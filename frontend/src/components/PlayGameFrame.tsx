import type { ReactNode } from 'react'
import './PlayGameFrame.css'

interface GameStat {
    label: string
    value: ReactNode
    tone?: 'default' | 'accent' | 'danger'
}

interface PlayGameFrameProps {
    title: string
    subtitle: string
    stats: GameStat[]
    onBack: () => void
    hero?: ReactNode
    children: ReactNode
    footer?: ReactNode
    leaderboard?: ReactNode
}

export default function PlayGameFrame({
    title,
    subtitle,
    stats,
    onBack,
    hero,
    children,
    footer,
    leaderboard,
}: PlayGameFrameProps) {
    return (
        <section className="play-game-frame">
            <div className="play-game-frame__header">
                <button type="button" className="play-game-frame__back" onClick={onBack}>
                    Back to Arcade
                </button>

                <div className="play-game-frame__title-block">
                    <span className="play-game-frame__kicker">Play Section</span>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>

                <div className="play-game-frame__stats">
                    {stats.map(stat => (
                        <div
                            key={stat.label}
                            className={`play-game-frame__stat play-game-frame__stat--${stat.tone || 'default'}`}
                        >
                            <span>{stat.label}</span>
                            <strong>{stat.value}</strong>
                        </div>
                    ))}
                </div>
            </div>

            <div className="play-game-frame__body">
                <div className="play-game-frame__main">
                    {hero && <div className="play-game-frame__hero">{hero}</div>}
                    <div className="play-game-frame__game-area">{children}</div>
                    {footer && <div className="play-game-frame__footer">{footer}</div>}
                </div>

                {leaderboard && (
                    <aside className="play-game-frame__side">
                        {leaderboard}
                    </aside>
                )}
            </div>
        </section>
    )
}
