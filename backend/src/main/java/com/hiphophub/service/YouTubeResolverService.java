package com.hiphophub.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class YouTubeResolverService {

    private record OEmbedResponse(String title, String authorName) {
    }

    private static final Pattern VIDEO_RENDERER_PATTERN = Pattern.compile(
            "\"videoRenderer\"\\s*:\\s*\\{.*?\"videoId\":\"([A-Za-z0-9_-]{11})\"",
            Pattern.DOTALL);
    private static final Pattern FALLBACK_VIDEO_ID_PATTERN = Pattern.compile("\"videoId\":\"([A-Za-z0-9_-]{11})\"");
    private static final String WATCH_URL_PREFIX = "https://www.youtube.com/watch?v=";
    private static final String SEARCH_URL_PREFIX = "https://www.youtube.com/results?search_query=";
    private static final String OEMBED_URL_PREFIX = "https://www.youtube.com/oembed?format=json&url=";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ConcurrentMap<String, String> cache = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, OEmbedResponse> oEmbedCache = new ConcurrentHashMap<>();

    public String resolveSongUrl(String artistName, String songTitle) {
        String artist = safe(artistName);
        String title = safe(songTitle);
        String strippedTitle = stripDecorators(title);

        List<String> queries = buildSongQueries(artist, title, strippedTitle);

        return resolveDirectUrl(queries, artist, title);
    }

    public String resolveAlbumUrl(String artistName, String albumTitle) {
        String artist = safe(artistName);
        String title = safe(albumTitle);

        List<String> queries = List.of(
                artist + " " + title + " full album",
                artist + " " + title + " official album",
                artist + " " + title + " album");

        return resolveDirectUrl(queries, artist, title);
    }

    private String resolveDirectUrl(List<String> queries, String artistName, String targetTitle) {
        for (String query : queries) {
            if (query == null || query.isBlank()) {
                continue;
            }
            String resolved = cache.computeIfAbsent(
                    normalizeKey(query),
                    key -> searchBestVideoUrl(query, artistName, targetTitle));
            if (isDirectWatchUrl(resolved)) {
                return resolved;
            }
        }

        String fallbackQuery = queries.stream().filter(q -> q != null && !q.isBlank()).findFirst().orElse("");
        return SEARCH_URL_PREFIX + encode(fallbackQuery);
    }

    private List<String> buildSongQueries(String artist, String title, String strippedTitle) {
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        addSongQueryVariants(queries, artist, title);
        if (!strippedTitle.isBlank() && !strippedTitle.equalsIgnoreCase(title)) {
            addSongQueryVariants(queries, artist, strippedTitle);
        }
        return new ArrayList<>(queries);
    }

    private void addSongQueryVariants(Set<String> queries, String artist, String title) {
        if (title == null || title.isBlank()) {
            return;
        }
        queries.add((artist + " " + title + " official video").trim());
        queries.add((artist + " " + title + " official audio").trim());
        queries.add((artist + " " + title + " lyric video").trim());
        queries.add((artist + " " + title).trim());
    }

    private String searchBestVideoUrl(String query, String artistName, String targetTitle) {
        try {
            String url = SEARCH_URL_PREFIX + encode(query) + "&sp=EgIQAQ%253D%253D";
            HttpEntity<Void> request = new HttpEntity<>(defaultHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            String html = response.getBody();

            if (html == null || html.isBlank()) {
                return url;
            }

            List<String> candidateIds = extractCandidateVideoIds(html);
            if (candidateIds.isEmpty()) {
                return url;
            }
            return candidateIds.stream()
                    .map(videoId -> new ScoredVideo(videoId, scoreVideo(videoId, artistName, targetTitle)))
                    .max(Comparator.comparingInt(ScoredVideo::score))
                    .filter(scored -> scored.score() > Integer.MIN_VALUE)
                    .map(scored -> WATCH_URL_PREFIX + scored.videoId())
                    .orElse(url);
        } catch (Exception e) {
            return SEARCH_URL_PREFIX + encode(query);
        }
    }

    private record ScoredVideo(String videoId, int score) {
    }

    private List<String> extractCandidateVideoIds(String html) {
        Set<String> ids = new LinkedHashSet<>();
        Matcher rendererMatcher = VIDEO_RENDERER_PATTERN.matcher(html);
        while (rendererMatcher.find()) {
            ids.add(rendererMatcher.group(1));
            if (ids.size() >= 12) {
                break;
            }
        }

        if (ids.isEmpty()) {
            Matcher fallbackMatcher = FALLBACK_VIDEO_ID_PATTERN.matcher(html);
            while (fallbackMatcher.find()) {
                ids.add(fallbackMatcher.group(1));
                if (ids.size() >= 12) {
                    break;
                }
            }
        }

        return new ArrayList<>(ids);
    }

    private int scoreVideo(String videoId, String artistName, String targetTitle) {
        OEmbedResponse metadata = fetchOEmbed(videoId);
        if (metadata == null) {
            return Integer.MIN_VALUE;
        }

        String normalizedArtist = normalizeComparable(artistName);
        String normalizedTitle = normalizeComparable(targetTitle);
        String compactArtist = normalizeKey(artistName);
        String compactTitle = normalizeKey(stripDecorators(targetTitle));
        String title = safe(metadata.title());
        String author = safe(metadata.authorName());
        String normalizedVideoTitle = normalizeComparable(title);
        String normalizedAuthor = normalizeComparable(author);
        String compactVideoTitle = normalizeKey(title);
        String compactAuthor = normalizeKey(author);

        int score = 0;

        if (!compactTitle.isBlank() && compactVideoTitle.contains(compactTitle)) {
            score += 180;
        }
        if (!normalizedTitle.isBlank() && containsAllTokens(normalizedVideoTitle, normalizedTitle)) {
            score += 120;
        }
        if (!compactArtist.isBlank() && (compactVideoTitle.contains(compactArtist) || compactAuthor.contains(compactArtist))) {
            score += 100;
        }
        if (!normalizedArtist.isBlank() && containsAllTokens(normalizedAuthor, normalizedArtist)) {
            score += 80;
        }
        if (normalizedVideoTitle.contains("official")) {
            score += 35;
        }
        if (normalizedVideoTitle.contains("audio")) {
            score += 12;
        }
        if (normalizedVideoTitle.contains("video")) {
            score += 10;
        }
        if (normalizedAuthor.contains("topic") || normalizedAuthor.contains("vevo")) {
            score += 20;
        }

        if (normalizedVideoTitle.contains("mixed")
                || normalizedVideoTitle.contains("remix")
                || normalizedVideoTitle.contains("dj mix")) {
            score -= 160;
        }
        if (normalizedVideoTitle.contains("slowed")
                || normalizedVideoTitle.contains("reverb")
                || normalizedVideoTitle.contains("8d")) {
            score -= 140;
        }

        return score;
    }

    private OEmbedResponse fetchOEmbed(String videoId) {
        if (videoId == null || videoId.isBlank()) {
            return null;
        }
        return oEmbedCache.computeIfAbsent(videoId, this::requestOEmbed);
    }

    private OEmbedResponse requestOEmbed(String videoId) {
        try {
            String watchUrl = WATCH_URL_PREFIX + videoId;
            String url = OEMBED_URL_PREFIX + encode(watchUrl);
            HttpEntity<Void> request = new HttpEntity<>(defaultHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            String body = response.getBody();
            if (body == null || body.isBlank()) {
                return null;
            }
            JsonNode json = objectMapper.readTree(body);
            String title = json.path("title").asText("");
            String author = json.path("author_name").asText("");
            if (title.isBlank() && author.isBlank()) {
                return null;
            }
            return new OEmbedResponse(title, author);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean containsAllTokens(String haystack, String normalizedTarget) {
        if (haystack == null || haystack.isBlank() || normalizedTarget == null || normalizedTarget.isBlank()) {
            return false;
        }
        for (String token : normalizedTarget.split("\\s+")) {
            if (token.isBlank()) {
                continue;
            }
            if (!haystack.contains(token)) {
                return false;
            }
        }
        return true;
    }

    private String stripDecorators(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\(.*?\\)", " ")
                .replaceAll("\\[.*?\\]", " ")
                .replaceAll("(?i)feat\\.?[^-]*", " ")
                .trim();
    }

    private String normalizeComparable(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private HttpHeaders defaultHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set("Accept-Language", "en-US,en;q=0.9");
        return headers;
    }

    private boolean isDirectWatchUrl(String value) {
        return value != null && value.startsWith(WATCH_URL_PREFIX);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeKey(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }
}
