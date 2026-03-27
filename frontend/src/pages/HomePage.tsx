import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import GameComponent from '../components/GameComponent'
import AINewsFeed from '../components/AINewsFeed'
import CompleteLyricGame from '../components/CompleteLyricGame'
import ArcadeLeaderboard from '../components/ArcadeLeaderboard'
import ArtistBlitzGame from '../components/ArtistBlitzGame'
import SceneDecoderGame from '../components/SceneDecoderGame'
import CoverShuffleGame from '../components/CoverShuffleGame'
import './HomePage.css'

interface Song {
    id: number
    title: string
    previewUrl?: string
    artistName?: string
    coverUrl?: string
    youtubeUrl?: string
    album?: {
        title: string
        coverImageUrl?: string
        coverUrl?: string
        youtubeUrl?: string
        artist?: {
            name: string
        }
    }
}

interface Artist {
    id: number
    name: string
    imageUrl?: string
    monthlyListeners?: number
    genre?: string
    bio?: string
}

interface Album {
    id: number
    title: string
    releaseDate?: string
    coverImageUrl?: string
    coverUrl?: string
    youtubeUrl?: string
    artist?: {
        name: string
    }
}

interface SongOfDayResponse {
    song?: {
        id?: number
        title?: string
        previewUrl?: string
        album?: string
        artist?: string
        coverUrl?: string
        youtubeUrl?: string
    }
}

interface NewsStory {
    id: string
    title: string
    summary: string
    tag: string
    category: string
    time: string
    source?: string
}

const isValidDate = (date?: string) => {
    if (!date) return false
    return !Number.isNaN(new Date(date).getTime())
}

const formatDate = (date?: string) => {
    if (!isValidDate(date)) return 'Date unavailable'
    return new Date(date as string).toLocaleDateString()
}

const toYouTubeSearch = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`

const mapSongOfDayResponse = (payload: SongOfDayResponse): Song | null => {
    const source = payload?.song
    if (!source?.id || !source?.title) return null
    return {
        id: source.id,
        title: source.title,
        previewUrl: source.previewUrl,
        youtubeUrl: source.youtubeUrl,
        artistName: source.artist,
        coverUrl: source.coverUrl,
        album: {
            title: source.album || 'Unknown Album',
            coverUrl: source.coverUrl,
            artist: {
                name: source.artist || 'Unknown Artist'
            }
        }
    }
}

export default function HomePage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('songOfDay')
    const [searchQuery, setSearchQuery] = useState('')
    const [songOfDay, setSongOfDay] = useState<Song | null>(null)
    const [top5OfDay, setTop5OfDay] = useState<Song[]>([])
    const [topSongs, setTopSongs] = useState<Song[]>([])
    const [recentReleases, setRecentReleases] = useState<Album[]>([])
    const [upcomingReleases, setUpcomingReleases] = useState<Album[]>([])
    const [releaseRadar, setReleaseRadar] = useState<NewsStory[]>([])
    const [artists, setArtists] = useState<Artist[]>([])
    const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null)
    const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSongPlaying, setIsSongPlaying] = useState(false)
    const [topSongPlayingId, setTopSongPlayingId] = useState<number | null>(null)
    const [topSongCurrentTime, setTopSongCurrentTime] = useState<Record<number, number>>({})
    const [artistImageErrorMap, setArtistImageErrorMap] = useState<Record<number, boolean>>({})
    const [selectedGame, setSelectedGame] = useState<'guess' | 'rapid' | 'lyric' | 'blitz' | 'decoder' | 'cover'>('guess')

    useEffect(() => {
        let isMounted = true

        const fetchSongOfDay = async () => {
            try {
                const res = await fetch('/api/songs/song-of-day')
                if (res.ok) {
                    const data = await res.json()
                    if (data?.id && data?.previewUrl) {
                        return data as Song
                    }
                }
            } catch (err) {
                console.error('Fallback fetch failed for /api/songs/random/dhh:', err)
            }

            return null
        }

        const loadData = async () => {
            try {
                const results = await Promise.allSettled([
                    fetchSongOfDay(),
                    fetch('/api/artists?scope=dhh'),
                    fetch('/api/albums/latest?scope=dhh'),
                    fetch('/api/albums/upcoming?scope=dhh'),
                    fetch('/api/songs/top/dhh?days=30&limit=30'),
                    fetch('/api/songs/top5-of-day')
                ])

                if (!isMounted) return

                const [songResult, artistsResult, latestResult, upcomingResult, topSongsResult, top5Result] = results

                if (songResult.status === 'fulfilled') {
                    setSongOfDay(songResult.value)
                }

                if (artistsResult.status === 'fulfilled' && artistsResult.value.ok) {
                    const artistData = await artistsResult.value.json()
                    if (isMounted) setArtists(artistData || [])
                } else if (artistsResult.status === 'rejected') {
                    setArtists([])
                }

                if (latestResult.status === 'fulfilled' && latestResult.value.ok) {
                    const latestData = await latestResult.value.json()
                    if (isMounted) setRecentReleases(latestData || [])
                } else if (latestResult.status === 'rejected') {
                    setRecentReleases([])
                }

                if (upcomingResult.status === 'fulfilled' && upcomingResult.value.ok) {
                    const upcomingData = await upcomingResult.value.json()
                    if (isMounted) setUpcomingReleases(upcomingData || [])
                } else if (upcomingResult.status === 'rejected') {
                    setUpcomingReleases([])
                }

                if (topSongsResult.status === 'fulfilled' && topSongsResult.value.ok) {
                    const songs = (await topSongsResult.value.json()) as Song[]
                    const withPreviews = (songs || []).filter(song => !!song.previewUrl)
                    if (isMounted) setTopSongs(withPreviews)
                } else if (topSongsResult.status === 'rejected') {
                    setTopSongs([])
                }

                if (top5Result.status === 'fulfilled' && top5Result.value.ok) {
                    const songs5 = (await top5Result.value.json()) as Song[]
                    if (isMounted) setTop5OfDay(songs5 || [])
                } else if (top5Result.status === 'rejected') {
                    setTop5OfDay([])
                }

            } catch (err) {
                console.error('Failed to load home page data:', err)
                if (!isMounted) return
                setSongOfDay(null)
                setArtists([])
                setRecentReleases([])
                setUpcomingReleases([])
                setTopSongs([])
                setReleaseRadar([])
            } finally {
                if (!isMounted) return
                setLoading(false)
            }
        }

        loadData()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        fetch('/api/game/random-song', { signal: controller.signal }).catch(() => undefined)
        return () => controller.abort()
    }, [])

    useEffect(() => {
        if (activeTab !== 'upcoming' || upcomingReleases.length > 0 || releaseRadar.length > 0) {
            return
        }

        let cancelled = false

        fetch('/api/ai-news')
            .then(res => res.ok ? res.json() : null)
            .then(payload => {
                if (cancelled || !payload) return
                const stories = (payload?.stories || []) as NewsStory[]
                setReleaseRadar(
                    stories
                        .filter(story => story.category === 'Releases')
                        .filter(story => story.time.toLowerCase().startsWith('in ')
                            || /upcoming|soon|announce|tease|expected/i.test(`${story.title} ${story.summary}`))
                        .slice(0, 6)
                )
            })
            .catch(err => {
                console.error('Failed to load release radar fallback:', err)
            })

        return () => {
            cancelled = true
        }
    }, [activeTab, upcomingReleases.length, releaseRadar.length])

    useEffect(() => {
        setIsSongPlaying(false)
    }, [songOfDay?.id])

    useEffect(() => {
        setTopSongPlayingId(null)
        setTopSongCurrentTime({})
    }, [topSongs])

    const filteredArtists = useMemo(() => {
        const uniqueByName = Array.from(
            new Map(artists.map(artist => [artist.name.toLowerCase(), artist])).values()
        )
        return uniqueByName.filter(artist =>
            artist.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [artists, searchQuery])

    const resolveSongCover = (song: Song | null) => {
        if (!song) return undefined
        return song.coverUrl || song.album?.coverImageUrl || song.album?.coverUrl
    }

    const resolveSongArtist = (song: Song | null) => {
        if (!song) return 'Unknown Artist'
        return song.artistName || song.album?.artist?.name || 'Unknown Artist'
    }

    const formatPreviewClock = (seconds: number) => {
        const safe = Math.max(0, Math.min(30, Math.floor(seconds)))
        return `0:${String(safe).padStart(2, '0')}`
    }

    const openDirectSongYoutube = async (song: Song | null) => {
        if (!song) return

        let targetUrl = song.youtubeUrl || toYouTubeSearch(`${resolveSongArtist(song)} ${song.title} official audio`)

        try {
            const res = await fetch(`/api/youtube/song/${song.id}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url) {
                    targetUrl = payload.url
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for song ${song.id}:`, err)
        }

        window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }

    const openDirectAlbumYoutube = async (album: Album) => {
        let targetUrl = album.youtubeUrl || toYouTubeSearch(`${album.artist?.name || ''} ${album.title} full album`)

        try {
            const res = await fetch(`/api/youtube/album/${album.id}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url) {
                    targetUrl = payload.url
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for album ${album.id}:`, err)
        }

        window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }

    const toggleTopSongPreview = async (song: Song) => {
        if (!song.previewUrl) return

        const currentAudio = document.getElementById(`top-song-preview-${song.id}`) as HTMLAudioElement | null
        if (!currentAudio) return

        if (topSongPlayingId !== null && topSongPlayingId !== song.id) {
            const previous = document.getElementById(`top-song-preview-${topSongPlayingId}`) as HTMLAudioElement | null
            if (previous) {
                previous.pause()
                previous.currentTime = 0
            }
        }

        if (topSongPlayingId === song.id && !currentAudio.paused) {
            currentAudio.pause()
            setTopSongPlayingId(null)
            return
        }

        try {
            await currentAudio.play()
            setTopSongPlayingId(song.id)
        } catch (err) {
            console.error(`Failed to play top song preview ${song.id}:`, err)
        }
    }

    const handleArtistClick = (artist: Artist) => {
        setSelectedArtistId(artist.id)
        setSelectedArtist(artist)
        setActiveTab('artistProfile')
    }

    const handleSearchKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && filteredArtists.length > 0) {
            handleArtistClick(filteredArtists[0])
        }
    }

    return (
        <div className="home-page">
            <header className="home-header">
                <div className="header-container">
                    <div className="brand-block">
                        <h1 className="header-logo">HipHopHub</h1>
                    </div>

                    <div className="header-center">
                        <input
                            type="text"
                            className="search-bar"
                            placeholder="Search artists or jump to a profile..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyPress}
                        />
                    </div>

                    <div className="header-actions">
                        <button className="btn btn-small btn-secondary" onClick={() => navigate('/login')}>Log In</button>
                        <button className="btn btn-small btn-primary" onClick={() => navigate('/signup')}>Sign Up</button>
                    </div>
                </div>
            </header>

            <div className="tabs-container">
                <div className="tabs">
                    <button className={`tab ${activeTab === 'songOfDay' ? 'active' : ''}`} onClick={() => setActiveTab('songOfDay')}>
                        Spotlight
                    </button>
                    <button className={`tab ${activeTab === 'topSongs' ? 'active' : ''}`} onClick={() => setActiveTab('topSongs')}>
                        Top Songs
                    </button>
                    <button className={`tab ${activeTab === 'recentReleases' ? 'active' : ''}`} onClick={() => setActiveTab('recentReleases')}>
                        Recent
                    </button>
                    <button className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`} onClick={() => setActiveTab('upcoming')}>
                        Upcoming
                    </button>
                    <button className={`tab ${activeTab === 'artists' ? 'active' : ''}`} onClick={() => setActiveTab('artists')}>
                        Artists
                    </button>
                    <button className={`tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>
                        News / AI
                    </button>
                    <button className={`tab ${activeTab === 'game' ? 'active' : ''}`} onClick={() => setActiveTab('game')}>
                        Play
                    </button>
                    {selectedArtistId && (
                        <button className={`tab ${activeTab === 'artistProfile' ? 'active' : ''}`} onClick={() => setActiveTab('artistProfile')}>
                            Artist Profile
                        </button>
                    )}
                </div>
            </div>

            <main className="home-content">
                <div className="container">
                    {activeTab === 'songOfDay' && (
                        <div className="song-of-day-section fade-in">
                            <div className="section-header">
                                <h2 className="section-title">Song of the Day</h2>
                                <span className="pill small">30s preview</span>
                            </div>
                            {songOfDay ? (
                                <div className="spotlight-layout">
                                    <div className="song-of-day-card card">
                                        <div className="song-cover">
                                            {resolveSongCover(songOfDay) ? (
                                                <img src={resolveSongCover(songOfDay)} alt={songOfDay.title} />
                                            ) : (
                                                <div className="song-cover-placeholder">No cover</div>
                                            )}
                                        </div>
                                        <div className="song-info">
                                            <h3 className="song-title">{songOfDay.title}</h3>
                                            <p className="song-artist">{resolveSongArtist(songOfDay)}</p>
                                            <p className="song-album">{songOfDay.album?.title || 'Unknown Album'}</p>
                                            {songOfDay.previewUrl ? (
                                                <div className="song-player-controls">
                                                    <button className="big-play" onClick={() => {
                                                        const audioEl = document.getElementById('song-of-day-player') as HTMLAudioElement | null
                                                        if (audioEl) {
                                                            audioEl.paused ? audioEl.play() : audioEl.pause()
                                                        }
                                                    }}>
                                                        {isSongPlaying ? 'Pause' : 'Play'}
                                                    </button>
                                                    <div className="player-bar">
                                                        <div className="player-progress">
                                                            <div className="player-progress-fill" />
                                                        </div>
                                                        <div className="player-meta">
                                                            <span>Preview</span>
                                                            <span>0:30</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => openDirectSongYoutube(songOfDay)}
                                                        className="yt-link-btn"
                                                    >
                                                        Play on YT
                                                    </button>
                                                    <audio
                                                        id="song-of-day-player"
                                                        src={songOfDay.previewUrl}
                                                        preload="none"
                                                        onPlay={() => setIsSongPlaying(true)}
                                                        onPause={() => setIsSongPlaying(false)}
                                                        onEnded={() => setIsSongPlaying(false)}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="preview-unavailable">Preview unavailable</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="spotlight-rail card">
                                        <div className="spotlight-rail-head">
                                            <h3>Today&apos;s Top 5</h3>
                                            <span>Fresh picks</span>
                                        </div>
                                        <div className="spotlight-list">
                                            {top5OfDay.map((song, index) => (
                                                <button
                                                    key={song.id}
                                                    type="button"
                                                    className="spotlight-row"
                                                    onClick={() => openDirectSongYoutube(song)}
                                                >
                                                    <span className="spotlight-rank">0{index + 1}</span>
                                                    <span className="spotlight-copy">
                                                        <strong>{song.title}</strong>
                                                        <small>{resolveSongArtist(song)}</small>
                                                    </span>
                                                </button>
                                            ))}
                                            {top5OfDay.length === 0 && (
                                                <div className="spotlight-empty">Top songs are still syncing.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading spotlight...' : 'No playable Song of the Day is available yet.'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'topSongs' && (
                        <div className="top-songs-section fade-in">
                            <div className="section-header">
                                <h2 className="section-title">Top DHH Songs</h2>
                                <p className="section-sub">Recent playable DHH cuts, prioritized by the last 30 days</p>
                            </div>
                            {topSongs.length > 0 ? (
                                <div className="songs-grid">
                                    {topSongs.map((song) => {
                                        const cover = resolveSongCover(song)
                                        return (
                                            <div key={song.id} className="song-card card">
                                                <div className="song-card-top">
                                                    <h4>{song.title}</h4>
                                                    <p>{resolveSongArtist(song)}</p>
                                                </div>
                                                <div className="song-card-media">
                                                    {cover && <img className="song-thumb" src={cover} alt={song.title} />}
                                                    {song.previewUrl ? (
                                                        <div className="top-song-player">
                                                            <div className="top-song-controls">
                                                                <button
                                                                    type="button"
                                                                    className="top-song-play-btn"
                                                                    onClick={() => toggleTopSongPreview(song)}
                                                                >
                                                                    {topSongPlayingId === song.id ? 'Pause' : 'Play'}
                                                                </button>
                                                                <div className="top-song-progress-wrap">
                                                                    <div className="top-song-progress-track">
                                                                        <div
                                                                            className="top-song-progress-fill"
                                                                            style={{
                                                                                width: `${Math.min(100, ((topSongCurrentTime[song.id] || 0) / 30) * 100)}%`
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="top-song-time">
                                                                        <span>{formatPreviewClock(topSongCurrentTime[song.id] || 0)}</span>
                                                                        <span>0:30</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <audio
                                                                id={`top-song-preview-${song.id}`}
                                                                preload="none"
                                                                src={song.previewUrl}
                                                                className="song-preview"
                                                                onTimeUpdate={(e) => {
                                                                    const next = Math.min(30, (e.currentTarget as HTMLAudioElement).currentTime)
                                                                    setTopSongCurrentTime(prev => ({ ...prev, [song.id]: next }))
                                                                }}
                                                                onPlay={() => setTopSongPlayingId(song.id)}
                                                                onPause={() => setTopSongPlayingId(prev => (prev === song.id ? null : prev))}
                                                                onEnded={() => setTopSongPlayingId(prev => (prev === song.id ? null : prev))}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="preview-unavailable">Preview unavailable</span>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => openDirectSongYoutube(song)}
                                                    className="yt-link-btn"
                                                >
                                                    Play on YT
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading top songs...' : 'No DHH songs found for the last 30 days.'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'recentReleases' && (
                        <div className="recent-releases-section fade-in">
                            <div className="section-header">
                                <h2 className="section-title">Recent Releases</h2>
                                <p className="section-sub">Last 30 days</p>
                            </div>
                            {recentReleases.length > 0 ? (
                                <div className="releases-grid">
                                    {recentReleases.map((album) => (
                                        <div key={album.id} className="album-card card">
                                            <div className="album-cover">
                                                {album.coverImageUrl || album.coverUrl ? (
                                                    <img src={album.coverImageUrl || album.coverUrl} alt={album.title} />
                                                ) : (
                                                    <div className="album-cover-placeholder">No cover</div>
                                                )}
                                            </div>
                                            <h4>{album.title}</h4>
                                            <p>{album.artist?.name}</p>
                                            <p className="release-date">{formatDate(album.releaseDate)}</p>
                                            <button
                                                type="button"
                                                onClick={() => openDirectAlbumYoutube(album)}
                                                className="yt-link-btn"
                                            >
                                                Play on YT
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading recent releases...' : 'No DHH releases in the last 30 days.'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'upcoming' && (
                        <div className="recent-releases-section fade-in">
                            <div className="section-header">
                                <h2 className="section-title">Upcoming Albums</h2>
                                <span className="pill small">AI radar</span>
                            </div>
                            {upcomingReleases.length > 0 ? (
                                <div className="releases-grid">
                                    {upcomingReleases.map(album => (
                                        <div key={album.id} className="album-card card">
                                            <div className="album-cover">
                                                {album.coverImageUrl || album.coverUrl ? (
                                                    <img src={album.coverImageUrl || album.coverUrl} alt={album.title} />
                                                ) : (
                                                    <div className="album-cover-placeholder">No cover</div>
                                                )}
                                            </div>
                                            <h4>{album.title}</h4>
                                            <p>{album.artist?.name}</p>
                                            <p className="release-date">{formatDate(album.releaseDate)}</p>
                                            <button
                                                type="button"
                                                onClick={() => openDirectAlbumYoutube(album)}
                                                className="yt-link-btn"
                                            >
                                                Play on YT
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : releaseRadar.length > 0 ? (
                                <div className="releases-grid">
                                    {releaseRadar.map((story) => (
                                        <div key={story.id} className="album-card card">
                                            <div className="album-cover album-cover-placeholder">News</div>
                                            <h4>{story.title}</h4>
                                            <p>{story.tag}</p>
                                            <p className="release-date">{story.time}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading upcoming releases...' : 'No upcoming DHH albums are available yet.'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'artists' && (
                        <div className="artists-section fade-in">
                            <div className="section-header">
                                <h2 className="section-title">Featured Artists</h2>
                                <p className="section-sub">Tap to open 8-tab profiles</p>
                            </div>
                            {filteredArtists.length > 0 ? (
                                <div className="artists-grid">
                                    {filteredArtists.map((artist) => (
                                        <div
                                            key={artist.id}
                                            className="artist-card card"
                                            onClick={() => handleArtistClick(artist)}
                                        >
                                            <div className="artist-image">
                                                {artist.imageUrl && !artistImageErrorMap[artist.id] ? (
                                                    <img
                                                        src={`/api/images/artist/${artist.id}`}
                                                        alt={artist.name}
                                                        onError={() => setArtistImageErrorMap(prev => ({ ...prev, [artist.id]: true }))}
                                                    />
                                                ) : (
                                                    <div className="artist-initial">{artist.name.charAt(0)}</div>
                                                )}
                                            </div>
                                            <h3>{artist.name}</h3>
                                            <p className="listeners">{artist.genre || 'Artist'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading artists...' : 'No artists available yet'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'news' && (
                        <AINewsFeed />
                    )}

                    {activeTab === 'game' && (
                        <div className="game-section fade-in">
                            <div className="section-header">
                                <div>
                                    <h2 className="section-title">Play</h2>
                                    <p className="game-description">Three game slots for replayable DHH sessions. The first two are live now.</p>
                                </div>
                            </div>

                            <div className="game-hub-grid">
                                <button
                                    type="button"
                                    className={`game-mode-card card ${selectedGame === 'guess' ? 'active' : ''}`}
                                    onClick={() => setSelectedGame('guess')}
                                >
                                    <span className="game-mode-kicker">Live now</span>
                                    <h3>Guess The Track</h3>
                                    <p>Listen to the preview, name the song, and post leaderboard points.</p>
                                </button>
                                <button
                                    type="button"
                                    className={`game-mode-card card ${selectedGame === 'rapid' ? 'active' : ''}`}
                                    onClick={() => setSelectedGame('rapid')}
                                >
                                    <span className="game-mode-kicker">Live now</span>
                                    <h3>Rapid Fire</h3>
                                    <p>Locked 10-second runs, no pause control, lives, combos, and auto-next pressure.</p>
                                </button>
                                <button
                                    type="button"
                                    className={`game-mode-card card ${selectedGame === 'lyric' ? 'active' : ''}`}
                                    onClick={() => setSelectedGame('lyric')}
                                >
                                    <span className="game-mode-kicker">Beta live</span>
                                    <h3>Complete The Lyric</h3>
                                    <p>Hook-card challenge mode with artist and song hints plus lower-score assist.</p>
                                </button>
                                <button
                                    type="button"
                                    className={`game-mode-card card ${selectedGame === 'blitz' ? 'active' : ''}`}
                                    onClick={() => setSelectedGame('blitz')}
                                >
                                    <span className="game-mode-kicker">Live now</span>
                                    <h3>Artist Blitz</h3>
                                    <p>Timed multiple-choice rounds based on title recognition and cover-reading speed.</p>
                                </button>
                                <button
                                    type="button"
                                    className={`game-mode-card card ${selectedGame === 'decoder' ? 'active' : ''}`}
                                    onClick={() => setSelectedGame('decoder')}
                                >
                                    <span className="game-mode-kicker">Live now</span>
                                    <h3>Scene Decoder</h3>
                                    <p>Artist-city knowledge sprint built for people who actually know the culture map.</p>
                                </button>
                                <button
                                    type="button"
                                    className={`game-mode-card card ${selectedGame === 'cover' ? 'active' : ''}`}
                                    onClick={() => setSelectedGame('cover')}
                                >
                                    <span className="game-mode-kicker">Live now</span>
                                    <h3>Cover Shuffle</h3>
                                    <p>Cover recognition race where you pick the right title before the minute ends.</p>
                                </button>
                            </div>

                            {selectedGame === 'lyric' ? (
                                <>
                                    <CompleteLyricGame />
                                    <ArcadeLeaderboard mode="COMPLETE_THE_LYRIC" title="Lyric Mode Leaderboard" />
                                </>
                            ) : selectedGame === 'blitz' ? (
                                <ArtistBlitzGame />
                            ) : selectedGame === 'decoder' ? (
                                <SceneDecoderGame />
                            ) : selectedGame === 'cover' ? (
                                <CoverShuffleGame />
                            ) : (
                                <>
                                    <p className="game-description">
                                        {selectedGame === 'guess'
                                            ? 'Guess the artist from a 30-second preview and climb the leaderboard.'
                                            : 'Rapid Fire now runs as a short-lock arcade mode with 10-second audio windows and no pause escape.'}
                                    </p>
                                    <GameComponent mode="global" variant={selectedGame === 'rapid' ? 'rapid' : 'guess'} />
                                    {selectedGame === 'rapid' && (
                                        <ArcadeLeaderboard mode="RAPID_FIRE" title="Rapid Fire Leaderboard" />
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'artistProfile' && selectedArtistId && (
                        <div className="artist-profile-section fade-in">
                            <ArtistProfile
                                artistId={selectedArtistId}
                                initialArtist={selectedArtist || undefined}
                                onBack={() => { setSelectedArtistId(null); setSelectedArtist(null); setActiveTab('artists') }}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
