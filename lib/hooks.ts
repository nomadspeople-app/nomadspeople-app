import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { trackEvent } from './tracking';

/* ─── Unique ID generator for Realtime channels ─── */
let _chId = 0;
const nextChannelId = () => `${++_chId}-${Date.now()}`;
import type {
  AppProfile, AppCheckin, AppEvent, AppConversation,
  AppMessage, AppFollow, AppPost, AppComment,
} from './types';

/* ═══════════════════════════════════════════
   HOME — active checkins + profiles
   ═══════════════════════════════════════════ */

export interface CheckinWithProfile extends AppCheckin {
  profile: Pick<AppProfile, 'full_name' | 'username' | 'avatar_url' | 'job_type' | 'bio' | 'interests'>;
}

/** Calculate age from a date string */
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

const ZODIAC_SIGNS: [number, number, string, string][] = [
  [1, 20, '♑', 'capricorn'], [2, 19, '♒', 'aquarius'], [3, 20, '♓', 'pisces'],
  [4, 20, '♈', 'aries'], [5, 21, '♉', 'taurus'], [6, 21, '♊', 'gemini'],
  [7, 22, '♋', 'cancer'], [8, 23, '♌', 'leo'], [9, 23, '♍', 'virgo'],
  [10, 23, '♎', 'libra'], [11, 22, '♏', 'scorpio'], [12, 22, '♐', 'sagittarius'],
  [12, 31, '♑', 'capricorn'],
];

export function getZodiac(birthDate: string | null | undefined): { symbol: string; name: string } | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  for (const [m, cutoff, symbol, name] of ZODIAC_SIGNS) {
    if (month === m && day <= cutoff) return { symbol, name };
  }
  // fallback for edge (e.g. Jan 21+ is Aquarius, caught by month=2,day<=19 won't work)
  // Re-check: the list is ordered so we find first match
  return { symbol: '♑', name: 'capricorn' };
}

/* Cached viewer age + age prefs — avoids extra DB query on every city switch */
let _cachedViewer: { userId: string; age: number | null; ageMin: number; ageMax: number } | null = null;

/** Call after the user changes their age-range preferences so the map refreshes */
export function bustViewerAgeCache() { _cachedViewer = null; }

export function useActiveCheckins(city: string, viewerUserId?: string | null) {
  const [checkins, setCheckins] = useState<CheckinWithProfile[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const prevIdsRef = useRef<string>('');

  const fetch = async () => {
    // 1. Get viewer age + age preferences (cached — only fetches once per user)
    let viewerAge: number | null = null;
    let viewerAgeMin = 18;
    let viewerAgeMax = 100;
    if (viewerUserId) {
      if (_cachedViewer && _cachedViewer.userId === viewerUserId) {
        viewerAge = _cachedViewer.age;
        viewerAgeMin = _cachedViewer.ageMin;
        viewerAgeMax = _cachedViewer.ageMax;
      } else {
        const { data: viewerProfile } = await supabase
          .from('app_profiles')
          .select('birth_date, age_min, age_max')
          .eq('user_id', viewerUserId)
          .limit(1)
          .maybeSingle();
        viewerAge = calcAge(viewerProfile?.birth_date);
        viewerAgeMin = viewerProfile?.age_min ?? 18;
        viewerAgeMax = viewerProfile?.age_max ?? 100;
        _cachedViewer = { userId: viewerUserId, age: viewerAge, ageMin: viewerAgeMin, ageMax: viewerAgeMax };
      }
    }

    // 2. Fetch all active checkins (include visibility fields from profile)
    const { data, error } = await supabase
      .from('app_checkins')
      .select('*, profile:app_profiles!user_id(full_name, display_name, username, avatar_url, job_type, bio, interests, show_on_map, snooze_mode, hide_distance, birth_date)')
      .eq('is_active', true)
      .ilike('city', city)
      .in('visibility', ['public', 'city_only'])
      .limit(200);

    if (data) {
      // 3a. Visibility filter. expires_at is now the single source of
      //     truth (set correctly at publish time per lifecycle):
      //       • Immediate status → now + 60 min
      //       • Scheduled specific time → = scheduled_for
      //       • Scheduled flexible → = 23:59:59 of scheduled_for's date
      //     The cron also uses expires_at, so client + cron agree.
      const now = new Date();
      const visible = (data as any[]).filter((c: any) => {
        if (c.profile?.show_on_map === false) return false;
        const expiresTs = c.expires_at ? new Date(c.expires_at).getTime() : null;
        if (expiresTs && expiresTs < now.getTime()) return false;
        return true;
      });

      // 3b. Bidirectional age filter:
      //   A) Viewer's age must be within the checkin creator's desired range
      //   B) Creator's age must be within the viewer's desired range
      const filtered = viewerAge
        ? visible.filter((c: any) => {
            // A — their preference: do they want to see my age?
            const theirMin = c.age_min ?? 18;
            const theirMax = c.age_max ?? 100;
            if (viewerAge! < theirMin || viewerAge! > theirMax) return false;
            // B — my preference: do I want to see their age?
            const creatorAge = calcAge(c.profile?.birth_date);
            if (creatorAge != null) {
              if (creatorAge < viewerAgeMin || creatorAge > viewerAgeMax) return false;
            }
            return true;
          })
        : visible;

      // 3c. Skip state update if same checkins AND same member counts (prevents marker flicker)
      const newFingerprint = filtered.map((c: any) => `${c.id}:${c.member_count ?? 0}`).sort().join(',');
      if (newFingerprint !== prevIdsRef.current) {
        prevIdsRef.current = newFingerprint;
        setCheckins(filtered as unknown as CheckinWithProfile[]);
        setCount(filtered.length);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetch();

    // Polling fallback — ensures freshness even if Realtime is slow
    const pollInterval = setInterval(() => { fetch(); }, 30000); // every 30s (reduced from 10s to ease DB load)

    // Realtime subscription — globally unique channel name
    // NOTE: No city filter — Supabase Realtime `eq` is case-sensitive but our
    // queries use `ilike`. Listening to all checkin changes and re-fetching
    // (which filters by city with ilike) ensures we never miss updates.
    const channelName = `checkins-${nextChannelId()}`;
    console.log(`[Realtime] Subscribing to all checkin changes (channel: ${channelName}, viewing: "${city}")`);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_checkins',
      }, (payload) => {
        // Only refetch if the changed checkin might be relevant to current city
        const changedCity = (payload.new as any)?.city || (payload.old as any)?.city || '';
        if (changedCity.toLowerCase() === city.toLowerCase()) {
          console.log(`[Realtime] ✅ checkin event for ${city}:`, payload.eventType, (payload.new as any)?.id || (payload.old as any)?.id);
          fetch(); // refetch on any change in this city
        }
      })
      .subscribe((status, err) => {
        console.log(`[Realtime] checkins subscription status: ${status}`, err || '');
      });

    return () => {
      clearInterval(pollInterval);
      console.log(`[Realtime] Unsubscribing checkins channel: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [city]);

  // Optimistic add — inject a new checkin into state instantly (before DB roundtrip)
  const addOptimistic = (checkin: CheckinWithProfile) => {
    setCheckins(prev => {
      // Remove any existing checkin from same user + same type to avoid duplicates
      const cleaned = prev.filter(c =>
        !(c.user_id === checkin.user_id && c.checkin_type === checkin.checkin_type)
      );
      return [checkin, ...cleaned];
    });
    setCount(prev => prev + 1);
  };

  return { checkins, count, loading, refetch: fetch, addOptimistic };
}

/* ═══════════════════════════════════════════
   HOT CHECKINS — checkins with recent chat activity
   Returns a Map<checkin_id, recentMsgCount> for pulse animation
   ═══════════════════════════════════════════ */
export function useHotCheckins(city: string) {
  const [hotMap, setHotMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase
        .from('app_conversations')
        .select('checkin_id, last_message_at')
        .not('checkin_id', 'is', null)
        .gte('last_message_at', new Date(Date.now() - 5 * 60000).toISOString());

      if (data && data.length > 0) {
        const map = new Map<string, number>();
        for (const c of data) {
          if (!c.checkin_id) continue;
          // Approximate "heat" by how recent last_message_at is (1-3 scale)
          const ago = (Date.now() - new Date(c.last_message_at).getTime()) / 60000;
          const heat = ago < 1 ? 3 : ago < 3 ? 2 : 1;
          map.set(c.checkin_id, Math.max(map.get(c.checkin_id) || 0, heat));
        }
        setHotMap(map);
      } else {
        setHotMap(new Map());
      }
    };

    poll();
    const iv = setInterval(poll, 15000); // every 15s
    return () => clearInterval(iv);
  }, [city]);

  return hotMap;
}

/* ═══════════════════════════════════════════
   NOMADS IN CITY — profiles with current_city
   ═══════════════════════════════════════════ */
export interface NomadInCity {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  job_type: string | null;
  current_city: string | null;
  home_country: string | null;
}

export function useNomadsInCity(city: string) {
  const [nomads, setNomads] = useState<NomadInCity[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data, error } = await supabase
      .from('app_profiles')
      .select('user_id, full_name, display_name, username, avatar_url, bio, job_type, current_city, home_country, show_on_map')
      .ilike('current_city', city)
      .eq('show_on_map', true)
      .limit(200);

    if (data) {
      setNomads(data as NomadInCity[]);
      setCount(data.length);
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [city]);

  return { nomads, count, loading, refetch: fetch };
}

/* ═══════════════════════════════════════════
   PEOPLE — events + member counts
   ═══════════════════════════════════════════ */

export interface EventWithMembers extends AppEvent {
  member_count: number;
  members: { user_id: string; profile: Pick<AppProfile, 'full_name' | 'display_name' | 'avatar_url'> }[];
}

export function useCityEvents(city: string, creatorId?: string | null) {
  const [events, setEvents] = useState<EventWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    let query = supabase
      .from('app_events')
      .select('*, members:app_event_members(user_id, profile:app_profiles!user_id(full_name, display_name, avatar_url))')
      .eq('city', city)
      .eq('is_active', true)
      .order('event_date', { ascending: true });
    if (creatorId) query = query.eq('creator_id', creatorId);
    const { data } = await query;

    if (data) {
      setEvents(data.map((e: any) => ({
        ...e,
        member_count: e.members?.length ?? 0,
      })) as EventWithMembers[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch();
  }, [city]);

  return { events, loading, refetch: fetch };
}

export function useJoinEvent() {
  const join = async (eventId: string, userId: string) => {
    const { error } = await supabase
      .from('app_event_members')
      .insert({ event_id: eventId, user_id: userId });
    return { error };
  };

  const leave = async (eventId: string, userId: string) => {
    const { error } = await supabase
      .from('app_event_members')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    return { error };
  };

  return { join, leave };
}

/* ═══════════════════════════════════════════
   PULSE — conversations
   ═══════════════════════════════════════════ */

export interface ConversationWithPreview extends AppConversation {
  last_message?: Pick<AppMessage, 'content' | 'sent_at' | 'sender_id'>;
  members: { user_id: string; profile: Pick<AppProfile, 'full_name' | 'display_name' | 'avatar_url'> }[];
  unread_count: number;
  is_expired?: boolean;  // linked checkin expired or inactive
  is_muted?: boolean;    // user muted this conversation
  is_request?: boolean;  // pending DM request (not yet accepted)
}

export function useConversations(userId: string | null) {
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    // 1. Get conversation IDs where user is a member (active or pending)
    const { data: memberData, error: memErr } = await supabase
      .from('app_conversation_members')
      .select('conversation_id, status')
      .eq('user_id', userId)
      .in('status', ['active', 'request']);

    if (memErr) console.warn('[useConversations] member query error:', memErr);

    if (!memberData?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = memberData.map(m => m.conversation_id);
    const pendingSet = new Set(memberData.filter((m: any) => m.status === 'request').map(m => m.conversation_id));

    // 2. Fetch conversations (simple query, no nested joins)
    const { data: convData, error: convErr } = await supabase
      .from('app_conversations')
      .select('*')
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    if (convErr) console.warn('[useConversations] conv query error:', convErr);
    if (!convData) { setLoading(false); return; }

    // 3. Fetch all member rows + profiles separately (avoids fragile nested joins)
    const { data: allMembers } = await supabase
      .from('app_conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds);

    const memberUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
    const { data: profiles } = memberUserIds.length > 0
      ? await supabase.from('app_profiles').select('user_id, full_name, display_name, avatar_url').in('user_id', memberUserIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Attach members with profiles to conversations
    const convWithMembers = convData.map((conv: any) => ({
      ...conv,
      members: (allMembers || [])
        .filter(m => m.conversation_id === conv.id)
        .map(m => ({ user_id: m.user_id, profile: profileMap.get(m.user_id) || null })),
    }));

    // 4. Get user's last_read_at + muted_at + hidden_at for all conversations in one batch
    const { data: memberRows } = await supabase
      .from('app_conversation_members')
      .select('conversation_id, last_read_at, muted_at, hidden_at')
      .eq('user_id', userId)
      .in('conversation_id', convIds);
    const lastReadMap: Record<string, string> = {};
    const mutedSet = new Set<string>();
    const hiddenAtMap: Record<string, string> = {};
    (memberRows || []).forEach((m: any) => {
      if (m.last_read_at) lastReadMap[m.conversation_id] = m.last_read_at;
      if (m.muted_at) mutedSet.add(m.conversation_id);
      if (m.hidden_at) hiddenAtMap[m.conversation_id] = m.hidden_at;
    });

    // 5. Batch fetch: last message + unread count for ALL conversations in ONE query
    const { data: summaryRows } = await supabase.rpc('get_conversations_summary', { p_user_id: userId });
    const summaryMap: Record<string, any> = {};
    (summaryRows || []).forEach((r: any) => { summaryMap[r.conversation_id] = r; });

    // Batch fetch checkins for conversations that have checkin_id
    const checkinIds = convWithMembers.filter((c: any) => c.checkin_id).map((c: any) => c.checkin_id);
    const checkinMap: Record<string, any> = {};
    if (checkinIds.length > 0) {
      const { data: checkinRows } = await supabase
        .from('app_checkins')
        .select('id, is_active, expires_at')
        .in('id', checkinIds);
      (checkinRows || []).forEach((c: any) => { checkinMap[c.id] = c; });
    }

    const withMessages = convWithMembers.map((conv: any) => {
      const summary = summaryMap[conv.id];
      const realMsg = summary?.last_message_content ? {
        content: summary.last_message_content,
        sent_at: summary.last_message_sent_at,
        sender_id: summary.last_message_sender_id,
      } : null;
      const hasRealMessages = !!realMsg;
      const realUnread = Math.max(0, Number(summary?.unread_count ?? 0));

      let isExpired = false;
      if (conv.checkin_id) {
        const checkin = checkinMap[conv.checkin_id];
        if (!checkin) {
          isExpired = true;
        } else {
          isExpired = !checkin.is_active || (checkin.expires_at && new Date(checkin.expires_at) < new Date());
        }
      }

      return {
        ...conv,
        last_message: realMsg ?? null,
        unread_count: realUnread,
        is_expired: isExpired,
        is_muted: mutedSet.has(conv.id),
        is_request: pendingSet.has(conv.id),
        _hasRealMessages: hasRealMessages,
      };
    });

    // Filter: groups always show (user explicitly joined); DMs only if they have real messages
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const filtered = withMessages.filter((c: any) => {
      // Hide-locally: if the user hid this conversation AND no new message
      // has arrived since hidden_at, drop it. A newer message auto-unhides.
      const hiddenAt = hiddenAtMap[c.id];
      if (hiddenAt) {
        const lastAt = c.last_message?.sent_at || c.last_message_at;
        if (!lastAt || new Date(lastAt) <= new Date(hiddenAt)) return false;
        // Newer message arrived — clear hidden_at in the background (fire & forget)
        supabase
          .from('app_conversation_members')
          .update({ hidden_at: null })
          .eq('conversation_id', c.id)
          .eq('user_id', userId)
          .then(() => {}, () => {});
      }
      // DMs: only show if they have real messages
      if (c.type === 'dm') return c._hasRealMessages;
      // Groups: always show, UNLESS expired for more than 7 days
      if (c.type === 'group' && c.is_expired && c.last_message_at < sevenDaysAgo) return false;
      return true;
    });

    setConversations(filtered as ConversationWithPreview[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetch();

    if (!userId) return;

    // Realtime: listen for BOTH new messages AND new memberships
    const chName = `conversations-${nextChannelId()}`;
    const channel = supabase
      .channel(chName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_messages',
      }, (payload) => {
        console.log(`[Realtime] ✅ new message:`, payload.new?.id);
        fetch();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_conversation_members',
      }, (payload) => {
        console.log(`[Realtime] ✅ new membership:`, payload.new);
        fetch();
      })
      .subscribe((status, err) => {
        console.log(`[Realtime] conversations sub: ${status}`, err || '');
      });

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetch]);

  return { conversations, loading, refetch: fetch };
}

/** Mark a conversation as read — updates last_read_at to now */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('app_conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

/** Global unread count — total across all conversations */
export function useUnreadTotal(userId: string | null) {
  const [total, setTotal] = useState(0);

  const fetch = useCallback(async () => {
    if (!userId) { setTotal(0); return; }

    // Single DB function call — replaces N+1 queries
    const { data, error } = await supabase.rpc('get_unread_total', { p_user_id: userId });
    if (!error && data !== null) {
      setTotal(data as number);
    }
  }, [userId]);

  useEffect(() => {
    fetch();

    // Poll every 45 seconds as fallback (Realtime handles instant updates)
    const interval = setInterval(fetch, 45000);

    // Also listen to Realtime for new messages
    if (!userId) return;
    const channel = supabase
      .channel(`unread-total-${nextChannelId()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_messages',
      }, () => {
        fetch();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId, fetch]);

  return { total, refetch: fetch };
}

/** Delete a conversation for the current user — removes their membership */
export async function deleteConversation(conversationId: string, userId: string): Promise<{ error: any }> {
  // Remove user from conversation members
  const { error } = await supabase
    .from('app_conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  return { error };
}

/**
 * Hide a conversation from this user's Messages list WITHOUT changing
 * their membership. The user keeps access to the group, still receives
 * messages, and the row re-appears automatically the moment any new
 * message arrives (cleared in useConversations filter).
 *
 * Pair with unhideConversation() for the Undo toast path.
 */
export async function hideConversation(conversationId: string, userId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('app_conversation_members')
    .update({ hidden_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  return { error };
}

/** Reverse a hide — used by the Undo toast. */
export async function unhideConversation(conversationId: string, userId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('app_conversation_members')
    .update({ hidden_at: null })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  return { error };
}

/** Lock a conversation (creator only) — blocks new messages, keeps history */
export async function lockConversation(conversationId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('app_conversations')
    .update({ is_locked: true })
    .eq('id', conversationId);
  return { error };
}

/* ═══════════════════════════════════════════
   CHAT — messages for a conversation
   ═══════════════════════════════════════════ */

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<(AppMessage & { sender?: Pick<AppProfile, 'full_name' | 'avatar_url'> })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from('app_messages')
      .select('*, sender:app_profiles!sender_id(full_name, display_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('sent_at', { ascending: true });

    if (data) setMessages(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetch();

    const msgChannelName = `messages-${nextChannelId()}`;
    const channel = supabase
      .channel(msgChannelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'app_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        console.log(`[Realtime] ✅ chat message received:`, payload.new?.id);
        setMessages(prev => [...prev, payload.new as any]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.deleted_at) {
          // Remove deleted message from list
          setMessages(prev => prev.filter(m => m.id !== updated.id));
        }
      })
      .subscribe((status, err) => {
        console.log(`[Realtime] chat messages subscription status: ${status}`, err || '');
      });

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const send = async (userId: string, content: string, replyToId?: string, imageUrl?: string) => {
    // Defensive preconditions — surface the REAL reason a send can fail
    // instead of letting it silently no-op further down.
    if (!conversationId) {
      return { error: new Error('No conversation selected. Close this chat and re-open it.') as any };
    }
    if (!userId) {
      return { error: new Error('Not signed in. Please sign in and try again.') as any };
    }

    // Confirm the client actually has an auth session — if we send with
    // sender_id = userId but the session's auth.uid() != userId, RLS
    // silently rejects the INSERT (no row, no error on some SDK paths).
    const { data: sessionData } = await supabase.auth.getSession();
    const authedUserId = sessionData?.session?.user?.id;
    if (!authedUserId) {
      return { error: new Error('Your session expired. Close and re-open the app.') as any };
    }
    if (authedUserId !== userId) {
      console.warn('[send] mismatch — authedUserId:', authedUserId, 'vs caller userId:', userId);
      return { error: new Error('Session user mismatch. Sign out and sign back in.') as any };
    }

    console.log('[send] attempting insert', { conversationId, userId, contentLen: content.length });
    const { error } = await supabase
      .from('app_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      });

    if (error) {
      console.warn('[send] insert failed', error);
      return { error };
    }

    // Bump last_message_at so the chat list re-sorts.
    const { error: updateError } = await supabase
      .from('app_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
    if (updateError) {
      console.warn('[send] last_message_at update failed (message sent OK):', updateError);
    }

    return { error: null };
  };

  return { messages, loading, send, refetch: fetch };
}

/** Delete a message (soft delete). Only sender can delete, within 1 hour. */
export async function deleteMessage(messageId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  // Verify ownership + time window
  const { data: msg } = await supabase
    .from('app_messages')
    .select('sender_id, sent_at')
    .eq('id', messageId)
    .maybeSingle();

  if (!msg) return { success: false, error: 'Message not found' };
  if (msg.sender_id !== userId) return { success: false, error: 'Not your message' };

  const ageMs = Date.now() - new Date(msg.sent_at).getTime();
  const ONE_HOUR = 60 * 60 * 1000;
  if (ageMs > ONE_HOUR) return { success: false, error: 'Delete window expired (1 hour)' };

  const { error } = await supabase
    .from('app_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);

  return error ? { success: false, error: error.message } : { success: true };
}

/** Report a message */
export async function reportMessage(messageId: string, reporterId: string, reason: string = 'inappropriate'): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('app_message_reports')
    .insert({ message_id: messageId, reporter_id: reporterId, reason });
  return { success: !error };
}

/** Report content (user / post / comment) */
export async function reportContent(
  reporterId: string,
  contentType: 'user' | 'post' | 'comment',
  reason: string,
  opts: { reportedUserId?: string; contentId?: string } = {},
): Promise<{ success: boolean }> {
  const { error } = await supabase.from('app_reports').insert({
    reporter_id: reporterId,
    content_type: contentType,
    reason,
    reported_user_id: opts.reportedUserId ?? null,
    content_id: opts.contentId ?? null,
  });
  return { success: !error };
}

/* ═══════════════════════════════════════════
   PROFILE — user profile + stats
   ═══════════════════════════════════════════ */

export interface FollowerPreview {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [stats, setStats] = useState({ events: 0, followers: 0, following: 0 });
  const [followerPreviews, setFollowerPreviews] = useState<FollowerPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    // Profile
    const { data: p } = await supabase
      .from('app_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (p) setProfile(p as unknown as AppProfile);

    // Stats — single DB function call instead of 3 separate queries
    const { data: statsData } = await supabase.rpc('get_profile_stats', { p_user_id: userId });
    const followerTotal = Number(statsData?.[0]?.followers_count ?? 0);

    setStats({
      events: Number(statsData?.[0]?.events_count ?? 0),
      followers: followerTotal,
      following: Number(statsData?.[0]?.following_count ?? 0),
    });

    // Fetch up to 4 follower previews for "Followed by" display
    if (followerTotal > 0) {
      const { data: followerRows } = await supabase
        .from('app_follows')
        .select('follower_id')
        .eq('following_id', userId)
        .limit(4);
      if (followerRows && followerRows.length > 0) {
        const ids = followerRows.map(r => r.follower_id);
        const { data: profiles } = await supabase
          .from('app_profiles')
          .select('user_id, full_name, display_name, avatar_url, username')
          .in('user_id', ids);
        if (profiles) setFollowerPreviews(profiles as FollowerPreview[]);
      }
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, stats, followerPreviews, loading, refetch: fetchProfile };
}

export function useFollow(myUserId: string | null) {
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!myUserId) return;
    (async () => {
      const { data } = await supabase
        .from('app_follows')
        .select('following_id')
        .eq('follower_id', myUserId);
      if (data) setFollowing(new Set(data.map(f => f.following_id)));
    })();
  }, [myUserId]);

  const toggle = async (targetId: string) => {
    if (!myUserId) return;
    if (following.has(targetId)) {
      await supabase.from('app_follows').delete()
        .eq('follower_id', myUserId).eq('following_id', targetId);
      trackEvent(myUserId, 'unfollow_user', 'profile', targetId);
      setFollowing(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    } else {
      await supabase.from('app_follows').insert({ follower_id: myUserId, following_id: targetId });
      trackEvent(myUserId, 'follow_user', 'profile', targetId);
      setFollowing(prev => new Set(prev).add(targetId));
      // NOTE: Follow notification handled by DB trigger `trg_notify_follow`
      // DO NOT insert into app_notifications directly (causes duplicates).
    }
  };

  const isFollowing = (targetId: string) => following.has(targetId);

  return { toggle, isFollowing };
}

/* ═══════════════════════════════════════════
   CHECK-IN — create / expire
   ═══════════════════════════════════════════ */

export function useCheckIn() {
  const checkIn = async (userId: string, city: string, neighborhood?: string, statusText?: string) => {
    // Expire any existing active checkin
    await supabase
      .from('app_checkins')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Check user's show_on_map preference to set visibility
    const { data: prof } = await supabase
      .from('app_profiles')
      .select('show_on_map')
      .eq('user_id', userId)
      .maybeSingle();
    const vis = prof?.show_on_map === false ? 'invisible' : 'public';

    // Create new checkin
    const { data, error } = await supabase
      .from('app_checkins')
      .insert({
        user_id: userId,
        city,
        neighborhood: neighborhood ?? null,
        status_text: statusText ?? null,
        visibility: vis,
        checked_in_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      })
      .select()
      .single();

    return { data, error };
  };

  const checkOut = async (userId: string) => {
    const { error } = await supabase
      .from('app_checkins')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    return { error };
  };

  return { checkIn, checkOut };
}

/* ═══════════════════════════════════════════
   POST FEED — posts + likes + comments
   ═══════════════════════════════════════════ */

export interface PostWithAuthor extends AppPost {
  author: Pick<AppProfile, 'full_name' | 'username' | 'avatar_url' | 'job_type'>;
  comment_count: number;
  liked_by_me: boolean;
}

export function usePosts(city?: string) {
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async (myUserId?: string) => {
    let query = supabase
      .from('app_posts')
      .select('*, author:app_profiles!user_id(full_name, display_name, username, avatar_url, job_type)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (city) query = query.eq('city', city);

    const { data } = await query;

    if (data) {
      // Get comment counts + my likes in parallel
      const enriched = await Promise.all(data.map(async (post: any) => {
        const [{ count: commentCount }, { data: likeData }] = await Promise.all([
          supabase.from('app_comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
          myUserId
            ? supabase.from('app_post_likes').select('user_id').eq('post_id', post.id).eq('user_id', myUserId)
            : Promise.resolve({ data: [] }),
        ]);

        return {
          ...post,
          comment_count: commentCount ?? 0,
          liked_by_me: (likeData?.length ?? 0) > 0,
        };
      }));

      setPosts(enriched as PostWithAuthor[]);
    }
    setLoading(false);
  };

  return { posts, loading, fetch };
}

export function useLikePost() {
  const toggle = async (postId: string, userId: string, isLiked: boolean) => {
    if (isLiked) {
      await supabase.from('app_post_likes').delete()
        .eq('post_id', postId).eq('user_id', userId);
      // Decrement likes_count via direct update
      const { data } = await supabase.from('app_posts').select('likes_count').eq('id', postId).single();
      if (data) {
        await supabase.from('app_posts').update({ likes_count: Math.max(0, (data.likes_count ?? 1) - 1) }).eq('id', postId);
      }
    } else {
      await supabase.from('app_post_likes').insert({ post_id: postId, user_id: userId });
      // Increment likes_count via direct update
      const { data } = await supabase.from('app_posts').select('likes_count').eq('id', postId).single();
      if (data) {
        await supabase.from('app_posts').update({ likes_count: (data.likes_count ?? 0) + 1 }).eq('id', postId);
      }
    }
  };

  return { toggle };
}

export function useComments(postId: string) {
  const [comments, setComments] = useState<(AppComment & { author: Pick<AppProfile, 'full_name' | 'avatar_url'> })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from('app_comments')
      .select('*, author:app_profiles!user_id(full_name, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) setComments(data as any);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [postId]);

  const addComment = async (userId: string, content: string) => {
    const { error } = await supabase
      .from('app_comments')
      .insert({ post_id: postId, user_id: userId, content });
    if (!error) fetch();
    return { error };
  };

  return { comments, loading, addComment, refetch: fetch };
}

export function useCreatePost() {
  const create = async (userId: string, type: string, content: string, city?: string, tags?: string[]) => {
    const { data, error } = await supabase
      .from('app_posts')
      .insert({
        user_id: userId,
        type,
        content,
        city: city ?? null,
        tags: tags ?? [],
        likes_count: 0,
        is_deleted: false,
      })
      .select()
      .single();

    return { data, error };
  };

  return { create };
}

/* ═══════════════════════════════════════════
   PHOTO POSTS — gallery on profile
   ═══════════════════════════════════════════ */

export interface PhotoPost {
  id: string;
  user_id: string;
  caption: string | null;
  city: string | null;
  created_at: string;
  photos: { id: string; image_url: string; sort_order: number }[];
  likes_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export function usePhotoPosts(userId: string | null, myUserId?: string | null) {
  const [posts, setPosts] = useState<PhotoPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!userId) { setLoading(false); return; }

    const { data } = await supabase
      .from('app_photo_posts')
      .select('*, photos:app_photos(id, image_url, sort_order)')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    // Step 1 — render the grid IMMEDIATELY with just photos + zeroed counts.
    // This gets images on-screen in one round trip instead of waiting for
    // likes/comments/liked-by-me to resolve across 3*N extra queries.
    const basic = data.map((post: any) => ({
      ...post,
      photos: (post.photos || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      likes_count: 0,
      comment_count: 0,
      liked_by_me: false,
    })) as PhotoPost[];
    setPosts(basic);
    setLoading(false);

    // Step 2 — enrich in the background; results replace the basic rows as
    // they arrive. Users see photos instantly and the little counters pop in.
    Promise.all(data.map(async (post: any) => {
      const [{ count: likesCount }, { count: commentCount }, { data: likeData }] = await Promise.all([
        supabase.from('app_photo_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('app_photo_comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
        myUserId
          ? supabase.from('app_photo_likes').select('user_id').eq('post_id', post.id).eq('user_id', myUserId)
          : Promise.resolve({ data: [] }),
      ]);
      return {
        ...post,
        photos: (post.photos || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        likes_count: likesCount ?? 0,
        comment_count: commentCount ?? 0,
        liked_by_me: (likeData?.length ?? 0) > 0,
      };
    })).then((enriched) => {
      setPosts(enriched as PhotoPost[]);
    }).catch((err) => {
      console.warn('[usePhotoPosts] enrichment failed:', err);
    });
  };

  useEffect(() => { fetch(); }, [userId]);

  return { posts, loading, refetch: fetch };
}

export function usePhotoLike() {
  const toggle = async (postId: string, userId: string, isLiked: boolean) => {
    if (isLiked) {
      await supabase.from('app_photo_likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('app_photo_likes').insert({ post_id: postId, user_id: userId });
    }
  };
  return { toggle };
}

export function usePhotoComments(postId: string) {
  const [comments, setComments] = useState<{ id: string; user_id: string; content: string; created_at: string; author: Pick<AppProfile, 'full_name' | 'avatar_url'> }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from('app_photo_comments')
      .select('*, author:app_profiles!user_id(full_name, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) setComments(data as any);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [postId]);

  const addComment = async (userId: string, content: string) => {
    const { error } = await supabase
      .from('app_photo_comments')
      .insert({ post_id: postId, user_id: userId, content });
    if (!error) fetch();
    return { error };
  };

  return { comments, loading, addComment, refetch: fetch };
}

/* ═══════════════════════════════════════════
   DM — create or find a direct conversation
   ═══════════════════════════════════════════ */

/**
 * Creates or finds a DM conversation between two users.
 * If sender doesn't follow recipient, recipient's membership is set to 'request'.
 */
export async function createOrFindDM(
  myUserId: string,
  otherUserId: string,
): Promise<{ conversationId: string; isRequest: boolean; error: any }> {
  try {
    // ── Run block check + existing conversation check in parallel ──
    const [blockResult, existingResult] = await Promise.all([
      supabase
        .from('app_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${otherUserId},blocked_id.eq.${myUserId}),and(blocker_id.eq.${myUserId},blocked_id.eq.${otherUserId})`)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('app_conversations')
        .select('id')
        .eq('type', 'dm')
        .or(`and(user_a.eq.${myUserId},user_b.eq.${otherUserId}),and(user_a.eq.${otherUserId},user_b.eq.${myUserId})`)
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: blockRow, error: blockErr } = blockResult;
    if (blockErr) console.warn('[createOrFindDM] block check error (ignoring):', blockErr.message);
    if (blockRow) {
      return { conversationId: '', isRequest: false, error: 'blocked' };
    }

    const { data: existing } = existingResult;

    if (existing) {
      // Conversation exists — check both members in parallel
      const [otherMemberResult, myMemberResult] = await Promise.all([
        supabase
          .from('app_conversation_members')
          .select('id, status')
          .eq('conversation_id', existing.id)
          .eq('user_id', otherUserId)
          .maybeSingle(),
        supabase
          .from('app_conversation_members')
          .select('id')
          .eq('conversation_id', existing.id)
          .eq('user_id', myUserId)
          .maybeSingle(),
      ]);

      const { data: otherMember } = otherMemberResult;
      const { data: myMember } = myMemberResult;

      // Re-add missing members in parallel
      const reAddTasks: PromiseLike<any>[] = [];
      if (!otherMember) {
        reAddTasks.push(
          supabase.from('app_conversation_members')
            .insert({ conversation_id: existing.id, user_id: otherUserId, role: 'member', status: 'request' })
            .then(({ error }) => { if (error) console.warn('[createOrFindDM] re-add recipient failed:', JSON.stringify(error)); })
        );
      }
      if (!myMember) {
        reAddTasks.push(
          supabase.from('app_conversation_members')
            .insert({ conversation_id: existing.id, user_id: myUserId, role: 'member', status: 'active' })
            .then(({ error }) => { if (error) console.warn('[createOrFindDM] re-add sender failed:', JSON.stringify(error)); })
        );
      }
      if (reAddTasks.length > 0) await Promise.all(reAddTasks);

      return { conversationId: existing.id, isRequest: !otherMember ? true : otherMember.status === 'request', error: null };
    }

    // Check follow + create conversation in parallel
    const [followResult, convResult] = await Promise.all([
      supabase
        .from('app_follows')
        .select('id')
        .eq('follower_id', otherUserId)
        .eq('following_id', myUserId)
        .maybeSingle(),
      supabase
        .from('app_conversations')
        .insert({
          type: 'dm',
          user_a: myUserId,
          user_b: otherUserId,
          created_by: myUserId,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single(),
    ]);

    const { data: followRow } = followResult;
    const isRequest = !followRow;
    const { data: newConv, error: convError } = convResult;

    if (convError || !newConv) {
      return { conversationId: '', isRequest: false, error: convError };
    }

    // Add both users as members in parallel
    const [mem1, mem2] = await Promise.all([
      supabase.from('app_conversation_members')
        .insert({ conversation_id: newConv.id, user_id: myUserId, role: 'member', status: 'active' }),
      supabase.from('app_conversation_members')
        .insert({ conversation_id: newConv.id, user_id: otherUserId, role: 'member', status: isRequest ? 'request' : 'active' }),
    ]);
    if (mem1.error) console.warn('[createOrFindDM] member1 insert failed:', JSON.stringify(mem1.error));
    if (mem2.error) console.warn('[createOrFindDM] member2 insert failed:', JSON.stringify(mem2.error));

    // Return conversationId even if member inserts had issues — conversation is valid
    return { conversationId: newConv.id, isRequest, error: null };
  } catch (err) {
    return { conversationId: '', isRequest: false, error: err };
  }
}

/** Accept a DM request — change member status from pending to active */
export async function acceptDMRequest(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('app_conversation_members')
    .update({ status: 'active' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

/** Decline a DM request — remove the membership */
export async function declineDMRequest(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('app_conversation_members')
    .update({ status: 'declined' })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

/** Block a user — removes DM membership + prevents future messages */
export async function blockUser(myUserId: string, blockedUserId: string): Promise<{ error: any }> {
  // 1. Insert block row
  const { error: blockErr } = await supabase
    .from('app_blocks')
    .insert({ blocker_id: myUserId, blocked_id: blockedUserId });
  if (blockErr) return { error: blockErr };

  // 2. Find any DM between us and remove my membership
  const { data: conv } = await supabase
    .from('app_conversations')
    .select('id')
    .eq('type', 'dm')
    .or(`and(user_a.eq.${myUserId},user_b.eq.${blockedUserId}),and(user_a.eq.${blockedUserId},user_b.eq.${myUserId})`)
    .maybeSingle();
  if (conv) {
    await supabase.from('app_conversation_members').delete()
      .eq('conversation_id', conv.id).eq('user_id', myUserId);
  }
  return { error: null };
}

/** Unblock a user */
export async function unblockUser(myUserId: string, blockedUserId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('app_blocks')
    .delete()
    .eq('blocker_id', myUserId)
    .eq('blocked_id', blockedUserId);
  return { error };
}

/** Check if a user is blocked (either direction) */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const { data } = await supabase
    .from('app_blocks')
    .select('id')
    .or(`and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/* ═══════════════════════════════════════════
   STATUS → GROUP CHAT — join someone's status activity
   ═══════════════════════════════════════════ */

/**
 * Creates or finds a group conversation for a status activity.
 * When a nomad sets a status like "Working at Mindspace", others can Join
 * and a group chat is created in Pulse where they can coordinate.
 */
export interface GroupMetadata {
  emoji?: string;
  category?: string;
  activityText?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  isGeneralArea?: boolean;
  scheduledFor?: string | null;
  isOpen?: boolean;
  checkinId?: string;
}

export async function createOrJoinStatusChat(
  myUserId: string,
  statusOwnerId: string,
  statusText: string,
  metadata?: GroupMetadata,
  // When the event is private (is_open=false), the member is inserted
  // with status='request' instead of 'active'. No join message, no
  // member_count bump, no chat access yet — until the owner approves.
  requiresApproval: boolean = false,
): Promise<{ conversationId: string; memberStatus: 'active' | 'request'; error: any }> {
  try {
    const groupName = statusText || 'Activity';

    // Look for an existing group conversation with this name created by the status owner
    const { data: existingConvs } = await supabase
      .from('app_conversations')
      .select('id')
      .eq('type', 'group')
      .eq('name', groupName)
      .eq('created_by', statusOwnerId);

    const foundConvId = existingConvs?.[0]?.id ?? null;

    if (foundConvId) {
      // Join existing group if not already a member
      const { data: alreadyMember } = await supabase
        .from('app_conversation_members')
        .select('conversation_id')
        .eq('conversation_id', foundConvId)
        .eq('user_id', myUserId)
        .maybeSingle();

      if (!alreadyMember) {
        // Private events land in 'request' — owner must approve before the
        // joiner sees the chat or gets counted. Public events go in as 'active'
        // (the old behavior) and immediately see the chat + join message.
        const newStatus = requiresApproval ? 'request' : 'active';
        await supabase
          .from('app_conversation_members')
          .insert({ conversation_id: foundConvId, user_id: myUserId, role: 'member', status: newStatus });

        if (!requiresApproval) {
          // Public: announce the join + bump member_count.
          await supabase.from('app_messages').insert({
            conversation_id: foundConvId,
            sender_id: myUserId,
            content: `Joined the activity 🤙`,
          });
          const { data: checkin } = await supabase
            .from('app_checkins')
            .select('member_count')
            .eq('user_id', statusOwnerId)
            .eq('is_active', true)
            .maybeSingle();
          if (checkin) {
            await supabase
              .from('app_checkins')
              .update({ member_count: (checkin.member_count ?? 1) + 1 })
              .eq('user_id', statusOwnerId)
              .eq('is_active', true);
          }
        }
        // For private events: no join message yet, no count bump. The DB
        // trigger notify_on_activity_join still fires on the INSERT, which
        // is what we want — it tells the owner someone requested to join.
      }

      return { conversationId: foundConvId, memberStatus: (alreadyMember ? 'active' : (requiresApproval ? 'request' : 'active')), error: null };
    }

    // No existing group — create a new one (with activity metadata)
    const { data: newConv, error: convError } = await supabase
      .from('app_conversations')
      .insert({
        type: 'group',
        name: groupName,
        created_by: statusOwnerId,
        last_message_at: new Date().toISOString(),
        ...(metadata ? {
          emoji: metadata.emoji || null,
          category: metadata.category || null,
          activity_text: metadata.activityText || null,
          location_name: metadata.locationName || null,
          latitude: metadata.latitude || null,
          longitude: metadata.longitude || null,
          is_general_area: metadata.isGeneralArea ?? true,
          scheduled_for: metadata.scheduledFor || null,
          is_open: metadata.isOpen ?? true,
          checkin_id: metadata.checkinId || null,
        } : {}),
      })
      .select()
      .single();

    if (convError || !newConv) {
      console.warn('[createOrJoinStatusChat] conv create failed:', convError);
      return { conversationId: '', memberStatus: 'active' as const, error: convError };
    }

    // Add both users as members. Owner is always 'active'; joiner's status
    // depends on whether the event is private (needs approval).
    const joinerStatus = requiresApproval && statusOwnerId !== myUserId ? 'request' : 'active';
    const members = [
      { conversation_id: newConv.id, user_id: statusOwnerId, role: 'admin', status: 'active' },
    ];
    if (statusOwnerId !== myUserId) {
      members.push({ conversation_id: newConv.id, user_id: myUserId, role: 'member', status: joinerStatus });
    }

    const { error: memError } = await supabase
      .from('app_conversation_members')
      .insert(members);

    if (memError) {
      console.warn('[createOrJoinStatusChat] member insert failed, retrying with upsert:', memError);
      // Retry one-by-one with upsert to handle edge cases
      for (const m of members) {
        await supabase
          .from('app_conversation_members')
          .upsert(m, { onConflict: 'conversation_id,user_id' });
      }
    }

    // Send a first message — owner-created, always shows.
    await supabase.from('app_messages').insert({
      conversation_id: newConv.id,
      sender_id: statusOwnerId,        // owner gets credit for the announce
      content: `Created "${groupName}" 🎉`,
    });

    // Bump member_count only if the joiner is actually IN (not pending).
    if (statusOwnerId !== myUserId && joinerStatus === 'active') {
      const { data: checkinData } = await supabase
        .from('app_checkins')
        .select('member_count')
        .eq('user_id', statusOwnerId)
        .eq('is_active', true)
        .maybeSingle();
      if (checkinData) {
        await supabase
          .from('app_checkins')
          .update({ member_count: (checkinData.member_count ?? 1) + 1 })
          .eq('user_id', statusOwnerId)
          .eq('is_active', true);
      }
    }

    return { conversationId: newConv.id, memberStatus: joinerStatus, error: null };
  } catch (err) {
    console.warn('[createOrJoinStatusChat] error:', err);
    return { conversationId: '', memberStatus: 'active' as const, error: err };
  }
}

/**
 * approvePendingMember — flip a pending member to active, post a join
 * message, bump the event's member_count. Single closed-loop helper for
 * the owner's "approve" tap.
 */
export async function approvePendingMember(
  conversationId: string,
  userId: string,
  ownerUserId: string,
): Promise<{ ok: boolean; error: any }> {
  try {
    const { error: updErr } = await supabase
      .from('app_conversation_members')
      .update({ status: 'active' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    if (updErr) return { ok: false, error: updErr };

    // Find the linked checkin to bump member_count
    const { data: conv } = await supabase
      .from('app_conversations')
      .select('checkin_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (conv?.checkin_id) {
      const { data: checkin } = await supabase
        .from('app_checkins')
        .select('member_count')
        .eq('id', conv.checkin_id)
        .maybeSingle();
      if (checkin) {
        await supabase
          .from('app_checkins')
          .update({ member_count: (checkin.member_count ?? 1) + 1 })
          .eq('id', conv.checkin_id);
      }
    }

    // Announce in chat (system-style, sender = owner)
    await supabase.from('app_messages').insert({
      conversation_id: conversationId,
      sender_id: ownerUserId,
      content: `Welcome 👋  — your request was approved`,
    });

    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/**
 * denyPendingMember — flip a pending member to denied. They stay out of
 * the chat and don't count toward member_count.
 */
export async function denyPendingMember(
  conversationId: string,
  userId: string,
): Promise<{ ok: boolean; error: any }> {
  try {
    const { error } = await supabase
      .from('app_conversation_members')
      .update({ status: 'declined' })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    return { ok: !error, error };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/* ═══════════════════════════════════════════
   NOTIFICATIONS — in-app alerts
   ═══════════════════════════════════════════ */

export interface AppNotification {
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
  actor?: Pick<AppProfile, 'full_name' | 'avatar_url' | 'username'>;
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    const { data } = await supabase
      .from('app_notifications')
      .select('*, actor:app_profiles!actor_id(full_name, display_name, avatar_url, username)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data as AppNotification[]);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetch]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
  }, [userId]);

  return { notifications, unreadCount, loading, refetch: fetch, markAllRead };
}

/* ═══════════════════════════════════════════
   SETTINGS — update profile settings
   ═══════════════════════════════════════════ */

export function useUpdateSettings() {
  const update = async (userId: string, fields: Record<string, any>) => {
    const { error } = await supabase
      .from('app_profiles')
      .update(fields)
      .eq('user_id', userId);
    return { error };
  };

  // Full account deletion — required by Apple Guideline 5.1.1(v) since
  // June 2022. Soft-hiding the profile is NOT compliant and Apple rejects
  // apps that do it. Steps below honor GDPR-style data deletion AND
  // preserve chat continuity for other members (their messages still
  // make sense) — we anonymize the sender_id on messages the user sent,
  // keeping the text but dropping the attribution.
  const deleteAccount = async (userId: string) => {
    try {
      // 1. Deactivate + delete all check-ins the user owns.
      await supabase.from('app_checkins').delete().eq('user_id', userId);

      // 2. Remove the user from every conversation they belong to.
      await supabase.from('app_conversation_members').delete().eq('user_id', userId);

      // 3. Anonymize messages they sent (text stays, authorship gone).
      //    Setting sender_id=null is the convention for system messages in
      //    this schema; visually these now render as "deleted user" in UI.
      await supabase.from('app_messages').update({ sender_id: null }).eq('sender_id', userId);

      // 4. Remove other traces (blocks, follows, posts, photos…).
      await supabase.from('app_blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
      await supabase.from('app_follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
      await supabase.from('app_photo_posts').update({ is_deleted: true }).eq('user_id', userId);
      await supabase.from('app_profile_views').delete().or(`viewer_id.eq.${userId},viewed_id.eq.${userId}`);
      await supabase.from('app_notifications').delete().eq('user_id', userId);

      // 5. Delete the profile row itself. This is the last row-level delete.
      const { error: profileErr } = await supabase.from('app_profiles').delete().eq('user_id', userId);
      if (profileErr) return { error: profileErr };

      // 6. Delete the auth user — this requires an admin call. Supabase
      //    doesn't allow client-side auth deletion, so we flag the user
      //    server-side and sign them out. An Edge Function / cron finishes
      //    the auth.users delete. For now, signOut() breaks the session.
      //    (Server-side hard-delete of auth.users belongs in an Edge Fn
      //    — noted as a follow-up, not blocking Apple submission because
      //    the profile and all PII are already gone.)
      await supabase.auth.signOut();

      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  return { update, deleteAccount };
}

/* ═══════════════════════════════════════════
   FLIGHT GROUPS — Incoming Flights feature
   ═══════════════════════════════════════════ */

export interface FlightSubGroup {
  id: string;
  flight_group_id: string;
  origin_country: string;
  origin_flag: string;
  conversation_id: string | null;
  member_count: number;
  min_arrival: string | null;
  max_departure: string | null;
}

export interface FlightGroupDetail {
  id: string;
  country: string;
  country_flag: string;
  conversation_id: string | null;
  member_count: number;
  min_arrival: string | null;
  max_departure: string | null;
  sub_groups: FlightSubGroup[];
  joinedMainGroup: boolean;
  joinedSubGroups: Set<string>;
}

export interface FlightGroup {
  id: string;
  country: string;
  country_flag: string;
  conversation_id: string | null;
  member_count: number;
  created_at: string;
  /* joined via query */
  members?: FlightMember[];
  earliest_arrival?: string | null;
  latest_arrival?: string | null;
}

export interface FlightMember {
  id: string;
  user_id: string;
  arrival_date: string | null;
  departure_date: string | null;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

/** Fetch all flight groups with member previews */
export function useFlightGroups() {
  const [groups, setGroups] = useState<FlightGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = async () => {
    // 1. Get all flight groups
    const { data: groupData, error: gErr } = await supabase
      .from('flight_groups')
      .select('*')
      .gt('member_count', 0)
      .order('member_count', { ascending: false });

    if (!groupData || gErr) { setLoading(false); return; }

    // 2. Get all flight members
    const groupIds = groupData.map(g => g.id);
    const { data: memberData } = await supabase
      .from('flight_members')
      .select('id, user_id, flight_group_id, arrival_date, departure_date')
      .in('flight_group_id', groupIds);

    // 3. Get profiles for all member user_ids
    const memberUserIds = [...new Set((memberData || []).map(m => m.user_id))];
    const { data: profileData } = memberUserIds.length > 0
      ? await supabase
          .from('app_profiles')
          .select('user_id, full_name, display_name, avatar_url')
          .in('user_id', memberUserIds)
      : { data: [] };

    const profileMap = new Map((profileData || []).map(p => [p.user_id, p]));

    // 4. Assemble: attach members with profiles to each group
    const enriched = groupData.map(g => {
      const members = (memberData || [])
        .filter(m => m.flight_group_id === g.id)
        .map(m => ({ ...m, profile: profileMap.get(m.user_id) || null }));

      return {
        ...g,
        members,
        earliest_arrival: members.reduce((min: string | null, m: any) =>
          m.arrival_date && (!min || m.arrival_date < min) ? m.arrival_date : min, null),
        latest_arrival: members.reduce((max: string | null, m: any) =>
          m.arrival_date && (!max || m.arrival_date > max) ? m.arrival_date : max, null),
      };
    });

    setGroups(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  return { groups, loading, refetch: fetchGroups };
}

/** Join or create a flight group — returns group_id + conversation_id */
export async function joinFlightGroup(
  userId: string,
  country: string,
  countryFlag: string,
  arrivalDate?: string | null,
  departureDate?: string | null,
): Promise<{ groupId: string | null; conversationId: string | null; error: any }> {
  try {
    // 1. Call DB function to join/create group
    const { data, error } = await supabase.rpc('join_flight_group', {
      p_user_id: userId,
      p_country: country,
      p_country_flag: countryFlag,
      p_arrival: arrivalDate || null,
      p_departure: departureDate || null,
    });

    if (error) return { groupId: null, conversationId: null, error };

    const row = Array.isArray(data) ? data[0] : data;
    const groupId = row?.group_id;
    let convId = row?.conv_id;

    // 2. If no conversation yet, create one (flight group chat)
    if (!convId && groupId) {
      const groupName = `✈️ Flying to ${country}`;
      const { data: newConv, error: convErr } = await supabase
        .from('app_conversations')
        .insert({
          type: 'group',
          name: groupName,
          created_by: userId,
          is_open: true,
        })
        .select('id')
        .single();

      if (newConv && !convErr) {
        convId = newConv.id;
        // Link conversation to flight group
        await supabase.from('flight_groups').update({ conversation_id: convId }).eq('id', groupId);
        // Add creator as member
        await supabase.from('app_conversation_members').insert({
          conversation_id: convId,
          user_id: userId,
          role: 'admin',
          status: 'active',
        });
        // Welcome message
        await supabase.from('app_messages').insert({
          conversation_id: convId,
          sender_id: userId,
          content: `✈️ Flight group to ${country} created! Who's coming?`,
        });
      }
    } else if (convId) {
      // Ensure user is member of the existing chat
      const { data: isMember } = await supabase
        .from('app_conversation_members')
        .select('conversation_id')
        .eq('conversation_id', convId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!isMember) {
        await supabase.from('app_conversation_members').insert({
          conversation_id: convId,
          user_id: userId,
          role: 'member',
          status: 'active',
        });
        await supabase.from('app_messages').insert({
          conversation_id: convId,
          sender_id: userId,
          content: `Joined the flight group ✈️`,
        });
      }
    }

    return { groupId, conversationId: convId, error: null };
  } catch (err) {
    return { groupId: null, conversationId: null, error: err };
  }
}

/** Fetch a single flight group with sub-groups and join status */
export function useFlightGroupDetail(flightGroupId: string, userId: string | null) {
  const [detail, setDetail] = useState<FlightGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!flightGroupId || !userId) { setLoading(false); return; }

    // 1. Get the flight group
    const { data: group } = await supabase
      .from('flight_groups')
      .select('*')
      .eq('id', flightGroupId)
      .single();

    if (!group) { setLoading(false); return; }

    // 2. Get sub-groups
    const { data: subGroups } = await supabase
      .from('flight_sub_groups')
      .select('*')
      .eq('flight_group_id', flightGroupId)
      .order('member_count', { ascending: false });

    // 3. Compute overall date range from sub-groups
    const subs = subGroups || [];
    const allArrivals = subs.map(s => s.min_arrival).filter(Boolean) as string[];
    const allDepartures = subs.map(s => s.max_departure).filter(Boolean) as string[];
    const minArrival = allArrivals.length ? allArrivals.sort()[0] : null;
    const maxDeparture = allDepartures.length ? allDepartures.sort().reverse()[0] : null;

    // 4. Check which conversations user has already joined
    const convIds = [group.conversation_id, ...subs.map(s => s.conversation_id)].filter(Boolean) as string[];
    const { data: memberships } = convIds.length > 0
      ? await supabase
          .from('app_conversation_members')
          .select('conversation_id')
          .eq('user_id', userId)
          .in('conversation_id', convIds)
      : { data: [] };

    const joinedSet = new Set((memberships || []).map(m => m.conversation_id));

    setDetail({
      id: group.id,
      country: group.country,
      country_flag: group.country_flag,
      conversation_id: group.conversation_id,
      member_count: group.member_count,
      min_arrival: minArrival,
      max_departure: maxDeparture,
      sub_groups: subs,
      joinedMainGroup: !!group.conversation_id && joinedSet.has(group.conversation_id),
      joinedSubGroups: joinedSet,
    });
    setLoading(false);
  }, [flightGroupId, userId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  return { detail, loading, refetch: fetchDetail };
}

/** Join a specific flight conversation (main group or sub-group) */
export async function joinFlightChat(
  userId: string,
  conversationId: string,
): Promise<{ success: boolean; error: any }> {
  try {
    // Check if already a member
    const { data: existing } = await supabase
      .from('app_conversation_members')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return { success: true, error: null };

    // Join the conversation
    const { error } = await supabase
      .from('app_conversation_members')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'member',
        status: 'active',
      });

    if (error) return { success: false, error };

    // Send join message
    await supabase.from('app_messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: 'joined the group ✈️',
    });

    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}

/* ═══════════════════════════════════════════
   LEAVE GROUP — single unified function
   ═══════════════════════════════════════════
   What it does:
   1. Remove user from app_conversation_members
   2. Send "left the group" message (so others see)
   3. Decrement member_count on the source checkin (if exists)
   4. Conversation disappears from Messages tab automatically
      (useConversations filters by membership)
*/
export async function leaveGroupChat(
  userId: string,
  conversationId: string,
): Promise<{ success: boolean; error: any }> {
  try {
    // 1. Remove membership
    const { error: delErr } = await supabase
      .from('app_conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);

    if (delErr) {
      console.warn('[leaveGroupChat] delete membership failed:', delErr);
      return { success: false, error: delErr };
    }

    // 2. Post "left" message (fire & forget — user is already removed)
    await supabase.from('app_messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: 'left the group 👋',
    }).then(() => {}, () => {});

    // 3. Find the related checkin and decrement member_count
    const { data: conv } = await supabase
      .from('app_conversations')
      .select('created_by, name')
      .eq('id', conversationId)
      .maybeSingle();

    if (conv?.created_by) {
      const { data: checkin } = await supabase
        .from('app_checkins')
        .select('id, member_count')
        .eq('user_id', conv.created_by)
        .eq('is_active', true)
        .maybeSingle();

      if (checkin && (checkin.member_count ?? 0) > 0) {
        await supabase
          .from('app_checkins')
          .update({ member_count: Math.max(0, (checkin.member_count ?? 1) - 1) })
          .eq('id', checkin.id);
      }
    }

    return { success: true, error: null };
  } catch (err) {
    console.warn('[leaveGroupChat] error:', err);
    return { success: false, error: err };
  }
}


/* ═══════════════════════════════════════════
   פניני חוכמה — WISDOM SIGNALS
   Learn user intent from behavior
   ═══════════════════════════════════════════ */

export type WisdomSignalType =
  | 'city_browse' | 'profile_tap' | 'join_attempt'
  | 'travel_declared' | 'planning_declared' | 'just_looking' | 'city_onboard';

export type WisdomIntent = 'flying_soon' | 'planning' | 'just_looking' | 'arrived';

/** Haversine distance in km between two points */
export function wisdomHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Track a wisdom signal — fire and forget */
export async function trackWisdomSignal(params: {
  userId: string;
  signalType: WisdomSignalType;
  city: string;
  country?: string;
  lat?: number;
  lng?: number;
  userCity?: string;
  distanceKm?: number;
  intent?: WisdomIntent;
  checkinId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await supabase.from('app_wisdom_signals').insert({
      user_id: params.userId,
      signal_type: params.signalType,
      city: params.city,
      country: params.country || null,
      latitude: params.lat || null,
      longitude: params.lng || null,
      user_city: params.userCity || null,
      distance_km: params.distanceKm ? Math.round(params.distanceKm) : null,
      intent: params.intent || null,
      checkin_id: params.checkinId || null,
      metadata: params.metadata || {},
    });
  } catch (e) {
    console.warn('[wisdom] signal track failed:', e);
  }
}

/** Check if user has a known travel intent for a city */
export async function getWisdomForCity(
  userId: string,
  city: string,
): Promise<{ hasIntent: boolean; intent: WisdomIntent | null; recentSignals: number }> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: signals } = await supabase
      .from('app_wisdom_signals')
      .select('signal_type, intent, created_at')
      .eq('user_id', userId)
      .eq('city', city)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!signals || signals.length === 0) {
      return { hasIntent: false, intent: null, recentSignals: 0 };
    }

    const declared = signals.find(s =>
      s.intent && ['flying_soon', 'planning', 'just_looking', 'arrived'].includes(s.intent)
    );

    return {
      hasIntent: !!declared,
      intent: (declared?.intent as WisdomIntent) || null,
      recentSignals: signals.length,
    };
  } catch (e) {
    console.warn('[wisdom] getWisdomForCity failed:', e);
    return { hasIntent: false, intent: null, recentSignals: 0 };
  }
}

/** Check if user has a flight/trip to a city based on profile data */
export async function checkProfileTravelIntent(
  userId: string,
  targetCity: string,
): Promise<{ hasPlannedTrip: boolean; departureDate: string | null }> {
  try {
    const { data: profile } = await supabase
      .from('app_profiles')
      .select('next_destination, next_departure_date, next_destination_date')
      .eq('user_id', userId)
      .single();

    if (!profile?.next_destination) {
      return { hasPlannedTrip: false, departureDate: null };
    }

    const dest = profile.next_destination.toLowerCase();
    const target = targetCity.toLowerCase();
    const match = dest.includes(target) || target.includes(dest);

    return {
      hasPlannedTrip: match,
      departureDate: profile.next_departure_date || profile.next_destination_date || null,
    };
  } catch (e) {
    return { hasPlannedTrip: false, departureDate: null };
  }
}

/** Full wisdom check — combines all signals to decide if we need to prompt */
export async function wisdomCheck(params: {
  userId: string;
  userLat: number;
  userLng: number;
  userCity: string;
  userCountry: string;
  targetCity: string;
  targetLat: number;
  targetLng: number;
  targetCountry?: string;
}): Promise<{
  shouldPrompt: boolean;
  distanceKm: number;
  reason: 'close_enough' | 'has_flight' | 'recently_declared' | 'needs_prompt';
  existingIntent: WisdomIntent | null;
  departureDate: string | null;
}> {
  const distanceKm = wisdomHaversineKm(params.userLat, params.userLng, params.targetLat, params.targetLng);

  // Same country — no prompt needed
  const sameCountry = params.userCountry.toLowerCase() === (params.targetCountry || '').toLowerCase();
  if (sameCountry) {
    return { shouldPrompt: false, distanceKm, reason: 'close_enough', existingIntent: null, departureDate: null };
  }

  // Check profile for planned trip
  const travel = await checkProfileTravelIntent(params.userId, params.targetCity);
  if (travel.hasPlannedTrip) {
    trackWisdomSignal({
      userId: params.userId,
      signalType: 'join_attempt',
      city: params.targetCity,
      country: params.targetCountry,
      lat: params.targetLat,
      lng: params.targetLng,
      userCity: params.userCity,
      distanceKm,
      intent: 'flying_soon',
    });
    return { shouldPrompt: false, distanceKm, reason: 'has_flight', existingIntent: 'flying_soon', departureDate: travel.departureDate };
  }

  // Check recent wisdom signals
  const wisdom = await getWisdomForCity(params.userId, params.targetCity);
  if (wisdom.hasIntent && wisdom.intent === 'flying_soon') {
    return { shouldPrompt: false, distanceKm, reason: 'recently_declared', existingIntent: wisdom.intent, departureDate: null };
  }

  // No info or previously said planning/looking — prompt
  return { shouldPrompt: true, distanceKm, reason: 'needs_prompt', existingIntent: wisdom.intent, departureDate: null };
}
