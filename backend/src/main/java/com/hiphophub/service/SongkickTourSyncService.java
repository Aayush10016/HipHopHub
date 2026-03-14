package com.hiphophub.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Tour;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.TourRepository;
import com.hiphophub.util.DhhArtistClassifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SongkickTourSyncService {

    private static final Logger log = LoggerFactory.getLogger(SongkickTourSyncService.class);
    private static final Pattern ARTIST_PATH_PATTERN = Pattern.compile("/artists/\\d+-[a-z0-9\\-]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern JSON_LD_PATTERN = Pattern.compile(
            "<script\\s+type=\"application/ld\\+json\">(.*?)</script>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final ArtistRepository artistRepository;
    private final TourRepository tourRepository;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final Object syncLock = new Object();
    private volatile Instant lastSyncAttempt = Instant.EPOCH;
    private final AtomicBoolean syncInProgress = new AtomicBoolean(false);

    @Value("${tour.sync.enabled:true}")
    private boolean tourSyncEnabled;

    @Value("${tour.sync.interval.hours:6}")
    private long syncIntervalHours;

    @Value("${tour.sync.max.artists:20}")
    private int maxArtistsPerSync;

    @Value("${tour.sync.max.events.per.artist:6}")
    private int maxEventsPerArtist;

    public SongkickTourSyncService(ArtistRepository artistRepository, TourRepository tourRepository) {
        this.artistRepository = artistRepository;
        this.tourRepository = tourRepository;
    }

    public void syncIfDue() {
        if (!tourSyncEnabled) {
            return;
        }

        Instant now = Instant.now();
        if (Duration.between(lastSyncAttempt, now).toHours() < syncIntervalHours) {
            return;
        }

        synchronized (syncLock) {
            now = Instant.now();
            if (Duration.between(lastSyncAttempt, now).toHours() < syncIntervalHours) {
                return;
            }
            if (!syncInProgress.compareAndSet(false, true)) {
                return;
            }
            lastSyncAttempt = now;
            try {
                runSync();
            } finally {
                syncInProgress.set(false);
            }
        }
    }

    public void forceSyncNow() {
        synchronized (syncLock) {
            if (!syncInProgress.compareAndSet(false, true)) {
                return;
            }
            lastSyncAttempt = Instant.now();
            try {
                runSync();
            } finally {
                syncInProgress.set(false);
            }
        }
    }

    public void triggerSyncIfDueAsync() {
        if (!tourSyncEnabled) {
            return;
        }
        Instant now = Instant.now();
        if (Duration.between(lastSyncAttempt, now).toHours() < syncIntervalHours) {
            return;
        }
        if (!syncInProgress.compareAndSet(false, true)) {
            return;
        }

        Thread worker = new Thread(() -> {
            try {
                synchronized (syncLock) {
                    Instant check = Instant.now();
                    if (Duration.between(lastSyncAttempt, check).toHours() < syncIntervalHours) {
                        return;
                    }
                    lastSyncAttempt = check;
                    runSync();
                }
            } finally {
                syncInProgress.set(false);
            }
        }, "songkick-tour-sync");
        worker.setDaemon(true);
        worker.start();
    }

    private void runSync() {
        try {
            List<Artist> candidates = artistRepository.findAll().stream()
                    .filter(artist -> DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre()))
                    .sorted(Comparator.comparing(
                            (Artist artist) -> artist.getMonthlyListeners() == null ? 0L : artist.getMonthlyListeners())
                            .reversed())
                    .limit(maxArtistsPerSync)
                    .toList();

            int saved = 0;
            for (Artist artist : candidates) {
                Optional<String> artistUrl = resolveArtistUrl(artist.getName());
                if (artistUrl.isEmpty()) {
                    continue;
                }

                List<TourCandidate> events = fetchArtistEvents(artistUrl.get(), artist.getName());
                if (events.isEmpty()) {
                    continue;
                }

                saved += persistTours(artist, events);
            }
            log.info("Songkick tour sync complete. New tours saved: {}", saved);
        } catch (Exception ex) {
            log.warn("Songkick tour sync failed: {}", ex.getMessage());
        }
    }

    private Optional<String> resolveArtistUrl(String artistName) {
        try {
            String url = "https://www.songkick.com/search?query="
                    + URLEncoder.encode(artistName, StandardCharsets.UTF_8);
            String html = fetchText(url);
            if (html.isBlank()) {
                return Optional.empty();
            }

            Matcher matcher = ARTIST_PATH_PATTERN.matcher(html);
            String bestPath = null;
            int bestScore = Integer.MIN_VALUE;
            while (matcher.find()) {
                String path = matcher.group();
                int score = scoreCandidate(path, artistName);
                if (score > bestScore) {
                    bestScore = score;
                    bestPath = path;
                }
            }

            if (bestPath == null || bestScore < 35) {
                return Optional.empty();
            }
            return Optional.of("https://www.songkick.com" + bestPath);
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private int scoreCandidate(String artistPath, String artistName) {
        int slugStart = artistPath.lastIndexOf('-');
        String slug = slugStart > 0 ? artistPath.substring(slugStart + 1) : artistPath;
        String normalizedArtist = normalize(artistName);
        String normalizedSlug = normalize(slug);
        if (normalizedArtist.isBlank() || normalizedSlug.isBlank()) {
            return 0;
        }

        int score = 0;
        if (normalizedArtist.equals(normalizedSlug)) {
            score += 120;
        }
        if (normalizedSlug.contains(normalizedArtist) || normalizedArtist.contains(normalizedSlug)) {
            score += 70;
        }

        String[] tokens = artistName.toLowerCase(Locale.ROOT).split("[^a-z0-9]+");
        for (String token : tokens) {
            if (token.length() < 3) {
                continue;
            }
            if (normalizedSlug.contains(token)) {
                score += 20;
            }
        }
        return score;
    }

    private List<TourCandidate> fetchArtistEvents(String artistUrl, String artistName) {
        List<TourCandidate> candidates = new ArrayList<>();
        try {
            String html = fetchText(artistUrl);
            if (html.isBlank()) {
                return candidates;
            }

            Matcher matcher = JSON_LD_PATTERN.matcher(html);
            Set<String> dedupe = new HashSet<>();
            while (matcher.find()) {
                String json = decodeHtml(matcher.group(1));
                List<JsonNode> payloads = parseJsonPayloads(json);
                for (JsonNode payload : payloads) {
                    if (!"MusicEvent".equalsIgnoreCase(payload.path("@type").asText(""))) {
                        continue;
                    }
                    TourCandidate candidate = toCandidate(payload, artistName);
                    if (candidate == null) {
                        continue;
                    }
                    String key = normalize(candidate.venue()) + "|" + normalize(candidate.city()) + "|" + candidate.eventDate();
                    if (dedupe.add(key)) {
                        candidates.add(candidate);
                    }
                }
            }
        } catch (Exception ex) {
            log.debug("Songkick parse failed for {}: {}", artistName, ex.getMessage());
        }

        return candidates.stream()
                .sorted(Comparator.comparing(TourCandidate::eventDate))
                .limit(maxEventsPerArtist)
                .toList();
    }

    private List<JsonNode> parseJsonPayloads(String json) {
        List<JsonNode> nodes = new ArrayList<>();
        try {
            JsonNode root = mapper.readTree(json);
            if (root.isArray()) {
                for (JsonNode node : root) {
                    nodes.add(node);
                }
            } else if (root.isObject()) {
                nodes.add(root);
            }
        } catch (Exception ignored) {
        }
        return nodes;
    }

    private TourCandidate toCandidate(JsonNode eventNode, String artistName) {
        LocalDate eventDate = parseEventDate(eventNode.path("startDate").asText(""));
        if (eventDate == null || eventDate.isBefore(LocalDate.now())) {
            return null;
        }

        JsonNode location = eventNode.path("location");
        JsonNode address = location.path("address");

        String venue = clean(location.path("name").asText(""));
        String city = clean(address.path("addressLocality").asText(""));
        String country = clean(address.path("addressCountry").asText(""));
        if (venue.isBlank()) {
            String eventName = clean(eventNode.path("name").asText(""));
            venue = eventName.replace(artistName, "").replace("@", "").trim();
        }
        if (city.isBlank()) {
            city = "Unknown City";
        }
        if (country.isBlank()) {
            country = "Unknown";
        }
        if (venue.isBlank()) {
            venue = "TBA Venue";
        }

        String ticketUrl = clean(eventNode.path("url").asText(""));
        JsonNode offers = eventNode.path("offers");
        if (offers.isArray() && !offers.isEmpty()) {
            String offerUrl = clean(offers.get(0).path("url").asText(""));
            if (!offerUrl.isBlank()) {
                ticketUrl = offerUrl;
            }
        }

        return new TourCandidate(venue, city, country, eventDate, ticketUrl);
    }

    private int persistTours(Artist artist, List<TourCandidate> candidates) {
        List<Tour> existing = tourRepository.findUpcomingToursByArtist(artist.getId(), LocalDate.now());
        Set<String> keys = new HashSet<>();
        for (Tour tour : existing) {
            String key = normalize(tour.getVenue()) + "|" + normalize(tour.getCity()) + "|" + tour.getEventDate();
            keys.add(key);
        }

        int saved = 0;
        for (TourCandidate candidate : candidates) {
            String key = normalize(candidate.venue()) + "|" + normalize(candidate.city()) + "|" + candidate.eventDate();
            if (keys.contains(key)) {
                continue;
            }

            Tour tour = new Tour();
            tour.setArtist(artist);
            tour.setVenue(candidate.venue());
            tour.setCity(candidate.city());
            tour.setCountry(candidate.country());
            tour.setEventDate(candidate.eventDate());
            tour.setTicketUrl(candidate.ticketUrl());
            tour.setCreatedAt(LocalDateTime.now());
            tour.setUpdatedAt(LocalDateTime.now());
            tourRepository.save(tour);

            keys.add(key);
            saved++;
        }
        return saved;
    }

    private String fetchText(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(12))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            return "";
        }
        return response.body();
    }

    private LocalDate parseEventDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toLocalDate();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDateTime.parse(value).toLocalDate();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ignored) {
        }
        return null;
    }

    private String decodeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&quot;", "\"")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&#39;", "'");
    }

    private String clean(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private record TourCandidate(String venue, String city, String country, LocalDate eventDate, String ticketUrl) {
    }
}
