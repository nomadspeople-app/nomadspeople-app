/**
 * Bubble — Waze-style anchored popup. The canonical "peek" shell for
 * any pin/marker tap in the app. Not a modal — it's absolute-positioned
 * on top of the map, anchored above a specific screen coordinate via
 * its tail.
 *
 * Design rules (locked per ux skill + user's Figma spec):
 *  - The bubble is ALWAYS connected to its source pin via the tail.
 *    It does not float, it does not drift. The user sees a clear
 *    visual line from tail → pin → anchor.
 *  - Dismisses on ANY touch outside: map tap, another pin tap, region
 *    change. Never stays open when the user's focus moves.
 *  - Avatar overlaps the bubble from above by 25 px (Figma spec), with
 *    a white border so it "sits on" the speech bubble.
 *  - Tail is a 40×20 triangle pointing down from the bubble's bottom.
 *  - Entire speech-bubble is the primary tap target (Waze pattern).
 *    Tapping it fires onPress. Tapping anywhere else fires onDismiss.
 *
 * Positioning math:
 *   - `anchorX` / `anchorY` are the pin's screen coords
 *     (from `mapRef.current.pointForCoordinate(...)`).
 *   - The bubble's TAIL TIP sits at (anchorX, anchorY - pinOffset).
 *     That puts the bubble body entirely above the pin.
 *   - Height is measured via onLayout and used to position the top.
 *     First frame uses an estimate so there's no "pop" on mount.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  Pressable, Dimensions,
} from 'react-native';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';

const SCREEN_W = Dimensions.get('window').width;

/** Pin visual height above its geographic anchor, in px.
 *  Approximation — pins are circular avatar markers ~50 px tall and
 *  react-native-maps anchors at the bottom-center by default. */
const PIN_OFFSET = 12;

/** Max bubble width — Figma: 90vw capped at a sane readable value. */
const BUBBLE_MAX_WIDTH = Math.min(SCREEN_W * 0.9, 320);

interface Props {
  visible: boolean;
  /** Screen X of the source pin (from pointForCoordinate). */
  anchorX: number;
  /** Screen Y of the source pin (from pointForCoordinate). */
  anchorY: number;
  avatarUrl?: string | null;
  /** Fallback avatar text (initials or emoji) when no avatarUrl. */
  avatarFallback?: string;
  /** Background of the fallback avatar circle. */
  avatarFallbackColor?: string;
  /** Tap on the speech-bubble body fires this. */
  onPress?: () => void;
  /** Tap outside (backdrop) fires this. */
  onDismiss: () => void;
  children: React.ReactNode;
}

export default function Bubble({
  visible, anchorX, anchorY,
  avatarUrl, avatarFallback, avatarFallbackColor,
  onPress, onDismiss, children,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [bubbleH, setBubbleH] = useState(180); // estimate; onLayout corrects
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 160 : 100,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible && (opacity as any)._value === 0) return null;

  // Total height incl. the avatar that pops ABOVE the bubble (25 px) and
  // the tail that hangs BELOW (20 px). We anchor the TAIL TIP to the pin.
  const AVATAR_POP_ABOVE = 25;
  const TAIL_H = 20;
  const topOfBubble = anchorY - PIN_OFFSET - TAIL_H - bubbleH + AVATAR_POP_ABOVE;
  const left = Math.max(
    s(4),
    Math.min(anchorX - BUBBLE_MAX_WIDTH / 2, SCREEN_W - BUBBLE_MAX_WIDTH - s(4)),
  );
  const tailCenterX = anchorX - left; // px from bubble's left edge

  return (
    <>
      {/* Invisible backdrop — catches taps anywhere outside the bubble
          and dismisses. Covers the whole screen so any tap that didn't
          already fire on the speech-bubble cancels it. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        pointerEvents={visible ? 'auto' : 'none'}
      />

      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[
          st.wrap,
          {
            left,
            top: topOfBubble,
            width: BUBBLE_MAX_WIDTH,
            opacity,
          },
        ]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (Math.abs(h - bubbleH) > 1) setBubbleH(h);
        }}
      >
        {/* Avatar overlapping top of speech bubble.
            Negative marginBottom pulls the next sibling up 25 px so
            the avatar sits half-in / half-out of the bubble. */}
        <View style={[st.avatarWrap, avatarFallbackColor ? { backgroundColor: '#fff' } : null]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, { backgroundColor: avatarFallbackColor || '#F4A582', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={st.avatarFallback}>{avatarFallback || '?'}</Text>
            </View>
          )}
        </View>

        {/* The speech bubble body — the Waze white card. Entire surface
            is the primary tap target. */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPress}
          style={st.speechBubble}
        >
          <View style={st.content}>
            {children}
          </View>
        </TouchableOpacity>

        {/* Tail — triangle pointing down. Centered under the anchor X
            so the visual line from tail tip → pin is straight. */}
        <View
          style={[
            st.tail,
            { left: tailCenterX - 20 },
          ]}
        />
      </Animated.View>
    </>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
  },

  /* Avatar — sits on top of the speech bubble */
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignSelf: 'center',
    marginBottom: -25, // pulls the speech bubble up so avatar overlaps
    zIndex: 2,
    // Figma: shadow blur 8, color #000, opacity 0.1
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

  /* Speech bubble — the white card. Figma: padding 40/32/24/32. */
  speechBubble: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 40,
    paddingHorizontal: 32,
    paddingBottom: 24,
    alignItems: 'center',
    // Figma: shadow blur 20, color #000, opacity 0.15
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 10,
    zIndex: 1,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },

  /* Tail — triangle pointing down. Border-hack: transparent L/R,
     colored top creates a downward isoceles triangle. */
  tail: {
    position: 'absolute',
    bottom: -19, // just below the speech bubble (1px overlap kills the seam)
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    zIndex: 0,
  },
});
