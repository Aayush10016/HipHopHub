package com.hiphophub.dto;

public class NewsItemDTO {
    private String id;
    private String title;
    private String summary;
    private String tag;
    private String category;
    private String time;
    private String source;

    public NewsItemDTO() {
    }

    public NewsItemDTO(String id, String title, String summary, String tag, String category, String time, String source) {
        this.id = id;
        this.title = title;
        this.summary = summary;
        this.tag = tag;
        this.category = category;
        this.time = time;
        this.source = source;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
