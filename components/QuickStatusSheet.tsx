/**
 * QuickStatusSheet — NomadsPeople activity creation (3-page wizard).
 *
 *   Page 1 — WHAT?   → Free text + 10 categories (2-col grid)
 *   Page 2 — WHEN & WHO → Day + Flexible/Specific time + Age range + Open/Private
 *   Page 3 — WHERE?  → Full-screen map (General area / Specific pin)
 *
 *   Design language matches TimerSheet.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  Dimensions, Platform, ScrollView, FlatList, Keyboard,
  Animated, UIManager, LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import DualThumbSlider from './DualThumbSlider';
import { useI18n } from '../lib/i18n';
import * as Haptics from 'expo-haptics';
import { detectCategories } from '../lib/categoryDetector';
// Location helpers live in ONE module now (CLAUDE.md Rule Zero).
// Status and Timer share the same code path; a fix in one is a fix
// in both, automatically.
import {
  type GeoResult,
  searchAddress,
  reverseGeocode,
  resolveLiveLocation,
} from '../lib/locationServices';

const { width: SW, height: SH } = Dimensions.get('window');
const OFFSCREEN = SH;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ═══ 10 Categories ═══ */
const CATEGORIES = [
  { key: 'food',          emoji: '🍽️', label: 'Food & Drinks' },
  { key: 'nightlife',     emoji: '🎉', label: 'Nightlife' },
  { key: 'outdoors',      emoji: '🥾', label: 'Outdoor' },
  { key: 'sightseeing',   emoji: '🗿', label: 'Sightseeing' },
  { key: 'entertainment', emoji: '🎬', label: 'Entertainment' },
  { key: 'shopping',      emoji: '🛍️', label: 'Shopping' },
  { key: 'wellness',      emoji: '🧘', label: 'Wellness' },
  { key: 'rideshare',     emoji: '🚗', label: 'Rideshare' },
  { key: 'social',        emoji: '💬', label: 'Social' },
  { key: 'other',         emoji: '✨', label: 'Other' },
] as const;
type CategoryKey = typeof CATEGORIES[number]['key'];

/* ═══ Day builder ═══ */
const buildDays = () => {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: { label: string; num: string; date: Date }[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    out.push({ label: i === 0 ? 'Today' : names[d.getDay()], num: `${d.getDate()}`, date: d });
  }
  return out;
};

/* ═══ Geocoding + GPS + IP + spoof detection live in
 *    lib/locationServices.ts. This file only composes them into
 *    the sheet's state machine; it does not reimplement any of it.
 *    ═══════════════════════════════════════════════════════════ */

/* ═══ Exported interface ═══ */
export interface QuickActivityData {
  category: string;
  activityText: string;
  emoji: string;
  locationName: string;
  latitude: number;
  longitude: number;
  isGeneralArea: boolean;
  scheduledFor: Date | null;
  isFlexibleTime: boolean;
  isNow: boolean;
  isOpen: boolean;
  ageMin: number;
  ageMax: number;
  durationMinutes: number;
  /** Set internally after publish */
  conversationId?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPublish: (data: QuickActivityData) => void;
  onChat?: (conversationId: string) => void;
  cityName: string;
  cityLat: number;
  cityLng: number;
  userLat?: number | null;
  userLng?: number | null;
  publishing?: boolean;
  userAvatarUrl?: string | null;
  userName?: string;
  /** When set, the sheet opens with a pre-chosen location from
   *  HomeScreen's pickMode. Page 3 (the internal map) is skipped
   *  entirely — the user only sees the WHAT and WHEN-WHO pages.
   *  Passing null opens the sheet in its legacy full-wizard mode
   *  with the internal map, kept for fallback during rollout. */
  initialPick?: { latitude: number; longitude: number; address: string } | null;
}

/* ═══ MAIN COMPONENT ═══ */
export default function QuickStatusSheet({
  visible, onClose, onPublish, onChat, cityName, cityLat, cityLng, userLat, userLng, publishing, userAvatarUrl, userName, initialPick,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const st = useMemo(() => makeStyles(colors), [colors]);

  type PageNum = 1 | 2 | 3;
  const [page, setPage] = useState<PageNum>(1);
  const [published, setPublished] = useState(false);
  const confettiAnim = useRef(new Animated.Value(0)).current;

  /* ── Confetti particles ── */
  const CONFETTI_COUNT = 24;
  const CONFETTI_COLORS = ['#E8614D', '#FF9A00', '#FFD700', '#34A853', '#2A9D8F', '#A855F7', '#EC4899', '#00D4AA'];
  const CONFETTI_EMOJIS = ['🎉', '✨', '🎊', '⭐', '🥳', '💫', '🎈', '🎵'];
  const confettiParticles = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      anim: new Animated.Value(0),
      angle: Math.random() * Math.PI * 2,
      distance: 80 + Math.random() * 160,
      rotation: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      emoji: Math.random() > 0.5 ? CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)] : null,
      size: 6 + Math.random() * 10,
      delay: Math.random() * 150,
    }))
  ).current;

  /* ── Page 1: What ── */
  const [activityText, setActivityText] = useState('');
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [detectedEmojis, setDetectedEmojis] = useState<string[]>([]);

  /* ── Auto-detect categories from text ── */
  const handleTextChange = useCallback((text: string) => {
    setActivityText(text);
    const detected = detectCategories(text);
    if (detected.length > 0) {
      setCategory(detected[0].key as CategoryKey);
      setDetectedEmojis(detected.map(d => d.emoji));
    } else {
      setCategory(null);
      setDetectedEmojis([]);
    }
  }, []);

  /* ── Page 2: When & Who ── */
  const DAYS = useRef(buildDays()).current;
  const [selectedDay, setSelectedDay] = useState(0);
  const [timeMode, setTimeMode] = useState<'flexible' | 'specific'>('flexible');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(80);
  const [isOpen, setIsOpen] = useState(true);

  /* ── Page 3: Where (map) ── */
  const [pinLat, setPinLat] = useState(cityLat);
  const [pinLng, setPinLng] = useState(cityLng);
  const [locationName, setLocationName] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<MapView>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch real GPS on open ──
   *
   * Thin wrapper around `resolveLiveLocation` in locationServices.
   * Same flow as TimerSheet — GPS + IP in parallel, 5 km drift
   * spoof check, graceful fallback to the city center. The shared
   * resolver also covers the "both providers failed" branch that
   * the old simpler fetch silently returned from. */
  const fetchGPS = useCallback(async () => {
    try {
      const res = await resolveLiveLocation(cityLat, cityLng);
      // If we actually got a live signal, move the pin and the
      // map to match. If we had to fall back (permission denied
      // AND both providers failed) we leave the map where it was
      // — staying on the city center is a better landing than
      // jerking the camera.
      if (res.usedFallback) return;
      setPinLat(res.latitude);
      setPinLng(res.longitude);
      mapRef.current?.animateToRegion({
        latitude: res.latitude,
        longitude: res.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } catch (e) {
      console.warn('[StatusSheet] GPS error:', e);
    }
  }, [cityLat, cityLng]);

  /* ── Reset on open ── */
  useEffect(() => {
    if (visible) {
      setPage(1);
      setActivityText('');
      setCategory(null);
      setDetectedEmojis([]);
      setSelectedDay(0);
      setTimeMode('flexible');
      setSelectedHour(12);
      setSelectedMinute(0);
      setShowTimePicker(false);
      setAgeMin(18);
      setAgeMax(80);
      setIsOpen(true);
      setPublished(false);
      // If HomeScreen pickMode already resolved a location, use it
      // and DO NOT hit GPS again — the pin is frozen at what the
      // user confirmed on the main map. Otherwise fall back to the
      // old "seed with cached coords then refresh with GPS" path,
      // kept for safety in case the sheet is ever opened without
      // initialPick (e.g. an old flow or a deep link).
      if (initialPick) {
        setPinLat(initialPick.latitude);
        setPinLng(initialPick.longitude);
        setLocationName(initialPick.address || '');
      } else {
        setPinLat(userLat ?? cityLat);
        setPinLng(userLng ?? cityLng);
        setLocationName('');
      }
      setAddressQuery('');
      setAddressResults([]);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
      // Background GPS refresh only when we DON'T have a pre-picked
      // location. With initialPick, hitting GPS would defeat the
      // whole point of the unified-map flow (the user already chose).
      if (!initialPick) fetchGPS();
    } else {
      Animated.timing(translateY, {
        toValue: OFFSCREEN, duration: 250, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  /* ── Address search — fast debounce with Photon autocomplete ── */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (addressQuery.trim().length < 2) { setAddressResults([]); setSearching(false); return; }
    setSearching(true);
    // 300ms debounce — Photon handles partial queries natively
    searchTimer.current = setTimeout(async () => {
      const results = await searchAddress(addressQuery.trim(), pinLat, pinLng, cityName);
      setAddressResults(results);
      setSearching(false);
    }, 300);
  }, [addressQuery, pinLat, pinLng, cityName]);

  /* ── Select address result ── */
  const selectAddress = useCallback((result: GeoResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setPinLat(lat); setPinLng(lng);
    setLocationName(result.subLine ? `${result.mainLine}, ${result.subLine}` : result.mainLine);
    setAddressQuery(''); setAddressResults([]);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 600);
  }, []);

  /* ── Time display ── */
  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
  };
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = [0, 15, 30, 45];

  /* ── Navigation ──
   *
   * Normally the wizard is 3 pages: WHAT → WHEN/WHO → WHERE (map).
   * With `initialPick` the location is already chosen, so the map
   * page is skipped entirely: on page 2, "Next" becomes "Publish"
   * and fires handlePublish directly. `skipMapPage` is the flag
   * the rest of the component checks. */
  const canGoPage2 = activityText.trim().length > 0;
  const skipMapPage = !!initialPick;

  const goNext = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (skipMapPage && page === 2) {
      // With a pre-chosen location we publish straight from page 2.
      handlePublish();
      return;
    }
    setPage(Math.min(page + 1, 3) as PageNum);
  };
  const goBack = () => {
    Keyboard.dismiss();
    if (page === 1) { onClose(); return; }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPage((page - 1) as PageNum);
  };

  /* ── Publish ── */
  const handlePublish = () => {
    if (publishing || !activityText.trim()) return;
    const cat = category ? CATEGORIES.find(c => c.key === category) : null;
    const dayDate = DAYS[selectedDay].date;

    let scheduledFor: Date | null = null;
    if (timeMode === 'specific') {
      scheduledFor = new Date(dayDate);
      scheduledFor.setHours(selectedHour, selectedMinute, 0, 0);
    }

    const locName = locationName || cityName;

    onPublish({
      category: category || 'other',
      activityText: activityText.trim() || (cat?.label ?? 'activity'),
      emoji: detectedEmojis[0] || cat?.emoji || '✨',
      locationName: locName,
      latitude: pinLat,
      longitude: pinLng,
      isGeneralArea: false,
      scheduledFor,
      isFlexibleTime: timeMode === 'flexible',
      isNow: selectedDay === 0 && timeMode === 'flexible',
      isOpen,
      ageMin,
      ageMax,
      durationMinutes: 60,
    });

    // Show success card + slide sheet down
    setPublished(true);

    // Haptic burst — short vibration
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 400);

    // Slide the sheet DOWN behind the success card
    Animated.timing(translateY, { toValue: SH, duration: 400, useNativeDriver: true }).start();

    // Success card entrance
    confettiAnim.setValue(0);
    Animated.spring(confettiAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();

    // Confetti particles explode outward
    confettiParticles.forEach((p) => {
      p.anim.setValue(0);
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]).start();
    });
  };

  /* ── Page titles ── */
  const titles: Record<number, string> = { 1: 'Create Activity', 2: 'When & Who', 3: 'Where?' };
  const sheetH = page === 3 ? SH * 0.92 : SH * 0.82;

  /* ═══ RENDER ═══ */
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        {page !== 3 && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />}

        <Animated.View style={[
          st.sheet,
          page === 3 ? { flex: 1 } : { height: sheetH },
          { transform: [{ translateY }] },
        ]}>
          {/* ── Header (pages 1 & 2) ── */}
          {page !== 3 && (
            <>
              <View style={st.handle} />
              <View style={st.headerRow}>
                <TouchableOpacity onPress={goBack} style={st.hdrBtn}>
                  <NomadIcon name={page === 1 ? 'close' : 'back'} size={18} strokeWidth={1.6} color="#1A1A1A"  />
                </TouchableOpacity>
                <Text style={st.title}>{titles[page]}</Text>
                <View style={st.stepBadge}>
                  <Text style={st.stepText}>{page}/3</Text>
                </View>
              </View>
            </>
          )}

          {/* ═══ PAGE 1 — WHAT ═══ */}
          {page === 1 && (
            <ScrollView style={st.pageScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Free text + auto-detect */}
              <Text style={st.label}>I want to...</Text>

              {/* Live detected emoji badges */}
              {detectedEmojis.length > 0 && (
                <View style={st.detectedRow}>
                  {detectedEmojis.map((em, i) => (
                    <View key={i} style={st.detectedBadge}>
                      <Text style={st.detectedEmoji}>{em}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TextInput
                style={st.textInput}
                placeholder="grab coffee, hang out at the park, etc."
                placeholderTextColor="#BBB"
                value={activityText}
                onChangeText={handleTextChange}
                maxLength={120}
                returnKeyType="done"
                blurOnSubmit
              />
              <Text style={st.charCount}>{activityText.length}/120</Text>

              {/* Next */}
              <TouchableOpacity
                style={[st.primaryBtn, !canGoPage2 && st.btnDisabled]}
                onPress={goNext}
                disabled={!canGoPage2}
                activeOpacity={0.8}
              >
                <Text style={st.primaryBtnText}>Next</Text>
                <NomadIcon name="forward" size={18} strokeWidth={1.8} color="white"  />
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          {/* ═══ PAGE 2 — WHEN & WHO ═══ */}
          {page === 2 && (
            <ScrollView style={st.pageScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* ── When ── */}
              <Text style={st.label}>When?</Text>

              {/* Day pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={st.dayRow}>
                  {DAYS.map((day, i) => {
                    const active = selectedDay === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[st.dayChip, active && st.dayChipActive]}
                        onPress={() => setSelectedDay(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={[st.dayLabel, active && st.dayLabelActive]}>{day.label}</Text>
                        <Text style={[st.dayNum, active && st.dayNumActive]}>{day.num}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Flexible / Specific */}
              <View style={st.timeRow}>
                <TouchableOpacity
                  style={[st.timeCard, timeMode === 'flexible' && st.timeCardActive]}
                  onPress={() => { setTimeMode('flexible'); setShowTimePicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={st.timeIcon}>📅</Text>
                  <Text style={[st.timeLabel, timeMode === 'flexible' && st.timeLabelActive]}>Flexible</Text>
                  <Text style={st.timeSub}>Anytime</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[st.timeCard, timeMode === 'specific' && st.timeCardActive]}
                  onPress={() => { setTimeMode('specific'); setShowTimePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={st.timeIcon}>🕐</Text>
                  {timeMode === 'specific' ? (
                    <>
                      <Text style={[st.timeLabel, st.timeLabelActive]}>{formatTime(selectedHour, selectedMinute)}</Text>
                      <Text style={st.timeSub}>Tap to change</Text>
                    </>
                  ) : (
                    <>
                      <Text style={st.timeLabel}>Set time</Text>
                      <Text style={st.timeSub}>Choose hour</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Time picker */}
              {showTimePicker && (
                <View style={st.pickerWrap}>
                  <View style={st.pickerBody}>
                    <ScrollView style={st.pickerCol} showsVerticalScrollIndicator={false}>
                      {HOURS.map((h) => (
                        <TouchableOpacity
                          key={h}
                          style={[st.pickerItem, selectedHour === h && st.pickerItemActive]}
                          onPress={() => setSelectedHour(h)}
                        >
                          <Text style={[st.pickerItemText, selectedHour === h && st.pickerItemTextActive]}>
                            {h.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <ScrollView style={st.pickerCol} showsVerticalScrollIndicator={false}>
                      {MINUTES.map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[st.pickerItem, selectedMinute === m && st.pickerItemActive]}
                          onPress={() => setSelectedMinute(m)}
                        >
                          <Text style={[st.pickerItemText, selectedMinute === m && st.pickerItemTextActive]}>
                            {m.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)} style={st.pickerDoneBtn}>
                    <Text style={st.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Who ── */}
              <Text style={[st.label, { marginTop: 20 }]}>Who can see?</Text>

              {/* Age range — single dual-thumb slider */}
              <DualThumbSlider
                min={18} max={80}
                valueMin={ageMin} valueMax={ageMax}
                onChangeMin={setAgeMin} onChangeMax={setAgeMax}
              />

              {/* Open / Private */}
              <View style={st.privacyRow}>
                <TouchableOpacity
                  style={[st.privacyCard, isOpen && st.privacyCardActive]}
                  onPress={() => setIsOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={st.privacyIcon}>👥</Text>
                  <Text style={[st.privacyLabel, isOpen && st.privacyLabelActive]}>Open</Text>
                  <Text style={st.privacySub}>Anyone can join</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.privacyCard, !isOpen && st.privacyCardActive]}
                  onPress={() => setIsOpen(false)}
                  activeOpacity={0.7}
                >
                  <Text style={st.privacyIcon}>🔒</Text>
                  <Text style={[st.privacyLabel, !isOpen && st.privacyLabelActive]}>Private</Text>
                  <Text style={st.privacySub}>Approval required</Text>
                </TouchableOpacity>
              </View>

              {/* Next — when initialPick is set, this acts as
                   Publish (the location is already chosen on the
                   main map). Without initialPick we still let the
                   user pick on page 3's internal map (legacy path,
                   kept for safety until the next stage of the
                   refactor deletes it). */}
              <TouchableOpacity
                style={st.primaryBtn}
                onPress={goNext}
                activeOpacity={0.8}
                disabled={publishing}
              >
                <Text style={st.primaryBtnText}>
                  {skipMapPage ? (publishing ? 'Publishing…' : 'Publish') : 'Choose Location'}
                </Text>
                {!skipMapPage && (
                  <NomadIcon name="forward" size={18} strokeWidth={1.8} color="white"  />
                )}
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          )}

          {/* ═══ PAGE 3 — WHERE (full-screen map) ═══ */}
          {page === 3 && (
            <View style={st.mapFull}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude: pinLat, longitude: pinLng,
                  latitudeDelta: 0.012, longitudeDelta: 0.012,
                }}
                showsUserLocation
                showsCompass={false}
                showsMyLocationButton={false}
                onRegionChangeComplete={(region) => {
                  setPinLat(region.latitude);
                  setPinLng(region.longitude);
                  // Reverse geocode after map stops moving
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  searchTimer.current = setTimeout(async () => {
                    const addr = await reverseGeocode(region.latitude, region.longitude);
                    if (addr) setLocationName(addr);
                  }, 600);
                }}
                // @ts-ignore
                mapLanguage="en"
              />

              {/* Center pin overlay (moves with map) */}
              <View style={st.pinOverlay} pointerEvents="none">
                <NomadIcon name="pin" size={36} strokeWidth={1.8} color={colors.primary}  />
                <View style={st.pinDot} />
              </View>

              {/* Top bar: back + step */}
              <View style={[st.mapTopBar, { top: insets.top + 8 }]}>
                <TouchableOpacity onPress={goBack} style={st.mapBackBtn}>
                  <NomadIcon name="back" size={18} strokeWidth={1.8} color="#1A1A1A"  />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <View style={st.stepBadgeMap}>
                  <Text style={st.stepText}>3/3</Text>
                </View>
              </View>

              {/* Search bar — always visible */}
              <View style={[st.searchWrap, { top: insets.top + 56 }]}>
                <View style={st.searchBar}>
                  <NomadIcon name="search" size={18} strokeWidth={1.8} color="#aaa"  />
                  <TextInput
                    style={st.searchInput}
                    placeholder="Search address or place..."
                    placeholderTextColor="#AAA"
                    value={addressQuery}
                    onChangeText={setAddressQuery}
                    returnKeyType="search"
                  />
                  {addressQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setAddressQuery(''); setAddressResults([]); }}>
                      <NomadIcon name="close" size={18} strokeWidth={1.8} color="#aaa"  />
                    </TouchableOpacity>
                  )}
                </View>
                {(searching || addressResults.length > 0) && (
                  <View style={st.dropdown}>
                    {searching ? (
                      <View style={st.dropItem}><Text style={st.dropTextMuted}>Searching...</Text></View>
                    ) : (
                      <FlatList
                        data={addressResults}
                        keyExtractor={(_, i) => `r${i}`}
                        keyboardShouldPersistTaps="handled"
                        style={{ maxHeight: 200 }}
                        renderItem={({ item }) => (
                          <TouchableOpacity style={st.dropItem} onPress={() => selectAddress(item)} activeOpacity={0.7}>
                            <View style={{ marginTop: 2 }}><NomadIcon name="pin" size={14} strokeWidth={1.8} color={colors.primary} /></View>
                            <View style={{ flex: 1 }}>
                              <Text style={st.dropText} numberOfLines={1}>{item.mainLine}</Text>
                              {item.subLine ? <Text style={st.dropSub} numberOfLines={1}>{item.subLine}</Text> : null}
                            </View>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Hint — below search when no results showing */}
              {!(searching || addressResults.length > 0) && (
                <View style={[st.hintCard, { top: insets.top + 116 }]}>
                  <NomadIcon name="info" size={14} strokeWidth={1.8} color="#888"  />
                  <Text style={st.hintText}>Drag the map to move pin, or search above</Text>
                </View>
              )}

              {/* Bottom: address pill + buttons (hidden when published) */}
              {!published && (
              <View style={[st.mapBottom, { paddingBottom: insets.bottom + 12 }]}>
                <View style={st.addrPill}>
                  <NomadIcon name="pin" size={14} strokeWidth={1.8} color="#00A699"  />
                  <Text style={st.addrText} numberOfLines={1}>
                    {locationName || cityName || 'Move map to set location'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[st.primaryBtn, { marginTop: 10 }, publishing && st.btnDisabled]}
                  onPress={() => {
                    if (!locationName) {
                      reverseGeocode(pinLat, pinLng).then(addr => {
                        if (addr) setLocationName(addr);
                        handlePublish();
                      });
                    } else {
                      handlePublish();
                    }
                  }}
                  disabled={publishing}
                  activeOpacity={0.8}
                >
                  <NomadIcon name="zap" size={18} strokeWidth={1.8} color="white"  />
                  <Text style={st.primaryBtnText}>
                    {publishing ? '...' : 'Add to Map!'}
                  </Text>
                </TouchableOpacity>
              </View>
              )}
            </View>
          )}

        </Animated.View>

        {/* ═══ Success overlay — floats ABOVE the sheet ═══ */}
        {published && (
          <View style={st.successOverlay}>
            {/* Confetti particles */}
            <View style={st.confettiContainer} pointerEvents="none">
              {confettiParticles.map((p, i) => {
                const tX = p.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, Math.cos(p.angle) * p.distance * 0.7, Math.cos(p.angle) * p.distance],
                });
                const tY = p.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, Math.sin(p.angle) * p.distance * 0.7 - 40, Math.sin(p.angle) * p.distance + 20],
                });
                const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotation}deg`] });
                const scale = p.anim.interpolate({ inputRange: [0, 0.15, 0.5, 0.85, 1], outputRange: [0, 1.4, 1.1, 0.6, 0] });
                const opacity = p.anim.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 1, 0.8, 0] });
                if (p.emoji) {
                  return <Animated.Text key={i} style={[st.confettiPiece, { fontSize: p.size + 10, opacity, transform: [{ translateX: tX }, { translateY: tY }, { scale }, { rotate }] }]}>{p.emoji}</Animated.Text>;
                }
                return <Animated.View key={i} style={[st.confettiPiece, { width: p.size, height: p.size * 0.6, borderRadius: p.size * 0.15, backgroundColor: p.color, opacity, transform: [{ translateX: tX }, { translateY: tY }, { scale }, { rotate }] }]} />;
              })}
            </View>

            {/* Success card */}
            <Animated.View style={[st.successCard, { opacity: confettiAnim, transform: [{ scale: confettiAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              {/* X close button */}
              <TouchableOpacity style={st.successCloseBtn} onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <NomadIcon name="close" size={20} strokeWidth={1.8} color="#999"  />
              </TouchableOpacity>

              {/* Emoji */}
              <View style={st.successEmojiBadge}>
                <Text style={{ fontSize: 44 }}>{detectedEmojis[0] || (category ? CATEGORIES.find(c => c.key === category)?.emoji : null) || '📍'}</Text>
              </View>

              {/* Title */}
              <Text style={st.successTitle}>You're on the map!</Text>
              <Text style={st.successSubtitle}>{activityText || 'Your activity is live'}</Text>

              {/* Location pill */}
              <View style={st.successLocPill}>
                <NomadIcon name="pin" size={14} strokeWidth={1.8} color="#00A699"  />
                <Text style={st.successLocText} numberOfLines={1}>{locationName || cityName}</Text>
              </View>

              {/* Buttons */}
              <View style={st.successBtnsRow}>
                <TouchableOpacity style={st.successChatBtn} onPress={() => { if (onChat) onChat(''); onClose(); }} activeOpacity={0.8}>
                  <NomadIcon name="chat" size={20} strokeWidth={1.8} color="white"  />
                  <Text style={st.successChatText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.successDeleteBtn} onPress={onClose} activeOpacity={0.8}>
                  <NomadIcon name="trash" size={20} strokeWidth={1.8} color={colors.primary}  />
                  <Text style={st.successDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
}

/* ═══ Styles — TimerSheet design language ═══ */
const GAP = 10;
const CAT_CELL_W = (SW - 32 - GAP) / 2;

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, overflow: 'hidden',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.borderSoft, alignSelf: 'center', marginBottom: 10 },

  /* Header */
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 6,
  },
  hdrBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800' as const, color: c.dark },
  stepBadge: { backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  stepText: { fontSize: 12, fontWeight: '700' as const, color: c.textMuted },

  /* Shared */
  pageScroll: { flex: 1, paddingHorizontal: 16 },
  label: { fontSize: 15, fontWeight: '700' as const, color: c.dark, marginBottom: 10, marginTop: 16 },

  /* Page 1 — text input */
  textInput: {
    height: 58, borderRadius: 16, borderWidth: 1.5, borderColor: c.borderSoft,
    backgroundColor: c.card, paddingHorizontal: 16, fontSize: 17, color: c.dark,
  },
  charCount: { fontSize: 11, color: c.textFaint, textAlign: 'right', marginTop: 4, marginBottom: 4 },

  /* Page 1 — category grid (2 per row, 5 rows) */
  /* Auto-detected emoji badges */
  detectedRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  detectedBadge: {
    backgroundColor: c.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1.5, borderColor: c.primary,
  },
  detectedEmoji: { fontSize: 22 },

  /* Legacy — kept for reference */
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  catCell: {
    width: CAT_CELL_W, height: 56, borderRadius: 14,
    backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  catCellActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  catEmoji: { fontSize: 24 },
  catLabel: { fontSize: 14, color: c.textSec, fontWeight: '500' as const },
  catLabelActive: { color: c.primary, fontWeight: '700' as const },

  /* Page 2 — day pills */
  dayRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  dayChip: {
    width: 56, height: 64, borderRadius: 14,
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dayChipActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  dayLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600' as const },
  dayLabelActive: { color: c.primary },
  dayNum: { fontSize: 18, fontWeight: '800' as const, color: c.dark, marginTop: 2 },
  dayNumActive: { color: c.primary },

  /* Page 2 — time cards */
  timeRow: { flexDirection: 'row', gap: 10 },
  timeCard: {
    flex: 1, borderRadius: 14, backgroundColor: c.surface,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  timeCardActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  timeIcon: { fontSize: 20, marginBottom: 4 },
  timeLabel: { fontSize: 14, fontWeight: '600' as const, color: c.textSec },
  timeLabelActive: { color: c.primary },
  timeSub: { fontSize: 11, color: c.textMuted, marginTop: 2 },

  /* Time picker */
  pickerWrap: {
    backgroundColor: c.surface, borderRadius: 14, marginTop: 10,
    overflow: 'hidden',
  },
  pickerBody: { flexDirection: 'row', height: 140 },
  pickerCol: { flex: 1 },
  pickerItem: {
    paddingVertical: 8, alignItems: 'center',
  },
  pickerItemActive: { backgroundColor: 'rgba(255,90,95,0.1)' },
  pickerItemText: { fontSize: 16, color: c.textSec, fontWeight: '500' as const },
  pickerItemTextActive: { color: c.primary, fontWeight: '700' as const },
  pickerDoneBtn: {
    alignItems: 'center', paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: c.borderSoft,
  },
  pickerDoneText: { fontSize: 14, fontWeight: '700' as const, color: c.primary },

  /* Page 2 — age presets */
  agePresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, justifyContent: 'center' },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSoft,
  },
  presetChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  presetText: { fontSize: 13, fontWeight: '600' as const, color: c.textSec },
  presetTextActive: { color: c.white },

  /* Page 2 — Open / Private */
  privacyRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  privacyCard: {
    flex: 1, borderRadius: 14, backgroundColor: c.surface,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  privacyCardActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
  privacyIcon: { fontSize: 22, marginBottom: 4 },
  privacyLabel: { fontSize: 14, fontWeight: '600' as const, color: c.textSec },
  privacyLabelActive: { color: c.primary },
  privacySub: { fontSize: 11, color: c.textMuted, marginTop: 2 },

  /* Buttons */
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: c.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 18,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' as const, color: c.white },
  btnDisabled: { opacity: 0.35 },

  /* ═══ Page 3 — Full map ═══ */
  mapFull: { flex: 1 },

  mapTopBar: {
    position: 'absolute', left: 12, right: 12, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  mapBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  stepBadgeMap: {
    backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },

  /* Center pin overlay */
  pinOverlay: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -18, marginTop: -36, alignItems: 'center',
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: -4 },

  /* Search — large & friendly */
  searchWrap: { position: 'absolute', left: 12, right: 12, zIndex: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.card, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500' as const, color: c.dark, padding: 0 },
  dropdown: {
    backgroundColor: c.card, borderRadius: 14, marginTop: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 5, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  dropText: { flex: 1, fontSize: 15, fontWeight: '600' as const, color: c.dark },
  dropSub: { flex: 1, fontSize: 12, color: c.textMuted, marginTop: 2 },
  dropTextMuted: { flex: 1, fontSize: 14, color: c.textMuted },

  /* Hint */
  hintCard: {
    position: 'absolute', left: 12, right: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  hintText: { fontSize: 13, color: c.textMuted, flex: 1 },

  /* Address pill */
  addrPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  addrText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: c.dark },

  /* Map bottom */
  mapBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: c.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6,
  },

  /* ═══ Success overlay — full card on map page ═══ */
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  confettiContainer: {
    position: 'absolute', top: '40%', left: '50%',
    width: 0, height: 0, alignItems: 'center', justifyContent: 'center', zIndex: 201,
  },
  confettiPiece: { position: 'absolute' },
  successCard: {
    width: '88%',
    backgroundColor: c.card,
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    zIndex: 202,
  },
  successCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  successEmojiBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: c.dark,
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: c.textMuted,
    marginBottom: 16,
    textAlign: 'center',
  },
  successLocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.successSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  successLocText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: c.success,
    maxWidth: 200,
  },
  successBtnsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  successChatBtn: {
    flex: 1, height: 54, borderRadius: 16, backgroundColor: c.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  successChatText: { fontSize: 16, fontWeight: '700' as const, color: c.white },
  successDeleteBtn: {
    flex: 1, height: 54, borderRadius: 16, backgroundColor: c.primaryLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FFCDD0',
  },
  successDeleteText: { fontSize: 16, fontWeight: '700' as const, color: c.primary },
});
