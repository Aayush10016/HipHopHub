package com.hiphophub.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ITunesTrackDTO {
    private String wrapperType;
    private String kind;
    private Long artistId;
    private Long trackId;
    private String trackName;
    private String previewUrl;
    private Integer trackTimeMillis;
    private Integer trackNumber;
    private Long collectionId;
    private Long collectionArtistId;
    private String collectionName;
    private String collectionArtistName;
    private String artistName;
    private String releaseDate;
    private String artworkUrl100;
    private String primaryGenreName;
    private Integer trackCount;
}
