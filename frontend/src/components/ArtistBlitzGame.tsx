import { memo, useEffect, useMemo, useState } from 'react'
import PlayGameFrame from './PlayGameFrame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import type { ArcadeArtistQuestion, GameCatalogArtist, GameCatalogRelease, GameCatalogSong } from '../lib/gameCatalog'

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

const buildFallbackBlitzQuestions = (artists: GameCatalogArtist[], songs: GameCatalogSong[], releases: GameCatalogRelease[]) => {
    const artistNames = artists.map(artist => artist.name)
    const cities = unique(artists.map(artist => artist.city || ''))
    const labels = unique(artists.flatMap(artist => artist.labels || []))
    const years = unique(releases.map(release => (release.releaseDate || '').slice(0, 4)).filter(Boolean))

    const questions: ArcadeArtistQuestion[] = []

    artists.forEach(artist => {
        if (artist.city) {
            questions.push({
                id: `fallback-city-${artist.id}`,
                category: 'city',
                prompt: `Which artist belongs to the ${artist.city} scene?`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNames),
                accent: artist.city,
            })
        }

        if ((artist.labels || []).length > 0) {
            const label = artist.labels?.[0]
            if (label) {
                questions.push({
                    id: `fallback-label-${artist.id}`,
                    category: 'fact',
                    prompt: `Which artist is linked with ${label}?`,
                    answer: artist.name,
                    options: buildOptions(artist.name, artistNames),
                    accent: label,
                })
            }
        }

        if (artist.facts.length > 0) {
            questions.push({
                id: `fallback-fact-${artist.id}`,
                category: 'fact',
                prompt: `Who matches this clue? ${artist.facts[0]}`,
                answer: artist.name,
                options: buildOptions(artist.name, artistNames),
            })
        }
    })

    releases.slice(0, 180).forEach(release => {
        const year = (release.releaseDate || '').slice(0, 4)
        if (year) {
            questions.push({
                id: `fallback-year-${release.id}`,
                category: 'year',
                prompt: `Pick the release year for "${release.title}".`,
                answer: year,
                options: buildOptions(year, years),
                mediaUrl: release.coverUrl,
                mediaAlt: release.title,
            })
        }

        questions.push({
            id: `fallback-release-${release.id}`,
            category: 'album',
            prompt: `Who owns the release "${release.title}"?`,
            answer: release.artistName,
            options: buildOptions(release.artistName, artistNames),
            mediaUrl: release.coverUrl,
            mediaAlt: release.title,
        })
    })

    songs.slice(0, 220).forEach(song => {
        questions.push({
            id: `fallback-track-${song.id}`,
            category: 'artist',
            prompt: `Who recorded "${song.title}"?`,
            answer: song.artistName,
            options: buildOptions(song.artistName, artistNames),
            mediaUrl: song.coverUrl,
            mediaAlt: song.title,
        })

        if (song.albumTitle) {
            questions.push({
                id: `fallback-collab-${song.id}`,
                category: 'collaborator',
                prompt: `"${song.title}" belongs to which release?`,
                answer: song.albumTitle,
                options: buildOptions(song.albumTitle, releases.map(release => release.title)),
                mediaUrl: song.coverUrl,
                mediaAlt: song.title,
            })
        }
    })

    return questions
}

function ArtistBlitzGameComponent({ onBack }: { onBack: () => void }) {
    const { loading, artists, songs, releases, catalog } = useArcadeCatalog()
    const totalArtists = catalog.artistCount || artists.length
    const totalSongs = catalog.songCount || songs.length
    const questionPool = useMemo(() => {
        const source = catalog.blitzQuestions.length > 0
            ? catalog.blitzQuestions
            : buildFallbackBlitzQuestions(artists, songs, releases)
        return shuffle(source).slice(0, 60)
    }, [artists, catalog.blitzQuestions, releases, songs])

    const [started, setStarted] = useState(false)
    const [index, setIndex] = useState(0)
    const [score, setScore] = useState(0)
    const [combo, setCombo] = useState(0)
    const [bestCombo, setBestCombo] = useState(0)
    const [timeLeft, setTimeLeft] = useState(SESSION_TIME)
    const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_TIME)
    const [selected, setSelected] = useState<string | null>(null)
    const [status, setStatus] = useState<string | null>(null)

    const current: ArcadeArtistQuestion | undefined = questionPool[index]
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
                    setStatus(`Time up. Correct answer: ${current.answer}`)
                    setCombo(0)
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
            setRoundTimeLeft(ROUND_TIME)
        }, 900)
        return () => window.clearTimeout(timeout)
    }, [gameOver, selected])

    const start = () => {
        setStarted(true)
        setIndex(0)
        setScore(0)
        setCombo(0)
        setBestCombo(0)
        setTimeLeft(SESSION_TIME)
        setRoundTimeLeft(ROUND_TIME)
        setSelected(null)
        setStatus(null)
    }

    const choose = (option: string) => {
        if (!current || selected || gameOver || !started) return
        setSelected(option)
        if (option === current.answer) {
            const points = Math.round(110 + roundTimeLeft * 8 + combo * 22)
            setScore(prev => prev + points)
            setCombo(prev => {
                const next = prev + 1
                setBestCombo(currentBest => Math.max(currentBest, next))
                return next
            })
            setStatus(`Correct. +${points}`)
        } else {
            setCombo(0)
            setStatus(`Correct answer: ${current.answer}`)
        }
    }

    return (
        <PlayGameFrame
            title="Artist Blitz"
            subtitle="Fast sixty-second recognition mode across artists, artwork, years, facts, albums, and collaborators."
            onBack={onBack}
            stats={[
                { label: 'Score', value: score.toLocaleString(), tone: 'accent' },
                { label: 'Timer', value: `${timeLeft}s`, tone: timeLeft <= 10 ? 'danger' : 'default' },
                { label: 'Round', value: `${roundTimeLeft}s`, tone: roundTimeLeft <= 3 ? 'danger' : 'default' },
                { label: 'Streak', value: `${combo}x` },
                { label: 'XP', value: Math.round(score * 0.4).toLocaleString() },
            ]}
            hero={current ? (
                <div className="arcade-game-hero arcade-game-hero--compact">
                    {current.mediaUrl ? (
                        <div className="arcade-game-hero__cover-shell arcade-game-hero__cover-shell--small">
                            <img src={current.mediaUrl} alt={current.mediaAlt || current.prompt} className="arcade-game-cover" />
                        </div>
                    ) : null}
                    <div className="arcade-game-hero__copy">
                        <div className="arcade-game-chip-row">
                            <span className="arcade-game-chip">{current.category}</span>
                            <span className="arcade-game-chip">{totalArtists.toLocaleString()} artists loaded</span>
                        </div>
                        <h3>{current.prompt}</h3>
                        <p>Every round is generated from the shared HipHopHub arcade catalog.</p>
                    </div>
                </div>
            ) : undefined}
            leaderboard={
                <div className="game-placeholder card leaderboard-card">
                    <div className="leaderboard-card__header">
                        <h3>Blitz Rules</h3>
                    </div>
                    <div className="arcade-board arcade-board--notes">
                        <div className="arcade-board-row"><strong>Prompt pool</strong><span>{catalog.blitzQuestions.length}</span></div>
                        <div className="arcade-board-row"><strong>Artists loaded</strong><span>{totalArtists.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Tracks loaded</strong><span>{totalSongs.toLocaleString()}</span></div>
                        <div className="arcade-board-row"><strong>Best combo</strong><span>{bestCombo}x</span></div>
                    </div>
                </div>
            }
        >
            {loading && questionPool.length === 0 ? (
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : !started || gameOver ? (
                <div className="arcade-result-card arcade-result-card--summary">
                    <h4>{gameOver ? 'Artist Blitz complete' : 'Ready for Artist Blitz'}</h4>
                    <p>{gameOver ? `Final score: ${score.toLocaleString()}` : 'A 60-second run built for rapid replay.'}</p>
                    <div className="arcade-action-row">
                        <button type="button" className="btn-next" onClick={start}>{gameOver ? 'Play again' : 'Start blitz'}</button>
                    </div>
                </div>
            ) : current ? (
                <>
                    <div className="blitz-options arcade-option-grid">
                        {current.options.map(option => (
                            <button
                                key={`${current.id}-${option}`}
                                type="button"
                                className={`blitz-option arcade-option-card ${selected === option ? 'active' : ''}`}
                                onClick={() => choose(option)}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {status && <p className="game-description">{status}</p>}
                </>
            ) : null}
        </PlayGameFrame>
    )
}

export default memo(ArtistBlitzGameComponent)

