/**
 * permissions — the single permission orchestrator.
 *
 * Why this lives alone:
 *   Before 2026-04-20 the app asked for Location permission
 *   from 7 different code paths, Notifications from 1, and
 *   never for iOS App Tracking Transparency at all. On a
 *   fresh install the user was hit with Location the moment
 *   they reached the map, then Notifications randomly later
 *   — a chaotic permission experience that Apple has been
 *   known to cite in reviews.
 *
 *   This module centralizes the *onboarding* permission
 *   sequence: a deliberate, paced request chain fired ONCE
 *   after the user completes onboarding. Individual
 *   re-request paths (in HomeScreen, PeopleScreen, etc.)
 *   stay as-is — they handle the case where a user first
 *   denied and now wants in.
 *
 * Contract:
 *   - `requestOnboardingPermissions()` is idempotent and
 *     cheap to call — if a permission is already granted
 *     or denied, it returns the current state without
 *     re-prompting.
 *   - The sequence is Location → Notifications → ATT with
 *     a small delay between prompts so iOS doesn't stack
 *     them visually.
 *   - ATT is iOS-only. On Android it returns
 *     `status: 'not-applicable'`.
 *   - Returns a summary of outcomes for analytics.
 *
 * Outcomes do NOT gate app functionality. A user who denies
 * all 3 still gets a working app (no map dot, no push, no
 * cross-app tracking — degraded but functional).
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

/* ─── Public types ─── */

export type PermissionKey = 'location' | 'notifications' | 'tracking';
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'not-applicable';

export interface PermissionOutcome {
  key: PermissionKey;
  state: PermissionState;
}

/* ─── Small helper: wait between prompts ─── */
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/* ─── Location (works cross-platform) ─── */
async function requestLocation(): Promise<PermissionOutcome> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      key: 'location',
      state: status === 'granted' ? 'granted'
           : status === 'denied'  ? 'denied'
                                  : 'undetermined',
    };
  } catch (err) {
    console.warn('[permissions] location request failed:', err);
    return { key: 'location', state: 'undetermined' };
  }
}

/* ─── Notifications (works cross-platform) ─── */
async function requestNotifications(): Promise<PermissionOutcome> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return {
      key: 'notifications',
      state: status === 'granted' ? 'granted'
           : status === 'denied'  ? 'denied'
                                  : 'undetermined',
    };
  } catch (err) {
    console.warn('[permissions] notifications request failed:', err);
    return { key: 'notifications', state: 'undetermined' };
  }
}

/* ─── App Tracking Transparency (iOS 14.5+ only) ─────
 *
 * Dynamically imported so the app still compiles + runs
 * cleanly before `expo-tracking-transparency` is installed.
 * Once Barak runs `npx expo install expo-tracking-transparency`,
 * the import succeeds and the ATT prompt actually fires.
 *
 * Until then: returns 'not-applicable' silently. No crash, no
 * missing-dep error. */
async function requestTracking(): Promise<PermissionOutcome> {
  if (Platform.OS !== 'ios') {
    return { key: 'tracking', state: 'not-applicable' };
  }
  try {
    const mod = await import('expo-tracking-transparency');
    const { status } = await mod.requestTrackingPermissionsAsync();
    return {
      key: 'tracking',
      state: status === 'granted' ? 'granted'
           : status === 'denied'  ? 'denied'
                                  : 'undetermined',
    };
  } catch (err) {
    // Most common cause: package not installed yet. Log once
    // and treat as "skip" — we'll re-try next cold launch.
    console.warn('[permissions] tracking module unavailable (expected before `expo install` has been run):', err);
    return { key: 'tracking', state: 'not-applicable' };
  }
}

/* ─── The orchestrator ─── */

/**
 * Fire all onboarding permissions in sequence. Call this ONCE
 * after `handleOnboardingComplete` — not on every app open.
 *
 * Returns an array of outcomes so the caller can log analytics
 * ("how many users grant location?") or soft-nudge the user
 * in-UI if something critical was denied.
 */
export async function requestOnboardingPermissions(): Promise<PermissionOutcome[]> {
  const outcomes: PermissionOutcome[] = [];

  // 1. Location — the most core permission, ask first while
  //    the user's attention is fresh.
  outcomes.push(await requestLocation());

  // Small beat so the next system prompt doesn't feel
  // stacked (iOS queues them and they can look jarring).
  await wait(400);

  // 2. Notifications — useful but not map-critical.
  outcomes.push(await requestNotifications());

  await wait(400);

  // 3. ATT — last, least intuitive. iOS-only.
  outcomes.push(await requestTracking());

  return outcomes;
}
