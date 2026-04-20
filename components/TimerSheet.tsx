import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  Modal, TextInput, Platform, Keyboard, ScrollView,
  UIManager, LayoutAnimation,
} from 'react-native';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { detectCategories } from '../lib/categoryDetector';
import * as Haptics from 'expo-haptics';
// Location helpers live in ONE module now (CLAUDE.md Rule Zero).
// MapView / Region / GeoResult / searchAddress / reverseGeocode are
// gone from this file after Stage 7 — the sheet does not own a map
// any more. resolveLiveLocation stays ONLY for the legacy fallback
// path when initialPick is undefined (which should not happen in
// normal user flow, but we keep the safety net).
import { resolveLiveLocation } from '../lib/locationServices';

const { height: SH, width: SW } = Dimensions.get('window');
const OFFSCREEN = SH;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ── 6 categories ── */
const CATEGORIES = [
  { key: 'coffee', emoji: '☕', label: 'status.coffee' },
  { key: 'food',   emoji: '🍕', label: 'status.foodDrinks' },
  { key: 'work',   emoji: '💻', label: 'status.work' },
  { key: 'beach',  emoji: '🏖', label: 'status.beach' },
  { key: 'sport',  emoji: '🏃', label: 'status.sport' },
  { key: 'bar',    emoji: '🍺', label: 'status.bar' },
] as const;

/* ── Duration presets ── */
const DURATIONS = [15, 30, 45, 60, 90, 120];

/* ── Location modes ── */
type LocMode = 'live' | 'map';

/* ── Geocoding + GPS + IP + spoof detection live in
 *    lib/locationServices.ts. This file only composes them into
 *    TimerSheet's state machine; it does not reimplement any of it. */

/* ── Exported interface ── */
export interface TimerData {
  category: string;
  emoji: string;
  statusText: string;
  locationName: string;
  latitude: number;
  longitude: number;
  durationMinutes: number;
  ageMin: number;
  ageMax: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPublish: (data: TimerData) => void;
  cityName: string;
  cityLat: number;
  cityLng: number;
  userLat?: number | null;
  userLng?: number | null;
  publishing?: boolean;
  /** When set, the sheet opens with a pre-chosen location from
   *  HomeScreen's pickMode. Page 2 (the internal map) is skipped
   *  entirely — the user only sees the details page and publishes
   *  directly from it. Passing null opens the sheet in its legacy
   *  2-page mode with the internal map, kept for fallback. */
  initialPick?: { latitude: number; longitude: number; address: string } | null;
}

import DualThumbSlider from './DualThumbSlider';

export default function TimerSheet({
  visible, onClose, onPublish, cityName, cityLat, cityLng, userLat, userLng, publishing, initialPick,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const st = useMemo(() => makeStyles(colors), [colors]);

  /* ── Page: 1=details, 2=map ── */
  const [page, setPage] = useState<1 | 2>(1);
  const [published, setPublished] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  /* ── Confetti particles ── */
  const CONFETTI_COLORS = ['#E8614D', '#FF9A00', '#FFD700', '#34A853', '#2A9D8F', '#A855F7', '#EC4899'];
  const CONFETTI_EMOJIS = ['🎉', '✨', '🎊', '⭐', '🥳', '💫'];
  const confettiParticles = useRef(
    Array.from({ length: 20 }, () => ({
      anim: new Animated.Value(0),
      angle: Math.random() * Math.PI * 2,
      distance: 80 + Math.random() * 140,
      rotation: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      emoji: Math.random() > 0.5 ? CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)] : null,
      size: 6 + Math.random() * 10,
      delay: Math.random() * 150,
    }))
  ).current;

  /* Page 1 state */
  const [category, setCategory] = useState<string | null>(null);
  const [detectedEmojis, setDetectedEmojis] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('');

  // Auto-detect categories as user types
  const handleTextChange = useCallback((text: string) => {
    setStatusText(text);
    const detected = detectCategories(text);
    if (detected.length > 0) {
      setCategory(detected[0].key);
      setDetectedEmojis(detected.map(d => d.emoji));
    } else {
      setCategory(null);
      setDetectedEmojis([]);
    }
  }, []);
  const [duration, setDuration] = useState(60);
  const [locMode, setLocMode] = useState<LocMode>('live');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(80);

  /* Location state — kept minimal after Stage 7. The sheet no
   * longer owns a MapView, so there are no more map search /
   * reverse-geocode / region tracking states here. `pinLat` /
   * `pinLng` survive because handlePublish reads them; they are
   * seeded from `initialPick` in the reset effect below. */
  const [pinLat, setPinLat] = useState(cityLat);
  const [pinLng, setPinLng] = useState(cityLng);
  const [addressLabel, setAddressLabel] = useState('');

  /* Live location state — only populated by fetchLiveLocation,
   * which only runs when the sheet opens WITHOUT initialPick. In
   * the normal pickMode flow these never fire. Kept as a
   * last-ditch fallback so the sheet isn't completely blank if a
   * future caller forgets to go through pickMode. */
  const [liveLat, setLiveLat] = useState<number | null>(null);
  const [liveLng, setLiveLng] = useState<number | null>(null);
  const [liveAddr, setLiveAddr] = useState('');
  const [fetchingLive, setFetchingLive] = useState(false);
  const [gpsWarning, setGpsWarning] = useState(false);

  /* ── Reset on open ── */
  useEffect(() => {
    if (visible) {
      setPage(1);
      setPublished(false);
      setCategory(null);
      setDetectedEmojis([]);
      setStatusText('');
      setDuration(60);
      setLocMode('live');
      setAgeMin(18);
      setAgeMax(80);
      // If HomeScreen pickMode already resolved a location, freeze
      // the pin there and DO NOT refetch GPS — the user explicitly
      // picked this spot on the main map. Otherwise fall back to
      // the legacy seed-and-refresh flow (used only when the sheet
      // is opened without pickMode, which should not happen in
      // normal user flows any more).
      if (initialPick) {
        setPinLat(initialPick.latitude);
        setPinLng(initialPick.longitude);
        setLiveLat(initialPick.latitude);
        setLiveLng(initialPick.longitude);
        setAddressLabel(initialPick.address || '');
        setLiveAddr(initialPick.address || '');
      } else {
        const startLat = userLat ?? cityLat;
        const startLng = userLng ?? cityLng;
        setPinLat(startLat);
        setPinLng(startLng);
        setLiveLat(userLat ?? null);
        setLiveLng(userLng ?? null);
        setAddressLabel('');
        setLiveAddr('');
      }
      setGpsWarning(false);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
      // Only auto-fetch GPS if we don't already have a chosen
      // location — otherwise the fetch would just overwrite what
      // the user confirmed on the main map.
      if (!initialPick) fetchLiveLocation();
    } else {
      Animated.timing(translateY, {
        toValue: OFFSCREEN, duration: 250, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  /* ── Fetch device location ──
   *
   * Thin wrapper around `resolveLiveLocation` in locationServices.
   * The function's one job in this sheet is to route the resolved
   * values into local state — it does NOT know how to talk to GPS
   * or IP or handle spoof detection; that lives in the shared
   * module and is tested in one place.
   *
   * A change in spoof threshold, provider order, or permission
   * handling belongs in locationServices, not here. */
  const fetchLiveLocation = useCallback(async () => {
    setFetchingLive(true);
    setGpsWarning(false);
    try {
      const res = await resolveLiveLocation(cityLat, cityLng);

      setLiveLat(res.latitude);
      setLiveLng(res.longitude);
      setGpsWarning(res.spoofSuspected || res.usedFallback);

      // Sync the map pin to the resolved position so the user sees
      // the map land where they actually are. Both Timer and Status
      // mirror live → pin, so both flows feel like the same map —
      // this was the exact inconsistency Rule Zero exists to stop.
      setPinLat(res.latitude);
      setPinLng(res.longitude);

      // Label the pin with the city name only — the street-level
      // reverse geocode lived on the internal MapView (page 2)
      // which Stage 7 removed. If an external caller needs a
      // street-level label they should go through HomeScreen's
      // pickMode, which already reverse-geocodes as the user pans.
      setLiveAddr(cityName);
    } catch (err) {
      // resolveLiveLocation is fully try-wrapped inside, so reaching
      // this catch means something weirder happened (e.g. we ran
      // without permissions module). Fall back gracefully.
      console.warn('[TimerSheet] live location error:', err);
      setLiveLat(cityLat);
      setLiveLng(cityLng);
      setLiveAddr(cityName);
      setGpsWarning(true);
    } finally {
      setFetchingLive(false);
    }
  }, [cityName, cityLat, cityLng]);

  /* Map / search / reverse-geocode helpers removed in Stage 7.
   * They belonged to the defunct page-2 MapView. Location picking
   * and address search happen on HomeScreen's pickMode now. If
   * you find yourself wanting a quick "search address in this
   * sheet" — extend pickMode, don't reintroduce a second map. */

  /* ── Navigation ── */
  const selectedCat = CATEGORIES.find(c => c.key === category);
  const canProceed = statusText.trim().length > 0;

  const goBack = () => {
    // page 2 no longer exists, but we keep the `if (page === 2)`
    // branch for defensive clarity — it will simply never fire.
    // Closing on back is the only path.
    onClose();
  };

  /* ── Publish ── */
  const handlePublish = () => {
    if (publishing || !statusText.trim()) return;
    let lat: number, lng: number, locName: string;
    if (initialPick) {
      // pickMode handed us a frozen coordinate — use it verbatim.
      // This is the only path in the normal user flow.
      lat = initialPick.latitude;
      lng = initialPick.longitude;
      locName = initialPick.address || cityName;
    } else if (locMode === 'live' && liveLat !== null && liveLng !== null) {
      // Legacy fallback: sheet opened without initialPick (should
      // not happen) and the old live-GPS fetch succeeded.
      lat = liveLat;
      lng = liveLng;
      locName = liveAddr || cityName;
    } else {
      // Nothing — center on the city so we don't publish at (0, 0).
      lat = cityLat;
      lng = cityLng;
      locName = cityName;
    }
    onPublish({
      category: category || 'other',
      emoji: detectedEmojis[0] || selectedCat?.emoji || '📍',
      statusText: statusText.trim(),
      locationName: locName,
      latitude: lat,
      longitude: lng,
      durationMinutes: duration,
      ageMin,
      ageMax,
    });

    // Show success card + slide sheet down
    setPublished(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 400);
    // Slide the sheet DOWN
    Animated.timing(translateY, { toValue: SH, duration: 400, useNativeDriver: true }).start();
    // Success card entrance
    successAnim.setValue(0);
    Animated.spring(successAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();
    confettiParticles.forEach((p) => {
      p.anim.setValue(0);
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]).start();
    });
  };

  /* ═══ RENDER ═══ */
  const sheetH = SH * 0.82;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        {page !== 2 && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />}

        <Animated.View style={[
          st.sheet,
          page === 2 ? { flex: 1 } : { height: sheetH },
          { transform: [{ translateY }] },
        ]}>
          {/* ── Header (page 1 only) ── */}
          {page !== 2 && (
            <>
              <View style={st.handle} />
              <View style={st.headerRow}>
                <TouchableOpacity onPress={goBack} style={st.hdrBtn}>
                  <NomadIcon name="close" size={18} strokeWidth={1.8} color="#1A1A1A"  />
                </TouchableOpacity>
                <Text style={st.title}>
                  {t('timer.title') || "I'm here for..."}
                </Text>
                <View style={st.stepBadge}>
                  <Text style={st.stepText}>1/2</Text>
                </View>
              </View>
            </>
          )}

          {/* ═══ PAGE 1 ═══ */}
          {/* Success overlay moved outside sheet — see below */}
          {page === 1 && (
            <ScrollView style={st.page1} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* What are you doing? — auto-detect icons */}
              <Text style={st.label}>{t('timer.whatDoing') || 'what are you doing?'}</Text>

              {/* Detected emoji badges */}
              {detectedEmojis.length > 0 && (
                <View style={st.detectedRow}>
                  {detectedEmojis.map((emoji, i) => (
                    <View key={i} style={st.detectedBadge}>
                      <Text style={st.detectedEmoji}>{emoji}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TextInput
                style={st.input}
                placeholder={t('timer.statusPlaceholder') || 'e.g. coffee and working…'}
                placeholderTextColor="#AAA"
                value={statusText}
                onChangeText={handleTextChange}
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />

              {/* Duration */}
              <Text style={st.label}>{t('timer.howLong') || 'How long?'}</Text>
              <View style={st.durRow}>
                {DURATIONS.map((min) => {
                  const active = duration === min;
                  return (
                    <TouchableOpacity
                      key={min}
                      style={[st.durChip, active && st.durChipActive]}
                      onPress={() => setDuration(min)}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.durChipText, active && st.durChipTextActive]}>
                        {min < 60 ? `${min}m` : min === 60 ? '1h' : `${min / 60}h`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Age range */}
              <Text style={st.label}>Age range</Text>
              <View style={st.ageSection}>
                {/* Age range — single dual-thumb slider */}
                <DualThumbSlider
                  min={18} max={80}
                  valueMin={ageMin} valueMax={ageMax}
                  onChangeMin={setAgeMin} onChangeMax={setAgeMax}
                />
              </View>

              {/* Location mode —
                   When `initialPick` is set the user already chose
                   a spot on the main map. We hide the live/map
                   chooser entirely and show a single read-only row
                   confirming the pick. The whole "second map"
                   experience is gone for this flow. */}
              <Text style={st.label}>{t('timer.location') || 'Location'}</Text>
              {initialPick ? (
                <View style={st.locOptions}>
                  <View style={[st.locOption, st.locOptionActive]}>
                    <NomadIcon name="pin" size={18} strokeWidth={1.8} color={colors.primary} />
                    <View style={st.locOptionText}>
                      <Text style={[st.locOptionTitle, st.locOptionTitleActive]}>
                        Location picked
                      </Text>
                      <Text style={st.locOptionAddr} numberOfLines={1}>
                        {initialPick.address || cityName}
                      </Text>
                    </View>
                    <NomadIcon name="check-circle" size={18} strokeWidth={1.8} color={colors.primary} />
                  </View>
                </View>
              ) : (
              <View style={st.locOptions}>
                {/* Live location */}
                <TouchableOpacity
                  style={[st.locOption, locMode === 'live' && st.locOptionActive]}
                  onPress={() => {
                    setLocMode('live');
                    if (!liveLat) fetchLiveLocation();
                  }}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="crosshair" size={18} strokeWidth={1.8} color={locMode === 'live' ? colors.primary : '#555'}  />
                  <View style={st.locOptionText}>
                    <Text style={[st.locOptionTitle, locMode === 'live' && st.locOptionTitleActive]}>
                      {t('timer.liveLocation') || 'Live Location'}
                    </Text>
                    {fetchingLive ? (
                      <View>
                        <Text style={st.locWaitText}>Wait, detecting location...</Text>
                        <Text style={st.locOptionSub}>Address will appear here</Text>
                      </View>
                    ) : liveAddr ? (
                      <View>
                        <Text style={st.locReadyLabel}>Location found</Text>
                        <Text style={[st.locOptionAddr, gpsWarning && st.locOptionAddrWarn]} numberOfLines={1}>
                          {gpsWarning ? '~ ' : ''}{liveAddr}
                        </Text>
                      </View>
                    ) : (
                      <Text style={st.locOptionSub}>{cityName}</Text>
                    )}
                  </View>
                  {locMode === 'live' && !fetchingLive && (
                    <TouchableOpacity onPress={fetchLiveLocation} style={st.refreshBtn}>
                      <NomadIcon name="refresh" size={14} strokeWidth={1.8} color={colors.primary}  />
                    </TouchableOpacity>
                  )}
                  {locMode === 'live' && <NomadIcon name="check-circle" size={18} strokeWidth={1.8} color={colors.primary}  />}
                </TouchableOpacity>

                {/* GPS spoofing warning */}
                {gpsWarning && locMode === 'live' && (
                  <View style={st.gpsWarning}>
                    <NomadIcon name="alert" size={14} strokeWidth={1.8} color="#F59E0B"  />
                    <Text style={st.gpsWarningText}>
                      GPS may be inaccurate in your area. We used network location instead.
                    </Text>
                    <TouchableOpacity
                      onPress={() => { if (liveLat && liveLng) { setPinLat(liveLat); setPinLng(liveLng); } setLocMode('map'); }}
                      style={st.gpsWarningBtn}
                    >
                      <Text style={st.gpsWarningBtnText}>Fix on map</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Pick on map */}
                <TouchableOpacity
                  style={[st.locOption, locMode === 'map' && st.locOptionActive]}
                  onPress={() => {
                    // Center pin on GPS if available
                    if (liveLat && liveLng) { setPinLat(liveLat); setPinLng(liveLng); }
                    setLocMode('map');
                  }}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="globe" size={18} strokeWidth={1.8} color={locMode === 'map' ? colors.primary : '#555'}  />
                  <View style={st.locOptionText}>
                    <Text style={[st.locOptionTitle, locMode === 'map' && st.locOptionTitleActive]}>
                      {t('timer.pickOnMap') || 'Pick on Map'}
                    </Text>
                    <Text style={st.locOptionSub}>
                      {t('timer.searchOrPin') || 'Search address or drop pin'}
                    </Text>
                  </View>
                  {locMode === 'map' && <NomadIcon name="check-circle" size={18} strokeWidth={1.8} color={colors.primary}  />}
                </TouchableOpacity>
              </View>
              )}

              {/* Publish button — the only button on this page
                   after Stage 7. Location was already chosen on
                   HomeScreen's pickMode (or, in the unlikely case
                   initialPick is null, we fall back to live GPS /
                   city center inside handlePublish). Either way
                   there is no second page to advance to. */}
              {!published && (
                <TouchableOpacity
                  style={[st.primaryBtn, !canProceed && st.btnDisabled]}
                  onPress={handlePublish}
                  disabled={!canProceed || publishing}
                  activeOpacity={0.8}
                >
                  <NomadIcon name="zap" size={18} strokeWidth={1.8} color="white"  />
                  <Text style={st.primaryBtnText}>
                    {publishing ? (t('common.loading') || '...') : (t('timer.goLive') || 'Go Live')}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Chat expiry notice */}
              <View style={st.chatNotice}>
                <NomadIcon name="chat" size={12} strokeWidth={1.8} color="#aaa"  />
                <Text style={st.chatNoticeText}>
                  Chat will expire when your timer ends
                </Text>
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>
          )}

          {/* PAGE 2 (the internal MapView) has been removed.
               Location picking happens exclusively on HomeScreen's
               pickMode, which passes a frozen initialPick into
               this sheet. There is no longer any code path that
               sets page to 2, so the block is dead. Do not re-add
               a MapView here — see CLAUDE.md "One Map" rule. */}
        </Animated.View>

        {/* ═══ Success overlay — floats ABOVE the sheet ═══ */}
        {published && (
          <View style={st.successOverlay}>
            <View style={st.confettiContainer} pointerEvents="none">
              {confettiParticles.map((p, i) => {
                const tx = p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, Math.cos(p.angle) * p.distance * 0.7, Math.cos(p.angle) * p.distance] });
                const ty = p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, Math.sin(p.angle) * p.distance * 0.7 - 40, Math.sin(p.angle) * p.distance + 20] });
                const rot = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotation}deg`] });
                const sc = p.anim.interpolate({ inputRange: [0, 0.15, 0.5, 0.85, 1], outputRange: [0, 1.4, 1.1, 0.6, 0] });
                const op = p.anim.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 1, 0.8, 0] });
                if (p.emoji) return <Animated.Text key={i} style={[st.confettiPiece, { fontSize: p.size + 10, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }, { rotate: rot }] }]}>{p.emoji}</Animated.Text>;
                return <Animated.View key={i} style={[st.confettiPiece, { width: p.size, height: p.size * 0.6, borderRadius: p.size * 0.15, backgroundColor: p.color, opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }, { rotate: rot }] }]} />;
              })}
            </View>
            <Animated.View style={[st.successCard, { opacity: successAnim, transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
              <TouchableOpacity style={st.successCloseBtn} onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <NomadIcon name="close" size={20} strokeWidth={1.8} color="#999"  />
              </TouchableOpacity>
              <View style={st.successEmojiBadge}>
                <Text style={{ fontSize: 44 }}>{detectedEmojis[0] || CATEGORIES.find(c => c.key === category)?.emoji || '📍'}</Text>
              </View>
              <Text style={st.successTitle}>You're on the map!</Text>
              <Text style={st.successSubtitle}>{statusText || 'Your timer is live'}</Text>
              <View style={st.successLocPill}>
                <NomadIcon name="clock" size={14} strokeWidth={1.8} color={colors.primary}  />
                <Text style={st.successLocText}>{duration} min</Text>
              </View>
              <View style={st.successBtnsRow}>
                <TouchableOpacity style={st.successChatBtn} onPress={onClose} activeOpacity={0.8}>
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

/* ═══ Styles ═══ */
const GAP = 10;
const CELL_W = (SW - 32 - GAP * 2) / 3;
const DUR_CHIP_W = (SW - 32 - GAP * 5) / 6;

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

  /* Page 1 */
  page1: { flex: 1, paddingHorizontal: 16 },
  label: { fontSize: 13, fontWeight: '600' as const, color: c.dark, marginBottom: 8, marginTop: 14 },

  /* Auto-detected emoji badges */
  detectedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  detectedBadge: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: c.dangerSurface,
    borderWidth: 1.5, borderColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  detectedEmoji: { fontSize: 22 },

  /* Legacy category grid (kept for reference) */
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  catCell: {
    width: CELL_W, height: 72, borderRadius: 14,
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },
  catCellActive: { borderWidth: 2, borderColor: c.primary, backgroundColor: c.dangerSurface },
  catEmoji: { fontSize: 26 },
  catLabel: { fontSize: 11, color: c.textSec, marginTop: 3 },
  catLabelActive: { color: c.primary, fontWeight: '700' as const },

  /* Input */
  input: {
    height: 44, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft,
    backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 14, color: c.dark,
  },

  /* Duration chips — single row */
  durRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: c.surface,
  },
  durChipActive: { backgroundColor: c.primary },
  durChipText: { fontSize: 14, fontWeight: '600' as const, color: c.textSec },
  durChipTextActive: { color: c.white },

  /* Location options */
  locOptions: { gap: 8 },
  locOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: c.surface,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  locOptionActive: { borderColor: c.primary, backgroundColor: c.dangerSurface },
  locOptionText: { flex: 1 },
  locOptionTitle: { fontSize: 14, fontWeight: '600' as const, color: c.dark },
  locOptionTitleActive: { color: c.primary },
  locOptionSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  locWaitText: { fontSize: 12, fontWeight: '700' as const, color: '#F59E0B', marginBottom: 1 },
  locReadyLabel: { fontSize: 10, fontWeight: '700' as const, color: '#00A699', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 1 },
  locOptionAddr: { fontSize: 13, fontWeight: '600' as const, color: '#00A699', marginTop: 0 },
  locOptionAddrWarn: { color: '#F59E0B' },
  refreshBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,90,95,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 4,
  },
  gpsWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  gpsWarningText: { flex: 1, fontSize: 11, color: '#92700C', lineHeight: 15 },
  gpsWarningBtn: {
    backgroundColor: c.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  gpsWarningBtnText: { fontSize: 11, fontWeight: '700' as const, color: 'white' },

  /* Age range */
  ageSection: { marginBottom: 4 },
  ageValueRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 2,
  },
  ageValueBadge: {
    backgroundColor: '#FFF0F0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1.5, borderColor: 'rgba(255,90,95,0.2)',
  },
  ageValueNum: { fontSize: 18, fontWeight: '800' as const, color: c.primary },
  ageDash: { fontSize: 16, color: '#ccc', fontWeight: '600' as const },
  agePresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, justifyContent: 'center' },
  agePresetChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSoft,
  },
  agePresetChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  agePresetText: { fontSize: 13, fontWeight: '600' as const, color: c.textSec },
  agePresetTextActive: { color: c.white },
  ageNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, paddingHorizontal: 4,
  },
  ageNoteText: { fontSize: 11, color: c.textMuted },

  /* Buttons */
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: c.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 18,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' as const, color: c.white },
  btnDisabled: { opacity: 0.35 },

  /* Page 2 — full-screen map */
  mapFull: { flex: 1 },

  pinOverlay: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -18, marginTop: -36, alignItems: 'center',
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginTop: -4 },

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

  hintCard: {
    position: 'absolute', left: 12, right: 12, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  hintText: { fontSize: 13, color: c.textMuted, flex: 1 },

  addrPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  addrText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: c.dark },

  mapBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: c.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6,
  },

  /* Chat expiry notice */
  chatNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 10,
  },
  chatNoticeText: {
    fontSize: 12, color: c.textMuted, fontWeight: '500' as const,
  },

  /* ═══ Success overlay — full card ═══ */
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  } as any,
  confettiContainer: {
    position: 'absolute', top: '40%', left: '50%',
    width: 0, height: 0, alignItems: 'center', justifyContent: 'center', zIndex: 201,
  } as any,
  confettiPiece: { position: 'absolute' } as any,
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
  } as any,
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
  } as any,
  successEmojiBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  } as any,
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
    backgroundColor: c.dangerSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFCDD0',
  } as any,
  successLocText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: c.primary,
    maxWidth: 200,
  },
  successBtnsRow: { flexDirection: 'row', gap: 12, width: '100%' } as any,
  successChatBtn: {
    flex: 1, height: 54, borderRadius: 16, backgroundColor: c.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  } as any,
  successChatText: { fontSize: 16, fontWeight: '700' as const, color: c.white },
  successDeleteBtn: {
    flex: 1, height: 54, borderRadius: 16, backgroundColor: c.dangerSurface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FFCDD0',
  } as any,
  successDeleteText: { fontSize: 16, fontWeight: '700' as const, color: c.primary },
});
