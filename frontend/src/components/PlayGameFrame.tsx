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
    leaderboardPlacement?: 'below' | 'side'
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
    leaderboardPlacement = 'below',
}: PlayGameFrameProps) {
    return (
        <section className="play-game-frame">
            <div className="play-game-frame__toolbar">
                <button type="button" className="play-game-frame__back" onClick={onBack}>
                    Back to Arcade
                </button>

                <div className="play-game-frame__title-block">
                    <span className="play-game-frame__kicker">Play Section</span>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
            </div>

            <div className={`play-game-frame__surface game-component play-game-frame__body--${leaderboardPlacement}`}>
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

                {footer && <div className="play-game-frame__footer">{footer}</div>}
                {hero && <div className="play-game-frame__hero">{hero}</div>}
                <div className="play-game-frame__game-area">{children}</div>
            </div>

            {leaderboard && (
                <div className="play-game-frame__leaderboard-below">
                    {leaderboard}
                </div>
            )}
        </section>
    )
}
