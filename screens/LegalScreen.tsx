import { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList } from '../lib/types';

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
        {activeTab === 'terms' && <TermsContent colors={colors} />}
        {activeTab === 'privacy' && <PrivacyContent colors={colors} />}
        {activeTab === 'guidelines' && <GuidelinesContent colors={colors} />}
        {activeTab === 'safety' && <SafetyContent colors={colors} />}
      </ScrollView>
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

/* TERMS OF SERVICE */
function TermsContent({ colors }: { colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ paddingHorizontal: s(12) }}>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        NomadsPeople • nomadspeople1@gmail.com • Effective April 5, 2026
      </Text>

      <Section title="Welcome to NomadsPeople" colors={colors}>
        <Paragraph
          text="NomadsPeople is a platform that connects digital nomads and expats in your neighborhood. By using our app, you are agreeing to these terms. We built this for nomads by nomads, so we keep it real, respectful, and safe."
          colors={colors}
        />
      </Section>

      <Section title="Who Can Use This" colors={colors}>
        <List
          items={[
            'You must be at least 18 years old',
            'You agree to use your real name or authentic nickname and real photo',
            'One person, one account only',
            'No impersonation, bots, or fake profiles',
            'You can only use this if you agree to follow our guidelines',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Your Account & Responsibilities" colors={colors}>
        <Paragraph
          text="You are responsible for keeping your password secure and for everything that happens on your account. If someone unauthorized uses it, tell us right away. Don't share your login with anyone else."
          colors={colors}
        />
      </Section>

      <Section title="Content You Create" colors={colors}>
        <Paragraph
          text="When you post activities, messages, or update your profile, you retain ownership. But by posting, you give NomadsPeople permission to use, display, and improve the platform based on your content (while keeping your data private per our Privacy Policy)."
          colors={colors}
        />
      </Section>

      <Section title="What is Not Allowed" colors={colors}>
        <List
          items={[
            'Harassment, bullying, hate speech, or discrimination',
            'Threats, violence, or illegal activity',
            'Spam, scams, or commercial solicitation',
            'Explicit or unsolicited sexual content',
            'Fake profiles or impersonation',
            'Sharing other peoples personal info without consent',
            'Hacking, bots, or automated abuse',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Intellectual Property" colors={colors}>
        <Paragraph
          text="NomadsPeople, its logo, design, and features are ours. You cannot copy, modify, or use them without permission. Your content stays yours."
          colors={colors}
        />
      </Section>

      <Section title="Location Features and Your Privacy" colors={colors}>
        <Paragraph
          text="We show your location on the map at a city-level grid for your safety and discovery. You control your visibility with Snooze Mode to hide from the map anytime. Check our Privacy Policy for full details."
          colors={colors}
        />
      </Section>

      <Section title="Push Notifications" colors={colors}>
        <Paragraph
          text="We send you notifications about matches, nearby people, and messages you want to know about. You can turn these off anytime in your settings."
          colors={colors}
        />
      </Section>

      <Section title="No Guarantees (Disclaimer)" colors={colors}>
        <Paragraph
          text="NomadsPeople is provided as-is. We don't run background checks, verify identities, or guarantee anyone safety or authenticity. You use the platform at your own risk. Trust your instincts and follow our Safety Tips."
          colors={colors}
        />
      </Section>

      <Section title="We are Not Liable For..." colors={colors}>
        <List
          items={[
            'Harm from meetings arranged through the app',
            'Lost, stolen, or damaged items',
            'Issues with other users',
            'Service interruptions or data loss',
            'Any indirect or consequential damages',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Account Termination" colors={colors}>
        <Paragraph
          text="We can remove your account if you break these rules or our guidelines. You can delete your account anytime in Settings. We will keep some data for legal/safety reasons but will stop using it."
          colors={colors}
        />
      </Section>

      <Section title="Changes to Terms" colors={colors}>
        <Paragraph
          text="We may update these terms. If we make big changes, we will let you know. Continuing to use the app means you accept the new terms."
          colors={colors}
        />
      </Section>

      <Section title="Questions?" colors={colors}>
        <Paragraph text="Email us at nomadspeople1@gmail.com" colors={colors} />
      </Section>
    </View>
  );
}

/* PRIVACY POLICY */
function PrivacyContent({ colors }: { colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ paddingHorizontal: s(12) }}>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        NomadsPeople • nomadspeople1@gmail.com • Effective April 5, 2026
      </Text>

      <Section title="What We Collect" colors={colors}>
        <List
          items={[
            'Profile info: name, photo, bio, interests, job, home country',
            'Location: city-level grid position for map display',
            'Activity: statuses, activities, timers you create',
            'Messages: DMs and group chat conversations',
            'Device info: phone type, OS version, unique identifiers',
            'Usage: features you use, how long, what you tap',
            'Push notification preferences',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="How We Use Your Data" colors={colors}>
        <List
          items={[
            'Show your profile and location to other nomads in your city',
            'Match you with people based on interests (DNA matching)',
            'Deliver push notifications you have opted into',
            'Improve the app with analytics (anonymized)',
            'Support you with customer service',
            'Keep the platform safe from abuse',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="What We Share" colors={colors}>
        <Paragraph text="Your Public Profile - other users see your name, photo, bio, interests, and location (city-level grid)." colors={colors} />
        <Paragraph text="Service Providers - we use Supabase (PostgreSQL) for data storage and Expo for push notifications. They have access to your data to provide these services." colors={colors} />
        <Paragraph text="Law Enforcement - if required by law, we may share data with authorities." colors={colors} />
        <Paragraph text="We never sell your data to third parties." colors={colors} />
      </Section>

      <Section title="Data Security" colors={colors}>
        <Paragraph
          text="We use encryption, secure authentication, and Row Level Security (database-level protection) to keep your data safe. But no system is 100 percent secure. If there is a breach, we will notify you."
          colors={colors}
        />
      </Section>

      <Section title="Your Rights" colors={colors}>
        <List
          items={[
            'Access your data: request a copy of what we have on you',
            'Delete your account: removes your profile and messages',
            'Export your data: get your profile info in a portable format',
            'Correct info: update your profile anytime',
            'Block users: they cannot see you or message you',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Data Retention" colors={colors}>
        <Paragraph text="Messages are kept as long as the conversation exists. Your profile data stays until you delete it. We keep some anonymized usage data to improve the service." colors={colors} />
      </Section>

      <Section title="Childrens Privacy" colors={colors}>
        <Paragraph text="NomadsPeople is for ages 18+. We don't knowingly collect data from minors. If we find out a user is under 18, we will terminate their account." colors={colors} />
      </Section>

      <Section title="International Data" colors={colors}>
        <Paragraph text="We operate globally. Your data may be processed in different countries. By using NomadsPeople, you consent to this." colors={colors} />
      </Section>

      <Section title="Changes to This Policy" colors={colors}>
        <Paragraph text="We update this policy as needed. Big changes will be notified to you. Continuing to use means you accept the changes." colors={colors} />
      </Section>

      <Section title="Contact Us" colors={colors}>
        <Paragraph text="Have privacy questions? Email nomadspeople1@gmail.com" colors={colors} />
      </Section>
    </View>
  );
}

/* COMMUNITY GUIDELINES */
function GuidelinesContent({ colors }: { colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ paddingHorizontal: s(12) }}>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        NomadsPeople • Community Standards • Effective April 5, 2026
      </Text>

      <Section title="Be Real" colors={colors}>
        <Paragraph text="Use your authentic name (or genuine nickname), a real photo of your face, and honest info. Fake profiles kill the vibe and get removed fast." colors={colors} />
      </Section>

      <Section title="Be Respectful" colors={colors}>
        <List
          items={[
            'No harassment, hate speech, or discrimination of any kind',
            'Respect peoples identities, beliefs, and backgrounds',
            'Disagree politely. We are from all over the world',
            'Don not spam, troll, or bait people',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Keep It Safe" colors={colors}>
        <List
          items={[
            'No threats, violence, or illegal activity',
            'No explicit sexual content or unsolicited nudes',
            'No selling drugs, weapons, or stolen goods',
            'No scams, MLM schemes, or financial manipulation',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="No Spam or Selling" colors={colors}>
        <Paragraph text="NomadsPeople is not a marketplace. Don not use it to advertise services, sell courses, recruit for MLMs, or blast promotional messages. Keep it social." colors={colors} />
      </Section>

      <Section title="Profile Rules" colors={colors}>
        <List
          items={[
            'Real photo of your face (not a meme, celebrity, or your dog)',
            'Use your real name or authentic nickname',
            'Don not put links to external sites in your bio',
            'Keep sensitive info (address, ID, finances) off the platform',
            'One account per person',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Chat Etiquette" colors={colors}>
        <List
          items={[
            'Respect peoples boundaries. If they are not interested, accept it',
            'Don not send unsolicited explicit images',
            'Keep conversations on the app (don not immediately ask for WhatsApp)',
            'Report any uncomfortable behavior',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Activity Rules" colors={colors}>
        <List
          items={[
            'Post activities for public places and legitimate meetups',
            'Be honest about timing, location, and what you are doing',
            'Respect others time. Cancel if you cannot make it',
            'No activities for selling, recruiting, or promoting commercial stuff',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Blocking and Reporting" colors={colors}>
        <Paragraph text="See someone breaking the rules? Report them. Block anyone who makes you uncomfortable. We will investigate reports and remove accounts that violate guidelines." colors={colors} />
      </Section>

      <Section title="Enforcement" colors={colors}>
        <List
          items={[
            'First offense: warning and explanation',
            'Second offense: 7-day suspension',
            'Third offense or serious violations: permanent ban',
            'We may terminate immediately for threats, harassment, or illegal activity',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="The Bottom Line" colors={colors}>
        <Paragraph text="NomadsPeople works because of trust. We are a community of real people looking for genuine connection. Keep it authentic, respectful, and safe." colors={colors} />
      </Section>
    </View>
  );
}

/* SAFETY TIPS */
function SafetyContent({ colors }: { colors: any }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ paddingHorizontal: s(12) }}>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        NomadsPeople • Safety Guide • Keep Yourself Safe
      </Text>

      <Section title="Before You Meet Someone" colors={colors}>
        <List
          items={[
            'Meet in a public place (cafe, restaurant, co-working space)',
            'Tell a trusted friend where you are going and who you are meeting',
            'Keep chatting on NomadsPeople until you feel comfortable',
            'Trust your gut. If something feels off, cancel',
            'Plan to leave whenever you want (no obligation to stay)',
            'Check the persons profile history and mutual connections',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="During the Meetup" colors={colors}>
        <List
          items={[
            'Stay aware of your surroundings',
            'Keep your phone charged and accessible',
            'Don not share financial info, ID numbers, or passwords',
            'Keep your valuables with you',
            'It is OK to leave early if you are uncomfortable',
            'If anyone makes you feel unsafe, get out and report it',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="After the Meetup" colors={colors}>
        <List
          items={[
            'Let your friend know you are safe',
            'If something felt wrong, block and report the person',
            'Stay in touch with people you genuinely connected with',
            'Leave feedback to help the community stay safe',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Online Safety" colors={colors}>
        <List
          items={[
            'Never send money, even if the story sounds real',
            'Don not share passwords, bank info, or ID numbers',
            'Be skeptical of too-good-to-be-true offers',
            'Use the app to communicate. Don not move to personal channels too fast',
            'Scammers prey on lonely travelers. Stay aware.',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="For LGBTQ+ Nomads" colors={colors}>
        <Paragraph text="Your safety comes first. Research local laws and customs before meeting up. Use NomadsPeople visibility settings (city-only or invisible) if needed. Connect with community groups for support." colors={colors} />
      </Section>

      <Section title="Global Emergency Resources" colors={colors}>
        <List
          items={[
            'US/Canada: 911 (or your countries emergency number)',
            'Europe: 112 (across EU)',
            'International SOS: +1-215-537-7600',
            'Polaris Project (trafficking): 1-844-888-FREE',
            'RAINN (sexual assault): 1-800-656-HOPE',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="If Something Goes Wrong" colors={colors}>
        <List
          items={[
            'Contact local police if you are in immediate danger',
            'Tell a trusted friend or family member',
            'Document what happened (screenshots, times, dates)',
            'Report the user on NomadsPeople with details',
            'Contact your embassy if you are abroad',
          ]}
          colors={colors}
        />
      </Section>

      <Section title="Trust Your Instincts" colors={colors}>
        <Paragraph text="You know yourself. If something feels wrong, it probably is. There are plenty of good people on NomadsPeople. Don not settle for anyone who makes you uncomfortable." colors={colors} />
      </Section>

      <Section title="Need Help?" colors={colors}>
        <Paragraph text="Report a safety concern in the app anytime. Email nomadspeople1@gmail.com for urgent issues." colors={colors} />
      </Section>
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
