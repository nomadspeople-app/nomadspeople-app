import { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList } from '../lib/types';
import {
  TERMS, PRIVACY, GUIDELINES, SAFETY,
  type LegalDocument, type LegalSection, type LegalBlock,
} from '../lib/legal/content';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Legal'>;
type Route = RouteProp<RootStackParamList, 'Legal'>;

const TABS = [
  { key: 'terms' as const, label: 'Terms', icon: 'file-text' as const },
  { key: 'privacy' as const, label: 'Privacy', icon: 'lock' as const },
  { key: 'guidelines' as const, label: 'Guidelines', icon: 'users' as const },
  { key: 'safety' as const, label: 'Safety', icon: 'alert' as const },
];

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const initialType = route.params?.type || 'terms';
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'guidelines' | 'safety'>(initialType);
  const scrollRef = useRef<ScrollView>(null);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Header with back button */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={[styles.backBtn, { backgroundColor: colors.bg }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <NomadIcon name="back" size={s(9)} color={colors.text} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Legal & Safety</Text>
        <View style={{ width: s(18) }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
              ]}
              onPress={() => handleTabChange(tab.key)}
            >
              <NomadIcon
                name={tab.icon as any}
                size={s(6)}
                color={isActive ? colors.accent : colors.textMuted}
                strokeWidth={1.6}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.accent : colors.textMuted },
                  isActive && { fontWeight: FW.bold },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + s(20) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Data-driven render — each tab pulls its document
             from lib/legal/content (the canonical source the
             marketing website also reads from). Keeps app
             and web wording identical. */}
        {activeTab === 'terms' && <DocumentRenderer doc={TERMS} colors={colors} />}
        {activeTab === 'privacy' && <DocumentRenderer doc={PRIVACY} colors={colors} />}
        {activeTab === 'guidelines' && <DocumentRenderer doc={GUIDELINES} colors={colors} />}
        {activeTab === 'safety' && <DocumentRenderer doc={SAFETY} colors={colors} />}
      </ScrollView>
    </View>
  );
}

/* DocumentRenderer — renders any LegalDocument from the
   canonical content module. Same shape, same look, every
   document. Keeps a single visual layer for all 4 tabs. */
function DocumentRenderer({ doc, colors }: { doc: LegalDocument; colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ paddingHorizontal: s(12) }}>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{doc.meta}</Text>
      {doc.sections.map((section: LegalSection, i: number) => (
        <Section key={i} title={section.title} colors={colors}>
          {section.body.map((block: LegalBlock, j: number) =>
            block.kind === 'paragraph'
              ? <Paragraph key={j} text={block.text} colors={colors} />
              : <List key={j} items={block.items} colors={colors} />
          )}
        </Section>
      ))}
    </View>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

function Paragraph({ text, colors }: { text: string; colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.paragraph, { color: colors.text }]}>{text}</Text>;
}

function List({ items, colors }: { items: string[]; colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View>
      {items.map((item, idx) => (
        <View key={idx} style={styles.listItem}>
          <Text style={[styles.bullet, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.listItemText, { color: colors.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}


const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: s(4),
    paddingBottom: s(4),
    paddingHorizontal: s(8),
    borderBottomWidth: 0.5,
  },

  backBtn: {
    width: s(18),
    height: s(18),
    borderRadius: s(9),
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: s(8),
    fontWeight: FW.bold,
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    paddingHorizontal: s(4),
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(5),
    gap: s(1.5),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabLabel: {
    fontSize: s(4.5),
    fontWeight: FW.medium,
  },

  scroll: {
    flex: 1,
  },

  meta: {
    fontSize: s(4.5),
    marginTop: s(8),
    marginBottom: s(8),
    fontWeight: FW.medium,
  },

  section: {
    marginBottom: s(14),
  },

  sectionTitle: {
    fontSize: s(7),
    fontWeight: FW.bold,
    marginBottom: s(6),
  },

  paragraph: {
    fontSize: s(5.5),
    lineHeight: s(9),
    marginBottom: s(6),
  },

  listItem: {
    flexDirection: 'row',
    marginBottom: s(5),
  },

  bullet: {
    fontSize: s(6),
    marginRight: s(4),
    fontWeight: FW.bold,
  },

  listItemText: {
    fontSize: s(5.5),
    lineHeight: s(8),
    flex: 1,
  },
});
