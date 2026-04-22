import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import DeleteAccountPage from './pages/DeleteAccountPage'
import SupportPage from './pages/SupportPage'

/* Routes wiring — the landing footer links to /privacy, /terms,
 * /delete-account, and /support. Before the April 2026 pre-launch
 * audit, only /, /admin, and /admin/login were registered — meaning
 * every legal link in the footer returned a 404. Apple rejects any
 * submission where the Privacy Policy URL 404s, so this was a hard
 * launch blocker discovered while preparing the submission kit. */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/delete-account" element={<DeleteAccountPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/login" element={<AdminLogin />} />
    </Routes>
  )
}
