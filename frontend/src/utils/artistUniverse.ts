import type { CSSProperties } from 'react'
import { hashString, seededShuffle } from './rotation'
import { findFlagshipTheme } from './flagshipThemes'
import type { FlagshipTheme } from './flagshipThemes'

type AlbumLike = {
    title?: string
    coverUrl?: string
    coverImageUrl?: string
    releaseDate?: string
}

const palettes = [
    ['#d7b179', '#89a4bc', '#8ca580', '#f5eee0'],
    ['#a480df', '#d06f5f', '#f0d9a8', '#edf0f4'],
    ['#6cb0c1', '#d7b16e', '#7c8d65', '#f0ece4'],
    ['#d9738f', '#758fcb', '#d9be73', '#f7ede0'],
    ['#7aa885', '#c89865', '#839ec0', '#f2ede7'],
    ['#9d88df', '#d97a64', '#7fa7a4', '#f8eee6']
]

const toInitials = (name: string) => {
    const parts = name
        .replace(/[^A-Za-z0-9$]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)

    if (!parts.length) return 'HH'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('')
}

const getGradientAngles = (seed: number) => {
    const angles = [115, 135, 155, 205, 225, 245]
    return angles[seed % angles.length]
}

export const buildArtistUniverse = (
    artistName: string,
    genre?: string,
    bio?: string,
    albums: AlbumLike[] = []
) => {
    const seed = hashString(`${artistName}-${genre || ''}-${bio || ''}`)
    const initials = toInitials(artistName)
    const collageImages = seededShuffle(
        albums
            .map(album => album.coverUrl || album.coverImageUrl)
            .filter((value): value is string => !!value),
        seed
    ).slice(0, 6)
    const releaseYears = Array.from(
        new Set(
            albums
                .map(album => album.releaseDate ? new Date(album.releaseDate).getFullYear() : null)
                .filter((value): value is number => !!value && !Number.isNaN(value))
        )
    ).sort((a, b) => a - b)

    /* ── Flagship artist override ──────────────────────────────── */
    const flagship: FlagshipTheme | null = findFlagshipTheme(artistName)

    if (flagship) {
        const bioLine = bio?.split('.')[0]?.trim()
        return {
            style: flagship.cssVars,
            initials,
            watermark: flagship.watermarkText,
            wordmark: artistName.toUpperCase(),
            palette: [
                flagship.palette.primary,
                flagship.palette.secondary,
                flagship.palette.tertiary,
                flagship.palette.text,
            ],
            collageImages,
            releaseYears,
            profileLead: bioLine ? `${bioLine}.` : 'Verified catalog, release history, and artist context.',
            /* Flagship-specific extras */
            isFlagship: true as const,
            flagship,
        }
    }

    /* ── Default seeded-hash system (unchanged) ────────────────── */
    const palette = palettes[seed % palettes.length]
    const accentAngle = getGradientAngles(seed)
    const watermark = artistName.length > 14 ? initials : artistName.toUpperCase()
    const bioLine = bio?.split('.')[0]?.trim()

    const style = {
        '--artist-accent-a': `${palette[0]}30`,
        '--artist-accent-b': `${palette[1]}2c`,
        '--artist-accent-c': `${palette[2]}26`,
        '--artist-accent-d': palette[3],
        '--artist-gradient': `linear-gradient(${accentAngle}deg, ${palette[0]} 0%, ${palette[1]} 56%, ${palette[2]} 100%)`
    } as CSSProperties

    return {
        style,
        initials,
        watermark,
        wordmark: artistName.toUpperCase(),
        palette,
        collageImages,
        releaseYears,
        profileLead: bioLine ? `${bioLine}.` : 'Verified catalog, release history, and artist context.',
        /* Non-flagship */
        isFlagship: false as const,
        flagship: null,
    }
}
