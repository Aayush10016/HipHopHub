package com.hiphophub.service;

import com.hiphophub.dto.DeezerArtistDTO;
import com.hiphophub.dto.DeezerSearchResponse;
import java.net.URLEncoder;
import java.text.Normalizer;
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
    private static final Map<String, String> ARTIST_SEARCH_ALIASES = buildArtistSearchAliases();

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
            for (String query : buildQueries(artistName, normalizedName)) {
                Optional<DeezerArtistDTO> best = searchStrict(query, normalizedName);
                if (best.isPresent()) {
                    return best;
                }
            }
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<DeezerArtistDTO> searchStrict(String query, String normalizedTarget) {
        String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
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

        List<DeezerArtistDTO> exactMatches = body.getData().stream()
                .filter(candidate -> candidate != null && candidate.getName() != null && !candidate.getName().isBlank())
                .filter(candidate -> normalize(candidate.getName()).equals(normalizedTarget))
                .sorted(Comparator.comparingLong((DeezerArtistDTO candidate) -> candidate.getNbFan() == null ? 0L : candidate.getNbFan())
                        .reversed())
                .toList();

        if (exactMatches.isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(exactMatches.get(0));
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

    private List<String> buildQueries(String artistName, String normalizedTarget) {
        String alias = ARTIST_SEARCH_ALIASES.get(normalizedTarget);
        if (alias == null || alias.isBlank() || alias.equalsIgnoreCase(artistName)) {
            return List.of(artistName);
        }
        return List.of(artistName, alias);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
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
        ids.put("thesiege", 809033L);
        ids.put("vichaar", 78836342L);
        ids.put("naamsujal", 174445827L);
        ids.put("wolfcryman", 105288352L);
        return Collections.unmodifiableMap(ids);
    }

    private static Map<String, String> buildArtistSearchAliases() {
        Map<String, String> aliases = new HashMap<>();
        aliases.put("sos", "SOS kashmir");
        aliases.put("naamsujal", "Naam Sujal");
        aliases.put("riarsaab", "Riar Saab");
        aliases.put("sambata", "SAMBATA");
        aliases.put("wolfcryman", "wolf cryman");
        aliases.put("dopeadelicz", "Dopeadelicz");
        aliases.put("thesiege", "The Siege");
        aliases.put("mcheadshot", "MC Headshot");
        return Collections.unmodifiableMap(aliases);
    }
}
