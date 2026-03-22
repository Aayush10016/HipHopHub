package com.hiphophub.config;

import com.hiphophub.model.Artist;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.service.MusicImportService;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Data Initializer
 *
 * Optionally seeds artists using Last.fm + iTunes when app.seed.enabled=true.
 */
@Configuration
public class DataInitializer {

    private static final long TARGET_ARTIST_COUNT = 90;
    private static final long TARGET_SONG_COUNT = 1800;
    private static final Duration METADATA_REFRESH_INTERVAL = Duration.ofDays(7);
    private static final Duration CATALOG_REFRESH_INTERVAL = Duration.ofDays(3);
    private static final Duration SEED_SWEEP_INTERVAL = Duration.ofHours(12);
    private static final Path STATE_FILE = Paths.get("data", "seed-state.properties");

    @Value("${app.seed.enabled:false}")
    private boolean seedEnabled;

    @Value("${music.import.seed.delay.ms:800}")
    private long seedDelayMs;

    private static final String[] DEFAULT_SEED_ARTISTS = {
            // Indian / DHH
            "DIVINE", "KR$NA", "Seedhe Maut", "MC Stan", "King", "Emiway Bantai",
            "Badshah", "Raftaar", "Ikka", "Karma", "Chaar Diwaari", "Prabh Deep",
            "Fotty Seven", "Karan Aujla", "Tsumyoki", "Nanku", "Karun", "wolf.cryman",
            "Yashraj", "Gravity", "Panther", "Hanumankind",
            "Bella", "Raga", "Dino James", "Rawal", "Yungsta", "MC Altaf",
            "Paradox", "Farhan Khan", "Dakait Shaddy", "MC Square",
            "AP Dhillon", "Bharg", "Dhanji", "Siyaahi", "Vichaar", "Naam Sujal",
            "Ahmer", "Frappe Ash", "Calm", "Encore ABJ", "The Siege", "D'Evil",
            "Loka", "Brodha V", "Sambata", "Smoke", "MC Kode", "Sos",
            "Vijay Dk", "Dee MC", "MC Headshot", "Shah Rule", "Yeda Anna", "Nazz",
            "Spectra", "Lashcurry", "EPR Iyer", "Enkore", "Kaam Bhaari", "Poetik Justis",
            "Kidshot", "AB17", "DRV", "Lil Bhavi", "MC Amrit", "Void",
            "Harjas Harjaayi", "Full Power", "Talah Ankit", "Meba Ofilia",
            "Sammohit", "Rapper Shaz", "Srushti Tawade", "Agsy", "J Trix",
            "Bagi Munda", "Mrunal Shankar", "Riar Saab", "Deep Kalsi", "GD47",
            "Yelhomie", "MC THC", "Yung Sammy", "MC Heam",
            "Flowbo", "Shen B", "Rapper Big Deal", "Dopeadelicz", "Vedang", "Pasha Bhai",

            // International
            "Drake", "Kendrick Lamar", "Travis Scott", "J. Cole", "Eminem",
            "50 Cent", "Snoop Dogg", "Kanye West", "Future", "Metro Boomin",
            "Lil Baby", "Pop Smoke", "A$AP Rocky", "Tyler, The Creator", "Post Malone",
            "The Weeknd", "Doja Cat", "Nicki Minaj", "Cardi B", "Central Cee",
            "21 Savage", "Lil Wayne", "Jay-Z", "Nas", "Playboi Carti"
    };

    @Bean
    CommandLineRunner initDatabase(
            MusicImportService musicImportService,
            ArtistRepository artistRepo,
            SongRepository songRepository) {
        return args -> {
            if (!seedEnabled) {
                System.out.println("Seed data disabled (app.seed.enabled=false). Skipping seed import.");
                return;
            }
            Thread seedThread = new Thread(() -> runSeedPipeline(musicImportService, artistRepo, songRepository), "hiphophub-seed");
            seedThread.setDaemon(true);
            seedThread.start();
            System.out.println("Seed import scheduled in background. App startup will not wait for catalog refresh.");
        };
    }

    private void runSeedPipeline(
            MusicImportService musicImportService,
            ArtistRepository artistRepo,
            SongRepository songRepository) {
        Properties state = loadState();
        List<Artist> existingArtists = artistRepo.findAll();

        boolean needsMetadataRefresh = existingArtists.stream().anyMatch(this::needsMetadataRefresh);
        if (!existingArtists.isEmpty()
                && needsMetadataRefresh
                && isStale(state.getProperty("lastMetadataRefreshAt"), METADATA_REFRESH_INTERVAL)) {
            System.out.println("Refreshing missing artist metadata in background...");
            for (Artist artist : existingArtists) {
                if (!needsMetadataRefresh(artist)) {
                    continue;
                }
                try {
                    musicImportService.refreshArtistMetadata(artist.getName());
                    pauseBetweenImports();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (Exception e) {
                    System.out.println("Metadata refresh failed for " + artist.getName() + ": " + e.getMessage());
                }
            }
            state.setProperty("lastMetadataRefreshAt", Instant.now().toString());
            saveState(state);
        }

        long artistCount = artistRepo.count();
        long songCount = songRepository.count();
        boolean belowTargets = artistCount < TARGET_ARTIST_COUNT || songCount < TARGET_SONG_COUNT;
        if (belowTargets
                && !existingArtists.isEmpty()
                && isStale(state.getProperty("lastCatalogRefreshAt"), CATALOG_REFRESH_INTERVAL)) {
            System.out.println("Refreshing thin artist catalogs in background...");
            for (Artist artist : existingArtists) {
                try {
                    long artistSongCount = songRepository.countByAlbumArtistId(artist.getId());
                    if (artistSongCount >= 18 && !needsMetadataRefresh(artist)) {
                        continue;
                    }
                    musicImportService.refreshArtistTracks(artist.getName());
                    if (needsMetadataRefresh(artist)) {
                        musicImportService.refreshArtistMetadata(artist.getName());
                    }
                    pauseBetweenImports();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (Exception e) {
                    System.out.println("Catalog refresh failed for " + artist.getName() + ": " + e.getMessage());
                }
            }
            state.setProperty("lastCatalogRefreshAt", Instant.now().toString());
            saveState(state);
        }

        if (!isStale(state.getProperty("lastSeedSweepAt"), SEED_SWEEP_INTERVAL)) {
            return;
        }

        System.out.println("Seeding missing artists via Last.fm + iTunes...");
        int imported = 0;
        int failed = 0;

        for (String artistName : DEFAULT_SEED_ARTISTS) {
            if (artistRepo.findByNameIgnoreCase(artistName).isPresent()) {
                continue;
            }
            try {
                musicImportService.importArtist(artistName);
                imported++;
                pauseBetweenImports();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.out.println("Seed import interrupted.");
                return;
            } catch (Exception e) {
                failed++;
                System.out.println("Failed to import " + artistName + ": " + e.getMessage());
            }
        }

        state.setProperty("lastSeedSweepAt", Instant.now().toString());
        saveState(state);
        System.out.println("Seed import complete. Artists: " + artistRepo.count()
                + ", imported: " + imported + ", failed: " + failed);
    }

    private void pauseBetweenImports() throws InterruptedException {
        if (seedDelayMs > 0) {
            Thread.sleep(seedDelayMs);
        }
    }

    private Properties loadState() {
        Properties properties = new Properties();
        if (!Files.exists(STATE_FILE)) {
            return properties;
        }
        try (InputStream inputStream = Files.newInputStream(STATE_FILE)) {
            properties.load(inputStream);
        } catch (IOException e) {
            System.out.println("Could not read seed state: " + e.getMessage());
        }
        return properties;
    }

    private void saveState(Properties properties) {
        try {
            Files.createDirectories(STATE_FILE.getParent());
            try (OutputStream outputStream = Files.newOutputStream(STATE_FILE)) {
                properties.store(outputStream, "HipHopHub seed state");
            }
        } catch (IOException e) {
            System.out.println("Could not save seed state: " + e.getMessage());
        }
    }

    private boolean isStale(String storedInstant, Duration interval) {
        if (storedInstant == null || storedInstant.isBlank()) {
            return true;
        }
        try {
            Instant instant = Instant.parse(storedInstant);
            return Duration.between(instant, Instant.now()).compareTo(interval) >= 0;
        } catch (Exception e) {
            return true;
        }
    }

    private boolean needsMetadataRefresh(Artist artist) {
        if (artist == null) {
            return false;
        }
        String imageUrl = artist.getImageUrl();
        boolean imageMissingOrWrong = imageUrl == null
                || imageUrl.isBlank()
                || imageUrl.toLowerCase().contains("mzstatic.com")
                || imageUrl.toLowerCase().contains("itunes.apple.com");

        boolean listenersMissing = artist.getMonthlyListeners() == null || artist.getMonthlyListeners() <= 0;
        return imageMissingOrWrong || listenersMissing;
    }
}
