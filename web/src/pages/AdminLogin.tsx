import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AdminLogin() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/admin')
    })
  }, [navigate])

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/admin' }
    })
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <span style={styles.logo}>nomadspeople</span>
        <p style={styles.sub}>Admin Dashboard</p>
        <button onClick={handleGoogleLogin} style={styles.btn}>
          Sign in with Google
        </button>
        <p style={styles.note}>Only authorized admins can access this page.</p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f3', fontFamily: "'Inter', sans-serif" },
  card: { background: '#fff', borderRadius: 20, padding: 48, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', maxWidth: 380, width: '100%' },
  logo: { fontSize: 24, fontWeight: 800, letterSpacing: -0.5 },
  sub: { color: '#999', fontSize: 14, marginTop: 4, marginBottom: 32 },
  btn: { width: '100%', padding: '14px 24px', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  note: { marginTop: 16, fontSize: 12, color: '#bbb' },
}
