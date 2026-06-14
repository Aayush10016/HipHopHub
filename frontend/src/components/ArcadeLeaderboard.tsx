import { useEffect, useMemo, useState } from 'react'

interface Entry {
    userId: number
    username: string
    bestPoints: number
    streak?: string | null
}

type Scope = 'global' | 'weekly' | 'friends'

export default function ArcadeLeaderboard({ mode, title }: { mode: 'RAPID_FIRE' | 'COMPLETE_THE_LYRIC'; title: string }) {
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
                <div className="arcade-skeleton arcade-skeleton--body" />
            ) : entries.length > 0 ? (
                <div className="arcade-board">
                    {entries.slice(0, 10).map((entry, index) => (
                        <div key={`${mode}-${entry.userId}`} className="arcade-board-row">
                            <span className="arcade-board-rank">#{index + 1}</span>
                            <strong className="arcade-board-name">{index === 0 ? <><span className="arcade-board-crown">? </span>{entry.username}</> : entry.username}</strong>
                            <span className="arcade-board-score">{entry.bestPoints}</span>
                            <span className="arcade-board-streak">{entry.streak || '—'}</span>
                        </div>
                    ))}
                </div>
            ) : scope === 'friends' ? (
                <p>{userId ? 'Finish a run to populate your personal comparison view.' : 'Log in to unlock your personal comparison view.'}</p>
            ) : (
                <p>No scores yet. Set the first run.</p>
            )}
        </div>
    )
}
