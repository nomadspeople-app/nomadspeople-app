/**
 * ActivityDetailSheet — Bottom sheet popup for activity/event details.
 *
 * Shows: emoji + category, activity text, location, date/countdown,
 * creator name, member count.
 * Join button → turns into Chat button after joining (with haptic).
 */
import { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  Dimensions, TextInput, Alert, Image,
} from 'react-native';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { createOrJoinStatusChat, leaveGroupChat } from '../lib/hooks';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/types';
import type { AppCheckin } from '../lib/types';
import * as Haptics from 'expo-haptics';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/tracking';
import { shareEvent, shareToInstagramStory, captureCard, isInstagramInstalled } from '../lib/sharing';
import ViewShot from 'react-native-view-shot';
import EventShareCard from './EventShareCard';

const { height: SH } = Dimensions.get('window');

/* ─── Category config (mirrors PeopleScreen) — emoji-forward, neutral color ─── */
const CAT_COLOR = '#6B7280';
const CAT_META: Record<string, { icon: string; color: string; label: string }> = {
  coffee:        { icon: '☕', color: CAT_COLOR, label: 'coffee' },
  food:          { icon: '🍽️', color: CAT_COLOR, label: 'food & drinks' },
  nightlife:     { icon: '🎉', color: CAT_COLOR, label: 'nightlife' },
  outdoors:      { icon: '🥾', color: CAT_COLOR, label: 'outdoor' },
  sightseeing:   { icon: '🗿', color: CAT_COLOR, label: 'sightseeing' },
  entertainment: { icon: '🎬', color: CAT_COLOR, label: 'entertainment' },
  shopping:      { icon: '🛍️', color: CAT_COLOR, label: 'shopping' },
  wellness:      { icon: '🧘', color: CAT_COLOR, label: 'wellness' },
  rideshare:     { icon: '🚗', color: CAT_COLOR, label: 'rideshare' },
  social:        { icon: '💬', color: CAT_COLOR, label: 'social' },
  work:          { icon: '💻', color: CAT_COLOR, label: 'work' },
  beach:         { icon: '🏖', color: CAT_COLOR, label: 'beach' },
  sport:         { icon: '🏃', color: CAT_COLOR, label: 'sport' },
  bar:           { icon: '🍺', color: CAT_COLOR, label: 'bar' },
  other:         { icon: '✨', color: CAT_COLOR, label: 'other' },
};

function formatCountdown(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  return rm > 0 ? `${hrs}h ${rm}m left` : `${hrs}h left`;
}

function formatDate(item: AppCheckin): string {
  const ref = item.scheduled_for || item.checked_in_at;
  const d = new Date(ref);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
}

interface Props {
  visible: boolean;
  checkin: AppCheckin | null;
  creatorName: string;
  creatorAvatarUrl?: string | null;
  onClose: () => void;
}

export default function ActivityDetailSheet({ visible, checkin, creatorName, creatorAvatarUrl, onClose }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId } = useContext(AuthContext);
  const translateY = useRef(new Animated.Value(SH)).current;
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [requestPending, setRequestPending] = useState(false);  // private-event request awaiting owner approval
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [hasInstagram, setHasInstagram] = useState(false);
  const shareCardRef = useRef<ViewShot>(null);
  // Active members of this event's chat (joined + approved). Shown as a
  // horizontal avatar strip so the viewer sees WHO is going, not just N.
  const [activeMembers, setActiveMembers] = useState<Array<{ user_id: string; avatar_url: string | null; display_name: string | null }>>([]);

  useEffect(() => {
    if (visible && checkin && userId) {
      // Reset state on every open — fresh DB check
      setJoined(false);
      setConversationId(null);
      setJoining(false);
      setRequestPending(false);
      // Check if user already joined this activity's conversation
      (async () => {
        const statusText = checkin.status_text || checkin.activity_text || 'activity';
        const { data: existingConvs } = await supabase
          .from('app_conversations')
          .select('id')
          .eq('type', 'group')
          .eq('name', statusText)
          .eq('created_by', checkin.user_id);

        const convId = existingConvs?.[0]?.id ?? null;
        if (convId) {
          const { data: membership } = await supabase
            .from('app_conversation_members')
            .select('conversation_id, status')
            .eq('conversation_id', convId)
            .eq('user_id', userId)
            .maybeSingle();

          if (membership) {
            // Differentiate between approved members (joined) and pending
            // requests (waiting for owner) so the UI shows the right state.
            if ((membership as any).status === 'request') {
              setRequestPending(true);
              setConversationId(convId);
            } else {
              setJoined(true);
              setConversationId(convId);
            }
          } else {
            setJoined(false);
            setConversationId(null);
          }
        } else {
          setJoined(false);
          setConversationId(null);
        }

        // Load active members of this event for the avatar strip
        if (convId) {
          const { data: mems } = await supabase
            .from('app_conversation_members')
            .select('user_id, profile:app_profiles!user_id(avatar_url, display_name, full_name)')
            .eq('conversation_id', convId)
            .eq('status', 'active');
          if (mems) {
            setActiveMembers((mems as any[]).map((m) => ({
              user_id: m.user_id,
              avatar_url: m.profile?.avatar_url ?? null,
              display_name: m.profile?.display_name ?? m.profile?.full_name ?? null,
            })));
          }
        } else {
          setActiveMembers([]);
        }
      })();
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else if (!visible) {
      Animated.timing(translateY, { toValue: SH, duration: 250, useNativeDriver: true }).start();
      // Clean slate for next open
      setJoined(false);
      setConversationId(null);
      setActiveMembers([]);
    }
  }, [visible, checkin, userId]);

  useEffect(() => { isInstagramInstalled().then(setHasInstagram); }, []);

  const handleShareStory = useCallback(async () => {
    if (!checkin) return;
    const uri = await captureCard(shareCardRef);
    if (uri) {
      const shared = await shareToInstagramStory(uri);
      if (shared) trackEvent(userId || '', 'share_story', 'checkin', checkin.id);
    }
  }, [checkin, userId]);

  const handleShareGeneric = useCallback(async () => {
    if (!checkin) return;
    const actText = checkin.status_text || checkin.activity_text || 'activity';
    await shareEvent({ activityText: actText, locationName: checkin.location_name || undefined });
    trackEvent(userId || '', 'share_event', 'checkin', checkin.id);
  }, [checkin, userId]);

  const handleJoin = useCallback(async () => {
    if (!checkin || !userId || joining) return;
    setJoining(true);

    const statusText = checkin.status_text || checkin.activity_text || 'activity';
    const catMeta = CAT_META[checkin.category || 'other'] || CAT_META.other;
    // Private event (is_open=false) → requires owner approval before the
    // joiner gets chat access or counts as a member. Public → instant join.
    const needsApproval = checkin.is_open === false;
    const { conversationId: convId, memberStatus, error } = await createOrJoinStatusChat(
      userId,
      checkin.user_id,
      statusText,
      {
        checkinId: checkin.id,
        emoji: checkin.status_emoji || catMeta.icon,
        category: checkin.category || 'other',
        activityText: statusText,
        locationName: checkin.location_name || undefined,
        latitude: checkin.latitude || undefined,
        longitude: checkin.longitude || undefined,
        scheduledFor: checkin.scheduled_for || undefined,
      },
      needsApproval,
    );

    if (convId && !error) {
      setConversationId(convId);
      // Only flip to "joined" if we were actually approved. Otherwise the
      // user is waiting — show a "request sent" state and don't open chat.
      if (memberStatus === 'active') setJoined(true);
      else setRequestPending(true);
      trackEvent(userId, 'join_group', 'conversation', convId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Stay open — show Chat | Leave buttons
    }
    setJoining(false);
  }, [checkin, userId, joining]);

  const handleChat = useCallback(() => {
    if (!conversationId || !checkin) return;
    const cat = CAT_META[checkin.category || 'other'] || CAT_META.other;
    const title = checkin.status_text || checkin.activity_text || 'activity';
    onClose();
    setTimeout(() => {
      nav.navigate('Chat', {
        conversationId,
        title,
        avatarColor: cat.color,
        avatarText: checkin.status_emoji || cat.icon,
        isGroup: true,
      });
    }, 300);
  }, [conversationId, checkin, onClose, nav]);

  const handleLeave = useCallback(async () => {
    if (!conversationId || !userId) return;
    const { success } = await leaveGroupChat(userId, conversationId);
    if (success) {
      trackEvent(userId, 'leave_group', 'conversation', conversationId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setJoined(false);
      setConversationId(null);
    }
  }, [conversationId, userId]);

  const isOwner = checkin?.user_id === userId;

  const handleStartEdit = useCallback(() => {
    if (!checkin) return;
    setEditText(checkin.status_text || checkin.activity_text || '');
    setEditLocation(checkin.location_name || '');
    setEditing(true);
  }, [checkin]);

  const handleSaveEdit = useCallback(async () => {
    if (!checkin) return;
    const updates: any = {};
    const newText = editText.trim();
    const newLoc = editLocation.trim();
    if (newText && newText !== (checkin.status_text || checkin.activity_text)) {
      updates.status_text = newText;
      updates.activity_text = newText;
    }
    if (newLoc !== (checkin.location_name || '')) {
      updates.location_name = newLoc || null;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('app_checkins').update(updates).eq('id', checkin.id);
      // Also update conversation name if it exists
      if (conversationId && updates.status_text) {
        await supabase.from('app_conversations').update({ name: updates.status_text, activity_text: updates.status_text }).eq('id', conversationId);
      }
    }
    setEditing(false);
    onClose(); // close sheet so it reloads fresh
  }, [checkin, editText, editLocation, conversationId, onClose]);

  const handleEndEvent = useCallback(() => {
    if (!checkin) return;
    Alert.alert(
      'end event?',
      'this will mark the event as ended. no one new can join.',
      [
        { text: 'cancel', style: 'cancel' },
        {
          text: 'end',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('app_checkins').update({
              is_active: false,
              expires_at: new Date().toISOString(),
            }).eq('id', checkin.id);
            onClose();
          },
        },
      ]
    );
  }, [checkin, onClose]);

  if (!checkin) return null;

  const cat = CAT_META[checkin.category || 'other'] || CAT_META.other;
  const isTimer = checkin.checkin_type === 'timer';
  const countdown = isTimer && checkin.expires_at ? formatCountdown(checkin.expires_at) : null;
  const isExpired = checkin.expires_at ? new Date(checkin.expires_at).getTime() <= Date.now() : false;
  const emoji = checkin.status_emoji || cat.icon;
  const text = checkin.status_text || checkin.activity_text || cat.label;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[st.sheet, { transform: [{ translateY }] }]}>
          <View style={st.handle} />

          {/* Close */}
          <TouchableOpacity style={st.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <NomadIcon name="close" size={18} strokeWidth={1.6} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Emoji */}
          <Text style={st.emoji}>{emoji}</Text>

          {/* Activity text — centered, max 2 lines, won't clip on sides */}
          <Text style={st.title} numberOfLines={2} ellipsizeMode="tail">{text}</Text>

          {/* Creator — avatar + name */}
          <View style={st.creatorRow}>
            <View style={st.creatorAvatar}>
              {creatorAvatarUrl ? (
                <Image source={{ uri: creatorAvatarUrl }} style={st.creatorAvatarImg} />
              ) : (
                <Text style={st.creatorInitial}>{(creatorName || '?')[0].toUpperCase()}</Text>
              )}
            </View>
            <Text style={st.creator}>{creatorName}</Text>
          </View>

          {/* Meta row: location + date/countdown */}
          <View style={st.metaRow}>
            {checkin.location_name && (
              <View style={st.metaPill}>
                <NomadIcon name="pin" size={s(5)} color={colors.textMuted} strokeWidth={1.4} />
                <Text style={st.metaText}>{checkin.location_name}</Text>
              </View>
            )}
            {isTimer && countdown && (
              <View style={[st.metaPill, { backgroundColor: colors.primaryLight }]}>
                <NomadIcon name="clock" size={s(5)} color={colors.primary} strokeWidth={1.4} />
                <Text style={[st.metaText, { color: colors.primary, fontWeight: FW.bold }]}>{countdown}</Text>
              </View>
            )}
            {!isTimer && (
              <View style={st.metaPill}>
                <NomadIcon name="calendar" size={s(5)} color={colors.textMuted} strokeWidth={1.4} />
                <Text style={st.metaText}>{formatDate(checkin)}</Text>
              </View>
            )}
          </View>

          {/* Members — avatar strip + count, so the viewer SEES who's
              going, not just a number. Tap an avatar to open the person's
              profile. */}
          {activeMembers.length > 0 && (
            <View style={{ alignItems: 'center', marginBottom: s(3) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(2.5) }}>
                {activeMembers.slice(0, 6).map((m) => (
                  <TouchableOpacity
                    key={m.user_id}
                    activeOpacity={0.7}
                    onPress={() => {
                      onClose();
                      setTimeout(() => nav.navigate('UserProfile' as any, { userId: m.user_id }), 200);
                    }}
                  >
                    {m.avatar_url ? (
                      <Image
                        source={{ uri: m.avatar_url }}
                        style={{ width: s(11), height: s(11), borderRadius: s(5.5), borderWidth: 1.5, borderColor: '#fff' }}
                      />
                    ) : (
                      <View style={{ width: s(11), height: s(11), borderRadius: s(5.5), backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: s(5), fontWeight: FW.bold, color: colors.dark }}>{(m.display_name || '?')[0].toUpperCase()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {activeMembers.length > 6 && (
                  <View style={{ width: s(11), height: s(11), borderRadius: s(5.5), backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' }}>
                    <Text style={{ fontSize: s(4), fontWeight: FW.bold, color: colors.dark }}>+{activeMembers.length - 6}</Text>
                  </View>
                )}
              </View>
              <Text style={[st.members, { marginTop: s(2) }]}>
                {activeMembers.length} {activeMembers.length === 1 ? 'nomad joined' : 'nomads joined'}
              </Text>
            </View>
          )}

          {/* ── Toolbar: share + owner tools ── */}
          {!editing && !isExpired && (
            <View style={st.toolbar}>
              {/* Share — everyone sees */}
              {hasInstagram && (
                <TouchableOpacity style={st.toolBtn} onPress={handleShareStory} activeOpacity={0.7}>
                  <Text style={{ fontSize: s(5.5) }}>📸</Text>
                  <Text style={st.toolBtnText}>story</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={st.toolBtn} onPress={handleShareGeneric} activeOpacity={0.7}>
                <NomadIcon name="share" size={s(5.5)} color={colors.dark} strokeWidth={1.4} />
                <Text style={st.toolBtnText}>share</Text>
              </TouchableOpacity>

              {/* Owner tools */}
              {isOwner && (
                <>
                  <View style={st.toolDivider} />
                  <TouchableOpacity style={st.toolBtn} onPress={handleStartEdit} activeOpacity={0.7}>
                    <NomadIcon name="settings" size={s(5.5)} color={colors.dark} strokeWidth={1.4} />
                    <Text style={st.toolBtnText}>edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.toolBtnDanger} onPress={handleEndEvent} activeOpacity={0.7}>
                    <NomadIcon name="close" size={s(5.5)} color={colors.danger} strokeWidth={1.4} />
                    <Text style={[st.toolBtnText, { color: colors.danger }]}>end</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Hidden share card for capture */}
          <View style={{ position: 'absolute', left: -9999 }}>
            <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
              <EventShareCard
                emoji={emoji}
                activityText={text}
                locationName={checkin.location_name || undefined}
                category={checkin.category || undefined}
                memberCount={checkin.member_count}
                creatorName={creatorName}
                dateText={!isTimer ? formatDate(checkin) : undefined}
                countdownText={countdown || undefined}
              />
            </ViewShot>
          </View>

          {/* Owner edit mode */}
          {isOwner && editing && (
            <View style={st.editSection}>
              <TextInput
                style={st.editInput}
                value={editText}
                onChangeText={setEditText}
                placeholder="activity text"
                placeholderTextColor={colors.textFaint}
                multiline
              />
              <TextInput
                style={st.editInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="location (optional)"
                placeholderTextColor={colors.textFaint}
              />
              <View style={st.editBtns}>
                <TouchableOpacity style={st.editCancelBtn} onPress={() => setEditing(false)} activeOpacity={0.7}>
                  <Text style={st.editCancelText}>cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.editSaveBtn} onPress={handleSaveEdit} activeOpacity={0.8}>
                  <Text style={st.editSaveText}>save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Action button */}
          {userId === checkin.user_id ? (
            // Viewer IS the owner — joining your own event makes no sense.
            // Show a short "your event" indicator instead of the Join CTA.
            <View style={[st.expiredBar, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40', borderWidth: 1 }]}>
              <Text style={[st.expiredText, { color: colors.primary }]}>this is your event · manage from Profile</Text>
            </View>
          ) : isExpired && !joined ? (
            <View style={st.expiredBar}>
              <Text style={st.expiredText}>this event has ended</Text>
            </View>
          ) : requestPending ? (
            // Private event: request sent, owner hasn't approved yet.
            <View style={[st.expiredBar, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[st.expiredText, { color: '#B45309' }]}>
                request sent — waiting for approval
              </Text>
            </View>
          ) : !joined ? (
            <TouchableOpacity
              style={st.joinBtn}
              onPress={handleJoin}
              activeOpacity={0.8}
              disabled={joining}
            >
              <Text style={st.joinBtnText}>
                {joining ? 'joining...' : (checkin.is_open === false ? 'request to join' : 'join')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={st.joinedRow}>
              <TouchableOpacity
                style={st.chatBtn}
                onPress={handleChat}
                activeOpacity={0.8}
              >
                <NomadIcon name="chat" size={18} strokeWidth={1.8} color="white" />
                <Text style={st.chatBtnText}>chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.leaveBtn}
                onPress={handleLeave}
                activeOpacity={0.8}
              >
                <NomadIcon name="close" size={16} strokeWidth={1.8} color={colors.danger} />
                <Text style={st.leaveBtnText}>leave</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: s(10) }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: s(12),
    borderTopRightRadius: s(12),
    paddingHorizontal: s(10),
    paddingTop: s(5),
    paddingBottom: s(10),
    alignItems: 'center',
  },
  handle: {
    width: s(18),
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: s(6),
  },
  closeBtn: {
    position: 'absolute',
    top: s(8),
    right: s(8),
  },
  emoji: {
    fontSize: 44,
    marginBottom: s(4),
  },
  title: {
    fontSize: s(8),
    fontWeight: FW.bold,
    color: c.dark,
    textAlign: 'center',
    marginBottom: s(2),
    paddingHorizontal: s(10),   // breathing room on the sides so long titles don't touch the edges
    alignSelf: 'stretch',       // ensure the text box spans full width so centering is true
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginBottom: s(5),
  },
  creatorAvatar: {
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  creatorAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: s(6),
  },
  creatorInitial: {
    fontSize: s(5.5),
    fontWeight: FW.bold,
    color: c.textMuted,
  },
  creator: {
    fontSize: s(5.5),
    fontWeight: FW.medium,
    color: c.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(3),
    marginBottom: s(4),
    justifyContent: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    backgroundColor: c.surface,
    paddingHorizontal: s(4),
    paddingVertical: s(2),
    borderRadius: s(5),
  },
  metaText: {
    fontSize: s(5),
    fontWeight: FW.medium,
    color: c.dark,
  },
  members: {
    fontSize: s(5),
    fontWeight: FW.medium,
    color: c.textMuted,
    marginBottom: s(4),
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2),
    marginBottom: s(5),
    flexWrap: 'wrap',
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(1.5),
    backgroundColor: c.surface,
    paddingHorizontal: s(4),
    paddingVertical: s(2.5),
    borderRadius: s(5),
  },
  toolBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(1.5),
    backgroundColor: c.dangerSurface,
    paddingHorizontal: s(4),
    paddingVertical: s(2.5),
    borderRadius: s(5),
  },
  toolBtnText: {
    fontSize: s(4.5),
    fontWeight: FW.semi,
    color: c.dark,
  },
  toolDivider: {
    width: 1,
    height: s(6),
    backgroundColor: c.borderSoft,
    marginHorizontal: s(1),
  },
  joinBtn: {
    backgroundColor: c.primary,
    borderRadius: s(7),
    paddingVertical: s(5),
    paddingHorizontal: s(20),
    alignItems: 'center',
    width: '100%',
  },
  joinBtnText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: 'white',
  },
  joinedRow: {
    flexDirection: 'row',
    gap: s(4),
    width: '100%',
  },
  chatBtn: {
    flex: 1,
    backgroundColor: c.success,
    borderRadius: s(7),
    paddingVertical: s(5),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(3),
  },
  chatBtnText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: 'white',
  },
  leaveBtn: {
    backgroundColor: c.dangerSurface,
    borderRadius: s(7),
    paddingVertical: s(5),
    paddingHorizontal: s(6),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(2),
  },
  leaveBtnText: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.danger,
  },
  editSection: {
    width: '100%',
    gap: s(4),
    marginBottom: s(5),
  },
  editInput: {
    backgroundColor: c.surface,
    borderRadius: s(5),
    paddingHorizontal: s(5),
    paddingVertical: s(4),
    fontSize: s(6),
    fontWeight: FW.medium,
    color: c.dark,
  },
  editBtns: {
    flexDirection: 'row',
    gap: s(4),
    justifyContent: 'flex-end',
  },
  editCancelBtn: {
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: c.surface,
  },
  editCancelText: {
    fontSize: s(5.5),
    fontWeight: FW.semi,
    color: c.textMuted,
  },
  editSaveBtn: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: c.success,
  },
  editSaveText: {
    fontSize: s(5.5),
    fontWeight: FW.bold,
    color: 'white',
  },
  expiredBar: {
    backgroundColor: c.surface,
    borderRadius: s(7),
    paddingVertical: s(5),
    paddingHorizontal: s(20),
    alignItems: 'center',
    width: '100%',
  },
  expiredText: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.textMuted,
  },
});
