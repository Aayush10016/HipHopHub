package com.hiphophub.util;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Classifies whether an artist should be treated as DHH for home-page scoped features.
 */
public final class DhhArtistClassifier {

    private static final Set<String> KNOWN_DHH_ARTISTS = Set.of(
            "divine",
            "krsna",
            "seedhemaut",
            "mcstan",
            "king",
            "emiwaybantai",
            "badshah",
            "raftaar",
            "ikka",
            "karma",
            "chaardiwaari",
            "prabhdeep",
            "fottyseven",
            "karanaujla",
            "tsumyoki",
            "nanku",
            "karun",
            "wolfcryman",
            "yashraj",
            "gravity",
            "panther",
            "hanumankind",
            "bella",
            "raga",
            "dinojames",
            "rawal",
            "yungsta",
            "mcaltaf",
            "paradox",
            "farhankhan",
            "dakaitshaddy",
            "mcsquare",
            "apdhillon",
            "bharg",
            "dhanji",
            "siyaahi",
            "vichaar",
            "naamsujal");

    private static final List<String> DHH_GENRE_HINTS = List.of(
            "desi",
            "indian",
            "hindi",
            "punjabi",
            "urdu",
            "bollywood");

    private DhhArtistClassifier() {
    }

    public static boolean isDhhArtist(String artistName, String genre) {
        String artistKey = normalize(artistName);
        if (!artistKey.isBlank() && KNOWN_DHH_ARTISTS.contains(artistKey)) {
            return true;
        }

        if (genre == null || genre.isBlank()) {
            return false;
        }

        String lowerGenre = genre.toLowerCase(Locale.ROOT);
        return DHH_GENRE_HINTS.stream().anyMatch(lowerGenre::contains);
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }
}
