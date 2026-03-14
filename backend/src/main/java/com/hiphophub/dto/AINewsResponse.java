package com.hiphophub.dto;

import java.util.List;

public class AINewsResponse {
    private List<NewsItemDTO> stories;
    private String updatedAt;

    public AINewsResponse() {
    }

    public AINewsResponse(List<NewsItemDTO> stories, String updatedAt) {
        this.stories = stories;
        this.updatedAt = updatedAt;
    }

    public List<NewsItemDTO> getStories() {
        return stories;
    }

    public void setStories(List<NewsItemDTO> stories) {
        this.stories = stories;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
