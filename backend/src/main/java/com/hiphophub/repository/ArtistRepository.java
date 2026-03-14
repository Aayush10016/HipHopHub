package com.hiphophub.repository;

import com.hiphophub.model.Artist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Artist Repository
 * 
 * This interface extends JpaRepository, which gives us automatic methods:
 * - findAll() - Get all artists
 * - findById(id) - Get artist by ID
 * - save(artist) - Save or update artist
 * - delete(artist) - Delete artist
 * - count() - Count all artists
 * 
 * We can also define custom queries!
 */
@Repository
public interface ArtistRepository extends JpaRepository<Artist, Long> {

    /**
     * Find artist by external ID
     * Spring Data JPA automatically creates the SQL query!
     */
    Optional<Artist> findByExternalId(String externalId);

    /**
     * Find artist by name (case-insensitive)
     */
    Optional<Artist> findByNameIgnoreCase(String name);

    /**
     * Search artists by partial name match (case-insensitive)
     */
    List<Artist> findByNameContainingIgnoreCase(String name);

    /**
     * Check if artist exists by external ID
     */
    boolean existsByExternalId(String externalId);
}
