package com.hiphophub.util;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class YouTubeLinkBuilder {

    private static final String BASE_URL = "https://www.youtube.com/results?search_query=";
    private static final Map<String, String> SONG_QUERY_OVERRIDES = buildSongQueryOverrides();

    private YouTubeLinkBuilder() {
    }

    public static String forSong(String artistName, String songTitle) {
        String query = SONG_QUERY_OVERRIDES.getOrDefault(
                normalizeKey(artistName) + ":" + normalizeKey(songTitle),
                safe(artistName) + " " + safe(songTitle) + " official audio");
        return BASE_URL + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
    }

    public static String forAlbum(String artistName, String albumTitle) {
        String query = safe(artistName) + " " + safe(albumTitle) + " full album";
        return BASE_URL + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private static Map<String, String> buildSongQueryOverrides() {
        Map<String, String> overrides = new HashMap<>();
        overrides.put("bella:tothemoon", "Byg Smyle Bella To the Moon official audio");
        return overrides;
    }
}
