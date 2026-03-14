package com.hiphophub.dto;

import java.time.LocalDate;

public class TourDTO {
    private Long id;
    private String venue;
    private String city;
    private String country;
    private LocalDate eventDate;
    private String ticketUrl;
    private Long artistId;
    private String artistName;

    public TourDTO() {
    }

    public TourDTO(Long id, String venue, String city, String country, LocalDate eventDate, String ticketUrl, Long artistId, String artistName) {
        this.id = id;
        this.venue = venue;
        this.city = city;
        this.country = country;
        this.eventDate = eventDate;
        this.ticketUrl = ticketUrl;
        this.artistId = artistId;
        this.artistName = artistName;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getVenue() {
        return venue;
    }

    public void setVenue(String venue) {
        this.venue = venue;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDate eventDate) {
        this.eventDate = eventDate;
    }

    public String getTicketUrl() {
        return ticketUrl;
    }

    public void setTicketUrl(String ticketUrl) {
        this.ticketUrl = ticketUrl;
    }

    public Long getArtistId() {
        return artistId;
    }

    public void setArtistId(Long artistId) {
        this.artistId = artistId;
    }

    public String getArtistName() {
        return artistName;
    }

    public void setArtistName(String artistName) {
        this.artistName = artistName;
    }
}
