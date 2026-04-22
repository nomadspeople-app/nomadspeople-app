/**
 * DeleteAccountPage — public out-of-app deletion flow.
 *
 * Required by Apple Guideline 5.1.1(v) and Google Play developer
 * policy: a user must be able to request and complete account
 * deletion WITHOUT having the app installed.
 *
 * Three-step UX:
 *   1. Form  — user enters email, we send a magic link via
 *              supabase.auth.signInWithOtp({ shouldCreateUser:false }).
 *              The magic link includes ?confirm=1 in the redirect URL.
 *   2. Sent  — instructional screen telling them to check email.
 *   3. Confirm — when they return via the magic link, the URL has
 *              ?confirm=1 and the Supabase session is active. We
 *              show a final "Delete Forever" button. On click,
 *              the SHARED deleteAccountData() runs (same code the
 *              mobile app uses), session is signed out, success
 *              shown.
 *
 * Single source of truth: the deletion mutation logic lives in
 * lib/accountDeletion.ts. This page never inlines DB calls — if a
 * future schema change adds a table to clean up, the change goes
 * in the shared module and both surfaces benefit.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deleteAccountData } from '../../../lib/accountDeletion'

type Step = 'form' | 'sent' | 'confirm' | 'deleting' | 'deleted' | 'error'

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [signedInEmail, setSignedInEmail] = useState<string>('')

  /* ── Detect post-magic-link return ─────────────────────────────
     Magic link redirects to /delete-account?confirm=1. Supabase
     sets the session via the URL hash on its own; we just check
     whether a session exists once Supabase has had a moment to
     parse the URL. If yes + ?confirm=1 in the URL → show the
     final-confirm step. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const confirmFlag = params.get('confirm') === '1'

    // Give supabase-js a tick to parse the URL fragment for the OTP token.
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (confirmFlag && data?.session?.user?.id) {
          setSignedInEmail(data.session.user.email ?? '')
          setStep('confirm')
        }
      } catch {
        /* no session yet — stay on form */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [])

  const handleRequest = async () => {
    if (!email.trim()) return
    setLoading(true)
    setErrorMsg('')
    try {
      // Magic link comes back to this same page with ?confirm=1.
      // Supabase appends the session token in the URL hash on its
      // own — the useEffect above picks that up.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/delete-account?confirm=1`,
        },
      })
      if (error) {
        setErrorMsg(error.message)
        setStep('error')
      } else {
        setStep('sent')
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'unknown error')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    setStep('deleting')
    try {
      const { data } = await supabase.auth.getSession()
      const userId = data?.session?.user?.id
      if (!userId) {
        setErrorMsg('Session expired. Please request a new link.')
        setStep('error')
        return
      }
      const { error } = await deleteAccountData(userId, supabase)
      if (error) {
        setErrorMsg(typeof error?.message === 'string' ? error.message : 'Deletion failed.')
        setStep('error')
        return
      }
      setStep('deleted')
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'unknown error')
      setStep('error')
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
              Enter the email address associated with your nomadspeople account. We'll send
              you a verification link. After you click it, you can confirm permanent deletion
              from this page.
            </p>
            <p style={p}>This action is irreversible. The following will be removed:</p>
            <ul style={ul}>
              <li style={li}>Your profile, photo, and bio</li>
              <li style={li}>All posts, comments, and photos you uploaded</li>
              <li style={li}>All check-ins and group memberships</li>
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
              Prefer to delete from inside the app? Open nomadspeople &rarr; Settings &rarr;
              Delete Account.
            </p>
          </>
        )}

        {step === 'sent' && (
          <div style={successBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✉️</p>
            <h2 style={{ ...h2, marginTop: 0 }}>Check your email</h2>
            <p style={p}>
              We sent a verification link to <strong>{email}</strong>. Open the email and tap
              the link &mdash; it will return you to this page with a final &ldquo;Delete
              Forever&rdquo; button.
            </p>
            <p style={p}>
              If you don&rsquo;t see the email, check your spam folder. The link expires in
              one hour.
            </p>
          </div>
        )}

        {step === 'confirm' && (
          <div style={confirmBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
            <h2 style={{ ...h2, marginTop: 0, color: '#B91C1C' }}>Final Confirmation</h2>
            <p style={p}>
              You&rsquo;re signed in as <strong>{signedInEmail || 'your account'}</strong>.
            </p>
            <p style={p}>
              Tapping the button below will <strong>permanently delete</strong> your
              nomadspeople account and every piece of personal data tied to it. Your messages
              in group chats will remain (so the conversation still makes sense to other
              members) but your name will no longer be attached to them.
            </p>
            <p style={p}>This cannot be undone.</p>
            <button onClick={handleConfirmDelete} style={dangerBtn}>
              Delete Forever
            </button>
            <p style={hint}>
              Changed your mind? Just close this page &mdash; nothing happens until you tap
              the button.
            </p>
          </div>
        )}

        {step === 'deleting' && (
          <div style={successBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>⏳</p>
            <h2 style={{ ...h2, marginTop: 0 }}>Deleting your account...</h2>
            <p style={p}>This usually takes a few seconds.</p>
          </div>
        )}

        {step === 'deleted' && (
          <div style={successBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
            <h2 style={{ ...h2, marginTop: 0 }}>Account deleted</h2>
            <p style={p}>
              Your account and all personal data have been permanently removed from
              nomadspeople. We&rsquo;re sorry to see you go &mdash; safe travels.
            </p>
            <p style={p}>
              <a href="/" style={link}>Return home</a>
            </p>
          </div>
        )}

        {step === 'error' && (
          <div style={errorBox}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
            <h2 style={{ ...h2, marginTop: 0 }}>Something went wrong</h2>
            <p style={p}>
              {errorMsg ||
                'We couldn\'t process your request. Make sure you\'re using the same email you signed up with.'}
            </p>
            <button onClick={() => { setStep('form'); setErrorMsg(''); }} style={btn}>
              Try Again
            </button>
            <p style={{ ...p, marginTop: 16 }}>
              Need help? Email{' '}
              <a href="mailto:support@nomadspeople.com" style={link}>support@nomadspeople.com</a>.
            </p>
          </div>
        )}
      </main>

      <footer style={footer}>
        <div style={footerInner}>
          <a href="/" style={footerLk}>Home</a>
          <a href="/terms" style={footerLk}>Terms</a>
          <a href="/privacy" style={footerLk}>Privacy</a>
          <a href="/support" style={footerLk}>Support</a>
        </div>
        <p style={footerCopy}>&copy; {new Date().getFullYear()} nomadspeople</p>
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
const dangerBtn: React.CSSProperties = { padding: '14px 28px', fontSize: 16, fontWeight: 800, color: '#fff', background: '#B91C1C', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', marginTop: 16, marginBottom: 8 }
const hint: React.CSSProperties = { fontSize: 13, color: '#999', marginTop: 8 }
const successBox: React.CSSProperties = { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 32, textAlign: 'center' }
const confirmBox: React.CSSProperties = { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 32, textAlign: 'center' }
const errorBox: React.CSSProperties = { background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 32, textAlign: 'center' }
const footer: React.CSSProperties = { borderTop: '1px solid #eee', padding: '24px', textAlign: 'center' }
const footerInner: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }
const footerLk: React.CSSProperties = { color: '#999', textDecoration: 'none', fontSize: 13 }
const footerCopy: React.CSSProperties = { fontSize: 12, color: '#ccc', margin: 0 }
