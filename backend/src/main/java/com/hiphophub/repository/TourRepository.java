package com.hiphophub.repository;

import com.hiphophub.model.Tour;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Tour Repository
 */
@Repository
public interface TourRepository extends JpaRepository<Tour, Long> {

    /**
     * Find tours by artist ID
     */
    List<Tour> findByArtistId(Long artistId);

    /**
     * Find upcoming tours (future dates only)
     */
    @Query("SELECT t FROM Tour t WHERE t.eventDate >= :today ORDER BY t.eventDate ASC")
    List<Tour> findUpcomingTours(LocalDate today);

    /**
     * Find upcoming tours for specific artist
     */
    @Query("SELECT t FROM Tour t WHERE t.artist.id = :artistId AND t.eventDate >= :today ORDER BY t.eventDate ASC")
    List<Tour> findUpcomingToursByArtist(Long artistId, LocalDate today);
}
