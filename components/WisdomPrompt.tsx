/**
 * פניני חוכמה — WisdomPrompt
 *
 * Smart dialog that appears when a user tries to join a status/timer
 * in a city far from their current location.
 *
 * Instead of blocking — it asks a smart question and learns.
 */
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
} from 'react-native';
import { useRef, useEffect } from 'react';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { WisdomIntent } from '../lib/hooks';

interface Props {
  visible: boolean;
  cityName: string;
  distanceKm: number;
  distanceUnit?: 'km' | 'mi';
  existingIntent: WisdomIntent | null;
  onResponse: (intent: WisdomIntent) => void;
  onCancel: () => void;
}

export default function WisdomPrompt({
  visible, cityName, distanceKm, distanceUnit = 'km', existingIntent, onResponse, onCancel,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const distVal = distanceUnit === 'mi' ? distanceKm * 0.621371 : distanceKm;
  const unit = distanceUnit === 'mi' ? 'mi' : 'km';
  const distText = distVal >= 1000
    ? `${(distVal / 1000).toFixed(1)}K ${unit}`
    : `${Math.round(distVal)} ${unit}`;

  // If they said "just_looking" or "planning" before, softer message
  const isSoftRepeat = existingIntent === 'just_looking' || existingIntent === 'planning';

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
    <Animated.View style={[st.overlay, { opacity: opacityAnim }]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onCancel} />

      <Animated.View style={[st.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Top icon */}
        <View style={st.iconCircle}>
          <NomadIcon name="compass" size={s(12)} color={colors.accent} strokeWidth={1.6} />
        </View>

        {/* Title */}
        <Text style={st.title}>
          {isSoftRepeat ? `Still thinking about ${cityName}?` : `You're far from ${cityName}`}
        </Text>

        {/* Subtitle — the smart observation */}
        <Text style={st.subtitle}>
          {isSoftRepeat
            ? `Last time you said you were ${existingIntent === 'planning' ? 'planning a trip' : 'just browsing'}. Changed your plans?`
            : `You're ${distText} away and we don't see a flight planned. What's up?`
          }
        </Text>

        {/* Option buttons */}
        <View style={st.options}>
          {/* Flying soon */}
          <TouchableOpacity
            style={st.optionBtn}
            activeOpacity={0.8}
            onPress={() => onResponse('flying_soon')}
          >
            <View style={[st.optionIcon, { backgroundColor: 'rgba(42,157,143,0.12)' }]}>
              <NomadIcon name="airplane" size={s(8)} color={colors.accent} strokeWidth={1.6} />
            </View>
            <View style={st.optionText}>
              <Text style={st.optionTitle}>Boarding soon</Text>
              <Text style={st.optionSub}>I'm flying there</Text>
            </View>
          </TouchableOpacity>

          {/* Planning */}
          <TouchableOpacity
            style={st.optionBtn}
            activeOpacity={0.8}
            onPress={() => onResponse('planning')}
          >
            <View style={[st.optionIcon, { backgroundColor: 'rgba(232,97,77,0.12)' }]}>
              <NomadIcon name="calendar" size={s(8)} color={colors.primary} strokeWidth={1.6} />
            </View>
            <View style={st.optionText}>
              <Text style={st.optionTitle}>Planning a trip</Text>
              <Text style={st.optionSub}>Want to connect ahead</Text>
            </View>
          </TouchableOpacity>

          {/* Just looking */}
          <TouchableOpacity
            style={st.optionBtn}
            activeOpacity={0.8}
            onPress={() => onResponse('just_looking')}
          >
            <View style={[st.optionIcon, { backgroundColor: 'rgba(0,0,0,0.06)' }]}>
              <NomadIcon name="eye" size={s(8)} color={colors.textSec} strokeWidth={1.6} />
            </View>
            <View style={st.optionText}>
              <Text style={st.optionTitle}>Just exploring</Text>
              <Text style={st.optionSub}>Curious about the scene</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Cancel */}
        <TouchableOpacity style={st.cancelBtn} onPress={onCancel}>
          <Text style={st.cancelText}>Not now</Text>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity style={{ flex: 0.3 }} activeOpacity={1} onPress={onCancel} />
    </Animated.View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: s(12),
  },
  card: {
    backgroundColor: c.card,
    borderRadius: s(14),
    paddingTop: s(14),
    paddingBottom: s(8),
    paddingHorizontal: s(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },

  iconCircle: {
    width: s(26), height: s(26), borderRadius: s(13),
    backgroundColor: 'rgba(42,157,143,0.1)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: s(6),
  },

  title: {
    fontSize: s(8.5),
    fontWeight: FW.extra,
    color: c.dark,
    textAlign: 'center',
    marginBottom: s(3),
  },
  subtitle: {
    fontSize: s(5.5),
    fontWeight: FW.medium,
    color: c.textSec,
    textAlign: 'center',
    lineHeight: s(8),
    marginBottom: s(8),
    paddingHorizontal: s(4),
  },

  options: {
    gap: s(3),
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(5),
    paddingHorizontal: s(5),
    borderRadius: s(10),
    backgroundColor: c.surface,
  },
  optionIcon: {
    width: s(18), height: s(18), borderRadius: s(9),
    alignItems: 'center', justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: s(6.5), fontWeight: FW.bold, color: c.dark,
  },
  optionSub: {
    fontSize: s(5), fontWeight: FW.regular, color: c.textMuted, marginTop: s(0.5),
  },

  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    marginTop: s(3),
  },
  cancelText: {
    fontSize: s(5.5), fontWeight: FW.medium, color: c.textMuted,
  },
});
