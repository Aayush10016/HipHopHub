import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hashString, pickDistinctItems, pickLeastRecent, readRecentValues, writeRecentValue } from '../utils/rotation'
import './LandingPage.css'

const marqueeItems = [
    'Underground artist radar',
    'Lyric + lore trivia',
    'Playable track previews',
    'Artist universes',
    'Tour and release tracking',
    'Guess-the-track game'
]

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=1200&q=80'

interface LandingTrack {
    id?: number
    title: string
    previewUrl: string
    artistName: string
    albumTitle?: string
    coverUrl?: string
    youtubeUrl?: string
}

interface RandomSongResponse {
    id?: number
    title?: string
    previewUrl?: string
    artistName?: string
    coverUrl?: string
    youtubeUrl?: string
    album?: {
        title?: string
        coverUrl?: string
        coverImageUrl?: string
        artist?: {
            name?: string
        }
    }
}

interface LandingFallbackResponse {
    songName?: string
    artistName?: string
    previewUrl?: string
}

interface LandingArtist {
    id: number
    name: string
    monthlyListeners?: number
    bio?: string
}

interface LandingTriviaItem {
    title: string
    lead: string
    body: string
}

interface SceneControlStat {
    label: string
    value: string
}

interface LandingOverviewResponse {
    track?: RandomSongResponse
    undergroundArtists?: LandingArtist[]
    trivia?: LandingTriviaItem[]
}

interface LandingSongPoolItem {
    id?: number
    title?: string
    previewUrl?: string
    artistName?: string
    coverUrl?: string
    youtubeUrl?: string
    album?: {
        title?: string
        coverUrl?: string
        coverImageUrl?: string
        artist?: {
            name?: string
        }
    }
}

let cachedLandingTrack: LandingTrack | null = null
let pendingLandingTrackPromise: Promise<LandingTrack | null> | null = null

const normalizeRandomSong = (song: RandomSongResponse): LandingTrack | null => {
    if (!song?.previewUrl || !song?.title) {
        return null
    }

    const artistName = song.artistName || song.album?.artist?.name || 'Featured artists'
    const albumTitle = song.album?.title || 'Fresh drops + classics'
    const coverUrl = song.coverUrl || song.album?.coverImageUrl || song.album?.coverUrl || DEFAULT_COVER

    return {
        id: song.id,
        title: song.title,
        previewUrl: song.previewUrl,
        artistName,
        albumTitle,
        coverUrl,
        youtubeUrl: song.youtubeUrl
    }
}

const normalizeFallbackSong = (fallback: LandingFallbackResponse): LandingTrack | null => {
    if (!fallback?.previewUrl || !fallback.songName) {
        return null
    }

    const artistName = fallback.artistName || 'Featured artists'

    return {
        title: fallback.songName,
        previewUrl: fallback.previewUrl,
        artistName,
        albumTitle: 'Fresh drops + classics',
        coverUrl: DEFAULT_COVER,
        youtubeUrl: undefined
    }
}

const normalizeSongPoolTrack = (song: LandingSongPoolItem): LandingTrack | null => {
    if (!song?.previewUrl || !song?.title) return null

    return {
        id: song.id,
        title: song.title,
        previewUrl: song.previewUrl,
        artistName: song.artistName || song.album?.artist?.name || 'Featured artists',
        albumTitle: song.album?.title || 'Fresh drops + classics',
        coverUrl: song.coverUrl || song.album?.coverImageUrl || song.album?.coverUrl || DEFAULT_COVER,
        youtubeUrl: song.youtubeUrl
    }
}

const fetchLandingTrack = async (): Promise<LandingTrack | null> => {
    try {
        const songRes = await fetch('/api/songs/random')
        if (songRes.ok) {
            const song = normalizeRandomSong(await songRes.json())
            if (song) {
                return song
            }
        }
    } catch (err) {
        console.error('Failed to fetch random song for landing:', err)
    }

    try {
        const fallbackRes = await fetch('/api/landing/background-song')
        if (fallbackRes.ok) {
            const fallback = normalizeFallbackSong(await fallbackRes.json())
            if (fallback) {
                return fallback
            }
        }
    } catch (err) {
        console.error('Failed to fetch fallback landing music:', err)
    }

    return null
}

const getLandingTrack = async (): Promise<LandingTrack | null> => {
    if (cachedLandingTrack) {
        return cachedLandingTrack
    }

    if (!pendingLandingTrackPromise) {
        pendingLandingTrackPromise = fetchLandingTrack()
            .then(track => {
                cachedLandingTrack = track
                return track
            })
            .finally(() => {
                pendingLandingTrackPromise = null
            })
    }

    return pendingLandingTrackPromise
}

const getBioSnapshot = (bio?: string) => {
    if (!bio) return 'Scene profile syncing.'
    const sentences = bio
        .split('.')
        .map(sentence => sentence.trim())
        .filter(Boolean)
        .slice(0, 2)

    const summary = sentences.join('. ')
    const tightened = summary.length > 108 ? `${summary.slice(0, 105).trimEnd()}.` : summary
    return tightened.endsWith('.') ? tightened : `${tightened}.`
}

const buildLoreCard = (artist: LandingArtist): LandingTriviaItem => ({
    title: 'Lore',
    lead: artist.name,
    body: getBioSnapshot(artist.bio)
})

export default function LandingPage() {
    const navigate = useNavigate()
    const [selectedTrack, setSelectedTrack] = useState<LandingTrack | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [autoplayBlocked, setAutoplayBlocked] = useState(false)
    const [isMuted, setIsMuted] = useState(true)
    const [undergroundArtists, setUndergroundArtists] = useState<LandingArtist[]>([])
    const [triviaItems, setTriviaItems] = useState<LandingTriviaItem[]>([])
    const [sceneControlStats, setSceneControlStats] = useState<SceneControlStat[]>([
        { label: 'Artists', value: '0' },
        { label: 'Playable cuts', value: '0' },
        { label: 'Daily rotations', value: '3' }
    ])
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        let cancelled = false

        const loadLandingData = async () => {
            const rotationSeed = hashString(new Date().toDateString())
            let fallbackArtists: LandingArtist[] = []
            let fallbackTrivia: LandingTriviaItem[] = []

            try {
                const [overviewResult, artistResult, songPoolResult] = await Promise.allSettled([
                    fetch('/api/landing/overview'),
                    fetch('/api/artists?scope=dhh'),
                    fetch('/api/songs/top/dhh?days=365&limit=36')
                ])

                let overviewTrack: LandingTrack | null = null
                let triviaFromOverview: LandingTriviaItem[] = []
                let nextSceneStats = [...sceneControlStats]

                if (overviewResult.status === 'fulfilled' && overviewResult.value.ok) {
                    const payload = (await overviewResult.value.json()) as LandingOverviewResponse
                    overviewTrack = payload.track ? normalizeRandomSong(payload.track) : null
                    triviaFromOverview = (payload.trivia || []).slice(0, 3)
                    fallbackArtists = (payload.undergroundArtists || []).slice(0, 3)
                }

                if (artistResult.status === 'fulfilled' && artistResult.value.ok) {
                    const artists = (await artistResult.value.json()) as LandingArtist[]
                    const rotatedArtists = pickDistinctItems(artists || [], artist => artist.name, 3, rotationSeed + 11)
                    if (rotatedArtists.length > 0) {
                        fallbackArtists = rotatedArtists
                    }

                    const loreArtists = pickDistinctItems(artists || [], artist => artist.name, 3, rotationSeed + 17)
                    if (loreArtists.length > 0) {
                        fallbackTrivia = loreArtists.map(buildLoreCard)
                        loreArtists.forEach(loreArtist => {
                            writeRecentValue('hiphophub:lore-recent-artists', loreArtist.name, 10)
                        })
                    }

                    nextSceneStats = [
                        { label: 'Artists', value: String(artists.length || 0) },
                        nextSceneStats[1],
                        nextSceneStats[2]
                    ]
                }

                if (songPoolResult.status === 'fulfilled' && songPoolResult.value.ok) {
                    const poolPayload = (await songPoolResult.value.json()) as LandingSongPoolItem[]
                    const songPool = (poolPayload || [])
                        .map(normalizeSongPoolTrack)
                        .filter((track): track is LandingTrack => !!track)

                    nextSceneStats = [
                        nextSceneStats[0],
                        { label: 'Playable cuts', value: String(songPool.length || 0) },
                        { label: 'Daily rotations', value: String(Math.max(fallbackArtists.length, 3)) }
                    ]
                }

                if (overviewTrack?.artistName) {
                    writeRecentValue('hiphophub:landing-track-recent-artists', overviewTrack.artistName, 8)
                }

                const finalTrack = overviewTrack
                const finalTrivia = (fallbackTrivia.length > 0 ? fallbackTrivia : triviaFromOverview).slice(0, 3)

                if (!cancelled) {
                    if (finalTrack) {
                        setSelectedTrack(finalTrack)
                    }
                    setUndergroundArtists(fallbackArtists)
                    setTriviaItems(finalTrivia)
                    setSceneControlStats(nextSceneStats)
                }

                if (finalTrack) {
                    return
                }
            } catch (err) {
                console.error('Failed to fetch landing overview:', err)
            }

            const fallbackTrack = await getLandingTrack()
            if (!cancelled) {
                setSelectedTrack(fallbackTrack)
                if (fallbackArtists.length > 0) {
                    setUndergroundArtists(fallbackArtists)
                }
                if (fallbackTrivia.length > 0) {
                    setTriviaItems(fallbackTrivia)
                }
            }
        }

        void loadLandingData()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio || !selectedTrack?.previewUrl) {
            return
        }

        let disposed = false

        const attemptPlay = async () => {
            try {
                audio.currentTime = 0
                await audio.play()
                if (!disposed) {
                    setAutoplayBlocked(false)
                }
            } catch {
                if (!disposed) {
                    setAutoplayBlocked(true)
                    setIsPlaying(false)
                }
            }
        }

        const handleFirstInteraction = () => {
            if (audio.muted) {
                audio.muted = false
                setIsMuted(false)
            }
            void attemptPlay()
        }

        const handleCanPlay = () => {
            void attemptPlay()
        }

        audio.autoplay = true
        audio.preload = 'auto'
        audio.playsInline = true
        audio.muted = true
        setIsMuted(true)
        audio.currentTime = 0
        audio.load()
        void attemptPlay()
        audio.addEventListener('canplay', handleCanPlay, { once: true })

        window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
        window.addEventListener('keydown', handleFirstInteraction, { once: true })

        return () => {
            disposed = true
            audio.removeEventListener('canplay', handleCanPlay)
            window.removeEventListener('pointerdown', handleFirstInteraction)
            window.removeEventListener('keydown', handleFirstInteraction)
        }
    }, [selectedTrack?.previewUrl])

    const heroCover = useMemo(() => selectedTrack?.coverUrl || DEFAULT_COVER, [selectedTrack?.coverUrl])
    const canPlay = !!selectedTrack?.previewUrl

    const handleTogglePlay = async () => {
        const audio = audioRef.current
        if (!audio || !canPlay) return

        if (audio.paused) {
            try {
                if (audio.muted) {
                    audio.muted = false
                    setIsMuted(false)
                }
                await audio.play()
                setAutoplayBlocked(false)
            } catch {
                setAutoplayBlocked(true)
            }
            return
        }

        audio.pause()
    }

    const toggleMute = () => {
        const audio = audioRef.current
        if (!audio) return
        const nextMuted = !audio.muted
        audio.muted = nextMuted
        setIsMuted(nextMuted)
    }

    const openYouTube = async () => {
        if (!selectedTrack?.id) return

        try {
            const res = await fetch(`/api/youtube/song/${selectedTrack.id}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url?.startsWith('https://www.youtube.com/watch?v=')) {
                    window.open(payload.url, '_blank', 'noopener,noreferrer')
                }
            }
        } catch (err) {
            console.error('Failed to resolve direct YouTube URL for landing track:', err)
        }
    }

    return (
        <div className="landing-page">
            <audio
                ref={audioRef}
                className="background-audio"
                src={selectedTrack?.previewUrl || ''}
                autoPlay
                playsInline
                preload="auto"
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                loop
            />

            <div className="landing-noise" />
            <div className="landing-beam landing-beam-left" />
            <div className="landing-beam landing-beam-right" />

            <header className="landing-nav">
                <div className="logo-block">
                    <div className="logo-mark">HipHopHub</div>
                    <span className="logo-submark">Indian hip-hop atlas</span>
                </div>
                <div className="nav-actions">
                    <button className="btn btn-secondary ghost" onClick={() => navigate('/login')}>
                        Log In
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/signup')}>
                        Join the Hub
                    </button>
                </div>
            </header>

            <section className="landing-hero">
                <div className="hero-text fade-in">
                    <div className="hero-copy-stack">
                        <h1 className="landing-logo">
                            Discover Desi hip-hop, curated.
                        </h1>
                        <p className="landing-tagline">
                            Live previews, artist universes, underground radar, and scene context — built for enthusiasts, not algorithms.
                        </p>
                    </div>

                    <div className="hero-actions">
                        <button
                            className="btn btn-primary btn-landing"
                            onClick={() => navigate('/home')}
                        >
                            Enter HipHopHub
                        </button>
                    </div>

                    <div className="scene-control-room">
                        <div className="scene-control-copy">
                            <span className="scene-control-kicker">Scene Control Room</span>
                            <p>Jump into artist profiles, latest playable cuts, and the arcade without leaving the hero.</p>
                        </div>
                        <div className="scene-control-stats">
                            {sceneControlStats.map((stat) => (
                                <div key={stat.label} className="scene-control-stat">
                                    <span>{stat.value}</span>
                                    <small>{stat.label}</small>
                                </div>
                            ))}
                        </div>
                        <div className="scene-control-actions">
                            <button type="button" className="home-chip" onClick={() => navigate('/home', { state: { activeTab: 'artists' } })}>Open artists</button>
                            <button type="button" className="home-chip" onClick={() => navigate('/home', { state: { activeTab: 'topSongs' } })}>Play top songs</button>
                            <button type="button" className="home-chip" onClick={() => navigate('/home', { state: { activeTab: 'game' } })}>Enter arcade</button>
                        </div>
                    </div>
                </div>

                <div className="hero-visual fade-in">
                    <div className="now-playing-card">
                        <div className="np-header">
                            <span className="pill small">Now playing</span>
                            <span className="pulse-dot" />
                        </div>
                        <div className="np-body">
                            <div className="np-cover-shell">
                                <div className="np-cover">
                                    <img src={heroCover} alt={selectedTrack?.title || 'HipHopHub mix'} />
                                    <div className="floating-eq" />
                                </div>
                                <div className="np-caption-row">
                                    <span>Auto-curated</span>
                                    <span>{isPlaying ? 'Live' : 'Paused'}</span>
                                </div>
                            </div>
                            <div className="np-meta">
                                <div className="np-controls">
                                    <button className="np-play" disabled={!canPlay} onClick={handleTogglePlay}>
                                        {canPlay ? (isPlaying ? '⏸ Pause' : '▶ Play') : 'No preview'}
                                    </button>
                                    <button className="np-play" disabled={!canPlay} onClick={toggleMute}>
                                        {isMuted ? '🔇' : '🔊'}
                                    </button>
                                </div>
                                <p className="np-track">{selectedTrack?.title || 'HipHopHub mix'}</p>
                                <p className="np-artist">{selectedTrack?.artistName || 'Featured artists'}</p>
                                <div className="np-divider" />
                                <div className="np-footnote-row">
                                    <span>Random cut</span>
                                    <span>{selectedTrack?.previewUrl ? 'Ready' : 'Syncing'}</span>
                                </div>
                                {selectedTrack?.id && selectedTrack?.youtubeUrl && (
                                    <button type="button" className="np-yt" onClick={openYouTube}>
                                        ▶ YouTube
                                    </button>
                                )}
                                {autoplayBlocked && (
                                    <p className="autoplay-hint">Tap Play to start.</p>
                                )}
                                {!autoplayBlocked && isPlaying && isMuted && (
                                    <p className="autoplay-hint">Playing muted. Tap 🔇 for sound.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="landing-data-grid">
                        <div className="landing-panel landing-panel-artists">
                            <div className="landing-panel-head">
                                <h3>Underground Scanner</h3>
                                <span>Daily rotation</span>
                            </div>
                            <div className="landing-list">
                                {undergroundArtists.map((artist) => (
                                    <button
                                        key={artist.id}
                                        type="button"
                                        className="landing-list-row"
                                        onClick={() => navigate('/home')}
                                    >
                                        <span className="landing-rank">{artist.name.charAt(0)}</span>
                                        <span className="landing-copy">
                                            <strong>{artist.name}</strong>
                                            <small>{getBioSnapshot(artist.bio)}</small>
                                        </span>
                                    </button>
                                ))}
                                {undergroundArtists.length === 0 && (
                                    <div className="landing-empty">Artist radar syncing.</div>
                                )}
                            </div>
                        </div>

                        <div className="landing-panel landing-panel-trivia">
                            <div className="landing-panel-head">
                                <h3>Lyric + Lore</h3>
                                <span>Scene cards</span>
                            </div>
                            {triviaItems.length > 0 ? (
                                <div className="landing-list">
                                    {triviaItems.map((item, index) => (
                                        <div key={`${item.lead}-${index}`} className="landing-list-row landing-list-row-static">
                                            <span className="landing-rank">{item.lead.charAt(0)}</span>
                                            <span className="landing-copy">
                                                <strong>{item.lead}</strong>
                                                <small>{item.body}</small>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="landing-empty">Trivia syncing.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="marquee" aria-label="HipHopHub capabilities">
                <div className="marquee-track">
                    {[...marqueeItems, ...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, idx) => (
                        <span key={idx} className="chip">{item}</span>
                    ))}
                </div>
            </section>
        </div>
    )
}
