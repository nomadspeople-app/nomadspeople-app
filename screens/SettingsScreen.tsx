import { useState, useContext, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, Linking, Modal, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';

// Enable LayoutAnimation on Android — iOS has it on by default.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
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
import AgeRangeControl from '../components/AgeRangeControl';
import DNAEditorModal from '../components/DNAEditorModal';
import { setUserNotificationPrefs, getUserNotificationPrefs } from '../lib/notifications';
import * as Haptics from 'expo-haptics';

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
/* DNA constants (NOMAD_TYPES / INTERESTS / LOOKING_FOR /
 * ALL_TAG_OPTIONS) moved into components/DNAEditorModal.tsx
 * as part of the 2026-04-20 scroll-jump fix. SettingsScreen no
 * longer needs to know about them — it just hands state down to
 * the modal. */

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
  /* Age range is owned by AgeRangeControl — no local mirror
   * state here. Reading profile.age_min / age_max directly keeps
   * SettingsScreen out of the drag loop (the root cause of the
   * "jumpy slider" complaint was this screen re-rendering on
   * every PanResponder tick). */
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
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [socialIg, setSocialIg] = useState('');
  const [socialTt, setSocialTt] = useState('');
  const [socialLi, setSocialLi] = useState('');
  // Website moved to My Work section per product decision — no need to duplicate.

  /* ─── Accordion state ─── Only one section open at a time. Default null
     (all collapsed) so the screen loads as a clean short list of titles. */
  const [openSection, setOpenSection] = useState<string | null>(null);
  const toggleSection = (key: string) => {
    // Calm, slow-ish easing (320ms) so expand/collapse feels intentional
    // rather than glitchy. Haptic on tap confirms the touch registered.
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.create(
      320, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity,
    ));
    setOpenSection((prev) => (prev === key ? null : key));
  };

  /* ─── Collapsible Section Header ───
     Row: [colored icon square] [title] [chevron that rotates when open].
     Each category gets its own icon + accent color so the list reads
     as a warm visual inventory, not a bare outline list. The chevron
     turns 180° when the section opens so the affordance reads both
     before and after the tap. */
  function Section({
    title, sectionKey, icon, iconColor, children,
  }: {
    title: string;
    sectionKey: string;
    icon: NomadIconName;
    iconColor: string;
    children: React.ReactNode;
  }) {
    const isOpen = openSection === sectionKey;
    return (
      <View style={styles.sectionWrap}>
        <TouchableOpacity
          style={[
            styles.sectionHeader,
            {
              backgroundColor: colors.card,
              borderColor: isOpen ? iconColor : colors.borderSoft,
              borderBottomLeftRadius: isOpen ? 0 : s(8),
              borderBottomRightRadius: isOpen ? 0 : s(8),
              borderBottomWidth: isOpen ? 0 : 0.5,
            },
          ]}
          activeOpacity={0.7}
          onPress={() => toggleSection(sectionKey)}
        >
          <View style={[styles.sectionIcon, { backgroundColor: iconColor + '1F' }]}>
            <NomadIcon name={icon} size={s(7)} color={iconColor} strokeWidth={1.8} />
          </View>
          <Text style={[styles.sectionHeaderTitle, { color: colors.dark }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            {isOpen ? t('section.tapToClose') : t('section.tapToOpen')}
          </Text>
          <View style={[
            styles.sectionToggleBtn,
            {
              backgroundColor: isOpen ? iconColor : colors.pill,
              borderColor: isOpen ? iconColor : colors.borderSoft,
            },
          ]}>
            <NomadIcon
              name={isOpen ? 'minus' : 'plus'}
              size={s(7)}
              color={isOpen ? '#FFF' : colors.dark}
              strokeWidth={2.2}
            />
          </View>
        </TouchableOpacity>
        {isOpen && (
          <View style={[
            styles.sectionBody,
            { backgroundColor: colors.card, borderColor: iconColor },
          ]}>
            {children}
          </View>
        )}
      </View>
    );
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

  /* Chip + DNAEditorModal extracted to
   * components/DNAEditorModal.tsx (2026-04-20). They used to be
   * defined nested inside this component body, which caused
   * React to re-create their identities on every SettingsScreen
   * re-render — leading to the ScrollView snapping back to the
   * top on every chip tap. Now they live at module scope where
   * the identity is stable. */

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
    // The "Snooze" UI toggle in this screen is just the inverse of
    // show_on_map — one truth, per CLAUDE.md Rule Zero. The
    // separate `snooze_mode` DB field is no longer read anywhere.
    setSnoozeMode(profile.show_on_map === false);
    setHideDistance((profile as any).hide_distance ?? false);
    /* age_min / age_max are read straight from `profile` where
     * the slider renders — no mirror state to sync here. */
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

  // Sync all notification prefs to the in-memory foreground handler.
  // `show_on_map` doubles as the quiet-mode switch (false → mute
  // non-essentials) — see lib/notifications.ts. Accepts overrides
  // so the just-toggled value is used without waiting for React
  // state to flush.
  const syncPrefs = (overrides: Partial<Record<string, any>> = {}) => {
    setUserNotificationPrefs({
      notify_nearby: overrides.notify_nearby ?? notifyNearby,
      notify_heating: overrides.notify_heating ?? notifyHeating,
      notify_profile_view: overrides.notify_profile_view ?? notifyProfileView,
      notify_chat: overrides.notify_chat ?? notifyChat,
      notify_activity_joined: overrides.notify_activity_joined ?? notifyActivityJoined,
      notify_dna_match: overrides.notify_dna_match ?? notifyDnaMatch,
      notify_flight_incoming: overrides.notify_flight_incoming ?? notifyFlightIncoming,
      show_on_map: overrides.show_on_map ?? showOnMap,
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

  /** applySnooze(val) — val === true means "snooze me" (hide).
   *  This is now a thin wrapper around show_on_map: snoozed ⇔
   *  show_on_map === false. The UI state `snoozeMode` still
   *  exists for the Switch's visual value; we keep it in sync
   *  here so the toggle animation matches. */
  const applySnooze = async (val: boolean) => {
    const nextShowOnMap = !val;
    setSnoozeMode(val);
    setShowOnMap(nextShowOnMap);
    save({ show_on_map: nextShowOnMap });
    syncPrefs({ show_on_map: nextShowOnMap });
    if (userId) {
      await supabase
        .from('app_checkins')
        .update({ visibility: nextShowOnMap ? 'public' : 'invisible' })
        .eq('user_id', userId)
        .eq('is_active', true);
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

  /* handleAgeCommit — called by AgeRangeControl 400 ms after the
   * user stops dragging. AgeRangeControl has already busted the
   * viewer age cache so the map will pick up the new preference
   * on next refetch; we just persist and surface errors. */
  const handleAgeCommit = async (min: number, max: number) => {
    if (!userId) return;
    const { error } = await update(userId, { age_min: min, age_max: max });
    if (error) {
      Alert.alert(
        t('common.error') || 'Error',
        t('settings.ageSaveError') || 'Could not save your age range. Please try again.'
      );
    }
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

  // ─── Social links: open modal loaded with current values ──────────────
  const openSocialLinks = () => {
    const p: any = profile || {};
    setSocialIg(p.instagram_handle || '');
    setSocialTt(p.tiktok_handle || '');
    setSocialLi(p.linkedin_handle || '');
    setShowSocialLinks(true);
  };

  // Strip handle prefixes (@ or URL fragments) so users can paste either
  // "@handle", "handle", or "https://instagram.com/handle" and we store
  // the canonical bare handle.
  const normHandle = (v: string, domain: string) =>
    v.trim()
      .replace(new RegExp(`^https?://(www\\.)?${domain.replace(/\./g, '\\.')}/(@?in/)?`, 'i'), '')
      .replace(/^@/, '')
      .replace(/\/$/, '')
      .trim();

  const handleSaveSocialLinks = () => {
    const ig = normHandle(socialIg, 'instagram.com');
    const tt = normHandle(socialTt, 'tiktok.com');
    const li = normHandle(socialLi, 'linkedin.com');
    save({
      instagram_handle: ig || null,
      tiktok_handle: tt || null,
      linkedin_handle: li || null,
    });
    setShowSocialLinks(false);
    setTimeout(() => refetchProfile(), 300);
  };

  const socialSummary = (() => {
    const p: any = profile || {};
    const parts: string[] = [];
    if (p.instagram_handle) parts.push('IG');
    if (p.tiktok_handle) parts.push('TikTok');
    if (p.linkedin_handle) parts.push('LinkedIn');
    return parts.length ? parts.join(' · ') : 'not set';
  })();

  const handleDeleteAccount = () => {
    // Step 1 — explain exactly what gets deleted. Transparent per
    // Apple 5.1.1(v). No vague "all data" — spell it out.
    Alert.alert(
      'Delete Account?',
      'This will PERMANENTLY delete:\n\n' +
        '• Your profile, photo, bio, location\n' +
        '• All events and check-ins you created\n' +
        '• Your membership in all group chats\n' +
        '• Your follows, blocks, notifications\n\n' +
        'Messages you sent in group chats will stay visible to members for context, but your name will be removed.\n\n' +
        'This cannot be undone. You will need to sign up again to use nomadspeople.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Step 2 — final confirm. Two taps so it's never an accident.
            Alert.alert(
              'Are you absolutely sure?',
              'This is your last chance to cancel.\n\nTap "Delete Forever" to permanently delete your account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    if (!userId) return;
                    const { error } = await deleteAccount(userId);
                    if (error) {
                      Alert.alert('Delete failed', error.message || 'Please try again or contact support.');
                      return;
                    }
                    // deleteAccount already signs the user out; but call
                    // signOut defensively in case the session lingered.
                    signOut();
                  },
                },
              ],
            );
          },
        },
      ],
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
        <Section title={t('settings.yourDna')} sectionKey="dna" icon="heart" iconColor="#E8614D">
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
        </Section>

        {/* ═══ YOUR SOCIAL LINKS ═══ */}
        <Section title="your links" sectionKey="links" icon="link" iconColor="#60A5FA">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="link"
            label="social & website"
            sublabel={socialSummary}
            onPress={openSocialLinks}
          />
        </View>
        </Section>

        {/* ═══ VISIBILITY ═══ */}
        {/* Show-on-map row removed for v1.0 (see git history on the
            SettingsScreen.removed.tsx file that was deleted in Stage
            13). Snooze mode below is the single user-facing
            visibility toggle; handleToggleSnooze syncs show_on_map
            internally. This dual-field pattern is flagged as a
            band-aid and is scheduled for consolidation in Stage 9. */}
        <Section title="visibility" sectionKey="visibility" icon="eye" iconColor="#10B981">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
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
          {/* Age Range —
               Uses the unified AgeRangeControl so Settings,
               Onboarding and CreationBubble all render the same
               slider, and so dragging doesn't re-render this
               huge screen on every tick (which was the root
               cause of the "jumpy slider" complaint). */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.pill }]}>
              <NomadIcon name="users" size={s(7)} color={colors.dark} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.dark }]}>
                {t('settings.ageRange')}
              </Text>
              <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>
                {t('settings.ageRangeSub')}
              </Text>
              <View style={{ marginTop: s(6), marginBottom: s(2) }}>
                <AgeRangeControl
                  initialMin={profile?.age_min ?? 18}
                  initialMax={profile?.age_max ?? 100}
                  onCommit={handleAgeCommit}
                  framed
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
        </Section>

        {/* ═══ APPEARANCE ═══ */}
        <Section title={t('settings.appearance')} sectionKey="appearance" icon="moon-stars" iconColor="#8B5CF6">
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
        </Section>

        {/* ═══ LANGUAGE ═══ */}
        <Section title={t('settings.language')} sectionKey="language" icon="globe" iconColor="#F59E0B">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="globe"
            label={t('settings.appLanguage')}
            sublabel={currentLangLabel}
            onPress={() => setShowLangPicker(true)}
          />
        </View>
        </Section>

        {/* ═══ ACTIVITY NOTIFICATIONS ═══ */}
        <Section title={t('settings.notifications')} sectionKey="notifications" icon="bell" iconColor="#EC4899">
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
          {/* "Activities heating up" row removed for v1.0 — see git history on the deleted SettingsScreen.removed.tsx */}
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
          {/* "Profile views" notification removed for v1.0 — see git history on the deleted SettingsScreen.removed.tsx */}
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
          {/* "DNA matches" notification removed for v1.0 — see git history on the deleted SettingsScreen.removed.tsx */}
        </View>
        </Section>

        {/* ═══ SOCIAL ═══ */}
        <Section title={t('settings.social')} sectionKey="social" icon="share" iconColor="#06B6D4">
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
        </Section>

        {/* ═══ FEEDBACK ═══ */}
        <Section title={t('settings.feedback')} sectionKey="feedback" icon="chat" iconColor="#F97316">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="chat"
            label={t('settings.messageFounder')}
            onPress={() => Linking.openURL('mailto:support@nomadspeople.com?subject=nomadspeople Feedback')}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="star"
            label={t('settings.leaveReview')}
            onPress={() => Linking.openURL('https://apps.apple.com/app/nomadspeople')}
          />
        </View>
        </Section>

        {/* ═══ SUPPORT ═══ */}
        <Section title="support" sectionKey="support" icon="info" iconColor="#14B8A6">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="alert"
            iconColor="#F59E0B"
            label="Report an Issue"
            sublabel="Let us know if something is broken"
            onPress={() => Linking.openURL('mailto:support@nomadspeople.com?subject=nomadspeople Bug Report')}
          />
        </View>
        </Section>

        {/* ═══ LEGAL ═══ */}
        <Section title={t('settings.legal')} sectionKey="legal" icon="shield" iconColor="#6B7280">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow
            icon="shield"
            label="Legal & Safety"
            sublabel="Terms, Privacy, Guidelines, Safety Tips"
            onPress={() => nav.navigate('Legal', { type: 'terms' })}
          />
        </View>
        </Section>

        {/* DEV MODE section removed 2026-04-20 — DEV_MODE flag retired. */}

        {/* ═══ ACCOUNT ═══ */}
        <Section title={t('settings.account')} sectionKey="account" icon="user" iconColor="#3B82F6">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
          <SettingsRow icon="logout" label={t('settings.logout')} danger onPress={handleLogout} />
          <View style={styles.divider} />
          <SettingsRow icon="trash" label={t('settings.deleteAccount')} danger onPress={handleDeleteAccount} />
        </View>
        </Section>

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

      {/* ═══ Social Links Modal ═══ */}
      <Modal visible={showSocialLinks} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSocialLinks(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: s(8), paddingHorizontal: s(8) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(8) }}>
            <TouchableOpacity onPress={() => setShowSocialLinks(false)}>
              <Text style={{ fontSize: s(8), color: colors.textMuted }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: s(9), fontWeight: '700', color: colors.dark }}>your links</Text>
            <TouchableOpacity onPress={handleSaveSocialLinks}>
              <Text style={{ fontSize: s(8), color: colors.primary, fontWeight: '700' }}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: s(6), color: colors.textMuted, marginBottom: s(6) }}>
            paste a full URL or just your username — we'll figure it out. shows as icons under your profile photo.
          </Text>

          {[
            { label: 'Instagram',  value: socialIg,  setter: setSocialIg,  placeholder: '@yourhandle' },
            { label: 'TikTok',     value: socialTt,  setter: setSocialTt,  placeholder: '@yourhandle' },
            { label: 'LinkedIn',   value: socialLi,  setter: setSocialLi,  placeholder: 'username (or full /in/ URL)' },
          ].map((field) => (
            <View key={field.label} style={{ marginBottom: s(7) }}>
              <Text style={{ fontSize: s(6), color: colors.textSec, marginBottom: s(2), fontWeight: '600' }}>
                {field.label}
              </Text>
              <TextInput
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  fontSize: s(8),
                  color: colors.dark,
                  backgroundColor: colors.card,
                  borderColor: colors.borderSoft,
                  borderWidth: 1,
                  borderRadius: s(3),
                  paddingHorizontal: s(5),
                  paddingVertical: s(5),
                }}
              />
            </View>
          ))}
        </View>
      </Modal>
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

  /* Collapsible section — each header is its own card-like button so it
     reads as obviously tappable: bordered, padded, with a circular ± on
     the right and a small "tap to open / tap to close" hint. When the
     section opens, the body slots underneath the same card so the whole
     thing feels like one expanding panel. */
  sectionWrap: {
    marginHorizontal: s(8),
    marginBottom: s(6),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingVertical: s(7),
    borderRadius: s(8),
    borderWidth: 0.5,
    gap: s(5),
  },
  sectionIcon: {
    width: s(16),
    height: s(16),
    borderRadius: s(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    flex: 1,
    fontSize: s(7.5),
    fontWeight: FW.semi,
    letterSpacing: 0.1,
    textTransform: 'lowercase',
  },
  sectionHint: {
    fontSize: s(4.8),
    fontWeight: FW.regular,
    letterSpacing: 0.1,
  },
  sectionToggleBtn: {
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: {
    paddingTop: s(4),
    paddingBottom: s(6),
    paddingHorizontal: s(2),
    borderWidth: 0.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: s(8),
    borderBottomRightRadius: s(8),
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

  /* DNA Editor + Chip styles moved into
   * components/DNAEditorModal.tsx alongside the components
   * that use them (2026-04-20 scroll-jump fix). */
});
