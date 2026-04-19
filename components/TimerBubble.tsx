/**
 * TimerBubble — Timer popup card.
 *
 * Fixed at bottom of screen, above tab bar.
 * Vibrant, inviting card with system colors.
 *
 * Layout:
 * ┌──────────────────────────────────────────┐
 * │  (avatar+ring)  Name   ⏱ 12:34       X  │
 * │                                          │
 * │  🎉 Activity text here                   │
 * │                                          │
 * │  👤👤👤  3 joined                        │
 * │                                          │
 * │  [       Join       ]                    │
 * │  or                                      │
 * │  [   Chat  ] [  Leave  ]                 │
 * └──────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View, Text, StyleSheet, Animated, Image, TouchableOpacity, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type MapView from 'react-native-maps';
import type { RootStackParamList, AppCheckin } from '../lib/types';
import { createOrJoinStatusChat } from '../lib/hooks';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';
import { trackEvent } from '../lib/tracking';
import { useAvatar } from '../lib/AvatarContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: SW } = Dimensions.get('window');

/* ── System colors ── */
const CORAL = '#E8614D';
const TEAL = '#2A9D8F';
const FB_BLUE = '#3B82F6';

interface MemberInfo {
  user_id: string;
  avatar_url?: string | null;
  full_name?: string | null;
}

interface Props {
  visible: boolean;
  checkin: AppCheckin | null;
  creatorName: string;
  creatorAvatarUrl?: string | null;
  mapRef: React.RefObject<MapView | null>;
  onClose: () => void;
}

/* ── Live countdown ── */
function useCountdown(exp: string | null) {
  const [t, setT] = useState('');
  useEffect(() => {
    if (!exp) return;
    const tick = () => {
      const d = Math.max(0, new Date(exp).getTime() - Date.now());
      if (d <= 0) { setT('ended'); return; }
      const m = Math.floor(d / 60000);
      const sec = Math.floor((d % 60000) / 1000);
      if (m >= 60) {
        const h = Math.floor(m / 60);
        setT(`${h}h ${m % 60}m`);
      } else {
        setT(`${m}:${sec.toString().padStart(2, '0')}`);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [exp]);
  return t;
}

/* ── Fetch group members ── */
function useGroupMembers(checkin: AppCheckin | null, joined: boolean) {
  const [members, setMembers] = useState<MemberInfo[]>([]);

  useEffect(() => {
    if (!checkin) { setMembers([]); return; }

    const load = async () => {
      const actText = checkin.activity_text || checkin.status_text || 'Timer';
      const { data: convs } = await supabase
        .from('app_conversations')
        .select('id')
        .eq('type', 'group')
        .eq('name', actText)
        .eq('created_by', checkin.user_id)
        .limit(1);

      if (!convs?.[0]) { setMembers([]); return; }

      const { data: mems } = await supabase
        .from('app_conversation_members')
        .select('user_id')
        .eq('conversation_id', convs[0].id)
        .limit(10);

      if (!mems?.length) { setMembers([]); return; }

      const userIds = mems.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('app_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      setMembers(mems.map(m => {
        const p = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          avatar_url: p?.avatar_url ?? null,
          full_name: p?.full_name ?? null,
        };
      }));
    };

    load();
  }, [checkin?.id, joined]);

  return members;
}

export default function TimerBubble({
  visible, checkin, creatorName, creatorAvatarUrl,
  mapRef, onClose,
}: Props) {
  const { userId } = useContext(AuthContext);
  const { avatarUri } = useAvatar();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [joined, setJoined] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  const countdown = useCountdown(checkin?.expires_at ?? null);
  const firstName = creatorName?.split(' ')[0] || 'Nomad';
  const initials = creatorName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const actText = checkin?.activity_text || checkin?.status_text || '';
  const actEmoji = checkin?.status_emoji || '🎯';
  const baseMemberCount = checkin?.member_count ?? 1;

  // Optimistic member count — bumps instantly on join
  const memberCount = joined ? Math.max(baseMemberCount, baseMemberCount + 1) : baseMemberCount;

  const groupMembers = useGroupMembers(checkin, joined);

  /* ── Fade in / out ── */
  useEffect(() => {
    if (visible) {
      setJoined(false);
      setChatId(null);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  /* ── Join ── */
  const handleJoin = async () => {
    if (!checkin || !userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackEvent(userId, 'join_group', 'checkin', checkin.id);
    try {
      const { conversationId, error } = await createOrJoinStatusChat(
        userId,
        checkin.user_id,
        checkin.activity_text || checkin.status_text || 'Timer',
      );
      if (error || !conversationId) {
        console.error('[TimerBubble] Failed to join:', error);
        return;
      }
      setChatId(conversationId);
      setJoined(true);
    } catch (err) {
      console.error('[TimerBubble] Join exception:', err);
    }
  };

  /* ── Chat ── */
  const handleChat = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If owner and no chatId yet, create/get the chat first
    if (checkin?.user_id === userId && !chatId && checkin) {
      try {
        const { conversationId, error } = await createOrJoinStatusChat(
          userId,
          checkin.user_id,
          checkin.activity_text || checkin.status_text || 'Timer',
        );
        if (error || !conversationId) return;
        setChatId(conversationId);
        // Navigate after setting chatId.
        // isGroup:true is what unlocks the tappable chat header → GroupInfo
        // (map / mute / member list). Without it the header is dead and the
        // user can't reach the timer's location, mute toggle, or members.
        setTimeout(() => {
          onClose();
          nav.navigate('Chat', { conversationId, title: firstName, isGroup: true });
        }, 50);
        return;
      } catch {}
    }

    // Normal flow: navigate to existing chat
    if (!chatId) return;
    onClose();
    nav.navigate('Chat', { conversationId: chatId, title: firstName, isGroup: true });
  };

  /* ── Leave ── */
  const handleLeave = async () => {
    if (!chatId || !userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await supabase.from('app_conversation_members').delete()
        .eq('conversation_id', chatId).eq('user_id', userId);
    } catch {}
    setJoined(false);
    setChatId(null);
    onClose();
  };

  if (!visible || !checkin) return null;

  const bottomOffset = 2;

  return (
    <>
    {/* ── Fullscreen backdrop — tap to close ── */}
    <TouchableOpacity
      style={st.backdrop}
      activeOpacity={1}
      onPress={onClose}
    />
    <Animated.View
      style={[
        st.container,
        { bottom: bottomOffset, opacity },
      ]}
      pointerEvents="auto"
    >
      {/* ── Top row: avatar + name + timer + close ── */}
      <View style={st.topRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            onClose();
            setTimeout(() => nav.navigate('UserProfile', { userId: checkin?.user_id || '', name: creatorName }), 200);
          }}
        >
          <View style={st.avtRing}>
            {creatorAvatarUrl ? (
              <Image source={{ uri: creatorAvatarUrl }} style={st.avtImg} />
            ) : (
              <View style={[st.avtImg, st.avtFallback]}>
                <Text style={st.avtInitials}>{initials}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={st.nameCol}>
          <Text style={st.name} numberOfLines={1}>{firstName}</Text>
          {countdown ? (
            <View style={st.timerRow}>
              <View style={st.timerDot} />
              <Text style={st.timerTxt}>{countdown} left</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={st.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Text style={st.closeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Activity text with emoji ── */}
      {actText ? (
        <View style={st.actRow}>
          <Text style={st.actEmoji}>{actEmoji}</Text>
          <Text style={st.actText} numberOfLines={2}>{actText}</Text>
        </View>
      ) : null}

      {/* ── Group members row ── */}
      {memberCount > 0 && (
        <View style={st.membersRow}>
          <View style={st.avatarStack}>
            {(groupMembers.length > 0 ? groupMembers : []).slice(0, 5).map((m, i) => (
              <View key={m.user_id} style={[st.miniAvtWrap, { marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }]}>
                {m.avatar_url ? (
                  <Image source={{ uri: avatarUri(m.avatar_url) }} style={st.miniAvt} />
                ) : (
                  <View style={[st.miniAvt, st.miniAvtFallback]}>
                    <Text style={st.miniAvtTxt}>
                      {(m.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          <Text style={st.memberCountTxt}>
            {memberCount} {memberCount === 1 ? 'person' : 'joined'}
          </Text>
        </View>
      )}

      {/* ── Buttons ── */}
      {checkin?.user_id === userId ? (
        /* ── Owner: show Messages button to manage activity ── */
        <TouchableOpacity style={st.messagesBtn} onPress={handleChat} activeOpacity={0.85}>
          <Text style={st.messagesBtnTxt}>Messages</Text>
        </TouchableOpacity>
      ) : !joined ? (
        <TouchableOpacity style={st.joinBtn} onPress={handleJoin} activeOpacity={0.85}>
          <Text style={st.joinBtnTxt}>Join</Text>
        </TouchableOpacity>
      ) : (
        <View style={st.btnRow}>
          <TouchableOpacity style={st.chatBtn} onPress={handleChat} activeOpacity={0.85}>
            <Text style={st.chatBtnTxt}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.leaveBtn} onPress={handleLeave} activeOpacity={0.85}>
            <Text style={st.leaveBtnTxt}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
    </>
  );
}

const CARD_MARGIN = 8;

const st = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 899,
    backgroundColor: 'transparent',
  },
  container: {
    position: 'absolute',
    left: CARD_MARGIN,
    right: CARD_MARGIN,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 22,
    zIndex: 900,

    // Stronger shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 14,
  },

  /* ── Top row ── */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avtRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avtImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avtFallback: {
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avtInitials: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },

  /* ── Timer — live dot + text ── */
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: CORAL,
    marginRight: 6,
  },
  timerTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: CORAL,
  },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '700',
  },

  /* ── Activity text row ── */
  actRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  actEmoji: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 1,
  },
  actText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
  },

  /* ── Group members row ── */
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 10,
  },
  miniAvtWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  miniAvt: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
  },
  miniAvtFallback: {
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvtTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberCountTxt: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },

  /* ── Join button — system coral ── */
  joinBtn: {
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  joinBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* ── Messages button for owners ── */
  messagesBtn: {
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  messagesBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* ── Chat (FB blue) | Leave (subtle) ── */
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chatBtn: {
    flex: 1,
    backgroundColor: FB_BLUE,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  chatBtnTxt: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  leaveBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  leaveBtnTxt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
