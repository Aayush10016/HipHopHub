package com.hiphophub.controller;

import com.hiphophub.dto.ArtistFactDTO;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Tour;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.TourRepository;
import com.hiphophub.service.MusicImportService;
import com.hiphophub.util.DhhArtistClassifier;
import org.springframework.data.domain.PageRequest;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 * Artist Controller
 *
 * Handles all HTTP requests related to artists.
 */
@RestController
@RequestMapping("/api/artists")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class ArtistController {

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private AlbumRepository albumRepository;

    @Autowired
    private TourRepository tourRepository;

    @Autowired
    private MusicImportService musicImportService;

    /**
     * GET /api/artists
     * Get all artists
     */
    @GetMapping
    public List<Artist> getAllArtists(
            @RequestParam(defaultValue = "all") String scope,
            @RequestParam(required = false) Integer limit) {
        List<Artist> artists = artistRepository.findAll().stream()
                .sorted(Comparator.comparing(Artist::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        artists = artists.stream()
                .map(musicImportService::enrichArtistForDisplay)
                .collect(Collectors.toList());

        if ("dhh".equalsIgnoreCase(scope)) {
            artists = artists.stream()
                    .filter(artist -> DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre()))
                    .collect(Collectors.toList());
        }

        if (limit != null && limit > 0) {
            return artists.stream().limit(limit).collect(Collectors.toList());
        }

        return artists;
    }

    /**
     * GET /api/artists/{id}
     * Get artist by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Artist> getArtistById(@PathVariable Long id) {
        return artistRepository.findById(id)
                .map(musicImportService::enrichArtistForDisplay)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/artists
     * Create a new artist
     */
    @PostMapping
    public Artist createArtist(@RequestBody Artist artist) {
        return artistRepository.save(artist);
    }

    /**
     * GET /api/artists/search?q=seedhe
     * Search artists by name (supports partial matching)
     */
    @GetMapping("/search")
    public List<Artist> searchArtists(@RequestParam String q) {
        List<Artist> results = artistRepository.findByNameContainingIgnoreCase(q);
        if (results.isEmpty()) {
            try {
                Artist imported = musicImportService.importArtist(q);
                return List.of(imported);
            } catch (Exception e) {
                System.err.println("Music import failed for search '" + q + "': " + e.getMessage());
            }
        }
        return results;
    }

    /**
     * GET /api/artists/{id}/profile
     * Get complete artist profile (artist + albums + songs + tours + facts)
     */
    @GetMapping("/{id}/profile")
    public ResponseEntity<Map<String, Object>> getArtistProfile(@PathVariable Long id) {
        Optional<Artist> artistOpt = artistRepository.findById(id);

        if (artistOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Artist artist = artistOpt.get();
        musicImportService.enrichArtistForDisplay(artist);
        Map<String, Object> profile = new HashMap<>();
        profile.put("artist", artist);
        profile.put("albums", artist.getAlbums());
        profile.put("tours", artist.getTours());

        return ResponseEntity.ok(profile);
    }

    /**
     * GET /api/artists/{id}/albums
     * Get albums for a specific artist
     */
    @GetMapping("/{id}/albums")
    public List<Album> getArtistAlbums(@PathVariable Long id) {
        return albumRepository.findByArtistId(id).stream()
                .sorted(Comparator
                        .comparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN)
                        .reversed()
                        .thenComparing(Album::getId, Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    /**
     * GET /api/artists/{id}/tours
     * Get upcoming tours for a specific artist
     */
    @GetMapping("/{id}/tours")
    public List<Tour> getArtistTours(@PathVariable Long id) {
        return tourRepository.findUpcomingToursByArtist(id, LocalDate.now());
    }

    /**
     * GET /api/artists/{id}/facts
     * Get derived facts for an artist
     */
    @GetMapping("/{id}/facts")
    public ResponseEntity<List<ArtistFactDTO>> getArtistFacts(@PathVariable Long id) {
        return artistRepository.findById(id)
                .map(artist -> ResponseEntity.ok(musicImportService.buildFacts(artist)))
                .orElse(ResponseEntity.notFound().build());
    }
}
