import { useEffect, useState } from 'react'

interface Entry {
    userId: number
    username: string
    bestPoints: number
}

type Scope = 'global' | 'weekly' | 'friends'

export default function ArcadeLeaderboard({ mode, title }: { mode: 'RAPID_FIRE' | 'COMPLETE_THE_LYRIC'; title: string }) {
    const [scope, setScope] = useState<Scope>('global')
    const [entries, setEntries] = useState<Entry[]>([])
    const [loading, setLoading] = useState(true)

    const userId = (() => {
        try {
            const raw = localStorage.getItem('hiphophub_user')
            return raw ? JSON.parse(raw)?.id : null
        } catch {
            return null
        }
    })()

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        const query = new URLSearchParams({ mode, scope })
        if (scope === 'friends' && userId) {
            query.set('userId', String(userId))
        }

        fetch(`/api/arcade/leaderboard?${query.toString()}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (!cancelled) {
                    setEntries(Array.isArray(data) ? data : [])
                    setLoading(false)
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setEntries([])
                    setLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [mode, scope, userId])

    return (
        <div className="game-placeholder card leaderboard-card">
            <div className="leaderboard-card__header">
                <h3>{title}</h3>
                <div className="leaderboard-card__tabs">
                    {(['global', 'weekly', 'friends'] as Scope[]).map(tab => (
                        <button
                            key={tab}
                            type="button"
                            className={`leaderboard-card__tab ${scope === tab ? 'active' : ''}`}
                            onClick={() => setScope(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
            {loading ? (
                <p>Loading leaderboard...</p>
            ) : entries.length > 0 ? (
                <div className="arcade-board">
                    {entries.map((entry, index) => (
                        <div key={`${mode}-${entry.userId}`} className="arcade-board-row">
                            <span>#{index + 1}</span>
                            <strong>{entry.username}</strong>
                            <span>{entry.bestPoints}</span>
                        </div>
                    ))}
                </div>
            ) : scope === 'friends' ? (
                <p>{userId ? 'Finish a run to surface your own comparison view.' : 'Log in to unlock your personal comparison view.'}</p>
            ) : (
                <p>No scores yet. Log in and set the first run.</p>
            )}
        </div>
    )
}
