import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

/* ─────────────────────────────────────────────────────────────────
 *  Feature-flag helpers
 *
 *  Read the `extra.auth` block from app.json. Defaults are false so
 *  the buttons never render unless someone explicitly flips the
 *  flag AFTER finishing the server-side provider wiring (Supabase
 *  Dashboard → Authentication → Providers → Apple / Google).
 * ────────────────────────────────────────────────────────────── */
type AuthConfig = {
  appleEnabled?: boolean;
  googleEnabled?: boolean;
  googleWebClientId?: string;
  googleIosClientId?: string;
};

const authExtra: AuthConfig =
  (Constants.expoConfig?.extra as any)?.auth ?? {};

/* ─────────────────────────────────────────────────────────────────
 *  Native module presence checks
 *
 *  Why this exists: a feature-flag in app.json saying
 *  `googleEnabled: true` is NOT enough on its own. The native
 *  module also has to be physically linked into the binary the
 *  user is running. Two real-world cases break this assumption:
 *    1. Expo Go — has no third-party native modules.
 *    2. An OLD EAS dev build, made before we added the dependency
 *       to package.json (this is exactly what happened on
 *       2026-04-22 when @react-native-google-signin landed but
 *       Barak still had a cached dev build from the day before —
 *       the app crashed with
 *       "TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin'
 *       could not be found").
 *
 *  We probe the native module with a synchronous `require()` inside
 *  try/catch. If the module isn't there, the require throws (or
 *  returns undefined) and we just record the result. The probe runs
 *  ONCE at module load — it's cheap and lets `isGoogleSignInEnabled`
 *  be a pure boolean that never lies.
 *
 *  Result: in Expo Go / a stale dev build, the social buttons stay
 *  hidden, the app does not crash, and the user goes through the
 *  email form like before.
 * ────────────────────────────────────────────────────────────── */
// Probe native modules at load time. Metro requires string-literal
// require() calls (it can't statically resolve `require(variable)`),
// so we duplicate the try/catch per module instead of writing a
// generic helper. Each block returns either the module object or
// null; null gates the corresponding feature flag below to false,
// which keeps the auth buttons hidden in builds that don't have the
// native binary linked (Expo Go, stale dev builds).

let appleAuthModule: any = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appleAuthModule = require('expo-apple-authentication');
  } catch {
    appleAuthModule = null;
  }
}

let googleSigninModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  googleSigninModule = require('@react-native-google-signin/google-signin');
} catch {
  googleSigninModule = null;
}

export const isAppleSignInEnabled: boolean =
  Platform.OS === 'ios'
  && authExtra.appleEnabled === true
  && appleAuthModule !== null;

export const isGoogleSignInEnabled: boolean =
  authExtra.googleEnabled === true
  // Need at least the web client ID for the ID token audience to match
  && typeof authExtra.googleWebClientId === 'string'
  && authExtra.googleWebClientId.length > 0
  // And the native module has to be in this build, not just the flag
  && googleSigninModule !== null;

/* ─────────────────────────────────────────────────────────────────
 *  Sign in with Apple
 *
 *  Flow:
 *    1. expo-apple-authentication opens the native Apple sheet.
 *    2. User confirms → we get an identityToken (signed JWT from Apple).
 *    3. We hand that token to Supabase's signInWithIdToken.
 *    4. Supabase verifies the Apple signature and either creates or
 *       returns the matching user.
 *
 *  Apple's full name + email are ONLY delivered on the VERY FIRST
 *  sign-in per Apple-ID / per App-ID pair. We forward those to
 *  Supabase via user_metadata so the downstream profile bootstrap
 *  code in AuthScreen can pick them up. On subsequent sign-ins they
 *  come back as null — that is expected.
 * ────────────────────────────────────────────────────────────── */
export async function signInWithApple(): Promise<{ error: string | null }> {
  if (!isAppleSignInEnabled || !appleAuthModule) {
    return { error: 'Apple Sign-In is not available on this build.' };
  }
  try {
    // Module already loaded at top of file (safeRequire). Keeping a
    // local alias mirrors the previous shape for the rest of this
    // function and keeps the AppleAuthentication.* calls readable.
    const AppleAuthentication = appleAuthModule;

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const identityToken = credential.identityToken;
    if (!identityToken) {
      return { error: 'Apple did not return an identity token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });
    if (error) return { error: error.message };

    // Forward Apple's first-time-only name to our profile metadata.
    // Supabase will attach this to the user; AuthScreen post-signup
    // code can read it to pre-fill display_name.
    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ')
          .trim()
      : '';
    if (fullName) {
      await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
    }

    return { error: null };
  } catch (e: any) {
    // ERR_CANCELED is fired when the user dismisses the Apple sheet.
    // It is not an error to show — the UI just stays on the auth
    // screen silently.
    if (e?.code === 'ERR_REQUEST_CANCELED' || e?.code === 'ERR_CANCELED') {
      return { error: null };
    }
    return { error: e?.message ?? 'Apple sign-in failed.' };
  }
}

/* ─────────────────────────────────────────────────────────────────
 *  Sign in with Google
 *
 *  Flow:
 *    1. GoogleSignin.signIn() opens the native Google sheet (iOS uses
 *       the iOS client ID; Android reads google-services.json).
 *    2. We extract idToken from the response.
 *    3. Supabase verifies the token against the WEB client ID
 *       (that's why googleWebClientId must match Supabase's settings).
 *    4. Supabase creates or returns the matching user.
 *
 *  GoogleSignin.configure() must run ONCE at app start — we do it
 *  here idempotently on the first signInWithGoogle call.
 * ────────────────────────────────────────────────────────────── */
let googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (googleConfigured || !googleSigninModule) return;
  const { GoogleSignin } = googleSigninModule;
  GoogleSignin.configure({
    webClientId: authExtra.googleWebClientId, // required
    iosClientId: authExtra.googleIosClientId || undefined, // iOS only
    offlineAccess: false, // we only need the ID token, not a refresh token
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!isGoogleSignInEnabled || !googleSigninModule) {
    return { error: 'Google Sign-In is not available on this build.' };
  }
  try {
    ensureGoogleConfigured();
    // Module already loaded at top of file (safeRequire).
    const { GoogleSignin } = googleSigninModule;

    // On Android we should check Play Services is available.
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const response = await GoogleSignin.signIn();
    // v14 returns { type: 'success', data: { idToken, user, ... } }
    // v13 returns the data object directly. Normalise.
    const data: any = (response as any)?.data ?? response;
    const idToken: string | undefined = data?.idToken;
    if (!idToken) {
      return { error: 'Google did not return an ID token.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { error: error.message };

    return { error: null };
  } catch (e: any) {
    // User cancelled — don't surface as an error.
    if (
      e?.code === 'SIGN_IN_CANCELLED' ||
      e?.code === '-5' ||
      e?.code === 12501 // android user cancelled
    ) {
      return { error: null };
    }
    return { error: e?.message ?? 'Google sign-in failed.' };
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[Auth] Existing session:', s ? `user ${s.user.id}` : 'none');
      setSession(s);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log('[Auth] State change:', _event, s ? `user ${s.user.id}` : 'no session');
      setSession(s);
      if (loading) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return {
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    loading,
    signOut,
  };
}
