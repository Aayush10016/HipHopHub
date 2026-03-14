package com.hiphophub.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeezerSearchResponse {
    private List<DeezerArtistDTO> data;
}
