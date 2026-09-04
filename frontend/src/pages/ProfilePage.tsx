import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './ProfilePage.css'

interface UserProfile {
    id: number
    username: string
    email: string
    joinDate: string
    topFanBadge: string
    scores: Record<string, number>
}

export default function ProfilePage() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!user) {
            navigate('/login')
            return
        }

        const fetchProfile = async () => {
            try {
                const res = await fetch(`/api/user/profile/${user.id}`)
                if (!res.ok) {
                    throw new Error('Failed to fetch profile')
                }
                const data = await res.json()
                setProfile(data)
            } catch (err) {
                console.error(err)
                setError('Could not load profile data.')
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [user, navigate])

    if (loading) {
        return <div className="loading-page">Loading Profile...</div>
    }

    if (error || !profile) {
        return <div className="loading-page">{error || 'Something went wrong.'}</div>
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return 'Unknown'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }

    return (
        <div className="profile-page">
            <header className="home-header">
                <div className="header-container">
                    <div className="brand-block" onClick={() => navigate('/home')} style={{ cursor: 'pointer', textDecoration: 'none' }}>
                        <h1 className="header-logo">HIPHOPHUB</h1>
                        <span className="brand-kicker">Desi hip-hop, organized like a real product.</span>
                    </div>
                </div>
            </header>

            <main className="profile-content container">
                <div className="profile-header card">
                    <div className="profile-avatar-large">
                        {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info">
                        <span className="profile-kicker">Registered Member</span>
                        <h1 className="profile-username">{profile.username}</h1>
                        <p className="profile-email">{profile.email}</p>
                        <p className="profile-joined">Joined: {formatDate(profile.joinDate)}</p>
                    </div>
                    <div className="profile-actions">
                        <button className="btn btn-secondary" onClick={() => { logout(); navigate('/') }}>Log Out</button>
                    </div>
                </div>

                <div className="profile-grid">
                    <div className="profile-section card">
                        <h2 className="section-title-small">Arcade High Scores</h2>
                        <div className="scores-list">
                            {Object.entries(profile.scores).map(([mode, score]) => (
                                <div key={mode} className="score-row">
                                    <span className="score-mode">{mode.replace('_', ' ')}</span>
                                    <span className="score-points">{score} pts</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="profile-section card">
                        <h2 className="section-title-small">Reputation</h2>
                        <div className="badges-list">
                            <div className="badge-card">
                                <span className="badge-icon">👑</span>
                                <div className="badge-info">
                                    <strong>Top Fan</strong>
                                    <span>{profile.topFanBadge}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
