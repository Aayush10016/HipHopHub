import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import { buildArtistUniverse } from '../utils/artistUniverse'
import './SeedheMautUniverse.css'

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

const SM_MATCH_NAMES = ['seedhe maut', 'seedhe maut inc', 'seedhe maut inc.']
const UniverseProfile = memo(ArtistProfile)

export default function SeedheMautUniverse() {
    const navigate = useNavigate()
    const location = useLocation()
    const routeState = (location.state as UniverseLocationState | null) || null
    const initialArtist = routeState?.artist || null

    const [artist, setArtist] = useState<Artist | null>(initialArtist)
    const [albums, setAlbums] = useState<Album[]>([])
    const [status, setStatus] = useState<'booting' | 'ready' | 'error'>(initialArtist ? 'ready' : 'booting')

    useEffect(() => {
        let cancelled = false

        if (initialArtist) {
            setArtist(initialArtist)
            setStatus('ready')
            return
        }

        const findSeedheMaut = async () => {
            try {
                const res = await fetch('/api/artists?scope=dhh')
                if (!res.ok) throw new Error('Failed to fetch artists')

                const artists = (await res.json()) as Artist[]
                const smArtist = artists.find(candidate => {
                    const normalized = candidate.name.toLowerCase().trim()
                    return SM_MATCH_NAMES.some(name => normalized === name || normalized.includes(name))
                }) || null

                if (cancelled) return

                if (smArtist) {
                    setArtist(smArtist)
                    setStatus('ready')
                    return
                }

                setStatus('error')
            } catch (err) {
                console.error('Failed to load Seedhe Maut universe:', err)
                if (!cancelled) setStatus('error')
            }
        }

        void findSeedheMaut()
        return () => {
            cancelled = true
        }
    }, [initialArtist])

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
                console.error('Failed to load Seedhe Maut albums for universe collage:', err)
            })

        return () => {
            cancelled = true
        }
    }, [artist?.id])

    const artistUniverse = useMemo(
        () => buildArtistUniverse(artist?.name || 'Seedhe Maut', artist?.genre, artist?.bio, albums),
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
        artist?.bio?.split('.').slice(0, 2).join('.').trim() || 'Verified catalog, album worlds, and full artist context.'
    ), [artist?.bio])

    return (
        <div className="sm-universe">
            <div className="sm-gradient-bg" aria-hidden="true" />

            {artistUniverse.collageImages.length > 0 && (
                <div className="sm-collage-wall" aria-hidden="true">
                    {artistUniverse.collageImages.map((image, index) => (
                        <div key={`${image}-${index}`} className="sm-collage-tile">
                            <img src={image} alt="" />
                        </div>
                    ))}
                </div>
            )}

            <div className="sm-veil sm-veil-top" aria-hidden="true" />
            <div className="sm-veil sm-veil-bottom" aria-hidden="true" />
            <div className="sm-vignette" aria-hidden="true" />

            <div className="sm-content">
                <button className="sm-back-btn sm-entry-anim sm-entry-anim--d1" onClick={exitUniverse}>
                    Exit Universe
                </button>

                <div className="sm-universe-header sm-entry-anim sm-entry-anim--d2">
                    <span className="sm-universe-kicker">Seedhe Maut universe</span>
                    <h1 className="sm-universe-title">{artist?.name || 'Seedhe Maut'}</h1>
                    <p className="sm-universe-sub">{subtitle.endsWith('.') ? subtitle : `${subtitle}.`}</p>
                </div>

                <div className="sm-profile-shell sm-entry-anim sm-entry-anim--d3">
                    {status === 'ready' && artist && (
                        <UniverseProfile
                            artistId={artist.id}
                            initialArtist={artist}
                            onBack={exitUniverse}
                        />
                    )}

                    {status === 'booting' && <div className="sm-loading-shell" aria-hidden="true" />}

                    {status === 'error' && (
                        <div className="sm-error-shell">
                            <p>Seedhe Maut universe is temporarily unavailable.</p>
                            <button className="sm-back-btn" onClick={exitUniverse}>
                                Return to profile
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
