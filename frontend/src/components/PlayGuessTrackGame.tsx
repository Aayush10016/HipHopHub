import { memo } from 'react'
import GameComponent from './GameComponent'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import './GameComponent.css'

type Variant = 'guess' | 'rapid'

function PlayGuessTrackGameComponent({ variant, onBack }: { variant: Variant; onBack: () => void }) {
    const { loading, artistCount, songCount, catalog } = useArcadeCatalog()
    const availableTracks = catalog.playableTracks.length
    const availableArtists = catalog.playableArtists.length
    const displayArtistCount = catalog.artistCount || artistCount || availableArtists || 0
    const displaySongCount = catalog.songCount || songCount || availableTracks || 0


    if (loading && artistCount === 0 && songCount === 0 && availableArtists === 0 && availableTracks === 0) {
        return <div className="arcade-game-page"><button type="button" className="play-game-frame__back" onClick={onBack}>Back to Arcade</button><div className="loading-profile" role="status"><span className="section-kicker">PREPARING THE DECK</span><div className="loading-bars"><i/><i/><i/><i/><i/></div><p>Finding your next mystery track…</p></div></div>
    }

    return (
        <section className="arcade-game-page">
            <div className="arcade-game-page__toolbar">
                <button type="button" className="play-game-frame__back" onClick={onBack}>
                    Back to Arcade
                </button>
                <div className="play-game-frame__title-block">
                    <span className="play-game-frame__kicker">Play Section</span>
                    <h2>{variant === 'rapid' ? 'Rapid Fire' : 'Guess The Track'}</h2>
                    <p>
                        {variant === 'rapid'
                            ? `${displaySongCount.toLocaleString()} catalog tracks ready for rapid rounds.`
                            : `${displaySongCount.toLocaleString()} catalog tracks loaded across ${displayArtistCount.toLocaleString()} artists.`}
                    </p>
                </div>
            </div>

            <GameComponent mode="global" variant={variant} />
        </section>
    )
}

export default memo(PlayGuessTrackGameComponent)
