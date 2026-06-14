import { memo, useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeSceneQuestion } from '../utils/gameCatalog'

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

function SceneDecoderGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, catalog } = useArcadeCatalog()
    const questionDeck = useMemo(() => shuffle(catalog.sceneFacts).slice(0, 48), [catalog.sceneFacts])

    const [started, setStarted] = useState(false)
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [didYouKnow, setDidYouKnow] = useState<string | null>(null)

    const current: ArcadeSceneQuestion | undefined = questionDeck[index]
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
                    setCombo(0)
                    setStatus(`Time up. Correct answer: ${current.answer}`)
                    setDidYouKnow(current.explanation)
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
            setDidYouKnow(null)
            setRoundTimeLeft(ROUND_TIME)
        }, 1800)
        return () => window.clearTimeout(timeout)
    }, [gameOver, selected])

    const start = () => {
        setStarted(true)
        setIndex(0)
        setScore(0)
        setCombo(0)
        setTimeLeft(SESSION_TIME)
        setRoundTimeLeft(ROUND_TIME)
        setSelected(null)
        setStatus(null)
        setDidYouKnow(null)
    }

    const choose = (option: string) => {
        if (!current || selected || gameOver || !started) return
        setSelected(option)
        if (option === current.answer) {
            const points = Math.round(100 + roundTimeLeft * 10 + combo * 18)
            setScore(prev => prev + points)
            setCombo(prev => prev + 1)
            setStatus(`Correct. +${points}`)
        } else {
            setCombo(0)
            setStatus(`Correct answer: ${current.answer}`)
        }
        setDidYouKnow(current.explanation)
    }

    return (
        <PlayGameFrame
            title="Scene Decoder"
            subtitle="DHH cultural trivia built from city roots, facts, release years, albums, collaborators, and scene waves."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 10 ? 'danger' : 'default' },
                { label: 'Round', value: `${roundTimeLeft}s`, tone: roundTimeLeft <= 3 ? 'danger' : 'default' },
                { label: 'Streak', value: `${combo}x` },
                { label: 'XP', value: Math.round(score * 0.38).toLocaleString() },
            ]}
            hero={current ? (
                <div className="arcade-game-hero arcade-game-hero--compact">
                    <div className="arcade-game-hero__copy">
                        <div className="arcade-game-chip-row">
                            <span className="arcade-game-chip">{current.category}</span>
                            <span className="arcade-game-chip">Did-you-know trivia mode</span>
                        </div>
                        <h3>{current.prompt}</h3>
                        <p>Answer first, then get a context note pulled from the verified catalog.</p>
                    </div>
                </div>
            ) : undefined}
            leaderboard={
                <div className="game-placeholder card leaderboard-card">
                    <div className="leaderboard-card__header">
                        <h3>Decoder Pool</h3>
                    </div>
                    <div className="arcade-board arcade-board--notes">
                        <div className="arcade-board-row"><strong>Question deck</strong><span>{catalog.sceneFacts.length}</span></div>
                        <div className="arcade-board-row"><strong>Artists loaded</strong><span>{catalog.artistCount.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Releases loaded</strong><span>{catalog.releaseCount.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Categories</strong><span>6</span></div>
                    </div>
                </div>
            }
        >
            {loading && questionDeck.length === 0 ? (
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : !started || gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{gameOver ? 'Scene Decoder complete' : 'Ready for Scene Decoder'}</h4>
                    <p>{gameOver ? `Final score: ${score.toLocaleString()}` : 'A fast DHH culture quiz designed for repeat runs.'}</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={start}>{gameOver ? 'Play again' : 'Start decoder'}</button>
                    </div>
                </div>
            ) : current ? (
                <>
                    <div className="arcade-option-grid">
                        {current.options.map(option => (
                            <button
                                key={`${current.id}-${option}`}
                                type="button"
                                className={`arcade-option-card ${selected === option ? 'active' : ''}`}
                                onClick={() => choose(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {status && <p className="game-description">{status}</p>}
                    {didYouKnow && <div className="arcade-did-you-know"><strong>Did you know?</strong><p>{didYouKnow}</p></div>}
                </>
            ) : null}
        </PlayGameFrame>
    )
}

export default memo(SceneDecoderGameComponent)

