package com.hiphophub.repository;

import com.hiphophub.model.BackgroundMusic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BackgroundMusicRepository extends JpaRepository<BackgroundMusic, Long> {

    /**
     * Find all active background songs
     */
    List<BackgroundMusic> findByIsActiveTrue();

    /**
     * Get a random active background song
     */
    @Query(value = "SELECT * FROM background_music WHERE is_active = true ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<BackgroundMusic> findRandomActiveSong();
}
