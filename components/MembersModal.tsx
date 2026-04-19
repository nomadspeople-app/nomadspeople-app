/**
 * MembersModal — the "window" the user sees when tapping "X Members"
 * on the Group Info screen. Built per the logic skill's rules:
 *
 *  - Everyone (including the creator) can tap a row → open that user's
 *    profile. No DB write, just navigation.
 *  - Creator-only affordance: an × button next to every other member
 *    that triggers a confirm Alert and then `removeGroupMember()`.
 *    Optimistic: the row disappears from the modal immediately; the
 *    parent refetches members + posts a system message in the chat.
 *
 *  Closed loop on remove:
 *    DB delete → optimistic UI → system message in chat (authored by
 *    creator, RLS-safe) → member_count-- on linked checkin → other
 *    members see the update via realtime.
 *
 *  Why a modal and not a fullscreen route: the user explicitly asked
 *  for a "חלון" (window) — quick peek, easy dismiss, no nav stack
 *  to back out of. Same gesture model as Telegram's member sheet.
 */
import { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { removeGroupMember } from '../lib/hooks';

export interface MembersModalMember {
  user_id: string;
  role?: string | null;
  profile?: {
    full_name?: string | null;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  members: MembersModalMember[];
  currentUserId: string | null;
  creatorUserId: string | null;
  /** Tap a row → navigate to that user's profile in the parent screen. */
  onTapMember: (userId: string, name: string) => void;
  /** Called after a successful removal so the parent can refetch members. */
  onAfterRemove?: () => void;
}

const getInitials = (name?: string | null): string =>
  name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?';

export default function MembersModal({
  visible, onClose, conversationId, members,
  currentUserId, creatorUserId,
  onTapMember, onAfterRemove,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [optimisticHidden, setOptimisticHidden] = useState<Set<string>>(new Set());

  // Reset optimistic state whenever the modal opens fresh
  useEffect(() => {
    if (visible) setOptimisticHidden(new Set());
  }, [visible]);

  const iAmCreator = !!(currentUserId && creatorUserId && currentUserId === creatorUserId);

  const visibleMembers = members.filter((m) => !optimisticHidden.has(m.user_id));
  const memberCount = visibleMembers.length;

  const handleRowTap = (m: MembersModalMember) => {
    const name = m.profile?.display_name || m.profile?.full_name || m.profile?.username || 'Nomad';
    onClose();
    // Tiny delay so the modal close animation doesn't fight the navigation push.
    setTimeout(() => onTapMember(m.user_id, name), 220);
  };

  const handleRemoveTap = (m: MembersModalMember) => {
    if (!currentUserId) return;
    const name = m.profile?.display_name || m.profile?.full_name || m.profile?.username || 'this member';
    Alert.alert(
      'Remove member?',
      `${name} will lose access to the chat and the activity. They can rejoin if the activity is still open.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(m.user_id);
            // Optimistic: hide row right away
            setOptimisticHidden((prev) => {
              const next = new Set(prev);
              next.add(m.user_id);
              return next;
            });
            const { success, error } = await removeGroupMember(
              currentUserId,
              m.user_id,
              conversationId,
              name,
            );
            setRemovingId(null);
            if (!success) {
              // Roll back the optimistic hide
              setOptimisticHidden((prev) => {
                const next = new Set(prev);
                next.delete(m.user_id);
                return next;
              });
              Alert.alert(
                'Could not remove',
                (error as any)?.message || 'Please try again.',
              );
              return;
            }
            // Fire parent refetch so the underlying list, member_count badge,
            // and chat system message all show through in the parent.
            onAfterRemove?.();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[st.root, { paddingTop: insets.top * 0.4 }]}>
        {/* ─── Header ─── */}
        <View style={st.hdr}>
          <View style={{ width: s(20) }} />
          <View style={st.hdrCenter}>
            <Text style={st.hdrTitle}>Members</Text>
            <Text style={st.hdrSub}>{memberCount} {memberCount === 1 ? 'person' : 'people'}</Text>
          </View>
          <TouchableOpacity
            style={st.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <NomadIcon name="close" size={s(8)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {/* ─── List ─── */}
        <ScrollView
          style={st.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + s(20) }}
          showsVerticalScrollIndicator={false}
        >
          {visibleMembers.length === 0 ? (
            <View style={st.emptyWrap}>
              <NomadIcon name="users" size={s(18)} color={colors.textFaint} strokeWidth={1.2} />
              <Text style={st.emptyTitle}>No members yet</Text>
            </View>
          ) : visibleMembers.map((m) => {
            const isCreator = m.user_id === creatorUserId || m.role === 'admin';
            const isMe = m.user_id === currentUserId;
            const name = m.profile?.display_name || m.profile?.full_name || m.profile?.username || 'Nomad';
            const avatarUrl = m.profile?.avatar_url || null;
            const ini = getInitials(name);
            // Creator can remove anyone except themselves and other admins.
            const canRemove = iAmCreator && !isMe && !isCreator;

            return (
              <View key={m.user_id} style={st.row}>
                {/* Tap area = avatar + name → profile */}
                <TouchableOpacity
                  style={st.rowMain}
                  activeOpacity={0.7}
                  onPress={() => handleRowTap(m)}
                >
                  <View style={[st.av, { backgroundColor: isCreator ? colors.primary : colors.accent }]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={st.avImg} />
                    ) : (
                      <Text style={st.avText}>{ini}</Text>
                    )}
                  </View>
                  <View style={st.info}>
                    <Text style={st.name} numberOfLines={1}>{name}</Text>
                    <View style={st.tags}>
                      {isCreator && (
                        <View style={[st.tag, { backgroundColor: colors.primary + '18' }]}>
                          <Text style={[st.tagText, { color: colors.primary }]}>creator</Text>
                        </View>
                      )}
                      {isMe && !isCreator && (
                        <View style={[st.tag, { backgroundColor: colors.surface }]}>
                          <Text style={[st.tagText, { color: colors.textMuted }]}>you</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Remove × — creator only, never on self/other admins */}
                {canRemove && (
                  <TouchableOpacity
                    style={st.removeBtn}
                    onPress={() => handleRemoveTap(m)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={removingId === m.user_id}
                  >
                    {removingId === m.user_id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={st.removeCircle}>
                        <NomadIcon name="close" size={s(5)} color="#fff" strokeWidth={2.2} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.card,
  },
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(6),
    paddingTop: s(4),
    paddingBottom: s(6),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  hdrCenter: {
    flex: 1,
    alignItems: 'center',
  },
  hdrTitle: {
    fontSize: s(8),
    fontWeight: FW.bold,
    color: c.dark,
  },
  hdrSub: {
    fontSize: s(5),
    color: c.textMuted,
    marginTop: s(0.5),
  },
  closeBtn: {
    width: s(20),
    alignItems: 'flex-end',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    paddingVertical: s(4),
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: s(5),
  },
  av: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avImg: { width: '100%', height: '100%' },
  avText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: '#fff',
  },
  info: { flex: 1 },
  name: {
    fontSize: s(7),
    fontWeight: FW.semi,
    color: c.dark,
  },
  tags: {
    flexDirection: 'row',
    gap: s(2),
    marginTop: s(1),
  },
  tag: {
    paddingHorizontal: s(3),
    paddingVertical: s(0.8),
    borderRadius: s(3),
  },
  tagText: {
    fontSize: s(4),
    fontWeight: FW.semi,
    textTransform: 'lowercase',
    letterSpacing: 0.3,
  },
  removeBtn: {
    paddingHorizontal: s(4),
    paddingVertical: s(2),
  },
  removeCircle: {
    width: s(11),
    height: s(11),
    borderRadius: s(5.5),
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingTop: s(40),
    alignItems: 'center',
    gap: s(4),
  },
  emptyTitle: {
    fontSize: s(7),
    fontWeight: FW.semi,
    color: c.textMuted,
  },
});
