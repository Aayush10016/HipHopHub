package com.hiphophub.repository;

import com.hiphophub.model.GameScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * GameScore Repository
 */
@Repository
public interface GameScoreRepository extends JpaRepository<GameScore, Long> {

    /**
     * Find scores by user ID
     */
    List<GameScore> findByUserId(Long userId);

    /**
     * Get global leaderboard (top 100 players by total points)
     */
    @Query("SELECT gs.user.id, gs.user.username, SUM(gs.points) as totalPoints " +
            "FROM GameScore gs " +
            "GROUP BY gs.user.id, gs.user.username " +
            "ORDER BY totalPoints DESC")
    List<Object[]> getGlobalLeaderboard();

    /**
     * Get artist-specific leaderboard
     */
    @Query("SELECT gs.user.id, gs.user.username, SUM(gs.points) as totalPoints " +
            "FROM GameScore gs " +
            "JOIN gs.song s " +
            "JOIN s.album a " +
            "WHERE a.artist.id = :artistId " +
            "GROUP BY gs.user.id, gs.user.username " +
            "ORDER BY totalPoints DESC")
    List<Object[]> getArtistLeaderboard(Long artistId);

    /**
     * Get user's total points
     */
    @Query("SELECT SUM(gs.points) FROM GameScore gs WHERE gs.user.id = :userId")
    Long getTotalPointsByUser(Long userId);
}
