import { memo, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NameEffect, TransitionType } from '../utils/artistUniverse'
import './UniverseTransition.css'

interface UniverseTransitionProps {
    artistName: string
    accentColor: string
    logoUrl?: string
    markText?: string
    label?: string
    transitionType?: TransitionType
    nameEffect?: NameEffect
    duration?: number
    onComplete: () => void
}

type Phase = 'preparing' | 'entering' | 'active' | 'exiting' | 'done'

function UniverseTransition({
    artistName,
    accentColor,
    logoUrl,
    markText,
    label,
    transitionType = 'legacy',
    nameEffect = 'classic',
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

        const activeTimer = window.setTimeout(() => setPhase('active'), fadeInDelay)
        const exitTimer = window.setTimeout(() => setPhase('exiting'), fadeInDelay + holdDuration)
        const completeTimer = window.setTimeout(() => {
            setPhase('done')
            onComplete()
        }, fadeInDelay + holdDuration + exitDuration)

        return () => {
            window.clearTimeout(activeTimer)
            window.clearTimeout(exitTimer)
            window.clearTimeout(completeTimer)
        }
    }, [assetsReady, duration, onComplete])

    const subtitle = label || `ENTERING THE ${artistName.toUpperCase()} UNIVERSE`
    const safeMark = useMemo(() => (markText || artistName.slice(0, 2)).toUpperCase(), [artistName, markText])

    const transitionClassName = useMemo(() => {
        if (phase === 'done') return ''
        return `universe-transition universe-transition--${phase} universe-transition--${transitionType}`
    }, [phase, transitionType])

    if (phase === 'done') return null

    return (
        <div
            className={transitionClassName}
            role="status"
            aria-live="polite"
            aria-label={subtitle}
            style={{ '--ut-accent': accentColor } as CSSProperties}
        >
            <div className="ut-shutter ut-shutter--left" aria-hidden="true" />
            <div className="ut-shutter ut-shutter--right" aria-hidden="true" />
            <div className="ut-glow" />
            <div className="ut-pulse-ring" aria-hidden="true" />
            <div className="ut-centerpiece">
                <div className="ut-brand-block">
                    {logoUrl ? (
                        <div className="ut-logo-container">
                            <img
                                src={logoUrl}
                                alt={`${artistName} logo`}
                                className="ut-logo"
                            />
                            <div className="ut-logo-atmosphere" aria-hidden="true" />
                        </div>
                    ) : (
                        <div className="ut-mark" aria-hidden="true">
                            {safeMark}
                        </div>
                    )}
                    <div className={`ut-copy ut-copy--${nameEffect}`}>
                        <h2 className={`ut-artist-name ut-artist-name--${nameEffect}`}>{artistName}</h2>
                        <div className="ut-line" />
                        <p className="ut-subtitle">{subtitle}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default memo(UniverseTransition)
