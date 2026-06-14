import { useEffect, useMemo, useState } from 'react'

export interface GameCatalogArtist {
    id: number
    name: string
    genre?: string
    bio?: string
    imageUrl?: string
    city?: string
    facts: string[]
    releaseYears: number[]
    releaseCount: number
    songCount: number
}

export interface GameCatalogSong {
    id: number
    title: string
    artistId: number
    artistName: string
    previewUrl?: string
    coverUrl?: string
    youtubeUrl?: string
    releaseDate?: string
    albumTitle?: string
    albumType?: string
}

export interface GameCatalogRelease {
    id: number
    title: string
    artistId: number
    artistName: string
    releaseDate?: string
    type?: string
    coverUrl?: string
    youtubeUrl?: string
}

interface GameCatalogResponse {
    artists: GameCatalogArtist[]
    songs: GameCatalogSong[]
    releases: GameCatalogRelease[]
    artistCount: number
    songCount: number
    releaseCount: number
}

let catalogPromise: Promise<GameCatalogResponse> | null = null
let catalogCache: GameCatalogResponse | null = null

const emptyCatalog: GameCatalogResponse = {
    artists: [],
    songs: [],
    releases: [],
    artistCount: 0,
    songCount: 0,
    releaseCount: 0,
}

const coerceArray = <T,>(value: unknown) => Array.isArray(value) ? value as T[] : []

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
    }
}

export function useGameCatalog() {
    const [data, setData] = useState<GameCatalogResponse>(catalogCache || emptyCatalog)
    const [loading, setLoading] = useState(!catalogCache)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        if (catalogCache) {
            setLoading(false)
            return
        }

        if (!catalogPromise) {
            catalogPromise = fetchCatalog()
                .then(payload => {
                    catalogCache = payload
                    return payload
                })
                .finally(() => {
                    catalogPromise = null
                })
        }

        catalogPromise
            .then(payload => {
                if (cancelled) return

                console.info(`Loaded artists: ${payload.artistCount}`)
                console.info(`Loaded tracks: ${payload.songCount}`)
                console.log({
                    artists: payload.artistCount,
                    tracks: payload.songCount,
                    releases: payload.releaseCount,
                })

                if (payload.artistCount === 0 || payload.songCount === 0) {
                    console.warn('Arcade catalog returned an unexpectedly small pool.', payload)
                }

                setData(payload)
                setLoading(false)
            })
            .catch(err => {
                console.error('Failed to load game catalog:', err)
                if (!cancelled) {
                    setError('Could not load the arcade catalog.')
                    setLoading(false)
                }
            })

        return () => {
            cancelled = true
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
