import { useCallback, useEffect, useRef, useState } from 'react'
import './GameComponent.css'

interface GameComponentProps {
    mode: 'global' | 'artist'
    artistId?: number
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

const getStoredUser = (): AuthUser | null => {
    try {
        const raw = localStorage.getItem('hiphophub_user')
        if (!raw) return null
        return JSON.parse(raw) as AuthUser
    } catch {
        return null
    }
}

export default function GameComponent({ mode, artistId }: GameComponentProps) {
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
    const audioRef = useRef<HTMLAudioElement>(null)
    const stopAtRef = useRef<number | null>(null)

    const timeMarkers = [1, 3, 5, 10, 15, 30]

    const resetAudio = useCallback(() => {
        if (!audioRef.current) return
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
        setCurrentTime(0)
        stopAtRef.current = null
    }, [])

    const loadNewSong = useCallback(async () => {
        resetAudio()
        setGuess('')
        setResult(null)
        setSelectedMarker(null)
        setShowConfetti(false)
        setMessage(null)
        setLoadingSong(true)

        const url = mode === 'global'
            ? '/api/game/random-song'
            : `/api/game/random-song/artist/${artistId}`

        try {
            const res = await fetch(url)
            if (!res.ok) {
                setCurrentSong(null)
                setMessage(mode === 'artist'
                    ? 'No playable preview tracks found for this artist yet.'
                    : 'No playable tracks found right now.')
                return
            }

            const data = await res.json()
            if (!data?.previewUrl) {
                setCurrentSong(null)
                setMessage('Track loaded without preview audio. Try next song.')
                return
            }

            setCurrentSong(data as GameSong)

            if (audioRef.current) {
                audioRef.current.src = data.previewUrl
                audioRef.current.load()
            }
        } catch (err) {
            console.error('Failed to load game track:', err)
            setCurrentSong(null)
            setMessage('Could not load track. Check backend/API and try again.')
        } finally {
            setLoadingSong(false)
        }
    }, [artistId, mode, resetAudio])

    useEffect(() => {
        loadNewSong()
        return () => resetAudio()
    }, [loadNewSong, resetAudio])

    const playAudio = async () => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong) return
        stopAtRef.current = null
        try {
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (err) {
            console.error('Audio play failed:', err)
            setMessage('Audio playback failed. Try another track.')
        }
    }

    const pauseAudio = () => {
        if (!audioRef.current || !isPlaying) return
        audioRef.current.pause()
        setIsPlaying(false)
    }

    const jumpToMarker = async (seconds: number) => {
        if (!audioRef.current || !currentSong?.previewUrl || !!result || loadingSong) return
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
                setScore(prev => prev + data.points)
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 3000)
                if (!user) {
                    setMessage('Log in to save your score on the leaderboard.')
                }
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
        const nextTime = Math.min(audioRef.current.currentTime, 30)
        setCurrentTime(nextTime)

        if (stopAtRef.current !== null && nextTime >= stopAtRef.current) {
            audioRef.current.pause()
            setIsPlaying(false)
            stopAtRef.current = null
        }
    }

    const handleAudioEnded = () => {
        setIsPlaying(false)
        setCurrentTime(30)
        if (!result) {
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
        <div className="game-component">
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
                <p className="game-description">Artist: {currentSong.artistName}</p>
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
                        style={{ width: `${(currentTime / 30) * 100}%` }}
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
                <div className="time-display">{currentTime.toFixed(1)}s / 30s</div>
            </div>

            <div className="playback-controls">
                {!isPlaying ? (
                    <button
                        className="btn-control"
                        onClick={playAudio}
                        disabled={!!result || loadingSong || !currentSong?.previewUrl}
                    >
                        {loadingSong ? 'Loading...' : 'Play'}
                    </button>
                ) : (
                    <button className="btn-control" onClick={pauseAudio}>
                        Pause
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

            {!result ? (
                <form onSubmit={handleSubmit} className="guess-form">
                    <input
                        type="text"
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Guess the song title..."
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
