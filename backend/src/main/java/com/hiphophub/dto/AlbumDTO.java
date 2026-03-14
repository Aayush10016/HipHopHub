package com.hiphophub.dto;

import java.time.LocalDate;
import lombok.Data;

/**
 * Album DTO with embedded artist info
 */
@Data
public class AlbumDTO {
    private Long id;
    private String title;
    private LocalDate releaseDate;
    private String type;
    private String coverUrl;
    private String youtubeUrl;
    private ArtistSimpleDTO artist;

    public AlbumDTO(Long id, String title, LocalDate releaseDate, String type, String coverUrl,
            String youtubeUrl, ArtistSimpleDTO artist) {
        this.id = id;
        this.title = title;
        this.releaseDate = releaseDate;
        this.type = type;
        this.coverUrl = coverUrl;
        this.youtubeUrl = youtubeUrl;
        this.artist = artist;
    }
}
