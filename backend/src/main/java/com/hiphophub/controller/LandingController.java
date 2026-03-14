package com.hiphophub.controller;

import com.hiphophub.model.BackgroundMusic;
import com.hiphophub.repository.BackgroundMusicRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Landing Page Controller
 * Handles landing page background music
 */
@RestController
@RequestMapping("/api/landing")
@CrossOrigin(origins = "*")
public class LandingController {

    @Autowired
    private BackgroundMusicRepository backgroundMusicRepository;

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
}
