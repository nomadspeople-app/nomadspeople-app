/**
 * nomadspeople — Push Notification Service
 *
 * Handles:
 * - Permission requests (iOS/Android)
 * - Expo push token registration
 * - Token storage in Supabase (app_profiles.push_token)
 * - Foreground notification display
 * - Notification tap → deep link routing
 * - Local notification channels (Android)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { isWithinRadius } from './distance';

/* ─── Types ─── */
export type NotificationType =
  | 'chat_message'        // Someone sent you a message
  | 'activity_nearby'     // New activity posted near you
  | 'activity_joined'     // Someone joined your activity
  | 'area_heating'        // Area is getting busy
  | 'profile_view'        // Someone viewed your profile
  | 'dna_match'           // New DNA match found
  | 'flight_incoming'     // Someone is flying to your city
  | 'follow_new'          // Someone followed you
  | 'timer_expiring'      // Your timer is about to expire
  | 'activity_reminder';  // Reminder for upcoming activity

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    screen?: string;          // Target screen name
    conversationId?: string;  // For chat deep links
    userId?: string;          // For profile deep links
    checkinId?: string;       // For activity deep links
    [key: string]: any;
  };
}

/* ─── User notification preferences (set by setUserNotificationPrefs) ─── */
let _userPrefs: UserNotificationPrefs = {};

export interface UserNotificationPrefs {
  notify_nearby?: boolean;
  notify_heating?: boolean;
  notify_profile_view?: boolean;
  notify_chat?: boolean;
  notify_activity_joined?: boolean;
  notify_dna_match?: boolean;
  notify_flight_incoming?: boolean;
  /** The user's visibility toggle — doubles as the notification
   *  quiet switch. When false, non-essential notifications are
   *  suppressed (chat + timer_expiring still pass through). This
   *  replaces the old `snooze_mode` field per CLAUDE.md Rule Zero:
   *  one source of truth, not two. */
  show_on_map?: boolean;
  /** Max distance (km) for location-based notifications. 0 = no limit */
  notification_distance_km?: number;
  /** User's current latitude (updated on app open / location change) */
  user_lat?: number | null;
  /** User's current longitude */
  user_lng?: number | null;
}

/** Call this from App.tsx whenever profile loads/changes */
export function setUserNotificationPrefs(prefs: UserNotificationPrefs) {
  _userPrefs = prefs;
}

/** Get current prefs (used to preserve location when syncing from Settings) */
export function getUserNotificationPrefs(): UserNotificationPrefs {
  return _userPrefs;
}

/* ─── Check if notification type is allowed by user preferences ─── */
function isNotificationAllowed(type?: NotificationType, notifData?: any): boolean {
  // If the user is hidden from the map (show_on_map === false)
  // they've told the whole app "I'm off the grid right now" —
  // mute everything except chat messages and timer expirations.
  // Those two are the "essentials" they still want to see.
  if (_userPrefs.show_on_map === false && type !== 'chat_message' && type !== 'timer_expiring') {
    return false;
  }
  switch (type) {
    case 'activity_nearby':   return _userPrefs.notify_nearby !== false;
    case 'area_heating':      return _userPrefs.notify_heating !== false;
    case 'profile_view':      return _userPrefs.notify_profile_view !== false;
    case 'chat_message':      return _userPrefs.notify_chat !== false;
    case 'activity_joined':   return _userPrefs.notify_activity_joined !== false;
    case 'dna_match':         return _userPrefs.notify_dna_match !== false;
    case 'flight_incoming':   return _userPrefs.notify_flight_incoming !== false;
    default:                  return true; // follow_new, timer_expiring, etc. always allowed
  }
}

/* ─── Check if a location-based notification is within the user's distance threshold ─── */
function isWithinNotificationDistance(notifData?: any): boolean {
  const maxKm = _userPrefs.notification_distance_km;
  // 0 or undefined = no limit
  if (!maxKm || maxKm <= 0) return true;
  // Need user location + notification location
  const uLat = _userPrefs.user_lat;
  const uLng = _userPrefs.user_lng;
  const nLat = notifData?.latitude ?? notifData?.lat;
  const nLng = notifData?.longitude ?? notifData?.lng;
  if (uLat == null || uLng == null || nLat == null || nLng == null) return true; // can't check → allow
  return isWithinRadius(uLat, uLng, nLat, nLng, maxKm);
}

/* ─── Configure foreground behavior ─── */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as NotificationPayload['data'] & { type?: NotificationType };
    const type = data?.type as NotificationType | undefined;

    // Respect user notification preferences
    if (!isNotificationAllowed(type, data)) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // For location-based notifications, check distance threshold
    const locationTypes: NotificationType[] = ['activity_nearby', 'area_heating'];
    if (type && locationTypes.includes(type) && !isWithinNotificationDistance(data)) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/* ─── Android notification channels ─── */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Main channels — each maps to a notification category
  const channels = [
    { id: 'messages', name: 'Messages', description: 'Chat messages and DMs', importance: Notifications.AndroidImportance.HIGH },
    { id: 'activities', name: 'Activities', description: 'Nearby activities and events', importance: Notifications.AndroidImportance.DEFAULT },
    { id: 'social', name: 'Social', description: 'Follows, profile views, DNA matches', importance: Notifications.AndroidImportance.DEFAULT },
    { id: 'reminders', name: 'Reminders', description: 'Timer and activity reminders', importance: Notifications.AndroidImportance.HIGH },
    { id: 'default', name: 'General', description: 'General notifications', importance: Notifications.AndroidImportance.DEFAULT },
  ];

  for (const ch of channels) {
    await Notifications.setNotificationChannelAsync(ch.id, {
      name: ch.name,
      description: ch.description,
      importance: ch.importance,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8614D',
      sound: 'default',
    });
  }
}

/* ─── Get the Android channel for a notification type ─── */
export function getChannelForType(type: NotificationType): string {
  switch (type) {
    case 'chat_message':
      return 'messages';
    case 'activity_nearby':
    case 'activity_joined':
    case 'area_heating':
      return 'activities';
    case 'profile_view':
    case 'dna_match':
    case 'flight_incoming':
    case 'follow_new':
      return 'social';
    case 'timer_expiring':
    case 'activity_reminder':
      return 'reminders';
    default:
      return 'default';
  }
}

/* ─── Request permission & register push token ─────────────
 *
 * Self-healing registration. Called on every cold start (and on
 * app focus) so that any prior failure — denied permission later
 * granted, token-fetch timeout, transient DB error — is corrected
 * automatically the next time the app opens.
 *
 * Idempotency contract (called multiple times safely):
 *   1. If permission still not granted → return null. We do NOT
 *      re-prompt every cold start; that would be UX abuse. The
 *      onboarding flow (lib/permissions.ts) is the one allowed to
 *      prompt, and Settings has a manual "Enable notifications"
 *      affordance. Here we passively check and exit.
 *   2. If permission granted → fetch the device's Expo token. The
 *      token can change (OS reinstall, restore from backup) so
 *      we always re-fetch and re-save.
 *   3. UPSERT the token to app_profiles.
 *
 * Pre-fix (2026-04-26): registration only fired once after
 * onboarding completion. If the token call timed out, the .update()
 * was blocked by RLS for any reason, or the user temporarily
 * dismissed the OS prompt before tapping Allow, push_token stayed
 * NULL FOREVER. Tester DB confirmed: shospeople + reviewer had
 * NULL tokens despite completing onboarding multiple days ago.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Must be a physical device
  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device for push notifications');
    return null;
  }

  // Check existing permissions WITHOUT prompting. If the user has
  // never granted (or has revoked), exit silently — re-prompting
  // every app open trains the user to swat away our permission
  // dialogs. The Settings screen has an explicit "Enable" CTA for
  // recovery. The onboarding flow is the only place that prompts.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    console.log('[Notifications] Permission not granted (status:', status, ')');
    return null;
  }

  // Setup Android channels (idempotent — safe to call every launch)
  await setupNotificationChannels();

  // Get Expo push token. Re-fetched every launch on purpose: tokens
  // can rotate (app reinstall, OS restore from backup, FCM cleanup).
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      'f7b98f05-2cda-4e34-8ea2-b1782649d5e3';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    if (!token) {
      console.warn('[Notifications] getExpoPushTokenAsync returned empty token');
      return null;
    }
    console.log('[Notifications] Push token:', token);

    // UPSERT to Supabase. If this fails, log + return null so the
    // caller can retry on the next launch — the in-memory `token`
    // would be useless without a DB row pointing at it.
    const saved = await savePushToken(userId, token);
    return saved ? token : null;
  } catch (error) {
    console.error('[Notifications] Error getting push token:', error);
    return null;
  }
}

/* ─── Save push token to DB ─────────────────────────────
 *
 * UPSERT (not UPDATE) per the same `logic` skill rule we applied
 * to profile saves on 2026-04-26: if the app_profiles row is
 * missing for any reason — fresh signup race, ghost row deleted
 * by an admin, etc. — UPDATE silently no-ops and the token is
 * lost forever. Tester report 2026-04-26: shospeople and reviewer
 * had push_token=NULL in DB despite completing onboarding (which
 * fires the registration). UPSERT closes the loop end-to-end.
 *
 * Returns success boolean so the caller can decide whether to
 * retry on next app open.
 */
async function savePushToken(userId: string, token: string): Promise<boolean> {
  const { error } = await supabase
    .from('app_profiles')
    .upsert(
      {
        user_id: userId,
        push_token: token,
        push_token_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[Notifications] Error saving push token:', error.message);
    return false;
  }
  console.log('[Notifications] Push token saved to DB');
  return true;
}

/* ─── Remove push token (logout / disable) ─── */
export async function unregisterPushToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from('app_profiles')
    .update({ push_token: null, push_token_updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[Notifications] Error removing push token:', error.message);
  }
}

/* ─── Schedule a local notification (e.g. timer reminder) ─── */
export async function scheduleLocalNotification(
  payload: NotificationPayload,
  trigger: Notifications.NotificationTriggerInput,
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, ...payload.data },
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: getChannelForType(payload.type) } : {}),
    },
    trigger,
  });
}

/* ─── Cancel a scheduled notification ─── */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/* ─── Cancel all scheduled notifications ─── */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/* ─── Get badge count ─── */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/* ─── Set badge count ─── */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/* ─── Clear all delivered notifications ─── */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}

/* ─── Notification listeners (used in App.tsx) ─── */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/* ─── Parse a notification response into navigation params ─── */
export function parseNotificationNavigation(
  response: Notifications.NotificationResponse,
): { screen: string; params: Record<string, any> } | null {
  const data = response.notification.request.content.data as any;
  if (!data?.type) return null;

  switch (data.type as NotificationType) {
    case 'chat_message':
      if (data.conversationId) {
        return {
          screen: 'Chat',
          params: {
            conversationId: data.conversationId,
            title: data.senderName || 'Chat',
          },
        };
      }
      return { screen: 'MainTabs', params: { screen: 'Pulse' } };

    case 'activity_nearby':
    case 'activity_joined':
    case 'area_heating':
      return { screen: 'MainTabs', params: { screen: 'Home' } };

    case 'profile_view':
    case 'follow_new':
      if (data.userId) {
        return {
          screen: 'UserProfile',
          params: { userId: data.userId, name: data.userName },
        };
      }
      return { screen: 'MainTabs', params: { screen: 'Profile' } };

    case 'dna_match':
    case 'flight_incoming':
      if (data.userId) {
        return {
          screen: 'UserProfile',
          params: { userId: data.userId, name: data.userName },
        };
      }
      return { screen: 'MainTabs', params: { screen: 'People' } };

    case 'timer_expiring':
    case 'activity_reminder':
      return { screen: 'MainTabs', params: { screen: 'Home' } };

    default:
      return null;
  }
}
