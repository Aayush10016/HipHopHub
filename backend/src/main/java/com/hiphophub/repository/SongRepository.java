package com.hiphophub.repository;

import com.hiphophub.model.Song;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Song Repository
 */
@Repository
public interface SongRepository extends JpaRepository<Song, Long> {

    /**
     * Find songs by album ID
     */
    List<Song> findByAlbumId(Long albumId);

    /**
     * Find songs by artist ID through album relation.
     */
    List<Song> findByAlbumArtistId(Long artistId);

    /**
     * Count songs by artist ID through album relation.
     */
    long countByAlbumArtistId(Long artistId);

    /**
     * Find song by external ID
     */
    Optional<Song> findByExternalId(String externalId);

    /**
     * Get random song for the game (with preview URL)
     */
    @Query(value = "SELECT * FROM songs WHERE preview_url IS NOT NULL ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Song> findRandomSongWithPreview();

    /**
     * Get random song by artist for artist-specific game
     */
    @Query(value = "SELECT s.* FROM songs s JOIN albums a ON s.album_id = a.id WHERE a.artist_id = :artistId AND s.preview_url IS NOT NULL ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Song> findRandomSongByArtist(Long artistId);

    /**
     * Get random Indian Hip-Hop song (artist genre contains 'hip hop' or 'rap')
     */
    @Query(value = """
            SELECT s.* FROM songs s 
            JOIN albums a ON s.album_id = a.id 
            JOIN artists ar ON a.artist_id = ar.id
            WHERE s.preview_url IS NOT NULL
              AND (LOWER(ar.genre) LIKE '%hip hop%' OR LOWER(ar.genre) LIKE '%rap%' OR LOWER(ar.genre) LIKE '%desi%')
            ORDER BY RAND() LIMIT 1
            """, nativeQuery = true)
    Optional<Song> findRandomIndianHipHopWithPreview();

    @Query("""
            SELECT s FROM Song s
            JOIN FETCH s.album a
            JOIN FETCH a.artist ar
            WHERE s.previewUrl IS NOT NULL
              AND a.releaseDate IS NOT NULL
              AND a.releaseDate >= :fromDate
            ORDER BY a.releaseDate DESC, s.id DESC
            """)
    List<Song> findPlayableSongsReleasedAfter(LocalDate fromDate, Pageable pageable);

    @Query("""
            SELECT s FROM Song s
            JOIN FETCH s.album a
            JOIN FETCH a.artist ar
            WHERE s.previewUrl IS NOT NULL
            ORDER BY a.releaseDate DESC, s.id DESC
            """)
    List<Song> findLatestPlayableSongs(Pageable pageable);
}
