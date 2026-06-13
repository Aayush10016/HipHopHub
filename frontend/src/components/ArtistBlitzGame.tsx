import { useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useGameCatalog } from '../hooks/useGameCatalog'

const SESSION_TIME = 60
const ROUND_DELAY_MS = 900
const ROUND_TIME = 6

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export default function ArtistBlitzGame({ onBack }: { onBack: () => void }) {
    const { artists, songs, artistCount, songCount, loading } = useGameCatalog()
    const [queue, setQueue] = useState<typeof songs>([])
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [totalTimeLeft, setTotalTimeLeft] = useState(SESSION_TIME)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [sessionStarted, setSessionStarted] = useState(false)
    const [correctCount, setCorrectCount] = useState(0)
    const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME)
    const [combo, setCombo] = useState(0)
    const [perfectMisses, setPerfectMisses] = useState(0)
    const [scoreBurst, setScoreBurst] = useState<number | null>(null)

    useEffect(() => {
        if (songs.length > 0) {
            setQueue(shuffle(songs).slice(0, Math.min(40, songs.length)))
        }
    }, [songs])

    const current = queue[index % Math.max(1, queue.length)]
    const sessionOver = totalTimeLeft <= 0

    const options = useMemo(() => {
        if (!current) return []
        const pool = shuffle(
            artists
                .map(artist => artist.name)
                .filter(name => name !== current.artistName)
        ).slice(0, 3)
        return shuffle([current.artistName, ...pool])
    }, [artists, current])

    useEffect(() => {
        if (!sessionStarted || sessionOver) return
        const timer = window.setInterval(() => {
            setTotalTimeLeft(prev => Math.max(0, prev - 1))
        }, 1000)
        return () => window.clearInterval(timer)
    }, [sessionOver, sessionStarted])

    useEffect(() => {
        if (!sessionStarted || sessionOver || selectedAnswer || !current) return
        setRoundTimeLeft(ROUND_TIME)
        const timer = window.setInterval(() => {
            setRoundTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setStatus(`Time up. Correct artist: ${current.artistName}`)
                    setSelectedAnswer('__timeout__')
                    setCombo(0)
                    setPerfectMisses(prevMisses => prevMisses + 1)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [current, selectedAnswer, sessionOver, sessionStarted])

    useEffect(() => {
        if (!selectedAnswer || sessionOver) return
        const timeout = window.setTimeout(() => {
            setIndex(prev => prev + 1)
            setSelectedAnswer(null)
            setStatus(null)
            setRoundTimeLeft(ROUND_TIME)
            setScoreBurst(null)
        }, ROUND_DELAY_MS)
        return () => window.clearTimeout(timeout)
    }, [selectedAnswer, sessionOver])

    const startSession = () => {
        setSessionStarted(true)
        setTotalTimeLeft(SESSION_TIME)
        setScore(0)
        setIndex(0)
        setSelectedAnswer(null)
        setStatus(null)
        setCorrectCount(0)
        setRoundTimeLeft(ROUND_TIME)
        setCombo(0)
        setPerfectMisses(0)
        setScoreBurst(null)
        setQueue(shuffle(songs).slice(0, Math.min(40, songs.length)))
    }

    const choose = (answer: string) => {
        if (!current || selectedAnswer || !sessionStarted || sessionOver) return
        setSelectedAnswer(answer)
        if (answer === current.artistName) {
            const roundPoints = Math.round(100 + (roundTimeLeft * 12) + (combo * 20))
            setScore(prev => prev + roundPoints)
            setScoreBurst(roundPoints)
            setCorrectCount(prev => prev + 1)
            setCombo(prev => prev + 1)
            setStatus('Correct pick.')
        } else {
            setStatus(`Wrong pick. Correct artist: ${current.artistName}`)
            setCombo(0)
            setPerfectMisses(prev => prev + 1)
        }
    }

    const perfectBonus = sessionOver && correctCount > 0 && perfectMisses === 0 ? 400 : 0
    const cover = current?.coverUrl

    return (
        <PlayGameFrame
            title="Artist Blitz"
            subtitle="One-minute recognition sprint across the full artist pool. Faster rounds, rising combos, and perfect-run bonus pressure."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score + perfectBonus, tone: 'accent' },
                { label: 'Master Timer', value: `${totalTimeLeft}s`, tone: totalTimeLeft <= 10 ? 'danger' : 'default' },
                { label: 'Round', value: `${roundTimeLeft}s`, tone: roundTimeLeft <= 2 ? 'danger' : 'default' },
                { label: 'Combo', value: `${combo}x` },
            ]}
            leaderboard={
                <div className="game-placeholder card">
                    <h3>Blitz Notes</h3>
                    <p>{loading ? 'Loading verified artists...' : `${artistCount} verified artists are in rotation.`}</p>
                    <p>{loading ? 'Loading track deck...' : `${songCount} playable tracks are available for the blitz deck.`}</p>
                    <p>Perfect round bonus: {perfectMisses === 0 ? 'Live' : 'Lost this run'}</p>
                    <p>Correct picks: {correctCount}</p>
                </div>
            }
        >
            {!current || loading ? (
                <div className="game-placeholder card">
                    <h3>Artist Blitz</h3>
                    <p>{loading ? 'Artist Blitz is syncing its full verified pool.' : 'No artist-blitz tracks are available right now.'}</p>
                </div>
            ) : !sessionStarted || sessionOver ? (
                <div className="blitz-launch">
                    {sessionOver && <p className="game-description">Session over. Final score: {score + perfectBonus}</p>}
                    {sessionOver && perfectBonus > 0 && <p className="game-description">Perfect round bonus unlocked: +{perfectBonus}</p>}
                    <button type="button" className="btn-next" onClick={startSession}>
                        {sessionOver ? 'Play Again' : 'Start Artist Blitz'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="blitz-cover">
                        {cover ? <img src={cover} alt={current.title} /> : <div className="album-cover-placeholder">Cover</div>}
                    </div>
                    <div className="blitz-title">{current.title}</div>
                    {scoreBurst && <div className="points-earned">+{scoreBurst}</div>}
                    <div className="blitz-options">
                        {options.map(option => (
                            <button
                                key={option}
                                type="button"
                                className={`blitz-option ${selectedAnswer === option ? 'active' : ''}`}
                                onClick={() => choose(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {status && <p className="game-description">{status}</p>}
                </>
            )}
        </PlayGameFrame>
    )
}
