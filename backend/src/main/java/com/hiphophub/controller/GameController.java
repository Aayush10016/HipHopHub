package com.hiphophub.controller;

import com.hiphophub.model.Song;
import com.hiphophub.model.GameScore;
import com.hiphophub.model.User;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Album;
import com.hiphophub.dto.ArtistFactDTO;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.GameScoreRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.repository.UserRepository;
import com.hiphophub.service.MusicImportService;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.LocalDateTime;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Game Controller
 *
 * Handles the "Guess the Song" game logic and leaderboards.
 */
@RestController
@RequestMapping("/api/game")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class GameController {
    private static final Logger log = LoggerFactory.getLogger(GameController.class);
    private static final String WATCH_URL_PREFIX = "https://www.youtube.com/watch?v=";

    private static final String DEFAULT_COVER_URL =
            "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80";
    private static final Duration GAME_POOL_TTL = Duration.ofMinutes(3);
    private static final Duration GAME_CATALOG_TTL = Duration.ofMinutes(5);

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private GameScoreRepository gameScoreRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private AlbumRepository albumRepository;

    @Autowired
    private MusicImportService musicImportService;

    private volatile List<Song> cachedGlobalGameSongs = List.of();
    private volatile Instant cachedGlobalGameSongsAt;
    private final Map<Long, List<Song>> cachedArtistGameSongs = new ConcurrentHashMap<>();
    private final Map<Long, Instant> cachedArtistGameSongsAt = new ConcurrentHashMap<>();
    private final Object globalGamePoolLock = new Object();
    private volatile Map<String, Object> cachedGameCatalog = Map.of();
    private volatile Instant cachedGameCatalogAt;
    private final Object gameCatalogLock = new Object();
    private static final int MIN_READY_ARTIST_COUNT = 8;
    private static final int MIN_READY_SONG_COUNT = 20;
    private static final int MIN_READY_RELEASE_COUNT = 12;
    private static final int MAX_GAME_CATALOG_SONGS = 720;
    private static final int MAX_GAME_CATALOG_RELEASES = 480;
    private static final int MAX_GAME_CATALOG_SONGS_PER_ARTIST = 10;
    private static final int MAX_GAME_CATALOG_RELEASES_PER_ARTIST = 8;

    /**
     * GET /api/game/random-song
     * Get a random song for the game
     */
    @GetMapping("/random-song")
    public ResponseEntity<Map<String, Object>> getRandomSong() {
        List<Song> pool = getGlobalGamePool();
        if (pool.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Song song = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        return ResponseEntity.ok(buildGameSongResponse(song));
    }

    /**
     * GET /api/game/random-song/artist/{artistId}
     * Get a random song by specific artist
     */
    @GetMapping("/random-song/artist/{artistId}")
    public ResponseEntity<Map<String, Object>> getRandomSongByArtist(@PathVariable Long artistId) {
        List<Song> pool = getArtistGamePool(artistId);
        if (pool.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Song song = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        return ResponseEntity.ok(buildGameSongResponse(song));
    }

    @GetMapping("/catalog")
    public ResponseEntity<Map<String, Object>> getGameCatalog() {
        return ResponseEntity.ok(buildGameCatalog());
    }

    /**
     * POST /api/game/submit-guess
     * Submit a guess and calculate points
     */
    @PostMapping("/submit-guess")
    public ResponseEntity<Map<String, Object>> submitGuess(@RequestBody Map<String, Object> guessData) {
        if (guessData == null || guessData.get("songId") == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "songId is required"));
        }

        Long songId;
        try {
            songId = Long.valueOf(guessData.get("songId").toString());
        } catch (NumberFormatException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "songId must be a valid number"));
        }

        String guessedTitle = guessData.get("guessedTitle") != null
                ? guessData.get("guessedTitle").toString()
                : "";
        Integer guessTimeSeconds = parseGuessTime(guessData.get("guessTimeSeconds"));

        Song song = songRepository.findById(songId).orElse(null);
        if (song == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("correctTitle", song.getTitle());
        response.put("artistName", song.getAlbum() != null && song.getAlbum().getArtist() != null
                ? song.getAlbum().getArtist().getName()
                : "");
        response.put("albumName", song.getAlbum() != null ? song.getAlbum().getTitle() : "");
        response.put("albumCover", resolveAlbumCover(song));

        // Check if guess is correct. Empty guesses should never score.
        boolean isCorrect = isGuessCorrect(song.getTitle(), guessedTitle);
        response.put("correct", isCorrect);

        if (isCorrect) {
            int points = calculatePoints(guessTimeSeconds);
            response.put("points", points);

            if (guessData.containsKey("userId") && guessData.get("userId") != null) {
                Long userId = parseUserId(guessData.get("userId"));
                if (userId != null) {
                    userRepository.findById(userId).ifPresent(user -> {
                        GameScore score = new GameScore();
                        score.setUser(user);
                        score.setSong(song);
                        score.setPoints(points);
                        score.setGuessTimeMs(Math.max(0, guessTimeSeconds) * 1000);
                        score.setDifficulty(resolveDifficulty(guessTimeSeconds));
                        score.setPlayedAt(LocalDateTime.now());
                        gameScoreRepository.save(score);
                    });
                }
            }
        } else {
            response.put("points", 0);
        }

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildGameSongResponse(Song song) {
        String artistName = song.getAlbum().getArtist().getName();

        Map<String, Object> response = new HashMap<>();
        response.put("songId", song.getId());
        response.put("previewUrl", song.getPreviewUrl());
        response.put("albumCover", resolveAlbumCover(song));
        response.put("artistName", artistName);
        response.put("songTitle", song.getTitle());
        response.put("youtubeUrl", directWatchUrlOrNull(YouTubeLinkBuilder.forSong(artistName, song.getTitle())));
        return response;
    }

    private String directWatchUrlOrNull(String url) {
        if (url == null || !url.startsWith(WATCH_URL_PREFIX)) {
            return null;
        }
        return url;
    }

    private boolean isPlayableSong(Song song) {
        return song != null
                && song.getPreviewUrl() != null
                && !song.getPreviewUrl().isBlank()
                && song.getAlbum() != null
                && song.getAlbum().getArtist() != null;
    }

    private boolean isDhhSong(Song song) {
        return DhhArtistClassifier.isDhhArtist(song.getAlbum().getArtist().getName(),
                song.getAlbum().getArtist().getGenre())
                && musicImportService.shouldFeatureArtistInDhhCatalog(song.getAlbum().getArtist());
    }

    private List<Song> getGlobalGamePool() {
        Instant now = Instant.now();
        if (cachedGlobalGameSongsAt != null
                && Duration.between(cachedGlobalGameSongsAt, now).compareTo(GAME_POOL_TTL) < 0
                && !cachedGlobalGameSongs.isEmpty()) {
            return cachedGlobalGameSongs;
        }

        synchronized (globalGamePoolLock) {
            now = Instant.now();
            if (cachedGlobalGameSongsAt != null
                    && Duration.between(cachedGlobalGameSongsAt, now).compareTo(GAME_POOL_TTL) < 0
                    && !cachedGlobalGameSongs.isEmpty()) {
                return cachedGlobalGameSongs;
            }

            List<Artist> artists = artistRepository.findAll().stream()
                    .map(musicImportService::enrichArtistForDisplay)
                    .filter(musicImportService::shouldFeatureArtistInDhhCatalog)
                    .toList();
            List<Long> artistIds = artists.stream().map(Artist::getId).toList();
            List<Song> refreshed = artistIds.isEmpty() ? new ArrayList<>() : new ArrayList<>(
                    songRepository.findPlayableSongsByArtistIds(artistIds).stream()
                    .filter(this::isPlayableSong)
                    .filter(this::isDhhSong)
                    .toList());
            log.info("Game random-song pool refreshed: {} playable DHH songs", refreshed.size());
            cachedGlobalGameSongs = refreshed;
            cachedGlobalGameSongsAt = now;
            return refreshed;
        }
    }

    private List<Song> getArtistGamePool(Long artistId) {
        Instant now = Instant.now();
        Instant cachedAt = cachedArtistGameSongsAt.get(artistId);
        List<Song> cached = cachedArtistGameSongs.getOrDefault(artistId, List.of());
        if (cachedAt != null
                && Duration.between(cachedAt, now).compareTo(GAME_POOL_TTL) < 0
                && !cached.isEmpty()) {
            return cached;
        }

        List<Song> refreshed = new ArrayList<>(songRepository.findByAlbumArtistId(artistId).stream()
                .filter(this::isPlayableSong)
                .toList());
        log.info("Game artist pool refreshed: artistId={} playable songs={}", artistId, refreshed.size());
        cachedArtistGameSongs.put(artistId, refreshed);
        cachedArtistGameSongsAt.put(artistId, now);
        return refreshed;
    }

    private Map<String, Object> buildGameCatalog() {
        Instant now = Instant.now();
        if (cachedGameCatalogAt != null
                && Duration.between(cachedGameCatalogAt, now).compareTo(GAME_CATALOG_TTL) < 0
                && isReadyCatalog(cachedGameCatalog)) {
            return cachedGameCatalog;
        }

        synchronized (gameCatalogLock) {
            now = Instant.now();
            if (cachedGameCatalogAt != null
                    && Duration.between(cachedGameCatalogAt, now).compareTo(GAME_CATALOG_TTL) < 0
                    && isReadyCatalog(cachedGameCatalog)) {
                return cachedGameCatalog;
            }

            List<Artist> artists = artistRepository.findAll().stream()
                    .map(musicImportService::enrichArtistForDisplay)
                    .filter(musicImportService::shouldFeatureArtistInDhhCatalog)
                    .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                    .toList();

            Map<Long, Artist> artistsById = artists.stream()
                    .collect(Collectors.toMap(Artist::getId, artist -> artist));

            List<Long> artistIds = artists.stream().map(Artist::getId).toList();

            List<Album> releases = artistIds.isEmpty() ? List.of() : albumRepository.findAlbumsByArtistIds(artistIds).stream()
                    .filter(album -> album != null
                            && album.getArtist() != null
                            && artistsById.containsKey(album.getArtist().getId()))
                    .sorted((left, right) -> {
                        if (left.getReleaseDate() == null && right.getReleaseDate() == null) return 0;
                        if (left.getReleaseDate() == null) return 1;
                        if (right.getReleaseDate() == null) return -1;
                        return right.getReleaseDate().compareTo(left.getReleaseDate());
                    })
                    .toList();

            List<Song> songs = artistIds.isEmpty() ? List.of() : songRepository.findPlayableSongsByArtistIds(artistIds).stream()
                    .filter(this::isPlayableSong)
                    .filter(this::isDhhSong)
                    .filter(song -> song.getAlbum() != null
                            && song.getAlbum().getArtist() != null
                            && artistsById.containsKey(song.getAlbum().getArtist().getId()))
                    .sorted((left, right) -> {
                        Album leftAlbum = left.getAlbum();
                        Album rightAlbum = right.getAlbum();
                        if (leftAlbum == null || leftAlbum.getReleaseDate() == null) return 1;
                        if (rightAlbum == null || rightAlbum.getReleaseDate() == null) return -1;
                        return rightAlbum.getReleaseDate().compareTo(leftAlbum.getReleaseDate());
                    })
                    .toList();

            int totalArtistCount = artists.size();
            int totalSongCount = songs.size();
            int totalReleaseCount = releases.size();

            List<Album> catalogReleases = trimGameCatalogReleases(releases);
            List<Song> catalogSongs = trimGameCatalogSongs(songs);

            Map<Long, List<Song>> songsByArtist = songs.stream()
                    .collect(Collectors.groupingBy(song -> song.getAlbum().getArtist().getId()));

            Map<Long, List<Album>> releasesByArtist = releases.stream()
                    .collect(Collectors.groupingBy(album -> album.getArtist().getId()));

            List<Map<String, Object>> artistPayload = artists.stream()
                    .map(artist -> {
                        List<ArtistFactDTO> facts = musicImportService.buildFacts(artist);
                        List<Album> artistReleases = releasesByArtist.getOrDefault(artist.getId(), List.of());
                        List<Song> artistSongs = songsByArtist.getOrDefault(artist.getId(), List.of());

                        Map<String, Object> item = new HashMap<>();
                        item.put("id", artist.getId());
                        item.put("name", artist.getName());
                        item.put("genre", artist.getGenre());
                        item.put("bio", artist.getBio());
                        item.put("imageUrl", artist.getImageUrl());
                        item.put("city", deriveCityFromBio(artist));
                        item.put("facts", facts.stream().map(ArtistFactDTO::getFact).toList());
                        item.put("releaseYears", artistReleases.stream()
                                .map(Album::getReleaseDate)
                                .filter(java.util.Objects::nonNull)
                                .map(date -> date.getYear())
                                .distinct()
                                .sorted()
                                .toList());
                        item.put("releaseCount", artistReleases.size());
                        item.put("songCount", artistSongs.size());
                        return item;
                    })
                    .toList();

            List<Map<String, Object>> releasePayload = catalogReleases.stream()
                    .map(album -> {
                        Map<String, Object> item = new HashMap<>();
                        item.put("id", album.getId());
                        item.put("title", album.getTitle());
                        item.put("artistId", album.getArtist().getId());
                        item.put("artistName", album.getArtist().getName());
                        item.put("releaseDate", album.getReleaseDate() != null ? album.getReleaseDate().toString() : null);
                        item.put("type", album.getType() != null ? album.getType().name() : null);
                        item.put("coverUrl", album.getCoverUrl());
                        item.put("youtubeUrl", directWatchUrlOrNull(YouTubeLinkBuilder.forAlbum(album.getArtist().getName(), album.getTitle())));
                        return item;
                    })
                    .toList();

            List<Map<String, Object>> songPayload = catalogSongs.stream()
                    .map(song -> {
                        Album album = song.getAlbum();
                        Artist artist = album.getArtist();
                        Map<String, Object> item = new HashMap<>();
                        item.put("id", song.getId());
                        item.put("title", song.getTitle());
                        item.put("artistId", artist.getId());
                        item.put("artistName", artist.getName());
                        item.put("previewUrl", song.getPreviewUrl());
                        item.put("coverUrl", resolveAlbumCover(song));
                        item.put("youtubeUrl", directWatchUrlOrNull(YouTubeLinkBuilder.forSong(artist.getName(), song.getTitle())));
                        item.put("releaseDate", album.getReleaseDate() != null ? album.getReleaseDate().toString() : null);
                        item.put("albumTitle", album.getTitle());
                        item.put("albumType", album.getType() != null ? album.getType().name() : null);
                        return item;
                    })
                    .toList();

            Map<String, Object> payload = new HashMap<>();
            payload.put("artists", artistPayload);
            payload.put("songs", songPayload);
            payload.put("releases", releasePayload);
            payload.put("artistCount", totalArtistCount);
            payload.put("songCount", totalSongCount);
            payload.put("releaseCount", totalReleaseCount);
            boolean ready = isReadyCatalog(totalArtistCount, totalSongCount, totalReleaseCount);
            payload.put("catalogReady", ready);
            log.info("Game catalog built: artists={} (payload {}), playableSongs={} (payload {}), releases={} (payload {})",
                    totalArtistCount, artistPayload.size(), totalSongCount, songPayload.size(), totalReleaseCount, releasePayload.size());

            if (ready) {
                cachedGameCatalog = payload;
                cachedGameCatalogAt = now;
            } else {
                cachedGameCatalog = Map.of();
                cachedGameCatalogAt = null;
                log.warn("Game catalog is still provisional. It will not be cached yet. artists={}, songs={}, releases={}",
                        totalArtistCount, totalSongCount, totalReleaseCount);
            }
            return payload;
        }
    }

    private List<Song> trimGameCatalogSongs(List<Song> songs) {
        Map<Long, Integer> perArtist = new HashMap<>();
        List<Song> trimmed = new ArrayList<>();

        for (Song song : songs) {
            Artist artist = song.getAlbum() != null ? song.getAlbum().getArtist() : null;
            if (artist == null) {
                continue;
            }
            long artistId = artist.getId();
            int currentCount = perArtist.getOrDefault(artistId, 0);
            if (currentCount >= MAX_GAME_CATALOG_SONGS_PER_ARTIST) {
                continue;
            }
            trimmed.add(song);
            perArtist.put(artistId, currentCount + 1);
            if (trimmed.size() >= MAX_GAME_CATALOG_SONGS) {
                break;
            }
        }

        return trimmed;
    }

    private List<Album> trimGameCatalogReleases(List<Album> releases) {
        Map<Long, Integer> perArtist = new HashMap<>();
        List<Album> trimmed = new ArrayList<>();

        for (Album album : releases) {
            Artist artist = album.getArtist();
            if (artist == null) {
                continue;
            }
            long artistId = artist.getId();
            int currentCount = perArtist.getOrDefault(artistId, 0);
            if (currentCount >= MAX_GAME_CATALOG_RELEASES_PER_ARTIST) {
                continue;
            }
            trimmed.add(album);
            perArtist.put(artistId, currentCount + 1);
            if (trimmed.size() >= MAX_GAME_CATALOG_RELEASES) {
                break;
            }
        }

        return trimmed;
    }

    private boolean isReadyCatalog(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return false;
        }
        return isReadyCatalog(asInt(payload.get("artistCount")), asInt(payload.get("songCount")), asInt(payload.get("releaseCount")));
    }

    private boolean isReadyCatalog(int artistCount, int songCount, int releaseCount) {
        return artistCount >= MIN_READY_ARTIST_COUNT
                && songCount >= MIN_READY_SONG_COUNT
                && releaseCount >= MIN_READY_RELEASE_COUNT;
    }

    private int asInt(Object value) {
        if (value == null) {
            return 0;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private String deriveCityFromBio(Artist artist) {
        if (artist == null || artist.getBio() == null) {
            return null;
        }
        String bio = artist.getBio().toLowerCase(Locale.ROOT);
        List<String> knownCities = List.of(
                "delhi", "mumbai", "pune", "ahmedabad", "bengaluru", "bangalore",
                "kolkata", "chandigarh", "lucknow", "jaipur", "goa", "indore",
                "hyderabad", "surat", "amritsar", "dehradun", "kochi", "chennai",
                "bhopal", "shimla", "gurugram", "noida", "ncr");

        for (String city : knownCities) {
            if (bio.contains(city)) {
                if ("bangalore".equals(city)) {
                    return "Bengaluru";
                }
                if ("ncr".equals(city)) {
                    return "Delhi NCR";
                }
                return city.substring(0, 1).toUpperCase(Locale.ROOT) + city.substring(1);
            }
        }
        return null;
    }

    private String resolveAlbumCover(Song song) {
        String albumCover = song.getAlbum().getCoverUrl();
        if (albumCover != null && !albumCover.isBlank()) {
            return albumCover;
        }

        String artistImage = song.getAlbum().getArtist().getImageUrl();
        if (artistImage != null && !artistImage.isBlank()) {
            return artistImage;
        }

        return DEFAULT_COVER_URL;
    }

    private boolean isGuessCorrect(String actualTitle, String guessedTitle) {
        String actual = normalizeTitle(actualTitle);
        String guess = normalizeTitle(guessedTitle);

        if (actual.isBlank() || guess.isBlank()) {
            return false;
        }

        if (actual.equals(guess)) {
            return true;
        }

        List<String> actualTokens = tokenize(actual);
        List<String> guessTokens = tokenize(guess);
        if (guessTokens.isEmpty()) {
            return false;
        }

        boolean tokensMatch = actualTokens.containsAll(guessTokens);
        if (tokensMatch && guessTokens.size() >= 2) {
            return true;
        }

        int distance = levenshtein(actual, guess);
        int maxLen = Math.max(actual.length(), guess.length());
        double similarity = maxLen == 0 ? 0 : (maxLen - distance) / (double) maxLen;

        return similarity >= 0.88 && Math.min(actual.length(), guess.length()) >= 5;
    }

    private String normalizeTitle(String value) {
        if (value == null) {
            return "";
        }
        String cleaned = value
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\(.*?\\)", " ")
                .replaceAll("\\[.*?\\]", " ")
                .replaceAll("feat\\.?|ft\\.?|featuring", " ")
                .replaceAll("official|video|audio|lyric|remix|version|explicit|clean|live|edit", " ")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return cleaned.replaceAll("\\s+", " ").trim();
    }

    private List<String> tokenize(String value) {
        return List.of(value.split(" ")).stream()
                .filter(token -> !token.isBlank())
                .filter(token -> token.length() > 2)
                .filter(token -> !List.of("the", "and", "for", "with", "from", "official", "audio", "video").contains(token))
                .toList();
    }

    private int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[a.length()][b.length()];
    }

    private GameScore.Difficulty resolveDifficulty(int guessTimeSeconds) {
        if (guessTimeSeconds <= 1) return GameScore.Difficulty.EXPERT;
        if (guessTimeSeconds <= 3) return GameScore.Difficulty.HARD;
        if (guessTimeSeconds <= 5) return GameScore.Difficulty.MEDIUM;
        if (guessTimeSeconds <= 10) return GameScore.Difficulty.EASY;
        return GameScore.Difficulty.BEGINNER;
    }

    private Long parseUserId(Object raw) {
        if (raw == null) return null;
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private int parseGuessTime(Object guessTimeRaw) {
        if (guessTimeRaw == null) {
            return 30;
        }
        try {
            int parsed = Integer.parseInt(guessTimeRaw.toString());
            if (parsed < 0) {
                return 0;
            }
            if (parsed > 30) {
                return 30;
            }
            return parsed;
        } catch (NumberFormatException e) {
            return 30;
        }
    }

    /**
     * Calculate points based on guess time
     */
    private int calculatePoints(int guessTimeSeconds) {
        int basePoints = 100;
        int timeBonus = 0;

        if (guessTimeSeconds <= 1) {
            timeBonus = 400;
        } else if (guessTimeSeconds <= 3) {
            timeBonus = 300;
        } else if (guessTimeSeconds <= 5) {
            timeBonus = 200;
        } else if (guessTimeSeconds <= 10) {
            timeBonus = 100;
        } else if (guessTimeSeconds <= 15) {
            timeBonus = 50;
        }

        return basePoints + timeBonus;
    }

    /**
     * GET /api/game/leaderboard
     * Get global leaderboard
     */
    @GetMapping("/leaderboard")
    public List<Map<String, Object>> getGlobalLeaderboard(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "global") String scope,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long userId) {
        List<Object[]> results;

        if ("weekly".equalsIgnoreCase(scope)) {
            results = gameScoreRepository.getWeeklyLeaderboard(LocalDateTime.now().minusDays(7));
        } else if ("friends".equalsIgnoreCase(scope) && userId != null) {
            results = gameScoreRepository.getUserLeaderboard(userId);
        } else {
            results = gameScoreRepository.getGlobalLeaderboard();
        }

        return results.stream()
                .limit(100)
                .map(row -> {
                    Map<String, Object> entry = new HashMap<>();
                    entry.put("userId", row[0]);
                    entry.put("username", row[1]);
                    entry.put("totalPoints", row[2]);
                    return entry;
                })
                .collect(Collectors.toList());
    }

    /**
     * GET /api/game/leaderboard/artist/{artistId}
     * Get artist-specific leaderboard
     */
    @GetMapping("/leaderboard/artist/{artistId}")
    public List<Map<String, Object>> getArtistLeaderboard(@PathVariable Long artistId) {
        List<Object[]> results = gameScoreRepository.getArtistLeaderboard(artistId);
        return results.stream()
                .limit(100)
                .map(row -> {
                    Map<String, Object> entry = new HashMap<>();
                    entry.put("userId", row[0]);
                    entry.put("username", row[1]);
                    entry.put("totalPoints", row[2]);
                    return entry;
                })
                .collect(Collectors.toList());
    }
}
