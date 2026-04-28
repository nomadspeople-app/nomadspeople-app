/**
 * updates — OTA (Over-The-Air) update check helper.
 *
 * WHY THIS EXISTS
 * ────────────────
 *
 * Before this file, the only way to push a bugfix after
 * launch was `eas build` → `eas submit` → wait for Apple
 * review (1–3 days). That's unacceptable for a live social
 * product: one bad TimerBubble crash and 100 users are stuck
 * for a week.
 *
 * `expo-updates` lets us push JS/asset changes via
 * `eas update --branch production` — users get the fix on
 * their next app open, typically within 5 minutes of push.
 * Native changes still require a rebuild, but ~99% of our
 * iterating is JS.
 *
 * HOW IT WORKS
 * ────────────
 *
 * On each cold launch of the app, we silently ask Expo's
 * update server: "is there a newer JS bundle for this
 * channel and runtime version?" If yes, we download it in
 * the background. We do NOT force-reload — the user is
 * mid-session. On their next cold launch, the new bundle
 * loads automatically.
 *
 * SAFE FALLBACK
 * ─────────────
 *
 * Exactly like expo-image and expo-tracking-transparency,
 * we dynamic-import expo-updates inside a try/catch. If the
 * package isn't installed (pre-`expo install` state), the
 * check is a silent no-op. Once installed + configured, the
 * check activates automatically on the next build.
 *
 * The dev build and Expo Go NEVER apply OTA updates (by
 * design — Updates.isEnabled is false in those contexts).
 * Only production / preview builds receive them.
 */

export interface UpdateCheckOutcome {
  /** 'skipped'     — expo-updates not installed, or dev/Go. */
  /** 'no-update'   — checked, server said no newer bundle.  */
  /** 'downloaded'  — new bundle fetched, will apply on next cold launch. */
  /** 'error'       — network or server error; silent retry on next launch. */
  state: 'skipped' | 'no-update' | 'downloaded' | 'error';
  error?: string;
}

/** Fire-and-forget. Call this ONCE on app cold launch after
 *  auth resolves. Do NOT call on every navigation — the
 *  server-side check is rate-limited by Expo.
 *
 *  Behavior change 2026-04-29 morning: when an update is
 *  available we now FETCH AND APPLY it inside the same cold
 *  launch — `reloadAsync()` reboots the JS bundle with the
 *  new code BEFORE the user reaches the home screen. The
 *  brief reload flash is invisible (mostly indistinguishable
 *  from normal app boot), and it eliminates the "first
 *  launch shows old bug, second launch shows fix" gap.
 *
 *  Why this matters: testers who install the app from Play
 *  Store get the v14-bundled JS on first run. If a critical
 *  visual fix shipped via OTA after that build (e.g., the
 *  Pixel/Samsung broken-bubble fix from 2026-04-29), the
 *  PREVIOUS implementation made them see the broken behavior
 *  for an entire session before the next cold launch picked
 *  up the new bundle. That gave new users a permanently bad
 *  first impression. Auto-reloading on download closes that
 *  gap to ~3 seconds.
 *
 *  Cost: a one-time ~3 s pause on the very first launch
 *  after install (or after we ship a new OTA), during which
 *  the JS bundle is downloaded and the app reloads. On every
 *  subsequent launch where there's no update, the check
 *  returns instantly.
 *
 *  This is JS-only — `Updates.fetchUpdateAsync()` and
 *  `Updates.reloadAsync()` are part of the existing
 *  expo-updates native module that's already in v14 AAB. No
 *  Rule Minus-One impact, no new build needed. */
export async function checkForOtaUpdate(): Promise<UpdateCheckOutcome> {
  try {
    const Updates = await import('expo-updates');

    // Updates.isEnabled is false in dev-client / Expo Go /
    // simulator without EAS config. We respect that signal
    // so dev builds don't try to update themselves.
    if (!Updates.isEnabled) {
      return { state: 'skipped' };
    }

    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      return { state: 'no-update' };
    }

    // Download the new bundle and apply IMMEDIATELY by
    // reloading the JS context. Safe to call from cold-launch
    // because the user hasn't interacted yet — the reload
    // looks like the tail end of normal startup. Anything
    // that needed to survive a reload (auth tokens) is in
    // AsyncStorage and the new bundle re-reads it on boot.
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    // reloadAsync() doesn't actually return — the JS context
    // is replaced. The line below is a defensive return for
    // the unreachable code path where reload silently fails.
    return { state: 'downloaded' };
  } catch (err: any) {
    // Most common cause pre-launch: `expo-updates` not
    // installed yet. Also: offline, Expo CDN blip. Any of
    // these → silent no-op; try again on the next launch.
    return { state: 'error', error: err?.message || String(err) };
  }
}

/** Force-apply a previously-downloaded update immediately.
 *
 *  Call this ONLY when the user has a clear moment to
 *  accept a reload (e.g., after they tap "restart to
 *  update" in a settings banner). Never call silently —
 *  mid-session reload is a jarring UX.
 *
 *  Safe if expo-updates isn't installed: returns without
 *  error. */
export async function applyPendingUpdate(): Promise<void> {
  try {
    const Updates = await import('expo-updates');
    if (!Updates.isEnabled) return;
    await Updates.reloadAsync();
  } catch {
    // Silent — no pending update or not available.
  }
}
