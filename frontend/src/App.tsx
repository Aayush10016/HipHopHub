import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ArtistProfilePage from './pages/ArtistProfilePage'
import SeedheMautUniverse from './pages/SeedheMautUniverse'
import ArtistUniversePage from './pages/ArtistUniversePage'
import ProfilePage from './pages/ProfilePage'
import DHHMascot from './components/DHHMascot'
import { AuthProvider } from './context/AuthContext'

export default function App() {
    return (
        <AuthProvider>
            <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/artists/:id" element={<ArtistProfilePage />} />
                <Route path="/universe/seedhe-maut" element={<SeedheMautUniverse />} />
                <Route path="/universe/artist/:id" element={<ArtistUniversePage />} />
                <Route path="/profile" element={<ProfilePage />} />
            </Routes>
            <DHHMascot />
        </Router>
        </AuthProvider>
    )
}
