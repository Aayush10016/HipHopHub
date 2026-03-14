package com.hiphophub.controller;

import com.hiphophub.dto.AlbumDTO;
import com.hiphophub.dto.ArtistSimpleDTO;
import com.hiphophub.dto.SongDTO;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Song;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.util.DhhArtistClassifier;
import com.hiphophub.util.YouTubeLinkBuilder;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
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

    @Autowired
    private SongRepository songRepository;

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
        List<Song> songsToChooseFrom = findPlayableSongs(songRepository.findAll());
        if (songsToChooseFrom.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Song randomSong = songsToChooseFrom.get(ThreadLocalRandom.current().nextInt(songsToChooseFrom.size()));
        return ResponseEntity.ok(convertToDTO(randomSong));
    }

    @GetMapping("/random/dhh")
    public ResponseEntity<SongDTO> getRandomDhhSong() {
        List<Song> dhhSongs = findDhhPlayableSongs(songRepository.findAll());
        if (dhhSongs.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Song randomSong = dhhSongs.get(ThreadLocalRandom.current().nextInt(dhhSongs.size()));
        return ResponseEntity.ok(convertToDTO(randomSong));
    }

    @GetMapping("/top/dhh")
    public List<SongDTO> getTopDhhSongs(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit) {
        int normalizedDays = Math.max(1, Math.min(days, 365));
        int normalizedLimit = Math.max(1, Math.min(limit, 100));
        LocalDate fromDate = LocalDate.now().minusDays(normalizedDays);

        return findDhhPlayableSongs(songRepository.findAll()).stream()
                .filter(song -> song.getAlbum() != null && song.getAlbum().getReleaseDate() != null)
                .filter(song -> !song.getAlbum().getReleaseDate().isBefore(fromDate))
                .sorted(Comparator
                        .comparing((Song song) -> song.getAlbum().getReleaseDate())
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
        return songRepository.findByAlbumArtistId(artistId).stream()
                .filter(this::isPlayableSong)
                .sorted(Comparator
                        .comparing((Song song) -> releaseDateOrMin(song.getAlbum()))
                        .reversed()
                        .thenComparing(Song::getId, Comparator.reverseOrder()))
                .map(this::convertToDTO)
                .collect(Collectors.toList());
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

    private List<Song> findPlayableSongs(List<Song> songs) {
        return songs.stream()
                .filter(this::isPlayableSong)
                .toList();
    }

    private List<Song> findDhhPlayableSongs(List<Song> songs) {
        return songs.stream()
                .filter(this::isPlayableSong)
                .filter(song -> {
                    Album album = song.getAlbum();
                    if (album == null || album.getArtist() == null) {
                        return false;
                    }
                    Artist artist = album.getArtist();
                    return DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre());
                })
                .toList();
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
