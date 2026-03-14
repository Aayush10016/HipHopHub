package com.hiphophub.controller;

import com.hiphophub.model.Song;
import com.hiphophub.model.GameScore;
import com.hiphophub.model.User;
import com.hiphophub.repository.GameScoreRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.repository.UserRepository;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

    private static final String DEFAULT_COVER_URL =
            "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80";

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private GameScoreRepository gameScoreRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * GET /api/game/random-song
     * Get a random song for the game
     */
    @GetMapping("/random-song")
    public ResponseEntity<Map<String, Object>> getRandomSong() {
        List<Song> playableDhhSongs = songRepository.findAll().stream()
                .filter(this::isPlayableSong)
                .filter(this::isDhhSong)
                .toList();

        if (playableDhhSongs.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Song song = playableDhhSongs.get(ThreadLocalRandom.current().nextInt(playableDhhSongs.size()));
        return ResponseEntity.ok(buildGameSongResponse(song));
    }

    /**
     * GET /api/game/random-song/artist/{artistId}
     * Get a random song by specific artist
     */
    @GetMapping("/random-song/artist/{artistId}")
    public ResponseEntity<Map<String, Object>> getRandomSongByArtist(@PathVariable Long artistId) {
        return songRepository.findRandomSongByArtist(artistId)
                .map(song -> ResponseEntity.ok(buildGameSongResponse(song)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST /api/game/submit-guess
     * Submit a guess and calculate points
     */
    @PostMapping("/submit-guess")
    public ResponseEntity<Map<String, Object>> submitGuess(@RequestBody Map<String, Object> guessData) {
        Long songId = Long.valueOf(guessData.get("songId").toString());
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
        response.put("artistName", song.getAlbum().getArtist().getName());
        response.put("albumName", song.getAlbum().getTitle());
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
        response.put("youtubeUrl", YouTubeLinkBuilder.forSong(artistName, song.getTitle()));
        return response;
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
                song.getAlbum().getArtist().getGenre());
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
    public List<Map<String, Object>> getGlobalLeaderboard() {
        List<Object[]> results = gameScoreRepository.getGlobalLeaderboard();
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
