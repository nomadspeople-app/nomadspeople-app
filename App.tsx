import { createContext, useContext, useState, useEffect, useCallback, useRef, createRef } from 'react';
import { View, ActivityIndicator, Image, StyleSheet, TouchableOpacity, I18nManager } from 'react-native';

/* One-time RTL reset (2026-04-27).
 *
 * Tester directive: the app must NOT mirror its layout when the
 * user picks Hebrew. Only the text content flips (RN handles bidi
 * automatically inside Text). The product owner explicitly does
 * not want the entire UI inverted.
 *
 * Users whose previous app version set I18nManager.forceRTL(true)
 * (when they picked Hebrew) carry that NATIVE setting forward
 * across OTAs — clearing it requires an explicit reset call.
 * This top-level statement runs once when the JS bundle loads,
 * BEFORE any component renders. The first time a user with the
 * stuck-RTL state opens the new bundle, this fires forceRTL(false);
 * the current session still renders with the old NATIVE state
 * (forceRTL needs app reload), but on the NEXT launch the layout
 * is back to LTR for everyone, regardless of locale.
 *
 * After v15 (or after every existing tester has reloaded once),
 * this side-effect is a no-op. Safe to leave in. */
if (I18nManager.isRTL) {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}
import { NavigationContainer, NavigationContainerRef, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useI18n } from './lib/i18n';
import NomadIcon from './components/NomadIcon';
import type { NomadIconName } from './components/NomadIcon';
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  parseNotificationNavigation,
  setBadgeCount,
  setUserNotificationPrefs,
} from './lib/notifications';
import HomeScreen from './screens/HomeScreen';
import PeopleScreen from './screens/PeopleScreen';
import PulseScreen from './screens/PulseScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatScreen from './screens/ChatScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AuthScreen from './screens/AuthScreen';
// PostFeedScreen saved for future use
// import PostFeedScreen from './screens/PostFeedScreen';
import PhotoViewerScreen from './screens/PhotoViewerScreen';
import SettingsScreen from './screens/SettingsScreen';
import GroupInfoScreen from './screens/GroupInfoScreen';
import LegalScreen from './screens/LegalScreen';
import FlightDetailScreen from './screens/FlightDetailScreen';
import BlockedUsersScreen from './screens/BlockedUsersScreen';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { useUnreadTotal } from './lib/hooks';
import { s, C, FW, getColors, ThemeContext } from './lib/theme';
import type { RootTabParamList, RootStackParamList } from './lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { I18nContext, translate, isRTL, applyRTL, type Locale } from './lib/i18n';
import { requestOnboardingPermissions } from './lib/permissions';
import { checkForOtaUpdate } from './lib/updates';
import { initSentry, setSentryUser, clearSentryUser, wrapWithSentry } from './lib/sentry';

/* ─── Sentry init — runs at module load, before React renders.
 *    initSentry is idempotent + graceful (no-ops in Expo Go / if
 *    DSN missing), so this is safe to call unconditionally at the
 *    top level. Placing it here (vs inside a useEffect) means even
 *    errors during the very first render are captured. */
initSentry();

/* ─── Auth Context ─── */
interface AuthCtx {
  userId: string | null;
  signOut: () => void;
  resetOnboarding: () => void;
  switchDevUser?: () => void;
  devUserLabel?: string;
  justFinishedSetup?: boolean;
  clearSetupFlag?: () => void;
}
export const AuthContext = createContext<AuthCtx>({ userId: null, signOut: () => {}, resetOnboarding: () => {} });
export const useAuthContext = () => useContext(AuthContext);

/* ─── Unread Badge Context ─── */
interface UnreadCtx { total: number; refetch: () => void; }
export const UnreadContext = createContext<UnreadCtx>({ total: 0, refetch: () => {} });
export const useUnreadContext = () => useContext(UnreadContext);

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<string, NomadIconName> = {
  Home: 'compass',
  People: 'users-3',
  Pulse: 'chat',
  Profile: 'user',
};

/* ─── Dev bypass: auto sign-in to a real Supabase auth session so RLS works.
 * Previously this just injected a fake user_id, which meant:
 *   - app_profiles writes failed silently (FK + RLS)
 *   - People tab returned nothing (RLS policies reject non-authed reads)
 *   - Settings updates (age range etc.) silently no-op'd
 * Removed 2026-04-20: the entire DEV_MODE auto-signin block was deleted
 * along with the hardcoded credentials it carried. The app now uses the
 * normal AuthScreen flow for everyone — including developers — which is
 * how production users sign in. Sessions persist via Supabase's
 * persistSession (lib/supabase.ts), so a developer signs in once and
 * stays signed in across reloads.
 *
 * Why removed:
 *   - The hardcoded password sat in the JS bundle. Anyone reverse-
 *     engineering an APK / IPA could read it.
 *   - The DEV_MODE auto-signin had a destructive failure mode: when
 *     Supabase auth was unreachable the local userId was still set
 *     to the dev account, but with no real session — so RLS blocked
 *     all queries, the profile lookup returned empty, and the user
 *     was routed into onboarding where they could overwrite their
 *     own profile.
 *   - The "switchDevUser" UI in Settings is now hidden because the
 *     hooks that surfaced it are gone (switchDevUser context value
 *     is undefined → conditional render in SettingsScreen drops it). */

/**
 * Floating Plus button rendered as an overlay above the tab bar.
 *
 * Lives inside <MainTabs/>, as a sibling of <Tab.Navigator/>. Sits
 * absolute-positioned at the bottom center, half-overlapping the
 * tab bar's top edge — Instagram / Spotify / X pattern. White
 * surface, black border, black plus icon — intentionally distinct
 * from tab icons so the eye reads it as the primary action across
 * every tab.
 *
 * The FAB disappears automatically when the user is inside Chat,
 * GroupInfo, Settings, etc. (those are Stack screens above
 * MainTabs). Rendering inside MainTabs gives that for free —
 * React Navigation hides the whole stack frame when the active
 * stack screen is something else.
 *
 * NAVIGATION MODEL — nested navigate:
 *   useNavigation() inside this component returns the STACK
 *   navigator, because CreateFab is a sibling of <Tab.Navigator/>,
 *   not a child. The Stack has no screen named 'Home' — only
 *   'MainTabs'. Calling `navigate('Home', ...)` on the Stack
 *   raises "was not handled by any navigator". The right form is
 *   the nested payload documented at
 *   https://reactnavigation.org/docs/nesting-navigators#navigating-to-a-screen-in-a-nested-navigator —
 *   navigate to the parent screen ('MainTabs') and pass
 *   { screen: 'Home', params: {...} } so the Tab navigator
 *   receives it.
 *
 * We use Date.now() as a nonce so repeat taps re-fire useEffect
 * even when the user is already on the Home tab (HomeScreen
 * clears the param right after consuming it).
 *
 * pointerEvents='box-none' on the wrapper lets touches pass
 * through the surrounding transparent area to the underlying tab
 * bar buttons.
 */
function CreateFab() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  // Typed against the Stack navigator on purpose — useNavigation
  // here returns the Stack (CreateFab is a sibling of the Tab
  // navigator, not a child). With the Stack typing, attempting to
  // navigate('Home', ...) becomes a compile-time error because
  // 'Home' isn't a stack screen — forcing the correct nested form.
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Tab bar visible height (matches tabBarStyle below): s(30) + insets.bottom.
  // Center the FAB on the TOP edge of the tab bar so it's half above /
  // half over. Button size s(28); we want its vertical center at
  // (tab bar top edge) → bottom = (s(30) + insets.bottom) - s(14).
  const tabBarHeight = s(30) + insets.bottom;
  const buttonSize = s(28);
  const bottomOffset = tabBarHeight - buttonSize / 2;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <TouchableOpacity
        accessibilityLabel={t('home.createActivity')}
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          // Nested form — see comment above. Navigates to the
          // 'MainTabs' Stack screen with an inner 'screen: Home'
          // payload so the Tab navigator switches to Home and
          // delivers the openCreate nonce as route.params.
          navigation.navigate('MainTabs', {
            screen: 'Home',
            params: { openCreate: Date.now() },
          });
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5,
          borderColor: '#1A1A1A',
          alignItems: 'center',
          justifyContent: 'center',
          // iOS shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          // Android shadow
          elevation: 6,
        }}
      >
        <NomadIcon name="plus" size={s(12)} color="#1A1A1A" strokeWidth={2.4} />
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  const { colors } = useContext(ThemeContext);
  const { total: unreadTotal } = useContext(UnreadContext);
  const { userId } = useAuthContext();
  const insets = useSafeAreaInsets();

  /* Fetch user avatar for Profile tab */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    supabase.from('app_profiles').select('avatar_url').eq('user_id', userId).single()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
  }, [userId]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, focused }) => {
            if (route.name === 'Profile') {
              return avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={[
                    tabStyles.avatar,
                    { borderColor: focused ? colors.primary : 'transparent' },
                  ]}
                />
              ) : (
                <NomadIcon name="user" size={s(9)} color={color} strokeWidth={1.8} />
              );
            }
            return <NomadIcon name={TAB_ICONS[route.name]} size={s(9)} color={color} strokeWidth={1.8} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#1A1A1A',
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            height: s(30) + insets.bottom,
            paddingBottom: insets.bottom || s(4),
          },
          tabBarLabelStyle: {
            fontSize: s(5),
            fontWeight: FW.medium,
            marginBottom: s(1),
          },
          tabBarIconStyle: {
            marginTop: s(2),
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="People" component={PeopleScreen} />
        <Tab.Screen name="Pulse" component={PulseScreen} options={{
          tabBarLabel: 'Messages',
          tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#1A1A2E',
            fontSize: s(5),
            fontWeight: FW.bold as any,
            minWidth: s(9),
            height: s(9),
            lineHeight: s(9),
            borderRadius: s(4.5),
          },
        }} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      {/* Floating create-activity button — visible across every tab,
          half-overlapping the tab bar's top edge. */}
      <CreateFab />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  avatar: {
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    borderWidth: 2,
  },
});

/* ─── Navigation ref for deep linking from notifications ─── */
const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();

function App() {
  const { userId: authUserId, loading: authLoading, signOut } = useAuth();

  // Single source of truth — whatever Supabase session says.
  const userId = authUserId;
  const loading = authLoading;

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  // Theme state
  const [isDark, setIsDark] = useState(false);
  const colors = getColors(isDark);

  // i18n state
  const [locale, setLocaleState] = useState<Locale>('en');
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    applyRTL(l);
  }, []);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
  const i18nValue = { locale, setLocale, t, isRTL: isRTL(locale) };

  const toggleDark = useCallback((val: boolean) => {
    setIsDark(val);
  }, []);

  /* Sentry user context — attach userId after auth so every
     error captured after this point carries the user's id. On
     sign-out (userId → null), the context is cleared so errors
     from the next signed-in user aren't mis-attributed. We
     never send email, display name, or any PII beyond user_id.
     Graceful: setSentryUser is a no-op when Sentry isn't
     initialized (Expo Go, missing DSN, init failure). */
  useEffect(() => {
    if (userId) {
      setSentryUser(userId);
    } else {
      clearSentryUser();
    }
  }, [userId]);

  /* OTA update check — fire-and-forget on cold launch.
   *
   * Runs ONCE when the App component mounts. If a newer JS
   * bundle is available on the current channel, it gets
   * downloaded in the background; the user keeps using the
   * current build and the new one applies on their next
   * cold launch.
   *
   * Safe in every environment:
   *   • Expo Go / dev client → isEnabled=false → no-op
   *   • expo-updates not installed → import fails → no-op
   *   • Network offline → catch fires → no-op, retry next launch
   *
   * Critical launch-readiness: without this, a single crashy
   * bug after launch requires App Store resubmission (1-3
   * days). With this, `eas update --branch production` ships
   * the fix in minutes. */
  useEffect(() => {
    void checkForOtaUpdate().then(outcome => {
      if (outcome.state === 'downloaded') {
        console.log('[updates] new bundle downloaded; will apply on next cold launch');
      }
    });
  }, []);

  // After login, check if user completed onboarding + load dark_mode
  useEffect(() => {
    if (!userId) {
      setOnboardingDone(null);
      return;
    }

    setCheckingProfile(true);
    (async () => {
      const { data } = await supabase
        .from('app_profiles')
        .select('onboarding_done, dark_mode, app_language')
        .eq('user_id', userId)
        .single();

      setOnboardingDone(data?.onboarding_done ?? false);
      setIsDark(data?.dark_mode ?? false);
      if (data?.app_language) {
        setLocale(data.app_language as Locale);
      }
      setCheckingProfile(false);
    })();
  }, [userId]);

  const [justFinishedSetup, setJustFinishedSetup] = useState(false);

  const handleOnboardingComplete = async () => {
    // Mark onboarding as done in DB (upsert — brand-new users may not yet
    // have an app_profiles row; plain UPDATE would silently no-op).
    if (userId) {
      await supabase
        .from('app_profiles')
        .upsert({ user_id: userId, onboarding_done: true }, { onConflict: 'user_id' });
    }
    setJustFinishedSetup(true);
    setOnboardingDone(true);

    /* Ask the 3 onboarding permissions (location →
     * notifications → ATT on iOS) in a paced sequence. Fire
     * AFTER marking onboarding done so the user is already
     * committed to the app — permission prompts during
     * onboarding feel intrusive; after it, expected.
     *
     * Fire-and-forget: we don't block the transition on the
     * result. Individual per-feature re-request paths still
     * exist (HomeScreen's map, etc.) for users who deny
     * initially. */
    void requestOnboardingPermissions().then(outcomes => {
      console.log('[onboarding] permissions:', outcomes);
    });
  };

  const resetOnboarding = useCallback(() => {
    setOnboardingDone(false);
  }, []);

  // ─── Unread badge hook — must be before any early returns (Rules of Hooks) ───
  const { total: unreadTotal, refetch: refetchUnread } = useUnreadTotal(userId);

  // ─── Push Notifications: register + listeners ───
  const notifReceivedSub = useRef<any>(null);
  const notifResponseSub = useRef<any>(null);

  useEffect(() => {
    if (!userId || !onboardingDone) return;

    // Register for push notifications (requests permission + saves token)
    registerForPushNotifications(userId).catch((err) =>
      console.warn('[App] Push registration failed:', err)
    );

    // Sync user notification preferences so foreground handler respects them
    (async () => {
      // 1. Fetch notification prefs from profile.
      //    `show_on_map` doubles as the quiet-mode switch (when
      //    false, non-essential notifications are suppressed),
      //    replacing the deprecated `snooze_mode` field.
      const { data: prefs } = await supabase.from('app_profiles')
        .select('notify_nearby, notify_heating, notify_profile_view, notify_chat, notify_activity_joined, notify_dna_match, notify_flight_incoming, show_on_map, notification_distance_km')
        .eq('user_id', userId).single();

      // 2. Fetch user's latest active checkin location
      const { data: checkin } = await supabase.from('app_checkins')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prefs) {
        setUserNotificationPrefs({
          ...prefs,
          user_lat: checkin?.latitude ?? null,
          user_lng: checkin?.longitude ?? null,
        });
      }
    })();

    // Clear badge when app opens
    setBadgeCount(0).catch(() => {});

    // Listen for notifications received while app is in foreground
    notifReceivedSub.current = addNotificationReceivedListener((notification) => {
      console.log('[App] Notification received:', notification.request.content.title);
      // Refresh unread count
      refetchUnread();
    });

    // Listen for notification taps (app was in background or killed)
    notifResponseSub.current = addNotificationResponseListener((response) => {
      console.log('[App] Notification tapped');
      setBadgeCount(0).catch(() => {});

      const nav = parseNotificationNavigation(response);
      if (nav && navigationRef.current) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          try {
            (navigationRef.current as any)?.navigate(nav.screen, nav.params);
          } catch (e) {
            console.warn('[App] Navigation from notification failed:', e);
          }
        }, 500);
      }
    });

    return () => {
      notifReceivedSub.current?.remove();
      notifResponseSub.current?.remove();
    };
  }, [userId, onboardingDone]);

  // ─── Loading: auth check ───
  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  // ─── Not logged in → Auth screen ───
  if (!userId) {
    return (
      <SafeAreaProvider>
        <AuthScreen onSuccess={() => {}} />
      </SafeAreaProvider>
    );
  }

  // ─── Loading: profile check ───
  if (checkingProfile || onboardingDone === null) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  // ─── Logged in but hasn't completed setup → Setup flow ───
  if (!onboardingDone) {
    return (
      <I18nContext.Provider value={i18nValue}>
        <SafeAreaProvider>
          <OnboardingScreen onComplete={handleOnboardingComplete} userId={userId} />
        </SafeAreaProvider>
      </I18nContext.Provider>
    );
  }

  // ─── Logged in + onboarded → Main app ───
  return (
    <I18nContext.Provider value={i18nValue}>
      <ThemeContext.Provider value={{ isDark, colors, toggleDark }}>
        <AuthContext.Provider value={{
          userId, signOut, resetOnboarding,
          // switchDevUser + devUserLabel retired with DEV_MODE. The
          // type keeps them optional so legacy consumers (SettingsScreen)
          // just render nothing when they're undefined.
          justFinishedSetup,
          clearSetupFlag: () => setJustFinishedSetup(false),
        }}>
          <UnreadContext.Provider value={{ total: unreadTotal, refetch: refetchUnread }}>
          <SafeAreaProvider>
            <NavigationContainer ref={navigationRef}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen
                  name="Chat"
                  component={ChatScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="UserProfile"
                  component={ProfileScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="PhotoViewer"
                  component={PhotoViewerScreen}
                  options={{ animation: 'slide_from_bottom' }}
                />
                <Stack.Screen
                  name="GroupInfo"
                  component={GroupInfoScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="Settings"
                  component={SettingsScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="Legal"
                  component={LegalScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="BlockedUsers"
                  component={BlockedUsersScreen}
                  options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen
                  name="FlightDetail"
                  component={FlightDetailScreen}
                  options={{ animation: 'slide_from_bottom' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </SafeAreaProvider>
          </UnreadContext.Provider>
        </AuthContext.Provider>
      </ThemeContext.Provider>
    </I18nContext.Provider>
  );
}

/* Wrap App with Sentry's error boundary so render-phase throws
   are captured. wrapWithSentry is graceful — if Sentry isn't
   available (Expo Go, missing DSN), it returns the component
   unchanged. Either way the default export stays a valid React
   component. */
export default wrapWithSentry(App);
