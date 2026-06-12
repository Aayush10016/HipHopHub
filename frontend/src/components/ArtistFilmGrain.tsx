/**
 * ArtistFilmGrain — subtle cinematic grain overlay.
 *
 * Creates a noise texture via inline SVG data URI, animated
 * at low frequency for a film-like aesthetic.  Used by artists
 * with filmGrain: true (e.g. Talha Anjum).
 */

import { memo } from 'react'

interface Props {
    opacity?: number
    className?: string
}

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`

function ArtistFilmGrain({ opacity = 0.045, className = '' }: Props) {
    return (
        <div
            className={`artist-film-grain ${className}`}
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 6,
                opacity,
                mixBlendMode: 'overlay',
                backgroundImage: GRAIN_SVG,
                backgroundRepeat: 'repeat',
                backgroundSize: '128px 128px',
                animation: 'grainShift 0.5s steps(4) infinite',
            }}
        >
            <style>{`
                @keyframes grainShift {
                    0%   { transform: translate3d(0, 0, 0); }
                    25%  { transform: translate3d(-2px, 2px, 0); }
                    50%  { transform: translate3d(2px, -1px, 0); }
                    75%  { transform: translate3d(-1px, -2px, 0); }
                    100% { transform: translate3d(0, 0, 0); }
                }
            `}</style>
        </div>
    )
}

export default memo(ArtistFilmGrain)
