import { memo, useEffect, useMemo, useRef, useState } from 'react'
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
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    useEffect(() => {
        if (!logoUrl) {
            setAssetsReady(true)
            return
        }

        let cancelled = false
        const fallbackTimer = window.setTimeout(() => setAssetsReady(true), 900)
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
            window.clearTimeout(fallbackTimer)
        }
    }, [logoUrl])

    useEffect(() => {
        if (!assetsReady) return

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const fadeInDelay = reduced ? 0 : 160
        const holdDuration = reduced ? 0 : Math.max(duration - 400, 200)
        const exitDuration = reduced ? 0 : 240

        setPhase('entering')

        const activeTimer = window.setTimeout(() => setPhase('active'), fadeInDelay)
        const exitTimer = window.setTimeout(() => setPhase('exiting'), fadeInDelay + holdDuration)
        const completeTimer = window.setTimeout(() => {
            setPhase('done')
            onCompleteRef.current()
        }, fadeInDelay + holdDuration + exitDuration)

        return () => {
            window.clearTimeout(activeTimer)
            window.clearTimeout(exitTimer)
            window.clearTimeout(completeTimer)
        }
    }, [assetsReady, duration])

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
            <button className="ut-skip" onClick={onComplete}>Skip intro ↗</button>
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
