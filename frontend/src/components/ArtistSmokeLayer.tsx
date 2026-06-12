/**
 * ArtistSmokeLayer — CSS-only animated smoke effect.
 *
 * Uses layered radial gradients with mix-blend-mode for depth.
 * Three smoke layers animate at different speeds to create
 * organic, cinematic atmosphere.
 */

import { useMemo } from 'react'
import type { FlagshipSmoke } from '../utils/flagshipThemes'

interface Props {
    smoke: FlagshipSmoke
    className?: string
}

const speedMap = { slow: 18, medium: 12, fast: 8 }

export default function ArtistSmokeLayer({ smoke, className = '' }: Props) {
    const layers = useMemo(() => {
        const duration = speedMap[smoke.speed]
        return Array.from({ length: smoke.layers }, (_, i) => {
            const offset = i * 33
            const scale = 1 + i * 0.15
            const layerOpacity = smoke.opacity * (1 - i * 0.2)
            const delay = -(i * (duration / smoke.layers))
            return { offset, scale, layerOpacity, delay, duration: duration + i * 4 }
        })
    }, [smoke])

    return (
        <div
            className={`artist-smoke-layer ${className}`}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}
        >
            {layers.map((layer, i) => (
                <div
                    key={i}
                    className="artist-smoke-cloud"
                    style={{
                        position: 'absolute',
                        inset: `-${40 + layer.offset}%`,
                        background: `radial-gradient(ellipse at ${30 + i * 20}% ${40 + i * 15}%, ${smoke.color}, transparent 70%)`,
                        opacity: layer.layerOpacity,
                        mixBlendMode: 'screen',
                        filter: `blur(${60 + i * 20}px)`,
                        transform: `scale(${layer.scale})`,
                        animation: `smokeFloat${i} ${layer.duration}s ease-in-out ${layer.delay}s infinite`,
                    }}
                />
            ))}
            <style>{`
                @keyframes smokeFloat0 {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: ${layers[0]?.layerOpacity ?? 0.2}; }
                    33% { transform: translate3d(4%, -3%, 0) scale(1.08); opacity: ${(layers[0]?.layerOpacity ?? 0.2) * 1.15}; }
                    66% { transform: translate3d(-3%, 2%, 0) scale(0.95); opacity: ${(layers[0]?.layerOpacity ?? 0.2) * 0.85}; }
                }
                @keyframes smokeFloat1 {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1.15); opacity: ${layers[1]?.layerOpacity ?? 0.16}; }
                    40% { transform: translate3d(-5%, 4%, 0) scale(1.22); opacity: ${(layers[1]?.layerOpacity ?? 0.16) * 1.2}; }
                    70% { transform: translate3d(3%, -2%, 0) scale(1.08); opacity: ${(layers[1]?.layerOpacity ?? 0.16) * 0.8}; }
                }
                @keyframes smokeFloat2 {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1.3); opacity: ${layers[2]?.layerOpacity ?? 0.12}; }
                    50% { transform: translate3d(6%, 3%, 0) scale(1.4); opacity: ${(layers[2]?.layerOpacity ?? 0.12) * 1.3}; }
                }
            `}</style>
        </div>
    )
}
