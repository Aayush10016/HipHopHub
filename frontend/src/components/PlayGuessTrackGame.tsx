import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArcadeLeaderboard from './ArcadeLeaderboard'
import GuessTrackLeaderboard from './GuessTrackLeaderboard'
import PlayGameFrame from './PlayGameFrame'
import { useGameCatalog } from '../hooks/useGameCatalog'
import './GameComponent.css'

type Variant = 'guess' | 'rapid'
type Difficulty = 'easy' | 'medium' | 'hardcore'

interface GameSong {
    songId: number
    previewUrl: string
    albumCover?: string
    artistName?: string
    youtubeUrl?: string
    songTitle?: string
}

interface AuthUser {
    id: number
    username: string
    email: string
}

const gameSongCache = new Map<string, GameSong>()
const pendingGameSongRequests = new Map<string, Promise<GameSong | null>>()

const DIFFICULTY_CONFIG: Record<Difficulty, {
    previewLimit: number
    roundTime: number
    multiplier: number
    markers: number[]
    label: string
}> = {
    easy: {
        previewLimit: 30,
        roundTime: 35,
        multiplier: 1,
        markers: [3, 5, 10, 15, 30],
        label: 'Full preview + more time',
    },
    medium: {
        previewLimit: 15,
        roundTime: 24,
        multiplier: 1.35,
        markers: [1, 3, 5, 10, 15],
        label: 'Shorter preview + tighter clock',
    },
    hardcore: {
        previewLimit: 5,
        roundTime: 12,
        multiplier: 2,
        markers: [],
        label: '5s only, no skipping',
    },
}

const getStoredUser = (): AuthUser | null => {
    try {
        const raw = localStorage.getItem('hiphophub_user')
        if (!raw) return null
        return JSON.parse(raw) as AuthUser
    } catch {
        return null
    }
}

const saveArcadeScore = async (userId: number, mode: 'RAPID_FIRE', points: number, metaLabel: string) => {
    await fetch('/api/arcade/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode, points, metaLabel })
    })
}

export default memo(function PlayGuessTrackGame({
    variant,
    onBack,
}: {
    variant: Variant
    onBack: () => void
}) {
    const isRapidFire = variant === 'rapid'
    const { artistCount, songCount, loading: catalogLoading } = useGameCatalog()
    const [currentSong, setCurrentSong] = useState<GameSong | null>(null)
    const [guess, setGuess] = useState('')
    const [result, setResult] = useState<any>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [selectedMarker, setSelectedMarker] = useState<number | null>(null)
    const [score, setScore] = useState(0)
    const [xp, setXp] = useState(0)
    const [loadingSong, setLoadingSong] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [user] = useState<AuthUser | null>(getStoredUser())
    const [streak, setStreak] = useState(0)
    const [lives, setLives] = useState(3)
    const [round, setRound] = useState(1)
    const [timeLeft, setTimeLeft] = useState(isRapidFire ? 10 : DIFFICULTY_CONFIG.medium.roundTime)
    const [sessionStarted, setSessionStarted] = useState(false)
    const [roundActive, setRoundActive] = useState(false)
    const [difficulty, setDifficulty] = useState<Difficulty>('medium')
    const [scoreBurst, setScoreBurst] = useState<number | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)
    const stopAtRef = useRef<number | null>(null)
    const resultTimerRef = useRef<number | null>(null)
    const arcadeSavedRef = useRef(false)

    const difficultyConfig = DIFFICULTY_CONFIG[difficulty]
    const previewLimit = isRapidFire ? 10 : difficultyConfig.previewLimit
    const roundLimit = isRapidFire ? 10 : difficultyConfig.roundTime
    const timeMarkers = isRapidFire ? [] : difficultyConfig.markers
    const comboMultiplier = useMemo(() => 1 + Math.min(1.5, streak * 0.15), [streak])
    const gameOver = lives <= 0
    const cacheKey = `${variant}-${difficulty}`

    const resetAudio = useCallback(() => {
        if (!audioRef.current) return
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
        setCurrentTime(0)
        stopAtRef.current = null
    }, [])

    const fetchGameSong = useCallback(async (key: string): Promise<GameSong | null> => {
        if (gameSongCache.has(key)) {
            const cached = gameSongCache.get(key) || null
            gameSongCache.delete(key)
            return cached
        }

        if (pendingGameSongRequests.has(key)) {
            return pendingGameSongRequests.get(key) || null
        }

        const request = (async () => {
            try {
                const res = await fetch('/api/game/random-song')
                if (!res.ok) return null
                const data = await res.json()
                return data?.previewUrl ? data as GameSong : null
            } catch (err) {
                console.error('Failed to load game track:', err)
                return null
            }
        })().finally(() => {
            pendingGameSongRequests.delete(key)
        })

        pendingGameSongRequests.set(key, request)
        return request
    }, [])

    const prefetchNextSong = useCallback(() => {
        if (gameSongCache.has(cacheKey) || pendingGameSongRequests.has(cacheKey)) return
        void fetchGameSong(cacheKey).then(song => {
            if (song) gameSongCache.set(cacheKey, song)
        })
    }, [cacheKey, fetchGameSong])

    const loadNewSong = useCallback(async () => {
        resetAudio()
        setGuess('')
        setResult(null)
        setSelectedMarker(null)
        setMessage(null)
        setLoadingSong(true)
        setRoundActive(false)
        setTimeLeft(roundLimit)
        if (resultTimerRef.current) {
            window.clearTimeout(resultTimerRef.current)
            resultTimerRef.current = null
        }

        try {
            const data = await fetchGameSong(cacheKey)
            if (!data?.previewUrl) {
                setCurrentSong(null)
                setMessage('No playable tracks found right now.')
                return
            }

            setCurrentSong(data)
            if (audioRef.current) {
                audioRef.current.src = data.previewUrl
                audioRef.current.load()
            }
            prefetchNextSong()
        } catch (err) {
            console.error('Failed to load track:', err)
            setCurrentSong(null)
            setMessage('Could not load track. Try again.')
        } finally {
            setLoadingSong(false)
        }
    }, [cacheKey, fetchGameSong, prefetchNextSong, resetAudio, roundLimit])

    useEffect(() => {
        void loadNewSong()
        return () => {
            resetAudio()
            if (resultTimerRef.current) {
                window.clearTimeout(resultTimerRef.current)
            }
        }
    }, [loadNewSong, resetAudio])

    useEffect(() => {
        if (!sessionStarted || !roundActive || !!result || loadingSong || gameOver || !currentSong) return
        const timer = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setRoundActive(false)
                    void submitGuess('', previewLimit)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [currentSong, gameOver, loadingSong, previewLimit, result, roundActive, sessionStarted])

    useEffect(() => {
        if (!isRapidFire || !gameOver || !user || arcadeSavedRef.current || score <= 0) return
        arcadeSavedRef.current = true
        void saveArcadeScore(user.id, 'RAPID_FIRE', score, `Round ${round}`)
    }, [gameOver, isRapidFire, round, score, user])

    const startSession = useCallback(() => {
        arcadeSavedRef.current = false
        setScore(0)
        setXp(0)
        setLives(3)
        setRound(1)
        setStreak(0)
        setSessionStarted(true)
        setRoundActive(false)
        setScoreBurst(null)
        void loadNewSong()
    }, [loadNewSong])

    const playAudio = useCallback(async () => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong || gameOver) return
        stopAtRef.current = previewLimit
        if (audioRef.current.currentTime >= previewLimit || currentTime >= previewLimit) {
            audioRef.current.currentTime = 0
            setCurrentTime(0)
        }
        try {
            setSessionStarted(true)
            setRoundActive(true)
            setTimeLeft(prev => (prev > 0 && prev <= roundLimit ? prev : roundLimit))
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Audio play failed:', err)
            setMessage('Audio playback failed. Try another track.')
        }
    }, [currentSong?.previewUrl, currentTime, gameOver, loadingSong, previewLimit, result, roundLimit])

    const pauseAudio = useCallback(() => {
        if (!audioRef.current || !isPlaying || isRapidFire) return
        audioRef.current.pause()
        setIsPlaying(false)
    }, [isPlaying, isRapidFire])

    const jumpToMarker = useCallback(async (seconds: number) => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong || gameOver || difficulty === 'hardcore') {
            return
        }
        setSelectedMarker(seconds)
        stopAtRef.current = seconds
        audioRef.current.currentTime = 0
        setCurrentTime(0)
        setSessionStarted(true)
        setRoundActive(true)
        try {
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Marker playback failed:', err)
            setMessage('Could not play preview at this marker.')
        }
    }, [currentSong?.previewUrl, difficulty, gameOver, loadingSong, result])

    const submitGuess = useCallback(async (guessText: string = guess, timeInSeconds: number = currentTime) => {
        if (!currentSong) return

        try {
            const res = await fetch('/api/game/submit-guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId: currentSong.songId,
                    guessedTitle: guessText,
                    guessTimeSeconds: Math.ceil(timeInSeconds),
                    userId: user?.id
                })
            })

            if (!res.ok) {
                setMessage('Could not submit guess.')
                return
            }

            const data = await res.json()
            const basePoints = Number(data.points || 0)
            const multiplier = isRapidFire ? 1 + Math.min(1, streak * 0.18) : difficultyConfig.multiplier * comboMultiplier
            const awardedPoints = data.correct ? Math.round(basePoints * multiplier) : 0

            if (data.correct) {
                setScore(prev => prev + awardedPoints)
                setXp(prev => prev + Math.round(awardedPoints * 0.6))
                setStreak(prev => prev + 1)
                setScoreBurst(awardedPoints)
                setShowConfetti(true)
                window.setTimeout(() => {
                    setShowConfetti(false)
                    setScoreBurst(null)
                }, 1000)
                data.points = awardedPoints
            } else {
                setLives(prev => Math.max(0, prev - 1))
                setStreak(0)
            }

            setResult(data)
            setRoundActive(false)

            resultTimerRef.current = window.setTimeout(() => {
                if (lives <= 1 && !data.correct) return
                setRound(prev => prev + 1)
                void loadNewSong()
            }, data.correct ? 1200 : 1500)
        } catch (err) {
            console.error('Submit guess failed:', err)
            setMessage('Could not submit guess.')
        } finally {
            pauseAudio()
        }
    }, [comboMultiplier, currentSong, currentTime, difficultyConfig.multiplier, guess, isRapidFire, lives, loadNewSong, pauseAudio, streak, user?.id])

    const handleTimeUpdate = useCallback(() => {
        if (!audioRef.current) return
        const nextTime = Math.min(audioRef.current.currentTime, previewLimit)
        setCurrentTime(nextTime)

        if (stopAtRef.current !== null && nextTime >= stopAtRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
            stopAtRef.current = null
        }
    }, [previewLimit])

    const handleAudioEnded = useCallback(() => {
        setIsPlaying(false)
        setCurrentTime(previewLimit)
    }, [previewLimit])

    const openDirectYouTube = useCallback(async () => {
        if (!currentSong?.songId) return

        try {
            const res = await fetch(`/api/youtube/song/${currentSong.songId}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url?.startsWith('https://www.youtube.com/watch?v=')) {
                    window.open(payload.url, '_blank', 'noopener,noreferrer')
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for game song ${currentSong.songId}:`, err)
        }
    }, [currentSong?.songId])

    const roundFinished = !!result
    const revealedCover = roundFinished ? (result?.albumCover || currentSong?.albumCover) : null

    return (
        <PlayGameFrame
            title={isRapidFire ? 'Rapid Fire' : 'Guess The Track'}
            subtitle={isRapidFire
                ? 'Locked short-window rounds with lives, pressure, and score spikes.'
                : 'Preview-based song recognition with difficulty ladders, streak XP, and a live global board.'}
            onBack={onBack}
            stats={[
                { label: 'Score', value: score, tone: 'accent' },
                { label: 'Clock', value: `${timeLeft}s`, tone: timeLeft <= 5 ? 'danger' : 'default' },
                { label: 'Lives', value: lives, tone: lives <= 1 ? 'danger' : 'default' },
                { label: 'Streak', value: `${streak}x` },
                { label: 'XP', value: xp },
            ]}
            hero={
                <div className={`arcade-guess-hero ${timeLeft <= 5 && roundActive ? 'is-urgent' : ''} ${revealedCover ? 'arcade-guess-hero--revealed' : ''}`}>
                    <audio
                        ref={audioRef}
                        onTimeUpdate={handleTimeUpdate}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onEnded={handleAudioEnded}
                    />

                    {revealedCover && (
                        <div className="arcade-guess-cover-shell">
                            <img className="arcade-guess-cover" src={revealedCover} alt={currentSong?.songTitle || 'Album cover'} />
                            {showConfetti && <div className="confetti-burst">+{scoreBurst}</div>}
                        </div>
                    )}

                    <div className="arcade-guess-hero-copy">
                        <div className="arcade-guess-mode-row">
                            {!isRapidFire && (
                                <div className="arcade-difficulty-toggle">
                                    {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            className={`arcade-difficulty-btn ${difficulty === mode ? 'active' : ''}`}
                                            onClick={() => {
                                                setDifficulty(mode)
                                                setSessionStarted(false)
                                                setRound(1)
                                                setLives(3)
                                                setStreak(0)
                                                setScore(0)
                                                setXp(0)
                                                setTimeLeft(DIFFICULTY_CONFIG[mode].roundTime)
                                                void loadNewSong()
                                            }}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <span className="lyric-chip">{isRapidFire ? '10s lock run' : difficultyConfig.label}</span>
                        </div>

                        <h3 className="arcade-guess-heading">
                            {message || (currentSong?.artistName ? `Artist: ${currentSong.artistName}` : 'Loading track...')}
                        </h3>
                        <p className="game-description">
                            {catalogLoading
                                ? 'Loading the verified arcade pool...'
                                : isRapidFire
                                    ? `Round ${round}. No skipping, no pause exploits, ${artistCount} artists in rotation.`
                                    : `Guess from a ${previewLimit}-second preview. Pool loaded: ${artistCount} artists and ${songCount} playable tracks.`}
                        </p>

                        <div className="progress-bar-container">
                            <div className={`progress-bar ${timeLeft <= 5 && roundActive ? 'is-urgent' : ''}`}>
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(currentTime / previewLimit) * 100}%` }}
                                />
                                {timeMarkers.map(marker => (
                                    <div
                                        key={marker}
                                        className={`time-marker ${selectedMarker === marker ? 'selected' : ''}`}
                                        style={{ left: `${(marker / previewLimit) * 100}%` }}
                                        onClick={() => !roundFinished && !loadingSong && jumpToMarker(marker)}
                                    >
                                        <div className="marker-label">{marker}s</div>
                                        <div className="marker-dot" />
                                    </div>
                                ))}
                            </div>
                            <div className="time-display">{currentTime.toFixed(1)}s / {previewLimit}s</div>
                        </div>
                    </div>
                </div>
            }
            leaderboard={isRapidFire
                ? <ArcadeLeaderboard mode="RAPID_FIRE" title="Rapid Fire Leaderboard" />
                : <GuessTrackLeaderboard />}
            footer={
                !user ? (
                    <div className="auth-gate">
                        <p className="game-description">Log in or sign up to save scores to the leaderboard.</p>
                        <div className="auth-gate-actions">
                            <a className="btn btn-small btn-secondary" href="/login">Log In</a>
                            <a className="btn btn-small btn-primary" href="/signup">Sign Up</a>
                        </div>
                    </div>
                ) : null
            }
        >
            {gameOver ? (
                <div className="result-section">
                    <div className="result incorrect">
                        <h3>{isRapidFire ? 'Rapid Fire Over' : 'Run Over'}</h3>
                        <p className="artist-name">Final score: {score}</p>
                        <p className="album-name">XP earned: {xp}</p>
                    </div>
                    <button className="btn-next" onClick={startSession}>
                        Restart Run
                    </button>
                </div>
            ) : (
                <>
                    <div className="playback-controls">
                        {!isPlaying ? (
                            <button
                                className="btn-control"
                                onClick={playAudio}
                                disabled={roundFinished || loadingSong || !currentSong?.previewUrl}
                            >
                                {loadingSong ? 'Loading...' : sessionStarted ? (isRapidFire ? 'Blast Next Round' : 'Replay Preview') : (isRapidFire ? 'Start Blast' : 'Start Round')}
                            </button>
                        ) : !isRapidFire ? (
                            <button className="btn-control" onClick={pauseAudio}>
                                Pause
                            </button>
                        ) : (
                            <button className="btn-control" disabled>
                                Locked 10s Run
                            </button>
                        )}
                        {roundFinished && currentSong?.youtubeUrl && (
                            <button type="button" onClick={openDirectYouTube} className="game-yt-btn">
                                Play on YouTube
                            </button>
                        )}
                    </div>

                    {!roundFinished ? (
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            if (!guess.trim()) return
                            void submitGuess()
                        }} className="guess-form">
                            <input
                                type="text"
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                placeholder={isRapidFire ? 'Name it fast...' : 'Guess the song title...'}
                                className="guess-input"
                            />
                            <button
                                type="submit"
                                className="btn-submit"
                                disabled={!guess.trim() || loadingSong || !currentSong}
                            >
                                Lock In
                            </button>
                        </form>
                    ) : (
                        <div className="result-section">
                            {result.correct ? (
                                <div className="result correct">
                                    <h3>Correct</h3>
                                    {revealedCover && <img className="result-cover" src={revealedCover} alt={result.correctTitle} />}
                                    <p className="song-title">{result.correctTitle}</p>
                                    <p className="artist-name">{result.artistName}</p>
                                    <p className="album-name">{result.albumName}</p>
                                    <p className="points-earned">+{result.points} points</p>
                                </div>
                            ) : (
                                <div className="result incorrect">
                                    <h3>Wrong or Time Up</h3>
                                    {revealedCover && <img className="result-cover" src={revealedCover} alt={result.correctTitle} />}
                                    <p className="song-title">{result.correctTitle}</p>
                                    <p className="artist-name">{result.artistName}</p>
                                    <p className="album-name">{result.albumName}</p>
                                </div>
                            )}
                            <button className="btn-next" onClick={() => {
                                setRound(prev => prev + 1)
                                void loadNewSong()
                            }}>
                                Next Track
                            </button>
                        </div>
                    )}
                </>
            )}
        </PlayGameFrame>
    )
})
