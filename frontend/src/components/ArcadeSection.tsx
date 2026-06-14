import { memo, useMemo, useState } from 'react'
import CompleteLyricGame from './CompleteLyricGame'
import ArtistBlitzGame from './ArtistBlitzGame'
import DhhConnectionsGame from './DhhConnectionsGame'
import DhhTimelineGame from './DhhTimelineGame'
import PlayGuessTrackGame from './PlayGuessTrackGame'
import SceneDecoderGame from './SceneDecoderGame'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import { buildCatalogSummary } from '../utils/gameCatalog'
import './ArcadeSection.css'

type GameMode = 'guess' | 'rapid' | 'lyric' | 'blitz' | 'decoder' | 'timeline' | 'connections'

const MODE_COPY: Record<GameMode, { kicker: string; title: string; description: string; intensity: string }> = {
    guess: {
        kicker: 'Flagship',
        title: 'Guess The Track',
        description: 'Recognize DHH songs from preview snippets, push your streak, and chase leaderboard points.',
        intensity: '30s preview · sticky leaderboard',
    },
    rapid: {
        kicker: 'Pressure',
        title: 'Rapid Fire',
        description: 'Ten-second rounds, auto-advance pacing, and combo scoring built for fast replay loops.',
        intensity: '10s rounds · survival mode',
    },
    lyric: {
        kicker: 'Lyric bank',
        title: 'Guess The Lyric',
        description: 'Complete missing words without metadata leaks, then reveal the song only after you answer.',
        intensity: '8-round session · combo XP',
    },
    blitz: {
        kicker: 'Sprint',
        title: 'Artist Blitz',
        description: 'Run through cover, city, collaborator, year, and album prompts in a one-minute burst.',
        intensity: '60s sprint · mixed prompts',
    },
    decoder: {
        kicker: 'Culture quiz',
        title: 'Scene Decoder',
        description: 'Decode cities, collectives, release years, and facts with explanation cards after every answer.',
        intensity: 'Trivia + explainers',
    },
    timeline: {
        kicker: 'Chronology',
        title: 'DHH Timeline',
        description: 'Drag official releases into order and clean the board before you run out of lives.',
        intensity: 'Drag-and-drop rounds',
    },
    connections: {
        kicker: 'New flagship',
        title: 'DHH Connections',
        description: 'Group artists by cities, labels, collectives, and eras in a replayable deduction board.',
        intensity: 'NYT-style grouping',
    },
}

function ArcadeSectionComponent() {
    const [selectedGame, setSelectedGame] = useState<GameMode>('guess')
    const [gameView, setGameView] = useState<'hub' | 'active'>('hub')
    const { loading, error, catalog } = useArcadeCatalog()
    const summary = useMemo(() => buildCatalogSummary(catalog), [catalog])

    const stats = [
        { label: 'Artists', value: summary.artistText },
        { label: 'Tracks', value: summary.songText },
        { label: 'Releases', value: summary.releaseText },
        { label: 'Lyrics', value: summary.lyricText },
    ]

    if (gameView === 'active') {
        if (selectedGame === 'lyric') {
            return <CompleteLyricGame onBack={() => setGameView('hub')} />
        }
        if (selectedGame === 'blitz') {
            return <ArtistBlitzGame onBack={() => setGameView('hub')} />
        }
        if (selectedGame === 'decoder') {
            return <SceneDecoderGame onBack={() => setGameView('hub')} />
        }
        if (selectedGame === 'timeline') {
            return <DhhTimelineGame onBack={() => setGameView('hub')} />
        }
        if (selectedGame === 'connections') {
            return <DhhConnectionsGame onBack={() => setGameView('hub')} />
        }
        return <PlayGuessTrackGame variant={selectedGame === 'rapid' ? 'rapid' : 'guess'} onBack={() => setGameView('hub')} />
    }

    return (
        <div className="arcade-section fade-in section-shell">
            <div className="arcade-section__hero card">
                <div className="arcade-section__hero-copy">
                    <span className="section-kicker">Arcade</span>
                    <h2 className="section-title">Play</h2>
                    <p className="game-description arcade-section__description">
                        {loading
                            ? 'Preparing the verified DHH arcade deck...'
                            : error
                                ? 'Arcade data is loading again. Open any mode to keep exploring.'
                                : `The flagship HipHopHub experience now runs on ${summary.artistText} artists, ${summary.songText} playable tracks, and ${summary.releaseText} official releases.`}
                    </p>
                </div>
                <div className="arcade-section__stats" aria-label="Arcade catalog stats">
                    {stats.map(stat => (
                        <div key={stat.label} className="arcade-section__stat">
                            <span>{stat.label}</span>
                            <strong>{stat.value}</strong>
                        </div>
                    ))}
                </div>
            </div>

            <div className="arcade-grid">
                {(Object.keys(MODE_COPY) as GameMode[]).map(mode => {
                    const copy = MODE_COPY[mode]
                    return (
                        <button
                            key={mode}
                            type="button"
                            className={`arcade-card card ${selectedGame === mode ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedGame(mode)
                                setGameView('active')
                            }}
                        >
                            <div className="arcade-card__topline">
                                <span className="game-mode-kicker">{copy.kicker}</span>
                                <span className="arcade-card__intensity">{copy.intensity}</span>
                            </div>
                            <h3>{copy.title}</h3>
                            <p>{copy.description}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

const ArcadeSection = memo(ArcadeSectionComponent)
export default ArcadeSection
