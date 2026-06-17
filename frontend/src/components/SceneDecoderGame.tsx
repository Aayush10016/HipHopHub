import { memo, useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeSceneQuestion, GameCatalogArtist, GameCatalogRelease } from '../lib/gameCatalog'

const SESSION_TIME = 60
const ROUND_TIME = 10

const shuffle = <T,>(items: T[]) => {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const buildOptions = (answer: string, pool: string[], size = 4) => {
    const options = unique(pool).filter(item => item.toLowerCase() !== answer.toLowerCase())
    return shuffle([answer, ...shuffle(options).slice(0, Math.max(0, size - 1))])
}

const buildFallbackSceneQuestions = (artists: GameCatalogArtist[], releases: GameCatalogRelease[]) => {
    const questions: ArcadeSceneQuestion[] = []
    const artistNames = artists.map(artist => artist.name)
    const cities = unique(artists.map(artist => artist.city || ''))
    const labels = unique(artists.flatMap(artist => artist.labels || []))
    const collectives = unique(artists.flatMap(artist => artist.collectives || []))
    const years = unique(releases.map(release => (release.releaseDate || '').slice(0, 4)).filter(Boolean))

    artists.forEach(artist => {
        if (artist.city) {
            questions.push({
                id: `scene-city-${artist.id}`,
                category: 'city',
                prompt: `Which city is ${artist.name} most associated with?`,
                answer: artist.city,
                options: buildOptions(artist.city, cities),
                explanation: `${artist.name} is tied to the ${artist.city} lane in the HipHopHub catalog.`,
            })
        }

        if (artist.facts.length > 0) {
            questions.push({
                id: `scene-fact-${artist.id}`,
                category: 'fact',
                prompt: `Which artist matches this fact? ${artist.facts[0]}`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNames),
                explanation: `This clue comes directly from ${artist.name}'s verified profile.`,
            })
        }

        if ((artist.collectives || []).length > 0) {
            const collective = artist.collectives?.[0]
            if (collective) {
                questions.push({
                    id: `scene-collective-${artist.id}`,
                    category: 'collaborator',
                    prompt: `Which collective is linked with ${artist.name}?`,
                    answer: collective,
                    options: buildOptions(collective, collectives),
                    explanation: `${artist.name} is mapped to ${collective} in the verified catalog.`,
                })
            }
        }

        if ((artist.labels || []).length > 0) {
            const label = artist.labels?.[0]
            if (label) {
                questions.push({
                    id: `scene-label-${artist.id}`,
                    category: 'album',
                    prompt: `Which label is connected to ${artist.name}?`,
                    answer: label,
                    options: buildOptions(label, labels),
                    explanation: `${artist.name} is associated with ${label} in the verified catalog.`,
                })
            }
        }
    })

    releases.slice(0, 180).forEach(release => {
        const year = (release.releaseDate || '').slice(0, 4)
        if (!year) return
        questions.push({
            id: `scene-year-${release.id}`,
            category: 'year',
            prompt: `Which year did "${release.title}" release?`,
            answer: year,
            options: buildOptions(year, years),
            explanation: `${release.title} is stored with a ${year} release date in the verified catalog.`,
        })
    })

    return questions
}

function SceneDecoderGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, artists, releases, catalog } = useArcadeCatalog()
    const totalArtists = catalog.artistCount || artists.length
    const totalReleases = catalog.releaseCount || releases.length
    const questionDeck = useMemo(() => {
        const source = catalog.sceneQuestions.length > 0
            ? catalog.sceneQuestions
            : buildFallbackSceneQuestions(artists, releases)
        return shuffle(source).slice(0, 48)
    }, [artists, catalog.sceneQuestions, releases])

    const [started, setStarted] = useState(false)
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)
    const [didYouKnow, setDidYouKnow] = useState<string | null>(null)

    const current: ArcadeSceneQuestion | undefined = questionDeck[index]
    const gameOver = started && (timeLeft <= 0 || !current)

    useEffect(() => {
        if (!started || gameOver) return
        const timer = window.setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000)
        return () => window.clearInterval(timer)
    }, [gameOver, started])

    useEffect(() => {
        if (!started || gameOver || selected || !current) return
        setRoundTimeLeft(ROUND_TIME)
        const timer = window.setInterval(() => {
            setRoundTimeLeft(prev => {
                if (prev <= 1) {
                    window.clearInterval(timer)
                    setSelected('__timeout__')
                    setCombo(0)
                    setStatus(`Time up. Correct answer: ${current.answer}`)
                    setDidYouKnow(current.explanation)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [current, gameOver, selected, started])

    useEffect(() => {
        if (!selected || gameOver) return
        const timeout = window.setTimeout(() => {
            setIndex(prev => prev + 1)
            setSelected(null)
            setStatus(null)
            setDidYouKnow(null)
            setRoundTimeLeft(ROUND_TIME)
        }, 1800)
        return () => window.clearTimeout(timeout)
    }, [gameOver, selected])

    const start = () => {
        setStarted(true)
        setIndex(0)
        setScore(0)
        setCombo(0)
        setTimeLeft(SESSION_TIME)
        setRoundTimeLeft(ROUND_TIME)
        setSelected(null)
        setStatus(null)
        setDidYouKnow(null)
    }

    const choose = (option: string) => {
        if (!current || selected || gameOver || !started) return
        setSelected(option)
        if (option === current.answer) {
            const points = Math.round(100 + roundTimeLeft * 10 + combo * 18)
            setScore(prev => prev + points)
            setCombo(prev => prev + 1)
            setStatus(`Correct. +${points}`)
        } else {
            setCombo(0)
            setStatus(`Correct answer: ${current.answer}`)
        }
        setDidYouKnow(current.explanation)
    }

    return (
        <PlayGameFrame
            title="Scene Decoder"
            subtitle="DHH cultural trivia built from city roots, facts, release years, albums, collaborators, and scene waves."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 10 ? 'danger' : 'default' },
                { label: 'Round', value: `${roundTimeLeft}s`, tone: roundTimeLeft <= 3 ? 'danger' : 'default' },
                { label: 'Streak', value: `${combo}x` },
                { label: 'XP', value: Math.round(score * 0.38).toLocaleString() },
            ]}
            hero={current ? (
                <div className="arcade-game-hero arcade-game-hero--compact">
                    <div className="arcade-game-hero__copy">
                        <div className="arcade-game-chip-row">
                            <span className="arcade-game-chip">{current.category}</span>
                            <span className="arcade-game-chip">Did-you-know trivia mode</span>
                        </div>
                        <h3>{current.prompt}</h3>
                        <p>Answer first, then get a context note pulled from the verified catalog.</p>
                    </div>
                </div>
            ) : undefined}
            leaderboard={
                <div className="game-placeholder card leaderboard-card">
                    <div className="leaderboard-card__header">
                        <h3>Decoder Pool</h3>
                    </div>
                    <div className="arcade-board arcade-board--notes">
                        <div className="arcade-board-row"><strong>Question deck</strong><span>{catalog.sceneQuestions.length}</span></div>
                        <div className="arcade-board-row"><strong>Artists loaded</strong><span>{totalArtists.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Releases loaded</strong><span>{totalReleases.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Categories</strong><span>6</span></div>
                    </div>
                </div>
            }
        >
            {loading && questionDeck.length === 0 ? (
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : questionDeck.length === 0 ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>Loading catalog...</h4>
                    <p>The arcade data is being fetched. Hang tight - this usually takes a few seconds.</p>
                </div>
            ) : !started || gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{gameOver ? 'Scene Decoder complete' : 'Ready for Scene Decoder'}</h4>
                    <p>{gameOver ? `Final score: ${score.toLocaleString()}` : 'A fast DHH culture quiz designed for repeat runs.'}</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={start}>{gameOver ? 'Play again' : 'Start decoder'}</button>
                    </div>
                </div>
            ) : current ? (
                <>
                    <div className="arcade-option-grid">
                        {current.options.map(option => (
                            <button
                                key={`${current.id}-${option}`}
                                type="button"
                                className={`arcade-option-card ${selected === option ? 'active' : ''}`}
                                onClick={() => choose(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {status && <p className="game-description">{status}</p>}
                    {didYouKnow && <div className="arcade-did-you-know"><strong>Did you know?</strong><p>{didYouKnow}</p></div>}
                </>
            ) : null}
        </PlayGameFrame>
    )
}

export default memo(SceneDecoderGameComponent)

