import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AuthPages.css'

export default function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: email, password })
            })

            const data = await res.json()
            if (!res.ok) {
                setError(data?.error || 'Login failed.')
                return
            }

            localStorage.setItem('hiphophub_user', JSON.stringify(data))
            navigate('/home')
        } catch (err) {
            console.error('Login failed:', err)
            setError('Login failed. Check backend and try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container card">
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Log in to HipHopHub</p>

                <form onSubmit={handleLogin} className="auth-form">
                    <div className="form-group">
                        <label>Email or Username</label>
                        <input
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com or username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary auth-btn">
                        {loading ? 'Logging in...' : 'Log In'}
                    </button>
                </form>

                {error && <p className="auth-error">{error}</p>}

                <p className="auth-footer">
                    Don't have an account?{' '}
                    <span className="auth-link" onClick={() => navigate('/signup')}>
                        Sign Up
                    </span>
                </p>

                <button className="btn btn-secondary mt-md" onClick={() => navigate('/')}>
                    Back to Home
                </button>
            </div>
        </div>
    )
}
