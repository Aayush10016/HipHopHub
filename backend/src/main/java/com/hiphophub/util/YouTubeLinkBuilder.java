package com.hiphophub.util;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class YouTubeLinkBuilder {

    private static final String BASE_URL = "https://www.youtube.com/results?search_query=";
    private static final Map<String, String> DIRECT_SONG_URL_OVERRIDES = buildDirectSongUrlOverrides();
    private static final Map<String, String> SONG_QUERY_OVERRIDES = buildSongQueryOverrides();

    private YouTubeLinkBuilder() {
    }

    public static String forSong(String artistName, String songTitle) {
        String directUrl = DIRECT_SONG_URL_OVERRIDES.get(normalizeKey(artistName) + ":" + normalizeKey(songTitle));
        if (directUrl != null && !directUrl.isBlank()) {
            return directUrl;
        }
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

    private static Map<String, String> buildDirectSongUrlOverrides() {
        Map<String, String> overrides = new HashMap<>();
        putDirectSong(overrides, "Bella", "To the Moon", "https://www.youtube.com/watch?v=Ja5r6ZjZ8fQ");

        putDirectSong(overrides, "AP Dhillon", "Thinking of You", "https://www.youtube.com/watch?v=uTZ1JqiQPk4");
        putDirectSong(overrides, "AP Dhillon", "Raatan Lambiyan", "https://www.youtube.com/watch?v=6w0rHWNxneA");
        putDirectSong(overrides, "AP Dhillon", "HITMEN", "https://www.youtube.com/watch?v=wiKCVac9N78");
        putDirectSong(overrides, "AP Dhillon", "By My Side", "https://www.youtube.com/watch?v=N8dexd1PqEw");
        putDirectSong(overrides, "AP Dhillon", "Without Me", "https://www.youtube.com/watch?v=ma_dtgS_W_w");
        putDirectSong(overrides, "AP Dhillon", "Thodi Si Daaru", "https://www.youtube.com/watch?v=slM5s55Jz0k");
        putDirectSong(overrides, "AP Dhillon", "OKAY", "https://www.youtube.com/watch?v=7wyDGJwndt8");
        putDirectSong(overrides, "AP Dhillon", "STFU", "https://www.youtube.com/watch?v=tDMuhR3CgGM");
        putDirectSong(overrides, "AP Dhillon", "NEVER LET YOU GO", "https://www.youtube.com/watch?v=h6usBnR0Ewk");
        putDirectSong(overrides, "AP Dhillon", "Afsos", "https://www.youtube.com/watch?v=2FhgKp_lfJQ");
        putDirectSong(overrides, "AP Dhillon", "315", "https://www.youtube.com/watch?v=HfYzeyxNH6U");
        putDirectSong(overrides, "AP Dhillon", "315 (feat. Shinda Kahlon & Jazzy B)", "https://www.youtube.com/watch?v=HfYzeyxNH6U");
        putDirectSong(overrides, "AP Dhillon", "Brownprint", "https://www.youtube.com/watch?v=BVi_9_uE1jg");
        putDirectSong(overrides, "AP Dhillon", "Brownprint (feat. Shinda Kahlon)", "https://www.youtube.com/watch?v=BVi_9_uE1jg");
        putDirectSong(overrides, "AP Dhillon", "To Be Continuedâ¦ (Bonus Track)", "https://www.youtube.com/watch?v=NDtyKKbRbjc");
        putDirectSong(overrides, "AP Dhillon", "Sweet Flower", "https://www.youtube.com/watch?v=sYYjiilNSGI");
        putDirectSong(overrides, "AP Dhillon", "After Midnight", "https://www.youtube.com/watch?v=LlJxnlFDRz4");
        putDirectSong(overrides, "AP Dhillon", "Distance", "https://www.youtube.com/watch?v=1ZDAhrjMLtM");
        putDirectSong(overrides, "AP Dhillon", "Old Money", "https://www.youtube.com/watch?v=-K-WY0WRT48");
        putDirectSong(overrides, "AP Dhillon", "Bora Bora", "https://www.youtube.com/watch?v=xARHpBzxFNI");
        putDirectSong(overrides, "AP Dhillon", "Bora Bora (feat. Ayra Starr)", "https://www.youtube.com/watch?v=xARHpBzxFNI");
        putDirectSong(overrides, "AP Dhillon", "Losing Myself (feat. Gunna)", "https://www.youtube.com/watch?v=M9UbwzDm4wI");
        putDirectSong(overrides, "AP Dhillon", "Problems Over Peace", "https://www.youtube.com/watch?v=OcoEM04ThsU");
        putDirectSong(overrides, "AP Dhillon", "Real Talk", "https://www.youtube.com/watch?v=6r4ckHlQH4c");
        putDirectSong(overrides, "AP Dhillon", "Scars", "https://www.youtube.com/watch?v=kXt-XVTGhto");
        putDirectSong(overrides, "AP Dhillon", "Lifestyle", "https://www.youtube.com/watch?v=0-67daqE4xU");
        putDirectSong(overrides, "AP Dhillon", "With You", "https://www.youtube.com/watch?v=mZQH8CPQ-wo");
        putDirectSong(overrides, "AP Dhillon", "Sleepless", "https://www.youtube.com/watch?v=sdhsp6NaB-A");
        putDirectSong(overrides, "AP Dhillon", "True Stories", "https://www.youtube.com/watch?v=-wFTG_f-W4c");
        putDirectSong(overrides, "AP Dhillon", "Final Thoughts", "https://www.youtube.com/watch?v=NpGq-yW-R6U");
        putDirectSong(overrides, "AP Dhillon", "Hills", "https://www.youtube.com/watch?v=UwRo4iZZb0I");
        putDirectSong(overrides, "AP Dhillon", "All Night (Live)", "https://www.youtube.com/watch?v=Vd7F5VHz5BI");
        putDirectSong(overrides, "AP Dhillon", "Wo Noor", "https://www.youtube.com/watch?v=HrcjFEK58ik");
        putDirectSong(overrides, "AP Dhillon", "Dil Nu", "https://www.youtube.com/watch?v=p2EdDiiVHh4");
        putDirectSong(overrides, "AP Dhillon", "Summer High", "https://www.youtube.com/watch?v=nqUN530Rgtw");
        putDirectSong(overrides, "AP Dhillon", "Against All Odds", "https://www.youtube.com/watch?v=mmted4E2Pvs");
        putDirectSong(overrides, "AP Dhillon", "Majhe Aale", "https://www.youtube.com/watch?v=3oL3O-SQ0ys");
        putDirectSong(overrides, "AP Dhillon", "War", "https://www.youtube.com/watch?v=l6ChXByZsOA");
        putDirectSong(overrides, "AP Dhillon", "Spaceship", "https://www.youtube.com/watch?v=RatDV50alQE");
        putDirectSong(overrides, "AP Dhillon", "Tere Te", "https://www.youtube.com/watch?v=fG70qm6usR8");
        putDirectSong(overrides, "AP Dhillon", "Desires", "https://www.youtube.com/watch?v=3ONzh3tf884");
        putDirectSong(overrides, "AP Dhillon", "Ma Belle", "https://www.youtube.com/watch?v=6piRLp7BV8o");
        putDirectSong(overrides, "AP Dhillon", "Insane", "https://www.youtube.com/watch?v=cqP8I5aaud8");
        putDirectSong(overrides, "AP Dhillon", "Drip (feat. Duvy)", "https://www.youtube.com/watch?v=XHPSxtLCloY");
        putDirectSong(overrides, "AP Dhillon", "Takeover (feat. AR Paisley)", "https://www.youtube.com/watch?v=brMvIdDrOhk");
        putDirectSong(overrides, "AP Dhillon", "Fate (feat. Shinda Kahlon)", "https://www.youtube.com/watch?v=HEsT6hS59i4");
        putDirectSong(overrides, "AP Dhillon", "Saada Pyaar", "https://www.youtube.com/watch?v=L6fr053Z_pU");
        putDirectSong(overrides, "AP Dhillon", "Chances", "https://www.youtube.com/watch?v=NhgQVF4WvyI");
        putDirectSong(overrides, "AP Dhillon", "Goat", "https://www.youtube.com/watch?v=dy05ncw9iGg");
        putDirectSong(overrides, "AP Dhillon", "Foreigns", "https://www.youtube.com/watch?v=jWz5on5N14E");
        putDirectSong(overrides, "AP Dhillon", "Toxic", "https://www.youtube.com/watch?v=7v0_uipNGao");
        putDirectSong(overrides, "AP Dhillon", "Brown Munde", "https://www.youtube.com/watch?v=VNs_cCtdbPc");
        putDirectSong(overrides, "AP Dhillon", "Free Smoke", "https://www.youtube.com/watch?v=cXAyRBfHM5Y");
        putDirectSong(overrides, "AP Dhillon", "Excuses", "https://www.youtube.com/watch?v=vX2cDW8LUWk");
        putDirectSong(overrides, "AP Dhillon", "Majhail", "https://www.youtube.com/watch?v=yzIyufV6ADk");
        putDirectSong(overrides, "AP Dhillon", "Droptop", "https://www.youtube.com/watch?v=YINxH2VLP-A");
        putDirectSong(overrides, "AP Dhillon", "Kirsaan", "https://www.youtube.com/watch?v=pVpJ3JnGDzI");
        putDirectSong(overrides, "AP Dhillon", "Deadly", "https://www.youtube.com/watch?v=rDH0kjE6enE");
        putDirectSong(overrides, "AP Dhillon", "Hustlin'", "https://www.youtube.com/watch?v=fRN6W8HOcUU");
        putDirectSong(overrides, "AP Dhillon", "Most Wanted", "https://www.youtube.com/watch?v=OImvWUHfNo8");
        putDirectSong(overrides, "AP Dhillon", "Feels", "https://www.youtube.com/watch?v=pUUhoS4WigM");
        putDirectSong(overrides, "AP Dhillon", "Arrogant", "https://www.youtube.com/watch?v=UkOPtbo73Ws");
        putDirectSong(overrides, "AP Dhillon", "Top Boy", "https://www.youtube.com/watch?v=aDE_ecFcwWM");
        putDirectSong(overrides, "AP Dhillon", "Faraar", "https://www.youtube.com/watch?v=vqyIYTVFNck");
        putDirectSong(overrides, "AP Dhillon", "Fake", "https://www.youtube.com/watch?v=FkgAdHM_kCk");
        return overrides;
    }

    private static void putDirectSong(Map<String, String> overrides, String artistName, String songTitle, String url) {
        overrides.put(normalizeKey(artistName) + ":" + normalizeKey(songTitle), url);
    }
}
