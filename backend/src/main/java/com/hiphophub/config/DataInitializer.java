package com.hiphophub.config;

import com.hiphophub.model.Artist;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.SongRepository;
import com.hiphophub.service.MusicImportService;
import java.util.List;
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

            List<Artist> existingArtists = artistRepo.findAll();
            boolean needsMetadataRefresh = existingArtists.stream().anyMatch(this::needsMetadataRefresh);
            if (!existingArtists.isEmpty() && needsMetadataRefresh) {
                System.out.println("Refreshing artist metadata (images/listeners/bios) from Last.fm/Deezer...");
                for (Artist artist : existingArtists) {
                    try {
                        musicImportService.refreshArtistMetadata(artist.getName());
                        if (seedDelayMs > 0) {
                            Thread.sleep(seedDelayMs);
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    } catch (Exception e) {
                        System.out.println("Metadata refresh failed for " + artist.getName() + ": " + e.getMessage());
                    }
                }
            }

            long artistCount = artistRepo.count();
            long songCount = songRepository.count();
            if (artistCount >= 30 && songCount >= 320) {
                System.out.println("Seed data already available. Artists: " + artistCount + ", songs: " + songCount);
                return;
            }

            System.out.println("Seeding artists via Last.fm + iTunes...");
            int imported = 0;
            int failed = 0;

            for (String artistName : DEFAULT_SEED_ARTISTS) {
                try {
                    musicImportService.importArtist(artistName);
                    imported++;
                    if (seedDelayMs > 0) {
                        Thread.sleep(seedDelayMs);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.out.println("Seed import interrupted.");
                    break;
                } catch (Exception e) {
                    failed++;
                    System.out.println("Failed to import " + artistName + ": " + e.getMessage());
                }
            }

            System.out.println("Seed import complete. Artists: " + artistRepo.count()
                    + ", imported: " + imported + ", failed: " + failed);
        };
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
