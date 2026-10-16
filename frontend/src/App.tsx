import StageEffects from './components/StageEffects'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ArtistProfilePage from './pages/ArtistProfilePage'
import SeedheMautUniverse from './pages/SeedheMautUniverse'
import ArtistUniversePage from './pages/ArtistUniversePage'
import ProfilePage from './pages/ProfilePage'
import NavigationEffects from './components/NavigationEffects'
import DHHMascot from './components/DHHMascot'
import { AuthProvider } from './context/AuthContext'

export default function App() {
    return (
        <AuthProvider>
            <Router>
            <NavigationEffects />
            <StageEffects />
            <a className="skip-link" href="#main-content">Skip to content</a>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/artists/:id" element={<ArtistProfilePage />} />
                <Route path="/universe/seedhe-maut" element={<SeedheMautUniverse />} />
                <Route path="/universe/artist/:id" element={<ArtistUniversePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<main id="main-content" className="universe-error"><span className="section-kicker">404 / OFF THE RECORD</span><h1>This track doesn’t exist.</h1><p>Find your way back to the scene.</p><Link className="btn btn-primary" to="/home">Explore HipHopHub ↗</Link></main>} />
            </Routes>
            <DHHMascot />
        </Router>
        </AuthProvider>
    )
}
