import { memo, useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeArtistQuestion } from '../lib/gameCatalog'

const SESSION_TIME = 60
const ROUND_TIME = 10

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

function ArtistBlitzGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, catalog } = useArcadeCatalog()
    const questionPool = useMemo(() => shuffle(catalog.artistQuestions).slice(0, 60), [catalog.artistQuestions])

    const [started, setStarted] = useState(false)
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(0)
    const [bestCombo, setBestCombo] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)

    const current: ArcadeArtistQuestion | undefined = questionPool[index]
    const gameOver = started && (timeLeft <= 0 || !current)

    useEffect(() => {
        if (!started || gameOver) return
        const timer = window.setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000)
        return () => window.clearInterval(timer)
    }, [gameOver, started])

    useEffect(() => {
        if (!started || gameOver || selected || !current) return
        setRoundTimeLeft(ROUND_TIME)
        const timer = window.setInterval(() => {
            setRoundTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setSelected('__timeout__')
                    setStatus(`Time up. Correct answer: ${current.answer}`)
                    setCombo(0)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [current, gameOver, selected, started])

    useEffect(() => {
        if (!selected || gameOver) return
        const timeout = window.setTimeout(() => {
            setIndex(prev => prev + 1)
            setSelected(null)
            setStatus(null)
            setRoundTimeLeft(ROUND_TIME)
        }, 900)
        return () => window.clearTimeout(timeout)
    }, [gameOver, selected])

    const start = () => {
        setStarted(true)
        setIndex(0)
        setScore(0)
        setCombo(0)
        setBestCombo(0)
        setTimeLeft(SESSION_TIME)
        setRoundTimeLeft(ROUND_TIME)
        setSelected(null)
        setStatus(null)
    }

    const choose = (option: string) => {
        if (!current || selected || gameOver || !started) return
        setSelected(option)
        if (option === current.answer) {
            const points = Math.round(110 + roundTimeLeft * 8 + combo * 22)
            setScore(prev => prev + points)
            setCombo(prev => {
                const next = prev + 1
                setBestCombo(currentBest => Math.max(currentBest, next))
                return next
            })
            setStatus(`Correct. +${points}`)
        } else {
            setCombo(0)
            setStatus(`Correct answer: ${current.answer}`)
        }
    }

    return (
        <PlayGameFrame
            title="Artist Blitz"
            subtitle="Fast sixty-second recognition mode across artists, artwork, years, facts, albums, and collaborators."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 10 ? 'danger' : 'default' },
                { label: 'Round', value: `${roundTimeLeft}s`, tone: roundTimeLeft <= 3 ? 'danger' : 'default' },
                { label: 'Streak', value: `${combo}x` },
                { label: 'XP', value: Math.round(score * 0.4).toLocaleString() },
            ]}
            hero={current ? (
                <div className="arcade-game-hero arcade-game-hero--compact">
                    {current.mediaUrl ? (
                        <div className="arcade-game-hero__cover-shell arcade-game-hero__cover-shell--small">
                            <img src={current.mediaUrl} alt={current.mediaAlt || current.prompt} className="arcade-game-cover" />
                        </div>
                    ) : null}
                    <div className="arcade-game-hero__copy">
                        <div className="arcade-game-chip-row">
                            <span className="arcade-game-chip">{current.category}</span>
                            <span className="arcade-game-chip">{catalog.artistCount.toLocaleString()} artists loaded</span>
                        </div>
                        <h3>{current.prompt}</h3>
                        <p>Every round is generated from the shared HipHopHub arcade catalog.</p>
                    </div>
                </div>
            ) : undefined}
            leaderboard={
                <div className="game-placeholder card leaderboard-card">
                    <div className="leaderboard-card__header">
                        <h3>Blitz Rules</h3>
                    </div>
                    <div className="arcade-board arcade-board--notes">
                        <div className="arcade-board-row"><strong>Prompt pool</strong><span>{catalog.artistQuestions.length}</span></div>
                        <div className="arcade-board-row"><strong>Artists loaded</strong><span>{catalog.artistCount.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Tracks loaded</strong><span>{catalog.songCount.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Best combo</strong><span>{bestCombo}x</span></div>
                    </div>
                </div>
            }
        >
            {loading && questionPool.length === 0 ? (
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : !started || gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{gameOver ? 'Artist Blitz complete' : 'Ready for Artist Blitz'}</h4>
                    <p>{gameOver ? `Final score: ${score.toLocaleString()}` : 'A 60-second run built for rapid replay.'}</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={start}>{gameOver ? 'Play again' : 'Start blitz'}</button>
                    </div>
                </div>
            ) : current ? (
                <>
                    <div className="blitz-options arcade-option-grid">
                        {current.options.map(option => (
                            <button
                                key={`${current.id}-${option}`}
                                type="button"
                                className={`blitz-option arcade-option-card ${selected === option ? 'active' : ''}`}
                                onClick={() => choose(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {status && <p className="game-description">{status}</p>}
                </>
            ) : null}
        </PlayGameFrame>
    )
}

export default memo(ArtistBlitzGameComponent)

