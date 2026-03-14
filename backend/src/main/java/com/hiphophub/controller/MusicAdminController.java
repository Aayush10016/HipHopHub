package com.hiphophub.controller;

import com.hiphophub.model.Artist;
import com.hiphophub.model.Album;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.service.MusicImportService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Music Import Controller
 *
 * Admin endpoints to fetch artists and tracks using Last.fm + iTunes.
 */
@RestController
@RequestMapping("/api/admin/music")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class MusicAdminController {

    @Autowired
    private MusicImportService musicImportService;

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private AlbumRepository albumRepository;

    @Value("${music.import.seed.delay.ms:800}")
    private long seedDelayMs;

    private static final String[] DEFAULT_SEED_ARTISTS = {
            // Indian / DHH
            "DIVINE", "KR$NA", "Seedhe Maut", "MC Stan", "King", "Emiway Bantai",
            "Badshah", "Raftaar", "Ikka", "Karma", "Chaar Diwaari", "Prabh Deep",
            "Fotty Seven", "Karan Aujla", "Tsumyoki", "Nanku", "Karun", "wolf.cryman",
            "Yashraj", "Gravity", "Panther", "Hanumankind",
            "Bella", "Raga", "Dino James", "Rawal", "Yungsta", "MC Altaf",
            "Paradox", "Farhan Khan", "Dakait Shaddy", "MC Square",
            "AP Dhillon", "Bharg", "Dhanji", "Siyaahi", "Vichaar", "Naam Sujal",

            // International
            "Drake", "Kendrick Lamar", "Travis Scott", "J. Cole", "Eminem",
            "50 Cent", "Snoop Dogg", "Kanye West", "Future", "Metro Boomin",
            "Lil Baby", "Pop Smoke", "A$AP Rocky", "Tyler, The Creator", "Post Malone",
            "The Weeknd", "Doja Cat", "Nicki Minaj", "Cardi B", "Central Cee",
            "21 Savage", "Lil Wayne", "Jay-Z", "Nas", "Playboi Carti"
    };

    @PostMapping("/import-artist")
    public ResponseEntity<Map<String, Object>> importArtist(@RequestBody Map<String, String> request) {
        String artistName = request.get("artistName");
        if (artistName == null || artistName.trim().isEmpty()) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "artistName is required");
            return ResponseEntity.badRequest().body(error);
        }

        Artist artist = musicImportService.importArtist(artistName.trim());
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("artist", Map.of(
                "id", artist.getId(),
                "name", artist.getName(),
                "genre", artist.getGenre()));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/import-seeds")
    public ResponseEntity<Map<String, Object>> importSeedArtists() {
        int successCount = 0;
        int failCount = 0;

        for (String artistName : DEFAULT_SEED_ARTISTS) {
            try {
                musicImportService.importArtist(artistName);
                successCount++;
                Thread.sleep(seedDelayMs);
            } catch (Exception e) {
                failCount++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("imported", successCount);
        response.put("failed", failCount);
        response.put("total", DEFAULT_SEED_ARTISTS.length);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/import-batch")
    public ResponseEntity<Map<String, Object>> importBatch(@RequestBody Map<String, List<String>> request) {
        List<String> artistNames = request.get("artistNames");
        if (artistNames == null || artistNames.isEmpty()) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "artistNames list is required");
            return ResponseEntity.badRequest().body(error);
        }

        int successCount = 0;
        int failCount = 0;
        List<String> imported = new ArrayList<>();

        for (String artistName : artistNames) {
            if (artistName == null || artistName.trim().isEmpty()) {
                continue;
            }
            try {
                Artist artist = musicImportService.importArtist(artistName.trim());
                imported.add(artist.getName());
                successCount++;
                Thread.sleep(seedDelayMs);
            } catch (Exception e) {
                failCount++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("imported", successCount);
        response.put("failed", failCount);
        response.put("artists", imported);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh-metadata")
    public ResponseEntity<Map<String, Object>> refreshMetadata() {
        List<Artist> artists = artistRepository.findAll();
        int successCount = 0;
        int failCount = 0;

        for (Artist artist : artists) {
            try {
                musicImportService.refreshArtistMetadata(artist.getName());
                successCount++;
                Thread.sleep(seedDelayMs);
            } catch (Exception e) {
                failCount++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("refreshed", successCount);
        response.put("failed", failCount);
        response.put("total", artists.size());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh-tracks")
    public ResponseEntity<Map<String, Object>> refreshTracks(@RequestBody Map<String, Object> request) {
        Object rawNames = request.get("artistNames");
        List<String> artistNames = new ArrayList<>();
        if (rawNames instanceof List<?> rawList) {
            for (Object item : rawList) {
                if (item != null) {
                    String name = item.toString().trim();
                    if (!name.isBlank()) {
                        artistNames.add(name);
                    }
                }
            }
        }

        if (artistNames.isEmpty()) {
            artistNames = artistRepository.findAll().stream().map(Artist::getName).toList();
        }

        int successCount = 0;
        int failCount = 0;
        List<String> updated = new ArrayList<>();

        for (String artistName : artistNames) {
            try {
                Artist artist = musicImportService.refreshArtistTracks(artistName);
                updated.add(artist.getName());
                successCount++;
                Thread.sleep(seedDelayMs);
            } catch (Exception e) {
                failCount++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("processed", artistNames.size());
        response.put("updated", updated.size());
        response.put("failed", failCount);
        response.put("updatedArtists", updated);
        response.put("succeeded", successCount);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh-images")
    public ResponseEntity<Map<String, Object>> refreshImages(@RequestBody Map<String, Object> request) {
        Object rawNames = request.get("artistNames");
        boolean force = request.get("force") instanceof Boolean && (Boolean) request.get("force");

        List<String> artistNames = new ArrayList<>();
        if (rawNames instanceof List<?> rawList) {
            for (Object item : rawList) {
                if (item != null) {
                    String name = item.toString().trim();
                    if (!name.isBlank()) {
                        artistNames.add(name);
                    }
                }
            }
        }

        if (artistNames.isEmpty()) {
            artistNames = artistRepository.findAll().stream().map(Artist::getName).toList();
        }

        int successCount = 0;
        int failCount = 0;
        List<String> updated = new ArrayList<>();

        for (String artistName : artistNames) {
            try {
                Artist artist = musicImportService.refreshArtistImage(artistName, force);
                if (artist.getImageUrl() != null && !artist.getImageUrl().isBlank()) {
                    updated.add(artist.getName());
                }
                successCount++;
                Thread.sleep(Math.max(seedDelayMs / 2, 25));
            } catch (Exception e) {
                failCount++;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("processed", artistNames.size());
        response.put("updated", updated.size());
        response.put("failed", failCount);
        response.put("force", force);
        response.put("updatedArtists", updated);
        response.put("succeeded", successCount);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sync-images-from-covers")
    public ResponseEntity<Map<String, Object>> syncImagesFromCovers(@RequestBody Map<String, List<String>> request) {
        List<String> artistNames = request.get("artistNames");
        if (artistNames == null || artistNames.isEmpty()) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "artistNames list is required");
            return ResponseEntity.badRequest().body(error);
        }

        Set<String> targets = new HashSet<>();
        for (String name : artistNames) {
            String normalized = normalizeName(name);
            if (!normalized.isBlank()) {
                targets.add(normalized);
            }
        }

        int updatedCount = 0;
        List<String> updatedArtists = new ArrayList<>();
        for (Artist artist : artistRepository.findAll()) {
            if (!targets.contains(normalizeName(artist.getName()))) {
                continue;
            }

            List<Album> albums = albumRepository.findByArtistId(artist.getId());
            String bestCover = albums.stream()
                    .filter(album -> album.getCoverUrl() != null && !album.getCoverUrl().isBlank())
                    .sorted(Comparator
                            .comparing((Album album) -> album.getReleaseDate(), Comparator.nullsLast(Comparator.naturalOrder()))
                            .reversed()
                            .thenComparing(Album::getId, Comparator.reverseOrder()))
                    .map(Album::getCoverUrl)
                    .findFirst()
                    .orElse(null);

            if (bestCover != null && !bestCover.isBlank()) {
                artist.setImageUrl(bestCover);
                artistRepository.save(artist);
                updatedCount++;
                updatedArtists.add(artist.getName());
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("updated", updatedCount);
        response.put("updatedArtists", updatedArtists);
        response.put("requested", artistNames);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/remove-artists")
    public ResponseEntity<Map<String, Object>> removeArtists(@RequestBody Map<String, List<String>> request) {
        List<String> artistNames = request.get("artistNames");
        if (artistNames == null || artistNames.isEmpty()) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "artistNames list is required");
            return ResponseEntity.badRequest().body(error);
        }

        Set<String> targetNames = new HashSet<>();
        for (String name : artistNames) {
            String normalized = normalizeName(name);
            if (!normalized.isBlank()) {
                targetNames.add(normalized);
            }
        }

        if (targetNames.isEmpty()) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "artistNames list is empty after normalization");
            return ResponseEntity.badRequest().body(error);
        }

        List<Artist> artists = artistRepository.findAll();
        List<String> removedNames = new ArrayList<>();

        for (Artist artist : artists) {
            if (targetNames.contains(normalizeName(artist.getName()))) {
                removedNames.add(artist.getName());
                artistRepository.delete(artist);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("removed", removedNames.size());
        response.put("removedArtists", removedNames);
        response.put("requested", artistNames);
        return ResponseEntity.ok(response);
    }

    private String normalizeName(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }
}
