import { lyricChallenges, type LyricChallenge } from '../data/lyricChallenges'
import type { GameCatalogArtist, GameCatalogRelease, GameCatalogSong } from '../hooks/useGameCatalog'

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const titleCase = (value: string) => value.replace(/\b\w/g, letter => letter.toUpperCase())

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

const unique = <T,>(items: T[]) => Array.from(new Set(items))

const byNormalizedName = <T extends { name?: string; artistName?: string }>(items: T[], key: 'name' | 'artistName') => {
    const map = new Map<string, T>()
    items.forEach(item => {
        const value = item[key]
        if (!value) return
        map.set(normalize(value), item)
    })
    return map
}

const buildMaskedPrompt = (prompt: string, difficulty: LyricChallenge['difficulty']) => {
    if (difficulty === 'easy') return prompt
    if (difficulty === 'medium') return prompt.replace(/____/g, '____ ____')
    return prompt.replace(/____/g, '____ ____ ____')
}

const ERA_LABELS = [
    { id: 'pioneer', label: 'Pioneer Era', min: -Infinity, max: 2015 },
    { id: 'breakout', label: 'Breakout Era', min: 2016, max: 2018 },
    { id: 'new-guard', label: 'New Guard', min: 2019, max: 2021 },
    { id: 'current-wave', label: 'Current Wave', min: 2022, max: Infinity },
] as const

const CONNECTION_GROUPS: Array<{ id: string; category: string; label: string; clue: string; artists: string[] }> = [
    {
        id: 'kalamkaar',
        category: 'Label',
        label: 'Kalamkaar',
        clue: 'Linked through the Kalamkaar roster.',
        artists: ['KR$NA', 'Karma', 'Deep Kalsi', 'Harjas Harjaayi'],
    },
    {
        id: 'gully-gang',
        category: 'Collective',
        label: 'Gully Gang',
        clue: 'Mumbai street-rap artists from the Gully Gang orbit.',
        artists: ['DIVINE', 'MC Altaf', "D'Evil", 'DopeadelicZ'],
    },
    {
        id: 'seedhe-maut-core',
        category: 'Collective',
        label: 'DL91 Core',
        clue: 'Artists directly tied to the Seedhe Maut / DL91 lane.',
        artists: ['Seedhe Maut', 'Encore ABJ', 'Calm', 'Full Power'],
    },
]

export interface ArcadePlayableTrack extends GameCatalogSong {
    coverArtUrl?: string
    normalizedTitle: string
}

export interface ArcadeLyricCard {
    id: string
    artistId?: number
    songId?: number
    artistName: string
    songTitle: string
    albumTitle?: string
    prompt: string
    maskedPrompt: string
    answers: string[]
    difficulty: LyricChallenge['difficulty']
    coverUrl?: string
}

export interface ArcadeTimelineEvent extends GameCatalogRelease {
    year: number
}

export interface ArcadeSceneQuestion {
    id: string
    category: 'fact' | 'city' | 'year' | 'album' | 'collaborator' | 'wave'
    prompt: string
    answer: string
    options: string[]
    explanation: string
}

export interface ArcadeArtistQuestion {
    id: string
    category: 'cover' | 'artist' | 'city' | 'year' | 'album' | 'collaborator' | 'fact'
    prompt: string
    answer: string
    options: string[]
    mediaUrl?: string
    mediaAlt?: string
    accent?: string
}

export interface ArcadeConnectionGroup {
    id: string
    category: string
    label: string
    clue: string
    artistNames: string[]
}

export interface ArcadeConnectionPuzzle {
    id: string
    groups: ArcadeConnectionGroup[]
    items: string[]
}

export interface ArcadeCatalog {
    artistCount: number
    songCount: number
    releaseCount: number
    artists: GameCatalogArtist[]
    songs: GameCatalogSong[]
    releases: GameCatalogRelease[]
    playableTracks: ArcadePlayableTrack[]
    playableLyrics: ArcadeLyricCard[]
    timelineEvents: ArcadeTimelineEvent[]
    sceneFacts: ArcadeSceneQuestion[]
    artistQuestions: ArcadeArtistQuestion[]
    connectionPuzzles: ArcadeConnectionPuzzle[]
}

const buildOptions = (answer: string, pool: string[], size = 4) => {
    const cleanedPool = unique(pool.filter(option => option && normalize(option) !== normalize(answer)))
    return shuffle([answer, ...shuffle(cleanedPool).slice(0, size - 1)])
}

const buildConnectionPuzzles = (artists: GameCatalogArtist[]) => {
    const artistNameMap = byNormalizedName(artists, 'name')
    const availableGroups: ArcadeConnectionGroup[] = []

    CONNECTION_GROUPS.forEach(group => {
        const present = group.artists.filter(name => artistNameMap.has(normalize(name)))
        if (present.length === 4) {
            availableGroups.push({
                id: group.id,
                category: group.category,
                label: group.label,
                clue: group.clue,
                artistNames: present,
            })
        }
    })

    const cityBuckets = new Map<string, string[]>()
    artists.forEach(artist => {
        if (!artist.city) return
        const list = cityBuckets.get(artist.city) || []
        list.push(artist.name)
        cityBuckets.set(artist.city, list)
    })

    cityBuckets.forEach((names, city) => {
        if (names.length >= 4) {
            availableGroups.push({
                id: `city-${normalize(city)}`,
                category: 'City',
                label: `${city} Scene`,
                clue: `All four artists are strongly associated with ${city}.`,
                artistNames: shuffle(names).slice(0, 4),
            })
        }
    })

    const eraBuckets = new Map<string, string[]>()
    artists.forEach(artist => {
        const firstYear = artist.releaseYears?.[0]
        if (!firstYear) return
        const era = ERA_LABELS.find(item => firstYear >= item.min && firstYear <= item.max)
        if (!era) return
        const list = eraBuckets.get(era.label) || []
        list.push(artist.name)
        eraBuckets.set(era.label, list)
    })

    eraBuckets.forEach((names, label) => {
        if (names.length >= 4) {
            availableGroups.push({
                id: `era-${normalize(label)}`,
                category: 'Era',
                label,
                clue: `These artists broke out in the ${label.toLowerCase()}.`,
                artistNames: shuffle(names).slice(0, 4),
            })
        }
    })

    const selected: ArcadeConnectionGroup[] = []
    const used = new Set<string>()

    availableGroups.forEach(group => {
        if (selected.length >= 4) return
        const hasOverlap = group.artistNames.some(name => used.has(normalize(name)))
        if (hasOverlap) return
        selected.push(group)
        group.artistNames.forEach(name => used.add(normalize(name)))
    })

    if (selected.length < 4) {
        return []
    }

    return [{
        id: 'connections-1',
        groups: selected,
        items: shuffle(selected.flatMap(group => group.artistNames)),
    }]
}

export function buildArcadeCatalog(input: {
    artists: GameCatalogArtist[]
    songs: GameCatalogSong[]
    releases: GameCatalogRelease[]
    artistCount: number
    songCount: number
    releaseCount: number
}): ArcadeCatalog {
    const artists = Array.isArray(input.artists) ? input.artists : []
    const songs = Array.isArray(input.songs) ? input.songs : []
    const releases = Array.isArray(input.releases) ? input.releases : []

    const artistCount = input.artistCount || artists.length
    const songCount = input.songCount || songs.length
    const releaseCount = input.releaseCount || releases.length

    const playableTracks = songs
        .filter(song => !!song.previewUrl)
        .map(song => ({
            ...song,
            coverArtUrl: song.coverUrl,
            normalizedTitle: normalize(song.title),
        }))

    const artistByName = byNormalizedName(artists, 'name')
    const songByArtistAndTitle = new Map<string, GameCatalogSong>()

    songs.forEach(song => {
        songByArtistAndTitle.set(`${normalize(song.artistName)}::${normalize(song.title)}`, song)
    })

    const playableLyrics = lyricChallenges
        .map(challenge => {
            const song = songByArtistAndTitle.get(`${normalize(challenge.artistName)}::${normalize(challenge.songTitle)}`)
            const artist = artistByName.get(normalize(challenge.artistName))
            return {
                id: `${normalize(challenge.artistName)}-${normalize(challenge.songTitle)}-${normalize(challenge.prompt)}`,
                artistId: artist?.id,
                songId: song?.id,
                artistName: artist?.name || challenge.artistName,
                songTitle: song?.title || challenge.songTitle,
                albumTitle: song?.albumTitle,
                prompt: challenge.prompt,
                maskedPrompt: buildMaskedPrompt(challenge.prompt, challenge.difficulty),
                answers: challenge.answers,
                difficulty: challenge.difficulty,
                coverUrl: song?.coverUrl,
            } satisfies ArcadeLyricCard
        })
        .filter((card, index, source) => source.findIndex(item => item.id === card.id) === index)

    const timelineEvents = releases
        .filter(release => !!release.releaseDate)
        .map(release => ({
            ...release,
            year: Number(release.releaseDate?.slice(0, 4) || 0),
        }))
        .filter(release => Number.isFinite(release.year) && release.year > 0)

    const artistNamePool = artists.map(artist => artist.name)

    const sceneFacts: ArcadeSceneQuestion[] = []
    const artistQuestions: ArcadeArtistQuestion[] = []

    artists.forEach(artist => {
        if (artist.city) {
            sceneFacts.push({
                id: `city-${artist.id}`,
                category: 'city',
                prompt: `Which city is ${artist.name} most associated with?`,
                answer: artist.city,
                options: buildOptions(artist.city, artists.map(item => item.city).filter((item): item is string => !!item)),
                explanation: `${artist.name} is tied to the ${artist.city} lane in the HipHopHub catalog.`,
            })

            artistQuestions.push({
                id: `artist-city-${artist.id}`,
                category: 'city',
                prompt: `Which artist belongs to the ${artist.city} scene?`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNamePool),
                accent: artist.city,
            })
        }

        if (artist.facts?.length) {
            const fact = artist.facts[0]
            sceneFacts.push({
                id: `fact-${artist.id}`,
                category: 'fact',
                prompt: `Which artist matches this fact? ${fact}`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNamePool),
                explanation: `This fact is stored directly on ${artist.name}'s HipHopHub profile.`,
            })

            artistQuestions.push({
                id: `artist-fact-${artist.id}`,
                category: 'fact',
                prompt: `Who fits this clue? ${fact}`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNamePool),
            })
        }

        const firstYear = artist.releaseYears?.[0]
        const era = firstYear ? ERA_LABELS.find(item => firstYear >= item.min && firstYear <= item.max) : null
        if (era) {
            sceneFacts.push({
                id: `wave-${artist.id}`,
                category: 'wave',
                prompt: `Which wave best fits ${artist.name} from the catalog timing?`,
                answer: era.label,
                options: buildOptions(era.label, ERA_LABELS.map(item => item.label)),
                explanation: `${artist.name}'s earliest verified release year places them in the ${era.label.toLowerCase()}.`,
            })
        }
    })

    timelineEvents.slice(0, 80).forEach(release => {
        const year = String(release.year)
        sceneFacts.push({
            id: `year-${release.id}`,
            category: 'year',
            prompt: `Which year did "${release.title}" release?`,
            answer: year,
            options: buildOptions(year, timelineEvents.map(item => String(item.year))),
            explanation: `${release.title} is recorded in HipHopHub with a ${year} release year.`,
        })

        artistQuestions.push({
            id: `release-year-${release.id}`,
            category: 'year',
            prompt: `Pick the release year for "${release.title}".`,
            answer: year,
            options: buildOptions(year, timelineEvents.map(item => String(item.year))),
            mediaUrl: release.coverUrl,
            mediaAlt: release.title,
        })

        if ((release.type || '').toUpperCase() === 'ALBUM') {
            sceneFacts.push({
                id: `album-${release.id}`,
                category: 'album',
                prompt: `Which album belongs to ${release.artistName}?`,
                answer: release.title,
                options: buildOptions(release.title, releases.filter(item => (item.type || '').toUpperCase() === 'ALBUM').map(item => item.title)),
                explanation: `${release.title} is a verified album under ${release.artistName}.`,
            })
        }

        if ((release.type || '').toUpperCase() === 'APPEARS_ON') {
            sceneFacts.push({
                id: `collab-${release.id}`,
                category: 'collaborator',
                prompt: `Who is officially credited on "${release.title}"?`,
                answer: release.artistName,
                options: buildOptions(release.artistName, artistNamePool),
                explanation: `${release.artistName} is the credited DHH artist mapped to this collaboration in the catalog.`,
            })
        }
    })

    playableTracks.slice(0, 120).forEach(song => {
        artistQuestions.push({
            id: `track-${song.id}`,
            category: 'artist',
            prompt: `Who recorded "${song.title}"?`,
            answer: song.artistName,
            options: buildOptions(song.artistName, artistNamePool),
            mediaUrl: song.coverArtUrl,
            mediaAlt: song.title,
        })

        if (song.coverArtUrl) {
            artistQuestions.push({
                id: `cover-${song.id}`,
                category: 'cover',
                prompt: `Which artist owns this cover?`,
                answer: song.artistName,
                options: buildOptions(song.artistName, artistNamePool),
                mediaUrl: song.coverArtUrl,
                mediaAlt: song.title,
            })
        }
    })

    const connectionPuzzles = buildConnectionPuzzles(artists)

    return {
        artistCount,
        songCount,
        releaseCount,
        artists,
        songs,
        releases,
        playableTracks,
        playableLyrics,
        timelineEvents,
        sceneFacts: shuffle(sceneFacts),
        artistQuestions: shuffle(artistQuestions),
        connectionPuzzles,
    }
}

export const formatCatalogNumber = (value: number, fallback: string) => (value > 0 ? value.toLocaleString() : fallback)

export const buildCatalogSummary = (catalog: ArcadeCatalog) => ({
    artistText: formatCatalogNumber(catalog.artistCount, 'verified artist deck'),
    songText: formatCatalogNumber(catalog.songCount, 'playable song pool'),
    releaseText: formatCatalogNumber(catalog.releaseCount, 'official release archive'),
    lyricText: formatCatalogNumber(catalog.playableLyrics.length, 'lyric cards'),
})

export const prettyCategoryLabel = (value: string) => titleCase(value.replace(/-/g, ' '))

