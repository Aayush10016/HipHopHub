import { useEffect, useMemo } from 'react'
import { useGameCatalog } from './useGameCatalog'
import { buildArcadeCatalog } from '../lib/gameCatalog'

export function useArcadeCatalog() {
    const raw = useGameCatalog()

    const catalog = useMemo(() => buildArcadeCatalog({
        artists: raw.artists,
        songs: raw.songs,
        releases: raw.releases,
        artistCount: raw.artistCount,
        songCount: raw.songCount,
        releaseCount: raw.releaseCount,
        catalogReady: raw.catalogReady,
    }), [raw.artistCount, raw.artists, raw.catalogReady, raw.releaseCount, raw.releases, raw.songCount, raw.songs])

    useEffect(() => {
        if (raw.loading) return

        console.log({
            totalSongs: raw.songCount,
            totalArtists: raw.artistCount,
            playableTracks: catalog.playableTracks.length,
            playableArtists: catalog.playableArtists.length,
            playableLyrics: catalog.playableLyrics.length,
            timelineEvents: catalog.timelineEvents.length,
            sceneQuestions: catalog.sceneQuestions.length,
            blitzQuestions: catalog.blitzQuestions.length,
            connections: catalog.connectionPuzzles.length,
        })

        if (catalog.playableTracks.length === 0) console.error('Arcade deck error: Playable tracks is 0.')
        if (catalog.playableArtists.length === 0) console.error('Arcade deck error: Playable artists is 0.')
        if (catalog.playableLyrics.length === 0) console.error('Arcade deck error: Playable lyrics is 0.')
        if (catalog.timelineEvents.length === 0) console.error('Arcade deck error: Timeline events is 0.')
        if (catalog.sceneQuestions.length === 0) console.error('Arcade deck error: Scene questions is 0.')
        if (catalog.blitzQuestions.length === 0) console.error('Arcade deck error: Blitz questions is 0.')
        if (catalog.connectionPuzzles.length === 0) console.error('Arcade deck error: Connections is 0.')
    }, [catalog, raw.artistCount, raw.loading, raw.songCount])

    return {
        ...raw,
        catalog,
    }
}
