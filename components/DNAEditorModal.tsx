/**
 * DNAEditorModal — extracted out of SettingsScreen (2026-04-20)
 *
 * Why this lives in its own file:
 *   When this modal was defined as a NESTED function inside the
 *   SettingsScreen component body, every `setInterests` /
 *   `setLookingFor` / etc. caused SettingsScreen to re-render,
 *   which re-created the DNAEditorModal function identity, which
 *   React interpreted as "brand new component" and fully unmounted
 *   + remounted the modal subtree on every chip tap. Result: the
 *   ScrollView snapped back to the top on every selection. Users
 *   reported the screen "jumping" — there was no escape.
 *
 *   Moving the component to module scope gives it a stable
 *   function identity, so React keeps the modal subtree mounted
 *   while only the props change. The scroll position survives.
 *
 *   Same fix logic applies to <Chip/> (also nested inside
 *   SettingsScreen) — extracted alongside it here. They live as a
 *   pair anyway.
 *
 * Why this is NOT the existing DNAEditorSheet:
 *   `components/DNAEditorSheet.tsx` is an unused alternative
 *   implementation that ALSO supports an "About Me" details
 *   section. Adopting it is a bigger migration with its own QA
 *   surface, so we leave that for a dedicated cleanup pass and
 *   only do the minimal extraction here.
 */
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useMemo } from 'react';

/* ═══════════════════════════════════════════
   DNA constants — moved here from SettingsScreen
   so the modal is self-contained. SettingsScreen
   no longer needs to know what NOMAD_TYPES is —
   it just hands state down to this modal.
   ═══════════════════════════════════════════ */

export const NOMAD_TYPES = [
  { emoji: '💻', label: 'Digital Nomad' },
  { emoji: '🏠', label: 'Remote Worker' },
  { emoji: '🚀', label: 'Startup Founder' },
  { emoji: '✍️', label: 'Freelancer' },
  { emoji: '🌍', label: 'Expat' },
  { emoji: '🎒', label: 'Traveler' },
];

export const INTERESTS = [
  { cat: 'work & productivity', items: [
    { emoji: '💻', label: 'Co-working' }, { emoji: '☕', label: 'Cafe Work' },
    { emoji: '📡', label: 'Fast WiFi' }, { emoji: '🤝', label: 'Networking' },
  ]},
  { cat: 'social & nightlife', items: [
    { emoji: '🍻', label: 'Nightlife' }, { emoji: '🎉', label: 'Events' },
    { emoji: '🍽️', label: 'Food & Drinks' }, { emoji: '💬', label: 'Meetups' },
  ]},
  { cat: 'outdoor & active', items: [
    { emoji: '🏄', label: 'Surfing' }, { emoji: '🥾', label: 'Hiking' },
    { emoji: '🚴', label: 'Cycling' }, { emoji: '🧘', label: 'Yoga' },
  ]},
  { cat: 'lifestyle', items: [
    { emoji: '📸', label: 'Photography' }, { emoji: '🎵', label: 'Music' },
    { emoji: '📚', label: 'Reading' }, { emoji: '🌱', label: 'Wellness' },
  ]},
];

export const LOOKING_FOR = [
  { emoji: '👋', label: 'Friends' },
  { emoji: '🧳', label: 'Travel Buddies' },
  { emoji: '💼', label: 'Work Partners' },
  { emoji: '❤️', label: 'Dating' },
  { emoji: '🏠', label: 'Roommates' },
];

/* All selectable items for "featured tags" — flat list from
   interests + looking_for + nomad types */
export const ALL_TAG_OPTIONS: { emoji: string; label: string }[] = [
  ...NOMAD_TYPES,
  ...INTERESTS.flatMap(g => g.items),
  ...LOOKING_FOR,
];

/* ═══════════════════════════════════════════
   Chip — small selectable pill. Top-level so its
   identity stays stable across parent re-renders.
   ═══════════════════════════════════════════ */

function Chip({
  emoji, label, selected, onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ═══════════════════════════════════════════
   DNAEditorModal — the page-sheet that lets a
   user edit their nomad type + interests +
   looking-for + featured-tags.
   ═══════════════════════════════════════════ */

interface Props {
  visible: boolean;
  onClose: () => void;
  nomadType: string;
  setNomadType: (v: string) => void;
  interests: string[];
  setInterests: (v: string[]) => void;
  lookingFor: string[];
  setLookingFor: (v: string[]) => void;
  featuredTags: string[];
  setFeaturedTags: (v: string[]) => void;
  onSave: () => void;
}

export default function DNAEditorModal({
  visible, onClose,
  nomadType, setNomadType,
  interests, setInterests,
  lookingFor, setLookingFor,
  featuredTags, setFeaturedTags,
  onSave,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const toggleInterest = (label: string) => {
    setInterests(
      interests.includes(label)
        ? interests.filter(i => i !== label)
        : interests.length < 10 ? [...interests, label] : interests
    );
  };

  const toggleLooking = (label: string) => {
    setLookingFor(
      lookingFor.includes(label)
        ? lookingFor.filter(i => i !== label)
        : [...lookingFor, label]
    );
  };

  const toggleFeatured = (label: string) => {
    setFeaturedTags(
      featuredTags.includes(label)
        ? featuredTags.filter(t => t !== label)
        : featuredTags.length < 4 ? [...featuredTags, label] : featuredTags
    );
  };

  const allSelected = [...interests, ...lookingFor, nomadType].filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.dnaRoot, { paddingTop: insets.top }]}>
        <View style={styles.dnaHeader}>
          <TouchableOpacity onPress={onClose}>
            <NomadIcon name="close" size={s(10)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
          <Text style={styles.dnaTitle}>Edit Your DNA</Text>
          <TouchableOpacity onPress={onSave}>
            <Text style={styles.dnaSaveBtn}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.dnaScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.dnaSection}>I am a...</Text>
          <View style={styles.chipWrap}>
            {NOMAD_TYPES.map((t) => (
              <Chip
                key={t.label}
                emoji={t.emoji}
                label={t.label}
                selected={nomadType === t.label}
                onPress={() => setNomadType(nomadType === t.label ? '' : t.label)}
              />
            ))}
          </View>

          <Text style={styles.dnaSection}>
            Interests <Text style={styles.dnaSectionSub}>({interests.length}/10)</Text>
          </Text>
          {INTERESTS.map((group) => (
            <View key={group.cat}>
              <Text style={styles.dnaCatLabel}>{group.cat}</Text>
              <View style={styles.chipWrap}>
                {group.items.map((item) => (
                  <Chip
                    key={item.label}
                    emoji={item.emoji}
                    label={item.label}
                    selected={interests.includes(item.label)}
                    onPress={() => toggleInterest(item.label)}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.dnaSection}>Looking for</Text>
          <View style={styles.chipWrap}>
            {LOOKING_FOR.map((item) => (
              <Chip
                key={item.label}
                emoji={item.emoji}
                label={item.label}
                selected={lookingFor.includes(item.label)}
                onPress={() => toggleLooking(item.label)}
              />
            ))}
          </View>

          <Text style={styles.dnaSection}>
            Featured on Profile <Text style={styles.dnaSectionSub}>({featuredTags.length}/4)</Text>
          </Text>
          <Text style={styles.dnaFeaturedHint}>
            Choose up to 4 items to display on your profile so people know what you're about
          </Text>
          <View style={styles.chipWrap}>
            {allSelected.map((label) => {
              const found = ALL_TAG_OPTIONS.find(o => o.label === label);
              if (!found) return null;
              return (
                <Chip
                  key={found.label}
                  emoji={found.emoji}
                  label={found.label}
                  selected={featuredTags.includes(found.label)}
                  onPress={() => toggleFeatured(found.label)}
                />
              );
            })}
            {allSelected.length === 0 && (
              <Text style={styles.dnaEmptyHint}>
                Select interests & looking for above first
              </Text>
            )}
          </View>

          <View style={{ height: insets.bottom + s(20) }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  dnaRoot: { flex: 1, backgroundColor: c.bg },
  dnaHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(10), paddingVertical: s(6),
    backgroundColor: c.card, borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  dnaTitle: { fontSize: s(9), fontWeight: FW.bold, color: c.dark },
  dnaSaveBtn: { fontSize: s(7.5), fontWeight: FW.bold, color: c.primary },
  dnaScroll: { flex: 1, padding: s(10) },
  dnaSection: {
    fontSize: s(8), fontWeight: FW.bold, color: c.dark,
    marginTop: s(10), marginBottom: s(4),
  },
  dnaSectionSub: { fontSize: s(6), fontWeight: FW.medium, color: c.textMuted },
  dnaCatLabel: {
    fontSize: s(5.5), fontWeight: FW.bold, color: c.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: s(5), marginBottom: s(3),
  },
  dnaFeaturedHint: {
    fontSize: s(6), color: c.textMuted, marginBottom: s(5), lineHeight: s(9),
  },
  dnaEmptyHint: {
    fontSize: s(6), color: c.textFaint, fontStyle: 'italic', padding: s(4),
  },

  /* Chip */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: s(3) },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    paddingVertical: s(3.5), paddingHorizontal: s(6),
    borderRadius: s(10), backgroundColor: c.card,
    borderWidth: 1.5, borderColor: c.borderSoft,
  },
  chipSelected: {
    borderColor: c.primary, backgroundColor: c.dangerSurface,
  },
  chipEmoji: { fontSize: s(7) },
  chipLabel: { fontSize: s(6), fontWeight: FW.medium, color: c.dark },
  chipLabelSelected: { color: c.primary, fontWeight: FW.bold },
});
