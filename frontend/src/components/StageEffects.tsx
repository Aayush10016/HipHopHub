import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import SceneSmoke from './SceneSmoke'

const readMotionPreference = () => {
    try {
        const preference = localStorage.getItem('hiphophub:motion')
        if (preference) return preference === 'on'
    } catch { /* A private session can still use the local control. */ }
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function StageEffects() {
    const { pathname } = useLocation()
    const [motion, setMotion] = useState(readMotionPreference)
    useEffect(() => {
        document.documentElement.dataset.motion = motion ? 'on' : 'off'
        try { localStorage.setItem('hiphophub:motion', motion ? 'on' : 'off') } catch { /* Optional preference storage. */ }
    }, [motion])
    useEffect(() => {
        if (!motion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const cards = new Set<HTMLElement>()
        const reveal = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue
                ;(entry.target as HTMLElement).dataset.reveal = 'visible'
                reveal.unobserve(entry.target)
            }
        }, { threshold: 0.08 })
        const discover = () => {
            document.querySelectorAll<HTMLElement>('.artist-card, .album-card, .news-card, .song-card, .overview-story-card, .album-item').forEach(card => {
                if (cards.has(card)) return
                cards.add(card)
                card.dataset.reveal = 'waiting'
                reveal.observe(card)
            })
        }
        discover()
        const updates = new MutationObserver(discover)
        updates.observe(document.getElementById('root')!, { childList: true, subtree: true })
        return () => {
            updates.disconnect()
            reveal.disconnect()
            cards.forEach(card => delete card.dataset.reveal)
        }
    }, [motion, pathname])
    return <>
        <div className="site-atmosphere" aria-hidden="true"><div className="stage-light" /><div className="stage-beams" /><SceneSmoke /><div className="stage-grain" /></div>
        <div key={pathname} className="route-light-sweep" aria-hidden="true" />
        <details className={`site-utility ${pathname === '/' ? 'site-utility--landing' : ''}`}>
            <summary aria-label="Stage effects and site information"><i className="effects-status" aria-hidden="true" /> HH / EFFECTS <span aria-hidden="true">+</span></summary>
            <div className="site-utility-panel">
                <span className="utility-label">BEHIND THE SCENE</span>
                <p className="effects-description">Smoke, moving spotlights and animated entrances. Switch off for a still stage.</p>
                <button type="button" aria-pressed={motion} onClick={() => setMotion(value => !value)}><span>Stage effects</span><strong>{motion ? 'On' : 'Off'}</strong></button>
                <a href="/image-credits.html" target="_blank" rel="noopener noreferrer">Photography & credits <span aria-hidden="true">↗</span></a>
            </div>
        </details>
    </>
}
