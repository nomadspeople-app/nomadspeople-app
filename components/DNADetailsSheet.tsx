/**
 * DNADetailsSheet — Personal DNA questionnaire
 * Each question shows chip-style pre-built answers.
 * Saves to app_profiles.dna_details (JSONB).
 */
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useI18n } from '../lib/i18n';

/* ── Question definitions ── */
export interface DNAQuestion {
  key: string;           // e.g. 'education'
  titleKey: string;      // i18n key for title
  emoji: string;
  options: { labelKey: string; value: string; emoji?: string }[];
  multi?: boolean;       // allow multiple selections (default: single)
}

export const DNA_QUESTIONS: DNAQuestion[] = [
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
    key: 'zodiac', titleKey: 'dna.zodiac', emoji: '✨',
    options: [
      { labelKey: 'dna.zodiac.aries', value: 'aries', emoji: '♈' },
      { labelKey: 'dna.zodiac.taurus', value: 'taurus', emoji: '♉' },
      { labelKey: 'dna.zodiac.gemini', value: 'gemini', emoji: '♊' },
      { labelKey: 'dna.zodiac.cancer', value: 'cancer', emoji: '♋' },
      { labelKey: 'dna.zodiac.leo', value: 'leo', emoji: '♌' },
      { labelKey: 'dna.zodiac.virgo', value: 'virgo', emoji: '♍' },
      { labelKey: 'dna.zodiac.libra', value: 'libra', emoji: '♎' },
      { labelKey: 'dna.zodiac.scorpio', value: 'scorpio', emoji: '♏' },
      { labelKey: 'dna.zodiac.sagittarius', value: 'sagittarius', emoji: '♐' },
      { labelKey: 'dna.zodiac.capricorn', value: 'capricorn', emoji: '♑' },
      { labelKey: 'dna.zodiac.aquarius', value: 'aquarius', emoji: '♒' },
      { labelKey: 'dna.zodiac.pisces', value: 'pisces', emoji: '♓' },
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

/* ── Types ── */
export type DNADetails = Record<string, string | string[]>;

interface Props {
  visible: boolean;
  onClose: () => void;
  initialData: DNADetails;
  onSave: (data: DNADetails) => void;
}

/* ── Component ── */
export default function DNADetailsSheet({ visible, onClose, initialData, onSave }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<DNADetails>({});

  useEffect(() => {
    if (visible) setAnswers({ ...initialData });
  }, [visible]);

  const handleSelect = (q: DNAQuestion, value: string) => {
    setAnswers((prev) => {
      if (q.multi) {
        const current = (prev[q.key] as string[]) || [];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [q.key]: next };
      }
      // single select — toggle off if already selected
      return { ...prev, [q.key]: prev[q.key] === value ? '' : value };
    });
  };

  const isSelected = (q: DNAQuestion, value: string): boolean => {
    if (q.multi) return ((answers[q.key] as string[]) || []).includes(value);
    return answers[q.key] === value;
  };

  const handleSave = () => {
    onSave(answers);
    onClose();
  };

  const answeredCount = DNA_QUESTIONS.filter((q) => {
    const v = answers[q.key];
    return q.multi ? (v as string[] || []).length > 0 : !!v;
  }).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[st.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <NomadIcon name="close" size={s(10)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
          <Text style={st.headerTitle}>{t('dna.title')}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={st.saveBtn}>{t('dna.save')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={st.subtitle}>{t('dna.subtitle')}</Text>
        <Text style={st.progress}>{answeredCount}/{DNA_QUESTIONS.length}</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + s(20) }}>
          {DNA_QUESTIONS.map((q) => (
            <View key={q.key} style={st.questionBlock}>
              <Text style={st.questionTitle}>
                {q.emoji}  {t(q.titleKey)}
              </Text>
              <View style={st.chipWrap}>
                {q.options.map((opt) => {
                  const selected = isSelected(q, opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[st.chip, selected && st.chipSelected]}
                      onPress={() => handleSelect(q, opt.value)}
                      activeOpacity={0.7}
                    >
                      {opt.emoji && <Text style={st.chipEmoji}>{opt.emoji}</Text>}
                      <Text style={[st.chipLabel, selected && st.chipLabelSelected]}>
                        {t(opt.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Styles ── */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(10), paddingVertical: s(6),
  },
  headerTitle: { fontSize: s(9), fontWeight: FW.extra, color: c.dark },
  saveBtn: { fontSize: s(7), fontWeight: FW.bold, color: c.primary },
  subtitle: {
    fontSize: s(6), color: c.textMuted, textAlign: 'center',
    paddingHorizontal: s(14), marginBottom: s(2),
  },
  progress: {
    fontSize: s(5.5), color: c.textFaint, textAlign: 'center',
    marginBottom: s(8),
  },
  questionBlock: {
    paddingHorizontal: s(10), marginBottom: s(12),
  },
  questionTitle: {
    fontSize: s(7), fontWeight: FW.bold, color: c.dark,
    marginBottom: s(5),
  },
  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: s(3.5),
  },
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
  chipEmoji: { fontSize: s(6), marginRight: s(2) },
  chipLabel: { fontSize: s(6), color: c.dark, fontWeight: FW.medium },
  chipLabelSelected: { color: c.primary, fontWeight: FW.bold },
});
