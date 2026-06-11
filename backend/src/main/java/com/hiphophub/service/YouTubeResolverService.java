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
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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
    private static final java.util.Map<String, String> ARTIST_QUERY_ALIASES = buildArtistQueryAliases();

    private final RestTemplate restTemplate = buildRestTemplate();
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

        String artistAlias = artistQueryAlias(artist);
        LinkedHashSet<String> queries = new LinkedHashSet<>();
        addAlbumQueryVariants(queries, artist, title);
        if (!artistAlias.equalsIgnoreCase(artist)) {
            addAlbumQueryVariants(queries, artistAlias, title);
        }

        return resolveDirectUrl(new ArrayList<>(queries), artist, title);
    }

    private String resolveDirectUrl(List<String> queries, String artistName, String targetTitle) {
        for (String query : queries) {
            if (query == null || query.isBlank()) {
                continue;
            }
            String cacheKey = normalizeKey(query);
            String resolved = cache.get(cacheKey);
            if (!isDirectWatchUrl(resolved)) {
                resolved = searchBestVideoUrl(query, artistName, targetTitle);
                if (isDirectWatchUrl(resolved)) {
                    cache.put(cacheKey, resolved);
                } else {
                    cache.remove(cacheKey);
                }
            }
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
        String artistAlias = artistQueryAlias(artist);
        if (!artistAlias.equalsIgnoreCase(artist)) {
            addSongQueryVariants(queries, artistAlias, title);
        }
        if (!strippedTitle.isBlank() && !strippedTitle.equalsIgnoreCase(title)) {
            addSongQueryVariants(queries, artist, strippedTitle);
            if (!artistAlias.equalsIgnoreCase(artist)) {
                addSongQueryVariants(queries, artistAlias, strippedTitle);
            }
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

    private void addAlbumQueryVariants(Set<String> queries, String artist, String title) {
        if (title == null || title.isBlank()) {
            return;
        }
        queries.add((artist + " " + title + " full album").trim());
        queries.add((artist + " " + title + " official album").trim());
        queries.add((artist + " " + title + " album").trim());
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
                    .map(videoId -> buildScoredVideo(videoId, artistName, targetTitle))
                    .max(Comparator.comparingInt(ScoredVideo::score))
                    .filter(scored -> scored.score() >= 200 && scored.strongTitleMatch())
                    .map(scored -> WATCH_URL_PREFIX + scored.videoId())
                    .orElse(url);
        } catch (Exception e) {
            return SEARCH_URL_PREFIX + encode(query);
        }
    }

    private record ScoredVideo(String videoId, int score, boolean strongTitleMatch) {
    }

    private ScoredVideo buildScoredVideo(String videoId, String artistName, String targetTitle) {
        int score = scoreVideo(videoId, artistName, targetTitle);
        OEmbedResponse metadata = fetchOEmbed(videoId);
        if (metadata == null) {
            return new ScoredVideo(videoId, Integer.MIN_VALUE, false);
        }

        String title = safe(metadata.title());
        String normalizedVideoTitle = normalizeComparable(title);
        String compactVideoTitle = normalizeKey(title);
        String normalizedTitle = normalizeComparable(targetTitle);
        String compactTitle = normalizeKey(stripDecorators(targetTitle));

        boolean strongTitleMatch = (!compactTitle.isBlank() && compactVideoTitle.contains(compactTitle))
                || (!normalizedTitle.isBlank() && containsAllTokens(normalizedVideoTitle, normalizedTitle));

        return new ScoredVideo(videoId, score, strongTitleMatch);
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

    private String artistQueryAlias(String artistName) {
        String alias = ARTIST_QUERY_ALIASES.get(normalizeComparable(artistName));
        return alias == null || alias.isBlank() ? safe(artistName) : alias;
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(7000);
        return new RestTemplate(factory);
    }

    private static java.util.Map<String, String> buildArtistQueryAliases() {
        java.util.Map<String, String> aliases = new java.util.HashMap<>();
        aliases.put("ab17", "ab17 rapper india");
        aliases.put("agsy", "Agsy rapper india");
        aliases.put("ahmer", "Ahmer rapper india");
        aliases.put("bagi munda", "BAGI MUNDA rapper india");
        aliases.put("bella", "Bella rapper india");
        aliases.put("brodha v", "Brodha V rapper india");
        aliases.put("king", "King rapper india");
        aliases.put("karma", "Karma rapper india");
        aliases.put("calm", "Calm Seedhe Maut");
        aliases.put("chaar diwaari", "Chaar Diwaari rapper india");
        aliases.put("d evil", "D Evil rapper india");
        aliases.put("dee mc", "Dee MC rapper india");
        aliases.put("deep kalsi", "Deep Kalsi official");
        aliases.put("dhanji", "Dhanji rapper india");
        aliases.put("dino james", "Dino James official");
        aliases.put("divine", "DIVINE rapper india");
        aliases.put("dopeadelicz", "Dopeadelicz rapper india");
        aliases.put("drv", "DRV rapper india");
        aliases.put("encore abj", "Encore ABJ Seedhe Maut");
        aliases.put("gravity", "Gravity rapper india");
        aliases.put("naam sujal", "Naam Sujal rapper india");
        aliases.put("panther", "Panther rapper india");
        aliases.put("nanku", "Nanku rapper india");
        aliases.put("rawal", "Rawal rapper india");
        aliases.put("riar saab", "Riar Saab official");
        aliases.put("sambata", "SAMBATA rapper india");
        aliases.put("shah rule", "Shah Rule rapper india");
        aliases.put("sos", "SOS kashmir hip hop");
        aliases.put("dakait shaddy", "Dakait Shaddy rapper india");
        aliases.put("the siege", "The Siege rapper india");
        aliases.put("mc kode", "MC Kode rapper india");
        aliases.put("mc headshot", "MC Headshot rapper india");
        aliases.put("mrunal shankar", "Mrunal Shankar rapper india");
        aliases.put("wolf cryman", "wolf.cryman rapper india");
        aliases.put("wolf.cryman", "wolf.cryman rapper india");
        aliases.put("yashraj", "YashRaj rapper india");
        return aliases;
    }
}
