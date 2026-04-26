import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/* ─── Primary Supabase project ─── */
const SUPABASE_URL = 'https://apzpxnkmuhcwmvmgisms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwenB4bmttdWhjd212bWdpc21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzg2MjksImV4cCI6MjA4OTk1NDYyOX0.Hr0n3c4l0vznMRN7eLPB40VATb77CjyOBWmYlLlK3KM';

/* ─── Auth session persistence ──────────────────────────────────
 *
 * CRITICAL — pre-2026-04-26 the client was instantiated as
 * `createClient(URL, KEY)` with no auth options. The default
 * storage in that mode is browser localStorage on web and
 * MEMORY-ONLY on React Native — meaning every full-quit of the
 * app threw the session away and forced the user to type their
 * email + password on the next launch. Tester report:
 * "אני צריך גם שתעשה לי שהמערכת כניסה תשמור את הכניסת משתמש -
 *  שלא אצטרך או משתמש לא יצטרך להכניס את המייל שלו כל יציאה".
 *
 * Fix: configure AsyncStorage as the auth storage on native and
 * leave the web default (localStorage) untouched. With this:
 *   - persistSession  : true (write the session to disk)
 *   - autoRefreshToken: true (silently rotate the JWT)
 *   - detectSessionInUrl: false (RN doesn't have a URL to detect)
 * Net effect: a logged-in user stays logged in across app
 * restarts, OS reboots, and OTA updates. The only way out is
 * an explicit Settings → Log Out tap.
 *
 * Email pre-fill on the AuthScreen (so a user who DID log out
 * doesn't have to retype their address) lives in AuthScreen
 * itself — see the `lastEmail` AsyncStorage key. Password is
 * NEVER stored on disk (security red line per CLAUDE.md). */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
