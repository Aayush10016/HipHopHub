package com.hiphophub.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Song Entity
 * 
 * Represents a song/track in the database.
 * Connected to an Album.
 * Contains preview URL for the "Guess the Song" game.
 */
@Entity
@Table(name = "songs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Song {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(name = "duration_ms")
    private Integer durationMs; // Duration in milliseconds

    @Column(name = "preview_url")
    private String previewUrl; // 30-second preview URL

    @JsonIgnore
    @Column(name = "external_id", unique = true)
    private String externalId;

    @Column(name = "track_number")
    private Integer trackNumber; // Position in the album

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Relationship: Many songs belong to one album
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "album_id", nullable = false)
    private Album album;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
