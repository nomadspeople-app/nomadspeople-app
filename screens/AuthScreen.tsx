import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';

/* ─── Dev shortcut credentials ─── */
const DEV_EMAIL = 'barak@test.com';
const DEV_PASSWORD = 'test1234';

interface Props {
  onSuccess: () => void;
  onDevSkip?: () => void;
}

export default function AuthScreen({ onSuccess, onDevSkip }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    setLoading(true);

    if (mode === 'signup') {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        setLoading(false);
        return;
      }

      // Create profile in app_profiles
      if (data.user) {
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
          });

        if (profileErr) {
          console.warn('[Auth] Profile creation error:', profileErr.message);
        }
      }

      onSuccess();
    } else {
      // Login
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        setError(signInErr.message);
        setLoading(false);
        return;
      }

      onSuccess();
    }

    setLoading(false);
  };

  const toggleMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError('');
  };

  /* ─── Dev shortcut: skip to login as test user ─── */
  const devLogin = async () => {
    setError('');
    setLoading(true);
    console.log('[Auth] Dev quick-login...');
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });
    if (err) {
      setError('Dev login failed: ' + err.message);
      console.warn('[Auth] Dev login error:', err.message);
    } else {
      console.log('[Auth] Dev login success:', data.user?.id);
    }
    setLoading(false);
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

        {/* ─── Dev shortcut (remove before production) ─── */}
        {onDevSkip && (
          <TouchableOpacity
            style={styles.devBtn}
            onPress={onDevSkip}
            activeOpacity={0.6}
          >
            <Text style={styles.devBtnText}>Skip — Enter as Barak</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
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

  /* ── Dev ── */
  devBtn: {
    marginTop: s(16),
    alignSelf: 'center',
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    borderRadius: s(20),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
  },
  devBtnText: {
    fontSize: s(5),
    color: c.textFaint,
    fontWeight: FW.medium,
  },
});
