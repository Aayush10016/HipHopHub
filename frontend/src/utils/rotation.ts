const safeParse = (value: string | null): string[] => {
    if (!value) return []
    try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
    } catch {
        return []
    }
}

export const hashString = (value: string) => {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0
    }
    return hash
}

export const seededShuffle = <T,>(items: T[], seed: number) => {
    const copy = [...items]
    let currentSeed = seed || 1

    const next = () => {
        currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296
        return currentSeed / 4294967296
    }

    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }

    return copy
}

export const readRecentValues = (key: string) => {
    if (typeof window === 'undefined') return []
    return safeParse(window.localStorage.getItem(key))
}

export const writeRecentValue = (key: string, value: string, maxItems = 6) => {
    if (typeof window === 'undefined' || !value) return
    const nextValues = [value, ...readRecentValues(key).filter(item => item !== value)].slice(0, maxItems)
    window.localStorage.setItem(key, JSON.stringify(nextValues))
}

export const pickLeastRecent = <T,>(
    items: T[],
    keyFn: (item: T) => string | undefined,
    recent: string[],
    seed: number
) => {
    if (!items.length) return null

    const shuffled = seededShuffle(items, seed)
    const nonRecent = shuffled.filter(item => {
        const key = keyFn(item)
        return key ? !recent.includes(key) : true
    })

    return nonRecent[0] || shuffled[0] || null
}

export const pickDistinctItems = <T,>(
    items: T[],
    keyFn: (item: T) => string | undefined,
    count: number,
    seed: number
) => {
    const shuffled = seededShuffle(items, seed)
    const seen = new Set<string>()
    const picked: T[] = []

    for (const item of shuffled) {
        const key = keyFn(item)
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        picked.push(item)
        if (picked.length >= count) break
    }

    return picked
}
