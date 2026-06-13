import { useEffect, useMemo, useState } from 'react'
import ArcadeLeaderboard from './ArcadeLeaderboard'
import PlayGameFrame from './PlayGameFrame'
import { lyricChallenges } from '../data/lyricChallenges'
import { useGameCatalog } from '../hooks/useGameCatalog'
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

type DifficultyMode = 'easy' | 'hard'

export default function CompleteLyricGame({ onBack }: { onBack: () => void }) {
    const [user] = useState(() => getStoredUser())
    const { artists, songs, loading } = useGameCatalog()
    const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>('easy')
    const [session, setSession] = useState(() => shuffle(lyricChallenges).slice(0, TOTAL_ROUNDS))
    const [roundIndex, setRoundIndex] = useState(0)
    const [usedSongHint, setUsedSongHint] = useState(false)
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
    const [score, setScore] = useState(0)
    const [streak, setStreak] = useState(0)
    const [lives, setLives] = useState(3)
    const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
    const [history, setHistory] = useState<RoundResult[]>([])
    const [savedRun, setSavedRun] = useState(false)
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null)

    const filteredChallenges = useMemo(() => {
        return lyricChallenges.filter(challenge =>
            difficultyMode === 'easy'
                ? challenge.difficulty === 'easy'
                : challenge.difficulty !== 'easy'
        )
    }, [difficultyMode])

    useEffect(() => {
        setSession(shuffle(filteredChallenges).slice(0, TOTAL_ROUNDS))
        setRoundIndex(0)
        setUsedSongHint(false)
        setTimeLeft(ROUND_TIME)
        setScore(0)
        setStreak(0)
        setLives(3)
        setRoundResult(null)
        setHistory([])
        setSavedRun(false)
        setSelectedChoice(null)
    }, [filteredChallenges])

    const current = session[roundIndex]
    const sessionDone = roundIndex >= session.length || lives <= 0

    const currentArtist = useMemo(() => {
        if (!current) return null
        return artists.find(artist => normalize(artist.name) === normalize(current.artistName)) || null
    }, [artists, current])

    const currentSongMeta = useMemo(() => {
        if (!currentArtist || !current) return null
        return songs.find(song =>
            song.artistId === currentArtist.id &&
            normalize(song.title) === normalize(current.songTitle)
        ) || null
    }, [current, currentArtist, songs])

    const maxPoints = useMemo(() => {
        const base = difficultyMode === 'hard' ? 160 : 100
        return usedSongHint ? Math.max(40, base - 45) : base
    }, [difficultyMode, usedSongHint])

    const comboMultiplier = useMemo(() => 1 + Math.min(1.2, streak * 0.15), [streak])

    const currentChoices = useMemo(() => {
        if (!current) return []
        const answer = current.answers[0]
        const distractors = shuffle(
            lyricChallenges
                .map(challenge => challenge.answers[0])
                .filter(option => normalize(option) !== normalize(answer))
        ).slice(0, 3)
        return shuffle([answer, ...distractors])
    }, [current])

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
        setUsedSongHint(false)
        setTimeLeft(ROUND_TIME)
        setRoundResult(null)
        setSelectedChoice(null)
    }

    const restartSession = () => {
        setSession(shuffle(filteredChallenges).slice(0, TOTAL_ROUNDS))
        setRoundIndex(0)
        setUsedSongHint(false)
        setTimeLeft(ROUND_TIME)
        setScore(0)
        setStreak(0)
        setLives(3)
        setRoundResult(null)
        setHistory([])
        setSavedRun(false)
        setSelectedChoice(null)
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

    const lockAnswer = (choice: string) => {
        if (!current || roundResult) return
        setSelectedChoice(choice)

        const normalizedGuess = normalize(choice)
        const correct = current.answers.some(answer => normalize(answer) === normalizedGuess)
        const timeBonus = Math.max(0, timeLeft * 3)
        const points = correct ? Math.round((maxPoints + timeBonus) * comboMultiplier) : 0
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
            <PlayGameFrame
                title="Complete The Lyric"
                subtitle="Session finished. Reset the board, chase a better combo, and clean up the misses."
                onBack={onBack}
                stats={[
                    { label: 'Final Score', value: score, tone: 'accent' },
                    { label: 'Accuracy', value: `${accuracy}%` },
                    { label: 'Correct', value: history.filter(item => item.correct).length },
                    { label: 'Hints Used', value: history.filter(item => item.usedSongHint).length },
                ]}
                leaderboard={<ArcadeLeaderboard mode="COMPLETE_THE_LYRIC" title="Lyric Mode Leaderboard" />}
            >
                <div className="lyric-game">
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
                            <strong>{difficultyMode}</strong>
                            <span>Difficulty</span>
                        </div>
                    </div>

                    <button type="button" className="btn-next" onClick={restartSession}>
                        Play Another Session
                    </button>
                </div>
            </PlayGameFrame>
        )
    }

    return (
        <PlayGameFrame
            title="Complete The Lyric"
            subtitle="Spotify-style lyric rounds with metadata, progress pressure, and multiple-choice blanks."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score, tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 5 ? 'danger' : 'default' },
                { label: 'Lives', value: lives, tone: lives <= 1 ? 'danger' : 'default' },
                { label: 'Combo', value: `${comboMultiplier.toFixed(2)}x` },
            ]}
            hero={
                <div className="lyric-hero">
                    <div className="lyric-hero-media">
                        {currentSongMeta?.coverUrl ? (
                            <img src={currentSongMeta.coverUrl} alt={current.songTitle} className="lyric-cover-art" />
                        ) : (
                            <div className="lyric-cover-art lyric-cover-art--placeholder">Cover</div>
                        )}
                        {currentArtist?.id ? (
                            <img src={`/api/images/artist/${currentArtist.id}`} alt={current.artistName} className="lyric-artist-avatar" />
                        ) : (
                            <div className="lyric-artist-avatar lyric-artist-avatar--placeholder">{current.artistName.charAt(0)}</div>
                        )}
                    </div>

                    <div className="lyric-hero-copy">
                        <div className="lyric-status-row">
                            <button
                                type="button"
                                className={`arcade-difficulty-btn ${difficultyMode === 'easy' ? 'active' : ''}`}
                                onClick={() => setDifficultyMode('easy')}
                            >
                                Easy
                            </button>
                            <button
                                type="button"
                                className={`arcade-difficulty-btn ${difficultyMode === 'hard' ? 'active' : ''}`}
                                onClick={() => setDifficultyMode('hard')}
                            >
                                Hard
                            </button>
                            <span className="lyric-chip">Round {roundIndex + 1}/{TOTAL_ROUNDS}</span>
                        </div>

                        <h3>{current.songTitle}</h3>
                        <p>{current.artistName}</p>

                        <div className="lyric-timer-track">
                            <div className="lyric-timer-fill" style={{ width: `${(timeLeft / ROUND_TIME) * 100}%` }} />
                        </div>
                    </div>
                </div>
            }
            leaderboard={<ArcadeLeaderboard mode="COMPLETE_THE_LYRIC" title="Lyric Mode Leaderboard" />}
        >
            <div className="lyric-game">
                <div className="lyric-clue-box">
                    <div className="lyric-chip-row">
                        <span className="lyric-chip">Artist hint: {current.artistName}</span>
                        {usedSongHint ? (
                            <span className="lyric-chip strong">Song hint active</span>
                        ) : (
                            <button type="button" className="lyric-hint-btn" onClick={() => setUsedSongHint(true)}>
                                Unlock Song Hint
                            </button>
                        )}
                    </div>
                    <div className="lyric-prompt">{current.prompt}</div>
                    {usedSongHint && <p className="lyric-prompt-note">Song hint: {current.songTitle}</p>}
                </div>

                {!roundResult ? (
                    <div className="lyric-options-grid">
                        {loading ? (
                            <p className="game-description">Loading song metadata...</p>
                        ) : currentChoices.map(choice => (
                            <button
                                key={choice}
                                type="button"
                                className={`lyric-choice ${selectedChoice === choice ? 'active' : ''}`}
                                onClick={() => lockAnswer(choice)}
                            >
                                {choice}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className={`lyric-result ${roundResult.correct ? 'correct' : 'incorrect'}`}>
                        <h4>{roundResult.correct ? 'Clean hit' : 'Missed this round'}</h4>
                        <p>Answer: {current.answers[0]}</p>
                        <p>Song: {current.songTitle}</p>
                        <p>Artist: {current.artistName}</p>
                        {roundResult.correct
                            ? <p>+{roundResult.points} points</p>
                            : <p>Life lost. Combo reset.</p>}
                        <div className="lyric-result-actions">
                            <button type="button" className="btn-next" onClick={nextRound}>
                                Next Round
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PlayGameFrame>
    )
}
