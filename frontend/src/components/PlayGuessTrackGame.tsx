import { memo, useEffect } from 'react'
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

    useEffect(() => {
        console.log('catalog', catalog)
        console.log('songCount', songCount)
        console.log('artistCount', artistCount)
        console.log('artistCount', catalog.artistCount)
        console.log('songCount', catalog.songCount)
        console.log('playableTracks', catalog.playableTracks.length)
        console.log('PlayGuessTrackGame catalog:', {
            loading,
            artistCount,
            songCount,
            playableArtists: availableArtists,
            playableTracks: availableTracks,
        })
    }, [artistCount, availableArtists, availableTracks, catalog, loading, songCount])

    if (loading && artistCount === 0 && songCount === 0 && availableArtists === 0 && availableTracks === 0) {
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
                            ? `${displaySongCount.toLocaleString()} verified tracks ready for rapid rounds.`
                            : `${displaySongCount.toLocaleString()} verified tracks loaded across ${displayArtistCount.toLocaleString()} artists.`}
                    </p>
                </div>
            </div>

            <GameComponent mode="global" variant={variant} />
        </section>
    )
}

export default memo(PlayGuessTrackGameComponent)
