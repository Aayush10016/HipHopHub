import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ArtistProfile from '../components/ArtistProfile'
import './ArtistProfilePage.css'

interface Artist {
    id: number
    name: string
    imageUrl?: string
    bio?: string
    monthlyListeners?: number
    genre?: string
}

export default function ArtistProfilePage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const artistId = Number(id)

    const [artist, setArtist] = useState<Artist | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!artistId || Number.isNaN(artistId)) {
            setError('Invalid artist id')
            setLoading(false)
            return
        }

        let isMounted = true

        fetch(`/api/artists/${artistId}`)
            .then(res => res.ok ? res.json() : Promise.reject('not found'))
            .then(data => {
                if (!isMounted) return
                setArtist(data)
                setLoading(false)
            })
            .catch(err => {
                console.error('Failed to fetch artist profile page:', err)
                if (!isMounted) return
                setError('Artist not found')
                setLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [artistId])

    if (loading) {
        return <div className="loading">Loading artist profile...</div>
    }

    if (error || !artist || !artistId || Number.isNaN(artistId)) {
        return <div className="loading">{error || 'Artist not found'}</div>
    }

    return (
        <div className="artist-profile-page">
            <ArtistProfile
                artistId={artistId}
                initialArtist={artist}
                onBack={() => navigate('/home')}
            />
        </div>
    )
}
