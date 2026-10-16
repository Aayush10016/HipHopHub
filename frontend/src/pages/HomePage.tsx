import PlaybackMeter from '../components/PlaybackMeter'
import ListeningLinks from '../components/ListeningLinks'
import { artistPortrait } from '../utils/portraits'
import { uniqueReleases } from '../utils/releases'
import Artwork from '../components/Artwork'
import { request } from '../utils/request'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import AINewsFeed from '../components/AINewsFeed'
import ArcadeSection from '../components/ArcadeSection'
import { hashString, pickLeastRecent, readRecentValues, writeRecentValue } from '../utils/rotation'
import { useAuth } from '../context/AuthContext'
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
    type?: string
    albumType?: string
    sourceUrl?: string
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
    return new Date(date as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const getSongArtistName = (song: Song | null | undefined) => {
    if (!song) return 'Unknown Artist'
    return song.artistName || song.album?.artist?.name || 'Unknown Artist'
}

const getArtistExcerpt = (bio?: string) => {
    if (!bio) return 'Catalog profile and scene context inside.'
    const firstLine = bio.split('.')[0]?.trim() || bio.trim()
    return `${firstLine}${firstLine.endsWith('.') ? '' : '.'}`
}

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
    const location = useLocation()
    const { user, logout } = useAuth()
    const [activeTab, setActiveTab] = useState('songOfDay')
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearchDropdown, setShowSearchDropdown] = useState(false)
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
    const [dataError, setDataError] = useState(false)
    const [previewTime, setPreviewTime] = useState(0)
    const [isSongPlaying, setIsSongPlaying] = useState(false)
    const [topSongPlayingId, setTopSongPlayingId] = useState<number | null>(null)
    const [topSongCurrentTime, setTopSongCurrentTime] = useState<Record<number, number>>({})
    const [artistImageErrorMap, setArtistImageErrorMap] = useState<Record<number, boolean>>({})

    useEffect(() => {
        let isMounted = true

        const fetchSongOfDay = async () => {
            try {
                const res = await request('/api/songs/song-of-day')
                if (res.ok) {
                    const data = await res.json()
                    if (data?.id && data?.previewUrl) {
                        return data as Song
                    }
                    return mapSongOfDayResponse(data)
                }
            } catch (err) {
                console.error('Fallback fetch failed for /api/songs/random/dhh:', err)
            }

            return null
        }

        const loadData = async () => {
            try {
                const rotationSeed = hashString(new Date().toDateString())
                const results = await Promise.allSettled([
                    fetchSongOfDay().then(song => { if (isMounted && song) setSongOfDay(song); return song }),
                    request('/api/artists?scope=dhh').then(async res => { if (!res.ok) throw new Error('Catalog unavailable'); const data = await res.clone().json(); if (isMounted) setArtists(data || []); return res }),
                    request('/api/albums/latest?scope=dhh'),
                    request('/api/albums/upcoming?scope=dhh'),
                    request('/api/songs/top/dhh?days=30&limit=30'),
                    request('/api/songs/top5-of-day')
                ])

                if (!isMounted) return

                const [songResult, artistsResult, latestResult, upcomingResult, topSongsResult, top5Result] = results
                let nextSongOfDay: Song | null = songResult.status === 'fulfilled' ? songResult.value : null
                let loadedTopSongs: Song[] = []

                if (artistsResult.status === 'fulfilled' && artistsResult.value.ok) {
                    const artistData = await artistsResult.value.json()
                    if (isMounted) setArtists(artistData?.length > 0 ? artistData : [])
                } else if (artistsResult.status === 'rejected') {
                    setArtists([]); setDataError(true)
                }

                if (latestResult.status === 'fulfilled' && latestResult.value.ok) {
                    const latestData = await latestResult.value.json()
                    if (isMounted) setRecentReleases(uniqueReleases(latestData || []))
                } else if (latestResult.status === 'rejected') {
                    setRecentReleases([])
                }

                if (upcomingResult.status === 'fulfilled' && upcomingResult.value.ok) {
                    const upcomingData = await upcomingResult.value.json()
                    if (isMounted) setUpcomingReleases(uniqueReleases(upcomingData || []))
                } else if (upcomingResult.status === 'rejected') {
                    setUpcomingReleases([])
                }

                if (topSongsResult.status === 'fulfilled' && topSongsResult.value.ok) {
                    const songs = (await topSongsResult.value.json()) as Song[]
                    const withPreviews = (songs || []).filter(song => !!song.previewUrl)
                    loadedTopSongs = withPreviews.length > 0 ? withPreviews : []
                    if (isMounted) setTopSongs(loadedTopSongs)
                } else if (topSongsResult.status === 'rejected') {
                    setTopSongs([])
                }

                if (top5Result.status === 'fulfilled' && top5Result.value.ok) {
                    const songs5 = (await top5Result.value.json()) as Song[]
                    if (isMounted) setTop5OfDay(songs5?.length > 0 ? songs5 : [])
                } else if (top5Result.status === 'rejected') {
                    setTop5OfDay([])
                }

                const candidateSongs = [
                    ...(nextSongOfDay ? [nextSongOfDay] : []),
                    ...loadedTopSongs.filter(song => song.id !== nextSongOfDay?.id)
                ]

                const rotatedSong = pickLeastRecent(
                    candidateSongs,
                    song => getSongArtistName(song),
                    readRecentValues('hiphophub:home-songofday-recent-artists'),
                    rotationSeed + 41
                )

                if (rotatedSong) {
                    nextSongOfDay = rotatedSong
                    writeRecentValue('hiphophub:home-songofday-recent-artists', getSongArtistName(rotatedSong), 20)
                }

                if (isMounted) {
                    setSongOfDay(nextSongOfDay || [][0])
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

        void loadData()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        const state = location.state as { openArtistId?: number; openArtist?: Artist; activeTab?: string } | null
        if (!state?.openArtistId && !state?.activeTab) return

        if (state.openArtistId) {
            setSelectedArtistId(state.openArtistId)
            setSelectedArtist(state.openArtist || null)
            setActiveTab(state.activeTab || 'artistProfile')
        } else if (state.activeTab) {
            setActiveTab(state.activeTab)
        }

        navigate('/home', { replace: true, state: null })
    }, [location.state, navigate])

    useEffect(() => {
        setIsSongPlaying(false)
    }, [songOfDay?.id])

    useEffect(() => {
        setTopSongPlayingId(null)
        setTopSongCurrentTime({})
    }, [topSongs])

    const allUniqueArtists = useMemo(() => {
        return Array.from(
            new Map(artists.map(artist => [artist.name.toLowerCase(), artist])).values()
        ).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    }, [artists])

    const filteredArtists = useMemo(() => {
        if (!searchQuery) return []
        return allUniqueArtists.filter(artist =>
            artist.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5)
    }, [allUniqueArtists, searchQuery])

    const resolveSongCover = (song: Song | null) => {
        if (!song) return undefined
        return song.coverUrl || song.album?.coverImageUrl || song.album?.coverUrl
    }

    const resolveSongArtist = (song: Song | null) => {
        return getSongArtistName(song)
    }

    const formatPreviewClock = (seconds: number) => {
        const safe = Math.max(0, Math.min(30, Math.floor(seconds)))
        return `0:${String(safe).padStart(2, '0')}`
    }

    const openDirectSongYoutube = (song: Song | null) => {
        if (song) window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(getSongArtistName(song) + ' ' + song.title + ' official audio')}`, '_blank', 'noopener,noreferrer')
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
        navigate(`/universe/artist/${artist.id}`, { state: { artist } })
    }

    const handleSearchKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { setShowSearchDropdown(false); return }
        if (e.key === 'Enter' && filteredArtists.length > 0) {
            handleArtistClick(filteredArtists[0])
            setSearchQuery('')
            setShowSearchDropdown(false)
        }
    }

    return (
        <div className="home-page">
            <header className="home-header">
                <div className="header-container">
                    <Link to="/home" className="brand-block" style={{ textDecoration: 'none' }}>
                        <span className="header-logo">HIPHOPHUB</span>
                        <span className="brand-kicker">Independent sound. Shared culture.</span>
                    </Link>

                    <div className="header-center relative">
                        <input
                            type="text"
                            className="search-bar"
                            placeholder="Find your artist…"
                            aria-label="Search artists"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setShowSearchDropdown(true)
                            }}
                            onFocus={() => setShowSearchDropdown(true)}
                            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                            onKeyDown={handleSearchKeyPress}
                        />
                        {showSearchDropdown && filteredArtists.length > 0 && (
                            <div className="search-dropdown">
                                {filteredArtists.map(artist => (
                                    <div
                                        key={artist.id}
                                        className="search-dropdown-item"
                                        role="button" tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleArtistClick(artist); setSearchQuery(''); setShowSearchDropdown(false) } }}
                                        onClick={() => {
                                            handleArtistClick(artist)
                                            setSearchQuery('')
                                            setShowSearchDropdown(false)
                                        }}
                                    >
                                        <div className="search-artist-avatar">
                                            {artist.imageUrl ? <Artwork src={artistPortrait(artist.id)} alt={artist.name} /> : <div className="placeholder-avatar"></div>}
                                        </div>
                                        <span>{artist.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="header-actions">
                        {user ? (
                            <div className="user-profile-menu">
                                <span className="user-greeting">Hi, {user.username}</span>
                                <button className="btn btn-small btn-secondary" onClick={() => navigate('/profile')}>Profile</button>
                                <button className="btn btn-small btn-secondary ghost" onClick={() => { logout(); navigate('/') }}>Log Out</button>
                            </div>
                        ) : (
                            <>
                                <button className="btn btn-small btn-secondary" onClick={() => navigate('/login')}>Log In</button>
                                <button className="btn btn-small btn-primary" onClick={() => navigate('/signup')}>Sign Up</button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <nav className="tabs-container" aria-label="Explore HipHopHub">
                <div className="tabs">
                    <button className={`tab ${activeTab === 'songOfDay' ? 'active' : ''}`} aria-current={activeTab === 'songOfDay' ? 'page' : undefined} onClick={() => setActiveTab('songOfDay')}>
                        Spotlight
                    </button>
                    <button className={`tab ${activeTab === 'topSongs' ? 'active' : ''}`} aria-current={activeTab === 'topSongs' ? 'page' : undefined} onClick={() => setActiveTab('topSongs')}>
                        Top Songs
                    </button>
                    <button className={`tab ${activeTab === 'recentReleases' ? 'active' : ''}`} aria-current={activeTab === 'recentReleases' ? 'page' : undefined} onClick={() => setActiveTab('recentReleases')}>
                        Recent
                    </button>
                    <button className={`tab ${activeTab === 'upcoming' ? 'active' : ''}`} aria-current={activeTab === 'upcoming' ? 'page' : undefined} onClick={() => setActiveTab('upcoming')}>
                        Upcoming
                    </button>
                    <button className={`tab ${activeTab === 'artists' ? 'active' : ''}`} aria-current={activeTab === 'artists' ? 'page' : undefined} onClick={() => setActiveTab('artists')}>
                        Artists
                    </button>
                    <button className={`tab ${activeTab === 'news' ? 'active' : ''}`} aria-current={activeTab === 'news' ? 'page' : undefined} onClick={() => setActiveTab('news')}>
                        The Feed
                    </button>
                    <button className={`tab ${activeTab === 'game' ? 'active' : ''}`} aria-current={activeTab === 'game' ? 'page' : undefined} onClick={() => setActiveTab('game')}>
                        Play
                    </button>
                    {selectedArtistId && (
                        <button className={`tab ${activeTab === 'artistProfile' ? 'active' : ''}`} aria-current={activeTab === 'artistProfile' ? 'page' : undefined} onClick={() => setActiveTab('artistProfile')}>
                            Artist Profile
                        </button>
                    )}
                </div>
            </nav>

            <main id="main-content" className="home-content">
                <div className="container stage-view" key={activeTab}>
                    {dataError && <div className="catalog-notice" role="alert">The catalog is taking a break. Try again in a moment. <button onClick={() => window.location.reload()}>Retry ↗</button></div>}
                    {activeTab === 'songOfDay' && <section className="discovery-intro" aria-label="Daily discovery"><div><span className="section-kicker">THE INDEPENDENT FREQUENCY / DESI HIP-HOP</span><h1>GOOD MUSIC.<br/><em>CLOSE TO HOME.</em></h1></div><div className="intro-note"><span className="issue-mark">HH / 001</span><p>New sounds. Familiar streets.<br/>Your next obsession starts here.</p><button onClick={() => setActiveTab('artists')}>Explore the artists <span>↗</span></button></div></section>}
                    {activeTab === 'songOfDay' && (
                        <div className="song-of-day-section fade-in section-shell">
                            <div className="section-header">
                                <div>
                                    <span className="section-kicker">01 / IN THE SPOTLIGHT</span>
                                    <h2 className="section-title">Song of the Day</h2>
                                </div>
                                <span className="pill small">30s preview</span>
                            </div>
                            {songOfDay ? (
                                <div className="spotlight-layout">
                                    <div className="song-of-day-card card">
                                        <div className="song-cover-shell">
                                            <div className="song-cover">
                                                {resolveSongCover(songOfDay) ? (
                                                    <Artwork src={resolveSongCover(songOfDay)} alt={songOfDay.title} />
                                                ) : (
                                                    <div className="song-cover-placeholder">No cover</div>
                                                )}
                                            </div>
                                            <div className="song-cover-meta">
                                                <span>Daily pick</span><PlaybackMeter active={isSongPlaying} />
                                                <span>{songOfDay.previewUrl ? 'Preview ready' : 'Audio unavailable'}</span>
                                            </div>
                                        </div>
                                        <div className="song-info">
                                            <span className="song-kicker">Curated listen</span>
                                            <h3 className="song-title" title={songOfDay.title}>{songOfDay.title.split(/\s*\(feat\./i)[0]}</h3>{songOfDay.title.length > 65 && <details className="track-credits"><summary>Full title & credits</summary><p>{songOfDay.title}</p></details>}
                                            <p className="song-artist">{resolveSongArtist(songOfDay)}</p>
                                            <p className="song-album">{songOfDay.album?.title || 'Unknown Album'}</p><ListeningLinks title={songOfDay.title} artist={resolveSongArtist(songOfDay)} youtubeUrl={songOfDay.youtubeUrl} />
                                            {songOfDay.previewUrl ? (
                                                <div className="song-player-controls">
                                                    <button className="big-play" onClick={() => {
                                                        const audioEl = document.getElementById('song-of-day-player') as HTMLAudioElement | null
                                                        if (audioEl) {
                                                            audioEl.paused ? void audioEl.play().catch(() => setIsSongPlaying(false)) : audioEl.pause()
                                                        }
                                                    }}>
                                                        {isSongPlaying ? 'Pause' : 'Play'}
                                                    </button>
                                                    <div className="player-bar">
                                                        <div className="player-progress">
                                                            <div className="player-progress-fill" style={{width: `${Math.min(100, previewTime / 30 * 100)}%`}} />
                                                        </div>
                                                        <div className="player-meta">
                                                            <span>Preview</span>
                                                            <span>0:30</span>
                                                        </div>
                                                    </div>

                                                    <audio
                                                        id="song-of-day-player"
                                                onTimeUpdate={e => setPreviewTime(e.currentTarget.currentTime)}
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
                                            <div>
                                                <span className="section-kicker">Fast access</span>
                                                <h3>Today&apos;s Top 5</h3>
                                            </div>
                                            <span>Fresh picks</span>
                                        </div>
                                        <div className="spotlight-list">
                                            {top5OfDay.map((song, index) => (
                                                <div className="spotlight-entry" key={song.id}><button
                                                    key={song.id}
                                                    type="button"
                                                    className="spotlight-row"

                                                    aria-label={`Listen to ${song.title}`}
                                                    onClick={() => { if (song.previewUrl) { setSongOfDay(song); setPreviewTime(0) } else { void openDirectSongYoutube(song) } }}
                                                >
                                                    <span className="spotlight-rank">0{index + 1}</span>
                                                    {resolveSongCover(song) ? (
                                                        <Artwork className="spotlight-thumb" src={resolveSongCover(song)} alt={song.title} />
                                                    ) : (
                                                        <span className="spotlight-thumb placeholder" />
                                                    )}
                                                    <span className="spotlight-copy">
                                                        <strong>{song.title}</strong>
                                                        <small>{resolveSongArtist(song)}</small>
                                                    </span>
                                                </button><ListeningLinks title={song.title} artist={resolveSongArtist(song)} youtubeUrl={song.youtubeUrl} /></div>
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

                    {activeTab === 'songOfDay' && allUniqueArtists.length > 0 && <section className="universe-discover"><div className="section-header"><div><span className="section-kicker">02 / PEOPLE BEHIND THE RECORDS</span><h2 className="section-title">A WORLD OF THEIR OWN.</h2></div><button className="universe-all" onClick={() => setActiveTab('artists')}>All artists ↗</button></div><div className="universe-mini-grid">{allUniqueArtists.filter(a => ['seedhe maut','kr$na','divine','mc stan'].includes(a.name.toLowerCase())).slice(0,4).map(a => <button key={a.id} className="universe-mini" onClick={() => handleArtistClick(a)}><Artwork src={artistPortrait(a.id)} alt={a.name} loading="lazy"/><span><small>ENTER THE UNIVERSE</small><strong>{a.name}</strong></span><b aria-hidden="true">↗</b></button>)}</div></section>}
                    {activeTab === 'topSongs' && (
                        <div className="top-songs-section fade-in section-shell">
                            <div className="section-header">
                                <div>
                                    <span className="section-kicker">Current rotation</span>
                                    <h2 className="section-title">Top DHH Songs</h2>
                                </div>
                                <p className="section-sub">Recent playable DHH cuts, prioritized by the last 30 days</p>
                            </div>
                            {topSongs.length > 0 ? (
                                <div className="songs-grid">
                                    {topSongs.map((song, index) => {
                                        const cover = resolveSongCover(song)
                                        return (
                                            <div key={song.id} className="song-card card">
                                                <div className="song-card-top">
                                                    <span className="song-card-rank">#{String(index + 1).padStart(2, '0')}</span>
                                                    <h4>{song.title}</h4>
                                                    <p>{resolveSongArtist(song)}</p>
                                                </div>
                                                <div className="song-card-media">
                                                    {cover && <Artwork className="song-thumb" src={cover} alt={song.title} />}
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
                                                <ListeningLinks title={song.title} artist={resolveSongArtist(song)} youtubeUrl={song.youtubeUrl} />
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
                        <div className="recent-releases-section fade-in section-shell">
                            <div className="section-header">
                                <div>
                                    <span className="section-kicker">Release radar</span>
                                    <h2 className="section-title">Recent Releases</h2>
                                </div>
                                <p className="section-sub">Last 30 days</p>
                            </div>
                            {recentReleases.length > 0 ? (
                                <div className="releases-grid">
                                    {recentReleases.map((album) => (
                                        <div key={album.id} className="album-card card">
                                            <div className="album-cover">
                                                {album.coverImageUrl || album.coverUrl ? (
                                                    <Artwork src={album.coverImageUrl || album.coverUrl} alt={album.title} />
                                                ) : (
                                                    <div className="album-cover-placeholder">No cover</div>
                                                )}
                                            </div>
                                            <span className="album-kicker">Recent drop</span>
                                            <h4>{album.title}</h4>
                                            <p>{!album.sourceUrl && (album.type || album.albumType) === 'APPEARS_ON' ? 'Featuring ' : ''}{album.artist?.name}</p>{album.sourceUrl && <a className="release-source" href={album.sourceUrl} target="_blank" rel="noopener noreferrer">Release credits ↗</a>}
                                            <p className="release-date">{formatDate(album.releaseDate)}</p>
                                            <ListeningLinks title={album.title} artist={album.artist?.name} youtubeUrl={album.youtubeUrl} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading recent releases...' : 'No DHH releases in the last 30 days.'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'upcoming' && (
                        <div className="recent-releases-section fade-in section-shell">
                            <div className="section-header">
                                <div>
                                    <span className="section-kicker">Forward radar</span>
                                    <h2 className="section-title">Upcoming Albums</h2>
                                </div>
                                <span className="pill small">Announcement watch</span>
                            </div>
                            {upcomingReleases.length > 0 ? (
                                <div className="releases-grid">
                                    {upcomingReleases.map(album => (
                                        <div key={album.id} className="album-card card">
                                            <div className="album-cover">
                                                {album.coverImageUrl || album.coverUrl ? (
                                                    <Artwork src={album.coverImageUrl || album.coverUrl} alt={album.title} />
                                                ) : (
                                                    <div className="album-cover-placeholder">No cover</div>
                                                )}
                                            </div>
                                            <span className="album-kicker">Announced</span>
                                            <h4>{album.title}</h4>
                                            <p>{!album.sourceUrl && (album.type || album.albumType) === 'APPEARS_ON' ? 'Featuring ' : ''}{album.artist?.name}</p>{album.sourceUrl && <a className="release-source" href={album.sourceUrl} target="_blank" rel="noopener noreferrer">Release credits ↗</a>}
                                            <p className="release-date">{formatDate(album.releaseDate)}</p>
                                            <ListeningLinks title={album.title} artist={album.artist?.name} youtubeUrl={album.youtubeUrl} />
                                        </div>
                                    ))}
                                </div>
                            ) : releaseRadar.length > 0 ? (
                                <div className="releases-grid">
                                    {releaseRadar.map((story) => (
                                        <div key={story.id} className="album-card card">
                                            <div className="album-cover album-cover-placeholder">News</div>
                                            <span className="album-kicker">Release watch</span>
                                            <h4>{story.title}</h4>
                                            <p>{story.tag}</p>
                                            <p className="release-date">{story.time}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">{loading ? 'Loading upcoming releases...' : 'No confirmed album announcements in our catalog. Explore The Feed for sourced releases and upcoming shows.'}</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'artists' && (
                        <div className="artists-section fade-in section-shell">
                            <div className="section-header">
                                <div>
                                    <span className="section-kicker">Artist directory</span>
                                    <h2 className="section-title">ENTER THEIR WORLD.</h2>
                                </div>
                                <p className="section-sub">The voices shaping the scene. Pick an artist. Find your frequency.</p>
                            </div>
                            {allUniqueArtists.length > 0 ? (
                                <div className="artists-grid">
                                    {allUniqueArtists.map((artist) => (
                                        <div
                                            key={artist.id}
                                            className="artist-card card"
                                            role="button" tabIndex={0}
                                            aria-label={`Enter ${artist.name} universe`}
                                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleArtistClick(artist) } }}
                                            onClick={() => handleArtistClick(artist)}
                                        >
                                            <div className="artist-image">
                                                {!artistImageErrorMap[artist.id] ? (
                                                    <Artwork
                                                        src={artistPortrait(artist.id)}
                                                        alt={artist.name}
                                                        loading="lazy" decoding="async"
                                                        onError={() => setArtistImageErrorMap(prev => ({ ...prev, [artist.id]: true }))}
                                                    />
                                                ) : (
                                                    <div className="artist-initial">{artist.name.charAt(0)}</div>
                                                )}
                                            </div>
                                            <div className="artist-card-copy">
                                                <span className="artist-card-kicker">Artist universe</span>
                                                <h3>{artist.name}</h3>
                                                <p className="listeners">{artist.genre || 'Artist'}</p>
                                                <p className="artist-card-bio">{getArtistExcerpt(artist.bio)}</p>
                                            </div>
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
                        <ArcadeSection />
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

            <footer className="site-footer"><span>HIPHOPHUB®</span><p>For the heads. For the culture. </p><Link to="/">Back to the beginning ↗</Link></footer>
        </div>
    )
}




