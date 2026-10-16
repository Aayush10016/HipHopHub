import { useEffect, useState } from 'react'
import type { SceneEvent, SceneStory } from '../utils/sceneFeed'
import './AINewsFeed.css'

type Category = 'All' | 'Stories' | 'Releases' | 'Shows'
export default function AINewsFeed() {
    const [stories, setStories] = useState<SceneStory[]>([])
    const [events, setEvents] = useState<SceneEvent[]>([])
    const [category, setCategory] = useState<Category>('All')
    const [checkedAt, setCheckedAt] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const refresh = async () => {
        setLoading(true); setError(false)
        try {
            const res = await fetch('/scene-feed.json', { cache: 'no-store', signal: AbortSignal.timeout(12000) })
            if (!res.ok) throw new Error('Feed unavailable')
            const data = await res.json()
            const safe = (url: unknown) => typeof url === 'string' && /^https:\/\//.test(url)
            setStories((data.stories || []).filter((s: SceneStory) => s.id && s.title && s.source && safe(s.url) && Date.parse(s.date) <= Date.now()))
            setEvents((data.events || []).filter((e: SceneEvent) => e.title && safe(e.ticketUrl) && Date.parse(e.eventDate) >= Date.now()))
            setCheckedAt(data.checkedAt || '')
        } catch { setError(true) } finally { setLoading(false) }
    }
    useEffect(() => { void refresh() }, [])
    const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    const visible = stories.filter(s => category === 'All' || s.category === category)
    return <section className="news-section fade-in">
        <div className="section-header"><div><span className="section-kicker">THE NOTICEBOARD / CULTURE, RECORDS & REAL DATES</span><h2 className="section-title">From the scene.</h2><p className="section-sub">A small, sourced edit. Every story takes you to the original.</p></div><button className="btn btn-secondary" onClick={() => void refresh()} disabled={loading}>{loading ? 'Checking…' : 'Refresh edition ↗'}</button></div>
        <div className="feed-edition">{checkedAt ? `Sources checked ${date(checkedAt)} · Curated edition` : 'Loading the edition…'}<span>Shows reflect published listings; check ticket availability with the organiser.</span></div>
        <div className="news-filters" aria-label="Filter the feed">{(['All','Stories','Releases','Shows'] as Category[]).map(c => <button key={c} className={`filter-chip ${category === c ? 'active' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        {error && <p role="alert" className="catalog-notice">The edition could not be refreshed. {stories.length ? 'The last loaded edition is shown.' : 'Please try again.'}</p>}
        {category !== 'Shows' && <div className="news-grid">{visible.map((s, i) => <article key={s.id} className="news-card card"><div className="news-meta"><span>{s.category}</span><time dateTime={s.date}>{date(s.date)}</time></div><span className="story-index" aria-hidden="true">0{i + 1}</span><h3><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></h3><p>{s.summary}</p><a className="story-source" href={s.url} target="_blank" rel="noopener noreferrer">{s.source} <span aria-hidden="true">↗</span></a></article>)}</div>}
        {(category === 'All' || category === 'Shows') && <div className="confirmed-shows"><div className="section-heading-block"><span className="section-kicker">OUTSIDE THE HEADPHONES</span><h3>Catch them live.</h3></div>{events.map(e => <article key={e.id} className="show-row"><div className="show-date"><b>{new Date(e.eventDate).toLocaleDateString('en-IN', {day:'2-digit',timeZone:'Asia/Kolkata'})}</b><span>{new Date(e.eventDate).toLocaleDateString('en-IN', {month:'short',timeZone:'Asia/Kolkata'})}</span></div><div><h4>{e.title}</h4><p>{e.venue} · {e.city}</p><small>{new Date(e.eventDate).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'})} IST · {e.source}</small></div><a className="btn btn-primary" href={e.ticketUrl} target="_blank" rel="noopener noreferrer">Tickets ↗</a></article>)}{!loading && !events.length && <p className="empty-message">No future dates in this edition. Browse <a href="https://www.district.in/events" target="_blank" rel="noopener noreferrer">District events ↗</a> for more listings.</p>}</div>}
        {!loading && category !== 'All' && category !== 'Shows' && !visible.length && <p className="empty-message">No sourced stories in this category for this edition.</p>}
        <p className="feed-footnote">This edition is maintained from linked sources. Refresh checks for a newer edition; it does not re-verify every source automatically. <a href="https://rollingstoneindia.com/" target="_blank" rel="noopener noreferrer">More at Rolling Stone India ↗</a></p>
    </section>
}
