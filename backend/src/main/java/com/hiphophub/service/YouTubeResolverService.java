package com.hiphophub.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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

    private static final Pattern VIDEO_RENDERER_PATTERN = Pattern.compile(
            "\"videoRenderer\"\\s*:\\s*\\{.*?\"videoId\":\"([A-Za-z0-9_-]{11})\"",
            Pattern.DOTALL);
    private static final Pattern FALLBACK_VIDEO_ID_PATTERN = Pattern.compile("\"videoId\":\"([A-Za-z0-9_-]{11})\"");
    private static final String WATCH_URL_PREFIX = "https://www.youtube.com/watch?v=";
    private static final String SEARCH_URL_PREFIX = "https://www.youtube.com/results?search_query=";

    private final RestTemplate restTemplate = new RestTemplate();
    private final ConcurrentMap<String, String> cache = new ConcurrentHashMap<>();

    public String resolveSongUrl(String artistName, String songTitle) {
        String artist = safe(artistName);
        String title = safe(songTitle);

        List<String> queries = List.of(
                artist + " " + title + " official video",
                artist + " " + title + " official audio",
                artist + " " + title + " lyric video",
                artist + " " + title);

        return resolveDirectUrl(queries);
    }

    public String resolveAlbumUrl(String artistName, String albumTitle) {
        String artist = safe(artistName);
        String title = safe(albumTitle);

        List<String> queries = List.of(
                artist + " " + title + " full album",
                artist + " " + title + " official album",
                artist + " " + title + " album");

        return resolveDirectUrl(queries);
    }

    private String resolveDirectUrl(List<String> queries) {
        for (String query : queries) {
            if (query == null || query.isBlank()) {
                continue;
            }
            String resolved = cache.computeIfAbsent(normalizeKey(query), key -> searchFirstVideoUrl(query));
            if (isDirectWatchUrl(resolved)) {
                return resolved;
            }
        }

        String fallbackQuery = queries.stream().filter(q -> q != null && !q.isBlank()).findFirst().orElse("");
        return SEARCH_URL_PREFIX + encode(fallbackQuery);
    }

    private String searchFirstVideoUrl(String query) {
        try {
            String url = SEARCH_URL_PREFIX + encode(query) + "&sp=EgIQAQ%253D%253D";
            HttpEntity<Void> request = new HttpEntity<>(defaultHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            String html = response.getBody();

            if (html == null || html.isBlank()) {
                return url;
            }

            String firstVideoId = extractFirstVideoId(html);
            if (firstVideoId == null) {
                return url;
            }
            return WATCH_URL_PREFIX + firstVideoId;
        } catch (Exception e) {
            return SEARCH_URL_PREFIX + encode(query);
        }
    }

    private String extractFirstVideoId(String html) {
        Set<String> ids = new LinkedHashSet<>();
        Matcher rendererMatcher = VIDEO_RENDERER_PATTERN.matcher(html);
        while (rendererMatcher.find()) {
            ids.add(rendererMatcher.group(1));
            if (ids.size() >= 5) {
                break;
            }
        }

        if (ids.isEmpty()) {
            Matcher fallbackMatcher = FALLBACK_VIDEO_ID_PATTERN.matcher(html);
            while (fallbackMatcher.find()) {
                ids.add(fallbackMatcher.group(1));
                if (ids.size() >= 5) {
                    break;
                }
            }
        }

        List<String> filtered = new ArrayList<>(ids);
        if (filtered.isEmpty()) {
            return null;
        }

        return filtered.get(0);
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
