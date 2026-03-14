package com.hiphophub.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;

@Data
public class LastFmArtistInfoResponse {
    private Artist artist;

    @Data
    public static class Artist {
        private String name;
        private String mbid;
        private Stats stats;
        private Bio bio;
        private TagList tags;
        private List<Image> image;
    }

    @Data
    public static class Stats {
        private String listeners;
        private String playcount;
    }

    @Data
    public static class Bio {
        private String summary;
    }

    @Data
    public static class TagList {
        private List<Tag> tag;
    }

    @Data
    public static class Tag {
        private String name;
    }

    @Data
    public static class Image {
        @JsonProperty("#text")
        private String url;
        private String size;
    }
}
