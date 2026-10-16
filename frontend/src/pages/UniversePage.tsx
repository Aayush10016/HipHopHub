import { buildArtistUniverse } from '../utils/artistUniverse'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import './ArtistUniversePage.css'

interface Artist { id: number; name: string; imageUrl?: string; bio?: string; genre?: string; monthlyListeners?: number }

export default function UniversePage({ seedheMaut = false }: { seedheMaut?: boolean }) {
    const { id } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const initial = (location.state as { artist?: Artist } | null)?.artist
    const [artist, setArtist] = useState<Artist | null>(initial || null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(initial ? 'ready' : 'loading')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        let disposed = false
        setArtist(null)
        const validInitial = initial && (seedheMaut || initial.id === Number(id))
        if (validInitial) { setArtist(initial); setStatus('ready'); return }
        if (!seedheMaut && (!Number.isInteger(Number(id)) || Number(id) <= 0)) { setStatus('error'); return }
        setStatus('loading')
        const timeout = window.setTimeout(() => controller.abort(), 18000)
        fetch(seedheMaut ? '/api/artists?scope=dhh' : `/api/artists/${id}`, { signal: controller.signal })
            .then(res => { if (!res.ok) throw new Error('Artist unavailable'); return res.json() })
            .then(data => {
                const next: Artist | undefined = seedheMaut ? data.find((a: Artist) => /^seedhe maut(?: inc\.?)?$/i.test(a.name.trim())) : data
                if (!next?.id) throw new Error('Artist unavailable')
                if (!disposed) { setArtist(next); setStatus('ready') }
            })
            .catch(() => { if (!disposed) setStatus('error') })
            .finally(() => window.clearTimeout(timeout))
        return () => { disposed = true; controller.abort(); window.clearTimeout(timeout) }
    }, [id, initial, seedheMaut, attempt])

    const back = () => navigate('/home', { state: { activeTab: 'artists' } })
    return <main id="main-content" className="universe-page" style={artist ? buildArtistUniverse(artist.name, artist.genre, artist.bio).style : undefined}>
        <header className="universe-nav"><Link to="/home" className="world-brand">HIPHOPHUB<span>®</span></Link><span>IN THE ARTIST'S WORLD</span><button onClick={back}>← All artists</button></header>
        {status === 'ready' && artist && <ArtistProfile key={artist.id} artistId={artist.id} initialArtist={artist} onBack={back} />}
        {status === 'loading' && <div className="loading-profile" role="status"><span className="section-kicker">TUNING INTO THE ARTIST</span><div className="loading-bars"><i/><i/><i/><i/><i/></div><p>Bringing the records into focus…</p></div>}
        {status === 'error' && <div className="universe-error" role="alert"><span className="section-kicker">SIGNAL LOST</span><h1>This world is out of reach.</h1><p>We couldn't load this artist. Try again or explore another voice.</p><button className="btn btn-primary" onClick={() => setAttempt(n => n + 1)}>Try again ↗</button><button className="btn btn-secondary" onClick={back}>Browse artists</button></div>}
        <footer className="site-footer"><span>HIPHOPHUB®</span><p>Every artist. A world of their own. </p><button onClick={back}>Keep digging ↗</button></footer>
    </main>
}
