package com.hiphophub.service;

import com.hiphophub.model.Artist;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.util.DhhArtistClassifier;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class CatalogRefreshScheduler {

    private final ArtistRepository artistRepository;
    private final AlbumRepository albumRepository;
    private final SongRepository songRepository;
    private final MusicImportService musicImportService;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final Map<Long, Instant> checkedArtistAt = new ConcurrentHashMap<>();

    @Value("${catalog.refresh.enabled:true}")
    private boolean enabled;

    @Value("${catalog.refresh.max-artists-per-run:20}")
    private int maxArtistsPerRun;

    @Value("${catalog.refresh.min-release-age-days:7}")
    private int minReleaseAgeDays;

    @Value("${catalog.refresh.recheck-after-hours:72}")
    private int recheckAfterHours;

    @Value("${catalog.refresh.delay.ms:5000}")
    private long delayMs;

    public CatalogRefreshScheduler(ArtistRepository artistRepository,
                                   AlbumRepository albumRepository,
                                   SongRepository songRepository,
                                   MusicImportService musicImportService) {
        this.artistRepository = artistRepository;
        this.albumRepository = albumRepository;
        this.songRepository = songRepository;
        this.musicImportService = musicImportService;
    }

    @Scheduled(
            initialDelayString = "${catalog.refresh.initial-delay.ms:180000}",
            fixedDelayString = "${catalog.refresh.interval.ms:21600000}")
    public void refreshStaleCatalogs() {
        if (!enabled || !running.compareAndSet(false, true)) {
            return;
        }

        try {
            LocalDate staleBefore = LocalDate.now().minusDays(Math.max(1, minReleaseAgeDays));
            List<Artist> candidates = artistRepository.findAll().stream()
                    .filter(artist -> DhhArtistClassifier.isDhhArtist(artist.getName(), artist.getGenre()))
                    .filter(this::isRefreshCandidate)
                    .sorted(Comparator.comparing(this::latestReleaseDateOrMin).reversed())
                    .limit(Math.max(1, maxArtistsPerRun))
                    .toList();

            if (candidates.isEmpty()) {
                return;
            }

            System.out.println("Scheduled catalog refresh: checking " + candidates.size()
                    + " stale artists; refreshing releases older than " + staleBefore + ".");

            for (Artist artist : candidates) {
                try {
                    musicImportService.refreshArtistTracks(artist.getName());
                    checkedArtistAt.put(artist.getId(), Instant.now());
                    pauseBetweenArtists();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (Exception e) {
                    System.out.println("Scheduled catalog refresh failed for "
                            + artist.getName() + ": " + e.getMessage());
                }
            }
        } finally {
            running.set(false);
        }
    }

    private boolean isRefreshCandidate(Artist artist) {
        Instant lastChecked = checkedArtistAt.get(artist.getId());
        if (lastChecked != null
                && Duration.between(lastChecked, Instant.now()).toHours() < Math.max(1, recheckAfterHours)) {
            return false;
        }

        long songCount = songRepository.countByAlbumArtistId(artist.getId());
        if (songCount == 0) {
            return true;
        }

        LocalDate latestRelease = latestReleaseDateOrMin(artist);
        LocalDate staleBefore = LocalDate.now().minusDays(Math.max(1, minReleaseAgeDays));
        return latestRelease.isBefore(staleBefore);
    }

    private LocalDate latestReleaseDateOrMin(Artist artist) {
        Optional<LocalDate> latest = albumRepository.findLatestReleaseDateByArtistId(artist.getId());
        return latest.orElse(LocalDate.MIN);
    }

    private void pauseBetweenArtists() throws InterruptedException {
        if (delayMs > 0) {
            Thread.sleep(delayMs);
        }
    }
}
