package com.hiphophub.controller;

import com.hiphophub.dto.AlbumDTO;
import com.hiphophub.dto.ArtistSimpleDTO;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Album Controller
 *
 * Handles HTTP requests for albums, EPs, and singles.
 */
@RestController
@RequestMapping("/api/albums")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class AlbumController {

    @Autowired
    private AlbumRepository albumRepository;

    /**
     * GET /api/albums
     * Get all albums
     */
    @GetMapping
    public List<AlbumDTO> getAllAlbums(@RequestParam(defaultValue = "all") String scope) {
        return applyScope(albumRepository.findAll(), scope).stream()
                .sorted(Comparator
                        .comparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN)
                        .reversed()
                        .thenComparing(Album::getId, Comparator.reverseOrder()))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * GET /api/albums/{id}
     * Get album by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<AlbumDTO> getAlbumById(@PathVariable Long id) {
        return albumRepository.findById(id)
                .map(album -> ResponseEntity.ok(toDTO(album)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/albums/latest
     * Get latest releases (last 30 days)
     */
    @GetMapping("/latest")
    public List<AlbumDTO> getLatestReleases(@RequestParam(defaultValue = "all") String scope) {
        LocalDate thirtyDaysAgo = LocalDate.now().minusDays(30);
        return applyScope(albumRepository.findLatestReleases(thirtyDaysAgo), scope).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * GET /api/albums/upcoming
     * Get upcoming releases (future dates)
     */
    @GetMapping("/upcoming")
    public List<AlbumDTO> getUpcomingReleases(@RequestParam(defaultValue = "all") String scope) {
        return applyScope(albumRepository.findUpcomingReleases(LocalDate.now()), scope).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * GET /api/albums/artist/{artistId}
     * Get all albums by specific artist
     */
    @GetMapping("/artist/{artistId}")
    public List<AlbumDTO> getAlbumsByArtist(@PathVariable Long artistId) {
        return albumRepository.findByArtistId(artistId).stream()
                .sorted(Comparator
                        .comparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN)
                        .reversed()
                        .thenComparing(Album::getId, Comparator.reverseOrder()))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * POST /api/albums
     * Create a new album
     */
    @PostMapping
    public Album createAlbum(@RequestBody Album album) {
        return albumRepository.save(album);
    }

    private List<Album> applyScope(List<Album> albums, String scope) {
        if (!"dhh".equalsIgnoreCase(scope)) {
            return albums;
        }
        return albums.stream()
                .filter(album -> {
                    Artist artist = album.getArtist();
                    return artist != null && DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre());
                })
                .collect(Collectors.toList());
    }

    private AlbumDTO toDTO(Album album) {
        Artist artist = album.getArtist();
        ArtistSimpleDTO artistDTO = new ArtistSimpleDTO(
                artist.getId(),
                artist.getName(),
                artist.getImageUrl(),
                artist.getMonthlyListeners(),
                artist.getGenre());

        return new AlbumDTO(
                album.getId(),
                album.getTitle(),
                album.getReleaseDate(),
                album.getType().toString(),
                album.getCoverUrl(),
                YouTubeLinkBuilder.forAlbum(artist.getName(), album.getTitle()),
                artistDTO);
    }
}
