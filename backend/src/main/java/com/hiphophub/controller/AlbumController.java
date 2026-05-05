package com.hiphophub.controller;

import com.hiphophub.dto.AlbumDTO;
import com.hiphophub.dto.ArtistSimpleDTO;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.service.MusicImportService;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private MusicImportService musicImportService;

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
        List<Integer> windows = List.of(30, 60, 90, 180, 365);
        for (Integer windowDays : windows) {
            List<AlbumDTO> matches = applyScope(albumRepository.findLatestReleases(LocalDate.now().minusDays(windowDays)), scope)
                    .stream()
                    .sorted(Comparator
                            .comparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN)
                            .reversed()
                            .thenComparing(Album::getId, Comparator.reverseOrder()))
                    .map(this::toDTO)
                    .collect(Collectors.toList());
            if (!matches.isEmpty()) {
                return matches;
            }
        }

        return List.of();
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
        List<Album> directAlbums = albumRepository.findByArtistId(artistId);
        if (directAlbums.isEmpty()) {
            directAlbums = artistRepository.findById(artistId)
                    .flatMap(artist -> musicImportService.resolveCatalogFallbackArtist(artist.getName()))
                    .map(fallbackArtist -> albumRepository.findByArtistId(fallbackArtist.getId()))
                    .orElse(List.of());
        }

        return dedupeAlbums(directAlbums).stream()
                .filter(album -> !isLowValueCompilation(album))
                .sorted(Comparator
                        .comparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN)
                        .reversed()
                        .thenComparing(Album::getId, Comparator.reverseOrder()))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private List<Album> dedupeAlbums(List<Album> albums) {
        LinkedHashMap<String, Album> bestByKey = new LinkedHashMap<>();

        albums.stream()
                .sorted(Comparator
                        .comparingInt(this::albumPriority)
                        .thenComparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN,
                                Comparator.reverseOrder())
                        .thenComparing(Album::getId, Comparator.reverseOrder()))
                .forEach(album -> bestByKey.putIfAbsent(albumIdentityKey(album), album));

        return List.copyOf(bestByKey.values());
    }

    private int albumPriority(Album album) {
        if (album == null || album.getType() == null) {
            return 99;
        }
        int penalty = isLowValueCompilation(album) ? 10 : 0;
        if (album.getType() == Album.AlbumType.ALBUM) {
            return 0 + penalty;
        }
        if (album.getType() == Album.AlbumType.EP) {
            return 1 + penalty;
        }
        if (album.getType() == Album.AlbumType.SINGLE) {
            return 2 + penalty;
        }
        if (album.getType() == Album.AlbumType.APPEARS_ON) {
            return 3 + penalty;
        }
        return 99 + penalty;
    }

    private boolean isLowValueCompilation(Album album) {
        if (album == null || album.getTitle() == null) {
            return false;
        }
        String key = album.getTitle().toLowerCase(Locale.ROOT);
        return key.contains("hits")
                || key.contains("vibes")
                || key.contains("workout")
                || key.contains("motivational")
                || key.contains("club out")
                || key.contains("grind")
                || key.contains("mausam")
                || key.contains("scene")
                || key.contains("house party")
                || key.contains("live with music")
                || key.contains("dance pop")
                || key.contains("desi hip hop hits")
                || key.contains("best of")
                || key.contains("republic day special")
                || key.contains("independence day special")
                || key.contains("power pack mix")
                || key.contains("mashup")
                || key.contains("episode.")
                || key.contains("episode ")
                || key.contains("trending version")
                || (key.contains("mass appeal") && key.contains("shutdown"));
    }

    private String albumIdentityKey(Album album) {
        String title = album != null && album.getTitle() != null ? album.getTitle() : "";
        String type = album != null && album.getType() != null ? album.getType().name() : "UNKNOWN";
        return type + ":" + title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
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
