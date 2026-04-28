import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { trackEvent } from './tracking';
import { gateContent, type GateOutcome } from './moderation';
import { deleteAccountData } from './accountDeletion';
import { captureUserReport } from './sentry';

/* Sentinel error codes — callers of `send()` inspect
 * these strings to distinguish "network failed" from
 * "moderation blocked" from "rate-limited". Not localized;
 * the UI layer translates via t() when surfacing to the user. */
export const SEND_BLOCKED_MODERATION = 'SEND_BLOCKED_MODERATION';
export const SEND_BLOCKED_RATE_LIMIT = 'SEND_BLOCKED_RATE_LIMIT';

/** Returned-from-send error shape used by the moderation
 *  gate. Inspect `.message` for the sentinel above and
 *  `.gateOutcome` for details (category, until-time). */
export interface SendBlockedError extends Error {
  gateOutcome: GateOutcome;
}

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

/* ─── Scale-safe fetch guards ───
 *
 * Two-layer defense against the DB-hammering pattern this
 * hook caused pre-April 2026:
 *
 *   1. TIME GUARD (30 s) — explicit refetch() calls (focus-
 *      effect in HomeScreen, post-publish trigger, etc.)
 *      that land within 30 s of a successful fetch and
 *      happen on non-empty data are skipped. The user sees
 *      the already-loaded data instead of waiting for a
 *      duplicate network round-trip.
 *
 *   2. BURST DEBOUNCE (300 ms) — Realtime events in a busy
 *      city fire in bursts (e.g. 10 members join an event
 *      within 2 s → 10 UPDATE events). Without debounce,
 *      each event triggers a full fetch. With debounce, a
 *      burst folds into ONE fetch 300 ms after the last
 *      event in the burst.
 *
 * Math at 1,000 concurrent Tel Aviv users, ~60 city-level
 * events/minute:
 *   Before: 12,000 fetches/min → exceeds Supabase Pro
 *   After:  ~200 fetches/min → comfortable headroom
 *
 * Rule Zero check: every user gets the same guarded behavior.
 * No user-specific bypass, no per-surface exception.
 */
const FETCH_TIME_GUARD_MS = 30_000;
const REALTIME_DEBOUNCE_MS = 300;

/* Pass `null` for `city` to fetch globally — every active checkin
 * regardless of city. HomeScreen uses this so the map can show
 * bubbles across multiple cities in a single zoomed-out view
 * (Tel Aviv + Rehovot + Jerusalem in the same frame, etc.) per the
 * 2026-04-28 owner directive: "density across cities is the beauty".
 *
 * `city_only` checkins are still scoped to a city — when fetching
 * globally we apply that filter on the client by comparing each
 * checkin's `city` to the viewer's `viewerCity` (passed by HomeScreen
 * as the user's GPS-resolved city). PeopleScreen continues to pass a
 * concrete city string for its city-bound list and is unchanged. */
export function useActiveCheckins(
  city: string | null,
  viewerUserId?: string | null,
  viewerCity?: string | null,
) {
  const [checkins, setCheckins] = useState<CheckinWithProfile[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const prevIdsRef = useRef<string>('');
  /** Last SUCCESSFUL fetch timestamp. 0 = never succeeded;
   *  set only after a query returns data, so a failed fetch
   *  doesn't poison the guard. */
  const lastFetchAtRef = useRef<number>(0);
  /** Concurrency guard — prevents two fetches firing in
   *  parallel from racing into setState. Without this, a
   *  rapid focus → realtime → focus sequence could have 3
   *  in-flight requests and the LAST one to resolve wins
   *  (which may be the oldest data). */
  const inFlightRef = useRef<boolean>(false);
  /** Timer for burst-debouncing Realtime-triggered fetches. */
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetch = async (opts?: { force?: boolean }) => {
    // In-flight guard — never run two fetches at once.
    if (inFlightRef.current) return;
    // Time guard — skip if we successfully fetched recently.
    // Compares against `lastFetchAtRef` which is only updated
    // post-success, so a series of failures doesn't lock us
    // out. First-ever call (lastFetchAtRef=0) always proceeds.
    if (!opts?.force
        && lastFetchAtRef.current > 0
        && Date.now() - lastFetchAtRef.current < FETCH_TIME_GUARD_MS) {
      setLoading(false);
      return;
    }
    inFlightRef.current = true;
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

    // 2. Fetch active checkins (include visibility fields from profile).
    //    `city === null` means GLOBAL mode: don't apply the .ilike('city')
    //    filter, return every active checkin regardless of city. That
    //    request is what HomeScreen uses so the map can render multiple
    //    cities at once. PeopleScreen still passes a concrete city
    //    string and gets the city-bound list it always did.
    let data: any[] | null = null;
    let error: any = null;
    try {
      let q = supabase
        .from('app_checkins')
        .select('*, profile:app_profiles!user_id(full_name, display_name, username, avatar_url, job_type, bio, interests, show_on_map, hide_distance, birth_date)')
        .eq('is_active', true)
        .in('visibility', ['public', 'city_only']);
      if (city) {
        q = q.ilike('city', city);
      }
      const res = await q.limit(200);
      data = res.data;
      error = res.error;
    } finally {
      // Release the in-flight lock no matter what — a thrown
      // exception here would otherwise deadlock subsequent
      // fetches for this hook's lifetime.
      inFlightRef.current = false;
    }

    if (data) {
      // Mark the fetch as successful AFTER we have data. Only
      // then does the time guard consider the 30 s window
      // active. Failed fetches leave lastFetchAtRef alone so
      // recovery is possible on the next call.
      lastFetchAtRef.current = Date.now();
      // 3a. Visibility filter. expires_at is now the single source of
      //     truth (set correctly at publish time per lifecycle):
      //       • Immediate status → now + 60 min
      //       • Scheduled specific time → = scheduled_for
      //       • Scheduled flexible → = 23:59:59 of scheduled_for's date
      //     The cron also uses expires_at, so client + cron agree.
      const now = new Date();
      const viewerCityLower = (viewerCity || '').toLowerCase();
      const visible = (data as any[]).filter((c: any) => {
        if (c.profile?.show_on_map === false) return false;
        const expiresTs = c.expires_at ? new Date(c.expires_at).getTime() : null;
        if (expiresTs && expiresTs < now.getTime()) return false;
        // Global mode (city === null) — `city_only` visibility means
        // "show only to people in the same city as the checkin", so
        // we drop those whose city doesn't match the viewer's GPS-
        // resolved city. `public` checkins remain visible globally.
        // Without this guard, a Berlin nomad's `city_only` checkin
        // would show on the Tel Aviv viewer's map — exactly the
        // privacy expectation we promised. PeopleScreen's city-bound
        // mode (`city` truthy) is unaffected: the SQL .ilike('city')
        // already restricted the data to one city.
        if (city === null && c.visibility === 'city_only') {
          const cCity = (c.city || '').toLowerCase();
          if (!cCity || !viewerCityLower) return false;
          if (cCity !== viewerCityLower) return false;
        }
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

      // 3c. Skip state update if NOTHING the map cares about changed.
      //
      // History: this used to fingerprint only `${id}:${member_count}`,
      // intended to suppress no-op re-renders that caused pin flicker
      // during map pans. Side effect — when an owner edited an event
      // (location_name, lat/lng, activity_text, expires_at, etc.) the
      // fingerprint was identical, so setCheckins was SKIPPED and the
      // pins kept showing the OLD coords / title forever, even though
      // the DB was correctly updated. Tester report 2026-04-26:
      // "שינוי לוקיישן בתוך האינפו של היוצר - לאחר שינוי ושמירה - אין שינוי".
      //
      // Fix: fingerprint every field a marker (or the People list) reads.
      // If ANY of them changes, the fingerprint changes and the new
      // checkin list flows down. Pin-jitter prevention now lives at
      // the Marker level (NomadMarker memoization) — separated concerns.
      const fp = (c: any) => [
        c.id,
        c.latitude ?? '',
        c.longitude ?? '',
        c.location_name ?? '',
        c.activity_text ?? '',
        c.status_emoji ?? '',
        c.category ?? '',
        c.member_count ?? 0,
        c.is_open ?? '',
        c.expires_at ?? '',
        c.scheduled_for ?? '',
        c.profile?.avatar_url ?? '',
        c.profile?.show_on_map ?? '',
      ].join('|');
      const newFingerprint = filtered.map(fp).sort().join('§');
      if (newFingerprint !== prevIdsRef.current) {
        prevIdsRef.current = newFingerprint;
        setCheckins(filtered as unknown as CheckinWithProfile[]);
        setCount(filtered.length);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // City changed — reset guards so first fetch runs fresh.
    lastFetchAtRef.current = 0;
    setLoading(true);
    void fetch({ force: true });

    // Polling fallback — Realtime is the primary refresh mechanism;
    // this is a safety net in case the websocket drops. The 120 s
    // polling interval runs through the normal fetch() which
    // respects the 30 s time guard, so mostly becomes a no-op
    // unless data is genuinely stale.
    const pollInterval = setInterval(() => { void fetch(); }, 120000);

    /* Realtime subscription with burst-debounced refetch.
     *
     * No server-side city filter — Supabase Realtime's `eq` is
     * case-sensitive but our queries use `ilike`, so we listen
     * to ALL changes and filter by city on the client. That
     * means every client hears every event in EVERY city —
     * expensive at scale but we compensate with the debounce.
     *
     * Debounce logic: each relevant event resets a 300 ms
     * timer. When the timer fires (300 ms after the last
     * event), ONE fetch runs. A burst of 20 events in 2 s
     * becomes 1 fetch, not 20. */
    const channelName = `checkins-${nextChannelId()}`;
    console.log(`[Realtime] Subscribing to all checkin changes (channel: ${channelName}, viewing: "${city}")`);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_checkins',
      }, (payload) => {
        // Global mode (city === null) reacts to EVERY checkin change
        // worldwide — that's the whole point of multi-city density.
        // City-bound mode keeps the existing client-side filter so
        // PeopleScreen doesn't refetch on every Berlin event.
        if (city) {
          const changedCity = (payload.new as any)?.city || (payload.old as any)?.city || '';
          if (changedCity.toLowerCase() !== city.toLowerCase()) return;
        }
        // Debounce: reset timer on each event, fetch only after
        // the burst subsides.
        if (realtimeDebounceRef.current) {
          clearTimeout(realtimeDebounceRef.current);
        }
        realtimeDebounceRef.current = setTimeout(() => {
          realtimeDebounceRef.current = null;
          void fetch({ force: true }); // Realtime = real change, bypass time guard
        }, REALTIME_DEBOUNCE_MS);
      })
      .subscribe((status, err) => {
        console.log(`[Realtime] checkins subscription status: ${status}`, err || '');
      });

    return () => {
      clearInterval(pollInterval);
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      console.log(`[Realtime] Unsubscribing checkins channel: ${channelName}`);
      supabase.removeChannel(channel);
    };
    // viewerCity is in deps so a city-only filter re-evaluates the
    // moment the viewer's GPS-resolved city updates — otherwise a
    // user who moved from Tel Aviv to Rehovot would keep seeing
    // Tel Aviv's city_only checkins until the next manual refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, viewerCity]);

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
   Returns a Map<checkin_id, heatLevel> for pulse animation
   ═══════════════════════════════════════════

   Stage 10 of the no-band-aids refactor (April 2026): this hook
   used to poll `app_conversations` every 60 seconds across all
   active clients. At 100 concurrent users that's 100 queries per
   minute just for the "hot" halo on map pins — and it was what
   took the DB over the edge overnight.

   New design:

   1) Initial fetch on mount — ONE query per mount, gets every
      checkin whose linked conversation had a message in the last
      5 minutes.
   2) Supabase Realtime subscription on `app_conversations`
      UPDATE — when a chat ticks forward, we get a push with the
      new `last_message_at`. No polling.
   3) Local heat decay — the 1 / 3 / 2 / 1 scale depends on HOW
      LONG AGO the last message was, so "heat" naturally drops
      over time even without new activity. We recompute hotMap
      from the stored last-message timestamps every 30 seconds on
      the client (no DB). Decay is cheap, deterministic, and
      invisible to the server.

   Net: the hook hits the DB once per mount and never again. The
   visual heat UI looks identical to the old polled version. */
export function useHotCheckins(city: string) {
  // Per-checkin "last message at" timestamps (ms since epoch).
  // This is the raw input — Realtime writes into it, decay reads
  // from it. hotMap below is derived from it.
  const [lastMsgMap, setLastMsgMap] = useState<Map<string, number>>(new Map());
  const [hotMap, setHotMap] = useState<Map<string, number>>(new Map());

  /* ── 1) Initial fetch + Realtime subscription ── */
  useEffect(() => {
    let cancelled = false;

    const fetchInitial = async () => {
      const cutoff = new Date(Date.now() - 5 * 60000).toISOString();
      const { data, error } = await supabase
        .from('app_conversations')
        .select('checkin_id, last_message_at')
        .not('checkin_id', 'is', null)
        .gte('last_message_at', cutoff);
      if (cancelled) return;
      if (error) {
        console.warn('[useHotCheckins] initial fetch failed:', error.message);
        return;
      }
      const next = new Map<string, number>();
      for (const c of data || []) {
        if (!c.checkin_id || !c.last_message_at) continue;
        const ts = new Date(c.last_message_at).getTime();
        next.set(c.checkin_id, Math.max(next.get(c.checkin_id) || 0, ts));
      }
      setLastMsgMap(next);
    };

    fetchInitial();

    // Realtime: every app_conversations UPDATE flows through
    // here. We receive updates for ALL cities — client-side heat
    // is global anyway (a hot pin shows regardless of which city
    // bucket the map is centered on), so we don't try to filter
    // at the channel level. Channel name includes `city` so React
    // can unsubscribe + resubscribe cleanly when the user
    // switches cities (rare, but free).
    const channel = supabase
      .channel(`hot-checkins-${city}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_conversations' },
        (payload) => {
          const row = payload.new as any;
          if (!row?.checkin_id || !row?.last_message_at) return;
          const ts = new Date(row.last_message_at).getTime();
          setLastMsgMap(prev => {
            const existing = prev.get(row.checkin_id) || 0;
            if (ts <= existing) return prev; // no-op, don't re-render
            const next = new Map(prev);
            next.set(row.checkin_id, ts);
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useHotCheckins] realtime status:', status);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [city]);

  /* ── 2) Recompute heat from timestamps — decay + fresh data ── */
  useEffect(() => {
    const recompute = () => {
      const now = Date.now();
      const next = new Map<string, number>();
      for (const [id, ts] of lastMsgMap.entries()) {
        const ago = (now - ts) / 60000; // minutes
        if (ago > 5) continue; // cold — drop from the map
        // Same 1 / 2 / 3 scale the old polling version used.
        const heat = ago < 1 ? 3 : ago < 3 ? 2 : 1;
        next.set(id, heat);
      }
      // Skip setState if the new map is identical to prev — avoids
      // waking re-renders while nothing visually changed (same
      // guard pattern as HomeScreen's region-change handler).
      setHotMap(prev => {
        if (prev.size !== next.size) return next;
        for (const [id, heat] of next) {
          if (prev.get(id) !== heat) return next;
        }
        return prev;
      });
    };

    recompute();
    // 30s is twice as frequent as the old 60s poll but costs
    // zero DB — it's pure in-memory arithmetic. Users notice heat
    // fading faster, which matches the "this pin is HOT right
    // now" metaphor better than a 60s lag.
    const iv = setInterval(recompute, 30000);
    return () => clearInterval(iv);
  }, [lastMsgMap]);

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

/**
 * useNomadsInCity — fetch profiles in a given city, filtered by the
 * viewer's age preference (and the candidates' age preference too).
 *
 * Owner report 2026-04-27: Eli (52) and Yuval (62) appeared in the
 * "nomads here" list of a viewer (Barak) whose age range was 18-48.
 * Root cause: this hook had NO age filter at all — it just selected
 * every profile in the matching city with show_on_map=true.
 *
 * Second owner report 2026-04-27 (later same day): when Barak
 * changed his age range in Settings and came back, the filter
 * didn't react until he refreshed. Root cause #2: the hook was
 * fetching the viewer profile internally, with deps only on
 * [city, viewerUserId]. A change to age_max didn't change either
 * dep, so no refetch fired. Fix: take the viewer's age + range
 * as parameters, deps include them — when Barak's age_max
 * changes, parent passes new value, hook refetches immediately.
 *
 * Fix: bidirectional age check, mirroring the same pattern that's
 * already in `useActiveCheckins` (line 201). Both sides must opt-in
 * to each other's age:
 *   A. The candidate's age is within the viewer's [age_min, age_max]
 *   B. The viewer's age is within the candidate's [age_min, age_max]
 *
 * If a candidate has no birth_date (NULL — happens for legacy users
 * who signed up before the field was required), they're INCLUDED
 * (we can't compute age, so we err on the side of "show them"; the
 * user can still mute / report). Same default as useActiveCheckins.
 *
 * If `viewer` is undefined / null, the filter is a no-op — all
 * candidates pass through. Hook stays safe to call from anywhere.
 */
export interface ViewerForFilter {
  /** Viewer's birth_date — used to compute their age for the
   *  "candidate accepts viewer's age" check. */
  birthDate: string | null;
  /** Viewer's preferred minimum age of others. Default 18. */
  ageMin: number;
  /** Viewer's preferred maximum age of others. Default 100. */
  ageMax: number;
}

export function useNomadsInCity(city: string, viewer?: ViewerForFilter | null) {
  const [nomads, setNomads] = useState<NomadInCity[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Stabilise the viewer object across re-renders that pass a new
  // reference but identical values, so deps comparison works.
  const viewerBirth = viewer?.birthDate ?? null;
  const viewerMin = viewer?.ageMin ?? 18;
  const viewerMax = viewer?.ageMax ?? 100;

  const fetch = async () => {
    const viewerAge = calcAge(viewerBirth);

    // ─── Active-presence threshold ─────────────────────────────
    // Owner directive 2026-04-27: a user who hasn't opened the app
    // recently must NOT appear in city nomad lists, even though
    // their profile remains in the DB. Otherwise an uninstalled
    // user (Eli case 2026-04-27 — deleted the app, kept appearing
    // in Tel Aviv list, would have received messages and matches)
    // looks "present" to everyone. Definition: last_active_at within
    // the last 24 hours. last_active_at is updated by HomeScreen's
    // GPS-first sync on every 30s tick — so any user with the app
    // open in the last day is "live", anyone else is hidden until
    // they reopen.
    const ACTIVE_PRESENCE_HOURS = 24;
    const cutoff = new Date(Date.now() - ACTIVE_PRESENCE_HOURS * 3600 * 1000).toISOString();

    // Fetch candidates — birth_date / age_min / age_max are now in
    // the SELECT so we can apply the bidirectional filter below.
    const { data, error } = await supabase
      .from('app_profiles')
      .select('user_id, full_name, display_name, username, avatar_url, bio, job_type, current_city, home_country, show_on_map, birth_date, age_min, age_max')
      .ilike('current_city', city)
      .eq('show_on_map', true)
      .gte('last_active_at', cutoff)
      .limit(200);

    if (!data) {
      setLoading(false);
      return;
    }

    // Apply bidirectional age filter only if we know the viewer's
    // age. Same logic as useActiveCheckins so the two surfaces
    // stay consistent — a person hidden from the map list is also
    // hidden from the city nomads list.
    const filtered = viewerAge != null
      ? data.filter((p: any) => {
          // A. Viewer's age must be within the candidate's [age_min, age_max].
          const theirMin = p.age_min ?? 18;
          const theirMax = p.age_max ?? 100;
          if (viewerAge! < theirMin || viewerAge! > theirMax) return false;
          // B. Candidate's age must be within the viewer's range. If
          //    candidate has no birth_date (NULL), let them through —
          //    same default as useActiveCheckins.
          const theirAge = calcAge(p.birth_date);
          if (theirAge != null) {
            if (theirAge < viewerMin || theirAge > viewerMax) return false;
          }
          return true;
        })
      : data;

    setNomads(filtered as NomadInCity[]);
    setCount(filtered.length);
    setLoading(false);
  };

  // Re-fetch whenever the city OR the viewer's age preference changes.
  // The age preference reactivity is the second-stage fix — without
  // these three deps a Settings change to age_max wouldn't update
  // the visible nomad list until next mount (Barak report 2026-04-27).
  useEffect(() => { fetch(); }, [city, viewerBirth, viewerMin, viewerMax]);

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

    // Poll as fallback — Realtime handles instant updates. 45s → 120s
    // on 2026-04-20. The badge count is a non-critical surface; if a
    // Realtime message is missed, 2 minutes to correct is fine.
    const interval = setInterval(fetch, 120000);

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

/** One-shot fetch of the blocked-user set for the signed-in viewer.
 *  Shape: a Set of user IDs the viewer has blocked. Used by
 *  useMessages and anywhere else we render user-authored content that
 *  the viewer opted out of seeing. Apple 1.2: blocks must hide the
 *  author's content end-to-end, not just prevent DMs. */
export async function fetchBlockedIds(myUserId: string | null | undefined): Promise<Set<string>> {
  if (!myUserId) return new Set();
  const { data } = await supabase
    .from('app_blocks')
    .select('blocked_id')
    .eq('blocker_id', myUserId);
  return new Set((data || []).map((r: any) => r.blocked_id as string));
}

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<(AppMessage & { sender?: Pick<AppProfile, 'full_name' | 'avatar_url'> })[]>([]);
  const [loading, setLoading] = useState(true);

  /* A Set of user_ids the signed-in viewer has blocked. Kept in a
   * ref (not state) because the Realtime INSERT callback below needs
   * the current value on every fire — if we used state, the closure
   * would capture the initial empty Set and never see the fetched
   * value. Apple 1.2 relies on this filter: a blocked user's messages
   * must not reach the viewer's screen via any path (initial load OR
   * Realtime push). */
  const blockedIdsRef = useRef<Set<string>>(new Set());

  const fetch = async () => {
    // Resolve the signed-in user + their block list BEFORE the
    // messages query so the same filter applies on first paint.
    const { data: sess } = await supabase.auth.getSession();
    const myId = sess?.session?.user?.id ?? null;
    blockedIdsRef.current = await fetchBlockedIds(myId);

    const { data } = await supabase
      .from('app_messages')
      .select('*, sender:app_profiles!sender_id(full_name, display_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('sent_at', { ascending: true });

    if (data) {
      const filtered = (data as any[]).filter(m => !blockedIdsRef.current.has(m.sender_id));
      setMessages(filtered as any);
    }
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
        const newMsg = payload.new as any;
        // Drop incoming messages from blocked authors. Same guard as
        // the initial fetch above — see blockedIdsRef comment for why
        // this is a ref and not state.
        if (newMsg?.sender_id && blockedIdsRef.current.has(newMsg.sender_id)) {
          console.log(`[Realtime] 🚫 blocked sender's message dropped: ${newMsg.id}`);
          return;
        }
        console.log(`[Realtime] ✅ chat message received:`, newMsg?.id);
        setMessages(prev => [...prev, newMsg]);
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

    /* ── Moderation gate ──────────────────────────────────
     *
     * Only scans the text portion. Image-only sends pass
     * through (we don't moderate images at v1 — see launch
     * freedom policy). Empty text + image is allowed.
     *
     * The gate handles its own DB logging + rate-limit
     * escalation. We only translate the outcome into the
     * shape `send()` callers expect. */
    if (content.trim()) {
      const outcome = await gateContent({
        userId,
        surface: 'chat',
        text: content,
      });
      if (outcome.state === 'flagged') {
        const err = new Error(SEND_BLOCKED_MODERATION) as SendBlockedError;
        err.gateOutcome = outcome;
        return { error: err as any };
      }
      if (outcome.state === 'rate_limited') {
        const err = new Error(SEND_BLOCKED_RATE_LIMIT) as SendBlockedError;
        err.gateOutcome = outcome;
        return { error: err as any };
      }
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

/** Report a message. On success we also push a Sentry event so Barak
 *  sees it in the inbox within minutes — Apple 1.2 expects a "timely
 *  response" on user reports of abusive content and this closes the
 *  loop without a separate email service. The Admin Dashboard is
 *  still the source of truth for moderation decisions; Sentry is the
 *  notification layer. */
export async function reportMessage(messageId: string, reporterId: string, reason: string = 'inappropriate'): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('app_message_reports')
    .insert({ message_id: messageId, reporter_id: reporterId, reason });
  if (!error) {
    captureUserReport('message', { reportedId: messageId, reporterId, reason });
  }
  return { success: !error };
}

/** Report content (user / post / comment). Like reportMessage, a
 *  successful insert also pushes a Sentry warning so Barak sees the
 *  report without needing to open the Admin Dashboard. */
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
  if (!error) {
    captureUserReport(contentType, {
      reportedId: opts.contentId ?? opts.reportedUserId,
      reporterId,
      reason,
    });
  }
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
  /* Same 30 s time guard as useActiveCheckins. The big offender
   * here is HomeScreen's useFocusEffect that calls refetch on
   * every tab switch. Without the guard, a user bouncing between
   * Home → Messages → Home → Profile → Home in 60 s fires 5
   * profile fetches. With the guard: 1 fetch.
   *
   * Same systemic principle: every user gets the same behavior;
   * scales linearly with user count.
   *
   * lastFetchAtRef is updated ONLY after a successful fetch, so
   * a transient failure doesn't lock the user out for 30 s. */
  const lastFetchAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  const fetchProfile = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) { setLoading(false); return; }
    // In-flight guard — never two fetches at once.
    if (inFlightRef.current) return;
    // Time guard — skip if we successfully fetched recently.
    if (!opts?.force
        && lastFetchAtRef.current > 0
        && Date.now() - lastFetchAtRef.current < FETCH_TIME_GUARD_MS) {
      setLoading(false);
      return;
    }
    inFlightRef.current = true;

    // Profile
    let p: any = null;
    try {
      const res = await supabase
        .from('app_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      p = res.data;
    } finally {
      // Always release the in-flight lock — a thrown exception
      // here would otherwise stall the hook forever.
      inFlightRef.current = false;
    }

    if (p) {
      setProfile(p as unknown as AppProfile);
      // Mark fetch as successful AFTER we have data — so the
      // 30 s time guard only kicks in on a real success.
      lastFetchAtRef.current = Date.now();
    }

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

  /* Optimistic-UI helper. Lets a save handler patch the local
   * profile state INSTANTLY (so the new bio / avatar / etc shows
   * the moment the user taps Save) and fire the DB UPSERT in
   * parallel. On DB error the caller can either revert with
   * another updateLocal call or just let the next refetch
   * reconcile. Pre-fix the only update path was refetch(), which
   * waited for a full network round-trip before the UI reflected
   * the change — tester report 2026-04-26: "אני אומנם יכול לכתוב
   * - אבל זה לא משתנה באותו הרגע". */
  const updateLocal = useCallback((patch: Partial<AppProfile>) => {
    setProfile(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return { profile, stats, followerPreviews, loading, refetch: fetchProfile, updateLocal };
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

    /* Look for an existing group conversation for this status.
     *
     * Dedup key priority:
     *   1. checkin_id (unique per status) — the correct dedup key
     *      since it's guaranteed 1:1 with the status itself.
     *   2. name + an app_conversation_members row for the status
     *      owner as admin — the fallback for legacy groups created
     *      before checkin_id was populated.
     *
     * The OLD dedup (.eq('created_by', statusOwnerId)) broke on
     * April 2026 when the RLS hardening required created_by to
     * equal auth.uid() — which meant the FIRST joiner (not the
     * status owner) is now the DB's created_by. Switching to
     * checkin_id-based dedup restores the product semantics AND
     * fits the tightened RLS. */
    let foundConvId: string | null = null;
    if (metadata?.checkinId) {
      const { data: byCheckin } = await supabase
        .from('app_conversations')
        .select('id')
        .eq('type', 'group')
        .eq('checkin_id', metadata.checkinId)
        .limit(1);
      foundConvId = byCheckin?.[0]?.id ?? null;
    }
    if (!foundConvId) {
      // Legacy fallback: find groups where the status owner is an
      // active admin member, matched by name. Works for groups
      // created before checkin_id was set on conversations.
      const { data: legacyMatch } = await supabase
        .from('app_conversation_members')
        .select('conversation_id, app_conversations!inner(id, name, type)')
        .eq('user_id', statusOwnerId)
        .eq('role', 'admin')
        .eq('status', 'active');
      const rows = (legacyMatch || []) as any[];
      const match = rows.find(
        (r) => r.app_conversations?.type === 'group' && r.app_conversations?.name === groupName,
      );
      foundConvId = match?.conversation_id ?? null;
    }

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

    /* No existing group — create a new one (with activity metadata).
     *
     * IMPORTANT: created_by is the INSERTER (auth.uid() = myUserId),
     * NOT the status owner. The RLS SELECT policy
     * conversations_group_creator_select requires this so the
     * RETURNING clause on .select().single() can read the row back.
     * The status owner is identified separately via admin-role
     * membership (inserted below) and via the checkin_id link. */
    const { data: newConv, error: convError } = await supabase
      .from('app_conversations')
      .insert({
        type: 'group',
        name: groupName,
        created_by: myUserId,
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
    // Notifications poll — 30s → 120s (2026-04-20 DB load cleanup).
    // Push-driven in production; polling is only the catch-up layer.
    const interval = setInterval(fetch, 120000);
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
  /**
   * Persist one or more fields to the user's app_profiles row.
   *
   * Uses UPSERT (not UPDATE) per the `logic` skill: if the row is
   * somehow missing — e.g. the user deleted then re-signed-up, or
   * a race during onboarding — UPDATE silently no-ops and the
   * caller's UI reports success while nothing is written. UPSERT
   * inserts the row if absent and updates it if present, with the
   * same RLS check (`auth.uid() = user_id`).
   *
   * Returns `{ error }` so callers can decide whether to surface
   * it. Tester reports 2026-04-26 ("הסיו לא נשמר / כל שמירה אינה
   * עובדת") were caused by callers fire-and-forgetting this and
   * never surfacing failures. New helper `saveProfileField` below
   * encapsulates the await + error-surface so screens stop having
   * to remember each step.
   */
  const update = async (userId: string, fields: Record<string, any>) => {
    const { error } = await supabase
      .from('app_profiles')
      .upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' });
    if (error) {
      // Always log — this is a primary write path. Sentry hook not
      // wired here yet; console keeps a trail in EAS logs.
      console.error('[useUpdateSettings] upsert failed:', error.message, fields);
    }
    return { error };
  };

  /* Full account deletion — required by Apple Guideline 5.1.1(v).
   * The actual mutation logic lives in lib/accountDeletion.ts so
   * the web's /delete-account flow uses the IDENTICAL pipeline.
   * One source of truth for "what does delete-account actually do"
   * means new tables only need cleanup wired up in one place. */
  const deleteAccount = async (userId: string) =>
    deleteAccountData(userId, supabase);

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
   REMOVE GROUP MEMBER (admin / creator only)
   ═══════════════════════════════════════════
   Closed-loop rules (per logic skill):
   1. Delete the member row (the one being kicked — NOT the admin's).
   2. Post a system message in the chat authored by the ADMIN
      (sender_id = adminUserId must equal auth.uid() for RLS).
      Copy: "❌ {name} was removed"
   3. Decrement member_count on the linked checkin, preferring
      app_conversations.checkin_id, falling back to admin's active
      checkin (most recent).
   4. The removed user's chat row disappears automatically from their
      Messages tab (useConversations filters by membership), so the
      propagation to their device is handled by the delete + their
      realtime subscription.
*/
export async function removeGroupMember(
  adminUserId: string,
  memberUserId: string,
  conversationId: string,
  memberDisplayName: string = 'member',
): Promise<{ success: boolean; error: any }> {
  if (!adminUserId || !memberUserId || !conversationId) {
    return { success: false, error: new Error('missing args') };
  }
  if (adminUserId === memberUserId) {
    // Admin removing themselves = leave, not remove. Refuse so UI can
    // route through leaveGroupChat (which posts "left the group" with
    // the right attribution).
    return { success: false, error: new Error('admin cannot self-remove via this path') };
  }
  try {
    // 0. Safety: only allow if caller is creator OR admin of the conv.
    //    RLS alone isn't enough here — we want a clear "forbidden" path.
    const { data: conv } = await supabase
      .from('app_conversations')
      .select('created_by, checkin_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv) return { success: false, error: new Error('conversation not found') };
    if (conv.created_by !== adminUserId) {
      // Also accept admin role
      const { data: me } = await supabase
        .from('app_conversation_members')
        .select('role')
        .eq('conversation_id', conversationId)
        .eq('user_id', adminUserId)
        .maybeSingle();
      if (me?.role !== 'admin') {
        return { success: false, error: new Error('only the creator can remove members') };
      }
    }

    // 1. Delete the target's membership row
    const { error: delErr } = await supabase
      .from('app_conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', memberUserId);
    if (delErr) {
      console.warn('[removeGroupMember] delete failed:', delErr.message);
      return { success: false, error: delErr };
    }

    // 2. System message authored by the admin (RLS-safe)
    const content = `❌ ${memberDisplayName} was removed`;
    const { error: msgErr } = await supabase.from('app_messages').insert({
      conversation_id: conversationId,
      sender_id: adminUserId,
      content,
    });
    if (msgErr) {
      // Non-fatal — the removal succeeded, but log so we can see gaps.
      console.warn('[removeGroupMember] system message failed:', msgErr.message);
    }

    // 3. Decrement member_count on the linked checkin
    const checkinId = (conv as any).checkin_id || null;
    if (checkinId) {
      const { data: checkin } = await supabase
        .from('app_checkins')
        .select('id, member_count')
        .eq('id', checkinId)
        .maybeSingle();
      if (checkin && (checkin.member_count ?? 0) > 0) {
        await supabase
          .from('app_checkins')
          .update({ member_count: Math.max(0, (checkin.member_count ?? 1) - 1) })
          .eq('id', checkin.id);
      }
    } else if (conv.created_by) {
      // Legacy fallback — most recent active checkin by the creator
      const { data: checkin } = await supabase
        .from('app_checkins')
        .select('id, member_count')
        .eq('user_id', conv.created_by)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
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
    console.warn('[removeGroupMember] error:', err);
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
