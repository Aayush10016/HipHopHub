import { useEffect, useState } from 'react'

interface Entry {
    userId: number
    username: string
    totalPoints: number
}

type Scope = 'global' | 'weekly' | 'friends'

export default function GuessTrackLeaderboard() {
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
        const query = new URLSearchParams({ scope })
        if (scope === 'friends' && userId) {
            query.set('userId', String(userId))
        }

        fetch(`/api/game/leaderboard?${query.toString()}`)
            .then(res => (res.ok ? res.json() : []))
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
    }, [scope, userId])

    return (
        <div className="game-placeholder card leaderboard-card">
            <div className="leaderboard-card__header">
                <h3>Guess The Track</h3>
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
                    {entries.slice(0, 10).map((entry, index) => (
                        <div key={`guess-${entry.userId}`} className="arcade-board-row">
                            <span>#{index + 1}</span>
                            <strong>{entry.username}</strong>
                            <span>{entry.totalPoints}</span>
                        </div>
                    ))}
                </div>
            ) : scope === 'friends' ? (
                <p>{userId ? 'Play a run to populate your circle view.' : 'Log in to compare your own run history here.'}</p>
            ) : (
                <p>No scores yet. Start the first streak.</p>
            )}
        </div>
    )
}
