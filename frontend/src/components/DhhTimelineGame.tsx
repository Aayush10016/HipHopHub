import { useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useGameCatalog, type GameCatalogRelease } from '../hooks/useGameCatalog'

const ROUNDS = 6
const LIVES = 3

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

type TimelineRound = {
    items: GameCatalogRelease[]
    correctOrder: number[]
}

const buildRound = (releases: GameCatalogRelease[]): TimelineRound | null => {
    const pool = shuffle(releases.filter(release => !!release.releaseDate)).slice(0, 4)
    if (pool.length < 4) return null
    const sorted = [...pool].sort((a, b) => (a.releaseDate || '').localeCompare(b.releaseDate || ''))
    return {
        items: pool,
        correctOrder: sorted.map(item => item.id),
    }
}

export default function DhhTimelineGame({ onBack }: { onBack: () => void }) {
    const { releases, releaseCount, loading } = useGameCatalog()
    const [rounds, setRounds] = useState<TimelineRound[]>([])
    const [roundIndex, setRoundIndex] = useState(0)
    const [selectedOrder, setSelectedOrder] = useState<number[]>([])
    const [score, setScore] = useState(0)
    const [lives, setLives] = useState(LIVES)
    const [status, setStatus] = useState<string | null>(null)
    const [started, setStarted] = useState(false)

    useEffect(() => {
        if (releases.length === 0) return
        const nextRounds: TimelineRound[] = []
        const safeReleases = releases.filter(release => !!release.releaseDate)
        for (let i = 0; i < ROUNDS; i += 1) {
            const round = buildRound(safeReleases)
            if (round) nextRounds.push(round)
        }
        setRounds(nextRounds)
    }, [releases])

    const current = rounds[roundIndex]
    const over = roundIndex >= rounds.length || lives <= 0
    const timelineEventCount = useMemo(
        () => releases.filter(release => !!release.releaseDate).length,
        [releases]
    )

    const orderedPreview = useMemo(() => {
        if (!current) return []
        return selectedOrder
            .map(id => current.items.find(item => item.id === id))
            .filter((item): item is GameCatalogRelease => !!item)
    }, [current, selectedOrder])

    const start = () => {
        const nextRounds: TimelineRound[] = []
        const safeReleases = releases.filter(release => !!release.releaseDate)
        for (let i = 0; i < ROUNDS; i += 1) {
            const round = buildRound(safeReleases)
            if (round) nextRounds.push(round)
        }
        setRounds(nextRounds)
        setRoundIndex(0)
        setSelectedOrder([])
        setScore(0)
        setLives(LIVES)
        setStatus(null)
        setStarted(true)
    }

    const pickEvent = (id: number) => {
        if (!current || over || selectedOrder.includes(id)) return
        const nextOrder = [...selectedOrder, id]
        setSelectedOrder(nextOrder)

        if (nextOrder.length === current.correctOrder.length) {
            const correctPositions = nextOrder.filter((item, idx) => item === current.correctOrder[idx]).length
            if (correctPositions === current.correctOrder.length) {
                const points = 220 + (roundIndex * 30)
                setScore(prev => prev + points)
                setStatus(`Perfect timeline. +${points}`)
            } else {
                setLives(prev => Math.max(0, prev - 1))
                setStatus(`Not quite. Correct order started with ${current.items.find(item => item.id === current.correctOrder[0])?.title}.`)
            }
        }
    }

    useEffect(() => {
        if (!current || !status) return
        const timer = window.setTimeout(() => {
            setRoundIndex(prev => prev + 1)
            setSelectedOrder([])
            setStatus(null)
        }, 1400)
        return () => window.clearTimeout(timer)
    }, [current, status])

    return (
        <PlayGameFrame
            title="DHH Timeline"
            subtitle="Replace cover-guessing with release chronology. Click the events in the order they happened."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score, tone: 'accent' },
                { label: 'Lives', value: lives, tone: lives <= 1 ? 'danger' : 'default' },
                { label: 'Round', value: `${Math.min(roundIndex + 1, rounds.length)}/${Math.max(1, rounds.length)}` },
                { label: 'Events', value: loading ? '...' : (timelineEventCount || releaseCount) },
            ]}
            leaderboard={
                <div className="game-placeholder card">
                    <h3>How It Works</h3>
                    <p>Pick the four events in chronological order.</p>
                    <p>Rounds get harder as catalog range widens.</p>
                    <p>Only official release dates from the verified catalog are used.</p>
                </div>
            }
        >
            {loading || !current ? (
                <div className="game-placeholder card">
                    <h3>DHH Timeline</h3>
                    <p>{loading ? 'Loading the release archive...' : 'Not enough dated releases are available for a timeline round yet.'}</p>
                </div>
            ) : !started || over ? (
                <div className="blitz-launch">
                    {over && <p className="game-description">Run over. Final score: {score}</p>}
                    <button type="button" className="btn-next" onClick={start}>
                        {over ? 'Play Again' : 'Start Timeline'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="timeline-selected-strip">
                        {orderedPreview.length > 0 ? orderedPreview.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="timeline-selected-card">
                                <span>{idx + 1}</span>
                                <strong>{item.title}</strong>
                                <small>{item.artistName}</small>
                            </div>
                        )) : (
                            <p className="game-description">Tap the events in the order they happened.</p>
                        )}
                    </div>

                    <div className="timeline-grid">
                        {current.items.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                className={`timeline-card ${selectedOrder.includes(item.id) ? 'active' : ''}`}
                                onClick={() => pickEvent(item.id)}
                            >
                                {item.coverUrl && <img src={item.coverUrl} alt={item.title} className="timeline-card-cover" />}
                                <strong>{item.title}</strong>
                                <span>{item.artistName}</span>
                            </button>
                        ))}
                    </div>

                    {status && <p className="game-description">{status}</p>}
                </>
            )}
        </PlayGameFrame>
    )
}
