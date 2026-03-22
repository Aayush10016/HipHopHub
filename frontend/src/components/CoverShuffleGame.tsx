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

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export default function CoverShuffleGame() {
    const [songs, setSongs] = useState<SongOption[]>([])
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [started, setStarted] = useState(false)

    useEffect(() => {
        fetch('/api/songs/top/dhh?days=365&limit=60')
            .then(res => res.ok ? res.json() : [])
            .then(data => setSongs(shuffle((data || []).filter((song: SongOption) => !!song.title)).slice(0, 20)))
            .catch(() => setSongs([]))
    }, [])

    const current = songs[index % Math.max(1, songs.length)]
    const over = timeLeft <= 0

    const options = useMemo(() => {
        if (!current) return []
        const others = shuffle(songs.filter(song => song.id !== current.id).map(song => song.title)).slice(0, 3)
        return shuffle([current.title, ...others])
    }, [current, songs])

    useEffect(() => {
        if (!started || over) return
        const timer = window.setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000)
        return () => window.clearInterval(timer)
    }, [over, started])

    useEffect(() => {
        if (!selected || over) return
        const timeout = window.setTimeout(() => {
            setSelected(null)
            setStatus(null)
            setIndex(prev => prev + 1)
        }, 800)
        return () => window.clearTimeout(timeout)
    }, [over, selected])

    const start = () => {
        setIndex(0)
        setScore(0)
        setTimeLeft(SESSION_TIME)
        setSelected(null)
        setStatus(null)
        setStarted(true)
    }

    const choose = (option: string) => {
        if (!started || over || selected || !current) return
        setSelected(option)
        if (option === current.title) {
            setScore(prev => prev + 120)
            setStatus('Correct title.')
        } else {
            setStatus(`Correct title: ${current.title}`)
        }
    }

    const cover = current?.coverUrl || current?.album?.coverImageUrl || current?.album?.coverUrl

    return (
        <div className="game-placeholder card">
            <h3>Cover Shuffle</h3>
            <p>One-minute sprint. Read the cover and lock the right track title before the buzzer.</p>
            <div className="lyric-status-row">
                <span className="lyric-chip">Score: {score}</span>
                <span className="lyric-chip">Timer: {timeLeft}s</span>
            </div>
            {!started || over ? (
                <div className="blitz-launch">
                    {over && <p className="game-description">Session over. Final score: {score}</p>}
                    <button type="button" className="btn-next" onClick={start}>
                        {over ? 'Play Again' : 'Start Cover Shuffle'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="blitz-cover">
                        {cover ? <img src={cover} alt={current?.title || 'Cover'} /> : <div className="album-cover-placeholder">Cover</div>}
                    </div>
                    <p className="game-description">Which track matches this cover?</p>
                    <div className="blitz-options">
                        {options.map(option => (
                            <button
                                key={option}
                                type="button"
                                className={`blitz-option ${selected === option ? 'active' : ''}`}
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
