package com.hiphophub.util;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public final class YouTubeLinkBuilder {

    private static final String BASE_URL = "https://www.youtube.com/results?search_query=";

    private YouTubeLinkBuilder() {
    }

    public static String forSong(String artistName, String songTitle) {
        String query = safe(artistName) + " " + safe(songTitle) + " official audio";
        return BASE_URL + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
    }

    public static String forAlbum(String artistName, String albumTitle) {
        String query = safe(artistName) + " " + safe(albumTitle) + " full album";
        return BASE_URL + URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
