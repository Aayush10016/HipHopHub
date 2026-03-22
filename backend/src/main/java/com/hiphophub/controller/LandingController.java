package com.hiphophub.controller;

import com.hiphophub.model.Artist;
import com.hiphophub.model.BackgroundMusic;
import com.hiphophub.model.Song;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.BackgroundMusicRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Landing Page Controller
 * Handles landing page background music
 */
@RestController
@RequestMapping("/api/landing")
@CrossOrigin(origins = "*")
public class LandingController {

    private static final Duration TRACK_POOL_TTL = Duration.ofMinutes(3);

    @Autowired
    private BackgroundMusicRepository backgroundMusicRepository;

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private ArtistRepository artistRepository;

    private volatile List<Song> cachedLandingTracks = List.of();
    private volatile Instant cachedLandingTracksAt;

    /**
     * Get random background song for landing page
     * GET /api/landing/background-song
     */
    @GetMapping("/background-song")
    public ResponseEntity<Map<String, Object>> getBackgroundSong() {
        BackgroundMusic song = backgroundMusicRepository.findRandomActiveSong()
                .orElse(null);

        if (song == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("songName", song.getSongName());
        response.put("artistName", song.getArtistName());
        response.put("previewUrl", song.getPreviewUrl());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getLandingOverview() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("track", buildTrackPayload());
        payload.put("topSongs", buildTopSongsPayload());
        payload.put("undergroundArtists", buildUndergroundArtistsPayload());
        payload.put("trivia", buildTriviaPayload());
        return ResponseEntity.ok(payload);
    }

    private Map<String, Object> buildTrackPayload() {
        List<Song> pool = getLandingTrackPool();
        if (pool.isEmpty()) {
            return Map.of();
        }
        Song song = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        if (song == null || song.getAlbum() == null || song.getAlbum().getArtist() == null) {
            return Map.of();
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("id", song.getId());
        payload.put("title", song.getTitle());
        payload.put("previewUrl", song.getPreviewUrl());
        payload.put("artistName", song.getAlbum().getArtist().getName());
        payload.put("coverUrl", song.getAlbum().getCoverUrl());
        payload.put("youtubeUrl", YouTubeLinkBuilder.forSong(song.getAlbum().getArtist().getName(), song.getTitle()));

        Map<String, Object> album = new HashMap<>();
        album.put("title", song.getAlbum().getTitle());
        album.put("coverUrl", song.getAlbum().getCoverUrl());
        Map<String, Object> artist = new HashMap<>();
        artist.put("name", song.getAlbum().getArtist().getName());
        album.put("artist", artist);
        payload.put("album", album);
        return payload;
    }

    private List<Map<String, Object>> buildTopSongsPayload() {
        List<Song> songs = songRepository.findPlayableSongsReleasedAfter(Instant.now().minus(Duration.ofDays(120)).atZone(java.time.ZoneId.systemDefault()).toLocalDate(),
                PageRequest.of(0, 20));
        return songs.stream()
                .filter(song -> song.getAlbum() != null && song.getAlbum().getArtist() != null)
                .filter(song -> DhhArtistClassifier.isDhhArtist(song.getAlbum().getArtist().getName(), song.getAlbum().getArtist().getGenre()))
                .limit(5)
                .map(song -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", song.getId());
                    row.put("title", song.getTitle());
                    row.put("artistName", song.getAlbum().getArtist().getName());
                    return row;
                })
                .toList();
    }

    private List<Map<String, Object>> buildUndergroundArtistsPayload() {
        List<Artist> pool = artistRepository.findAll().stream()
                .filter(artist -> DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre()))
                .filter(artist -> artist.getMonthlyListeners() != null && artist.getMonthlyListeners() > 0)
                .sorted(Comparator.comparing(Artist::getMonthlyListeners))
                .limit(30)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        java.util.Collections.shuffle(pool);
        return pool.stream()
                .limit(3)
                .map(artist -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("id", artist.getId());
                    row.put("name", artist.getName());
                    row.put("monthlyListeners", artist.getMonthlyListeners());
                    row.put("imageUrl", artist.getImageUrl());
                    row.put("bio", artist.getBio());
                    return row;
                })
                .toList();
    }

    private List<Map<String, String>> buildTriviaPayload() {
        List<Map<String, String>> trivia = new ArrayList<>();
        List<Artist> artists = artistRepository.findAll().stream()
                .filter(artist -> DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre()))
                .filter(artist -> artist.getBio() != null && !artist.getBio().isBlank())
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        java.util.Collections.shuffle(artists);

        for (Artist artist : artists.stream().limit(8).toList()) {
            String[] bioLines = artist.getBio().split("\\.");
            String firstLine = bioLines[0].trim();
            Map<String, String> row = new HashMap<>();
            row.put("title", "Scene Lore");
            row.put("lead", artist.getName());
            row.put("body", firstLine.endsWith(".") ? firstLine : firstLine + ".");
            trivia.add(row);

            if (bioLines.length > 1) {
                Map<String, String> deepCut = new HashMap<>();
                deepCut.put("title", "Deep Cut");
                deepCut.put("lead", artist.getName());
                String secondLine = bioLines[1].trim();
                deepCut.put("body", secondLine.endsWith(".") ? secondLine : secondLine + ".");
                trivia.add(deepCut);
            }

            Map<String, String> prompt = new HashMap<>();
            prompt.put("title", "Quick Quiz");
            prompt.put("lead", artist.getName());
            prompt.put("body", "Can you name a track, project, or guest verse from " + artist.getName() + " before opening the play tab?");
            trivia.add(prompt);
        }

        if (trivia.isEmpty()) {
            Map<String, String> prompt = new HashMap<>();
            prompt.put("title", "Quick Quiz");
            prompt.put("lead", "Name the track");
            prompt.put("body", "Jump into HipHopHub and test yourself in the guessing game with 30-second snippets.");
            trivia.add(prompt);
        }

        return trivia;
    }

    private List<Song> getLandingTrackPool() {
        Instant now = Instant.now();
        if (cachedLandingTracksAt != null
                && Duration.between(cachedLandingTracksAt, now).compareTo(TRACK_POOL_TTL) < 0
                && !cachedLandingTracks.isEmpty()) {
            return cachedLandingTracks;
        }

        List<Song> refreshed = new ArrayList<>(songRepository.findLatestPlayableSongs(PageRequest.of(0, 500)).stream()
                .filter(song -> song.getAlbum() != null && song.getAlbum().getArtist() != null)
                .toList());
        cachedLandingTracks = refreshed;
        cachedLandingTracksAt = now;
        return refreshed;
    }
}
