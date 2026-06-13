import { useEffect, useMemo, useState } from 'react'
import './UniverseTransition.css'

interface UniverseTransitionProps {
    artistName: string
    accentColor: string
    logoUrl?: string
    label?: string
    duration?: number
    onComplete: () => void
}

type Phase = 'preparing' | 'entering' | 'logo' | 'holding' | 'exiting' | 'done'

export default function UniverseTransition({
    artistName,
    accentColor,
    logoUrl,
    label,
    duration = 2200,
    onComplete,
}: UniverseTransitionProps) {
    const [phase, setPhase] = useState<Phase>('preparing')
    const [assetsReady, setAssetsReady] = useState(!logoUrl)

    useEffect(() => {
        if (!logoUrl) {
            setAssetsReady(true)
            return
        }

        let cancelled = false
        const img = new Image()
        img.onload = () => {
            if (!cancelled) setAssetsReady(true)
        }
        img.onerror = () => {
            if (!cancelled) setAssetsReady(true)
        }
        img.src = logoUrl

        return () => {
            cancelled = true
        }
    }, [logoUrl])

    useEffect(() => {
        if (!assetsReady) return

        const fadeInDelay = 520
        const logoDelay = logoUrl ? 760 : 0
        const holdDelay = fadeInDelay + logoDelay
        const holdDuration = Math.max(duration - holdDelay - 460, 700)
        const exitDuration = 460

        setPhase('entering')

        const enterTimer = setTimeout(() => {
            setPhase(logoUrl ? 'logo' : 'holding')
        }, fadeInDelay)

        const logoTimer = logoUrl
            ? setTimeout(() => setPhase('holding'), fadeInDelay + logoDelay)
            : null

        const exitTimer = setTimeout(() => {
            setPhase('exiting')
        }, holdDelay + holdDuration)

        const completeTimer = setTimeout(() => {
            setPhase('done')
            onComplete()
        }, holdDelay + holdDuration + exitDuration)

        return () => {
            clearTimeout(enterTimer)
            if (logoTimer) clearTimeout(logoTimer)
            clearTimeout(exitTimer)
            clearTimeout(completeTimer)
        }
    }, [assetsReady, duration, logoUrl, onComplete])

    const subtitle = label || `ENTERING THE ${artistName.toUpperCase()} UNIVERSE`

    const transitionClassName = useMemo(() => {
        if (phase === 'holding' || phase === 'logo') {
            return 'universe-transition universe-transition--active'
        }

        return `universe-transition universe-transition--${phase}`
    }, [phase])

    if (phase === 'done') return null

    return (
        <div
            className={transitionClassName}
            role="status"
            aria-live="polite"
            aria-label={subtitle}
        >
            <div className="ut-glow" style={{ background: accentColor }} />

            {logoUrl && phase === 'logo' && (
                <div className="ut-logo-container">
                    <img
                        src={logoUrl}
                        alt={`${artistName} logo`}
                        className="ut-logo"
                    />
                    <div className="ut-logo-atmosphere" />
                </div>
            )}

            {phase === 'holding' && (
                <>
                    <h2 className="ut-artist-name">{artistName}</h2>
                    <div className="ut-line" style={{ background: accentColor }} />
                    <p className="ut-subtitle">{subtitle}</p>
                </>
            )}
        </div>
    )
}
