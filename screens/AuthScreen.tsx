import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';

/* AsyncStorage key for the most recent successful login email.
 * Pre-fills the email field on the login form so a user who
 * signed out (or whose persisted session expired) doesn't have
 * to retype their address. NEVER stores password — that would
 * be a privacy / security red line. See lib/supabase.ts comment. */
const LAST_EMAIL_KEY = '@nomadspeople/lastEmail';
import { TERMS_VERSION, PRIVACY_VERSION } from '../lib/legal/content';
import NomadIcon from '../components/NomadIcon';
import {
  isAppleSignInEnabled,
  isGoogleSignInEnabled,
  signInWithApple,
  signInWithGoogle,
} from '../lib/auth';

interface Props {
  onSuccess: () => void;
}

/** Turn a Supabase auth error into a single short human sentence.
 *  The Supabase SDK sometimes stuffs the entire non-JSON response body
 *  (Cloudflare 522/503 HTML, etc.) into `.message`, which would render
 *  as a wall of JSON on our form. This maps the common cases to clean
 *  copy and swallows everything else into a generic retry message. */
function friendlyAuthError(err: any): string {
  // Pull what we can from the object without trusting any single field.
  const raw = typeof err === 'string' ? err : (err?.message || '');
  const status: number | undefined = err?.status;
  const text = String(raw).toLowerCase();

  // Cloudflare / gateway / any 5xx → server-side hiccup, come back later.
  if (
    status === 522 || status === 523 || status === 524 ||
    status === 502 || status === 503 || status === 504 ||
    text.includes('cloudflare') || text.includes('timeout') ||
    text.includes('gateway') || text.includes('<html') || text.startsWith('{')
  ) {
    return 'Server is busy right now. Please try again in a minute.';
  }
  // Explicit bad-credential messages Supabase returns
  if (text.includes('invalid login') || text.includes('invalid credentials')) {
    return 'Wrong email or password.';
  }
  if (text.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (text.includes('user already registered')) {
    return 'This email already has an account. Try logging in instead.';
  }
  if (text.includes('network') || text.includes('failed to fetch') || text.includes('abort')) {
    return 'No connection. Check your internet and try again.';
  }
  // Anything else — a short, safe default. Never leak raw error objects.
  return 'Something went wrong. Please try again.';
}

export default function AuthScreen({ onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /* Mode default — start `null` so the first-paint can be a brief
   * spinner instead of a flash of "Login" → "Signup" once we read
   * AsyncStorage. The async useEffect below sets it to either
   * 'login' (returning user) or 'signup' (first-time on this
   * device). Pre-fix this defaulted to 'login' for everyone:
   * brand-new testers landed on the Login form, typed their fresh
   * credentials, and got "Invalid email or password" because no
   * such account existed yet — exactly the report from 2026-04-26
   * ("מייל או סיסמא אינם מזוהים"). The smart default fixes the
   * 12-tester onboarding flow end-to-end. */
  const [mode, setMode] = useState<'login' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // fullName intentionally removed (2026-04-26): the display name
  // is now collected during onboarding (lib/translations
  // setup.displayName), not at signup.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* On mount: read the last-saved email. If we find one, the user
   * has signed in on this device before — open in Login mode with
   * the email pre-filled. Otherwise, open in Signup — first-time
   * users should see the registration form by default, not be
   * forced to discover the "Sign up" toggle. */
  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL_KEY)
      .then((saved) => {
        if (saved) {
          setEmail(saved);
          setMode('login');
        } else {
          setMode('signup');
        }
      })
      .catch(() => setMode('signup')); // safer default on read failure
  }, []);

  /* ── Consent state (signup only) ──────────────────────────────
     Three checkboxes: age (required), terms (required), privacy
     (required), plus one optional marketing opt-in. All four start
     unchecked — GDPR requires explicit opt-in for every consent.
     handleSubmit blocks if any of the three required boxes is
     unchecked. */
  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  /* Toggle between dotted password (default) and plain text. We do NOT
     persist this — every time the screen opens, password is masked. */
  const [showPassword, setShowPassword] = useState(false);

  /* ── Forgot password ─────────────────────────────────────────────
   *
   * Sends a password-reset email via Supabase. The email contains
   * a magic link that opens Supabase's hosted recovery page where
   * the user picks a new password. No native deep-linking required
   * for v14 — the link works in any browser.
   *
   * Tester report 2026-04-26: "אין לנו את האופציה להחלפת סיסמא של
   * המשתמש במידה וירצה". Critical for a closed test where 12
   * people are setting passwords for the first time and at least
   * one will mistype + forget what they wrote.
   *
   * Fail mode: if the email isn't registered, Supabase still
   * returns success (security best practice — don't leak which
   * emails exist). We just tell the user to check their inbox.
   */
  const [resettingPassword, setResettingPassword] = useState(false);
  const handleForgotPassword = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Email needed', 'Type your email above first, then tap "Forgot password?".');
      return;
    }
    setResettingPassword(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'https://nomadspeople.com/reset-password',
      });
      if (resetErr) {
        Alert.alert('Could not send reset email', friendlyAuthError(resetErr));
        return;
      }
      Alert.alert(
        'Check your email',
        `We sent password reset instructions to ${trimmed}.\n\nThe link works in any browser. If you don't see it within a couple of minutes, check your spam folder.`,
      );
    } catch (ex) {
      Alert.alert('Could not send reset email', friendlyAuthError(ex));
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    // Display name is collected during onboarding (lib/translations
    // setup.displayName) — keeping it OUT of the signup form keeps
    // the first impression to two fields. Tester directive 2026-04-26:
    // "אין צורך בהרשמה / מייל / סיסמא הם בוחרים".
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    /* ── Consent gate (signup only) ─────────────────────────────
       GDPR Article 7(1): we must be able to demonstrate that the
       user has consented. If any of the three required boxes is
       unchecked, we refuse to create the account — no account, no
       consent event, no data stored. Marketing opt-in is optional
       and does NOT block signup. */
    if (mode === 'signup') {
      if (!agreedAge) {
        setError('Please confirm you are 18 or older.');
        return;
      }
      if (!agreedTerms) {
        setError('Please accept the Terms of Service to continue.');
        return;
      }
      if (!agreedPrivacy) {
        setError('Please accept the Privacy Policy to continue.');
        return;
      }
    }

    setLoading(true);

    // The outer try/catch handles thrown exceptions from the Supabase SDK
    // (happens when the auth endpoint returns HTML / 522 — the SDK can
    // throw instead of returning a clean { error } object). Either way,
    // we route the message through friendlyAuthError so the form NEVER
    // renders a raw JSON dump.
    try {
      if (mode === 'signup') {
        const cleanedEmail = email.trim().toLowerCase();
        // No `data: { full_name }` here — name is collected by
        // OnboardingScreen so the auth form stays minimal (email +
        // password only). The profile row below uses an empty
        // string for full_name; OnboardingScreen.handleComplete
        // overwrites it with the user's chosen display name.
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: cleanedEmail,
          password,
        });

        if (signUpErr) {
          setError(friendlyAuthError(signUpErr));
          setLoading(false);
          return;
        }

        // Create profile in app_profiles with consent timestamps baked in
        // so we have proof from the very first DB write that the user
        // agreed to Terms + Privacy before the account existed.
        if (data.user) {
          const nowIso = new Date().toISOString();
          const { error: profileErr } = await supabase
            .from('app_profiles')
            .insert({
              user_id: data.user.id,
              full_name: '',
              username: email.trim().split('@')[0],
              onboarding_done: false,
              show_on_map: true,
              creator_tag: false,
              is_premium: false,
              visibility: 'public',
              /* Consent snapshot — these fields pin the exact version
                 the user agreed to. Required by GDPR Article 7(1). */
              terms_accepted_at: nowIso,
              terms_version_accepted: TERMS_VERSION,
              privacy_accepted_at: nowIso,
              privacy_version_accepted: PRIVACY_VERSION,
              marketing_emails_opt_in: marketingOptIn,
              marketing_opt_in_at: marketingOptIn ? nowIso : null,
            });

          if (profileErr) {
            console.warn('[Auth] Profile creation error:', profileErr.message);
          }

          /* Append-only audit log — an immutable record of every
             consent action. A profile row can be updated later, but
             these events are never modified. If a dispute arises,
             this is the legal record. */
          const events = [
            { user_id: data.user.id, event_type: 'age_verified',     version: null,                   surface: 'signup' as const },
            { user_id: data.user.id, event_type: 'terms_accepted',   version: TERMS_VERSION,          surface: 'signup' as const },
            { user_id: data.user.id, event_type: 'privacy_accepted', version: PRIVACY_VERSION,        surface: 'signup' as const },
          ];
          if (marketingOptIn) {
            events.push({
              user_id: data.user.id,
              event_type: 'marketing_opt_in',
              version: null,
              surface: 'signup' as const,
            });
          }
          const { error: consentErr } = await supabase
            .from('app_consent_events')
            .insert(events);
          if (consentErr) {
            console.warn('[Auth] Consent event log failed:', consentErr.message);
            // Non-fatal: the profile fields are authoritative for the
            // "did they agree" question. The event log is redundant
            // belt-and-braces. A missing event here still leaves the
            // profile row with the correct timestamps.
          }
        }

        // Remember the email for next launch — same pattern as login.
        AsyncStorage.setItem(LAST_EMAIL_KEY, cleanedEmail).catch(() => {});

        onSuccess();
      } else {
        // Login
        const cleanedEmail = email.trim().toLowerCase();
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanedEmail,
          password,
        });

        if (signInErr) {
          setError(friendlyAuthError(signInErr));
          setLoading(false);
          return;
        }

        // Remember the email for next launch — fire-and-forget,
        // a write failure shouldn't block the login flow.
        AsyncStorage.setItem(LAST_EMAIL_KEY, cleanedEmail).catch(() => {});

        onSuccess();
      }
    } catch (ex) {
      // Supabase SDK threw (usually on 5xx HTML bodies it can't parse).
      // Log for debugging, show the user a clean retry message.
      console.warn('[Auth] submit threw:', ex);
      setError(friendlyAuthError(ex));
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError('');
  };

  // While AsyncStorage is being read for the smart-default mode,
  // show a tiny spinner instead of flashing Login → Signup. The
  // read is fast (sub-100ms typically), so this is invisible to
  // the user — but it removes the "wait, why is the form
  // rearranging itself" jitter on slow Android cold starts.
  if (mode === null) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ─── Brand — wordmark only, Apple-clean ─── */}
        <View style={styles.brandWrap}>
          <Text style={styles.wordmark}>nomadspeople</Text>
          <Text style={styles.tagline}>find your people, anywhere</Text>
        </View>

        {/* ─── Social sign-in (Apple + Google) ───
             Rendered ONLY when the provider is both (a) plausibly
             available on this platform and (b) server-side wired up
             in Supabase (see app.json → extra.auth.*). Both checks
             live in lib/auth.ts so nothing slips through.
             When neither is enabled this whole block is null — no
             divider, no empty space — so the email form stays the
             primary CTA without friction. */}
        {(isAppleSignInEnabled || isGoogleSignInEnabled) && (
          <View style={styles.socialAuthGroup}>
            {isAppleSignInEnabled && (
              <TouchableOpacity
                style={[styles.socialBtn, styles.appleBtn]}
                onPress={async () => {
                  setLoading(true);
                  setError('');
                  const { error: e } = await signInWithApple();
                  if (e) setError(e);
                  else onSuccess();
                  setLoading(false);
                }}
                disabled={loading}
                activeOpacity={0.75}
                accessibilityLabel="Continue with Apple"
              >
                <Text style={styles.appleBtnText}>  Continue with Apple</Text>
              </TouchableOpacity>
            )}
            {isGoogleSignInEnabled && (
              <TouchableOpacity
                style={[styles.socialBtn, styles.googleBtn]}
                onPress={async () => {
                  setLoading(true);
                  setError('');
                  const { error: e } = await signInWithGoogle();
                  if (e) setError(e);
                  else onSuccess();
                  setLoading(false);
                }}
                disabled={loading}
                activeOpacity={0.75}
                accessibilityLabel="Continue with Google"
              >
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            )}

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
          </View>
        )}

        {/* ─── Form — no card, floating fields ─── */}
        {/* Two-field signup (email + password). Display name moved
            entirely into OnboardingScreen per the 2026-04-26
            tester directive: "אין צורך בהרשמה / מייל / סיסמא הם
            בוחרים". The auth surface stays minimal so first-time
            users complete it in seconds. */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          {/* Password field with eye toggle. The eye sits inside the
              same border as the input so it reads as one unit. Tapping
              the eye flips secureTextEntry. */}
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <NomadIcon
                name={showPassword ? 'eye-off' : 'eye'}
                size={s(7)}
                color={colors.textMuted}
                strokeWidth={1.8}
              />
            </TouchableOpacity>
          </View>

          {/* ─── Forgot password? — login mode only ───
               Tester report 2026-04-26: "אין לנו את האופציה
               להחלפת סיסמא של המשתמש במידה וירצה". Critical for a
               closed test where 12 people are setting passwords
               for the first time and at least one will mistype +
               forget what they wrote. Wired to handleForgotPassword
               above, which uses Supabase resetPasswordForEmail. */}
          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleForgotPassword}
              disabled={resettingPassword}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotText}>
                {resettingPassword ? 'Sending email…' : 'Forgot password?'}
              </Text>
            </TouchableOpacity>
          )}

          {/* ─── Consent checkboxes (signup only) ───
               GDPR Article 7 requires explicit, verifiable consent.
               Three required boxes, one optional. The three required
               must be checked to enable the Create Account button. */}
          {mode === 'signup' && (
            <View style={styles.consentGroup}>
              <ConsentRow
                checked={agreedAge}
                onToggle={() => setAgreedAge(!agreedAge)}
                colors={colors}
                styles={styles}
              >
                <Text style={styles.consentText}>
                  I am <Text style={styles.consentStrong}>18 years or older</Text>.
                </Text>
              </ConsentRow>

              <ConsentRow
                checked={agreedTerms}
                onToggle={() => setAgreedTerms(!agreedTerms)}
                colors={colors}
                styles={styles}
              >
                <Text style={styles.consentText}>
                  I agree to the{' '}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL('https://nomadspeople.com/terms')}
                  >
                    Terms of Service
                  </Text>
                  .
                </Text>
              </ConsentRow>

              <ConsentRow
                checked={agreedPrivacy}
                onToggle={() => setAgreedPrivacy(!agreedPrivacy)}
                colors={colors}
                styles={styles}
              >
                <Text style={styles.consentText}>
                  I agree to the{' '}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL('https://nomadspeople.com/privacy')}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </ConsentRow>

              <ConsentRow
                checked={marketingOptIn}
                onToggle={() => setMarketingOptIn(!marketingOptIn)}
                colors={colors}
                styles={styles}
              >
                <Text style={styles.consentTextOptional}>
                  Send me occasional updates and tips from nomadspeople (optional).
                </Text>
              </ConsentRow>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.75}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Continue' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Toggle ─── */}
        <TouchableOpacity onPress={toggleMode} activeOpacity={0.7} style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.toggleLink}>
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </Text>
          </Text>
        </TouchableOpacity>


      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── ConsentRow — single row with a square checkbox + label.
      Tapping anywhere on the row toggles. Used for the three
      required consents + the optional marketing opt-in. Kept
      local to AuthScreen because it has specific sizing to fit
      under the password field and because its only consumer is
      the signup form. If a second surface ever needs this, lift
      to components/. */
function ConsentRow({
  checked,
  onToggle,
  children,
  colors,
  styles,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
  styles: any;
}) {
  return (
    <TouchableOpacity
      style={styles.consentRow}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.checkbox,
          checked && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        {checked && (
          <NomadIcon name="check" size={s(3.5)} color="#fff" strokeWidth={2.5} />
        )}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: s(16),
    justifyContent: 'center',
    paddingVertical: s(20),
  },

  /* ── Brand — just the wordmark, centered, breathing room ── */
  brandWrap: {
    alignItems: 'center',
    marginBottom: s(20),
  },
  wordmark: {
    fontSize: s(16),
    fontWeight: FW.extra,
    color: c.dark,
    letterSpacing: -0.5,
    marginBottom: s(4),
  },
  tagline: {
    fontSize: s(6),
    color: c.textMuted,
    fontWeight: FW.regular,
    letterSpacing: 0.2,
  },

  /* ── Social sign-in block (Apple + Google) ──
     Native iOS Apple button guideline: black fill, white text,
     SF symbol. We approximate with flat black TouchableOpacity +
     Apple logo emoji fallback (the real Apple SFSymbol requires
     the `AppleAuthenticationButton` native component; we use our
     own styled button so we can control disabled state alongside
     the email form). Google button: white fill, 1px border, dark
     label — per Google Identity branding. */
  socialAuthGroup: {
    gap: s(4),
    marginBottom: s(8),
  },
  socialBtn: {
    height: s(22),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  appleBtn: {
    backgroundColor: '#000',
  },
  appleBtnText: {
    color: '#fff',
    fontSize: s(6.5),
    fontWeight: FW.semi,
  },
  googleBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  googleBtnText: {
    color: '#1F1F1F',
    fontSize: s(6.5),
    fontWeight: FW.medium,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(4),
    gap: s(4),
  },
  orLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: c.borderSoft,
  },
  orText: {
    fontSize: s(5.5),
    color: c.textMuted,
    fontWeight: FW.regular,
  },

  /* ── Form — clean, no border card ── */
  form: {
    gap: s(5),
  },
  input: {
    height: s(22),
    borderRadius: s(6),
    paddingHorizontal: s(7),
    fontSize: s(6.5),
    fontWeight: FW.regular,
    color: c.dark,
    backgroundColor: c.surface,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
  },
  error: {
    fontSize: s(6),
    color: c.danger,
    textAlign: 'center',
    fontWeight: FW.semi,
    backgroundColor: c.surface,
    borderRadius: s(4),
    paddingVertical: s(3),
    paddingHorizontal: s(4),
    borderWidth: 0.5,
    borderColor: c.danger,
    marginVertical: s(2),
  },

  /* ── Password input + eye toggle ──
     We replicate the .input visual (height, border, radius, bg) on
     the WRAPPER so the eye icon sits inside the same field. The
     inner TextInput then has no border of its own. */
  passwordWrap: {
    height: s(22),
    borderRadius: s(6),
    paddingLeft: s(7),
    paddingRight: s(3),
    backgroundColor: c.surface,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: s(6.5),
    fontWeight: FW.regular,
    color: c.dark,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: s(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* "Forgot password?" — login mode only. Right-aligned just under
   * the password row, soft text so it doesn't compete with the
   * primary Continue button. */
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: s(2),
    paddingVertical: s(1),
    paddingHorizontal: s(2),
  },
  forgotText: {
    fontSize: s(5.5),
    color: c.primary,
    fontWeight: FW.medium,
  },

  /* ── Consent group ── */
  consentGroup: {
    gap: s(3),
    marginTop: s(3),
    marginBottom: s(3),
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(4),
    paddingVertical: s(2),
  },
  checkbox: {
    width: s(7),
    height: s(7),
    borderRadius: s(1.5),
    borderWidth: 1.5,
    borderColor: c.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(0.5),
  },
  consentText: {
    fontSize: s(5.5),
    color: c.dark,
    lineHeight: s(8),
  },
  consentTextOptional: {
    fontSize: s(5),
    color: c.textSec,
    lineHeight: s(7.5),
    fontStyle: 'italic',
  },
  consentStrong: {
    fontWeight: FW.bold,
  },
  consentLink: {
    color: c.primary,
    textDecorationLine: 'underline',
    fontWeight: FW.semi,
  },

  submitBtn: {
    height: s(22),
    backgroundColor: c.dark,
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(2),
  },
  submitText: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
    color: c.bg,
    letterSpacing: 0.1,
  },

  /* ── Toggle ── */
  toggleRow: {
    marginTop: s(10),
    alignItems: 'center',
  },
  toggleText: {
    fontSize: s(5.5),
    color: c.textMuted,
    fontWeight: FW.regular,
  },
  toggleLink: {
    color: c.primary,
    fontWeight: FW.semi,
  },

});
