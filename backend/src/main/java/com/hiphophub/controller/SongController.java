package com.hiphophub.controller;

import com.hiphophub.dto.AlbumDTO;
import com.hiphophub.dto.ArtistSimpleDTO;
import com.hiphophub.dto.SongDTO;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Song;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.service.MusicImportService;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import org.springframework.data.domain.PageRequest;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Random;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;
import java.util.ArrayList;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/songs")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class SongController {

    private static final String DEFAULT_COVER =
            "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80";
    private static final Duration RANDOM_CACHE_TTL = Duration.ofMinutes(3);

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private MusicImportService musicImportService;

    private volatile List<Song> cachedPlayableSongs = List.of();
    private volatile Instant cachedPlayableSongsAt;

    private volatile List<Song> cachedDhhPlayableSongs = List.of();
    private volatile Instant cachedDhhPlayableSongsAt;

    @GetMapping
    public List<SongDTO> getAllSongs() {
        return songRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SongDTO> getSongById(@PathVariable Long id) {
        return songRepository.findById(id)
                .map(song -> ResponseEntity.ok(convertToDTO(song)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/random")
    public ResponseEntity<SongDTO> getRandomSong() {
        List<Song> pool = getPlayableSongPool(false);
        if (pool.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Song randomSong = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        return ResponseEntity.ok(convertToDTO(randomSong));
    }

    @GetMapping("/random/dhh")
    public ResponseEntity<SongDTO> getRandomDhhSong() {
        List<Song> pool = getPlayableSongPool(true);
        if (pool.isEmpty()) {
            return getRandomSong();
        }
        Song randomSong = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        return ResponseEntity.ok(convertToDTO(randomSong));
    }

    /**
     * GET /api/songs/song-of-day
     * Returns a deterministic "Song of the Day" that stays the same until midnight UTC.
     */
    @GetMapping("/song-of-day")
    public ResponseEntity<SongDTO> getSongOfDay() {
        List<Song> pool = getPlayableSongPool(true);
        if (pool.isEmpty()) {
            pool = getPlayableSongPool(false);
        }
        if (pool.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        long daySeed = LocalDate.now(ZoneOffset.UTC).toEpochDay();
        int index = new Random(daySeed).nextInt(pool.size());
        return ResponseEntity.ok(convertToDTO(pool.get(index)));
    }

    /**
     * GET /api/songs/top5-of-day
     * Returns 5 deterministic songs for the day, each from a different artist.
     */
    @GetMapping("/top5-of-day")
    public List<SongDTO> getTop5OfDay() {
        List<Song> pool = getPlayableSongPool(true);
        if (pool.isEmpty()) {
            pool = getPlayableSongPool(false);
        }
        if (pool.isEmpty()) {
            return List.of();
        }

        long daySeed = LocalDate.now(ZoneOffset.UTC).toEpochDay() + 7919;
        Random rng = new Random(daySeed);

        // Shuffle deterministically
        List<Song> shuffled = new ArrayList<>(pool);
        java.util.Collections.shuffle(shuffled, rng);

        // Pick one song per unique artist, up to 5
        java.util.Set<Long> seenArtists = new java.util.LinkedHashSet<>();
        List<Song> picks = new ArrayList<>();
        for (Song song : shuffled) {
            Long artistId = song.getAlbum().getArtist().getId();
            if (seenArtists.add(artistId)) {
                picks.add(song);
                if (picks.size() >= 5) break;
            }
        }

        return picks.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @GetMapping("/top/dhh")
    public List<SongDTO> getTopDhhSongs(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit) {
        int normalizedDays = Math.max(1, Math.min(days, 365));
        int normalizedLimit = Math.max(1, Math.min(limit, 100));
        List<Integer> windows = List.of(normalizedDays, 60, 90, 180, 365);
        PageRequest pageRequest = PageRequest.of(0, Math.max(normalizedLimit * 8, 80));

        for (Integer windowDays : windows) {
            List<SongDTO> matches = songRepository.findPlayableSongsReleasedAfter(LocalDate.now().minusDays(windowDays), pageRequest).stream()
                    .filter(this::isDhhSong)
                    .sorted(Comparator
                            .comparing((Song song) -> song.getAlbum().getReleaseDate())
                            .reversed()
                            .thenComparing(Song::getId, Comparator.reverseOrder()))
                    .limit(normalizedLimit)
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());

            if (!matches.isEmpty()) {
                return matches;
            }
        }

        return songRepository.findLatestPlayableSongs(PageRequest.of(0, Math.max(normalizedLimit * 8, 80))).stream()
                .filter(this::isDhhSong)
                .sorted(Comparator
                        .comparing((Song song) -> releaseDateOrMin(song.getAlbum()))
                        .reversed()
                        .thenComparing(Song::getId, Comparator.reverseOrder()))
                .limit(normalizedLimit)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/top/dhh/all-time")
    public List<SongDTO> getTopDhhSongsAllTime(@RequestParam(defaultValue = "20") int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit, 100));
        return findDhhPlayableSongs(songRepository.findAll()).stream()
                .sorted(Comparator
                        .comparing((Song song) -> releaseDateOrMin(song.getAlbum()))
                        .reversed()
                        .thenComparing(Song::getId, Comparator.reverseOrder()))
                .limit(normalizedLimit)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @GetMapping("/artist/{artistId}")
    public List<SongDTO> getSongsByArtist(@PathVariable Long artistId) {
        List<Song> directSongs = songRepository.findByAlbumArtistId(artistId);
        if (!directSongs.isEmpty()) {
            return dedupeArtistSongs(directSongs).stream()
                    .map(this::convertToDTO)
                    .collect(Collectors.toList());
        }

        return artistRepository.findById(artistId)
                .filter(artist -> musicImportService.hasCatalogFallback(artist.getName()))
                .flatMap(artist -> artistRepository.findByNameIgnoreCase("Seedhe Maut"))
                .map(relatedArtist -> dedupeArtistSongs(songRepository.findByAlbumArtistId(relatedArtist.getId())).stream()
                        .map(this::convertToDTO)
                        .collect(Collectors.toList()))
                .orElse(List.of());
    }

    @GetMapping("/album/{albumId}")
    public List<SongDTO> getSongsByAlbum(@PathVariable Long albumId) {
        return songRepository.findByAlbumId(albumId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private LocalDate releaseDateOrMin(Album album) {
        if (album == null || album.getReleaseDate() == null) {
            return LocalDate.MIN;
        }
        return album.getReleaseDate();
    }

    private List<Song> dedupeArtistSongs(List<Song> songs) {
        Comparator<Song> ranking = Comparator
                .comparingInt(this::artistSongPriority)
                .thenComparing((Song song) -> releaseDateOrMin(song.getAlbum()), Comparator.reverseOrder())
                .thenComparing(Song::getId, Comparator.reverseOrder());

        LinkedHashMap<String, Song> bestByTitle = new LinkedHashMap<>();
        songs.stream()
                .sorted(ranking)
                .forEach(song -> bestByTitle.putIfAbsent(normalizeSongTitle(song.getTitle()), song));

        return bestByTitle.values().stream()
                .sorted(Comparator
                        .comparing((Song song) -> releaseDateOrMin(song.getAlbum()))
                        .reversed()
                        .thenComparing(Song::getId, Comparator.reverseOrder()))
                .collect(Collectors.toList());
    }

    private int artistSongPriority(Song song) {
        Album album = song != null ? song.getAlbum() : null;
        Album.AlbumType type = album != null ? album.getType() : null;
        if (type == null) {
            return 99;
        }
        if (type == Album.AlbumType.ALBUM) {
            return 0;
        }
        if (type == Album.AlbumType.SINGLE) {
            return 1;
        }
        if (type == Album.AlbumType.EP) {
            return 2;
        }
        if (type == Album.AlbumType.APPEARS_ON) {
            return 3;
        }
        return 99;
    }

    private String normalizeSongTitle(String title) {
        if (title == null) {
            return "";
        }
        return title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private List<Song> findPlayableSongs(List<Song> songs) {
        return songs.stream()
                .filter(this::isPlayableSong)
                .toList();
    }

    private List<Song> findDhhPlayableSongs(List<Song> songs) {
        return songs.stream()
                .filter(this::isPlayableSong)
                .filter(this::isDhhSong)
                .toList();
    }

    private boolean isDhhSong(Song song) {
        Album album = song.getAlbum();
        if (album == null || album.getArtist() == null) {
            return false;
        }
        Artist artist = album.getArtist();
        return DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre());
    }

    private List<Song> getPlayableSongPool(boolean dhhOnly) {
        Instant now = Instant.now();
        if (dhhOnly) {
            if (cachedDhhPlayableSongsAt != null
                    && Duration.between(cachedDhhPlayableSongsAt, now).compareTo(RANDOM_CACHE_TTL) < 0
                    && !cachedDhhPlayableSongs.isEmpty()) {
                return cachedDhhPlayableSongs;
            }
        } else {
            if (cachedPlayableSongsAt != null
                    && Duration.between(cachedPlayableSongsAt, now).compareTo(RANDOM_CACHE_TTL) < 0
                    && !cachedPlayableSongs.isEmpty()) {
                return cachedPlayableSongs;
            }
        }

        List<Song> refreshed = new ArrayList<>(songRepository.findLatestPlayableSongs(PageRequest.of(0, 600)).stream()
                .filter(this::isPlayableSong)
                .filter(song -> !dhhOnly || isDhhSong(song))
                .toList());

        if (dhhOnly) {
            cachedDhhPlayableSongs = refreshed;
            cachedDhhPlayableSongsAt = now;
        } else {
            cachedPlayableSongs = refreshed;
            cachedPlayableSongsAt = now;
        }
        return refreshed;
    }

    private boolean isPlayableSong(Song song) {
        if (song == null || song.getAlbum() == null || song.getAlbum().getArtist() == null) {
            return false;
        }
        String previewUrl = song.getPreviewUrl();
        return previewUrl != null && !previewUrl.isBlank();
    }

    private String resolveSongCover(Song song) {
        Album album = song.getAlbum();
        if (album != null && album.getCoverUrl() != null && !album.getCoverUrl().isBlank()) {
            return album.getCoverUrl();
        }
        Artist artist = album != null ? album.getArtist() : null;
        if (artist != null && artist.getImageUrl() != null && !artist.getImageUrl().isBlank()) {
            return artist.getImageUrl();
        }
        return DEFAULT_COVER;
    }

    private SongDTO convertToDTO(Song song) {
        Album album = song.getAlbum();
        Artist artist = album.getArtist();
        String artistName = artist.getName();
        String coverUrl = resolveSongCover(song);

        ArtistSimpleDTO artistDTO = new ArtistSimpleDTO(
                artist.getId(),
                artistName,
                artist.getImageUrl(),
                artist.getMonthlyListeners(),
                artist.getGenre());

        AlbumDTO albumDTO = new AlbumDTO(
                album.getId(),
                album.getTitle(),
                album.getReleaseDate(),
                album.getType().toString(),
                coverUrl,
                YouTubeLinkBuilder.forAlbum(artistName, album.getTitle()),
                artistDTO);

        return new SongDTO(
                song.getId(),
                song.getTitle(),
                song.getDurationMs(),
                song.getPreviewUrl(),
                song.getTrackNumber(),
                artistName,
                coverUrl,
                YouTubeLinkBuilder.forSong(artistName, song.getTitle()),
                albumDTO);
    }
}
