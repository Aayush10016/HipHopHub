package com.hiphophub.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * GameScore Entity
 * 
 * Represents a user's score in the "Guess the Song" game.
 * Tracks which song was played, difficulty, time taken, and points earned.
 */
@Entity
@Table(name = "game_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "guess_time_ms", nullable = false)
    private Integer guessTimeMs; // Time taken to guess (in milliseconds)

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Difficulty difficulty;

    @Column(nullable = false)
    private Integer points;

    @Column(name = "played_at", nullable = false)
    private LocalDateTime playedAt;

    // Relationship: Many game scores belong to one user
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Relationship: Many game scores can be for the same song
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @PrePersist
    protected void onCreate() {
        playedAt = LocalDateTime.now();
    }

    /**
     * Enum for Game Difficulty Levels
     * Based on preview duration
     */
    public enum Difficulty {
        EXPERT(1000, 500), // 1 second preview
        HARD(3000, 300), // 3 seconds preview
        MEDIUM(5000, 200), // 5 seconds preview
        EASY(10000, 100), // 10 seconds preview
        BEGINNER(30000, 50); // 30 seconds preview

        private final int previewDurationMs;
        private final int basePoints;

        Difficulty(int previewDurationMs, int basePoints) {
            this.previewDurationMs = previewDurationMs;
            this.basePoints = basePoints;
        }

        public int getPreviewDurationMs() {
            return previewDurationMs;
        }

        public int getBasePoints() {
            return basePoints;
        }
    }
}
