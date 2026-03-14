# Importing Artists (Last.fm + iTunes)

HipHopHub now uses a hybrid data flow:
- Last.fm for artist bios, tags, and images
- iTunes for track previews and album art

This keeps the database real without strict API limits.

## Requirements

- A Last.fm API key (free)
- Add keys in `backend/src/main/resources/application-local.properties`:
```
lastfm.api.key=YOUR_LASTFM_KEY
lastfm.api.secret=YOUR_LASTFM_SECRET
```

## Import a single artist

Windows CMD:
```
curl -X POST http://localhost:8080/api/admin/music/import-artist -H "Content-Type: application/json" -d "{\"artistName\":\"KR$NA\"}"
```

PowerShell:
```
Invoke-RestMethod -Uri "http://localhost:8080/api/admin/music/import-artist" -Method POST -ContentType "application/json" -Body '{"artistName":"Talha Anjum"}'
```

## Import the default seed list

```
curl -X POST http://localhost:8080/api/admin/music/import-seeds
```

## Notes

- iTunes previews are 30 seconds.
- Tracks without previews are skipped.
- Adjust `music.import.track.limit` in `application.properties` to pull more tracks per artist.
- You can also use `/api/artists/search?q=ArtistName` to auto-import while searching.
