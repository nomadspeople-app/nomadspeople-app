import { useState, useContext, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image,
  Animated, PanResponder, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import NomadIcon from '../components/NomadIcon';
import AvatarTouchable from '../components/AvatarTouchable';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList } from '../lib/types';
import { useConversations, lockConversation, deleteConversation, leaveGroupChat, hideConversation, unhideConversation, type ConversationWithPreview } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterTab = 'All' | 'Groups' | 'Direct';

// Peach palette for group avatars — warm, pastel, on-brand with #E8614D.
// Replaces the old navy/gray palette which felt corporate. Dark text on
// these so the initials/emoji stay readable.
const GROUP_COLORS = ['#FFCDB2', '#FFB4A2', '#FFAB91', '#FCC8B3', '#FFA07A', '#E5989B'];
const getGroupColor = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];
// Soft warm fallback for DM avatars when the other user has no
// avatar_url. Matches the family but is distinct from group tones.
const DM_FALLBACK_COLOR = '#F4A582';
const getInitials = (name?: string | null) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() : '??';

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/* ─── Swipeable conversation row ─── */
function SwipeableConvRow({
  conv, idx, userId, nav, t, colors, st,
  onLock, onDelete, onLeave, onHide, onMute, closeSignal,
  isLast,
}: {
  conv: ConversationWithPreview;
  idx: number;
  userId: string | null;
  nav: Nav;
  t: (k: string) => string;
  colors: ReturnType<typeof useTheme>['colors'];
  st: ReturnType<typeof makeStyles>;
  onLock: (id: string) => void;
  onDelete: (id: string) => void;
  onLeave: (id: string) => void;
  onHide: (id: string) => void;
  onMute: (id: string) => void;
  closeSignal: number;
  isLast: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const isGroup = conv.type === 'group';
  const isDM = conv.type === 'dm';
  const isExpired = conv.is_expired === true;
  const isLocked = conv.is_locked === true;
  const isDead = isExpired || isLocked;
  const isCreator = conv.created_by === userId;
  const isGroupMember = isGroup && !isCreator;

  const canSwipe = isDM || isGroupMember || (isCreator && isDead && !isLocked) || (isGroup && isDead);
  const canSwipeRef = useRef(canSwipe);
  canSwipeRef.current = canSwipe;

  useEffect(() => {
    if (isOpen.current) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      isOpen.current = false;
    }
  }, [closeSignal]);

  // Use the live animated value (not gs.dx) on release — otherwise small
  // reverse-drift before releasing makes gs.dx drop under threshold and
  // the row snaps back even though the user clearly pulled it open.
  const currentXRef = useRef(0);
  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => canSwipeRef.current && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        // Start the move from wherever the row currently sits (so a
        // second swipe on an already-open row feels continuous).
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        // Support swiping further right AND closing with a leftward drag
        // when already open. Clamp to [0, 170].
        const base = isOpen.current ? 160 : 0;
        const next = Math.max(0, Math.min(base + gs.dx, 170));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        const x = currentXRef.current;
        // Fling right or past halfway → open. Fling left or below 40 → close.
        const shouldOpen = gs.vx > 0.25 ? true : gs.vx < -0.25 ? false : x > 60;
        Animated.spring(translateX, {
          toValue: shouldOpen ? 160 : 0,
          useNativeDriver: true,
          velocity: gs.vx,
          bounciness: 4,
        }).start();
        isOpen.current = shouldOpen;
      },
      onPanResponderTerminate: () => {
        // Another responder took over — settle to current side cleanly.
        const shouldOpen = currentXRef.current > 80;
        Animated.spring(translateX, { toValue: shouldOpen ? 160 : 0, useNativeDriver: true }).start();
        isOpen.current = shouldOpen;
      },
    })
  ).current;

  const handleLock = () => {
    Alert.alert(
      'close group chat?',
      'no one will be able to send new messages. chat history stays visible.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'close',
          style: 'destructive',
          onPress: () => {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            onLock(conv.id);
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    const doDelete = () => {
      Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
        onDelete(conv.id);
      });
    };

    if (isDead) {
      doDelete();
      return;
    }

    Alert.alert(
      'delete active group?',
      'you will lose access to this chat and all its messages. this cannot be undone.',
      [
        { text: 'cancel', style: 'cancel' },
        { text: 'delete', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const handleMute = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    onMute(conv.id);
    // expo-haptics has no NotificationFeedbackType.Light — the
    // three valid types are Success / Warning / Error. A "mute"
    // feels more like a subtle selection tick than a hard
    // success, so we use selectionAsync() instead.
    Haptics.selectionAsync().catch(() => {});
  };

  const handleLeave = () => {
    Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
      onLeave(conv.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    });
  };

  // Hide — only makes sense for an ACTIVE group where the user is a
  // member (not the owner). It hides the row from *this* user's list
  // without touching membership; new messages re-surface it automatically.
  const handleHide = () => {
    Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
      onHide(conv.id);
      Haptics.selectionAsync().catch(() => {});
    });
  };

  // DMs get the soft warm fallback (under the avatar_url Image, only
  // visible when the other user has no avatar). Groups get the peach
  // palette per index. Dead chats grey out either way.
  const avatarColor = isDead
    ? '#D1D5DB'
    : isGroup
      ? getGroupColor(idx)
      : DM_FALLBACK_COLOR;
  const otherMember = conv.members?.find(m => m.user_id !== userId);
  const otherProfile = otherMember?.profile;
  const avatarUrl = isGroup ? null : (otherProfile as any)?.avatar_url || null;
  const groupEmoji = isGroup ? (conv.emoji || null) : null;
  const avatarText = isGroup
    ? (groupEmoji || getInitials(conv.name))
    : getInitials(otherProfile?.display_name || otherProfile?.full_name || conv.name);
  const displayName = isGroup
    ? (conv.name || 'group')
    : (otherProfile?.display_name || otherProfile?.full_name || 'nomad');
  const preview = conv.last_message?.content || '';
  const time = conv.last_message?.sent_at ? timeAgo(conv.last_message.sent_at) : '';
  const hasUnread = conv.unread_count > 0 && !isDead && !conv.is_muted;

  return (
    <View style={st.swipeWrap}>
      {/* Actions behind row */}
      {canSwipe && (
        <View style={st.swipeActionsContainer}>
          {/* Mute button — smaller icon for a lighter feel. Flips
              bell → bell-active so the icon reflects the state. */}
          <TouchableOpacity style={[st.swipeAction, st.swipeActionMute]} activeOpacity={0.8} onPress={handleMute}>
            <NomadIcon name={conv.is_muted ? "bell-active" : "bell"} size={s(6)} color="white" strokeWidth={2} />
            <Text style={st.swipeActionText}>{conv.is_muted ? 'unmute' : 'mute'}</Text>
          </TouchableOpacity>

          {/* Primary action button */}
          {isDM ? (
            <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleDelete}>
              <NomadIcon name="close" size={s(6)} color="white" strokeWidth={2} />
              <Text style={st.swipeActionText}>delete</Text>
            </TouchableOpacity>
          ) : isGroup && isDead ? (
            isGroupMember ? (
              <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleLeave}>
                <NomadIcon name="logout" size={s(6)} color="white" strokeWidth={2} />
                <Text style={st.swipeActionText}>leave</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleDelete}>
                <NomadIcon name="close" size={s(6)} color="white" strokeWidth={2} />
                <Text style={st.swipeActionText}>delete</Text>
              </TouchableOpacity>
            )
          ) : isGroupMember ? (
            // Active group, user is a member (not owner) → HIDE locally,
            // do NOT remove membership. Fixes the "swipe-to-delete kicked
            // me out of the group" bug. To actually leave the group, use
            // the GroupInfoScreen → Leave action.
            <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleHide}>
              <NomadIcon name="eye-off" size={s(6)} color="white" strokeWidth={2} />
              <Text style={st.swipeActionText}>hide</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleLock}>
              <NomadIcon name="lock" size={s(6)} color="white" strokeWidth={2} />
              <Text style={st.swipeActionText}>close</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Animated.View
        style={[st.rowAnimated, { transform: [{ translateX }] }]}
        {...(canSwipe ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity
          style={st.row}
          activeOpacity={0.6}
          onPress={() => nav.navigate('Chat', {
            conversationId: conv.id,
            title: displayName,
            avatarColor,
            avatarText,
            isGroup,
          })}
        >
          {/* Avatar — tappable for DMs (→ that user's profile),
              non-tappable for groups (no single user). The outer
              row's TouchableOpacity still catches taps OUTSIDE the
              avatar circle and routes them to the chat, so:
                - tap face → profile
                - tap anywhere else on the row → chat
              The select-mode avatar render below (line ~658) is
              intentionally NOT wrapped — taps there toggle the
              checkbox, profile navigation would fight that. */}
          <AvatarTouchable
            userId={isGroup ? null : (otherMember?.user_id ?? null)}
            userName={isGroup ? null : (otherProfile?.display_name || otherProfile?.full_name || null)}
            style={[
              st.avatar,
              { backgroundColor: avatarColor },
              isGroup && st.avatarGroup,
              isDead && { opacity: 0.55 },
            ]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={st.avatarImg} />
            ) : (
              <Text style={[
                st.avatarText,
                isGroup && groupEmoji ? st.avatarEmoji : isGroup ? st.avatarInitials : null,
              ]}>
                {avatarText}
              </Text>
            )}
          </AvatarTouchable>

          {/* Name + preview */}
          <View style={st.info}>
            <View style={st.nameRow}>
              <Text
                style={[st.name, hasUnread && st.nameUnread, isDead && st.nameDead]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {isLocked && (
                <View style={{ marginLeft: s(2) }}>
                  <NomadIcon name="lock" size={s(4.5)} color={colors.textSec} strokeWidth={1.4} />
                </View>
              )}
              {isExpired && !isLocked && (
                <View style={{ marginLeft: s(2) }}>
                  <NomadIcon name="clock" size={s(4.5)} color={colors.textSec} strokeWidth={1.4} />
                </View>
              )}
              {time ? <Text style={[st.time, isDead && st.timeDead]}> · {time}</Text> : null}
            </View>
            <Text
              style={[st.preview, hasUnread && st.previewUnread, isDead && st.previewDead]}
              numberOfLines={1}
            >
              {isLocked ? 'chat closed' : preview}
            </Text>
          </View>

          {/* Right: badge or muted icon */}
          <View style={st.meta}>
            {conv.is_muted && (
              <View style={{ opacity: 0.4 }}>
                <NomadIcon name="bell" size={s(4)} color={colors.textSec} strokeWidth={1.4} />
              </View>
            )}
            {hasUnread ? (
              <View style={st.badge}>
                <Text style={st.badgeText}>{conv.unread_count}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Separator — like Instagram, thin line under the text area (not full width) */}
        {!isLast && <View style={st.separator} />}
      </Animated.View>
    </View>
  );
}

export default function PulseScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const { userId } = useContext(AuthContext);
  const { conversations, loading, refetch } = useConversations(userId);
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [closeSignal, setCloseSignal] = useState(0);

  /* ─── Undo-toast + optimistic-pending system ───
     When the user swipes a destructive action, we:
       1. Show a toast "hidden" / "deleted" / "left" with an Undo button.
       2. Optimistically hide the row from the list right away.
       3. For non-destructive actions (hide): commit the DB write now;
          Undo reverses it.
       4. For destructive actions (delete / leave / lock): defer the DB
          write for 4s; Undo cancels it before it fires.
     Everything routes through toastAction() below so the UX is uniform.  */
  type ActionKind = 'hide' | 'delete' | 'leave' | 'lock';
  type PendingAction = {
    kind: ActionKind;
    convId: string;
    label: string;          // toast message
    timer: ReturnType<typeof setTimeout> | null;
    undo: () => Promise<void>;
  };
  const [pending, setPending] = useState<PendingAction | null>(null);
  const pendingRef = useRef<PendingAction | null>(null);
  pendingRef.current = pending;

  useFocusEffect(useCallback(() => {
    refetch();
    setCloseSignal(c => c + 1);
  }, [refetch]));

  // On unmount, let any in-flight timer fire (don't clearTimeout) so the
  // destructive write completes even if the user closes the app. For an
  // in-flight hide, the DB write has already happened — so leaving the
  // toast reference behind is safe. We just release the React state.
  useEffect(() => {
    return () => { setPending(null); };
  }, []);

  const filtered = conversations.filter((c) => {
    // Hide the row that has a pending action in-flight (optimistic)
    if (pending?.convId === c.id) return false;
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Groups') return c.type === 'group';
    return c.type === 'dm';
  });

  const sorted = [...filtered].sort((a, b) => {
    const aScore = a.is_locked ? 2 : a.is_expired ? 1 : 0;
    const bScore = b.is_locked ? 2 : b.is_expired ? 1 : 0;
    return aScore - bScore;
  });

  /** Cancel any pending action (e.g. user swiped another row, screen blurred). */
  const flushPending = useCallback(async (mode: 'commit' | 'cancel') => {
    const p = pendingRef.current;
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    setPending(null);
    if (mode === 'cancel') {
      await p.undo();
    }
    refetch();
  }, [refetch]);

  /** Show a toast with Undo. Replaces any in-flight toast (committing it). */
  const startToast = useCallback((next: PendingAction) => {
    // If another action is mid-flight, commit it before queueing the next one.
    const prev = pendingRef.current;
    if (prev?.timer) {
      // Letting the prev timer fire on its own would be fine, but we
      // dismiss the prev toast immediately to avoid two toasts on screen.
      // The prev's commit-on-timer keeps running.
    }
    setPending(next);
  }, []);

  const handleLock = useCallback((conversationId: string) => {
    if (!userId) return;
    const conv = conversations.find(c => c.id === conversationId);
    const label = conv?.name ? `closed "${conv.name}"` : 'chat closed';
    const timer = setTimeout(async () => {
      await lockConversation(conversationId);
      setPending(p => (p?.convId === conversationId && p.kind === 'lock' ? null : p));
      refetch();
    }, 4000);
    startToast({
      kind: 'lock',
      convId: conversationId,
      label,
      timer,
      undo: async () => { /* nothing to undo — DB write deferred */ },
    });
  }, [userId, conversations, refetch, startToast]);

  const handleDelete = useCallback((conversationId: string) => {
    if (!userId) return;
    const conv = conversations.find(c => c.id === conversationId);
    const label = conv?.type === 'dm' ? 'chat deleted' : 'group deleted';
    const timer = setTimeout(async () => {
      await deleteConversation(conversationId, userId);
      setPending(p => (p?.convId === conversationId && p.kind === 'delete' ? null : p));
      refetch();
    }, 4000);
    startToast({
      kind: 'delete',
      convId: conversationId,
      label,
      timer,
      undo: async () => { /* nothing to undo — DB write deferred */ },
    });
  }, [userId, conversations, refetch, startToast]);

  const handleLeave = useCallback((conversationId: string) => {
    if (!userId) return;
    const timer = setTimeout(async () => {
      await leaveGroupChat(userId, conversationId);
      setPending(p => (p?.convId === conversationId && p.kind === 'leave' ? null : p));
      refetch();
    }, 4000);
    startToast({
      kind: 'leave',
      convId: conversationId,
      label: 'left the group',
      timer,
      undo: async () => { /* nothing to undo — DB write deferred */ },
    });
  }, [userId, refetch, startToast]);

  /** Hide is non-destructive — commit the DB write NOW so it persists
      across reloads, but offer Undo for ~4s that calls unhideConversation. */
  const handleHide = useCallback(async (conversationId: string) => {
    if (!userId) return;
    // Optimistic write — runs immediately
    await hideConversation(conversationId, userId);
    refetch();
    const timer = setTimeout(() => {
      setPending(p => (p?.convId === conversationId && p.kind === 'hide' ? null : p));
    }, 4000);
    startToast({
      kind: 'hide',
      convId: conversationId,
      label: 'hidden from list',
      timer,
      undo: async () => { await unhideConversation(conversationId, userId); },
    });
  }, [userId, refetch, startToast]);

  const handleMute = useCallback(async (conversationId: string) => {
    if (!userId) return;
    // Get current muted status from conversations
    const conv = conversations.find(c => c.id === conversationId);
    const newMuted = !conv?.is_muted;
    await supabase
      .from('app_conversation_members')
      .update({ muted_at: newMuted ? new Date().toISOString() : null })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    refetch();
  }, [userId, conversations, refetch]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(sorted.map(c => c.id)));
  }, [sorted]);

  const cancelSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (!userId || selected.size === 0) return;
    const hasActive = sorted.some(c => selected.has(c.id) && c.type === 'group' && !c.is_expired && !c.is_locked);

    const doDelete = async () => {
      for (const id of selected) {
        const conv = sorted.find(c => c.id === id);
        if (!conv) continue;
        const isActiveGroupMember = conv.type === 'group' && conv.created_by !== userId && !conv.is_expired && !conv.is_locked;
        const isEndedGroupMember = conv.type === 'group' && conv.created_by !== userId && (conv.is_expired || conv.is_locked);
        if (isActiveGroupMember) {
          // Bulk hide — no membership change, same rule as the swipe
          await hideConversation(id, userId);
        } else if (isEndedGroupMember) {
          await leaveGroupChat(userId, id);
        } else {
          await deleteConversation(id, userId);
        }
      }
      setSelectMode(false);
      setSelected(new Set());
      refetch();
    };

    if (hasActive) {
      Alert.alert(
        'delete active groups?',
        'some selected chats are still active. you will lose access to them and all their messages.',
        [
          { text: 'cancel', style: 'cancel' },
          { text: 'delete', style: 'destructive', onPress: doDelete },
        ]
      );
    } else {
      doDelete();
    }
  }, [userId, selected, sorted, refetch]);

  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: colors.card }]}>

      {/* ─── Header ─── */}
      <View style={[st.header, { backgroundColor: colors.card, borderBottomColor: colors.borderSoft }]}>
        {selectMode ? (
          <View style={st.selectHeader}>
            <TouchableOpacity onPress={cancelSelect} activeOpacity={0.7}>
              <Text style={st.selectCancel}>cancel</Text>
            </TouchableOpacity>
            <Text style={st.selectCount}>{selected.size} selected</Text>
            <TouchableOpacity onPress={selectAll} activeOpacity={0.7}>
              <Text style={st.selectAllBtn}>select all</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={st.titleRow}>
            <Text style={st.title}>{t('pulse.title')}</Text>
            {sorted.length > 0 && (
              <TouchableOpacity onPress={() => setSelectMode(true)} activeOpacity={0.7}>
                <Text style={st.editBtn}>edit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!selectMode && (
          <View style={st.filterTabs}>
            {(['All', 'Groups', 'Direct'] as FilterTab[]).map((tab) => {
              const labels: Record<FilterTab, string> = {
                'All': t('pulse.all'),
                'Groups': t('pulse.groups'),
                'Direct': t('pulse.direct'),
              };
              return (
                <TouchableOpacity
                  key={tab}
                  style={[st.fTab, activeFilter === tab && st.fTabOn]}
                  onPress={() => setActiveFilter(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[st.fTabText, activeFilter === tab && st.fTabTextOn]}>{labels[tab]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ─── Conversation List ─── */}
      <ScrollView style={st.scroll} contentContainerStyle={st.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingTop: s(30), alignItems: 'center' }}>
            <ActivityIndicator color={colors.dark} />
          </View>
        ) : sorted.length === 0 ? (
          <View style={st.emptyWrap}>
            <NomadIcon name="chat" size={s(18)} color={colors.textFaint} strokeWidth={1.2} />
            <Text style={st.emptyTitle}>{t('pulse.noConversations')}</Text>
            <Text style={st.emptySub}>{t('pulse.emptyHint')}</Text>
          </View>
        ) : sorted.map((conv, idx) => (
          selectMode ? (
            <TouchableOpacity
              key={conv.id}
              style={[st.selectRow, selected.has(conv.id) && st.selectRowOn]}
              activeOpacity={0.7}
              onPress={() => toggleSelect(conv.id)}
            >
              <View style={[st.checkbox, selected.has(conv.id) && st.checkboxOn]}>
                {selected.has(conv.id) && <NomadIcon name="check" size={s(5)} color="white" strokeWidth={2.5} />}
              </View>
              <View style={[
                st.avatar,
                { backgroundColor: (conv.is_expired || conv.is_locked)
                    ? '#D1D5DB'
                    : conv.type === 'group'
                      ? getGroupColor(idx)
                      : DM_FALLBACK_COLOR
                },
                conv.type === 'group' && st.avatarGroup,
              ]}>
                {conv.type !== 'group' && (conv.members?.find(m => m.user_id !== userId)?.profile as any)?.avatar_url ? (
                  <Image source={{ uri: (conv.members?.find(m => m.user_id !== userId)?.profile as any)?.avatar_url }} style={st.avatarImg} />
                ) : (
                  <Text style={[st.avatarText, conv.type === 'group' && conv.emoji ? st.avatarEmoji : conv.type === 'group' ? st.avatarInitials : null]}>
                    {conv.type === 'group' ? (conv.emoji || getInitials(conv.name)) : getInitials(conv.members?.find(m => m.user_id !== userId)?.profile?.full_name || conv.name)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.name, (conv.is_expired || conv.is_locked) && st.nameDead]} numberOfLines={1}>
                  {conv.type === 'group' ? (conv.name || 'group') : (conv.members?.find(m => m.user_id !== userId)?.profile?.full_name || 'chat')}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <SwipeableConvRow
              key={conv.id}
              conv={conv}
              idx={idx}
              userId={userId}
              nav={nav}
              t={t}
              colors={colors}
              st={st}
              onLock={handleLock}
              onDelete={handleDelete}
              onLeave={handleLeave}
              onHide={handleHide}
              onMute={handleMute}
              closeSignal={closeSignal}
              isLast={idx === sorted.length - 1}
            />
          )
        ))}
      </ScrollView>

      {/* ─── Undo toast ───
           Floats above the tab bar; replaced on each new action. Tap Undo
           within 4s to revert (for deferred writes: cancels the timer;
           for hide: calls unhideConversation). */}
      {pending && (
        <View
          pointerEvents="box-none"
          style={[st.toastWrap, { bottom: insets.bottom + s(20) }]}
        >
          <View style={st.toast}>
            <Text style={st.toastLabel} numberOfLines={1}>{pending.label}</Text>
            <TouchableOpacity
              onPress={() => flushPending('cancel')}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={st.toastUndo}>undo</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bulk delete bar */}
      {selectMode && selected.size > 0 && (
        <View style={[st.bulkBar, { paddingBottom: insets.bottom + s(5), backgroundColor: colors.card, borderTopColor: colors.borderSoft }]}>
          <TouchableOpacity style={st.bulkBtn} onPress={handleBulkDelete} activeOpacity={0.8}>
            <NomadIcon name="close" size={s(7)} color="white" strokeWidth={2} />
            <Text style={st.bulkBtnText}>delete {selected.size}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES — Instagram DM–inspired: flat, clean, spacious
   ═══════════════════════════════════════════════════════ */
// Chat-list avatar — reduced from s(28) → s(22) on 2026-04-20
// per product-owner directive ("עצומים / שיהיו אסתטים").
// s(28) computes to ~55pt on 390-wide, ~60pt on 430-wide —
// heavier than WhatsApp (50pt) and made the whole Messages
// row read as "all avatar". At s(22) the avatar is ~43pt,
// the row feels balanced with the name / preview text, and
// avatars still scan at a glance without bullying the layout.
const AVATAR_SIZE = s(22);

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.card,
  },

  /* ── Header ── */
  header: {
    paddingTop: s(6),
    paddingHorizontal: s(8),
    backgroundColor: c.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(4),
  },
  title: {
    fontSize: s(11),
    fontWeight: FW.extra,
    color: c.dark,
    marginBottom: s(6),
  },
  editBtn: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.dark,
    marginBottom: s(6),
  },
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(5),
    paddingHorizontal: s(4),
  },
  selectCancel: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.dark,
  },
  selectCount: {
    fontSize: s(6),
    fontWeight: FW.bold,
    color: c.dark,
  },
  selectAllBtn: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.dark,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: s(4),
    gap: s(1),
  },
  fTab: {
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  fTabOn: {
    borderBottomColor: c.dark,
  },
  fTabText: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
    color: c.textMuted,
  },
  fTabTextOn: {
    color: c.dark,
  },

  /* ── List ── */
  scroll: {
    flex: 1,
  },
  list: {
    paddingTop: s(4),
  },

  /* ── Swipe ── */
  swipeWrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeActionsContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    width: 160,
  },
  swipeAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(1),
  },
  swipeActionMute: {
    backgroundColor: '#6B7280', // medium gray for mute
  },
  swipeActionPrimary: {
    backgroundColor: '#374151', // dark badge for primary action
  },
  swipeActionText: {
    fontSize: s(5),
    fontWeight: FW.bold,
    color: c.white,
  },
  rowAnimated: {
    backgroundColor: c.card,
  },

  /* ── Row ── */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingVertical: s(5),
    gap: s(6),
  },

  /* ── Avatar ── */
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGroup: {
    borderRadius: s(8),
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarText: {
    // Scaled down together with AVATAR_SIZE — keeps the
    // ratio between avatar diameter and inner text so the
    // text never gets cropped or feels floaty.
    fontSize: s(6.5),
    fontWeight: FW.bold,
    // Dark chocolate-brown reads well on peach pastels AND on the DM
    // fallback. White (old value) washes out on these pastels.
    color: '#3B1F1A',
  },
  avatarInitials: {
    fontSize: s(5.5),
  },
  avatarEmoji: {
    fontSize: s(10.5),
  },

  /* ── Info ── */
  info: {
    flex: 1,
    minWidth: 0,
    gap: s(1.5),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: s(6.2),
    fontWeight: FW.semi,
    color: c.dark,
  },
  nameUnread: {
    fontWeight: FW.bold,
  },
  nameDead: {
    color: c.textSec,
  },
  time: {
    fontSize: s(5.5),
    fontWeight: FW.regular,
    color: c.textMuted,
  },
  timeDead: {
    color: c.textMuted,
  },
  preview: {
    fontSize: s(5.5),
    color: c.textMuted,
    lineHeight: s(7.5),
  },
  previewUnread: {
    color: c.textSec,
  },
  previewDead: {
    color: c.textMuted,
    fontStyle: 'italic',
  },

  /* ── Meta (right side) ── */
  meta: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2),
    minWidth: s(10),
  },

  /* ── Badge ── */
  badge: {
    minWidth: s(7.5),
    height: s(7.5),
    borderRadius: s(4),
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(2),
  },
  badgeText: {
    fontSize: s(4.2),
    fontWeight: FW.bold,
    color: c.white,
  },

  /* ── Separator — Instagram style: starts after avatar ── */
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderSoft,
    marginLeft: s(8) + AVATAR_SIZE + s(6), // left padding + avatar + gap
  },

  /* ── Select mode ── */
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(5),
    paddingHorizontal: s(8),
  },
  selectRowOn: {
    backgroundColor: c.surface,
  },
  checkbox: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: c.dark,
    borderColor: c.dark,
  },

  /* ── Undo toast ── */
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingLeft: s(7),
    paddingRight: s(4),
    paddingVertical: s(4),
    borderRadius: s(10),
    gap: s(6),
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  toastLabel: {
    color: '#fff',
    fontSize: s(6),
    fontWeight: FW.semi,
    flexShrink: 1,
  },
  toastUndo: {
    color: '#FFD166',
    fontSize: s(6),
    fontWeight: FW.extra,
    paddingHorizontal: s(3),
    paddingVertical: s(2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ── Bulk bar ── */
  bulkBar: {
    backgroundColor: c.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    paddingTop: s(5),
    paddingHorizontal: s(8),
  },
  bulkBtn: {
    backgroundColor: c.dark,
    borderRadius: s(7),
    paddingVertical: s(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
  },
  bulkBtnText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: c.white,
  },

  /* ── Empty ── */
  emptyWrap: { paddingTop: s(30), alignItems: 'center', gap: s(4), paddingHorizontal: s(12) },
  emptyTitle: { fontSize: s(7.5), fontWeight: FW.semi, color: c.textSec },
  emptySub: { fontSize: s(6), color: c.textMuted, textAlign: 'center', lineHeight: s(9) },
});
