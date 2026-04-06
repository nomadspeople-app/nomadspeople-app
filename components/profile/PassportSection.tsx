import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, Dimensions, Keyboard, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useState, useMemo, useCallback, useRef } from 'react';
import NomadIcon from '../NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';
import { COUNTRIES } from '../../lib/countries';
import type { VisitedPlace } from '../../lib/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SW } = Dimensions.get('window');

/* ── Stamp colors — rotate through for visual variety ── */
const STAMP_COLORS = [
  '#C62828', '#1565C0', '#2E7D32', '#6A1B9A',
  '#E65100', '#00838F', '#4E342E', '#283593',
];
const getStampColor = (i: number) => STAMP_COLORS[i % STAMP_COLORS.length];

/* ── Stamp card dimensions ── */
const STAMP_W = s(38);
const STAMP_H = s(44);

interface Props {
  places: VisitedPlace[];
  isOwner: boolean;
  onAddPlace?: (place: VisitedPlace) => void;
}

export default function PassportSection({ places, isOwner, onAddPlace }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  // Country picker state
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Count unique countries and cities
  const countries = new Set(places.map(p => p.country));
  const cities = places.length;

  // Filtered countries for picker
  const filtered = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
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
    // Create a VisitedPlace with country center coords (approximate)
    const place: VisitedPlace = {
      city: country.name,
      country: country.name,
      lat: 0,
      lng: 0,
      year: new Date().getFullYear(),
    };
    onAddPlace?.(place);
    closePicker();
  }, [onAddPlace, closePicker]);

  return (
    <View style={st.wrap}>
      {/* Header */}
      <View style={st.headerRow}>
        <View style={st.headerLeft}>
          <NomadIcon name="globe" size={s(6)} color={colors.dark} strokeWidth={1.6} />
          <Text style={st.headerTitle}>{t('profile.passport')}</Text>
        </View>
        {isOwner && !showPicker && (
          <TouchableOpacity onPress={openPicker} activeOpacity={0.7} style={st.addBtn}>
            <NomadIcon name="plus" size={s(5)} color={colors.primary} strokeWidth={1.6} />
            <Text style={st.addText}>{t('profile.addPlace')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Inline country picker ── */}
      {showPicker && (
        <View style={st.pickerWrap}>
          <View style={st.pickerInputRow}>
            <NomadIcon name="search" size={s(5)} color={colors.textFaint} strokeWidth={1.6} />
            <TextInput
              ref={inputRef}
              style={st.pickerInput}
              placeholder={t('profile.searchCountry')}
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={closePicker}>
              <NomadIcon name="close" size={s(5)} color={colors.textMuted} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
          {filtered.length > 0 && (
            <ScrollView
              style={st.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filtered.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={st.pickerItem}
                  onPress={() => selectCountry(c)}
                  activeOpacity={0.7}
                >
                  <Text style={st.pickerFlag}>{c.flag}</Text>
                  <Text style={st.pickerName}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Passport ink stamps slider ── */}
      {places.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.stampsRow}
            decelerationRate="fast"
            snapToInterval={STAMP_W + s(3)}
          >
            {places.map((p, i) => {
              const color = getStampColor(i);
              // Slight random rotation for authentic stamp feel
              const rotation = ((i * 7 + 3) % 11) - 5; // -5 to +5 degrees
              return (
                <View
                  key={`${p.country}-${p.city}-${i}`}
                  style={[
                    st.stamp,
                    { borderColor: color, transform: [{ rotate: `${rotation}deg` }] },
                  ]}
                >
                  {/* Outer ring */}
                  <View style={[st.stampRing, { borderColor: color }]}>
                    {/* Country name curved at top */}
                    <Text style={[st.stampCountry, { color }]} numberOfLines={1}>
                      {(p.country ?? '').toUpperCase()}
                    </Text>
                    {/* Year in center — large */}
                    <Text style={[st.stampYear, { color }]}>
                      {p.year || '•'}
                    </Text>
                    {/* City at bottom */}
                    {p.city && p.city !== p.country && (
                      <Text style={[st.stampCity, { color }]} numberOfLines={1}>
                        {p.city}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Stats row */}
          <View style={st.statsRow}>
            <View style={st.statItem}>
              <Text style={st.statNum}>{countries.size}</Text>
              <Text style={st.statLabel}>{t('profile.countriesCount')}</Text>
            </View>
            <View style={st.statDivider} />
            <View style={st.statItem}>
              <Text style={st.statNum}>{cities}</Text>
              <Text style={st.statLabel}>{t('profile.citiesCount')}</Text>
            </View>
          </View>
        </>
      ) : isOwner ? (
        <TouchableOpacity style={st.emptyWrap} activeOpacity={0.7} onPress={openPicker}>
          <NomadIcon name="pin" size={s(14)} color={colors.textFaint} strokeWidth={1.8} />
          <Text style={st.emptyTitle}>{t('profile.passportEmpty')}</Text>
          <Text style={st.emptySub}>{t('profile.passportEmptySub')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    marginHorizontal: s(8),
    marginTop: s(6),
    backgroundColor: c.card,
    borderRadius: s(10),
    padding: s(6),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1) },
    shadowOpacity: 0.04, shadowRadius: s(4),
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(5) },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  headerTitle: { fontSize: s(7), fontWeight: FW.extra, color: c.dark },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: s(1.5) },
  addText: { fontSize: s(5), fontWeight: FW.semi, color: c.primary },

  /* ── Inline country picker ── */
  pickerWrap: {
    marginBottom: s(5),
  },
  pickerInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    backgroundColor: c.surface, borderRadius: s(8),
    paddingHorizontal: s(5), paddingVertical: s(3),
    borderWidth: 1, borderColor: c.borderSoft,
  },
  pickerInput: {
    flex: 1, fontSize: s(6), fontWeight: FW.medium, color: c.dark,
    padding: 0, margin: 0,
  },
  pickerList: {
    maxHeight: s(60), marginTop: s(2),
    backgroundColor: c.surface, borderRadius: s(8),
    borderWidth: 0.5, borderColor: c.borderSoft,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingHorizontal: s(5), paddingVertical: s(4),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  pickerFlag: { fontSize: s(8) },
  pickerName: { fontSize: s(5.5), fontWeight: FW.medium, color: c.dark },

  /* ── Passport stamps slider ── */
  stampsRow: {
    paddingRight: s(6), gap: s(3),
  },
  stamp: {
    width: STAMP_W,
    height: STAMP_H,
    borderWidth: 2,
    borderRadius: s(5),
    borderStyle: 'dashed',
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: s(3),
    position: 'relative',
    overflow: 'hidden',
  },
  stampRing: {
    width: '100%', height: '100%',
    borderWidth: 1.5, borderRadius: s(4), borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    padding: s(2),
  },
  stampFlag: { fontSize: s(12), marginBottom: s(1) },
  stampCountry: {
    fontSize: s(5), fontWeight: FW.extra,
    textTransform: 'uppercase', letterSpacing: 0.5,
    textAlign: 'center',
  },
  stampCity: {
    fontSize: s(3.8), fontWeight: FW.medium, color: c.textMuted,
    marginTop: s(0.5), textAlign: 'center',
  },
  stampYearBadge: {
    position: 'absolute', bottom: s(2), right: s(2),
    paddingHorizontal: s(2.5), paddingVertical: s(0.8),
    borderRadius: s(3),
  },
  stampYear: {
    fontSize: s(3.5), fontWeight: FW.bold, color: 'white',
  },

  /* Corner decorations — like passport stamp corners */
  stampCornerTL: {
    position: 'absolute', top: s(1.5), left: s(1.5),
    width: s(4), height: s(4),
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRadius: s(1),
  },
  stampCornerTR: {
    position: 'absolute', top: s(1.5), right: s(1.5),
    width: s(4), height: s(4),
    borderTopWidth: 1.5, borderRightWidth: 1.5, borderRadius: s(1),
  },
  stampCornerBL: {
    position: 'absolute', bottom: s(1.5), left: s(1.5),
    width: s(4), height: s(4),
    borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderRadius: s(1),
  },
  stampCornerBR: {
    position: 'absolute', bottom: s(1.5), right: s(1.5),
    width: s(4), height: s(4),
    borderBottomWidth: 1.5, borderRightWidth: 1.5, borderRadius: s(1),
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(8), marginTop: s(5),
  },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: s(9), fontWeight: FW.extra, color: c.dark },
  statLabel: { fontSize: s(4.5), color: c.textMuted, fontWeight: FW.medium, marginTop: s(0.5) },
  statDivider: { width: 1, height: s(12), backgroundColor: c.borderSoft },

  /* Empty state */
  emptyWrap: {
    alignItems: 'center', paddingVertical: s(10), gap: s(3),
  },
  emptyTitle: { fontSize: s(6), fontWeight: FW.bold, color: c.dark },
  emptySub: { fontSize: s(5), color: c.textMuted, textAlign: 'center' },
});
