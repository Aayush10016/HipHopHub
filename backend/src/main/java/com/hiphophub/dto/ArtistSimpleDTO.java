package com.hiphophub.dto;

import lombok.Data;

/**
 * Simplified Artist DTO for embedding in other responses
 */
@Data
public class ArtistSimpleDTO {
    private Long id;
    private String name;
    private String imageUrl;
    private Long monthlyListeners;
    private String genre;

    public ArtistSimpleDTO(Long id, String name, String imageUrl, Long monthlyListeners, String genre) {
        this.id = id;
        this.name = name;
        this.imageUrl = imageUrl;
        this.monthlyListeners = monthlyListeners;
        this.genre = genre;
    }
}
