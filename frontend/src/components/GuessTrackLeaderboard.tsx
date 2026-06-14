import { useEffect, useMemo, useState } from 'react'

interface Entry {
    userId: number
    username: string
    totalPoints: number
    streak?: string | null
}

type Scope = 'global' | 'weekly' | 'friends'

export default function GuessTrackLeaderboard() {
    const [scope, setScope] = useState<Scope>('global')
    const [entries, setEntries] = useState<Entry[]>([])
    const [loading, setLoading] = useState(true)

    const userId = useMemo(() => {
        try {
            const raw = localStorage.getItem('hiphophub_user')
            return raw ? JSON.parse(raw)?.id : null
        } catch {
            return null
        }
    }, [])

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
                <h3>Guess The Track Leaderboard</h3>
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
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : entries.length > 0 ? (
                <div className="arcade-board">
                    {entries.slice(0, 10).map((entry, index) => (
                        <div key={`guess-${entry.userId}`} className="arcade-board-row">
                            <span className="arcade-board-rank">#{index + 1}</span>
                            <strong className="arcade-board-name">{index === 0 ? <><span className="arcade-board-crown">? </span>{entry.username}</> : entry.username}</strong>
                            <span className="arcade-board-score">{entry.totalPoints}</span>
                            <span className="arcade-board-streak">{entry.streak || '—'}</span>
                        </div>
                    ))}
                </div>
            ) : scope === 'friends' ? (
                <p>{userId ? 'Play a run to populate your personal comparison view.' : 'Log in to compare your own run history here.'}</p>
            ) : (
                <p>No scores yet. Start the first streak.</p>
            )}
        </div>
    )
}
