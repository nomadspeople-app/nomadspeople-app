import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/login" element={<AdminLogin />} />
    </Routes>
  )
}
