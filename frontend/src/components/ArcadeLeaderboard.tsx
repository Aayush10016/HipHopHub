import { useEffect, useState } from 'react'

interface Entry {
    userId: number
    username: string
    bestPoints: number
}

export default function ArcadeLeaderboard({ mode, title }: { mode: 'RAPID_FIRE' | 'COMPLETE_THE_LYRIC'; title: string }) {
    const [entries, setEntries] = useState<Entry[]>([])

    useEffect(() => {
        let cancelled = false
        fetch(`/api/arcade/leaderboard?mode=${mode}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (!cancelled) {
                    setEntries(Array.isArray(data) ? data : [])
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setEntries([])
                }
            })
        return () => {
            cancelled = true
        }
    }, [mode])

    return (
        <div className="game-placeholder card">
            <h3>{title}</h3>
            {entries.length > 0 ? (
                <div className="arcade-board">
                    {entries.map((entry, index) => (
                        <div key={`${mode}-${entry.userId}`} className="arcade-board-row">
                            <span>#{index + 1}</span>
                            <strong>{entry.username}</strong>
                            <span>{entry.bestPoints}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p>No scores yet. Log in and set the first run.</p>
            )}
        </div>
    )
}
