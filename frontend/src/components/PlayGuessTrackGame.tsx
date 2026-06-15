import { memo, useEffect } from 'react'
import GameComponent from './GameComponent'
import { useArcadeCatalog } from '../hooks/useArcadeCatalog'
import './GameComponent.css'

type Variant = 'guess' | 'rapid'

function PlayGuessTrackGameComponent({ variant, onBack }: { variant: Variant; onBack: () => void }) {
    const { loading, error, artistCount, songCount, catalog } = useArcadeCatalog()
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

    if (loading && songCount === 0) {
        return (
            <section className="arcade-game-page">
                <div className="arcade-game-page__toolbar">
                    <button type="button" className="play-game-frame__back" onClick={onBack}>
                        Back to Arcade
                    </button>
                    <div className="play-game-frame__title-block">
                        <span className="play-game-frame__kicker">Play Section</span>
                        <h2>{variant === 'rapid' ? 'Rapid Fire' : 'Guess The Track'}</h2>
                        <p>Preparing the live DHH game engine...</p>
                    </div>
                </div>
            </section>
        )
    }

    if (!loading && songCount === 0) {
        return (
            <section className="arcade-game-page">
                <div className="arcade-game-page__toolbar">
                    <button type="button" className="play-game-frame__back" onClick={onBack}>
                        Back to Arcade
                    </button>
                    <div className="play-game-frame__title-block">
                        <span className="play-game-frame__kicker">Play Section</span>
                        <h2>{variant === 'rapid' ? 'Rapid Fire' : 'Guess The Track'}</h2>
                        <p>{error || 'The game catalog is unavailable right now. Check the frontend catalog logs.'}</p>
                    </div>
                </div>
            </section>
        )
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
                            ? 'Ten-second rounds using the same verified song engine as the artist challenge.'
                            : 'The main game now runs on the same preview, submit, and round engine used on artist pages.'}
                    </p>
                </div>
            </div>

            <GameComponent mode="global" variant={variant} />
        </section>
    )
}

export default memo(PlayGuessTrackGameComponent)
