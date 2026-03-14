import { useEffect, useMemo, useState } from 'react'
import './AINewsFeed.css'

type Category = 'All' | 'Beef' | 'Releases' | 'Statements' | 'Tours' | 'Spotlight'

interface NewsStory {
    id: string
    title: string
    summary: string
    tag: string
    category: Category
    time: string
    source?: string
}

export default function AINewsFeed() {
    const [stories, setStories] = useState<NewsStory[]>([])
    const [activeCategory, setActiveCategory] = useState<Category>('All')
    const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        refreshFeed()
        const interval = setInterval(refreshFeed, 120000)
        return () => clearInterval(interval)
    }, [])

    const refreshFeed = async () => {
        setLoading(true)
        setError(null)
        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 15000)
            const res = await fetch('/api/ai-news', { signal: controller.signal })
            clearTimeout(timeout)

            if (!res.ok) throw new Error('Failed to load live news')
            const data = await res.json()
            const incoming = data?.stories as NewsStory[] | undefined
            setStories(incoming?.length ? incoming : [])
            setLastUpdated(data?.updatedAt || new Date().toISOString())
        } catch (err) {
            console.error('Live news fetch failed:', err)
            setStories([])
            setError('No DHH news right now or news sources are temporarily unreachable')
            setLastUpdated(new Date().toISOString())
        } finally {
            setLoading(false)
        }
    }

    const filteredStories = useMemo(() => {
        if (activeCategory === 'All') return stories
        return stories.filter(story => story.category === activeCategory)
    }, [activeCategory, stories])

    return (
        <div className="news-section fade-in">
            <div className="section-header">
                <div>
                    <h2 className="section-title">DHH News Feed</h2>
                    <p className="section-sub">Live Indian hip-hop updates for beef alerts, drops, tours, and statements.</p>
                </div>
                <div className="news-actions">
                    <button className="btn btn-secondary btn-small" onClick={refreshFeed} disabled={loading}>
                        {loading ? 'Syncing...' : 'Refresh Feed'}
                    </button>
                    <div className="news-status">
                        <span className="status-dot" />
                        <span className="status-text">{loading ? 'Syncing...' : 'Auto-refreshes every 2 min'}</span>
                    </div>
                </div>
            </div>

            <div className="news-filters">
                {(['All', 'Spotlight', 'Releases', 'Statements', 'Beef', 'Tours'] as Category[]).map(cat => (
                    <button
                        key={cat}
                        className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="news-grid">
                {filteredStories.length === 0 && !loading && (
                    <div className="news-empty card">
                        <h3>No DHH news right now</h3>
                        <p>We will auto-refresh shortly. Try Refresh Feed again or check back soon.</p>
                    </div>
                )}
                {filteredStories.map(item => (
                    <div key={item.id} className="news-card card">
                        <div className="news-meta">
                            <span className="tag">{item.tag}</span>
                            <span className="time">{item.time}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.summary}</p>
                        <div className="news-footer">
                            <span>{item.source || 'Live feed'}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="news-footer-row">
                <div className="last-updated">Last updated: {new Date(lastUpdated).toLocaleTimeString()}</div>
                {error && <div className="news-error">{error}</div>}
            </div>
        </div>
    )
}
