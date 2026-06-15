import { memo, useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeTimelineEvent, GameCatalogRelease } from '../lib/gameCatalog'

const TOTAL_ROUNDS = 6
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
    items: ArcadeTimelineEvent[]
    orderedIds: number[]
}

const buildRound = (events: ArcadeTimelineEvent[]): TimelineRound | null => {
    const sample = shuffle(events).slice(0, 4)
    if (sample.length < 4) return null
    const ordered = [...sample].sort((left, right) => left.year - right.year)
    return {
        items: sample,
        orderedIds: ordered.map(item => item.id),
    }
}

const buildFallbackTimelineEvents = (releases: GameCatalogRelease[]) => releases
    .filter(release => !!release.releaseDate)
    .map(release => ({
        ...release,
        year: Number((release.releaseDate || '').slice(0, 4)),
    }))
    .filter(release => Number.isFinite(release.year) && release.year > 0)

function DhhTimelineGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, releases, catalog } = useArcadeCatalog()
    const totalReleases = catalog.releaseCount || releases.length
    const eventPool = useMemo(
        () => (catalog.timelineEvents.length > 0 ? catalog.timelineEvents : buildFallbackTimelineEvents(releases)),
        [catalog.timelineEvents, releases],
    )

    const [started, setStarted] = useState(false)
    const [rounds, setRounds] = useState<TimelineRound[]>([])
    const [roundIndex, setRoundIndex] = useState(0)
    const [selectedOrder, setSelectedOrder] = useState<number[]>([])
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(0)
    const [lives, setLives] = useState(LIVES)
    const [status, setStatus] = useState<string | null>(null)
    const [draggedId, setDraggedId] = useState<number | null>(null)

    const current = rounds[roundIndex]
    const gameOver = started && (roundIndex >= rounds.length || lives <= 0)

    const resetRounds = () => {
        const nextRounds: TimelineRound[] = []
        for (let i = 0; i < TOTAL_ROUNDS; i += 1) {
            const round = buildRound(eventPool)
            if (round) nextRounds.push(round)
        }
        setRounds(nextRounds)
        setRoundIndex(0)
        setSelectedOrder(new Array(nextRounds[0]?.orderedIds.length || 4).fill(0))
    }

    useEffect(() => {
        if (eventPool.length === 0 || started) return
        resetRounds()
    }, [eventPool, started])

    useEffect(() => {
        if (!status || !current) return
        const timeout = window.setTimeout(() => {
            const nextRound = roundIndex + 1
            setRoundIndex(nextRound)
            setSelectedOrder(new Array(rounds[nextRound]?.orderedIds.length || 4).fill(0))
            setStatus(null)
            setDraggedId(null)
        }, 1400)
        return () => window.clearTimeout(timeout)
    }, [current, roundIndex, rounds, status])

    const start = () => {
        setStarted(true)
        setScore(0)
        setCombo(0)
        setLives(LIVES)
        setStatus(null)
        setDraggedId(null)
        resetRounds()
    }

    const clearSlot = (slotIndex: number) => {
        if (status) return
        const next = [...selectedOrder]
        next[slotIndex] = 0
        setSelectedOrder(next)
    }

    const evaluate = (order: number[]) => {
        if (!current || order.some(item => item === 0)) return
        setSelectedOrder(order)
        const perfect = order.every((item, index) => item === current.orderedIds[index])
        if (perfect) {
            const points = 220 + combo * 35 + roundIndex * 30
            setScore(prev => prev + points)
            setCombo(prev => prev + 1)
            setStatus(`Perfect order. +${points}`)
        } else {
            setLives(prev => Math.max(0, prev - 1))
            setCombo(0)
            const first = current.items.find(item => item.id === current.orderedIds[0])
            setStatus(`Not quite. The earliest release here was ${first?.title || 'the first card'}.`)
        }
    }

    const placeInSlot = (eventId: number, slotIndex?: number) => {
        if (!current || status || selectedOrder.includes(eventId)) return
        const next = [...selectedOrder]
        const target = typeof slotIndex === 'number' ? slotIndex : next.findIndex(item => item === 0)
        if (target < 0) return
        next[target] = eventId
        evaluate(next)
    }

    const orderedPreview = selectedOrder.map(id => current?.items.find(item => item.id === id) || null)

    return (
        <PlayGameFrame
            title="DHH Timeline"
            subtitle="Arrange official releases chronologically with drag-and-drop slots, snap feedback, and escalating rounds."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Lives', value: lives, tone: lives <= 1 ? 'danger' : 'default' },
                { label: 'Round', value: `${Math.min(roundIndex + 1, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}` },
                { label: 'Streak', value: `${combo}x` },
                { label: 'XP', value: Math.round(score * 0.36).toLocaleString() },
            ]}
            hero={current ? (
                <div className="arcade-game-hero arcade-game-hero--compact">
                    <div className="arcade-game-hero__copy">
                        <div className="arcade-game-chip-row">
                            <span className="arcade-game-chip">4 release cards</span>
                            <span className="arcade-game-chip">Drag or tap to place</span>
                        </div>
                        <h3>Arrange the releases from earliest to latest.</h3>
                        <p>Only official dated releases from the verified HipHopHub catalog are used here.</p>
                    </div>
                </div>
            ) : undefined}
            leaderboard={
                <div className="game-placeholder card leaderboard-card">
                    <div className="leaderboard-card__header">
                        <h3>Timeline Notes</h3>
                    </div>
                    <div className="arcade-board arcade-board--notes">
                        <div className="arcade-board-row"><strong>Dated events</strong><span>{catalog.timelineEvents.length.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Official releases</strong><span>{totalReleases.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Lives</strong><span>{lives}</span></div>
                        <div className="arcade-board-row"><strong>Best combo</strong><span>{combo}x</span></div>
                    </div>
                </div>
            }
        >
            {loading && eventPool.length === 0 ? (
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : !started || gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{gameOver ? 'Timeline run complete' : 'Ready for DHH Timeline'}</h4>
                    <p>{gameOver ? `Final score: ${score.toLocaleString()}` : 'Arrange four releases at a time and hold the streak.'}</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={start}>{gameOver ? 'Play again' : 'Start timeline'}</button>
                    </div>
                </div>
            ) : current ? (
                <>
                    <div className="timeline-selected-strip">
                        {current.orderedIds.map((_, index) => {
                            const item = orderedPreview[index]
                            return (
                                <button
                                    key={`slot-${index}`}
                                    type="button"
                                    className={`timeline-selected-card ${item ? 'filled' : 'empty'}`}
                                    onDragOver={event => event.preventDefault()}
                                    onDrop={event => {
                                        event.preventDefault()
                                        if (draggedId) placeInSlot(draggedId, index)
                                    }}
                                    onClick={() => clearSlot(index)}
                                >
                                    <span>{index + 1}</span>
                                    {item ? (
                                        <>
                                            <strong>{item.title}</strong>
                                            <small>{item.artistName}</small>
                                        </>
                                    ) : (
                                        <small>Drop release here</small>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    <div className="timeline-grid">
                        {current.items.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                className={`timeline-card ${selectedOrder.includes(item.id) ? 'active' : ''}`}
                                draggable={!selectedOrder.includes(item.id)}
                                onDragStart={() => setDraggedId(item.id)}
                                onDragEnd={() => setDraggedId(null)}
                                onClick={() => placeInSlot(item.id)}
                            >
                                {item.coverUrl ? <img src={item.coverUrl} alt={item.title} className="timeline-card-cover" /> : null}
                                <strong>{item.title}</strong>
                                <span>{item.artistName}</span>
                            </button>
                        ))}
                    </div>

                    {status && <p className="game-description">{status}</p>}
                </>
            ) : null}
        </PlayGameFrame>
    )
}

export default memo(DhhTimelineGameComponent)
