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
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { haversineKm, formatDistance } from '../lib/distance';
import type { RootStackParamList } from '../lib/types';
import { useActiveCheckins, useHotCheckins, useNomadsInCity, useFollow, useProfile, createOrJoinStatusChat, wisdomCheck, trackWisdomSignal, type CheckinWithProfile, type NomadInCity, type WisdomIntent } from '../lib/hooks';
import { AuthContext } from '../App';
import { useAvatar } from '../lib/AvatarContext';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { fetchJsonWithTimeout } from '../lib/fetchWithTimeout';
// The single source of truth for address reverse-geocoding. Used by
// pickMode below to label the pin with the current neighborhood /
// street while the user pans. DO NOT reach into Nominatim directly —
// all callers go through lib/locationServices (CLAUDE.md Rule Zero).
import { reverseGeocode as reverseGeocodeAddress } from '../lib/locationServices';
import { trackEvent } from '../lib/tracking';
import ProfileCardSheet from '../components/ProfileCardSheet';
import NotificationsSheet from '../components/NotificationsSheet';
import CityPickerSheet, { CITIES, type City } from '../components/CityPickerSheet';
import QuickStatusSheet, { type QuickActivityData } from '../components/QuickStatusSheet';
import TimerSheet, { type TimerData } from '../components/TimerSheet';
import NomadsListSheet from '../components/NomadsListSheet';
import ActivityDetailSheet from '../components/ActivityDetailSheet';
import TimerBubble from '../components/TimerBubble';
import WisdomPrompt from '../components/WisdomPrompt';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ─── Tel Aviv center ─── */
const TLV = { latitude: 32.0853, longitude: 34.7818 };
const INITIAL_REGION = {
  ...TLV,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
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
    const key = `${name}-${country}`.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    results.push({
      name,
      country,
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

/* ─── Helper: build a single Marker element for a checkin ─── */
function buildNomadMarker(
  c: CheckinWithProfile,
  i: number,
  cityLat: number,
  cityLng: number,
  onPinTap: (c: CheckinWithProfile) => void,
  avatarUri: (url: string | null | undefined) => string | undefined,
  st: ReturnType<typeof makeStyles>,
  hotMap?: Map<string, number>,
) {
  const catStyle = getCatStyle(c.category);
  // Prefer display_name (the user-controlled "nickname") over full_name —
  // legacy rows sometimes have full_name='Deleted User' or similar stale
  // defaults. display_name is the thing the user actually set in Settings.
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
  const ringSize = s(33); // slightly larger than avatarRing (s(27))

  return (
    <Marker
      key={c.id}
      // Per CLAUDE.md: tracksViewChanges must be FALSE on all markers —
      // the Marker view gets snapshotted once, no per-frame redraws, no
      // flicker. The "hot" visual signal stays in the border color only;
      // we don't animate the Marker itself any more.
      tracksViewChanges={false}
      coordinate={{
        latitude: c.latitude ? c.latitude : scatter(cityLat, hashCode(c.id)),
        longitude: c.longitude ? c.longitude : scatter(cityLng, hashCode(c.id + '_lng')),
      }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={() => onPinTap(c)}
    >
      <View style={[st.pinWrap, isExpired && { opacity: 0.5 }]}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {isHot && <PulseRing heat={heat} size={ringSize} />}
          <View style={[st.avatarRing, { borderColor }]}>
            <View style={[st.avatar, { backgroundColor: catStyle.color }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUri(avatarUrl) }} style={st.avatarImg} />
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
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);
  const [activeVibe, setActiveVibe] = useState(0);
  const [joined, setJoined] = useState(false);
  const [visibleNomadCount, setVisibleNomadCount] = useState<number | null>(null);
  const [visibleNomadIds, setVisibleNomadIds] = useState<Set<string>>(new Set());

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

  // ── Popup state: only shown when a group pin is tapped ──
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState<CheckinWithProfile | null>(null);

  // ── Activity success popup — now handled inside QuickStatusSheet ──

  useEffect(() => {
    if (route.params?.newActivity) {
      // Activity popup now handled inside QuickStatusSheet
      nav.setParams({ newActivity: undefined } as any);
    }
  }, [route.params?.newActivity]);

  const [showProfile, setShowProfile] = useState(false);
  const [selectedNomad, setSelectedNomad] = useState<any>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [currentCity, setCurrentCity] = useState<City>(CITIES[0]);

  /* ── City search state ── */
  const [searchFocused, setSearchFocused] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CitySearchResult[]>([]);
  const [recentCities, setRecentCities] = useState<CitySearchResult[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const citySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [showQuickStatus, setShowQuickStatus] = useState(false);
  const [quickPublishing, setQuickPublishing] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerPublishing, setTimerPublishing] = useState(false);
  const [showNomadsList, setShowNomadsList] = useState(false);
  const [showCancelTimer, setShowCancelTimer] = useState(false);
  const [activeTimerCheckin, setActiveTimerCheckin] = useState<string | null>(null); // checkin id
  const [activeTimerChatId, setActiveTimerChatId] = useState<string | null>(null);
  const [showReplaceStatus, setShowReplaceStatus] = useState(false); // confirm replacing active status
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
   * Before this existed, Status and Timer each rendered their OWN
   * MapView inside their sheet. That's how the codebase ended up
   * with 6 MapView instances — each a different world with its own
   * state, GPS fetcher, and race conditions. The product felt like
   * "why did my pin jump to the sea when I opened Timer".
   *
   * pickMode folds location-picking back onto the ONE MapView —
   * the HomeScreen map the user is already looking at. When the
   * user taps the Status or Timer button:
   *
   *   1. pickMode flips from 'browse' to 'status' | 'timer'
   *   2. A center-pin overlay appears on the main map
   *   3. A bottom panel shows the reverse-geocoded address and
   *      the "Continue" / "Cancel" buttons
   *   4. As the user pans, onRegionChangeComplete updates pickLat
   *      / pickLng and debounces reverseGeocodeAddress so the
   *      address label tracks the pin
   *   5. On Continue — we open QuickStatusSheet / TimerSheet with
   *      the pre-picked coords via `initialPick`, and the sheet
   *      skips its internal map page entirely
   *
   * The sheet's own MapView is reachable only if a sheet opens
   * without `initialPick` (nothing does any more), so in practice
   * it never mounts. Stage 7 of this refactor deletes it outright. */
  type PickMode = 'browse' | 'status' | 'timer';
  const [pickMode, setPickMode] = useState<PickMode>('browse');
  const [pickLat, setPickLat] = useState<number>(0);
  const [pickLng, setPickLng] = useState<number>(0);
  const [pickAddr, setPickAddr] = useState<string>('');
  const [pickResolving, setPickResolving] = useState(false);
  // Captured-at-commit-time payload handed into the sheet as
  // `initialPick`. We freeze it when the user taps Continue so the
  // sheet never sees the pick mutate underneath it.
  const [initialPick, setInitialPick] = useState<
    { latitude: number; longitude: number; address: string } | null
  >(null);
  const pickGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Enter pickMode for either 'status' or 'timer'. Seeds the pin
   *  to the user's last known GPS when available, otherwise to the
   *  current city's center. Animates the map there so the opening
   *  experience always lands somewhere sensible. */
  const enterPickMode = useCallback((kind: 'status' | 'timer') => {
    const seedLat = userLat ?? currentCity.lat;
    const seedLng = userLng ?? currentCity.lng;
    setPickLat(seedLat);
    setPickLng(seedLng);
    setPickAddr('');
    setPickResolving(true);
    setPickMode(kind);
    mapRef.current?.animateToRegion({
      latitude: seedLat, longitude: seedLng,
      latitudeDelta: 0.006, longitudeDelta: 0.006,
    }, 450);
    Haptics.selectionAsync().catch(() => {});
  }, [userLat, userLng, currentCity.lat, currentCity.lng]);

  /** Exit pickMode without committing. Also called on Cancel. */
  const exitPickMode = useCallback(() => {
    if (pickGeocodeTimer.current) {
      clearTimeout(pickGeocodeTimer.current);
      pickGeocodeTimer.current = null;
    }
    setPickMode('browse');
    setPickAddr('');
    setPickResolving(false);
  }, []);

  /** Commit the current pick and hand it to the appropriate sheet.
   *  The sheet receives a frozen snapshot of coords + address so
   *  the pin can't shift under its feet while the user fills in
   *  the form. */
  const commitPick = useCallback(() => {
    const kind = pickMode;
    const snapshot = {
      latitude: pickLat,
      longitude: pickLng,
      address: pickAddr,
    };
    exitPickMode();
    setInitialPick(snapshot);
    if (kind === 'status') setShowQuickStatus(true);
    if (kind === 'timer') setShowTimer(true);
  }, [pickMode, pickLat, pickLng, pickAddr, exitPickMode]);

  const refreshGPS = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLat(pos.coords.latitude);
      setUserLng(pos.coords.longitude);
    } catch (e) {
      console.warn('[HomeScreen] GPS refresh error:', e);
    }
  }, []);

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
        }
        // 2) Then get fresh GPS — may take 1-3s
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        // 3) Zoom map to real location on first GPS fix
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
  }, [refreshGPS]);

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
    // Create a City object for the app
    const city: City = {
      id: `${result.name}-${result.country}`.toLowerCase().replace(/\s/g, '-'),
      name: result.name,
      country: result.country,
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

  // Nomads in city (profiles with current_city) — separate from map pins
  const { nomads: nomadsInCity, count: nomadsCount, loading: nomadsLoading } = useNomadsInCity(currentCity.name);

  // Real data from Supabase
  const { checkins, count: activeCount, loading: checkinsLoading, refetch: refetchCheckins, addOptimistic } = useActiveCheckins(currentCity.name, userId);

  // Hot checkins — for pulse animation on pins with active conversations
  const hotCheckins = useHotCheckins(currentCity.name);

  /* ── Filter checkins by active vibe for clustering ── */
  const filteredCheckins = useMemo(() => {
    if (activeVibe === 0) return checkins;
    const vibeKey = VIBES[activeVibe]?.catKey;
    return vibeKey ? checkins.filter(c => c.category === vibeKey) : checkins;
  }, [checkins, activeVibe]);

  const { profile: myProfile, refetch: refetchProfile } = useProfile(userId);
  const myName = myProfile?.display_name || myProfile?.full_name || myProfile?.username || 'You';
  const myInitials = myName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const { toggle: toggleFollow, isFollowing } = useFollow(userId);
  /* ── Refetch profile every time screen gains focus (catches Settings changes) ── */
  useFocusEffect(useCallback(() => { refetchProfile(); refetchCheckins(); }, [refetchProfile, refetchCheckins]));

  const isSnoozed = myProfile?.show_on_map === false;

  // Sync current city with user's profile city on load
  useEffect(() => {
    if (myProfile?.current_city) {
      const match = CITIES.find(c => c.name.toLowerCase() === myProfile.current_city?.toLowerCase());
      if (match && match.id !== currentCity.id) {
        setCurrentCity(match);
        mapRef.current?.animateToRegion({
          latitude: match.lat, longitude: match.lng,
          latitudeDelta: 0.08, longitudeDelta: 0.08,
        }, 600);
      }
    }
  }, [myProfile?.current_city]);

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
      // Wake up: make visible again
      await supabase.from('app_profiles').update({
        show_on_map: true,
        snooze_mode: false,
      }).eq('user_id', userId);
      await supabase.from('app_checkins').update({ visibility: 'public' })
        .eq('user_id', userId).eq('is_active', true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchProfile();
      refetchCheckins();
    });
  }, [userId, refetchProfile, refetchCheckins, cloudLeftX, cloudRightX, overlayOpacity, cardScale, screenW]);

  /* ── No auto-checkin: users only appear on map via status creation ── */

  const handleCitySelect = (city: City) => {
    trackEvent(userId, 'search_city', 'city', undefined, { city: city.name });
    setCurrentCity(city);
    mapRef.current?.animateToRegion({
      latitude: city.lat,
      longitude: city.lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
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
    const isTimer = (checkin as any).checkin_type === 'timer';
    const isOwn = checkin.user_id === userId;

    // TIMER pins — Waze-style anchored Bubble.
    //
    // Unified flow for BOTH owner and visitor (per ux skill's
    // Bottom-sheet style: tap pin → haptic → bubble slides up from
    // below the bottom tab bar. The map does NOT move — the user
    // said this was too dizzying. Re-tapping the same pin dismisses.
    //
    // No anchor math, no pointForCoordinate, no map pan. The sheet
    // always lands in the same place, which makes the interaction
    // predictable and familiar (same pattern as Apple/Google Maps).
    if (isTimer) {
      if (timerBubbleCheckin?.id === checkin.id) {
        dismissTimerBubble();
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      setTimerBubbleCheckin(checkin);
      return;
    }

    // STATUS / event pins — follow the locked map-pin-tap flow from
    // CLAUDE.md: smooth 400ms zoom into the pin's neighborhood, then
    // 450ms later open the popup. Owner tapping own event → Profile
    // management; visitors → the visitor sheet.
    const lat = checkin.latitude ?? currentCity.lat;
    const lng = checkin.longitude ?? currentCity.lng;
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }, 400);
    setTimeout(() => {
      if (isOwn) {
        nav.navigate('UserProfile' as any, { userId: checkin.user_id, openCheckinId: checkin.id });
        return;
      }
      setTimerBubbleCheckin(null);
      setPopupData(checkin);
      setJoined(false);
      setShowPopup(true);
    }, 450);
  }, [userId, currentCity.lat, currentCity.lng, timerBubbleCheckin?.id, nav]);

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
    return filteredCheckins.map((c, i) =>
      buildNomadMarker(c, i, currentCity.lat, currentCity.lng, handlePinTap, avatarUri, st, hotCheckins),
    );
  }, [isSnoozed, filteredCheckins, currentCity.lat, currentCity.lng, handlePinTap, avatarUri, st, hotCheckins]);

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
   * If the checkin lat/lng is >50km from currentCity, auto-correct to the nearest
   * CITIES entry or fall back to Nominatim reverse geocoding.
   */
  const resolveCheckinCity = async (lat: number | null | undefined, lng: number | null | undefined): Promise<string> => {
    const checkinLat = lat ?? userLat ?? currentCity.lat;
    const checkinLng = lng ?? userLng ?? currentCity.lng;
    const distFromCurrent = haversineKm(checkinLat, checkinLng, currentCity.lat, currentCity.lng);
    // If within 50km of currentCity, it's correct
    if (distFromCurrent < 50) return currentCity.name;
    // Try to find a closer CITIES entry
    const nearest = findNearestCity(checkinLat, checkinLng, 50);
    if (nearest) {
      console.log(`[City Resolve] GPS is ${distFromCurrent.toFixed(0)}km from ${currentCity.name}, auto-corrected to ${nearest.name}`);
      setCurrentCity(nearest);
      return nearest.name;
    }
    // Fall back to Nominatim reverse geocoding. fetchJsonWithTimeout
    // returns null on timeout/network error (no throw), so we just
    // fall through to the currentCity fallback without a stack trace
    // in LogBox.
    const data = await fetchJsonWithTimeout<any>(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${checkinLat}&lon=${checkinLng}&zoom=10&accept-language=en`,
      { tag: 'nominatim.reverse', timeoutMs: 7000 },
    );
    const cityName = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.state || '';
    if (cityName) {
      console.log(`[City Resolve] GPS is ${distFromCurrent.toFixed(0)}km from ${currentCity.name}, Nominatim resolved to ${cityName}`);
      return cityName;
    }
    return currentCity.name;
  };

  /* ── Quick Status publish handler ── */
  const handleQuickPublish = async (data: QuickActivityData) => {
    if (!userId || quickPublishing) return;
    setQuickPublishing(true);
    try {
      // Expire only active STATUS checkins (keep timers alive)
      await supabase
        .from('app_checkins')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('checkin_type', 'status');

      // expires_at policy — three cases (per product spec 2026-04-19):
      //  A) Scheduled with SPECIFIC time → expires AT that time (event's
      //     start = end-of-life on the map). The chat survives because
      //     it's a separate entity, but the pin disappears.
      //  B) Scheduled with FLEXIBLE time → expires at 23:59:59 of the
      //     event's day (the user committed only to "that day", so the
      //     pin is alive throughout the day).
      //  C) Immediate status ("I'm here now") → expires at now + 60 min.
      const scheduledFor = data.scheduledFor ?? null;
      const isFutureScheduled = scheduledFor instanceof Date && scheduledFor.getTime() > Date.now();
      let expiresAt: string;
      if (isFutureScheduled) {
        if (data.isFlexibleTime) {
          // End of the event's day, local time.
          const endOfDay = new Date(scheduledFor!);
          endOfDay.setHours(23, 59, 59, 999);
          expiresAt = endOfDay.toISOString();
        } else {
          // Exactly at scheduled time.
          expiresAt = scheduledFor!.toISOString();
        }
      } else {
        const durationMs = (data.durationMinutes || 60) * 60 * 1000;
        expiresAt = new Date(Date.now() + durationMs).toISOString();
      }

      // Resolve correct city based on actual GPS (prevents wrong-city bug)
      const resolvedCity = await resolveCheckinCity(data.latitude, data.longitude);

      // Insert new activity checkin — always public (user chose to post)
      const { data: newCheckin, error: insertErr } = await supabase.from('app_checkins').insert({
        user_id: userId,
        city: resolvedCity,
        checkin_type: 'status',
        status_text: data.activityText,
        status_emoji: data.emoji,
        category: data.category,
        activity_text: data.activityText,
        location_name: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        scheduled_for: data.scheduledFor?.toISOString() ?? null,
        expires_at: expiresAt,
        is_flexible_time: data.isFlexibleTime ?? false,
        is_open: data.isOpen ?? true,
        visibility: 'public',
        is_active: true,
        member_count: 1,
        age_min: data.ageMin ?? 18,
        age_max: data.ageMax ?? 80,
      }).select('id').single();

      if (insertErr) {
        console.error('Error creating checkin:', insertErr);
        return;
      }

      // Optimistic: show on map INSTANTLY — no waiting for refetch
      if (newCheckin?.id) {
        addOptimistic({
          id: newCheckin.id,
          user_id: userId,
          city: resolvedCity,
          checkin_type: 'status',
          status_text: data.activityText,
          status_emoji: data.emoji,
          category: data.category,
          activity_text: data.activityText,
          location_name: data.locationName,
          latitude: data.latitude,
          longitude: data.longitude,
          expires_at: expiresAt,
          is_active: true,
          visibility: 'public',
          member_count: 1,
          is_open: data.isOpen ?? true,
          age_min: data.ageMin ?? 18,
          age_max: data.ageMax ?? 80,
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

      // Auto-create group chat
      await createOrJoinStatusChat(userId, userId, data.activityText, {
        emoji: data.emoji,
        category: data.category,
        activityText: data.activityText,
        locationName: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        isGeneralArea: data.isGeneralArea ?? false,
        scheduledFor: data.scheduledFor?.toISOString() ?? null,
        isOpen: data.isOpen ?? true,
        checkinId: newCheckin?.id || undefined,
      });

      // Close sheet + refresh (success popup now handled inside QuickStatusSheet)
      trackEvent(userId, 'create_status', 'checkin', newCheckin?.id, { city: resolvedCity });
      refetchCheckins();
    } catch (err) {
      console.error('Quick publish error:', err);
    } finally {
      setQuickPublishing(false);
    }
  };

  /* ── Timer publish handler ── */
  const handleTimerPublish = async (data: TimerData) => {
    if (!userId || timerPublishing) return;
    setTimerPublishing(true);
    try {
      // Expire only active TIMER checkins (keep statuses alive)
      await supabase
        .from('app_checkins')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('checkin_type', 'timer');

      const durationMs = data.durationMinutes * 60 * 1000;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();

      // Resolve correct city based on actual GPS (prevents wrong-city bug)
      const resolvedTimerCity = await resolveCheckinCity(data.latitude, data.longitude);

      // Always public — user chose to post a timer
      const { data: newCheckin, error: insertErr } = await supabase.from('app_checkins').insert({
        user_id: userId,
        city: resolvedTimerCity,
        checkin_type: 'timer',
        status_text: data.statusText,
        status_emoji: data.emoji,
        category: data.category,
        activity_text: data.statusText,
        location_name: data.locationName || currentCity.name,
        latitude: data.latitude ?? userLat ?? currentCity.lat,
        longitude: data.longitude ?? userLng ?? currentCity.lng,
        expires_at: expiresAt,
        is_flexible_time: false,
        is_open: true,
        visibility: 'public',
        is_active: true,
        member_count: 1,
        age_min: data.ageMin ?? 18,
        age_max: data.ageMax ?? 80,
      }).select('id').single();

      if (insertErr) {
        console.error('Error creating timer checkin:', insertErr);
        return;
      }

      // Optimistic: show on map INSTANTLY
      if (newCheckin?.id) {
        addOptimistic({
          id: newCheckin.id,
          user_id: userId,
          city: resolvedTimerCity,
          checkin_type: 'timer',
          status_text: data.statusText,
          status_emoji: data.emoji,
          category: data.category,
          activity_text: data.statusText,
          location_name: data.locationName || currentCity.name,
          latitude: data.latitude ?? userLat ?? currentCity.lat,
          longitude: data.longitude ?? userLng ?? currentCity.lng,
          expires_at: expiresAt,
          is_active: true,
          visibility: 'public',
          member_count: 1,
          is_open: true,
          age_min: data.ageMin ?? 18,
          age_max: data.ageMax ?? 80,
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

      // Auto-create group chat
      await createOrJoinStatusChat(userId, userId, data.statusText, {
        emoji: data.emoji,
        category: data.category,
        activityText: data.statusText,
        locationName: data.locationName || currentCity.name,
        latitude: data.latitude ?? currentCity.lat,
        longitude: data.longitude ?? currentCity.lng,
        isGeneralArea: false,
        scheduledFor: null,
        isOpen: true,
        checkinId: newCheckin?.id || undefined,
      });

      // Track active timer
      if (newCheckin?.id) setActiveTimerCheckin(newCheckin.id);

      // DON'T close the modal — success card stays visible, user dismisses it
      trackEvent(userId, 'create_timer', 'checkin', newCheckin?.id, { city: resolvedTimerCity });
      refetchCheckins();
    } catch (err) {
      console.error('Timer publish error:', err);
    } finally {
      setTimerPublishing(false);
    }
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
        mapPadding={{ top: (headerH > 0 ? headerH : insets.top + s(36)) + s(30), left: 0, right: 0, bottom: s(40) }}
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
                onPress={exitPickMode}
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
                onPress={commitPick}
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

      {/* ── HEADER — floats above map ── */}
      <View style={[st.header, { paddingTop: insets.top }]} onLayout={onHeaderLayout}>
        <View style={st.hRow}>
          <Text style={st.brand}>{t('home.brand')}</Text>
          <TouchableOpacity style={st.hBtn} onPress={() => setShowNotifs(true)}>
            <NomadIcon name="bell" size={s(8)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
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
        {VIBES.map((v, i) => (
          <TouchableOpacity
            key={v.label}
            style={[st.chip, activeVibe === i && st.chipOn]}
            onPress={() => setActiveVibe(i)}
            activeOpacity={0.7}
          >
            {v.icon && (
              <View style={{ marginRight: s(0.5) }}>
                <NomadIcon name={v.icon} size={s(6.5)} strokeWidth={1.8} color={activeVibe === i ? 'white' : (v.color || colors.textSec)} />
              </View>
            )}
            <Text style={[st.chipTxt, activeVibe === i && st.chipTxtOn]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
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

      {/* Timer bubble is now rendered inside the Marker (Waze-style) */}

      {/* ── Activity Detail Sheet — shown after tapping a status pin ── */}
      <ActivityDetailSheet
        visible={showPopup}
        checkin={popupData}
        creatorName={(popupData as any)?.profile?.full_name || 'nomad'}
        creatorAvatarUrl={avatarUri((popupData as any)?.profile?.avatar_url)}
        onClose={() => { setShowPopup(false); }}
        onBeforeJoin={(checkin, doJoin) => {
          // WisdomPrompt uses a native Modal — renders on top without closing the sheet.
          // Keep the popup open so after join it transitions to Chat/Leave buttons.
          wisdomGate(
            checkin.city || currentCity.name,
            checkin.latitude || currentCity.lat,
            checkin.longitude || currentCity.lng,
            currentCity.country,
            doJoin,
          );
        }}
      />

      {/* ── FAB Column — bottom to top: Timer → Status → Location (hidden when snoozed) ── */}
      {!isSnoozed && <View style={st.fabColumn}>
        {/* Timer — red square (closest to bottom bar) */}
        <TouchableOpacity
          style={st.fabBubbleRed}
          activeOpacity={0.85}
          onPress={() => {
            if (!userId) return;
            // Check for active timer in background — open sheet immediately if query is slow
            supabase
              .from('app_checkins')
              .select('id')
              .eq('user_id', userId)
              .eq('is_active', true)
              .eq('checkin_type', 'timer')
              .gt('expires_at', new Date().toISOString())
              .limit(1)
              .maybeSingle()
              .then(({ data: activeTimer }) => {
                if (activeTimer) {
                  setActiveTimerCheckin(activeTimer.id);
                  supabase
                    .from('app_conversations')
                    .select('id')
                    .eq('checkin_id', activeTimer.id)
                    .limit(1)
                    .maybeSingle()
                    .then(({ data: chat }) => {
                      setActiveTimerChatId(chat?.id || null);
                      setShowCancelTimer(true);
                    }, () => setShowCancelTimer(true));
                } else {
                  // No active timer — enter pickMode on the main map
                  // instead of opening a sheet with a second map.
                  enterPickMode('timer');
                }
              }, () => enterPickMode('timer'));
          }}
        >
          <NomadIcon name="timer" size={s(10)} color="#FF6B6B" strokeWidth={1.8} />
        </TouchableOpacity>

        {/* Status — green square */}
        <TouchableOpacity
          style={st.fabBubbleGreen}
          activeOpacity={0.85}
          onPress={() => {
            if (!userId) return;
            // Check for active status in background — if none, jump
            // straight into pickMode on the main map. If there IS
            // an active status, we confirm replace first and then
            // enter pickMode (see the Replace confirm button below).
            supabase
              .from('app_checkins')
              .select('id')
              .eq('user_id', userId)
              .eq('is_active', true)
              .eq('checkin_type', 'status')
              .limit(1)
              .maybeSingle()
              .then(({ data: activeStatus }) => {
                if (activeStatus) {
                  setShowReplaceStatus(true);
                } else {
                  enterPickMode('status');
                }
              }, () => enterPickMode('status'));
          }}
        >
          <NomadIcon name="plus" size={s(10)} color="#4ADE80" strokeWidth={2} />
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
              try {
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`,
                  { headers: { 'User-Agent': 'NomadsPeople/1.0' } },
                );
                const data = await res.json();
                const addr = data.address || {};
                const cityName = addr.city || addr.town || addr.village || addr.state || '';
                const country = addr.country || '';
                if (cityName) {
                  setCurrentCity({
                    id: `${cityName}-${country}`.toLowerCase().replace(/\s/g, '-'),
                    name: cityName, country, flag: '', lat, lng, active: 0,
                  });
                }
              } catch (err) {
                // Non-fatal: the city label simply stays on its
                // previous value. The map still pans to `lat,lng`.
                // (This direct fetch to nominatim predates the
                // lib/locationServices wrapper and should migrate
                // to it — tracked separately.)
                console.warn('[HomeScreen] reverse geocode for "my location" failed:', err);
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
      />
      {/* CityPickerSheet removed — replaced by inline search */}

      {/* ── Nomads List Sheet ── */}
      <NomadsListSheet
        visible={showNomadsList}
        onClose={() => setShowNomadsList(false)}
        nomads={nomadsInCity}
        nearbyIds={visibleNomadIds}
        cityName={currentCity.name}
        bubbleTop={cityTop}
        onViewProfile={(uid, name) => {
          setShowNomadsList(false);
          setTimeout(() => nav.navigate('UserProfile', { userId: uid, name }), 200);
        }}
      />

      {/* ── Quick Status Sheet ──
           Receives `initialPick` from pickMode — when set, the sheet
           skips its own internal map page entirely and the user sees
           only the WHAT / WHEN-WHO pages. The sheet's MapView never
           mounts in this flow, which is the whole point. */}
      <QuickStatusSheet
        visible={showQuickStatus}
        onClose={() => { setShowQuickStatus(false); setInitialPick(null); }}
        onPublish={handleQuickPublish}
        cityName={currentCity.name}
        cityLat={currentCity.lat}
        cityLng={currentCity.lng}
        userLat={userLat}
        userLng={userLng}
        publishing={quickPublishing}
        initialPick={initialPick}
      />

      {/* ── Timer Sheet ── */}
      <TimerSheet
        visible={showTimer}
        onClose={() => { setShowTimer(false); setInitialPick(null); }}
        onPublish={handleTimerPublish}
        cityName={currentCity.name}
        cityLat={currentCity.lat}
        cityLng={currentCity.lng}
        userLat={userLat}
        userLng={userLng}
        publishing={timerPublishing}
        initialPick={initialPick}
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

      {/* ── Replace Active Status Confirmation ── */}
      <Modal visible={showReplaceStatus} transparent animationType="fade" onRequestClose={() => setShowReplaceStatus(false)}>
        <View style={st.cancelOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowReplaceStatus(false)} />
          <View style={[st.cancelSheet, { paddingBottom: insets.bottom + s(6) }]}>
            <View style={st.cancelHandle} />
            <Text style={st.cancelTitle}>You have an active status</Text>
            <Text style={st.cancelSub}>Creating a new one will replace it</Text>

            <TouchableOpacity
              style={[st.cancelReasonBtn, { backgroundColor: colors.primaryLight }]}
              activeOpacity={0.7}
              onPress={() => {
                setShowReplaceStatus(false);
                // Enter pickMode on the main map — the replace itself
                // happens inside handleQuickPublish, which expires the
                // old status before inserting the new one.
                enterPickMode('status');
              }}
            >
              <Text style={st.cancelReasonEmoji}>🔄</Text>
              <Text style={[st.cancelReasonText, { color: colors.primary }]}>Replace with new status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={st.cancelKeepBtn}
              activeOpacity={0.8}
              onPress={() => setShowReplaceStatus(false)}
            >
              <Text style={st.cancelKeepText}>Keep current status</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Activity Success Popup — removed, now handled inside QuickStatusSheet */}

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

  /* ── Map Pins — NomadsPeople bubble design ── */
  pinWrap: { alignItems: 'center' },

  /* Outer ring = the colored border around the avatar (compact: -15%) */
  avatarRing: {
    width: s(27), height: s(27), borderRadius: s(13.5),
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1.5) },
    shadowOpacity: 0.18, shadowRadius: s(4), elevation: 5,
  },

  /* Inner avatar circle (compact: -15%) */
  avatar: {
    width: s(22), height: s(22), borderRadius: s(11),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  avatarTxt: { color: c.white, fontSize: s(6.5), fontWeight: FW.bold },
  avatarImg: { width: s(22), height: s(22), borderRadius: s(11) },

  /* Emoji badge — sits on top-right of the ring (enlarged: +20%) */
  emojiBadge: {
    position: 'absolute', top: -s(3.5), right: -s(3.5),
    width: s(17), height: s(17), borderRadius: s(8.5),
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.borderSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.12, shadowRadius: s(2), elevation: 3,
  },
  emojiText: { fontSize: s(9) },

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
  hIcons: { flexDirection: 'row', gap: s(2.5) },
  hBtn: {
    width: s(22), height: s(22), borderRadius: s(11),
    backgroundColor: c.white82, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.08, shadowRadius: s(2),
  },

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
  fabBubbleGreen: {
    width: s(24), height: s(24), borderRadius: s(7),
    backgroundColor: '#F5F3EF',
    borderWidth: 1.5, borderColor: '#4ADE80',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  fabBubbleRed: {
    width: s(24), height: s(24), borderRadius: s(7),
    backgroundColor: '#F5F3EF',
    borderWidth: 1.5, borderColor: '#FF6B6B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },

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

  /* Activity Success Popup styles removed — now in QuickStatusSheet */

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
