/**
 * PeopleScreen — 3 equal horizontal-slider sections:
 *   1. Relevant Activities — active checkins in your current city
 *   2. Incoming Flights — people heading to your city (next_destination)
 *   3. My Match People — DNA-matched nomads (interests, looking_for, job_type)
 *
 *   Each section is a horizontal FlatList of cards.
 *   The 3 sections split the screen equally from top bar to bottom bar.
 */
import { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Dimensions, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NomadIcon from '../components/NomadIcon';
import type { RootStackParamList } from '../lib/types';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { haversineKm, formatDistance } from '../lib/distance';
import { useActiveCheckins, useFlightGroups, calcAge, type FlightGroup } from '../lib/hooks';
import { useViewedCity } from '../lib/ViewedCityContext';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';
import { wakeUpVisibility } from '../lib/visibility';
import { trackEvent } from '../lib/tracking';
import { useI18n } from '../lib/i18n';
import { detectCategories } from '../lib/categoryDetector';
/* Same bubble everywhere — tapping an activity card on this
 * screen opens the identical TimerBubble shell used on the
 * map (HomeScreen). Before April 2026 this screen used its
 * own ActivityDetailSheet, which was the one remaining
 * divergent surface in the product: different shell, different
 * animation, different visual weight than the map bubble.
 * Now they share one component, one anchor style, one
 * language. */
import TimerBubble from '../components/TimerBubble';
import FlightDetailSheet from '../components/FlightDetailSheet';
import type { AppCheckin } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');

/* ─── Category config ─── */
/* Emoji-forward: one neutral accent, emoji carries personality */
const CAT_COLOR = '#6B7280'; // muted gray — calm canvas for emoji
const CAT_META: Record<string, { icon: string; color: string; label: string }> = {
  coffee:        { icon: '☕', color: CAT_COLOR, label: 'coffee' },
  food:          { icon: '🍽️', color: CAT_COLOR, label: 'food & drinks' },
  nightlife:     { icon: '🎉', color: CAT_COLOR, label: 'nightlife' },
  outdoors:      { icon: '🥾', color: CAT_COLOR, label: 'outdoor' },
  sightseeing:   { icon: '🗿', color: CAT_COLOR, label: 'sightseeing' },
  entertainment: { icon: '🎬', color: CAT_COLOR, label: 'entertainment' },
  shopping:      { icon: '🛍️', color: CAT_COLOR, label: 'shopping' },
  wellness:      { icon: '🧘', color: CAT_COLOR, label: 'wellness' },
  rideshare:     { icon: '🚗', color: CAT_COLOR, label: 'rideshare' },
  social:        { icon: '💬', color: CAT_COLOR, label: 'social' },
  other:         { icon: '✨', color: CAT_COLOR, label: 'other' },
  work:          { icon: '💻', color: CAT_COLOR, label: 'work' },
  beach:         { icon: '🏖', color: CAT_COLOR, label: 'beach' },
  sport:         { icon: '🏃', color: CAT_COLOR, label: 'sport' },
  bar:           { icon: '🍺', color: CAT_COLOR, label: 'bar' },
  cafe:          { icon: '☕', color: CAT_COLOR, label: 'cafe' },
  night:         { icon: '🌙', color: CAT_COLOR, label: 'night out' },
  out:           { icon: '☀️', color: CAT_COLOR, label: 'outdoors' },
  meetup:        { icon: '🤝', color: CAT_COLOR, label: 'meetup' },
};

/* ─── Helpers ─── */
function avatarColor(str: string): string {
  const colors = ['#E8614D', '#2A9D8F', '#34A853', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#F97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatActivityDate(item: { scheduled_for: string | null; checked_in_at: string; is_flexible_time: boolean }): string {
  const ref = item.scheduled_for || item.checked_in_at;
  const d = new Date(ref);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  let day = '';
  if (diffDays === 0) day = 'today';
  else if (diffDays === 1) day = 'tomorrow';
  else day = d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();

  return day;
}

function formatCountdown(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m left` : `${hrs}h left`;
}

function countryFlag(country: string): string {
  const FLAGS: Record<string, string> = {
    'Thailand': '🇹🇭', 'Japan': '🇯🇵', 'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳', 'Portugal': '🇵🇹',
    'Spain': '🇪🇸', 'Mexico': '🇲🇽', 'Colombia': '🇨🇴', 'Germany': '🇩🇪', 'France': '🇫🇷',
    'Italy': '🇮🇹', 'Brazil': '🇧🇷', 'UK': '🇬🇧', 'USA': '🇺🇸', 'Canada': '🇨🇦',
    'Australia': '🇦🇺', 'India': '🇮🇳', 'South Korea': '🇰🇷', 'Turkey': '🇹🇷', 'Greece': '🇬🇷',
    'Croatia': '🇭🇷', 'Argentina': '🇦🇷', 'Israel': '🇮🇱', 'Netherlands': '🇳🇱', 'Poland': '🇵🇱',
    'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿', 'Hungary': '🇭🇺', 'Romania': '🇷🇴', 'Malaysia': '🇲🇾',
    'Philippines': '🇵🇭', 'Singapore': '🇸🇬', 'UAE': '🇦🇪', 'Morocco': '🇲🇦', 'South Africa': '🇿🇦',
    'Costa Rica': '🇨🇷', 'Peru': '🇵🇪', 'Chile': '🇨🇱', 'Egypt': '🇪🇬', 'Georgia': '🇬🇪',
  };
  return FLAGS[country] || '✈️';
}

/* ─── Types ─── */

interface MatchPerson {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  job_type: string | null;
  bio: string | null;
  interests: string[];
  looking_for: string[];
  featured_tags: string[];
  matchScore: number;
  matchReasons: string[];
}

/* ═══════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════ */
function SectionTitle({ icon, color, title, count }: {
  icon: string;
  color: string;
  title: string;
  count: number;
}) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={st.secHeader}>
      <View style={[st.secIconWrap, { backgroundColor: color + '15' }]}>
        <NomadIcon name={icon as any} size={s(8)} color={color} strokeWidth={1.8} />
      </View>
      <Text style={st.secTitle}>{title}</Text>
      {count > 0 && (
        <View style={[st.secBadge, { backgroundColor: color }]}>
          <Text style={st.secBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════ */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId } = useContext(AuthContext);
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  /* ── State ── */
  const [myProfile, setMyProfile] = useState<any>(null);
  const [matches, setMatches] = useState<MatchPerson[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  /* ── Activity detail sheet ── */
  const [selectedCheckin, setSelectedCheckin] = useState<AppCheckin | null>(null);
  const [selectedCreatorName, setSelectedCreatorName] = useState('');
  const [selectedCreatorAvatar, setSelectedCreatorAvatar] = useState<string | null>(null);

  /* ── Flight detail sheet ── */
  const [selectedFlight, setSelectedFlight] = useState<FlightGroup | null>(null);

  /* ── City: read from shared ViewedCityContext ─────────────────
   * Owner directive 2026-04-27: People tab follows the SAME city
   * the user is looking at on the map. Pre-fix this screen read
   * from `myProfile?.current_city` directly, which meant:
   *   - It only updated when the profile DB row updated (slow,
   *     fragile, only after GPS sync committed).
   *   - It couldn't follow a manual map pan to another city
   *     because pan didn't write to profile.current_city.
   * The ViewedCityContext exposes the same `viewedCity` HomeScreen
   * uses, so map + People tab are now in lock-step. */
  const { viewedCity } = useViewedCity();
  const currentCity = viewedCity.name;

  /* ── Fetch active checkins for current city ── */
  const { checkins, loading: checkinsLoading } = useActiveCheckins(currentCity, userId);

  /* ── User location for distance calculations ── */
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const distUnit = (myProfile?.distance_unit as 'km' | 'mi') || 'km';

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      } catch (err) {
        // Non-fatal: distance-to-other-people badges simply won't
        // render. Log so we notice if it starts failing in
        // production (e.g., after an expo-location version bump).
        console.warn('[PeopleScreen] GPS fetch failed:', err);
      }
    })();
  }, []);

  /* ── Fetch own profile ── */
  const fetchMyProfile = useCallback(() => {
    if (!userId) return;
    supabase
      .from('app_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setMyProfile(data); });
  }, [userId]);

  useEffect(() => { fetchMyProfile(); }, [fetchMyProfile]);

  /* ── Refetch profile on screen focus (catches Settings snooze changes) ── */
  useFocusEffect(useCallback(() => { fetchMyProfile(); }, [fetchMyProfile]));

  /* ── Snooze state ──
   *
   * Single source of truth per CLAUDE.md: `show_on_map === false`
   * means the user is hidden from the map AND considered "snoozed"
   * from a social standpoint. The legacy `snooze_mode` field is no
   * longer read anywhere in the client. */
  const isSnoozed = myProfile?.show_on_map === false;
  const screenW = Dimensions.get('window').width;
  const cloudLeftX  = useRef(new Animated.Value(0)).current;
  const cloudRightX = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const cardScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSnoozed) {
      cloudLeftX.setValue(0);
      cloudRightX.setValue(0);
      overlayOpacity.setValue(1);
      cardScale.setValue(1);
    }
  }, [isSnoozed]);

  const handleWakeUp = useCallback(async () => {
    if (!userId) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(cardScale, { toValue: 0, duration: 250, easing: Easing.in(Easing.back(1.5)), useNativeDriver: true }),
      Animated.timing(cloudLeftX, { toValue: -screenW, duration: 500, delay: 100, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(cloudRightX, { toValue: screenW, duration: 500, delay: 100, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 600, delay: 150, useNativeDriver: true }),
    ]).start(async () => {
      // Wake up — delegate to the shared lib/visibility helper so
      // HomeScreen's wake-up and this one share one mutation path.
      // See docs/architecture: the two writes (show_on_map=true,
      // checkin.visibility=public) must travel together or the user
      // ends up half-visible.
      await wakeUpVisibility(userId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchMyProfile();
    });
  }, [userId, fetchMyProfile, cloudLeftX, cloudRightX, overlayOpacity, cardScale, screenW]);

  /* ── Fetch flight groups ── */
  const { groups: flightGroups, loading: flightsLoading } = useFlightGroups();

  /* ── Fetch & compute DNA matches ── */
  useEffect(() => {
    if (!userId || !myProfile) return;
    setMatchesLoading(true);

    const myInterests = myProfile.interests || [];
    const myLooking = myProfile.looking_for || [];
    const myJobType = myProfile.job_type || '';

    // Active-presence threshold (24h since last_active_at) — owner
    // directive 2026-04-27. A user who deleted the app or hasn't
    // opened it in 24h must NOT surface in matches. Same logic /
    // same constant as useNomadsInCity. last_active_at is
    // refreshed on every 30s GPS tick by HomeScreen, so any
    // currently-using user is "live".
    const ACTIVE_PRESENCE_HOURS = 24;
    const cutoff = new Date(Date.now() - ACTIVE_PRESENCE_HOURS * 3600 * 1000).toISOString();

    supabase
      .from('app_profiles')
      // birth_date / age_min / age_max needed for the bidirectional age
      // filter below. Owner report 2026-04-27: Eli (52) and Yuval (62)
      // appeared in Barak's matches (filter 18-48) because this query
      // had no age filter at all.
      .select('user_id, full_name, display_name, avatar_url, job_type, bio, interests, looking_for, featured_tags, current_city, birth_date, age_min, age_max')
      .neq('user_id', userId)
      .eq('onboarding_done', true)
      .eq('show_on_map', true)
      // City scope — owner report 2026-04-27 (later same day): "אלי
      // הופיע לי בלשונית People כאשר הייתי על רחובות". Pre-fix this
      // query was global (showed every nomad regardless of city), so
      // a Tel Aviv profile leaked into a Rehovot viewer's matches.
      // The "+25 same city" bonus in scoring below was the only city
      // signal — not strict enough. Now we strictly require the
      // candidate's profile.current_city to match the viewedCity.
      .ilike('current_city', currentCity)
      .gte('last_active_at', cutoff)
      .limit(100)
      .then(({ data }) => {
        if (!data) { setMatchesLoading(false); return; }

        // Bidirectional age filter — same pattern as useActiveCheckins
        // and useNomadsInCity. Both sides must opt-in to each other's
        // age. If a candidate has no birth_date (NULL — legacy users),
        // they're INCLUDED (we err on "show"; user can mute / report).
        const myAge = calcAge(myProfile?.birth_date);
        const myAgeMin = myProfile?.age_min ?? 18;
        const myAgeMax = myProfile?.age_max ?? 100;
        const ageFiltered = myAge != null
          ? data.filter((p: any) => {
              // A. Viewer's age must fit candidate's preferred range.
              const theirMin = p.age_min ?? 18;
              const theirMax = p.age_max ?? 100;
              if (myAge! < theirMin || myAge! > theirMax) return false;
              // B. Candidate's age must fit viewer's preferred range.
              const theirAge = calcAge(p.birth_date);
              if (theirAge != null) {
                if (theirAge < myAgeMin || theirAge > myAgeMax) return false;
              }
              return true;
            })
          : data;

        const scored = ageFiltered.map((p: any) => {
          let score = 0;
          const reasons: string[] = [];
          const theirInterests: string[] = p.interests || [];
          const theirLooking: string[] = p.looking_for || [];

          // Interest overlap
          const interestOverlap = myInterests.filter((i: string) => theirInterests.includes(i));
          if (interestOverlap.length > 0) {
            score += interestOverlap.length * 15;
            reasons.push(interestOverlap.slice(0, 2).join(', '));
          }

          // Looking-for overlap
          const lookingOverlap = myLooking.filter((l: string) => theirLooking.includes(l));
          if (lookingOverlap.length > 0) {
            score += lookingOverlap.length * 20;
            reasons.push(lookingOverlap[0]);
          }

          // Same job type
          if (myJobType && p.job_type === myJobType) {
            score += 10;
            reasons.push(p.job_type);
          }

          // Same city bonus
          if (p.current_city && p.current_city.toLowerCase() === currentCity.toLowerCase()) {
            score += 25;
            reasons.push('Same city');
          }

          return {
            user_id: p.user_id,
            full_name: p.display_name || p.full_name || 'Nomad',
            avatar_url: p.avatar_url,
            job_type: p.job_type,
            bio: p.bio,
            interests: theirInterests,
            looking_for: theirLooking,
            featured_tags: p.featured_tags || [],
            matchScore: score,
            matchReasons: reasons.slice(0, 3),
          } as MatchPerson;
        });

        scored.sort((a, b) => b.matchScore - a.matchScore);
        setMatches(scored.filter(m => m.matchScore > 0).slice(0, 30));
        setMatchesLoading(false);
      });
  }, [userId, myProfile, currentCity]);

  /* ── Available height for 3 sections ── */
  const HEADER_H = s(28);
  const TAB_BAR_H = 80;
  const usableH = SH - insets.top - HEADER_H - TAB_BAR_H - insets.bottom;
  const SECTION_H = Math.floor(usableH / 3);
  const CARD_H = SECTION_H - s(22); // minus section header + padding

  /* ── Navigate to profile ── */
  const goProfile = (uid: string, name?: string) => {
    nav.navigate('UserProfile', { userId: uid, name: name || '' });
  };

  /* ═══ RENDER ═══ */
  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>

      {/* ─── Header ─── */}
      <View style={[st.header, { backgroundColor: colors.bg }]}>
        <Text style={[st.headerTitle, { color: colors.dark }]}>people</Text>
        <Text style={[st.headerCity, { color: colors.textMuted }]}>{countryFlag(myProfile?.home_country || '')} {currentCity}</Text>
      </View>

      {/* ── SNOOZE OVERLAY — blocks entire people list ── */}
      {isSnoozed && (
        <Animated.View style={[st.snoozeOverlay, { opacity: overlayOpacity }]}>
          {/* Dim backdrop */}
          <View style={st.snoozeDim} />

          {/* Left clouds */}
          <Animated.View style={[st.cloudCluster, st.cloudLeft, { transform: [{ translateX: cloudLeftX }] }]}>
            <View style={[st.cloud, { width: s(70), height: s(36), top: '20%', left: -s(8) }]} />
            <View style={[st.cloud, { width: s(55), height: s(30), top: '45%', left: s(5) }]} />
            <View style={[st.cloud, { width: s(60), height: s(34), top: '68%', left: -s(3) }]} />
          </Animated.View>

          {/* Right clouds */}
          <Animated.View style={[st.cloudCluster, st.cloudRight, { transform: [{ translateX: cloudRightX }] }]}>
            <View style={[st.cloud, { width: s(65), height: s(34), top: '15%', right: -s(6) }]} />
            <View style={[st.cloud, { width: s(50), height: s(28), top: '40%', right: s(8) }]} />
            <View style={[st.cloud, { width: s(55), height: s(32), top: '65%', right: -s(2) }]} />
          </Animated.View>

          {/* Center card */}
          <Animated.View style={[st.snoozeCard, { transform: [{ scale: cardScale }] }]}>
            <Text style={st.snoozeCardEmoji}>😴</Text>
            <Text style={st.snoozeCardTitle}>you're snoozed</Text>
            <Text style={st.snoozeCardSub}>people and activities are hidden{'\n'}while you rest</Text>
            <TouchableOpacity style={st.wakeUpBtn} onPress={handleWakeUp} activeOpacity={0.75}>
              <Text style={st.wakeUpBtnText}>wake up</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* ═══ SECTION 1 — RELEVANT ACTIVITIES ═══ */}
      <View style={[st.section, { height: SECTION_H }]}>
        <SectionTitle icon="zap" color="#F97316" title="relevant activities" count={checkins.length} />
        {checkinsLoading ? (
          <View style={st.loadingRow}><ActivityIndicator color="#F97316" /></View>
        ) : checkins.length === 0 ? (
          <View style={st.emptyRow}>
            <NomadIcon name="calendar" size={s(12)} color={colors.textFaint} strokeWidth={1.4} />
            <Text style={st.emptyText}>no activities nearby right now</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={checkins}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.sliderContent}
            renderItem={({ item }) => {
              const cat = CAT_META[item.category || 'other'] || CAT_META.other;
              const profile = item.profile as any;
              // Detect extra categories from free text
              const textToScan = item.status_text || item.activity_text || '';
              const detected = detectCategories(textToScan);
              // Build unique emoji list: primary first, then detected (skip duplicates)
              const primaryEmoji = item.status_emoji || cat.icon;
              const allEmojis = [primaryEmoji];
              for (const d of detected) {
                if (d.key !== item.category && !allEmojis.includes(d.emoji)) {
                  allEmojis.push(d.emoji);
                }
              }
              const isTimer = item.checkin_type === 'timer';
              const countdown = isTimer && item.expires_at ? formatCountdown(item.expires_at) : null;
              return (
                <TouchableOpacity
                  style={[st.activityCard, { height: CARD_H }]}
                  activeOpacity={0.8}
                  onPress={() => { trackEvent(userId, 'view_checkin', 'checkin', item.id); setSelectedCheckin(item); setSelectedCreatorName(profile?.full_name || 'nomad'); setSelectedCreatorAvatar(profile?.avatar_url || null); }}
                >
                  {/* Category icons row */}
                  <View style={st.actCatRow}>
                    {allEmojis.map((emoji, i) => (
                      <View key={i} style={[st.actCatBadge, { backgroundColor: cat.color + '15' }]}>
                        <Text style={st.actCatEmoji}>{emoji}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Timer countdown — prominent */}
                  {isTimer && countdown && (
                    <View style={st.countdownRow}>
                      <NomadIcon name="clock" size={s(6)} color={colors.primary} strokeWidth={1.6} />
                      <Text style={st.countdownText}>{countdown}</Text>
                    </View>
                  )}

                  {/* Status date — small black */}
                  {!isTimer && (
                    <Text style={st.dateSmall}>{formatActivityDate(item)}</Text>
                  )}

                  {/* Activity text */}
                  <Text style={st.actText} numberOfLines={2}>
                    {item.status_text || item.activity_text || cat.label}
                  </Text>

                  {/* Location + distance */}
                  {item.location_name && (
                    <View style={st.actLocRow}>
                      <NomadIcon name="pin" size={s(5)} color={colors.textMuted} strokeWidth={1.4} />
                      <Text style={st.actLoc} numberOfLines={1}>{item.location_name}</Text>
                    </View>
                  )}
                  {userLat && userLng && item.latitude && item.longitude && !profile?.hide_distance && (
                    <Text style={st.actDistance}>
                      {formatDistance(haversineKm(userLat, userLng, item.latitude, item.longitude), distUnit)} away
                    </Text>
                  )}

                  {/* Bottom: name + time (no avatar — card opens event, not profile) */}
                  <View style={st.actBottom}>
                    <Text style={st.actName} numberOfLines={1}>{profile?.full_name || 'Nomad'}</Text>
                    <Text style={st.actTime}>{isTimer && countdown ? countdown : timeAgo(item.checked_in_at)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* ── Divider ── */}
      <View style={st.divider} />

      {/* ═══ SECTION 2 — INCOMING FLIGHTS ═══ */}
      <View style={[st.section, { height: SECTION_H }]}>
        <SectionTitle icon="airplane" color={colors.accent} title="incoming flights" count={flightGroups.length} />
        {flightsLoading ? (
          <View style={st.loadingRow}><ActivityIndicator color={colors.accent} /></View>
        ) : flightGroups.length === 0 ? (
          <View style={st.emptyRow}>
            <NomadIcon name="airplane" size={s(12)} color={colors.textFaint} strokeWidth={1.4} />
            <Text style={st.emptyText}>no flights yet</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={flightGroups}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.sliderContent}
            renderItem={({ item }) => {
              const memberPreviews = (item.members || []).slice(0, 4);
              const dateFrom = item.earliest_arrival
                ? new Date(item.earliest_arrival).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : '';
              const dateTo = item.latest_arrival
                ? new Date(item.latest_arrival).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                : '';
              const dateRange = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : dateFrom || '';

              return (
                <TouchableOpacity
                  style={[st.flightCard, { height: CARD_H }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedFlight(item);
                  }}
                >
                  {/* Flag — top corner */}
                  <Text style={st.flightFlag}>{item.country_flag || '✈️'}</Text>

                  {/* Country name — big */}
                  <Text style={st.flightCountry} numberOfLines={1}>{item.country.toLowerCase()}</Text>

                  {/* Date range */}
                  {dateRange ? <Text style={st.flightDate}>{dateRange}</Text> : null}

                  {/* Bottom: people dots + count */}
                  <View style={st.flightBottom}>
                    <View style={st.flightDots}>
                      {memberPreviews.map((m: any, i: number) => (
                        <View key={m.id} style={[st.flightDot, { marginLeft: i > 0 ? -s(1.5) : 0, backgroundColor: avatarColor(m.user_id) }]}>
                          {m.profile?.avatar_url ? (
                            <Image source={{ uri: m.profile.avatar_url }} style={st.flightDotImg} />
                          ) : null}
                        </View>
                      ))}
                    </View>
                    <Text style={st.flightCount}>{item.member_count} {item.member_count === 1 ? 'nomad' : 'nomads'}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* ── Divider ── */}
      <View style={st.divider} />

      {/* ═══ SECTION 3 — MEETUP PEOPLE ═══
       *
       * Renamed from "My Match People" + percentage badge removed
       * 2026-04-27 per owner directive: the % score was opaque to
       * users (computed client-side from interest/looking_for/
       * job_type overlaps with arbitrary weights). Showing "73%"
       * without explanation invited "where does this come from?"
       * confusion. The internal score still drives the SORT order
       * (best matches first) but is no longer surfaced to the user. */}
      <View style={[st.section, { height: SECTION_H }]}>
        <SectionTitle icon="heart" color="#EC4899" title="meetup people" count={matches.length} />
        {matchesLoading ? (
          <View style={st.loadingRow}><ActivityIndicator color="#EC4899" /></View>
        ) : matches.length === 0 ? (
          <View style={st.emptyRow}>
            <NomadIcon name="heart" size={s(12)} color={colors.textFaint} strokeWidth={1.4} />
            <Text style={st.emptyText}>complete your profile to find matches</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={matches}
            keyExtractor={(item) => item.user_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.sliderContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[st.matchCard, { height: CARD_H }]}
                activeOpacity={0.8}
                onPress={() => goProfile(item.user_id, item.full_name)}
              >
                {/* Match score badge removed 2026-04-27 — the %
                    was a client-side fabrication with arbitrary
                    weights (interest +15, looking_for +20, etc.)
                    that confused users. Score still drives sort
                    order in `scored.sort` above — just hidden. */}

                {/* Avatar */}
                <View style={[st.matchAvatar, { backgroundColor: avatarColor(item.user_id) }]}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={st.matchAvatarImg} />
                  ) : (
                    <Text style={st.matchAvatarText}>
                      {(item.full_name || '?')[0].toUpperCase()}
                    </Text>
                  )}
                </View>

                {/* First name only */}
                <Text style={st.matchName} numberOfLines={1}>{(item.full_name || '').split(' ')[0]}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* ── Unified activity bubble (same shell as the map) ── */}
      <TimerBubble
        visible={!!selectedCheckin}
        checkin={selectedCheckin}
        creatorName={selectedCreatorName}
        creatorAvatarUrl={selectedCreatorAvatar}
        onClose={() => setSelectedCheckin(null)}
      />

      {/* ── Flight Detail Sheet ── */}
      <FlightDetailSheet
        visible={!!selectedFlight}
        flightGroup={selectedFlight}
        onClose={() => setSelectedFlight(null)}
      />

    </View>
  );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const CARD_W = s(72);

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(10),
    height: s(28),
  },
  headerTitle: {
    fontSize: s(12),
    fontWeight: FW.extra,
    color: c.dark,
  },
  headerCity: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
    color: c.textMuted,
  },

  /* ── Section wrapper ── */
  section: {
    flex: 0,
    paddingTop: s(3),
  },
  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    marginBottom: s(4),
    gap: s(4),
  },
  secIconWrap: {
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  secTitle: {
    fontSize: s(7.5),
    fontWeight: FW.bold,
    color: c.dark,
    flex: 1,
  },
  secBadge: {
    paddingHorizontal: s(4),
    paddingVertical: s(1),
    borderRadius: s(8),
    minWidth: s(12),
    alignItems: 'center',
  },
  secBadgeText: {
    fontSize: s(5),
    fontWeight: FW.bold,
    color: c.white,
  },

  /* ── Divider ── */
  divider: {
    height: 1,
    backgroundColor: c.borderSoft,
    marginHorizontal: s(10),
  },

  /* ── Slider ── */
  sliderContent: {
    paddingHorizontal: s(10),
    gap: s(6),
    paddingBottom: s(3),
  },

  /* ── Loading / Empty ── */
  loadingRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyRow: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(3),
  },
  emptyText: {
    fontSize: s(6),
    color: c.textFaint,
    fontWeight: FW.medium,
  },

  /* ═══ Activity Card ═══ */
  activityCard: {
    width: CARD_W,
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(8),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    justifyContent: 'space-between',
  },
  actCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(1.5),
    marginBottom: s(1),
  },
  actCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: s(3),
    paddingVertical: s(1.5),
    borderRadius: s(5),
    gap: s(2),
  },
  actCatEmoji: { fontSize: s(5.5) },
  actCatLabel: { fontSize: s(5), fontWeight: FW.bold },

  /* Timer countdown */
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    marginTop: s(2),
    backgroundColor: c.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: s(4),
    paddingVertical: s(2),
    borderRadius: s(5),
  },
  countdownText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: c.primary,
  },

  /* Status date — small black */
  dateSmall: {
    fontSize: s(5),
    fontWeight: FW.medium,
    color: c.dark,
    marginTop: s(1.5),
  },

  actText: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
    color: c.dark,
    lineHeight: s(9),
    marginTop: s(2),
  },
  actLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    marginTop: s(1),
  },
  actLoc: {
    fontSize: s(5),
    color: c.textMuted,
    flex: 1,
  },
  actDistance: {
    fontSize: s(4.5),
    color: c.accent,
    fontWeight: FW.medium,
    marginTop: s(1),
  },
  actBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(3),
  },
  actAvatar: {
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  actAvatarImg: { width: s(12), height: s(12), borderRadius: s(6) },
  actAvatarText: { fontSize: s(5), fontWeight: FW.bold, color: c.white },
  actName: { fontSize: s(5), fontWeight: FW.semi, color: c.dark, flex: 1 },
  actTime: { fontSize: s(4.5), color: c.textFaint },

  /* ═══ Flight Card ═══ */
  flightCard: {
    width: CARD_W,
    backgroundColor: 'transparent',
    borderRadius: s(12),
    padding: s(8),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    justifyContent: 'space-between',
  },
  flightFlag: {
    fontSize: s(10),
    alignSelf: 'flex-start',
  },
  flightCountry: {
    fontSize: s(8.5),
    fontWeight: FW.extra,
    color: c.dark,
    marginTop: s(2),
  },
  flightDate: {
    fontSize: s(5),
    color: c.textMuted,
    fontWeight: FW.medium,
    marginTop: s(1),
  },
  flightBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(2),
  },
  flightDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flightDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    borderWidth: 1.5,
    borderColor: c.bg,
    overflow: 'hidden' as const,
  },
  flightDotImg: { width: s(8), height: s(8), borderRadius: s(4) },
  flightCount: {
    fontSize: s(5),
    color: c.textMuted,
    fontWeight: FW.medium,
  },

  /* ═══ Match Card ═══ */
  matchCard: {
    width: CARD_W,
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(8),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2),
  },
  matchScoreBadge: {
    backgroundColor: c.surface,
    paddingHorizontal: s(5),
    paddingVertical: s(1.5),
    borderRadius: s(6),
  },
  matchScoreText: {
    fontSize: s(5.5),
    fontWeight: FW.extra,
    color: c.dark,
  },
  matchAvatar: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  matchAvatarImg: { width: s(22), height: s(22), borderRadius: s(11) },
  matchAvatarText: { fontSize: s(9), fontWeight: FW.bold, color: c.white },
  matchName: { fontSize: s(6.5), fontWeight: FW.bold, color: c.dark, textAlign: 'center' },
  matchJob: { fontSize: s(5), color: c.textMuted, textAlign: 'center' },
  matchReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: s(2),
    marginTop: s(1),
  },
  matchReasonPill: {
    backgroundColor: c.primaryLight,
    paddingHorizontal: s(4),
    paddingVertical: s(1),
    borderRadius: s(4),
  },
  matchReasonText: {
    fontSize: s(4.5),
    color: c.primary,
    fontWeight: FW.medium,
  },

  /* ── Snooze cloud overlay ── */
  snoozeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(180, 200, 220, 0.5)',
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
});
