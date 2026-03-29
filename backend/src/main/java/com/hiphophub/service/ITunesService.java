package com.hiphophub.service;

import com.hiphophub.dto.ITunesSearchResponse;
import com.hiphophub.dto.ITunesTrackDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ITunesService {

    private static final Logger log = LoggerFactory.getLogger(ITunesService.class);
    private static final Set<String> STRICT_EXACT_ARTISTS = Set.of("king", "ikka", "karma", "sm");

    @Value("${itunes.api.url:https://itunes.apple.com/search}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<ITunesTrackDTO> searchTracksByArtist(String artistName, int limit) {
        String cleaned = normalizeName(artistName);

        List<ITunesTrackDTO> tracks = fetchTracks(artistName, cleaned, limit, "IN", true);
        if (tracks.isEmpty()) {
            tracks = fetchTracks(artistName, cleaned, limit, "US", true);
        }
        if (tracks.isEmpty() && !cleaned.equalsIgnoreCase(artistName)) {
            tracks = fetchTracks(cleaned, cleaned, limit, "IN", true);
        }
        if (tracks.isEmpty() && !cleaned.equalsIgnoreCase(artistName)) {
            tracks = fetchTracks(cleaned, cleaned, limit, "US", true);
        }
        if (tracks.isEmpty()) {
            tracks = fetchTracks(artistName, cleaned, limit, "IN", false);
        }
        if (tracks.isEmpty()) {
            tracks = fetchTracks(artistName, cleaned, limit, "US", false);
        }

        return tracks;
    }

    public List<ITunesTrackDTO> lookupTracksByArtistId(Long artistId, int limit, String country) {
        if (artistId == null || artistId <= 0) {
            return Collections.emptyList();
        }
        try {
            StringBuilder url = new StringBuilder("https://itunes.apple.com/lookup?id=")
                    .append(artistId)
                    .append("&entity=song")
                    .append("&limit=").append(limit)
                    .append("&country=").append(country == null || country.isBlank() ? "IN" : country);

            HttpEntity<Void> entity = new HttpEntity<>(null, defaultHeaders());
            ResponseEntity<String> response = restTemplate.exchange(
                    url.toString(),
                    HttpMethod.GET,
                    entity,
                    String.class);

            String rawBody = response.getBody();
            if (rawBody == null || rawBody.isBlank()) {
                return Collections.emptyList();
            }

            ITunesSearchResponse body = objectMapper.readValue(rawBody, ITunesSearchResponse.class);
            if (body == null || body.getResults() == null) {
                return Collections.emptyList();
            }

            return body.getResults().stream()
                    .filter(track -> "track".equalsIgnoreCase(track.getWrapperType()))
                    .filter(track -> "song".equalsIgnoreCase(track.getKind()))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("iTunes lookup failed. artistId='{}', country='{}', error={}", artistId, country, e.getMessage());
            return Collections.emptyList();
        }
    }

    private List<ITunesTrackDTO> fetchTracks(String termName, String normalizedArtist, int limit, String country, boolean strictArtistAttr) {
        try {
            String term = URLEncoder.encode(termName, StandardCharsets.UTF_8);
            StringBuilder url = new StringBuilder(apiUrl)
                    .append("?term=").append(term)
                    .append("&media=music")
                    .append("&entity=song")
                    .append("&limit=").append(limit)
                    .append("&country=").append(country);
            if (strictArtistAttr) {
                url.append("&attribute=artistTerm");
            }
            HttpEntity<Void> entity = new HttpEntity<>(null, defaultHeaders());
            ResponseEntity<String> response = restTemplate.exchange(
                    url.toString(),
                    HttpMethod.GET,
                    entity,
                    String.class);

            String rawBody = response.getBody();
            if (rawBody == null || rawBody.isBlank()) {
                log.warn("iTunes search returned blank body. term='{}', country='{}', strict={}",
                        termName, country, strictArtistAttr);
                return Collections.emptyList();
            }

            ITunesSearchResponse body = objectMapper.readValue(rawBody, ITunesSearchResponse.class);
            if (body == null || body.getResults() == null) {
                log.warn("iTunes search returned empty body. term='{}', country='{}', strict={}",
                        termName, country, strictArtistAttr);
                return Collections.emptyList();
            }

            List<ITunesTrackDTO> base = body.getResults().stream()
                    .filter(track -> "track".equalsIgnoreCase(track.getWrapperType()))
                    .filter(track -> "song".equalsIgnoreCase(track.getKind()))
                    .collect(Collectors.toList());

            if (normalizedArtist == null || normalizedArtist.isBlank()) {
                return base;
            }

            List<ITunesTrackDTO> filtered = base.stream()
                    .filter(track -> namesMatch(normalizedArtist, track.getArtistName()))
                    .collect(Collectors.toList());

            log.debug("iTunes search term='{}', country='{}', strict={} => resultCount={}, base={}, filtered={}",
                    termName, country, strictArtistAttr, body.getResultCount(), base.size(), filtered.size());
            return filtered.isEmpty() ? base : filtered;
        } catch (Exception e) {
            log.warn("iTunes search failed. term='{}', country='{}', strict={}, error={}",
                    termName, country, strictArtistAttr, e.getMessage());
            return Collections.emptyList();
        }
    }

    private HttpHeaders defaultHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "HipHopHub/1.0");
        return headers;
    }

    private boolean namesMatch(String normalizedArtist, String candidate) {
        if (candidate == null) {
            return false;
        }
        String direct = normalizeName(candidate);
        if (direct.equals(normalizedArtist)) {
            return true;
        }

        List<String> contributors = extractContributors(candidate);
        for (String contributor : contributors) {
            String normalizedContributor = normalizeName(contributor);
            if (normalizedContributor.isBlank()) {
                continue;
            }
            if (normalizedContributor.equals(normalizedArtist)) {
                return true;
            }
            if (STRICT_EXACT_ARTISTS.contains(normalizedArtist)) {
                continue;
            }
            if (normalizedArtist.length() >= 6
                    && (normalizedContributor.contains(normalizedArtist)
                            || normalizedArtist.contains(normalizedContributor))) {
                return true;
            }
        }

        return false;
    }

    private List<String> extractContributors(String value) {
        if (value == null || value.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(value.split("(?i)\\s*(?:,|&| feat\\.? | ft\\.? | x | with | and |\\+)\\s*"))
                .filter(part -> part != null && !part.isBlank())
                .collect(Collectors.toList());
    }

    private String normalizeName(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }
}
