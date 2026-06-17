import { useEffect, useMemo, useState } from 'react'
import type { GameCatalogArtist, GameCatalogRelease, GameCatalogResponse, GameCatalogSong } from '../lib/gameCatalog'

let catalogPromise: Promise<GameCatalogResponse> | null = null
let catalogCache: GameCatalogResponse | null = null

const emptyCatalog: GameCatalogResponse = {
    artists: [],
    songs: [],
    releases: [],
    artistCount: 0,
    songCount: 0,
    releaseCount: 0,
    catalogReady: false,
}

const RETRY_DELAYS_MS = [800, 1500, 2500, 4000]

const coerceArray = <T,>(value: unknown) => Array.isArray(value) ? value as T[] : []
const coerceString = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : String(value)
const coerceNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return fallback
}
const coerceNumberArray = (value: unknown) => coerceArray<unknown>(value)
    .map(item => coerceNumber(item, NaN))
    .filter(item => Number.isFinite(item))

const normalizeArtist = (raw: any): GameCatalogArtist => ({
    id: coerceNumber(raw?.id),
    name: coerceString(raw?.name || raw?.artistName || raw?.artist || raw?.title),
    genre: coerceString(raw?.genre) || undefined,
    bio: coerceString(raw?.bio || raw?.description) || undefined,
    imageUrl: coerceString(raw?.imageUrl || raw?.image_url || raw?.image) || undefined,
    city: coerceString(raw?.city || raw?.location) || undefined,
    facts: coerceArray<unknown>(raw?.facts || raw?.artistFacts).map(item => coerceString(item)).filter(Boolean),
    releaseYears: coerceNumberArray(raw?.releaseYears || raw?.years || raw?.release_years),
    releaseCount: coerceNumber(raw?.releaseCount || raw?.release_count),
    songCount: coerceNumber(raw?.songCount || raw?.trackCount || raw?.song_count),
    collectives: coerceArray<unknown>(raw?.collectives || raw?.collective || raw?.groups).map(item => coerceString(item)).filter(Boolean),
    labels: coerceArray<unknown>(raw?.labels || raw?.label).map(item => coerceString(item)).filter(Boolean),
})

const normalizeSong = (raw: any): GameCatalogSong => ({
    id: coerceNumber(raw?.id),
    title: coerceString(raw?.title || raw?.songTitle || raw?.song || raw?.songName || raw?.name),
    artistId: coerceNumber(raw?.artistId || raw?.artist_id),
    artistName: coerceString(raw?.artistName || raw?.artist || raw?.name),
    previewUrl: coerceString(raw?.previewUrl || raw?.preview_url || raw?.audioPreview || raw?.audio || raw?.preview) || undefined,
    audio: coerceString(raw?.audio || raw?.previewUrl || raw?.preview_url || raw?.audioPreview || raw?.preview) || undefined,
    coverUrl: coerceString(raw?.coverUrl || raw?.cover_url || raw?.cover || raw?.albumCover || raw?.imageUrl) || undefined,
    youtubeUrl: coerceString(raw?.youtubeUrl || raw?.youtube_url || raw?.youtube) || undefined,
    releaseDate: coerceString(raw?.releaseDate || raw?.release_date || raw?.date) || undefined,
    albumTitle: coerceString(raw?.albumTitle || raw?.album || raw?.album_name || raw?.releaseTitle) || undefined,
    albumType: coerceString(raw?.albumType || raw?.album_type || raw?.type) || undefined,
})

const normalizeRelease = (raw: any): GameCatalogRelease => ({
    id: coerceNumber(raw?.id),
    title: coerceString(raw?.title || raw?.releaseTitle || raw?.albumTitle || raw?.name),
    artistId: coerceNumber(raw?.artistId || raw?.artist_id),
    artistName: coerceString(raw?.artistName || raw?.artist || raw?.name),
    releaseDate: coerceString(raw?.releaseDate || raw?.release_date || raw?.date) || undefined,
    type: coerceString(raw?.type || raw?.albumType || raw?.album_type) || undefined,
    coverUrl: coerceString(raw?.coverUrl || raw?.cover_url || raw?.cover || raw?.imageUrl) || undefined,
    youtubeUrl: coerceString(raw?.youtubeUrl || raw?.youtube_url || raw?.youtube) || undefined,
})

const isCatalogReady = (payload: GameCatalogResponse) => {
    if (payload.catalogReady === false) return false
    return payload.artistCount > 0 && payload.songCount > 0 && payload.releaseCount > 0
}

const fetchCatalog = async (): Promise<GameCatalogResponse> => {
    const response = await fetch('/api/game/catalog')
    if (!response.ok) {
        throw new Error('Failed to load game catalog')
    }

    const payload = await response.json()
    const artists = coerceArray<any>(payload?.artists).map(normalizeArtist).filter(artist => artist.id > 0 && artist.name)
    const songs = coerceArray<any>(payload?.songs).map(normalizeSong).filter(song => song.id > 0 && song.title && song.artistName)
    const releases = coerceArray<any>(payload?.releases).map(normalizeRelease).filter(release => release.id > 0 && release.title && release.artistName)

    return {
        artists,
        songs,
        releases,
        artistCount: Number(payload?.artistCount || artists.length || 0),
        songCount: Number(payload?.songCount || songs.length || 0),
        releaseCount: Number(payload?.releaseCount || releases.length || 0),
        catalogReady: Boolean(payload?.catalogReady ?? (artists.length > 0 && songs.length > 0 && releases.length > 0)),
    }
}

const getCatalogPromise = () => {
    if (!catalogPromise) {
        catalogPromise = fetchCatalog().finally(() => {
            catalogPromise = null
        })
    }
    return catalogPromise
}

export function useGameCatalog() {
    const [data, setData] = useState<GameCatalogResponse>(catalogCache || emptyCatalog)
    const [loading, setLoading] = useState(!catalogCache || !isCatalogReady(catalogCache))
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        let retryTimer: number | null = null
        let attempt = 0

        const clearRetry = () => {
            if (retryTimer !== null) {
                window.clearTimeout(retryTimer)
                retryTimer = null
            }
        }

        const scheduleRetry = () => {
            clearRetry()
            const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
            retryTimer = window.setTimeout(() => {
                attempt += 1
                void loadCatalog()
            }, delay)
        }

        const loadCatalog = async () => {
            try {
                const payload = await getCatalogPromise()
                if (cancelled) return

                console.info(`Loaded artists: ${payload.artistCount}`)
                console.info(`Loaded tracks: ${payload.songCount}`)
                console.log({
                    totalArtists: payload.artistCount,
                    totalSongs: payload.songCount,
                    totalReleases: payload.releaseCount,
                    ready: payload.catalogReady,
                })

                if (payload.artistCount === 0) {
                    console.error('Arcade catalog error: Total artists is 0.')
                }
                if (payload.songCount === 0) {
                    console.error('Arcade catalog error: Total songs is 0.')
                }
                if (payload.releaseCount === 0) {
                    console.error('Arcade catalog error: Total releases is 0.')
                }

                setData(payload)

                if (isCatalogReady(payload)) {
                    catalogCache = payload
                    setLoading(false)
                    setError(null)
                    return
                }

                console.warn('Arcade catalog is still provisional. Retrying until the live catalog is ready.', payload)
                setLoading(true)
                setError(null)
                scheduleRetry()
            } catch (err) {
                console.error('Failed to load game catalog:', err)
                if (cancelled) return
                // Retry on error — the backend may not be ready yet
                scheduleRetry()
            }
        }

        if (catalogCache && isCatalogReady(catalogCache)) {
            setData(catalogCache)
            setLoading(false)
            return () => {
                cancelled = true
                clearRetry()
            }
        }

        setLoading(true)
        void loadCatalog()

        return () => {
            cancelled = true
            clearRetry()
        }
    }, [])

    const artistsById = useMemo(() => {
        const map = new Map<number, GameCatalogArtist>()
        data.artists.forEach(artist => map.set(artist.id, artist))
        return map
    }, [data.artists])

    const songsByArtistId = useMemo(() => {
        const map = new Map<number, GameCatalogSong[]>()
        data.songs.forEach(song => {
            const list = map.get(song.artistId) || []
            list.push(song)
            map.set(song.artistId, list)
        })
        return map
    }, [data.songs])

    const releasesByArtistId = useMemo(() => {
        const map = new Map<number, GameCatalogRelease[]>()
        data.releases.forEach(release => {
            const list = map.get(release.artistId) || []
            list.push(release)
            map.set(release.artistId, list)
        })
        return map
    }, [data.releases])

    return {
        ...data,
        loading,
        error,
        artistsById,
        songsByArtistId,
        releasesByArtistId,
    }
}

