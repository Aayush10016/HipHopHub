import { useMemo } from 'react'
import { useGameCatalog } from './useGameCatalog'
import { buildArcadeCatalog } from '../lib/gameCatalog'
import type { GameCatalogResponse } from '../lib/gameCatalog'

type PreparedCatalog = ReturnType<typeof buildArcadeCatalog>
const prepared = new WeakMap<GameCatalogResponse['songs'], { input: GameCatalogResponse; catalog: PreparedCatalog }>()

export function useArcadeCatalog() {
    const raw = useGameCatalog()
    const catalog = useMemo(() => {
        const input: GameCatalogResponse = {
            artists: raw.artists, songs: raw.songs, releases: raw.releases,
            artistCount: raw.artistCount, songCount: raw.songCount,
            releaseCount: raw.releaseCount, catalogReady: raw.catalogReady,
        }
        const cached = prepared.get(input.songs)
        if (cached && cached.input.artists === input.artists && cached.input.releases === input.releases
            && cached.input.artistCount === input.artistCount && cached.input.songCount === input.songCount
            && cached.input.releaseCount === input.releaseCount && cached.input.catalogReady === input.catalogReady) return cached.catalog
        const result = buildArcadeCatalog(input)
        prepared.set(input.songs, { input, catalog: result })
        return result
    }, [raw.artistCount, raw.artists, raw.catalogReady, raw.releaseCount, raw.releases, raw.songCount, raw.songs])
    return { ...raw, catalog }
}
