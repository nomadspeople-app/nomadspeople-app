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
  onClose: () => void;
  /** Owner action — fires when the creator taps "End now" on
   *  their own pin. Parent is responsible for expiring the
   *  checkin in Supabase + refreshing the map. If absent, we
   *  fall back to the legacy "manage" navigation (which we
   *  keep only so old callers don't break). */
  onOwnerEnd?: (checkin: AppCheckin) => void;
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
 *  Primary lookup: app_conversations.checkin_id (exact link).
 *  Fallback: name + created_by — used for conversations created by
 *  older code paths that didn't set checkin_id. Without this
 *  fallback, the chat/leave buttons stay disabled after join
 *  because no conversation is found. */
function useJoinedMembers(
  checkinId: string | null,
  creatorUserId: string | null,
  checkinName: string | null,
  refreshKey: number,
) {
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [myMembership, setMyMembership] = useState<'none' | 'active' | 'request'>('none');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { userId } = useContext(AuthContext);

  useEffect(() => {
    if (!checkinId) { setMembers([]); setConversationId(null); setMyMembership('none'); return; }
    let cancelled = false;
    const load = async () => {
      // 1. Try exact link via checkin_id
      const byCheckin = await supabase
        .from('app_conversations')
        .select('id')
        .eq('checkin_id', checkinId)
        .maybeSingle();
      let conv = byCheckin.data;

      // 2. Fallback for legacy chats with no checkin_id set — match
      //    by owner + name (exactly what createOrJoinStatusChat does
      //    when it looks for "existing" conversations).
      if (!conv?.id && creatorUserId && checkinName) {
        const byName = await supabase
          .from('app_conversations')
          .select('id')
          .eq('type', 'group')
          .eq('name', checkinName)
          .eq('created_by', creatorUserId)
          .limit(1)
          .maybeSingle();
        conv = byName.data;
      }

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

  return { members, myMembership, conversationId, setConversationId, setMyMembership };
}

export default function TimerBubble({
  visible, checkin, creatorName, creatorAvatarUrl, onClose, onOwnerEnd,
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
  // Optimistic count adjustment — +1 on Join (before server confirms),
  // -1 on Leave. Merged with checkin.member_count for display so the
  // "X going" number reacts instantly to taps, before refetch.
  const [countDelta, setCountDelta] = useState(0);

  useEffect(() => {
    // Reset transient state whenever the bubble changes target.
    setOptimisticallyJoined(false);
    setJoining(false);
    setCountDelta(0);
  }, [checkin?.id]);

  const { members, myMembership, conversationId, setConversationId, setMyMembership } =
    useJoinedMembers(
      checkin?.id || null,
      checkin?.user_id || null,
      checkin?.activity_text || checkin?.status_text || null,
      refreshKey,
    );

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
    setCountDelta(1);               // "X going" bumps +1 instantly
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const { conversationId: cid, memberStatus, error } = await createOrJoinStatusChat(
        userId,
        checkin.user_id,
        checkin.activity_text || checkin.status_text || 'Timer',
        // Pass metadata so the new conversation gets linked to this
        // exact checkin via checkin_id. Without this, useJoinedMembers
        // can't find the conv on the next render and the chat/leave
        // buttons stay disabled. (Backwards-compatible name+owner
        // fallback exists in the hook for older convs without this
        // link.) Timers are always public per spec.
        {
          checkinId: checkin.id,
          activityText: checkin.activity_text || checkin.status_text || 'Timer',
          emoji: checkin.status_emoji || null,
          category: (checkin as any).category || null,
          locationName: checkin.location_name || null,
          latitude: checkin.latitude || null,
          longitude: checkin.longitude || null,
          isOpen: true,
        } as any,
      );
      if (error || !cid) {
        // Roll back optimistic state — server rejected.
        setOptimisticallyJoined(false);
        setCountDelta(0);
        Alert.alert('could not join', (error as any)?.message || 'please try again');
        setJoining(false);
        return;
      }
      // Set conversationId IMMEDIATELY from the helper's return — so
      // tapping chat/leave right after joining works without waiting
      // for the refetch cycle. (Previously the buttons did nothing
      // because `conversationId` was still null at that moment.)
      setConversationId(cid);
      if (memberStatus === 'active') setMyMembership('active');
      trackEvent(userId, 'join_timer', 'checkin', checkin.id);
      // Pull the real members list so my avatar enters with the right data.
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      setOptimisticallyJoined(false);
      setCountDelta(0);
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
            // Optimistic count decrement — "X going" drops by 1 now.
            setCountDelta(-1);
            setOptimisticallyJoined(false);
            setMyMembership('none');
            await leaveGroupChat(userId, conversationId);
            setRefreshKey(k => k + 1);
          },
        },
      ],
    );
  };

  /* ── Owner actions (creator tapping their own pin) ──
   *
   *  "End now" — confirm alert, then parent's onOwnerEnd expires
   *  the checkin in Supabase. Stays on the map; no navigation
   *  away. This is the unified management action for both
   *  timers and scheduled statuses.
   *
   *  If onOwnerEnd isn't provided (legacy callers), we fall back
   *  to the old nav-to-profile behavior. */
  const handleEnd = () => {
    if (!checkin) return;
    if (!onOwnerEnd) {
      Haptics.selectionAsync().catch(() => {});
      onClose();
      setTimeout(() => {
        nav.navigate('UserProfile' as any, { userId: checkin.user_id, openCheckinId: checkin.id });
      }, 80);
      return;
    }
    Alert.alert(
      'End this now?',
      'People will no longer see it on the map or be able to join.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'end',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            onOwnerEnd(checkin);
            onClose();
          },
        },
      ],
    );
  };

  const st = styles(colors);

  // Participants strip — ALWAYS shows avatars. Creator first (so a
  // brand-new timer with zero joiners still has 1 visible icon),
  // then joiners. Up to 4 avatars side-by-side; the rest collapse
  // into a "+N" pill. Matches the user's spec exactly:
  //   2 participants → 2 icons,  4 → 4,  >4 → 4 + "+N".
  type Participant = { user_id: string; avatar_url: string | null; full_name: string | null };
  const allParticipants: Participant[] = [
    {
      user_id: checkin?.user_id || 'creator',
      avatar_url: creatorAvatarUrl || null,
      full_name: creatorName,
    },
    ...members,
  ];
  // Add me optimistically if I just tapped Join and the server hasn't
  // returned my row yet. Skip if I'm already in the list (e.g., refetch
  // landed) so I don't appear twice.
  if (optimisticallyJoined && userId && !allParticipants.some(p => p.user_id === userId)) {
    allParticipants.push({ user_id: userId, avatar_url: null, full_name: 'you' });
  }
  // Pure Facepile per user spec: up to 3 overlapping avatars, then a
  // +N gray circle if there are more. NO usernames anywhere — visual
  // stack only. A small "X going" count sits beside the stack to
  // convey the action ("going").
  const MAX_AVATARS = 3;
  const shownAvatars = allParticipants.slice(0, MAX_AVATARS);
  const baseCount = Math.max(1, checkin?.member_count ?? 1);
  const goingCount = Math.max(allParticipants.length, baseCount + countDelta);
  const overflow = Math.max(0, goingCount - shownAvatars.length);

  return (
    <Bubble
      visible={visible}
      avatarUrl={creatorAvatarUrl || null}
      avatarFallback={initials}
      avatarFallbackColor={colors.primary}
      // No onPress on the shell — the inner CTA button owns the tap.
      // Backdrop still dismisses via onDismiss.
      onPress={undefined}
      onDismiss={onClose}
    >
      {/* TITLE — reads like a quote: "Barak [asks] מי בא לים".
          The name sits at the start of the sentence in heavy bold
          (800/900) so the reader instantly knows WHO is inviting,
          and the activity text continues on the same line at a
          lighter weight. No "says" / "asks" word — the layout
          itself carries that meaning. */}
      <Text style={st.title} numberOfLines={3}>
        <Text style={st.titleName}>{firstName}</Text>
        {actText ? ` ${actText}` : ''}
      </Text>

      {/* Subtitle — countdown only. The creator name is already
          in the title above. */}
      {!!countdown && (
        <Text style={st.subtitle} numberOfLines={1}>
          {countdown === 'ended' ? 'ended' : `ends in ${countdown}`}
        </Text>
      )}

      {/* Participants row — ALWAYS visible. Up to 4 avatars side-by-side
          (creator first), then "+N" pill if there are more. Plus the
          "X going" count next to it for an at-a-glance number. */}
      {/* Facepile — pure visual stack, no usernames, no special
          highlight on "me". Uniform 32×32 circles with a thick 2px
          white border and heavy -14 overlap so they sit
          "one on top of the other" like Instagram Stories. */}
      <View style={st.membersRow}>
        <View style={st.avatarStrip}>
          {shownAvatars.map((p, i) => (
            <View key={p.user_id} style={i > 0 ? { marginLeft: -14 } : null}>
              <MemberDot url={p.avatar_url} name={p.full_name} st={st} />
            </View>
          ))}
          {overflow > 0 && (
            <View style={[st.memberDot, st.memberDotMore, { marginLeft: -14 }]}>
              <Text style={st.memberMoreText}>+{overflow}</Text>
            </View>
          )}
        </View>
        {/* Small action text — keeps the "going" meaning without
            naming anyone. Pure count next to the stack. */}
        <Text style={st.goingCount}>{goingCount} going</Text>
      </View>

      {/* CTA area — fixed total height across all states so the bubble
          doesn't grow/shrink between "not joined" and "joined". */}
      <View style={st.ctaWrap}>
        {isOwn ? (
          /* Owner: full-width "End now" button. Stays on the map
             — no navigation. Firing onOwnerEnd from the parent
             expires the checkin in Supabase. */
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleEnd}
            style={[st.cta, st.ctaLeave]}
          >
            <NomadIcon name="close" size={s(6)} color="#fff" strokeWidth={2} />
            <Text style={st.ctaText}>end now</Text>
          </TouchableOpacity>
        ) : iAmMember ? (
          /* Joined visitor: chat (blue, wide) + leave (red, narrow)
             on the SAME ROW. Same height as the Join button so the
             total bubble height is identical across states. */
          <View style={st.ctaRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleChat}
              style={[st.cta, st.ctaChat, { flex: 2.2 }]}
            >
              <NomadIcon name="chat" size={s(6)} color="#fff" strokeWidth={1.8} />
              <Text style={st.ctaText}>chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLeave}
              style={[st.cta, st.ctaLeave, { flex: 1 }]}
            >
              <Text style={st.ctaText}>leave</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Visitor not yet joined: full-width JOIN */
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleJoin}
            disabled={joining}
            style={[st.cta, st.ctaJoin, joining && { opacity: 0.7 }]}
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

/* ─── Member avatar dot — uniform 32×32 for every participant.
    No per-user styling differences; the only variation is the
    image itself (or initials fallback). */
function MemberDot({
  url, name, st,
}: {
  url: string | null;
  name: string | null;
  st: ReturnType<typeof styles>;
}) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={st.memberDot}>
      {url ? (
        <Image source={{ uri: url }} style={st.memberImg} />
      ) : (
        <Text style={st.memberInitials}>{initials}</Text>
      )}
    </View>
  );
}

const styles = (c: ThemeColors) => StyleSheet.create({
  // Title is the "Barak מי בא לים עוד שעתיים" block.
  // Base weight is medium so the inline bold name (below) pops
  // against it and the reader instantly sees: NAME + what they're
  // saying. Color is the same across — contrast comes from weight
  // alone (cleaner than mixing colors here).
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  // Inline on the same Text block — this is the "who is asking" slot.
  // 900 makes it visibly heavier than the 500 surrounding copy without
  // needing a color change or a different font family.
  titleName: {
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
  },

  /* Member row — fixed min-height so the bubble doesn't grow
     when the first person joins. Shows either the empty-state
     invitation or the avatars + "X going" count. */
  membersRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  avatarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  /* Member dot — uniform 32×32 for every participant (no size
     difference for the current user). 2px white border makes the
     overlap read as distinct circles even when they're 14px on
     top of each other. */
  memberDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#3B1F1A',
  },
  memberMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  /* Count text next to the stack — a single "N going". Short,
     muted grey, regular weight. Carries the action ("going")
     without ever naming a person. */
  goingCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptyMembers: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  /* CTA area — constant height across states */
  ctaWrap: {
    width: '100%',
    marginTop: 4,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%', // overridden by flex in the Chat/Leave row
  },
  /* Join / Manage — brand coral, full width */
  ctaJoin: {
    backgroundColor: '#E8614D',
    shadowColor: '#E8614D',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  /* Chat — gentle blue, wide. Soft shadow in its own tone. */
  ctaChat: {
    backgroundColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  /* Leave — solid red, narrower. Same height/radius as chat so the
     two read as a paired action bar rather than a heavy CTA + tiny link. */
  ctaLeave: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
});
