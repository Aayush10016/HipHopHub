import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ArcadeLeaderboard from './ArcadeLeaderboard'
import GuessTrackLeaderboard from './GuessTrackLeaderboard'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadePlayableTrack } from '../lib/gameCatalog'
import './GameComponent.css'

type Variant = 'guess' | 'rapid'

type AuthUser = {
    id: number
    username: string
}

const PREVIEW_MARKERS = [1, 3, 5, 10, 15, 30]
const RAPID_LIMIT = 10
const GUESS_LIMIT = 30

const getStoredUser = (): AuthUser | null => {
    try {
        const raw = localStorage.getItem('hiphophub_user')
        return raw ? JSON.parse(raw) as AuthUser : null
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

const trimText = (value: string) => value.trim()
const difficultyLabel = (round: number) => (round <= 3 ? 'Easy' : round <= 7 ? 'Medium' : 'Hard')

const saveRapidScore = async (userId: number, points: number, streak: number, rounds: number) => {
    await fetch('/api/arcade/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            mode: 'RAPID_FIRE',
            points,
            metaLabel: `Best streak ${streak} - Round ${rounds}`,
        }),
    })
}

function PlayGuessTrackGameComponent({ variant, onBack }: { variant: Variant; onBack: () => void }) {
    const isRapid = variant === 'rapid'
    const { loading, catalog } = useArcadeCatalog()
    const user = useMemo(() => getStoredUser(), [])
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const autoAdvanceRef = useRef<number | null>(null)
    const savedScoreRef = useRef(false)

    const previewLimit = isRapid ? RAPID_LIMIT : GUESS_LIMIT
    const trackDeck = useMemo(
        () => catalog.playableTracks.filter(track => !!track.previewUrl),
        [catalog.playableTracks],
    )

    const [currentTrack, setCurrentTrack] = useState<ArcadePlayableTrack | null>(null)
    const [recentTrackIds, setRecentTrackIds] = useState<number[]>([])
    const [guess, setGuess] = useState('')
    const [score, setScore] = useState(0)
    const [xp, setXp] = useState(0)
    const [streak, setStreak] = useState(0)
    const [bestStreak, setBestStreak] = useState(0)
    const [lives, setLives] = useState(3)
    const [round, setRound] = useState(1)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [timeLeft, setTimeLeft] = useState(previewLimit)
    const [started, setStarted] = useState(false)
    const [loadingRound, setLoadingRound] = useState(false)
    const [roundResult, setRoundResult] = useState<null | {
        correct: boolean
        correctTitle: string
        artistName: string
        albumName: string
        points: number
    }>(null)
    const [feedback, setFeedback] = useState<string | null>(null)
    const [selectedMarker, setSelectedMarker] = useState<number | null>(null)
    const [flashState, setFlashState] = useState<'correct' | 'wrong' | null>(null)

    const gameOver = lives <= 0

    const pickNextTrack = useCallback(() => {
        if (trackDeck.length === 0) return null

        const recent = new Set(recentTrackIds.slice(-12))
        const freshPool = trackDeck.filter(track => !recent.has(track.id))
        const pool = freshPool.length > 0 ? freshPool : trackDeck
        return shuffle(pool)[0] || null
    }, [recentTrackIds, trackDeck])

    const resetAudio = useCallback(() => {
        if (!audioRef.current) return
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
        setCurrentTime(0)
        setTimeLeft(previewLimit)
    }, [previewLimit])

    const beginRound = useCallback((track?: ArcadePlayableTrack | null) => {
        const nextTrack = track || pickNextTrack()
        resetAudio()
        setRoundResult(null)
        setGuess('')
        setSelectedMarker(null)
        setFeedback(null)
        setFlashState(null)
        setStarted(false)
        setLoadingRound(false)

        if (!nextTrack) {
            setCurrentTrack(null)
            return
        }

        setCurrentTrack(nextTrack)
        setRecentTrackIds(prev => [...prev, nextTrack.id])
        if (audioRef.current) {
            audioRef.current.src = nextTrack.previewUrl || ''
            audioRef.current.load()
        }
    }, [pickNextTrack, resetAudio])

    useEffect(() => {
        if (loading || trackDeck.length === 0 || currentTrack) return
        beginRound(trackDeck[0])
    }, [beginRound, currentTrack, loading, trackDeck])

    useEffect(() => {
        return () => {
            if (autoAdvanceRef.current) {
                window.clearTimeout(autoAdvanceRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!isRapid || !gameOver || !user || savedScoreRef.current || score <= 0) return
        savedScoreRef.current = true
        void saveRapidScore(user.id, score, bestStreak, round)
    }, [bestStreak, gameOver, isRapid, round, score, user])

    const queueNextRound = useCallback((delay = isRapid ? 1300 : 0) => {
        if (autoAdvanceRef.current) {
            window.clearTimeout(autoAdvanceRef.current)
        }

        autoAdvanceRef.current = window.setTimeout(() => {
            setRound(prev => prev + 1)
            beginRound()
        }, delay)
    }, [beginRound, isRapid])

    const revealRound = useCallback(async (submittedGuess: string) => {
        if (!currentTrack || roundResult) return
        setLoadingRound(true)
        resetAudio()

        try {
            const response = await fetch('/api/game/submit-guess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId: currentTrack.id,
                    guessedTitle: submittedGuess,
                    guessTimeSeconds: Math.ceil(currentTime),
                    userId: user?.id,
                }),
            })

            if (!response.ok) {
                setFeedback('Could not validate this round. Try the next track.')
                return
            }

            const payload = await response.json()
            const bonus = isRapid ? Math.round((1 + streak * 0.2) * 40) : Math.round((1 + streak * 0.12) * 25)
            const awarded = payload.correct ? Number(payload.points || 0) + bonus : 0
            const nextBestStreak = payload.correct ? Math.max(bestStreak, streak + 1) : bestStreak

            if (payload.correct) {
                setScore(prev => prev + awarded)
                setXp(prev => prev + Math.max(35, Math.round(awarded * 0.45)))
                setStreak(prev => prev + 1)
                setBestStreak(nextBestStreak)
                setFlashState('correct')
            } else {
                setLives(prev => Math.max(0, prev - 1))
                setStreak(0)
                setFlashState('wrong')
            }

            setRoundResult({
                correct: !!payload.correct,
                correctTitle: payload.correctTitle || currentTrack.title,
                artistName: payload.artistName || currentTrack.artistName,
                albumName: payload.albumName || currentTrack.albumTitle || 'Verified DHH release',
                points: awarded,
            })

            if (isRapid && (payload.correct || lives > 1)) {
                queueNextRound(1400)
            }
        } catch (error) {
            console.error('Failed to submit guess', error)
            setFeedback('Could not validate this round. Try the next track.')
        } finally {
            setLoadingRound(false)
        }
    }, [bestStreak, currentTime, currentTrack, isRapid, lives, queueNextRound, resetAudio, roundResult, streak, user?.id])

    const startPlayback = useCallback(async () => {
        if (!audioRef.current || !currentTrack?.previewUrl || roundResult || gameOver) return

        if (audioRef.current.currentTime >= previewLimit || currentTime >= previewLimit) {
            audioRef.current.currentTime = 0
            setCurrentTime(0)
            setTimeLeft(previewLimit)
        }
        setSelectedMarker(null)

        try {
            setStarted(true)
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (error) {
            console.error('Playback failed', error)
            setFeedback('Preview playback failed. Reload the round.')
        }
    }, [currentTime, currentTrack?.previewUrl, gameOver, previewLimit, roundResult])

    const pausePlayback = useCallback(() => {
        if (!audioRef.current || !isPlaying) return
        audioRef.current.pause()
        setIsPlaying(false)
    }, [isPlaying])

    const jumpToMarker = useCallback(async (seconds: number) => {
        if (!audioRef.current || !currentTrack?.previewUrl || roundResult || gameOver || isRapid) return
        audioRef.current.currentTime = 0
        setCurrentTime(0)
        setTimeLeft(seconds)
        setSelectedMarker(seconds)

        try {
            setStarted(true)
            await audioRef.current.play()
            setIsPlaying(true)
        } catch (error) {
            console.error('Marker playback failed', error)
        }
    }, [currentTrack?.previewUrl, gameOver, isRapid, roundResult])

    const handleSubmit = useCallback((event: React.FormEvent) => {
        event.preventDefault()
        if (!trimText(guess) || !currentTrack || roundResult) return
        void revealRound(trimText(guess))
    }, [currentTrack, guess, revealRound, roundResult])

    const restartRun = useCallback(() => {
        savedScoreRef.current = false
        setScore(0)
        setXp(0)
        setStreak(0)
        setBestStreak(0)
        setLives(3)
        setRound(1)
        setRecentTrackIds([])
        beginRound()
    }, [beginRound])

    const openYoutube = useCallback(() => {
        if (!currentTrack?.youtubeUrl) return
        window.open(currentTrack.youtubeUrl, '_blank', 'noopener,noreferrer')
    }, [currentTrack?.youtubeUrl])

    const revealedCover = roundResult ? currentTrack?.coverArtUrl : null
    const previewProgress = Math.max(0, Math.min(100, (currentTime / previewLimit) * 100))

    const hero = (
        <div className={`arcade-game-hero ${flashState ? `is-${flashState}` : ''}`}>
            <audio
                ref={audioRef}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => {
                    if (!audioRef.current) return
                    const effectiveLimit = isRapid ? previewLimit : (selectedMarker ?? previewLimit)
                    const nextTime = Math.min(audioRef.current.currentTime, effectiveLimit)
                    setCurrentTime(nextTime)
                    setTimeLeft(Math.max(0, Math.ceil(effectiveLimit - nextTime)))

                    if (nextTime >= effectiveLimit) {
                        audioRef.current.pause()
                        setIsPlaying(false)
                        if (!roundResult && !loadingRound && isRapid) {
                            void revealRound('')
                        }
                    }
                }}
                onEnded={() => {
                    setIsPlaying(false)
                    if (!roundResult && !loadingRound && isRapid) {
                        void revealRound('')
                    }
                }}
            />

            <div className="arcade-game-hero__cover-shell">
                {revealedCover ? (
                    <img src={revealedCover} alt={currentTrack?.title || 'Album cover'} className="arcade-game-cover" />
                ) : (
                    <div className="arcade-game-cover arcade-game-cover--placeholder" aria-hidden="true">
                        <div className="arcade-game-cover__placeholder-card">
                            <span>Artist hint</span>
                            <strong>{currentTrack?.artistName || 'Loading artist'}</strong>
                            <small>{difficultyLabel(round)} difficulty</small>
                            <small>Round {round}</small>
                        </div>
                    </div>
                )}
            </div>

            <div className="arcade-game-hero__copy">
                <div className="arcade-game-chip-row">
                    <span className="arcade-game-chip">Artist hint: {currentTrack?.artistName || 'Loading artist'}</span>
                    <span className="arcade-game-chip">Round {round}</span>
                    <span className="arcade-game-chip">{difficultyLabel(round)} difficulty</span>
                    {isRapid && <span className="arcade-game-chip">10s auto-next</span>}
                </div>

                <h3>{roundResult ? roundResult.correctTitle : isRapid ? 'Name the track before the clock burns out.' : 'Listen, inspect the timeline, and lock the title.'}</h3>
                <p>
                    {loading
                        ? 'Preparing the verified track deck...'
                        : `${catalog.playableArtists.length.toLocaleString()} verified artists loaded - ${catalog.playableTracks.length.toLocaleString()} playable tracks ready`}
                </p>

                <div className="arcade-timeline">
                    {!isRapid && (
                        <div className="arcade-timeline__ticks" aria-hidden="true">
                            {[0, ...PREVIEW_MARKERS].map(marker => (
                                <span key={`tick-${marker}`}>{marker}s</span>
                            ))}
                        </div>
                    )}
                    <div className={`arcade-timeline__bar ${isPlaying ? 'is-playing' : ''}`}>
                        {!isRapid && PREVIEW_MARKERS.map(marker => (
                            <button
                                key={marker}
                                type="button"
                                className={`arcade-timeline__marker ${selectedMarker === marker ? 'active' : ''}`}
                                style={{ left: `${(marker / previewLimit) * 100}%` }}
                                onClick={() => void jumpToMarker(marker)}
                                disabled={marker > previewLimit || !!roundResult}
                                aria-label={`Jump to ${marker} seconds`}
                            />
                        ))}
                        <div className="arcade-timeline__fill" style={{ width: `${previewProgress}%` }} />
                    </div>
                    <div className="arcade-timeline__legend">
                        <span>{currentTime.toFixed(1)}s</span>
                        <span>{previewLimit}s preview window</span>
                    </div>
                </div>
            </div>
        </div>
    )

    if (loading && trackDeck.length === 0) {
        return (
            <PlayGameFrame
                title={isRapid ? 'Rapid Fire' : 'Guess The Track'}
                subtitle={isRapid ? 'Ten-second bursts built for endless replay loops.' : 'Recognize songs from preview snippets and climb the DHH leaderboard.'}
                stats={[
                    { label: 'Score', value: '...' },
                    { label: 'Timer', value: '...' },
                    { label: 'Lives', value: '...' },
                    { label: 'Streak', value: '...' },
                    { label: 'XP', value: '...' },
                ]}
                onBack={onBack}
                hero={<div className="arcade-skeleton arcade-skeleton--hero" />}
                leaderboard={isRapid ? <ArcadeLeaderboard mode="RAPID_FIRE" title="Rapid Fire Leaderboard" /> : <GuessTrackLeaderboard />}
            >
                <div className="arcade-skeleton arcade-skeleton--body" />
            </PlayGameFrame>
        )
    }

    return (
        <PlayGameFrame
            title={isRapid ? 'Rapid Fire' : 'Guess The Track'}
            subtitle={isRapid ? 'Ten-second rounds, combo bonuses, and instant next-track pressure.' : 'Recognize songs from short previews and climb the DHH leaderboard.'}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 5 ? 'danger' : 'default' },
                { label: 'Lives', value: lives, tone: lives <= 1 ? 'danger' : 'default' },
                { label: 'Streak', value: `${streak}x` },
                { label: 'XP', value: xp.toLocaleString() },
            ]}
            onBack={onBack}
            hero={hero}
            footer={!user ? (
                <div className="auth-gate auth-gate--inline">
                    <p>Log in or sign up to save your run on the leaderboard.</p>
                    <div className="auth-gate-actions">
                        <a className="btn btn-small btn-secondary" href="/login">Log In</a>
                        <a className="btn btn-small btn-primary" href="/signup">Sign Up</a>
                    </div>
                </div>
            ) : null}
            leaderboard={isRapid ? <ArcadeLeaderboard mode="RAPID_FIRE" title="Rapid Fire Leaderboard" /> : <GuessTrackLeaderboard />}
        >
            {trackDeck.length === 0 ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>No playable tracks yet</h4>
                    <p>The arcade is waiting for preview-enabled tracks from the live catalog.</p>
                </div>
            ) : gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{isRapid ? 'Rapid Fire finished' : 'Run finished'}</h4>
                    <p>Final score: {score.toLocaleString()}</p>
                    <p>Best streak: {bestStreak}x</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={restartRun}>Play again</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="arcade-action-row arcade-action-row--top">
                        {!isPlaying ? (
                            <button type="button" className="btn-control" onClick={() => void startPlayback()} disabled={!currentTrack || loadingRound}>
                                {started ? (isRapid ? 'Replay 10s blast' : 'Replay preview') : (isRapid ? 'Start round' : 'Play preview')}
                            </button>
                        ) : (
                            <button type="button" className="btn-control btn-control--secondary" onClick={pausePlayback}>
                                Pause
                            </button>
                        )}
                        {roundResult && currentTrack?.youtubeUrl && (
                            <button type="button" className="game-yt-btn" onClick={openYoutube}>Play on YouTube</button>
                        )}
                    </div>

                    {!roundResult ? (
                        <form className="guess-form" onSubmit={handleSubmit}>
                            <input
                                type="text"
                                className="guess-input"
                                value={guess}
                                onChange={event => setGuess(event.target.value)}
                                placeholder={isRapid ? 'Type the song fast...' : 'Guess the song title...'}
                            />
                            <button type="submit" className="btn-submit" disabled={!trimText(guess) || loadingRound || !currentTrack}>
                                Submit guess
                            </button>
                        </form>
                    ) : (
                        <div className={`arcade-result-card ${roundResult.correct ? 'is-correct' : 'is-wrong'}`}>
                            <h4>{roundResult.correct ? 'Correct' : 'Not this one'}</h4>
                            <p className="song-title">{roundResult.correctTitle}</p>
                            <p className="artist-name">{roundResult.artistName}</p>
                            <p className="album-name">{roundResult.albumName}</p>
                            {roundResult.correct ? <p className="points-earned">+{roundResult.points} points</p> : <p className="album-name">Life lost. Combo reset.</p>}
                            {!isRapid && (
                                <div className="arcade-action-row">
                                    <button type="button" className="btn-next" onClick={() => queueNextRound(0)}>Next track</button>
                                </div>
                            )}
                        </div>
                    )}

                    {feedback && <p className="game-description">{feedback}</p>}
                </>
            )}
        </PlayGameFrame>
    )
}

export default memo(PlayGuessTrackGameComponent)
