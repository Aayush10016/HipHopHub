import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

const marqueeItems = [
    'AI hip-hop news wire',
    'Upcoming drops radar',
    '8-tab artist universes',
    'Guess-the-track game',
    'Tour & ticket alerts',
    'Lyric + lore trivia'
]

const vibeTiles = [
    { title: 'Desi Heat Check', desc: 'Today s top 5 tracks + snippets', accent: 'lime' },
    { title: 'Underground Scanner', desc: 'Spotlight on next-up MCs', accent: 'cyan' },
    { title: 'Beef Alert', desc: 'Instant updates on rap conversations', accent: 'amber' }
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
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        let cancelled = false

        getLandingTrack().then(track => {
            if (!cancelled) {
                setSelectedTrack(track)
            }
        })

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

        audio.muted = true
        setIsMuted(true)
        audio.currentTime = 0
        audio.load()
        void attemptPlay()

        window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
        window.addEventListener('keydown', handleFirstInteraction, { once: true })

        return () => {
            disposed = true
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
                        <button className="btn btn-secondary ghost" onClick={() => navigate('/home')}>
                            View live prototype
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

                    <div className="vibe-stack">
                        {vibeTiles.map(tile => (
                            <div key={tile.title} className={`vibe-card ${tile.accent}`}>
                                <div className="vibe-title">{tile.title}</div>
                                <div className="vibe-desc">{tile.desc}</div>
                            </div>
                        ))}
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
