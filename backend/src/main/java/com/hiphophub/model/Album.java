package com.hiphophub.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Album Entity
 * 
 * Represents an album, EP, or single in the database.
 * Connected to an Artist.
 */
@Entity
@Table(name = "albums")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Album {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(name = "release_date")
    private LocalDate releaseDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "album_type", nullable = false)
    private AlbumType type;

    @Column(name = "cover_url")
    private String coverUrl;

    @JsonIgnore
    @Column(name = "external_id", unique = true)
    private String externalId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Relationship: Many albums belong to one artist
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "artist_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Artist artist;

    // Relationship: One album has many songs
    @OneToMany(mappedBy = "album", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Song> songs = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Enum for Album Types
     */
    public enum AlbumType {
        ALBUM, // Full-length album
        EP, // Extended Play (shorter than album)
        SINGLE, // Single track release
        COMPILATION, // Multiple artists compilation
        APPEARS_ON // Guest/feature appearances
    }
}
