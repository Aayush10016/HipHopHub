/**
 * UniverseTransition — Cinematic full-screen overlay shown when
 * entering an artist universe.
 *
 * Phases:
 * 1. Fade to dark (0 → 400ms)
 * 2. Artist name + "ENTERING THE __ UNIVERSE" (400 → hold)
 * 3. Fade out + call onComplete (after `duration` ms)
 *
 * All animations use GPU-composited transform + opacity only.
 * Respects prefers-reduced-motion via CSS.
 */

import { useEffect, useState } from 'react'
import './UniverseTransition.css'

interface UniverseTransitionProps {
    artistName: string
    accentColor: string
    label?: string
    duration?: number
    onComplete: () => void
}

type Phase = 'entering' | 'holding' | 'exiting' | 'done'

export default function UniverseTransition({
    artistName,
    accentColor,
    label,
    duration = 1400,
    onComplete,
}: UniverseTransitionProps) {
    const [phase, setPhase] = useState<Phase>('entering')

    useEffect(() => {
        const holdDelay = 400
        const holdDuration = duration - holdDelay - 350
        const exitDuration = 350

        // Phase 1 → Phase 2
        const t1 = setTimeout(() => setPhase('holding'), holdDelay)

        // Phase 2 → Phase 3
        const t2 = setTimeout(() => setPhase('exiting'), holdDelay + Math.max(holdDuration, 600))

        // Phase 3 → done
        const t3 = setTimeout(() => {
            setPhase('done')
            onComplete()
        }, holdDelay + Math.max(holdDuration, 600) + exitDuration)

        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
        }
    }, [duration, onComplete])

    if (phase === 'done') return null

    const subtitle = label || `ENTERING THE ${artistName.toUpperCase()} UNIVERSE`

    return (
        <div
            className={`universe-transition universe-transition--${phase === 'holding' ? 'entering' : phase}`}
            role="status"
            aria-live="polite"
            aria-label={subtitle}
        >
            {/* Accent glow behind name */}
            <div
                className="ut-glow"
                style={{ background: accentColor }}
            />

            {/* Artist name */}
            <h2 className="ut-artist-name">{artistName}</h2>

            {/* Decorative line */}
            <div className="ut-line" style={{ background: accentColor }} />

            {/* Subtitle */}
            <p className="ut-subtitle">{subtitle}</p>
        </div>
    )
}
