package com.hiphophub.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hiphophub.dto.AINewsResponse;
import com.hiphophub.dto.NewsItemDTO;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Tour;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.TourRepository;
import com.hiphophub.util.DhhArtistClassifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.Comparator;
import java.util.stream.Collectors;

/**
 * Live DHH news service.
 *
 * Uses NewsAPI when a key is available and falls back to Google News RSS.
 * Categorization is rule-based (no paid LLM required).
 */
@Service
public class AINewsService {

    private final AlbumRepository albumRepository;
    private final TourRepository tourRepository;
    private final SongkickTourSyncService songkickTourSyncService;

    public AINewsService(AlbumRepository albumRepository,
                         TourRepository tourRepository,
                         SongkickTourSyncService songkickTourSyncService) {
        this.albumRepository = albumRepository;
        this.tourRepository = tourRepository;
        this.songkickTourSyncService = songkickTourSyncService;
    }

    @Value("${news.api.key:}")
    private String newsApiKey;

    @Value("${news.api.url:https://newsapi.org/v2/everything}")
    private String newsApiUrl;

    @Value("${news.api.query:desi hip hop OR indian hip hop OR hiphop india OR rap india OR desi rapper}")
    private String newsApiQuery;

    @Value("${news.api.domains:}")
    private String newsApiDomains;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    private static final int MAX_ITEMS = 12;
    private static final int MIN_ITEMS = 8;
    private static final Duration MAX_NEWS_AGE = Duration.ofHours(24);
    private static final int INTERNAL_RECENT_RELEASE_DAYS = 7;
    private static final int INTERNAL_FALLBACK_RELEASE_DAYS = 30;
    private static final int INTERNAL_UPCOMING_WINDOW_DAYS = 45;
    private static final String DEFAULT_BASE_QUERY =
            "(desi hip hop OR indian hip hop OR dhh OR rap india OR seedhe maut OR raftaar OR kr$na OR divine OR emiway OR ikka OR king OR mc stan)";
    private static final String BEEF_QUERY = DEFAULT_BASE_QUERY + " AND (beef OR diss OR feud OR clash OR subliminal)";
    private static final String RELEASE_QUERY = DEFAULT_BASE_QUERY + " AND (new single OR album OR EP OR mixtape OR dropped OR release OR music video)";
    private static final String TOUR_QUERY = DEFAULT_BASE_QUERY + " AND (tour OR concert OR tickets OR live show OR performance OR festival)";
    private static final String STATEMENT_QUERY = DEFAULT_BASE_QUERY + " AND (interview OR statement OR responds OR announced)";
    private static final String REDDIT_RSS_SEARCH_URL = "https://www.reddit.com/r/IndianHipHopHeads/search.rss";
    private static final List<String> DHH_KEYWORDS = List.of(
            "desi hip hop", "indian hip hop", "hip hop india", "hip-hop india", "dhh",
            "seedhe maut", "kr$na", "krsna", "raftaar", "divine", "emiway", "mc stan",
            "ikka", "badshah", "king", "karma", "paradox", "raga", "rawal", "prabh deep",
            "gravity", "nanku", "bharg", "dhanji", "siyaahi", "vichaar", "naam sujal"
    );
    private static final List<String> BEEF_KEYWORDS = List.of(
            "beef", "diss", "diss track", "feud", "clash", "shots fired", "war of words", "call out", "subliminal", "vs"
    );
    private static final List<String> TOUR_KEYWORDS = List.of(
            "tour", "concert", "gig", "tickets", "live show", "headline show", "festival", "performance", "show announcement", "rolling loud"
    );
    private static final List<String> RELEASE_KEYWORDS = List.of(
            "release", "releasing", "drops", "dropped", "album", "ep", "single", "mixtape", "track", "tracklist", "music video", "mv", "out now", "teaser", "preview"
    );
    private static final List<String> STATEMENT_KEYWORDS = List.of(
            "statement", "interview", "reacts", "responds", "addressed", "announced", "clarifies", "speaks on"
    );
    private static final Map<String, String> TAGS = new HashMap<>();

    static {
        TAGS.put("Beef", "Beef Alert");
        TAGS.put("Tours", "Tour Radar");
        TAGS.put("Releases", "Release Radar");
        TAGS.put("Statements", "Statement Watch");
        TAGS.put("Spotlight", "Scene Radar");
    }

    public AINewsResponse getLatestNews() {
        List<NewsItemDTO> stories = fetchLiveNews();
        if (stories.isEmpty()) {
            stories = getFallbackNews();
        }
        String updatedAt = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        return new AINewsResponse(stories, updatedAt);
    }

    private List<NewsItemDTO> fetchLiveNews() {
        List<RawNewsItem> raw = new ArrayList<>();
        fetchFromNewsApi().ifPresent(raw::addAll);
        if (raw.size() < 6) {
            fetchFromGoogleRss().ifPresent(raw::addAll);
        }
        fetchFromRedditRss().ifPresent(raw::addAll);

        LinkedHashMap<String, RawNewsItem> deduped = new LinkedHashMap<>();
        for (RawNewsItem item : raw) {
            String title = cleanText(item.title());
            String summary = cleanText(item.summary());
            if (title.isBlank()) {
                continue;
            }
            boolean relevant = isDhhRelevant(title + " " + summary) || isTrustedDhhSource(item.source());
            if (!relevant) {
                continue;
            }
            String category = resolveCategory(title + " " + summary);
            if (!isMajorUpdate(item, category)) {
                continue;
            }
            if (!isFreshNews(item.publishedAt())) {
                continue;
            }
            String key = normalize(title);
            if (!deduped.containsKey(key)) {
                deduped.put(key, item);
            }
            if (deduped.size() >= MAX_ITEMS) {
                break;
            }
        }

        List<RawNewsItem> ranked = deduped.values().stream()
                .sorted(Comparator
                        .comparingInt((RawNewsItem item) -> categoryPriority(resolveCategory(item.title() + " " + item.summary())))
                        .thenComparing((RawNewsItem item) -> parseInstant(item.publishedAt()), Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_ITEMS)
                .collect(Collectors.toList());

        List<NewsItemDTO> stories = new ArrayList<>();
        int counter = 1;
        for (RawNewsItem item : ranked) {
            String category = resolveCategory(item.title() + " " + item.summary());
            stories.add(new NewsItemDTO(
                    "news-" + counter++,
                    cleanText(item.title()),
                    buildSummary(item.summary()),
                    TAGS.getOrDefault(category, "Scene Radar"),
                    category,
                    toRelativeTime(item.publishedAt()),
                    cleanText(item.source()).isBlank() ? "Live feed" : cleanText(item.source())
            ));
        }

        List<NewsItemDTO> enriched = enrichWithInternalRadar(stories);
        for (int i = 0; i < enriched.size(); i++) {
            enriched.get(i).setId("news-" + (i + 1));
        }
        return enriched;
    }

    private Optional<List<RawNewsItem>> fetchFromNewsApi() {
        if (newsApiKey == null || newsApiKey.isBlank()) {
            return Optional.empty();
        }
        try {
            List<RawNewsItem> items = new ArrayList<>();
            for (String query : buildQuerySet()) {
                Optional<List<RawNewsItem>> queryItems = fetchNewsApiByQuery(query, 16);
                queryItems.ifPresent(items::addAll);
                if (items.size() >= 36) {
                    break;
                }
            }

            return items.isEmpty() ? Optional.empty() : Optional.of(items);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<List<RawNewsItem>> fetchFromGoogleRss() {
        try {
            List<RawNewsItem> items = new ArrayList<>();
            for (String query : buildQuerySet()) {
                Optional<List<RawNewsItem>> queryItems = fetchGoogleRssByQuery(query);
                queryItems.ifPresent(items::addAll);
                if (items.size() >= 36) {
                    break;
                }
            }

            return items.isEmpty() ? Optional.empty() : Optional.of(items);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<List<RawNewsItem>> fetchFromRedditRss() {
        try {
            List<RawNewsItem> items = new ArrayList<>();
            List<String> redditQueries = List.of(
                    "beef OR diss OR feud OR subliminal",
                    "release OR dropped OR single OR album OR ep OR mixtape",
                    "tour OR concert OR tickets OR show announcement"
            );

            for (String query : redditQueries) {
                Optional<List<RawNewsItem>> queryItems = fetchRedditRssByQuery(query);
                queryItems.ifPresent(items::addAll);
                if (items.size() >= 30) {
                    break;
                }
            }

            return items.isEmpty() ? Optional.empty() : Optional.of(items);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private List<NewsItemDTO> getFallbackNews() {
        List<NewsItemDTO> items = new ArrayList<>();
        items.add(new NewsItemDTO(
                "fallback-1",
                "No major DHH update in last 24 hours",
                "This feed is strict and only shows fresh stories from the previous day. It auto-refreshes every 2 minutes.",
                "Update Watch",
                "Releases",
                "Just now",
                "System"
        ));
        items.add(new NewsItemDTO(
                "fallback-2",
                "Monitoring beefs, tours, and releases",
                "As soon as a fresh item appears from trusted sources, it will replace this placeholder.",
                "Beef Alert",
                "Beef",
                "Just now",
                "System"
        ));
        return items;
    }

    private String resolveCategory(String text) {
        String value = text == null ? "" : text.toLowerCase(Locale.ROOT);
        if (containsAny(value, BEEF_KEYWORDS)) {
            return "Beef";
        }
        if (containsAny(value, TOUR_KEYWORDS)) {
            return "Tours";
        }
        if (containsAny(value, RELEASE_KEYWORDS)) {
            return "Releases";
        }
        if (containsAny(value, STATEMENT_KEYWORDS)) {
            return "Statements";
        }
        return "Spotlight";
    }

    private int categoryPriority(String category) {
        return switch (category) {
            case "Beef" -> 0;
            case "Releases" -> 1;
            case "Tours" -> 2;
            case "Statements" -> 3;
            default -> 4;
        };
    }

    private boolean isDhhRelevant(String text) {
        String value = text == null ? "" : text.toLowerCase(Locale.ROOT);
        boolean artistOrSceneKeyword = containsAny(value, DHH_KEYWORDS);
        boolean indiaAndHipHop = containsAny(value, List.of("hip hop", "hip-hop", "rapper", "rap"))
                && containsAny(value, List.of("india", "indian", "desi", "mumbai", "delhi", "punjab", "bengaluru", "kolkata", "hyderabad"));
        return artistOrSceneKeyword || indiaAndHipHop;
    }

    private boolean isTrustedDhhSource(String source) {
        if (source == null) {
            return false;
        }
        String value = source.toLowerCase(Locale.ROOT);
        return value.contains("indianhiphopheads")
                || value.contains("rolling stone india")
                || value.contains("homegrown")
                || value.contains("red bull")
                || value.contains("gq india");
    }

    private boolean isRedditSource(String source) {
        if (source == null) {
            return false;
        }
        return source.toLowerCase(Locale.ROOT).contains("reddit");
    }

    private boolean isMajorUpdate(RawNewsItem item, String category) {
        if (!List.of("Beef", "Releases", "Tours").contains(category)) {
            return false;
        }

        String titleLower = cleanText(item.title()).toLowerCase(Locale.ROOT);
        String combined = (item.title() + " " + item.summary()).toLowerCase(Locale.ROOT);
        boolean hasArtist = containsAny(combined, DHH_KEYWORDS);

        if (!isRedditSource(item.source())) {
            return true;
        }

        if (looksLikeLowSignalPost(combined)) {
            return false;
        }

        boolean hasArtistInTitle = containsAny(titleLower, DHH_KEYWORDS);

        boolean actionKeywordInTitle = switch (category) {
            case "Beef" -> containsAny(titleLower, BEEF_KEYWORDS);
            case "Releases" -> containsAny(titleLower, RELEASE_KEYWORDS);
            case "Tours" -> containsAny(titleLower, TOUR_KEYWORDS);
            default -> false;
        };

        return actionKeywordInTitle && hasArtistInTitle && hasArtist;
    }

    private boolean looksLikeLowSignalPost(String text) {
        return containsAny(text, List.of(
                "hot take", "opinion", "anyone", "suggestion", "blend please", "name suggestion",
                "rate my", "help me", "meme", "shitpost", "random thought", "what do you think",
                "dickrider", "prediction", "how many years", "biggest"
        ));
    }

    private boolean isFreshNews(String publishedAt) {
        Instant instant = parseInstant(publishedAt);
        if (instant == null) {
            return false;
        }
        Duration age = Duration.between(instant, Instant.now());
        if (age.isNegative()) {
            return true;
        }
        return age.compareTo(MAX_NEWS_AGE) <= 0;
    }

    private boolean containsAny(String text, List<String> keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String buildSummary(String raw) {
        String cleaned = cleanText(raw);
        if (cleaned.isBlank()) {
            return "Tap to read the latest DHH/Indian hip-hop update.";
        }
        String pruned = cleaned.replaceAll("\\[\\+\\d+ chars\\]$", "").trim();
        pruned = pruned.replaceAll("(?i)submitted by\\s+/u/\\S+\\s*\\[link\\]\\s*\\[comments\\]", "").trim();
        if (pruned.isBlank()) {
            return "Fresh DHH update detected from trusted community sources.";
        }
        if (pruned.length() > 220) {
            return pruned.substring(0, 217).trim() + "...";
        }
        return pruned;
    }

    private String cleanText(String input) {
        if (input == null) {
            return "";
        }
        String cleaned = input
                .replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replaceAll("&#\\d+;", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if ("null".equalsIgnoreCase(cleaned)) {
            return "";
        }
        return cleaned;
    }

    private String normalize(String title) {
        return cleanText(title)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private String toRelativeTime(String publishedAt) {
        Instant instant = parseInstant(publishedAt);
        if (instant == null) {
            return "Just now";
        }

        Duration duration = Duration.between(instant, Instant.now());
        if (duration.isNegative()) {
            return "Just now";
        }

        long minutes = duration.toMinutes();
        if (minutes < 1) {
            return "Just now";
        }
        if (minutes < 60) {
            return minutes + " min ago";
        }

        long hours = duration.toHours();
        if (hours < 24) {
            return hours + " hr ago";
        }

        long days = duration.toDays();
        if (days < 7) {
            return days + " d ago";
        }

        return DateTimeFormatter.ofPattern("dd MMM", Locale.ENGLISH)
                .format(instant.atOffset(OffsetDateTime.now().getOffset()));
    }

    private List<String> buildQuerySet() {
        List<String> queries = new ArrayList<>();
        String base = (newsApiQuery == null || newsApiQuery.isBlank()) ? DEFAULT_BASE_QUERY : newsApiQuery;
        queries.add(BEEF_QUERY);
        queries.add(RELEASE_QUERY);
        queries.add(TOUR_QUERY);
        queries.add(STATEMENT_QUERY);
        queries.add(base + " AND (release OR beef OR diss OR tour OR concert OR single OR album)");
        return queries;
    }

    private Optional<List<RawNewsItem>> fetchNewsApiByQuery(String query, int pageSize) {
        try {
            String domainsPart = (newsApiDomains != null && !newsApiDomains.isBlank())
                    ? "&domains=" + URLEncoder.encode(newsApiDomains, StandardCharsets.UTF_8)
                    : "";
            String from = Instant.now().minus(MAX_NEWS_AGE).toString();
            String url = String.format(Locale.ROOT,
                    "%s?q=%s&language=en&sortBy=publishedAt&pageSize=%d&from=%s%s&apiKey=%s",
                    newsApiUrl,
                    URLEncoder.encode(query, StandardCharsets.UTF_8),
                    pageSize,
                    URLEncoder.encode(from, StandardCharsets.UTF_8),
                    domainsPart,
                    URLEncoder.encode(newsApiKey, StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return Optional.empty();
            }

            JsonNode root = mapper.readTree(response.body());
            JsonNode articles = root.path("articles");
            if (!articles.isArray()) {
                return Optional.empty();
            }

            List<RawNewsItem> items = new ArrayList<>();
            for (JsonNode a : articles) {
                String title = cleanText(a.path("title").asText(""));
                if (title.isBlank()) {
                    continue;
                }
                String summary = cleanText(a.path("description").asText(""));
                if (summary.isBlank()) {
                    summary = cleanText(a.path("content").asText(""));
                }
                String source = cleanText(a.path("source").path("name").asText("NewsAPI"));
                String publishedAt = a.path("publishedAt").asText("");
                items.add(new RawNewsItem(title, summary, source, publishedAt));
            }
            return items.isEmpty() ? Optional.empty() : Optional.of(items);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<List<RawNewsItem>> fetchGoogleRssByQuery(String query) {
        try {
            String strictQuery = "(" + query + ") when:1d";
            String url = "https://news.google.com/rss/search?q="
                    + URLEncoder.encode(strictQuery, StandardCharsets.UTF_8)
                    + "&hl=en-IN&gl=IN&ceid=IN:en";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return Optional.empty();
            }

            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setExpandEntityReferences(false);
            dbf.setXIncludeAware(false);
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
            dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            Document doc = dbf.newDocumentBuilder()
                    .parse(new ByteArrayInputStream(response.body().getBytes(StandardCharsets.UTF_8)));
            NodeList nodes = doc.getElementsByTagName("item");
            if (nodes == null || nodes.getLength() == 0) {
                return Optional.empty();
            }

            List<RawNewsItem> items = new ArrayList<>();
            for (int i = 0; i < nodes.getLength(); i++) {
                Node node = nodes.item(i);
                if (!(node instanceof Element element)) {
                    continue;
                }

                String title = cleanText(getTagValue(element, "title"));
                String summary = cleanText(getTagValue(element, "description"));
                String source = cleanText(getTagValue(element, "source"));
                String publishedAt = cleanText(getTagValue(element, "pubDate"));

                if (title.contains(" - ")) {
                    int splitIndex = title.lastIndexOf(" - ");
                    if (splitIndex > 4) {
                        if (source.isBlank()) {
                            source = title.substring(splitIndex + 3).trim();
                        }
                        title = title.substring(0, splitIndex).trim();
                    }
                }

                if (title.isBlank()) {
                    continue;
                }

                if (source.isBlank()) {
                    source = "Google News";
                }

                items.add(new RawNewsItem(title, summary, source, publishedAt));
            }
            return items.isEmpty() ? Optional.empty() : Optional.of(items);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<List<RawNewsItem>> fetchRedditRssByQuery(String query) {
        try {
            String url = REDDIT_RSS_SEARCH_URL
                    + "?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
                    + "&restrict_sr=on&sort=new&t=day";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "HipHopHub/1.0")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return Optional.empty();
            }

            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setExpandEntityReferences(false);
            dbf.setXIncludeAware(false);
            dbf.setNamespaceAware(true);
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
            dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            Document doc = dbf.newDocumentBuilder()
                    .parse(new ByteArrayInputStream(response.body().getBytes(StandardCharsets.UTF_8)));

            NodeList nodes = doc.getElementsByTagNameNS("*", "entry");
            if (nodes == null || nodes.getLength() == 0) {
                nodes = doc.getElementsByTagName("entry");
            }
            if (nodes == null || nodes.getLength() == 0) {
                return Optional.empty();
            }

            List<RawNewsItem> items = new ArrayList<>();
            for (int i = 0; i < nodes.getLength(); i++) {
                Node node = nodes.item(i);
                if (!(node instanceof Element element)) {
                    continue;
                }

                String title = cleanText(getTagValueAnyNs(element, "title"));
                String summary = cleanText(getTagValueAnyNs(element, "summary"));
                if (summary.isBlank()) {
                    summary = cleanText(getTagValueAnyNs(element, "content"));
                }
                String publishedAt = cleanText(getTagValueAnyNs(element, "updated"));
                if (publishedAt.isBlank()) {
                    publishedAt = cleanText(getTagValueAnyNs(element, "published"));
                }

                if (title.isBlank()) {
                    continue;
                }

                String source = "Reddit r/IndianHipHopHeads";
                items.add(new RawNewsItem(title, summary, source, publishedAt));
            }
            return items.isEmpty() ? Optional.empty() : Optional.of(items);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private List<NewsItemDTO> enrichWithInternalRadar(List<NewsItemDTO> stories) {
        List<NewsItemDTO> merged = new ArrayList<>(stories);
        Set<String> seenTitles = new HashSet<>();
        for (NewsItemDTO story : merged) {
            seenTitles.add(normalize(story.getTitle()));
        }

        LocalDate today = LocalDate.now();
        if (merged.size() < MIN_ITEMS) {
            appendUpcomingTours(merged, seenTitles, today);
        }
        if (merged.size() < MIN_ITEMS) {
            appendRecentReleases(merged, seenTitles, today, INTERNAL_RECENT_RELEASE_DAYS);
        }
        if (merged.size() < MIN_ITEMS) {
            appendUpcomingReleases(merged, seenTitles, today);
        }
        if (merged.size() < MIN_ITEMS) {
            appendRecentReleases(merged, seenTitles, today, INTERNAL_FALLBACK_RELEASE_DAYS);
        }

        if (merged.size() > MAX_ITEMS) {
            return new ArrayList<>(merged.subList(0, MAX_ITEMS));
        }
        return merged;
    }

    private void appendUpcomingTours(List<NewsItemDTO> stories, Set<String> seenTitles, LocalDate today) {
        songkickTourSyncService.triggerSyncIfDueAsync();
        List<Tour> tours = tourRepository.findUpcomingTours(today);
        for (Tour tour : tours) {
            if (stories.size() >= MIN_ITEMS) {
                return;
            }
            if (tour.getArtist() == null || !isDhhArtist(tour.getArtist())) {
                continue;
            }
            if (tour.getEventDate() == null) {
                continue;
            }
            if (ChronoUnit.DAYS.between(today, tour.getEventDate()) > INTERNAL_UPCOMING_WINDOW_DAYS) {
                continue;
            }

            String artistName = tour.getArtist().getName();
            String city = cleanText(tour.getCity());
            String venue = cleanText(tour.getVenue());
            String title = artistName + " tour update: " + city;
            if (!seenTitles.add(normalize(title))) {
                continue;
            }

            String summary = venue.isBlank()
                    ? "Upcoming show date announced for " + city + "."
                    : "Live show at " + venue + ", " + city + ".";
            stories.add(new NewsItemDTO(
                    "",
                    title,
                    summary,
                    "Tour Radar",
                    "Tours",
                    relativeFromDate(tour.getEventDate()),
                    "HipHopHub tour tracker"
            ));
        }
    }

    private void appendRecentReleases(List<NewsItemDTO> stories, Set<String> seenTitles, LocalDate today, int windowDays) {
        List<Album> releases = albumRepository.findLatestReleases(today.minusDays(windowDays));
        for (Album album : releases) {
            if (stories.size() >= MIN_ITEMS) {
                return;
            }
            if (album.getArtist() == null || !isDhhArtist(album.getArtist())) {
                continue;
            }
            if (album.getReleaseDate() == null || album.getReleaseDate().isAfter(today)) {
                continue;
            }

            String artistName = album.getArtist().getName();
            String albumTitle = cleanText(album.getTitle());
            String title = artistName + " release: " + albumTitle;
            if (!seenTitles.add(normalize(title))) {
                continue;
            }

            String type = album.getType() != null ? album.getType().name() : "Release";
            String summary = type + " dropped on " + album.getReleaseDate() + ".";
            stories.add(new NewsItemDTO(
                    "",
                    title,
                    summary,
                    "Release Radar",
                    "Releases",
                    relativeFromDate(album.getReleaseDate()),
                    "HipHopHub release index"
            ));
        }
    }

    private void appendUpcomingReleases(List<NewsItemDTO> stories, Set<String> seenTitles, LocalDate today) {
        List<Album> upcoming = albumRepository.findUpcomingReleases(today);
        for (Album album : upcoming) {
            if (stories.size() >= MIN_ITEMS) {
                return;
            }
            if (album.getArtist() == null || !isDhhArtist(album.getArtist())) {
                continue;
            }
            if (album.getReleaseDate() == null) {
                continue;
            }
            if (ChronoUnit.DAYS.between(today, album.getReleaseDate()) > INTERNAL_UPCOMING_WINDOW_DAYS) {
                continue;
            }

            String artistName = album.getArtist().getName();
            String albumTitle = cleanText(album.getTitle());
            String title = artistName + " upcoming release: " + albumTitle;
            if (!seenTitles.add(normalize(title))) {
                continue;
            }

            String type = album.getType() != null ? album.getType().name() : "Release";
            String summary = type + " expected on " + album.getReleaseDate() + ".";
            stories.add(new NewsItemDTO(
                    "",
                    title,
                    summary,
                    "Release Radar",
                    "Releases",
                    relativeFromDate(album.getReleaseDate()),
                    "HipHopHub release index"
            ));
        }
    }

    private Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
        }

        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ignored) {
        }

        try {
            return DateTimeFormatter.RFC_1123_DATE_TIME.parse(value, Instant::from);
        } catch (DateTimeParseException ignored) {
        }

        return null;
    }

    private String relativeFromDate(LocalDate date) {
        if (date == null) {
            return "Soon";
        }
        LocalDate today = LocalDate.now();
        long days = ChronoUnit.DAYS.between(today, date);
        if (days == 0) {
            return "Today";
        }
        if (days > 0) {
            return "in " + days + " d";
        }
        return Math.abs(days) + " d ago";
    }

    private boolean isDhhArtist(Artist artist) {
        return artist != null && DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre());
    }

    private String getTagValue(Element element, String tagName) {
        NodeList list = element.getElementsByTagName(tagName);
        if (list == null || list.getLength() == 0) {
            return "";
        }
        Node value = list.item(0);
        return value == null ? "" : value.getTextContent();
    }

    private String getTagValueAnyNs(Element element, String tagName) {
        NodeList list = element.getElementsByTagNameNS("*", tagName);
        if (list == null || list.getLength() == 0) {
            list = element.getElementsByTagName(tagName);
        }
        if (list == null || list.getLength() == 0) {
            return "";
        }
        Node value = list.item(0);
        return value == null ? "" : value.getTextContent();
    }

    private record RawNewsItem(String title, String summary, String source, String publishedAt) {
    }
}
