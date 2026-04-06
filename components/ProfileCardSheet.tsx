import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder, Modal, Image, ScrollView,
} from 'react-native';
import { useRef, useEffect, useState, useMemo } from 'react';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';

const { height: SH } = Dimensions.get('window');
const SHEET_H = SH * 0.58;

/* ── Countdown timer ── */
function Countdown({ expiresAt, colors }: { expiresAt: string; colors: any }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m left` : `${m}m ${sec}s left`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const ended = remaining === 'Ended';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(2.5), marginBottom: s(5) }}>
      <NomadIcon name="clock" size={s(5.5)} color={ended ? '#9CA3AF' : colors.danger} strokeWidth={1.4} />
      <Text style={{ fontSize: s(6.5), fontWeight: FW.bold as any, color: ended ? '#9CA3AF' : colors.danger }}>
        {remaining}
      </Text>
    </View>
  );
}

export interface ActiveGroup {
  id: string;
  name: string;
  category: string;
  memberCount: number;
}

interface NomadData {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string | null;
  vibeIcon: string;
  vibeColor: string;
  vibeLabel: string;
  bio: string;
  city: string;
  statusEmoji?: string | null;
  statusText?: string | null;
  interests?: string[];
  activeGroups?: ActiveGroup[];
  memberCount?: number;
  checkinType?: 'status' | 'timer';
  expiresAt?: string | null;
}

interface Props {
  visible: boolean;
  nomad: NomadData | null;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
  onSayHi?: (userId: string, name: string) => void;
  onJoinStatus?: (userId: string, statusText: string) => void;
  onFollow?: (userId: string) => void;
  isFollowing?: boolean;
}

export default function ProfileCardSheet({
  visible, nomad, onClose, onViewProfile, onJoinStatus,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (visible) {
      setJoined(false);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: SHEET_H, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) onClose();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!nomad) return null;

  const hasStatus = !!(nomad.statusText || nomad.statusEmoji);
  const AV = s(22);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[st.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Handle */}
            <View style={st.handle} />

            {/* ═══ PROFILE ROW — compact avatar + name + city ═══ */}
            <TouchableOpacity
              style={st.profileRow}
              onPress={() => { onClose(); onViewProfile(nomad.id); }}
              activeOpacity={0.7}
            >
              <View style={[st.avatar, { width: AV, height: AV, borderRadius: AV / 2, backgroundColor: nomad.color }]}>
                {nomad.avatarUrl ? (
                  <Image source={{ uri: nomad.avatarUrl }} style={st.avatarImg} />
                ) : (
                  <Text style={st.avatarText}>{nomad.initials}</Text>
                )}
              </View>
              <View style={st.nameCol}>
                <Text style={st.name} numberOfLines={1}>{nomad.name}</Text>
                <View style={st.cityRow}>
                  <NomadIcon name="pin" size={s(3.5)} color={colors.textMuted} strokeWidth={1.4} />
                  <Text style={st.city}>{nomad.city}</Text>
                </View>
              </View>
              <NomadIcon name="forward" size={s(6)} color={colors.textFaint} strokeWidth={1.6} />
            </TouchableOpacity>

            {/* ═══ STATUS — the main event ═══ */}
            {hasStatus && (
              <View style={st.statusCard}>
                <Text style={st.statusEmoji}>{nomad.statusEmoji || '📍'}</Text>
                <Text style={st.statusText} numberOfLines={3}>{nomad.statusText || 'Active now'}</Text>
                {/* Countdown for timer checkins */}
                {nomad.checkinType === 'timer' && nomad.expiresAt && (
                  <Countdown expiresAt={nomad.expiresAt} colors={colors} />
                )}
                {(nomad.memberCount ?? 0) > 0 && (
                  <View style={st.membersRow}>
                    <NomadIcon name="users" size={s(4)} color="#4ADE80" strokeWidth={1.4} />
                    <Text style={st.membersTxt}>{nomad.memberCount} {(nomad.memberCount ?? 0) === 1 ? 'person' : 'people'} joined</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[st.joinBtn, joined && st.joinBtnOn]}
                  onPress={() => {
                    if (!joined) {
                      setJoined(true);
                      onJoinStatus?.(nomad.id, nomad.statusText || 'Activity');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <NomadIcon name={joined ? 'check' : 'users'} size={s(6)} color="white" strokeWidth={1.6} />
                  <Text style={st.joinBtnTxt}>{joined ? 'Joined!' : 'Join Activity'}</Text>
                </TouchableOpacity>
              </View>
            )}


            {/* View Profile removed — user enters profile from avatar/name tap */}

          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: SHEET_H,
    backgroundColor: c.card,
    borderTopLeftRadius: s(16),
    borderTopRightRadius: s(16),
    paddingHorizontal: s(12),
    paddingTop: s(5),
    paddingBottom: s(14),
  },
  handle: {
    width: s(18),
    height: s(1.8),
    borderRadius: s(1),
    backgroundColor: c.pill,
    alignSelf: 'center',
    marginBottom: s(8),
  },

  /* ═══ PROFILE ROW — compact ═══ */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginBottom: s(8),
    paddingVertical: s(2),
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: s(1),
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(1) },
    shadowOpacity: 0.1,
    shadowRadius: s(3),
    elevation: 3,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: 'white', fontSize: s(8), fontWeight: FW.bold },
  nameCol: { flex: 1 },
  name: {
    fontSize: s(8),
    fontWeight: FW.extra,
    color: c.dark,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    marginTop: s(1),
  },
  city: { fontSize: s(5), color: c.textMuted },

  /* ═══ STATUS CARD — the main event ═══ */
  statusCard: {
    backgroundColor: c.successSurface,
    borderRadius: s(12),
    padding: s(10),
    marginBottom: s(8),
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
  },
  statusEmoji: { fontSize: s(18), marginBottom: s(4) },
  statusText: {
    fontSize: s(8.5),
    fontWeight: FW.bold,
    color: c.dark,
    lineHeight: s(12),
    textAlign: 'center',
    marginBottom: s(5),
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2.5),
    marginBottom: s(7),
  },
  membersTxt: {
    fontSize: s(5),
    color: '#4ADE80',
    fontWeight: FW.medium,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
    backgroundColor: c.success,
    borderRadius: s(12),
    paddingVertical: s(7),
    width: '100%',
  },
  joinBtnOn: {
    backgroundColor: '#16A34A',
  },
  joinBtnTxt: { color: c.white, fontSize: s(8), fontWeight: FW.extra },

});
