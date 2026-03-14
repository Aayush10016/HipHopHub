package com.hiphophub.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Recommendation Entity
 * 
 * Represents the "Song of the Day" or recommended songs.
 * Can be daily recommendations, trending, or personalized.
 */
@Entity
@Table(name = "recommendations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecommendationType type;

    @Column(name = "recommendation_date", nullable = false)
    private LocalDate recommendationDate;

    @Column(length = 1000)
    private String description; // Why this song is recommended

    private Boolean active; // Is this recommendation currently active

    // Relationship: Each recommendation is for one song
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    /**
     * Types of recommendations
     */
    public enum RecommendationType {
        SONG_OF_THE_DAY, // Daily featured song
        TRENDING, // Currently trending
        UNDERRATED_GEM, // Hidden gems
        PERSONALIZED, // Based on user preferences
        EDITOR_CHOICE // Hand-picked by curators
    }
}
