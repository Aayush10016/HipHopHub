import type { CSSProperties } from 'react'

type TransitionType = 'legacy' | 'pulse' | 'cinematic' | 'split'
type NameEffect = 'classic' | 'sharp' | 'soft-glow' | 'chrome' | 'shimmer' | 'warm-pulse'

interface AlbumLike {
    title?: string
    coverUrl?: string
    coverImageUrl?: string
    releaseDate?: string
}

interface ArtistThemeOverride {
    palette: {
        primary: string
        secondary: string
        tertiary: string
        text: string
        surface: string
    }
    transitionType?: TransitionType
    nameEffect?: NameEffect
    label?: string
    logoUrl?: string
    markText?: string
}

export interface ArtistUniverseConfig {
    slug: string
    initials: string
    markText: string
    label: string
    transitionType: TransitionType
    nameEffect: NameEffect
    logoUrl?: string
    profileLead: string
    collageImages: string[]
    releaseYears: string[]
    watermark: string
    wordmark: string
    palette: {
        primary: string
        secondary: string
        tertiary: string
        text: string
        surface: string
    }
    style: CSSProperties
    isFlagship: boolean
    flagship: {
        id: string
    }
}

const SEEDHE_MAUT_LOGO_URL = '/assets/seedhe-maut-logo-20260613.png'

const SPECIAL_THEMES: Record<string, ArtistThemeOverride> = {
    'seedhe-maut': {
        palette: {
            primary: '#e63946',
            secondary: '#3f0812',
            tertiary: '#12040b',
            text: '#fff5f5',
            surface: 'rgba(22, 8, 12, 0.78)',
        },
        transitionType: 'legacy',
        nameEffect: 'classic',
        label: 'ENTERING THE SEEDHE MAUT UNIVERSE',
        logoUrl: SEEDHE_MAUT_LOGO_URL,
        markText: 'SM',
    },
    'karan-aujla': {
        palette: {
            primary: '#d4a84c',
            secondary: '#5a3c10',
            tertiary: '#120c04',
            text: '#fff7e6',
            surface: 'rgba(24, 17, 6, 0.76)',
        },
        transitionType: 'cinematic',
        nameEffect: 'shimmer',
    },
    'kr-na': {
        palette: {
            primary: '#f2f2f2',
            secondary: '#991b1b',
            tertiary: '#09090b',
            text: '#ffffff',
            surface: 'rgba(13, 13, 16, 0.82)',
        },
        transitionType: 'split',
        nameEffect: 'sharp',
        markText: 'KR$NA',
    },
    'divine': {
        palette: {
            primary: '#6da0ff',
            secondary: '#1d365f',
            tertiary: '#090f1b',
            text: '#edf4ff',
            surface: 'rgba(9, 15, 27, 0.82)',
        },
        transitionType: 'pulse',
        nameEffect: 'soft-glow',
    },
    'mc-stan': {
        palette: {
            primary: '#d8ccff',
            secondary: '#5d3d96',
            tertiary: '#0f091a',
            text: '#f7f2ff',
            surface: 'rgba(15, 9, 26, 0.78)',
        },
        transitionType: 'cinematic',
        nameEffect: 'chrome',
    },
    'emiway-bantai': {
        palette: {
            primary: '#ff8a3d',
            secondary: '#6b2400',
            tertiary: '#120805',
            text: '#fff3eb',
            surface: 'rgba(20, 9, 5, 0.8)',
        },
        transitionType: 'pulse',
        nameEffect: 'warm-pulse',
    },
}

const GENERIC_EFFECTS: NameEffect[] = ['classic', 'sharp', 'soft-glow', 'chrome', 'shimmer', 'warm-pulse']
const GENERIC_TRANSITIONS: TransitionType[] = ['legacy', 'pulse', 'cinematic', 'split']

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const hashString = (input: string) => {
    let hash = 0
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

const normalizeArtistName = (name: string) => {
    const compact = name
        .normalize('NFKD')
        .replace(/[^\w\s$-]/g, '')
        .replace(/\$/g, '-')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')

    return compact || 'artist'
}

const hslToHex = (h: number, s: number, l: number) => {
    const hue = ((h % 360) + 360) % 360
    const sat = clamp(s, 0, 100) / 100
    const light = clamp(l, 0, 100) / 100

    const c = (1 - Math.abs(2 * light - 1)) * sat
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
    const m = light - c / 2

    let r = 0
    let g = 0
    let b = 0

    if (hue < 60) [r, g, b] = [c, x, 0]
    else if (hue < 120) [r, g, b] = [x, c, 0]
    else if (hue < 180) [r, g, b] = [0, c, x]
    else if (hue < 240) [r, g, b] = [0, x, c]
    else if (hue < 300) [r, g, b] = [x, 0, c]
    else [r, g, b] = [c, 0, x]

    const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const hexToRgb = (hex: string) => {
    const normalized = hex.replace('#', '')
    const safe = normalized.length === 3
        ? normalized.split('').map(char => char + char).join('')
        : normalized

    const int = Number.parseInt(safe, 16)
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
    }
}

const rgba = (hex: string, alpha: number) => {
    const { r, g, b } = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const buildSeededPalette = (name: string, genre?: string) => {
    const hash = hashString(`${name}|${genre || ''}`)
    const hue = hash % 360
    const companionHue = (hue + 28 + (hash % 54)) % 360
    const accent = hslToHex(hue, 82, 60)
    const secondary = hslToHex(companionHue, 76, 44)
    const tertiary = hslToHex((hue + 180) % 360, 36, 8)
    const text = hslToHex(hue, 28, 95)
    const surface = `rgba(${hexToRgb(tertiary).r}, ${hexToRgb(tertiary).g}, ${hexToRgb(tertiary).b}, 0.78)`

    return {
        primary: accent,
        secondary,
        tertiary,
        text,
        surface,
    }
}

const buildInitials = (name: string) => {
    const tokens = name
        .replace(/[^\w\s$]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)

    if (tokens.length === 0) return 'HH'
    if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
    return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase()
}

const buildMarkText = (name: string) => {
    const cleaned = name.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= 6) return cleaned.toUpperCase()
    return buildInitials(cleaned)
}

const buildReleaseYears = (albums: AlbumLike[]) => Array.from(
    new Set(
        albums
            .map(album => album.releaseDate ? new Date(album.releaseDate).getFullYear() : null)
            .filter((year): year is number => !!year && !Number.isNaN(year))
    )
).sort((a, b) => a - b).map(String)

const buildCollageImages = (albums: AlbumLike[]) => {
    const images = albums
        .map(album => album.coverUrl || album.coverImageUrl)
        .filter((cover): cover is string => !!cover)

    return Array.from(new Set(images)).slice(0, 9)
}

const buildLead = (name: string, genre?: string, bio?: string) => {
    if (bio?.trim()) {
        const firstSentence = bio.split('.').map(part => part.trim()).find(Boolean)
        if (firstSentence) {
            return `${firstSentence}${firstSentence.endsWith('.') ? '' : '.'}`
        }
    }

    const genreLabel = genre?.trim() || 'desi hip-hop'
    return `Verified ${genreLabel} releases, singles, collaborations, and catalog context for ${name}.`
}

const buildTransitionLabel = (name: string, override?: string) => override || `ENTERING ${name.toUpperCase()}`

const getThemeOverride = (slug: string) => SPECIAL_THEMES[slug]

export const buildArtistUniverse = (
    name: string,
    genre?: string,
    bio?: string,
    albums: AlbumLike[] = []
): ArtistUniverseConfig => {
    const safeName = name || 'HipHopHub Artist'
    const slug = normalizeArtistName(safeName)
    const baseHash = hashString(`${safeName}|${genre || ''}`)
    const override = getThemeOverride(slug)
    const palette = override?.palette || buildSeededPalette(safeName, genre)
    const transitionType = override?.transitionType || GENERIC_TRANSITIONS[baseHash % GENERIC_TRANSITIONS.length]
    const nameEffect = override?.nameEffect || GENERIC_EFFECTS[(baseHash >> 2) % GENERIC_EFFECTS.length]
    const releaseYears = buildReleaseYears(albums)
    const collageImages = buildCollageImages(albums)
    const initials = buildInitials(safeName)
    const markText = override?.markText || buildMarkText(safeName)
    const watermark = markText

    const style: CSSProperties = {
        '--artist-accent-a': rgba(palette.primary, 0.22),
        '--artist-accent-b': rgba(palette.secondary, 0.18),
        '--artist-accent-c': rgba(palette.primary, 0.08),
        '--artist-accent-d': palette.text,
        '--artist-universe-bg': `linear-gradient(180deg, ${palette.tertiary} 0%, ${hslToHex((baseHash + 18) % 360, 34, 5)} 46%, ${palette.tertiary} 100%)`,
        '--artist-universe-gradient': `
            radial-gradient(118% 82% at 14% 12%, ${rgba(palette.primary, 0.16)} 0%, transparent 58%),
            radial-gradient(84% 62% at 86% 16%, ${rgba(palette.secondary, 0.16)} 0%, transparent 52%),
            linear-gradient(180deg, ${rgba(palette.tertiary, 0.12)} 0%, ${rgba(palette.tertiary, 0.5)} 100%)
        `,
        '--artist-universe-top-veil': `linear-gradient(180deg, ${rgba(palette.tertiary, 0.9)} 0%, ${rgba(palette.tertiary, 0.56)} 16%, ${rgba(palette.tertiary, 0.12)} 42%, transparent 68%)`,
        '--artist-universe-bottom-veil': `linear-gradient(180deg, transparent 0%, ${rgba(palette.tertiary, 0.18)} 36%, ${rgba(palette.tertiary, 0.62)} 74%, ${rgba(palette.tertiary, 0.92)} 100%)`,
        '--artist-universe-vignette': `radial-gradient(124% 84% at center, transparent 28%, ${rgba(palette.tertiary, 0.24)} 62%, ${rgba(palette.tertiary, 0.74)} 100%)`,
        '--artist-universe-line': `linear-gradient(90deg, ${rgba(palette.primary, 0.68)}, ${rgba(palette.primary, 0)})`,
        '--artist-universe-kicker': rgba(palette.primary, 0.78),
        '--artist-universe-text': palette.text,
        '--artist-universe-subtext': rgba(palette.text, 0.76),
        '--artist-universe-surface': palette.surface,
        '--artist-universe-glow': rgba(palette.primary, 0.22),
    } as CSSProperties

    return {
        slug,
        initials,
        markText,
        label: buildTransitionLabel(safeName, override?.label),
        transitionType,
        nameEffect,
        logoUrl: override?.logoUrl,
        profileLead: buildLead(safeName, genre, bio),
        collageImages,
        releaseYears,
        watermark,
        wordmark: safeName.toUpperCase(),
        palette,
        style,
        isFlagship: true,
        flagship: {
            id: slug,
        },
    }
}

export type { AlbumLike, NameEffect, TransitionType }
