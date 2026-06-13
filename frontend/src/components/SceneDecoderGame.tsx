import { useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useGameCatalog, type GameCatalogArtist, type GameCatalogRelease } from '../hooks/useGameCatalog'

const SESSION_TIME = 60
const ROUND_TIME = 8

type SceneQuestion = {
    prompt: string
    answer: string
    options: string[]
    label: string
}

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

const buildWave = (artist: GameCatalogArtist) => {
    const firstYear = artist.releaseYears?.[0]
    if (!firstYear) return 'Modern Wave'
    if (firstYear <= 2015) return 'Pioneer Wave'
    if (firstYear <= 2018) return 'Breakout Wave'
    if (firstYear <= 2021) return 'New Guard'
    return 'Current Wave'
}

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

export default function SceneDecoderGame({ onBack }: { onBack: () => void }) {
    const { artists, releases, artistCount, loading } = useGameCatalog()
    const [questions, setQuestions] = useState<SceneQuestion[]>([])
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [started, setStarted] = useState(false)
    const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME)
    const [combo, setCombo] = useState(0)

    useEffect(() => {
        if (artists.length === 0) return
        const nextQuestions: SceneQuestion[] = []

        const cityArtists = artists.filter(artist => !!artist.city)
        for (let i = 0; i < Math.min(12, cityArtists.length); i += 1) {
            const artist = cityArtists[i]
            const options = shuffle([
                artist.city as string,
                ...shuffle(cityArtists.filter(item => item.id !== artist.id).map(item => item.city as string)).slice(0, 3)
            ])
            nextQuestions.push({
                prompt: `Which city is ${artist.name} most associated with?`,
                answer: artist.city as string,
                options,
                label: 'City roots',
            })
        }

        const factArtists = artists.filter(artist => artist.facts.length > 0)
        for (let i = 0; i < Math.min(12, factArtists.length); i += 1) {
            const artist = factArtists[i]
            const fact = pickRandom(artist.facts)
            const options = shuffle([
                artist.name,
                ...shuffle(factArtists.filter(item => item.id !== artist.id).map(item => item.name)).slice(0, 3)
            ])
            nextQuestions.push({
                prompt: `Guess the artist from this fact: ${fact}`,
                answer: artist.name,
                options,
                label: 'Fact check',
            })
        }

        const waveArtists = artists.filter(artist => artist.releaseYears.length > 0)
        for (let i = 0; i < Math.min(12, waveArtists.length); i += 1) {
            const artist = waveArtists[i]
            const answer = buildWave(artist)
            const options = shuffle([
                answer,
                ...['Pioneer Wave', 'Breakout Wave', 'New Guard', 'Current Wave'].filter(item => item !== answer).slice(0, 3)
            ])
            nextQuestions.push({
                prompt: `Which DHH wave best fits ${artist.name} based on catalog timing?`,
                answer,
                options,
                label: 'Scene wave',
            })
        }

        const datedReleases = releases.filter(release => !!release.releaseDate)
        for (let i = 0; i < Math.min(12, datedReleases.length / 4); i += 1) {
            const selection = shuffle(datedReleases).slice(0, 4)
            const ordered = [...selection].sort((a, b) => (a.releaseDate || '').localeCompare(b.releaseDate || ''))
            const answer = ordered[0]?.title
            if (!answer) continue
            nextQuestions.push({
                prompt: 'Which release came first?',
                answer,
                options: shuffle(selection.map(item => item.title)),
                label: 'Release order',
            })
        }

        setQuestions(shuffle(nextQuestions))
    }, [artists, releases])

    const current = questions[index % Math.max(1, questions.length)]
    const over = timeLeft <= 0
    const options = useMemo(() => current ? shuffle(current.options) : [], [current])

    useEffect(() => {
        if (!started || over) return
        const timer = window.setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000)
        return () => window.clearInterval(timer)
    }, [over, started])

    useEffect(() => {
        if (!started || over || selected || !current) return
        setRoundTimeLeft(ROUND_TIME)
        const timer = window.setInterval(() => {
            setRoundTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setSelected('__timeout__')
                    setStatus(`Time up. Correct answer: ${current.answer}`)
                    setCombo(0)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [current, over, selected, started])

    useEffect(() => {
        if (!selected || over) return
        const timeout = window.setTimeout(() => {
            setSelected(null)
            setStatus(null)
            setIndex(prev => prev + 1)
            setRoundTimeLeft(ROUND_TIME)
        }, 900)
        return () => window.clearTimeout(timeout)
    }, [over, selected])

    const start = () => {
        setQuestions(shuffle(questions))
        setIndex(0)
        setScore(0)
        setTimeLeft(SESSION_TIME)
        setSelected(null)
        setStatus(null)
        setStarted(true)
        setRoundTimeLeft(ROUND_TIME)
        setCombo(0)
    }

    const choose = (option: string) => {
        if (!started || over || selected || !current) return
        setSelected(option)
        if (option === current.answer) {
            const points = 120 + (combo * 20) + (roundTimeLeft * 5)
            setScore(prev => prev + points)
            setCombo(prev => prev + 1)
            setStatus(`Correct. +${points}`)
        } else {
            setStatus(`Correct answer: ${current.answer}`)
            setCombo(0)
        }
    }

    return (
        <PlayGameFrame
            title="Scene Decoder"
            subtitle="Culture quiz mode built from artist facts, city roots, release timing, and wave awareness across the full DHH catalog."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score, tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 10 ? 'danger' : 'default' },
                { label: 'Round', value: `${roundTimeLeft}s`, tone: roundTimeLeft <= 2 ? 'danger' : 'default' },
                { label: 'Combo', value: `${combo}x` },
            ]}
            leaderboard={
                <div className="game-placeholder card">
                    <h3>Decoder Pool</h3>
                    <p>{artistCount} artists loaded.</p>
                    <p>{releases.length} releases available for chronology questions.</p>
                    <p>Question types: city, fact, wave, chronology.</p>
                </div>
            }
        >
            {loading || !current ? (
                <div className="game-placeholder card">
                    <h3>Scene Decoder</h3>
                    <p>Loading the culture map...</p>
                </div>
            ) : !started || over ? (
                <div className="blitz-launch">
                    {over && <p className="game-description">Session over. Final score: {score}</p>}
                    <button type="button" className="btn-next" onClick={start}>
                        {over ? 'Play Again' : 'Start Scene Decoder'}
                    </button>
                </div>
            ) : (
                <>
                    <div className="lyric-chip strong">{current.label}</div>
                    <div className="blitz-title">{current.prompt}</div>
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
        </PlayGameFrame>
    )
}
