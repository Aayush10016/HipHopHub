package com.hiphophub.controller;

import com.hiphophub.model.Album;
import com.hiphophub.model.Song;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.service.YouTubeResolverService;
import com.hiphophub.util.YouTubeLinkBuilder;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/youtube")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class YouTubeController {

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private AlbumRepository albumRepository;

    @Autowired
    private YouTubeResolverService youTubeResolverService;

    @GetMapping("/song/{songId}")
    public ResponseEntity<Map<String, Object>> resolveSong(@PathVariable Long songId) {
        Song song = songRepository.findById(songId).orElse(null);
        if (song == null || song.getAlbum() == null || song.getAlbum().getArtist() == null) {
            return ResponseEntity.notFound().build();
        }

        String artistName = song.getAlbum().getArtist().getName();
        String url = youTubeResolverService.resolveSongUrl(artistName, song.getTitle());
        if (url == null || url.isBlank()) {
            url = YouTubeLinkBuilder.forSong(artistName, song.getTitle());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("url", url);
        response.put("songId", songId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/album/{albumId}")
    public ResponseEntity<Map<String, Object>> resolveAlbum(@PathVariable Long albumId) {
        Album album = albumRepository.findById(albumId).orElse(null);
        if (album == null || album.getArtist() == null) {
            return ResponseEntity.notFound().build();
        }

        String artistName = album.getArtist().getName();
        String url = youTubeResolverService.resolveAlbumUrl(artistName, album.getTitle());
        if (url == null || url.isBlank()) {
            url = YouTubeLinkBuilder.forAlbum(artistName, album.getTitle());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("url", url);
        response.put("albumId", albumId);
        return ResponseEntity.ok(response);
    }
}
