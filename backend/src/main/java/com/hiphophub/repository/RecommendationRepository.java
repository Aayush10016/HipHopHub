package com.hiphophub.repository;

import com.hiphophub.model.Recommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Recommendation Repository
 */
@Repository
public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {

    /**
     * Get active Song of the Day
     */
    @Query("SELECT r FROM Recommendation r WHERE r.type = 'SONG_OF_THE_DAY' AND r.active = true AND r.recommendationDate = :today")
    Optional<Recommendation> getTodaysSongOfTheDay(LocalDate today);

    /**
     * Get all recommendations by type
     */
    List<Recommendation> findByType(Recommendation.RecommendationType type);

    /**
     * Get active recommendations
     */
    List<Recommendation> findByActiveTrue();

    /**
     * Get trending songs
     */
    @Query("SELECT r FROM Recommendation r WHERE r.type = 'TRENDING' AND r.active = true ORDER BY r.recommendationDate DESC")
    List<Recommendation> getTrendingRecommendations();

    /**
     * Get underrated gems
     */
    @Query(value = "SELECT * FROM recommendations WHERE type = 'UNDERRATED_GEM' AND active = true ORDER BY RAND() LIMIT 10", nativeQuery = true)
    List<Recommendation> getUnderratedGems();
}
