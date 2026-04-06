import { useState, useContext, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, Linking, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NomadIcon from '../components/NomadIcon';
import type { NomadIconName } from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useProfile, useUpdateSettings } from '../lib/hooks';
import { useAuthContext } from '../App';
import { supabase } from '../lib/supabase';
import { useI18n, LOCALE_META, SUPPORTED_LOCALES, type Locale } from '../lib/i18n';
import type { RootStackParamList } from '../lib/types';
import DualThumbSlider from '../components/DualThumbSlider';
import { setUserNotificationPrefs, getUserNotificationPrefs } from '../lib/notifications';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ─── Language options ─── */
const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'es', label: 'Español', native: 'Spanish' },
  { code: 'pt', label: 'Português', native: 'Portuguese' },
  { code: 'it', label: 'Italiano', native: 'Italian' },
  { code: 'fr', label: 'Français', native: 'French' },
  { code: 'de', label: 'Deutsch', native: 'German' },
  { code: 'ja', label: '日本語', native: 'Japanese' },
  { code: 'zh', label: '中文', native: 'Chinese' },
  { code: 'ko', label: '한국어', native: 'Korean' },
  { code: 'he', label: 'עברית', native: 'Hebrew' },
  { code: 'ar', label: 'العربية', native: 'Arabic' },
  { code: 'ru', label: 'Русский', native: 'Russian' },
  { code: 'th', label: 'ไทย', native: 'Thai' },
  { code: 'vi', label: 'Tiếng Việt', native: 'Vietnamese' },
];

/* ─── DNA data (same as Onboarding) ─── */
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

/* All selectable items for "featured tags" — flat list from interests + looking_for + nomad types */
const ALL_TAG_OPTIONS: { emoji: string; label: string }[] = [
  ...NOMAD_TYPES,
  ...INTERESTS.flatMap(g => g.items),
  ...LOOKING_FOR,
];

/* ═══════════════════════════════════════════
   MAIN SETTINGS SCREEN
   ═══════════════════════════════════════════ */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { userId, signOut, resetOnboarding, switchDevUser, devUserLabel } = useAuthContext();
  const { profile, refetch: refetchProfile } = useProfile(userId);
  const { update, deleteAccount } = useUpdateSettings();
  const { t, locale: i18nLocale, setLocale: setI18nLocale } = useI18n();
  const { isDark, colors, toggleDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Local state from profile
  const [darkMode, setDarkMode] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [appLang, setAppLang] = useState('en');
  const [notifyNearby, setNotifyNearby] = useState(true);
  const [notifyHeating, setNotifyHeating] = useState(true);
  const [notifyDistance, setNotifyDistance] = useState(20);
  const [showOnMap, setShowOnMap] = useState(true);
  const [snoozeMode, setSnoozeMode] = useState(false);
  const [hideDistance, setHideDistance] = useState(false);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(100);
  const [notifyProfileView, setNotifyProfileView] = useState(true);
  const [notifyChat, setNotifyChat] = useState(true);
  const [notifyActivityJoined, setNotifyActivityJoined] = useState(true);
  const [notifyDnaMatch, setNotifyDnaMatch] = useState(true);
  const [notifyFlightIncoming, setNotifyFlightIncoming] = useState(true);
  const [visibility, setVisibility] = useState<'public' | 'city_only' | 'invisible'>('public');

  // DNA state
  const [dnaNomadType, setDnaNomadType] = useState('');
  const [dnaInterests, setDnaInterests] = useState<string[]>([]);
  const [dnaLookingFor, setDnaLookingFor] = useState<string[]>([]);
  const [dnaFeaturedTags, setDnaFeaturedTags] = useState<string[]>([]);

  // Username editing
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  // Display name editing
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');

  // Modals
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showDNAEditor, setShowDNAEditor] = useState(false);

  /* ─── Section Header ─── */
  function SectionHeader({ title }: { title: string }) {
    return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>;
  }

  /* ─── Row with icon + label + right element ─── */
  function SettingsRow({
    icon, iconColor, label, sublabel, right, onPress, danger,
  }: {
    icon: NomadIconName;
    iconColor?: string;
    label: string;
    sublabel?: string;
    right?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
  }) {
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={onPress ? 0.6 : 1}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={[styles.rowIcon, { backgroundColor: colors.pill }, danger && { backgroundColor: '#FFF0F0' }]}>
          <NomadIcon name={icon} size={s(7)} color={iconColor || (danger ? colors.primary : colors.dark)} strokeWidth={1.6} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowLabel, { color: colors.dark }, danger && { color: colors.primary }]}>{label}</Text>
          {sublabel && <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>{sublabel}</Text>}
        </View>
        {right || (onPress && <NomadIcon name="forward" size={s(6)} color="#1A1A1A" strokeWidth={1.6} />)}
      </TouchableOpacity>
    );
  }

  /* ─── Chip component for DNA editor ─── */
  function Chip({
    emoji, label, selected, onPress,
  }: {
    emoji: string; label: string; selected: boolean; onPress: () => void;
  }) {
    return (
      <TouchableOpacity
        style={[styles.chip, selected && styles.chipSelected]}
        onPress={onPress}
        activeOpacity={0.6}
      >
        <Text style={styles.chipEmoji}>{emoji}</Text>
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  /* ─── DNA Editor Modal ─── */
  function DNAEditorModal({
    visible, onClose,
    nomadType, setNomadType,
    interests, setInterests,
    lookingFor, setLookingFor,
    featuredTags, setFeaturedTags,
    onSave,
  }: {
    visible: boolean; onClose: () => void;
    nomadType: string; setNomadType: (v: string) => void;
    interests: string[]; setInterests: (v: string[]) => void;
    lookingFor: string[]; setLookingFor: (v: string[]) => void;
    featuredTags: string[]; setFeaturedTags: (v: string[]) => void;
    onSave: () => void;
  }) {
    const dnaInsets = useSafeAreaInsets();

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
        <View style={[styles.dnaRoot, { paddingTop: dnaInsets.top }]}>
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

            <Text style={styles.dnaSection}>Interests <Text style={styles.dnaSectionSub}>({interests.length}/10)</Text></Text>
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
                <Text style={styles.dnaEmptyHint}>Select interests & looking for above first</Text>
              )}
            </View>

            <View style={{ height: dnaInsets.bottom + s(20) }} />
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Sync from DB
  useEffect(() => {
    if (!profile) return;
    setDarkMode(profile.dark_mode ?? false);
    setDistanceUnit((profile.distance_unit as 'km' | 'mi') ?? 'km');
    setAppLang(profile.app_language ?? 'en');
    setNotifyNearby(profile.notify_nearby ?? true);
    setNotifyHeating(profile.notify_heating ?? true);
    setNotifyDistance(profile.notification_distance_km ?? 20);
    setShowOnMap(profile.show_on_map ?? true);
    setSnoozeMode(profile.snooze_mode ?? false);
    setHideDistance((profile as any).hide_distance ?? false);
    setAgeMin(profile.age_min ?? 18);
    setAgeMax(profile.age_max ?? 100);
    setNotifyProfileView(profile.notify_profile_view ?? true);
    setNotifyChat((profile as any).notify_chat ?? true);
    setNotifyActivityJoined((profile as any).notify_activity_joined ?? true);
    setNotifyDnaMatch((profile as any).notify_dna_match ?? true);
    setNotifyFlightIncoming((profile as any).notify_flight_incoming ?? true);
    setUsernameInput(profile.username ?? '');
    // DNA
    setDnaNomadType(profile.job_type ?? '');
    setDnaInterests(profile.interests ?? []);
    setDnaLookingFor(profile.looking_for ?? []);
    setDnaFeaturedTags(profile.featured_tags ?? []);
    setVisibility((profile as any).visibility ?? 'public');
  }, [profile]);

  // Save helper
  const save = (fields: Record<string, any>) => {
    if (userId) update(userId, fields);
  };

  // Sync all notification prefs to the in-memory foreground handler
  // Accept overrides so the just-toggled value is used (state hasn't re-rendered yet)
  const syncPrefs = (overrides: Partial<Record<string, any>> = {}) => {
    setUserNotificationPrefs({
      notify_nearby: overrides.notify_nearby ?? notifyNearby,
      notify_heating: overrides.notify_heating ?? notifyHeating,
      notify_profile_view: overrides.notify_profile_view ?? notifyProfileView,
      notify_chat: overrides.notify_chat ?? notifyChat,
      notify_activity_joined: overrides.notify_activity_joined ?? notifyActivityJoined,
      notify_dna_match: overrides.notify_dna_match ?? notifyDnaMatch,
      notify_flight_incoming: overrides.notify_flight_incoming ?? notifyFlightIncoming,
      snooze_mode: overrides.snooze_mode ?? snoozeMode,
      notification_distance_km: overrides.notification_distance_km ?? notifyDistance,
      // Preserve user location from App.tsx startup (GPS-based, not in app_profiles)
      user_lat: getUserNotificationPrefs().user_lat ?? null,
      user_lng: getUserNotificationPrefs().user_lng ?? null,
    });
  };

  const handleToggleDark = (val: boolean) => {
    setDarkMode(val);
    toggleDark(val);  // Update app-wide theme immediately
    save({ dark_mode: val });
  };

  const handleDistanceUnit = (unit: 'km' | 'mi') => {
    setDistanceUnit(unit);
    save({ distance_unit: unit });
  };

  const handleLangSelect = (code: string) => {
    setAppLang(code);
    save({ app_language: code });
    // Sync with global i18n context so UI updates immediately
    if (SUPPORTED_LOCALES.includes(code as Locale)) {
      setI18nLocale(code as Locale);
    }
    setShowLangPicker(false);
  };

  const handleToggleNearby = (val: boolean) => {
    setNotifyNearby(val);
    save({ notify_nearby: val });
    syncPrefs({ notify_nearby: val });
  };

  const handleToggleHeating = (val: boolean) => {
    setNotifyHeating(val);
    save({ notify_heating: val });
    syncPrefs({ notify_heating: val });
  };

  const handleDistanceChange = (delta: number) => {
    const next = Math.max(5, Math.min(100, notifyDistance + delta));
    setNotifyDistance(next);
    save({ notification_distance_km: next });
    syncPrefs({ notification_distance_km: next });
  };

  const handleToggleShowOnMap = async (val: boolean) => {
    setShowOnMap(val);
    save({ show_on_map: val });
    // Also update visibility of any active checkins so the change takes effect immediately
    if (userId) {
      await supabase
        .from('app_checkins')
        .update({ visibility: val ? 'public' : 'invisible' })
        .eq('user_id', userId)
        .eq('is_active', true);
    }
  };

  const applySnooze = async (val: boolean) => {
    setSnoozeMode(val);
    save({ snooze_mode: val });
    syncPrefs({ snooze_mode: val });
    if (val && showOnMap) {
      setShowOnMap(false);
      save({ show_on_map: false });
      if (userId) {
        await supabase
          .from('app_checkins')
          .update({ visibility: 'invisible' })
          .eq('user_id', userId)
          .eq('is_active', true);
      }
    }
    if (!val) {
      setShowOnMap(true);
      save({ show_on_map: true });
      if (userId) {
        await supabase
          .from('app_checkins')
          .update({ visibility: 'public' })
          .eq('user_id', userId)
          .eq('is_active', true);
      }
    }
  };

  const handleToggleSnooze = (val: boolean) => {
    if (val) {
      // Turning ON → show confirmation popup
      Alert.alert(
        'Enable Snooze Mode?',
        "You won't be able to see or join nearby activities or discover nearby travelers while snoozed. You can disable this anytime in settings.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => applySnooze(true) },
        ]
      );
    } else {
      // Turning OFF → no confirmation needed
      applySnooze(false);
    }
  };

  const handleToggleHideDistance = (val: boolean) => {
    setHideDistance(val);
    save({ hide_distance: val });
  };

  const handleVisibilityChange = async (newVis: 'public' | 'city_only' | 'invisible') => {
    setVisibility(newVis);
    save({ visibility: newVis });
    // Also update visibility of any active checkins
    if (userId) {
      await supabase
        .from('app_checkins')
        .update({ visibility: newVis })
        .eq('user_id', userId)
        .eq('is_active', true);
    }
  };

  const handleAgeChange = (min: number, max: number) => {
    setAgeMin(min);
    setAgeMax(max);
    save({ age_min: min, age_max: max });
  };

  const handleToggleProfileView = (val: boolean) => {
    setNotifyProfileView(val);
    save({ notify_profile_view: val });
    syncPrefs({ notify_profile_view: val });
  };

  const handleToggleChat = (val: boolean) => {
    setNotifyChat(val);
    save({ notify_chat: val });
    syncPrefs({ notify_chat: val });
  };

  const handleToggleActivityJoined = (val: boolean) => {
    setNotifyActivityJoined(val);
    save({ notify_activity_joined: val });
    syncPrefs({ notify_activity_joined: val });
  };

  const handleToggleDnaMatch = (val: boolean) => {
    setNotifyDnaMatch(val);
    save({ notify_dna_match: val });
    syncPrefs({ notify_dna_match: val });
  };

  const handleToggleFlightIncoming = (val: boolean) => {
    setNotifyFlightIncoming(val);
    save({ notify_flight_incoming: val });
    syncPrefs({ notify_flight_incoming: val });
  };

  const handleSaveUsername = async () => {
    const clean = usernameInput.toLowerCase().replace(/\s/g, '_').replace(/[^a-z0-9._\-]/g, '').slice(0, 30);
    if (clean.length < 3) {
      Alert.alert('Username too short', 'Must be at least 3 characters.');
      return;
    }

    // Check 7-day cooldown
    const changedAt = profile?.username_changed_at;
    if (changedAt) {
      const daysSince = (Date.now() - new Date(changedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        const daysLeft = Math.ceil(7 - daysSince);
        Alert.alert('Too soon', `You can change your username again in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`);
        return;
      }
    }

    // Check uniqueness
    const { data } = await supabase
      .from('app_profiles')
      .select('user_id')
      .eq('username', clean)
      .neq('user_id', userId || '')
      .limit(1);

    if (data && data.length > 0) {
      Alert.alert('Username taken', 'This username is already in use. Try another one.');
      return;
    }

    setUsernameInput(clean);
    save({ username: clean, username_changed_at: new Date().toISOString() });
    setEditingUsername(false);
  };

  const handleSaveDisplayName = () => {
    const trimmed = displayNameInput.trim();
    if (trimmed.length < 2) {
      Alert.alert('Too short', 'Name must be at least 2 characters.');
      return;
    }
    save({ display_name: trimmed, full_name: trimmed });
    setEditingDisplayName(false);
  };

  const handleSaveDNA = async () => {
    save({
      job_type: dnaNomadType || null,
      interests: dnaInterests,
      looking_for: dnaLookingFor,
      featured_tags: dnaFeaturedTags,
    });
    setShowDNAEditor(false);
    // Refetch so ProfileScreen sees updated tags immediately
    setTimeout(() => refetchProfile(), 300);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (userId) {
              await deleteAccount(userId);
              signOut();
            }
          },
        },
      ]
    );
  };

  const handleResetAndTest = () => {
    Alert.alert(
      '🔄 Reset & Test Again',
      'This will reset your profile data and start fresh from the beginning. Your account will NOT be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            // Reset onboarding_done + clear profile fields
            await supabase
              .from('app_profiles')
              .update({
                onboarding_done: false,
                username: null,
                full_name: null,
                bio: null,
                job_type: null,
                home_country: null,
                current_city: null,
                interests: [],
                looking_for: [],
                featured_tags: [],
                travel_style: null,
                instagram_handle: null,
                birth_date: null,
                age_verified: false,
              })
              .eq('user_id', userId);

            // Delete check-ins
            await supabase.from('app_checkins').delete().eq('user_id', userId);
            // Delete event memberships
            await supabase.from('app_event_members').delete().eq('user_id', userId);
            // Delete posts
            await supabase.from('app_posts').delete().eq('user_id', userId);

            // Navigate back to onboarding
            resetOnboarding();
          },
        },
      ]
    );
  };

  const currentLangLabel = LANGUAGES.find(l => l.code === appLang)?.label || 'English';

  /* Build DNA summary string */
  const dnaSummary = [
    dnaNomadType,
    ...(dnaInterests.length ? [`${dnaInterests.length} interests`] : []),
    ...(dnaLookingFor.length ? [dnaLookingFor.join(', ')] : []),
  ].filter(Boolean).join(' · ') || 'Set up your profile DNA';

  const featuredSummary = dnaFeaturedTags.length
    ? dnaFeaturedTags.join(', ')
    : 'Choose up to 4 tags';

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      {/* ─── Header ─── */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.borderSoft }]}>
        <TouchableOpacity style={[styles.hdrBtn, { backgroundColor: colors.pill }]} onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <NomadIcon name="back" size={s(9)} color="#1A1A1A" strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={[styles.hdrTitle, { color: colors.dark }]}>{t('settings.title')}</Text>
        <View style={[styles.hdrBtn, { backgroundColor: colors.pill }]} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ═══ YOUR DNA ═══ */}
        <SectionHeader title={t('settings.yourDna')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          {editingUsername ? (
            <View style={styles.usernameEditRow}>
              <Text style={[styles.usernameAt, { color: colors.textMuted }]}>@</Text>
              <TextInput
                style={[styles.usernameInput, { color: colors.dark }]}
                value={usernameInput}
                onChangeText={setUsernameInput}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <TouchableOpacity style={styles.usernameSaveBtn} onPress={handleSaveUsername}>
                <Text style={styles.usernameSaveTxt}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow
              icon="at-sign"
              label={t('settings.username')}
              sublabel={`@${usernameInput || 'not set'}`}
              onPress={() => setEditingUsername(true)}
            />
          )}
          <View style={styles.divider} />
          {editingDisplayName ? (
            <View style={styles.usernameEditRow}>
              <TextInput
                style={[styles.usernameInput, { color: colors.dark, flex: 1 }]}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                placeholder="Your Name"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={styles.usernameSaveBtn} onPress={handleSaveDisplayName}>
                <Text style={styles.usernameSaveTxt}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow
              icon="user"
              label="nickname"
              sublabel={profile?.display_name || profile?.full_name || 'not set'}
              onPress={() => {
                setDisplayNameInput(profile?.display_name || profile?.full_name || '');
                setEditingDisplayName(true);
              }}
            />
          )}
          <View style={styles.divider} />
          <SettingsRow
            icon="heart"
            iconColor={colors.primary}
            label={t('settings.editInterests')}
            sublabel={dnaSummary}
            onPress={() => setShowDNAEditor(true)}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="star"
            iconColor={colors.accent}
            label={t('settings.featuredTags')}
            sublabel={featuredSummary}
            onPress={() => setShowDNAEditor(true)}
          />
        </View>

        {/* ═══ VISIBILITY ═══ */}
        <SectionHeader title="visibility" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="eye"
            label={t('settings.showOnMap')}
            sublabel={t('settings.showOnMapSub')}
            right={
              <Switch
                value={showOnMap}
                onValueChange={handleToggleShowOnMap}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />
          <SettingsRow
            icon="moon-stars"
            label="Snooze mode"
            sublabel="Hide me from nearby list"
            right={
              <Switch
                value={snoozeMode}
                onValueChange={handleToggleSnooze}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />
          <SettingsRow
            icon="pin"
            label="Hide my distance"
            sublabel="Hide my distance away from others"
            right={
              <Switch
                value={hideDistance}
                onValueChange={handleToggleHideDistance}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />

          {/* Visibility */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.pill }]}>
              <NomadIcon name="eye" size={s(7)} color={colors.dark} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.dark }]}>Visibility</Text>
              <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>How visible are you to others?</Text>
              <View style={{ marginTop: s(5), flexDirection: 'row', gap: s(3) }}>
                {[
                  { value: 'public' as const, label: 'Everyone' },
                  { value: 'city_only' as const, label: 'Same city' },
                  { value: 'invisible' as const, label: 'Invisible' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.visibilityBtn,
                      visibility === opt.value && styles.visibilityBtnActive,
                      { backgroundColor: visibility === opt.value ? colors.primary : colors.pill },
                    ]}
                    onPress={() => handleVisibilityChange(opt.value)}
                  >
                    <Text
                      style={[
                        styles.visibilityBtnText,
                        visibility === opt.value && styles.visibilityBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Age Range */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.pill }]}>
              <NomadIcon name="users" size={s(7)} color={colors.dark} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.dark }]}>Creator age range</Text>
              <View style={{ marginTop: s(4), marginBottom: s(2) }}>
                <DualThumbSlider
                  min={18}
                  max={100}
                  valueMin={ageMin}
                  valueMax={ageMax}
                  onChangeMin={(v) => handleAgeChange(v, ageMax)}
                  onChangeMax={(v) => handleAgeChange(ageMin, v)}
                  step={1}
                />
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSoft }]} />
          <SettingsRow
            icon="close"
            label="Blocked Users"
            sublabel="Manage blocked users"
            onPress={() => Alert.alert('Blocked Users', 'No blocked users yet.')}
          />
        </View>

        {/* ═══ APPEARANCE ═══ */}
        <SectionHeader title={t('settings.appearance')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="moon-stars"
            label={t('settings.darkMode')}
            sublabel={t('settings.darkModeSub')}
            right={
              <Switch
                value={darkMode}
                onValueChange={handleToggleDark}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="compass"
            label={t('settings.distanceUnit')}
            right={
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitBtn, distanceUnit === 'km' && styles.unitBtnActive]}
                  onPress={() => handleDistanceUnit('km')}
                >
                  <Text style={[styles.unitText, distanceUnit === 'km' && styles.unitTextActive]}>KM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitBtn, distanceUnit === 'mi' && styles.unitBtnActive]}
                  onPress={() => handleDistanceUnit('mi')}
                >
                  <Text style={[styles.unitText, distanceUnit === 'mi' && styles.unitTextActive]}>MI</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        {/* ═══ LANGUAGE ═══ */}
        <SectionHeader title={t('settings.language')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="globe"
            label={t('settings.appLanguage')}
            sublabel={currentLangLabel}
            onPress={() => setShowLangPicker(true)}
          />
        </View>

        {/* ═══ ACTIVITY NOTIFICATIONS ═══ */}
        <SectionHeader title={t('settings.notifications')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="bell"
            label={t('settings.notifyNearby')}
            right={
              <Switch
                value={notifyNearby}
                onValueChange={handleToggleNearby}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trending"
            label={t('settings.notifyHeating')}
            right={
              <Switch
                value={notifyHeating}
                onValueChange={handleToggleHeating}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="target"
            label={t('settings.notifyDistance')}
            right={
              <View style={styles.distanceControl}>
                <TouchableOpacity onPress={() => handleDistanceChange(-5)} style={styles.distBtn}>
                  <NomadIcon name="minus" size={s(5)} color={colors.primary} strokeWidth={1.6} />
                </TouchableOpacity>
                <Text style={styles.distValue}>{notifyDistance} km</Text>
                <TouchableOpacity onPress={() => handleDistanceChange(5)} style={styles.distBtn}>
                  <NomadIcon name="plus" size={s(5)} color={colors.primary} strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="eye"
            label="Profile views"
            sublabel="When someone views your profile"
            right={
              <Switch
                value={notifyProfileView}
                onValueChange={handleToggleProfileView}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="chat"
            label="Messages"
            sublabel="New chat messages and DMs"
            right={
              <Switch
                value={notifyChat}
                onValueChange={handleToggleChat}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="users"
            label="Activity joined"
            sublabel="When someone joins your activity"
            right={
              <Switch
                value={notifyActivityJoined}
                onValueChange={handleToggleActivityJoined}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="heart"
            label="DNA matches"
            sublabel="When you match with a nearby nomad"
            right={
              <Switch
                value={notifyDnaMatch}
                onValueChange={handleToggleDnaMatch}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="airplane"
            label="Incoming flights"
            sublabel="When someone is flying to your city"
            right={
              <Switch
                value={notifyFlightIncoming}
                onValueChange={handleToggleFlightIncoming}
                trackColor={{ false: '#D1D5DB', true: colors.success }}
                ios_backgroundColor="#D1D5DB"
                thumbColor="white"
              />
            }
          />
        </View>

        {/* ═══ SOCIAL ═══ */}
        <SectionHeader title={t('settings.social')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="camera"
            iconColor="#E4405F"
            label={t('settings.instagram')}
            onPress={() => Linking.openURL('https://instagram.com/nomadspeople')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="camera"
            label={t('settings.tiktok')}
            onPress={() => Linking.openURL('https://tiktok.com/@nomadspeople')}
          />
        </View>

        {/* ═══ FEEDBACK ═══ */}
        <SectionHeader title={t('settings.feedback')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="chat"
            label={t('settings.messageFounder')}
            onPress={() => Linking.openURL('mailto:nomadspeople1@gmail.com?subject=NomadsPeople Feedback')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="star"
            label={t('settings.leaveReview')}
            onPress={() => Linking.openURL('https://apps.apple.com/app/nomadspeople')}
          />
        </View>

        {/* ═══ SUPPORT ═══ */}
        <SectionHeader title="support" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="alert"
            iconColor="#F59E0B"
            label="Report an Issue"
            sublabel="Let us know if something is broken"
            onPress={() => Linking.openURL('mailto:nomadspeople1@gmail.com?subject=NomadsPeople Bug Report')}
          />
        </View>

        {/* ═══ LEGAL ═══ */}
        <SectionHeader title={t('settings.legal')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="shield"
            label="Legal & Safety"
            sublabel="Terms, Privacy, Guidelines, Safety Tips"
            onPress={() => nav.navigate('Legal', { type: 'terms' })}
          />
        </View>

        {/* ═══ DEV MODE ═══ */}
        <SectionHeader title={t('settings.devMode')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          {switchDevUser && (
            <>
              <SettingsRow
                icon="users"
                iconColor={colors.accent}
                label={`Switch User (now: ${devUserLabel})`}
                sublabel="Toggle between test accounts"
                onPress={switchDevUser}
              />
              <View style={styles.divider} />
            </>
          )}
          <SettingsRow
            icon="refresh"
            iconColor="#FF9500"
            label={t('settings.resetTest')}
            sublabel={t('settings.resetTestSub')}
            onPress={handleResetAndTest}
          />
        </View>

        {/* ═══ ACCOUNT ═══ */}
        <SectionHeader title={t('settings.account')} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow icon="logout" label={t('settings.logout')} danger onPress={handleLogout} />
          <View style={styles.divider} />
          <SettingsRow icon="trash" label={t('settings.deleteAccount')} danger onPress={handleDeleteAccount} />
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          {userId && (
            <Text style={[styles.footerUserId, { color: colors.textFaint }]}>
              Your User ID: {userId.slice(0, 8)}...
            </Text>
          )}
          <Text style={[styles.footerVersion, { color: colors.textMuted }]}>Version 1.0.0</Text>
          <Text style={[styles.footerMade, { color: colors.textFaint }]}>{t('settings.madeWith')}</Text>
        </View>

        <View style={{ height: insets.bottom + s(10) }} />
      </ScrollView>

      {/* ═══ Language Picker Modal ═══ */}
      <Modal visible={showLangPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowLangPicker(false)} />
          <View style={[styles.langCard, { paddingBottom: insets.bottom + s(10) }]}>
            <View style={styles.langHandle} />
            <Text style={styles.langTitle}>{t('settings.appLanguage')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: s(200) }}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langRow, appLang === lang.code && styles.langRowActive]}
                  onPress={() => handleLangSelect(lang.code)}
                  activeOpacity={0.6}
                >
                  <View>
                    <Text style={[styles.langLabel, appLang === lang.code && { color: colors.primary, fontWeight: FW.bold }]}>
                      {lang.label}
                    </Text>
                    <Text style={styles.langNative}>{lang.native}</Text>
                  </View>
                  {appLang === lang.code && (
                    <NomadIcon name="check-circle" size={s(8)} color={colors.primary} strokeWidth={1.6} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ DNA Editor Modal ═══ */}
      <DNAEditorModal
        visible={showDNAEditor}
        onClose={() => setShowDNAEditor(false)}
        nomadType={dnaNomadType}
        setNomadType={setDnaNomadType}
        interests={dnaInterests}
        setInterests={setDnaInterests}
        lookingFor={dnaLookingFor}
        setLookingFor={setDnaLookingFor}
        featuredTags={dnaFeaturedTags}
        setFeaturedTags={setDnaFeaturedTags}
        onSave={handleSaveDNA}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════ */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: s(6), paddingBottom: s(4), paddingHorizontal: s(10),
    backgroundColor: c.card, borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  hdrBtn: { width: s(20), height: s(20), borderRadius: s(10), backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: s(9), fontWeight: FW.bold, color: c.dark },

  scroll: { flex: 1 },

  sectionTitle: {
    fontSize: s(5.5), fontWeight: FW.bold, color: c.textMuted, letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: s(12), paddingTop: s(10), paddingBottom: s(4),
  },

  card: {
    marginHorizontal: s(10), backgroundColor: c.card, borderRadius: s(8),
    borderWidth: 0.5, borderColor: c.borderSoft, overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: s(6), paddingHorizontal: s(8), gap: s(5),
  },
  rowIcon: {
    width: s(16), height: s(16), borderRadius: s(5), backgroundColor: c.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: s(7), fontWeight: FW.medium, color: c.dark },
  rowSublabel: { fontSize: s(5.5), color: c.textMuted, marginTop: s(0.5) },

  divider: { height: 0.5, backgroundColor: c.borderSoft, marginLeft: s(29) },

  /* Username edit inline */
  usernameEditRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: s(5), paddingHorizontal: s(8), gap: s(2),
  },
  usernameAt: { fontSize: s(8), fontWeight: FW.bold },
  usernameInput: {
    flex: 1, fontSize: s(7), fontWeight: FW.medium,
    borderBottomWidth: 1, borderBottomColor: c.primary, paddingVertical: s(2),
  },
  usernameSaveBtn: {
    backgroundColor: c.primary, paddingVertical: s(3), paddingHorizontal: s(8), borderRadius: s(6),
  },
  usernameSaveTxt: { fontSize: s(6), fontWeight: FW.bold, color: 'white' },

  /* Unit toggle (KM / MI) */
  unitToggle: { flexDirection: 'row', borderRadius: s(5), overflow: 'hidden', borderWidth: 0.5, borderColor: c.borderSoft },
  unitBtn: { paddingVertical: s(2.5), paddingHorizontal: s(6), backgroundColor: c.pill },
  unitBtnActive: { backgroundColor: c.primary },
  unitText: { fontSize: s(5.5), fontWeight: FW.bold, color: c.textMuted },
  unitTextActive: { color: 'white' },

  /* Distance control */
  distanceControl: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  distBtn: { width: s(14), height: s(14), borderRadius: s(7), borderWidth: 1, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  distValue: { fontSize: s(7), fontWeight: FW.bold, color: c.dark, minWidth: s(25), textAlign: 'center' },

  /* Visibility buttons */
  visibilityBtn: { flex: 1, paddingVertical: s(3.5), borderRadius: s(6), alignItems: 'center', justifyContent: 'center' },
  visibilityBtnActive: {},
  visibilityBtnText: { fontSize: s(6), fontWeight: FW.bold, color: c.textMuted },
  visibilityBtnTextActive: { color: 'white' },

  /* Footer */
  footer: { alignItems: 'center', paddingVertical: s(12), gap: s(3) },
  footerUserId: { fontSize: s(5.5), color: c.textFaint },
  footerVersion: { fontSize: s(6), fontWeight: FW.medium, color: c.textMuted },
  footerMade: { fontSize: s(5.5), color: c.textFaint },

  /* Modal overlay */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },

  /* Language picker */
  langCard: {
    backgroundColor: c.card, borderTopLeftRadius: s(14), borderTopRightRadius: s(14), padding: s(10),
  },
  langHandle: { width: s(20), height: s(2), backgroundColor: '#ddd', borderRadius: s(1), alignSelf: 'center', marginBottom: s(8) },
  langTitle: { fontSize: s(9), fontWeight: FW.bold, color: c.dark, marginBottom: s(6) },
  langRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: s(6), paddingHorizontal: s(6), borderRadius: s(6), marginBottom: s(1),
  },
  langRowActive: { backgroundColor: c.dangerSurface },
  langLabel: { fontSize: s(7.5), fontWeight: FW.medium, color: c.dark },
  langNative: { fontSize: s(5.5), color: c.textMuted, marginTop: s(0.5) },

  /* ─── DNA Editor ─── */
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

  /* Chips */
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
