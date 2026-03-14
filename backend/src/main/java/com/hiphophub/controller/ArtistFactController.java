package com.hiphophub.controller;

import com.hiphophub.model.ArtistFact;
import com.hiphophub.repository.ArtistFactRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Artist Facts Controller
 * Handles fun facts for artist profiles
 */
@RestController
@RequestMapping("/api/artist-facts")
@CrossOrigin(origins = "*")
public class ArtistFactController {

    @Autowired
    private ArtistFactRepository artistFactRepository;

    /**
     * GET /api/artist-facts/{artistId}
     * Get stored fun facts for an artist.
     */
    @GetMapping("/{artistId}")
    public ResponseEntity<List<ArtistFact>> getArtistFacts(@PathVariable Long artistId) {
        List<ArtistFact> facts = artistFactRepository.findByArtistIdOrderByDisplayOrderAsc(artistId);
        return ResponseEntity.ok(facts);
    }
}
