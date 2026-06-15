import { memo, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeConnectionGroup, ArcadeConnectionPuzzle, GameCatalogArtist } from '../lib/gameCatalog'

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '')
const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const buildFallbackConnections = (artists: GameCatalogArtist[]): ArcadeConnectionPuzzle | undefined => {
    const groups: ArcadeConnectionGroup[] = []
    const buckets = new Map<string, { category: string; label: string; artists: string[] }>()

    artists.forEach(artist => {
        if (artist.city) {
            const key = `city:${normalize(artist.city)}`
            const bucket = buckets.get(key) || { category: 'City', label: artist.city, artists: [] }
            bucket.artists.push(artist.name)
            buckets.set(key, bucket)
        }

        ;(artist.labels || []).forEach(label => {
            const key = `label:${normalize(label)}`
            const bucket = buckets.get(key) || { category: 'Label', label, artists: [] }
            bucket.artists.push(artist.name)
            buckets.set(key, bucket)
        })

        ;(artist.collectives || []).forEach(collective => {
            const key = `collective:${normalize(collective)}`
            const bucket = buckets.get(key) || { category: 'Collective', label: collective, artists: [] }
            bucket.artists.push(artist.name)
            buckets.set(key, bucket)
        })

        const firstYear = artist.releaseYears?.[0]
        if (firstYear) {
            const era = firstYear <= 2015 ? 'Pioneer Era' : firstYear <= 2018 ? 'Breakout Era' : firstYear <= 2021 ? 'New Guard' : 'Current Wave'
            const key = `era:${normalize(era)}`
            const bucket = buckets.get(key) || { category: 'Era', label: era, artists: [] }
            bucket.artists.push(artist.name)
            buckets.set(key, bucket)
        }

        if (artist.genre) {
            const key = `genre:${normalize(artist.genre)}`
            const bucket = buckets.get(key) || { category: 'Genre', label: artist.genre, artists: [] }
            bucket.artists.push(artist.name)
            buckets.set(key, bucket)
        }
    })

    buckets.forEach((bucket, key) => {
        const names = unique(bucket.artists)
        if (names.length >= 4) {
            groups.push({
                id: key,
                category: bucket.category,
                label: bucket.label,
                clue: `${bucket.category} · ${bucket.label}`,
                artistNames: names.slice(0, 4),
            })
        }
    })

    const selected: ArcadeConnectionGroup[] = []
    const used = new Set<string>()
    for (const group of groups) {
        if (group.artistNames.some(name => used.has(normalize(name)))) continue
        selected.push(group)
        group.artistNames.forEach(name => used.add(normalize(name)))
        if (selected.length === 4) break
    }

    if (selected.length < 4 && artists.length >= 16) {
        const remaining = artists
            .map(artist => artist.name)
            .filter(name => !used.has(normalize(name)))
            .slice(0, (4 - selected.length) * 4)

        while (selected.length < 4 && remaining.length >= 4) {
            const chunk = remaining.splice(0, 4)
            selected.push({
                id: `fallback-roster-${selected.length + 1}`,
                category: 'Roster',
                label: `Roster ${selected.length + 1}`,
                clue: 'Verified artists grouped from the live HipHopHub catalog.',
                artistNames: chunk,
            })
        }
    }

    if (selected.length < 4) return undefined

    return {
        id: 'fallback-connections-1',
        groups: selected,
        items: selected.flatMap(group => group.artistNames).sort(() => Math.random() - 0.5),
    }
}

function DhhConnectionsGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, artists, catalog } = useArcadeCatalog()
    const puzzle = useMemo<ArcadeConnectionPuzzle | undefined>(
        () => catalog.connectionPuzzles[0] || buildFallbackConnections(artists),
        [artists, catalog.connectionPuzzles],
    )

    const [selected, setSelected] = useState<string[]>([])
    const [solvedGroups, setSolvedGroups] = useState<string[]>([])
    const [attemptsLeft, setAttemptsLeft] = useState(4)
    const [score, setScore] = useState(0)
    const [message, setMessage] = useState<string | null>(null)

    const remainingItems = useMemo(() => {
        if (!puzzle) return []
        const solvedItems = new Set(
            puzzle.groups
                .filter(group => solvedGroups.includes(group.id))
                .flatMap(group => group.artistNames),
        )
        return puzzle.items.filter(item => !solvedItems.has(item))
    }, [puzzle, solvedGroups])

    const solvedDetails = useMemo(() => {
        if (!puzzle) return []
        return puzzle.groups.filter(group => solvedGroups.includes(group.id))
    }, [puzzle, solvedGroups])

    const gameOver = attemptsLeft <= 0 || (!!puzzle && solvedGroups.length === puzzle.groups.length)

    const toggle = (item: string) => {
        if (gameOver) return
        setMessage(null)
        setSelected(prev => {
            if (prev.includes(item)) {
                return prev.filter(entry => entry !== item)
            }
            if (prev.length >= 4) {
                return prev
            }
            return [...prev, item]
        })
    }

    const submitGroup = () => {
        if (!puzzle || selected.length !== 4 || gameOver) return
        const matched = puzzle.groups.find(group =>
            group.artistNames.every(name => selected.includes(name)) && selected.every(name => group.artistNames.includes(name)),
        )

        if (matched) {
            setSolvedGroups(prev => [...prev, matched.id])
            setScore(prev => prev + 250)
            setMessage(`${matched.label} solved · ${matched.clue}`)
        } else {
            setAttemptsLeft(prev => Math.max(0, prev - 1))
            setMessage('That group does not share the same connection.')
        }
        setSelected([])
    }

    const reset = () => {
        setSelected([])
        setSolvedGroups([])
        setAttemptsLeft(4)
        setScore(0)
        setMessage(null)
    }

    return (
        <PlayGameFrame
            title="DHH Connections"
            subtitle="Group artists by shared scenes, collectives, labels, and eras in a flagship deduction board."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Lives', value: attemptsLeft, tone: attemptsLeft <= 1 ? 'danger' : 'default' },
                { label: 'Solved', value: `${solvedGroups.length}/${puzzle?.groups.length || 4}` },
                { label: 'Selected', value: `${selected.length}/4` },
                { label: 'XP', value: Math.round(score * 0.32).toLocaleString() },
            ]}
            hero={
                <div className="arcade-game-hero arcade-game-hero--compact">
                    <div className="arcade-game-hero__copy">
                        <div className="arcade-game-chip-row">
                            <span className="arcade-game-chip">NYT-style grouping</span>
                            <span className="arcade-game-chip">4 groups of 4</span>
                        </div>
                        <h3>Pick four artists that belong together.</h3>
                        <p>Categories can include cities, labels, collectives, and release eras. Solve all four groups before the lives run out.</p>
                    </div>
                </div>
            }
            leaderboard={
                <div className="game-placeholder card leaderboard-card">
                    <div className="leaderboard-card__header">
                        <h3>Solved Groups</h3>
                    </div>
                    {solvedDetails.length > 0 ? (
                        <div className="arcade-board arcade-board--notes">
                            {solvedDetails.map(group => (
                                <div key={group.id} className="arcade-result-card arcade-result-card--mini">
                                    <strong>{group.label}</strong>
                                    <p>{group.clue}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="game-description">Solve a set of four to reveal the connection.</p>
                    )}
                </div>
            }
        >
            {loading && !puzzle ? (
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{solvedGroups.length === puzzle?.groups.length ? 'Board cleared' : 'Run over'}</h4>
                    <p>Final score: {score.toLocaleString()}</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={reset}>Play again</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="connections-grid">
                        {remainingItems.map(item => (
                            <button
                                key={item}
                                type="button"
                                className={`connections-card ${selected.includes(item) ? 'active' : ''}`}
                                onClick={() => toggle(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-control btn-control--secondary" onClick={() => setSelected([])} disabled={selected.length === 0}>Clear</button>
                        <button type="button" className="btn-next" onClick={submitGroup} disabled={selected.length !== 4}>Submit group</button>
                    </div>
                    {message && <p className="game-description">{message}</p>}
                </>
            )}
        </PlayGameFrame>
    )
}

export default memo(DhhConnectionsGameComponent)
