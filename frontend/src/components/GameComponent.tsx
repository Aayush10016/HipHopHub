import { useCallback, useEffect, useRef, useState } from 'react'
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

const gameSongCache = new Map<string, GameSong>()
const pendingGameSongRequests = new Map<string, Promise<GameSong | null>>()

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

export default function GameComponent({ mode, artistId, variant = 'guess' }: GameComponentProps) {
    const [currentSong, setCurrentSong] = useState<GameSong | null>(null)
    const [guess, setGuess] = useState('')
    const [result, setResult] = useState<any>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [selectedMarker, setSelectedMarker] = useState<number | null>(null)
    const [score, setScore] = useState(0)
    const [showConfetti, setShowConfetti] = useState(false)
    const [loadingSong, setLoadingSong] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [user, setUser] = useState<AuthUser | null>(getStoredUser())
    const [streak, setStreak] = useState(0)
    const [rapidLives, setRapidLives] = useState(3)
    const [rapidRound, setRapidRound] = useState(1)
    const [rapidTimeLeft, setRapidTimeLeft] = useState(10)
    const [rapidStarted, setRapidStarted] = useState(false)
    const [rapidRoundActive, setRapidRoundActive] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)
    const stopAtRef = useRef<number | null>(null)
    const resultTimerRef = useRef<number | null>(null)
    const arcadeSavedRef = useRef(false)
    const startRapidPlaybackRef = useRef<() => Promise<void>>(() => Promise.resolve())
    const mountedRef = useRef(false)

    const cacheKey = mode === 'global' ? 'global' : `artist-${artistId ?? 'unknown'}`
    const isRapidFire = variant === 'rapid'
    const rapidGameOver = isRapidFire && rapidLives <= 0
    const previewLimit = isRapidFire ? 10 : 30
    const timeMarkers = isRapidFire ? [] : [1, 3, 5, 10, 15, 30]

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

        const request = fetch(url)
            .then(async res => {
                if (!res.ok) return null
                const data = await res.json()
                if (!data?.previewUrl) return null
                return data as GameSong
            })
            .catch(err => {
                console.error('Failed to load game track:', err)
                return null
            })
            .finally(() => {
                pendingGameSongRequests.delete(key)
            })

        pendingGameSongRequests.set(key, request)
        return request
    }, [artistId, mode])

    const prefetchNextSong = useCallback(() => {
        if (gameSongCache.has(cacheKey) || pendingGameSongRequests.has(cacheKey)) {
            return
        }
        void fetchGameSong(cacheKey).then(song => {
            if (song) {
                gameSongCache.set(cacheKey, song)
            }
        })
    }, [cacheKey, fetchGameSong])

    const startRapidPlayback = useCallback(async () => {
        if (!audioRef.current || !audioRef.current.src || rapidGameOver || loadingSong) return
        try {
            audioRef.current.currentTime = 0
            stopAtRef.current = previewLimit
            setCurrentTime(0)
            setRapidStarted(true)
            setRapidRoundActive(true)
            setRapidTimeLeft(previewLimit)
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Rapid playback failed:', err)
            setRapidRoundActive(false)
            setMessage('Audio playback failed. Try another track.')
        }
    }, [loadingSong, previewLimit, rapidGameOver])

    // Keep the ref in sync so loadNewSong can call it without a dependency
    startRapidPlaybackRef.current = startRapidPlayback

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
                setMessage(mode === 'artist'
                    ? 'No playable preview tracks found for this artist yet.'
                    : 'No playable tracks found right now.')
                return
            }

            setCurrentSong(data as GameSong)

            if (audioRef.current) {
                audioRef.current.src = data.previewUrl
                audioRef.current.load()
            }
            prefetchNextSong()
            if (isRapidFire && autoStartRapid) {
                window.setTimeout(() => {
                    void startRapidPlaybackRef.current()
                }, 120)
            }
        } catch (err) {
            console.error('Failed to load game track:', err)
            setCurrentSong(null)
            setMessage('Could not load track. Check backend/API and try again.')
        } finally {
            setLoadingSong(false)
        }
    }, [cacheKey, fetchGameSong, isRapidFire, mode, prefetchNextSong, resetAudio])

    // Initial load — runs only once on mount
    useEffect(() => {
        if (mountedRef.current) return
        mountedRef.current = true
        loadNewSong()
        return () => {
            resetAudio()
            if (resultTimerRef.current) {
                window.clearTimeout(resultTimerRef.current)
            }
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
                    submitGuess('', 10)
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
        setRapidStarted(false)
        setRapidRoundActive(false)
        void loadNewSong()
    }

    const playAudio = async () => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong || rapidGameOver) return
        if (isRapidFire) {
            await startRapidPlayback()
            return
        }
        stopAtRef.current = null
        try {
            audioRef.current.currentTime = 0
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Audio play failed:', err)
            setMessage('Audio playback failed. Try another track.')
        }
    }

    const pauseAudio = () => {
        if (!audioRef.current || !isPlaying || isRapidFire) return
        audioRef.current.pause()
        setIsPlaying(false)
    }

    const jumpToMarker = async (seconds: number) => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong || rapidGameOver) return
        setSelectedMarker(seconds)
        stopAtRef.current = seconds
        audioRef.current.currentTime = 0
        setCurrentTime(0)

        try {
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Marker playback failed:', err)
            setMessage('Could not play preview at this marker.')
        }
    }

    const submitGuess = async (
        guessText: string = guess,
        timeInSeconds: number = currentTime
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
                    userId: user?.id
                })
            })

            if (!res.ok) {
                setMessage('Could not submit guess. Try another song.')
                return
            }

            const data = await res.json()
            setResult(data)

            if (data.correct) {
                const awardedPoints = isRapidFire ? data.points + (streak * 25) : data.points
                setScore(prev => prev + awardedPoints)
                setStreak(prev => prev + 1)
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 3000)
                if (!user) {
                    setMessage('Log in to save your score on the leaderboard.')
                }
                data.points = awardedPoints
            } else {
                setStreak(0)
                if (isRapidFire) {
                    setRapidLives(prev => Math.max(0, prev - 1))
                }
            }

            if (isRapidFire) {
                setRapidRoundActive(false)
                resultTimerRef.current = window.setTimeout(() => {
                    setRapidRound(prev => prev + 1)
                    void loadNewSong(true)
                }, 1600)
            }
        } catch (err) {
            console.error('Submit guess failed:', err)
            setMessage('Could not submit guess. Check your backend and retry.')
        } finally {
            pauseAudio()
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!guess.trim()) return
        submitGuess()
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
        if (!result && !isRapidFire) {
            submitGuess('', 30)
        }
    }

    const openDirectYouTube = async () => {
        if (!currentSong?.songId) return

        let targetUrl = currentSong.youtubeUrl || '#'
        try {
            const res = await fetch(`/api/youtube/song/${currentSong.songId}`)
            if (res.ok) {
                const payload = await res.json()
                if (payload?.url) {
                    targetUrl = payload.url
                }
            }
        } catch (err) {
            console.error(`Failed to resolve direct YouTube URL for game song ${currentSong.songId}:`, err)
        }

        if (targetUrl && targetUrl !== '#') {
            window.open(targetUrl, '_blank', 'noopener,noreferrer')
        }
    }

    return (
        <div className={`game-component ${isRapidFire ? 'rapid-fire' : ''}`}>
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
                    <span>Rapid Fire mode</span>
                    <span>Round: {rapidRound}</span>
                    <span>Lives: {rapidLives}</span>
                    <span>Streak: {streak}</span>
                    <span>Clock: {rapidTimeLeft}s</span>
                </div>
            )}

            {message && <p className="empty-message">{message}</p>}
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
                <p className="game-description">
                    {isRapidFire ? `Rapid clue: ${currentSong.artistName}` : `Artist: ${currentSong.artistName}`}
                </p>
            )}

            <div className="album-cover-section">
                {result ? (
                    <div className="album-cover revealed">
                        <img src={result.albumCover || currentSong?.albumCover} alt="Album" />
                        {showConfetti && <div className="confetti-burst">Celebration</div>}
                    </div>
                ) : (
                    <div className="album-cover hidden">
                        <div className="mystery-icon">?</div>
                    </div>
                )}
            </div>

            <div className="progress-bar-container">
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(currentTime / previewLimit) * 100}%` }}
                    />
                    {timeMarkers.map(marker => (
                        <div
                            key={marker}
                            className={`time-marker ${selectedMarker === marker ? 'selected' : ''}`}
                            style={{ left: `${(marker / 30) * 100}%` }}
                            onClick={() => !result && !loadingSong && jumpToMarker(marker)}
                        >
                            <div className="marker-label">{marker}s</div>
                            <div className="marker-dot" />
                        </div>
                    ))}
                </div>
                <div className="time-display">{currentTime.toFixed(1)}s / {previewLimit}s</div>
            </div>

            <div className="playback-controls">
                {!isPlaying ? (
                    <button
                        className="btn-control"
                        onClick={playAudio}
                        disabled={!!result || loadingSong || !currentSong?.previewUrl || rapidGameOver}
                    >
                        {loadingSong ? 'Loading...' : isRapidFire ? 'Blast' : 'Play'}
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
            </div>

            {currentSong?.youtubeUrl && (
                <div className="game-yt-wrap">
                    <button type="button" onClick={openDirectYouTube} className="game-yt-btn">
                        Play on YT
                    </button>
                </div>
            )}

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
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder={isRapidFire ? 'Name it fast...' : 'Guess the song title...'}
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
                            {isRapidFire && <p className="album-name">Current streak: {streak}</p>}
                        </div>
                    ) : (
                        <div className="result incorrect">
                            <h3>Wrong or Time's Up</h3>
                            <p className="song-title">Correct Answer: {result.correctTitle}</p>
                            <p className="artist-name">{result.artistName}</p>
                            <p className="album-name">{result.albumName}</p>
                        </div>
                    )}
                    <button className="btn-next" onClick={loadNewSong}>
                        Next Song
                    </button>
                </div>
            )}
        </div>
    )
}
