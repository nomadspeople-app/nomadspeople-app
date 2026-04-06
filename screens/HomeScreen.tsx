import { useState, useRef, useContext, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
  Modal, Animated, TextInput, Keyboard, FlatList, Dimensions, Easing,
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
import { useActiveCheckins, useNomadsInCity, useFollow, useProfile, createOrJoinStatusChat, type CheckinWithProfile, type NomadInCity } from '../lib/hooks';
import { AuthContext } from '../App';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/tracking';
import ProfileCardSheet from '../components/ProfileCardSheet';
import NotificationsSheet from '../components/NotificationsSheet';
import CityPickerSheet, { CITIES, type City } from '../components/CityPickerSheet';
import QuickStatusSheet, { type QuickActivityData } from '../components/QuickStatusSheet';
import TimerSheet, { type TimerData } from '../components/TimerSheet';
import NomadsListSheet from '../components/NomadsListSheet';
import ActivityDetailSheet from '../components/ActivityDetailSheet';

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
const scatter = (base: number, i: number) => base + (i % 3 - 1) * 0.004 + (i % 2) * 0.002;

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
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&layer=city&layer=state&layer=country`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NomadsPeople/1.0' } });
    const data = await res.json();
    if (!data.features?.length) return [];
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
  } catch { return []; }
}

const RECENT_CITIES_KEY = 'nomadspeople_recent_cities';

async function loadRecentCities(): Promise<CitySearchResult[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_CITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveRecentCity(city: CitySearchResult): Promise<void> {
  try {
    const recents = await loadRecentCities();
    // Remove duplicate if exists, add to front, keep max 5
    const filtered = recents.filter(c => !(c.name === city.name && c.country === city.country));
    const updated = [city, ...filtered].slice(0, 5);
    await AsyncStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(updated));
  } catch {}
}

/* ─── Memoized Markers — prevents re-render when parent state changes ─── */
const NomadMarkers = memo(function NomadMarkers({
  checkins: allCheckins,
  activeVibe,
  cityLat,
  cityLng,
  onPinTap,
}: {
  checkins: CheckinWithProfile[];
  activeVibe: number;
  cityLat: number;
  cityLng: number;
  onPinTap: (c: CheckinWithProfile) => void;
}) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const filtered = useMemo(() => {
    if (activeVibe === 0) return allCheckins;
    const vibeKey = VIBES[activeVibe]?.catKey;
    return vibeKey ? allCheckins.filter(c => c.category === vibeKey) : allCheckins;
  }, [allCheckins, activeVibe]);

  return (
    <>
      {filtered.map((c, i) => {
        const catStyle = getCatStyle(c.category);
        const ini = getInitials(c.profile?.full_name);
        const firstName = c.profile?.full_name?.split(' ')[0] || 'Nomad';
        const pinEmoji = c.status_emoji || catStyle.emoji;
        const avatarUrl = (c.profile as any)?.avatar_url || null;
        const isTimer = (c as any).checkin_type === 'timer';
        const expiresAt = (c as any).expires_at;
        const minsLeft = expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000)) : null;
        const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

        // Border logic: expired → gray, timer → red tones, status → green
        const borderColor = isExpired ? '#9CA3AF' : isTimer ? '#FF6B6B' : '#4ADE80';

        return (
          <Marker
            key={c.id}
            tracksViewChanges={false}
            coordinate={{
              latitude: c.latitude ? c.latitude : scatter(cityLat, i),
              longitude: c.longitude ? c.longitude : scatter(cityLng, i + 3),
            }}
            onPress={() => onPinTap(c)}
          >
            <View style={[st.pinWrap, isExpired && { opacity: 0.5 }]}>
              {/* Avatar with colored border — no halo */}
              <View style={[st.avatarRing, { borderColor }]}>
                <View style={[st.avatar, { backgroundColor: catStyle.color }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={st.avatarImg} />
                  ) : (
                    <Text style={st.avatarTxt}>{ini}</Text>
                  )}
                </View>
                {/* Emoji badge — top right, overlapping ring */}
                <View style={st.emojiBadge}>
                  <Text style={st.emojiText}>{pinEmoji}</Text>
                </View>
              </View>
              {/* Name tag */}
              <View style={st.nameTag}>
                <Text style={st.nameTxt}>{firstName}</Text>
              </View>
              {/* Timer badge — only for timer checkins */}
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
                      {minsLeft < 60 ? `${minsLeft}m` : `${Math.floor(minsLeft / 60)}h${minsLeft % 60 > 0 ? `${minsLeft % 60}m` : ''}`}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </Marker>
        );
      })}
    </>
  );
});

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
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);
  const [activeVibe, setActiveVibe] = useState(0);
  const [joined, setJoined] = useState(false);

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

  /* ── GPS: fetch once on mount, reuse everywhere ── */
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

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
        // 2) Then get fresh GPS — may take 1-3s but userLat is already set
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      } catch (e) {
        console.warn('[HomeScreen] GPS error:', e);
      }
    })();
  }, []);

  /* ── Load recent cities on mount ── */
  useEffect(() => {
    loadRecentCities().then(setRecentCities);
  }, []);

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
    // Save to recents
    await saveRecentCity(result);
    setRecentCities(await loadRecentCities());
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
    // Animate map to new city
    mapRef.current?.animateToRegion({
      latitude: result.lat, longitude: result.lng,
      latitudeDelta: 0.08, longitudeDelta: 0.08,
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
  const { profile: myProfile, refetch: refetchProfile } = useProfile(userId);
  const myName = myProfile?.display_name || myProfile?.full_name || myProfile?.username || 'You';
  const myInitials = myName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const { toggle: toggleFollow, isFollowing } = useFollow(userId);
  /* ── Refetch profile every time screen gains focus (catches Settings changes) ── */
  useFocusEffect(useCallback(() => { refetchProfile(); }, [refetchProfile]));

  const isSnoozed = (myProfile as any)?.snooze_mode === true;

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
      // After animation completes, update DB
      await supabase.from('app_profiles').update({
        snooze_mode: false,
        show_on_map: true,
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

  const handlePinTap = (checkin: CheckinWithProfile) => {
    // Show event popup — user decides to join or not
    trackEvent(userId, 'tap_map_pin', 'checkin', checkin.id);
    setPopupData(checkin);
    setJoined(false);
    setShowPopup(true);
  };

  const handleViewProfile = (userId: string) => {
    nav.navigate('UserProfile', { userId, name: selectedNomad?.name });
  };

  const handleSayHi = (userId: string, name: string) => {
    nav.navigate('Chat', { conversationId: userId, title: name, avatarColor: selectedNomad?.color, avatarText: selectedNomad?.initials });
  };

  /* Join/Chat logic now handled inside ActivityDetailSheet */

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

      // Calculate expires_at based on chosen duration
      const durationMs = (data.durationMinutes || 60) * 60 * 1000;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();

      // Insert new activity checkin — always public (user chose to post)
      const { data: newCheckin, error: insertErr } = await supabase.from('app_checkins').insert({
        user_id: userId,
        city: currentCity.name,
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
          city: currentCity.name,
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
      trackEvent(userId, 'create_status', 'checkin', newCheckin?.id, { city: currentCity.name });
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

      // Always public — user chose to post a timer
      const { data: newCheckin, error: insertErr } = await supabase.from('app_checkins').insert({
        user_id: userId,
        city: currentCity.name,
        checkin_type: 'timer',
        status_text: data.statusText,
        status_emoji: data.emoji,
        category: data.category,
        activity_text: data.statusText,
        location_name: data.locationName || currentCity.name,
        latitude: data.latitude ?? currentCity.lat,
        longitude: data.longitude ?? currentCity.lng,
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
          city: currentCity.name,
          checkin_type: 'timer',
          status_text: data.statusText,
          status_emoji: data.emoji,
          category: data.category,
          activity_text: data.statusText,
          location_name: data.locationName || currentCity.name,
          latitude: data.latitude ?? currentCity.lat,
          longitude: data.longitude ?? currentCity.lng,
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
      trackEvent(userId, 'create_timer', 'checkin', newCheckin?.id, { city: currentCity.name });
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

  /* ── Auto-cleanup: expire stale statuses + delete expired chats every 60s ── */
  useEffect(() => {
    const cleanup = async () => {
      const now = new Date().toISOString();
      // 1. Find expired checkins (before deactivating them)
      const { data: expired } = await supabase
        .from('app_checkins')
        .select('id')
        .eq('is_active', true)
        .lt('expires_at', now)
        .not('expires_at', 'is', null);

      // 2. Deactivate them
      if (expired && expired.length > 0) {
        const expiredIds = expired.map(e => e.id);
        await supabase
          .from('app_checkins')
          .update({ is_active: false })
          .in('id', expiredIds);

        // 3. Delete associated chats (messages → members → conversation)
        const { data: chats } = await supabase
          .from('app_conversations')
          .select('id')
          .in('checkin_id', expiredIds);
        if (chats && chats.length > 0) {
          const chatIds = chats.map(c => c.id);
          await supabase.from('app_messages').delete().in('conversation_id', chatIds);
          await supabase.from('app_conversation_members').delete().in('conversation_id', chatIds);
          await supabase.from('app_conversations').delete().in('id', chatIds);
        }

        // Clear local active timer if it was ours
        if (activeTimerCheckin && expiredIds.includes(activeTimerCheckin)) {
          setActiveTimerCheckin(null);
          setActiveTimerChatId(null);
        }
      }

      refetchCheckins();
    };
    cleanup();
    const interval = setInterval(cleanup, 60_000);
    return () => clearInterval(interval);
  }, [refetchCheckins, activeTimerCheckin]);

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
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        // @ts-ignore — mapLanguage supported in react-native-maps 1.10+
        mapLanguage="en"
        customMapStyle={isDark ? DIM_MAP_STYLE : []}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        mapPadding={{ top: (headerH > 0 ? headerH : insets.top + s(36)) + s(30), left: 0, right: 0, bottom: s(40) }}
      >
        {/* ── NOMAD MARKERS from Supabase (memoized) — hidden when snoozed ── */}
        {!isSnoozed && (
          <NomadMarkers
            checkins={checkins}
            activeVibe={activeVibe}
            cityLat={currentCity.lat}
            cityLng={currentCity.lng}
            onPinTap={handlePinTap}
          />
        )}
      </MapView>

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
            <Text style={st.snoozeCardEmoji}>😴</Text>
            <Text style={st.snoozeCardTitle}>you're snoozed</Text>
            <Text style={st.snoozeCardSub}>
              nomads and activities are hidden{'\n'}while you rest
            </Text>
            <TouchableOpacity style={st.wakeUpBtn} onPress={handleWakeUp} activeOpacity={0.75}>
              <Text style={st.wakeUpBtnText}>wake up</Text>
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
        {/* ── City Search Bar ── */}
        <View style={st.searchBar}>
          <NomadIcon name="search" size={18} color="#aaa" strokeWidth={1.6} />
          <TextInput
            ref={searchInputRef}
            style={st.searchInput}
            placeholder={currentCity.name ? `${currentCity.name} — search any city...` : 'Search any city or country...'}
            placeholderTextColor="#AAA"
            value={cityQuery}
            onChangeText={setCityQuery}
            onFocus={() => setSearchFocused(true)}
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
                  <TouchableOpacity
                    key={`recent-${i}`}
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
        contentContainerStyle={{ paddingHorizontal: s(5), gap: s(3.5), alignItems: 'center' }}
      >
        {VIBES.map((v, i) => (
          <TouchableOpacity
            key={v.label}
            style={[st.chip, activeVibe === i && st.chipOn]}
            onPress={() => setActiveVibe(i)}
            activeOpacity={0.7}
          >
            {v.icon && (
              <View style={{ marginRight: s(1) }}>
                <NomadIcon name={v.icon} size={s(4.5)} strokeWidth={1.6} color={activeVibe === i ? 'white' : (v.color || colors.textSec)} />
              </View>
            )}
            <Text style={[st.chipTxt, activeVibe === i && st.chipTxtOn]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── CITY LABEL + NOMADS BUBBLE — floats above map ── */}
      <View style={[st.cityLabel, { top: cityTop }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
          <Text style={st.cityName}>{currentCity.flag} {currentCity.name}</Text>
          {userLat && userLng && (() => {
            const distKm = haversineKm(userLat, userLng, currentCity.lat, currentCity.lng);
            const unit = (myProfile as any)?.distance_unit === 'mi' ? 'mi' as const : 'km' as const;
            return distKm > 5 ? (
              <View style={st.distBadge}>
                <NomadIcon name="navigation" size={s(4)} color={colors.accent} strokeWidth={1.4} />
                <Text style={st.distBadgeText}>{formatDistance(distKm, unit)}</Text>
              </View>
            ) : null;
          })()}
        </View>
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
                  <Image source={{ uri: n.avatar_url }} style={st.nomadsMiniAvImg} />
                ) : (
                  <Text style={st.nomadsMiniAvTxt}>
                    {(n.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            ))}
          </View>
          <View style={st.nomadsBubbleTextCol}>
            <Text style={st.nomadsBubbleCount}>{nomadsLoading ? '…' : nomadsCount}</Text>
            <Text style={st.nomadsBubbleLabel}>{t('home.nomadsHere')}</Text>
          </View>
          <NomadIcon name="forward" size={s(6)} color="#1A1A1A" strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── Activity Detail Sheet — shown after tapping a pin ── */}
      <ActivityDetailSheet
        visible={showPopup}
        checkin={popupData}
        creatorName={(popupData as any)?.profile?.full_name || 'nomad'}
        creatorAvatarUrl={(popupData as any)?.profile?.avatar_url}
        onClose={() => { setShowPopup(false); setJoined(false); }}
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
                  setShowTimer(true);
                }
              }, () => setShowTimer(true));
          }}
        >
          <NomadIcon name="timer" size={s(13)} color="#FF6B6B" strokeWidth={1.8} />
        </TouchableOpacity>

        {/* Status — green square */}
        <TouchableOpacity
          style={st.fabBubbleGreen}
          activeOpacity={0.85}
          onPress={() => {
            if (!userId) return;
            // Check for active status in background — open sheet immediately if query is slow
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
                  setShowQuickStatus(true);
                }
              }, () => setShowQuickStatus(true));
          }}
        >
          <NomadIcon name="plus" size={s(13)} color="#4ADE80" strokeWidth={2} />
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
              } catch {}
            };
            if (userLat && userLng) {
              goToMyLocation(userLat, userLng);
            } else {
              (async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') return;
                  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                  setUserLat(pos.coords.latitude);
                  setUserLng(pos.coords.longitude);
                  goToMyLocation(pos.coords.latitude, pos.coords.longitude);
                } catch {}
              })();
            }
          }}
        >
          <NomadIcon name="crosshair" size={s(13)} color="#555" strokeWidth={1.8} />
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
        }}
      />
      <NotificationsSheet
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={userId}
      />
      {/* CityPickerSheet removed — replaced by inline search */}

      {/* ── Nomads List Sheet ── */}
      <NomadsListSheet
        visible={showNomadsList}
        onClose={() => setShowNomadsList(false)}
        nomads={nomadsInCity}
        cityName={currentCity.name}
        onViewProfile={(uid, name) => {
          setShowNomadsList(false);
          setTimeout(() => nav.navigate('UserProfile', { userId: uid, name }), 200);
        }}
      />

      {/* ── Quick Status Sheet ── */}
      <QuickStatusSheet
        visible={showQuickStatus}
        onClose={() => setShowQuickStatus(false)}
        onPublish={handleQuickPublish}
        cityName={currentCity.name}
        cityLat={currentCity.lat}
        cityLng={currentCity.lng}
        userLat={userLat}
        userLng={userLng}
        publishing={quickPublishing}
      />

      {/* ── Timer Sheet ── */}
      <TimerSheet
        visible={showTimer}
        onClose={() => setShowTimer(false)}
        onPublish={handleTimerPublish}
        cityName={currentCity.name}
        cityLat={currentCity.lat}
        cityLng={currentCity.lng}
        userLat={userLat}
        userLng={userLng}
        publishing={timerPublishing}
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
                setShowQuickStatus(true);
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

  /* Outer ring = the colored border around the avatar */
  avatarRing: {
    width: s(32), height: s(32), borderRadius: s(16),
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1.5) },
    shadowOpacity: 0.18, shadowRadius: s(4), elevation: 5,
  },

  /* Inner avatar circle */
  avatar: {
    width: s(26), height: s(26), borderRadius: s(13),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  avatarTxt: { color: c.white, fontSize: s(7.5), fontWeight: FW.bold },
  avatarImg: { width: s(26), height: s(26), borderRadius: s(13) },

  /* Emoji badge — sits on top-right of the ring */
  emojiBadge: {
    position: 'absolute', top: -s(3), right: -s(3),
    width: s(14), height: s(14), borderRadius: s(7),
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.borderSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.12, shadowRadius: s(2), elevation: 3,
  },
  emojiText: { fontSize: s(7.5) },

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
  searchBar: {
    backgroundColor: c.card, borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
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

  /* City label + nomads bubble — floats above map */
  cityLabel: { position: 'absolute', left: s(10), zIndex: 8 },
  cityName: { fontSize: s(10), fontWeight: FW.extra, color: c.dark, marginBottom: s(3) },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(1.5),
    backgroundColor: c.accentLight,
    borderRadius: s(5),
    paddingVertical: s(1.5),
    paddingHorizontal: s(4),
  },
  distBadgeText: {
    fontSize: s(4.5),
    fontWeight: FW.medium,
    color: c.accent,
  },

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
    bottom: 56, right: 12,
    flexDirection: 'column-reverse', alignItems: 'center', gap: s(4),
  },
  fabLocationBtn: {
    width: s(28), height: s(28), borderRadius: s(14),
    backgroundColor: c.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: c.borderSoft,
  },
  fabBubbleGreen: {
    width: s(28), height: s(28), borderRadius: s(14),
    backgroundColor: c.card,
    borderWidth: 2.5, borderColor: '#4ADE80',
    alignItems: 'center', justifyContent: 'center',
  },
  fabBubbleRed: {
    width: s(28), height: s(28), borderRadius: s(14),
    backgroundColor: c.card,
    borderWidth: 2.5, borderColor: '#FF6B6B',
    alignItems: 'center', justifyContent: 'center',
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
