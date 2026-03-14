package com.hiphophub.repository;

import com.hiphophub.model.ArtistFact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ArtistFactRepository extends JpaRepository<ArtistFact, Long> {

    /**
     * Find all facts for a specific artist, ordered by display order
     */
    List<ArtistFact> findByArtistIdOrderByDisplayOrderAsc(Long artistId);
}
