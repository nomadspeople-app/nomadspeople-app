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
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList } from '../lib/types';
import { useConversations, lockConversation, deleteConversation, leaveGroupChat, type ConversationWithPreview } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FilterTab = 'All' | 'Groups' | 'Direct';

const GROUP_COLORS = ['#1A1A2E', '#374151', '#1E3A5F', '#1A3C34', '#2D2B55', '#3F3322'];
const getGroupColor = (i: number) => GROUP_COLORS[i % GROUP_COLORS.length];
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
  onLock, onDelete, onLeave, onMute, closeSignal,
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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => canSwipeRef.current && Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          translateX.setValue(Math.min(gs.dx, 170));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80) {
          Animated.spring(translateX, { toValue: 160, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Light).catch(() => {});
  };

  const handleLeave = () => {
    Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
      onLeave(conv.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    });
  };

  const avatarColor = isDead ? '#D1D5DB' : getGroupColor(idx);
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
          {/* Mute button — available for all conversations */}
          <TouchableOpacity style={[st.swipeAction, st.swipeActionMute]} activeOpacity={0.8} onPress={handleMute}>
            <NomadIcon name={conv.is_muted ? "bell" : "bell"} size={s(7)} color="white" strokeWidth={2} />
            <Text style={st.swipeActionText}>{conv.is_muted ? 'unmute' : 'mute'}</Text>
          </TouchableOpacity>

          {/* Primary action button */}
          {isDM ? (
            <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleDelete}>
              <NomadIcon name="close" size={s(7)} color="white" strokeWidth={2} />
              <Text style={st.swipeActionText}>delete</Text>
            </TouchableOpacity>
          ) : isGroup && isDead ? (
            isGroupMember ? (
              <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleLeave}>
                <NomadIcon name="logout" size={s(7)} color="white" strokeWidth={2} />
                <Text style={st.swipeActionText}>leave</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleDelete}>
                <NomadIcon name="close" size={s(7)} color="white" strokeWidth={2} />
                <Text style={st.swipeActionText}>delete</Text>
              </TouchableOpacity>
            )
          ) : isGroupMember ? (
            <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleLeave}>
              <NomadIcon name="logout" size={s(7)} color="white" strokeWidth={2} />
              <Text style={st.swipeActionText}>leave</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[st.swipeAction, st.swipeActionPrimary]} activeOpacity={0.8} onPress={handleLock}>
              <NomadIcon name="lock" size={s(7)} color="white" strokeWidth={2} />
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
          {/* Avatar */}
          <View style={[
            st.avatar,
            { backgroundColor: avatarColor },
            isGroup && st.avatarGroup,
            isDead && { opacity: 0.55 },
          ]}>
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
          </View>

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
                <NomadIcon name="bell" size={s(5)} color={colors.textSec} strokeWidth={1.4} />
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

  useFocusEffect(useCallback(() => {
    refetch();
    setCloseSignal(c => c + 1);
  }, [refetch]));

  const filtered = conversations.filter((c) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Groups') return c.type === 'group';
    return c.type === 'dm';
  });

  const sorted = [...filtered].sort((a, b) => {
    const aScore = a.is_locked ? 2 : a.is_expired ? 1 : 0;
    const bScore = b.is_locked ? 2 : b.is_expired ? 1 : 0;
    return aScore - bScore;
  });

  const handleLock = useCallback(async (conversationId: string) => {
    await lockConversation(conversationId);
    refetch();
  }, [refetch]);

  const handleDelete = useCallback(async (conversationId: string) => {
    if (!userId) return;
    await deleteConversation(conversationId, userId);
    refetch();
  }, [userId, refetch]);

  const handleLeave = useCallback(async (conversationId: string) => {
    if (!userId) return;
    await leaveGroupChat(userId, conversationId);
    refetch();
  }, [userId, refetch]);

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
        const isGroupMember = conv.type === 'group' && conv.created_by !== userId;
        if (isGroupMember) {
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
                { backgroundColor: (conv.is_expired || conv.is_locked) ? '#D1D5DB' : getGroupColor(idx) },
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
              onMute={handleMute}
              closeSignal={closeSignal}
              isLast={idx === sorted.length - 1}
            />
          )
        ))}
      </ScrollView>

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
const AVATAR_SIZE = s(28);

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
    fontSize: s(8),
    fontWeight: FW.bold,
    color: c.white,
  },
  avatarInitials: {
    fontSize: s(6.5),
  },
  avatarEmoji: {
    fontSize: s(13),
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
    minWidth: s(10),
    height: s(10),
    borderRadius: s(5),
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(2.5),
  },
  badgeText: {
    fontSize: s(5),
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
