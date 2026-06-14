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
    const artists = coerceArray<GameCatalogArtist>(payload?.artists)
    const songs = coerceArray<GameCatalogSong>(payload?.songs)
    const releases = coerceArray<GameCatalogRelease>(payload?.releases)

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
                    artists: payload.artistCount,
                    tracks: payload.songCount,
                    releases: payload.releaseCount,
                    ready: payload.catalogReady,
                })

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
                setError('Could not load the arcade catalog.')
                setLoading(false)
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
