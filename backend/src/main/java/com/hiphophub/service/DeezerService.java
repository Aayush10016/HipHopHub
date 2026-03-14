package com.hiphophub.service;

import com.hiphophub.dto.DeezerArtistDTO;
import com.hiphophub.dto.DeezerSearchResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class DeezerService {

    private static final Map<String, Long> PREFERRED_ARTIST_IDS = buildPreferredArtistIds();

    @Value("${deezer.api.url:https://api.deezer.com}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public Optional<DeezerArtistDTO> searchBestArtist(String artistName) {
        if (artistName == null || artistName.isBlank()) {
            return Optional.empty();
        }

        String normalizedName = normalize(artistName);
        Long preferredId = PREFERRED_ARTIST_IDS.get(normalizedName);
        if (preferredId != null) {
            Optional<DeezerArtistDTO> preferredArtist = fetchArtistById(preferredId);
            if (preferredArtist.isPresent()) {
                return preferredArtist;
            }
        }

        try {
            String encoded = URLEncoder.encode(artistName, StandardCharsets.UTF_8);
            String url = apiUrl + "/search/artist?q=" + encoded;
            HttpEntity<Void> entity = new HttpEntity<>(defaultHeaders());
            ResponseEntity<DeezerSearchResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    DeezerSearchResponse.class);

            DeezerSearchResponse body = response.getBody();
            if (body == null || body.getData() == null || body.getData().isEmpty()) {
                return Optional.empty();
            }

            String target = normalizedName;
            List<DeezerArtistDTO> candidates = body.getData().stream()
                    .filter(candidate -> candidate != null && candidate.getName() != null && !candidate.getName().isBlank())
                    .sorted(Comparator.comparingInt((DeezerArtistDTO candidate) -> score(target, candidate))
                            .reversed())
                    .toList();

            DeezerArtistDTO best = candidates.get(0);
            int bestScore = score(target, best);
            if (bestScore < 40) {
                return Optional.empty();
            }
            return Optional.of(best);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<DeezerArtistDTO> fetchArtistById(Long artistId) {
        if (artistId == null) {
            return Optional.empty();
        }
        try {
            String url = apiUrl + "/artist/" + artistId;
            HttpEntity<Void> entity = new HttpEntity<>(defaultHeaders());
            ResponseEntity<DeezerArtistDTO> response = restTemplate.exchange(url, HttpMethod.GET, entity,
                    DeezerArtistDTO.class);
            DeezerArtistDTO artist = response.getBody();
            if (artist == null || artist.getName() == null || artist.getName().isBlank()) {
                return Optional.empty();
            }
            return Optional.of(artist);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public String pickBestImage(DeezerArtistDTO artist) {
        if (artist == null) {
            return null;
        }
        if (artist.getPictureXl() != null && !artist.getPictureXl().isBlank()) {
            return artist.getPictureXl();
        }
        if (artist.getPictureBig() != null && !artist.getPictureBig().isBlank()) {
            return artist.getPictureBig();
        }
        if (artist.getPictureMedium() != null && !artist.getPictureMedium().isBlank()) {
            return artist.getPictureMedium();
        }
        if (artist.getPicture() != null && !artist.getPicture().isBlank()) {
            return artist.getPicture();
        }
        return null;
    }

    private int score(String normalizedTarget, DeezerArtistDTO candidate) {
        String normalizedCandidate = normalize(candidate.getName());
        int score = 0;

        if (normalizedTarget.equals(normalizedCandidate)) {
            score += 100;
        } else if (normalizedTarget.contains(normalizedCandidate) || normalizedCandidate.contains(normalizedTarget)) {
            score += 70;
        } else {
            int commonPrefix = commonPrefixLength(normalizedTarget, normalizedCandidate);
            score += Math.min(50, commonPrefix * 8);
        }

        if (candidate.getNbFan() != null) {
            if (candidate.getNbFan() > 500_000) {
                score += 12;
            } else if (candidate.getNbFan() > 100_000) {
                score += 8;
            } else if (candidate.getNbFan() > 10_000) {
                score += 4;
            }
        }

        return score;
    }

    private int commonPrefixLength(String first, String second) {
        int max = Math.min(first.length(), second.length());
        int idx = 0;
        while (idx < max && first.charAt(idx) == second.charAt(idx)) {
            idx++;
        }
        return idx;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private HttpHeaders defaultHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "HipHopHub/1.0");
        headers.set("Accept-Language", "en-US,en;q=0.9");
        return headers;
    }

    private static Map<String, Long> buildPreferredArtistIds() {
        Map<String, Long> ids = new HashMap<>();
        ids.put("krsna", 13693077L);
        ids.put("seedhemaut", 12416876L);
        ids.put("divine", 186634907L);
        ids.put("ikka", 4649117L);
        ids.put("emiwaybantai", 50929372L);
        ids.put("yashraj", 10342742L);
        ids.put("gravity", 204809007L);
        ids.put("karma", 122246332L);
        ids.put("nanku", 66764672L);
        ids.put("paradox", 99170L);
        ids.put("prabhdeep", 8835380L);
        ids.put("raga", 816099L);
        ids.put("rawal", 5307423L);
        ids.put("king", 5474020L);
        ids.put("bharg", 118638462L);
        ids.put("dhanji", 14258655L);
        ids.put("siyaahi", 71380092L);
        ids.put("vichaar", 78836342L);
        ids.put("naamsujal", 174445827L);
        return Collections.unmodifiableMap(ids);
    }
}
