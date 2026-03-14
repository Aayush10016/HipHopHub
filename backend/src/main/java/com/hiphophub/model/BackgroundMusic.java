package com.hiphophub.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Background Music Model
 * Stores songs for the landing page background music
 */
@Entity
@Table(name = "background_music")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BackgroundMusic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "song_name", nullable = false)
    private String songName;

    @Column(name = "artist_name", nullable = false)
    private String artistName;

    @Column(name = "preview_url", nullable = false)
    private String previewUrl; // 30-second preview URL

    @Column(name = "is_active")
    private Boolean isActive = true; // For rotation/enabling/disabling
}
