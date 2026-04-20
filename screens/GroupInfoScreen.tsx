import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, Share, Modal, Linking, ActivityIndicator, Switch, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import MapView, { Marker, Circle } from 'react-native-maps';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList } from '../lib/types';
import { AuthContext } from '../App';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { leaveGroupChat, removeGroupMember } from '../lib/hooks';
import MembersModal from '../components/MembersModal';
import { postEventSystemMessage, eventSystemMsg } from '../lib/eventSystemMessages';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'GroupInfo'>;

/* ─── Category style mapping ─── */
const CAT_META: Record<string, { color: string; emoji: string; label: string }> = {
  food:          { color: '#6B7280', emoji: '🍽️', label: 'Food & Drinks' },
  nightlife:     { color: '#6B7280', emoji: '🎉', label: 'Nightlife' },
  outdoors:      { color: '#6B7280', emoji: '🥾', label: 'Outdoor & Active' },
  sightseeing:   { color: '#6B7280', emoji: '🗿', label: 'Sightseeing' },
  entertainment: { color: '#6B7280', emoji: '🎬', label: 'Entertainment' },
  shopping:      { color: '#6B7280', emoji: '🛍️', label: 'Shopping' },
  wellness:      { color: '#6B7280', emoji: '🧘', label: 'Wellness' },
  rideshare:     { color: '#6B7280', emoji: '🚗', label: 'Rideshare' },
  social:        { color: '#6B7280', emoji: '💬', label: 'Social' },
  coffee:        { color: '#6B7280', emoji: '☕', label: 'Coffee' },
  other:         { color: '#6B7280', emoji: '✨', label: 'Other' },
};
const getCat = (k?: string | null) => CAT_META[k || ''] || CAT_META.social;

interface GroupData {
  id: string;
  name: string | null;
  emoji: string | null;
  category: string | null;
  activity_text: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_general_area: boolean;
  scheduled_for: string | null;
  is_open: boolean;
  created_by: string | null;
  created_at: string;
  checkin_id: string | null;
}

interface MemberRow {
  user_id: string;
  role: string;
  rsvp: string;
  profile: {
    /** User's chosen display name — preferred over full_name in
     *  UI per the "display_name over full_name" rule (stale
     *  'Deleted User' defaults live in full_name). */
    display_name: string | null;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface GroupPhoto {
  id: string;
  image_url: string;
  user_id: string;
  created_at: string;
}

export default function GroupInfoScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = useContext(AuthContext);
  const { t } = useI18n();
  const { colors } = useTheme();
  const { conversationId } = route.params;
  const st = useMemo(() => makeStyles(colors), [colors]);

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [photos, setPhotos] = useState<GroupPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [muteNotifs, setMuteNotifs] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  // Fallback coords from linked checkin
  const [checkinCoords, setCheckinCoords] = useState<{ lat: number; lng: number; locName?: string } | null>(null);

  /* ─── Fetch group data ─── */
  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Conversation metadata — pull checkin_id too so the fallback below
    // can pick the EXACT checkin linked to this conversation, not "any
    // active checkin by the creator" (which is wrong when a user has a
    // status + a timer open at the same time).
    const { data: conv } = await supabase
      .from('app_conversations')
      .select('id, name, emoji, category, activity_text, location_name, latitude, longitude, is_general_area, scheduled_for, is_open, created_by, created_at, checkin_id')
      .eq('id', conversationId)
      .single();

    if (conv) {
      setGroup(conv as GroupData);

      // If the conversation row has no coords (typical — coords live on
      // app_checkins), resolve via the linked checkin. Prefer checkin_id
      // (exact link) over created_by (ambiguous when >1 active checkin).
      if (!conv.latitude) {
        let checkinRow: { latitude: number | null; longitude: number | null; location_name: string | null } | null = null;
        if ((conv as any).checkin_id) {
          const { data } = await supabase
            .from('app_checkins')
            .select('latitude, longitude, location_name')
            .eq('id', (conv as any).checkin_id)
            .maybeSingle();
          checkinRow = data as any;
        }
        if (!checkinRow && conv.created_by) {
          // Older chats may have no checkin_id — fall back to active-checkin lookup.
          const { data } = await supabase
            .from('app_checkins')
            .select('latitude, longitude, location_name')
            .eq('user_id', conv.created_by)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          checkinRow = data as any;
        }
        if (checkinRow?.latitude && checkinRow?.longitude) {
          setCheckinCoords({
            lat: checkinRow.latitude,
            lng: checkinRow.longitude,
            locName: checkinRow.location_name || undefined,
          });
        }
      }
    }

    // Members with profiles
    const { data: mems } = await supabase
      .from('app_conversation_members')
      .select('user_id, role, rsvp, profile:app_profiles!user_id(full_name, display_name, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .eq('status', 'active');

    if (mems) setMembers(mems as unknown as MemberRow[]);

    // My mute status
    if (userId) {
      const { data: myMem } = await supabase
        .from('app_conversation_members')
        .select('muted_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
      setMuteNotifs(!!myMem?.muted_at);
    }

    // Group photos
    const { data: pics } = await supabase
      .from('app_group_photos')
      .select('id, image_url, user_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (pics) setPhotos(pics as GroupPhoto[]);

    setLoading(false);
  }, [conversationId, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── Actions ─── */
  const handleShare = async () => {
    const name = group?.name || 'Activity';
    await Share.share({
      message: `Join "${name}" on NomadsPeople! 🎉`,
    }).catch(() => {});
  };


  const handleOpenInMaps = () => {
    if (!mapLat || !mapLng) return;
    const label = encodeURIComponent(mapLocName);
    // Try Google Maps first (works on Android + iOS if installed), fallback to Apple Maps
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${mapLat},${mapLng}&query_place_id=${label}`;
    const appleUrl = `https://maps.apple.com/?ll=${mapLat},${mapLng}&q=${label}`;
    Linking.canOpenURL('comgooglemaps://').then((supported) => {
      Linking.openURL(supported ? googleUrl : appleUrl).catch(() => {});
    }).catch(() => {
      Linking.openURL(appleUrl).catch(() => {});
    });
  };

  const handleLeave = async () => {
    setShowLeaveConfirm(false);
    if (!userId) return;

    await leaveGroupChat(userId, conversationId);

    nav.goBack();
    nav.goBack(); // back past ChatScreen too
  };

  const handleMemberTap = (memberId: string, memberName?: string | null) => {
    nav.navigate('UserProfile', { userId: memberId, name: memberName || undefined });
  };

  const iAmCreator = !!(userId && group?.created_by === userId);

  const handleEditName = async () => {
    if (!editName.trim() || !group) return;
    if (!userId) return;
    const newName = editName.trim();
    if (newName === group.name) {
      // No-op — nothing changed. Just close the editor, no system message.
      setEditing(false);
      return;
    }
    // 1. DB write
    const { error } = await supabase.from('app_conversations').update({
      name: newName,
      activity_text: newName,
    }).eq('id', conversationId);
    if (error) {
      Alert.alert('Could not save', error.message || 'Please try again.');
      return;
    }
    // 2. Optimistic local update
    setGroup({ ...group, name: newName, activity_text: newName });
    setEditing(false);
    // 3. Close the logic loop — post a chat system message so every
    //    member sees the rename. Propagation map (logic skill):
    //    title change → "✏️ Event renamed to X" system msg in chat.
    //    Also update the linked app_checkins row so map/profile cards
    //    reflect the new title (they read from app_checkins).
    if ((group as any).checkin_id || group.created_by === userId) {
      // Best-effort: keep activity_text and status_text in sync with
      // the conversation title. Safe because only the creator can
      // invoke this (iAmCreator gate in the UI).
      await supabase
        .from('app_checkins')
        .update({ activity_text: newName, status_text: newName })
        .eq('user_id', userId)
        .eq('is_active', true)
        .then(() => {}, () => {});
    }
    // Find the linked checkin to post the system message against
    const linkedCheckinId = (group as any).checkin_id as string | undefined;
    if (linkedCheckinId) {
      await postEventSystemMessage(linkedCheckinId, userId, eventSystemMsg.titleChanged(newName));
    }
  };

  const handleEndEvent = () => {
    Alert.alert('End Event', 'This will mark the event as ended. No one new can join.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          // Lock the conversation
          await supabase.from('app_conversations').update({ is_open: false, is_locked: true }).eq('id', conversationId);
          // Deactivate linked checkin
          if (group?.created_by) {
            await supabase.from('app_checkins').update({ is_active: false, expires_at: new Date().toISOString() })
              .eq('user_id', group.created_by).eq('is_active', true);
          }
          nav.goBack();
          nav.goBack();
        },
      },
    ]);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (memberId === userId) return; // can't remove yourself
    if (!userId) return;
    Alert.alert('Remove Member', `Remove ${memberName} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // Use the admin-removal helper so the chat system message is
          // authored by the creator (RLS requires sender_id=auth.uid()).
          // Using leaveGroupChat here would silently drop the message
          // because it tries to insert with sender_id=memberId.
          const { success, error } = await removeGroupMember(
            userId,
            memberId,
            conversationId,
            memberName,
          );
          if (!success) {
            Alert.alert('Could not remove', (error as any)?.message || 'Please try again.');
            return;
          }
          fetchAll(); // refresh member list + counts
        },
      },
    ]);
  };

  const cat = getCat(group?.category);
  const displayEmoji = group?.emoji || cat.emoji;
  const memberCount = members.length;
  const creator = members.find(m => m.role === 'admin');

  // Resolved map coordinates — conversation metadata first, then fallback to checkin
  const mapLat = group?.latitude || checkinCoords?.lat || null;
  const mapLng = group?.longitude || checkinCoords?.lng || null;
  const mapLocName = group?.location_name || checkinCoords?.locName || group?.name || 'Activity';

  if (loading) {
    return (
      <View style={[st.root, { paddingTop: insets.top }]}>
        <View style={st.hdr}>
          <TouchableOpacity style={st.backBtn} onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <NomadIcon name="back" size={s(9)} color="#1A1A1A" strokeWidth={1.8} />
          </TouchableOpacity>
          <Text style={st.hdrTitle}>Group Info</Text>
          <View style={st.backBtn} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <View style={st.hdr}>
        <TouchableOpacity style={st.backBtn} onPress={() => nav.goBack()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <NomadIcon name="back" size={s(9)} color="#1A1A1A" strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={st.hdrTitle}>Group Info</Text>
        <View style={st.backBtn} />
      </View>

      <ScrollView
        style={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ─── Activity icon + name + members ─── */}
        <View style={st.topSection}>
          <View style={[st.emojiCircle, { backgroundColor: cat.color + '18' }]}>
            <Text style={st.emojiText}>{displayEmoji}</Text>
          </View>

          {/* Name: inline editable only while in edit mode. The new
              creator pill row BELOW triggers editing. When editing, the
              input sits HIGH on the screen so the keyboard doesn't
              cover it — that was the reported bug with the old bottom
              placement of Creator Tools. */}
          {editing ? (
            <View style={st.editRow}>
              <TextInput
                style={st.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Activity name"
                placeholderTextColor={colors.textFaint}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleEditName}
              />
              <TouchableOpacity style={st.editSave} onPress={handleEditName} activeOpacity={0.7}>
                <Text style={st.editSaveText}>save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)} activeOpacity={0.7}>
                <Text style={st.editCancelText}>cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={st.groupName}>{group?.name || 'Activity'}</Text>
          )}
          <Text style={st.memberCountText}>{memberCount} Members</Text>

          {/* Creator-only pills — moved from the bottom so tapping Edit
              Name keeps the input above the keyboard. Icon-first compact
              design, on-brand. Hidden entirely for non-creators. */}
          {iAmCreator && !editing && (
            <View style={st.creatorPillsRow}>
              <TouchableOpacity
                style={st.creatorPill}
                activeOpacity={0.7}
                onPress={() => { setEditName(group?.name || ''); setEditing(true); }}
              >
                <NomadIcon name="edit" size={s(4.5)} color={colors.dark} strokeWidth={1.5} />
                <Text style={st.creatorPillText}>edit name</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.creatorPill, st.creatorPillDanger]}
                activeOpacity={0.7}
                onPress={handleEndEvent}
              >
                <NomadIcon name="close" size={s(4.5)} color={colors.danger} strokeWidth={1.5} />
                <Text style={[st.creatorPillText, { color: colors.danger }]}>end event</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── Action rows ─── */}
        <View style={st.section}>
          {/* Share Activity */}
          <TouchableOpacity style={st.actionRow} activeOpacity={0.7} onPress={handleShare}>
            <View style={[st.actionIcon, { backgroundColor: 'rgba(255,90,95,0.1)' }]}>
              <NomadIcon name="share" size={s(6)} color={colors.primary} strokeWidth={1.4} />
            </View>
            <Text style={st.actionLabel}>Share Activity</Text>
            <NomadIcon name="forward" size={s(6)} color="#1A1A1A" strokeWidth={1.4} />
          </TouchableOpacity>


          {/* Mute Notifications */}
          <View style={st.actionRow}>
            <View style={[st.actionIcon, { backgroundColor: 'rgba(255,90,95,0.1)' }]}>
              <NomadIcon name="bell" size={s(6)} color={colors.primary} strokeWidth={1.4} />
            </View>
            <Text style={[st.actionLabel, { flex: 1 }]}>Mute Notifications</Text>
            <Switch
              value={muteNotifs}
              onValueChange={async (val) => {
                setMuteNotifs(val);
                if (!userId) return;
                await supabase
                  .from('app_conversation_members')
                  .update({ muted_at: val ? new Date().toISOString() : null })
                  .eq('conversation_id', conversationId)
                  .eq('user_id', userId);
              }}
              trackColor={{ false: '#E5E3DC', true: colors.primary }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* ─── Map — tappable, opens native maps for navigation ─── */}
        {mapLat != null && mapLng != null && (
          <TouchableOpacity
            style={st.section}
            activeOpacity={0.85}
            onPress={handleOpenInMaps}
          >
            <View style={st.mapContainer}>
              <MapView
                style={st.map}
                initialRegion={{
                  latitude: mapLat,
                  longitude: mapLng,
                  latitudeDelta: group?.is_general_area ? 0.02 : 0.005,
                  longitudeDelta: group?.is_general_area ? 0.02 : 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                pointerEvents="none"
              >
                <Marker coordinate={{ latitude: mapLat, longitude: mapLng }}>
                  <View style={[st.mapPin, { backgroundColor: colors.primary }]}>
                    <View style={st.mapPinInner} />
                  </View>
                </Marker>
                {group?.is_general_area && (
                  <Circle
                    center={{ latitude: mapLat, longitude: mapLng }}
                    radius={500}
                    fillColor="rgba(255,90,95,0.15)"
                    strokeColor="rgba(255,90,95,0.3)"
                    strokeWidth={1}
                  />
                )}
              </MapView>
              {/* Open in Maps overlay label */}
              <View style={st.openMapsOverlay}>
                <Text style={st.openMapsOverlayText}>Open in Maps</Text>
                <NomadIcon name="external-link" size={s(4)} color={colors.accent} strokeWidth={1.4} />
              </View>
            </View>
          </TouchableOpacity>
        )}


        {/* ─── Members ─── */}
        <View style={st.section}>
          {/* Tappable heading — opens the MembersModal. The inline list
              below stays as a quick scan. Per the logic-skill closed
              loop: tap → modal → tap member → profile / (creator only)
              × → removeGroupMember → chat system message + count--. */}
          <TouchableOpacity
            style={st.membersHeaderBtn}
            activeOpacity={0.7}
            onPress={() => setShowMembersModal(true)}
          >
            <Text style={st.sectionTitle}>Members ({memberCount})</Text>
            <View style={st.membersHeaderRight}>
              <Text style={st.membersHeaderCta}>view all</Text>
              <NomadIcon name="forward" size={s(5)} color="#1A1A1A" strokeWidth={1.4} />
            </View>
          </TouchableOpacity>
          <View style={st.membersList}>
            {members.map((m) => {
              const isCreator = m.user_id === group?.created_by || m.role === 'admin';
              const name = m.profile?.display_name || m.profile?.full_name || m.profile?.username || 'Nomad';
              const avatarUrl = m.profile?.avatar_url || null;
              const ini = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={st.memberRow}
                  activeOpacity={0.7}
                  onPress={() => handleMemberTap(m.user_id, m.profile?.full_name)}
                >
                  <View style={[st.memberAv, { backgroundColor: isCreator ? colors.primary : colors.accent }]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={st.memberAvImg} />
                    ) : (
                      <Text style={st.memberAvText}>{ini}</Text>
                    )}
                  </View>
                  <View style={st.memberInfo}>
                    <Text style={st.memberName}>{name}</Text>
                    {isCreator && <Text style={st.creatorTag}>creator</Text>}
                    {m.user_id === userId && !isCreator && <Text style={st.youTag}>you</Text>}
                  </View>
                  {iAmCreator && !isCreator && m.user_id !== userId ? (
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(m.user_id, name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <NomadIcon name="close" size={s(5)} color={colors.danger} strokeWidth={1.6} />
                    </TouchableOpacity>
                  ) : (
                    <NomadIcon name="forward" size={s(6)} color="#1A1A1A" strokeWidth={1.4} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Creator Tools block removed from here — it moved to the top,
            next to the group name. The old bottom placement was why
            the keyboard covered the edit input. */}

        {/* ─── Leave Chat ─── */}
        <TouchableOpacity
          style={st.leaveBtn}
          activeOpacity={0.7}
          onPress={() => setShowLeaveConfirm(true)}
        >
          <NomadIcon name="logout" size={s(6)} color="white" strokeWidth={1.4} />
          <Text style={st.leaveBtnText}>Leave Chat</Text>
        </TouchableOpacity>

        <View style={{ height: s(20) + insets.bottom }} />
      </ScrollView>

      {/* ─── Leave Confirmation Modal ─── */}
      <Modal visible={showLeaveConfirm} transparent animationType="fade">
        <TouchableOpacity
          style={st.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLeaveConfirm(false)}
        >
          <View style={st.modalBox}>
            <Text style={st.modalTitle}>Leave Chat</Text>
            <Text style={st.modalMsg}>Are you sure you want to leave this activity?</Text>
            <View style={st.modalBtns}>
              <TouchableOpacity
                style={st.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setShowLeaveConfirm(false)}
              >
                <Text style={st.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.modalLeaveBtn}
                activeOpacity={0.7}
                onPress={handleLeave}
              >
                <Text style={st.modalLeaveText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Members Modal — "the window" when user taps "Members (N)" ─── */}
      <MembersModal
        visible={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        conversationId={conversationId}
        members={members}
        currentUserId={userId || null}
        creatorUserId={group?.created_by || null}
        onTapMember={handleMemberTap}
        onAfterRemove={fetchAll}
      />
    </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─── */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.card },

  /* Header */
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(5), paddingVertical: s(5),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  backBtn: {
    width: s(20), height: s(20), borderRadius: s(10),
    backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: { fontSize: s(7), fontWeight: FW.bold, color: c.dark },

  scroll: { flex: 1 },

  /* Top section — emoji + name + count */
  topSection: { alignItems: 'center', paddingVertical: s(10) },
  emojiCircle: {
    width: s(32), height: s(32), borderRadius: s(16),
    alignItems: 'center', justifyContent: 'center', marginBottom: s(5),
  },
  emojiText: { fontSize: s(14) },
  groupName: { fontSize: s(8.5), fontWeight: FW.extra, color: c.dark, marginBottom: s(2) },
  memberCountText: { fontSize: s(5.5), fontWeight: FW.medium, color: c.textMuted },

  /* Creator-only action pills (top of screen, under group name) */
  creatorPillsRow: {
    flexDirection: 'row',
    gap: s(3),
    marginTop: s(5),
    justifyContent: 'center',
  },
  creatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    paddingHorizontal: s(5),
    paddingVertical: s(3),
    borderRadius: s(10),
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  creatorPillDanger: {
    backgroundColor: (c as any).dangerSurface || '#FEF2F2',
    borderColor: c.danger + '40',
  },
  creatorPillText: {
    fontSize: s(5),
    fontWeight: FW.semi,
    color: c.dark,
    textTransform: 'lowercase',
  },

  /* Section containers */
  section: { paddingHorizontal: s(8), marginBottom: s(6) },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: s(5),
  },
  sectionTitle: { fontSize: s(6.5), fontWeight: FW.bold, color: c.dark },

  /* Tappable "Members (N) — view all" heading row */
  membersHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(2),
  },
  membersHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  membersHeaderCta: {
    fontSize: s(5.5),
    fontWeight: FW.semi,
    color: c.primary,
  },

  /* Action rows */
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(5),
    paddingVertical: s(5.5),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  actionIcon: {
    width: s(16), height: s(16), borderRadius: s(8),
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { flex: 1, fontSize: s(6.5), fontWeight: FW.medium, color: c.dark },

  /* Map */
  mapContainer: {
    height: s(80), borderRadius: s(8), overflow: 'hidden',
    borderWidth: 0.5, borderColor: c.borderSoft,
  },
  map: { flex: 1 },
  mapPin: {
    width: s(10), height: s(10), borderRadius: s(5),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: s(1.5), borderColor: 'white',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(1) },
    shadowOpacity: 0.2, shadowRadius: s(2), elevation: 3,
  },
  mapPinInner: {
    width: s(4), height: s(4), borderRadius: s(2), backgroundColor: 'white',
  },
  openMapsOverlay: {
    position: 'absolute', bottom: s(3), right: s(3),
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: s(4),
    paddingHorizontal: s(4), paddingVertical: s(2),
    shadowColor: '#000', shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.1, shadowRadius: s(2), elevation: 2,
  },
  openMapsOverlayText: { fontSize: s(5), fontWeight: FW.semi, color: c.accent },

  /* Photos */
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    backgroundColor: c.primary, borderRadius: s(6),
    paddingHorizontal: s(5), paddingVertical: s(2.5),
  },
  addPhotoBtnText: { fontSize: s(5), fontWeight: FW.semi, color: 'white' },
  emptyPhotos: { alignItems: 'center', paddingVertical: s(10) },
  emptyPhotoTitle: { fontSize: s(6), fontWeight: FW.semi, color: c.textSec, marginTop: s(3) },
  emptyPhotoSub: { fontSize: s(5), color: c.textMuted, marginTop: s(1) },
  photoThumb: { width: s(40), height: s(40), borderRadius: s(4) },

  /* Members */
  membersList: { marginTop: s(4) },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(5),
    paddingVertical: s(5),
    borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  memberAv: {
    width: s(18), height: s(18), borderRadius: s(9),
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvImg: { width: s(18), height: s(18), borderRadius: s(9) },
  memberAvText: { color: 'white', fontSize: s(6), fontWeight: FW.bold },
  memberInfo: { flex: 1 },
  memberName: { fontSize: s(6.5), fontWeight: FW.semi, color: c.dark },
  creatorTag: { fontSize: s(5), fontWeight: FW.medium, color: c.primary, marginTop: s(0.5) },
  youTag: { fontSize: s(5), fontWeight: FW.medium, color: c.textMuted, marginTop: s(0.5) },

  /* Creator Tools */
  creatorTools: { flexDirection: 'row', gap: s(3), flexWrap: 'wrap' },
  creatorToolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    backgroundColor: c.surface, borderRadius: s(5),
    paddingHorizontal: s(5), paddingVertical: s(3.5),
  },
  creatorToolBtnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    backgroundColor: c.dangerSurface || '#FEE2E2', borderRadius: s(5),
    paddingHorizontal: s(5), paddingVertical: s(3.5),
  },
  creatorToolText: { fontSize: s(5.5), fontWeight: FW.semi, color: c.dark },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  editInput: {
    flex: 1, backgroundColor: c.surface, borderRadius: s(5),
    paddingHorizontal: s(5), paddingVertical: s(4),
    fontSize: s(6), fontWeight: FW.medium, color: c.dark,
  },
  editSave: {
    backgroundColor: c.success, borderRadius: s(5),
    paddingHorizontal: s(5), paddingVertical: s(3.5),
  },
  editSaveText: { fontSize: s(5.5), fontWeight: FW.bold, color: 'white' },
  editCancelText: { fontSize: s(5.5), fontWeight: FW.semi, color: c.textMuted },

  /* Leave Chat button */
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(3),
    marginHorizontal: s(8), marginTop: s(4),
    backgroundColor: c.primary, borderRadius: s(12),
    paddingVertical: s(6),
  },
  leaveBtnText: { fontSize: s(6.5), fontWeight: FW.bold, color: 'white' },

  /* Leave Modal */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: c.card, borderRadius: s(10),
    paddingVertical: s(10), paddingHorizontal: s(12),
    width: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: s(4) },
    shadowOpacity: 0.15, shadowRadius: s(12), elevation: 8,
  },
  modalTitle: { fontSize: s(8), fontWeight: FW.bold, color: c.dark, textAlign: 'center', marginBottom: s(3) },
  modalMsg: { fontSize: s(6), color: c.textSec, textAlign: 'center', marginBottom: s(8) },
  modalBtns: { flexDirection: 'row', gap: s(5) },
  modalCancelBtn: {
    flex: 1, borderRadius: s(8), paddingVertical: s(5),
    alignItems: 'center', backgroundColor: c.surface,
  },
  modalCancelText: { fontSize: s(6.5), fontWeight: FW.semi, color: c.accent },
  modalLeaveBtn: {
    flex: 1, borderRadius: s(8), paddingVertical: s(5),
    alignItems: 'center', backgroundColor: c.dangerSurface,
  },
  modalLeaveText: { fontSize: s(6.5), fontWeight: FW.semi, color: c.primary },
});
