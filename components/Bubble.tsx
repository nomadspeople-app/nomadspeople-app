/**
 * Bubble — bottom-docked sheet for pin/marker tap popups.
 *
 * Design decision (2026-04-19 revision): we moved AWAY from an
 * anchored-with-tail popup (Waze-style) because the required map
 * motion was making users dizzy. The new pattern:
 *
 *   - Edge-to-edge card with a small horizontal margin (16px each side)
 *   - Floats above the bottom tab bar with a gentle gap
 *   - Tall enough to cover the floating Timer/Status FABs, so the
 *     user's eye stays on one surface while the bubble is open
 *   - Slides UP from below on appear, slides DOWN on dismiss
 *   - No tail — the source pin is communicated by a highlight on the
 *     pin itself (scale + ring), rendered by the parent screen
 *
 * Matches the pattern used by Apple Maps, Google Maps, Airbnb, Yelp
 * for place detail popovers. Familiar to anyone who's used a maps
 * app, and it's the cleanest way to give a popup a lot of content
 * space without shoving the map around.
 *
 * The visual shell (avatar overlapping the top, white rounded card,
 * soft shadow) is preserved from the previous version — the user
 * loves that styling, so the only change is positioning + animation.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  Pressable, Dimensions, Keyboard, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';

const SCREEN_H = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  avatarUrl?: string | null;
  avatarFallback?: string;
  avatarFallbackColor?: string;
  /** Tap on the speech-bubble body fires this (if defined). */
  onPress?: () => void;
  /** Tap outside (backdrop) fires this. */
  onDismiss: () => void;
  children: React.ReactNode;
}

export default function Bubble({
  visible,
  avatarUrl, avatarFallback, avatarFallbackColor,
  onPress, onDismiss, children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  // Slide-up/down animation. translateY starts at SCREEN_H (fully
  // below screen) and springs to 0 on entry. On exit, it eases back
  // to SCREEN_H while opacity fades. Two animated values kept separate
  // because spring + timing are driven differently.
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const [mounted, setMounted] = useState(visible);

  /* ── Keyboard avoidance ──
   *
   * The bubble is docked at the bottom of the screen. When a
   * TextInput inside it focuses, the on-screen keyboard rises
   * and would cover the bubble. We animate the bubble up by the
   * exact keyboard height so the input stays visible at all
   * times. This works for every consumer of <Bubble/> — no per-
   * component wiring needed. */
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKbHeight(e.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKbHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 11,   // controlled slide, no bouncy overshoot
          tension: 68,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H * 0.4,  // slide down ~40% of screen — enough to clearly exit
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, opacity, translateY]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop — full screen tap catcher. Transparent on purpose;
          we don't dim the map because the user's context (what city,
          where their finger just was) should stay clear. Tapping here
          dismisses. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        pointerEvents={visible ? 'auto' : 'none'}
      />

      {/* The sheet itself. Anchored to the bottom with a gap above
          the safe area (so it never touches the tab bar). Horizontal
          margins keep it edge-to-edge with breathing room. */}
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[
          st.wrap,
          {
            // Sit just above the tab bar with a tiny visible gap,
            // not a chunky margin. The parent screen lives inside
            // the bottom-tab navigator, so "bottom: 0" on this
            // absolutely-positioned sheet already means the top of
            // the tab bar — we only need the small s(2) lift to
            // keep the shadow from being clipped and to give the
            // eye a thin line between bubble and tab.
            //
            // Keyboard case: UIKit reports the keyboard height
            // including the safe-area bottom on iOS; Android
            // doesn't, so we add insets.bottom only on Android.
            // Either way we keep the s(2) breathing room above
            // the keyboard so the TextInput never looks
            // swallowed by its own virtual keyboard.
            bottom: kbHeight > 0
              ? (Platform.OS === 'ios' ? kbHeight + s(2) : kbHeight + insets.bottom + s(2))
              : s(2),
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Avatar overlapping the top of the card. Same styling as
            before — 60px circle, 4px white border, soft shadow. */}
        <View style={st.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, { backgroundColor: avatarFallbackColor || '#F4A582', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={st.avatarFallback}>{avatarFallback || '?'}</Text>
            </View>
          )}
        </View>

        {/* The card itself — white, rounded, shadowed.
             When a parent provides `onPress`, we wrap the surface
             in a TouchableOpacity so the whole card is tappable
             (TimerBubble pattern — tap anywhere to join).
             When no onPress is given (CreationBubble), we render
             a plain View. A disabled TouchableOpacity in RN still
             intercepts touches before they reach children, which
             broke TextInputs inside the card — the optional
             address line in the WHERE step couldn't receive taps
             at all. A View passes everything through. */}
        {onPress ? (
          <TouchableOpacity
            activeOpacity={0.94}
            onPress={onPress}
            style={st.card}
          >
            <View style={st.content}>
              {children}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={st.card}>
            <View style={st.content}>
              {children}
            </View>
          </View>
        )}
      </Animated.View>
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: s(8),   // ~16px
    right: s(8),
    alignItems: 'center',
    zIndex: 50,
  },

  /* Avatar on top — overlaps the card by 25px per original Figma */
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignSelf: 'center',
    marginBottom: -25,
    zIndex: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    fontSize: s(8),
    fontWeight: FW.bold,
    color: '#3B1F1A',
  },

  /* The card body. Same Figma spec as before — 20px radius, 40/32/24/32
     padding, soft 20-blur shadow. No tail. */
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 40,
    paddingHorizontal: 32,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
    zIndex: 1,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
});
