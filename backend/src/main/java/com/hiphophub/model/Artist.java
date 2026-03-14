package com.hiphophub.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Artist Entity
 * 
 * Represents a hip-hop artist in the database.
 * 
 * JPA Annotations:
 * - @Entity: Marks this class as a database table
 * - @Table: Specifies the table name
 * - @Id: Marks the primary key
 * - @GeneratedValue: Auto-generates IDs
 * 
 * Lombok Annotations:
 * - @Data: Auto-generates getters, setters, toString, equals, hashCode
 * - @NoArgsConstructor: Creates empty constructor
 * - @AllArgsConstructor: Creates constructor with all fields
 */
@Entity
@Table(name = "artists")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Artist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(length = 2000)
    private String bio;

    @Column(name = "image_url")
    private String imageUrl;

    @JsonIgnore
    @Column(name = "external_id", unique = true)
    private String externalId;

    private String genre;

    @Column(name = "monthly_listeners")
    private Long monthlyListeners;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Relationship: One artist has many albums
    @OneToMany(mappedBy = "artist", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Album> albums = new ArrayList<>();

    // Relationship: One artist has many tours
    @OneToMany(mappedBy = "artist", cascade = CascadeType.ALL, orphanRemoval = true)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private List<Tour> tours = new ArrayList<>();

    /**
     * Automatically set timestamps before persisting
     */
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    /**
     * Automatically update timestamp before updating
     */
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
