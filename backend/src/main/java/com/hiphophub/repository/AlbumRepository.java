package com.hiphophub.repository;

import com.hiphophub.model.Album;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Album Repository
 */
@Repository
public interface AlbumRepository extends JpaRepository<Album, Long> {

    /**
     * Find albums by artist ID
     */
    List<Album> findByArtistId(Long artistId);

    /**
     * Find albums with same title (case-insensitive) across artists.
     */
    List<Album> findByTitleIgnoreCase(String title);

    /**
     * Find albums by external ID
     */
    Optional<Album> findByExternalId(String externalId);

    /**
     * Find latest releases (last 30 days)
     * Uses JPQL (Java Persistence Query Language)
     */
    @Query("SELECT a FROM Album a WHERE a.releaseDate >= :fromDate ORDER BY a.releaseDate DESC")
    List<Album> findLatestReleases(LocalDate fromDate);

    /**
     * Find upcoming releases (future dates)
     */
    @Query("SELECT a FROM Album a WHERE a.releaseDate > :today ORDER BY a.releaseDate ASC")
    List<Album> findUpcomingReleases(LocalDate today);

    /**
     * Find albums by type
     */
    List<Album> findByType(Album.AlbumType type);

    /**
     * Check if album exists by external ID
     */
    boolean existsByExternalId(String externalId);
}
