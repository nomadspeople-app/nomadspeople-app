/**
 * StatusCreationFlow — NomadsPeople activity creation wizard.
 *
 * 5-step wizard + success screen:
 *   Step 0 — I WANT TO...    → Free text input
 *   Step 1 — WHAT TYPE?      → 10 categories in 2-column grid
 *   Step 2 — WHERE?          → General area (circle) / Specific point (pin + search)
 *   Step 3 — WHEN?           → Day picker + Flexible / Specific time (iOS picker)
 *   Step 4 — WHO CAN JOIN    → Age range slider + Open / Private + warning dialog
 *   Step 5 — SUCCESS         → Activity added! Enter chat or share
 *
 *   → On publish: inserts into app_checkins + appears on map
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  Dimensions, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import DualThumbSlider from './DualThumbSlider';

const { width: SW, height: SH } = Dimensions.get('window');

/* ═══ Categories ═══ */
const CATEGORIES = [
  { key: 'food',          emoji: '🍽️', label: 'Food & Drinks',     sub: 'Restaurants, cafes, bars' },
  { key: 'nightlife',     emoji: '🎉', label: 'Nightlife',         sub: 'Clubs, parties, events' },
  { key: 'outdoors',      emoji: '🥾', label: 'Outdoor & Active',  sub: 'Hiking, sports, fitness' },
  { key: 'sightseeing',   emoji: '🗿', label: 'Sightseeing',       sub: 'Tours, landmarks, exploring' },
  { key: 'entertainment', emoji: '🎬', label: 'Entertainment',     sub: 'Movies, shows, museums' },
  { key: 'shopping',      emoji: '🛍️', label: 'Shopping',          sub: 'Markets, malls, boutiques' },
  { key: 'wellness',      emoji: '🧘', label: 'Wellness',          sub: 'Yoga, spa, meditation' },
  { key: 'rideshare',     emoji: '🚗', label: 'Rideshare',         sub: 'Split rides, carpools' },
  { key: 'social',        emoji: '💬', label: 'Social',            sub: 'Hangout, chat, meet up' },
  { key: 'other',         emoji: '✨', label: 'Other',             sub: 'Something else' },
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

/* ═══ Nominatim geocoding ═══ */
interface GeoResult { display_name: string; lat: string; lon: string }

async function searchAddress(query: string, lat: number, lng: number): Promise<GeoResult[]> {
  if (query.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&viewbox=${lng - 0.3},${lat + 0.3},${lng + 0.3},${lat - 0.3}&bounded=0&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NomadsPeople/1.0' } });
    return await res.json();
  } catch { return []; }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NomadsPeople/1.0' } });
    const data = await res.json();
    const addr = data.address || {};
    const parts = [addr.road, addr.house_number, addr.neighbourhood || addr.suburb].filter(Boolean);
    return parts.join(' ') || data.display_name?.split(',').slice(0, 2).join(',') || '';
  } catch { return ''; }
}

/* ═══ Props & Data ═══ */
interface Props {
  visible: boolean;
  onClose: () => void;
  onPublish: (data: ActivityData) => void;
  userCity: string;
  cityLat: number;
  cityLng: number;
}

export interface ActivityData {
  category: string;
  activityText: string;
  emoji: string;
  locationName: string;
  latitude: number;
  longitude: number;
  scheduledFor: Date | null;
  isFlexibleTime: boolean;
  flexSlot: string | null;
  isOpen: boolean;
  hour: number | null;
  minute: number | null;
  isGeneralArea: boolean;
  ageMin: number;
  ageMax: number;
}

const TOTAL_STEPS = 5; // 0=Text, 1=Category, 2=Where, 3=When, 4=Who
const PINK = '#FF3B6B';


export default function StatusCreationFlow({ visible, onClose, onPublish, userCity, cityLat, cityLng }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useMemo(() => makeStyles(colors), [colors]);

  /* ─── State ─── */
  const [step, setStep] = useState(0);
  // Success popup is handled by HomeScreen, not here
  const [showLocConfirm, setShowLocConfirm] = useState(false);

  // Step 0 — Free text
  const [activityText, setActivityText] = useState('');

  // Step 1 — What type
  const [category, setCategory] = useState<CategoryKey | null>(null);

  // Step 2 — Where
  const [locMode, setLocMode] = useState<'general' | 'specific'>('general');
  const [pinLat, setPinLat] = useState(cityLat);
  const [pinLng, setPinLng] = useState(cityLng);
  const [locationName, setLocationName] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Step 3 — When
  const [selectedDay, setSelectedDay] = useState(0);
  const [timeMode, setTimeMode] = useState<'flexible' | 'specific'>('flexible');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Step 4 — Who can join
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(80);
  const [isOpen, setIsOpen] = useState(true);
  const [showPrivateWarning, setShowPrivateWarning] = useState(false);

  const mapRef = useRef<MapView>(null);
  const DAYS = useRef(buildDays()).current;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textInputRef = useRef<TextInput>(null);

  /* ─── Reset on open ─── */
  useEffect(() => {
    if (visible) {
      setStep(0);
      setActivityText('');
      setCategory(null);
      setLocMode('general');
      setPinLat(cityLat);
      setPinLng(cityLng);
      setLocationName('');
      setAddressQuery('');
      setAddressResults([]);
      setSelectedDay(0);
      setTimeMode('flexible');
      setSelectedHour(12);
      setSelectedMinute(0);
      setShowTimePicker(false);
      setAgeMin(18);
      setAgeMax(80);
      setIsOpen(true);
      setShowPrivateWarning(false);
      setShowLocConfirm(false);
    }
  }, [visible]);

  /* ─── Auto-focus text input on step 0 ─── */
  useEffect(() => {
    if (visible && step === 0) {
      const timer = setTimeout(() => textInputRef.current?.focus(), 400);
      return () => clearTimeout(timer);
    }
  }, [visible, step]);

  /* ─── Address search debounce ─── */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (addressQuery.length < 3) { setAddressResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchAddress(addressQuery, cityLat, cityLng);
      setAddressResults(results);
      setSearching(false);
    }, 500);
  }, [addressQuery]);

  /* ─── Navigation ─── */
  const canProceed = () => {
    if (step === 0) return activityText.trim().length > 0;
    if (step === 1) return category !== null;
    return true;
  };

  const handleNext = () => {
    if (canProceed() && step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else onClose();
  };

  /* ─── Private mode handler ─── */
  const handlePrivateToggle = () => {
    if (locMode === 'specific') {
      setShowPrivateWarning(true);
    } else {
      setIsOpen(false);
    }
  };

  /* ─── Publish ─── */
  const handlePublish = () => {
    if (!category) return;
    const cat = CATEGORIES.find(c => c.key === category)!;
    const dayDate = DAYS[selectedDay].date;

    let scheduledFor: Date | null = null;
    if (timeMode === 'specific') {
      scheduledFor = new Date(dayDate);
      scheduledFor.setHours(selectedHour, selectedMinute, 0, 0);
    }

    onPublish({
      category,
      activityText: activityText.trim() || cat.label,
      emoji: cat.emoji,
      locationName: locationName || userCity,
      latitude: pinLat,
      longitude: pinLng,
      scheduledFor,
      isFlexibleTime: timeMode === 'flexible',
      flexSlot: null,
      isOpen,
      hour: timeMode === 'specific' ? selectedHour : null,
      minute: timeMode === 'specific' ? selectedMinute : null,
      isGeneralArea: locMode === 'general',
      ageMin,
      ageMax,
    });

    // No success screen here — parent handles navigation to Home + popup
    onClose();
  };

  /* ─── Pin drag ─── */
  const handlePinDragEnd = useCallback(async (lat: number, lng: number) => {
    setPinLat(lat);
    setPinLng(lng);
    const addr = await reverseGeocode(lat, lng);
    if (addr) setLocationName(addr);
  }, []);

  /* ─── Select address ─── */
  const selectAddress = (result: GeoResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setPinLat(lat);
    setPinLng(lng);
    const shortName = result.display_name.split(',').slice(0, 2).join(',').trim();
    setLocationName(shortName);
    setAddressQuery('');
    setAddressResults([]);
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 600);
  };

  /* ─── Time display ─── */
  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  /* ─── Hours/Minutes for picker ─── */
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = [0, 30];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={st.overlayBg} onPress={onClose} activeOpacity={1} />

        {/* ════════ STEP 2 — WHERE (full-page map) ════════ */}
        {step === 2 ? (
          <View style={st.mapFull}>
            {/* The Map — behind everything */}
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: cityLat, longitude: cityLng,
                latitudeDelta: 0.04, longitudeDelta: 0.04,
              }}
              showsUserLocation
              showsMyLocationButton={false}
              // @ts-ignore
              mapLanguage="en"
            >
              {locMode === 'general' && (
                <Circle
                  center={{ latitude: pinLat, longitude: pinLng }}
                  radius={1500}
                  fillColor="rgba(255,90,95,0.10)"
                  strokeColor="rgba(255,90,95,0.25)"
                  strokeWidth={1}
                />
              )}
              <Marker
                coordinate={{ latitude: pinLat, longitude: pinLng }}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  handlePinDragEnd(latitude, longitude);
                }}
              >
                <View style={st.pinkPin} />
              </Marker>
            </MapView>

            {/* ═══ TOP BAR — switches between toggle (General) and search (Specific) ═══ */}
            <View style={[st.mapTopBar, { top: insets.top + s(2) }]}>

              {locMode === 'general' ? (
                /* ── GENERAL MODE: Toggle bar + X ── */
                <View style={st.toggleBar}>
                  <TouchableOpacity
                    style={[st.toggleTab, st.toggleTabActive]}
                    onPress={() => setLocMode('general')}
                    activeOpacity={0.7}
                  >
                    <Text style={st.toggleIcon}>📍</Text>
                    <Text style={[st.toggleText, st.toggleTextActive]}>General</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.toggleTab}
                    onPress={() => setLocMode('specific')}
                    activeOpacity={0.7}
                  >
                    <Text style={st.toggleIcon}>📌</Text>
                    <Text style={st.toggleText}>Specific</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.toggleCloseBtn} onPress={onClose}>
                    <NomadIcon name="close" size={s(6)} strokeWidth={1.6} color="#666"  />
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── SPECIFIC MODE: Search bar ── */
                <View style={st.searchBar}>
                  <TouchableOpacity onPress={() => setLocMode('general')} style={st.searchBackBtn}>
                    <NomadIcon name="back" size={s(6)} strokeWidth={1.6} color="#333"  />
                  </TouchableOpacity>
                  <TextInput
                    style={st.searchInput}
                    placeholder="Search address or place..."
                    placeholderTextColor="#999"
                    value={addressQuery}
                    onChangeText={setAddressQuery}
                    autoFocus
                  />
                  {searching ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => { setAddressQuery(''); setAddressResults([]); }}
                      style={st.searchClearBtn}
                    >
                      <NomadIcon name="close" size={s(6)} strokeWidth={1.6} color="#666"  />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* ═══ BELOW TOP BAR — hint OR search results ═══ */}

            {/* Search results (Specific mode, typing) */}
            {locMode === 'specific' && addressResults.length > 0 && (
              <View style={[st.resultsCard, { top: insets.top + s(22) }]}>
                <FlatList
                  data={addressResults}
                  keyExtractor={(item, i) => `${item.lat}-${item.lon}-${i}`}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity style={st.resultRow} onPress={() => selectAddress(item)}>
                      <NomadIcon name="pin" size={s(5)} strokeWidth={1.4} color={PINK}  />
                      <View style={st.resultTextWrap}>
                        <Text style={st.resultTitle} numberOfLines={1}>
                          {item.display_name.split(',')[0]}
                        </Text>
                        <Text style={st.resultSub} numberOfLines={1}>
                          {item.display_name.split(',').slice(1, 3).join(',').trim()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* Hint bubble (when no search results) */}
            {!(locMode === 'specific' && addressResults.length > 0) && (
              <View style={[st.hintCard, { top: insets.top + s(22) }]}>
                <Text style={st.hintPin}>📍</Text>
                <View style={st.hintTextWrap}>
                  <Text style={st.hintTitle}>
                    {locMode === 'general' ? 'Choose a general area' : 'Choose a specific meeting point'}
                  </Text>
                  <Text style={st.hintSub}>
                    {locMode === 'general'
                      ? "If you're not sure about the exact location"
                      : 'Search, tap, or drag the pin to set location'}
                  </Text>
                </View>
              </View>
            )}

            {/* ═══ BOTTOM — Location confirm or Set button ═══ */}
            <View style={[st.mapBottomBtn, { paddingBottom: insets.bottom + s(6) }]}>
              {showLocConfirm && locationName ? (
                /* Confirmation card — user sees selected location */
                <View style={st.locConfirmCard}>
                  <View style={st.locConfirmTop}>
                    <NomadIcon name="pin" size={s(5)} strokeWidth={1.4} color={PINK}  />
                    <Text style={st.locConfirmName} numberOfLines={2}>{locationName}</Text>
                  </View>
                  <View style={st.locConfirmBtns}>
                    <TouchableOpacity
                      style={st.locConfirmChange}
                      onPress={() => setShowLocConfirm(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={st.locConfirmChangeText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={st.locConfirmOk}
                      onPress={handleNext}
                      activeOpacity={0.8}
                    >
                      <Text style={st.locConfirmOkText}>Confirm & Continue</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={st.pinkBtn}
                  onPress={() => {
                    // If no location name yet, do reverse geocode first
                    if (!locationName) {
                      reverseGeocode(pinLat, pinLng).then(addr => {
                        if (addr) setLocationName(addr);
                        setShowLocConfirm(true);
                      });
                    } else {
                      setShowLocConfirm(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={st.pinkBtnText}>Set Activity Location</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* ════════ BOTTOM SHEET STEPS (0, 1, 3, 4) ════════ */
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.sheet}>
            {/* Drag handle */}
            <View style={st.dragHandle}><View style={st.dragBar} /></View>

            {/* Header — Back / Title / X */}
            <View style={st.header}>
              <TouchableOpacity onPress={handleBack} style={st.headerSide}>
                {step > 0 ? (
                  <View style={st.backRow}>
                    <NomadIcon name="back" size={s(6)} strokeWidth={1.6} color="#333"  />
                    <Text style={st.backText}>Back</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <Text style={st.headerTitle}>
                {step === 0 ? 'Create Activity' :
                 step === 1 ? 'What type?' :
                 step === 3 ? 'When?' : 'Who can join?'}
              </Text>
              <TouchableOpacity onPress={onClose} style={st.headerSide}>
                <Text style={st.headerX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">

              {/* ════════ STEP 0 — I WANT TO... ════════ */}
              {step === 0 && (
                <View>
                  <View style={st.freeTextHeader}>
                    <Text style={st.freeTextEmoji}>✨</Text>
                    <Text style={st.freeTextTitle}>I want to...</Text>
                  </View>
                  <TextInput
                    ref={textInputRef}
                    style={st.freeTextInput}
                    placeholder="grab coffee, hang out at the park, etc."
                    placeholderTextColor="#C5C5C0"
                    value={activityText}
                    onChangeText={setActivityText}
                    multiline
                    maxLength={120}
                    returnKeyType="done"
                    blurOnSubmit
                  />
                  <Text style={st.freeTextCount}>{activityText.length}/120</Text>
                </View>
              )}

              {/* ════════ STEP 1 — WHAT TYPE ════════ */}
              {step === 1 && (
                <View style={st.catGrid}>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[st.catCard, active && st.catCardActive]}
                        onPress={() => setCategory(cat.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={st.catEmoji}>{cat.emoji}</Text>
                        <Text style={[st.catLabel, active && st.catLabelActive]}>{cat.label}</Text>
                        <Text style={st.catSub}>{cat.sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* ════════ STEP 3 — WHEN ════════ */}
              {step === 3 && (
                <View>
                  {/* Day pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.dayRow}>
                    {DAYS.map((day, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[st.dayChip, selectedDay === i && st.dayChipActive]}
                        onPress={() => setSelectedDay(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={[st.dayLabel, selectedDay === i && st.dayLabelActive]}>{day.label}</Text>
                        <Text style={[st.dayNum, selectedDay === i && st.dayNumActive]}>{day.num}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Flexible / Specific time */}
                  <View style={st.timeRow}>
                    <TouchableOpacity
                      style={[st.timeCard, timeMode === 'flexible' && st.timeCardActive]}
                      onPress={() => { setTimeMode('flexible'); setShowTimePicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={st.timeIcon}>📅</Text>
                      <Text style={[st.timeLabel, timeMode === 'flexible' && st.timeLabelActive]}>Flexible time</Text>
                      <Text style={st.timeSub}>Anytime during the day</Text>
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
                          <Text style={st.timeLabel}>Set specific time</Text>
                          <Text style={st.timeSub}>Choose exact time</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Time picker — inline scroll wheels */}
                  {showTimePicker && (
                    <View style={st.pickerWrap}>
                      <View style={st.pickerHeader}>
                        <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                          <Text style={st.pickerCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={st.pickerTitle}>Select Time</Text>
                        <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                          <Text style={st.pickerDone}>Done</Text>
                        </TouchableOpacity>
                      </View>
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
                    </View>
                  )}

                  <Text style={st.hint}>Activity will be visible on map until midnight</Text>
                </View>
              )}

              {/* ════════ STEP 4 — WHO CAN JOIN ════════ */}
              {step === 4 && (
                <View>
                  {/* Age range — real draggable slider */}
                  <View style={st.ageSection}>
                    <View style={st.ageLabelRow}>
                      <Text style={st.ageIcon}>🔒</Text>
                      <Text style={st.ageLabel}>Age range</Text>
                    </View>
                    <DualThumbSlider
                      min={18} max={80}
                      valueMin={ageMin} valueMax={ageMax}
                      onChangeMin={setAgeMin} onChangeMax={setAgeMax}
                    />
                  </View>

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
                      onPress={handlePrivateToggle}
                      activeOpacity={0.7}
                    >
                      <Text style={st.privacyIcon}>🔒</Text>
                      <Text style={[st.privacyLabel, !isOpen && st.privacyLabelActive]}>Private</Text>
                      <Text style={st.privacySub}>Approval required</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Bottom button */}
            <View style={st.bottomBar}>
              <TouchableOpacity
                style={[st.pinkBtn, !canProceed() && st.pinkBtnDisabled]}
                onPress={step === 4 ? handlePublish : handleNext}
                disabled={!canProceed()}
                activeOpacity={0.8}
              >
                <Text style={st.pinkBtnText}>
                  {step === 4 ? 'Add to Map!' : 'Next →'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* ═══ Private + Specific Location Warning Dialog ═══ */}
      <Modal visible={showPrivateWarning} transparent animationType="fade">
        <View style={st.dialogOverlay}>
          <View style={st.dialogCard}>
            <Text style={st.dialogTitle}>Specific Location + Private Activity</Text>
            <Text style={st.dialogBody}>
              You've chosen a specific meeting point, which will be visible to everyone who can see this activity. Are you sure you want to make this private?
            </Text>
            <Text style={st.dialogBody}>
              Consider using 'General Area' instead if you want to share the exact location only with approved members.
            </Text>
            <TouchableOpacity
              style={st.dialogPrimaryBtn}
              onPress={() => { setIsOpen(false); setShowPrivateWarning(false); }}
              activeOpacity={0.7}
            >
              <Text style={st.dialogPrimaryText}>Make Private Anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.dialogCancelBtn}
              onPress={() => setShowPrivateWarning(false)}
              activeOpacity={0.7}
            >
              <Text style={st.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

/* ═══════════ Styles ═══════════ */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

  /* ─── Bottom sheet (steps 0, 1, 3, 4) ─── */
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(14),
    borderTopRightRadius: s(14),
    maxHeight: SH * 0.65,
    overflow: 'hidden',
  },
  dragHandle: { alignItems: 'center', paddingTop: s(2) },
  dragBar: { width: s(18), height: s(1.5), backgroundColor: c.borderSoft, borderRadius: s(1) },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(7), paddingTop: s(2), paddingBottom: s(2),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  headerSide: { width: s(30) },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: s(5.5), color: c.dark, fontWeight: FW.semi },
  headerTitle: { fontSize: s(7), fontWeight: FW.bold, color: c.dark, textAlign: 'center' },
  headerX: { fontSize: s(7), color: c.textMuted, textAlign: 'right' },
  body: { paddingHorizontal: s(7), paddingTop: s(4), paddingBottom: s(3) },
  bottomBar: { paddingHorizontal: s(7), paddingBottom: s(6), paddingTop: s(3) },

  /* ─── Pink button (used everywhere) ─── */
  pinkBtn: {
    backgroundColor: PINK, borderRadius: s(12), paddingVertical: s(5.5),
    alignItems: 'center', justifyContent: 'center',
  },
  pinkBtnDisabled: { backgroundColor: '#DDD' },
  pinkBtnText: { color: 'white', fontSize: s(7), fontWeight: FW.bold },

  /* ─── STEP 0 — FREE TEXT ─── */
  freeTextHeader: {
    flexDirection: 'row', alignItems: 'center', gap: s(3), marginBottom: s(4),
  },
  freeTextEmoji: { fontSize: s(10) },
  freeTextTitle: { fontSize: s(8), fontWeight: FW.bold, color: c.dark },
  freeTextInput: {
    fontSize: s(6.5), color: c.dark, backgroundColor: c.surface,
    borderRadius: s(10), paddingHorizontal: s(5), paddingVertical: s(4.5),
    textAlignVertical: 'top', fontWeight: FW.medium,
    borderWidth: 1, borderColor: c.borderSoft,
  },
  freeTextCount: {
    fontSize: s(4), color: c.textFaint, textAlign: 'right', marginTop: s(2),
  },

  /* ─── STEP 1 — WHAT TYPE (2-col grid) ─── */
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(3) },
  catCard: {
    width: (SW - s(14) - s(3)) / 2,
    backgroundColor: c.surface, borderRadius: s(10),
    paddingVertical: s(5), paddingHorizontal: s(4), alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  catCardActive: { borderColor: PINK, backgroundColor: c.dangerSurface },
  catEmoji: { fontSize: s(10), marginBottom: s(1) },
  catLabel: { fontSize: s(5.5), fontWeight: FW.bold, color: c.dark, textAlign: 'center' },
  catLabelActive: { color: PINK },
  catSub: { fontSize: s(3.8), color: c.textMuted, textAlign: 'center', marginTop: s(0.5) },

  /* ─── STEP 2 — WHERE (full-page map) ─── */
  mapFull: { flex: 1 },

  /* ── Top bar container ── */
  mapTopBar: {
    position: 'absolute', left: s(5), right: s(5), zIndex: 10,
  },

  /* ── GENERAL MODE: Toggle bar (like screenshot 4.PNG) ── */
  toggleBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.card, borderRadius: s(12),
    paddingVertical: s(1), paddingHorizontal: s(2),
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1.5) },
    shadowOpacity: 0.10, shadowRadius: s(5), elevation: 4,
  },
  toggleTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(2), paddingVertical: s(4.5), borderRadius: s(10),
  },
  toggleTabActive: {
    backgroundColor: 'rgba(255,59,107,0.06)',
  },
  toggleIcon: { fontSize: s(5) },
  toggleText: { fontSize: s(5.5), fontWeight: FW.semi, color: c.textMuted },
  toggleTextActive: { color: PINK, fontWeight: FW.bold },
  toggleCloseBtn: {
    width: s(16), height: s(16), borderRadius: s(8),
    alignItems: 'center', justifyContent: 'center',
    marginLeft: s(1),
  },

  /* ── SPECIFIC MODE: Search bar (like screenshot 5.PNG / 6.PNG) ── */
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.card, borderRadius: s(12),
    paddingVertical: s(1), paddingHorizontal: s(3),
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1.5) },
    shadowOpacity: 0.10, shadowRadius: s(5), elevation: 4,
  },
  searchBackBtn: {
    padding: s(3),
  },
  searchInput: {
    flex: 1, fontSize: s(6), fontWeight: FW.medium, color: c.dark,
    paddingVertical: s(5), paddingHorizontal: s(2),
  },
  searchClearBtn: {
    padding: s(3),
  },

  /* ── Hint card (below top bar — like screenshot 4.PNG / 6.PNG) ── */
  hintCard: {
    position: 'absolute', left: s(5), right: s(5), zIndex: 8,
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    backgroundColor: c.card, borderRadius: s(12),
    paddingHorizontal: s(6), paddingVertical: s(5),
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1.5) },
    shadowOpacity: 0.10, shadowRadius: s(5), elevation: 4,
  },
  hintPin: { fontSize: s(7) },
  hintTextWrap: { flex: 1 },
  hintTitle: { fontSize: s(5.5), fontWeight: FW.bold, color: c.dark },
  hintSub: { fontSize: s(4.5), color: c.textMuted, marginTop: s(1) },

  /* ── Search results (below search bar — like screenshot 5.PNG) ── */
  resultsCard: {
    position: 'absolute', left: s(5), right: s(5), zIndex: 25,
    maxHeight: s(90), backgroundColor: c.card, borderRadius: s(12),
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1.5) },
    shadowOpacity: 0.10, shadowRadius: s(5), elevation: 4,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(4),
    paddingHorizontal: s(6), paddingVertical: s(5),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  resultTextWrap: { flex: 1 },
  resultTitle: { fontSize: s(5.5), fontWeight: FW.semi, color: c.dark },
  resultSub: { fontSize: s(4.2), color: c.textMuted, marginTop: s(0.5) },

  /* ── Pink map pin ── */
  pinkPin: {
    width: s(10), height: s(10), borderRadius: s(5),
    backgroundColor: PINK,
    shadowColor: PINK, shadowOffset: { width: 0, height: s(2) },
    shadowOpacity: 0.35, shadowRadius: s(4), elevation: 5,
  },

  /* ── Bottom CTA ── */
  mapBottomBtn: {
    position: 'absolute', bottom: 0, left: s(5), right: s(5), zIndex: 20,
  },

  /* Location confirmation card */
  locConfirmCard: {
    backgroundColor: c.card, borderRadius: s(12), padding: s(6),
    shadowColor: '#000', shadowOffset: { width: 0, height: -s(1) },
    shadowOpacity: 0.1, shadowRadius: s(5), elevation: 5,
  },
  locConfirmTop: {
    flexDirection: 'row', alignItems: 'center', gap: s(3), marginBottom: s(5),
  },
  locConfirmName: { flex: 1, fontSize: s(6), fontWeight: FW.bold, color: c.dark },
  locConfirmBtns: { flexDirection: 'row', gap: s(3) },
  locConfirmChange: {
    flex: 1, paddingVertical: s(5), borderRadius: s(10),
    backgroundColor: c.surface, alignItems: 'center',
  },
  locConfirmChangeText: { fontSize: s(5.5), fontWeight: FW.semi, color: c.textSec },
  locConfirmOk: {
    flex: 2, paddingVertical: s(5), borderRadius: s(10),
    backgroundColor: PINK, alignItems: 'center',
  },
  locConfirmOkText: { fontSize: s(5.5), fontWeight: FW.bold, color: 'white' },

  /* ─── STEP 3 — WHEN ─── */
  dayRow: { gap: s(3), marginBottom: s(5) },
  dayChip: {
    width: s(26), paddingVertical: s(5), borderRadius: s(10),
    backgroundColor: c.surface, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dayChipActive: { borderColor: PINK, backgroundColor: c.dangerSurface },
  dayLabel: { fontSize: s(5), fontWeight: FW.bold, color: c.textMuted },
  dayLabelActive: { color: PINK },
  dayNum: { fontSize: s(8), fontWeight: FW.extra, color: c.dark, marginTop: s(1) },
  dayNumActive: { color: PINK },

  timeRow: { flexDirection: 'row', gap: s(3), marginBottom: s(4) },
  timeCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: s(10),
    paddingVertical: s(5), alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  timeCardActive: { borderColor: PINK, backgroundColor: c.dangerSurface },
  timeIcon: { fontSize: s(8), marginBottom: s(1) },
  timeLabel: { fontSize: s(5), fontWeight: FW.bold, color: c.textSec },
  timeLabelActive: { color: PINK },
  timeSub: { fontSize: s(3.8), color: c.textMuted, marginTop: s(0.5) },

  hint: { fontSize: s(4.5), color: c.textFaint, textAlign: 'center', marginTop: s(2) },

  /* Time picker */
  pickerWrap: {
    backgroundColor: c.surface, borderRadius: s(10), overflow: 'hidden',
    marginBottom: s(4),
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(7), paddingVertical: s(4),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  pickerCancel: { fontSize: s(5), color: PINK, fontWeight: FW.semi },
  pickerTitle: { fontSize: s(5.5), fontWeight: FW.bold, color: c.dark },
  pickerDone: { fontSize: s(5), color: PINK, fontWeight: FW.bold },
  pickerBody: { flexDirection: 'row', height: s(50), justifyContent: 'center' },
  pickerCol: { width: s(30) },
  pickerItem: { height: s(14), alignItems: 'center', justifyContent: 'center' },
  pickerItemActive: { backgroundColor: 'rgba(255,59,107,0.08)', borderRadius: s(4) },
  pickerItemText: { fontSize: s(6), color: c.textMuted },
  pickerItemTextActive: { color: c.dark, fontWeight: FW.bold },

  /* ─── STEP 4 — WHO CAN JOIN ─── */
  ageSection: {
    marginBottom: s(6),
    backgroundColor: c.surface, borderRadius: s(10),
    padding: s(5), borderWidth: 1, borderColor: c.borderSoft,
  },
  ageLabelRow: { flexDirection: 'row', alignItems: 'center', gap: s(2), marginBottom: s(2) },
  ageIcon: { fontSize: s(6) },
  ageLabel: { fontSize: s(6), fontWeight: FW.bold, color: c.dark },

  privacyRow: { flexDirection: 'row', gap: s(3) },
  privacyCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: s(10),
    paddingVertical: s(6), alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  privacyCardActive: { borderColor: PINK, backgroundColor: c.dangerSurface },
  privacyIcon: { fontSize: s(10), marginBottom: s(2) },
  privacyLabel: { fontSize: s(6), fontWeight: FW.bold, color: c.textSec },
  privacyLabelActive: { color: PINK },
  privacySub: { fontSize: s(3.8), color: c.textMuted, marginTop: s(1) },

  /* ─── DIALOG (Private warning / Delete confirm) ─── */
  dialogOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: s(10),
  },
  dialogCard: {
    backgroundColor: c.card, borderRadius: s(10), padding: s(8),
    width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(3) },
    shadowOpacity: 0.12, shadowRadius: s(8), elevation: 6,
  },
  dialogTitle: {
    fontSize: s(7), fontWeight: FW.bold, color: c.dark,
    textAlign: 'center', marginBottom: s(4),
  },
  dialogBody: {
    fontSize: s(5), color: c.textSec, textAlign: 'center',
    lineHeight: s(7.5), marginBottom: s(4),
  },
  dialogPrimaryBtn: {
    paddingVertical: s(4), alignItems: 'center', marginTop: s(2),
  },
  dialogPrimaryText: { fontSize: s(5.5), fontWeight: FW.bold, color: '#007AFF' },
  dialogCancelBtn: {
    paddingVertical: s(4), alignItems: 'center',
  },
  dialogCancelText: { fontSize: s(5.5), fontWeight: FW.semi, color: '#007AFF' },
});
