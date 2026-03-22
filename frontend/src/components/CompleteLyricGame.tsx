import { useEffect, useMemo, useState } from 'react'
import { lyricChallenges } from '../data/lyricChallenges'
import './CompleteLyricGame.css'

const TOTAL_ROUNDS = 8
const ROUND_TIME = 20

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const getStoredUser = () => {
    try {
        const raw = localStorage.getItem('hiphophub_user')
        return raw ? JSON.parse(raw) as { id: number; username: string } : null
    } catch {
        return null
    }
}

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

type RoundResult = {
    correct: boolean
    points: number
    usedSongHint: boolean
}

export default function CompleteLyricGame() {
    const [user] = useState(() => getStoredUser())
    const [session, setSession] = useState(() => shuffle(lyricChallenges).slice(0, TOTAL_ROUNDS))
    const [roundIndex, setRoundIndex] = useState(0)
    const [input, setInput] = useState('')
    const [usedSongHint, setUsedSongHint] = useState(false)
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
    const [score, setScore] = useState(0)
    const [streak, setStreak] = useState(0)
    const [lives, setLives] = useState(3)
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
    const [history, setHistory] = useState<RoundResult[]>([])
    const [savedRun, setSavedRun] = useState(false)

    const current = session[roundIndex]
    const sessionDone = roundIndex >= session.length || lives <= 0

    const maxPoints = useMemo(() => {
        const base = current?.difficulty === 'hard' ? 160 : current?.difficulty === 'medium' ? 120 : 90
        return usedSongHint ? Math.max(40, base - 45) : base
    }, [current?.difficulty, usedSongHint])

    useEffect(() => {
        if (sessionDone || roundResult) return
        const timer = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setLives(currentLives => Math.max(0, currentLives - 1))
                    setStreak(0)
                    setRoundResult({ correct: false, points: 0, usedSongHint })
                    setHistory(prevHistory => [...prevHistory, { correct: false, points: 0, usedSongHint }])
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [roundResult, sessionDone, usedSongHint])

    const nextRound = () => {
        setRoundIndex(prev => prev + 1)
        setInput('')
        setUsedSongHint(false)
        setTimeLeft(ROUND_TIME)
        setRoundResult(null)
    }

    const restartSession = () => {
        setSession(shuffle(lyricChallenges).slice(0, TOTAL_ROUNDS))
        setRoundIndex(0)
        setInput('')
        setUsedSongHint(false)
        setTimeLeft(ROUND_TIME)
        setScore(0)
        setStreak(0)
        setLives(3)
        setRoundResult(null)
        setHistory([])
        setSavedRun(false)
    }

    useEffect(() => {
        if (!sessionDone || !user || savedRun || score <= 0) return
        fetch('/api/arcade/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                mode: 'COMPLETE_THE_LYRIC',
                points: score,
                metaLabel: `${history.filter(item => item.correct).length}/${history.length} correct`
            })
        }).finally(() => setSavedRun(true))
    }, [history, savedRun, score, sessionDone, user])

    const submit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!current || !input.trim() || roundResult) return

        const normalizedGuess = normalize(input)
        const correct = current.answers.some(answer => normalize(answer) === normalizedGuess)
        const timeBonus = Math.max(0, timeLeft * 2)
        const streakBonus = correct ? streak * 15 : 0
        const points = correct ? maxPoints + timeBonus + streakBonus : 0
        const result = { correct, points, usedSongHint }

        if (correct) {
            setScore(prev => prev + points)
            setStreak(prev => prev + 1)
        } else {
            setLives(prev => Math.max(0, prev - 1))
            setStreak(0)
        }

        setRoundResult(result)
        setHistory(prev => [...prev, result])
    }

    if (!current || sessionDone) {
        const accuracy = history.length
            ? Math.round((history.filter(item => item.correct).length / history.length) * 100)
            : 0

        return (
            <div className="lyric-game card">
                <div className="lyric-game-head">
                    <div>
                        <h3>Complete The Lyric</h3>
                        <p>Session complete. Reload the board and chase a higher combo.</p>
                    </div>
                    <div className="lyric-score">Final Score: {score}</div>
                </div>

                <div className="lyric-summary-grid">
                    <div className="lyric-summary-card">
                        <strong>{history.filter(item => item.correct).length}</strong>
                        <span>Correct</span>
                    </div>
                    <div className="lyric-summary-card">
                        <strong>{accuracy}%</strong>
                        <span>Accuracy</span>
                    </div>
                    <div className="lyric-summary-card">
                        <strong>{history.filter(item => item.usedSongHint).length}</strong>
                        <span>Song hints used</span>
                    </div>
                </div>

                <button type="button" className="btn-next" onClick={restartSession}>
                    Play Another Session
                </button>
            </div>
        )
    }

    return (
        <div className="lyric-game card">
            <div className="lyric-game-head">
                <div>
                    <h3>Complete The Lyric</h3>
                    <p>Round-based lyric bank with artist clues, song hints, streak bonuses, and timer pressure.</p>
                </div>
                <div className="lyric-score">Score: {score}</div>
            </div>

            <div className="lyric-status-row">
                <span className="lyric-chip">Round {roundIndex + 1}/{TOTAL_ROUNDS}</span>
                <span className="lyric-chip">Lives: {lives}</span>
                <span className="lyric-chip">Streak: {streak}</span>
                <span className="lyric-chip">{current.difficulty}</span>
            </div>

            <div className="lyric-timer-track">
                <div className="lyric-timer-fill" style={{ width: `${(timeLeft / ROUND_TIME) * 100}%` }} />
            </div>

            <div className="lyric-clue-box">
                <span className="lyric-chip">Artist hint: {current.artistName}</span>
                {usedSongHint ? (
                    <span className="lyric-chip strong">Song hint: {current.songTitle}</span>
                ) : (
                    <button type="button" className="lyric-hint-btn" onClick={() => setUsedSongHint(true)}>
                        Give Song Hint
                    </button>
                )}
                <div className="lyric-prompt">{current.prompt}</div>
                <p className="lyric-prompt-note">Current round max: {maxPoints + Math.max(0, timeLeft * 2) + (streak * 15)} points</p>
            </div>

            {!roundResult ? (
                <form className="lyric-form" onSubmit={submit}>
                    <input
                        className="lyric-input"
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type the missing word or phrase..."
                    />
                    <button className="btn-submit" type="submit" disabled={!input.trim()}>
                        Lock In
                    </button>
                </form>
            ) : (
                <div className={`lyric-result ${roundResult.correct ? 'correct' : 'incorrect'}`}>
                    <h4>{roundResult.correct ? 'Clean hit' : 'Missed this round'}</h4>
                    <p>Answer: {current.answers[0]}</p>
                    <p>Song: {current.songTitle}</p>
                    <p>Artist: {current.artistName}</p>
                    {roundResult.correct
                        ? <p>+{roundResult.points} points</p>
                        : <p>Life lost. Reset the streak and go again.</p>}
                    <div className="lyric-result-actions">
                        <button type="button" className="btn-next" onClick={nextRound}>
                            Next Round
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
