package com.hiphophub.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ITunesSearchResponse {
    private Integer resultCount;
    private List<ITunesTrackDTO> results;
}
