package com.hiphophub.controller;

import com.hiphophub.dto.TourDTO;
import com.hiphophub.model.Tour;
import com.hiphophub.repository.TourRepository;
import com.hiphophub.service.SongkickTourSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Tour Controller
 * 
 * Handles HTTP requests for tour dates and shows.
 */
@RestController
@RequestMapping("/api/tours")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:5173" })
public class TourController {

    @Autowired
    private TourRepository tourRepository;

    @Autowired
    private SongkickTourSyncService songkickTourSyncService;

    /**
     * GET /api/tours/upcoming
     * Get all upcoming tours
     */
    @GetMapping("/upcoming")
    public List<TourDTO> getUpcomingTours() {
        songkickTourSyncService.syncIfDue();
        return tourRepository.findUpcomingTours(LocalDate.now()).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * GET /api/tours/artist/{artistId}
     * Get upcoming tours for specific artist
     */
    @GetMapping("/artist/{artistId}")
    public List<TourDTO> getArtistTours(@PathVariable Long artistId) {
        songkickTourSyncService.syncIfDue();
        return tourRepository.findUpcomingToursByArtist(artistId, LocalDate.now()).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * POST /api/tours/sync
     * Force refresh tours from free web source (Songkick scrape).
     */
    @PostMapping("/sync")
    public List<TourDTO> syncToursNow() {
        songkickTourSyncService.forceSyncNow();
        return tourRepository.findUpcomingTours(LocalDate.now()).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * POST /api/tours
     * Create a new tour
     */
    @PostMapping
    public Tour createTour(@RequestBody Tour tour) {
        return tourRepository.save(tour);
    }

    private TourDTO toDTO(Tour tour) {
        Long artistId = null;
        String artistName = null;
        if (tour.getArtist() != null) {
            artistId = tour.getArtist().getId();
            artistName = tour.getArtist().getName();
        }

        return new TourDTO(
                tour.getId(),
                tour.getVenue(),
                tour.getCity(),
                tour.getCountry(),
                tour.getEventDate(),
                tour.getTicketUrl(),
                artistId,
                artistName
        );
    }
}
