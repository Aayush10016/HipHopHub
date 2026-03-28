import { useEffect, useMemo, useState } from 'react'
import GameComponent from '../components/GameComponent'
import './ArtistProfile.css'

interface Artist {
    id: number
    name: string
    imageUrl?: string
    bio?: string
    monthlyListeners?: number
    genre?: string
}

interface Album {
    id: number
    title: string
    releaseDate: string
    coverImageUrl?: string
    coverUrl?: string
    albumType?: string
    type?: string
    youtubeUrl?: string
}

interface Song {
    id: number
    title: string
    previewUrl?: string
    durationMs?: number
    artistName?: string
    coverUrl?: string
    youtubeUrl?: string
}

interface Tour {
    id: number
    venue: string
    city: string
    country: string
    eventDate: string
    ticketUrl?: string
}

interface Fact {
    id: number
    fact: string
}

interface ArtistProfileProps {
    artistId: number
    initialArtist?: Artist
    onBack: () => void
}

const toYouTubeSearch = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`

export default function ArtistProfile({ artistId, initialArtist, onBack }: ArtistProfileProps) {
    const [activeTab, setActiveTab] = useState('overview')
    const [artist, setArtist] = useState<Artist | null>(initialArtist || null)
    const [albums, setAlbums] = useState<Album[]>([])
    const [songs, setSongs] = useState<Song[]>([])
    const [tours, setTours] = useState<Tour[]>([])
    const [facts, setFacts] = useState<Fact[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeSongId, setActiveSongId] = useState<number | null>(null)
    const [artistImageFailed, setArtistImageFailed] = useState(false)
    const [songCurrentTime, setSongCurrentTime] = useState<Record<number, number>>({})

    useEffect(() => {
        let isMounted = true
        setLoading(true)
        setError(null)
        setArtist(initialArtist || null)
        setAlbums([])
        setSongs([])
        setTours([])
        setFacts([])
        setArtistImageFailed(false)
        setSongCurrentTime({})
        setActiveSongId(null)

        Promise.all([
            fetch(`/api/artists/${artistId}`),
            fetch(`/api/artists/${artistId}/albums`),
            fetch(`/api/songs/artist/${artistId}`),
            fetch(`/api/artists/${artistId}/tours`),
            fetch(`/api/artists/${artistId}/facts`)
        ])
            .then(async ([artistRes, albumsRes, songsRes, toursRes, factsRes]) => {
                if (!isMounted) return

                if (artistRes.ok) {
                    setArtist(await artistRes.json())
                } else {
                    setError('Artist not found')
                }

                if (albumsRes.ok) {
                    setAlbums((await albumsRes.json()) || [])
                }

                if (songsRes.ok) {
                    setSongs((await songsRes.json()) || [])
                }

                if (toursRes.ok) {
                    setTours((await toursRes.json()) || [])
                }

                if (factsRes.ok) {
                    setFacts((await factsRes.json()) || [])
                }

                setLoading(false)
            })
            .catch(err => {
                if (!isMounted) return
                console.error('Failed to fetch artist profile:', err)
                setError('Artist not found')
                setLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [artistId, initialArtist])

    useEffect(() => {
        setActiveSongId(null)
        setSongCurrentTime({})
    }, [artistId])

    const displayArtist = artist || initialArtist

    const albumsByType = useMemo(
        () => albums.filter(a => (a.albumType || a.type) === 'ALBUM'),
        [albums]
    )
    const eps = useMemo(
        () => albums.filter(a => (a.albumType || a.type) === 'EP'),
        [albums]
    )
    const singles = useMemo(
        () => albums.filter(a => {
            const type = a.albumType || a.type
            return type === 'SINGLE' || type === 'APPEARS_ON'
        }),
        [albums]
    )

    const getAlbumCover = (album: Album) => album.coverUrl || album.coverImageUrl
    const fallbackArtistImage = useMemo(() => {
        for (const album of albums) {
            const cover = getAlbumCover(album)
            if (cover) return cover
        }
        return undefined
    }, [albums])
    const artistImageSrc = !artistImageFailed && displayArtist?.id
        ? `/api/images/artist/${displayArtist.id}`
        : fallbackArtistImage

    const toggleSongPreview = async (songId: number) => {
        const currentAudio = document.getElementById(`artist-song-preview-${songId}`) as HTMLAudioElement | null
        if (!currentAudio) return

        if (activeSongId !== null && activeSongId !== songId) {
            const previous = document.getElementById(`artist-song-preview-${activeSongId}`) as HTMLAudioElement | null
            if (previous) {
                previous.pause()
                previous.currentTime = 0
            }
            setSongCurrentTime(prev => ({ ...prev, [activeSongId]: 0 }))
        }

        if (activeSongId === songId && !currentAudio.paused) {
            currentAudio.pause()
            setActiveSongId(null)
            return
        }

        try {
            await currentAudio.play()
            setActiveSongId(songId)
        } catch (err) {
            console.error('Failed to play artist song preview:', err)
        }
    }

    const formatPreviewClock = (seconds: number) => {
        const safe = Math.max(0, Math.min(30, Math.floor(seconds)))
        return `0:${String(safe).padStart(2, '0')}`
    }

    const openDirectSongYoutube = async (song: Song) => {
        let targetUrl = song.youtubeUrl || toYouTubeSearch(`${displayArtist?.name || song.artistName || ''} ${song.title} official audio`)

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
        let targetUrl = album.youtubeUrl || toYouTubeSearch(`${displayArtist?.name || ''} ${album.title} full album`)

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

    const openDirectSingleYoutube = (album: Album) => {
        const targetUrl = toYouTubeSearch(`${displayArtist?.name || ''} ${album.title} official audio`)
        window.open(targetUrl, '_blank', 'noopener,noreferrer')
    }

    if (loading) {
        return <div className="loading-profile">Loading artist profile...</div>
    }

    if (error || !displayArtist) {
        return <div className="error-profile">{error || 'Artist not found'}</div>
    }

    return (
        <div className="artist-profile fade-in">
            <button className="btn btn-secondary back-btn" onClick={onBack}>
                Back to Artists
            </button>

            <div className="artist-header">
                <div className="artist-header-image">
                    {artistImageSrc ? (
                        <img
                            src={artistImageSrc}
                            alt={displayArtist.name}
                            onError={() => setArtistImageFailed(true)}
                        />
                    ) : (
                        <div className="artist-initial-large">{displayArtist.name.charAt(0)}</div>
                    )}
                </div>
                <div className="artist-header-info">
                    <h1 className="artist-name">{displayArtist.name}</h1>
                    {displayArtist.genre && <p className="artist-genre">{displayArtist.genre}</p>}
                </div>
            </div>

            <div className="profile-tabs">
                <button
                    className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`profile-tab ${activeTab === 'songs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('songs')}
                >
                    Songs ({songs.length})
                </button>
                <button
                    className={`profile-tab ${activeTab === 'albums' ? 'active' : ''}`}
                    onClick={() => setActiveTab('albums')}
                >
                    Albums ({albumsByType.length})
                </button>
                <button
                    className={`profile-tab ${activeTab === 'eps' ? 'active' : ''}`}
                    onClick={() => setActiveTab('eps')}
                >
                    EPs ({eps.length})
                </button>
                <button
                    className={`profile-tab ${activeTab === 'singles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('singles')}
                >
                    Singles ({singles.length})
                </button>
                <button
                    className={`profile-tab ${activeTab === 'tours' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tours')}
                >
                    Tours ({tours.length})
                </button>
                <button
                    className={`profile-tab ${activeTab === 'facts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('facts')}
                >
                    Fun Facts
                </button>
                <button
                    className={`profile-tab ${activeTab === 'game' ? 'active' : ''}`}
                    onClick={() => setActiveTab('game')}
                >
                    Game
                </button>
            </div>

            <div className="profile-content">
                {activeTab === 'overview' && (
                    <div className="overview-section">
                        {displayArtist.bio && (
                            <div className="bio-card card">
                                <h3>Biography</h3>
                                <p>{displayArtist.bio}</p>
                            </div>
                        )}

                        <div className="overview-grid">
                            <div className="overview-card card">
                                <h4>Total Albums</h4>
                                <p className="overview-stat">{albumsByType.length}</p>
                            </div>
                            <div className="overview-card card">
                                <h4>Total Songs</h4>
                                <p className="overview-stat">{songs.length}</p>
                            </div>
                            <div className="overview-card card">
                                <h4>Total EPs</h4>
                                <p className="overview-stat">{eps.length}</p>
                            </div>
                            <div className="overview-card card">
                                <h4>Singles</h4>
                                <p className="overview-stat">{singles.length}</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'songs' && (
                    <div className="songs-section">
                        <h3>All Songs</h3>
                        {songs.length > 0 ? (
                            <div className="songs-list">
                                {songs.map((song, index) => (
                                    <div key={song.id} className="song-item card">
                                        <span className="song-number">{index + 1}</span>
                                        <div className="artist-song-cover">
                                            {song.coverUrl ? (
                                                <img src={song.coverUrl} alt={song.title} />
                                            ) : (
                                                <div className="artist-song-cover-placeholder"></div>
                                            )}
                                        </div>
                                        <div className="song-details">
                                            <h4>{song.title}</h4>
                                            {song.durationMs && (
                                                <span className="song-duration">
                                                    {Math.floor(song.durationMs / 60000)}:{String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="artist-song-actions">
                                            {song.previewUrl && (
                                                <div className="artist-song-player">
                                                    <button
                                                        type="button"
                                                        className="song-play-btn"
                                                        onClick={() => toggleSongPreview(song.id)}
                                                    >
                                                        {activeSongId === song.id ? 'Pause' : 'Play'}
                                                    </button>
                                                    <div className="artist-song-progress-wrap">
                                                        <div className="artist-song-progress-track">
                                                            <div
                                                                className="artist-song-progress-fill"
                                                                style={{
                                                                    width: `${Math.min(100, ((songCurrentTime[song.id] || 0) / 30) * 100)}%`
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="artist-song-time">
                                                            <span>{formatPreviewClock(songCurrentTime[song.id] || 0)}</span>
                                                            <span>0:30</span>
                                                        </div>
                                                    </div>
                                                    <audio
                                                        id={`artist-song-preview-${song.id}`}
                                                        preload="none"
                                                        src={song.previewUrl}
                                                        className="song-preview"
                                                        onTimeUpdate={(e) => {
                                                            const next = Math.min(30, (e.currentTarget as HTMLAudioElement).currentTime)
                                                            setSongCurrentTime(prev => ({ ...prev, [song.id]: next }))
                                                        }}
                                                        onPlay={() => setActiveSongId(song.id)}
                                                        onPause={() => setActiveSongId(prev => (prev === song.id ? null : prev))}
                                                        onEnded={() => {
                                                            setActiveSongId(prev => (prev === song.id ? null : prev))
                                                            setSongCurrentTime(prev => ({ ...prev, [song.id]: 30 }))
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => openDirectSongYoutube(song)}
                                                className="yt-link-btn"
                                            >
                                                Play on YT
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No songs available</p>
                        )}
                    </div>
                )}

                {activeTab === 'albums' && (
                    <div className="albums-section">
                        <h3>Albums</h3>
                        {albumsByType.length > 0 ? (
                            <div className="albums-grid">
                                {albumsByType.map(album => (
                                    <div key={album.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(album) ? (
                                                <img src={getAlbumCover(album)} alt={album.title} />
                                            ) : (
                                                <div className="album-placeholder"></div>
                                            )}
                                        </div>
                                        <h4>{album.title}</h4>
                                        <p>{new Date(album.releaseDate).getFullYear()}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No albums available</p>
                        )}
                    </div>
                )}

                {activeTab === 'eps' && (
                    <div className="eps-section">
                        <h3>EPs</h3>
                        {eps.length > 0 ? (
                            <div className="albums-grid">
                                {eps.map(ep => (
                                    <div key={ep.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(ep) ? (
                                                <img src={getAlbumCover(ep)} alt={ep.title} />
                                            ) : (
                                                <div className="album-placeholder"></div>
                                            )}
                                        </div>
                                        <h4>{ep.title}</h4>
                                        <p>{new Date(ep.releaseDate).getFullYear()}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No EPs available</p>
                        )}
                    </div>
                )}

                {activeTab === 'singles' && (
                    <div className="singles-section">
                        <h3>Singles</h3>
                        {singles.length > 0 ? (
                            <div className="albums-grid">
                                {singles.map(single => (
                                    <div key={single.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(single) ? (
                                                <img src={getAlbumCover(single)} alt={single.title} />
                                            ) : (
                                                <div className="album-placeholder"></div>
                                            )}
                                        </div>
                                        <h4>{single.title}</h4>
                                        <p>{new Date(single.releaseDate).getFullYear()}</p>
                                        <button type="button" onClick={() => openDirectSingleYoutube(single)} className="yt-link-btn">
                                            Play on YT
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No singles available</p>
                        )}
                    </div>
                )}

                {activeTab === 'tours' && (
                    <div className="tours-section">
                        <h3>Upcoming Tours and Events</h3>
                        {tours.length > 0 ? (
                            <div className="tours-list">
                                {tours.map(tour => (
                                    <div key={tour.id} className="tour-item card">
                                        <div className="tour-date">
                                            <span className="tour-day">{new Date(tour.eventDate).getDate()}</span>
                                            <span className="tour-month">{new Date(tour.eventDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                                        </div>
                                        <div className="tour-details">
                                            <h4>{tour.venue}</h4>
                                            <p>{tour.city}, {tour.country}</p>
                                        </div>
                                        {tour.ticketUrl && (
                                            <a href={tour.ticketUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-small">
                                                Get Tickets
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No upcoming tours</p>
                        )}
                    </div>
                )}

                {activeTab === 'facts' && (
                    <div className="facts-section">
                        <h3>Fun Facts</h3>
                        {facts.length > 0 ? (
                            <div className="facts-list">
                                {facts.map(fact => (
                                    <div key={fact.id} className="fact-item card">
                                        <span className="fact-emoji"></span>
                                        <p>{fact.fact}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No fun facts available</p>
                        )}
                    </div>
                )}

                {activeTab === 'game' && (
                    <div className="game-section">
                        <h3>Guess the {displayArtist.name} Song</h3>
                        <p className="game-description">
                            Test your knowledge of {displayArtist.name}'s music. Listen to a 30-second preview and guess the song.
                        </p>
                        <GameComponent artistId={artistId} mode="artist" />
                    </div>
                )}
            </div>
        </div>
    )
}
