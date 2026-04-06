/**
 * tracking.ts — The brain's data collector.
 *
 * Tracks every meaningful user action into `user_activity` table.
 * Also handles profile view tracking via `app_profile_views`.
 *
 * Usage:
 *   import { trackEvent, trackProfileView } from '../lib/tracking';
 *   trackEvent(userId, 'view_checkin', 'checkin', checkinId, { city: 'Bangkok' });
 *   trackProfileView(viewerId, viewedUserId);
 */
import { supabase } from './supabase';

// ── Event types we track ──
export type TrackAction =
  | 'view_profile'        // Opened someone's profile
  | 'view_checkin'        // Tapped on a checkin/activity card
  | 'join_group'          // Joined a group activity
  | 'leave_group'         // Left a group activity
  | 'send_message'        // Sent a chat message
  | 'create_status'       // Published a status
  | 'create_timer'        // Started a timer
  | 'follow_user'         // Followed someone
  | 'unfollow_user'       // Unfollowed someone
  | 'like_post'           // Liked a post
  | 'unlike_post'         // Unliked a post
  | 'search_city'         // Searched/switched city
  | 'tap_map_pin'         // Tapped a pin on the map
  | 'open_chat'           // Opened a conversation
  | 'block_user'          // Blocked someone
  | 'share_profile'       // Shared a profile
  | 'add_travel_place'    // Added a place to flight strip
  | 'update_profile'      // Updated own profile
  | 'create_event'        // Created an event
  | 'join_event'          // Joined an event
  | 'app_open'            // Opened the app
  | 'onboarding_complete'; // Completed onboarding

export type EntityType =
  | 'profile'
  | 'checkin'
  | 'conversation'
  | 'message'
  | 'post'
  | 'event'
  | 'city'
  | 'app';

/**
 * Fire-and-forget event tracking.
 * Never throws — silently logs errors so it never breaks the app.
 */
export function trackEvent(
  userId: string | null | undefined,
  action: TrackAction,
  entityType: EntityType,
  entityId?: string | null,
  metadata?: Record<string, any>,
): void {
  if (!userId) return;

  // Fire and forget — don't await, don't block UI
  supabase
    .from('user_activity')
    .insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      metadata: metadata || null,
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) {
        console.warn('[Tracking] Failed to track event:', action, error.message);
      }
    });
}

/**
 * Track profile view — writes to dedicated `app_profile_views` table.
 * Debounced: won't re-track the same viewer→viewed pair within 5 minutes.
 */
const _recentViews = new Map<string, number>(); // key: `viewerId:viewedId`, value: timestamp
const VIEW_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

export function trackProfileView(
  viewerId: string | null | undefined,
  viewedUserId: string | null | undefined,
): void {
  if (!viewerId || !viewedUserId) return;
  if (viewerId === viewedUserId) return; // Don't track self-views

  const key = `${viewerId}:${viewedUserId}`;
  const now = Date.now();
  const lastView = _recentViews.get(key);

  if (lastView && now - lastView < VIEW_DEBOUNCE_MS) return; // Too recent
  _recentViews.set(key, now);

  // Clean old entries periodically (prevent memory leak)
  if (_recentViews.size > 200) {
    const cutoff = now - VIEW_DEBOUNCE_MS;
    for (const [k, v] of _recentViews) {
      if (v < cutoff) _recentViews.delete(k);
    }
  }

  // Insert profile view
  supabase
    .from('app_profile_views')
    .insert({
      viewer_id: viewerId,
      viewed_id: viewedUserId,
    })
    .then(({ error }) => {
      if (error) {
        console.warn('[Tracking] Failed to track profile view:', error.message);
      }
    });

  // Also track as general event
  trackEvent(viewerId, 'view_profile', 'profile', viewedUserId);
}

/**
 * Get match score between current user and another user.
 * Calls the Postgres `calculate_match_score` function.
 */
export async function getMatchScore(
  myUserId: string,
  otherUserId: string,
): Promise<{ score: number; pct: number; breakdown: Record<string, any> } | null> {
  const { data, error } = await supabase.rpc('calculate_match_score', {
    user_a_id: myUserId,
    user_b_id: otherUserId,
  });

  if (error) {
    console.warn('[Matching] Failed to get match score:', error.message);
    return null;
  }

  return data ? { score: data.score, pct: data.pct, breakdown: data.breakdown } : null;
}

/**
 * Get recommended users for the current user.
 * Calls the Postgres `get_recommended_users` function.
 */
export async function getRecommendedUsers(
  userId: string,
  city?: string | null,
  limit: number = 20,
): Promise<Array<{
  user_id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  current_city: string | null;
  job_type: string | null;
  bio: string | null;
  match_score: number;
  match_pct: number;
  match_breakdown: Record<string, any>;
}>> {
  const { data, error } = await supabase.rpc('get_recommended_users', {
    for_user_id: userId,
    city_filter: city || null,
    result_limit: limit,
  });

  if (error) {
    console.warn('[Matching] Failed to get recommendations:', error.message);
    return [];
  }

  return data || [];
}
