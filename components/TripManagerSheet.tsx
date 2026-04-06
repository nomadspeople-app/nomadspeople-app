/**
 * TripManagerSheet — Bottom sheet for managing trips.
 *
 * Lets user: add a new trip, edit existing trip, remove trip.
 * Reuses the same country search + calendar UI pattern from onboarding.
 */
import { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  Dimensions, TextInput, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { COUNTRIES } from '../lib/countries';
import { supabase } from '../lib/supabase';
import { joinFlightGroup } from '../lib/hooks';
import { AuthContext } from '../App';
import * as Haptics from 'expo-haptics';

const { height: SH } = Dimensions.get('window');
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void; // callback after trip saved/removed — parent refetches profile
  /** Pre-fill with existing trip for editing */
  existing?: {
    country: string;
    flag: string;
    arrivalDate: string | null;  // ISO date
    departureDate: string | null;
    tripVibe: string | null;
    tripCompanion: string | null;
  } | null;
}

export default function TripManagerSheet({ visible, onClose, onSaved, existing }: Props) {
  const insets = useSafeAreaInsets();
  const { userId } = useContext(AuthContext);
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SH)).current;

  // Form state
  const [country, setCountry] = useState('');
  const [countryQuery, setCountryQuery] = useState('');
  const [showCountryList, setShowCountryList] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [showArrivalCal, setShowArrivalCal] = useState(false);
  const [showDepartureCal, setShowDepartureCal] = useState(false);
  const [calViewMonth, setCalViewMonth] = useState(new Date());
  const [tripVibe, setTripVibe] = useState<string | null>(null);
  const [tripCompanion, setTripCompanion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isEditing = !!existing?.country;

  // Pre-fill when editing — also fetch trip_vibe/trip_companion from DB
  useEffect(() => {
    if (visible && existing?.country) {
      setCountry(existing.country);
      setArrivalDate(existing.arrivalDate ? new Date(existing.arrivalDate + 'T00:00:00') : null);
      setDepartureDate(existing.departureDate ? new Date(existing.departureDate + 'T00:00:00') : null);
      setTripVibe(existing.tripVibe || null);
      setTripCompanion(existing.tripCompanion || null);
      // Fetch vibe/companion from flight_members if not passed
      if (!existing.tripVibe && userId) {
        (async () => {
          const { data: fg } = await supabase.from('flight_groups').select('id').eq('country', existing.country).maybeSingle();
          if (fg) {
            const { data: fm } = await supabase.from('flight_members')
              .select('trip_vibe, trip_companion')
              .eq('user_id', userId).eq('flight_group_id', fg.id).maybeSingle();
            if (fm) {
              setTripVibe(fm.trip_vibe || null);
              setTripCompanion(fm.trip_companion || null);
            }
          }
        })();
      }
    } else if (visible) {
      setCountry('');
      setCountryQuery('');
      setArrivalDate(null);
      setDepartureDate(null);
      setTripVibe(null);
      setTripCompanion(null);
    }
    setShowArrivalCal(false);
    setShowDepartureCal(false);
    setShowCountryList(false);
  }, [visible, existing]);

  // Animate
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: SH, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Country autocomplete
  const filteredCountries = useMemo(() => {
    if (!countryQuery || countryQuery.length < 1) return [];
    const q = countryQuery.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [countryQuery]);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatDateDisplay = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const canSave = country.length > 0;

  // Save trip
  const handleSave = useCallback(async () => {
    if (!userId || !country) return;
    setSaving(true);

    try {
      const arrStr = arrivalDate ? formatDate(arrivalDate) : null;
      const depStr = departureDate ? formatDate(departureDate) : null;
      const flag = COUNTRIES.find(c => c.name === country)?.flag || '';

      // Update profile
      await supabase.from('app_profiles').update({
        next_destination: country,
        next_destination_date: arrStr,
        next_destination_flag: flag,
        next_departure_date: depStr,
      }).eq('user_id', userId);

      // Join flight group (creates if doesn't exist)
      await joinFlightGroup(userId, country, flag, arrStr, depStr);

      // Save vibe & companion on flight_members
      if (tripVibe || tripCompanion) {
        const { data: fg } = await supabase.from('flight_groups').select('id').eq('country', country).maybeSingle();
        if (fg) {
          await supabase.from('flight_members')
            .update({ trip_vibe: tripVibe, trip_companion: tripCompanion })
            .eq('user_id', userId)
            .eq('flight_group_id', fg.id);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch (e) {
      console.error('Save trip error:', e);
    } finally {
      setSaving(false);
    }
  }, [userId, country, arrivalDate, departureDate, tripVibe, tripCompanion, onSaved, onClose]);

  // Remove trip
  const handleRemove = useCallback(() => {
    Alert.alert(
      'remove trip',
      `are you sure you want to remove your trip to ${existing?.country || country}?`,
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'remove',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setRemoving(true);
            try {
              // Clear trip from profile
              await supabase.from('app_profiles').update({
                next_destination: null,
                next_destination_date: null,
                next_destination_flag: null,
                next_departure_date: null,
              }).eq('user_id', userId);

              // Remove from flight_members (keeps group for others)
              await supabase
                .from('flight_members')
                .delete()
                .eq('user_id', userId);

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSaved();
              onClose();
            } catch (e) {
              console.error('Remove trip error:', e);
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  }, [userId, existing, country, onSaved, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={{ height: insets.top + s(20) }} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[st.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + s(10) }]}>
          {/* Handle */}
          <View style={st.handle} />

          {/* Header */}
          <View style={st.header}>
            <Text style={st.title}>{isEditing ? 'edit trip' : 'add a trip'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <NomadIcon name="close" size={s(7)} strokeWidth={1.6} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: s(10) }}>

            {/* ── Country picker ── */}
            <Text style={st.fieldLabel}>where to?</Text>
            {country ? (
              <View style={st.selectedRow}>
                <Text style={st.selectedFlag}>{COUNTRIES.find(c => c.name === country)?.flag}</Text>
                <Text style={st.selectedName}>{country}</Text>
                <TouchableOpacity onPress={() => { setCountry(''); setCountryQuery(''); setShowCountryList(true); }}>
                  <NomadIcon name="x-circle" size={s(7)} color={colors.textFaint} strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={st.inputWrap}>
                  <View style={{ position: 'absolute', left: s(10), zIndex: 1 }}>
                    <NomadIcon name="search" size={s(7)} color={colors.textFaint} strokeWidth={1.6} />
                  </View>
                  <TextInput
                    style={st.textInput}
                    placeholder="search country..."
                    placeholderTextColor={colors.textFaint}
                    value={countryQuery}
                    onChangeText={(txt) => { setCountryQuery(txt); setShowCountryList(true); }}
                    onFocus={() => setShowCountryList(true)}
                    autoCorrect={false}
                  />
                </View>
                {showCountryList && filteredCountries.length > 0 && (
                  <ScrollView style={st.acList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {filteredCountries.map((c) => (
                      <TouchableOpacity key={c.name} style={st.acItem}
                        onPress={() => { setCountry(c.name); setCountryQuery(''); setShowCountryList(false); }}>
                        <Text style={st.acFlag}>{c.flag}</Text>
                        <Text style={st.acName}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* ── Date pickers ── */}
            <View style={st.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>arrival</Text>
                <TouchableOpacity
                  style={st.dateBtn}
                  onPress={() => { setShowArrivalCal(true); setShowDepartureCal(false); setCalViewMonth(arrivalDate || new Date()); }}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="calendar" size={s(6)} color={colors.primary} strokeWidth={1.4} />
                  <Text style={[st.dateBtnText, !arrivalDate && { color: colors.textFaint }]}>
                    {arrivalDate ? formatDateDisplay(arrivalDate) : 'select date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: s(5) }} />
              <View style={{ flex: 1 }}>
                <Text style={st.fieldLabel}>departure</Text>
                <TouchableOpacity
                  style={st.dateBtn}
                  onPress={() => { setShowDepartureCal(true); setShowArrivalCal(false); setCalViewMonth(departureDate || arrivalDate || new Date()); }}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="calendar" size={s(6)} color={colors.primary} strokeWidth={1.4} />
                  <Text style={[st.dateBtnText, !departureDate && { color: colors.textFaint }]}>
                    {departureDate ? formatDateDisplay(departureDate) : 'optional'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Inline Calendar ── */}
            {(showArrivalCal || showDepartureCal) && (() => {
              const viewYear = calViewMonth.getFullYear();
              const viewMon = calViewMonth.getMonth();
              const firstDay = new Date(viewYear, viewMon, 1).getDay();
              const daysInMonth = new Date(viewYear, viewMon + 1, 0).getDate();
              const calDays: (number | null)[] = Array(firstDay).fill(null).concat(
                Array.from({ length: daysInMonth }, (_, i) => i + 1)
              );
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              return (
                <View style={st.calBox}>
                  <View style={st.calHeader}>
                    <TouchableOpacity onPress={() => setCalViewMonth(new Date(viewYear, viewMon - 1, 1))} style={st.calNavBtn}>
                      <NomadIcon name="back" size={s(8)} color={colors.dark} strokeWidth={1.6} />
                    </TouchableOpacity>
                    <Text style={st.calMonthLabel}>{MONTHS[viewMon]} {viewYear}</Text>
                    <TouchableOpacity onPress={() => setCalViewMonth(new Date(viewYear, viewMon + 1, 1))} style={st.calNavBtn}>
                      <NomadIcon name="forward" size={s(8)} color={colors.dark} strokeWidth={1.6} />
                    </TouchableOpacity>
                  </View>
                  <View style={st.calDayNames}>
                    {['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'].map(d => (
                      <Text key={d} style={st.calDayName}>{d}</Text>
                    ))}
                  </View>
                  <View style={st.calGrid}>
                    {calDays.map((day, i) => {
                      if (day === null) return <View key={`e${i}`} style={st.calCell} />;
                      const dateObj = new Date(viewYear, viewMon, day);
                      dateObj.setHours(0, 0, 0, 0);
                      const isPast = dateObj < today;
                      const isSelected = showArrivalCal
                        ? (arrivalDate && dateObj.getTime() === arrivalDate.getTime())
                        : (departureDate && dateObj.getTime() === departureDate.getTime());
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[st.calCell, isSelected && st.calCellSel]}
                          disabled={isPast}
                          onPress={() => {
                            if (showArrivalCal) {
                              setArrivalDate(dateObj);
                              setShowArrivalCal(false);
                            } else {
                              setDepartureDate(dateObj);
                              setShowDepartureCal(false);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            st.calDayText,
                            isPast && { color: '#ccc' },
                            isSelected && st.calDayTextSel,
                          ]}>{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* ── Vibe — "what's the vibe?" ── */}
            {country.length > 0 && (
              <>
                <Text style={st.fieldLabel}>what's the vibe?</Text>
                <View style={st.chipRow}>
                  {([
                    ['work', '🧳', 'work trip'],
                    ['adventure', '🏄', 'adventure'],
                    ['chill', '🍹', 'slow & chill'],
                    ['social', '👯', 'meet people'],
                    ['relocation', '🔄', 'trying it out'],
                  ] as const).map(([key, emoji, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[st.chip, tripVibe === key && st.chipSel]}
                      onPress={() => setTripVibe(tripVibe === key ? null : key)}
                      activeOpacity={0.7}
                    >
                      <Text style={st.chipEmoji}>{emoji}</Text>
                      <Text style={[st.chipLabel, tripVibe === key && st.chipLabelSel]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={st.fieldLabel}>who's coming?</Text>
                <View style={st.chipRow}>
                  {([
                    ['solo', '🙋', 'solo'],
                    ['partner', '👫', 'with partner'],
                    ['friends', '👥', 'with friends'],
                    ['not_sure', '🤷', 'not sure yet'],
                  ] as const).map(([key, emoji, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[st.chip, tripCompanion === key && st.chipSel]}
                      onPress={() => setTripCompanion(tripCompanion === key ? null : key)}
                      activeOpacity={0.7}
                    >
                      <Text style={st.chipEmoji}>{emoji}</Text>
                      <Text style={[st.chipLabel, tripCompanion === key && st.chipLabelSel]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ── Actions ── */}
            <View style={st.actions}>
              <TouchableOpacity
                style={[st.saveBtn, !canSave && { opacity: 0.4 }]}
                disabled={!canSave || saving}
                onPress={handleSave}
                activeOpacity={0.75}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={st.saveBtnText}>{isEditing ? 'save changes' : 'add trip'}</Text>
                )}
              </TouchableOpacity>

              {isEditing && (
                <TouchableOpacity
                  style={st.removeBtn}
                  onPress={handleRemove}
                  disabled={removing}
                  activeOpacity={0.7}
                >
                  {removing ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Text style={st.removeBtnText}>remove trip</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    flex: 1,
    backgroundColor: c.card,
    borderTopLeftRadius: s(12),
    borderTopRightRadius: s(12),
    paddingHorizontal: s(10),
    paddingTop: s(5),
  },
  handle: {
    width: s(18),
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: s(4),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: s(4),
    marginBottom: s(4),
  },
  title: {
    fontSize: s(10),
    fontWeight: FW.extra,
    color: c.dark,
  },

  /* Fields */
  fieldLabel: {
    fontSize: s(5.5),
    fontWeight: FW.semi,
    color: c.textSec,
    marginBottom: s(3),
    marginTop: s(6),
  },

  /* Selected country row */
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(6),
    paddingHorizontal: s(8),
    backgroundColor: c.successLight,
    borderRadius: s(10),
    borderWidth: 1.5,
    borderColor: c.success,
  },
  selectedFlag: { fontSize: s(10) },
  selectedName: { flex: 1, fontSize: s(7.5), fontWeight: FW.bold, color: c.dark },

  /* Search input */
  inputWrap: { position: 'relative' as const },
  textInput: {
    backgroundColor: c.card,
    borderRadius: s(12),
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    paddingVertical: s(6),
    paddingLeft: s(22),
    paddingRight: s(10),
    fontSize: s(7),
    color: c.dark,
  },
  acList: {
    maxHeight: s(60),
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: s(8),
    marginTop: s(2),
    backgroundColor: c.card,
  },
  acItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(5),
    paddingHorizontal: s(8),
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderSoft,
  },
  acFlag: { fontSize: s(8) },
  acName: { fontSize: s(6.5), fontWeight: FW.medium, color: c.dark },

  /* Date row */
  dateRow: {
    flexDirection: 'row',
    marginTop: s(4),
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    backgroundColor: c.card,
    borderRadius: s(10),
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    paddingVertical: s(5.5),
    paddingHorizontal: s(6),
  },
  dateBtnText: {
    fontSize: s(6),
    fontWeight: FW.medium,
    color: c.dark,
  },

  /* Calendar */
  calBox: {
    backgroundColor: c.bg,
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: s(6),
    marginTop: s(6),
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(4),
  },
  calNavBtn: { padding: s(2) },
  calMonthLabel: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: c.dark,
  },
  calDayNames: {
    flexDirection: 'row',
    marginBottom: s(2),
  },
  calDayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: s(4.5),
    fontWeight: FW.semi,
    color: c.textMuted,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellSel: {
    backgroundColor: c.primary,
    borderRadius: s(12),
  },
  calDayText: {
    fontSize: s(7),
    fontWeight: FW.semi,
    color: c.dark,
  },
  calDayTextSel: {
    color: 'white',
    fontWeight: FW.extra,
  },

  /* Actions */
  actions: {
    marginTop: s(10),
    gap: s(5),
  },
  saveBtn: {
    backgroundColor: c.primary,
    borderRadius: s(12),
    paddingVertical: s(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: 'white',
    fontSize: s(7),
    fontWeight: FW.bold,
  },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(5),
  },
  removeBtnText: {
    color: c.danger,
    fontSize: s(6),
    fontWeight: FW.semi,
  },

  /* Vibe & companion chips */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(3),
    marginBottom: s(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2.5),
    paddingVertical: s(4),
    paddingHorizontal: s(6),
    borderRadius: s(10),
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  chipSel: {
    backgroundColor: c.primaryLight,
    borderColor: c.primary,
  },
  chipEmoji: {
    fontSize: s(6.5),
  },
  chipLabel: {
    fontSize: s(5.5),
    fontWeight: FW.medium,
    color: c.textSec,
  },
  chipLabelSel: {
    color: c.primary,
    fontWeight: FW.bold,
  },
});
