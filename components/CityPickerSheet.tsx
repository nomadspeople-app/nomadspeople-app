import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder, Modal, ScrollView, TextInput,
} from 'react-native';
import { useRef, useEffect, useState, useMemo } from 'react';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';

const { height: SH } = Dimensions.get('window');
const SHEET_H = SH * 0.65;

export interface City {
  id: string;
  name: string;
  /** Full country name, for display ('Israel', 'Thailand'). */
  country: string;
  /** ISO 3166-1 alpha-2 country code, uppercase ('IL', 'TH').
   *  Used by the geo gates to match against a viewer's current
   *  GPS country and decide the foreign-browsing treatment.
   *
   *  Optional only to accommodate rare runtime cases where a search
   *  provider didn't return the code (disputed territories, open
   *  ocean, etc). Every entry in the static CITIES list MUST have it,
   *  and the search / GPS resolve paths MUST attempt to populate it.
   *  A missing code is fail-open by design (isSameCountryAsViewer
   *  treats null/undefined as same-country). */
  countryCode?: string;
  flag: string;
  lat: number;
  lng: number;
  active: number;
}

export const CITIES: City[] = [
  { id: 'tlv',  name: 'Tel Aviv',     country: 'Israel',    countryCode: 'IL', flag: '🇮🇱', lat: 32.0853,  lng: 34.7818,   active: 24  },
  { id: 'bkk',  name: 'Bangkok',      country: 'Thailand',  countryCode: 'TH', flag: '🇹🇭', lat: 13.7563,  lng: 100.5018,  active: 312 },
  { id: 'lis',  name: 'Lisbon',       country: 'Portugal',  countryCode: 'PT', flag: '🇵🇹', lat: 38.7169,  lng: -9.1395,   active: 187 },
  { id: 'mex',  name: 'Mexico City',  country: 'Mexico',    countryCode: 'MX', flag: '🇲🇽', lat: 19.4326,  lng: -99.1332,  active: 245 },
  { id: 'cnx',  name: 'Chiang Mai',   country: 'Thailand',  countryCode: 'TH', flag: '🇹🇭', lat: 18.7883,  lng: 98.9853,   active: 156 },
  { id: 'ber',  name: 'Berlin',       country: 'Germany',   countryCode: 'DE', flag: '🇩🇪', lat: 52.5200,  lng: 13.4050,   active: 198 },
  { id: 'bcn',  name: 'Barcelona',    country: 'Spain',     countryCode: 'ES', flag: '🇪🇸', lat: 41.3851,  lng: 2.1734,    active: 173 },
  { id: 'bal',  name: 'Bali',         country: 'Indonesia', countryCode: 'ID', flag: '🇮🇩', lat: -8.3405,  lng: 115.0920,  active: 289 },
  { id: 'tyo',  name: 'Tokyo',        country: 'Japan',     countryCode: 'JP', flag: '🇯🇵', lat: 35.6762,  lng: 139.6503,  active: 134 },
  { id: 'nyc',  name: 'New York',     country: 'USA',       countryCode: 'US', flag: '🇺🇸', lat: 40.7128,  lng: -74.0060,  active: 267 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectCity: (city: City) => void;
  currentCityId?: string;
}

export default function CityPickerSheet({ visible, onClose, onSelectCity, currentCityId }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? CITIES.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase())
      )
    : CITIES;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      translateY.setValue(SHEET_H);
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(translateY, { toValue: SHEET_H, duration: 250, useNativeDriver: true }).start(() => {
      setSearch('');
      onClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={st.overlay}>
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={dismiss} />
        <Animated.View style={[st.sheet, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          {/* Handle */}
          <View style={st.handleWrap}>
            <View style={st.handle} />
          </View>

          {/* Title */}
          <View style={st.titleRow}>
            <Text style={st.title}>Choose a city</Text>
            <TouchableOpacity onPress={dismiss} style={st.closeBtn}>
              <NomadIcon name="close" size={s(5)} color="#888" strokeWidth={1.4} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={st.searchWrap}>
            <NomadIcon name="search" size={s(4.5)} color="#bbb" strokeWidth={1.4} />
            <TextInput
              style={st.searchInput}
              placeholder="Search city..."
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <NomadIcon name="x-circle" size={s(4)} color="#ccc" strokeWidth={1.4} />
              </TouchableOpacity>
            )}
          </View>

          {/* City List */}
          <ScrollView style={st.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent} keyboardShouldPersistTaps="handled">
            {filtered.map((city) => {
              const isCurrent = city.id === currentCityId;
              return (
                <TouchableOpacity
                  key={city.id}
                  style={[st.row, isCurrent && st.rowActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelectCity(city);
                    dismiss();
                  }}
                >
                  <Text style={st.flag}>{city.flag}</Text>
                  <View style={st.rowInfo}>
                    <Text style={[st.cityName, isCurrent && st.cityNameActive]}>{city.name}</Text>
                    <Text style={st.country}>{city.country}</Text>
                  </View>
                  <View style={st.activeBadge}>
                    <View style={[st.dot, isCurrent && st.dotActive]} />
                    <Text style={[st.activeCount, isCurrent && st.activeCountBold]}>{city.active} active</Text>
                  </View>
                  {isCurrent && (
                    <View style={{ marginLeft: s(3) }}>
                      <NomadIcon name="check" size={s(5)} color={colors.primary} strokeWidth={1.6} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    height: SHEET_H,
    backgroundColor: c.card,
    borderTopLeftRadius: s(14),
    borderTopRightRadius: s(14),
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: s(6), paddingBottom: s(2) },
  handle: { width: s(24), height: s(2.5), borderRadius: s(1.5), backgroundColor: c.pill },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(12),
    paddingBottom: s(8),
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderSoft,
  },
  title: { fontSize: s(10), fontWeight: FW.extra, color: c.dark },
  closeBtn: {
    width: s(20), height: s(20), borderRadius: s(10),
    backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginHorizontal: s(12),
    marginTop: s(6),
    marginBottom: s(2),
    backgroundColor: c.pill,
    borderRadius: s(10),
    paddingHorizontal: s(8),
    paddingVertical: s(5),
  },
  searchInput: {
    flex: 1,
    fontSize: s(7),
    color: c.dark,
    padding: 0,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingVertical: s(4) },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(7),
    paddingHorizontal: s(12),
    gap: s(7),
  },
  rowActive: {
    backgroundColor: 'rgba(255,90,95,0.06)',
  },
  flag: { fontSize: s(14) },
  rowInfo: { flex: 1, minWidth: 0 },
  cityName: { fontSize: s(8), fontWeight: FW.bold, color: c.dark },
  cityNameActive: { color: c.primary },
  country: { fontSize: s(6), color: c.textMuted, marginTop: s(0.5) },

  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: s(2) },
  dot: { width: s(3), height: s(3), borderRadius: s(1.5), backgroundColor: c.accent },
  dotActive: { backgroundColor: c.primary },
  activeCount: { fontSize: s(6), color: c.textSec },
  activeCountBold: { color: c.primary, fontWeight: FW.semi },
});
