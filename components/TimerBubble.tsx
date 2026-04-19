/**
 * TimerBubble — the content that fills the Waze-style Bubble shell
 * for a timer pin tap.
 *
 * Layout per user's 2026-04-19 spec:
 *   [owner avatar, already on the shell]
 *   TITLE — big, bold, the activity text ("מי בא לים עוד שעתיים")
 *   subtitle — creator first-name · countdown
 *   member avatars row — medium circles of who already joined
 *   big primary CTA — join / chat / manage
 *
 * Button state:
 *   - owner on own timer      → "manage"  → UserProfile w/ openCheckinId
 *   - visitor, not a member   → "join"    → createOrJoinStatusChat (+
 *       optimistic avatar/count, haptic), then state swaps to chat+leave
 *   - visitor, already member → "chat"    → ChatScreen. Small "leave"
 *       link below for exiting.
 *
 * All interactive elements fire Haptics. All destructive paths use
 * Alert confirmation per the ux skill (leave). Join closes its full
 * logic loop: DB membership row + system "joined" message (handled
 * inside createOrJoinStatusChat) + member_count increments + UI
 * reflects the new state immediately (optimistic).
 */
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  Text, StyleSheet, View, TouchableOpacity, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, AppCheckin } from '../lib/types';
import { AuthContext } from '../App';
import * as Haptics from 'expo-haptics';
import { trackEvent } from '../lib/tracking';
import Bubble from './Bubble';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { createOrJoinStatusChat, leaveGroupChat } from '../lib/hooks';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  visible: boolean;
  checkin: AppCheckin | null;
  creatorName: string;
  creatorAvatarUrl?: string | null;
  anchorX: number;
  anchorY: number;
  onClose: () => void;
}

interface MemberLite {
  user_id: string;
  avatar_url: string | null;
  full_name: string | null;
}

/** Live countdown in minutes/hours. Updates every 30s — we don't need
 *  second-precision and slower interval = less battery. */
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
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [exp]);
  return t;
}

/** Load members of the timer's conversation (if it exists). Excludes
 *  the creator — they're already shown as the big avatar on top.
 *  Queries via app_conversations.checkin_id (exact link), not the
 *  fragile name-match the old TimerBubble used. */
function useJoinedMembers(checkinId: string | null, creatorUserId: string | null, refreshKey: number) {
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [myMembership, setMyMembership] = useState<'none' | 'active' | 'request'>('none');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { userId } = useContext(AuthContext);

  useEffect(() => {
    if (!checkinId) { setMembers([]); setConversationId(null); setMyMembership('none'); return; }
    let cancelled = false;
    const load = async () => {
      const { data: conv } = await supabase
        .from('app_conversations')
        .select('id')
        .eq('checkin_id', checkinId)
        .maybeSingle();
      if (cancelled) return;
      if (!conv?.id) {
        // No chat yet — nobody joined. Only the creator exists.
        setConversationId(null);
        setMembers([]);
        setMyMembership('none');
        return;
      }
      setConversationId(conv.id);

      // All active members
      const { data: mems } = await supabase
        .from('app_conversation_members')
        .select('user_id, status')
        .eq('conversation_id', conv.id)
        .eq('status', 'active');
      if (cancelled) return;
      const memberIds = (mems || []).map(m => m.user_id);

      // My status
      if (userId && memberIds.includes(userId)) setMyMembership('active');
      else setMyMembership('none');

      // Hydrate profiles for display (exclude creator)
      const others = memberIds.filter(id => id !== creatorUserId);
      if (others.length === 0) { setMembers([]); return; }
      const { data: profiles } = await supabase
        .from('app_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', others);
      if (cancelled) return;
      setMembers(
        (profiles || []).map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        })),
      );
    };
    load();
    return () => { cancelled = true; };
  }, [checkinId, creatorUserId, userId, refreshKey]);

  return { members, myMembership, conversationId, setMyMembership };
}

export default function TimerBubble({
  visible, checkin, creatorName, creatorAvatarUrl,
  anchorX, anchorY, onClose,
}: Props) {
  const { userId } = useContext(AuthContext);
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();

  const countdown = useCountdown(checkin?.expires_at ?? null);
  const firstName = (creatorName || 'Nomad').split(' ')[0] || 'Nomad';
  const initials = (creatorName || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const actText = checkin?.activity_text || checkin?.status_text || '';
  const isOwn = !!(checkin && userId && checkin.user_id === userId);

  const [joining, setJoining] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Optimistically show me in the members row right after I tap Join.
  // Cleared whenever the bubble reopens for a fresh checkin.
  const [optimisticallyJoined, setOptimisticallyJoined] = useState(false);

  useEffect(() => {
    // Reset transient state whenever the bubble changes target.
    setOptimisticallyJoined(false);
    setJoining(false);
  }, [checkin?.id]);

  const { members, myMembership, conversationId, setMyMembership } =
    useJoinedMembers(checkin?.id || null, checkin?.user_id || null, refreshKey);

  const iAmMember = myMembership === 'active' || optimisticallyJoined;

  /* ── Join (visitor, not yet member) ──────────────────────────────
     Closed loop per logic skill:
       1. createOrJoinStatusChat inserts membership row + posts
          "joined the group" system message + increments count.
       2. Haptic impact.
       3. Optimistic: add me to the members row immediately.
       4. Refresh the members query to pick up the real server state. */
  const handleJoin = async () => {
    if (!checkin || !userId || joining) return;
    setJoining(true);
    setOptimisticallyJoined(true); // immediate UI response
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const { conversationId: cid, memberStatus, error } = await createOrJoinStatusChat(
        userId,
        checkin.user_id,
        checkin.activity_text || checkin.status_text || 'Timer',
        // TimerBubble is always called for timer pins; timers are always
        // public per spec so requiresApproval is implicitly false here.
      );
      if (error || !cid) {
        setOptimisticallyJoined(false);
        Alert.alert('could not join', (error as any)?.message || 'please try again');
        setJoining(false);
        return;
      }
      if (memberStatus === 'active') setMyMembership('active');
      trackEvent(userId, 'join_timer', 'checkin', checkin.id);
      // Pull the real members list so my avatar enters with the right data.
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      setOptimisticallyJoined(false);
      Alert.alert('could not join', e?.message || 'please try again');
    } finally {
      setJoining(false);
    }
  };

  /* ── Chat (already-member visitor) ── */
  const handleChat = () => {
    if (!checkin || !conversationId) return;
    Haptics.selectionAsync().catch(() => {});
    const title = checkin.activity_text || checkin.status_text || firstName;
    onClose();
    setTimeout(() => {
      nav.navigate('Chat', { conversationId, title, isGroup: true });
    }, 80);
  };

  /* ── Leave (already-member visitor) ── */
  const handleLeave = () => {
    if (!checkin || !userId || !conversationId) return;
    Alert.alert(
      'leave this timer?',
      'you won\'t get messages from this group anymore.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'leave',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            await leaveGroupChat(userId, conversationId);
            setOptimisticallyJoined(false);
            setMyMembership('none');
            setRefreshKey(k => k + 1);
          },
        },
      ],
    );
  };

  /* ── Manage (owner's own timer) ── */
  const handleManage = () => {
    if (!checkin) return;
    Haptics.selectionAsync().catch(() => {});
    onClose();
    setTimeout(() => {
      nav.navigate('UserProfile' as any, { userId: checkin.user_id, openCheckinId: checkin.id });
    }, 80);
  };

  const st = styles(colors);

  // Member row — up to 3 avatars, then "+N more"
  const shown = members.slice(0, 3);
  // Add myself optimistically at the end of the strip for instant feedback
  const meShown = optimisticallyJoined && !shown.some(m => m.user_id === userId);
  const othersCount = Math.max(0, members.length - shown.length);
  const showMembersRow = shown.length > 0 || meShown;

  return (
    <Bubble
      visible={visible}
      anchorX={anchorX}
      anchorY={anchorY}
      avatarUrl={creatorAvatarUrl || null}
      avatarFallback={initials}
      avatarFallbackColor={colors.primary}
      // No onPress on the shell — the inner CTA button owns the tap.
      // Backdrop still dismisses via onDismiss.
      onPress={undefined}
      onDismiss={onClose}
    >
      {/* TITLE — big, bold, the thing people read in one glance */}
      {!!actText && (
        <Text style={st.title} numberOfLines={3}>{actText}</Text>
      )}

      {/* Subtitle — creator + countdown. Small, muted, supporting. */}
      <Text style={st.subtitle} numberOfLines={1}>
        {firstName}
        {!!countdown && countdown !== 'ended' && ` · ends in ${countdown}`}
        {countdown === 'ended' && ' · ended'}
      </Text>

      {/* Member avatars — medium circles, social proof */}
      {showMembersRow && (
        <View style={st.membersRow}>
          {shown.map((m) => (
            <MemberDot key={m.user_id} url={m.avatar_url} name={m.full_name} st={st} />
          ))}
          {meShown && (
            <MemberDot key="me" url={null} name="you" st={st} highlight={colors.primary} />
          )}
          {othersCount > 0 && (
            <View style={[st.memberDot, st.memberDotMore]}>
              <Text style={st.memberMoreText}>+{othersCount}</Text>
            </View>
          )}
        </View>
      )}

      {/* Primary CTA — takes roughly half the bubble's vertical air */}
      <View style={st.ctaWrap}>
        {isOwn ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleManage}
            style={[st.cta, st.ctaPrimary]}
          >
            <NomadIcon name="settings" size={s(6)} color="#fff" strokeWidth={1.8} />
            <Text style={st.ctaText}>manage</Text>
          </TouchableOpacity>
        ) : iAmMember ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleChat}
              style={[st.cta, st.ctaPrimary]}
            >
              <NomadIcon name="chat" size={s(6)} color="#fff" strokeWidth={1.8} />
              <Text style={st.ctaText}>chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleLeave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={st.leaveLink}
            >
              <Text style={st.leaveLinkText}>leave</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleJoin}
            disabled={joining}
            style={[st.cta, st.ctaPrimary, joining && { opacity: 0.7 }]}
          >
            {joining ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <NomadIcon name="plus" size={s(6)} color="#fff" strokeWidth={2} />
                <Text style={st.ctaText}>join</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </Bubble>
  );
}

/* ─── Small member avatar dot (medium size, row) ─── */
function MemberDot({
  url, name, st, highlight,
}: {
  url: string | null;
  name: string | null;
  st: ReturnType<typeof styles>;
  highlight?: string;
}) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[st.memberDot, highlight ? { borderColor: highlight, borderWidth: 2 } : null]}>
      {url ? (
        <Image source={{ uri: url }} style={st.memberImg} />
      ) : (
        <Text style={st.memberInitials}>{initials}</Text>
      )}
    </View>
  );
}

const styles = (c: ThemeColors) => StyleSheet.create({
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
  },

  /* Member row */
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  memberDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4A582',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberDotMore: {
    backgroundColor: '#E5E7EB',
  },
  memberImg: { width: '100%', height: '100%' },
  memberInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B1F1A',
  },
  memberMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  /* CTA — takes the lower half of the bubble */
  ctaWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
  },
  ctaPrimary: {
    backgroundColor: '#E8614D', // brand primary
    shadowColor: '#E8614D',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },

  /* Secondary leave link — small, unobtrusive */
  leaveLink: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  leaveLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'lowercase',
  },
});
