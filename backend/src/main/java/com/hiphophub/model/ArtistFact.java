package com.hiphophub.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Artist Fact Model
 * Stores fun facts about artists for the "Fun Facts" tab
 */
@Entity
@Table(name = "artist_facts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ArtistFact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "artist_id", nullable = false)
    private Artist artist;

    @Column(nullable = false, length = 1000)
    private String fact;

    @Column(name = "display_order")
    private Integer displayOrder; // Order to display facts (1, 2, 3...)
}
