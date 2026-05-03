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

        putDirectSong(overrides, "Badshah", "Tateeree Phir Se", "https://www.youtube.com/watch?v=gKRZfguyyyg");
        putDirectSong(overrides, "Badshah", "Delhi Se Manali (Ladka Tera Diwana)", "https://www.youtube.com/watch?v=PYmKIMwXsSg");
        putDirectSong(overrides, "Badshah", "Kokaina", "https://www.youtube.com/watch?v=yRWdchy43zY");
        putDirectSong(overrides, "Badshah", "Galiyon Ke Ghalib", "https://www.youtube.com/watch?v=AOWrGJcNdoE");
        putDirectSong(overrides, "Badshah", "Blessed", "https://www.youtube.com/watch?v=F2OVaaKzS8A");
        putDirectSong(overrides, "Badshah", "Dear Aditya", "https://www.youtube.com/watch?v=HSQbnud22uE");
        putDirectSong(overrides, "Badshah", "Gori Hai Kalaiyan (From \"Mere Husband Ki Biwi\")", "https://www.youtube.com/watch?v=7WH-Od55sgc");
        putDirectSong(overrides, "Badshah", "Morni", "https://www.youtube.com/watch?v=Zrt77f7nTqY");
        putDirectSong(overrides, "Badshah", "Body On Me", "https://www.youtube.com/watch?v=QjdFHXLlTtI");
        putDirectSong(overrides, "Badshah", "Surma", "https://www.youtube.com/watch?v=_7An6JuTj0s");
        putDirectSong(overrides, "Badshah", "Red And Blue", "https://www.youtube.com/watch?v=0DvKsjXrNgE");
        putDirectSong(overrides, "Badshah", "Hola At Your Boy", "https://www.youtube.com/watch?v=VYOuTa2oWDo");
        putDirectSong(overrides, "Badshah", "Like A Snake", "https://www.youtube.com/watch?v=9AoDIgJWd7k");
        putDirectSong(overrides, "Badshah", "OâSajna", "https://www.youtube.com/watch?v=JRKk7gxcpMc");
        putDirectSong(overrides, "Badshah", "Soulmate", "https://www.youtube.com/watch?v=k3ijQJjUbTs");
        putDirectSong(overrides, "Badshah", "God Damn", "https://www.youtube.com/watch?v=au5uNkCKzaY");
        putDirectSong(overrides, "Badshah", "Bajenge", "https://www.youtube.com/watch?v=C5pbk6etTBw");
        putDirectSong(overrides, "Badshah", "Zaalim", "https://www.youtube.com/watch?v=3rWL1mavaKQ");
        putDirectSong(overrides, "Badshah", "Koi Na", "https://www.youtube.com/watch?v=x89xYIgQUJ0");
        putDirectSong(overrides, "Badshah", "Nasha (From \"Sukhee\")", "https://www.youtube.com/watch?v=YupVhBGuiZE");
        putDirectSong(overrides, "Badshah", "Gone Girl", "https://www.youtube.com/watch?v=mvCWGL_r-Zg");
        putDirectSong(overrides, "Badshah", "Baawla (Jhankar Beats)", "https://www.youtube.com/watch?v=eI2gINbvVsw");
        putDirectSong(overrides, "Badshah", "Issa Vibe", "https://www.youtube.com/watch?v=oOUGLKf8uU0");
        putDirectSong(overrides, "Badshah", "Sanak", "https://www.youtube.com/watch?v=lAUf0q711Ew");
        putDirectSong(overrides, "Badshah", "Voodoo", "https://www.youtube.com/watch?v=sPn2HP8cAbo");
        putDirectSong(overrides, "Badshah", "Tabahi", "https://www.youtube.com/watch?v=0cbXeXP2Wgg");
        putDirectSong(overrides, "Badshah", "Baawla", "https://www.youtube.com/watch?v=eI2gINbvVsw");
        putDirectSong(overrides, "Badshah", "Slow Slow", "https://www.youtube.com/watch?v=ToWapzm8SiY");
        putDirectSong(overrides, "Badshah", "Sajna, Say Yes To The Dress", "https://www.youtube.com/watch?v=WBqoJVEyJPU");
        putDirectSong(overrides, "Badshah", "Bach Ke Rehna (Red Notice)", "https://www.youtube.com/watch?v=ILc1UQ1EV0M");
        putDirectSong(overrides, "Badshah", "Chamkeela Chehra", "https://www.youtube.com/watch?v=2UwxHhkK-3c");
        putDirectSong(overrides, "Badshah", "Jugnu (feat. Nikhita Gandhi)", "https://www.youtube.com/watch?v=ksY3wb4vtlA");
        putDirectSong(overrides, "Badshah", "Bad Boy X Bad Girl (feat. Nikhita Gandhi)", "https://www.youtube.com/watch?v=9v5-9ovoTGE");
        putDirectSong(overrides, "Badshah", "Bachpan Ka Pyaar", "https://www.youtube.com/watch?v=k7QniTYNsmQ");
        putDirectSong(overrides, "Badshah", "Paani Paani", "https://www.youtube.com/watch?v=nFjVlf2r9_Q");
        putDirectSong(overrides, "Badshah", "Fly", "https://www.youtube.com/watch?v=yz95mLpz5Bs");
        putDirectSong(overrides, "Badshah", "Top Tucker (feat. Rashmika Mandanna)", "https://www.youtube.com/watch?v=bY8bEaJp3x8");
        putDirectSong(overrides, "Badshah", "Heelein Toot Gayi (From \"Indoo Ki Jawani\") [feat. Guru Randhawa]", "https://www.youtube.com/watch?v=ms2dXQ0gpDA");
        putDirectSong(overrides, "Badshah", "Awaara (feat. Reet Talwar)", "https://www.youtube.com/watch?v=Mi-Q1KM9Xtk");
        putDirectSong(overrides, "Badshah", "The Power Of Dreams (feat. Lisa Mishra)", "https://www.youtube.com/watch?v=V8-xk1MYGpQ");
        putDirectSong(overrides, "Badshah", "Shuru", "https://www.youtube.com/watch?v=4cSPrIC1lTo");
        putDirectSong(overrides, "Badshah", "Hot Launde (feat. Fotty Seven & Bali)", "https://www.youtube.com/watch?v=iuqfU9Ll300");
        putDirectSong(overrides, "Badshah", "Haryana Roadways", "https://www.youtube.com/watch?v=KupZ-mEm6QY");
        putDirectSong(overrides, "Badshah", "Genda Phool (Gujarati Version)", "https://www.youtube.com/watch?v=0d_W9PdsMeQ");
        putDirectSong(overrides, "Badshah", "Genda Phool (feat. Payal Dev)", "https://www.youtube.com/watch?v=SD4Z8dlZPd8");
        putDirectSong(overrides, "Badshah", "Boht Tej", "https://www.youtube.com/watch?v=qgqeeo2Enfg");
        putDirectSong(overrides, "Badshah", "Garmi (feat. Varun Dhawan)", "https://www.youtube.com/watch?v=IE8OD5FbU-c");
        putDirectSong(overrides, "Badshah", "Garmi (From \"Street Dancer 3D\") (feat. Varun Dhawan)", "https://www.youtube.com/watch?v=IE8OD5FbU-c");
        putDirectSong(overrides, "Badshah", "Kamaal", "https://www.youtube.com/watch?v=ZPSUimDt7N8");
        putDirectSong(overrides, "Badshah", "Chandigarh Mein", "https://www.youtube.com/watch?v=yt4-qlU__iM");
        putDirectSong(overrides, "Badshah", "Munna Badnaam Hua", "https://www.youtube.com/watch?v=PKSU0CGhGac");
        putDirectSong(overrides, "Badshah", "Interstellar", "https://www.youtube.com/watch?v=rwQdNstRAjM");
        putDirectSong(overrides, "Badshah", "Bad Boy", "https://www.youtube.com/watch?v=-wv0yyoGYLI");
        putDirectSong(overrides, "Badshah", "Paagal", "https://www.youtube.com/watch?v=bdesdebUFLE");
        putDirectSong(overrides, "Badshah", "Sheher Ki Ladki", "https://www.youtube.com/watch?v=V-aWMKcuJSo");
        putDirectSong(overrides, "Badshah", "Grandfather", "https://www.youtube.com/watch?v=9R7fOmfkVTc");
        putDirectSong(overrides, "Badshah", "Akh Lad Jaave (From \"Loveyatri - A Journey of Love\")", "https://www.youtube.com/watch?v=2ufcnLgoIo4");
        putDirectSong(overrides, "Badshah", "Proper Patola", "https://www.youtube.com/watch?v=GVhmynWOPoM");
        putDirectSong(overrides, "Badshah", "Aao Kabhi Haveli Pe", "https://www.youtube.com/watch?v=PkgStlsVaqw");
        putDirectSong(overrides, "Badshah", "Call Waiting", "https://www.youtube.com/watch?v=MsKPG4b8V4I");
        putDirectSong(overrides, "Badshah", "Oxygen", "https://www.youtube.com/watch?v=nyEffQVZEVE");
        putDirectSong(overrides, "Badshah", "ILL.I.Am", "https://www.youtube.com/watch?v=Shv3wmS3yhU");
        putDirectSong(overrides, "Badshah", "No Limit", "https://www.youtube.com/watch?v=hD14MHAFvt8");
        putDirectSong(overrides, "Badshah", "Right Up There (feat. Lisa Mishra)", "https://www.youtube.com/watch?v=JDOCyK_t3fM");
        putDirectSong(overrides, "Badshah", "Kya Kehte Ho", "https://www.youtube.com/watch?v=pfI7GBOzYpk");
        putDirectSong(overrides, "Badshah", "Therapy", "https://www.youtube.com/watch?v=dd5BcdtI2MY");
        putDirectSong(overrides, "Badshah", "Dj Waley Babu (feat. Aastha Gill)", "https://www.youtube.com/watch?v=OulN7vTDq1I");
        putDirectSong(overrides, "Badshah", "Nain (feat. Aastha Gill)", "https://www.youtube.com/watch?v=bHP7l56fAe8");
        putDirectSong(overrides, "Badshah", "Heartless (feat. Aastha Gill)", "https://www.youtube.com/watch?v=Gv_XBMrPvRw");
        putDirectSong(overrides, "Badshah", "Aashiq Awaara (feat. Sunidhi Chauhan)", "https://www.youtube.com/watch?v=A2tOJyJCExk");
        putDirectSong(overrides, "Badshah", "Mercy", "https://www.youtube.com/watch?v=Jyst8oIHOAY");
        putDirectSong(overrides, "Badshah", "She Move It Like", "https://www.youtube.com/watch?v=Ci0WbaUH3no");
        putDirectSong(overrides, "Badshah", "Tere Naal Nachna", "https://www.youtube.com/watch?v=94vimg-so20");
        putDirectSong(overrides, "Badshah", "Tareefan", "https://www.youtube.com/watch?v=3SWc5G8Gx7E");
        putDirectSong(overrides, "Badshah", "Happy Happy", "https://www.youtube.com/watch?v=SbQ-_9LM58w");
        putDirectSong(overrides, "Badshah", "Kareja Kareja (feat. Aastha Gill)", "https://www.youtube.com/watch?v=rmCD_Hv2XmY");
        putDirectSong(overrides, "Badshah", "Mercy (Lady Bee Remix)", "https://www.youtube.com/watch?v=mD0lSnYS7QY");
        putDirectSong(overrides, "Badshah", "Driving Slow", "https://www.youtube.com/watch?v=mePu74AKLDc");
        putDirectSong(overrides, "Badshah", "Kar Gayi Chull (Remix By DJ Paroma) [From \"Kapoor & Sons (Since 1921)\"]", "https://www.youtube.com/watch?v=NTHz9ephYTw");
        putDirectSong(overrides, "Badshah", "Saturday Saturday", "https://www.youtube.com/watch?v=0fXlZ3vnQd0");
        putDirectSong(overrides, "Badshah", "Kar Gayi Chull (From \"Kapoor & Sons (Since 1921)\")", "https://www.youtube.com/watch?v=NTHz9ephYTw");
        putDirectSong(overrides, "Badshah", "Kar Gayi Chull", "https://www.youtube.com/watch?v=NTHz9ephYTw");
        putDirectSong(overrides, "Badshah", "Aaj Raat Ka Scene", "https://www.youtube.com/watch?v=a7VVJwC1y8Q");
        putDirectSong(overrides, "Badshah", "Bandook", "https://www.youtube.com/watch?v=zT0GudaEois");
        putDirectSong(overrides, "Badshah", "Abhi Toh Party Shuru Hui Hai", "https://www.youtube.com/watch?v=8LZgzAZ2lpQ");
        putDirectSong(overrides, "Badshah", "Getup Jawani", "https://www.youtube.com/watch?v=r3opt2IoDII");
        return overrides;
    }

    private static void putDirectSong(Map<String, String> overrides, String artistName, String songTitle, String url) {
        overrides.put(normalizeKey(artistName) + ":" + normalizeKey(songTitle), url);
    }
}
