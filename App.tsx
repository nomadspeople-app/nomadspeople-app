import { createContext, useContext, useState, useEffect, useCallback, useRef, createRef } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { useUnreadTotal } from './lib/hooks';
import { s, C, FW, getColors, ThemeContext } from './lib/theme';
import type { RootTabParamList, RootStackParamList } from './lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { I18nContext, translate, isRTL, applyRTL, type Locale } from './lib/i18n';

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
 * Now DEV_MODE actually authenticates as the dev user.
 * Before enabling DEV_MODE in a fresh Supabase project, create matching rows
 * in auth.users + app_profiles with the passwords below. ───────────────── */
// Product decision (2026-04-19): one dev account only — barakperez@gmail.com.
// Every change in dev is tested against real data from the founder's own
// account, not dummy data. Test accounts (barak_test / test_nomad) are kept
// commented below so they can be re-enabled for multi-user scenarios
// (testing chat between two users, etc.) without re-creating DB rows.
const DEV_MODE = __DEV__;
const DEV_USERS = [
  { id: '91bfaacb-aea4-40d4-af67-7421b05be39d', label: 'Barak', email: 'barakperez@gmail.com', password: 'NomadsPeopleDev2026!' },
  // { id: '88888888-8888-8888-8888-888888888888', label: 'Barak (test)', email: 'barak_test@nomadspeople.dev', password: 'NomadsPeopleDev2026!' },
  // { id: '99999999-9999-9999-9999-999999999999', label: 'Test Nomad',   email: 'test_nomad@nomadspeople.dev', password: 'NomadsPeopleDev2026!' },
];
const DEV_USER_ID = DEV_USERS[0].id;

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

export default function App() {
  const { userId: authUserId, loading: authLoading, signOut } = useAuth();

  // In dev mode: switchable dev users, persisted per device
  const [devUserIdx, setDevUserIdx] = useState(0);
  const [devUserLoaded, setDevUserLoaded] = useState(false);
  const userId = DEV_MODE ? DEV_USERS[devUserIdx].id : authUserId;
  const loading = DEV_MODE ? !devUserLoaded : authLoading;

  // Load saved dev user choice on startup
  useEffect(() => {
    if (!DEV_MODE) { setDevUserLoaded(true); return; }
    AsyncStorage.getItem('dev_user_idx')
      .then((val) => {
        if (val !== null) setDevUserIdx(Number(val));
      })
      .catch(() => {})
      .finally(() => setDevUserLoaded(true));
  }, []);

  // DEV_MODE: sign in as the selected dev user so we have a real Supabase auth
  // session. Without this, RLS policies block all reads/writes and the app
  // looks half-broken (empty People tab, settings saves silently fail, etc.).
  useEffect(() => {
    if (!DEV_MODE || !devUserLoaded) return;
    let cancelled = false;
    const dev = DEV_USERS[devUserIdx];
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      // Already signed in as the right dev user? done.
      if (session?.user?.id === dev.id) return;
      // Signed in as a DIFFERENT user (e.g. after switchDevUser) — sign out first.
      if (session) {
        await supabase.auth.signOut();
        if (cancelled) return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: dev.email,
        password: dev.password,
      });
      if (error) console.warn('[DEV_MODE] auto sign-in failed:', error.message);
    })();
    return () => { cancelled = true; };
  }, [devUserIdx, devUserLoaded]);

  // Save when switching
  const switchDevUser = useCallback(() => {
    setDevUserIdx((i) => {
      const next = (i + 1) % DEV_USERS.length;
      AsyncStorage.setItem('dev_user_idx', String(next));
      return next;
    });
  }, []);

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
      // 1. Fetch notification prefs from profile
      const { data: prefs } = await supabase.from('app_profiles')
        .select('notify_nearby, notify_heating, notify_profile_view, notify_chat, notify_activity_joined, notify_dna_match, notify_flight_incoming, snooze_mode, notification_distance_km')
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

  // ─── Not logged in → Auth screen (skipped in DEV_MODE) ───
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
          switchDevUser: DEV_MODE ? switchDevUser : undefined,
          devUserLabel: DEV_MODE ? DEV_USERS[devUserIdx].label : undefined,
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
