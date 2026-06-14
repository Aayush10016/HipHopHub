package com.hiphophub.repository;

import com.hiphophub.model.ArcadeScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ArcadeScoreRepository extends JpaRepository<ArcadeScore, Long> {

    @Query("SELECT a.user.id, a.user.username, MAX(a.points) as bestPoints " +
            "FROM ArcadeScore a " +
            "WHERE a.mode = :mode " +
            "GROUP BY a.user.id, a.user.username " +
            "ORDER BY bestPoints DESC")
    List<Object[]> getModeLeaderboard(ArcadeScore.Mode mode);

    @Query("SELECT a.user.id, a.user.username, MAX(a.points) as bestPoints " +
            "FROM ArcadeScore a " +
            "WHERE a.mode = :mode AND a.playedAt >= :since " +
            "GROUP BY a.user.id, a.user.username " +
            "ORDER BY bestPoints DESC")
    List<Object[]> getModeLeaderboardSince(ArcadeScore.Mode mode, LocalDateTime since);

    @Query("SELECT a.user.id, a.user.username, MAX(a.points) as bestPoints " +
            "FROM ArcadeScore a " +
            "WHERE a.mode = :mode AND a.user.id = :userId " +
            "GROUP BY a.user.id, a.user.username " +
            "ORDER BY bestPoints DESC")
    List<Object[]> getModeLeaderboardForUser(ArcadeScore.Mode mode, Long userId);

    @Query("SELECT MAX(a.points) FROM ArcadeScore a WHERE a.user.id = :userId AND a.mode = :mode")
    Integer getBestScoreByUserAndMode(Long userId, ArcadeScore.Mode mode);
}
