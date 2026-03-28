package com.hiphophub.controller;

import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.ArtistRepository;
import java.net.URI;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
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

    private static final String DEEZER_PLACEHOLDER_HASH = "AA398423834EED25E1221BD2D4CE4C528F98AD1D1FEDC45F4164DFA859E5EBB5";
    private static final int MIN_ACCEPTABLE_IMAGE_BYTES = 35_000;

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private AlbumRepository albumRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/artist/{artistId}")
    public ResponseEntity<byte[]> getArtistImage(@PathVariable Long artistId) {
        Artist artist = artistRepository.findById(artistId).orElse(null);
        if (artist == null) {
            return ResponseEntity.notFound().build();
        }
        String imageUrl = artist.getImageUrl();
        if (imageUrl == null || imageUrl.isBlank()) {
            String fallbackCover = findFallbackCover(artistId);
            if (fallbackCover == null || fallbackCover.isBlank()) {
                return ResponseEntity.notFound().build();
            }
            return proxyImage(fallbackCover);
        }
        return proxyImageWithFallback(imageUrl, artistId);
    }

    private ResponseEntity<byte[]> proxyImageWithFallback(String imageUrl, Long artistId) {
        ResponseEntity<byte[]> primary = proxyImage(imageUrl);
        if (!primary.getStatusCode().is2xxSuccessful()) {
            return primary;
        }

        byte[] body = primary.getBody();
        if (body == null || body.length == 0) {
            return primary;
        }

        if (!isDeezerPlaceholder(body) && body.length >= MIN_ACCEPTABLE_IMAGE_BYTES) {
            return primary;
        }

        String fallbackCover = findFallbackCover(artistId);
        if (fallbackCover == null || fallbackCover.isBlank()) {
            return primary;
        }

        ResponseEntity<byte[]> fallback = proxyImage(fallbackCover);
        if (fallback.getStatusCode().is2xxSuccessful() && fallback.getBody() != null && fallback.getBody().length > 0) {
            return fallback;
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

    private String findFallbackCover(Long artistId) {
        List<Album> albums = albumRepository.findByArtistId(artistId);
        return albums.stream()
                .filter(album -> album.getCoverUrl() != null && !album.getCoverUrl().isBlank())
                .sorted(Comparator.comparing(Album::getReleaseDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed())
                .map(Album::getCoverUrl)
                .findFirst()
                .orElse(null);
    }

    private boolean isDeezerPlaceholder(byte[] body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String hash = HexFormat.of().formatHex(digest.digest(body)).toUpperCase();
            return DEEZER_PLACEHOLDER_HASH.equals(hash);
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
