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
import { useI18n } from '../lib/i18n';
import { useEventTime } from '../lib/eventTime';
import { useViewerCountry, canJoinEvent } from '../lib/geo';
import { countryLabel } from '../lib/countryNames';

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
  /** Optional pre-join gate — HomeScreen's `wisdomGate` uses
   *  it to ask "are you actually going to Tokyo?" before a
   *  visitor joins a far-away scheduled event. If provided,
   *  we call it with the checkin + a `doJoin` callback that
   *  runs the normal createOrJoinStatusChat flow. If absent
   *  we join immediately — same behavior as before the
   *  scheduled-pin unification. */
  onBeforeJoin?: (checkin: AppCheckin, doJoin: () => void) => void;
}

interface MemberLite {
  user_id: string;
  avatar_url: string | null;
  full_name: string | null;
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
  visible, checkin, creatorName, creatorAvatarUrl, onClose, onOwnerEnd, onBeforeJoin,
}: Props) {
  const { userId } = useContext(AuthContext);
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const { t, locale } = useI18n();

  /* ── Gate 3 of the geo-boundaries spec ──
     Viewer's GPS country vs the event's `country` column. When the
     viewer is far from home (canJoinEvent === false), the Join button
     is replaced by a disabled "far from home" label — no tap, no
     network call, no accidental foreign joins.
     `useViewerCountry` fail-opens on null (GPS warming up, permission
     denied) so the local UX is never blocked by transient state.
     The publish gate (Gate 1) is the strict one — see
     HomeScreen.publishCheckin. */
  const viewerCountry = useViewerCountry();
  const canJoin = canJoinEvent(
    viewerCountry,
    checkin ? { country: checkin.country } : null,
  );
  const eventCountryLabel = countryLabel(
    checkin?.country ?? null,
    locale,
    '',
  );

  /* Unified WHEN display — replaces the old inline `useCountdown`
   * which only handled timers. Now the same bubble can render:
   *   • timer         → "ends in 23m" (live tick)
   *   • starts-soon   → "starts in 3h"
   *   • starts-on     → "tomorrow · 18:00" / "mon 21 apr · 18:00"
   *   • live-now      → "live now · ends in 2h"
   *   • ended         → "ended"
   * …so a visitor tapping a scheduled pin sees the SAME bubble
   * shell + exact time info instead of being routed to a
   * separate ActivityDetailSheet. Matches the product-owner's
   * "same bubble, same idea" directive (2026-04-20).
   */
  const checkinType: 'timer' | 'status' =
    ((checkin as any)?.checkin_type as 'timer' | 'status') || 'timer';
  const whenState = useEventTime({
    type: checkinType,
    scheduledFor: checkin?.scheduled_for ?? null,
    expiresAt: checkin?.expires_at ?? null,
    isFlexible: (checkin as any)?.is_flexible_time ?? false,
  });
  const whenText = (() => {
    switch (whenState.kind) {
      case 'timer-live':
        return t('event.when.endsIn', { dur: whenState.durationShort || '' });
      case 'timer-ended':
      case 'ended':
        return t('event.when.ended');
      case 'starts-soon':
        return t('event.when.startsIn', { dur: whenState.durationShort || '' });
      case 'live-now':
        return `${t('event.when.liveNow')}${t('event.when.sep')}${t('event.when.endsIn', { dur: whenState.durationShort || '' })}`;
      case 'starts-on': {
        const dayPart = whenState.dayKey === 'today'
          ? t('event.when.today')
          : whenState.dayKey === 'tomorrow'
            ? t('event.when.tomorrow')
            : (whenState.dayLabel || '');
        /* A specific time beats "all day" every time — if
           the creator picked an hour in the WHEN step, show
           it. "all day" is the fallback only when the event
           has no hour AND is marked flexible (future UX: an
           explicit all-day toggle). */
        const timePart = whenState.timeShort
          ? whenState.timeShort
          : whenState.flexible
            ? t('event.when.allDay')
            : '';
        return timePart ? `${dayPart}${t('event.when.sep')}${timePart}` : dayPart;
      }
      default:
        return '';
    }
  })();
  const whenIsLive = whenState.kind === 'timer-live'
    || whenState.kind === 'live-now'
    || whenState.kind === 'starts-soon';

  const creatorFallback = t('event.fallback.creator');
  const firstName = (creatorName || creatorFallback).split(' ')[0] || creatorFallback;
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
       1. (Optional) onBeforeJoin lets the parent run a pre-join
          gate — HomeScreen uses this to trigger the "are you
          really going to Tokyo?" wisdom prompt before a visitor
          joins a far-away scheduled event. If absent we join
          immediately.
       2. createOrJoinStatusChat inserts membership row + posts
          "joined the group" system message + increments count.
       3. Haptic impact.
       4. Optimistic: add me to the members row immediately.
       5. Refresh the members query to pick up the real server state. */
  const handleJoin = () => {
    if (!checkin || !userId || joining) return;
    if (onBeforeJoin) {
      onBeforeJoin(checkin, () => { void doJoin(); });
      return;
    }
    void doJoin();
  };

  const doJoin = async () => {
    if (!checkin || !userId || joining) return;
    setJoining(true);
    setOptimisticallyJoined(true); // immediate UI response
    setCountDelta(1);               // "X going" bumps +1 instantly
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      // Shared fallback so the chat title + metadata always
       // agree. Without it the conversation's name and its
       // activityText could drift — e.g. if someone refactored
       // one literal and forgot the other.
      const activityFallback = t('event.fallback.activity');
      const chatName = checkin.activity_text || checkin.status_text || activityFallback;
      const { conversationId: cid, memberStatus, error } = await createOrJoinStatusChat(
        userId,
        checkin.user_id,
        chatName,
        // Pass metadata so the new conversation gets linked to this
        // exact checkin via checkin_id. Without this, useJoinedMembers
        // can't find the conv on the next render and the chat/leave
        // buttons stay disabled. (Backwards-compatible name+owner
        // fallback exists in the hook for older convs without this
        // link.) Timers are always public per spec.
        {
          checkinId: checkin.id,
          activityText: chatName,
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
        Alert.alert(
          t('event.error.joinFailedTitle'),
          (error as any)?.message || t('event.error.joinFailedGeneric')
        );
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
      Alert.alert(
        t('event.error.joinFailedTitle'),
        e?.message || t('event.error.joinFailedGeneric')
      );
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
      t('event.confirm.leaveTitle'),
      t('event.confirm.leaveBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('event.confirm.leaveAction'),
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

  /* ── Owner action — "End now"
   *
   *  Confirm alert, then parent's onOwnerEnd expires the checkin
   *  in Supabase. Stays on the map; no navigation away. Unified
   *  action for both timers and scheduled statuses.
   *
   *  onOwnerEnd is a required-in-practice prop — every real
   *  caller passes one. We assert existence at call time rather
   *  than ship a fallback nav path (that would be a band-aid
   *  that rots the moment someone forgets to wire the prop). */
  const handleEnd = () => {
    if (!checkin) return;
    if (!onOwnerEnd) {
      // Visible log so the wiring break is obvious in dev.
      console.warn('[TimerBubble] onOwnerEnd missing — End now is a no-op');
      return;
    }
    Alert.alert(
      t('event.confirm.endTitle'),
      t('event.confirm.endBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('event.confirm.endAction'),
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
    allParticipants.push({ user_id: userId, avatar_url: null, full_name: t('event.you') });
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

      {/* Subtitle — unified WHEN display (timer countdown OR
          scheduled date/time). Live states render in brand
          coral so the eye lands on "ends in 23m" the moment
          the bubble opens; future scheduled events render in
          calm muted grey. One signal, one surface. */}
      {!!whenText && (
        <Text
          style={[st.subtitle, whenIsLive && st.subtitleLive]}
          numberOfLines={1}
        >
          {whenText}
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
        <Text style={st.goingCount}>{t('event.going', { count: goingCount })}</Text>
      </View>

      {/* CTA area — fixed total height across all states so the bubble
          doesn't grow/shrink between "not joined" and "joined". */}
      <View style={st.ctaWrap}>
        {isOwn ? (
          /* Owner: full-width "End now". Soft neutral fill + red
             text — destructive but not shouting, lets the user
             dismiss their own post calmly. ctaLeave is reserved
             for the visitor "leave the group" flow where a louder
             red is appropriate. */
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleEnd}
            style={[st.cta, st.ctaEnd]}
          >
            <NomadIcon name="close" size={s(6)} color="#DC2626" strokeWidth={2} />
            <Text style={[st.ctaText, st.ctaEndText]}>{t('event.cta.endNow')}</Text>
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
              <Text style={st.ctaText}>{t('event.cta.chat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLeave}
              style={[st.cta, st.ctaLeave, { flex: 1 }]}
            >
              <Text style={st.ctaText}>{t('event.cta.leave')}</Text>
            </TouchableOpacity>
          </View>
        ) : !canJoin ? (
          /* Visitor, but far from home (Gate 3). Disabled "far from
             home" label instead of a Join button. No onPress — a
             foreign viewer should NEVER be able to trigger a join
             request. The subtitle tells them where to travel to. */
          <View style={[st.cta, st.ctaDisabledForeign]}>
            <NomadIcon name="globe" size={s(6)} color="#9CA3AF" strokeWidth={1.8} />
            <View style={{ alignItems: 'center' }}>
              <Text style={[st.ctaText, st.ctaDisabledText]}>
                {t('geo.block.joinDisabledLabel')}
              </Text>
              {eventCountryLabel ? (
                <Text style={st.ctaDisabledSubText}>
                  {t('geo.block.joinDisabledSub', { country: eventCountryLabel })}
                </Text>
              ) : null}
            </View>
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
                <Text style={st.ctaText}>{t('event.cta.join')}</Text>
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
  /* Live variant — brand coral + heavier weight. Applied when
     the event is currently running (timer-live / live-now) or
     starting in <24h (starts-soon). Signals presence / urgency
     without adding a second UI element. */
  subtitleLive: {
    color: '#E8614D',
    fontWeight: '700',
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
  /* End now — soft neutral fill with red text. Used on the
     owner-on-own-pin path where the action is destructive but
     personal (I'm ending MY post) and doesn't need to scream. */
  ctaEnd: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    // no shadow — keeps the button quiet inside the bubble
  },
  ctaEndText: {
    color: '#DC2626',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
  /* Disabled-foreign state — the viewer is outside the event's
     country. Same footprint as a Join button so the bubble height
     doesn't jump, but quiet colors, no shadow, and a tiny sub-label
     explaining why it's disabled. Non-interactive (rendered as a
     View, no onPress). */
  ctaDisabledForeign: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ctaDisabledText: {
    color: '#6B7280',
  },
  ctaDisabledSubText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 1,
    letterSpacing: 0.2,
    textTransform: 'lowercase',
  },
});
