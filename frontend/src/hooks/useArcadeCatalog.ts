import { useMemo } from 'react'
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

    return {
        ...raw,
        catalog,
    }
}
