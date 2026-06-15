import { lyricChallenges, type LyricChallenge } from '../data/lyricChallenges'

export interface GameCatalogArtist {
    id: number
    name: string
    genre?: string
    bio?: string
    imageUrl?: string
    city?: string
    facts: string[]
    releaseYears: number[]
    releaseCount: number
    songCount: number
    collectives?: string[]
    labels?: string[]
}

export interface GameCatalogSong {
    id: number
    title: string
    artistId: number
    artistName: string
    previewUrl?: string
    audio?: string
    coverUrl?: string
    youtubeUrl?: string
    releaseDate?: string
    albumTitle?: string
    albumType?: string
}

export interface GameCatalogRelease {
    id: number
    title: string
    artistId: number
    artistName: string
    releaseDate?: string
    type?: string
    coverUrl?: string
    youtubeUrl?: string
}

export interface GameCatalogResponse {
    artists: GameCatalogArtist[]
    songs: GameCatalogSong[]
    releases: GameCatalogRelease[]
    artistCount: number
    songCount: number
    releaseCount: number
    catalogReady?: boolean
}

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

const uniqueBy = <T,>(items: T[], getKey: (item: T) => string) => {
    const seen = new Set<string>()
    return items.filter(item => {
        const key = getKey(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

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

const sanitizeText = (value?: string) => {
    if (!value) return ''
    return value
        .replaceAll('ï¿½', '')
        .replaceAll('â€¢', '•')
        .replaceAll('â€”', '—')
        .replaceAll('â€“', '–')
        .replaceAll('âœ“', '?')
        .replaceAll('â†’', '->')
        .replace(/\s+/g, ' ')
        .trim()
}

const hasAudio = (song: GameCatalogSong) => !!(song.previewUrl || song.audio)

const hasPlayableLyric = (challenge: LyricChallenge) => sanitizeText(challenge.prompt).length >= 8 && challenge.answers.length > 0

const ERA_LABELS = [
    { id: 'pioneer', label: 'Pioneer Era', min: -Infinity, max: 2015 },
    { id: 'breakout', label: 'Breakout Era', min: 2016, max: 2018 },
    { id: 'new-guard', label: 'New Guard', min: 2019, max: 2021 },
    { id: 'current-wave', label: 'Current Wave', min: 2022, max: Infinity },
] as const

const KNOWN_AFFINITIES: Array<{ category: 'collective' | 'label'; label: string; artists: string[] }> = [
    {
        category: 'label',
        label: 'Kalamkaar',
        artists: ['KR$NA', 'Karma', 'Deep Kalsi', 'Harjas Harjaayi'],
    },
    {
        category: 'collective',
        label: 'Gully Gang',
        artists: ['DIVINE', 'MC Altaf', "D'Evil", 'DopeadelicZ'],
    },
    {
        category: 'collective',
        label: 'DL91 Core',
        artists: ['Seedhe Maut', 'Encore ABJ', 'Calm', 'Full Power'],
    },
    {
        category: 'label',
        label: 'Azadi Records',
        artists: ['Prabh Deep', 'Seedhe Maut', 'Ahmer', 'Tsumyoki'],
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
    playableArtists: GameCatalogArtist[]
    playableTracks: ArcadePlayableTrack[]
    playableLyrics: ArcadeLyricCard[]
    timelineEvents: ArcadeTimelineEvent[]
    sceneQuestions: ArcadeSceneQuestion[]
    sceneFacts: ArcadeSceneQuestion[]
    blitzQuestions: ArcadeArtistQuestion[]
    artistQuestions: ArcadeArtistQuestion[]
    connectionGroups: ArcadeConnectionGroup[]
    connectionPuzzles: ArcadeConnectionPuzzle[]
}

const buildOptions = (answer: string, pool: string[], size = 4) => {
    const cleanedAnswer = sanitizeText(answer)
    const cleanedPool = unique(pool.map(item => sanitizeText(item)).filter(option => option && normalize(option) !== normalize(cleanedAnswer)))
    return shuffle([cleanedAnswer, ...shuffle(cleanedPool).slice(0, Math.max(0, size - 1))])
}

const deriveArtistAffinities = (artist: GameCatalogArtist) => {
    const collectives = new Set((artist.collectives || []).map(sanitizeText).filter(Boolean))
    const labels = new Set((artist.labels || []).map(sanitizeText).filter(Boolean))

    KNOWN_AFFINITIES.forEach(group => {
        if (group.artists.some(name => normalize(name) === normalize(artist.name))) {
            if (group.category === 'collective') {
                collectives.add(group.label)
            } else {
                labels.add(group.label)
            }
        }
    })

    const bio = sanitizeText(artist.bio).toLowerCase()
    if (bio.includes('gully gang')) collectives.add('Gully Gang')
    if (bio.includes('kalamkaar')) labels.add('Kalamkaar')
    if (bio.includes('azadi records')) labels.add('Azadi Records')
    if (bio.includes('seedhe maut') || bio.includes('dl91') || bio.includes('south delhi')) collectives.add('DL91 Core')

    return {
        collectives: Array.from(collectives),
        labels: Array.from(labels),
    }
}

const buildConnectionGroups = (artists: GameCatalogArtist[]) => {
    const playableArtists = artists.filter(artist => artist.songCount > 0 || artist.releaseCount > 0)
    const nameMap = byNormalizedName(playableArtists, 'name')
    const groups: ArcadeConnectionGroup[] = []

    KNOWN_AFFINITIES.forEach(group => {
        const present = group.artists
            .map(name => nameMap.get(normalize(name))?.name)
            .filter((name): name is string => !!name)
        if (present.length >= 4) {
            groups.push({
                id: `${group.category}-${normalize(group.label)}`,
                category: titleCase(group.category),
                label: group.label,
                clue: `All four artists map to ${group.label}.`,
                artistNames: shuffle(unique(present)).slice(0, 4),
            })
        }
    })

    const cityBuckets = new Map<string, string[]>()
    const collectiveBuckets = new Map<string, string[]>()
    const labelBuckets = new Map<string, string[]>()
    const eraBuckets = new Map<string, string[]>()

    playableArtists.forEach(artist => {
        if (artist.city) {
            const city = sanitizeText(artist.city)
            cityBuckets.set(city, [...(cityBuckets.get(city) || []), artist.name])
        }

        const affinity = deriveArtistAffinities(artist)
        affinity.collectives.forEach(collective => {
            collectiveBuckets.set(collective, [...(collectiveBuckets.get(collective) || []), artist.name])
        })
        affinity.labels.forEach(label => {
            labelBuckets.set(label, [...(labelBuckets.get(label) || []), artist.name])
        })

        const firstYear = artist.releaseYears?.[0]
        if (firstYear) {
            const era = ERA_LABELS.find(item => firstYear >= item.min && firstYear <= item.max)
            if (era) {
                eraBuckets.set(era.label, [...(eraBuckets.get(era.label) || []), artist.name])
            }
        }
    })

    const pushBucketGroups = (bucket: Map<string, string[]>, category: string, clueBuilder: (label: string) => string) => {
        bucket.forEach((names, label) => {
            const uniqueNames = unique(names)
            if (uniqueNames.length < 4) return
            groups.push({
                id: `${normalize(category)}-${normalize(label)}`,
                category,
                label,
                clue: clueBuilder(label),
                artistNames: shuffle(uniqueNames).slice(0, 4),
            })
        })
    }

    pushBucketGroups(cityBuckets, 'City', label => `All four artists are associated with ${label}.`)
    pushBucketGroups(collectiveBuckets, 'Collective', label => `All four artists share the ${label} lane.`)
    pushBucketGroups(labelBuckets, 'Label', label => `All four artists connect through ${label}.`)
    pushBucketGroups(eraBuckets, 'Era', label => `All four artists broke through in the ${label.toLowerCase()}.`)

    return uniqueBy(groups, group => `${normalize(group.category)}::${normalize(group.label)}`)
}

const pickNonOverlappingGroups = (groups: ArcadeConnectionGroup[], target = 4) => {
    const ordered = [...groups].sort((left, right) => {
        const priority = (group: ArcadeConnectionGroup) => {
            if (group.category === 'Collective') return 0
            if (group.category === 'Label') return 1
            if (group.category === 'City') return 2
            return 3
        }
        return priority(left) - priority(right)
    })

    const search = (index: number, chosen: ArcadeConnectionGroup[], used: Set<string>): ArcadeConnectionGroup[] | null => {
        if (chosen.length === target) return chosen
        if (index >= ordered.length) return null

        for (let i = index; i < ordered.length; i += 1) {
            const candidate = ordered[i]
            const overlap = candidate.artistNames.some(name => used.has(normalize(name)))
            if (overlap) continue
            const nextUsed = new Set(used)
            candidate.artistNames.forEach(name => nextUsed.add(normalize(name)))
            const result = search(i + 1, [...chosen, candidate], nextUsed)
            if (result) return result
        }

        return null
    }

    return search(0, [], new Set()) || []
}

const buildConnectionPuzzles = (artists: GameCatalogArtist[]) => {
    const groups = buildConnectionGroups(artists)
    const selected = pickNonOverlappingGroups(groups)
    if (selected.length < 4) {
        return {
            connectionGroups: groups,
            connectionPuzzles: [] as ArcadeConnectionPuzzle[],
        }
    }

    return {
        connectionGroups: groups,
        connectionPuzzles: [{
            id: 'connections-1',
            groups: selected,
            items: shuffle(selected.flatMap(group => group.artistNames)),
        }],
    }
}

export function buildArcadeCatalog(input: GameCatalogResponse): ArcadeCatalog {
    const artists = (Array.isArray(input.artists) ? input.artists : []).map(artist => ({
        ...artist,
        name: sanitizeText(artist.name),
        genre: sanitizeText(artist.genre),
        bio: sanitizeText(artist.bio),
        city: sanitizeText(artist.city) || undefined,
        facts: (artist.facts || []).map(fact => sanitizeText(fact)).filter(Boolean),
        collectives: (artist.collectives || []).map(item => sanitizeText(item)).filter(Boolean),
        labels: (artist.labels || []).map(item => sanitizeText(item)).filter(Boolean),
    }))

    const songs = (Array.isArray(input.songs) ? input.songs : []).map(song => ({
        ...song,
        title: sanitizeText(song.title),
        artistName: sanitizeText(song.artistName),
        albumTitle: sanitizeText(song.albumTitle),
        previewUrl: song.previewUrl || song.audio,
        audio: song.audio || song.previewUrl,
    }))

    const releases = (Array.isArray(input.releases) ? input.releases : []).map(release => ({
        ...release,
        title: sanitizeText(release.title),
        artistName: sanitizeText(release.artistName),
        type: sanitizeText(release.type),
    }))

    const playableArtists = artists.filter(artist => artist.songCount > 0 || artist.releaseCount > 0)
    const artistCount = input.artistCount || artists.length
    const songCount = input.songCount || songs.length
    const releaseCount = input.releaseCount || releases.length

    const playableTracks = songs
        .filter(hasAudio)
        .map(song => ({
            ...song,
            coverArtUrl: song.coverUrl,
            normalizedTitle: normalize(song.title),
        }))

    const artistByName = byNormalizedName(playableArtists, 'name')
    const songByArtistAndTitle = new Map<string, GameCatalogSong>()

    songs.forEach(song => {
        songByArtistAndTitle.set(`${normalize(song.artistName)}::${normalize(song.title)}`, song)
    })

    const playableLyrics = lyricChallenges
        .filter(hasPlayableLyric)
        .map(challenge => {
            const song = songByArtistAndTitle.get(`${normalize(challenge.artistName)}::${normalize(challenge.songTitle)}`)
            const artist = artistByName.get(normalize(challenge.artistName))
            return {
                id: `${normalize(challenge.artistName)}-${normalize(challenge.songTitle)}-${normalize(challenge.prompt)}`,
                artistId: artist?.id,
                songId: song?.id,
                artistName: sanitizeText(artist?.name || challenge.artistName),
                songTitle: sanitizeText(song?.title || challenge.songTitle),
                albumTitle: sanitizeText(song?.albumTitle) || undefined,
                prompt: sanitizeText(challenge.prompt),
                maskedPrompt: sanitizeText(buildMaskedPrompt(challenge.prompt, challenge.difficulty)),
                answers: challenge.answers.map(answer => sanitizeText(answer)).filter(Boolean),
                difficulty: challenge.difficulty,
                coverUrl: song?.coverUrl,
            } satisfies ArcadeLyricCard
        })
        .filter(card => card.answers.length > 0)

    const timelineEvents = uniqueBy([
        ...releases
            .filter(release => !!release.releaseDate)
            .map(release => ({
                ...release,
                year: Number(release.releaseDate?.slice(0, 4) || 0),
            } satisfies ArcadeTimelineEvent)),
        ...songs
            .filter(song => !!song.releaseDate)
            .map(song => ({
                id: 1000000 + song.id,
                title: song.albumTitle || song.title,
                artistId: song.artistId,
                artistName: song.artistName,
                releaseDate: song.releaseDate,
                type: song.albumType,
                coverUrl: song.coverUrl,
                youtubeUrl: song.youtubeUrl,
                year: Number(song.releaseDate?.slice(0, 4) || 0),
            } satisfies ArcadeTimelineEvent)),
    ], event => `${event.artistId}-${normalize(event.title)}-${event.year}`)
        .filter(event => Number.isFinite(event.year) && event.year > 0)

    const artistNamePool = playableArtists.map(artist => artist.name)
    const releaseTitlePool = releases.map(release => release.title)
    const questionYearPool = unique(timelineEvents.map(item => String(item.year)))

    const sceneFacts: ArcadeSceneQuestion[] = []
    const artistQuestions: ArcadeArtistQuestion[] = []

    playableArtists.forEach(artist => {
        if (artist.city) {
            sceneFacts.push({
                id: `city-${artist.id}`,
                category: 'city',
                prompt: `Which city is ${artist.name} most associated with?`,
                answer: artist.city,
                options: buildOptions(artist.city, playableArtists.map(item => item.city).filter((item): item is string => !!item)),
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

        if (artist.facts.length > 0) {
            const fact = artist.facts[0]
            sceneFacts.push({
                id: `fact-${artist.id}`,
                category: 'fact',
                prompt: `Which artist matches this fact? ${fact}`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNamePool),
                explanation: `This clue comes directly from ${artist.name}'s verified HipHopHub profile.`,
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

    releases.slice(0, 160).forEach(release => {
        if (release.releaseDate) {
            const year = String(release.releaseDate.slice(0, 4))
            sceneFacts.push({
                id: `year-${release.id}`,
                category: 'year',
                prompt: `Which year did "${release.title}" release?`,
                answer: year,
                options: buildOptions(year, questionYearPool),
                explanation: `${release.title} is recorded in HipHopHub with a ${year} release year.`,
            })

            artistQuestions.push({
                id: `release-year-${release.id}`,
                category: 'year',
                prompt: `Pick the release year for "${release.title}".`,
                answer: year,
                options: buildOptions(year, questionYearPool),
                mediaUrl: release.coverUrl,
                mediaAlt: release.title,
            })
        }

        if ((release.type || '').toUpperCase() === 'ALBUM' || (release.type || '').toUpperCase() === 'EP') {
            sceneFacts.push({
                id: `album-${release.id}`,
                category: 'album',
                prompt: `Which release belongs to ${release.artistName}?`,
                answer: release.title,
                options: buildOptions(release.title, releaseTitlePool),
                explanation: `${release.title} is a verified ${sanitizeText(release.type).toLowerCase() || 'release'} under ${release.artistName}.`,
            })

            artistQuestions.push({
                id: `album-owner-${release.id}`,
                category: 'album',
                prompt: `Who owns the release "${release.title}"?`,
                answer: release.artistName,
                options: buildOptions(release.artistName, artistNamePool),
                mediaUrl: release.coverUrl,
                mediaAlt: release.title,
            })
        }

        if ((release.type || '').toUpperCase() === 'APPEARS_ON') {
            sceneFacts.push({
                id: `collab-${release.id}`,
                category: 'collaborator',
                prompt: `Which artist is officially tied to the collaboration "${release.title}"?`,
                answer: release.artistName,
                options: buildOptions(release.artistName, artistNamePool),
                explanation: `${release.artistName} is the verified DHH artist mapped to this collaboration in the catalog.`,
            })
        }
    })

    playableTracks.slice(0, 240).forEach(song => {
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

        if (song.albumTitle) {
            artistQuestions.push({
                id: `track-album-${song.id}`,
                category: 'album',
                prompt: `"${song.title}" appears on which release?`,
                answer: song.albumTitle,
                options: buildOptions(song.albumTitle, releaseTitlePool),
                mediaUrl: song.coverArtUrl,
                mediaAlt: song.title,
            })
        }
    })

    const { connectionGroups, connectionPuzzles } = buildConnectionPuzzles(playableArtists)

    return {
        artistCount,
        songCount,
        releaseCount,
        artists: playableArtists,
        songs,
        releases,
        playableArtists,
        playableTracks,
        playableLyrics: shuffle(playableLyrics),
        timelineEvents: shuffle(timelineEvents).slice(0, Math.max(100, Math.min(timelineEvents.length, 180))),
        sceneQuestions: shuffle(sceneFacts),
        sceneFacts: shuffle(sceneFacts),
        blitzQuestions: shuffle(artistQuestions),
        artistQuestions: shuffle(artistQuestions),
        connectionGroups,
        connectionPuzzles,
    }
}

export const formatCatalogNumber = (value: number, fallback: string) => (value > 0 ? value.toLocaleString() : fallback)

export const buildCatalogSummary = (catalog: ArcadeCatalog) => ({
    artistText: formatCatalogNumber(catalog.playableArtists.length, 'artist deck offline'),
    songText: formatCatalogNumber(catalog.playableTracks.length, 'track pool offline'),
    releaseText: formatCatalogNumber(catalog.releaseCount, 'release archive offline'),
    lyricText: formatCatalogNumber(catalog.playableLyrics.length, 'lyric deck offline'),
})

export const prettyCategoryLabel = (value: string) => titleCase(value.replace(/-/g, ' '))


