import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'form' | 'sent' | 'error'>('form')
  const [loading, setLoading] = useState(false)

  const handleRequest = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      // Send a magic link so the user can verify identity before deletion
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      })
      if (error) {
        setStep('error')
      } else {
        setStep('sent')
      }
    } catch {
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={wrap}>
      <nav style={nav}>
        <a href="/" style={logo}>nomadspeople</a>
      </nav>

      <main style={main}>
        <h1 style={h1}>Delete Your Account</h1>
        <p style={meta}>
          Google Play and Apple require that you can request account deletion without
          having the app installed. Use this page to begin the process.
        </p>

        {step === 'form' && (
          <>
            <p style={p}>
              Enter the email address associated with your NomadsPeople account. We will send
              you a verification link. After you verify, your account and all associated data
              will be permanently deleted.
            </p>
            <p style={p}>This action is irreversible. The following will be removed:</p>
            <ul style={ul}>
              <li style={li}>Your profile, photo, and bio</li>
              <li style={li}>All posts, comments, and photos you uploaded</li>
              <li style={li}>All messages and group memberships</li>
              <li style={li}>Your position on the map</li>
              <li style={li}>Notification preferences and push token</li>
            </ul>

            <div style={formRow}>
              <input
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input}
              />
              <button
                onClick={handleRequest}
                disabled={loading || !email.trim()}
                style={{
                  ...btn,
                  opacity: loading || !email.trim() ? 0.5 : 1,
                }}
              >
                {loading ? 'Sending...' : 'Send Verification'}
              </button>
            </div>

            <p style={hint}>
              Prefer to delete from inside the app? Open NomadsPeople &rarr; Settings &rarr;
              Delete Account.
            </p>
          </>
        )}

        {step === 'sent' && (
          <div style={successBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✉️</p>
            <h2 style={{ ...h2, marginTop: 0 }}>Check your email</h2>
            <p style={p}>
              We sent a verification link to <strong>{email}</strong>. Click it to confirm
              account deletion. If you don&rsquo;t see the email, check your spam folder.
            </p>
            <p style={p}>
              Once verified, your account and all data will be permanently removed within
              24 hours.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div style={errorBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
            <h2 style={{ ...h2, marginTop: 0 }}>Something went wrong</h2>
            <p style={p}>
              We couldn&rsquo;t find an account with that email, or an error occurred. Make
              sure you&rsquo;re using the same email you signed up with.
            </p>
            <button onClick={() => setStep('form')} style={btn}>
              Try Again
            </button>
            <p style={{ ...p, marginTop: 16 }}>
              Need help? Email{' '}
              <a href="mailto:nomadspeople1@gmail.com" style={link}>nomadspeople1@gmail.com</a>.
            </p>
          </div>
        )}
      </main>

      <footer style={footer}>
        <div style={footerInner}>
          <a href="/" style={footerLk}>Home</a>
          <a href="/terms" style={footerLk}>Terms</a>
          <a href="/privacy" style={footerLk}>Privacy</a>
          <a href="/delete-account" style={footerLk}>Delete Account</a>
        </div>
        <p style={footerCopy}>&copy; {new Date().getFullYear()} NomadsPeople</p>
      </footer>
    </div>
  )
}

const wrap: React.CSSProperties = { fontFamily: "'Inter', -apple-system, sans-serif", color: '#1A1A1A', background: '#FAFAF8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }
const nav: React.CSSProperties = { padding: '16px 24px', borderBottom: '1px solid #eee', background: 'rgba(250,250,248,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }
const logo: React.CSSProperties = { fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: '#1A1A1A', textDecoration: 'none' }
const main: React.CSSProperties = { maxWidth: 600, margin: '0 auto', padding: '48px 24px 80px', flex: 1 }
const h1: React.CSSProperties = { fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }
const meta: React.CSSProperties = { fontSize: 13, color: '#999', marginBottom: 32 }
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: '#444', marginBottom: 12 }
const ul: React.CSSProperties = { paddingLeft: 20, marginBottom: 24 }
const li: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: '#444', marginBottom: 6 }
const link: React.CSSProperties = { color: '#E8614D', textDecoration: 'none' }
const formRow: React.CSSProperties = { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }
const input: React.CSSProperties = { flex: 1, minWidth: 240, padding: '12px 16px', fontSize: 15, border: '1px solid #ddd', borderRadius: 10, outline: 'none', fontFamily: 'inherit' }
const btn: React.CSSProperties = { padding: '12px 24px', fontSize: 15, fontWeight: 700, color: '#fff', background: '#E8614D', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }
const hint: React.CSSProperties = { fontSize: 13, color: '#999', marginTop: 8 }
const successBox: React.CSSProperties = { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 32, textAlign: 'center' }
const errorBox: React.CSSProperties = { background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 32, textAlign: 'center' }
const footer: React.CSSProperties = { borderTop: '1px solid #eee', padding: '24px', textAlign: 'center' }
const footerInner: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }
const footerLk: React.CSSProperties = { color: '#999', textDecoration: 'none', fontSize: 13 }
const footerCopy: React.CSSProperties = { fontSize: 12, color: '#ccc', margin: 0 }
