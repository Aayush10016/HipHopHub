import { useEffect, useMemo, useState } from 'react'

interface SongOption {
    id: number
    title: string
    artistName?: string
    coverUrl?: string
    album?: {
        coverImageUrl?: string
        coverUrl?: string
    }
}

const SESSION_TIME = 60
const ROUND_DELAY_MS = 900

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export default function ArtistBlitzGame() {
    const [songs, setSongs] = useState<SongOption[]>([])
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [totalTimeLeft, setTotalTimeLeft] = useState(SESSION_TIME)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [sessionStarted, setSessionStarted] = useState(false)
    const [correctCount, setCorrectCount] = useState(0)

    useEffect(() => {
        fetch('/api/songs/top/dhh?days=365&limit=60')
            .then(res => res.ok ? res.json() : [])
            .then(data => setSongs(shuffle((data || []).filter((song: SongOption) => !!song.artistName)).slice(0, 20)))
            .catch(() => setSongs([]))
    }, [])

    const current = songs[index % Math.max(1, songs.length)]
    const sessionOver = totalTimeLeft <= 0

    const options = useMemo(() => {
        if (!current) return []
        const artistPool = shuffle(
            Array.from(new Set(songs.map(song => song.artistName).filter(Boolean) as string[]))
                .filter(name => name !== current.artistName)
        ).slice(0, 3)
        return shuffle([current.artistName || 'Unknown Artist', ...artistPool])
    }, [current, songs])

    useEffect(() => {
        if (!sessionStarted || sessionOver) return
        const timer = window.setInterval(() => {
            setTotalTimeLeft(prev => Math.max(0, prev - 1))
        }, 1000)
        return () => window.clearInterval(timer)
    }, [sessionOver, sessionStarted])

    useEffect(() => {
        if (!sessionStarted || sessionOver || selectedAnswer || !current) return
        const timeout = window.setTimeout(() => {
            setStatus(`Time up. Correct artist: ${current.artistName}`)
            setSelectedAnswer('__timeout__')
        }, ROUND_DELAY_MS * 3)
        return () => window.clearTimeout(timeout)
    }, [current, selectedAnswer, sessionOver, sessionStarted])

    useEffect(() => {
        if (!selectedAnswer || sessionOver) return
        const timeout = window.setTimeout(() => {
            setIndex(prev => prev + 1)
            setSelectedAnswer(null)
            setStatus(null)
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
    }

    const choose = (answer: string) => {
        if (!current || selectedAnswer || !sessionStarted || sessionOver) return
        setSelectedAnswer(answer)
        if (answer === current.artistName) {
            setScore(prev => prev + 100 + (totalTimeLeft * 2))
            setCorrectCount(prev => prev + 1)
            setStatus('Correct pick.')
        } else {
            setStatus(`Wrong pick. Correct artist: ${current.artistName}`)
        }
    }

    if (!current) {
        return (
            <div className="game-placeholder card">
                <h3>Artist Blitz</h3>
                <p>Artist Blitz is syncing its track pool.</p>
            </div>
        )
    }

    const cover = current.coverUrl || current.album?.coverImageUrl || current.album?.coverUrl

    return (
        <div className="game-placeholder card">
            <h3>Artist Blitz</h3>
            <p>One-minute sprint. Identify as many artists as possible before the master timer runs out.</p>
            <div className="lyric-status-row">
                <span className="lyric-chip">Score: {score}</span>
                <span className="lyric-chip">Timer: {totalTimeLeft}s</span>
                <span className="lyric-chip">Correct: {correctCount}</span>
            </div>

            {!sessionStarted || sessionOver ? (
                <div className="blitz-launch">
                    {sessionOver && <p className="game-description">Session over. Final score: {score}</p>}
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
        </div>
    )
}
