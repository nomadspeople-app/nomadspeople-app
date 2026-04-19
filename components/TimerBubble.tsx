/**
 * TimerBubble — Waze-style anchored popup for timer pins.
 *
 * Visual shell is the canonical `Bubble` (avatar on top, white speech
 * bubble body, tail pointing down at the source pin). All Waze-spec
 * decisions live in Bubble.tsx; this file owns ONLY the timer-specific
 * content + the navigation that fires when the bubble is tapped.
 *
 * Behavior (per the user's spec):
 *  - Appears on tap of a timer pin, anchored above it.
 *  - Tap on the bubble body:
 *      visitor → navigate to ActivityDetailSheet (full info + Join)
 *      owner   → navigate to UserProfile with openCheckinId so the
 *                creator's management surface opens (rename / cancel
 *                pills live there per the unified-surface rule).
 *  - Tap outside / map / region change → onClose fires (HomeScreen
 *    handles the actual dismissal).
 *
 * Display content (compact, scannable, no buttons inside the bubble —
 * the whole bubble is the CTA):
 *    [owner avatar overlapping top]
 *    Name (bold)
 *    [emoji] activity text
 *    ends in 23m
 */
import React, { useState, useEffect, useContext } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, AppCheckin } from '../lib/types';
import { AuthContext } from '../App';
import * as Haptics from 'expo-haptics';
import { trackEvent } from '../lib/tracking';
import Bubble from './Bubble';
import { s, FW, useTheme } from '../lib/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  visible: boolean;
  checkin: AppCheckin | null;
  creatorName: string;
  creatorAvatarUrl?: string | null;
  /** Screen X of the source pin (HomeScreen computes via pointForCoordinate). */
  anchorX: number;
  /** Screen Y of the source pin. */
  anchorY: number;
  /** Called when the user taps outside the bubble (backdrop / map / region change). */
  onClose: () => void;
  /** Visitor flow: open the full ActivityDetailSheet — HomeScreen owns the sheet state. */
  onOpenVisitorDetail?: (checkin: AppCheckin) => void;
}

/** Live human-friendly countdown — "23m", "1h12m", "ended". */
function useCountdown(exp: string | null) {
  const [t, setT] = useState('');
  useEffect(() => {
    if (!exp) { setT(''); return; }
    const tick = () => {
      const d = Math.max(0, new Date(exp).getTime() - Date.now());
      if (d <= 0) { setT('ended'); return; }
      const mins = Math.floor(d / 60000);
      if (mins < 60) {
        setT(`${Math.max(1, mins)}m`);
      } else {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setT(`${h}h${m > 0 ? `${m}m` : ''}`);
      }
    };
    tick();
    const iv = setInterval(tick, 30000); // every 30s — countdown precision in minutes
    return () => clearInterval(iv);
  }, [exp]);
  return t;
}

export default function TimerBubble({
  visible, checkin, creatorName, creatorAvatarUrl,
  anchorX, anchorY, onClose, onOpenVisitorDetail,
}: Props) {
  const { userId } = useContext(AuthContext);
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();

  const countdown = useCountdown(checkin?.expires_at ?? null);
  const firstName = (creatorName || 'Nomad').split(' ')[0] || 'Nomad';
  const initials = (creatorName || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const actText = checkin?.activity_text || checkin?.status_text || '';
  const actEmoji = checkin?.status_emoji || '⏰';
  const isOwn = !!(checkin && userId && checkin.user_id === userId);

  const handleBubbleTap = () => {
    if (!checkin) return;
    Haptics.selectionAsync().catch(() => {});
    trackEvent(userId, 'tap_timer_bubble', 'checkin', checkin.id);
    onClose();
    // Defer the nav so the bubble dismiss animation gets a frame to
    // start before the next surface mounts (no visual fight).
    setTimeout(() => {
      if (isOwn) {
        // Owner → their own profile, focused on this checkin. Creator
        // affordances (cancel/rename/etc.) live there per the unified
        // single-surface rule.
        nav.navigate('UserProfile' as any, { userId: checkin.user_id, openCheckinId: checkin.id });
      } else {
        // Visitor → full ActivityDetailSheet (Join lives there).
        // HomeScreen still owns the sheet state.
        onOpenVisitorDetail?.(checkin);
      }
    }, 80);
  };

  return (
    <Bubble
      visible={visible}
      anchorX={anchorX}
      anchorY={anchorY}
      avatarUrl={creatorAvatarUrl || null}
      avatarFallback={initials}
      avatarFallbackColor={colors.primary}
      onPress={handleBubbleTap}
      onDismiss={onClose}
    >
      <Text style={styles.title} numberOfLines={1}>{firstName}</Text>
      {!!actText && (
        <Text style={styles.line} numberOfLines={2}>
          {actEmoji}  {actText}
        </Text>
      )}
      {!!countdown && (
        <Text style={styles.countdown}>
          {countdown === 'ended' ? 'ended' : `ends in ${countdown}`}
        </Text>
      )}
    </Bubble>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  line: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#374151',
    textAlign: 'center',
    marginTop: 4,
  },
  countdown: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#E8614D', // brand primary — highlights urgency
    textAlign: 'center',
    marginTop: 4,
  },
});
