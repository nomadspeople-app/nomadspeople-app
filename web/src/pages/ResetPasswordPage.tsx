/**
 * ResetPasswordPage — /reset-password route.
 *
 * Where this is used:
 *   The mobile AuthScreen calls `supabase.auth.resetPasswordForEmail(email, {
 *     redirectTo: 'https://nomadspeople.com/reset-password'
 *   })` when a user taps "Forgot password?".
 *
 *   Supabase emails the user a verification link of the shape
 *     https://apzpxnkmuhcwmvmgisms.supabase.co/auth/v1/verify?token=...&type=recovery
 *       &redirect_to=https://nomadspeople.com/reset-password
 *
 *   When the user taps that link:
 *     1. Supabase verifies the recovery token, exchanges it for a session,
 *     2. Redirects to redirect_to with the session credentials in the URL HASH:
 *           https://nomadspeople.com/reset-password#access_token=...&refresh_token=...&type=recovery
 *     3. The web @supabase/supabase-js client auto-detects the hash (default
 *        `detectSessionInUrl: true`) and sets the session in localStorage —
 *        meaning by the time this component mounts, the session is already
 *        live and `supabase.auth.updateUser({ password })` will succeed.
 *
 *   Pre-fix incident (2026-04-28 morning): there was NO route registered for
 *   `/reset-password` on the web side. Tester (Barak) clicked the email
 *   reset link and landed on a blank SPA shell with no UI — the React
 *   Router had no match, so nothing rendered. Discovered while resetting
 *   his old `barakperez@gmail.com` account password manually via SQL.
 *   This page is the structural fix so future resets actually work for
 *   every tester (and every public user once we launch).
 *
 *   Status of this flow:
 *     - The intermediate Supabase URL still appears to the user during the
 *       redirect (looks like supabase.co for ~half a second). Replacing
 *       that with our own domain requires Custom SMTP + a magic-link
 *       template change — tracked in V15-CHECKLIST §2 "Configure password
 *       reset email URL". Out of scope here. This page makes the END of
 *       the flow work; the email itself still ships from Supabase's
 *       default sender for now.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: '#fff',
    color: '#1A1A1A',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: '32px 24px',
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
    border: '1px solid #EEE',
    background: '#fff',
  },
  brand: {
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 16,
    borderRadius: 10,
    border: '1px solid #DDD',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: '#E8614D',
    border: 'none',
    borderRadius: 10,
    marginTop: 18,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    color: '#C53030',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
    padding: '10px',
    background: '#FED7D7',
    borderRadius: 8,
  },
  success: {
    color: '#22543D',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    padding: '14px',
    background: '#C6F6D5',
    borderRadius: 8,
    fontWeight: 500,
  },
  notReady: {
    color: '#6B6B6B',
    fontSize: 14,
    textAlign: 'center',
    padding: '16px',
    background: '#F7FAFC',
    borderRadius: 8,
    marginTop: 8,
  },
  link: {
    color: '#E8614D',
    textDecoration: 'none',
    fontWeight: 600,
  },
};

/* Map the most common Supabase update-password errors to short, user-
 * friendly Hebrew/English messages. Mirrors the friendlyAuthError
 * helper in the mobile app's AuthScreen so reset failures don't leak
 * raw error JSON to the user. */
function friendlyResetError(err: any): string {
  const text = String(err?.message ?? '').toLowerCase();
  const code = String(err?.error_code ?? err?.code ?? '').toLowerCase();
  if (
    code === 'weak_password' ||
    text.includes('weak password') ||
    text.includes('password should be')
  ) {
    return 'Password is too weak. Use at least 6 characters.';
  }
  if (
    text.includes('same as') ||
    text.includes('same password')
  ) {
    return 'New password must be different from your current one.';
  }
  if (text.includes('session') || text.includes('not authenticated')) {
    return 'Your reset link expired. Please request a new password reset email.';
  }
  if (text.includes('network') || text.includes('failed to fetch')) {
    return 'No connection. Check your internet and try again.';
  }
  return 'Could not update password. Please request a new reset link and try again.';
}

export default function ResetPasswordPage() {
  /* Three states this page can be in:
   *
   *   sessionState === 'checking' → still inspecting the URL hash for the
   *     recovery session that Supabase put there. Show a loading line so
   *     the user doesn't see a flash of "your link expired" before the
   *     async getSession() resolves.
   *
   *   sessionState === 'ready' → recovery session is live; show the
   *     password form.
   *
   *   sessionState === 'expired' → no session was found (link reused,
   *     expired token, manually navigated to /reset-password without an
   *     email click). Show a clear "request a new link" message instead
   *     of letting the user type a password into a non-functional form.
   */
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'expired'>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* Supabase's default `detectSessionInUrl: true` parses the URL hash
     * automatically as soon as the client is created. By the time this
     * effect runs (the next microtask after mount), the session has
     * either been picked up successfully or we never had one. We
     * confirm via a single getSession() call. */
    let cancelled = false;
    supabase.auth.getSession()
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) {
          console.warn('[ResetPassword] getSession failed:', e.message);
          setSessionState('expired');
          return;
        }
        if (data.session?.access_token) {
          setSessionState('ready');
        } else {
          setSessionState('expired');
        }
      })
      .catch((e) => {
        console.warn('[ResetPassword] getSession threw:', e);
        if (!cancelled) setSessionState('expired');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(friendlyResetError(updateErr));
        setSubmitting(false);
        return;
      }
      // Sign out the recovery session so the user isn't left in a
      // half-authenticated state on the web. They open the app and
      // log in fresh with the new password.
      await supabase.auth.signOut().catch(() => {});
      setDone(true);
    } catch (ex: any) {
      setError(friendlyResetError(ex));
    }
    setSubmitting(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>nomadspeople</div>
        <div style={styles.subtitle}>set a new password</div>

        {sessionState === 'checking' && (
          <div style={styles.notReady}>verifying your link…</div>
        )}

        {sessionState === 'expired' && (
          <div style={styles.notReady}>
            This reset link is no longer valid. Open the nomadspeople app, tap
            "Forgot password?" on the login screen, and we'll send you a fresh
            link.
          </div>
        )}

        {sessionState === 'ready' && !done && (
          <form onSubmit={handleSubmit}>
            <label style={styles.label} htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              style={styles.input}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="At least 6 characters"
              required
            />

            <label style={styles.label} htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              style={styles.input}
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              placeholder="Type it again"
              required
            />

            {error && <div style={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.button,
                ...(submitting ? styles.buttonDisabled : {}),
              }}
            >
              {submitting ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}

        {done && (
          <div style={styles.success}>
            Password updated. Open the nomadspeople app and sign in with your
            new password.
          </div>
        )}
      </div>
    </div>
  );
}
