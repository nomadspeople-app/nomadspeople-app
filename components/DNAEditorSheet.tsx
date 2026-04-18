/**
 * DNAEditorSheet — Unified DNA editor
 * Combines nomad type, interests, looking for, about-me details,
 * and featured profile tags into ONE clean modal.
 *
 * Zodiac is intentionally omitted — derived from birth_date.
 */
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useI18n } from '../lib/i18n';

/* ═══════════════════════════════════════════
   DATA DEFINITIONS
   ═══════════════════════════════════════════ */

const NOMAD_TYPES = [
  { emoji: '💻', label: 'Digital Nomad' },
  { emoji: '🏠', label: 'Remote Worker' },
  { emoji: '🚀', label: 'Startup Founder' },
  { emoji: '✍️', label: 'Freelancer' },
  { emoji: '🌍', label: 'Expat' },
  { emoji: '🎒', label: 'Traveler' },
];

const INTERESTS = [
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

const LOOKING_FOR = [
  { emoji: '👋', label: 'Friends' },
  { emoji: '🧳', label: 'Travel Buddies' },
  { emoji: '💼', label: 'Work Partners' },
  { emoji: '❤️', label: 'Dating' },
  { emoji: '🏠', label: 'Roommates' },
];

/** About-me question definitions (no zodiac) */
interface AboutQuestion {
  key: string;
  titleKey: string;
  emoji: string;
  options: { labelKey: string; value: string; emoji?: string }[];
  multi?: boolean;
}

const ABOUT_QUESTIONS: AboutQuestion[] = [
  {
    key: 'education', titleKey: 'dna.education', emoji: '🎓',
    options: [
      { labelKey: 'dna.education.highSchool', value: 'high_school' },
      { labelKey: 'dna.education.inUniversity', value: 'in_university' },
      { labelKey: 'dna.education.bachelors', value: 'bachelors' },
      { labelKey: 'dna.education.masters', value: 'masters' },
      { labelKey: 'dna.education.postGrad', value: 'post_grad' },
      { labelKey: 'dna.education.phd', value: 'phd' },
      { labelKey: 'dna.education.vocational', value: 'vocational' },
    ],
  },
  {
    key: 'family', titleKey: 'dna.family', emoji: '👶',
    options: [
      { labelKey: 'dna.family.wantKids', value: 'want_kids' },
      { labelKey: 'dna.family.dontWant', value: 'dont_want' },
      { labelKey: 'dna.family.haveKids', value: 'have_kids' },
      { labelKey: 'dna.family.notSure', value: 'not_sure' },
      { labelKey: 'dna.family.openToIt', value: 'open_to_it' },
    ],
  },
  {
    key: 'communication', titleKey: 'dna.communication', emoji: '💬',
    multi: true,
    options: [
      { labelKey: 'dna.communication.direct', value: 'direct' },
      { labelKey: 'dna.communication.humorous', value: 'humorous' },
      { labelKey: 'dna.communication.sarcastic', value: 'sarcastic' },
      { labelKey: 'dna.communication.emotional', value: 'emotional' },
      { labelKey: 'dna.communication.listener', value: 'listener' },
      { labelKey: 'dna.communication.deep', value: 'deep' },
    ],
  },
  {
    key: 'pets', titleKey: 'dna.pets', emoji: '🐾',
    options: [
      { labelKey: 'dna.pets.dog', value: 'dog', emoji: '🐕' },
      { labelKey: 'dna.pets.cat', value: 'cat', emoji: '🐈' },
      { labelKey: 'dna.pets.both', value: 'both', emoji: '🐾' },
      { labelKey: 'dna.pets.none', value: 'none' },
      { labelKey: 'dna.pets.allergic', value: 'allergic' },
      { labelKey: 'dna.pets.loveAll', value: 'love_all', emoji: '❤️' },
    ],
  },
  {
    key: 'alcohol', titleKey: 'dna.alcohol', emoji: '🍷',
    options: [
      { labelKey: 'dna.alcohol.never', value: 'never' },
      { labelKey: 'dna.alcohol.social', value: 'social' },
      { labelKey: 'dna.alcohol.regular', value: 'regular' },
      { labelKey: 'dna.alcohol.sober', value: 'sober' },
    ],
  },
  {
    key: 'smoking', titleKey: 'dna.smoking', emoji: '🚬',
    options: [
      { labelKey: 'dna.smoking.never', value: 'never' },
      { labelKey: 'dna.smoking.social', value: 'social' },
      { labelKey: 'dna.smoking.regular', value: 'regular' },
    ],
  },
  {
    key: 'loveLanguage', titleKey: 'dna.loveLanguage', emoji: '❤️',
    options: [
      { labelKey: 'dna.loveLanguage.touch', value: 'touch' },
      { labelKey: 'dna.loveLanguage.quality', value: 'quality_time' },
      { labelKey: 'dna.loveLanguage.words', value: 'words' },
      { labelKey: 'dna.loveLanguage.gifts', value: 'gifts' },
      { labelKey: 'dna.loveLanguage.acts', value: 'acts' },
    ],
  },
];

/* All tag-able items for "featured on profile" */
const ALL_TAG_OPTIONS: { emoji: string; label: string }[] = [
  ...NOMAD_TYPES,
  ...INTERESTS.flatMap(g => g.items),
  ...LOOKING_FOR,
];

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
export type DNADetails = Record<string, string | string[]>;

export interface DNAEditorData {
  nomadType: string;
  interests: string[];
  lookingFor: string[];
  featuredTags: string[];
  details: DNADetails;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initial: DNAEditorData;
  onSave: (data: DNAEditorData) => void;
}

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
export default function DNAEditorSheet({ visible, onClose, initial, onSave }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // Local state
  const [nomadType, setNomadType] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [featuredTags, setFeaturedTags] = useState<string[]>([]);
  const [details, setDetails] = useState<DNADetails>({});

  // Sync from initial when opened
  useEffect(() => {
    if (visible) {
      setNomadType(initial.nomadType);
      setInterests([...initial.interests]);
      setLookingFor([...initial.lookingFor]);
      setFeaturedTags([...initial.featuredTags]);
      setDetails({ ...initial.details });
    }
  }, [visible]);

  /* ── Toggle helpers ── */
  const toggleInterest = (label: string) => {
    setInterests(prev =>
      prev.includes(label)
        ? prev.filter(i => i !== label)
        : prev.length < 10 ? [...prev, label] : prev
    );
  };

  const toggleLooking = (label: string) => {
    setLookingFor(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const toggleFeatured = (label: string) => {
    setFeaturedTags(prev =>
      prev.includes(label)
        ? prev.filter(t => t !== label)
        : prev.length < 4 ? [...prev, label] : prev
    );
  };

  const handleDetailSelect = (q: AboutQuestion, value: string) => {
    setDetails(prev => {
      if (q.multi) {
        const current = (prev[q.key] as string[]) || [];
        const next = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        return { ...prev, [q.key]: next };
      }
      return { ...prev, [q.key]: prev[q.key] === value ? '' : value };
    });
  };

  const isDetailSelected = (q: AboutQuestion, value: string): boolean => {
    if (q.multi) return ((details[q.key] as string[]) || []).includes(value);
    return details[q.key] === value;
  };

  /* ── Save ── */
  const handleSave = () => {
    onSave({ nomadType, interests, lookingFor, featuredTags, details });
    onClose();
  };

  /* ── Featured candidates = all selected items ── */
  const allSelected = [...interests, ...lookingFor, nomadType].filter(Boolean);

  /* ── Chip component ── */
  const Chip = ({ emoji, label, selected, onPress }: {
    emoji?: string; label: string; selected: boolean; onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[st.chip, selected && st.chipSelected]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {emoji ? <Text style={st.chipEmoji}>{emoji}</Text> : null}
      <Text style={[st.chipLabel, selected && st.chipLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[st.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <NomadIcon name="close" size={s(10)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
          <Text style={st.headerTitle}>{t('dna.editDna')}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={st.saveBtn}>{t('dna.save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + s(20) }}>

          {/* ─── Section 1: I am a... ─── */}
          <Text style={st.sectionTitle}>{t('dna.iAmA')}</Text>
          <View style={st.sectionBody}>
            <View style={st.chipWrap}>
              {NOMAD_TYPES.map(item => (
                <Chip
                  key={item.label}
                  emoji={item.emoji}
                  label={item.label}
                  selected={nomadType === item.label}
                  onPress={() => setNomadType(nomadType === item.label ? '' : item.label)}
                />
              ))}
            </View>
          </View>

          {/* ─── Section 2: Interests ─── */}
          <Text style={st.sectionTitle}>
            {t('dna.interests')} <Text style={st.sectionCount}>({interests.length}/10)</Text>
          </Text>
          <View style={st.sectionBody}>
            {INTERESTS.map(group => (
              <View key={group.cat}>
                <Text style={st.catLabel}>{group.cat}</Text>
                <View style={st.chipWrap}>
                  {group.items.map(item => (
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
          </View>

          {/* ─── Section 3: Looking for ─── */}
          <Text style={st.sectionTitle}>{t('dna.lookingFor')}</Text>
          <View style={st.sectionBody}>
            <View style={st.chipWrap}>
              {LOOKING_FOR.map(item => (
                <Chip
                  key={item.label}
                  emoji={item.emoji}
                  label={item.label}
                  selected={lookingFor.includes(item.label)}
                  onPress={() => toggleLooking(item.label)}
                />
              ))}
            </View>
          </View>

          {/* ─── Section 4: About me ─── */}
          <Text style={st.sectionTitle}>{t('dna.aboutMe')}</Text>
          <View style={st.sectionBody}>
            {ABOUT_QUESTIONS.map(q => (
              <View key={q.key} style={st.questionBlock}>
                <Text style={st.questionTitle}>{q.emoji}  {t(q.titleKey)}</Text>
                <View style={st.chipWrap}>
                  {q.options.map(opt => (
                    <Chip
                      key={opt.value}
                      emoji={opt.emoji}
                      label={t(opt.labelKey)}
                      selected={isDetailSelected(q, opt.value)}
                      onPress={() => handleDetailSelect(q, opt.value)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* ─── Section 5: Featured on profile ─── */}
          <Text style={st.sectionTitle}>
            {t('dna.featuredOnProfile')} <Text style={st.sectionCount}>({featuredTags.length}/4)</Text>
          </Text>
          <View style={st.sectionBody}>
            <Text style={st.hint}>{t('dna.featuredHint')}</Text>
            <View style={st.chipWrap}>
              {allSelected.map(label => {
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
                <Text style={st.emptyHint}>{t('dna.featuredEmpty')}</Text>
              )}
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(10), paddingVertical: s(6),
    backgroundColor: c.card, borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  headerTitle: { fontSize: s(9), fontWeight: FW.extra, color: c.dark },
  saveBtn: { fontSize: s(7.5), fontWeight: FW.bold, color: c.primary },

  /* Section titles — pill-style dividers */
  sectionTitle: {
    fontSize: s(7.5), fontWeight: FW.bold, color: c.dark,
    paddingHorizontal: s(10), paddingTop: s(12), paddingBottom: s(2),
  },
  sectionCount: { fontSize: s(6), fontWeight: FW.medium, color: c.textMuted },

  sectionBody: {
    paddingHorizontal: s(10), paddingTop: s(4), paddingBottom: s(4),
  },

  catLabel: {
    fontSize: s(5.5), fontWeight: FW.bold, color: c.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: s(5), marginBottom: s(3),
  },

  /* About-me question blocks */
  questionBlock: { marginBottom: s(10) },
  questionTitle: {
    fontSize: s(6.5), fontWeight: FW.bold, color: c.dark,
    marginBottom: s(4),
  },

  hint: {
    fontSize: s(6), color: c.textMuted, marginBottom: s(5), lineHeight: s(9),
  },
  emptyHint: {
    fontSize: s(6), color: c.textFaint, fontStyle: 'italic', padding: s(4),
  },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: s(3.5) },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(6), paddingVertical: s(4),
    borderRadius: s(10), backgroundColor: c.pill,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: c.primary + '18',
    borderColor: c.primary,
  },
  chipEmoji: { fontSize: s(6.5), marginRight: s(2) },
  chipLabel: { fontSize: s(6), color: c.dark, fontWeight: FW.medium },
  chipLabelSelected: { color: c.primary, fontWeight: FW.bold },
});
