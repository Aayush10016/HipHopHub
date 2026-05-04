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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
    private static final Map<String, Set<String>> TRACK_TITLE_BLACKLISTS = buildTrackTitleBlacklists();
    private static final Map<String, Set<String>> ALBUM_TITLE_BLACKLISTS = buildAlbumTitleBlacklists();

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
        purgeBlacklistedCatalogEntries(artist);
        mergeDuplicateOwnedAlbums(artist);
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
        purgeBlacklistedCatalogEntries(artist);
        mergeDuplicateOwnedAlbums(artist);
        reclassifyLikelyFeatureAlbums(artist);
        deleteEmptyAlbums(artist);
        return artist;
    }

    public List<ArtistFactDTO> buildFacts(Artist artist) {
        List<ArtistFactDTO> facts = new ArrayList<>();
        List<Album> artistAlbums = albumRepository.findByArtistId(artist.getId()).stream()
                .collect(Collectors.collectingAndThen(
                        Collectors.toMap(
                                album -> album.getType() + ":" + normalizeKey(album.getTitle()),
                                album -> album,
                                (left, right) -> left,
                                LinkedHashMap::new),
                        map -> new ArrayList<>(map.values())));
        long songCount = songRepository.findByAlbumArtistId(artist.getId()).stream()
                .map(song -> normalizeKey(song.getTitle()))
                .filter(title -> !title.isBlank())
                .distinct()
                .count();
        long albumCount = artistAlbums.stream().filter(a -> a.getType() == Album.AlbumType.ALBUM).count();
        long epCount = artistAlbums.stream().filter(a -> a.getType() == Album.AlbumType.EP).count();
        long singleCount = artistAlbums.stream()
                .filter(a -> a.getType() == Album.AlbumType.SINGLE)
                .count();
        long featureCount = artistAlbums.stream()
                .filter(a -> a.getType() == Album.AlbumType.APPEARS_ON)
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
                            + " singles, " + featureCount + " features"));
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

    public Optional<Artist> resolveCatalogFallbackArtist(String artistName) {
        String key = normalizeKey(artistName);
        if ("calm".equals(key)) {
            return artistRepository.findByNameIgnoreCase("Seedhe Maut");
        }
        return Optional.empty();
    }

    private List<ITunesTrackDTO> findTracksForArtist(String requestedArtistName, String canonicalArtistName) {
        int lookupLimit = Math.max(trackLimit, 100);
        int searchLimit = Math.max(trackLimit, 50);

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
                for (ITunesTrackDTO track : iTunesService.lookupTracksByArtistId(artistId, lookupLimit, "IN")) {
                    if (track.getTrackId() != null) {
                        mergedByTrackId.putIfAbsent(track.getTrackId(), track);
                    }
                }
            }
        }

        for (TrackQueryOverride attempt : attempts) {
            List<ITunesTrackDTO> rawTracks = iTunesService.searchTracksByArtist(attempt.searchTerm(), searchLimit);
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

        appendCuratedTrackSupplements(artistKey, mergedByTrackId, searchLimit);

        return new ArrayList<>(mergedByTrackId.values());
    }

    private void appendCuratedTrackSupplements(String artistKey, Map<Long, ITunesTrackDTO> mergedByTrackId, int searchLimit) {
        if (!"devil".equals(artistKey)) {
            return;
        }

        List<TrackQueryOverride> exactQueries = List.of(
                new TrackQueryOverride("Todun Taak D Evil", "D'Evil", true),
                new TrackQueryOverride("Dekh Toofaan Aaya Hai D Evil", "D'Evil", true),
                new TrackQueryOverride("Asli Action Chaalu D Evil Shah Rule", "D'Evil", true),
                new TrackQueryOverride("Gully Gang Cypher Vol 2 D Evil", "D'Evil", true),
                new TrackQueryOverride("Gully Gang Cypher D Evil Aavrutti Shah Rule", "D'Evil", true),
                new TrackQueryOverride("Mumbai Darshan D Evil", "D'Evil", true),
                new TrackQueryOverride("Bohot Bhaari D Evil", "D'Evil", true),
                new TrackQueryOverride("Vibe Hai D Evil Shah Rule", "D'Evil", true),
                new TrackQueryOverride("Disco Rap D Evil MC Altaf", "D'Evil", true),
                new TrackQueryOverride("Bas Kya Ba D Evil", "D'Evil", true));

        Set<String> allowedTitles = Set.of(
                "toduntaak",
                "dekhtoofaanaayahai",
                "asliactionchaaluthemesong",
                "asliactionchaaluthemesongfromanactionhero",
                "gullygangcyphervol2featdivinedevilmcaltafaavruttiandshahrule",
                "gullygangcypherfeatsaifansammohitsledgefrenzzyandkarankanchan",
                "mumbaidarshan",
                "bohotbhaari",
                "vibehaifeataavruttidevilandshahrule",
                "discorap",
                "baskyabafeatdivine",
                "baskyabafeatडिवाइन");

        for (TrackQueryOverride attempt : exactQueries) {
            List<ITunesTrackDTO> rawTracks = iTunesService.searchTracksByArtist(attempt.searchTerm(), searchLimit);
            List<ITunesTrackDTO> retained = retainOwnedTracks(
                    attempt.ownershipName(),
                    rawTracks,
                    attempt.allowContributorMatches());
            retained.stream()
                    .filter(track -> allowedTitles.contains(normalizeKey(track.getTrackName())))
                    .forEach(track -> {
                        if (track.getTrackId() != null) {
                            mergedByTrackId.putIfAbsent(track.getTrackId(), track);
                        }
                    });
        }
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

        if (allowContributorMatches) {
            Map<Long, ITunesTrackDTO> merged = new LinkedHashMap<>();

            for (ITunesTrackDTO track : retainPreferredPrimaryTracks(artistName, primaryMatches)) {
                if (track.getTrackId() != null) {
                    merged.putIfAbsent(track.getTrackId(), track);
                }
            }

            filteredTracks.stream()
                    .filter(track -> isContributorMatch(artistName, track.getArtistName()))
                    .forEach(track -> {
                        if (track.getTrackId() != null) {
                            merged.putIfAbsent(track.getTrackId(), track);
                        }
                    });

            if (!merged.isEmpty()) {
                return new ArrayList<>(merged.values());
            }
        }

        if (!primaryMatches.isEmpty()) {
            return retainPreferredPrimaryTracks(artistName, primaryMatches);
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
            if (requiresStrictPreferredPrimaryMatch(artistKey)) {
                return List.of();
            }
        }
        return tracks;
    }

    private boolean requiresStrictPreferredPrimaryMatch(String artistKey) {
        return Set.of("drv").contains(artistKey);
    }

    private void saveTracksForArtist(Artist artist, List<ITunesTrackDTO> tracks) {
        List<String> incomingTrackKeys = new ArrayList<>();
        for (ITunesTrackDTO track : tracks) {
            if (track.getTrackName() == null || track.getTrackName().isBlank()) {
                continue;
            }
            if (isBlacklistedTrack(artist, track)) {
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

    private boolean isBlacklistedTrack(Artist artist, ITunesTrackDTO track) {
        if (artist == null || track == null) {
            return false;
        }
        if (isMixedVariant(track)) {
            return true;
        }
        String artistKey = normalizeKey(artist.getName());
        Set<String> blockedTitles = TRACK_TITLE_BLACKLISTS.get(artistKey);
        if (blockedTitles != null && !blockedTitles.isEmpty()) {
            String titleKey = normalizeKey(track.getTrackName());
            if (!titleKey.isBlank() && blockedTitles.contains(titleKey)) {
                return true;
            }
        }
        return isBlacklistedCollection(artistKey, track);
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

        String normalizedTitle = normalizeKey(pickAlbumTitle(track));
        if (artist.getId() != null && !normalizedTitle.isBlank()) {
            Optional<Album> sameTitleAlbum = albumRepository.findByArtistId(artist.getId()).stream()
                    .filter(existing -> existing.getType() == resolvedType)
                    .filter(existing -> normalizedTitle.equals(normalizeKey(existing.getTitle())))
                    .findFirst();
            if (sameTitleAlbum.isPresent()) {
                return updateExistingAlbum(sameTitleAlbum.get(), track, resolvedType, releaseDate, cover);
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

    private void mergeDuplicateOwnedAlbums(Artist artist) {
        if (artist == null || artist.getId() == null) {
            return;
        }

        Map<String, List<Album>> grouped = albumRepository.findByArtistId(artist.getId()).stream()
                .filter(album -> album.getTitle() != null && !album.getTitle().isBlank())
                .filter(album -> album.getType() != Album.AlbumType.APPEARS_ON)
                .collect(Collectors.groupingBy(album -> album.getType() + ":" + normalizeKey(album.getTitle())));

        for (List<Album> duplicates : grouped.values()) {
            if (duplicates.size() <= 1) {
                continue;
            }

            List<Album> ranked = duplicates.stream()
                    .sorted(Comparator
                            .comparingInt((Album album) -> songRepository.findByAlbumId(album.getId()).size())
                            .reversed()
                            .thenComparing((Album album) -> album.getReleaseDate() != null ? album.getReleaseDate() : LocalDate.MIN,
                                    Comparator.reverseOrder())
                            .thenComparing(Album::getId))
                    .collect(Collectors.toList());

            Album primary = ranked.get(0);
            Map<String, Song> primarySongsByTitle = songRepository.findByAlbumId(primary.getId()).stream()
                    .collect(Collectors.toMap(
                            song -> normalizeKey(song.getTitle()),
                            song -> song,
                            (left, right) -> left,
                            LinkedHashMap::new));

            for (int i = 1; i < ranked.size(); i++) {
                Album duplicate = ranked.get(i);
                for (Song song : songRepository.findByAlbumId(duplicate.getId())) {
                    String titleKey = normalizeKey(song.getTitle());
                    if (primarySongsByTitle.containsKey(titleKey)) {
                        songRepository.delete(song);
                        continue;
                    }
                    song.setAlbum(primary);
                    songRepository.save(song);
                    primarySongsByTitle.put(titleKey, song);
                }
                albumRepository.delete(duplicate);
            }
        }
    }

    private void purgeBlacklistedCatalogEntries(Artist artist) {
        if (artist == null || artist.getId() == null) {
            return;
        }

        for (Song song : songRepository.findByAlbumArtistId(artist.getId())) {
            if (!isManagedItunesSong(song)) {
                continue;
            }
            if (!isBlacklistedStoredSong(artist, song)) {
                continue;
            }
            songRepository.delete(song);
        }

        deleteEmptyAlbums(artist);
    }

    private boolean isBlacklistedStoredSong(Artist artist, Song song) {
        if (song == null) {
            return false;
        }
        ITunesTrackDTO track = new ITunesTrackDTO();
        track.setTrackName(song.getTitle());
        if (song.getAlbum() != null) {
            track.setCollectionName(song.getAlbum().getTitle());
        }
        return isBlacklistedTrack(artist, track);
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

        boolean primaryMatch = isPrimaryArtistMatch(artist.getName(), track.getArtistName());
        boolean contributorMatch = isContributorMatch(artist.getName(), track.getArtistName());
        boolean coPrimaryRelease = isLikelyCoPrimaryRelease(artist, track);

        if (!primaryMatch && !contributorMatch) {
            return Album.AlbumType.APPEARS_ON;
        }
        if (!primaryMatch && !coPrimaryRelease) {
            return Album.AlbumType.APPEARS_ON;
        }
        if (!isCollectionOwnedByArtist(artist, track) && !coPrimaryRelease) {
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

    private boolean isLikelyCoPrimaryRelease(Artist artist, ITunesTrackDTO track) {
        if (artist == null || track == null) {
            return false;
        }
        if (!isContributorMatch(artist.getName(), track.getArtistName())) {
            return false;
        }

        String collectionArtist = track.getCollectionArtistName();
        if (collectionArtist == null || collectionArtist.isBlank()) {
            return true;
        }

        return isPrimaryArtistMatch(artist.getName(), collectionArtist)
                || isContributorMatch(artist.getName(), collectionArtist);
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

        if (override.imageUrl() != null) {
            if (override.imageUrl().isBlank()) {
                if (artist.getImageUrl() != null && !artist.getImageUrl().isBlank()) {
                    artist.setImageUrl(null);
                }
            } else if (!override.imageUrl().equals(artist.getImageUrl())) {
                artist.setImageUrl(override.imageUrl());
            }
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
                "Bella is an Indian rapper known for emotionally direct writing, melodic hooks, and a versatile DHH catalog that moves between hard rap records and introspective songs.",
                ""));
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
        overrides.put("drv", new ArtistOverride("Desi Hip-Hop",
                "DRV is a Delhi rapper whose catalog blends melodic trap, conversational writing, and collaborative DHH records across solo projects, EPs, and feature-heavy releases."));
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
        overrides.put("ahmer", new ArtistOverride("Desi Hip-Hop",
                "Ahmer is a Kashmiri rapper and songwriter whose music blends political clarity, regional identity, and modern DHH production into one of the strongest catalogs from the valley."));
        overrides.put("apdhillon", new ArtistOverride("Punjabi",
                "AP Dhillon is a Punjabi singer, rapper, and songwriter whose catalog helped push modern North American Punjabi rap and melodic crossover records deep into the Indian mainstream."));
        overrides.put("badshah", new ArtistOverride("Desi Hip-Hop",
                "Badshah is a Delhi rapper, songwriter, and hitmaker who built one of the biggest catalogs in Indian hip-hop by balancing commercial hooks, rap writing, and crossover pop production."));
        overrides.put("bagimunda", new ArtistOverride("Desi Hip-Hop",
                "BAGI MUNDA is a Chandigarh-rooted DHH artist whose catalog mixes cinematic street rap, Punjabi-Hindi writing, and collaborative underground projects with producers and rappers from the newer wave."));
        overrides.put("brodhav", new ArtistOverride("Desi Hip-Hop",
                "Brodha V is a Bengaluru rapper, writer, and performer known for fast cadences, multilingual flows, mythic references, and one of the longest-running independent rap catalogs in Indian hip-hop."));
        overrides.put("chaardiwaari", new ArtistOverride("Desi Hip-Hop",
                "Chaar Diwaari is a Delhi artist and producer whose catalog pushes experimental Hindi hip-hop through abrasive production, unconventional songwriting, and a strong visual identity."));
        return overrides;
    }

    private static Map<String, List<Long>> buildPreferredItunesArtistIds() {
        Map<String, List<Long>> ids = new HashMap<>();
        ids.put("ab17", List.of(1729666037L, 1604373331L));
        ids.put("agsy", List.of(1457823481L, 1458883055L));
        ids.put("ahmer", List.of(921260135L));
        ids.put("apdhillon", List.of(1484701109L));
        ids.put("badshah", List.of(214832525L));
        ids.put("bagimunda", List.of(1565582554L));
        ids.put("bharg", List.of(1512171189L));
        ids.put("brodhav", List.of(388811568L));
        ids.put("chaardiwaari", List.of(1595489611L));
        ids.put("devil", List.of(1246923845L));
        ids.put("drv", List.of(1618943292L));
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
        overrides.put("ahmer", List.of(
                new TrackQueryOverride("SOS Ahmer", "Ahmer", true),
                new TrackQueryOverride("Prabh Deep Ahmer", "Ahmer", true),
                new TrackQueryOverride("Karun Ahmer", "Ahmer", true),
                new TrackQueryOverride("30KEY Ahmer", "Ahmer", true)));
        overrides.put("apdhillon", List.of(
                new TrackQueryOverride("Gurinder Gill AP Dhillon", "AP Dhillon", true),
                new TrackQueryOverride("Shinda Kahlon AP Dhillon", "AP Dhillon", true),
                new TrackQueryOverride("Ayra Starr AP Dhillon", "AP Dhillon", true)));
        overrides.put("badshah", List.of(
                new TrackQueryOverride("Aastha Gill Badshah", "Badshah", true),
                new TrackQueryOverride("Karan Aujla Badshah", "Badshah", true),
                new TrackQueryOverride("Arijit Singh Badshah", "Badshah", true),
                new TrackQueryOverride("Payal Dev Badshah", "Badshah", true),
                new TrackQueryOverride("Nikhita Gandhi Badshah", "Badshah", true),
                new TrackQueryOverride("Badshah Karan Aujla Arijit Singh", "Badshah", true)));
        overrides.put("bagimunda", List.of(
                new TrackQueryOverride("Dhanji BAGI MUNDA", "BAGI MUNDA", true),
                new TrackQueryOverride("dox BAGI MUNDA", "BAGI MUNDA", true),
                new TrackQueryOverride("Jaskaran BAGI MUNDA", "BAGI MUNDA", true),
                new TrackQueryOverride("MC Amrit BAGI MUNDA", "BAGI MUNDA", true),
                new TrackQueryOverride("Fatboi Raccoon BAGI MUNDA", "BAGI MUNDA", true)));
        overrides.put("bharg", List.of(
                new TrackQueryOverride("Rawal Bharg", "Bharg", true),
                new TrackQueryOverride("rohh Bharg", "Bharg", true),
                new TrackQueryOverride("Sez on the Beat Bharg", "Bharg", true),
                new TrackQueryOverride("Tsumyoki Bharg", "Bharg", true),
                new TrackQueryOverride("Agsy Bharg", "Bharg", true),
                new TrackQueryOverride("MC Headshot Bharg", "Bharg", true),
                new TrackQueryOverride("KR$NA Bharg", "Bharg", true),
                new TrackQueryOverride("Vasu Raina Bharg", "Bharg", true),
                new TrackQueryOverride("Saar Punch Bharg", "Bharg", true),
                new TrackQueryOverride("Ruaa Kayy Bharg", "Bharg", true),
                new TrackQueryOverride("Chaar Diwaari Bharg", "Bharg", true),
                new TrackQueryOverride("Dikshant Jain Bharg", "Bharg", true),
                new TrackQueryOverride("Frappe Ash Bharg", "Bharg", true),
                new TrackQueryOverride("SarpDansh Bharg", "Bharg", true),
                new TrackQueryOverride("SunSunnykhez Bharg", "Bharg", true),
                new TrackQueryOverride("Kanika Malhotra Bharg", "Bharg", true),
                new TrackQueryOverride("Bhappa Bharg", "Bharg", true),
                new TrackQueryOverride("SHAHI Bharg", "Bharg", true),
                new TrackQueryOverride("SPRYK Bharg", "Bharg", true),
                new TrackQueryOverride("Karan Kanchan Rawal Bharg", "Bharg", true)));
        overrides.put("brodhav", List.of(
                new TrackQueryOverride("Raftaar Brodha V", "Brodha V", true),
                new TrackQueryOverride("Hiphop Tamizha Brodha V", "Brodha V", true),
                new TrackQueryOverride("Anirudh Brodha V", "Brodha V", true),
                new TrackQueryOverride("Dub Sharma Brodha V", "Brodha V", true),
                new TrackQueryOverride("Sai Charan Brodha V", "Brodha V", true),
                new TrackQueryOverride("Ko the Timeless Brodha V", "Brodha V", true),
                new TrackQueryOverride("Siddharth Basrur Brodha V", "Brodha V", true),
                new TrackQueryOverride("Smokey Brodha V", "Brodha V", true)));
        overrides.put("chaardiwaari", List.of(
                new TrackQueryOverride("Bharg Chaar Diwaari", "Chaar Diwaari", true),
                new TrackQueryOverride("Karun Chaar Diwaari", "Chaar Diwaari", true)));
        overrides.put("bella", List.of(
                new TrackQueryOverride("MC Headshot Bella", "Bella", true),
                new TrackQueryOverride("Deep Kalsi Bella", "Bella", true),
                new TrackQueryOverride("Kidshot Bella", "Bella", true),
                new TrackQueryOverride("Siyaahi Bella", "Bella", true),
                new TrackQueryOverride("UDD CHALE Bella", "Bella", true),
                new TrackQueryOverride("Dukh Dard Peeda Bella", "Bella", true),
                new TrackQueryOverride("Hangover MC Headshot Bella", "Bella", true),
                new TrackQueryOverride("Caution MC Headshot Bella", "Bella", true),
                new TrackQueryOverride("Space For Now Bella", "Bella", true)));
        overrides.put("gravity", List.of(
                new TrackQueryOverride("Gravity Mtv Hustle", "Gravity", false)));
        overrides.put("dakaitshaddy", List.of(
                new TrackQueryOverride("Dakait", "Dakait", false)));
        overrides.put("devil", List.of(
                new TrackQueryOverride("D Evil divine", "D'Evil", true),
                new TrackQueryOverride("D Evil MC Altaf", "D'Evil", true),
                new TrackQueryOverride("D Evil Shah Rule", "D'Evil", true),
                new TrackQueryOverride("D Evil Toofaan", "D'Evil", true),
                new TrackQueryOverride("D Evil Gully Gang", "D'Evil", true),
                new TrackQueryOverride("D Evil Action Hero", "D'Evil", true),
                new TrackQueryOverride("D Evil Madgaon Express", "D'Evil", true)));
        overrides.put("drv", List.of(
                new TrackQueryOverride("Qaab DRV", "DRV", true),
                new TrackQueryOverride("Boyblanck DRV", "DRV", true),
                new TrackQueryOverride("Bombay the Artist DRV", "DRV", true),
                new TrackQueryOverride("Darcy DRV", "DRV", true),
                new TrackQueryOverride("Loka DRV", "DRV", true),
                new TrackQueryOverride("AAKASH DRV", "DRV", true),
                new TrackQueryOverride("Dhanji DRV", "DRV", true),
                new TrackQueryOverride("Mohit DRV", "DRV", true),
                new TrackQueryOverride("Full Power DRV", "DRV", true),
                new TrackQueryOverride("Flyboy S DRV", "DRV", true),
                new TrackQueryOverride("Zubin DRV", "DRV", true),
                new TrackQueryOverride("jaiyash DRV", "DRV", true),
                new TrackQueryOverride("Sidak Singh DRV", "DRV", true),
                new TrackQueryOverride("Raftaar DRV", "DRV", true),
                new TrackQueryOverride("Boman Irani DRV", "DRV", true)));
        return overrides;
    }

    private static Map<String, Set<String>> buildTrackTitleBlacklists() {
        Map<String, Set<String>> blacklists = new HashMap<>();
        blacklists.put("apdhillon", Set.of(
                "losingmyselffeatgunnamixed",
                "summerhighmixed",
                "problemsgoverpeacemixed",
                "truestoriesmixed",
                "excusessaieremixmixed",
                "majhailmixed",
                "teretemanjremixmixed",
                "brownmundesohniyemixed",
                "indiansarangifeatdeestarzamajheaaleteejeditmixed",
                "murdershewroteexcusesmundiantobachkesantochglremixmixed"));
        blacklists.put("bella", Set.of(
                "tiamopersemprefeatbellanonvocalextendedmix",
                "tiamopersemprefeatbellavocalextendedmix"));
        blacklists.put("bharg", Set.of(
                "roshnimixed"));
        blacklists.put("brodhav", Set.of(
                "partyallnight52nonstop",
                "brodhavaathmaraama",
                "birlaestateshomeadvantageforrcbfeatbrodhav"));
        blacklists.put("drv", Set.of(
                "feelagain",
                "righthere",
                "blessings",
                "noonecouldloveyoumore",
                "aura",
                "demain",
                "secretsignals",
                "candlelights",
                "coldcircuit",
                "coolgirls",
                "moneygreed",
                "farbutnotgone",
                "myfallenangle",
                "foronelasttime",
                "themoonjustknows",
                "myfirstiloveyou",
                "nocrownnothronejustyou",
                "inquest",
                "lafoule",
                "winterdrive",
                "cloudtree",
                "bekindtothegoodones",
                "doyousee",
                "thestruggle",
                "daydreams",
                "togetherinthisthing",
                "bendtheknee",
                "thesamepicture",
                "runaway",
                "distncia",
                "kofarcade",
                "autentico",
                "jobs",
                "ifoughtthelawfeattedhawkins",
                "rosehill",
                "crash",
                "60xaday",
                "americandream",
                "milesaway",
                "alive",
                "hollywood",
                "theend",
                "thatslove",
                "cominghome",
                "wordtothewise",
                "sounbelievable",
                "mrbadluck",
                "sixfeetdown",
                "livelearn",
                "homecoming",
                "timestandsstill",
                "nothingtolose",
                "farfromgrace",
                "betterdays",
                "thatgirl",
                "drv"));
        return blacklists;
    }

    private static Map<String, Set<String>> buildAlbumTitleBlacklists() {
        Map<String, Set<String>> blacklists = new HashMap<>();
        blacklists.put("apdhillon", Set.of(
                "dontbelievethehypevol6djmix",
                "tupuedesworkoutmusic",
                "haveyourselfaveryindiesummer",
                "purosexitosdelaelectronica",
                "purosxitosdelaelectrnica",
                "lostemazosdelhouseyeltechno",
                "lovetapes",
                "talaradiojuly2023djmix",
                "boilerroommanjinlondonoct122023djmix",
                "boilerroompanjabihitsquadinlondonoct122023djmix",
                "episode003teejdjmix",
                "episode005skgdjmix",
                "episode023jasleendjmix",
                "halfmoonogshezdjmix",
                "syber009smilezdjmix",
                "womentothefrontkizzidjmix"));
        blacklists.put("devil", Set.of(
                "cricketlivewithmusic",
                "drunknhighhouseparty",
                "dancepop2021ep",
                "desihiphophits",
                "desihiphopvibes",
                "motivationalsongshindi",
                "newyearnewmemotivationalsongs",
                "bollywoodworkouthits",
                "clubout",
                "desigrind",
                "rapkamausam",
                "junglirap",
                "cooppedupep",
                "massappealgullygangshutdown",
                "skrrtskrrt",
                "micdropscene"));
        blacklists.put("drv", Set.of(
                "feelagainsingle",
                "rightheresingle",
                "blessingssingle",
                "noonecouldloveyoumoresingle",
                "aurasingle",
                "demainsingle",
                "secretsignalssingle",
                "candlelightssingle",
                "coldcircuitsingle",
                "coolgirlssingle",
                "moneygreedsingle",
                "lafoulesingle",
                "clubout",
                "bleedinink",
                "ukulelesongs",
                "cclos",
                "desihiphophits",
                "drivenrockvision",
                "drv",
                "housepartysongs",
                "dilliscene",
                "rapbajao",
                "bhartiyahiphop",
                "electronicdeepsoundvol2",
                "orphanblackthednasamplermusicfromtheoriginaltvseries"));
        return blacklists;
    }

    private boolean isBlacklistedCollection(String artistKey, ITunesTrackDTO track) {
        Set<String> blockedCollections = ALBUM_TITLE_BLACKLISTS.get(artistKey);
        if (blockedCollections == null || blockedCollections.isEmpty()) {
            return false;
        }
        String collectionKey = normalizeKey(track.getCollectionName());
        return !collectionKey.isBlank() && blockedCollections.contains(collectionKey);
    }

    private boolean isMixedVariant(ITunesTrackDTO track) {
        String titleKey = normalizeKey(track.getTrackName());
        String collectionKey = normalizeKey(track.getCollectionName());
        return titleKey.contains("mixed") || collectionKey.contains("djmix");
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
