package com.hiphophub.service;

import com.hiphophub.dto.ArtistFactDTO;
import com.hiphophub.dto.DeezerArtistDTO;
import com.hiphophub.dto.ITunesTrackDTO;
import com.hiphophub.dto.LastFmArtistInfoResponse;
import com.hiphophub.model.Album;
import com.hiphophub.model.Artist;
import com.hiphophub.model.Song;
import com.hiphophub.repository.AlbumRepository;
import com.hiphophub.repository.ArtistRepository;
import com.hiphophub.repository.SongRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class MusicImportService {

    private record ArtistOverride(String genre, String bio, String imageUrl) {
        private ArtistOverride(String genre, String bio) {
            this(genre, bio, null);
        }
    }

    private record TrackQueryOverride(String searchTerm, String ownershipName, boolean allowContributorMatches) {
    }

    private static final Logger log = LoggerFactory.getLogger(MusicImportService.class);

    @Value("${music.import.track.limit:25}")
    private int trackLimit;

    private static final String LASTFM_PLACEHOLDER_TOKEN = "2a96cbd8b46e442fc41c2b86b821562f";
    private static final Map<String, ArtistOverride> ARTIST_OVERRIDES = buildArtistOverrides();
    private static final Map<String, List<Long>> PREFERRED_ITUNES_ARTIST_IDS = buildPreferredItunesArtistIds();
    private static final Map<String, Album.AlbumType> ALBUM_TYPE_OVERRIDES = buildAlbumTypeOverrides();
    private static final Map<String, List<TrackQueryOverride>> TRACK_QUERY_OVERRIDES = buildTrackQueryOverrides();

    @Autowired
    private ArtistRepository artistRepository;

    @Autowired
    private AlbumRepository albumRepository;

    @Autowired
    private SongRepository songRepository;

    @Autowired
    private LastFmService lastFmService;

    @Autowired
    private ITunesService iTunesService;

    @Autowired
    private DeezerService deezerService;

    public Artist refreshArtistMetadata(String artistName) {
        Optional<Artist> existing = artistRepository.findByNameIgnoreCase(artistName);
        if (existing.isEmpty()) {
            return importArtist(artistName);
        }

        Artist artist = existing.get();
        LastFmArtistInfoResponse.Artist info = lastFmService.fetchArtistInfo(artistName).orElse(null);
        Optional<DeezerArtistDTO> deezerArtist = deezerService.searchBestArtist(artistName);

        if (info == null && deezerArtist.isEmpty()) {
            applyCuratedOverrides(artist, artistName);
            return artist;
        }

        if (info != null) {
            String cleanedBio = cleanSummary(info.getBio() != null ? info.getBio().getSummary() : null);
            if (shouldOverrideBio(artist.getBio(), cleanedBio)) {
                artist.setBio(cleanedBio);
            }

            String pickedGenre = pickGenre(info);
            if (shouldOverrideGenre(artist.getGenre(), pickedGenre)) {
                artist.setGenre(pickedGenre);
            }

            String lastFmImage = pickImage(info);
            if (shouldOverrideArtistImage(artist.getImageUrl(), lastFmImage)) {
                artist.setImageUrl(lastFmImage);
            }

            Long listeners = parseLong(info.getStats() != null ? info.getStats().getListeners() : null);
            if (listeners > 0) {
                artist.setMonthlyListeners(listeners);
            }
        }

        String deezerImage = deezerArtist.map(deezerService::pickBestImage).orElse(null);
        if (shouldOverrideArtistImage(artist.getImageUrl(), deezerImage)) {
            artist.setImageUrl(deezerImage);
        }

        Long deezerFans = deezerArtist.map(DeezerArtistDTO::getNbFan).orElse(0L);
        if ((artist.getMonthlyListeners() == null || artist.getMonthlyListeners() <= 0) && deezerFans > 0) {
            artist.setMonthlyListeners(deezerFans);
        }

        applyCuratedOverrides(artist, artistName);

        return artistRepository.save(artist);
    }

    public Artist refreshArtistImage(String artistName, boolean forceOverride) {
        Optional<Artist> existing = artistRepository.findByNameIgnoreCase(artistName);
        Artist artist = existing.orElseGet(() -> importArtist(artistName));

        Optional<DeezerArtistDTO> deezerArtist = deezerService.searchBestArtist(artist.getName());
        if (deezerArtist.isEmpty()) {
            deezerArtist = deezerService.searchBestArtist(artistName);
        }

        if (deezerArtist.isEmpty()) {
            return artist;
        }

        String deezerImage = deezerService.pickBestImage(deezerArtist.get());
        if (deezerImage != null && !deezerImage.isBlank()) {
            if (forceOverride || shouldOverrideArtistImage(artist.getImageUrl(), deezerImage)) {
                artist.setImageUrl(deezerImage);
            }
        }

        Long deezerFans = deezerArtist.map(DeezerArtistDTO::getNbFan).orElse(0L);
        if ((artist.getMonthlyListeners() == null || artist.getMonthlyListeners() <= 0) && deezerFans > 0) {
            artist.setMonthlyListeners(deezerFans);
        }

        applyCuratedOverrides(artist, artistName);

        return artistRepository.save(artist);
    }

    public Artist importArtist(String artistName) {
        Optional<Artist> existing = artistRepository.findByNameIgnoreCase(artistName);

        LastFmArtistInfoResponse.Artist info = lastFmService.fetchArtistInfo(artistName).orElse(null);
        String canonicalName = info != null && info.getName() != null && !info.getName().isBlank()
                ? info.getName()
                : artistName;
        Optional<DeezerArtistDTO> deezerArtist = deezerService.searchBestArtist(canonicalName);
        if (deezerArtist.isEmpty() && !canonicalName.equalsIgnoreCase(artistName)) {
            deezerArtist = deezerService.searchBestArtist(artistName);
        }

        Artist artist = existing.orElseGet(Artist::new);
        if (artist.getName() == null || artist.getName().isBlank()) {
            String deezerCanonicalName = deezerArtist.map(DeezerArtistDTO::getName).orElse(null);
            artist.setName(firstNonBlank(canonicalName, deezerCanonicalName, artistName));
        }

        if (info != null) {
            String cleanedBio = cleanSummary(info.getBio() != null ? info.getBio().getSummary() : null);
            if (shouldOverrideBio(artist.getBio(), cleanedBio)) {
                artist.setBio(cleanedBio);
            } else if (isGenericBio(artist.getBio())) {
                artist.setBio(null);
            }

            String pickedGenre = pickGenre(info);
            if (shouldOverrideGenre(artist.getGenre(), pickedGenre)) {
                artist.setGenre(pickedGenre);
            }

            String lastFmImage = pickImage(info);
            if (shouldOverrideArtistImage(artist.getImageUrl(), lastFmImage)) {
                artist.setImageUrl(lastFmImage);
            }

            Long listeners = parseLong(info.getStats() != null ? info.getStats().getListeners() : null);
            if (listeners > 0) {
                artist.setMonthlyListeners(listeners);
            }
        }

        String deezerImage = deezerArtist.map(deezerService::pickBestImage).orElse(null);
        if (shouldOverrideArtistImage(artist.getImageUrl(), deezerImage)) {
            artist.setImageUrl(deezerImage);
        }

        Long deezerFans = deezerArtist.map(DeezerArtistDTO::getNbFan).orElse(0L);
        if ((artist.getMonthlyListeners() == null || artist.getMonthlyListeners() <= 0) && deezerFans > 0) {
            artist.setMonthlyListeners(deezerFans);
        }

        List<ITunesTrackDTO> tracks = findTracksForArtist(artistName, canonicalName);

        if (tracks.isEmpty()) {
            log.warn("No iTunes tracks found for artist '{}'", canonicalName);
        } else {
            log.debug("Found {} iTunes tracks for artist '{}'", tracks.size(), canonicalName);
            String primaryGenre = firstNonBlankGenre(tracks);
            if (shouldOverrideGenre(artist.getGenre(), primaryGenre)) {
                artist.setGenre(primaryGenre);
            }
        }

        if (artist.getGenre() == null || artist.getGenre().isBlank()) {
            artist.setGenre("Hip Hop");
        }

        applyCuratedOverrides(artist, artistName);

        artist = artistRepository.save(artist);
        saveTracksForArtist(artist, tracks);
        reclassifyLikelyFeatureAlbums(artist);
        deleteEmptyAlbums(artist);

        return artist;
    }

    public Artist refreshArtistTracks(String artistName) {
        Optional<Artist> existing = artistRepository.findByNameIgnoreCase(artistName);
        Artist artist = existing.orElseGet(() -> importArtist(artistName));

        String canonicalName = artist.getName() != null && !artist.getName().isBlank()
                ? artist.getName()
                : artistName;

        List<ITunesTrackDTO> tracks = findTracksForArtist(artistName, canonicalName);

        if (!tracks.isEmpty()) {
            String primaryGenre = firstNonBlankGenre(tracks);
            if (shouldOverrideGenre(artist.getGenre(), primaryGenre)) {
                artist.setGenre(primaryGenre);
            }
        }

        applyCuratedOverrides(artist, artistName);

        artist = artistRepository.save(artist);
        saveTracksForArtist(artist, tracks);
        reclassifyLikelyFeatureAlbums(artist);
        deleteEmptyAlbums(artist);
        return artist;
    }

    public List<ArtistFactDTO> buildFacts(Artist artist) {
        List<ArtistFactDTO> facts = new ArrayList<>();
        List<Album> artistAlbums = albumRepository.findByArtistId(artist.getId());
        long songCount = songRepository.countByAlbumArtistId(artist.getId());
        long albumCount = artistAlbums.stream().filter(a -> a.getType() == Album.AlbumType.ALBUM).count();
        long epCount = artistAlbums.stream().filter(a -> a.getType() == Album.AlbumType.EP).count();
        long singleCount = artistAlbums.stream()
                .filter(a -> a.getType() == Album.AlbumType.SINGLE || a.getType() == Album.AlbumType.APPEARS_ON)
                .count();

        facts.add(new ArtistFactDTO(1L, "Genre: " + safe(artist.getGenre(), "Hip Hop")));

        facts.add(new ArtistFactDTO(2L, "Catalog: " + songCount + " songs across " + artistAlbums.size() + " releases"));

        artistAlbums.stream()
                .filter(a -> a.getReleaseDate() != null)
                .max(Comparator.comparing(Album::getReleaseDate))
                .ifPresent(latest -> facts.add(new ArtistFactDTO(3L,
                        "Latest release: " + latest.getTitle() + " (" + latest.getReleaseDate().getYear() + ")")));

        if (albumCount > 0 || epCount > 0 || singleCount > 0) {
            facts.add(new ArtistFactDTO(4L,
                    "Projects split: " + albumCount + " albums, " + epCount + " EPs, " + singleCount
 + " singles/features"));
        }

        if (artist.getBio() != null && !artist.getBio().isBlank()) {
            facts.add(new ArtistFactDTO(5L, "Known for: " + trimSentence(artist.getBio())));
        }

        return facts;
    }

    public Artist enrichArtistForDisplay(Artist artist) {
        if (artist == null) {
            return null;
        }
        applyCuratedOverrides(artist, artist.getName());
        return artist;
    }

    public boolean hasCatalogFallback(String artistName) {
        String key = normalizeKey(artistName);
        return List.of("calm").contains(key);
    }

    private List<ITunesTrackDTO> findTracksForArtist(String requestedArtistName, String canonicalArtistName) {
        List<TrackQueryOverride> attempts = new ArrayList<>();
        attempts.add(new TrackQueryOverride(canonicalArtistName, canonicalArtistName, false));
        if (requestedArtistName != null && !requestedArtistName.equalsIgnoreCase(canonicalArtistName)) {
            attempts.add(new TrackQueryOverride(requestedArtistName, requestedArtistName, false));
        }

        List<TrackQueryOverride> overrides = TRACK_QUERY_OVERRIDES.get(normalizeKey(firstNonBlank(requestedArtistName, canonicalArtistName)));
        if (overrides != null) {
            attempts.addAll(overrides);
        }

        Map<Long, ITunesTrackDTO> mergedByTrackId = new java.util.LinkedHashMap<>();
        String artistKey = normalizeKey(firstNonBlank(requestedArtistName, canonicalArtistName));
        List<Long> preferredArtistIds = PREFERRED_ITUNES_ARTIST_IDS.get(artistKey);
        if (preferredArtistIds != null) {
            for (Long artistId : preferredArtistIds) {
                for (ITunesTrackDTO track : iTunesService.lookupTracksByArtistId(artistId, trackLimit, "IN")) {
                    if (track.getTrackId() != null) {
                        mergedByTrackId.putIfAbsent(track.getTrackId(), track);
                    }
                }
            }
        }

        for (TrackQueryOverride attempt : attempts) {
            List<ITunesTrackDTO> rawTracks = iTunesService.searchTracksByArtist(attempt.searchTerm(), trackLimit);
            List<ITunesTrackDTO> retained = retainOwnedTracks(
                    attempt.ownershipName(),
                    rawTracks,
                    attempt.allowContributorMatches());
            for (ITunesTrackDTO track : retained) {
                if (track.getTrackId() != null) {
                    mergedByTrackId.putIfAbsent(track.getTrackId(), track);
                }
            }
        }

        return new ArrayList<>(mergedByTrackId.values());
    }

    private List<ITunesTrackDTO> retainOwnedTracks(String artistName, List<ITunesTrackDTO> tracks) {
        return retainOwnedTracks(artistName, tracks, false);
    }

    private List<ITunesTrackDTO> retainOwnedTracks(String artistName, List<ITunesTrackDTO> tracks,
            boolean allowContributorMatches) {
        if (tracks == null || tracks.isEmpty()) {
            return List.of();
        }

        List<ITunesTrackDTO> filteredTracks = filterKnownNameCollisions(artistName, tracks);

        List<ITunesTrackDTO> primaryMatches = filteredTracks.stream()
                .filter(track -> isPrimaryArtistMatch(artistName, track.getArtistName()))
                .collect(Collectors.toList());

        if (!primaryMatches.isEmpty()) {
            return retainPreferredPrimaryTracks(artistName, primaryMatches);
        }

        if (allowContributorMatches) {
            return filteredTracks.stream()
                    .filter(track -> isContributorMatch(artistName, track.getArtistName()))
                    .collect(Collectors.toList());
        }

        return List.of();
    }

    private List<ITunesTrackDTO> filterKnownNameCollisions(String artistName, List<ITunesTrackDTO> tracks) {
        String normalizedArtist = normalizeKey(artistName);
        if (!"yashraj".equals(normalizedArtist)) {
            return tracks;
        }

        return tracks.stream()
                .filter(track -> {
                    String trackArtist = normalizeKey(track.getArtistName());
                    String collectionArtist = normalizeKey(track.getCollectionArtistName());
                    return !trackArtist.contains("mukhate") && !collectionArtist.contains("mukhate");
                })
                .collect(Collectors.toList());
    }

    private List<ITunesTrackDTO> retainPreferredPrimaryTracks(String artistName, List<ITunesTrackDTO> tracks) {
        if (tracks == null || tracks.isEmpty()) {
            return List.of();
        }

        String artistKey = normalizeKey(artistName);
        List<Long> preferredArtistIds = PREFERRED_ITUNES_ARTIST_IDS.get(artistKey);
        if (preferredArtistIds != null && !preferredArtistIds.isEmpty()) {
            List<ITunesTrackDTO> exactIdMatches = tracks.stream()
                    .filter(track -> track.getArtistId() != null && preferredArtistIds.contains(track.getArtistId()))
                    .collect(Collectors.toList());
            if (!exactIdMatches.isEmpty()) {
                return exactIdMatches;
            }
        }
        return tracks;
    }

    private void saveTracksForArtist(Artist artist, List<ITunesTrackDTO> tracks) {
        List<String> incomingTrackKeys = new ArrayList<>();
        for (ITunesTrackDTO track : tracks) {
            if (track.getTrackName() == null || track.getTrackName().isBlank()) {
                continue;
            }

            String previewUrl = track.getPreviewUrl();

            Album album = findOrCreateAlbum(artist, track);
            String trackKey = track.getTrackId() != null ? "itunes:" + track.getTrackId() : null;
            if (trackKey != null) {
                incomingTrackKeys.add(trackKey);
            }

            if (trackKey != null) {
                Optional<Song> existingSong = songRepository.findByExternalId(trackKey);
                if (existingSong.isPresent()) {
                    Song song = existingSong.get();
                    boolean changed = false;

                    if (song.getAlbum() == null || song.getAlbum().getArtist() == null
                            || !isSameArtist(song.getAlbum().getArtist(), artist)) {
                        song.setAlbum(album);
                        changed = true;
                    }
                    if (!track.getTrackName().equals(song.getTitle())) {
                        song.setTitle(track.getTrackName());
                        changed = true;
                    }
                    if (previewUrl != null && !previewUrl.isBlank() && !previewUrl.equals(song.getPreviewUrl())) {
                        song.setPreviewUrl(previewUrl);
                        changed = true;
                    }
                    if (track.getTrackNumber() != null && !track.getTrackNumber().equals(song.getTrackNumber())) {
                        song.setTrackNumber(track.getTrackNumber());
                        changed = true;
                    }
                    if (track.getTrackTimeMillis() != null && !track.getTrackTimeMillis().equals(song.getDurationMs())) {
                        song.setDurationMs(track.getTrackTimeMillis());
                        changed = true;
                    }

                    if (changed) {
                        songRepository.save(song);
                    }
                    continue;
                }
            }

            Song song = new Song();
            song.setTitle(track.getTrackName());
            song.setExternalId(trackKey);
            song.setDurationMs(track.getTrackTimeMillis());
            song.setTrackNumber(track.getTrackNumber());
            song.setPreviewUrl(previewUrl);
            song.setAlbum(album);
            songRepository.save(song);
        }

        cleanupArtistCatalog(artist, incomingTrackKeys);
    }

    private Album findOrCreateAlbum(Artist artist, ITunesTrackDTO track) {
        Album.AlbumType resolvedType = classifyAlbumType(artist, track);
        LocalDate releaseDate = parseDate(track.getReleaseDate());
        String cover = upscaleArtwork(track.getArtworkUrl100());
        if (cover == null || cover.isBlank()) {
            cover = artist.getImageUrl();
        }

        String albumKey = buildAlbumKey(artist, track);
        if (albumKey != null) {
            Optional<Album> existing = albumRepository.findByExternalId(albumKey);
            if (existing.isPresent()) {
                return updateExistingAlbum(existing.get(), track, resolvedType, releaseDate, cover);
            }
        }

        String legacyKey = buildLegacyAlbumKey(track);
        if (legacyKey != null) {
            Optional<Album> legacy = albumRepository.findByExternalId(legacyKey);
            if (legacy.isPresent() && isSameArtist(legacy.get().getArtist(), artist)) {
                return updateExistingAlbum(legacy.get(), track, resolvedType, releaseDate, cover);
            }
        }

        Album album = new Album();
        album.setArtist(artist);
        album.setTitle(pickAlbumTitle(track));
        album.setType(resolvedType);
        album.setReleaseDate(releaseDate);
        album.setCoverUrl(cover);
        album.setExternalId(albumKey != null ? albumKey : buildFallbackAlbumKey(artist, track));

        return albumRepository.save(album);
    }

    private Album updateExistingAlbum(Album existing, ITunesTrackDTO track, Album.AlbumType resolvedType,
            LocalDate releaseDate, String cover) {
        boolean changed = false;

        if (resolvedType != null && existing.getType() != resolvedType) {
            existing.setType(resolvedType);
            changed = true;
        }
        if ((existing.getTitle() == null || existing.getTitle().isBlank()) && pickAlbumTitle(track) != null) {
            existing.setTitle(pickAlbumTitle(track));
            changed = true;
        }
        if (existing.getReleaseDate() == null && releaseDate != null) {
            existing.setReleaseDate(releaseDate);
            changed = true;
        }
        if ((existing.getCoverUrl() == null || existing.getCoverUrl().isBlank()) && cover != null && !cover.isBlank()) {
            existing.setCoverUrl(cover);
            changed = true;
        }

        if (changed) {
            return albumRepository.save(existing);
        }
        return existing;
    }

    private void cleanupArtistCatalog(Artist artist, List<String> incomingTrackKeys) {
        if (artist == null || artist.getId() == null) {
            return;
        }
        if (incomingTrackKeys == null || incomingTrackKeys.isEmpty()) {
            return;
        }

        List<Song> existingSongs = songRepository.findByAlbumArtistId(artist.getId());
        for (Song song : existingSongs) {
            if (!isManagedItunesSong(song)) {
                continue;
            }
            if (incomingTrackKeys.contains(song.getExternalId())) {
                continue;
            }
            songRepository.delete(song);
        }

        deleteEmptyAlbums(artist);
    }

    private boolean isManagedItunesSong(Song song) {
        if (song == null || song.getExternalId() == null) {
            return false;
        }
        return song.getExternalId().startsWith("itunes:");
    }

    private Album.AlbumType classifyAlbumType(Artist artist, ITunesTrackDTO track) {
        Album.AlbumType overrideType = resolveAlbumTypeOverride(artist, track);
        if (overrideType != null) {
            return overrideType;
        }

        if (!isPrimaryArtistMatch(artist.getName(), track.getArtistName())) {
            return Album.AlbumType.APPEARS_ON;
        }
        if (!isCollectionOwnedByArtist(artist, track)) {
            return Album.AlbumType.APPEARS_ON;
        }

        String collectionName = track.getCollectionName() != null
                ? track.getCollectionName().toLowerCase(Locale.ROOT)
                : "";

        if (collectionName.contains("single")) {
            return Album.AlbumType.SINGLE;
        }
        if (collectionName.contains(" ep") || collectionName.endsWith("ep") || collectionName.contains("- ep")) {
            return Album.AlbumType.EP;
        }

        Integer trackCount = track.getTrackCount();
        if (trackCount == null || trackCount <= 1) {
            return Album.AlbumType.SINGLE;
        }
        if (trackCount <= 7) {
            return Album.AlbumType.EP;
        }
        return Album.AlbumType.ALBUM;
    }

    private Album.AlbumType resolveAlbumTypeOverride(Artist artist, ITunesTrackDTO track) {
        String artistKey = normalizeKey(artist != null ? artist.getName() : null);
        String titleKey = normalizeKey(pickAlbumTitle(track));
        if (artistKey.isBlank() || titleKey.isBlank()) {
            return null;
        }
        return ALBUM_TYPE_OVERRIDES.get(artistKey + ":" + titleKey);
    }

    private boolean isCollectionOwnedByArtist(Artist artist, ITunesTrackDTO track) {
        String collectionArtist = track.getCollectionArtistName();
        if (collectionArtist == null || collectionArtist.isBlank()) {
            return true;
        }
        return isPrimaryArtistMatch(artist.getName(), collectionArtist)
                || isContributorMatch(artist.getName(), collectionArtist);
    }

    private String pickGenre(LastFmArtistInfoResponse.Artist info) {
        if (info.getTags() != null && info.getTags().getTag() != null && !info.getTags().getTag().isEmpty()) {
            return info.getTags().getTag().get(0).getName();
        }
        return "Hip Hop";
    }

    private String pickImage(LastFmArtistInfoResponse.Artist info) {
        if (info.getImage() == null || info.getImage().isEmpty()) {
            return null;
        }
        for (int i = info.getImage().size() - 1; i >= 0; i--) {
            LastFmArtistInfoResponse.Image image = info.getImage().get(i);
            if (image == null) {
                continue;
            }
            String url = image.getUrl();
            if (url != null && !url.isBlank() && !isLastFmPlaceholder(url)) {
                return url;
            }
        }
        return null;
    }

    private Long parseLong(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private LocalDate parseDate(String isoDate) {
        if (isoDate == null || isoDate.isBlank()) {
            return null;
        }
        try {
            if (isoDate.length() == 4) {
                return LocalDate.of(Integer.parseInt(isoDate), 1, 1);
            }
            if (isoDate.contains("T")) {
                return OffsetDateTime.parse(isoDate).toLocalDate();
            }
            return LocalDate.parse(isoDate);
        } catch (Exception e) {
            return null;
        }
    }

    private String cleanSummary(String summary) {
        if (summary == null) {
            return null;
        }
        String noHtml = summary.replaceAll("<[^>]*>", "").trim();
        int idx = noHtml.indexOf("Read more");
        if (idx > 0) {
            noHtml = noHtml.substring(0, idx).trim();
        }
        int ccIdx = noHtml.indexOf("User-contributed text");
        if (ccIdx > 0) {
            noHtml = noHtml.substring(0, ccIdx).trim();
        }
        if (noHtml.isBlank()) {
            return null;
        }
        if (isGenericBio(noHtml)) {
            return null;
        }
        return noHtml;
    }

    private String upscaleArtwork(String url) {
        if (url == null) {
            return null;
        }
        return url.replaceAll("100x100", "600x600")
                .replaceAll("200x200", "600x600")
                .replaceAll("300x300", "600x600");
    }

    private String trimSentence(String text) {
        if (text == null) {
            return "";
        }
        String cleaned = text.trim();
        int dot = cleaned.indexOf('.');
        if (dot > 0) {
            return cleaned.substring(0, dot + 1);
        }
        return cleaned;
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String firstNonBlankGenre(List<ITunesTrackDTO> tracks) {
        for (ITunesTrackDTO track : tracks) {
            String genre = track.getPrimaryGenreName();
            if (genre != null && !genre.isBlank()) {
                return genre;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private boolean shouldOverrideArtistImage(String current, String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }
        if (current == null || current.isBlank()) {
            return true;
        }
        return isLastFmPlaceholder(current) || isLikelyAlbumArt(current);
    }

    private boolean shouldOverrideGenre(String current, String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }
        if (current == null || current.isBlank()) {
            return true;
        }
        return isUnrelatedGenre(current);
    }

    private boolean shouldOverrideBio(String current, String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }
        if (current == null || current.isBlank()) {
            return true;
        }
        return isGenericBio(current);
    }

    private boolean isUnrelatedGenre(String genre) {
        if (genre == null || genre.isBlank()) {
            return true;
        }
        String lower = genre.toLowerCase(Locale.ROOT);
        return !(lower.contains("hip hop")
                || lower.contains("hip-hop")
                || lower.contains("rap")
                || lower.contains("desi")
                || lower.contains("punjabi")
                || lower.contains("hindi")
                || lower.contains("indian")
                || lower.contains("urdu"));
    }

    private boolean isLastFmPlaceholder(String url) {
        return url != null && url.contains(LASTFM_PLACEHOLDER_TOKEN);
    }

    private boolean isLikelyAlbumArt(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        return lower.contains("mzstatic.com")
                || lower.contains("itunes.apple.com")
                || lower.contains("apple.com/us/album");
    }

    private boolean isGenericBio(String bio) {
        if (bio == null) {
            return false;
        }
        String lower = bio.toLowerCase(Locale.ROOT);
        return lower.contains("there is more than one artist with the name")
                || lower.contains("there are at least")
                || lower.contains("read more on last.fm");
    }

    private String pickAlbumTitle(ITunesTrackDTO track) {
        if (track.getCollectionName() != null && !track.getCollectionName().isBlank()) {
            return track.getCollectionName();
        }
        if (track.getTrackName() != null && !track.getTrackName().isBlank()) {
            return track.getTrackName();
        }
        return "Singles";
    }

    private String buildAlbumKey(Artist artist, ITunesTrackDTO track) {
        String artistKey = normalizeKey(artist != null ? artist.getName() : null);
        if (track.getCollectionId() != null && !artistKey.isBlank()) {
            return "itunes:" + artistKey + ":" + track.getCollectionId();
        }

        String title = pickAlbumTitle(track);
        String titleKey = normalizeKey(title);
        if (artistKey.isBlank() || titleKey.isBlank()) {
            return null;
        }
        return "itunes:single:" + artistKey + ":" + titleKey;
    }

    private String buildLegacyAlbumKey(ITunesTrackDTO track) {
        if (track.getCollectionId() == null) {
            return null;
        }
        return "itunes:" + track.getCollectionId();
    }

    private String buildFallbackAlbumKey(Artist artist, ITunesTrackDTO track) {
        String artistKey = normalizeKey(artist != null ? artist.getName() : null);
        String titleKey = normalizeKey(pickAlbumTitle(track));
        return "itunes:fallback:" + artistKey + ":" + titleKey;
    }

    private boolean isSameArtist(Artist first, Artist second) {
        if (first == null || second == null) {
            return false;
        }
        if (first.getId() != null && second.getId() != null) {
            return first.getId().equals(second.getId());
        }
        return normalizeKey(first.getName()).equals(normalizeKey(second.getName()));
    }

    private boolean isPrimaryArtistMatch(String expectedArtist, String trackArtist) {
        String normalizedExpected = normalizeKey(expectedArtist);
        if (normalizedExpected.isBlank()) {
            return false;
        }

        String primaryContributor = extractContributors(trackArtist).stream()
                .findFirst()
                .orElse("");
        String normalizedPrimary = normalizeKey(primaryContributor);

        if (normalizedPrimary.isBlank()) {
            return false;
        }

        return normalizedPrimary.equals(normalizedExpected);
    }

    private boolean isContributorMatch(String expectedArtist, String trackArtist) {
        String normalizedExpected = normalizeKey(expectedArtist);
        if (normalizedExpected.isBlank()) {
            return false;
        }

        return extractContributors(trackArtist).stream()
                .map(this::normalizeKey)
                .anyMatch(contributor -> contributor.equals(normalizedExpected));
    }

    private List<String> extractContributors(String rawArtistCredit) {
        if (rawArtistCredit == null || rawArtistCredit.isBlank()) {
            return List.of();
        }

        return Arrays.stream(rawArtistCredit.split("(?i)\\s*(?:,|&| feat\\.? | ft\\.? | x | with | and |\\+)\\s*"))
                .filter(part -> part != null && !part.isBlank())
                .collect(Collectors.toList());
    }

    private String normalizeKey(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private void reclassifyLikelyFeatureAlbums(Artist artist) {
        List<Album> artistAlbums = albumRepository.findByArtistId(artist.getId());
        for (Album album : artistAlbums) {
            if (album.getType() == Album.AlbumType.SINGLE || album.getType() == Album.AlbumType.APPEARS_ON) {
                continue;
            }

            int ownSongCount = songRepository.findByAlbumId(album.getId()).size();
            if (ownSongCount == 0 || ownSongCount > 2) {
                continue;
            }

            List<Album> sameTitleAlbums = albumRepository.findByTitleIgnoreCase(album.getTitle());
            Optional<Album> strongestCandidate = sameTitleAlbums.stream()
                    .filter(other -> other.getId() != null && !other.getId().equals(album.getId()))
                    .filter(other -> !isSameArtist(other.getArtist(), artist))
                    .max(Comparator.comparingInt(other -> songRepository.findByAlbumId(other.getId()).size()));

            if (strongestCandidate.isEmpty()) {
                continue;
            }

            int otherSongCount = songRepository.findByAlbumId(strongestCandidate.get().getId()).size();
            if (otherSongCount >= ownSongCount + 2) {
                album.setType(Album.AlbumType.APPEARS_ON);
                albumRepository.save(album);
            }
        }
    }

    private void applyCuratedOverrides(Artist artist, String requestedArtistName) {
        if (artist == null) {
            return;
        }

        String key = normalizeKey(firstNonBlank(artist.getName(), requestedArtistName));
        ArtistOverride override = ARTIST_OVERRIDES.get(key);
        if (override == null) {
            return;
        }

        if (override.genre() != null && !override.genre().isBlank()
                && !override.genre().equalsIgnoreCase(safe(artist.getGenre(), ""))) {
            artist.setGenre(override.genre());
        }

        if (override.bio() != null && !override.bio().isBlank()
                && !override.bio().equals(artist.getBio())) {
            artist.setBio(override.bio());
        }

        if (override.imageUrl() != null && !override.imageUrl().isBlank()
                && !override.imageUrl().equals(artist.getImageUrl())) {
            artist.setImageUrl(override.imageUrl());
        }
    }

    private static Map<String, ArtistOverride> buildArtistOverrides() {
        Map<String, ArtistOverride> overrides = new HashMap<>();
        overrides.put("divine", new ArtistOverride("Desi Hip-Hop",
                "DIVINE is a Mumbai rapper who helped push Indian hip-hop into the mainstream with street-rooted writing, cinematic storytelling, and the Gully Gang movement."));
        overrides.put("ikka", new ArtistOverride("Desi Hip-Hop",
                "Ikka is a Delhi rapper, songwriter, and hitmaker known for balancing hard rap records with major crossover hooks across independent and film music."));
        overrides.put("king", new ArtistOverride("Desi Hip-Hop",
                "King is a Delhi artist whose catalog blends rap, melody, and pop songwriting, making him one of the most commercially visible names from the DHH ecosystem.",
                "https://cdn-images.dzcdn.net/images/artist/a2abdf367a086764c0d8b0e8d8a6832c/1000x1000-000000-80-0-0.jpg"));
        overrides.put("calm", new ArtistOverride("Desi Hip-Hop",
                "Calm is a Delhi rapper and producer best known as one half of Seedhe Maut, with a style built on layered writing, beat work, and modern underground rap production.",
                "https://cdn-images.dzcdn.net/images/artist/dbd4cd0d5c2e3f1000b742542d3d7a07/1000x1000-000000-80-0-0.jpg"));
        overrides.put("karma", new ArtistOverride("Desi Hip-Hop",
                "Karma is a Dehradun rapper recognized for technical bars, sharp flows, and a battle-ready writing style that made him a consistent DHH mainstay."));
        overrides.put("gravity", new ArtistOverride("Desi Hip-Hop",
                "Gravity is a Mumbai rapper known for fast cadences, dense rhyme patterns, and sci-fi-leaning concepts that stand out in India’s underground rap scene."));
        overrides.put("paradox", new ArtistOverride("Desi Hip-Hop",
                "Paradox is an Indian rapper and performer who broke out through battle-rap energy, melodic instincts, and high-visibility live appearances."));
        overrides.put("raga", new ArtistOverride("Desi Hip-Hop",
                "Raga is a Delhi rapper with an aggressive voice, street-heavy writing, and a catalog shaped by cypher culture, diss records, and high-impact singles."));
        overrides.put("bella", new ArtistOverride("Desi Hip-Hop",
                "Bella is an Indian rapper and singer known for emotionally direct writing, melodic hooks, and a versatile catalog that moves between rap records and introspective songs."));
        overrides.put("panther", new ArtistOverride("Desi Hip-Hop",
                "Panther is a Delhi-based rapper whose music leans on punchlines, swagger, and fast-paced bars built for cyphers, battles, and club-ready singles."));
        overrides.put("naamsujal", new ArtistOverride("Desi Hip-Hop",
                "Naam Sujal is a rising Indian rapper whose visibility grew through performance-led rap platforms and a fast-expanding youth audience."));
        overrides.put("nanku", new ArtistOverride("Desi Hip-Hop",
                "Nanku is an Indian artist working across rap, alt-pop, and melodic songwriting with a catalog that comfortably crosses underground and accessible sounds."));
        overrides.put("siyaahi", new ArtistOverride("Desi Hip-Hop",
                "Siyaahi is an Ahmedabad rapper tied closely to India’s independent hip-hop circuit, known for nimble flows, collaborative work, and left-field production choices."));
        overrides.put("vichaar", new ArtistOverride("Desi Hip-Hop",
                "Vichaar is an Indian hip-hop artist associated with lyrically dense underground records and collaborative releases across the newer DHH wave."));
        overrides.put("bharg", new ArtistOverride("Desi Hip-Hop",
                "Bharg is an Indian rapper and producer whose work moves between sharp rap writing, melodic experimentation, and modern independent production."));
        overrides.put("dhanji", new ArtistOverride("Desi Hip-Hop",
                "Dhanji is an Ahmedabad rapper known for eccentric flows, off-center writing, and a catalog that pushes beyond standard desi rap templates."));
        overrides.put("yashraj", new ArtistOverride("Desi Hip-Hop",
                "YashRaj is a Mumbai rapper and songwriter known for polished flows, melodic control, and a modern sound shaped by both underground and streaming-era DHH."));
        overrides.put("prabhdeep", new ArtistOverride("Desi Hip-Hop",
                "Prabh Deep is a Delhi rapper and singer whose work blends Punjabi identity, social reflection, and futuristic production into one of DHH’s strongest discographies."));
        overrides.put("thesiege", new ArtistOverride("Desi Hip-Hop",
                "The Siege is a Mumbai rapper whose catalog leans dark, theatrical, and introspective, with a strong foothold in India's underground rap scene."));
        overrides.put("deemc", new ArtistOverride("Desi Hip-Hop",
                "Dee MC is an Indian rapper and songwriter known for battle-rooted confidence, sharp bilingual writing, and years of visibility across the wider hip-hop ecosystem."));
        overrides.put("nazz", new ArtistOverride("Desi Hip-Hop",
                "Nazz is an Indian rapper who built a following through direct writing, internet-native punchlines, and quick-turnaround independent singles."));
        overrides.put("lashcurry", new ArtistOverride("Desi Hip-Hop",
                "Lashcurry is a rising Indian rapper from the newer DHH wave, recognized for technical cadences, freestyle energy, and youth-heavy digital reach."));
        overrides.put("devil", new ArtistOverride("Desi Hip-Hop",
                "D'Evil is a Mumbai rapper from the Gully Gang ecosystem, known for street-rooted writing, cypher-heavy collaborations, and a raw old-school rap presence."));
        overrides.put("dakaitshaddy", new ArtistOverride("Desi Hip-Hop",
                "Dakait Shaddy is a North Indian hip-hop artist tied to the Dakait camp, with a catalog shaped by rugged flows, regional slang, and underground rap collaborations."));
        overrides.put("epriyer", new ArtistOverride("Desi Hip-Hop",
                "EPR Iyer is an Indian rapper celebrated for dense writing, socio-political themes, and one of the most technically demanding flows in the scene."));
        overrides.put("kaambhaari", new ArtistOverride("Desi Hip-Hop",
                "Kaam Bhaari is a Mumbai rapper associated with gritty street writing and the city's original gully rap breakthrough period."));
        overrides.put("shahrule", new ArtistOverride("Desi Hip-Hop",
                "Shah Rule is a Mumbai artist whose catalog blends rap, melody, and polished songwriting aimed at both scene credibility and wide replay value."));
        overrides.put("kidshot", new ArtistOverride("Desi Hip-Hop",
                "Kidshot is a battle-tested Indian rapper known for aggressive punchlines, cypher-ready energy, and a strong roots-in-the-scene reputation."));
        overrides.put("vijaydk", new ArtistOverride("Desi Hip-Hop",
                "Vijay DK is a Mumbai rapper with a fast-rising local following, known for street-first records, slang-heavy writing, and strong youth appeal."));
        overrides.put("ab17", new ArtistOverride("Desi Hip-Hop",
                "ab17 is an Indian underground rapper associated with hard-edged independent releases, collaborative cypher energy, and a newer-school DHH sound."));
        overrides.put("agsy", new ArtistOverride("Desi Hip-Hop",
                "Agsy is a Delhi rapper and performer whose catalog blends battle energy, melody, and confident crossover writing across singles, cyphers, and collaborative DHH releases."));
        return overrides;
    }

    private static Map<String, List<Long>> buildPreferredItunesArtistIds() {
        Map<String, List<Long>> ids = new HashMap<>();
        ids.put("ab17", List.of(1729666037L, 1604373331L));
        ids.put("agsy", List.of(1457823481L, 1458883055L));
        ids.put("yashraj", List.of(1530263031L));
        ids.put("king", List.of(1489995981L));
        ids.put("paradox", List.of(1680197168L));
        ids.put("bella", List.of(1529015408L));
        ids.put("nanku", List.of(1677419924L));
        ids.put("raga", List.of(162661216L));
        ids.put("ikka", List.of(545256421L));
        ids.put("gravity", List.of(130799L));
        return ids;
    }

    private static Map<String, Album.AlbumType> buildAlbumTypeOverrides() {
        Map<String, Album.AlbumType> overrides = new HashMap<>();
        overrides.put("yashraj:merijaanpehlenaach", Album.AlbumType.ALBUM);
        return overrides;
    }

    private static Map<String, List<TrackQueryOverride>> buildTrackQueryOverrides() {
        Map<String, List<TrackQueryOverride>> overrides = new HashMap<>();
        overrides.put("ab17", List.of(
                new TrackQueryOverride("Ab 17 RiJ", "Ab 17", false),
                new TrackQueryOverride("Omkar Singh Ab 17", "Ab 17", true)));
        overrides.put("agsy", List.of(
                new TrackQueryOverride("Agsy", "Agsy", true),
                new TrackQueryOverride("Deep Kalsi Agsy", "Agsy", true),
                new TrackQueryOverride("KALAM INK Agsy", "Agsy", true),
                new TrackQueryOverride("Parmish Verma Agsy", "Agsy", true),
                new TrackQueryOverride("RCR Ishq Bector Agsy", "Agsy", true),
                new TrackQueryOverride("KavyaKriti Agsy", "Agsy", true),
                new TrackQueryOverride("Jogga Agsy", "Agsy", true),
                new TrackQueryOverride("The Landers Agsy", "Agsy", true),
                new TrackQueryOverride("Patang Agsy", "Agsy", true),
                new TrackQueryOverride("BLRJ Agsy", "Agsy", true),
                new TrackQueryOverride("Prabh Deep Smoke Agsy", "Agsy", true)));
        overrides.put("gravity", List.of(
                new TrackQueryOverride("Gravity Mtv Hustle", "Gravity", false)));
        overrides.put("dakaitshaddy", List.of(
                new TrackQueryOverride("Dakait", "Dakait", false)));
        overrides.put("devil", List.of(
                new TrackQueryOverride("D Evil divine", "D'Evil", true)));
        return overrides;
    }

    private void deleteEmptyAlbums(Artist artist) {
        List<Album> artistAlbums = albumRepository.findByArtistId(artist.getId());
        for (Album album : artistAlbums) {
            if (songRepository.findByAlbumId(album.getId()).isEmpty()) {
                albumRepository.delete(album);
            }
        }
    }
}
