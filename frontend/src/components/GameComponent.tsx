import { useCallback, useEffect, useRef, useState } from 'react'
import { readRecentValues, writeRecentValue } from '../utils/rotation'
import './GameComponent.css'

interface GameComponentProps {
    mode: 'global' | 'artist'
    artistId?: number
    variant?: 'guess' | 'rapid'
}

interface GameSong {
    songId: number
    previewUrl: string
    albumCover?: string
    artistName?: string
    youtubeUrl?: string
}

interface AuthUser {
    id: number
    username: string
    email: string
}

type GuessResult = {
    correct: boolean
    correctTitle: string
    artistName: string
    albumName: string
    albumCover?: string
    points: number
}

const gameSongCache = new Map<string, GameSong>()
const pendingGameSongRequests = new Map<string, Promise<GameSong | null>>()
const GUESS_TIMELINE_MARKERS = [0, 1, 3, 5, 10, 15, 20, 25, 30]

const getStoredUser = (): AuthUser | null => {
    try {
        const raw = localStorage.getItem('hiphophub_user')
        if (!raw) return null
        return JSON.parse(raw) as AuthUser
    } catch {
        return null
    }
}

const scoreForGuessTime = (seconds: number) => {
    if (seconds <= 1) return 1000
    if (seconds <= 3) return 900
    if (seconds <= 5) return 800
    if (seconds <= 10) return 650
    if (seconds <= 15) return 500
    if (seconds <= 20) return 350
    if (seconds <= 25) return 200
    return 100
}

const saveArcadeScore = async (userId: number, mode: 'RAPID_FIRE', points: number, metaLabel: string) => {
    await fetch('/api/arcade/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode, points, metaLabel }),
    })
}

export default function GameComponent({ mode, artistId, variant = 'guess' }: GameComponentProps) {
    const [currentSong, setCurrentSong] = useState<GameSong | null>(null)
    const [guess, setGuess] = useState('')
    const [result, setResult] = useState<GuessResult | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [selectedMarker, setSelectedMarker] = useState<number | null>(null)
    const [score, setScore] = useState(0)
    const [showConfetti, setShowConfetti] = useState(false)
    const [loadingSong, setLoadingSong] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [user] = useState<AuthUser | null>(getStoredUser())
    const [streak, setStreak] = useState(0)
    const [rapidLives, setRapidLives] = useState(3)
    const [rapidRound, setRapidRound] = useState(1)
    const [rapidTimeLeft, setRapidTimeLeft] = useState(10)
    const [rapidRoundActive, setRapidRoundActive] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)
    const stopAtRef = useRef<number | null>(null)
    const resultTimerRef = useRef<number | null>(null)
    const arcadeSavedRef = useRef(false)
    const mountedRef = useRef(false)

    const cacheKey = mode === 'global' ? 'global' : `artist-${artistId ?? 'unknown'}`
    const recentArtistKey = `hiphophub:game-recent-artists:${cacheKey}`
    const isRapidFire = variant === 'rapid'
    const rapidGameOver = isRapidFire && rapidLives <= 0
    const previewLimit = isRapidFire ? 10 : 30
    const timeMarkers = isRapidFire ? [] : GUESS_TIMELINE_MARKERS

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

        const url = mode === 'global'
            ? '/api/game/random-song'
            : `/api/game/random-song/artist/${artistId}`

        const request = (async () => {
            const recentArtists = readRecentValues(recentArtistKey)
            const maxAttempts = mode === 'global' ? 4 : 1

            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                try {
                    const res = await fetch(url)
                    if (!res.ok) return null
                    const data = await res.json()
                    console.log('API:', data)
                    if (!data?.previewUrl) return null

                    const gameSong = data as GameSong
                    const artistName = gameSong.artistName
                    const isRecentRepeat = mode === 'global' && artistName && recentArtists.includes(artistName)

                    if (!isRecentRepeat || attempt === maxAttempts - 1) {
                        if (artistName) {
                            writeRecentValue(recentArtistKey, artistName, 10)
                        }
                        return gameSong
                    }
                } catch (err) {
                    console.error('Failed to load game track:', err)
                    return null
                }
            }

            return null
        })().finally(() => {
            pendingGameSongRequests.delete(key)
        })

        pendingGameSongRequests.set(key, request)
        return request
    }, [artistId, mode, recentArtistKey])

    const prefetchNextSong = useCallback(() => {
        if (gameSongCache.has(cacheKey) || pendingGameSongRequests.has(cacheKey)) return
        void fetchGameSong(cacheKey).then(song => {
            if (song) gameSongCache.set(cacheKey, song)
        })
    }, [cacheKey, fetchGameSong])

    const loadNewSong = useCallback(async (autoStartRapid = false) => {
        resetAudio()
        setGuess('')
        setResult(null)
        setSelectedMarker(null)
        setShowConfetti(false)
        setMessage(null)
        setLoadingSong(true)
        if (isRapidFire) {
            setRapidTimeLeft(10)
            setRapidRoundActive(false)
        }
        if (resultTimerRef.current) {
            window.clearTimeout(resultTimerRef.current)
            resultTimerRef.current = null
        }

        try {
            const data = await fetchGameSong(cacheKey)
            if (!data?.previewUrl) {
                setCurrentSong(null)
                return
            }

            setCurrentSong(data)
            if (audioRef.current) {
                audioRef.current.src = data.previewUrl
                audioRef.current.load()
            }
            prefetchNextSong()
            if (isRapidFire && autoStartRapid) {
                window.setTimeout(() => {
                    void playAudio(true)
                }, 120)
            }
        } catch (err) {
            console.error('Failed to load game track:', err)
            setCurrentSong(null)
        } finally {
            setLoadingSong(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey, fetchGameSong, isRapidFire, prefetchNextSong, resetAudio])

    useEffect(() => {
        if (mountedRef.current) return
        mountedRef.current = true
        void loadNewSong()
        return () => {
            resetAudio()
            if (resultTimerRef.current) {
                window.clearTimeout(resultTimerRef.current)
            }
        }
    }, [loadNewSong, resetAudio])

    useEffect(() => {
        prefetchNextSong()
    }, [prefetchNextSong])

    useEffect(() => {
        if (!isRapidFire || !rapidRoundActive || rapidGameOver || !!result || loadingSong || !currentSong) return

        const timer = window.setInterval(() => {
            setRapidTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setRapidRoundActive(false)
                    void submitGuess('', 10)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => window.clearInterval(timer)
    }, [currentSong, isRapidFire, loadingSong, rapidGameOver, rapidRoundActive, result])

    useEffect(() => {
        if (!rapidGameOver || !user || arcadeSavedRef.current || score <= 0) return
        arcadeSavedRef.current = true
        void saveArcadeScore(user.id, 'RAPID_FIRE', score, `Round ${rapidRound}`)
    }, [rapidGameOver, rapidRound, score, user])

    const resetRapidSession = () => {
        arcadeSavedRef.current = false
        setRapidLives(3)
        setRapidRound(1)
        setRapidTimeLeft(10)
        setScore(0)
        setStreak(0)
        setResult(null)
        setRapidRoundActive(false)
        void loadNewSong()
    }

    const pauseAudio = useCallback(() => {
        if (!audioRef.current) return
        audioRef.current.pause()
        setIsPlaying(false)
        if (isRapidFire) {
            setRapidRoundActive(false)
        }
    }, [isRapidFire])

    const playAudio = async (forceRestart = false) => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong || rapidGameOver) return

        if (forceRestart || isRapidFire || audioRef.current.currentTime >= previewLimit || currentTime >= previewLimit) {
            audioRef.current.currentTime = 0
            setCurrentTime(0)
        }

        if (isRapidFire) {
            stopAtRef.current = previewLimit
            setRapidRoundActive(true)
            setRapidTimeLeft(forceRestart || currentTime <= 0 ? previewLimit : Math.max(0, Math.ceil(previewLimit - audioRef.current.currentTime)))
        } else {
            stopAtRef.current = selectedMarker && selectedMarker > 0 ? selectedMarker : null
        }

        try {
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Audio play failed:', err)
        }
    }

    const jumpToMarker = async (seconds: number) => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong || rapidGameOver || isRapidFire) return
        setSelectedMarker(seconds)
        stopAtRef.current = seconds
        audioRef.current.currentTime = 0
        setCurrentTime(0)

        try {
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Marker playback failed:', err)
        }
    }

    const submitGuess = async (
        guessText: string = guess,
        timeInSeconds: number = currentTime,
    ) => {
        if (!currentSong) return

        try {
            const res = await fetch('/api/game/submit-guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId: currentSong.songId,
                    guessedTitle: guessText,
                    guessTimeSeconds: Math.ceil(timeInSeconds),
                    userId: user?.id,
                }),
            })

            if (!res.ok) {
                return
            }

            const data = await res.json()
            const timeScore = scoreForGuessTime(Math.ceil(Math.max(0, timeInSeconds)))
            const awardedPoints = data.correct
                ? (isRapidFire ? Math.max(180, timeScore) + (streak * 25) : timeScore)
                : 0

            const nextResult: GuessResult = {
                correct: !!data.correct,
                correctTitle: data.correctTitle || '',
                artistName: data.artistName || currentSong.artistName || '',
                albumName: data.albumName || '',
                albumCover: data.albumCover || currentSong.albumCover,
                points: awardedPoints,
            }

            setResult(nextResult)

            if (data.correct) {
                setScore(prev => prev + awardedPoints)
                setStreak(prev => prev + 1)
                setShowConfetti(true)
                window.setTimeout(() => setShowConfetti(false), 3000)
                if (!user) {
                    setMessage('Log in or sign up to save scores.')
                }
            } else {
                setStreak(0)
                if (isRapidFire) {
                    setRapidLives(prev => Math.max(0, prev - 1))
                }
            }
        } catch (err) {
            console.error('Submit guess failed:', err)
        } finally {
            if (audioRef.current) {
                audioRef.current.pause()
            }
            setIsPlaying(false)
        }
    }

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!guess.trim()) return
        void submitGuess()
    }

    const handleTimeUpdate = () => {
        if (!audioRef.current) return
        const nextTime = Math.min(audioRef.current.currentTime, previewLimit)
        setCurrentTime(nextTime)

        if (stopAtRef.current !== null && nextTime >= stopAtRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
            stopAtRef.current = null
            if (isRapidFire) {
                setRapidRoundActive(false)
            }
        }
    }

    const handleAudioEnded = () => {
        setIsPlaying(false)
        setCurrentTime(previewLimit)
        if (!result && isRapidFire) {
            setRapidRoundActive(false)
        }
    }

    useEffect(() => {
        console.log('GameComponent state:', {
            mode,
            variant,
            hasSong: !!currentSong,
            songId: currentSong?.songId ?? null,
            artistHint: currentSong?.artistName ?? null,
            loadingSong,
            rapidGameOver,
        })
    }, [currentSong, loadingSong, mode, rapidGameOver, variant])

    return (
        <div className={`game-component game-shell ${isRapidFire ? 'rapid-fire' : ''}`}>
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onEnded={handleAudioEnded}
            />

            <div className="score-display">
                <span className="trophy-icon">Trophy</span>
                <span className="score-text">Score: {score}</span>
            </div>

            {isRapidFire && (
                <div className="rapid-fire-strip">
                    <span>Rapid Fire</span>
                    <span>Round: {rapidRound}</span>
                    <span>Lives: {rapidLives}</span>
                    <span>Streak: {streak}</span>
                    <span>Clock: {rapidTimeLeft}s</span>
                </div>
            )}

            {message ? <p className="empty-message">{message}</p> : null}
            {!user && (
                <div className="auth-gate">
                    <p className="game-description">Log in or sign up to save scores to the leaderboard.</p>
                    <div className="auth-gate-actions">
                        <a className="btn btn-small btn-secondary" href="/login">Log In</a>
                        <a className="btn btn-small btn-primary" href="/signup">Sign Up</a>
                    </div>
                </div>
            )}
            {currentSong?.artistName && !result && (
                <p className="game-description">Artist hint: {currentSong.artistName}</p>
            )}

            <div className="question-card-section">
                <div className="question-card" aria-label="Mystery track card">
                    <div className="question-card__glow" />
                    <div className="question-card__mark">?</div>
                    {result && showConfetti && <div className="confetti-burst">Celebration</div>}
                </div>
            </div>

            {!isRapidFire && (
                <div className="preview-timeline">
                    <div className="preview-timeline__labels" style={{ gridTemplateColumns: `repeat(${timeMarkers.length}, minmax(0, 1fr))` }}>
                        {timeMarkers.map(marker => (
                            <span key={`label-${marker}`} className="preview-timeline__label">{marker}s</span>
                        ))}
                    </div>
                    <div className="preview-timeline__rail" style={{ gridTemplateColumns: `repeat(${timeMarkers.length}, minmax(0, 1fr))` }}>
                        {timeMarkers.map(marker => (
                            <button
                                key={marker}
                                type="button"
                                className={`preview-timeline__point ${selectedMarker === marker ? 'selected' : ''}`}
                                onClick={() => marker > 0 && !result && !loadingSong && void jumpToMarker(marker)}
                                disabled={marker === 0 || !!result || loadingSong}
                            >
                                <span className="preview-timeline__dot" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="progress-bar-container">
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(currentTime / previewLimit) * 100}%` }} />
                </div>
                <div className="time-display">{currentTime.toFixed(1)}s / {previewLimit}s</div>
            </div>

            <div className="playback-controls">
                <button
                    className="btn-control"
                    onClick={() => {
                        if (isPlaying) {
                            pauseAudio()
                            return
                        }
                        void playAudio(currentTime <= 0)
                    }}
                    disabled={!!result || loadingSong || !currentSong?.previewUrl || rapidGameOver}
                >
                    {isPlaying ? 'Pause Preview' : 'Play Preview'}
                </button>
            </div>

            {rapidGameOver ? (
                <div className="result-section">
                    <div className="result incorrect">
                        <h3>Rapid Fire Over</h3>
                        <p className="artist-name">Final score: {score}</p>
                        <p className="album-name">Best streak this run came from your combo pressure.</p>
                    </div>
                    <button className="btn-next" onClick={resetRapidSession}>
                        Restart Rapid Fire
                    </button>
                </div>
            ) : !result ? (
                <form onSubmit={handleSubmit} className="guess-form">
                    <input
                        type="text"
                        value={guess}
                        onChange={(event) => setGuess(event.target.value)}
                        placeholder={isRapidFire ? 'Guess the track title...' : 'Guess the song title...'}
                        className="guess-input"
                    />
                    <button
                        type="submit"
                        className="btn-submit"
                        disabled={!guess.trim() || loadingSong || !currentSong}
                    >
                        Submit Guess
                    </button>
                </form>
            ) : (
                <div className="result-section">
                    {result.correct ? (
                        <div className="result correct">
                            <h3>Correct!</h3>
                            <p className="song-title">{result.correctTitle}</p>
                            <p className="artist-name">{result.artistName}</p>
                            <p className="album-name">{result.albumName}</p>
                            <p className="points-earned">+{result.points} points</p>
                        </div>
                    ) : (
                        <div className="result incorrect">
                            <h3>Wrong or Time&apos;s Up</h3>
                            <p className="song-title">Correct Answer: {result.correctTitle}</p>
                            <p className="artist-name">{result.artistName}</p>
                            <p className="album-name">{result.albumName}</p>
                        </div>
                    )}
                    <button
                        className="btn-next"
                        onClick={() => {
                            if (isRapidFire) {
                                setRapidRound(prev => prev + 1)
                            }
                            void loadNewSong(false)
                        }}
                    >
                        Next Round
                    </button>
                </div>
            )}
        </div>
    )
}
