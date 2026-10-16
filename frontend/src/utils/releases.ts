import credits from '../releaseCredits.json'
const normalizedTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/single$/, '')
export interface Release { id: number; title: string; releaseDate?: string; albumType?: string; type?: string; artist?: { name: string }; sourceUrl?: string }
/** Merge contributor catalog records without treating features as the lead artist. */
export function uniqueReleases<T extends Release>(releases: T[]): T[] {
    const groups = new Map<string, T>()
    for (const raw of releases) {
        const key = normalizedTitle(raw.title)
        const item = { ...raw }
        const credit = (credits as Record<string, { artist: string; releaseDate: string; url: string }>)[key]
        if (credit && credit.releaseDate === item.releaseDate) { item.artist = { name: credit.artist }; item.sourceUrl = credit.url }
        if (key === 'distortion') { item.artist = { name: 'Hurricane & DL91 Era' }; item.releaseDate = '2026-10-09'; item.sourceUrl = 'https://music.apple.com/us/album/distortion/6818165582' }
        if (key === 'maddawg101') { item.artist = { name: 'Karma' }; item.sourceUrl = 'https://music.apple.com/us/album/mad-dawg-101/6819835426' }
        const groupKey = item.sourceUrl || `${key}|${item.releaseDate || ''}`
        const prior = groups.get(groupKey)
        if (!prior || ((prior.albumType || prior.type) === 'APPEARS_ON' && (item.albumType || item.type) !== 'APPEARS_ON')) groups.set(groupKey, item)
    }
    return [...groups.values()]
}
