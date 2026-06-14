import { memo, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeConnectionPuzzle } from '../utils/gameCatalog'

function DhhConnectionsGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, catalog } = useArcadeCatalog()
    const puzzle = useMemo<ArcadeConnectionPuzzle | undefined>(() => catalog.connectionPuzzles[0], [catalog.connectionPuzzles])

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
            ) : !puzzle ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>Connections deck unavailable</h4>
                    <p>The current artist pool does not yet expose enough non-overlapping connection groups.</p>
                </div>
            ) : gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{solvedGroups.length === puzzle.groups.length ? 'Board cleared' : 'Run over'}</h4>
                    <p>{solvedGroups.length === puzzle.groups.length ? `Perfect solve. Final score: ${score.toLocaleString()}` : `Final score: ${score.toLocaleString()}`}</p>
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
