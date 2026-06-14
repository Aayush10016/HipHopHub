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
    const [draggedId, setDraggedId] = useState<number | null>(null)

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
        return selectedOrder.map(id =>
            id ? current.items.find(item => item.id === id) || null : null
        )
    }, [current, selectedOrder])

    const firstEmptySlot = useMemo(
        () => selectedOrder.findIndex(item => item === 0),
        [selectedOrder]
    )

    const start = () => {
        const nextRounds: TimelineRound[] = []
        const safeReleases = releases.filter(release => !!release.releaseDate)
        for (let i = 0; i < ROUNDS; i += 1) {
            const round = buildRound(safeReleases)
            if (round) nextRounds.push(round)
        }
        setRounds(nextRounds)
        setRoundIndex(0)
        setSelectedOrder(new Array(nextRounds[0]?.correctOrder.length || 4).fill(0))
        setScore(0)
        setLives(LIVES)
        setStatus(null)
        setStarted(true)
        setDraggedId(null)
    }

    const evaluateOrder = (nextOrder: number[]) => {
        if (!current || nextOrder.some(item => item === 0)) return
        setSelectedOrder(nextOrder)

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

    const pickEvent = (id: number, slotIndex?: number) => {
        if (!current || over) return
        if (selectedOrder.includes(id)) return

        const nextOrder = selectedOrder.length === 0
            ? new Array(current.correctOrder.length).fill(0)
            : [...selectedOrder]

        const targetSlot = typeof slotIndex === 'number'
            ? slotIndex
            : nextOrder.findIndex(item => item === 0)

        if (targetSlot < 0) return
        nextOrder[targetSlot] = id
        evaluateOrder(nextOrder)
    }

    const clearSlot = (slotIndex: number) => {
        if (!current || status) return
        const nextOrder = selectedOrder.length === 0
            ? new Array(current.correctOrder.length).fill(0)
            : [...selectedOrder]
        nextOrder[slotIndex] = 0
        setSelectedOrder(nextOrder)
    }

    useEffect(() => {
        if (!current || !status) return
        const timer = window.setTimeout(() => {
            setRoundIndex(prev => prev + 1)
            setSelectedOrder(new Array(current.correctOrder.length).fill(0))
            setStatus(null)
            setDraggedId(null)
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
                        {Array.from({ length: current.correctOrder.length }).map((_, idx) => {
                            const item = orderedPreview[idx]
                            return (
                                <button
                                    key={`slot-${idx}`}
                                    type="button"
                                    className={`timeline-selected-card ${item ? 'filled' : 'empty'}`}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                        event.preventDefault()
                                        if (draggedId) pickEvent(draggedId, idx)
                                    }}
                                    onClick={() => clearSlot(idx)}
                                >
                                    <span>{idx + 1}</span>
                                    {item ? (
                                        <>
                                            <strong>{item.title}</strong>
                                            <small>{item.artistName}</small>
                                        </>
                                    ) : (
                                        <small>Drop event here</small>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {!status && firstEmptySlot >= 0 && (
                        <p className="game-description">Drag events into the numbered slots or tap cards to fill the next open slot.</p>
                    )}

                    <div className="timeline-grid">
                        {current.items.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                className={`timeline-card ${selectedOrder.includes(item.id) ? 'active' : ''}`}
                                onClick={() => pickEvent(item.id)}
                                draggable={!selectedOrder.includes(item.id)}
                                onDragStart={() => setDraggedId(item.id)}
                                onDragEnd={() => setDraggedId(null)}
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
