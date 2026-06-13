import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import './SeedheMautUniverse.css'

interface Artist {
    id: number
    name: string
    imageUrl?: string
    bio?: string
    monthlyListeners?: number
    genre?: string
}

interface UniverseLocationState {
    artist?: Artist
}

const SM_MATCH_NAMES = ['seedhe maut', 'seedhe maut inc', 'seedhe maut inc.']
const PARTICLES = Array.from({ length: 8 }, (_, index) => index)
const EMBERS = Array.from({ length: 6 }, (_, index) => index)

const UniverseProfile = memo(ArtistProfile)

export default function SeedheMautUniverse() {
    const navigate = useNavigate()
    const location = useLocation()
    const initialArtist = (location.state as UniverseLocationState | null)?.artist || null

    const [artist, setArtist] = useState<Artist | null>(initialArtist)
    const [status, setStatus] = useState<'booting' | 'ready' | 'error'>(initialArtist ? 'ready' : 'booting')

    const prefersReducedMotion = useRef(
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    const parallaxRef = useRef<HTMLDivElement>(null)
    const smokeRef = useRef<HTMLDivElement>(null)
    const dragonRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const pulseTimeoutRef = useRef<number | null>(null)
    const targetPointerRef = useRef({ x: 0, y: 0 })
    const currentPointerRef = useRef({ x: 0, y: 0 })

    const pulseDragon = useCallback(() => {
        if (prefersReducedMotion.current || !dragonRef.current) return

        dragonRef.current.classList.add('sm-dragon--revealed')

        if (pulseTimeoutRef.current) {
            window.clearTimeout(pulseTimeoutRef.current)
        }

        pulseTimeoutRef.current = window.setTimeout(() => {
            dragonRef.current?.classList.remove('sm-dragon--revealed')
        }, 2800)
    }, [])

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
        if (prefersReducedMotion.current) return

        const animate = () => {
            currentPointerRef.current.x += (targetPointerRef.current.x - currentPointerRef.current.x) * 0.06
            currentPointerRef.current.y += (targetPointerRef.current.y - currentPointerRef.current.y) * 0.06

            const x = currentPointerRef.current.x
            const y = currentPointerRef.current.y

            if (parallaxRef.current) {
                parallaxRef.current.style.transform = `translate3d(${x * -14}px, ${y * -10}px, 0)`
            }

            if (smokeRef.current) {
                smokeRef.current.style.transform = `translate3d(${x * 26}px, ${y * 16}px, 0)`
            }

            rafRef.current = window.requestAnimationFrame(animate)
        }

        rafRef.current = window.requestAnimationFrame(animate)

        return () => {
            if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
        }
    }, [])

    useEffect(() => {
        const handleScroll = () => pulseDragon()
        const handleAudioPlay = (event: Event) => {
            if (event.target instanceof HTMLAudioElement) {
                pulseDragon()
            }
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        document.addEventListener('play', handleAudioPlay, true)

        return () => {
            window.removeEventListener('scroll', handleScroll)
            document.removeEventListener('play', handleAudioPlay, true)
            if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current)
        }
    }, [pulseDragon])

    const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (prefersReducedMotion.current) return

        const centerX = window.innerWidth / 2
        const centerY = window.innerHeight / 2
        targetPointerRef.current.x = (event.clientX - centerX) / centerX
        targetPointerRef.current.y = (event.clientY - centerY) / centerY
    }, [])

    const subtitle = useMemo(() => (
        artist?.bio?.split('.').slice(0, 2).join('.').trim() || 'Delhi underground catalog, live cuts, and scene pressure.'
    ), [artist?.bio])

    return (
        <div className="sm-universe" onMouseMove={handleMouseMove} onMouseEnter={pulseDragon}>
            <div className="sm-gradient-bg" aria-hidden="true" />
            <div className="sm-world-haze" aria-hidden="true" />
            <div className="sm-smoke-field" ref={smokeRef} aria-hidden="true">
                <div className="sm-smoke-layer sm-smoke-layer--black sm-smoke-layer--black-a" />
                <div className="sm-smoke-layer sm-smoke-layer--black sm-smoke-layer--black-b" />
                <div className="sm-smoke-layer sm-smoke-layer--red sm-smoke-layer--red-a" />
                <div className="sm-smoke-layer sm-smoke-layer--red sm-smoke-layer--red-b" />
                <div className="sm-smoke-layer sm-smoke-layer--red sm-smoke-layer--red-c" />
            </div>

            <div ref={dragonRef} className="sm-dragon" aria-hidden="true" />
            <div className="sm-dragon-fire" aria-hidden="true" />

            <div className="sm-embers" aria-hidden="true">
                {EMBERS.map((ember) => (
                    <span key={ember} className="sm-ember" />
                ))}
            </div>

            <div className="sm-particles" aria-hidden="true">
                {PARTICLES.map((particle) => (
                    <span key={particle} className="sm-particle" />
                ))}
            </div>

            <div className="sm-vignette" aria-hidden="true" />
            <div className="sm-world-mask" aria-hidden="true" />

            <div className="sm-parallax-container" ref={parallaxRef}>
                <div className="sm-content">
                    <button className="sm-back-btn sm-entry-anim sm-entry-anim--d1" onClick={() => navigate('/home')}>
                        Exit Universe
                    </button>

                    <div className="sm-universe-header sm-entry-anim sm-entry-anim--d2">
                        <span className="sm-universe-kicker">Delhi underground archive</span>
                        <h1 className="sm-universe-title">{artist?.name || 'Seedhe Maut'}</h1>
                        <p className="sm-universe-sub">{subtitle.endsWith('.') ? subtitle : `${subtitle}.`}</p>
                    </div>

                    <div className="sm-profile-shell sm-entry-anim sm-entry-anim--d3">
                        {status === 'ready' && artist && (
                            <UniverseProfile
                                artistId={artist.id}
                                initialArtist={artist}
                                onBack={() => navigate('/home')}
                            />
                        )}

                        {status === 'booting' && <div className="sm-loading-shell" aria-hidden="true" />}

                        {status === 'error' && (
                            <div className="sm-error-shell">
                                <p>Seedhe Maut universe is temporarily unavailable.</p>
                                <button className="sm-back-btn" onClick={() => navigate('/home')}>
                                    Back to Hub
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
