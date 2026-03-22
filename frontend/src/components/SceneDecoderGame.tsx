import { useEffect, useMemo, useState } from 'react'

interface SceneQuestion {
    artist: string
    answer: string
    options: string[]
}

const SESSION_TIME = 60

const sceneQuestions: SceneQuestion[] = [
    { artist: 'DIVINE', answer: 'Mumbai', options: ['Mumbai', 'Delhi', 'Bengaluru', 'Pune'] },
    { artist: 'KR$NA', answer: 'Delhi', options: ['Delhi', 'Mumbai', 'Kolkata', 'Goa'] },
    { artist: 'Seedhe Maut', answer: 'Delhi', options: ['Delhi', 'Jaipur', 'Chennai', 'Goa'] },
    { artist: 'MC Stan', answer: 'Pune', options: ['Pune', 'Delhi', 'Mumbai', 'Ahmedabad'] },
    { artist: 'Prabh Deep', answer: 'Delhi', options: ['Delhi', 'Amritsar', 'Pune', 'Shillong'] },
    { artist: 'Hanumankind', answer: 'Bengaluru', options: ['Bengaluru', 'Delhi', 'Mumbai', 'Lucknow'] },
    { artist: 'The Siege', answer: 'Mumbai', options: ['Mumbai', 'Delhi', 'Pune', 'Surat'] },
    { artist: 'Siyaahi', answer: 'Ahmedabad', options: ['Ahmedabad', 'Delhi', 'Pune', 'Bhopal'] },
    { artist: 'EPR', answer: 'Kolkata', options: ['Kolkata', 'Delhi', 'Mumbai', 'Shillong'] },
    { artist: 'Vijay DK', answer: 'Mumbai', options: ['Mumbai', 'Pune', 'Indore', 'Delhi'] }
]

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

export default function SceneDecoderGame() {
    const [questions, setQuestions] = useState(() => shuffle(sceneQuestions))
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [started, setStarted] = useState(false)

    const current = questions[index % questions.length]
    const over = timeLeft <= 0
    const options = useMemo(() => shuffle(current.options), [current])

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
        setQuestions(shuffle(sceneQuestions))
        setIndex(0)
        setScore(0)
        setTimeLeft(SESSION_TIME)
        setSelected(null)
        setStatus(null)
        setStarted(true)
    }

    const choose = (option: string) => {
        if (!started || over || selected) return
        setSelected(option)
        if (option === current.answer) {
            setScore(prev => prev + 120)
            setStatus('Correct.')
        } else {
            setStatus(`Correct answer: ${current.answer}`)
        }
    }

    return (
        <div className="game-placeholder card">
            <h3>Scene Decoder</h3>
            <p>Match artists to their city roots in a one-minute DHH knowledge sprint.</p>
            <div className="lyric-status-row">
                <span className="lyric-chip">Score: {score}</span>
                <span className="lyric-chip">Timer: {timeLeft}s</span>
            </div>
            {!started || over ? (
                <div className="blitz-launch">
                    {over && <p className="game-description">Session over. Final score: {score}</p>}
                    <button type="button" className="btn-next" onClick={start}>
                        {over ? 'Play Again' : 'Start Scene Decoder'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="blitz-title">{current.artist}</div>
                    <p className="game-description">Which city is this artist most associated with?</p>
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
