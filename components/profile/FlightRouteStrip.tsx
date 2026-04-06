/**
 * FlightRouteStrip — Wavy flight-path strip for the profile.
 *
 * Matches the reference design exactly:
 * • SVG wavy dashed line connecting location pins
 * • Pin icons (circle + inner dot) at each stop
 * • Country name under each pin — NO flags, NO emojis
 * • Airplane icon mid-route on the dashed line
 * • Scroll arrows < > on both sides
 * • Clean, minimal, white card
 */
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Keyboard, LayoutAnimation, Platform, UIManager,
  Dimensions,
} from 'react-native';
import { useState, useMemo, useCallback, useRef } from 'react';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import NomadIcon from '../NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import type { VisitedPlace } from '../../lib/types';
import { COUNTRIES } from '../../lib/countries';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ── Approximate country centers for distance calculation ── */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'thailand': [15.87, 100.99], 'china': [35.86, 104.19], 'japan': [36.20, 138.25],
  'south korea': [35.91, 127.77], 'vietnam': [14.06, 108.28], 'indonesia': [0.79, 113.92],
  'india': [20.59, 78.96], 'united states': [37.09, -95.71], 'usa': [37.09, -95.71],
  'canada': [56.13, -106.35], 'mexico': [23.63, -102.55], 'brazil': [-14.24, -51.93],
  'argentina': [-38.42, -63.62], 'colombia': [4.57, -74.30], 'united kingdom': [55.38, -3.44],
  'uk': [55.38, -3.44], 'france': [46.23, 2.21], 'germany': [51.17, 10.45],
  'spain': [40.46, -3.75], 'italy': [41.87, 12.57], 'portugal': [39.40, -8.22],
  'netherlands': [52.13, 5.29], 'greece': [39.07, 21.82], 'turkey': [38.96, 35.24],
  'australia': [-25.27, 133.78], 'israel': [31.05, 34.85], 'morocco': [31.79, -7.09],
  'south africa': [-30.56, 22.94], 'egypt': [26.82, 30.80], 'russia': [61.52, 105.32],
  'poland': [51.92, 19.15], 'czechia': [49.82, 15.47], 'hungary': [47.16, 19.50],
  'croatia': [45.10, 15.20], 'georgia': [42.32, 43.36], 'peru': [-9.19, -75.02],
  'costa rica': [9.75, -83.75], 'philippines': [12.88, 121.77], 'malaysia': [4.21, 101.98],
  'singapore': [1.35, 103.82], 'cambodia': [12.57, 104.99], 'sri lanka': [7.87, 80.77],
  'nepal': [28.39, 84.12], 'taiwan': [23.70, 120.96], 'uae': [23.42, 53.85],
  'bali': [-8.41, 115.19], 'new zealand': [-40.90, 174.89],
  'sweden': [60.13, 18.64], 'switzerland': [46.82, 8.23], 'austria': [47.52, 14.55],
  'ireland': [53.41, -8.24], 'romania': [45.94, 24.97], 'kenya': [-0.02, 37.91],
  'chile': [-35.68, -71.54], 'ecuador': [-1.83, -78.18], 'panama': [8.54, -80.78],
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCoords(place: VisitedPlace): [number, number] {
  if (place.lat && place.lng) return [place.lat, place.lng];
  const key = place.country?.toLowerCase();
  if (key && COUNTRY_COORDS[key]) return COUNTRY_COORDS[key];
  return [0, 0];
}

/* ── Short label: abbreviate long country names ── */
function shortLabel(country: string): string {
  if (country.length <= 8) return country;
  const ABBR: Record<string, string> = {
    'united states': 'USA', 'united kingdom': 'UK', 'south korea': 'S.Korea',
    'new zealand': 'NZ', 'south africa': 'S.Africa', 'costa rica': 'C.Rica',
    'czech republic': 'Czechia', 'dominican republic': 'DR',
  };
  const lower = country.toLowerCase();
  if (ABBR[lower]) return ABBR[lower];
  return country.length > 10 ? country.slice(0, 9) + '…' : country;
}

/* ── Deduplicate by country, keep order ── */
function uniqueCountries(places: VisitedPlace[]): VisitedPlace[] {
  const seen = new Set<string>();
  return places.filter(p => {
    if (!p.country) return false;
    const key = p.country.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ── SVG Layout constants ── */
const SVG_H = 100;           // Total SVG height
const PIN_R_OUTER = 10;      // Pin outer circle radius
const PIN_R_INNER = 4;       // Pin inner dot radius
const STOP_GAP_MIN = 70;     // Min horizontal gap between stops
const STOP_GAP_MAX = 120;    // Max horizontal gap between stops
const WAVE_AMP = 18;         // Amplitude of the wave
const Y_CENTER = 42;         // Vertical center of the wave path
const LABEL_Y_OFFSET = 22;   // How far below pin center to place label
const PLANE_SIZE = 18;       // Airplane icon size
const SIDE_PAD = 30;         // Padding on left/right of SVG

/* ── Wave Y position for each stop ── */
const WAVE_PATTERN = [0, -1, 0.4, -0.8, 0.1, -0.6, 0.5, -0.9];
function waveY(i: number): number {
  return Y_CENTER + WAVE_PATTERN[i % WAVE_PATTERN.length] * WAVE_AMP;
}

/** Distance → horizontal gap between stops */
function distToGap(km: number): number {
  const ratio = Math.min(1, Math.max(0, (km - 300) / 14000));
  return STOP_GAP_MIN + ratio * (STOP_GAP_MAX - STOP_GAP_MIN);
}

interface Props {
  places: VisitedPlace[];
  isOwner: boolean;
  onAddPlace?: (place: VisitedPlace) => void;
  nextDestination?: string | null;
  nextDestinationFlag?: string | null;
}

export default function FlightRouteStrip({
  places, isOwner, onAddPlace,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  // Picker
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const openPicker = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPicker(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const closePicker = useCallback(() => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPicker(false);
    setQuery('');
  }, []);

  const selectCountry = useCallback((country: { name: string; flag: string }) => {
    onAddPlace?.({ city: country.name, country: country.name, lat: 0, lng: 0, year: new Date().getFullYear() });
    closePicker();
  }, [onAddPlace, closePicker]);

  const stops = uniqueCountries(places);
  const countryCount = stops.length;
  const cityCount = places.length;

  // Pre-compute stop positions
  const stopPositions = useMemo(() => {
    const positions: { x: number; y: number; label: string }[] = [];
    let xCursor = SIDE_PAD;

    stops.forEach((stop, i) => {
      const y = waveY(i);
      positions.push({ x: xCursor, y, label: shortLabel(stop.country) });

      if (i < stops.length - 1) {
        const [lat1, lng1] = getCoords(stop);
        const [lat2, lng2] = getCoords(stops[i + 1]);
        const km = (lat1 && lng1 && lat2 && lng2) ? haversineKm(lat1, lng1, lat2, lng2) : 3000;
        xCursor += distToGap(km);
      }
    });

    return positions;
  }, [stops]);

  // SVG total width
  const svgWidth = useMemo(() => {
    if (stopPositions.length === 0) return 200;
    return stopPositions[stopPositions.length - 1].x + SIDE_PAD;
  }, [stopPositions]);

  // Build the SVG wavy dashed path
  const pathD = useMemo(() => {
    if (stopPositions.length < 2) return '';
    let d = `M ${stopPositions[0].x} ${stopPositions[0].y}`;
    for (let i = 1; i < stopPositions.length; i++) {
      const prev = stopPositions[i - 1];
      const curr = stopPositions[i];
      const cpX = (prev.x + curr.x) / 2;
      // Control point: midpoint X, but Y swings in opposite direction for wave
      const cpY1 = prev.y + (curr.y - prev.y) * 0.1;
      const cpY2 = curr.y - (curr.y - prev.y) * 0.1;
      d += ` C ${cpX} ${cpY1}, ${cpX} ${cpY2}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [stopPositions]);

  // Plane position: midpoint of the middle segment
  const planePos = useMemo(() => {
    if (stopPositions.length < 2) return null;
    const midIdx = Math.floor((stopPositions.length - 1) / 2);
    const p1 = stopPositions[midIdx];
    const p2 = stopPositions[midIdx + 1];
    const x = (p1.x + p2.x) / 2;
    const y = (p1.y + p2.y) / 2;
    // Calculate angle for rotation
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { x, y, angle };
  }, [stopPositions]);

  // Scroll arrows
  const handleScrollLeft = useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, []);

  const handleScrollRight = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  if (stops.length === 0 && !isOwner) return null;

  // Colors for SVG
  const pinColor = colors.dark;
  const pinFill = colors.card;
  const lineColor = colors.dark;
  const planeColor = '#C4A882'; // Warm rose/beige like in reference

  return (
    <View style={st.wrap}>
      {/* ── Header ── */}
      <View style={st.headerRow}>
        <View style={st.headerLeft}>
          <Text style={st.headerEmoji}>✈️</Text>
          <Text style={st.headerTitle}>My Travels</Text>
        </View>
        {isOwner && !showPicker && (
          <TouchableOpacity onPress={openPicker} activeOpacity={0.7} style={st.addBtn}>
            <NomadIcon name="plus" size={s(5)} color={colors.primary} strokeWidth={1.6} />
            <Text style={st.addText}>{t('profile.addPlace')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Picker ── */}
      {showPicker && (
        <View style={st.pickerWrap}>
          <View style={st.pickerInputRow}>
            <NomadIcon name="search" size={s(5)} color={colors.textFaint} strokeWidth={1.6} />
            <TextInput
              ref={inputRef} style={st.pickerInput}
              placeholder="search country..." placeholderTextColor={colors.textFaint}
              value={query} onChangeText={setQuery}
              autoCorrect={false} returnKeyType="search"
            />
            <TouchableOpacity onPress={closePicker}>
              <NomadIcon name="close" size={s(5)} color={colors.textMuted} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
          {filtered.length > 0 && (
            <ScrollView style={st.pickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filtered.map((c) => (
                <TouchableOpacity key={c.name} style={st.pickerItem} onPress={() => selectCountry(c)} activeOpacity={0.7}>
                  <Text style={st.pickerFlag}>{c.flag}</Text>
                  <Text style={st.pickerName}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ══════ THE FLIGHT STRIP ══════ */}
      {stops.length > 0 ? (
        <View style={st.stripCard}>
          {/* Left arrow */}
          <TouchableOpacity style={st.arrowLeft} onPress={handleScrollLeft} activeOpacity={0.6}>
            <Text style={st.arrowText}>‹</Text>
          </TouchableOpacity>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.stripScroll}
            decelerationRate="fast"
          >
            <Svg width={svgWidth} height={SVG_H} viewBox={`0 0 ${svgWidth} ${SVG_H}`}>
              {/* Wavy dashed route line */}
              {pathD ? (
                <Path
                  d={pathD}
                  stroke={lineColor}
                  strokeWidth={2}
                  strokeDasharray="6,5"
                  fill="none"
                  strokeLinecap="round"
                />
              ) : null}

              {/* Stop pins */}
              {stopPositions.map((pos, i) => (
                <G key={`pin-${i}`}>
                  {/* Outer circle */}
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={PIN_R_OUTER}
                    fill={pinFill}
                    stroke={pinColor}
                    strokeWidth={2}
                  />
                  {/* Inner dot */}
                  <Circle
                    cx={pos.x}
                    cy={pos.y}
                    r={PIN_R_INNER}
                    fill={pinColor}
                  />
                  {/* Country label */}
                  <SvgText
                    x={pos.x}
                    y={pos.y + LABEL_Y_OFFSET}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="600"
                    fill={pinColor}
                  >
                    {pos.label}
                  </SvgText>
                </G>
              ))}

              {/* Airplane mid-route */}
              {planePos && (
                <G>
                  <SvgText
                    x={planePos.x}
                    y={planePos.y + 5}
                    textAnchor="middle"
                    fontSize={PLANE_SIZE}
                    rotation={planePos.angle}
                    originX={planePos.x}
                    originY={planePos.y}
                  >
                    ✈
                  </SvgText>
                </G>
              )}
            </Svg>
          </ScrollView>

          {/* Right arrow */}
          <TouchableOpacity style={st.arrowRight} onPress={handleScrollRight} activeOpacity={0.6}>
            <Text style={st.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
      ) : isOwner ? (
        <TouchableOpacity style={st.emptyStrip} activeOpacity={0.7} onPress={openPicker}>
          <Text style={st.emptyPlane}>✈️</Text>
          <Text style={st.emptyTitle}>where have you been?</Text>
          <Text style={st.emptySub}>add your travels to build your flight map</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Stats ── */}
      {countryCount > 0 && (
        <View style={st.statsRow}>
          <View style={st.statItem}>
            <Text style={st.statNum}>{countryCount}</Text>
            <Text style={st.statLabel}>{t('profile.countriesCount') || 'countries'}</Text>
          </View>
          <View style={st.statDivider} />
          <View style={st.statItem}>
            <Text style={st.statNum}>{cityCount}</Text>
            <Text style={st.statLabel}>{t('profile.citiesCount') || 'cities'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: { marginHorizontal: s(8), marginTop: s(6) },

  /* Header */
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: s(4), paddingHorizontal: s(2),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  headerEmoji: { fontSize: s(7) },
  headerTitle: { fontSize: s(7), fontWeight: FW.extra, color: c.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: s(1.5) },
  addText: { fontSize: s(5), fontWeight: FW.semi, color: c.primary },

  /* Picker */
  pickerWrap: { marginBottom: s(4) },
  pickerInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    backgroundColor: c.surface, borderRadius: s(6),
    paddingHorizontal: s(5), paddingVertical: s(3),
    borderWidth: 0.5, borderColor: c.borderSoft,
  },
  pickerInput: { flex: 1, fontSize: s(6), fontWeight: FW.medium, color: c.dark, padding: 0, margin: 0 },
  pickerList: {
    maxHeight: s(50), marginTop: s(2),
    backgroundColor: c.surface, borderRadius: s(6),
    borderWidth: 0.5, borderColor: c.borderSoft,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingHorizontal: s(5), paddingVertical: s(3.5),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  pickerFlag: { fontSize: s(8) },
  pickerName: { fontSize: s(5.5), fontWeight: FW.medium, color: c.dark },

  /* ═══ Strip card ═══ */
  stripCard: {
    backgroundColor: c.card,
    borderRadius: s(6),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(1) },
    shadowOpacity: 0.04,
    shadowRadius: s(4),
    flexDirection: 'row',
    alignItems: 'center',
  },
  stripScroll: {
    paddingVertical: s(2),
  },

  /* Scroll arrows */
  arrowLeft: {
    paddingHorizontal: s(2),
    paddingVertical: s(6),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  arrowRight: {
    paddingHorizontal: s(2),
    paddingVertical: s(6),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  arrowText: {
    fontSize: s(8),
    color: c.textMuted,
    fontWeight: FW.light,
  },

  /* Empty state */
  emptyStrip: {
    alignItems: 'center', paddingVertical: s(12), gap: s(3),
    backgroundColor: c.card, borderRadius: s(6),
    borderWidth: 0.5, borderColor: c.borderSoft,
  },
  emptyPlane: { fontSize: s(14) },
  emptyTitle: { fontSize: s(6.5), fontWeight: FW.bold, color: c.dark },
  emptySub: { fontSize: s(5), color: c.textMuted, fontWeight: FW.medium, textAlign: 'center' },

  /* Stats */
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(8), marginTop: s(5), paddingBottom: s(2),
  },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: s(9), fontWeight: FW.extra, color: c.dark },
  statLabel: { fontSize: s(4.5), color: c.textMuted, fontWeight: FW.medium, marginTop: s(0.5) },
  statDivider: { width: 1, height: s(12), backgroundColor: c.borderSoft },
});
