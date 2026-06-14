import { useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useGameCatalog, type GameCatalogArtist, type GameCatalogSong } from '../hooks/useGameCatalog'

const SESSION_TIME = 60
const ROUND_DELAY_MS = 900
const ROUND_TIME = 6

type BlitzQuestion = {
    key: string
    prompt: string
    answer: string
    options: string[]
    label: string
    mediaType?: 'cover'
    mediaUrl?: string
    mediaAlt?: string
}

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

const uniqueOptions = (options: string[]) =>
    options.filter((option, index, source) => source.indexOf(option) === index)

export default function ArtistBlitzGame({ onBack }: { onBack: () => void }) {
    const { artists, songs, artistCount, songCount, loading } = useGameCatalog()
    const [queue, setQueue] = useState<BlitzQuestion[]>([])
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

    const questionPool = useMemo(() => {
        const artistNamePool = artists.map(artist => artist.name)
        const questions: BlitzQuestion[] = []

        songs
            .filter(song => !!song.coverUrl)
            .slice(0, 30)
            .forEach(song => {
                const options = uniqueOptions(shuffle([
                    song.artistName,
                    ...shuffle(artistNamePool.filter(name => name !== song.artistName)).slice(0, 3)
                ]))
                if (options.length === 4) {
                    questions.push({
                        key: `cover-${song.id}`,
                        prompt: `Who owns the artwork for "${song.title}"?`,
                        answer: song.artistName,
                        options,
                        label: 'Album image',
                        mediaType: 'cover',
                        mediaUrl: song.coverUrl,
                        mediaAlt: song.title,
                    })
                }
            })

        artists
            .filter(artist => !!artist.city)
            .slice(0, 24)
            .forEach(artist => {
                const options = uniqueOptions(shuffle([
                    artist.name,
                    ...shuffle(artistNamePool.filter(name => name !== artist.name)).slice(0, 3)
                ]))
                if (options.length === 4) {
                    questions.push({
                        key: `city-${artist.id}`,
                        prompt: `Which artist is most associated with ${artist.city}?`,
                        answer: artist.name,
                        options,
                        label: 'City',
                    })
                }
            })

        songs
            .filter(song => !!song.releaseDate)
            .slice(0, 24)
            .forEach(song => {
                const year = song.releaseDate?.slice(0, 4)
                if (!year) return
                const options = uniqueOptions(shuffle([
                    year,
                    ...shuffle(songs
                        .map(item => item.releaseDate?.slice(0, 4))
                        .filter((item): item is string => !!item && item !== year))
                        .slice(0, 3)
                ]))
                if (options.length === 4) {
                    questions.push({
                        key: `year-${song.id}`,
                        prompt: `Which year did "${song.title}" release?`,
                        answer: year,
                        options,
                        label: 'Release year',
                    })
                }
            })

        songs
            .filter(song => song.albumType === 'APPEARS_ON')
            .slice(0, 24)
            .forEach(song => {
                const options = uniqueOptions(shuffle([
                    song.artistName,
                    ...shuffle(artistNamePool.filter(name => name !== song.artistName)).slice(0, 3)
                ]))
                if (options.length === 4) {
                    questions.push({
                        key: `feature-${song.id}`,
                        prompt: `Who is credited on the collaboration "${song.title}"?`,
                        answer: song.artistName,
                        options,
                        label: 'Collaborator',
                        mediaType: song.coverUrl ? 'cover' : undefined,
                        mediaUrl: song.coverUrl,
                        mediaAlt: song.title,
                    })
                }
            })

        songs
            .slice(0, 24)
            .forEach(song => {
                const options = uniqueOptions(shuffle([
                    song.artistName,
                    ...shuffle(artistNamePool.filter(name => name !== song.artistName)).slice(0, 3)
                ]))
                if (options.length === 4) {
                    questions.push({
                        key: `title-${song.id}`,
                        prompt: `Which artist recorded "${song.title}"?`,
                        answer: song.artistName,
                        options,
                        label: 'Track title',
                    })
                }
            })

        return shuffle(questions)
    }, [artists, songs])

    useEffect(() => {
        if (questionPool.length > 0) {
            setQueue(questionPool.slice(0, Math.min(45, questionPool.length)))
        }
    }, [questionPool])

    const current = queue[index % Math.max(1, queue.length)]
    const sessionOver = totalTimeLeft <= 0

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
                    setStatus(`Time up. Correct answer: ${current.answer}`)
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
        setQueue(shuffle(questionPool).slice(0, Math.min(45, questionPool.length)))
    }

    const choose = (answer: string) => {
        if (!current || selectedAnswer || !sessionStarted || sessionOver) return
        setSelectedAnswer(answer)
        if (answer === current.answer) {
            const roundPoints = Math.round(100 + (roundTimeLeft * 12) + (combo * 20))
            setScore(prev => prev + roundPoints)
            setScoreBurst(roundPoints)
            setCorrectCount(prev => prev + 1)
            setCombo(prev => prev + 1)
            setStatus('Correct pick.')
        } else {
            setStatus(`Wrong pick. Correct answer: ${current.answer}`)
            setCombo(0)
            setPerfectMisses(prev => prev + 1)
        }
    }

    const perfectBonus = sessionOver && correctCount > 0 && perfectMisses === 0 ? 400 : 0

    return (
        <PlayGameFrame
            title="Artist Blitz"
            subtitle="One-minute recognition sprint across artwork, city cues, feature credits, release years, and title ownership."
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
                    <p>Question pool: artwork, city, collaborator, year, title.</p>
                    <p>Correct picks: {correctCount}</p>
                </div>
            }
        >
            {!current || loading ? (
                <div className="game-placeholder card">
                    <h3>Artist Blitz</h3>
                    <p>{loading ? 'Artist Blitz is syncing its full verified pool.' : 'No artist-blitz questions are available right now.'}</p>
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
                    {current.mediaType === 'cover' && current.mediaUrl && (
                        <div className="blitz-cover">
                            <img src={current.mediaUrl} alt={current.mediaAlt || current.prompt} />
                        </div>
                    )}
                    <div className="lyric-chip strong">{current.label}</div>
                    <div className="blitz-title">{current.prompt}</div>
                    {scoreBurst && <div className="points-earned">+{scoreBurst}</div>}
                    <div className="blitz-options">
                        {current.options.map(option => (
                            <button
                                key={`${current.key}-${option}`}
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
