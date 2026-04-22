import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { TERMS_VERSION, PRIVACY_VERSION } from '../lib/legal/content';
import NomadIcon from '../components/NomadIcon';

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
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('Please enter your name');
      return;
    }
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
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
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
              full_name: fullName.trim(),
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

        onSuccess();
      } else {
        // Login
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInErr) {
          setError(friendlyAuthError(signInErr));
          setLoading(false);
          return;
        }

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

        {/* ─── Form — no card, floating fields ─── */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={colors.textFaint}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
            />
          )}

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

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

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
    fontSize: s(5.5),
    color: c.danger,
    textAlign: 'center',
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
