import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Dimensions, Animated, Image, Alert, Platform,
  KeyboardAvoidingView, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { COUNTRIES, POPULAR_CITIES } from '../lib/countries';
import { useI18n, type Locale, SUPPORTED_LOCALES } from '../lib/i18n';
import DualThumbSlider from '../components/DualThumbSlider';

const APP_ICON = require('../assets/icon.png');

const { width: SW } = Dimensions.get('window');
const TOTAL_STEPS = 13; // 0-12

/* ─── Gender Options ─── */
const GENDER_OPTIONS = [
  { emoji: '👨', label: 'man' },
  { emoji: '👩', label: 'woman' },
  { emoji: '✨', label: 'other' },
];

/* ─── Languages ─── */
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
];

/* ─── Step data ─── */
const NOMAD_TYPES = [
  { emoji: '💻', label: 'digital nomad', sub: 'working remotely while traveling' },
  { emoji: '🏠', label: 'remote worker', sub: 'work from home, travel sometimes' },
  { emoji: '🚀', label: 'startup founder', sub: 'building on the go' },
  { emoji: '✍️', label: 'freelancer', sub: 'independent work, flexible location' },
  { emoji: '🌍', label: 'expat', sub: 'living abroad long-term' },
  { emoji: '🎒', label: 'traveler', sub: 'exploring the world' },
];

const INTERESTS = [
  { cat: 'work & productivity', items: [
    { emoji: '💻', label: 'co-working' }, { emoji: '☕', label: 'cafe work' },
    { emoji: '📡', label: 'fast wifi' }, { emoji: '🤝', label: 'networking' },
    { emoji: '🎯', label: 'focus' }, { emoji: '📝', label: 'planning' },
  ]},
  { cat: 'social & nightlife', items: [
    { emoji: '🍻', label: 'nightlife' }, { emoji: '🎉', label: 'events' },
    { emoji: '🍽️', label: 'food & drinks' }, { emoji: '💬', label: 'meetups' },
    { emoji: '🎤', label: 'karaoke' }, { emoji: '🎶', label: 'live music' },
  ]},
  { cat: 'outdoor & active', items: [
    { emoji: '🏄', label: 'surfing' }, { emoji: '🥾', label: 'hiking' },
    { emoji: '🚴', label: 'cycling' }, { emoji: '🧘', label: 'yoga' },
    { emoji: '🏃', label: 'running' }, { emoji: '🧗', label: 'climbing' },
  ]},
  { cat: 'lifestyle', items: [
    { emoji: '📸', label: 'photography' }, { emoji: '🎵', label: 'music' },
    { emoji: '📚', label: 'reading' }, { emoji: '🌱', label: 'wellness' },
    { emoji: '🎨', label: 'art' }, { emoji: '✈️', label: 'travel' },
  ]},
];

const LOOKING_FOR = [
  { emoji: '👋', label: 'friends' },
  { emoji: '🧳', label: 'travel buddies' },
  { emoji: '💼', label: 'work partners' },
  { emoji: '❤️', label: 'dating' },
  { emoji: '🏠', label: 'roommates' },
  { emoji: '🧑‍🏫', label: 'mentorship' },
];

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

/* ─── Validation ─── */
function sanitizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/\s/g, '_').replace(/[^a-z0-9._\-]/g, '').slice(0, 30);
}

function extractInstagramHandle(input: string): string {
  const match = input.match(/(?:instagram\.com\/)([a-zA-Z0-9._]+)/);
  if (match) return match[1].toLowerCase();
  return input.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '');
}

/* ─── Grid ─── */
const CHIP_GAP = s(3);
const GRID_PAD = s(14);
const CHIP_W = (SW - GRID_PAD * 2 - CHIP_GAP * 2) / 3;

interface OnboardingScreenProps {
  onComplete: () => void;
  userId: string;
}

export default function OnboardingScreen({ onComplete, userId }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { t, setLocale: setI18nLocale } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  /* ─── User selections ─── */
  const yearScrollRef = useRef<ScrollView>(null);
  const [appLanguage, setAppLanguage] = useState('en');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [instagramRaw, setInstagramRaw] = useState('');
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [birthMonth, setBirthMonth] = useState(1);
  const [birthDay, setBirthDay] = useState(1);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [gender, setGender] = useState<number | null>(null);
  const [ageRangeMin, setAgeRangeMin] = useState(18);
  const [ageRangeMax, setAgeRangeMax] = useState(100);
  const [nomadType, setNomadType] = useState<number | null>(null);

  // Country autocomplete
  const [homeCountry, setHomeCountry] = useState('');
  const [homeCountryQuery, setHomeCountryQuery] = useState('');
  const [showCountryList, setShowCountryList] = useState(false);

  // City autocomplete
  const [currentCity, setCurrentCity] = useState('');
  const [currentCityQuery, setCurrentCityQuery] = useState('');
  const [showCityList, setShowCityList] = useState(false);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);

  /* Trip + permissions */
  const [discoverNearby, setDiscoverNearby] = useState(true);
  const [appearNearby, setAppearNearby] = useState(true);
  const [tripCountry, setTripCountry] = useState('');
  const [tripCountryQuery, setTripCountryQuery] = useState('');
  const [showTripCountryList, setShowTripCountryList] = useState(false);
  const [tripArrivalDate, setTripArrivalDate] = useState<Date | null>(null);
  const [tripDepartureDate, setTripDepartureDate] = useState<Date | null>(null);
  const [showArrivalCal, setShowArrivalCal] = useState(false);
  const [showDepartureCal, setShowDepartureCal] = useState(false);
  const [calViewMonth, setCalViewMonth] = useState(new Date());

  /* ─── Trip country autocomplete ─── */
  const filteredTripCountries = useMemo(() => {
    if (!tripCountryQuery || tripCountryQuery.length < 1) return [];
    const q = tripCountryQuery.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [tripCountryQuery]);

  /* ─── Country autocomplete ─── */
  const filteredCountries = useMemo(() => {
    if (!homeCountryQuery || homeCountryQuery.length < 1) return [];
    const q = homeCountryQuery.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [homeCountryQuery]);

  /* ─── City autocomplete ─── */
  const filteredCities = useMemo(() => {
    if (!currentCityQuery) return POPULAR_CITIES.slice(0, 10);
    const q = currentCityQuery.toLowerCase();
    return POPULAR_CITIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [currentCityQuery]);

  const animateTransition = (next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const goNext = () => {
    // Age verification on step 3
    if (step === 3) {
      const age = getAge();
      if (age < 18) {
        Alert.alert('age requirement', 'you must be at least 18 years old to join nomadspeople.');
        return;
      }
      if (!ageConfirmed) {
        Alert.alert(
          'confirm your age',
          `you entered ${birthDay} ${MONTHS[birthMonth - 1]} ${birthYear} (age ${age}). is this your real date of birth?\n\nthis cannot be changed later.`,
          [
            { text: 'edit', style: 'cancel' },
            { text: 'confirm', onPress: () => { setAgeConfirmed(true); animateTransition(step + 1); } },
          ]
        );
        return;
      }
    }

    // Step 10 (looking for) → save profile → go to permissions
    if (step === 10) {
      handleSaveProfile();
      return;
    }

    // Step 11 (permissions) → go to trip
    if (step === 11) {
      animateTransition(12);
      return;
    }

    // Step 12 (trip, last step) → save trip if filled, then finish
    if (step === 12) {
      if (tripCountry && tripArrivalDate) {
        handleAddTripAndFinish();
      } else {
        handleFinishOnboarding();
      }
      return;
    }

    if (step < TOTAL_STEPS - 1) animateTransition(step + 1);
    else handleFinishOnboarding();
  };

  const goBack = () => {
    if (step > 0) animateTransition(step - 1);
  };

  const getAge = () => {
    if (!birthYear) return 0;
    const today = new Date();
    const birth = new Date(birthYear, birthMonth - 1, birthDay);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleUsernameChange = (raw: string) => {
    const clean = sanitizeUsername(raw);
    setUsername(clean);
    if (usernameCheckRef.current) clearTimeout(usernameCheckRef.current);

    if (clean.length < 3) {
      setUsernameError('at least 3 characters');
      setCheckingUsername(false);
      return;
    }

    setUsernameError('');
    setCheckingUsername(true);

    usernameCheckRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('app_profiles')
        .select('user_id')
        .eq('username', clean)
        .neq('user_id', userId || '')
        .limit(1);

      if (data && data.length > 0) {
        setUsernameError('username already taken');
      } else {
        setUsernameError('');
      }
      setCheckingUsername(false);
    }, 500);
  };

  const toggleInterest = (label: string) => {
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) :
        prev.length < 10 ? [...prev, label] : prev
    );
  };

  const toggleLooking = (label: string) => {
    setLookingFor((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  /* Save profile data */
  const handleSaveProfile = async () => {
    const birthDate = birthYear ? `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}` : null;
    const igHandle = extractInstagramHandle(instagramRaw);

    await supabase
      .from('app_profiles')
      .update({
        full_name: displayName.trim() || username || null,
        display_name: displayName.trim() || null,
        username: username || null,
        birth_date: birthDate,
        age_verified: true,
        gender: gender !== null ? GENDER_OPTIONS[gender].label : null,
        age_min: ageRangeMin,
        age_max: ageRangeMax,
        instagram_handle: igHandle || null,
        job_type: nomadType !== null ? NOMAD_TYPES[nomadType].label : null,
        home_country: homeCountry || null,
        current_city: currentCity || null,
        interests: selectedInterests,
        looking_for: lookingFor,
        app_language: appLanguage,
      })
      .eq('user_id', userId);

    animateTransition(11); // go to permissions step
  };

  /* Add trip */
  const formatDate = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD
  const formatDateDisplay = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const handleAddTripAndFinish = async () => {
    if (!tripCountry || !tripArrivalDate) return;
    const arrStr = formatDate(tripArrivalDate);
    const depStr = tripDepartureDate ? formatDate(tripDepartureDate) : null;
    const flag = COUNTRIES.find(c => c.name === tripCountry)?.flag || '';

    // Save trip to profile
    await supabase.from('app_profiles').update({
      next_destination: tripCountry,
      next_destination_date: arrStr,
      next_destination_flag: flag,
      next_departure_date: depStr,
    }).eq('user_id', userId);

    handleFinishOnboarding();
  };
  const handleFinishOnboarding = () => { onComplete(); };

  /* ─── Steps ─── */
  // 0: Welcome, 1: Language, 2: Username+IG, 3: Birth, 4: Gender, 5: AgeRange,
  // 6: NomadType, 7: HomeCountry, 8: CurrentCity, 9: Interests, 10: LookingFor,
  // 11: Permissions, 12: Trip (last)

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return !!appLanguage;
      case 2: return username.length >= 3 && !usernameError && !checkingUsername && displayName.trim().length >= 2;
      case 3: return birthYear !== null;
      case 4: return gender !== null;
      case 5: return true; // age range always has defaults
      case 6: return nomadType !== null;
      case 7: return true;
      case 8: return true;
      case 9: return selectedInterests.length >= 1;
      case 10: return lookingFor.length >= 1;
      case 11: return true; // permissions
      case 12: return true; // trip is optional
      default: return true;
    }
  };

  const ctaLabel = () => {
    if (step === 0) return t('setup.getStarted');
    if (step === 11) return t('setup.next'); // permissions
    if (step === 12) return tripCountry && tripArrivalDate ? 'add trip' : t('setup.skip');
    if (step === 7) return homeCountry ? t('setup.next') : t('setup.skip');
    if (step === 8) return currentCity ? t('setup.next') : t('setup.skip');
    return t('setup.next');
  };

  const progressWidth = step === 0 ? 0 : ((step) / (TOTAL_STEPS - 1)) * 100;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => currentYear - 18 - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Year picker starts from top (newest eligible years) — no auto-scroll

  /* ─── Render ─── */
  const renderStep = () => {
    switch (step) {

      /* ── 0: Welcome ── */
      case 0:
        return (
          <View style={st.centerContent}>
            <Image source={APP_ICON} style={st.logoImage} />
            <Text style={st.welcomeTitle}>nomadspeople</Text>
            <Text style={st.welcomeSub}>find your neighborhood.{'\n'}meet your people.</Text>
            <View style={st.featureList}>
              {[
                { icon: 'pin' as const, text: 'neighborhood-level intelligence' },
                { icon: 'users' as const, text: 'connect with nomads near you' },
                { icon: 'calendar' as const, text: 'join events & co-working sessions' },
              ].map((f, i) => (
                <View key={i} style={st.featureRow}>
                  <View style={st.featureIcon}><NomadIcon name={f.icon} size={s(7)} color={colors.primary} strokeWidth={1.6} /></View>
                  <Text style={st.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      /* ── 1: Language ── */
      case 1:
        return (
          <View>
            <Text style={st.question}>{t('setup.chooseLanguage')}</Text>
            <Text style={st.subtitle}>{t('setup.languageSub')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: s(160) }}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[st.langRow, appLanguage === lang.code && st.langRowSel]}
                  onPress={() => {
                    setAppLanguage(lang.code);
                    if (SUPPORTED_LOCALES.includes(lang.code as Locale)) {
                      setI18nLocale(lang.code as Locale);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={st.langFlag}>{lang.flag}</Text>
                  <Text style={[st.langLabel, appLanguage === lang.code && st.langLabelSel]}>{lang.label}</Text>
                  {appLanguage === lang.code && (
                    <View style={st.checkCircle}><NomadIcon name="check" size={s(5)} color="white" strokeWidth={1.4} /></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      /* ── 2: Username + Instagram ── */
      case 2:
        return (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={st.question}>{t('setup.username')}</Text>
            <Text style={st.subtitle}>{t('setup.usernameSub')}</Text>
            <View style={st.inputWrap}>
              <Text style={st.inputPrefix}>@</Text>
              <TextInput
                style={[st.textInput, { paddingLeft: s(20) }]}
                placeholder="yourname"
                placeholderTextColor="#B0ADA5"
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {usernameError ? <Text style={st.errorText}>{usernameError}</Text>
              : checkingUsername ? <Text style={st.checkingText}>checking availability...</Text>
              : username.length >= 3 ? <Text style={st.successText}>@{username} is available</Text>
              : null}

            <Text style={[st.question, { marginTop: s(14) }]}>your name</Text>
            <Text style={st.subtitle}>this is how other nomads will see you</Text>
            <TextInput
              style={st.textInput}
              placeholder="Barak Perez"
              placeholderTextColor="#B0ADA5"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {displayName.trim().length >= 2 && (
              <Text style={st.successText}>hi {displayName.trim()}!</Text>
            )}

            <Text style={[st.question, { marginTop: s(14) }]}>instagram (optional)</Text>
            <Text style={st.subtitle}>connect your instagram so nomads can find you</Text>
            <TextInput
              style={st.textInput}
              placeholder="@handle or instagram.com/handle"
              placeholderTextColor="#B0ADA5"
              value={instagramRaw}
              onChangeText={setInstagramRaw}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {instagramRaw.length > 0 && (
              <Text style={st.successText}>will save as: @{extractInstagramHandle(instagramRaw)}</Text>
            )}
            <View style={{ height: s(10) }} />
          </ScrollView>
        );

      /* ── 3: Birth Date ── */
      case 3:
        return (
          <View>
            <Text style={st.question}>{t('setup.birthYear')}</Text>
            <Text style={st.subtitle}>{t('setup.birthYearSub')}</Text>
            <View style={st.datePickerRow}>
              <View style={st.dateColumn}>
                <Text style={st.dateColLabel}>day</Text>
                <ScrollView style={st.dateScroll} showsVerticalScrollIndicator={false}>
                  {days.map(d => (
                    <TouchableOpacity key={d} style={[st.dateItem, birthDay === d && st.dateItemActive]} onPress={() => { setBirthDay(d); setAgeConfirmed(false); }}>
                      <Text style={[st.dateItemText, birthDay === d && st.dateItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={st.dateColumn}>
                <Text style={st.dateColLabel}>month</Text>
                <ScrollView style={st.dateScroll} showsVerticalScrollIndicator={false}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity key={m} style={[st.dateItem, birthMonth === i + 1 && st.dateItemActive]} onPress={() => { setBirthMonth(i + 1); setAgeConfirmed(false); }}>
                      <Text style={[st.dateItemText, birthMonth === i + 1 && st.dateItemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={st.dateColumn}>
                <Text style={st.dateColLabel}>year</Text>
                <ScrollView style={st.dateScroll} showsVerticalScrollIndicator={false}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[st.dateItem, birthYear === y && st.dateItemActive]} onPress={() => { setBirthYear(y); setAgeConfirmed(false); }}>
                      <Text style={[st.dateItemText, birthYear === y && st.dateItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            {birthYear && <Text style={st.datePreview}>{birthDay} {MONTHS[birthMonth - 1]} {birthYear} · age {getAge()}</Text>}
            {getAge() < 18 && <Text style={st.errorText}>you must be at least 18 to join</Text>}
          </View>
        );

      /* ── 4: Gender ── */
      case 4:
        return (
          <View>
            <Text style={st.question}>how do you identify?</Text>
            <Text style={st.subtitle}>this helps us personalize your experience</Text>
            <View style={st.optionsList}>
              {GENDER_OPTIONS.map((g, i) => (
                <TouchableOpacity key={i} style={[st.optionRow, gender === i && st.optionRowSelected]} onPress={() => setGender(i)} activeOpacity={0.7}>
                  <Text style={st.optionEmoji}>{g.emoji}</Text>
                  <View style={st.optionInfo}>
                    <Text style={st.optionLabel}>{g.label}</Text>
                  </View>
                  {gender === i && <View style={st.checkCircle}><NomadIcon name="check" size={s(5)} color="white" strokeWidth={1.4} /></View>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      /* ── 5: Age Range Slider ── */
      case 5:
        return (
          <View>
            <Text style={st.question}>age range preference</Text>
            <Text style={st.subtitle}>set the age range of people you'd like to connect with</Text>
            <View style={{ marginTop: s(10) }}>
              <DualThumbSlider
                min={18}
                max={100}
                valueMin={ageRangeMin}
                valueMax={ageRangeMax}
                onChangeMin={setAgeRangeMin}
                onChangeMax={setAgeRangeMax}
                step={1}
              />
            </View>
            <Text style={st.ageHint}>
              {ageRangeMin === 18 && ageRangeMax >= 100
                ? "you'll see everyone — no age filter"
                : `you'll see nomads aged ${ageRangeMin}–${ageRangeMax >= 100 ? '100+' : ageRangeMax}`}
            </Text>
            {!(ageRangeMin === 18 && ageRangeMax >= 100) && (
              <Text style={st.ageNote}>you can always change this later in settings</Text>
            )}
          </View>
        );

      /* ── 6: Nomad Type ── */
      case 6:
        return (
          <View>
            <Text style={st.question}>{t('setup.nomadType')}</Text>
            <Text style={st.subtitle}>{t('setup.nomadTypeSub')}</Text>
            <View style={st.optionsList}>
              {NOMAD_TYPES.map((t, i) => (
                <TouchableOpacity key={i} style={[st.optionRow, nomadType === i && st.optionRowSelected]} onPress={() => setNomadType(i)} activeOpacity={0.7}>
                  <Text style={st.optionEmoji}>{t.emoji}</Text>
                  <View style={st.optionInfo}>
                    <Text style={st.optionLabel}>{t.label}</Text>
                    <Text style={st.optionSub}>{t.sub}</Text>
                  </View>
                  {nomadType === i && <View style={st.checkCircle}><NomadIcon name="check" size={s(5)} color="white" strokeWidth={1.4} /></View>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      /* ── 7: Home Country (autocomplete) ── */
      case 7:
        return (
          <View style={st.centeredSearchStep}>
            <Text style={st.question}>{t('setup.homeCountry')}</Text>
            <Text style={st.subtitle}>{t('setup.homeCountrySub')}</Text>

            {/* Already selected */}
            {homeCountry ? (
              <View style={st.selectedRow}>
                <Text style={st.selectedFlag}>{COUNTRIES.find(c => c.name === homeCountry)?.flag}</Text>
                <Text style={st.selectedName}>{homeCountry}</Text>
                <TouchableOpacity onPress={() => { setHomeCountry(''); setHomeCountryQuery(''); setShowCountryList(true); }}>
                  <NomadIcon name="x-circle" size={s(7)} color="#ccc" strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={st.inputWrap}>
                  <View style={{ position: 'absolute', left: s(10), zIndex: 1 }}>
                    <NomadIcon name="search" size={s(7)} color="#B0ADA5" strokeWidth={1.6} />
                  </View>
                  <TextInput
                    style={[st.textInput, { paddingLeft: s(22) }]}
                    placeholder="type your country..."
                    placeholderTextColor="#B0ADA5"
                    value={homeCountryQuery}
                    onChangeText={(t) => { setHomeCountryQuery(t); setShowCountryList(true); }}
                    onFocus={() => setShowCountryList(true)}
                    autoCorrect={false}
                  />
                </View>
                {showCountryList && filteredCountries.length > 0 && (
                  <ScrollView style={st.acList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {filteredCountries.map((c) => (
                      <TouchableOpacity key={c.name} style={st.acItem}
                        onPress={() => { setHomeCountry(c.name); setHomeCountryQuery(''); setShowCountryList(false); }}>
                        <Text style={st.acFlag}>{c.flag}</Text>
                        <Text style={st.acName}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {homeCountryQuery.length > 0 && filteredCountries.length === 0 && (
                  <Text style={st.noResults}>no countries found for "{homeCountryQuery}"</Text>
                )}
              </>
            )}

            {/* Inline CTA — right below search */}
            <TouchableOpacity
              style={[st.ctaBtn, { marginTop: s(12) }]}
              onPress={goNext}
              activeOpacity={0.8}
            >
              <Text style={st.ctaText}>{homeCountry ? t('setup.next') : t('setup.skip')}</Text>
            </TouchableOpacity>
          </View>
        );

      /* ── 8: Current City (autocomplete) ── */
      case 8:
        return (
          <View style={st.centeredSearchStep}>
            <Text style={st.question}>{t('setup.currentCity')}</Text>
            <Text style={st.subtitle}>{t('setup.currentCitySub')}</Text>

            {currentCity ? (
              <View style={st.selectedRow}>
                <NomadIcon name="pin" size={s(7)} color={colors.primary} strokeWidth={1.6} />
                <Text style={st.selectedName}>{currentCity}</Text>
                <TouchableOpacity onPress={() => { setCurrentCity(''); setCurrentCityQuery(''); setShowCityList(true); }}>
                  <NomadIcon name="x-circle" size={s(7)} color="#ccc" strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={st.inputWrap}>
                  <View style={{ position: 'absolute', left: s(10), zIndex: 1 }}>
                    <NomadIcon name="search" size={s(7)} color="#B0ADA5" strokeWidth={1.6} />
                  </View>
                  <TextInput
                    style={[st.textInput, { paddingLeft: s(22) }]}
                    placeholder="search for a city..."
                    placeholderTextColor="#B0ADA5"
                    value={currentCityQuery}
                    onChangeText={(t) => { setCurrentCityQuery(t); setShowCityList(true); }}
                    onFocus={() => setShowCityList(true)}
                    autoCorrect={false}
                  />
                </View>
                {showCityList && (
                  <ScrollView style={st.acList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {filteredCities.map((c) => (
                      <TouchableOpacity key={c.name} style={st.acItem}
                        onPress={() => { setCurrentCity(c.name); setCurrentCityQuery(''); setShowCityList(false); }}>
                        <NomadIcon name="pin" size={s(5)} color={colors.textMuted} strokeWidth={1.4} />
                        <Text style={st.acName}>{c.name}</Text>
                        <Text style={st.acCountry}>{c.country}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* Inline CTA — right below search */}
            <TouchableOpacity
              style={[st.ctaBtn, { marginTop: s(12) }]}
              onPress={goNext}
              activeOpacity={0.8}
            >
              <Text style={st.ctaText}>{currentCity ? t('setup.next') : t('setup.skip')}</Text>
            </TouchableOpacity>
          </View>
        );

      /* ── 9: Interests (3-column grid) ── */
      case 9:
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: s(20) }}>
            <Text style={st.question}>{t('setup.interests')}</Text>
            {INTERESTS.map((cat, ci) => (
              <View key={ci}>
                <Text style={st.catLabel}>{cat.cat}</Text>
                <View style={st.grid3}>
                  {cat.items.map((item) => {
                    const sel = selectedInterests.includes(item.label);
                    return (
                      <TouchableOpacity key={item.label} style={[st.gridChip, sel && st.gridChipSel]}
                        onPress={() => toggleInterest(item.label)} activeOpacity={0.7}>
                        <Text style={st.gridChipEmoji}>{item.emoji}</Text>
                        <Text style={[st.gridChipLabel, sel && st.gridChipLabelSel]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        );

      /* ── 10: Looking For (3-column grid) ── */
      case 10:
        return (
          <View>
            <Text style={st.question}>{t('setup.lookingFor')}</Text>
            <Text style={st.subtitle}>{t('setup.lookingForSub')}</Text>
            <View style={st.grid3}>
              {LOOKING_FOR.map((l) => {
                const sel = lookingFor.includes(l.label);
                return (
                  <TouchableOpacity key={l.label} style={[st.gridChip, st.gridChipTall, sel && st.gridChipSel]}
                    onPress={() => toggleLooking(l.label)} activeOpacity={0.7}>
                    <Text style={st.gridChipEmoji}>{l.emoji}</Text>
                    <Text style={[st.gridChipLabel, sel && st.gridChipLabelSel]}>{l.label}</Text>
                    {sel && <View style={st.gridCheck}><NomadIcon name="check" size={s(4)} color="white" strokeWidth={1.4} /></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      /* ── 11: Permissions ── */
      case 11:
        return (
          <View style={st.centerContent}>
            <View style={st.permIcon}><NomadIcon name="compass" size={s(16)} color={colors.primary} strokeWidth={1.8} /></View>
            <Text style={st.question}>connect with nearby nomads</Text>
            <Text style={st.subtitle}>enable location to discover activities{'\n'}and let other nomads see you're nearby</Text>
            <View style={st.benefitsList}>
              <View style={st.benefitRow}>
                <View style={st.benefitIcon}><NomadIcon name="pin" size={s(7)} color={colors.dark} strokeWidth={1.6} /></View>
                <View style={st.benefitInfo}>
                  <Text style={st.benefitTitle}>discover nearby activities</Text>
                  <Text style={st.benefitSub}>find meetups and co-working near you</Text>
                </View>
                <Switch
                  value={discoverNearby}
                  onValueChange={setDiscoverNearby}
                  trackColor={{ false: '#D1D5DB', true: colors.success }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
              </View>
              <View style={st.benefitRow}>
                <View style={st.benefitIcon}><NomadIcon name="users" size={s(7)} color={colors.dark} strokeWidth={1.6} /></View>
                <View style={st.benefitInfo}>
                  <Text style={st.benefitTitle}>appear to nearby nomads</Text>
                  <Text style={st.benefitSub}>others can see you're in the area</Text>
                </View>
                <Switch
                  value={appearNearby}
                  onValueChange={setAppearNearby}
                  trackColor={{ false: '#D1D5DB', true: colors.success }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
              </View>
              <View style={st.benefitRow}>
                <View style={st.benefitIcon}><NomadIcon name="shield" size={s(7)} color={colors.dark} strokeWidth={1.6} /></View>
                <View style={st.benefitInfo}>
                  <Text style={st.benefitTitle}>your privacy is protected</Text>
                  <Text style={st.benefitSub}>exact location is never shown</Text>
                </View>
              </View>
            </View>
          </View>
        );

      /* ── 12: Trip (last, optional) ── */
      case 12:
        return (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: s(20) }}>
            <View style={st.tripInlineIconRow}><Text style={{ fontSize: s(18) }}>✈️</Text></View>
            <Text style={st.question}>got a trip coming up?</Text>
            <Text style={st.subtitle}>let nomads in your destination know you're coming</Text>

            {/* Country autocomplete */}
            <Text style={st.tripFieldLabel}>where to?</Text>
            {tripCountry ? (
              <View style={[st.selectedRow, { marginBottom: s(8) }]}>
                <Text style={st.selectedFlag}>{COUNTRIES.find(c => c.name === tripCountry)?.flag}</Text>
                <Text style={st.selectedName}>{tripCountry}</Text>
                <TouchableOpacity onPress={() => { setTripCountry(''); setTripCountryQuery(''); setShowTripCountryList(true); }}>
                  <NomadIcon name="x-circle" size={s(7)} color="#ccc" strokeWidth={1.6} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={st.inputWrap}>
                  <View style={{ position: 'absolute', left: s(10), zIndex: 1 }}>
                    <NomadIcon name="search" size={s(7)} color="#B0ADA5" strokeWidth={1.6} />
                  </View>
                  <TextInput
                    style={[st.textInput, { paddingLeft: s(22) }]}
                    placeholder="search country..."
                    placeholderTextColor="#B0ADA5"
                    value={tripCountryQuery}
                    onChangeText={(txt) => { setTripCountryQuery(txt); setShowTripCountryList(true); }}
                    onFocus={() => setShowTripCountryList(true)}
                    autoCorrect={false}
                  />
                </View>
                {showTripCountryList && filteredTripCountries.length > 0 && (
                  <ScrollView style={[st.acList, { maxHeight: s(60) }]} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {filteredTripCountries.map((c) => (
                      <TouchableOpacity key={c.name} style={st.acItem}
                        onPress={() => { setTripCountry(c.name); setTripCountryQuery(''); setShowTripCountryList(false); }}>
                        <Text style={st.acFlag}>{c.flag}</Text>
                        <Text style={st.acName}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* Date pickers */}
            <View style={[st.tripDateRow, { marginTop: s(8) }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.tripFieldLabel}>arrival</Text>
                <TouchableOpacity
                  style={st.tripDateBtn}
                  onPress={() => { setShowArrivalCal(true); setShowDepartureCal(false); setCalViewMonth(tripArrivalDate || new Date()); }}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="calendar" size={s(6)} color={colors.primary} strokeWidth={1.4} />
                  <Text style={[st.tripDateBtnText, !tripArrivalDate && { color: '#bbb' }]}>
                    {tripArrivalDate ? formatDateDisplay(tripArrivalDate) : 'select date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: s(5) }} />
              <View style={{ flex: 1 }}>
                <Text style={st.tripFieldLabel}>departure</Text>
                <TouchableOpacity
                  style={st.tripDateBtn}
                  onPress={() => { setShowDepartureCal(true); setShowArrivalCal(false); setCalViewMonth(tripDepartureDate || tripArrivalDate || new Date()); }}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="calendar" size={s(6)} color={colors.primary} strokeWidth={1.4} />
                  <Text style={[st.tripDateBtnText, !tripDepartureDate && { color: '#bbb' }]}>
                    {tripDepartureDate ? formatDateDisplay(tripDepartureDate) : 'optional'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Inline Calendar ── */}
            {(showArrivalCal || showDepartureCal) && (() => {
              const viewYear = calViewMonth.getFullYear();
              const viewMon = calViewMonth.getMonth();
              const firstDay = new Date(viewYear, viewMon, 1).getDay();
              const daysInMonth = new Date(viewYear, viewMon + 1, 0).getDate();
              const calDays: (number | null)[] = Array(firstDay).fill(null).concat(
                Array.from({ length: daysInMonth }, (_, i) => i + 1)
              );
              const today = new Date();
              today.setHours(0,0,0,0);

              return (
                <View style={st.calBoxLarge}>
                  <View style={st.calHeader}>
                    <TouchableOpacity onPress={() => setCalViewMonth(new Date(viewYear, viewMon - 1, 1))} style={st.calNavBtn}>
                      <NomadIcon name="back" size={s(8)} color={colors.dark} strokeWidth={1.6} />
                    </TouchableOpacity>
                    <Text style={st.calMonthLabelLarge}>{MONTHS[viewMon]} {viewYear}</Text>
                    <TouchableOpacity onPress={() => setCalViewMonth(new Date(viewYear, viewMon + 1, 1))} style={st.calNavBtn}>
                      <NomadIcon name="forward" size={s(8)} color={colors.dark} strokeWidth={1.6} />
                    </TouchableOpacity>
                  </View>
                  <View style={st.calDayNames}>
                    {['su','mo','tu','we','th','fr','sa'].map(d => (
                      <Text key={d} style={st.calDayNameLarge}>{d}</Text>
                    ))}
                  </View>
                  <View style={st.calGrid}>
                    {calDays.map((day, i) => {
                      if (day === null) return <View key={`e${i}`} style={st.calCellLarge} />;
                      const dateObj = new Date(viewYear, viewMon, day);
                      dateObj.setHours(0,0,0,0);
                      const isPast = dateObj < today;
                      const isSelected = showArrivalCal
                        ? (tripArrivalDate && dateObj.getTime() === tripArrivalDate.getTime())
                        : (tripDepartureDate && dateObj.getTime() === tripDepartureDate.getTime());
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[st.calCellLarge, isSelected && st.calCellSelLarge]}
                          disabled={isPast}
                          onPress={() => {
                            if (showArrivalCal) {
                              setTripArrivalDate(dateObj);
                              setShowArrivalCal(false);
                            } else {
                              setTripDepartureDate(dateObj);
                              setShowDepartureCal(false);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            st.calDayTextLarge,
                            isPast && { color: '#ccc' },
                            isSelected && st.calDayTextSelLarge,
                          ]}>{day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </ScrollView>
        );

      default: return null;
    }
  };

  // Disable keyboard avoidance on steps where input is near top and CTA shouldn't move
  const noKeyboardAvoid = [7, 8, 12].includes(step);

  return (
    <KeyboardAvoidingView
      style={[st.root, { paddingTop: insets.top + s(8) }]}
      behavior={Platform.OS === 'ios' && !noKeyboardAvoid ? 'padding' : undefined}
    >
      {step > 0 && (
        <View style={st.header}>
          <TouchableOpacity onPress={goBack} style={st.backBtn} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <NomadIcon name="back" size={s(9)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
          <View style={st.progressCol}>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: `${progressWidth}%` }]} />
            </View>
          </View>
          <View style={{ width: s(12) }} />
        </View>
      )}

      {step > 1 && step < 9 && (
        <View style={st.miniLogoRow}>
          <Image source={APP_ICON} style={st.miniLogoImg} />
        </View>
      )}

      <Animated.View style={[st.content, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>

      {step !== 7 && step !== 8 && (
        <View style={[st.ctaWrap, { paddingBottom: Math.max(insets.bottom, s(12)) }]}>
          <TouchableOpacity
            style={[st.ctaBtn, !canProceed() && st.ctaBtnDisabled]}
            onPress={goNext}
            disabled={!canProceed()}
            activeOpacity={0.8}
          >
            <Text style={st.ctaText}>{ctaLabel()}</Text>
          </TouchableOpacity>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─── */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.card },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(10), marginBottom: s(4), gap: s(8) },
  backBtn: { width: s(18), height: s(18), alignItems: 'center', justifyContent: 'center' },
  progressCol: { flex: 1, alignItems: 'center', gap: s(1.5) },
  progressBar: { width: '100%', height: s(3), backgroundColor: c.pill, borderRadius: s(1.5), overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: c.primary, borderRadius: s(1.5) },
  stepLabel: { fontSize: s(4.5), fontWeight: FW.medium, color: c.textMuted },
  miniLogoRow: { alignItems: 'center', marginBottom: s(10) },
  miniLogoImg: { width: s(20), height: s(20), borderRadius: s(6), marginBottom: s(3) },
  miniLogoLabel: { fontSize: s(7), fontWeight: FW.extra, color: c.dark },
  content: { flex: 1, paddingHorizontal: s(14) },

  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: s(30) },
  centeredSearchStep: { flex: 1, justifyContent: 'center', paddingBottom: s(40) },
  logoImage: { width: s(40), height: s(40), borderRadius: s(12), marginBottom: s(10) },
  welcomeTitle: { fontSize: s(14), fontWeight: FW.extra, color: c.dark, marginBottom: s(4) },
  welcomeSub: { fontSize: s(7), color: c.textMuted, textAlign: 'center', lineHeight: s(11), marginBottom: s(20) },
  featureList: { gap: s(8), width: '100%', paddingHorizontal: s(6) },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  featureIcon: { width: s(18), height: s(18), borderRadius: s(9), backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: s(6.5), fontWeight: FW.medium, color: c.dark },

  question: { fontSize: s(11), fontWeight: FW.extra, color: c.dark, marginBottom: s(3) },
  subtitle: { fontSize: s(6), color: c.textMuted, marginBottom: s(12), lineHeight: s(9) },

  /* Language */
  langRow: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(5.5), paddingHorizontal: s(8), borderRadius: s(8), backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderSoft, marginBottom: s(3) },
  langRowSel: { borderColor: c.primary, backgroundColor: c.primaryLight },
  langFlag: { fontSize: s(9) },
  langLabel: { flex: 1, fontSize: s(7), fontWeight: FW.medium, color: c.dark },
  langLabelSel: { color: c.primary, fontWeight: FW.bold },

  /* Options */
  optionsList: { gap: s(4) },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(6), paddingHorizontal: s(8), borderRadius: s(10), backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderSoft },
  optionRowSelected: { borderColor: c.primary, backgroundColor: c.primaryLight },
  optionEmoji: { fontSize: s(10) },
  optionInfo: { flex: 1 },
  optionLabel: { fontSize: s(7), fontWeight: FW.bold, color: c.dark },
  optionSub: { fontSize: s(5), color: c.textMuted, marginTop: s(0.5) },
  checkCircle: { width: s(10), height: s(10), borderRadius: s(5), backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },

  /* Inputs */
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputPrefix: { position: 'absolute', left: s(10), zIndex: 1, fontSize: s(8), fontWeight: FW.bold, color: c.textMuted },
  textInput: { backgroundColor: c.card, borderRadius: s(12), borderWidth: 1.5, borderColor: c.borderSoft, paddingVertical: s(9), paddingHorizontal: s(12), fontSize: s(8), color: c.dark },
  skipLink: { alignItems: 'center', marginTop: s(10) },
  skipLinkText: { fontSize: s(6), color: c.textMuted },
  errorText: { fontSize: s(5.5), color: c.primary, marginTop: s(4), marginLeft: s(2) },
  ageHint: { fontSize: s(5.5), color: c.textSec, textAlign: 'center', marginTop: s(8), lineHeight: s(8) },
  ageNote: { fontSize: s(4.5), color: c.textMuted, textAlign: 'center', marginTop: s(4) },
  successText: { fontSize: s(5.5), color: c.success, marginTop: s(4), marginLeft: s(2) },
  checkingText: { fontSize: s(5.5), color: c.textMuted, marginTop: s(4), marginLeft: s(2), fontStyle: 'italic' },
  noResults: { fontSize: s(5.5), color: c.textMuted, marginTop: s(6), textAlign: 'center' },

  /* Autocomplete */
  acList: { maxHeight: s(100), marginTop: s(5), backgroundColor: c.card, borderRadius: s(10), borderWidth: 1.5, borderColor: c.borderSoft },
  acItem: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(7), paddingHorizontal: s(10), borderBottomWidth: 0.5, borderBottomColor: c.borderSoft },
  acFlag: { fontSize: s(9) },
  acName: { fontSize: s(7.5), fontWeight: FW.medium, color: c.dark, flex: 1 },
  acCountry: { fontSize: s(5), color: c.textMuted },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: s(6), paddingVertical: s(9), paddingHorizontal: s(12), backgroundColor: c.successLight, borderRadius: s(12), borderWidth: 1.5, borderColor: c.success },
  selectedFlag: { fontSize: s(11) },
  selectedName: { flex: 1, fontSize: s(8), fontWeight: FW.bold, color: c.dark },

  /* Date */
  datePickerRow: { flexDirection: 'row', gap: s(5), height: s(80) },
  dateColumn: { flex: 1 },
  dateColLabel: { fontSize: s(5.5), fontWeight: FW.bold, color: c.textMuted, textAlign: 'center', marginBottom: s(4) },
  dateScroll: { flex: 1, backgroundColor: c.inputBg, borderRadius: s(8), borderWidth: 1, borderColor: c.borderSoft },
  dateItem: { paddingVertical: s(4), alignItems: 'center' },
  dateItemActive: { backgroundColor: c.primaryLight },
  dateItemText: { fontSize: s(7), color: c.dark, fontWeight: FW.medium },
  dateItemTextActive: { color: c.primary, fontWeight: FW.bold },
  datePreview: { textAlign: 'center', marginTop: s(8), fontSize: s(8), fontWeight: FW.bold, color: c.dark },

  /* 3-Column Grid */
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: CHIP_GAP },
  gridChip: { width: CHIP_W, alignItems: 'center', justifyContent: 'center', paddingVertical: s(5), borderRadius: s(8), backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.borderSoft },
  gridChipTall: { paddingVertical: s(8) },
  gridChipSel: { borderColor: c.primary, backgroundColor: c.primaryLight },
  gridChipEmoji: { fontSize: s(10), marginBottom: s(2) },
  gridChipLabel: { fontSize: s(5.5), fontWeight: FW.semi, color: c.dark, textAlign: 'center' },
  gridChipLabelSel: { color: c.primary, fontWeight: FW.bold },
  gridCheck: { position: 'absolute', top: s(2), right: s(2), width: s(7), height: s(7), borderRadius: s(3.5), backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: s(6), fontWeight: FW.bold, color: c.dark, marginBottom: s(4), marginTop: s(6) },

  /* Location */
  permIcon: { width: s(32), height: s(32), borderRadius: s(16), backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: s(12) },
  benefitsList: { width: '100%', gap: s(8), marginTop: s(10) },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: s(7) },
  benefitIcon: { width: s(14), height: s(14), borderRadius: s(7), backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center', marginTop: s(1) },
  benefitInfo: { flex: 1 },
  benefitTitle: { fontSize: s(7), fontWeight: FW.bold, color: c.dark, marginBottom: s(1) },
  benefitSub: { fontSize: s(5.5), color: c.textMuted, lineHeight: s(8) },

  /* Trip (inline step) */
  tripInlineIconRow: { alignItems: 'center', marginBottom: s(6) },
  tripFieldLabel: { fontSize: s(6), fontWeight: FW.bold, color: c.dark, marginBottom: s(4) },
  tripDateRow: { flexDirection: 'row' },
  tripDateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: s(4),
    backgroundColor: c.card, borderRadius: s(10), borderWidth: 1.5, borderColor: c.borderSoft,
    paddingVertical: s(7), paddingHorizontal: s(8), marginBottom: s(8),
  },
  tripDateBtnText: { fontSize: s(7), fontWeight: FW.medium, color: c.dark },

  /* Large Calendar (inline, readable) */
  calBoxLarge: { backgroundColor: c.inputBg, borderRadius: s(12), borderWidth: 1, borderColor: c.borderSoft, padding: s(8), marginBottom: s(8), marginTop: s(4) },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(6) },
  calNavBtn: { padding: s(3) },
  calMonthLabelLarge: { fontSize: s(8), fontWeight: FW.bold, color: c.dark },
  calDayNames: { flexDirection: 'row', marginBottom: s(4) },
  calDayNameLarge: { flex: 1, textAlign: 'center', fontSize: s(6), fontWeight: FW.bold, color: c.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCellLarge: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellSelLarge: { backgroundColor: c.primary, borderRadius: s(20) },
  calDayTextLarge: { fontSize: s(7.5), color: c.dark, fontWeight: FW.medium },
  calDayTextSelLarge: { color: 'white', fontWeight: FW.bold },

  /* CTA */
  ctaWrap: { paddingHorizontal: s(14), paddingTop: s(6) },
  ctaBtn: { backgroundColor: c.primary, borderRadius: s(14), paddingVertical: s(8), alignItems: 'center' },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaText: { color: 'white', fontSize: s(8), fontWeight: FW.bold },
});
