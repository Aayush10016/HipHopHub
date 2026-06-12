/**
 * Flagship artist themes — hand-crafted identities for the top 5 artists.
 *
 * Every color, particle shape, smoke tint, and atmosphere keyword was chosen
 * to match the artist's real-world aesthetic.  Non-flagship artists continue
 * to use the seeded-hash palette system in artistUniverse.ts.
 */

import type { CSSProperties } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FlagshipParticles {
    shape: 'circle' | 'square' | 'geometric' | 'abstract'
    color: string
    glowColor: string
    count: number
    speed: number
    glow: boolean
    sizeRange: [number, number]
}

export interface FlagshipSmoke {
    color: string
    opacity: number
    speed: 'slow' | 'medium' | 'fast'
    layers: number
}

export interface FlagshipTheme {
    id: string
    matchNames: string[]
    palette: {
        primary: string
        secondary: string
        tertiary: string
        text: string
        glow: string
    }
    gradientStops: string[]
    gradientAngle: number
    smoke: FlagshipSmoke
    particles: FlagshipParticles
    atmosphere: string
    filmGrain: boolean
    watermarkText: string
    moodPrimary: string
    moodSecondary: string
    atmosphereLabel: string
    cssVars: CSSProperties
}

/* ------------------------------------------------------------------ */
/*  Themes                                                             */
/* ------------------------------------------------------------------ */

const FLAGSHIP_THEMES: FlagshipTheme[] = [
    /* ── Seedhe Maut ─────────────────────────────────────────────── */
    {
        id: 'seedhe-maut',
        matchNames: [
            'seedhe maut',
            'seedhe maut inc',
            'seedhe maut inc.',
            'sm',
        ],
        palette: {
            primary: '#e63946',
            secondary: '#1a1a2e',
            tertiary: '#2b0f0f',
            text: '#ffeaea',
            glow: 'rgba(230, 57, 70, 0.35)',
        },
        gradientStops: [
            '#e63946 0%',
            '#8b1a1a 35%',
            '#1a1a2e 70%',
            '#0d0d15 100%',
        ],
        gradientAngle: 145,
        smoke: {
            color: '#e63946',
            opacity: 0.22,
            speed: 'medium',
            layers: 3,
        },
        particles: {
            shape: 'circle',
            color: '#e63946',
            glowColor: 'rgba(230, 57, 70, 0.6)',
            count: 55,
            speed: 0.4,
            glow: true,
            sizeRange: [2, 6],
        },
        atmosphere: 'delhi-underground',
        filmGrain: false,
        watermarkText: 'SM',
        moodPrimary: 'Underground',
        moodSecondary: 'Aggressive',
        atmosphereLabel: 'Delhi graffiti pressure',
        cssVars: {
            '--artist-accent-a': 'rgba(230, 57, 70, 0.28)',
            '--artist-accent-b': 'rgba(139, 26, 26, 0.22)',
            '--artist-accent-c': 'rgba(26, 26, 46, 0.18)',
            '--artist-accent-d': '#ffeaea',
            '--artist-gradient':
                'linear-gradient(145deg, #e63946 0%, #8b1a1a 35%, #1a1a2e 70%, #0d0d15 100%)',
        } as CSSProperties,
    },

    /* ── KR$NA ───────────────────────────────────────────────────── */
    {
        id: 'krsna',
        matchNames: ['kr$na', 'krsna', 'kr$na (indian rapper)', 'krishna kaul'],
        palette: {
            primary: '#00f0ff',
            secondary: '#0a0a2e',
            tertiary: '#061428',
            text: '#e0f7ff',
            glow: 'rgba(0, 240, 255, 0.35)',
        },
        gradientStops: [
            '#00f0ff 0%',
            '#0066cc 30%',
            '#0a0a2e 65%',
            '#050510 100%',
        ],
        gradientAngle: 135,
        smoke: {
            color: '#00a8ff',
            opacity: 0.18,
            speed: 'fast',
            layers: 3,
        },
        particles: {
            shape: 'geometric',
            color: '#00f0ff',
            glowColor: 'rgba(0, 240, 255, 0.55)',
            count: 60,
            speed: 0.55,
            glow: true,
            sizeRange: [2, 5],
        },
        atmosphere: 'cyberpunk',
        filmGrain: false,
        watermarkText: 'KR$NA',
        moodPrimary: 'Voltage',
        moodSecondary: 'Digital',
        atmosphereLabel: 'cyber warfare frequency',
        cssVars: {
            '--artist-accent-a': 'rgba(0, 240, 255, 0.22)',
            '--artist-accent-b': 'rgba(0, 102, 204, 0.18)',
            '--artist-accent-c': 'rgba(10, 10, 46, 0.16)',
            '--artist-accent-d': '#e0f7ff',
            '--artist-gradient':
                'linear-gradient(135deg, #00f0ff 0%, #0066cc 30%, #0a0a2e 65%, #050510 100%)',
        } as CSSProperties,
    },

    /* ── Talha Anjum ─────────────────────────────────────────────── */
    {
        id: 'talha-anjum',
        matchNames: ['talha anjum', 'anjum'],
        palette: {
            primary: '#d4a54a',
            secondary: '#0d0d0d',
            tertiary: '#1a1508',
            text: '#fff5e0',
            glow: 'rgba(212, 165, 74, 0.3)',
        },
        gradientStops: [
            '#d4a54a 0%',
            '#8a6b2a 28%',
            '#1a1508 60%',
            '#0a0a08 100%',
        ],
        gradientAngle: 155,
        smoke: {
            color: '#d4a54a',
            opacity: 0.16,
            speed: 'slow',
            layers: 3,
        },
        particles: {
            shape: 'circle',
            color: '#d4a54a',
            glowColor: 'rgba(212, 165, 74, 0.45)',
            count: 40,
            speed: 0.25,
            glow: true,
            sizeRange: [1, 4],
        },
        atmosphere: 'cinematic-noir',
        filmGrain: true,
        watermarkText: 'ANJUM',
        moodPrimary: 'Nocturnal',
        moodSecondary: 'Cinematic',
        atmosphereLabel: 'Karachi nights, gold-lit tension',
        cssVars: {
            '--artist-accent-a': 'rgba(212, 165, 74, 0.24)',
            '--artist-accent-b': 'rgba(138, 107, 42, 0.18)',
            '--artist-accent-c': 'rgba(26, 21, 8, 0.14)',
            '--artist-accent-d': '#fff5e0',
            '--artist-gradient':
                'linear-gradient(155deg, #d4a54a 0%, #8a6b2a 28%, #1a1508 60%, #0a0a08 100%)',
        } as CSSProperties,
    },

    /* ── Divine ───────────────────────────────────────────────────── */
    {
        id: 'divine',
        matchNames: ['divine', 'vivian fernandes'],
        palette: {
            primary: '#e8a838',
            secondary: '#2a1810',
            tertiary: '#1a1208',
            text: '#fff3d6',
            glow: 'rgba(232, 168, 56, 0.3)',
        },
        gradientStops: [
            '#e8a838 0%',
            '#c47820 28%',
            '#2a1810 62%',
            '#0f0a06 100%',
        ],
        gradientAngle: 140,
        smoke: {
            color: '#e8a838',
            opacity: 0.2,
            speed: 'medium',
            layers: 3,
        },
        particles: {
            shape: 'circle',
            color: '#e8a838',
            glowColor: 'rgba(232, 168, 56, 0.5)',
            count: 50,
            speed: 0.35,
            glow: true,
            sizeRange: [2, 5],
        },
        atmosphere: 'mumbai-gully',
        filmGrain: false,
        watermarkText: 'DIVINE',
        moodPrimary: 'Street',
        moodSecondary: 'Raw',
        atmosphereLabel: 'Mumbai gully amber',
        cssVars: {
            '--artist-accent-a': 'rgba(232, 168, 56, 0.26)',
            '--artist-accent-b': 'rgba(196, 120, 32, 0.2)',
            '--artist-accent-c': 'rgba(42, 24, 16, 0.16)',
            '--artist-accent-d': '#fff3d6',
            '--artist-gradient':
                'linear-gradient(140deg, #e8a838 0%, #c47820 28%, #2a1810 62%, #0f0a06 100%)',
        } as CSSProperties,
    },

    /* ── Chaar Diwaari ───────────────────────────────────────────── */
    {
        id: 'chaar-diwaari',
        matchNames: ['chaar diwaari', 'chaar diwari', '4 diwaari'],
        palette: {
            primary: '#9b59b6',
            secondary: '#1a0a2e',
            tertiary: '#120822',
            text: '#f0e0ff',
            glow: 'rgba(155, 89, 182, 0.35)',
        },
        gradientStops: [
            '#9b59b6 0%',
            '#6c3483 30%',
            '#1a0a2e 65%',
            '#08040f 100%',
        ],
        gradientAngle: 160,
        smoke: {
            color: '#9b59b6',
            opacity: 0.2,
            speed: 'slow',
            layers: 3,
        },
        particles: {
            shape: 'abstract',
            color: '#9b59b6',
            glowColor: 'rgba(155, 89, 182, 0.5)',
            count: 45,
            speed: 0.3,
            glow: true,
            sizeRange: [2, 7],
        },
        atmosphere: 'surreal-dream',
        filmGrain: false,
        watermarkText: 'CD',
        moodPrimary: 'Experimental',
        moodSecondary: 'Surreal',
        atmosphereLabel: 'purple dreamscape static',
        cssVars: {
            '--artist-accent-a': 'rgba(155, 89, 182, 0.24)',
            '--artist-accent-b': 'rgba(108, 52, 131, 0.2)',
            '--artist-accent-c': 'rgba(26, 10, 46, 0.16)',
            '--artist-accent-d': '#f0e0ff',
            '--artist-gradient':
                'linear-gradient(160deg, #9b59b6 0%, #6c3483 30%, #1a0a2e 65%, #08040f 100%)',
        } as CSSProperties,
    },
]

/* ------------------------------------------------------------------ */
/*  Lookup                                                             */
/* ------------------------------------------------------------------ */

export const findFlagshipTheme = (
    artistName: string,
): FlagshipTheme | null => {
    const normalised = artistName.toLowerCase().trim()
    return (
        FLAGSHIP_THEMES.find((theme) =>
            theme.matchNames.some((name) => normalised === name || normalised.includes(name)),
        ) ?? null
    )
}

export { FLAGSHIP_THEMES }
