import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPages.css'

export default function SignupPage() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            })

            const data = await res.json()
            if (!res.ok) {
                setError(data?.error || 'Signup failed.')
                return
            }

            login(data)
            navigate('/home')
        } catch (err) {
            console.error('Signup failed:', err)
            setError('Signup failed. Check backend and try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div id="main-content" className="auth-page"><div className="auth-editorial"><a href="/">HIPHOPHUB®</a><span>FOR THE HEADS.<br/>FOR THE CULTURE.</span><p>Your place in the scene starts here.</p></div>
            <div className="auth-container card">
                <h1 className="auth-title">Join HipHopHub</h1>
                <p className="auth-subtitle">Create your account</p>

                <form onSubmit={handleSignup} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username" autoComplete="username" value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email" autoComplete="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password" autoComplete="new-password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="password"
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary auth-btn">
                        {loading ? 'Creating account...' : 'Sign Up'}
                    </button>
                </form>

                {error && <p role="alert" className="auth-error">{error}</p>}

                <p className="auth-footer">
                    Already have an account?{' '}
                    <button type="button" className="auth-link" onClick={() => navigate('/login')}>
                        Log In
                    </button>
                </p>

                <button className="btn btn-secondary mt-md" onClick={() => navigate('/')}>
                    Back to Home
                </button>
            </div>
        </div>
    )
}
