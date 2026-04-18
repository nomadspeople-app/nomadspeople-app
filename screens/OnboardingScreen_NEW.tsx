import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

const AVATAR_COLORS = ['#E8614D', '#8B5CF6', '#10B981', '#F59E0B', '#2A9D8F', '#EC4899'];
const getColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];
const initials = (name?: string) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

const TOTAL_STEPS = 5; // 0: Welcome, 1: Name, 2: Avatar, 3: Location, 4: Done

interface OnboardingScreenProps {
  userId: string;
  onComplete: () => void;
}

export default function OnboardingScreen({ userId, onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const st = styles(colors);

  // State
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to top on step change
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [step]);

  const handleNext = async () => {
    switch (step) {
      case 0: // Welcome → Name
        setStep(1);
        break;
      case 1: // Name → Avatar
        if (fullName.trim().length < 2) {
          Alert.alert('Name required', 'Please enter at least 2 characters');
          return;
        }
        setStep(2);
        break;
      case 2: // Avatar → Location
        setStep(3);
        break;
      case 3: // Location → Done
        if (!location) {
          Alert.alert('Location required', 'Please allow location access');
          return;
        }
        await handleLocationNext();
        break;
      case 4: // Done
        await saveProfile();
        break;
    }
  };

  const handleLocationNext = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need location to show you on the map');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      // Try to get city name (optional, can be skipped if reverse geocoding fails)
      try {
        const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (result) {
          const city = result.city || result.region || 'Unknown location';
          setLocationName(city);
        }
      } catch (err) {
        console.warn('[Onboarding] Reverse geocode failed:', err);
      }

      setLocation({ lat: latitude, lng: longitude });
      setStep(4);
    } catch (err) {
      Alert.alert('Location error', 'Could not get your location');
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const fileName = `avatars/${userId}/${Date.now()}.jpg`;

        setLoading(true);
        const { data, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, {
            uri: asset.uri,
            type: 'image/jpeg',
            name: fileName,
          });

        if (uploadError) {
          Alert.alert('Upload failed', uploadError.message);
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        setAvatarUrl(urlData.publicUrl);
        setLoading(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick photo');
    }
  };

  const saveProfile = async () => {
    if (!location) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('app_profiles')
        .update({
          full_name: fullName.trim(),
          avatar_url: avatarUrl || `https://via.placeholder.com/200?text=${initials(fullName)}`,
          latitude: location.lat,
          longitude: location.lng,
          onboarding_done: true,
          show_on_map: true,
        })
        .eq('user_id', userId);

      if (error) {
        Alert.alert('Error', 'Failed to save profile: ' + error.message);
        setLoading(false);
        return;
      }

      onComplete();
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <View style={[st.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={st.scroll} scrollEnabled={false}>
        {/* Step 0: Welcome */}
        {step === 0 && (
          <View style={st.step}>
            <Image source={require('../assets/icon.png')} style={st.logo} />
            <Text style={st.title}>Welcome to NomadsPeople</Text>
            <Text style={st.subtitle}>Meet nomads near you, join activities, chat in real-time</Text>
            <Text style={st.hint}>(2 min setup)</Text>
          </View>
        )}

        {/* Step 1: Full Name */}
        {step === 1 && (
          <View style={st.step}>
            <Text style={st.title}>What's your name?</Text>
            <TextInput
              style={st.input}
              placeholder="e.g., Alex Smith"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
              autoFocus
            />
            <Text style={st.hint}>This is how other nomads will see you</Text>
          </View>
        )}

        {/* Step 2: Avatar */}
        {step === 2 && (
          <View style={st.step}>
            <Text style={st.title}>Pick your avatar</Text>

            {/* Color options */}
            <View style={st.avatarGrid}>
              {AVATAR_COLORS.map((color, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    st.avatarOption,
                    { backgroundColor: color },
                    avatarIndex === idx && !avatarUrl && st.avatarSelected,
                  ]}
                  onPress={() => {
                    setAvatarIndex(idx);
                    setAvatarUrl(null);
                  }}
                >
                  <Text style={st.avatarText}>{initials(fullName)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Or upload photo */}
            <TouchableOpacity style={st.uploadButton} onPress={handlePickPhoto}>
              <NomadIcon name="image" size={s(6)} color={colors.primary} strokeWidth={2} />
              <Text style={st.uploadText}>Upload photo</Text>
            </TouchableOpacity>

            {avatarUrl && <Text style={st.successText}>✓ Photo selected</Text>}
          </View>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <View style={st.step}>
            <Text style={st.title}>Where are you?</Text>
            <Text style={st.subtitle}>We'll show you on the map so other nomads can find you</Text>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={st.loader} />
            ) : (
              <TouchableOpacity style={st.button} onPress={handleLocationNext}>
                <NomadIcon name="map-pin" size={s(6)} color="white" strokeWidth={2} />
                <Text style={st.buttonText}>Allow location access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <View style={st.step}>
            <Text style={st.title}>You're all set! 🎉</Text>
            <View style={st.summary}>
              <View
                style={[
                  st.summaryAvatar,
                  { backgroundColor: avatarUrl ? '#ccc' : getColor(avatarIndex) },
                ]}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={st.summaryAvatarImg} />
                ) : (
                  <Text style={st.summaryAvatarText}>{initials(fullName)}</Text>
                )}
              </View>
              <Text style={st.summaryName}>{fullName}</Text>
              <Text style={st.summaryLocation}>📍 {locationName || 'Location set'}</Text>
            </View>
            <Text style={st.subtitle}>Ready to explore!</Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={[st.footer, { paddingBottom: insets.bottom + s(4) }]}>
        {step > 0 && step < 4 && (
          <TouchableOpacity style={st.secondaryBtn} onPress={() => setStep(step - 1)}>
            <Text style={st.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        {step !== 4 || loading ? (
          <TouchableOpacity
            style={[st.button, loading && st.buttonDisabled]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={st.buttonText}>{step === 3 ? 'Next' : 'Continue'}</Text>
                <NomadIcon name="arrow-right" size={s(5)} color="white" strokeWidth={2} />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.button, loading && st.buttonDisabled]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={st.buttonText}>Let's go!</Text>
                <NomadIcon name="arrow-right" size={s(5)} color="white" strokeWidth={2} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={st.progressBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[st.progressDot, i <= step && st.progressDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

function styles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: s(6),
    },
    step: {
      alignItems: 'center',
      minHeight: '100%',
      justifyContent: 'center',
    },
    logo: {
      width: s(20),
      height: s(20),
      borderRadius: s(10),
      marginBottom: s(8),
    },
    title: {
      fontSize: s(9),
      fontWeight: FW.bold,
      color: colors.dark,
      marginBottom: s(2),
      textAlign: 'center',
    },
    subtitle: {
      fontSize: s(5.5),
      color: colors.textMuted,
      marginTop: s(2),
      textAlign: 'center',
      lineHeight: s(8),
    },
    hint: {
      fontSize: s(4.5),
      color: colors.textFaint,
      marginTop: s(3),
      fontStyle: 'italic',
    },
    input: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: s(2),
      paddingHorizontal: s(4),
      paddingVertical: s(3),
      fontSize: s(5.5),
      color: colors.dark,
      marginTop: s(4),
    },
    avatarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s(3),
      justifyContent: 'center',
      marginTop: s(6),
      marginBottom: s(4),
    },
    avatarOption: {
      width: s(16),
      height: s(16),
      borderRadius: s(8),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    avatarSelected: {
      borderColor: colors.primary,
      borderWidth: 3,
    },
    avatarText: {
      color: 'white',
      fontSize: s(6),
      fontWeight: FW.bold,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: s(3),
      paddingHorizontal: s(4),
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: s(2),
      gap: s(2),
    },
    uploadText: {
      fontSize: s(5),
      color: colors.primary,
      fontWeight: FW.medium,
    },
    successText: {
      fontSize: s(4.5),
      color: '#10B981',
      marginTop: s(3),
      fontWeight: FW.medium,
    },
    footer: {
      paddingHorizontal: s(6),
      paddingTop: s(4),
      gap: s(3),
      flexDirection: 'row',
    },
    button: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: s(3),
      borderRadius: s(2),
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: s(2),
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: 'white',
      fontSize: s(5.5),
      fontWeight: FW.bold,
    },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: s(3),
      borderRadius: s(2),
      justifyContent: 'center',
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: colors.dark,
      fontSize: s(5.5),
      fontWeight: FW.medium,
    },
    summary: {
      alignItems: 'center',
      marginVertical: s(6),
    },
    summaryAvatar: {
      width: s(20),
      height: s(20),
      borderRadius: s(10),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: s(4),
    },
    summaryAvatarImg: {
      width: '100%',
      height: '100%',
      borderRadius: s(10),
    },
    summaryAvatarText: {
      color: 'white',
      fontSize: s(8),
      fontWeight: FW.bold,
    },
    summaryName: {
      fontSize: s(7),
      fontWeight: FW.bold,
      color: colors.dark,
      marginBottom: s(1),
    },
    summaryLocation: {
      fontSize: s(5),
      color: colors.textMuted,
    },
    progressBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: s(1.5),
      paddingBottom: s(4),
    },
    progressDot: {
      width: s(1.5),
      height: s(1.5),
      borderRadius: s(0.75),
      backgroundColor: colors.border,
    },
    progressDotActive: {
      backgroundColor: colors.primary,
    },
    loader: {
      marginVertical: s(8),
    },
  });
}
