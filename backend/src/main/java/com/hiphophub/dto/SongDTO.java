package com.hiphophub.dto;

import lombok.Data;

/**
 * Song DTO with embedded album and artist info
 */
@Data
public class SongDTO {
    private Long id;
    private String title;
    private Integer durationMs;
    private String previewUrl;
    private Integer trackNumber;
    private String artistName;
    private String coverUrl;
    private String youtubeUrl;
    private AlbumDTO album;

    public SongDTO(Long id, String title, Integer durationMs, String previewUrl, Integer trackNumber, String artistName,
            String coverUrl, String youtubeUrl, AlbumDTO album) {
        this.id = id;
        this.title = title;
        this.durationMs = durationMs;
        this.previewUrl = previewUrl;
        this.trackNumber = trackNumber;
        this.artistName = artistName;
        this.coverUrl = coverUrl;
        this.youtubeUrl = youtubeUrl;
        this.album = album;
    }
}
