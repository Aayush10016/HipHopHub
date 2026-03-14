package com.hiphophub.service;

import com.hiphophub.dto.LastFmArtistInfoResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class LastFmService {

    @Value("${lastfm.api.key:}")
    private String apiKey;

    @Value("${lastfm.api.url:https://ws.audioscrobbler.com/2.0/}")
    private String apiUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public Optional<LastFmArtistInfoResponse.Artist> fetchArtistInfo(String artistName) {
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        try {
            String encoded = URLEncoder.encode(artistName, StandardCharsets.UTF_8);
            String url = apiUrl + "?method=artist.getinfo&artist=" + encoded + "&api_key=" + apiKey
                    + "&format=json&autocorrect=1";
            ResponseEntity<LastFmArtistInfoResponse> response = restTemplate.getForEntity(url, LastFmArtistInfoResponse.class);
            if (response.getBody() == null || response.getBody().getArtist() == null) {
                return Optional.empty();
            }
            return Optional.of(response.getBody().getArtist());
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
