import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

interface LandingOverviewResponse {
    track?: RandomSongResponse
    undergroundArtists?: LandingArtist[]
    trivia?: LandingTriviaItem[]
}

let cachedLandingTrack: LandingTrack | null = null
let pendingLandingTrackPromise: Promise<LandingTrack | null> | null = null

const toYoutubeSearch = (query: string) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`

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
        youtubeUrl: song.youtubeUrl || toYoutubeSearch(`${artistName} ${song.title} official audio`)
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
        youtubeUrl: toYoutubeSearch(`${artistName} ${fallback.songName} official audio`)
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

export default function LandingPage() {
    const navigate = useNavigate()
    const [selectedTrack, setSelectedTrack] = useState<LandingTrack | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [autoplayBlocked, setAutoplayBlocked] = useState(false)
    const [isMuted, setIsMuted] = useState(true)
    const [undergroundArtists, setUndergroundArtists] = useState<LandingArtist[]>([])
    const [triviaItems, setTriviaItems] = useState<LandingTriviaItem[]>([])
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        let cancelled = false

        const loadLandingData = async () => {
            try {
                const overviewRes = await fetch('/api/landing/overview')
                if (overviewRes.ok) {
                    const payload = (await overviewRes.json()) as LandingOverviewResponse
                    const overviewTrack = payload.track ? normalizeRandomSong(payload.track) : null
                    if (!cancelled && overviewTrack) {
                        setSelectedTrack(overviewTrack)
                    }
                    if (!cancelled) {
                        setUndergroundArtists((payload.undergroundArtists || []).slice(0, 3))
                        setTriviaItems((payload.trivia || []).slice(0, 1))
                    }
                    if (overviewTrack) {
                        return
                    }
                }
            } catch (err) {
                console.error('Failed to fetch landing overview:', err)
            }

            const fallbackTrack = await getLandingTrack()
            if (!cancelled) {
                setSelectedTrack(fallbackTrack)
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

    const heroCover = useMemo(() => {
        return selectedTrack?.coverUrl || DEFAULT_COVER
    }, [selectedTrack?.coverUrl])

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
        if (!selectedTrack) return
        let targetUrl = selectedTrack.youtubeUrl || toYoutubeSearch(`${selectedTrack.artistName} ${selectedTrack.title} official audio`)

        if (selectedTrack.id) {
            try {
                const res = await fetch(`/api/youtube/song/${selectedTrack.id}`)
                if (res.ok) {
                    const payload = await res.json()
                    if (payload?.url) {
                        targetUrl = payload.url
                    }
                }
            } catch (err) {
                console.error('Failed to resolve direct YouTube URL for landing track:', err)
            }
        }

        window.open(targetUrl, '_blank', 'noopener,noreferrer')
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

            <div className="grid-overlay" />
            <div className="orb orb-left" />
            <div className="orb orb-right" />

            <header className="landing-nav">
                <div className="logo-mark">HipHopHub</div>
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
                <div className="hero-text">
                    <div className="pill">Desi Hip-Hop OS   Real-time drops   Games</div>
                    <h1 className="landing-logo glow">
                        Pulse, news, and games for hip-hop enthusiasts.
                    </h1>
                    <p className="landing-tagline">
                        Explore HipHopHub   a responsive music hub for tracks, tours,
                        games, artist universes, upcoming albums, and live news.
                    </p>

                    <div className="hero-actions">
                        <button
                            className="btn btn-primary btn-landing"
                            onClick={() => navigate('/home')}
                        >
                            Enter HipHopHub
                        </button>
                    </div>

                    <div className="hero-stats">
                        <div className="stat">
                            <span className="stat-number">8</span>
                            <span className="stat-label">Artist universes</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">30s</span>
                            <span className="stat-label">Guess-the-track game</span>
                        </div>
                        <div className="stat">
                            <span className="stat-number">Live</span>
                            <span className="stat-label">AI hip-hop news wire</span>
                        </div>
                    </div>
                </div>

                <div className="hero-visual">
                    <div className="now-playing-card">
                        <div className="np-header">
                            <span className="pill small">Now playing</span>
                            <span className="pulse-dot" />
                        </div>
                        <div className="np-body">
                            <div className="np-cover">
                                <img src={heroCover} alt={selectedTrack?.title || 'HipHopHub mix'} />
                                <div className="floating-eq" />
                            </div>
                            <div className="np-meta">
                                <div className="np-controls">
                                    <button className="np-play" disabled={!canPlay} onClick={handleTogglePlay}>
                                    {canPlay ? (isPlaying ? 'Pause' : 'Play') : 'No preview'}
                                    </button>
                                    <button className="np-play" disabled={!canPlay} onClick={toggleMute}>
                                        {isMuted ? 'Unmute' : 'Mute'}
                                    </button>
                                </div>
                                <p className="np-track">{selectedTrack?.title || 'HipHopHub mix'}</p>
                                <p className="np-artist">{selectedTrack?.artistName || 'Featured artists'}</p>
                                <p className="np-album">{selectedTrack?.albumTitle || 'Fresh drops + classics'}</p>
                                {selectedTrack?.youtubeUrl && (
                                    <button type="button" className="np-yt" onClick={openYouTube}>
                                        Play on YT
                                    </button>
                                )}
                                {autoplayBlocked && (
                                    <p className="autoplay-hint">Autoplay was blocked by browser. Tap Play once.</p>
                                )}
                                {!autoplayBlocked && isPlaying && isMuted && (
                                    <p className="autoplay-hint">Autoplay started muted. Tap Unmute for sound.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="landing-data-grid">
                        <div className="landing-panel">
                            <div className="landing-panel-head">
                                <h3>Underground Scanner</h3>
                                <span>Daily rotation of next-up artists</span>
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
                                            <small>{((artist.monthlyListeners || 0) / 1000).toFixed(0)}K listeners</small>
                                            {artist.bio && (
                                                <small>{`${artist.bio.split('.')[0].slice(0, 72)}${artist.bio.split('.')[0].length > 72 ? '...' : ''}`}</small>
                                            )}
                                        </span>
                                    </button>
                                ))}
                                {undergroundArtists.length === 0 && (
                                    <div className="landing-empty">Artist radar is syncing.</div>
                                )}
                            </div>
                        </div>

                        <div className="landing-panel">
                            <div className="landing-panel-head">
                                <h3>Lyric + Lore Trivia</h3>
                                <span>One daily scene card</span>
                            </div>
                            <div className="trivia-list">
                                {triviaItems.map((item) => (
                                    <div key={`${item.title}-${item.lead}`} className="trivia-item">
                                        <strong>{item.title}</strong>
                                        <span>{item.lead}</span>
                                        <p>{item.body}</p>
                                    </div>
                                ))}
                                {triviaItems.length === 0 && (
                                    <div className="landing-empty">Trivia cards are syncing.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="marquee">
                <div className="marquee-track">
                    {marqueeItems.concat(marqueeItems).map((item, idx) => (
                        <span key={idx} className="chip">{item}</span>
                    ))}
                </div>
            </section>
        </div>
    )
}
