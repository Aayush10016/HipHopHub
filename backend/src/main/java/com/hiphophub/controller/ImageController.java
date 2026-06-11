package com.hiphophub.controller;

import com.hiphophub.model.Artist;
import com.hiphophub.repository.ArtistRepository;
import java.net.URI;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Set;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/images")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class ImageController {

    private static final Set<String> KNOWN_PLACEHOLDER_HASHES = Set.of(
            "AA398423834EED25E1221BD2D4CE4C528F98AD1D1FEDC45F4164DFA859E5EBB5",
            "BD8DAE144DC585A7EB090E2071FE386BBE0DF6EBCC47EE0D96D5EC5C23274530");

    @Autowired
    private ArtistRepository artistRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/artist/{artistId}")
    public ResponseEntity<byte[]> getArtistImage(@PathVariable Long artistId) {
        Artist artist = artistRepository.findById(artistId).orElse(null);
        if (artist == null) {
            return ResponseEntity.notFound().build();
        }

        String imageUrl = artist.getImageUrl();
        if (imageUrl == null || imageUrl.isBlank()) {
            return ResponseEntity.notFound().build();
        }

        return proxyArtistImage(imageUrl);
    }

    private ResponseEntity<byte[]> proxyArtistImage(String imageUrl) {
        ResponseEntity<byte[]> primary = proxyImage(imageUrl);
        if (!primary.getStatusCode().is2xxSuccessful()) {
            return ResponseEntity.notFound().build();
        }

        byte[] body = primary.getBody();
        if (body == null || body.length == 0) {
            return ResponseEntity.notFound().build();
        }

        if (isDeezerPlaceholder(body)) {
            return ResponseEntity.notFound().build();
        }

        return primary;
    }

    private ResponseEntity<byte[]> proxyImage(String imageUrl) {
        try {
            HttpEntity<Void> request = new HttpEntity<>(defaultHeaders());
            ResponseEntity<byte[]> upstream = restTemplate.exchange(
                    URI.create(imageUrl),
                    HttpMethod.GET,
                    request,
                    byte[].class);

            byte[] body = upstream.getBody();
            if (body == null || body.length == 0) {
                return ResponseEntity.notFound().build();
            }

            MediaType mediaType = upstream.getHeaders().getContentType();
            if (mediaType == null) {
                mediaType = MediaType.IMAGE_JPEG;
            }

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .cacheControl(CacheControl.maxAge(Duration.ofHours(12)).cachePublic())
                    .body(body);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    private boolean isDeezerPlaceholder(byte[] body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String hash = HexFormat.of().formatHex(digest.digest(body)).toUpperCase();
            return KNOWN_PLACEHOLDER_HASHES.contains(hash);
        } catch (Exception e) {
            return false;
        }
    }

    private HttpHeaders defaultHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");
        return headers;
    }
}
