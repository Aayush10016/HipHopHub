/**
 * SeedheMautUniverse — Immersive artist universe page for Seedhe Maut.
 *
 * Layers:
 * 1. Animated gradient background
 * 2. Red/black smoke (CSS radial-gradient, mix-blend-mode: screen)
 * 3. Dragon silhouette with breathing opacity animation
 * 4. CSS-only floating particles (12 particles, zero canvas overhead)
 * 5. Parallax container responding to mouse movement
 * 6. ArtistProfile content with SM-themed card overrides
 *
 * Performance: All animations use transform/opacity/filter only.
 * Parallax uses onMouseMove + translate3d with no layout recalculation.
 * Dragon is a CSS background-image SVG — zero runtime cost.
 *
 * Accessibility: prefers-reduced-motion disables all motion globally.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const SM_MATCH_NAMES = ['seedhe maut', 'seedhe maut inc', 'seedhe maut inc.']

const PARTICLE_COUNT = 12

export default function SeedheMautUniverse() {
    const navigate = useNavigate()
    const [artist, setArtist] = useState<Artist | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const parallaxRef = useRef<HTMLDivElement>(null)
    const smokeRef = useRef<HTMLDivElement>(null)
    const prefersReducedMotion = useRef(
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )

    // Fetch Seedhe Maut artist data by name search
    useEffect(() => {
        let cancelled = false

        const findSeedheMaut = async () => {
            try {
                const res = await fetch('/api/artists?scope=dhh')
                if (!res.ok) {
                    throw new Error('Failed to fetch artists')
                }

                const artists = (await res.json()) as Artist[]
                const smArtist = artists.find(a =>
                    SM_MATCH_NAMES.some(name =>
                        a.name.toLowerCase().trim() === name ||
                        a.name.toLowerCase().trim().includes(name)
                    )
                )

                if (!cancelled) {
                    if (smArtist) {
                        setArtist(smArtist)
                    } else {
                        setError('Seedhe Maut not found in artist catalog')
                    }
                    setLoading(false)
                }
            } catch (err) {
                console.error('Failed to find Seedhe Maut:', err)
                if (!cancelled) {
                    setError('Failed to load artist data')
                    setLoading(false)
                }
            }
        }

        void findSeedheMaut()
        return () => { cancelled = true }
    }, [])

    // Parallax mouse tracking
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (prefersReducedMotion.current) return

        const { clientX, clientY } = e
        const cx = window.innerWidth / 2
        const cy = window.innerHeight / 2
        const dx = (clientX - cx) / cx
        const dy = (clientY - cy) / cy

        // Content parallax (subtle)
        if (parallaxRef.current) {
            parallaxRef.current.style.transform =
                `translate3d(${dx * -1.5}px, ${dy * -1.5}px, 0)`
        }

        // Smoke parallax (deeper)
        if (smokeRef.current) {
            smokeRef.current.style.transform =
                `translate3d(${dx * 6}px, ${dy * 4}px, 0)`
        }
    }, [])

    if (loading) {
        return (
            <div className="sm-universe" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'rgba(230, 57, 70, 0.6)', fontSize: '0.82rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                        Loading universe...
                    </p>
                </div>
            </div>
        )
    }

    if (error || !artist) {
        return (
            <div className="sm-universe" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255, 234, 234, 0.5)', marginBottom: '1rem' }}>{error || 'Artist not found'}</p>
                    <button className="sm-back-btn" onClick={() => navigate('/home')}>
                        ← Back to Hub
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="sm-universe" onMouseMove={handleMouseMove}>
            {/* Layer 1: Animated gradient */}
            <div className="sm-gradient-bg" aria-hidden="true" />

            {/* Layer 2: Red smoke */}
            <div className="sm-smoke" ref={smokeRef} aria-hidden="true">
                <div className="sm-smoke-layer sm-smoke-layer--1" />
                <div className="sm-smoke-layer sm-smoke-layer--2" />
                <div className="sm-smoke-layer sm-smoke-layer--3" />
            </div>

            {/* Layer 3: Dragon silhouette + fire breath */}
            <div className="sm-dragon" aria-hidden="true" />
            <div className="sm-dragon-fire" aria-hidden="true" />

            {/* Layer 3.5: CSS-only particles */}
            <div className="sm-particles" aria-hidden="true">
                {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
                    <span key={i} className="sm-particle" />
                ))}
            </div>

            {/* Layer 4: Vignette */}
            <div className="sm-vignette" aria-hidden="true" />

            {/* Layer 5: Content */}
            <div className="sm-parallax-container" ref={parallaxRef}>
                <div className="sm-content">
                    {/* Back button */}
                    <div className="sm-entry-anim sm-entry-anim--d1">
                        <button className="sm-back-btn" onClick={() => navigate('/home')}>
                            ← Exit Universe
                        </button>
                    </div>

                    {/* Universe header */}
                    <div className="sm-universe-header sm-entry-anim sm-entry-anim--d2">
                        <span className="sm-universe-kicker">Artist Universe</span>
                        <h1 className="sm-universe-title">{artist.name}</h1>
                        <p className="sm-universe-sub">
                            Delhi underground. Red smoke. Graffiti pressure. Full catalog, live previews, and scene context.
                        </p>
                    </div>

                    {/* Artist Profile (existing component, wrapped in SM theme) */}
                    <div className="sm-entry-anim sm-entry-anim--d3">
                        <ArtistProfile
                            artistId={artist.id}
                            initialArtist={artist}
                            onBack={() => navigate('/home')}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
