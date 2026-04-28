import { useState, useRef, useContext, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
  Modal, Animated, TextInput, Keyboard, FlatList, Dimensions, Easing, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NomadIcon from '../components/NomadIcon';
import type { NomadIconName } from '../components/NomadIcon';
import MapView, { Marker } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { haversineKm, formatDistance } from '../lib/distance';
import type { RootStackParamList } from '../lib/types';
import { useActiveCheckins, useHotCheckins, useNomadsInCity, useFollow, useProfile, useNotifications, createOrJoinStatusChat, wisdomCheck, trackWisdomSignal, type CheckinWithProfile, type NomadInCity, type WisdomIntent } from '../lib/hooks';
import { AuthContext } from '../App';
import { useAvatar } from '../lib/AvatarContext';
import { useViewedCity } from '../lib/ViewedCityContext';
import { useI18n } from '../lib/i18n';
import { gateContent } from '../lib/moderation';
import {
  resolveCurrentCountry,
  pinCountryFromCoords,
  isSameCountryAsViewer,
} from '../lib/geo';
import { countryLabel } from '../lib/countryNames';
import { wakeUpVisibility } from '../lib/visibility';
import { resolveCityFromCoordinates, reverseGeocodeCityFull } from '../lib/cityResolver';
import { supabase } from '../lib/supabase';
import { fetchJsonWithTimeout } from '../lib/fetchWithTimeout';
// The single source of truth for address reverse-geocoding. Used by
// pickMode below to label the pin with the current neighborhood /
// street while the user pans. DO NOT reach into Nominatim directly —
// all callers go through lib/locationServices (CLAUDE.md Rule Zero).
import {
  reverseGeocode as reverseGeocodeAddress,
  searchAddress as searchPickAddress,
  resolveLiveLocation,
  type GeoResult,
} from '../lib/locationServices';
import { trackEvent } from '../lib/tracking';
import ProfileCardSheet from '../components/ProfileCardSheet';
import NotificationsSheet from '../components/NotificationsSheet';
import CityPickerSheet, { CITIES, type City } from '../components/CityPickerSheet';
/* QuickStatusSheet + TimerSheet were retired when the unified
 * CreationBubble shipped (Stage 17 of the no-band-aids
 * refactor). We only import the payload TYPES because
 * handleQuickPublish / handleTimerPublish still use them as
 * function signatures. The components themselves are no
 * longer rendered anywhere — the type imports keep the old
 * files from going totally orphaned until they're deleted in
 * a dedicated cleanup pass. */
import type { QuickActivityData } from '../components/QuickStatusSheet';
import type { TimerData } from '../components/TimerSheet';
import CreationBubble, { type CreationPayload } from '../components/CreationBubble';
import CachedImage from '../components/CachedImage';
import NomadsListSheet from '../components/NomadsListSheet';
import TimerBubble from '../components/TimerBubble';
import WisdomPrompt from '../components/WisdomPrompt';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ─── Tel Aviv center ─── */
const TLV = { latitude: 32.0853, longitude: 34.7818 };
/* INITIAL_REGION is what the map shows BEFORE the first GPS fix
 * lands. Tightened from 0.08 → 0.04 (2026-04-27 evening) so the
 * cold-start view already reads as "city center" — bubbles are
 * legible at landing instead of dots-on-a-region. The first GPS
 * fix (HomeScreen `gpsInitDone`) and the search-bar flow already
 * use ≤0.04 deltas; this brings cold-start in line with them so
 * regardless of HOW the user lands on a city, they see the same
 * frame. */
const INITIAL_REGION = {
  ...TLV,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

/* ─── Dim map style for dark mode (matches app palette) ─── */
const DIM_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#3A3A44' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#2C2C34' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9E9EB2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#464654' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#3E3E4C' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#505060' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#2A3240' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#404050' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#3A4A42' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#3E3E4C' }] },
];

/* ─── Activity category → color + emoji mapping ─── */
/* Emoji-forward: neutral accent, emoji carries personality */
const CAT_CLR = '#6B7280';
const CAT_STYLE: Record<string, { color: string; emoji: string }> = {
  food:          { color: CAT_CLR, emoji: '🍽️' },
  nightlife:     { color: CAT_CLR, emoji: '🎉' },
  outdoors:      { color: CAT_CLR, emoji: '🌴' },
  sightseeing:   { color: CAT_CLR, emoji: '🗿' },
  entertainment: { color: CAT_CLR, emoji: '🎬' },
  shopping:      { color: CAT_CLR, emoji: '🛍️' },
  wellness:      { color: CAT_CLR, emoji: '🧘' },
  rideshare:     { color: CAT_CLR, emoji: '🚗' },
  social:        { color: CAT_CLR, emoji: '💬' },
  other:         { color: CAT_CLR, emoji: '✨' },
};
const getCatStyle = (cat?: string | null) => CAT_STYLE[cat || ''] || CAT_STYLE.social;
const getInitials = (name?: string | null) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

/* ─── Scatter pin positions slightly so they don't overlap ─── */
/* Uses a deterministic hash of the checkin ID so positions are stable across re-renders */
const hashCode = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};
const scatter = (base: number, seed: number) => base + (seed % 3 - 1) * 0.004 + (seed % 2) * 0.002;

const VIBES: { label: string; icon?: NomadIconName; color?: string; catKey?: string }[] = [
  { label: 'All' },
  { label: 'Food',          icon: 'coffee',         color: CAT_CLR, catKey: 'food' },
  { label: 'Nightlife',     icon: 'music',          color: CAT_CLR, catKey: 'nightlife' },
  { label: 'Outdoor',       icon: 'sunrise',        color: CAT_CLR, catKey: 'outdoors' },
  { label: 'Sightseeing',   icon: 'compass',        color: CAT_CLR, catKey: 'sightseeing' },
  { label: 'Entertainment', icon: 'sparkle',        color: CAT_CLR, catKey: 'entertainment' },
  { label: 'Shopping',      icon: 'gift',           color: CAT_CLR, catKey: 'shopping' },
  { label: 'Wellness',      icon: 'heart',          color: CAT_CLR, catKey: 'wellness' },
  { label: 'Rideshare',     icon: 'navigation',     color: CAT_CLR, catKey: 'rideshare' },
  { label: 'Social',        icon: 'chat',           color: CAT_CLR, catKey: 'social' },
  { label: 'Other',         icon: 'star',           color: CAT_CLR, catKey: 'other' },
];

/* ─── City search via Photon ─── */
interface CitySearchResult {
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2 country code, uppercase. Populated from
   *  Photon's `properties.countrycode`. Optional because rare
   *  results (disputed zones, etc) may omit it — callers should
   *  fail-open per the geo spec. */
  countryCode?: string;
  lat: number;
  lng: number;
  label: string; // "Tel Aviv, Israel"
}

/** Find the closest CITIES entry within maxKm, or null */
function findNearestCity(lat: number, lng: number, maxKm = 50): City | null {
  let best: City | null = null;
  let bestDist = maxKm;
  for (const c of CITIES) {
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

async function searchCities(q: string): Promise<CitySearchResult[]> {
  if (q.length < 2) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&layer=city&layer=state&layer=country`;
  // fetchJsonWithTimeout never throws — on network/timeout failure it
  // returns null and the user sees an empty dropdown (the search just
  // "didn't find anything") instead of a scary red LogBox error.
  const data = await fetchJsonWithTimeout<any>(url, { tag: 'photon.cities', timeoutMs: 7000 });
  if (!data?.features?.length) return [];
  // Deduplicate by city name + country
  const seen = new Set<string>();
  const results: CitySearchResult[] = [];
  for (const f of data.features) {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates || [0, 0];
    const name = p.name || p.city || p.state || '';
    const country = p.country || '';
    // Photon returns `countrycode` as an uppercase ISO 3166-1 alpha-2
    // code (e.g. 'IL', 'TH'). Capture it so the downstream City object
    // can participate in the geo gates instead of silently bypassing
    // them for user-searched cities.
    const rawCC: string | undefined = p.countrycode;
    const countryCode = rawCC ? rawCC.toUpperCase() : undefined;
    const key = `${name}-${country}`.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    results.push({
      name,
      country,
      countryCode,
      lat: coords[1],
      lng: coords[0],
      label: country ? `${name}, ${country}` : name,
    });
    if (results.length >= 5) break;
  }
  return results;
}

const RECENT_CITIES_KEY = 'nomadspeople_recent_cities';

/* Recent cities — stored in Supabase (app_profiles.recent_cities jsonb).
 * Previous version used AsyncStorage only, which proved unreliable across
 * Expo Go reloads and bundle refreshes — user saw 'empty' even after
 * searching many cities. DB-backed storage persists reliably and syncs
 * if the user ever signs in on another device. AsyncStorage is kept as
 * an instant warm cache so the chip row doesn't flash empty on cold open. */

async function loadRecentCities(userId?: string | null): Promise<CitySearchResult[]> {
  // 1. Warm cache from AsyncStorage for instant UI (no round-trip to DB)
  let cached: CitySearchResult[] = [];
  try {
    const raw = await AsyncStorage.getItem(RECENT_CITIES_KEY);
    cached = raw ? JSON.parse(raw) : [];
  } catch { /* ignore */ }

  if (!userId) return cached;

  // 2. Pull canonical value from Supabase — source of truth.
  try {
    const { data } = await supabase
      .from('app_profiles')
      .select('recent_cities')
      .eq('user_id', userId)
      .maybeSingle();
    const rc = ((data as any)?.recent_cities as CitySearchResult[]) || [];
    if (Array.isArray(rc)) {
      // Sync AsyncStorage so the next cold open hits the warm cache.
      AsyncStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(rc)).catch(() => {});
      return rc;
    }
  } catch (e) {
    console.warn('[recentCities] supabase load failed, using cache:', e);
  }
  return cached;
}

async function saveRecentCity(city: CitySearchResult, userId?: string | null): Promise<void> {
  const current = await loadRecentCities(userId);
  // Dedupe by name + country, push to front, cap at 5.
  const filtered = current.filter(c => !(c.name === city.name && c.country === city.country));
  const updated = [city, ...filtered].slice(0, 5);

  // Local cache for instant re-read
  try { await AsyncStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(updated)); } catch { /* ignore */ }

  // Canonical write to Supabase (survives app reinstalls, different devices)
  if (userId) {
    try {
      await supabase.from('app_profiles').update({ recent_cities: updated }).eq('user_id', userId);
    } catch (e) {
      console.warn('[recentCities] supabase save failed (cache still saved):', e);
    }
  }
}

/* ─── Pulse ring component — breathing animation for hot pins ─── */
function PulseRing({ heat, size }: { heat: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Speed: heat 3 → 800ms, heat 2 → 1200ms, heat 1 → 1800ms
    const duration = heat >= 3 ? 800 : heat >= 2 ? 1200 : 1800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [heat]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: 'rgba(42,157,143,0.35)',
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

/* ─── Marker rendering pipeline — IMAGE-BASED (2026-04-27 evening) ───
 *
 * The story so far (and why we ended up here):
 *
 *   The "Marker as a custom React subtree" approach worked on iOS and
 *   Pixel/most stock Android, but failed badly on Samsung One UI. The
 *   failure modes ran the full menu over a single morning of testing:
 *   square avatars instead of circles, half-rendered bubbles, default
 *   red Google pins (snapshot returned null), markers that disappeared
 *   after a second, markers that only appeared after the user zoomed.
 *
 *   Root cause: react-native-maps on Android relies on Skia to capture
 *   a custom-view Marker into a native bitmap. Samsung's One UI Skia
 *   compositor is more sensitive to layout/snapshot timing than
 *   stock AOSP. By the time the snapshot fires, the avatar Image may
 *   not have decoded; Yoga may not have applied borderRadius:9999;
 *   shadows may extend outside the measured bounds. Any of those
 *   produces a malformed bitmap that ships to the user.
 *
 *   We tried four band-aids over 2026-04-26 → 2026-04-27 (negative-
 *   offset removal, hard-clamped borderRadius, shadow removal,
 *   tracksViewChanges lifecycle tuning). Each fixed one device and
 *   broke another. Per Rule Zero, that's the cue to extract the
 *   shared core instead of patching a fifth time.
 *
 *   The structural fix is image-based markers:
 *
 *     1. Render the bubble JSX OFFSCREEN (position:absolute, far off
 *        the visible area) once per checkin in a dedicated stage
 *        outside the MapView.
 *     2. Wait for the avatar Image to fire onLoad (or onError, or a
 *        belt-and-braces 1.5s timeout) so we know the subtree is
 *        fully painted.
 *     3. Capture the View → PNG via react-native-view-shot.
 *     4. Pass the PNG URI to <Marker image={...}>. Native renders
 *        the PNG directly as the marker icon — no bitmap snapshot
 *        path, no Skia compositor quirks, identical pixels on every
 *        device.
 *
 *   While capture is in flight (~50–300ms after avatar load), the
 *   Marker still renders the same JSX as a child. That subtree is
 *   the same content that's about to become the PNG, so the user
 *   sees the bubble immediately on platforms where the snapshot
 *   path works; on Samsung they see whatever broken visual the
 *   snapshot path produces, then it gets replaced by the PNG when
 *   capture completes (typically <300ms — invisible flicker).
 *
 *   Pulse animation for "hot" markers is currently dropped. The
 *   PNG is static, so the breathing halo is now a static halo
 *   (rendered into the PNG when isHot). Re-introducing the
 *   animation would require a parallel Animated <Marker> per hot
 *   pin — defer until we have evidence the static halo is
 *   insufficient.
 *
 *   `react-native-view-shot ^4.0.3` is already a runtime dep
 *   (shipped in AAB v14), so this refactor is JS-only. No native
 *   module added, no `expo prebuild`, no new AAB needed — fully
 *   compatible with Rule Minus-One while Closed Testing is open.
 *   This change ships via EAS Update on the production channel.
 */

/* ── BubbleVisual — the marker visual, extracted as a shared component.
 *    Used by:
 *     (a) the offscreen capture stage (MarkerCaptureCell), where it's
 *         snapshot to PNG via captureRef;
 *     (b) the Marker fallback child render, kept as a skeleton so the
 *         native bitmap path has SOMETHING to draw during the brief
 *         window between marker mount and PNG ready.
 *    The two callsites pass byte-identical props so the captured
 *    PNG matches the fallback view exactly — no visual jump when
 *    react-native-maps switches from child-bitmap to image. */
function BubbleVisual({
  c,
  st,
  avatarUri,
  hotMap,
  onAvatarLoad,
  onAvatarError,
}: {
  c: CheckinWithProfile;
  st: ReturnType<typeof makeStyles>;
  avatarUri: (url: string | null | undefined) => string | undefined;
  hotMap?: Map<string, number>;
  /** Capture pipeline only — fired when the avatar image finishes
   *  decoding so the offscreen capture knows it's safe to snapshot.
   *  The fallback render path inside Marker passes `undefined` so
   *  no spurious capture is triggered for the on-map subtree. */
  onAvatarLoad?: () => void;
  onAvatarError?: () => void;
}) {
  const catStyle = getCatStyle(c.category);
  const nameForDisplay = (c.profile as any)?.display_name || c.profile?.full_name || '';
  const ini = getInitials(nameForDisplay || undefined);
  const firstName = nameForDisplay?.split(' ')[0] || 'Nomad';
  const pinEmoji = c.status_emoji || catStyle.emoji;
  const avatarUrl = (c.profile as any)?.avatar_url || null;
  const isTimer = (c as any).checkin_type === 'timer';
  const expiresAt = (c as any).expires_at;
  const minsLeft = expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000)) : null;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

  const borderColor = isExpired ? '#9CA3AF' : isTimer ? '#FF6B6B' : '#4ADE80';
  const timerStr = minsLeft !== null
    ? (minsLeft < 60 ? `${minsLeft}m` : `${Math.floor(minsLeft / 60)}h${minsLeft % 60 > 0 ? `${minsLeft % 60}m` : ''}`)
    : '';

  const heat = hotMap?.get(c.id) ?? 0;
  const isHot = heat > 0 && !isExpired;
  const ringSize = s(33);

  return (
    <View style={[st.pinWrap, isExpired && { opacity: 0.5 }]}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {isHot && (
          /* Static halo replacement for the previously-animated
           * PulseRing. captureRef can't snapshot an Animated value
           * mid-cycle, so we render a fixed-state halo at roughly
           * the brightest point of the breathing animation. The
           * heat tier still drives the visible scale (3 = biggest,
           * 1 = subtlest) so a "hot" pin still reads as more
           * alive than a cold one — just no longer pulsing. */
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              backgroundColor: heat >= 3 ? 'rgba(42,157,143,0.40)'
                : heat >= 2 ? 'rgba(42,157,143,0.30)'
                : 'rgba(42,157,143,0.22)',
              transform: [{ scale: heat >= 3 ? 1.35 : heat >= 2 ? 1.25 : 1.15 }],
            }}
          />
        )}
        <View style={[st.avatarRing, { borderColor }]}>
          <View style={[st.avatar, { backgroundColor: catStyle.color }]}>
            {avatarUrl ? (
              <CachedImage
                source={{ uri: avatarUri(avatarUrl) }}
                style={st.avatarImg}
                recyclingKey={c.id}
                onLoad={onAvatarLoad}
                onError={onAvatarError}
              />
            ) : (
              <Text style={st.avatarTxt}>{ini}</Text>
            )}
          </View>
          <View style={st.emojiBadge}>
            <Text style={st.emojiText}>{pinEmoji}</Text>
          </View>
        </View>
      </View>
      <View style={st.nameTag}>
        <Text style={st.nameTxt}>{firstName}</Text>
      </View>
      {isTimer && minsLeft !== null && (() => {
        const urgent = minsLeft <= 10;
        const soon = minsLeft <= 30 && !urgent;
        return (
          <View style={[
            st.timerPill,
            urgent && st.timerPillUrgent,
            soon && st.timerPillSoon,
          ]}>
            <Text style={[
              st.timerPillText,
              urgent && st.timerPillTextUrgent,
            ]}>
              {timerStr}
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

/* ── Visual fingerprint — the inputs that affect what BubbleVisual
 *    paints. When this string changes for a given checkin, the
 *    cached PNG is stale and the capture stage must re-snapshot.
 *
 *    Deliberately includes minsLeft so timer markers re-capture
 *    every minute — yes, this means ~50 ms of capture work per
 *    timer per minute, but it keeps the displayed countdown
 *    correct without a parallel animated overlay. With ~50 active
 *    timers in a city that's <2.5 s of JS work per minute spread
 *    across 60 s — well under any noticeable cost. If we ever
 *    profile this as a hot path, switch to "drop the timer text
 *    from the marker, show only in the popup" or "re-capture on
 *    tier change only".
 *
 *    isHot is bucketed by heat level (the static halo's scale and
 *    opacity differ per tier) so a heat 1→2 transition triggers a
 *    re-capture but heat staying at 2 across re-renders does not. */
function computeMarkerVisualKey(c: CheckinWithProfile, hotMap?: Map<string, number>): string {
  const avatarUrl = (c.profile as any)?.avatar_url || '';
  const isTimer = (c as any).checkin_type === 'timer';
  const expiresAt = (c as any).expires_at;
  const minsLeft = expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000)) : null;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  const nameForDisplay = (c.profile as any)?.display_name || c.profile?.full_name || '';
  const heat = hotMap?.get(c.id) ?? 0;
  return [
    c.id,
    avatarUrl,
    c.category ?? '',
    c.status_emoji ?? '',
    nameForDisplay,
    isTimer ? 't' : 's',
    isExpired ? 'x' : 'a',
    minsLeft ?? 'n',
    heat,
  ].join('|');
}

/* ── MarkerCaptureCell — one offscreen capture per checkin.
 *
 *    Mounts the BubbleVisual via a wrapper View whose ref is fed
 *    to captureRef. Waits for the avatar's onLoad (or onError, or
 *    a 1.5s timeout) before capturing so the snapshot includes
 *    the fully decoded image. On capture success, calls onCaptured
 *    with the resulting tmpfile URI; on failure, logs and gives up
 *    (the fallback child render inside Marker still shows the
 *    bubble, just via the broken-on-Samsung native snapshot path —
 *    same as before this refactor).
 *
 *    `collapsable={false}` is critical on Android — without it,
 *    React would optimize away the wrapper View (it has no native
 *    backing of its own), and view-shot would have nothing to
 *    capture. */
function MarkerCaptureCell({
  c,
  st,
  avatarUri,
  hotMap,
  onCaptured,
}: {
  c: CheckinWithProfile;
  st: ReturnType<typeof makeStyles>;
  avatarUri: (url: string | null | undefined) => string | undefined;
  hotMap?: Map<string, number>;
  onCaptured: (uri: string) => void;
}) {
  const viewRef = useRef<View>(null);
  const hasAvatar = !!((c.profile as any)?.avatar_url);
  const [imgReady, setImgReady] = useState(!hasAvatar); // initials-only = ready immediately

  useEffect(() => {
    if (!imgReady) return;
    let mounted = true;

    // Small layout-settle delay before capture. Without it, on slower
    // devices the View is mounted but Yoga may not have applied the
    // final borderRadius / overflow:hidden yet, leading to the same
    // square-avatar bug we just escaped. 80 ms is enough on every
    // device tested without being noticeable to the user.
    const t = setTimeout(async () => {
      if (!mounted || !viewRef.current) return;
      try {
        const uri = await captureRef(viewRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        if (mounted && uri) onCaptured(uri);
      } catch (e) {
        // Capture failed — keep silent in production. The Marker's
        // fallback child render still shows something on devices
        // where the native snapshot path works.
        console.warn('[MarkerCapture] failed for', c.id, e);
      }
    }, 80);

    // Belt-and-braces: if onLoad never fires (Image pool stalled,
    // network never resolves, etc.) we still want to ship SOMETHING.
    // imgReady stays true once flipped, so this fallback only kicks
    // in for the rare case where neither onLoad nor onError ever
    // fired in 1.5 s — at which point the snapshot will capture
    // whatever's painted (typically the colored placeholder).
    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [imgReady, c.id]);

  // Hard fallback: if the avatar Image never reports load OR error
  // (network stuck, very rare), force imgReady after 1.5 s so the
  // marker doesn't sit in a "captured nothing" state forever.
  useEffect(() => {
    if (imgReady) return;
    const t = setTimeout(() => setImgReady(true), 1500);
    return () => clearTimeout(t);
  }, [imgReady]);

  return (
    <View ref={viewRef} collapsable={false}>
      <BubbleVisual
        c={c}
        st={st}
        avatarUri={avatarUri}
        hotMap={hotMap}
        onAvatarLoad={() => setImgReady(true)}
        onAvatarError={() => setImgReady(true)}
      />
    </View>
  );
}

/* ── MarkerCaptureStage — offscreen container that owns one cell
 *    per checkin whose visual fingerprint hasn't been captured yet.
 *
 *    Rendered as a sibling of <MapView> at HomeScreen level — NOT
 *    inside it. <MapView> only accepts Marker-family children;
 *    nesting plain Views inside it can render unpredictably across
 *    iOS/Android. Keeping the stage outside the map keeps the
 *    capture pipeline cleanly separated from the on-screen markers.
 *
 *    Position-absolute / -10000 px keeps the stage out of the user's
 *    view while leaving its layout fully resolved (so view-shot can
 *    measure and capture). pointerEvents="none" means the stage can't
 *    accidentally absorb a tap that was meant for the map. */
function MarkerCaptureStage({
  checkins,
  capturedKeys,
  st,
  avatarUri,
  hotMap,
  onCaptured,
}: {
  checkins: CheckinWithProfile[];
  capturedKeys: Map<string, string>;
  st: ReturnType<typeof makeStyles>;
  avatarUri: (url: string | null | undefined) => string | undefined;
  hotMap?: Map<string, number>;
  onCaptured: (id: string, key: string, uri: string) => void;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: -10000,
        top: -10000,
        // No width/height clamp here. Earlier we set width:0, height:0
        // thinking it would just keep the stage hidden, but on Android
        // a zero-sized parent clips its children to zero size BEFORE
        // they paint — view-shot then captured an empty PNG and the
        // Marker stayed at the default red pin (Pixel + Samsung
        // tester reports 2026-04-29 morning). Letting the stage
        // measure intrinsically lets every BubbleVisual render at
        // its natural dimensions, captureRef gets real pixels, and
        // the Marker finally renders the branded bubble.
        opacity: 0,
      }}
      pointerEvents="none"
    >
      {checkins.map((c) => {
        const key = computeMarkerVisualKey(c, hotMap);
        // Skip checkins whose current visual key is already captured.
        // The cell unmounts → its tmpfile stays on disk (OS will GC),
        // and we re-render only when something actually changed.
        if (capturedKeys.get(c.id) === key) return null;
        return (
          <MarkerCaptureCell
            // Re-mount on key change so the capture useEffect fires
            // with a fresh imgReady cycle for the new visual.
            key={`${c.id}::${key}`}
            c={c}
            st={st}
            avatarUri={avatarUri}
            hotMap={hotMap}
            onCaptured={(uri) => onCaptured(c.id, key, uri)}
          />
        );
      })}
    </View>
  );
}

/* ── NomadMarker — thin wrapper around <Marker>. Receives the
 *    captured PNG URI from HomeScreen state (via prop) and feeds
 *    it to the Marker `image` prop. Falls back to rendering the
 *    same BubbleVisual as a child while the URI is still pending,
 *    so platforms with a working native snapshot path show the
 *    bubble immediately on mount. */
function NomadMarker({
  c,
  coord,
  onPinTap,
  avatarUri,
  st,
  hotMap,
  pngUri,
}: {
  c: CheckinWithProfile;
  /* Stable `{ latitude, longitude }` reference owned by HomeScreen's
   * markerCoordsRef. Reusing the same object across renders prevents
   * react-native-maps from animating the native pin on every parent
   * re-render even when the coordinates haven't actually changed. */
  coord: { latitude: number; longitude: number };
  onPinTap: (c: CheckinWithProfile) => void;
  avatarUri: (url: string | null | undefined) => string | undefined;
  st: ReturnType<typeof makeStyles>;
  hotMap?: Map<string, number>;
  pngUri?: string;
}) {
  return (
    <Marker
      key={c.id}
      // tracksViewChanges only matters while we're rendering the
      // child fallback (i.e. before pngUri arrives). Once the image
      // prop is set, react-native-maps uses the PNG directly and
      // ignores the child subtree.
      tracksViewChanges={!pngUri}
      coordinate={coord}
      anchor={{ x: 0.5, y: 1 }}
      onPress={() => onPinTap(c)}
      image={pngUri ? { uri: pngUri } : undefined}
    >
      {/* Branded BubbleVisual fallback during the brief PNG-capture
       * window (~80–1500 ms after first paint).
       *
       * Why this child is back, after we removed it earlier today:
       *
       *   The 2026-04-29 morning revert (ship default red pin while
       *   waiting for capture) traded "broken bubble briefly" for
       *   "default red pin permanently if capture fails". On
       *   Pixel 9 Pro the offscreen capture stage was rendering
       *   inside a 0×0 parent — children clipped to zero — so the
       *   captured PNG came back empty, the Marker never received
       *   `pngUri`, and the user saw RED TEARDROPS instead of our
       *   bubbles. Owner screenshot 09:18: "this isn't our bubble".
       *
       *   With the offscreen stage now uncapped (parent intrinsic
       *   size, see MarkerCaptureStage), captures actually produce
       *   real PNGs. Restoring this child gives every device an
       *   immediate branded bubble while the capture works in the
       *   background. On working snapshot devices (iPhone, Pixel,
       *   most Android) the child render IS already the right
       *   bubble — the PNG just locks it in place going forward.
       *   On Samsung One UI the child briefly shows the broken
       *   bitmap, then the PNG corrects it (~200 ms window).
       *
       *   This puts us back to "Pixel + iPhone always show the
       *   right bubble" behaviour while keeping the structural
       *   PNG fix that protects Samsung. Both worlds covered. */}
      {!pngUri && (
        <BubbleVisual
          c={c}
          st={st}
          avatarUri={avatarUri}
          hotMap={hotMap}
        />
      )}
    </Marker>
  );
}

/* ── Countdown component for timer popups ── */
function PopupCountdown({ expiresAt }: { expiresAt: string }) {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m left` : `${m}m ${sec}s left`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const isEnded = remaining === 'Ended';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), marginTop: s(3) }}>
      <NomadIcon name="clock" size={s(6)} color={isEnded ? '#9CA3AF' : colors.danger} strokeWidth={1.6} />
      <Text style={{ fontSize: s(6), fontWeight: FW.bold as any, color: isEnded ? '#9CA3AF' : colors.danger }}>
        {remaining}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<any>();
  const { userId, justFinishedSetup, clearSetupFlag } = useContext(AuthContext);
  const { avatarUri } = useAvatar();
  const { t, locale } = useI18n();
  const { colors, isDark } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);
  // Active category filter for the vibe bar.
  //   null = "All" (no filter, every checkin shown)
  //   non-null = the catKey of the chosen vibe (e.g. 'food'),
  //              filters the map + clusters to only those checkins.
  // Stored as a string (not an index into VIBES) on purpose: the
  // visible vibe list is dynamically pruned to ONLY show categories
  // that have at least one live checkin, so any index-based state
  // would point at the wrong row the moment a category appeared or
  // disappeared. A string is stable across that.
  const [activeCatKey, setActiveCatKey] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [visibleNomadCount, setVisibleNomadCount] = useState<number | null>(null);
  const [visibleNomadIds, setVisibleNomadIds] = useState<Set<string>>(new Set());

  /* ── Captured marker PNG URIs — image-based marker pipeline ──
   *
   * Map<checkinId, { key, uri }>. The key is the visual fingerprint
   * (computeMarkerVisualKey) at capture time; if the live key for
   * this checkin diverges, the entry is stale and the capture stage
   * will re-snapshot. The Map is held behind a ref so per-marker
   * progress doesn't trigger HomeScreen-wide re-renders for every
   * single capture; we bump `markerImagesVersion` once per captured
   * entry to invalidate the nomadMarkers memo, which causes only
   * the markers whose URIs changed to actually re-render (their
   * pngUri prop changed; everyone else's didn't).
   *
   * For PeopleScreen/PulseScreen-equivalent surfaces this Map is
   * irrelevant — those screens don't render markers. Only HomeScreen
   * cares about it. */
  const markerImagesRef = useRef<Map<string, { key: string; uri: string }>>(new Map());
  const [markerImagesVersion, setMarkerImagesVersion] = useState(0);
  const markerCapturedKeysSnapshot = useMemo(() => {
    // Plain Map<id, key> derived from the ref — handed to
    // MarkerCaptureStage so it can decide which checkins still
    // need (re-)capture. Recomputed per render but cheap (it's
    // just a copy of a small map). forEach is used (rather than
    // for...of on Map.entries()) to dodge the TS downlevelIteration
    // tooling warning while keeping identical runtime behaviour.
    const m = new Map<string, string>();
    markerImagesRef.current.forEach((entry, id) => { m.set(id, entry.key); });
    return m;
    // markerImagesVersion is in deps so the snapshot tracks the
    // ref. capturedKeys is read by MarkerCaptureStage which is
    // the only consumer that needs reactivity here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerImagesVersion]);
  const handleMarkerCaptured = useCallback((id: string, key: string, uri: string) => {
    const existing = markerImagesRef.current.get(id);
    if (existing && existing.key === key && existing.uri === uri) return;
    markerImagesRef.current.set(id, { key, uri });
    setMarkerImagesVersion((v) => v + 1);
  }, []);
  /* Stable Marker coordinates — keyed by checkin id, refreshed only
   * when a checkin's coords actually move.
   *
   * Why: every time `markerImagesVersion` bumps (i.e. once per
   * capture, once per minute for timers, etc.) the nomadMarkers
   * useMemo re-runs and used to recreate `coordinate={{ latitude,
   * longitude }}` as a fresh inline object literal — same numbers,
   * new reference. react-native-maps treats a new coordinate ref as
   * a position change and animates the native pin to its (identical)
   * destination. With ~6+ markers and frequent capture bumps you
   * see them all "dance" briefly several times a minute. The owner
   * called this out 2026-04-28 evening: "still flickering, jumping
   * weirdly, no stability".
   *
   * Fix: cache one `{ latitude, longitude }` object per checkin id
   * and reuse the SAME REFERENCE on every memo run unless the
   * checkin's lat/lng actually changed. React reconciler sees the
   * Marker's coord prop as the same object, no native update fires,
   * pins stay rock-still even while the capture pipeline progresses
   * underneath. */
  const markerCoordsRef = useRef<Map<string, { latitude: number; longitude: number }>>(new Map());
  const getStableCoord = useCallback(
    (c: CheckinWithProfile, cityLat: number, cityLng: number): { latitude: number; longitude: number } => {
      const lat = c.latitude ? c.latitude : scatter(cityLat, hashCode(c.id));
      const lng = c.longitude ? c.longitude : scatter(cityLng, hashCode(c.id + '_lng'));
      const cached = markerCoordsRef.current.get(c.id);
      if (cached && cached.latitude === lat && cached.longitude === lng) {
        return cached;
      }
      const fresh = { latitude: lat, longitude: lng };
      markerCoordsRef.current.set(c.id, fresh);
      return fresh;
    },
    [],
  );
  // Note: the prune-stale-entries useEffect lives further down in the
  // body (right after useActiveCheckins() declares `checkins`) because
  // it has to read that hook's output. Defining it here would hit a
  // "used before declaration" TS error — the ref and callback above
  // can stand alone, but the cleanup specifically needs `checkins`.

  // ── Welcome celebration overlay ──
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (justFinishedSetup) {
      setShowWelcome(true);
      Animated.timing(welcomeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      const timer = setTimeout(() => {
        Animated.timing(welcomeOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
          setShowWelcome(false);
          clearSetupFlag?.();
        });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [justFinishedSetup]);

  // Publish success feedback lives inside CreationBubble's own
  // 'success' step — see components/CreationBubble.tsx. HomeScreen
  // just clears the deep-link param so the user doesn't see a
  // stale "newActivity" hint after they navigate away.
  useEffect(() => {
    if (route.params?.newActivity) {
      nav.setParams({ newActivity: undefined } as any);
    }
  }, [route.params?.newActivity]);

  /* ── Tab-level Plus button → open creation flow ──
   * The global floating Plus lives in App.tsx (see CreateFab) and
   * is visible across every tab. When tapped on a non-Home tab it
   * navigates to Home with `openCreate: Date.now()`. The nonce
   * (Date.now()) ensures useEffect fires even when the user was
   * already on Home — same param value would skip the effect.
   *
   * We clear the param immediately after consuming it so:
   *   - leaving Home and coming back doesn't re-trigger creation
   *   - the deep-link state stays clean for any other code that
   *     reads route.params (none today, but the next dev's
   *     surprise budget shouldn't be paid in creation modals).
   *
   * Guarded on `userId` because openCreation needs auth to write
   * the eventual checkin row. If the tap lands before auth is
   * ready, the effect re-runs once userId is set (since userId is
   * in the deps array) — the tap doesn't get lost.
   */
  useEffect(() => {
    const nonce = route.params?.openCreate;
    if (nonce && userId) {
      openCreation();
      nav.setParams({ openCreate: undefined } as any);
    }
    // openCreation is referenced but not in deps because re-running
    // it when its identity changes (e.g. userLat refresh) would
    // reopen creation unexpectedly. The nonce alone is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.openCreate, userId]);

  /* Deep-link `focusCheckinId` is consumed further down — placed
   * after the useActiveCheckins() call so it can read `checkins`
   * without a TDZ error. Search for "focusCheckinId effect" below. */

  const [showProfile, setShowProfile] = useState(false);
  const [selectedNomad, setSelectedNomad] = useState<any>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  // ─── Viewed city — single source of truth ───
  // Lives in ViewedCityContext (lib/ViewedCityContext.tsx) so PeopleScreen
  // and any future screen consume the same value. Aliased to currentCity
  // here so the existing call sites in this file (40+ references) stay
  // intact. Do NOT add a local useState for the city — the Context is
  // the only writable copy.
  //
  // setGpsCity is the SECOND writer, used ONLY by syncLiveCityFromGPS
  // below to record the device's actual GPS position; it then drives
  // the DB update to profile.current_city. Owner directive 2026-04-27:
  // "Registered location = GPS / viewed location = what user is looking
  // at / they can differ when the user pans the map."
  const { viewedCity: currentCity, setViewedCity: setCurrentCity, setGpsCity } = useViewedCity();

  /* ── City search state ── */
  const [searchFocused, setSearchFocused] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [recentCities, setRecentCities] = useState<CitySearchResult[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const citySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  /* Publishing flags are still used by handleQuickPublish /
   * handleTimerPublish (to show the "publishing…" spinner in
   * CreationBubble via the `publishing` prop). The show…
   * flags from the retired sheets are gone. */
  const [quickPublishing, setQuickPublishing] = useState(false);
  const [timerPublishing, setTimerPublishing] = useState(false);
  const [showNomadsList, setShowNomadsList] = useState(false);
  const [showCancelTimer, setShowCancelTimer] = useState(false);
  const [activeTimerCheckin, setActiveTimerCheckin] = useState<string | null>(null); // checkin id
  const [activeTimerChatId, setActiveTimerChatId] = useState<string | null>(null);
  // showReplaceStatus removed — conflict is warned inside
  // CreationBubble at the PUBLISH step (see comment there).
  const [timerBubbleCheckin, setTimerBubbleCheckin] = useState<CheckinWithProfile | null>(null);
  /** Dismiss the timer bubble. Bottom-sheet style — no anchor to clear,
   *  no map state to restore. The Bubble component handles its own
   *  slide-down animation; we just unset the source checkin. */
  const dismissTimerBubble = () => {
    setTimerBubbleCheckin(null);
  };
  /* ── פניני חוכמה — Wisdom state ── */
  const [showWisdom, setShowWisdom] = useState(false);
  const [wisdomCity, setWisdomCity] = useState('');
  const [wisdomDistance, setWisdomDistance] = useState(0);
  const [wisdomExistingIntent, setWisdomExistingIntent] = useState<WisdomIntent | null>(null);
  const [wisdomPendingAction, setWisdomPendingAction] = useState<(() => void) | null>(null);

  /* ── GPS: fetch on mount + refresh every 30s for live accuracy ── */
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const gpsInitDone = useRef(false);

  /* ═══ PICK MODE — the one-map location picker ═══════════════════
   *
   * The ONE MapView in the app is HomeScreen's. pickMode flips
   * that map into a location-picker overlay so new activities
   * can pin themselves without a second MapView anywhere.
   *
   * Today the ONLY caller is CreationBubble — it hands off via
   * `handleCreationRequestPick`, the user pans, then
   * `commitPickFromCreation` feeds the result back to the
   * bubble via `creationLocationUpdater` without ever unmounting
   * it. The legacy QuickStatusSheet / TimerSheet entry points
   * (`enterPickMode`, `commitPick`, and `initialPick`) were
   * retired with the CreationBubble unification — see Stage 17
   * of the no-band-aids refactor. */
  type PickMode = 'browse' | 'status' | 'timer';
  const [pickMode, setPickMode] = useState<PickMode>('browse');
  const [pickLat, setPickLat] = useState<number>(0);
  const [pickLng, setPickLng] = useState<number>(0);
  const [pickAddr, setPickAddr] = useState<string>('');
  const [pickResolving, setPickResolving] = useState(false);
  const pickGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Optional address search inside pickMode.
   *
   * Per product request: a search bar sits at the top of pickMode
   * so users who KNOW the exact address don't have to pan for it.
   * Pin-drop still works — the search is a shortcut, not the only
   * path. Typing debounces 300ms then hits Photon via the shared
   * lib/locationServices.searchAddress. */
  const [pickSearchQuery, setPickSearchQuery] = useState('');
  const [pickSearchResults, setPickSearchResults] = useState<GeoResult[]>([]);
  const [pickSearching, setPickSearching] = useState(false);
  const pickSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Enter pickMode for either 'status' or 'timer'. Seeds the pin
   *  to the user's last known GPS when available, otherwise to the
   *  current city's center. Animates the map there so the opening
   *  experience always lands somewhere sensible. */
  /** Exit pickMode without committing. Also called on Cancel. */
  const exitPickMode = useCallback(() => {
    if (pickGeocodeTimer.current) {
      clearTimeout(pickGeocodeTimer.current);
      pickGeocodeTimer.current = null;
    }
    if (pickSearchTimer.current) {
      clearTimeout(pickSearchTimer.current);
      pickSearchTimer.current = null;
    }
    setPickMode('browse');
    setPickAddr('');
    setPickResolving(false);
    setPickSearchQuery('');
    setPickSearchResults([]);
    setPickSearching(false);
  }, []);

  /** Debounced Photon search for the pickMode search bar. */
  const onPickSearchChange = useCallback((q: string) => {
    setPickSearchQuery(q);
    if (pickSearchTimer.current) clearTimeout(pickSearchTimer.current);
    if (q.trim().length < 2) {
      setPickSearchResults([]);
      setPickSearching(false);
      return;
    }
    setPickSearching(true);
    pickSearchTimer.current = setTimeout(async () => {
      const results = await searchPickAddress(q.trim(), pickLat, pickLng, currentCity.name);
      setPickSearchResults(results);
      setPickSearching(false);
    }, 300);
  }, [pickLat, pickLng, currentCity.name]);

  /** Tap on a search result — animate the map there. The
   *  onRegionChangeComplete handler below will settle pickLat/Lng
   *  and reverseGeocode the new address. */
  const onPickSearchSelect = useCallback((r: GeoResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setPickSearchQuery('');
    setPickSearchResults([]);
    setPickSearching(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({
      latitude: lat, longitude: lng,
      latitudeDelta: 0.006, longitudeDelta: 0.006,
    }, 500);
  }, []);

  /* ═══ CREATION BUBBLE — the unified Status / Timer flow ═══════════
   *
   * The user asked for the creation experience to live inside the
   * same docked Bubble that pops up when tapping a pin. One visual
   * language for "viewing" and "creating" — what you upload looks
   * like what people see. The CreationBubble component owns the
   * multi-step wizard; HomeScreen owns the map and the publish
   * handlers.
   *
   * When the user taps the "change location" row inside the bubble,
   * we TEMPORARILY hide the bubble, flip into pickMode on the main
   * map, and on Continue push the new coords back into the bubble
   * via a ref-based updater so the bubble doesn't unmount. This
   * keeps the typed text, category, age range, etc. intact across
   * the location pick — nothing the user entered is lost.
   */
  const [showCreation, setShowCreation] = useState(false);
  // (creationKind removed — Stage 18 cleanup. pickMode always
  //  uses the green-pin color now that the bubble picks
  //  timer/status internally.)
  const [creationSeedLat, setCreationSeedLat] = useState<number>(currentCity.lat);
  const [creationSeedLng, setCreationSeedLng] = useState<number>(currentCity.lng);
  const [creationSeedAddr, setCreationSeedAddr] = useState<string>('');
  /** Monotonic session token. Incremented ONLY on a fresh open
   *  (Status/Timer button tap). Stays unchanged when we hide +
   *  restore the bubble around a pickMode round-trip, so the
   *  bubble's internal reset effect doesn't wipe the user's
   *  already-entered text and settings. */
  const [creationSessionKey, setCreationSessionKey] = useState(0);
  // Exposed by CreationBubble — parent calls it after pickMode
  // commits so the bubble can update its internal location state
  // without unmounting. Stays null when the bubble isn't mounted.
  //
  // `opts.manual` distinguishes a USER pick (pickMode commit)
  // from a BACKGROUND refresh (openCreation's async GPS chain).
  // The bubble ignores background pushes once a manual pick has
  // landed — see CreationBubble.manuallyPickedRef. This prevents
  // a slow GPS resolver from silently overriding the picked
  // coords with the device GPS (the "pin always takes my
  // location" bug, fixed 2026-04-26).
  const creationLocationUpdater = useRef<
    ((loc: { lat: number; lng: number; address: string }, opts?: { manual?: boolean }) => void) | null
  >(null);

  /** Open the unified creation bubble.
   *
   *  After Stage 17 there is no "kind" to pass — the bubble asks
   *  WHEN as step 2 and derives timer vs. status from the answer
   *  (now → timer, today/later → status). This function just
   *  bumps the session key so the bubble resets to step WHAT,
   *  seeds location from the latest GPS (or city center), and
   *  kicks off a background GPS refresh so the seed improves by
   *  the time the user reaches WHERE. */
  const openCreation = useCallback(() => {
    const initLat = userLat ?? currentCity.lat;
    const initLng = userLng ?? currentCity.lng;
    setCreationSeedLat(initLat);
    setCreationSeedLng(initLng);
    setCreationSeedAddr(currentCity.name);
    setCreationSessionKey(k => k + 1); // fresh session → bubble resets
    setShowCreation(true);
    Haptics.selectionAsync().catch(() => {});
    // Fire-and-forget GPS refresh so the seed improves while the
    // user types. resolveLiveLocation runs GPS + IP + spoof in
    // parallel and never throws. When it returns, we push the
    // result into the bubble via its location-updater ref.
    (async () => {
      try {
        const res = await resolveLiveLocation(initLat, initLng);
        if (!res.usedFallback) {
          creationLocationUpdater.current?.({
            lat: res.latitude,
            lng: res.longitude,
            address: '',
          });
          const addr = await reverseGeocodeAddress(res.latitude, res.longitude);
          if (addr) {
            creationLocationUpdater.current?.({
              lat: res.latitude,
              lng: res.longitude,
              address: addr,
            });
          }
        }
      } catch (err) {
        console.warn('[HomeScreen] creation GPS refresh failed:', err);
      }
    })();
  }, [userLat, userLng, currentCity.lat, currentCity.lng, currentCity.name]);

  /** Called by CreationBubble when the user taps the "set pin"
   *  row. Opens pickMode on the main map using the BEST GPS coord
   *  we have right now — last-known for instant feedback, then
   *  high-accuracy for refinement. Never relies on a possibly-
   *  stale bubble seed (which could be city center if userLat
   *  was null at bubble open), so the pin lands on the user's
   *  real location from frame one instead of city center + snap.
   *
   *  Priority order:
   *    1. Location.getLastKnownPositionAsync — instant, matches
   *       the iOS blue dot.
   *    2. Bubble's current coord — only if last-known is null.
   *    3. Location.getCurrentPositionAsync(High) — refines the
   *       map to the freshest fix; animates only if it drifts
   *       more than ~10 m from the initial snap so the map
   *       doesn't jiggle pointlessly. */
  const handleCreationRequestPick = useCallback(
    (current: { lat: number; lng: number; address: string }) => {
      setShowCreation(false);
      setPickResolving(true);
      // pickMode value is only used by the pickMode overlay to
      // decide the center-pin color. Always 'status' (green) now
      // that the unified flow picks timer/status inside the bubble.
      setPickMode('status');

      (async () => {
        // ── Best-available seed for the FIRST pin animation ──
        //
        // Source preference (most → least trustworthy of "where the
        // user actually is right now"):
        //   1. userLat/Lng — HomeScreen's GPS state, refreshed on
        //      app mount + when the user taps "center on me". On
        //      a warm app this is the freshest non-blocking source.
        //   2. Location.getLastKnownPositionAsync() — OS-cached
        //      position. Synchronous-ish, returns null on cold GPS.
        //   3. current.lat/lng — what the bubble was holding when
        //      the user tapped "change location". This was the seed
        //      passed at openCreation time and may be STALE: if
        //      userLat was null at openCreation, current became the
        //      city centre fallback. Trusting it here produced the
        //      "pin opens in Tel Aviv even though I'm in Yavne"
        //      report on 2026-04-26.
        //   4. currentCity.lat/lng — the absolute last-resort city
        //      centre. Better than crashing if every GPS path fails.
        let initialLat: number | null = null;
        let initialLng: number | null = null;

        if (userLat != null && userLng != null) {
          initialLat = userLat;
          initialLng = userLng;
        }

        if (initialLat == null) {
          try {
            const last = await Location.getLastKnownPositionAsync();
            if (last) {
              initialLat = last.coords.latitude;
              initialLng = last.coords.longitude;
            }
          } catch (err) {
            console.warn('[HomeScreen] last-known GPS failed:', err);
          }
        }

        if (initialLat == null || initialLng == null) {
          // Bubble seed last — it's frequently the city centre by the
          // time we reach here, but it's still better than nothing.
          initialLat = current.lat || currentCity.lat;
          initialLng = current.lng || currentCity.lng;
        }

        // initialLat / initialLng are now guaranteed numbers thanks
        // to the city-centre fallback above. Capture into locals so
        // TypeScript narrows the type for the setState calls.
        const seedLat = initialLat as number;
        const seedLng = initialLng as number;

        setPickLat(seedLat);
        setPickLng(seedLng);
        setPickAddr(current.address || '');
        mapRef.current?.animateToRegion({
          latitude: seedLat, longitude: seedLng,
          latitudeDelta: 0.005, longitudeDelta: 0.005,
        }, 300);

        // High-accuracy fresh fix. Only re-animate if the drift vs.
        // the initial snap is > ~10 m (0.0001° lat ≈ 11 m); otherwise
        // the map would visibly twitch for a handful of meters of GPS
        // jitter. Running this even when we already had userLat lets
        // the pin settle on the very latest position by the time the
        // user looks at the screen.
        try {
          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          // Sync HomeScreen state too — next openCreation will pick
          // up this fresh value as the bubble seed.
          setUserLat(fresh.coords.latitude);
          setUserLng(fresh.coords.longitude);
          const dLat = Math.abs(fresh.coords.latitude - seedLat);
          const dLng = Math.abs(fresh.coords.longitude - seedLng);
          if (dLat > 0.0001 || dLng > 0.0001) {
            mapRef.current?.animateToRegion({
              latitude: fresh.coords.latitude,
              longitude: fresh.coords.longitude,
              latitudeDelta: 0.004, longitudeDelta: 0.004,
            }, 350);
          }
          // onRegionChangeComplete picks up the settled region and
          // handles pickLat/Lng + reverse geocode.
        } catch (err) {
          console.warn('[HomeScreen] fresh GPS refine failed:', err);
        }
      })();
    },
    [userLat, userLng, currentCity.lat, currentCity.lng],
  );

  /** Called when the user commits a pick that originated from the
   *  creation bubble. Pushes the new coords into the bubble and
   *  re-shows it. No state loss — text / category / etc. are still
   *  in the bubble's local state because the component stayed
   *  mounted (just invisible while pickMode was on top). */
  const commitPickFromCreation = useCallback(() => {
    const snap = { lat: pickLat, lng: pickLng, address: pickAddr };
    exitPickMode();
    // `manual: true` locks the bubble against any background GPS
    // push that may still be in flight from openCreation. Without
    // this flag a slow-arriving GPS resolver could overwrite the
    // user's pick a few seconds later — the exact bug reported on
    // 2026-04-26 ("הפין במפות לא עובד / הוא תמיד לוקח לוקיישן שלי").
    creationLocationUpdater.current?.(snap, { manual: true });
    setShowCreation(true);
  }, [pickLat, pickLng, pickAddr, exitPickMode]);

  /** Called when the user cancels pickMode that originated from
   *  creation. Re-show the bubble with the PREVIOUS location intact. */
  const cancelPickFromCreation = useCallback(() => {
    exitPickMode();
    setShowCreation(true);
  }, [exitPickMode]);

  /* handleCreationPublish is declared LATER in this file — after
   * handleQuickPublish and handleTimerPublish — because it routes
   * into them. See the "creation publish bridge" block further
   * down near the other publish handlers. */

  /* ── Live city sync from GPS — owner directive 2026-04-27 ────
   *
   * The user's "current city" is derived from LIVE GPS, not from
   * a profile field they once filled in or a hardcoded default.
   * Owner: "ברור שהכלל חייב להיות מובנה GPS / אם הוא נסע למטולה
   * הוא נכנס לצ'ק אין מטולה". Without this, Yuval (Rehovot)
   * opened the app this morning and the map snapped to Tel Aviv
   * because his profile.current_city was NULL and CITIES[0] = TLV.
   *
   * On every GPS tick we:
   *   1. Reverse-geocode the coords → city name (via shared
   *      cityResolver, no inline duplication).
   *   2. setCurrentCity to that city — drives map center, "nomads
   *      in city" filter, country derivation, etc.
   *   3. Persist the city + lat/lng to app_profiles so other
   *      users see this nomad in the correct city's nomad list.
   *
   * Guarded by lastSyncedCityName ref so we don't spam Supabase
   * with identical city UPDATEs on every 30s GPS refresh.
   *
   * 2026-04-27 evening — split write fix:
   *
   *   The previous implementation short-circuited the ENTIRE function
   *   when the resolved city hadn't changed since the last fix. That
   *   meant a user who stays in one city (e.g., Eli — Tel Aviv all
   *   day) NEVER had their `last_active_at` re-stamped after the first
   *   call, even if the app was actively in use. After the 2026-04-26
   *   `useNomadsInCity` 24-hour active-presence filter shipped (commit
   *   c9b3d64), those users started "disappearing" from PeopleScreen
   *   and the map's "nomads here" count even though they were online.
   *
   *   The fix splits the write into two:
   *     (a) `last_active_at` + last_location_* — the presence ping —
   *         ALWAYS fires on every call. Cheap UPDATE, single row.
   *         This keeps the user inside the 24-hour visibility window.
   *     (b) `current_city` + Context.setGpsCity — the city change —
   *         ONLY when the resolved cityName has actually moved. Same
   *         ref-guard pattern as before, just gating the smaller write.
   *
   *   Net: a stationary user's row gets re-stamped every ~30 s (cheap),
   *   and other-city users still pay the full reverse-geocode + city
   *   write only when they truly moved.
   */
  const lastSyncedCityName = useRef<string | null>(null);
  const syncLiveCityFromGPS = useCallback(async (lat: number, lng: number) => {
    if (!userId) return;

    // (a) Presence ping — fires every call, regardless of whether the
    // city changed. Stationary users stay visible inside the 24-hour
    // active filter; the cost is one UPDATE on a single row indexed
    // by user_id (the table's PK in practice). No-op fallback: errors
    // get logged, never surfaced — a temporary network hiccup
    // shouldn't crash the screen, and the next GPS tick (30 s away)
    // will retry.
    const nowIso = new Date().toISOString();
    void supabase.from('app_profiles').update({
      last_location_latitude: lat,
      last_location_longitude: lng,
      last_location_timestamp: nowIso,
      last_active_at: nowIso,
    }).eq('user_id', userId).then(({ error }) => {
      if (error) console.warn('[HomeScreen] presence ping failed:', error.message);
    });

    // (b) City change — reverse-geocode + city write + Context update,
    // but only when the resolved city is actually different from the
    // last one we synced. Reverse-geocode is the expensive call here
    // (network round-trip to the geocoder), so the ref-guard avoids
    // even doing the lookup when we already know we're in the same
    // city as the last tick. Wrap in try/catch so a geocode failure
    // doesn't shadow the presence ping above (which already fired).
    try {
      const { cityName, country, countryCode } = await reverseGeocodeCityFull(lat, lng);
      if (!cityName) return; // reverse-geocode failed — keep previous city
      if (lastSyncedCityName.current === cityName) return; // unchanged

      lastSyncedCityName.current = cityName;

      // Prefer a CITIES entry if we have one (richer metadata: flag, active count).
      const fromList = CITIES.find(c => c.name.toLowerCase() === cityName.toLowerCase());
      const liveCity: City = fromList ?? {
        id: `${cityName}-${country}`.toLowerCase().replace(/\s+/g, '-'),
        name: cityName,
        country,
        countryCode,
        flag: '',
        lat,
        lng,
        active: 0,
      };
      // Route through the Context's setGpsCity (NOT setCurrentCity) so
      // the manual-pan-vs-GPS logic in ViewedCityContext can decide
      // whether to also update viewedCity. If the GPS city is the same
      // as last fix → leave viewedCity alone (user might be panning).
      // If GPS city changed → user moved → also update viewedCity.
      setGpsCity(liveCity);

      // Persist the city change. last_active_at is updated again here
      // so that "user just moved cities" surfaces a fresh timestamp at
      // the same moment as the city flip — no race window where the
      // city is new but the activity is stale.
      const { error } = await supabase.from('app_profiles').update({
        current_city: cityName,
        last_active_at: new Date().toISOString(),
      }).eq('user_id', userId);
      if (error) console.warn('[HomeScreen] Profile city sync failed:', error.message);
    } catch (e) {
      console.warn('[HomeScreen] Live city sync error:', e);
    }
  }, [userId, setGpsCity]);

  const refreshGPS = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLat(pos.coords.latitude);
      setUserLng(pos.coords.longitude);
      // Re-sync city — covers the "user drove from Rehovot to Tel Aviv
      // while the app was open" case. The internal ref-guard skips the
      // DB write if the resolved city is unchanged.
      syncLiveCityFromGPS(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      console.warn('[HomeScreen] GPS refresh error:', e);
    }
  }, [syncLiveCityFromGPS]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        // 1) Try cached position first — instant
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setUserLat(last.coords.latitude);
          setUserLng(last.coords.longitude);
          // Sync city from cached coords too — gets "Rehovot" on the
          // map almost instantly even before fresh GPS lands.
          syncLiveCityFromGPS(last.coords.latitude, last.coords.longitude);
        }
        // 2) Then get fresh GPS — may take 1-3s
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        // 3) Re-sync city from the precise fix (covers cases where
        //    the cached position was stale by hundreds of km, e.g.
        //    a flight). lastSyncedCityName ref skips the DB write if
        //    the cached and fresh fixes resolve to the same city.
        syncLiveCityFromGPS(pos.coords.latitude, pos.coords.longitude);
        // 4) Zoom map to real location on first GPS fix
        if (!gpsInitDone.current) {
          gpsInitDone.current = true;
          mapRef.current?.animateToRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }, 600);
        }
      } catch (e) {
        console.warn('[HomeScreen] GPS error:', e);
      }
    })();
    // Refresh GPS every 30 seconds
    const gpsInterval = setInterval(refreshGPS, 30_000);
    return () => clearInterval(gpsInterval);
  }, [refreshGPS, syncLiveCityFromGPS]);

  /* ── Notifications hook ──
   *
   * Drives the unread badge on the bottom-right bell. Pre-fix the
   * bell was a static icon with no count — testers had unread
   * notifications in app_notifications but no signal to open the
   * sheet. Tester report 2026-04-26: "האייקון פעמון - לא מראה
   * נוטיפיקיישן".
   *
   * `useNotifications` polls every 120s and exposes refetch +
   * markAllRead. We refetch when the screen regains focus and
   * after the sheet closes (mark-all-read inside the sheet).
   */
  const { unreadCount: notifUnread, refetch: refetchNotifs, markAllRead: markNotifsRead } = useNotifications(userId);
  useFocusEffect(useCallback(() => { refetchNotifs(); }, [refetchNotifs]));

  /* ── Recent cities: load on mount AND auto-record the current city so
          the dropdown always has at least one item (even first-timers who
          never searched). Every time currentCity changes we also push it
          into recents, which makes "Recent" behave as "cities I've been on
          the map on" — matching the user's mental model. */
  useEffect(() => {
    loadRecentCities(userId).then(setRecentCities);
  }, [userId]);

  // Auto-saving the current city on every mount was making the list feel
  // noisy — Tel Aviv appearing even though the user never searched for it.
  // Recents now only contain cities the user EXPLICITLY searched and
  // picked, via handleCitySearchSelect.

  /* ── City search — debounced Photon autocomplete ── */
  useEffect(() => {
    if (citySearchTimer.current) clearTimeout(citySearchTimer.current);
    if (cityQuery.trim().length < 2) { setCityResults([]); setCitySearching(false); return; }
    setCitySearching(true);
    citySearchTimer.current = setTimeout(async () => {
      const results = await searchCities(cityQuery.trim());
      setCityResults(results);
      setCitySearching(false);
    }, 300);
  }, [cityQuery]);

  /* ── Select a city from search results ── */
  const handleCitySearchSelect = useCallback(async (result: CitySearchResult) => {
    // Save to recents (Supabase + AsyncStorage cache)
    await saveRecentCity(result, userId);
    setRecentCities(await loadRecentCities(userId));
    // Create a City object for the app. countryCode comes from
    // Photon's `properties.countrycode` — carried through so the geo
    // gates (nomads list blur, join button) treat this user-searched
    // city the same as a hardcoded CITIES entry.
    const city: City = {
      id: `${result.name}-${result.country}`.toLowerCase().replace(/\s/g, '-'),
      name: result.name,
      country: result.country,
      countryCode: result.countryCode,
      flag: '',
      lat: result.lat,
      lng: result.lng,
      active: 0,
    };
    setCurrentCity(city);
    // Animate map close-in on the selected city. Was 0.08 (city + suburbs
    // view ≈ 10km), now 0.035 — a proper city-center zoom so you actually
    // see the pins of that city instead of zooming out over a region.
    mapRef.current?.animateToRegion({
      latitude: result.lat, longitude: result.lng,
      latitudeDelta: 0.035, longitudeDelta: 0.035,
    }, 800);
    // Close search
    setCityQuery('');
    setCityResults([]);
    setSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  const closeSearch = useCallback(() => {
    setCityQuery('');
    setCityResults([]);
    setSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  // useNomadsInCity moved further down — it now depends on myProfile
  // for the viewer's age range, and myProfile is declared below.

  // Real data from Supabase.
  //
  // GLOBAL fetch (city = null) so the map can render multiple cities
  // at once. The owner directive 2026-04-28: "even when several cities
  // are visible on the map I want the bubbles in density across all
  // of them — that's the beauty". Fetching globally + filtering
  // city_only checkins client-side against the viewer's GPS city
  // gives us exactly that: every public checkin worldwide is on the
  // map, city_only checkins are limited to their city's residents.
  // PeopleScreen continues to call useActiveCheckins(currentCity.name)
  // for its city-bound list and is unaffected.
  const { checkins, count: activeCount, loading: checkinsLoading, refetch: refetchCheckins, addOptimistic } = useActiveCheckins(null, userId, currentCity.name);

  /* Prune captured-marker PNG entries when their underlying checkin
   * disappears (expired, deleted, owner went show_on_map=false, etc.).
   * Without this the Map grows unbounded over a long session and the
   * tmpfile URIs hold references the OS hasn't yet GC'd.
   *
   * Pruning is keyed on the unfiltered `checkins` (not
   * `filteredCheckins`) so that toggling the category vibe chip
   * doesn't throw away — and re-capture — every PNG every time the
   * user flicks between "All" and "Food". */
  useEffect(() => {
    const liveIds = new Set<string>();
    for (let i = 0; i < checkins.length; i++) liveIds.add(checkins[i].id);
    let pruned = false;
    const ids: string[] = [];
    markerImagesRef.current.forEach((_, id) => ids.push(id));
    for (const id of ids) {
      if (!liveIds.has(id)) {
        markerImagesRef.current.delete(id);
        pruned = true;
      }
    }
    if (pruned) setMarkerImagesVersion((v) => v + 1);
  }, [checkins]);

  // Hot checkins — for pulse animation on pins with active conversations
  const hotCheckins = useHotCheckins(currentCity.name);

  /* ── Visible vibe chips ──
   * Only show vibe chips for categories that ACTUALLY have at least
   * one live checkin in the current city. 'All' is always there as
   * the default. The intent: an empty "Nightlife" chip with zero
   * pins behind it is a dead end the user taps and feels nothing
   * happened — pruning to live categories makes the bar a real
   * filter, not a menu of possibilities. */
  const activeCategoryKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of checkins) {
      if (c.category) set.add(c.category);
    }
    return set;
  }, [checkins]);

  const visibleVibes = useMemo(
    () => VIBES.filter(v => !v.catKey || activeCategoryKeys.has(v.catKey)),
    [activeCategoryKeys],
  );

  /* If the user has Food selected and the last food checkin
   * expires (or the user moves to a city with no food yet), the
   * Food chip vanishes — and we'd be stuck filtering on a vibe the
   * user can't see anymore. Fall back to All so the map repopulates. */
  useEffect(() => {
    if (activeCatKey && !activeCategoryKeys.has(activeCatKey)) {
      setActiveCatKey(null);
    }
  }, [activeCatKey, activeCategoryKeys]);

  /* ── Filter checkins by active vibe for clustering ── */
  const filteredCheckins = useMemo(() => {
    if (!activeCatKey) return checkins;
    return checkins.filter(c => c.category === activeCatKey);
  }, [checkins, activeCatKey]);

  /* ── Own active checkins — derived, fed into CreationBubble
   *    so it can show the "replace" banner on the PUBLISH step.
   *    useMemo so re-renders triggered by unrelated state don't
   *    re-filter the whole checkin list. */
  const { hasActiveTimer, hasActiveScheduled } = useMemo(() => {
    let timer = false;
    let scheduled = false;
    for (const c of checkins) {
      if (c.user_id !== userId) continue;
      const kind = (c as any).checkin_type;
      if (kind === 'timer') timer = true;
      else if (kind === 'status') scheduled = true;
      if (timer && scheduled) break;
    }
    return { hasActiveTimer: timer, hasActiveScheduled: scheduled };
  }, [checkins, userId]);

  /* ── focusCheckinId effect — notification deep-link ────────────
   *
   * Notifications navigate here with `focusCheckinId` + `focusNonce`
   * when the user taps an activity_* notification (see
   * NotificationsSheet.handleNotifPress). We:
   *   1. Find the checkin in the already-loaded `checkins` list.
   *   2. If found — animate the map to its coordinates and pop the
   *      TimerBubble for it (same as if the user tapped its pin).
   *   3. If NOT found — fetch it directly by id from app_checkins.
   *      Covers the case where the user is in a different city from
   *      the activity (useActiveCheckins is city-scoped) or the
   *      checkin landed via Realtime AFTER the notification but
   *      BEFORE the focus effect ran.
   *
   * The nonce makes this fire even when the same notification is
   * tapped twice — same pattern as `openCreate`.
   * Pre-fix the corresponding NotificationsSheet case was an empty
   * `// Go to home/map` comment with no code — tapping any
   * activity_* notification was a dead-end button. Tester report
   * 2026-04-26: "לחיצה על הנוטיפיקיישן לא פותח לי את האירוע".
   */
  useEffect(() => {
    const targetId = route.params?.focusCheckinId as string | undefined;
    const nonce = route.params?.focusNonce;
    if (!targetId || !nonce) return;

    let cancelled = false;
    (async () => {
      let target = checkins.find(c => c.id === targetId) as any;
      if (!target) {
        const { data } = await supabase
          .from('app_checkins')
          .select('*, profile:app_profiles!user_id(full_name, display_name, username, avatar_url, job_type, bio, interests, show_on_map, hide_distance, birth_date)')
          .eq('id', targetId)
          .maybeSingle();
        if (cancelled) return;
        target = data;
      }
      if (!target || !target.latitude || !target.longitude) {
        Alert.alert(
          'Activity not found',
          "We couldn't find this activity. It may have been removed.",
        );
        nav.setParams({ focusCheckinId: undefined, focusNonce: undefined } as any);
        return;
      }
      // Hide ghost bubbles: an event whose owner ended it (or that
      // expired via cron) keeps its row in app_checkins but flips
      // is_active=false. Opening the TimerBubble for it would let
      // the user tap Join on a dead group. Friendlier to surface a
      // quick "ended" alert and stay on the map.
      if (target.is_active === false) {
        Alert.alert(
          'Activity ended',
          'This activity has already ended.',
        );
        nav.setParams({ focusCheckinId: undefined, focusNonce: undefined } as any);
        return;
      }
      mapRef.current?.animateToRegion({
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 450);
      // Wait for camera then open bubble — matches the locked Map
      // Pin Tap Flow in CLAUDE.md (zoom 400ms → wait 450ms → popup).
      //
      // IMPORTANT — do NOT gate this setTimeout on `cancelled`. The
      // first version did, and `cancelled` flips to true the moment
      // we clear `focusCheckinId` from route.params (which changes
      // the useEffect deps and runs the cleanup). The map animation
      // ran fine because it fires synchronously, but the bubble
      // never opened — tester report 2026-04-26: "שלח אותי לבועה
      // אבל לא פתח לי את הבאבל". The `cancelled` flag still guards
      // the async DB fetch above, where it MATTERS (avoids setting
      // a bubble for a checkin the user already navigated away
      // from). Once we have the target in hand and have committed
      // to opening the bubble, the user wants it open — period.
      setTimeout(() => setTimerBubbleCheckin(target), 470);
      // Clear the params LAST, after we've handed the bubble work
      // off to setTimeout. Order doesn't change behavior with the
      // setTimeout-no-guard fix above, but keeps the intent obvious.
      nav.setParams({ focusCheckinId: undefined, focusNonce: undefined } as any);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.focusCheckinId, route.params?.focusNonce, checkins.length]);

  const { profile: myProfile, refetch: refetchProfile } = useProfile(userId);
  const myName = myProfile?.display_name || myProfile?.full_name || myProfile?.username || 'You';
  const myInitials = myName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const { toggle: toggleFollow, isFollowing } = useFollow(userId);

  // ─── Nomads-in-city — bidirectional age filter, reactive to Settings ───
  // Pass viewer details derived from myProfile so when the user changes
  // age_min/age_max in Settings and comes back, fetchProfile updates
  // myProfile, the deps below change, and useNomadsInCity re-fetches
  // immediately. Owner report 2026-04-27: "הסרגל לא מגיב מיידי /
  // המערכת דורשת ריפרש".
  const viewerForFilter = myProfile ? {
    birthDate: myProfile.birth_date ?? null,
    ageMin: myProfile.age_min ?? 18,
    ageMax: myProfile.age_max ?? 100,
  } : null;
  const { nomads: nomadsInCity, count: nomadsCount, loading: nomadsLoading, refetch: refetchNomads } = useNomadsInCity(currentCity.name, viewerForFilter);

  /* ── Refetch profile every time screen gains focus (catches Settings changes) ── */
  useFocusEffect(useCallback(() => {
    refetchProfile();
    refetchCheckins();
    refetchNomads(); // also refresh nomad list on focus — covers age changes
  }, [refetchProfile, refetchCheckins, refetchNomads]));

  const isSnoozed = myProfile?.show_on_map === false;

  // ─── Removed 2026-04-27: profile.current_city → currentCity sync ───
  //
  // The original useEffect here matched myProfile.current_city against
  // the static CITIES list and called setCurrentCity if a match was
  // found. Two reasons it had to go:
  //
  //   1. With GPS-first sync (syncLiveCityFromGPS above), profile.current_city
  //      is now WRITTEN BY HomeScreen on every GPS tick. Reading it
  //      back into setCurrentCity created a feedback loop: GPS updates
  //      profile → profile updates trigger this useEffect → useEffect
  //      calls setCurrentCity → re-render → next GPS tick → repeat.
  //
  //   2. The match against CITIES was the bug Yuval (Rehovot) ran into
  //      this morning — Rehovot is not in CITIES, so the match failed
  //      silently and currentCity stayed at the Tel Aviv default.
  //      syncLiveCityFromGPS handles unknown cities by constructing a
  //      dynamic City object from the reverse-geocode result.
  //
  // viewedCity is now driven by:
  //   • setGpsCity (from syncLiveCityFromGPS) — auto-syncs on GPS move
  //   • setViewedCity (from CityPickerSheet, FAB, manual pan) — user override

  /* ── Cloud overlay animation refs ── */
  const cloudLeftX  = useRef(new Animated.Value(0)).current;
  const cloudRightX = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const cardScale   = useRef(new Animated.Value(1)).current;
  const screenW = Dimensions.get('window').width;

  // Reset cloud positions when entering snooze
  useEffect(() => {
    if (isSnoozed) {
      cloudLeftX.setValue(0);
      cloudRightX.setValue(0);
      overlayOpacity.setValue(1);
      cardScale.setValue(1);
    }
  }, [isSnoozed]);

  /* ── Wake up from snooze — animate clouds then update DB ── */
  const handleWakeUp = useCallback(async () => {
    if (!userId) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate: card shrinks, clouds scatter left/right, overlay fades
    Animated.parallel([
      Animated.timing(cardScale, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(cloudLeftX, {
        toValue: -screenW,
        duration: 500,
        delay: 100,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cloudRightX, {
        toValue: screenW,
        duration: 500,
        delay: 100,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 600,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      // Wake up — delegate both writes (show_on_map=true + checkin
      // visibility=public) to the shared lib/visibility helper.
      // PeopleScreen's wake-up uses the same call. Previously we had
      // two copies of these writes diverging by comment alone; per
      // Rule Zero the mutation now lives in one place.
      await wakeUpVisibility(userId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchProfile();
      refetchCheckins();
    });
  }, [userId, refetchProfile, refetchCheckins, cloudLeftX, cloudRightX, overlayOpacity, cardScale, screenW]);

  /* ── No auto-checkin: users only appear on map via status creation ── */

  const handleCitySelect = (city: City) => {
    trackEvent(userId, 'search_city', 'city', undefined, { city: city.name });
    setCurrentCity(city);
    // Tightened from 0.08 → 0.04 (2026-04-27 evening) — at 0.08 the
    // user lands on a region-level view where bubbles read as tiny
    // dots. 0.04 matches INITIAL_REGION and the first-GPS-fix zoom
    // so every "land on a city" entry point sees the same frame.
    mapRef.current?.animateToRegion({
      latitude: city.lat,
      longitude: city.lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 800);
  };

  /** handlePinTap is passed to every Marker as onPress. If the
   *  function identity changes on every parent render, every
   *  Marker's onPress prop changes, react-native-maps treats that
   *  as a prop update, and the whole Marker's native view gets
   *  re-applied — the pins appear to jump. Wrapping in useCallback
   *  with a stable dep list keeps the reference stable so memoized
   *  markers stay put across re-renders triggered by GPS polls,
   *  hot-checkin refetches, pickMode state changes, and so on. */
  const handlePinTap = useCallback((checkin: CheckinWithProfile) => {
    trackEvent(userId, 'tap_map_pin', 'checkin', checkin.id);

    /* Unified pin-tap flow (2026-04-20) — product-owner
     * directive "same bubble, same idea". Every pin — timer,
     * scheduled, own, visitor — opens the SAME anchored
     * TimerBubble. The bubble itself branches on owner vs
     * visitor and on timer vs scheduled to render the right
     * time label and the right CTA set. The ActivityDetailSheet
     * modal that used to open on visitor-on-status taps is
     * retired from the main flow — it was the one outlier that
     * used a different shell and broke the visual language. */
    if (timerBubbleCheckin?.id === checkin.id) {
      dismissTimerBubble();
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setTimerBubbleCheckin(checkin);
  }, [userId, timerBubbleCheckin?.id]);

  /** The marker list — MEMOIZED so it doesn't rebuild on every
   *  parent re-render. HomeScreen re-renders constantly (GPS
   *  refresh every 30s, hotCheckins refetch every 60s, pickMode
   *  transitions, region-change guard commits, etc.) and before
   *  this memo, each re-render called filteredCheckins.map(...),
   *  which produced a fresh JSX array with fresh inline coordinate
   *  objects for every Marker. react-native-maps treats a new
   *  coordinate reference as a position update and animates the
   *  native pin — even when the coords are byte-identical — which
   *  the user sees as bubbles "jumping" all over the map.
   *
   *  With this memo, as long as none of the dependencies changed
   *  (same checkins, same city, same hot map, same handlers), the
   *  memo returns the SAME array reference. React's reconciler
   *  sees identical JSX elements and skips reapplying props to the
   *  native Marker views. The pins stay rock-still.
   *
   *  Adding anything used by `buildNomadMarker` to this list must
   *  come with a useCallback / useMemo on the caller side. Never
   *  add a plain arrow function or inline object as a dep. */
  const nomadMarkers = useMemo(() => {
    if (isSnoozed) return null;
    // pngUri reads from the ref directly — markerImagesVersion is in
    // the dep list so the memo re-runs whenever a new capture lands,
    // at which point the relevant marker picks up its URI and the
    // others render as identical JSX (React reconciler skips the
    // native re-prop). For checkins not yet captured, pngUri is
    // undefined → Marker renders the BubbleVisual fallback child.
    return filteredCheckins.map((c) => (
      <NomadMarker
        key={c.id}
        c={c}
        coord={getStableCoord(c, currentCity.lat, currentCity.lng)}
        onPinTap={handlePinTap}
        avatarUri={avatarUri}
        st={st}
        hotMap={hotCheckins}
        pngUri={markerImagesRef.current.get(c.id)?.uri}
      />
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSnoozed, filteredCheckins, currentCity.lat, currentCity.lng, handlePinTap, avatarUri, st, hotCheckins, markerImagesVersion, getStableCoord]);

  const handleViewProfile = (userId: string) => {
    nav.navigate('UserProfile', { userId, name: selectedNomad?.name });
  };

  const handleSayHi = (userId: string, name: string) => {
    nav.navigate('Chat', { conversationId: userId, title: name, avatarColor: selectedNomad?.color, avatarText: selectedNomad?.initials });
  };

  /* ── פניני חוכמה — Wisdom-aware join wrapper ── */
  const wisdomGate = async (
    targetCity: string,
    targetLat: number,
    targetLng: number,
    targetCountry: string | undefined,
    action: () => void,
  ) => {
    if (!userId || !userLat || !userLng) {
      console.log('[WISDOM] No location data, letting through');
      action(); // no location data — let them through
      return;
    }
    // Find the user's actual country from their profile city
    const profileCity = myProfile?.current_city || '';
    const profileCityMatch = CITIES.find(c => c.name.toLowerCase() === profileCity.toLowerCase());
    const myCountry = profileCityMatch?.country || myProfile?.home_country || '';

    console.log('[WISDOM] Gate fired:', { profileCity, myCountry, targetCity, targetCountry, userId: userId.slice(0, 8) });

    const result = await wisdomCheck({
      userId,
      userLat,
      userLng,
      userCity: profileCity,
      userCountry: myCountry,
      targetCity,
      targetLat,
      targetLng,
      targetCountry,
    });

    console.log('[WISDOM] Result:', result);

    if (!result.shouldPrompt) {
      action(); // close enough, has flight, or already declared
      return;
    }
    // Show wisdom prompt
    setWisdomCity(targetCity);
    setWisdomDistance(result.distanceKm);
    setWisdomExistingIntent(result.existingIntent);
    setWisdomPendingAction(() => action);
    setShowWisdom(true);
    console.log('[WISDOM] Showing prompt for', targetCity);
  };

  const handleWisdomResponse = (intent: WisdomIntent) => {
    if (!userId) return;
    // Track the signal
    trackWisdomSignal({
      userId,
      signalType: intent === 'flying_soon' ? 'travel_declared' : intent === 'planning' ? 'planning_declared' : 'just_looking',
      city: wisdomCity,
      userCity: myProfile?.current_city || 'Unknown',
      distanceKm: wisdomDistance,
      intent,
    });
    setShowWisdom(false);
    if (intent === 'flying_soon' || intent === 'planning') {
      // Let them through — they declared intent
      wisdomPendingAction?.();
    }
    // 'just_looking' — don't execute the action, they're just browsing
    setWisdomPendingAction(null);
  };

  /**
   * Resolve the correct city name for a checkin based on actual GPS coordinates.
   *
   * Delegates to the shared lib/cityResolver so every caller in the
   * app resolves cities through one pipeline (previously this helper
   * duplicated that logic inline — classic Rule Zero violation that
   * drifted every time one side changed). Extra HomeScreen concern
   * preserved: if the user drifted >50 km and we land on a CITIES
   * entry, auto-correct `currentCity` so the map recenters.
   */
  const resolveCheckinCity = async (lat: number | null | undefined, lng: number | null | undefined): Promise<string> => {
    const checkinLat = lat ?? userLat ?? currentCity.lat;
    const checkinLng = lng ?? userLng ?? currentCity.lng;
    // 2026-04-27: removed the prior `if (distFromCurrent < 50) return
    // currentCity.name` shortcut. It was a perf optimization that
    // broke correctness whenever currentCity didn't match the user's
    // actual GPS city — e.g., Yuval in Rehovot (22 km from Tel Aviv
    // city center) creating a checkin while currentCity was still
    // the default 'Tel Aviv'. The shortcut returned 'Tel Aviv' even
    // though every coordinate of the checkin was in Rehovot, leading
    // to a Tel Aviv-tagged checkin appearing in Rehovot viewers'
    // lists (or worse, Tel Aviv viewers seeing a "phantom" Rehovot
    // pin). Same systemic root cause as the inflated "4 events in
    // Tel Aviv" count owner reported earlier today.
    //
    // Always reverse-geocode now. The cost is one Nominatim call
    // per checkin creation (~300ms) — negligible vs the price of a
    // mistagged checkin that confuses every viewer. The shared
    // resolver internally checks CITIES first, then falls back to
    // Nominatim, so the perf cost is bounded.
    return resolveCityFromCoordinates(checkinLat, checkinLng, currentCity.name);
  };

  /* ── Quick Status publish handler ── */
  /* ═══ Unified publish engine ════════════════════════════════════
   *
   * ONE INSERT pipeline for both checkin kinds — replaces the two
   * near-duplicate handlers we used to carry (Rule Zero: "if you're
   * writing the same block twice, stop"). The two public handlers
   * below (`handleQuickPublish`, `handleTimerPublish`) stay as
   * thin wrappers: they translate their kind-specific payload
   * shape into the shared `PublishCheckinInput` and delegate here.
   *
   * Kind-specific fallbacks (timer's `?? userLat ?? currentCity.lat`,
   * status's scheduled_for, etc.) live inside each wrapper — NOT
   * here — so this engine only sees already-normalized data.
   *
   * Closes the loop per logic skill:
   *   1) Expire prior active checkins of the SAME kind (cross-kind
   *      stays untouched — user can hold one timer AND one status).
   *   2) Compute expires_at with the shared policy (scheduled +
   *      flexible → end-of-day; scheduled specific → scheduled_for;
   *      else now + duration).
   *   3) Resolve city via GPS (not Photon's raw p.city — we learned
   *      that the hard way, see CLAUDE.md).
   *   4) INSERT + optimistic addOptimistic for instant UI.
   *   5) createOrJoinStatusChat to spawn the group chat.
   *   6) Timer-only: stash active checkin id for the FAB badge.
   *   7) trackEvent + refetchCheckins.
   *   8) Error → Alert, never silent. */
  interface PublishCheckinInput {
    kind: 'status' | 'timer';
    /** Activity / status text. Shown as title on pin and in chat. */
    text: string;
    category: string;
    emoji: string;
    locationName: string;
    latitude: number;
    longitude: number;
    ageMin: number;
    ageMax: number;
    /** Only used when the checkin is NOT future-scheduled — defines
     *  the "now + X minutes" expiry for immediate posts and timers.
     *  Ignored when scheduledFor is a future Date. */
    durationMinutes: number;
    /** Date object for a future start time; null for "happening now"
     *  (timer or immediate status). */
    scheduledFor: Date | null;
    /** Status all-day flag — shifts expires_at to 23:59:59 of the
     *  scheduled_for day. Timers always pass false. */
    isFlexibleTime: boolean;
    /** Open-join vs. approval-required. Timers always pass true. */
    isOpen: boolean;
    /** Status-only: whether the pin shows a precise point or a
     *  general neighborhood. Timers always pass false. */
    isGeneralArea: boolean;
  }

  const publishCheckin = async (input: PublishCheckinInput) => {
    if (!userId) return;
    const isTimer = input.kind === 'timer';
    const alreadyPublishing = isTimer ? timerPublishing : quickPublishing;
    if (alreadyPublishing) return;
    const setPublishing = isTimer ? setTimerPublishing : setQuickPublishing;
    setPublishing(true);

    try {
      /* ── Geo gate (Phase 1) ─────────────────────────────
       *
       * The country of the pin coordinates MUST match the
       * user's current GPS country. This is the gate that
       * prevents someone in Israel from publishing a pin
       * in Bangkok.
       *
       * Ordering: runs BEFORE the moderation gate, because
       * a cross-country pin should never even reach content
       * scanning — it's categorically invalid.
       *
       * Fail modes:
       *   - GPS denied / unavailable → block with publishNoGps
       *   - Geocoder failure → block with publishGeocodeFail
       *   - Country mismatch → block with publishBody
       *
       * Fail-open is NOT allowed here — per spec red line,
       * a failed geo check always blocks. Better a moment
       * of friction than a fake pin on the map.
       *
       * SPEC: docs/product-decisions/2026-04-20-geo-boundaries-spec.md
       */
      const [viewerCountry, eventCountry] = await Promise.all([
        resolveCurrentCountry(),
        pinCountryFromCoords(input.latitude, input.longitude),
      ]);

      if (viewerCountry == null) {
        Alert.alert(
          t('geo.block.publishTitle'),
          t('geo.block.publishNoGps'),
        );
        return;
      }
      if (eventCountry == null) {
        Alert.alert(
          t('geo.block.publishTitle'),
          t('geo.block.publishGeocodeFail'),
        );
        return;
      }
      if (!isSameCountryAsViewer(viewerCountry, eventCountry)) {
        Alert.alert(
          t('geo.block.publishTitle'),
          t('geo.block.publishBody', {
            eventCountry: countryLabel(eventCountry, locale),
            homeCountry: countryLabel(viewerCountry, locale),
          }),
        );
        return;
      }

      /* ── Moderation gate ───────────────────────────────
       *
       * Same gate the chat uses, applied to the activity
       * text. If flagged → polite Alert, no INSERT. If
       * rate-limited → "paused for an hour" Alert, no
       * INSERT. Per the launch freedom policy this only
       * catches the Apple-1.2-required categories
       * (slurs / threats / sexual targeting / self-harm),
       * not casual profanity. */
      const moderation = await gateContent({
        userId,
        surface: 'checkin',
        text: input.text,
      });
      if (moderation.state === 'flagged') {
        Alert.alert(
          t('moderation.blockedTitle'),
          t('moderation.blockedCheckinBody'),
        );
        return;
      }
      if (moderation.state === 'rate_limited') {
        Alert.alert(
          t('moderation.rateLimitedTitle'),
          t('moderation.rateLimitedBody'),
        );
        return;
      }

      // 1) Expire prior active checkins of the same kind only.
      await supabase
        .from('app_checkins')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('checkin_type', input.kind);

      // 2) expires_at policy — shared between status and timer.
      const isFutureScheduled =
        input.scheduledFor instanceof Date && input.scheduledFor.getTime() > Date.now();
      let expiresAt: string;
      if (isFutureScheduled) {
        if (input.isFlexibleTime) {
          const endOfDay = new Date(input.scheduledFor!);
          endOfDay.setHours(23, 59, 59, 999);
          expiresAt = endOfDay.toISOString();
        } else {
          expiresAt = input.scheduledFor!.toISOString();
        }
      } else {
        expiresAt = new Date(Date.now() + input.durationMinutes * 60 * 1000).toISOString();
      }

      // 3) Resolve city from GPS, not raw Photon p.city.
      const resolvedCity = await resolveCheckinCity(input.latitude, input.longitude);

      // 4) INSERT. Always public — user explicitly chose to post.
      //    The `country` field is set from the value the geo gate
      //    already resolved a few lines above — one lookup, used
      //    for both the gate AND the row write. See spec.
      const { data: newCheckin, error: insertErr } = await supabase
        .from('app_checkins')
        .insert({
          user_id: userId,
          city: resolvedCity,
          country: eventCountry,
          checkin_type: input.kind,
          status_text: input.text,
          status_emoji: input.emoji,
          category: input.category,
          activity_text: input.text,
          location_name: input.locationName,
          latitude: input.latitude,
          longitude: input.longitude,
          scheduled_for: input.scheduledFor?.toISOString() ?? null,
          expires_at: expiresAt,
          is_flexible_time: input.isFlexibleTime,
          is_open: input.isOpen,
          visibility: 'public',
          is_active: true,
          member_count: 1,
          age_min: input.ageMin,
          age_max: input.ageMax,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(`Error creating ${input.kind} checkin:`, insertErr);
        Alert.alert(
          t('creation.error.title'),
          insertErr.message
            ? t('creation.error.body', { detail: insertErr.message })
            : t('creation.error.bodyGeneric')
        );
        return;
      }

      // 5) Optimistic UI — new pin appears on the map before the
      //    refetch cycle completes.
      if (newCheckin?.id) {
        addOptimistic({
          id: newCheckin.id,
          user_id: userId,
          city: resolvedCity,
          checkin_type: input.kind,
          status_text: input.text,
          status_emoji: input.emoji,
          category: input.category,
          activity_text: input.text,
          location_name: input.locationName,
          latitude: input.latitude,
          longitude: input.longitude,
          expires_at: expiresAt,
          is_active: true,
          visibility: 'public',
          member_count: 1,
          is_open: input.isOpen,
          age_min: input.ageMin,
          age_max: input.ageMax,
          profile: {
            full_name: myName,
            username: myProfile?.username || '',
            avatar_url: myProfile?.avatar_url || null,
            job_type: myProfile?.job_type || null,
            bio: myProfile?.bio || '',
            interests: (myProfile as any)?.interests || [],
          },
        } as any);
      }

      // 6) Group chat — fires system "joined the group" message
      //    internally. Single-user at first (the creator); visitors
      //    join via TimerBubble later.
      await createOrJoinStatusChat(userId, userId, input.text, {
        emoji: input.emoji,
        category: input.category,
        activityText: input.text,
        locationName: input.locationName,
        latitude: input.latitude,
        longitude: input.longitude,
        isGeneralArea: input.isGeneralArea,
        scheduledFor: input.scheduledFor?.toISOString() ?? null,
        isOpen: input.isOpen,
        checkinId: newCheckin?.id || undefined,
      });

      // 7) Timer-only: the FAB badge tracks the currently-running
      //    timer so "+ publish" opens the bubble with a "replace"
      //    banner instead of a fresh one.
      if (isTimer && newCheckin?.id) setActiveTimerCheckin(newCheckin.id);

      // 8) Track + refetch. CreationBubble owns the visual success
      //    step; we don't surface another one here.
      trackEvent(
        userId,
        isTimer ? 'create_timer' : 'create_status',
        'checkin',
        newCheckin?.id,
        { city: resolvedCity },
      );
      refetchCheckins();
    } catch (err: any) {
      console.error(`${input.kind} publish error:`, err);
      Alert.alert(
        t('creation.error.title'),
        err?.message
          ? t('creation.error.body', { detail: err.message })
          : t('creation.error.bodyGeneric')
      );
    } finally {
      setPublishing(false);
    }
  };

  /* ── Status publish wrapper — adapts QuickActivityData to the
   *    shared PublishCheckinInput. Preserves the exact fallback
   *    behavior the previous inline handler had (no GPS fallback
   *    for lat/lng — the caller is expected to have picked coords
   *    via pickMode / CreationBubble before this runs). */
  const handleQuickPublish = async (data: QuickActivityData) => {
    await publishCheckin({
      kind: 'status',
      text: data.activityText,
      category: data.category,
      emoji: data.emoji,
      locationName: data.locationName,
      latitude: data.latitude,
      longitude: data.longitude,
      ageMin: data.ageMin ?? 18,
      ageMax: data.ageMax ?? 100,
      durationMinutes: data.durationMinutes || 60,
      scheduledFor: data.scheduledFor ?? null,
      isFlexibleTime: data.isFlexibleTime ?? false,
      isOpen: data.isOpen ?? true,
      isGeneralArea: data.isGeneralArea ?? false,
    });
  };

  /* ── Timer publish wrapper — adapts TimerData to the shared
   *    PublishCheckinInput. Applies the timer-specific fallbacks
   *    for location_name + lat/lng at the boundary, matching the
   *    pre-unification handler's behavior 1:1. */
  const handleTimerPublish = async (data: TimerData) => {
    await publishCheckin({
      kind: 'timer',
      text: data.statusText,
      category: data.category,
      emoji: data.emoji,
      locationName: data.locationName || currentCity.name,
      latitude: data.latitude ?? userLat ?? currentCity.lat,
      longitude: data.longitude ?? userLng ?? currentCity.lng,
      ageMin: data.ageMin ?? 18,
      ageMax: data.ageMax ?? 100,
      durationMinutes: data.durationMinutes,
      scheduledFor: null,
      isFlexibleTime: false,
      isOpen: true,
      isGeneralArea: false,
    });
  };

  /* ── Creation publish bridge ──
   *
   * CreationBubble emits a kind-tagged CreationPayload; we fan it
   * out to the existing per-kind publish handlers so the DB insert
   * logic stays in one place (avoiding yet another duplicate
   * publish pipeline, which would violate CLAUDE.md Rule Zero).
   *
   * Declared here (not higher in the file) so the closure captures
   * the fresh handleQuickPublish / handleTimerPublish identities —
   * they're re-created on every render, and a too-early useCallback
   * would capture stale closures. */
  const handleCreationPublish = (data: CreationPayload) => {
    if (data.kind === 'timer') {
      handleTimerPublish({
        category: data.category,
        emoji: data.emoji,
        statusText: data.text,
        locationName: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        durationMinutes: data.durationMinutes,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
      });
    } else {
      handleQuickPublish({
        category: data.category,
        activityText: data.text,
        emoji: data.emoji,
        locationName: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        isGeneralArea: false,
        scheduledFor: data.scheduledFor,
        isFlexibleTime: true,
        isNow: !data.scheduledFor,
        isOpen: data.isOpen,
        ageMin: data.ageMin,
        ageMax: data.ageMax,
        durationMinutes: data.durationMinutes,
      });
    }
    setShowCreation(false);
  };

  /* ── Cancel active timer with reason ── */
  const CANCEL_REASONS = [
    { key: 'found_company', label: 'Found company', emoji: '🤝' },
    { key: 'left_place', label: 'Left the place', emoji: '🚶' },
    { key: 'changed_plans', label: 'Changed plans', emoji: '🔄' },
    { key: 'other', label: 'Other reason', emoji: '💭' },
  ];

  const handleCancelTimer = async (reason: string) => {
    if (!userId || !activeTimerCheckin) return;
    // 1. Deactivate the checkin
    await supabase
      .from('app_checkins')
      .update({ is_active: false })
      .eq('id', activeTimerCheckin);

    // 2. Delete/close the associated chat
    if (activeTimerChatId) {
      // Delete messages first, then conversation
      await supabase.from('app_messages').delete().eq('conversation_id', activeTimerChatId);
      await supabase.from('app_conversation_members').delete().eq('conversation_id', activeTimerChatId);
      await supabase.from('app_conversations').delete().eq('id', activeTimerChatId);
    }

    setActiveTimerCheckin(null);
    setActiveTimerChatId(null);
    setShowCancelTimer(false);
    refetchCheckins();
  };

  /* ── Expired-timer local cleanup (client-side state only) ──
     REMOVED 2026-04-20: the previous implementation ran every 60 s
     on EVERY active client and issued an UPDATE + three DELETEs on
     app_messages / app_conversation_members / app_conversations for
     every expired checkin. With N clients this multiplied DB load by
     N and was one of the two main contributors to the DB storm that
     locked us out this morning. It also violated the timer spec,
     which says the chat must SURVIVE expiry so members can chat the
     afterglow.

     Server side now owns lifecycle: the pg_cron `cleanup_checkins`
     function flips is_active=false and posts a system message into
     the chat. The chat + members + messages stay put. The pin
     disappears from the map because useActiveCheckins filters by
     is_active + expires_at.

     If we need client-side state cleanup (e.g., clear a local
     activeTimerCheckin that expired), that can be done in a tiny
     pure-local effect that doesn't touch the DB. Adding that back
     later if it becomes a bug, NOT preemptively. */

  /* ── Layout cascade — header height measured dynamically ── */
  const [headerH, setHeaderH] = useState(0);
  const onHeaderLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && h !== headerH) setHeaderH(h);
  }, [headerH]);
  const vibeTop = headerH > 0 ? headerH + s(2) : insets.top + s(36) + s(2);   // 4px gap after header
  const cityTop = vibeTop + s(14) + s(4);

  return (
    <View style={st.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Offscreen capture stage for the image-based marker pipeline.
       * Rendered OUTSIDE <MapView> on purpose — see MarkerCaptureStage
       * docstring. Kept high in the JSX tree (right after StatusBar)
       * so it mounts as early as possible relative to MapView, giving
       * captures a head start and minimizing the window during which
       * the user sees the fallback child render on Samsung One UI. */}
      <MarkerCaptureStage
        checkins={filteredCheckins}
        capturedKeys={markerCapturedKeysSnapshot}
        st={st}
        avatarUri={avatarUri}
        hotMap={hotCheckins}
        onCaptured={handleMarkerCaptured}
      />

      {/* ── REAL MAP ── */}
      <MapView
        ref={mapRef}
        style={st.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation={true}
        showsCompass={false}
        showsMyLocationButton={false}
        onPress={() => {
          // Tapping the map (not a pin) dismisses the bubble. The
          // Bubble has its own transparent backdrop Pressable that
          // also catches taps — this is a safety net for taps that
          // land directly on the Map rather than on the backdrop.
          if (timerBubbleCheckin) dismissTimerBubble();
        }}
        // @ts-ignore — mapLanguage supported in react-native-maps 1.10+
        mapLanguage="en"
        customMapStyle={isDark ? DIM_MAP_STYLE : []}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        mapPadding={{
          top: (headerH > 0 ? headerH : insets.top + s(36)) + s(30),
          left: 0,
          right: 0,
          // Bottom padding controls where Google's native UI (logo,
          // location button, compass) sits relative to the visible map
          // area. Was s(40) — that left a ~40pt empty gap between the
          // logo and the bottom tab bar that the owner flagged 2026-04-28
          // as "too high". The bottom tab bar height (App.tsx) is
          // s(30) + insets.bottom, so a small s(8) here pulls the logo
          // close to the tab bar without it disappearing behind it.
          bottom: s(8),
        }}
        onRegionChangeComplete={(region) => {
          // Bubble is bottom-docked now (no anchor), so map pan/zoom
          // doesn't affect it. The user can freely explore the map
          // while the popup is open at the bottom — same as Apple
          // Maps / Google Maps.
          // Collect checkins visible in current map region
          const visible = filteredCheckins.filter(c => {
            const lat = c.latitude ?? 0;
            const lng = c.longitude ?? 0;
            return (
              lat >= region.latitude - region.latitudeDelta / 2 &&
              lat <= region.latitude + region.latitudeDelta / 2 &&
              lng >= region.longitude - region.longitudeDelta / 2 &&
              lng <= region.longitude + region.longitudeDelta / 2
            );
          });
          const nextCount = visible.length;
          const nextIds = visible.map(c => c.user_id);

          // Guard: only commit state if something actually changed.
          // Every pan fires onRegionChangeComplete, and blindly calling
          // setState with a fresh `new Set(...)` each time re-renders
          // HomeScreen → rebuilds every Marker → the inline coordinate
          // objects change reference → react-native-maps issues native
          // position updates → the pins appear to "dance" left-right.
          // This guard collapses the no-op updates so the map is stable
          // while panning inside the same cluster of pins.
          setVisibleNomadCount(prev => (prev === nextCount ? prev : nextCount));
          setVisibleNomadIds(prev => {
            if (prev.size === nextIds.length && nextIds.every(id => prev.has(id))) {
              return prev;
            }
            return new Set(nextIds);
          });

          // ── pickMode: track the center of the settled region as
          //    the user's pick, and reverse-geocode with a debounce.
          //    We only do this while pickMode is active so the
          //    geocoder isn't pestered during normal browsing.
          //    Same no-op guard as above — if the user settled on a
          //    coord that rounds to the same 6-decimal place we had
          //    before, skip the setState cascade so the memoized
          //    marker list doesn't invalidate.
          if (pickMode !== 'browse') {
            setPickLat(prev => (Math.abs(prev - region.latitude) < 1e-6 ? prev : region.latitude));
            setPickLng(prev => (Math.abs(prev - region.longitude) < 1e-6 ? prev : region.longitude));
            setPickResolving(prev => (prev ? prev : true));
            if (pickGeocodeTimer.current) clearTimeout(pickGeocodeTimer.current);
            // 350ms debounce — a human drag settles around 250-300ms
            // before they let go; this avoids Nominatim requests for
            // every micro-adjustment.
            pickGeocodeTimer.current = setTimeout(async () => {
              const addr = await reverseGeocodeAddress(
                region.latitude, region.longitude,
              );
              // Only commit if we're still in pickMode — user may
              // have cancelled while we were awaiting the network.
              setPickMode(current => {
                if (current !== 'browse') {
                  setPickAddr(addr || currentCity.name || '');
                  setPickResolving(false);
                }
                return current;
              });
            }, 350);
          }
        }}
      >
        {/* ── ALL NOMAD MARKERS — show full density ──
             The array itself is memoized above (`nomadMarkers`) so
             we hand react-native-maps the SAME element references
             across renders. Without this, every re-render rebuilt
             every Marker with a fresh coordinate object and the
             pins "jumped" across the whole app. */}
        {nomadMarkers}
      </MapView>

      {/* ═══════════════════════════════════════════════════════════
           PICK MODE OVERLAY — center pin + bottom panel
           ═══════════════════════════════════════════════════════════
           Rendered ONLY while the user is picking a location for a
           new Status or Timer. The pin is an absolute-positioned
           View at the geometric center of the map — NOT a Marker,
           because we want it glued to the SCREEN, not to a
           coordinate (same technique Waze, Uber, and Google Maps
           use for "drop a pin" flows).
           ═══════════════════════════════════════════════════════════ */}
      {pickMode !== 'browse' && (
        <>
          {/* Top search bar — optional shortcut. The user can still
               pan the map to drop the center pin anywhere; this is
               for the common case where they know the street name. */}
          <View style={[st.pickSearchWrap, { top: insets.top + s(6) }]}>
            <View style={[st.pickSearchBar, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
              <NomadIcon name="search" size={s(7)} color={colors.textMuted} strokeWidth={1.6} />
              <TextInput
                style={[st.pickSearchInput, { color: colors.dark }]}
                placeholder={t('pickMode.searchPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={pickSearchQuery}
                onChangeText={onPickSearchChange}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {pickSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setPickSearchQuery(''); setPickSearchResults([]); setPickSearching(false); Keyboard.dismiss(); }}>
                  <NomadIcon name="close" size={s(6)} color={colors.textMuted} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
            </View>
            {(pickSearching || pickSearchResults.length > 0) && (
              <View style={[st.pickSearchResults, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
                {pickSearching ? (
                  <Text style={[st.pickSearchEmpty, { color: colors.textMuted }]}>…</Text>
                ) : (
                  pickSearchResults.map((r, i) => (
                    <TouchableOpacity
                      key={`${r.lat},${r.lon}-${i}`}
                      style={[st.pickSearchRow, { borderBottomColor: colors.borderSoft }]}
                      onPress={() => onPickSearchSelect(r)}
                      activeOpacity={0.7}
                    >
                      <NomadIcon name="pin" size={s(5)} color={colors.primary} strokeWidth={1.6} />
                      <View style={{ flex: 1 }}>
                        <Text style={[st.pickSearchMain, { color: colors.dark }]} numberOfLines={1}>{r.mainLine || r.display_name}</Text>
                        {!!r.subLine && (
                          <Text style={[st.pickSearchSub, { color: colors.textMuted }]} numberOfLines={1}>{r.subLine}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Center pin — sits at screen-center, not at any coord.
               pointerEvents="none" so the map underneath still
               receives pan / zoom gestures. */}
          <View style={st.pickPinWrap} pointerEvents="none">
            <View style={st.pickPinShadow} />
            <NomadIcon
              name="pin"
              size={s(22)}
              strokeWidth={2}
              color={pickMode === 'timer' ? '#FF6B6B' : '#4ADE80'}
            />
          </View>

          {/* "Center on me" button — forces a fresh Location.getCurrent
               and animates the map there. Without this the user had to
               pan manually when the initial GPS snap lagged behind
               the iOS blue dot. Button sits above the bottom panel,
               aligned right, so left-handed pan isn't blocked. */}
          <TouchableOpacity
            style={[st.pickMyLocBtn, { backgroundColor: colors.card, borderColor: colors.borderSoft, bottom: insets.bottom + s(80) }]}
            activeOpacity={0.7}
            onPress={async () => {
              Haptics.selectionAsync().catch(() => {});
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                // Last-known is instant and matches the iOS blue dot.
                // Fresh getCurrentPositionAsync refines it a moment later.
                const last = await Location.getLastKnownPositionAsync();
                if (last) {
                  mapRef.current?.animateToRegion({
                    latitude: last.coords.latitude,
                    longitude: last.coords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }, 300);
                }
                const fresh = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.High,
                });
                mapRef.current?.animateToRegion({
                  latitude: fresh.coords.latitude,
                  longitude: fresh.coords.longitude,
                  latitudeDelta: 0.004,
                  longitudeDelta: 0.004,
                }, 350);
              } catch (err) {
                console.warn('[pickMode] center-on-me failed:', err);
              }
            }}
          >
            <NomadIcon name="crosshair" size={s(8)} color={colors.primary} strokeWidth={1.8} />
          </TouchableOpacity>

          {/* Bottom panel — address label + Continue / Cancel.
               Sits above the tab bar and below the map. The whole
               panel is a solid card so the user understands this is
               a modal-like state, not normal browse. */}
          <View
            style={[
              st.pickPanel,
              {
                backgroundColor: colors.card,
                borderColor: colors.borderSoft,
                bottom: insets.bottom + s(12),
              },
            ]}
          >
            <View style={st.pickPanelHeader}>
              <NomadIcon
                name="pin"
                size={s(6)}
                color={pickMode === 'timer' ? '#FF6B6B' : '#4ADE80'}
                strokeWidth={2}
              />
              <Text style={[st.pickPanelTitle, { color: colors.dark }]}>
                {pickMode === 'timer' ? t('pickMode.titleTimer') : t('pickMode.titleStatus')}
              </Text>
            </View>
            <Text
              style={[st.pickPanelAddress, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {pickResolving
                ? t('pickMode.resolving')
                : pickAddr || currentCity.name}
            </Text>
            <View style={st.pickPanelRow}>
              <TouchableOpacity
                style={[st.pickPanelCancel, { borderColor: colors.borderSoft }]}
                activeOpacity={0.7}
                onPress={cancelPickFromCreation}
              >
                <Text style={[st.pickPanelCancelText, { color: colors.textMuted }]}>
                  {t('pickMode.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  st.pickPanelContinue,
                  {
                    backgroundColor:
                      pickMode === 'timer' ? '#FF6B6B' : '#4ADE80',
                  },
                ]}
                activeOpacity={0.8}
                onPress={commitPickFromCreation}
              >
                <Text style={st.pickPanelContinueText}>{t('pickMode.continue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Bottom-sheet timer bubble ──
           Slides up from above the tab bar. Owns its own CTA
           (join / chat / leave / manage). Dismisses on backdrop tap
           or when another pin is tapped. The bubble's backdrop is
           transparent (no dim) so the user's map context stays clear. */}
      <TimerBubble
        visible={!!timerBubbleCheckin}
        checkin={timerBubbleCheckin as any}
        creatorName={timerBubbleCheckin?.profile?.full_name || 'Nomad'}
        creatorAvatarUrl={avatarUri((timerBubbleCheckin?.profile as any)?.avatar_url)}
        onClose={dismissTimerBubble}
        /* Wisdom gate — fires before the actual join. Cheap
           no-op for local taps (same city / same country);
           shows the "are you really going there?" prompt for
           far-away scheduled events. Previously wired only to
           ActivityDetailSheet; now wired here too so the
           scheduled-visitor flow still gates even though
           both pin types share the same bubble. */
        onBeforeJoin={(ck, doJoin) => {
          wisdomGate(
            (ck as any).city || currentCity.name,
            (ck.latitude as number) || currentCity.lat,
            (ck.longitude as number) || currentCity.lng,
            currentCity.country,
            doJoin,
          );
        }}
        onOwnerEnd={async (ck) => {
          // Expire the checkin in place — stays on map, no nav.
          // Works for both timers and scheduled statuses since
          // the DB shape is the same: is_active + expires_at.
          if (!ck?.id) return;
          const { error } = await supabase
            .from('app_checkins')
            .update({
              is_active: false,
              expires_at: new Date().toISOString(),
            })
            .eq('id', ck.id);
          if (error) {
            console.warn('[HomeScreen] onOwnerEnd failed:', error.message);
            return;
          }
          refetchCheckins();
        }}
      />

      {/* ── SNOOZE CLOUD OVERLAY — Simpsons-style clouds covering the map ── */}
      {isSnoozed && (
        <Animated.View style={[st.snoozeOverlay, { opacity: overlayOpacity }]}>
          {/* Dim backdrop */}
          <View style={st.snoozeDim} />

          {/* Left cloud cluster */}
          <Animated.View style={[st.cloudCluster, st.cloudLeft, { transform: [{ translateX: cloudLeftX }] }]}>
            <View style={[st.cloud, { width: s(80), height: s(40), top: '15%', left: -s(10) }]} />
            <View style={[st.cloud, { width: s(60), height: s(35), top: '35%', left: s(5) }]} />
            <View style={[st.cloud, { width: s(70), height: s(38), top: '55%', left: -s(5) }]} />
            <View style={[st.cloud, { width: s(50), height: s(28), top: '75%', left: s(10) }]} />
          </Animated.View>

          {/* Right cloud cluster */}
          <Animated.View style={[st.cloudCluster, st.cloudRight, { transform: [{ translateX: cloudRightX }] }]}>
            <View style={[st.cloud, { width: s(70), height: s(38), top: '10%', right: -s(8) }]} />
            <View style={[st.cloud, { width: s(55), height: s(32), top: '30%', right: s(8) }]} />
            <View style={[st.cloud, { width: s(75), height: s(40), top: '50%', right: -s(3) }]} />
            <View style={[st.cloud, { width: s(45), height: s(26), top: '70%', right: s(12) }]} />
          </Animated.View>

          {/* Center wake-up card */}
          <Animated.View style={[st.snoozeCard, { transform: [{ scale: cardScale }] }]}>
            <Text style={st.snoozeCardEmoji}>👻</Text>
            <Text style={st.snoozeCardTitle}>{t('hidden.title')}</Text>
            <Text style={st.snoozeCardSub}>
              {t('hidden.subHome')}
            </Text>
            <TouchableOpacity style={st.wakeUpBtn} onPress={handleWakeUp} activeOpacity={0.75}>
              <Text style={st.wakeUpBtnText}>{t('hidden.wakeUp')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── HEADER — floats above map ──
           Bell relocated to the right-side fabColumn (April 2026) so the
           top header carries only brand + city search. The Bell is now
           rendered alongside the My-Location button, in the same
           visual column where the green Plus used to live. */}
      <View style={[st.header, { paddingTop: insets.top }]} onLayout={onHeaderLayout}>
        <View style={st.hRow}>
          <Text style={st.brand}>{t('home.brand')}</Text>
        </View>
        {/* ── City Search Bar (compact) + City Label ── */}
        <View style={st.searchRow}>
          <View style={[st.searchBar, searchFocused && st.searchBarExpanded]}>
            <NomadIcon name="search" size={16} color="#aaa" strokeWidth={1.6} />
            <TextInput
              ref={searchInputRef}
              style={st.searchInput}
              placeholder="search city..."
              placeholderTextColor="#AAA"
              value={cityQuery}
              onChangeText={setCityQuery}
              onFocus={() => {
                setSearchFocused(true);
                // Always re-read the Recents list from storage on focus so
                // the dropdown reflects the truth AsyncStorage has (e.g.
                // after switching users or after another screen mutated it).
                loadRecentCities(userId).then(setRecentCities);
              }}
              returnKeyType="search"
            />
            {searchFocused && (
              <TouchableOpacity onPress={closeSearch}>
                <NomadIcon name="close" size={18} color="#888" strokeWidth={1.8} />
              </TouchableOpacity>
            )}
            {!searchFocused && !checkinsLoading && (
              <View style={st.searchBadge}>
                <View style={st.searchBadgeDot} />
                <Text style={st.searchBadgeTxt}>{activeCount}</Text>
              </View>
            )}
          </View>
          {!searchFocused && (
            <Text style={st.searchCityLabel} numberOfLines={1}>{currentCity.flag} {currentCity.name}</Text>
          )}
        </View>

        {/* ── Search Dropdown (recents + results) ── */}
        {searchFocused && (
          <View style={st.cityDropdown}>
            {cityQuery.length < 2 && recentCities.length > 0 && (
              <>
                <View style={st.cityDropSection}>
                  <NomadIcon name="clock" size={14} color="#aaa" strokeWidth={1.4} />
                  <Text style={st.cityDropSectionText}>Recent</Text>
                </View>
                {recentCities.map((city, i) => (
                  <View key={`recent-${i}`} style={[st.cityDropItem, { paddingRight: s(3) }]}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => handleCitySearchSelect(city)}
                      activeOpacity={0.7}
                    >
                      <NomadIcon name="pin" size={16} color={colors.primary} strokeWidth={1.6} />
                      <Text style={[st.cityDropName, { marginLeft: s(3) }]} numberOfLines={1}>{city.name}</Text>
                      <Text style={st.cityDropCountry} numberOfLines={1}>{city.country}</Text>
                    </TouchableOpacity>
                    {/* X — remove this city from the recent list. Tapping
                         the row still opens the city; only the X deletes. */}
                    <TouchableOpacity
                      onPress={async () => {
                        const next = recentCities.filter(c => !(c.name === city.name && c.country === city.country));
                        setRecentCities(next);
                        try { await AsyncStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(next)); } catch {}
                        if (userId) {
                          await supabase.from('app_profiles').update({ recent_cities: next }).eq('user_id', userId);
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ padding: s(2), marginLeft: s(2) }}
                    >
                      <NomadIcon name="close" size={14} color="#C5C5C5" strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
            {cityQuery.length >= 2 && citySearching && (
              <View style={st.cityDropItem}>
                <Text style={st.cityDropMuted}>Searching...</Text>
              </View>
            )}
            {cityQuery.length >= 2 && !citySearching && cityResults.length > 0 && (
              <>
                {cityResults.map((city, i) => (
                  <TouchableOpacity
                    key={`result-${i}`}
                    style={st.cityDropItem}
                    onPress={() => handleCitySearchSelect(city)}
                    activeOpacity={0.7}
                  >
                    <NomadIcon name="pin" size={16} color={colors.primary} strokeWidth={1.6} />
                    <Text style={st.cityDropName} numberOfLines={1}>{city.name}</Text>
                    <Text style={st.cityDropCountry} numberOfLines={1}>{city.country}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {cityQuery.length < 2 && recentCities.length === 0 && (
              <View style={st.cityDropItem}>
                <Text style={st.cityDropMuted}>Type a city or country name...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── VIBE BAR — floats above map ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[st.vibeBar, { top: vibeTop }]}
        contentContainerStyle={{ paddingHorizontal: s(10), gap: s(3.5), alignItems: 'center' }}
      >
        {visibleVibes.map((v) => {
          // 'All' chip's catKey is undefined; it represents the
          // "no filter" state, which we model as activeCatKey === null.
          const chipKey = v.catKey ?? null;
          const isActive = chipKey === activeCatKey;
          return (
            <TouchableOpacity
              key={v.label}
              style={[st.chip, isActive && st.chipOn]}
              onPress={() => setActiveCatKey(chipKey)}
              activeOpacity={0.7}
            >
              {v.icon && (
                <View style={{ marginRight: s(0.5) }}>
                  <NomadIcon name={v.icon} size={s(6.5)} strokeWidth={1.8} color={isActive ? 'white' : (v.color || colors.textSec)} />
                </View>
              )}
              <Text style={[st.chipTxt, isActive && st.chipTxtOn]}>{v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── NOMADS BUBBLE — floats above map ── */}
      <View style={[st.nomadsBubbleWrap, { top: cityTop }]}>
        <TouchableOpacity
          style={st.nomadsBubble}
          activeOpacity={0.8}
          onPress={() => setShowNomadsList(true)}
        >
          {/* Stacked mini avatars */}
          <View style={st.nomadsBubbleAvatars}>
            {nomadsInCity.slice(0, 3).map((n, i) => (
              <View key={n.user_id} style={[st.nomadsMiniAv, { marginLeft: i > 0 ? -s(3) : 0, zIndex: 3 - i }]}>
                {n.avatar_url ? (
                  <Image source={{ uri: avatarUri(n.avatar_url) }} style={st.nomadsMiniAvImg} />
                ) : (
                  <Text style={st.nomadsMiniAvTxt}>
                    {(n.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            ))}
          </View>
          <View style={st.nomadsBubbleTextCol}>
            <Text style={st.nomadsBubbleCount}>{nomadsLoading ? '…' : Math.max(0, nomadsInCity.filter(n => n.user_id !== userId).length)}</Text>
            <Text style={st.nomadsBubbleLabel}>{t('home.nomadsHere')}</Text>
          </View>
          <NomadIcon name="forward" size={s(6)} color="#1A1A1A" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── FAB Column — Bell + My-Location stack ──
           April 2026: the Plus button moved to the bottom tab bar
           (see CreateFab in App.tsx) and is now visible across
           every tab — Home, People, Pulse, Profile. The Bell that
           used to sit in the top-right header took the Plus's old
           slot here, beside the My-Location button.

           Hidden when the user is in snooze mode — show_on_map=false
           means no map presence, so floating affordances would be
           noise. Notifications are still reachable via the standard
           push flow / system tray; the in-app Bell just hides while
           the user is invisible. */}
      {!isSnoozed && <View style={st.fabColumn}>
        {/* Notifications bell (bottom of column) — same visual
            language as the My-Location button below. onPress opens
            the standard NotificationsSheet defined further down in
            this file. */}
        <TouchableOpacity
          accessibilityLabel={t('home.notifications')}
          accessibilityRole="button"
          style={st.fabLocationBtn}
          activeOpacity={0.8}
          onPress={() => {
            // Just open the sheet. The sheet itself runs the
            // mark-all-as-read flow after a 1.5s delay — see
            // NotificationsSheet's useEffect on `visible`. After
            // that delay it both patches its own list AND calls
            // onMarkedAllRead → refetchNotifs → the bell badge
            // drops to 0. Pre-fix we ALSO called markNotifsRead
            // here eagerly, which made the badge vanish before the
            // user's eyes had a chance to register the count, AND
            // duplicated the DB write the sheet would do anyway.
            setShowNotifs(true);
          }}
        >
          <NomadIcon name="bell" size={s(10)} color="#555" strokeWidth={1.8} />
          {/* Unread badge — red pill with count, capped at 9+ so we
              don't blow the bell out of layout for power users. */}
          {notifUnread > 0 && (
            <View style={st.bellBadge}>
              <Text style={st.bellBadgeText}>
                {notifUnread > 9 ? '9+' : String(notifUnread)}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* My Location — white square (top) */}
        <TouchableOpacity
          style={st.fabLocationBtn}
          activeOpacity={0.8}
          onPress={() => {
            const goToMyLocation = async (lat: number, lng: number) => {
              mapRef.current?.animateToRegion({
                latitude: lat, longitude: lng,
                latitudeDelta: 0.02, longitudeDelta: 0.02,
              }, 800);
              const nearestCity = findNearestCity(lat, lng, 50);
              if (nearestCity) { setCurrentCity(nearestCity); return; }
              // No CITIES entry within 50 km — delegate to the
              // shared reverse-geocoder. Returns empty fields on any
              // network / parse failure, so a bad result just leaves
              // the existing city label in place. The map still pans
              // to `lat,lng` regardless. Previous inline fetch here
              // was a Rule Zero violation (re-implemented extraction
              // rules that already lived in lib/cityResolver).
              const { cityName, country, countryCode } = await reverseGeocodeCityFull(lat, lng);
              if (cityName) {
                setCurrentCity({
                  id: `${cityName}-${country}`.toLowerCase().replace(/\s/g, '-'),
                  name: cityName, country, countryCode, flag: '', lat, lng, active: 0,
                });
              }
            };
            if (userLat && userLng) {
              goToMyLocation(userLat, userLng);
            } else {
              (async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    // Tell the user WHY nothing happened — silent
                    // failure on a direct button tap is the worst
                    // kind of UX. The message mirrors iOS/Android
                    // native copy so it reads familiar.
                    Alert.alert(
                      'Location access needed',
                      'Turn on location in your system settings to center the map on where you are.',
                    );
                    return;
                  }
                  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                  setUserLat(pos.coords.latitude);
                  setUserLng(pos.coords.longitude);
                  goToMyLocation(pos.coords.latitude, pos.coords.longitude);
                } catch (err) {
                  console.warn('[HomeScreen] "my location" GPS fetch failed:', err);
                  Alert.alert(
                    'Could not find your location',
                    'Check your internet and GPS, then try again.',
                  );
                }
              })();
            }
          }}
        >
          <NomadIcon name="crosshair" size={s(10)} color="#555" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>}

      {/* Check-in is now done from Profile > Status button */}

      {/* ── Bottom Sheets ── */}
      <ProfileCardSheet
        visible={showProfile}
        nomad={selectedNomad}
        onClose={() => setShowProfile(false)}
        onViewProfile={handleViewProfile}
        onSayHi={handleSayHi}
        onFollow={(targetId) => { toggleFollow(targetId); }}
        isFollowing={selectedNomad ? isFollowing(selectedNomad.id) : false}
        onJoinStatus={async (statusUserId, statusText) => {
          if (!userId) return;
          const doJoin = async () => {
            setShowProfile(false);
            const { conversationId, error } = await createOrJoinStatusChat(userId, statusUserId, statusText);
            if (conversationId && !error) {
              nav.navigate('Chat', {
                conversationId,
                title: statusText || 'Activity',
                avatarColor: colors.accent,
                avatarText: (statusText || 'ACT').slice(0, 3).toUpperCase(),
                isGroup: true,
              });
            }
          };
          // Close ProfileCard first so WisdomPrompt can render on top (no nested Modals)
          setShowProfile(false);
          // Wisdom gate — check if user is far from this city
          wisdomGate(
            currentCity.name,
            currentCity.lat,
            currentCity.lng,
            currentCity.country,
            doJoin,
          );
        }}
      />
      <NotificationsSheet
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={userId}
        onNavigate={(screen, params) => {
          setShowNotifs(false);
          setTimeout(() => nav.navigate(screen as any, params as any), 200);
        }}
        // The sheet calls this once it has marked rows as read in
        // DB + local state. Refetching here keeps the bell badge in
        // sync with the per-row visual state inside the sheet.
        onMarkedAllRead={refetchNotifs}
      />
      {/* CityPickerSheet removed — replaced by inline search */}

      {/* ── Nomads List Sheet ──
           nearbyIds + bubbleTop used to be passed here but the
           component never consumed them — the sheet computes its
           own layout and shows everyone in the city. Removed to
           silence TS errors that were masking the unused-prop
           drift. */}
      <NomadsListSheet
        visible={showNomadsList}
        onClose={() => setShowNomadsList(false)}
        nomads={nomadsInCity}
        cityName={currentCity.name}
        listCountryCode={currentCity.countryCode}
        onViewProfile={(uid, name) => {
          setShowNomadsList(false);
          setTimeout(() => nav.navigate('UserProfile', { userId: uid, name }), 200);
        }}
      />

      {/* ── Creation Bubble — the unified Status / Timer flow ──
           Single bottom-docked bubble that walks the user through
           WHAT → WHERE → WHO → PUBLISH using the exact same shell
           as TimerBubble. Replaces the old sheets for normal
           creation flows. The old sheets below are kept rendered
           but never opened in the happy path — they stay as a
           safety valve for any legacy entry point. */}
      <CreationBubble
        visible={showCreation}
        userName={(myName || 'nomad').split(' ')[0] || 'nomad'}
        sessionKey={creationSessionKey}
        userAvatarUrl={avatarUri(myProfile?.avatar_url)}
        userFallback={myInitials}
        // Neutral dark-grey fallback (not the brand coral) so the
        // avatar circle doesn't make the whole bubble read as
        // "reddish" when the user has no profile picture yet.
        userFallbackColor={'#374151'}
        seedLat={creationSeedLat}
        seedLng={creationSeedLng}
        seedAddress={creationSeedAddr}
        cityName={currentCity.name}
        // Publishing flag — either pipeline can be in-flight since
        // the bubble's WHEN answer decides which handler runs.
        publishing={timerPublishing || quickPublishing}
        onClose={() => setShowCreation(false)}
        onRequestLocationPick={handleCreationRequestPick}
        onPublish={handleCreationPublish}
        locationUpdaterRef={creationLocationUpdater}
        hasActiveTimer={hasActiveTimer}
        hasActiveScheduled={hasActiveScheduled}
        /* Synergy: the "+" bubble's age slider starts from the
           user's profile-level age preference. Whatever they
           set in Settings (or during onboarding) pre-fills
           every new event. They can still drag to override
           per-event. Pre-refactor these were hardcoded 18/80
           inside the bubble, which silently ignored the
           user's own preference — a classic drift bug. */
        defaultAgeMin={myProfile?.age_min ?? null}
        defaultAgeMax={myProfile?.age_max ?? null}
      />

      {/* ── פניני חוכמה — Wisdom Prompt ── */}
      <WisdomPrompt
        visible={showWisdom}
        cityName={wisdomCity}
        distanceKm={wisdomDistance}
        distanceUnit={(myProfile as any)?.distance_unit || 'km'}
        existingIntent={wisdomExistingIntent}
        onResponse={handleWisdomResponse}
        onCancel={() => { setShowWisdom(false); setWisdomPendingAction(null); }}
      />

      {/* ── Cancel Active Timer Popup ── */}
      <Modal visible={showCancelTimer} transparent animationType="fade" onRequestClose={() => setShowCancelTimer(false)}>
        <View style={st.cancelOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCancelTimer(false)} />
          <View style={[st.cancelSheet, { paddingBottom: insets.bottom + s(6) }]}>
            <View style={st.cancelHandle} />
            <Text style={st.cancelTitle}>You have an active timer</Text>
            <Text style={st.cancelSub}>End it to start a new one, or keep it running</Text>

            <TouchableOpacity
              style={st.cancelEndBtn}
              activeOpacity={0.8}
              onPress={() => handleCancelTimer('ended')}
            >
              <NomadIcon name="close" size={s(7)} color="white" strokeWidth={1.8} />
              <Text style={st.cancelEndText}>End timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.cancelKeepBtn}
              activeOpacity={0.8}
              onPress={() => setShowCancelTimer(false)}
            >
              <Text style={st.cancelKeepText}>Keep my timer running</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Replace-status modal removed — the one-active-per-type
           rule is now enforced inside CreationBubble's PUBLISH
           step. When the user's answer conflicts with an active
           timer or scheduled event, a warning banner appears
           above the summary pills and the Publish button label
           becomes "Replace and publish". One warning, one flow,
           one language — per CLAUDE.md Rule Zero. */}

      {/* ── Welcome celebration overlay ── */}
      {showWelcome && (
        <Animated.View style={[st.welcomeOverlay, { opacity: welcomeOpacity }]} pointerEvents="none">
          <Text style={st.welcomeEmoji}>🎉</Text>
          <Text style={st.welcomeTitle}>welcome, nomad!</Text>
          <Text style={st.welcomeSub}>your adventure starts here</Text>
        </Animated.View>
      )}
    </View>
  );
}

/* ─── Styles — all sizes are s(mockup_px) ─── */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },

  /* ── Pick-mode overlay (pin + bottom panel) ──
     Pin sits at the geometric center of the visible map area, NOT
     anchored to a coordinate, so it tracks the screen as the user
     pans. The shadow gives it a touch of dimensionality so it
     doesn't look painted on. */
  pickPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -s(11),
    // Slight negative Y because the pin's visual weight is at the
    // bottom — the tip should land at the center, not the head.
    marginTop: -s(20),
    alignItems: 'center',
    zIndex: 80,
  },
  pickPinShadow: {
    position: 'absolute',
    bottom: -s(2),
    width: s(8),
    height: s(2.5),
    borderRadius: s(1.5),
    backgroundColor: 'rgba(0,0,0,0.25)',
    transform: [{ scaleX: 1.4 }],
  },

  /* Pick-mode search bar (top) */
  pickSearchWrap: {
    position: 'absolute',
    left: s(8),
    right: s(8),
    zIndex: 95,
  },
  pickSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    borderRadius: s(8),
    borderWidth: 0.5,
    paddingHorizontal: s(7),
    paddingVertical: s(5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.12,
    shadowRadius: s(5),
    elevation: 4,
  },
  pickSearchInput: {
    flex: 1,
    fontSize: s(7),
    fontWeight: FW.regular,
    paddingVertical: 0,
  },
  pickSearchResults: {
    marginTop: s(4),
    borderRadius: s(8),
    borderWidth: 0.5,
    paddingVertical: s(2),
    maxHeight: s(70),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.12,
    shadowRadius: s(5),
    elevation: 4,
  },
  pickSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(7),
    paddingVertical: s(5),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickSearchMain: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
  },
  pickSearchSub: {
    fontSize: s(5.5),
    fontWeight: FW.regular,
    marginTop: s(0.5),
  },
  pickSearchEmpty: {
    fontSize: s(6),
    fontWeight: FW.regular,
    textAlign: 'center',
    paddingVertical: s(6),
  },

  /* Floating "center on me" button inside pickMode. Sits above
     the bottom panel on the right edge — doesn't obscure the
     pin or the CTAs. */
  pickMyLocBtn: {
    position: 'absolute',
    right: s(10),
    width: s(20),
    height: s(20),
    borderRadius: s(10),
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 88,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.15,
    shadowRadius: s(5),
    elevation: 5,
  },
  pickPanel: {
    position: 'absolute',
    left: s(10),
    right: s(10),
    borderRadius: s(10),
    borderWidth: 0.5,
    paddingHorizontal: s(10),
    paddingVertical: s(8),
    zIndex: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.18,
    shadowRadius: s(6),
    elevation: 6,
  },
  pickPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginBottom: s(2),
  },
  pickPanelTitle: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
    letterSpacing: 0.1,
  },
  pickPanelAddress: {
    fontSize: s(6),
    fontWeight: FW.regular,
    marginBottom: s(8),
    minHeight: s(14),
  },
  pickPanelRow: {
    flexDirection: 'row',
    gap: s(6),
  },
  pickPanelCancel: {
    flex: 1,
    height: s(18),
    borderRadius: s(7),
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickPanelCancelText: {
    fontSize: s(7),
    fontWeight: FW.medium,
  },
  pickPanelContinue: {
    flex: 2,
    height: s(18),
    borderRadius: s(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickPanelContinueText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: '#FFF',
    letterSpacing: 0.2,
  },

  /* ── Welcome celebration overlay ── */
  welcomeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  welcomeEmoji: { fontSize: s(28), marginBottom: s(8) },
  welcomeTitle: { fontSize: s(14), fontWeight: FW.extra, color: c.white, marginBottom: s(4) },
  welcomeSub: { fontSize: s(7), color: 'rgba(255,255,255,0.8)' },

  /* ── Snooze cloud overlay ── */
  snoozeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(180, 200, 220, 0.45)',
  },
  cloudCluster: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '60%',
  },
  cloudLeft: { left: 0 },
  cloudRight: { right: 0 },
  cloud: {
    position: 'absolute',
    backgroundColor: 'rgba(240, 245, 250, 0.85)',
    borderRadius: 999,
    shadowColor: '#B0C4D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  snoozeCard: {
    backgroundColor: c.card,
    borderRadius: s(14),
    paddingVertical: s(14),
    paddingHorizontal: s(12),
    alignItems: 'center',
    width: s(120),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 10,
  },
  snoozeCardEmoji: { fontSize: s(22), marginBottom: s(4) },
  snoozeCardTitle: {
    fontSize: s(9),
    fontWeight: FW.bold,
    color: c.dark,
    marginBottom: s(2),
  },
  snoozeCardSub: {
    fontSize: s(5.5),
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: s(8),
    marginBottom: s(8),
  },
  wakeUpBtn: {
    backgroundColor: c.primary,
    borderRadius: s(12),
    paddingVertical: s(5),
    paddingHorizontal: s(14),
  },
  wakeUpBtnText: {
    fontSize: s(6.5),
    fontWeight: FW.bold,
    color: c.white,
  },

  /* ── Map Pins — nomadspeople bubble design ── */
  pinWrap: { alignItems: 'center' },

  /* ── Unified marker bubble ──
   * One cohesive container for the whole pin: avatar circle on
   * top (with emoji badge), name underneath, timer countdown
   * underneath that. Single shadow, single colored border (green
   * for status, red for timer). Replaces the previous 3-stacked
   * floating shapes that read as "square with circle on top".
   * Per UX skill: looks like ONE thing the eye can land on. */
  markerBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: s(7),
    paddingHorizontal: s(4),
    paddingVertical: s(3),
    alignItems: 'center',
    borderWidth: 2.5,
    minWidth: s(28),
    maxWidth: s(42),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.18,
    shadowRadius: s(4),
    elevation: 5,
  },
  markerAvatarCircle: {
    width: s(18),
    height: s(18),
    // 9999 forces React Native + Android marker bitmap to clamp to
    // a perfect circle regardless of when the snapshot fires. Using
    // s(9) here meant the bitmap captured the literal radius before
    // overflow:hidden was enforced, leaving avatars as squares on
    // Samsung One UI / Pixel (Barak report 2026-04-27 "מרובעת").
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markerAvatarImg: {
    width: s(18),
    height: s(18),
    borderRadius: 9999,
  },
  markerInitials: {
    color: '#FFF',
    fontSize: s(7),
    fontWeight: FW.bold as any,
  },
  /* Emoji badge sits on the avatar's top-right corner — single
   * visual cue for the activity category, INSIDE the bubble. */
  markerEmojiBadge: {
    position: 'absolute',
    top: -s(3),
    right: -s(3),
    width: s(11),
    height: s(11),
    borderRadius: 9999, // force perfect circle (Android bitmap clamp)
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  markerEmojiText: {
    fontSize: s(7),
  },
  markerName: {
    fontSize: s(5),
    fontWeight: FW.bold as any,
    color: '#1A1A1A',
    marginTop: s(2.5),
    textAlign: 'center',
    maxWidth: s(36),
  },
  markerTimer: {
    fontSize: s(4.5),
    fontWeight: FW.semi as any,
    color: '#FF6B6B',
    marginTop: s(0.5),
  },

  /* Outer ring = the colored border around the avatar (compact: -15%) */
  avatarRing: {
    // borderRadius: 9999 — RN/Android clamps to half-min-dimension
    // natively, guaranteeing a perfect circle on every device.
    //
    // 2026-04-27 evening: removed the shadow (shadowColor / shadowOffset
    // / shadowOpacity / shadowRadius / elevation). Eli kept seeing a
    // half-rendered avatar even after the borderRadius:9999 fix.
    // Samsung One UI uses Skia for compositing in newer versions, and
    // shadows on a custom Marker view extend OUTSIDE the view's
    // measured bounds. The marker bitmap snapshot path on One UI
    // intermittently fails when shadows are present — the snapshot
    // captures only the part of the shape that fits inside the
    // shadow-extended bounds, leaving the visible content cut.
    //
    // Trade-off: marker pins lose their soft drop-shadow on Android.
    // The colored border (borderColor passed inline) still gives them
    // visual weight on the map. iOS keeps shadows fine even with
    // shadowColor removed because of how its compositor handles
    // unbounded shadows; this style runs the same on both.
    width: s(27), height: s(27), borderRadius: 9999,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.card,
  },

  /* Inner avatar circle.
   *
   * 2026-04-28 — sized to s(15) (down from s(22), -30%) and emoji
   * badge sized up correspondingly (+30% to s(22)) per owner directive:
   * "the activity is what matters, the photo is secondary". The outer
   * avatarRing keeps its original s(27) so the bubble's overall
   * footprint on the map stays the same — only the proportions inside
   * the ring change. The avatarRing's c.card background fills the
   * extra whitespace around the smaller avatar, which reads as a
   * clean "halo" around the photo. */
  avatar: {
    // borderRadius: 9999 — same reason as avatarRing above. Hard-clamp
    // to perfect circle regardless of how s() rounds.
    width: s(15), height: s(15), borderRadius: 9999,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  // Initials font shrunk proportionally so they still fit cleanly
  // inside the smaller circle without overflowing or wrapping.
  avatarTxt: { color: c.white, fontSize: s(4.5), fontWeight: FW.bold },
  avatarImg: { width: s(15), height: s(15), borderRadius: 9999 },

  /* Emoji badge — sits on top-right of the ring.
   *
   * Sized to s(22) (up from s(17), +30%) on 2026-04-28 per owner
   * directive: "the activity icon is the most important thing on the
   * bubble, make it bigger". This pairs with the s(22) → s(15)
   * shrink on the inner avatar — net result is the activity emoji
   * is now the eye-catcher, the photo is supporting context. */
  emojiBadge: {
    // top:0, right:0 (no negative offsets) — Android marker bitmap
    // snapshot uses parent's measured bounds. Negative offsets push
    // pixels outside that box → snapshot returns a half-rendered
    // bubble (Eli screenshot 2026-04-27 15:14: red half-circle, dark
    // patch on right, no proper avatar/badge). Was: top:-s(3.5),
    // right:-s(3.5). Now flush with the avatarRing's top-right corner
    // — slight visual shift inward but the bubble actually renders.
    position: 'absolute', top: 0, right: 0,
    width: s(22), height: s(22), borderRadius: 9999,
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.borderSoft,
    // Shadow removed 2026-04-27 evening — same reason as avatarRing
    // (Samsung One UI Skia bitmap snapshot intermittently fails with
    // shadows on Marker views).
  },
  // Emoji glyph scales with the badge: s(9) → s(12) (+30%) so the
  // icon fills the new larger badge instead of looking lonely.
  emojiText: { fontSize: s(12) },

  /* Name label under bubble */
  nameTag: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: s(4), paddingVertical: s(1.5),
    borderRadius: s(4), marginTop: s(2),
    shadowColor: '#000', shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.08, shadowRadius: s(2),
  },
  nameTxt: { fontSize: s(5.5), fontWeight: FW.semi, color: c.dark },

  /* Timer pill — compact, readable, sits under name */
  timerPill: {
    backgroundColor: 'rgba(255,107,107,0.14)', borderRadius: s(5),
    paddingHorizontal: s(4), paddingVertical: s(2),
    marginTop: s(1.5),
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)',
  },
  timerPillSoon: {
    backgroundColor: 'rgba(255,107,107,0.22)',
    borderColor: 'rgba(255,107,107,0.4)',
  },
  timerPillUrgent: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  timerPillText: {
    fontSize: s(5.5), color: c.primary, fontWeight: FW.extra,
    textAlign: 'center',
  },
  timerPillTextUrgent: { color: '#fff' },

  /* Cluster */
  cluster: {
    width: s(24), height: s(24), borderRadius: s(12),
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: s(2), borderColor: 'white',
    shadowColor: c.primary, shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.25, shadowRadius: s(7),
  },
  clusterTxt: { color: c.white, fontSize: s(7), fontWeight: FW.bold },

  /* Group pin */
  groupCirc: {
    width: s(28), height: s(28), borderRadius: s(14),
    backgroundColor: c.white88, borderWidth: s(1.5), borderColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: c.primary, shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.18, shadowRadius: s(7),
  },
  groupBadge: {
    position: 'absolute', top: -s(3), right: -s(3),
    width: s(12), height: s(12), borderRadius: s(6),
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
  },
  groupBadgeTxt: { color: c.white, fontSize: s(6), fontWeight: FW.bold },

  /* Header — floats above map */
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: s(10), paddingBottom: s(1),
  },
  hRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(3) },
  brand: { fontSize: s(9), fontWeight: FW.extra, color: c.dark, letterSpacing: -0.3 },
  /* hRow is now brand-only — Bell moved to fabColumn (April 2026).
     hBtn / hIcons styles removed with the relocation; if a future
     header-right control returns, model it after fabLocationBtn so
     it shares the same visual language as the on-map controls. */

  /* Search */
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
  },
  searchBar: {
    backgroundColor: c.card, borderRadius: 14,
    height: s(18),
    paddingHorizontal: s(5),
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
    flex: 0,
    width: '48%',
  },
  searchBarExpanded: {
    flex: 1,
    width: '100%',
  },
  searchCityLabel: {
    fontSize: s(8.5), fontWeight: FW.extra, color: c.dark,
    flex: 1,
    letterSpacing: -0.3,
  },
  searchInput: {
    flex: 1, fontSize: 15, fontWeight: '500' as const, color: c.dark, padding: 0,
  },
  searchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: s(1.5),
    backgroundColor: 'rgba(0,166,153,0.1)', borderRadius: s(6),
    paddingHorizontal: s(4), paddingVertical: s(2),
  },
  searchBadgeDot: { width: s(3), height: s(3), borderRadius: s(1.5), backgroundColor: c.accent },
  searchBadgeTxt: { fontSize: s(5), fontWeight: FW.bold, color: c.accent },

  /* City search dropdown */
  cityDropdown: {
    backgroundColor: c.card, borderRadius: 14, marginTop: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 5,
    overflow: 'hidden', maxHeight: 280,
  },
  cityDropSection: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
  },
  cityDropSectionText: { fontSize: 12, fontWeight: '600' as const, color: c.textMuted, textTransform: 'uppercase' as const },
  cityDropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  cityDropName: { fontSize: 15, fontWeight: '600' as const, color: c.dark, flex: 1 },
  cityDropCountry: { fontSize: 13, color: c.textMuted },
  cityDropMuted: { fontSize: 14, color: c.textMuted },

  /* Vibe bar — floats above map */
  vibeBar: { position: 'absolute', left: 0, right: 0, height: s(18), zIndex: 9 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(7), paddingVertical: s(3), borderRadius: s(10),
    backgroundColor: c.white88, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.04, shadowRadius: s(1.5),
  },
  chipOn: { backgroundColor: c.dark, borderColor: c.dark },
  chipTxt: { fontSize: s(6), fontWeight: FW.semi, color: c.textSec },
  chipTxtOn: { color: 'white' },

  /* Nomads bubble wrapper — floats above map */
  nomadsBubbleWrap: { position: 'absolute', left: s(10), zIndex: 8 },

  /* Nomads bubble — tappable, impressive */
  nomadsBubble: {
    flexDirection: 'row', alignItems: 'center', gap: s(4),
    backgroundColor: c.card, borderRadius: s(12),
    paddingHorizontal: s(5), paddingVertical: s(4),
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.1, shadowRadius: s(6), elevation: 4,
  },
  nomadsBubbleAvatars: { flexDirection: 'row', alignItems: 'center' },
  nomadsMiniAv: {
    width: s(13), height: s(13), borderRadius: s(6.5),
    backgroundColor: c.accent, borderWidth: 1.5, borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  nomadsMiniAvImg: { width: s(13), height: s(13), borderRadius: s(6.5) },
  nomadsMiniAvTxt: { fontSize: s(5), fontWeight: FW.bold, color: c.white },
  nomadsBubbleTextCol: { flexDirection: 'column' },
  nomadsBubbleCount: { fontSize: s(7.5), fontWeight: FW.extra, color: c.dark, lineHeight: s(9) },
  nomadsBubbleLabel: { fontSize: s(4.5), color: c.textMuted, fontWeight: FW.medium },

  /* FAB column — 3 buttons stacked vertically, close to bottom tab bar */
  fabColumn: {
    position: 'absolute', zIndex: 12,
    bottom: s(25), right: s(5),
    flexDirection: 'column-reverse', alignItems: 'center', gap: s(4),
  },
  fabLocationBtn: {
    width: s(24), height: s(24), borderRadius: s(7),
    backgroundColor: '#F5F3EF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: c.borderSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  /* Unread badge for the notifications bell — sits in the top-right
   * corner of the fabLocationBtn. Brand-coral fill on white border so
   * it reads as a count even at small size. minWidth so single digits
   * stay round, two digits ('9+') auto-stretch. */
  bellBadge: {
    position: 'absolute',
    top: -s(2), right: -s(2),
    minWidth: s(10), height: s(10),
    paddingHorizontal: s(2),
    borderRadius: s(5),
    backgroundColor: c.primary,
    borderWidth: 1.5, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },
  bellBadgeText: {
    color: '#FFF',
    fontSize: s(5),
    fontWeight: FW.bold as any,
    lineHeight: s(6),
  },
  /* fabBubbleGreen / fabBubbleRed retired (April 2026): the
     unified Plus moved to the bottom tab bar (App.tsx CreateFab)
     and the Timer/Status duo had already been merged into one
     creation entry point. Both styles intentionally removed
     rather than left as dead code — Rule Zero / no band-aids. */

  /* Popup — only shown on group pin tap */
  popup: {
    position: 'absolute', left: s(12), right: s(50),
    backgroundColor: 'rgba(255,255,255,0.76)', borderRadius: s(16),
    paddingVertical: s(10), paddingHorizontal: s(11), zIndex: 15,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(6) },
    shadowOpacity: 0.07, shadowRadius: s(24),
  },
  popTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: s(4) },
  popClose: {
    width: s(14), height: s(14), borderRadius: s(7),
    backgroundColor: 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center',
  },
  popCloseX: { fontSize: s(7), color: c.textMuted },
  popTag: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: s(5), paddingVertical: s(2), borderRadius: s(5), marginBottom: s(3),
  },
  popTagTxt: { fontSize: s(6), fontWeight: FW.bold, color: c.work },
  popTitle: { fontSize: s(8), fontWeight: FW.extra, color: c.dark, marginBottom: s(1) },
  popMetaRow: { flexDirection: 'row', alignItems: 'center', gap: s(2), marginBottom: s(6) },
  popMeta: { fontSize: s(6), color: c.textMuted },
  popAvatars: { flexDirection: 'row', alignItems: 'center', marginBottom: s(7) },
  popAv: {
    width: s(14), height: s(14), borderRadius: s(7),
    borderWidth: s(1.5), borderColor: 'white',
    alignItems: 'center', justifyContent: 'center',
  },
  popAvTxt: { color: c.white, fontSize: s(5), fontWeight: FW.bold },
  popMembers: { fontSize: s(6), color: c.textMuted, marginLeft: s(7) },
  popBtn: {
    borderRadius: s(9), paddingVertical: s(5), alignItems: 'center',
    backgroundColor: 'rgba(255,90,95,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,90,95,0.2)',
  },
  popBtnOn: { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: 'rgba(5,150,105,0.2)' },
  popBtnTxt: { fontSize: s(7), fontWeight: FW.bold, color: c.primary },
  popBtnTxtOn: { color: c.primary },

  /* ═══ CANCEL TIMER POPUP ═══ */
  cancelOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cancelSheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12,
  },
  cancelHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.borderSoft, alignSelf: 'center', marginBottom: 16,
  },
  cancelTitle: {
    fontSize: 18, fontWeight: FW.extra, color: c.dark,
    textAlign: 'center', marginBottom: 4,
  },
  cancelSub: {
    fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 20,
  },
  cancelReasonLabel: {
    fontSize: 13, fontWeight: FW.semi, color: c.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  cancelReasonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    height: 52, borderRadius: 14,
    backgroundColor: c.surface, paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1, borderColor: c.borderSoft,
  },
  cancelReasonEmoji: {
    fontSize: 20,
  },
  cancelReasonText: {
    fontSize: 15, fontWeight: FW.medium, color: c.dark,
  },
  cancelEndBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, borderRadius: 14,
    backgroundColor: c.danger || '#E8614D',
    marginBottom: 8,
  },
  cancelEndText: {
    fontSize: 16, fontWeight: FW.bold, color: 'white',
  },
  cancelKeepBtn: {
    height: 52, borderRadius: 14,
    backgroundColor: c.card,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    borderWidth: 1.5, borderColor: c.borderSoft,
  },
  cancelKeepText: {
    fontSize: 15, fontWeight: FW.semi, color: c.textMuted,
  },
});
