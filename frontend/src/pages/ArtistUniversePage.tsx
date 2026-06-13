import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import { buildArtistUniverse } from '../utils/artistUniverse'
import './ArtistUniversePage.css'

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
    title?: string
    coverUrl?: string
    coverImageUrl?: string
    releaseDate?: string
}

interface UniverseLocationState {
    artist?: Artist
    returnState?: {
        openArtistId?: number
        openArtist?: Artist
        activeTab?: string
    }
}

const UniverseProfile = memo(ArtistProfile)

export default function ArtistUniversePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { id } = useParams()
    const artistId = Number(id)
    const routeState = (location.state as UniverseLocationState | null) || null
    const initialArtist = routeState?.artist || null

    const [artist, setArtist] = useState<Artist | null>(initialArtist)
    const [albums, setAlbums] = useState<Album[]>([])
    const [status, setStatus] = useState<'booting' | 'ready' | 'error'>(initialArtist ? 'ready' : 'booting')

    useEffect(() => {
        let cancelled = false

        if (!artistId || Number.isNaN(artistId)) {
            setStatus('error')
            return
        }

        if (initialArtist?.id === artistId) {
            setArtist(initialArtist)
            setStatus('ready')
            return
        }

        const loadArtist = async () => {
            try {
                const res = await fetch(`/api/artists/${artistId}`)
                if (!res.ok) throw new Error('Artist not found')
                const payload = await res.json()
                if (cancelled) return
                setArtist(payload)
                setStatus('ready')
            } catch (err) {
                console.error('Failed to load artist universe:', err)
                if (!cancelled) setStatus('error')
            }
        }

        void loadArtist()
        return () => {
            cancelled = true
        }
    }, [artistId, initialArtist])

    useEffect(() => {
        let cancelled = false
        if (!artist?.id) return

        fetch(`/api/artists/${artist.id}/albums`)
            .then(res => (res.ok ? res.json() : []))
            .then((payload: Album[]) => {
                if (!cancelled) {
                    setAlbums(payload || [])
                }
            })
            .catch(err => {
                console.error('Failed to load artist albums for universe collage:', err)
            })

        return () => {
            cancelled = true
        }
    }, [artist?.id])

    const artistUniverse = useMemo(
        () => buildArtistUniverse(artist?.name || 'HipHopHub Artist', artist?.genre, artist?.bio, albums),
        [albums, artist?.bio, artist?.genre, artist?.name]
    )

    const exitUniverse = useCallback(() => {
        if (routeState?.returnState) {
            navigate('/home', { state: routeState.returnState })
            return
        }

        if (artist) {
            navigate('/home', {
                state: {
                    openArtistId: artist.id,
                    openArtist: artist,
                    activeTab: 'artistProfile'
                }
            })
            return
        }

        navigate('/home')
    }, [artist, navigate, routeState?.returnState])

    const subtitle = useMemo(() => (
        artist?.bio?.split('.').map(part => part.trim()).filter(Boolean).slice(0, 2).join('. ') ||
        'Verified catalog, album worlds, and full artist context.'
    ), [artist?.bio])

    return (
        <div className="artist-universe" style={artistUniverse.style}>
            <div className="artist-universe-gradient-bg" aria-hidden="true" />

            {artistUniverse.collageImages.length > 0 && (
                <div className="artist-universe-collage-wall" aria-hidden="true">
                    {artistUniverse.collageImages.map((image, index) => (
                        <div key={`${image}-${index}`} className="artist-universe-collage-tile">
                            <img src={image} alt="" />
                        </div>
                    ))}
                </div>
            )}

            <div className="artist-universe-veil artist-universe-veil-top" aria-hidden="true" />
            <div className="artist-universe-veil artist-universe-veil-bottom" aria-hidden="true" />
            <div className="artist-universe-vignette" aria-hidden="true" />

            <div className="artist-universe-content">
                <button className="artist-universe-back-btn artist-universe-entry artist-universe-entry--d1" onClick={exitUniverse}>
                    Exit Universe
                </button>

                <div className="artist-universe-header artist-universe-entry artist-universe-entry--d2">
                    <span className="artist-universe-kicker">Artist universe</span>
                    <h1 className={`artist-universe-title artist-universe-title--${artistUniverse.nameEffect}`}>
                        {artist?.name || 'HipHopHub Artist'}
                    </h1>
                    <p className="artist-universe-sub">{subtitle.endsWith('.') ? subtitle : `${subtitle}.`}</p>
                </div>

                <div className="artist-universe-profile-shell artist-universe-entry artist-universe-entry--d3">
                    {status === 'ready' && artist && (
                        <UniverseProfile
                            artistId={artist.id}
                            initialArtist={artist}
                            onBack={exitUniverse}
                        />
                    )}

                    {status === 'booting' && <div className="artist-universe-loading-shell" aria-hidden="true" />}

                    {status === 'error' && (
                        <div className="artist-universe-error-shell">
                            <p>Artist universe is temporarily unavailable.</p>
                            <button className="artist-universe-back-btn" onClick={exitUniverse}>
                                Return to profile
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
