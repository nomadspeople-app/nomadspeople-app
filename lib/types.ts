/* ─── Database row types for Supabase ─── */

export interface VisitedPlace {
  city: string;
  country: string;
  lat: number;
  lng: number;
  year?: number;
}

export interface AppProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  username_changed_at: string | null;
  avatar_url: string | null;
  bio: string | null;
  job_type: string | null;
  home_country: string | null;
  current_city: string | null;
  next_destination: string | null;
  interests: string[] | null;
  looking_for: string[] | null;
  languages: string[] | null;
  show_on_map: boolean;
  onboarding_done: boolean;
  creator_tag: boolean;
  is_premium: boolean;
  website_url: string | null;
  birth_date: string | null;
  age_verified: boolean;
  instagram_handle: string | null;
  featured_tags: string[];
  travel_style: string | null;
  visited_places: VisitedPlace[] | null;
  next_destination_date: string | null;
  skills: string[] | null;
  open_to_work: boolean;
  portfolio_url: string | null;
  visibility: 'public' | 'city_only' | 'invisible';
  app_language: string;
  distance_unit: string;
  dark_mode: boolean;
  notify_nearby: boolean;
  notify_heating: boolean;
  notification_distance_km: number;
  notify_profile_view: boolean;
  notify_chat: boolean;
  notify_activity_joined: boolean;
  notify_dna_match: boolean;
  notify_flight_incoming: boolean;
  notify_follow: boolean;
  notify_timer: boolean;
  push_token: string | null;
  push_token_updated_at: string | null;
  /** @deprecated Stage 9 — the client no longer reads or writes
   *  this column. `show_on_map === false` is the one truth for
   *  "user is snoozed / hidden." The column still exists in the
   *  DB for historical data; a DROP COLUMN migration is tracked
   *  as a follow-up. */
  snooze_mode?: boolean;
  age_min: number;
  age_max: number;
  created_at: string;
  last_active_at: string;
}

export interface AppCheckin {
  id: string;
  user_id: string;
  city: string;
  neighborhood: string | null;
  /** ISO 3166-1 alpha-2 country code (uppercase) where this checkin
   *  was posted. Set at publish time by HomeScreen.publishCheckin via
   *  pinCountryFromCoords. Consumed by all three geo gates (publish,
   *  list blur, join button). Null for legacy pre-gate rows — callers
   *  fail-open on null per the geo spec (docs/product-decisions/
   *  2026-04-20-geo-boundaries-spec.md). */
  country: string | null;
  checkin_type: 'status' | 'timer';
  status_text: string | null;
  status_emoji: string | null;
  visibility: 'public' | 'city_only' | 'invisible';
  checked_in_at: string;
  expires_at: string;
  is_active: boolean;
  /* ─── Activity fields (status v2) ─── */
  category: string | null;
  activity_text: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  scheduled_for: string | null;
  is_flexible_time: boolean;
  is_open: boolean;
  member_count: number;
}

export interface AppEvent {
  id: string;
  creator_id: string;
  city: string;
  neighborhood: string | null;
  name: string;
  description: string | null;
  category: 'work' | 'cafe' | 'night' | 'out' | 'meetup' | 'other';
  event_date: string | null;
  event_time: string | null;
  location_name: string | null;
  is_free: boolean;
  price: string | null;
  max_members: number | null;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

export interface AppEventMember {
  event_id: string;
  user_id: string;
  joined_at: string;
}

export interface AppFollow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface AppConversation {
  id: string;
  user_a: string | null;
  user_b: string | null;
  type: 'dm' | 'group';
  name: string | null;
  event_id: string | null;
  created_by: string | null;
  emoji: string | null;
  category: string | null;
  activity_text: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_general_area: boolean;
  scheduled_for: string | null;
  is_open: boolean;
  is_locked: boolean;
  checkin_id: string | null;
  created_at: string;
  last_message_at: string;
}

export interface AppConversationMember {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: 'active' | 'request' | 'declined';
  joined_at: string;
}

export interface AppMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url: string | null;
  reply_to_id: string | null;
  sent_at: string;
  read_at: string | null;
  deleted_at: string | null;
}

export interface AppMessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface AppPost {
  id: string;
  user_id: string;
  type: 'status' | 'looking_for' | 'opportunity' | 'question' | 'checkin';
  content: string;
  city: string | null;
  image_url: string | null;
  tags: string[] | null;
  likes_count: number;
  created_at: string;
  is_deleted: boolean;
}

export interface AppPostLike {
  post_id: string;
  user_id: string;
}

export interface AppComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface AppSubscription {
  id: string;
  user_id: string;
  plan: 'free' | 'premium' | 'creator';
  started_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  color: string | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  read_at: string | null;
}

/* ─── Navigation types ─── */
export type RootTabParamList = {
  Home: { newActivity?: { text: string; emoji: string; category: string } } | undefined;
  People: undefined;
  Pulse: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Onboarding: undefined;
  Chat: { conversationId: string; title: string; avatarColor?: string; avatarText?: string; isGroup?: boolean };
  GroupInfo: { conversationId: string };
  UserProfile: { userId: string; name?: string };
  PhotoViewer: { posts: any[]; startIndex: number; authorName: string; profileUserId: string };
  Settings: undefined;
  PostFeed: { postIndex?: number };
  Notifications: undefined;
  Legal: { type: 'terms' | 'privacy' | 'guidelines' | 'safety' };
  FlightDetail: { flightGroupId: string };
};

/* ─── Vibe categories ─── */
export const VIBE_CATEGORIES = ['All', 'Work', 'Cafe', 'Night', 'Out'] as const;
export type VibeCategory = (typeof VIBE_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  work:   '#6B7280',
  cafe:   '#6B7280',
  night:  '#6B7280',
  out:    '#6B7280',
  meetup: '#6B7280',
  other:  '#6B7280',
};

/* ─── Reaction emojis ─── */
export const REACTION_EMOJIS = ['❤️', '👍', '🔥', '😂', '🙌', '👀'] as const;
