import { memo, useEffect } from 'react'
import GameComponent from './GameComponent'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import './GameComponent.css'

type Variant = 'guess' | 'rapid'

function PlayGuessTrackGameComponent({ variant, onBack }: { variant: Variant; onBack: () => void }) {
    const { loading, artistCount, songCount, catalog } = useArcadeCatalog()
    const availableTracks = catalog.playableTracks.length
    const availableArtists = catalog.playableArtists.length

    useEffect(() => {
        console.log('PlayGuessTrackGame catalog:', {
            loading,
            artistCount,
            songCount,
            playableArtists: availableArtists,
            playableTracks: availableTracks,
        })
    }, [artistCount, availableArtists, availableTracks, loading, songCount])

    if (!catalog) {
        return <div className="arcade-game-page">Loading...</div>
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
                            ? `${Math.max(songCount, availableTracks).toLocaleString()} verified tracks ready for rapid rounds.`
                            : `${Math.max(songCount, availableTracks).toLocaleString()} verified tracks loaded across ${Math.max(artistCount, availableArtists).toLocaleString()} artists.`}
                    </p>
                </div>
            </div>

            <GameComponent mode="global" variant={variant} />
        </section>
    )
}

export default memo(PlayGuessTrackGameComponent)
