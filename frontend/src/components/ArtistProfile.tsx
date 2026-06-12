import { useEffect, useMemo, useState } from 'react'
import GameComponent from '../components/GameComponent'
import ArtistSmokeLayer from '../components/ArtistSmokeLayer'
import ArtistParticleCanvas from '../components/ArtistParticleCanvas'
import ArtistFilmGrain from '../components/ArtistFilmGrain'
import ArtistWaveform from '../components/ArtistWaveform'
import { buildArtistUniverse } from '../utils/artistUniverse'
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

const getAlbumCover = (album: Album) => album.coverUrl || album.coverImageUrl

const getBioLead = (bio?: string) => {
    if (!bio) return 'A catalog view built around verified songs, releases, and scene context.'
    const firstLine = bio.split('.')[0]?.trim() || bio.trim()
    return `${firstLine}${firstLine.endsWith('.') ? '' : '.'}`
}

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
            return type === 'SINGLE'
        }),
        [albums]
    )
    const appearsOn = useMemo(
        () => albums.filter(a => (a.albumType || a.type) === 'APPEARS_ON'),
        [albums]
    )

    const artistImageSrc = !artistImageFailed && displayArtist?.id
        ? `/api/images/artist/${displayArtist.id}`
        : undefined

    const overviewStats = [
        { label: 'Albums', value: albumsByType.length },
        { label: 'Songs', value: songs.length },
        { label: 'EPs', value: eps.length },
        { label: 'Singles', value: singles.length },
        { label: 'Features', value: appearsOn.length }
    ]

    const artistUniverse = useMemo(
        () => buildArtistUniverse(displayArtist?.name || 'HipHopHub', displayArtist?.genre, displayArtist?.bio, albums),
        [albums, displayArtist?.bio, displayArtist?.genre, displayArtist?.name]
    )

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
        try {
            const res = await fetch(`/api/youtube/song/${song.id}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url?.startsWith('https://www.youtube.com/watch?v=')) {
                    window.open(payload.url, '_blank', 'noopener,noreferrer')
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for song ${song.id}:`, err)
        }
    }

    const openDirectAlbumYoutube = async (album: Album) => {
        try {
            const res = await fetch(`/api/youtube/album/${album.id}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url?.startsWith('https://www.youtube.com/watch?v=')) {
                    window.open(payload.url, '_blank', 'noopener,noreferrer')
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for album ${album.id}:`, err)
        }
    }

    const openDirectSingleYoutube = async (album: Album) => {
        try {
            const res = await fetch(`/api/youtube/album/${album.id}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url?.startsWith('https://www.youtube.com/watch?v=')) {
                    window.open(payload.url, '_blank', 'noopener,noreferrer')
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for single ${album.id}:`, err)
        }
    }

    if (loading) {
        return <div className="loading-profile">Loading artist profile...</div>
    }

    if (error || !displayArtist) {
        return <div className="error-profile">{error || 'Artist not found'}</div>
    }

    const themeId = artistUniverse.isFlagship ? artistUniverse.flagship.id : 'default'
    const flagship = artistUniverse.isFlagship ? artistUniverse.flagship : null

    return (
        <div
            className={`artist-profile fade-in ${artistUniverse.isFlagship ? 'flagship' : ''}`}
            style={artistUniverse.style}
            data-artist-theme={themeId}
        >
            {/* ═══ Layer 1: Animated Gradient Background ═══ */}
            <div className="artist-hero-gradient" aria-hidden="true" />

            {/* ═══ Layer 2: Smoke ═══ */}
            {flagship ? (
                <ArtistSmokeLayer smoke={flagship.smoke} />
            ) : (
                <>
                    <div className="artist-atmosphere artist-atmosphere-one" />
                    <div className="artist-atmosphere artist-atmosphere-two" />
                    <div className="artist-atmosphere artist-atmosphere-three" />
                </>
            )}

            {/* ═══ Layer 2.5: Waveform Visualizer ═══ */}
            <ArtistWaveform
                color={flagship ? flagship.palette.primary : artistUniverse.palette[0]}
                opacity={flagship ? 0.06 : 0.04}
            />

            {/* ═══ Layer 3: Album Collage ═══ */}
            {artistUniverse.collageImages.length > 0 && (
                <div className="artist-collage" aria-hidden="true">
                    {artistUniverse.collageImages.map((image, index) => (
                        <img key={`${image}-${index}`} src={image} alt="" />
                    ))}
                </div>
            )}

            {/* ═══ Layer 4: Watermark / Logo ═══ */}
            <div className="artist-brand-watermark" aria-hidden="true">
                {artistUniverse.watermark}
            </div>

            {/* ═══ Layer 5: Particles ═══ */}
            {flagship ? (
                <ArtistParticleCanvas config={flagship.particles} />
            ) : (
                <div className="artist-particle-field" aria-hidden="true">
                    {Array.from({ length: 16 }).map((_, index) => (
                        <span key={index} className={`artist-particle particle-${index % 4}`} />
                    ))}
                </div>
            )}

            {/* ═══ Layer 5.5: Film Grain ═══ */}
            {flagship?.filmGrain && <ArtistFilmGrain />}

            {/* ═══ Layer 6: Content ═══ */}
            <button className="btn btn-secondary back-btn" onClick={onBack}>
                Back to Artists
            </button>

            <div className="artist-header card">
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
                    <span className="artist-kicker">Artist universe</span>
                    <h1 className="artist-name">{displayArtist.name}</h1>
                    {displayArtist.genre && <p className="artist-genre">{displayArtist.genre}</p>}
                    <p className="artist-lead">{getBioLead(displayArtist.bio)}</p>
                    <div className="artist-mood-row">
                        <span className="artist-mood-chip">{artistUniverse.moodPrimary}</span>
                        <span className="artist-mood-chip">{artistUniverse.moodSecondary}</span>
                        <span className="artist-mood-chip">{artistUniverse.atmosphere}</span>
                    </div>
                    <div className="artist-summary-row">
                        <div className="artist-summary-chip">
                            <strong>{songs.length}</strong>
                            <span>verified songs</span>
                        </div>
                        <div className="artist-summary-chip">
                            <strong>{albumsByType.length + eps.length + singles.length}</strong>
                            <span>release entries</span>
                        </div>
                        <div className="artist-summary-chip">
                            <strong>{appearsOn.length}</strong>
                            <span>feature credits</span>
                        </div>
                    </div>
                </div>
                <div className="artist-mark-badge" aria-hidden="true">
                    <span className="artist-mark-label">Wordmark</span>
                    <strong>{artistUniverse.initials}</strong>
                </div>
            </div>

            <div className="catalog-strip">
                {overviewStats.map((item) => (
                    <div key={item.label} className="catalog-strip-card">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                    </div>
                ))}
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
                    className={`profile-tab ${activeTab === 'appears-on' ? 'active' : ''}`}
                    onClick={() => setActiveTab('appears-on')}
                >
                    Features ({appearsOn.length})
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
                        <div className="overview-story-grid">
                            <div className="overview-story-card card">
                                <span className="section-label">Signature atmosphere</span>
                                <h3>{artistUniverse.moodPrimary} x {artistUniverse.moodSecondary}</h3>
                                <p>{artistUniverse.signature}</p>
                            </div>

                            <div className="overview-story-card card">
                                <span className="section-label">Career timeline</span>
                                <h3>Release arc</h3>
                                {artistUniverse.releaseYears.length > 0 ? (
                                    <div className="timeline-strip">
                                        {artistUniverse.releaseYears.map(year => (
                                            <span key={year} className="timeline-chip">{year}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <p>Release years are still syncing for this artist.</p>
                                )}
                            </div>
                        </div>

                        {displayArtist.bio && (
                            <div className="bio-card card">
                                <span className="section-label">Biography</span>
                                <h3>Inside the artist universe</h3>
                                <p>{displayArtist.bio}</p>
                            </div>
                        )}

                        <div className="overview-grid">
                            {overviewStats.map((item) => (
                                <div key={item.label} className="overview-card card">
                                    <h4>{item.label}</h4>
                                    <p className="overview-stat">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'songs' && (
                    <div className="songs-section">
                        <div className="section-heading-block">
                            <span className="section-label">Library</span>
                            <h3>All Songs</h3>
                        </div>
                        {songs.length > 0 ? (
                            <div className="songs-list">
                                {songs.map((song, index) => (
                                    <div key={song.id} className="song-item card">
                                        <span className="song-number">{index + 1}</span>
                                        <div className="artist-song-cover">
                                            {song.coverUrl ? (
                                                <img src={song.coverUrl} alt={song.title} />
                                            ) : (
                                                <div className="artist-song-cover-placeholder" />
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
                                            {song.youtubeUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => openDirectSongYoutube(song)}
                                                    className="yt-link-btn"
                                                >
                                                    ▶ Play on YouTube
                                                </button>
                                            )}
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
                        <div className="section-heading-block">
                            <span className="section-label">Discography</span>
                            <h3>Albums</h3>
                        </div>
                        {albumsByType.length > 0 ? (
                            <div className="albums-grid">
                                {albumsByType.map(album => (
                                    <div key={album.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(album) ? (
                                                <img src={getAlbumCover(album)} alt={album.title} />
                                            ) : (
                                                <div className="album-placeholder" />
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
                        <div className="section-heading-block">
                            <span className="section-label">Discography</span>
                            <h3>EPs</h3>
                        </div>
                        {eps.length > 0 ? (
                            <div className="albums-grid">
                                {eps.map(ep => (
                                    <div key={ep.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(ep) ? (
                                                <img src={getAlbumCover(ep)} alt={ep.title} />
                                            ) : (
                                                <div className="album-placeholder" />
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
                        <div className="section-heading-block">
                            <span className="section-label">Discography</span>
                            <h3>Singles</h3>
                        </div>
                        {singles.length > 0 ? (
                            <div className="albums-grid">
                                {singles.map(single => (
                                    <div key={single.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(single) ? (
                                                <img src={getAlbumCover(single)} alt={single.title} />
                                            ) : (
                                                <div className="album-placeholder" />
                                            )}
                                        </div>
                                        <h4>{single.title}</h4>
                                        <p>{new Date(single.releaseDate).getFullYear()}</p>
                                        {single.youtubeUrl && (
                                            <button type="button" onClick={() => openDirectSingleYoutube(single)} className="yt-link-btn">
                                                ▶ Play on YouTube
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No singles available</p>
                        )}
                    </div>
                )}

                {activeTab === 'appears-on' && (
                    <div className="appears-on-section">
                        <div className="section-heading-block">
                            <span className="section-label">Credits</span>
                            <h3>Features and Appears On</h3>
                        </div>
                        {appearsOn.length > 0 ? (
                            <div className="albums-grid">
                                {appearsOn.map(release => (
                                    <div key={release.id} className="album-item card">
                                        <div className="album-cover">
                                            {getAlbumCover(release) ? (
                                                <img src={getAlbumCover(release)} alt={release.title} />
                                            ) : (
                                                <div className="album-placeholder" />
                                            )}
                                        </div>
                                        <h4>{release.title}</h4>
                                        <p>{new Date(release.releaseDate).getFullYear()}</p>
                                        {release.youtubeUrl && (
                                            <button type="button" onClick={() => openDirectSingleYoutube(release)} className="yt-link-btn">
                                                ▶ Play on YouTube
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="empty-message">No feature releases available</p>
                        )}
                    </div>
                )}

                {activeTab === 'tours' && (
                    <div className="tours-section">
                        <div className="section-heading-block">
                            <span className="section-label">Calendar</span>
                            <h3>Upcoming Tours and Events</h3>
                        </div>
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
                        <div className="section-heading-block">
                            <span className="section-label">Context</span>
                            <h3>Fun Facts</h3>
                        </div>
                        {facts.length > 0 ? (
                            <div className="facts-list">
                                {facts.map(fact => (
                                    <div key={fact.id} className="fact-item card">
                                        <span className="fact-emoji" />
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
                        <div className="section-heading-block">
                            <span className="section-label">Challenge mode</span>
                            <h3>Guess the {displayArtist.name} Song</h3>
                        </div>
                        <p className="game-description">
                            Test your knowledge of {displayArtist.name}&apos;s music. Listen to a 30-second preview and guess the song.
                        </p>
                        <GameComponent artistId={artistId} mode="artist" />
                    </div>
                )}
            </div>
        </div>
    )
}
