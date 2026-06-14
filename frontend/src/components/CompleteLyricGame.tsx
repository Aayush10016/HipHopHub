import { memo, useEffect, useMemo, useState } from 'react'
import ArcadeLeaderboard from './ArcadeLeaderboard'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeLyricCard } from '../utils/gameCatalog'
import './CompleteLyricGame.css'

const TOTAL_ROUNDS = 8
const ROUND_TIME = 22

type AuthUser = {
    id: number
    username: string
}

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

const getStoredUser = (): AuthUser | null => {
    try {
        const raw = localStorage.getItem('hiphophub_user')
        return raw ? JSON.parse(raw) as AuthUser : null
    } catch {
        return null
    }
}

const getChoices = (card: ArcadeLyricCard, pool: ArcadeLyricCard[]) => {
    const answer = card.answers[0]
    const distractors = pool
        .flatMap(item => item.answers[0])
        .filter(item => item.toLowerCase() !== answer.toLowerCase())
        .filter((item, index, source) => source.findIndex(candidate => candidate.toLowerCase() === item.toLowerCase()) === index)
    return shuffle([answer, ...shuffle(distractors).slice(0, 3)])
}

function CompleteLyricGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, catalog } = useArcadeCatalog()
    const user = useMemo(() => getStoredUser(), [])
    const deck = useMemo(() => shuffle(catalog.playableLyrics).slice(0, TOTAL_ROUNDS), [catalog.playableLyrics])

    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(0)
    const [bestCombo, setBestCombo] = useState(0)
    const [lives, setLives] = useState(3)
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
    const [roundResult, setRoundResult] = useState<null | { correct: boolean; points: number }>(null)
    const [savedRun, setSavedRun] = useState(false)

    const current = deck[index]
    const gameOver = !current || lives <= 0 || index >= deck.length
    const choices = useMemo(() => current ? getChoices(current, catalog.playableLyrics) : [], [catalog.playableLyrics, current])

    useEffect(() => {
        if (!current || roundResult || gameOver) return
        const timer = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setLives(currentLives => Math.max(0, currentLives - 1))
                    setCombo(0)
                    setRoundResult({ correct: false, points: 0 })
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [current, gameOver, roundResult])

    useEffect(() => {
        if (!gameOver || !user || savedRun || score <= 0) return
        fetch('/api/arcade/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                mode: 'COMPLETE_THE_LYRIC',
                points: score,
                metaLabel: `Best combo ${bestCombo}`,
            }),
        }).finally(() => setSavedRun(true))
    }, [bestCombo, gameOver, savedRun, score, user])

    const nextRound = () => {
        setIndex(prev => prev + 1)
        setSelectedChoice(null)
        setRoundResult(null)
        setTimeLeft(ROUND_TIME)
    }

    const restart = () => {
        setIndex(0)
        setScore(0)
        setCombo(0)
        setBestCombo(0)
        setLives(3)
        setTimeLeft(ROUND_TIME)
        setSelectedChoice(null)
        setRoundResult(null)
        setSavedRun(false)
    }

    const lockAnswer = (choice: string) => {
        if (!current || roundResult) return
        setSelectedChoice(choice)

        const correct = current.answers.some(answer => answer.toLowerCase() === choice.toLowerCase())
        const base = current.difficulty === 'hard' ? 180 : current.difficulty === 'medium' ? 140 : 100
        const awarded = correct ? Math.round(base + (combo * 24) + (timeLeft * 4)) : 0

        if (correct) {
            setScore(prev => prev + awarded)
            setCombo(prev => {
                const next = prev + 1
                setBestCombo(currentBest => Math.max(currentBest, next))
                return next
            })
        } else {
            setLives(prev => Math.max(0, prev - 1))
            setCombo(0)
        }

        setRoundResult({ correct, points: awarded })
    }

    if (loading && catalog.playableLyrics.length === 0) {
        return (
            <PlayGameFrame
                title="Guess The Lyric"
                subtitle="Complete missing words without seeing the song title until the round resolves."
                onBack={onBack}
                stats={[
                    { label: 'Score', value: '...' },
                    { label: 'Timer', value: '...' },
                    { label: 'Lives', value: '...' },
                    { label: 'Streak', value: '...' },
                    { label: 'XP', value: '...' },
                ]}
                hero={<div className="arcade-skeleton arcade-skeleton--hero" />}
                leaderboard={<ArcadeLeaderboard mode="COMPLETE_THE_LYRIC" title="Lyric Mode Leaderboard" />}
            >
                <div className="arcade-skeleton arcade-skeleton--body" />
            </PlayGameFrame>
        )
    }

    return (
        <PlayGameFrame
            title="Guess The Lyric"
            subtitle="Read the lyric only, choose the missing phrase, and reveal the song after the answer lands."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 5 ? 'danger' : 'default' },
                { label: 'Lives', value: lives, tone: lives <= 1 ? 'danger' : 'default' },
                { label: 'Streak', value: `${combo}x` },
                { label: 'XP', value: Math.round(score * 0.42).toLocaleString() },
            ]}
            hero={current ? (
                <div className="lyric-hero">
                    <div className="lyric-hero-copy">
                        <div className="lyric-chip-row">
                            <span className="lyric-chip">{current.difficulty}</span>
                            <span className="lyric-chip">Round {Math.min(index + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}</span>
                            <span className="lyric-chip">{catalog.playableLyrics.length} lyric cards</span>
                        </div>
                        <h3>{roundResult ? current.songTitle : 'Fill the missing lyric'}</h3>
                        <p>
                            {roundResult
                                ? `${current.artistName} · ${current.albumTitle || 'Verified DHH release'}`
                                : 'Song title, artist, and album stay hidden until you answer.'}
                        </p>
                        <div className="lyric-timer-track">
                            <div className="lyric-timer-fill" style={{ width: `${(timeLeft / ROUND_TIME) * 100}%` }} />
                        </div>
                    </div>
                    {roundResult && (
                        <div className="lyric-hero-media">
                            {current.coverUrl ? <img src={current.coverUrl} alt={current.songTitle} className="lyric-cover-art" /> : <div className="lyric-cover-art lyric-cover-art--placeholder">Lyric</div>}
                        </div>
                    )}
                </div>
            ) : undefined}
            leaderboard={<ArcadeLeaderboard mode="COMPLETE_THE_LYRIC" title="Lyric Mode Leaderboard" />}
        >
            {gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>Session complete</h4>
                    <p>Final score: {score.toLocaleString()}</p>
                    <p>Best combo: {bestCombo}x</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={restart}>Play again</button>
                    </div>
                </div>
            ) : current ? (
                <div className="lyric-game">
                    <div className="lyric-clue-box">
                        <div className="lyric-prompt">{current.maskedPrompt}</div>
                        {!roundResult && <p className="lyric-prompt-note">Only the lyric is visible before you answer.</p>}
                    </div>

                    {!roundResult ? (
                        <div className="lyric-options-grid">
                            {choices.map(choice => (
                                <button key={choice} type="button" className={`lyric-choice ${selectedChoice === choice ? 'active' : ''}`} onClick={() => lockAnswer(choice)}>
                                    {choice}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className={`arcade-result-card ${roundResult.correct ? 'is-correct' : 'is-wrong'}`}>
                            <h4>{roundResult.correct ? 'Locked in' : 'Missed the phrase'}</h4>
                            <p>Answer: {current.answers[0]}</p>
                            <p>Song: {current.songTitle}</p>
                            <p>Artist: {current.artistName}</p>
                            {roundResult.correct ? <p className="points-earned">+{roundResult.points} points</p> : <p className="album-name">Life lost. Combo reset.</p>}
                            <div className="arcade-action-row">
                                <button type="button" className="btn-next" onClick={nextRound}>Next round</button>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </PlayGameFrame>
    )
}

export default memo(CompleteLyricGameComponent)

