import { memo, useEffect, useMemo, useState } from 'react'
import './UniverseTransition.css'

interface UniverseTransitionProps {
    artistName: string
    accentColor: string
    logoUrl?: string
    label?: string
    duration?: number
    onComplete: () => void
}

type Phase = 'preparing' | 'entering' | 'active' | 'exiting' | 'done'

function UniverseTransition({
    artistName,
    accentColor,
    logoUrl,
    label,
    duration = 2600,
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
        const holdDuration = Math.max(duration - 980, 1800)
        const exitDuration = 460

        setPhase('entering')

        const activeTimer = setTimeout(() => setPhase('active'), fadeInDelay)
        const exitTimer = setTimeout(() => setPhase('exiting'), fadeInDelay + holdDuration)
        const completeTimer = setTimeout(() => {
            setPhase('done')
            onComplete()
        }, fadeInDelay + holdDuration + exitDuration)

        return () => {
            clearTimeout(activeTimer)
            clearTimeout(exitTimer)
            clearTimeout(completeTimer)
        }
    }, [assetsReady, duration, onComplete])

    const subtitle = label || `ENTERING THE ${artistName.toUpperCase()} UNIVERSE`

    const transitionClassName = useMemo(() => {
        if (phase === 'done') return ''
        return `universe-transition universe-transition--${phase}`
    }, [phase])

    if (phase === 'done') return null

    return (
        <div className={transitionClassName} role="status" aria-live="polite" aria-label={subtitle}>
            <div className="ut-glow" style={{ background: accentColor }} />
            <div className="ut-centerpiece">
                {logoUrl && (
                    <div className="ut-logo-container">
                        <img
                            src={logoUrl}
                            alt={`${artistName} logo`}
                            className="ut-logo"
                        />
                        <div className="ut-logo-atmosphere" />
                    </div>
                )}
                <div className="ut-copy">
                    <h2 className="ut-artist-name">{artistName}</h2>
                    <div className="ut-line" style={{ background: accentColor }} />
                    <p className="ut-subtitle">{subtitle}</p>
                </div>
            </div>
        </div>
    )
}

export default memo(UniverseTransition)
