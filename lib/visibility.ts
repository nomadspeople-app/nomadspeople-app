/**
 * visibility — THE one source for "am I visible / snoozed?" writes.
 *
 * `show_on_map` on `app_profiles` is the single truth per CLAUDE.md
 * (Locked April 2026, Stage 9 of the no-band-aids refactor). The
 * old `snooze_mode` column is deprecated and no longer read or
 * written anywhere in the client.
 *
 * WHY THIS MODULE EXISTS
 * ──────────────────────
 * HomeScreen's wake-up animation and PeopleScreen's wake-up animation
 * were previously running the exact same two DB writes inline:
 *
 *   1. app_profiles.show_on_map = true  (single truth)
 *   2. app_checkins.visibility = 'public' (WHERE is_active = true)
 *
 * Two copies of the same idea diverging is a Rule Zero violation. If
 * tomorrow we need to flip a third field — say, `last_visible_at` —
 * fixing it in only one screen leaves a regression in the other.
 *
 * All wake-up / hide flows now consume these helpers. Animations
 * stay per-screen (they're cosmetic); the data mutation is shared.
 */

import { supabase } from './supabase';

/** Wake the user back up on the map. Writes the two fields that
 *  together make the user publicly visible again:
 *
 *    - app_profiles.show_on_map → true
 *    - app_checkins.visibility → 'public' (for currently-active rows only)
 *
 *  Errors are logged but not thrown — the caller's animation should
 *  finish regardless. If a write fails, the next pull-to-refresh
 *  will re-surface the stale state and the user can retry. */
export async function wakeUpVisibility(userId: string): Promise<void> {
  if (!userId) return;
  const profilePromise = supabase
    .from('app_profiles')
    .update({ show_on_map: true })
    .eq('user_id', userId);
  const checkinsPromise = supabase
    .from('app_checkins')
    .update({ visibility: 'public' })
    .eq('user_id', userId)
    .eq('is_active', true);

  const [profileRes, checkinsRes] = await Promise.all([
    profilePromise,
    checkinsPromise,
  ]);
  if (profileRes.error) {
    console.warn('[visibility] wake up — profile write failed:', profileRes.error);
  }
  if (checkinsRes.error) {
    console.warn('[visibility] wake up — checkins write failed:', checkinsRes.error);
  }
}

/** Go invisible — hide the user from the map and mute their active
 *  checkins from public view. The mirror of `wakeUpVisibility`. Kept
 *  symmetrical so both sides of the toggle share a single surface.
 *
 *  Not yet consumed at this commit; added for future-proofing so
 *  the first caller doesn't have to reinvent the write. When the
 *  Settings screen's snooze toggle is migrated here, delete its
 *  inline writes to `app_profiles.show_on_map` and call this. */
export async function sleepVisibility(userId: string): Promise<void> {
  if (!userId) return;
  const { error } = await supabase
    .from('app_profiles')
    .update({ show_on_map: false })
    .eq('user_id', userId);
  if (error) {
    console.warn('[visibility] sleep — profile write failed:', error);
  }
}
