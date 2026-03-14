package com.hiphophub.controller;

import com.hiphophub.model.Recommendation;
import com.hiphophub.model.Song;
import com.hiphophub.repository.RecommendationRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.util.YouTubeLinkBuilder;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Recommendation Controller
 *
 * Handles song recommendations including Song of the Day feature.
 */
@RestController
@RequestMapping("/api/recommendations")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class RecommendationController {

    @Autowired
    private RecommendationRepository recommendationRepository;

    @Autowired
    private SongRepository songRepository;

    /**
     * GET /api/recommendations/song-of-the-day
     * Get today's featured song
     */
    @GetMapping("/song-of-the-day")
    public ResponseEntity<Map<String, Object>> getSongOfTheDay() {
        Optional<Recommendation> recOpt = recommendationRepository.getTodaysSongOfTheDay(LocalDate.now())
                .filter(rec -> rec.getSong() != null)
                .filter(rec -> isPlayableSong(rec.getSong()));

        if (recOpt.isPresent()) {
            Recommendation rec = recOpt.get();
            return ResponseEntity.ok(buildSongOfDayResponse(
                    rec.getId(),
                    rec.getDescription(),
                    rec.getRecommendationDate(),
                    rec.getSong()));
        }

        return pickFallbackSongOfDay()
                .map(song -> ResponseEntity.ok(buildSongOfDayResponse(
                        null,
                        "Auto-picked from the full playable catalog.",
                        LocalDate.now(),
                        song)))
                .orElse(ResponseEntity.notFound().build());
    }

    private Optional<Song> pickFallbackSongOfDay() {
        List<Song> playableSongs = new ArrayList<>(songRepository.findAll().stream()
                .filter(this::isPlayableSong)
                .toList());
        if (playableSongs.isEmpty()) {
            return Optional.empty();
        }

        playableSongs.sort(Comparator.comparing(Song::getId));
        int daySeed = Math.abs(LocalDate.now().toString().hashCode());
        int randomIndex = daySeed % playableSongs.size();
        return Optional.of(playableSongs.get(randomIndex));
    }

    private boolean isPlayableSong(Song song) {
        if (song == null || song.getAlbum() == null || song.getAlbum().getArtist() == null) {
            return false;
        }
        if (song.getPreviewUrl() == null || song.getPreviewUrl().isBlank()) {
            return false;
        }
        return true;
    }

    private Map<String, Object> buildSongOfDayResponse(
            Long recommendationId,
            String description,
            LocalDate date,
            Song song) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", recommendationId);
        response.put("description", description);
        response.put("date", date);

        String artistName = song.getAlbum().getArtist().getName();

        Map<String, Object> songInfo = new HashMap<>();
        songInfo.put("id", song.getId());
        songInfo.put("title", song.getTitle());
        songInfo.put("artist", artistName);
        songInfo.put("album", song.getAlbum().getTitle());
        songInfo.put("coverUrl", song.getAlbum().getCoverUrl());
        songInfo.put("previewUrl", song.getPreviewUrl());
        songInfo.put("youtubeUrl", YouTubeLinkBuilder.forSong(artistName, song.getTitle()));

        response.put("song", songInfo);
        return response;
    }

    /**
     * GET /api/recommendations/trending
     * Get trending songs
     */
    @GetMapping("/trending")
    public List<Recommendation> getTrending() {
        return recommendationRepository.getTrendingRecommendations();
    }

    /**
     * GET /api/recommendations/underrated
     * Get underrated gems
     */
    @GetMapping("/underrated")
    public List<Recommendation> getUnderratedGems() {
        return recommendationRepository.getUnderratedGems();
    }

    /**
     * GET /api/recommendations/discover
     * Random song discovery (for users who don't know what to listen to)
     */
    @GetMapping("/discover")
    public List<Recommendation> discover() {
        return recommendationRepository.findByActiveTrue();
    }

    /**
     * POST /api/recommendations
     * Create a new recommendation (admin feature)
     */
    @PostMapping
    public Recommendation createRecommendation(@RequestBody Recommendation recommendation) {
        return recommendationRepository.save(recommendation);
    }
}
