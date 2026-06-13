import { useEffect, useState } from 'react'

interface Entry {
    userId: number
    username: string
    totalPoints: number
}

export default function GuessTrackLeaderboard() {
    const [entries, setEntries] = useState<Entry[]>([])

    useEffect(() => {
        let cancelled = false
        fetch('/api/game/leaderboard')
            .then(res => (res.ok ? res.json() : []))
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
    }, [])

    return (
        <div className="game-placeholder card">
            <h3>Guess The Track Leaderboard</h3>
            {entries.length > 0 ? (
                <div className="arcade-board">
                    {entries.slice(0, 10).map((entry, index) => (
                        <div key={`guess-${entry.userId}`} className="arcade-board-row">
                            <span>#{index + 1}</span>
                            <strong>{entry.username}</strong>
                            <span>{entry.totalPoints}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p>No scores yet. Start the first streak.</p>
            )}
        </div>
    )
}
