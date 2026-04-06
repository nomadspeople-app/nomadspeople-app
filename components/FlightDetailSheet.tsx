/**
 * FlightDetailSheet — Full bottom sheet for flight group details.
 *
 * Slides up from bottom tab bar to near top.
 * Shows: flag + country hero, main group join, sub-groups by origin with join buttons.
 * Open, spacious rows — friendly join buttons — our design language.
 */
import { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  Dimensions, Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { joinFlightChat, leaveGroupChat, useFlightGroupDetail, type FlightSubGroup } from '../lib/hooks';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../lib/types';
import * as Haptics from 'expo-haptics';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';
import type { FlightGroup } from '../lib/hooks';

const { height: SH } = Dimensions.get('window');

function formatDate(d: string | null) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

const AVATAR_COLORS = ['#E8614D', '#2A9D8F', '#34A853', '#F59E0B', '#8B5CF6', '#EC4899'];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

interface Props {
  visible: boolean;
  flightGroup: FlightGroup | null;
  onClose: () => void;
}

export default function FlightDetailSheet({ visible, flightGroup: fg, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId } = useContext(AuthContext);
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SH)).current;

  const [joiningMain, setJoiningMain] = useState(false);
  const [joiningSub, setJoiningSub] = useState<string | null>(null);
  const [homeCountry, setHomeCountry] = useState<string | null>(null);

  // Fetch full detail with sub-groups
  const { detail, loading, refetch } = useFlightGroupDetail(fg?.id || '', userId);

  // Fetch user's home country
  useEffect(() => {
    if (!userId) return;
    supabase.from('app_profiles').select('home_country').eq('user_id', userId).single()
      .then(({ data }) => { if (data?.home_country) setHomeCountry(data.home_country); });
  }, [userId]);

  // Animate in/out
  useEffect(() => {
    if (visible && fg) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: SH, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible, fg]);

  const handleJoinMain = useCallback(async () => {
    if (!userId || !detail?.conversation_id || detail.joinedMainGroup) return;
    setJoiningMain(true);
    const { success } = await joinFlightChat(userId, detail.conversation_id);
    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refetch();
    }
    setJoiningMain(false);
  }, [userId, detail, refetch]);

  const handleJoinSub = useCallback(async (sub: FlightSubGroup) => {
    if (!userId || !sub.conversation_id) return;
    if (detail?.joinedSubGroups.has(sub.conversation_id)) return;
    setJoiningSub(sub.id);
    const { success } = await joinFlightChat(userId, sub.conversation_id);
    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refetch();
    }
    setJoiningSub(null);
  }, [userId, detail, refetch]);

  const handleLeaveMain = useCallback(async () => {
    if (!userId || !detail?.conversation_id) return;
    const { success } = await leaveGroupChat(userId, detail.conversation_id);
    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await refetch();
    }
  }, [userId, detail, refetch]);

  const handleLeaveSub = useCallback(async (sub: FlightSubGroup) => {
    if (!userId || !sub.conversation_id) return;
    const { success } = await leaveGroupChat(userId, sub.conversation_id);
    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await refetch();
    }
  }, [userId, refetch]);

  const handleOpenChat = useCallback((conversationId: string, title: string, emoji: string) => {
    onClose();
    setTimeout(() => {
      nav.navigate('Chat', { conversationId, title, avatarText: emoji, isGroup: true });
    }, 300);
  }, [onClose, nav]);

  if (!fg) return null;

  const memberPreviews = (fg.members || []).slice(0, 6);
  const mainDateRange = detail
    ? `${formatDate(detail.min_arrival)} – ${formatDate(detail.max_departure)}`
    : fg.earliest_arrival
      ? `${formatDate(fg.earliest_arrival)} – ${formatDate(fg.latest_arrival || null)}`
      : '';

  const mainJoined = detail?.joinedMainGroup || false;
  const subGroups = detail?.sub_groups || [];

  // Sort sub-groups: user's origin first, then by member count
  const sortedSubs = [...subGroups].sort((a, b) => {
    const aIsUser = homeCountry && a.origin_country === homeCountry ? -1 : 0;
    const bIsUser = homeCountry && b.origin_country === homeCountry ? -1 : 0;
    if (aIsUser !== bIsUser) return aIsUser - bIsUser;
    return b.member_count - a.member_count;
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        {/* Tap backdrop to close */}
        <TouchableOpacity style={{ height: insets.top + s(20) }} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[st.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + s(10) }]}>
          {/* Handle */}
          <View style={st.handle} />

          {/* Close button */}
          <TouchableOpacity style={st.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <NomadIcon name="close" size={s(7)} strokeWidth={1.6} color="#999" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: s(10) }}>

            {/* ── Hero ── */}
            <View style={st.hero}>
              <Text style={st.heroFlag}>{fg.country_flag}</Text>
              <Text style={st.heroCountry}>{fg.country.toLowerCase()}</Text>
              <Text style={st.heroMeta}>
                {fg.member_count} {fg.member_count === 1 ? 'nomad' : 'nomads'}
                {mainDateRange ? `  ·  ${mainDateRange}` : ''}
              </Text>
            </View>

            {/* ── Member previews ── */}
            {memberPreviews.length > 0 && (
              <View style={st.dotsRow}>
                {memberPreviews.map((m: any, i: number) => (
                  <View key={m.id} style={[st.dot, { marginLeft: i > 0 ? -s(2) : 0, backgroundColor: avatarColor(m.user_id) }]}>
                    {m.profile?.avatar_url ? (
                      <Image source={{ uri: m.profile.avatar_url }} style={st.dotImg} />
                    ) : (
                      <Text style={st.dotInitial}>{(m.profile?.full_name || '?')[0].toUpperCase()}</Text>
                    )}
                  </View>
                ))}
                {fg.member_count > 6 && (
                  <Text style={st.dotMore}>+{fg.member_count - 6}</Text>
                )}
              </View>
            )}

            {/* ── Main group row ── */}
            <View style={st.groupSection}>
              <Text style={st.sectionLabel}>everyone heading to {fg.country.toLowerCase()}</Text>
              <View style={st.groupRow}>
                <View style={st.groupLeft}>
                  <Text style={st.groupFlag}>{fg.country_flag}</Text>
                  <View style={st.groupInfo}>
                    <Text style={st.groupName}>{fg.country.toLowerCase()} group</Text>
                    <Text style={st.groupSub}>{fg.member_count} nomads</Text>
                  </View>
                </View>
                {mainJoined ? (
                  <View style={st.joinedBtns}>
                    <TouchableOpacity
                      style={st.joinedBtn}
                      onPress={() => detail?.conversation_id && handleOpenChat(
                        detail.conversation_id,
                        `${fg.country_flag} ${fg.country.toLowerCase()}`,
                        fg.country_flag,
                      )}
                      activeOpacity={0.7}
                    >
                      <NomadIcon name="chat" size={s(5.5)} color="white" strokeWidth={1.6} />
                      <Text style={st.joinedBtnText}>chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.leaveBtn} onPress={handleLeaveMain} activeOpacity={0.7}>
                      <NomadIcon name="close" size={s(4.5)} color={colors.danger} strokeWidth={1.6} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={st.joinBtn}
                    onPress={handleJoinMain}
                    disabled={joiningMain || !detail?.conversation_id}
                    activeOpacity={0.7}
                  >
                    {joiningMain ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={st.joinBtnText}>join</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Sub-groups by origin ── */}
            {loading ? (
              <View style={st.loadingRow}><ActivityIndicator color={colors.accent} /></View>
            ) : sortedSubs.length > 0 ? (
              <View style={st.groupSection}>
                <Text style={st.sectionLabel}>by where they're coming from</Text>
                {sortedSubs.map((sub) => {
                  const isJoined = sub.conversation_id ? detail!.joinedSubGroups.has(sub.conversation_id) : false;
                  const isJoining = joiningSub === sub.id;
                  const isUserOrigin = homeCountry && sub.origin_country === homeCountry;
                  const subDate = sub.min_arrival
                    ? `${formatDate(sub.min_arrival)} – ${formatDate(sub.max_departure)}`
                    : '';

                  return (
                    <View key={sub.id} style={[st.groupRow, isUserOrigin && st.groupRowHighlight]}>
                      <View style={st.groupLeft}>
                        <Text style={st.groupFlag}>{sub.origin_flag}</Text>
                        <View style={st.groupInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2) }}>
                            <Text style={st.groupName}>{sub.origin_country.toLowerCase()}</Text>
                            {isUserOrigin && <View style={st.youBadge}><Text style={st.youBadgeText}>you</Text></View>}
                          </View>
                          <Text style={st.groupSub}>
                            {sub.member_count} {sub.member_count === 1 ? 'person' : 'people'}
                            {subDate ? `  ·  ${subDate}` : ''}
                          </Text>
                        </View>
                      </View>
                      {isJoined ? (
                        <View style={st.joinedBtns}>
                          <TouchableOpacity
                            style={st.joinedBtn}
                            onPress={() => sub.conversation_id && handleOpenChat(
                              sub.conversation_id,
                              `${sub.origin_flag} ${sub.origin_country.toLowerCase()} → ${fg.country.toLowerCase()}`,
                              sub.origin_flag,
                            )}
                            activeOpacity={0.7}
                          >
                            <NomadIcon name="chat" size={s(5.5)} color="white" strokeWidth={1.6} />
                            <Text style={st.joinedBtnText}>chat</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={st.leaveBtn} onPress={() => handleLeaveSub(sub)} activeOpacity={0.7}>
                            <NomadIcon name="close" size={s(4.5)} color={colors.danger} strokeWidth={1.6} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={st.joinBtn}
                          onPress={() => handleJoinSub(sub)}
                          disabled={isJoining || !sub.conversation_id}
                          activeOpacity={0.7}
                        >
                          {isJoining ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Text style={st.joinBtnText}>join</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    flex: 1,
    backgroundColor: c.card,
    borderTopLeftRadius: s(12),
    borderTopRightRadius: s(12),
    paddingHorizontal: s(10),
    paddingTop: s(5),
  },
  handle: {
    width: s(18),
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: s(4),
  },
  closeBtn: {
    position: 'absolute',
    top: s(8),
    right: s(10),
    zIndex: 10,
  },

  /* Hero */
  hero: {
    alignItems: 'center',
    paddingTop: s(8),
    paddingBottom: s(6),
  },
  heroFlag: {
    fontSize: s(24),
    marginBottom: s(3),
  },
  heroCountry: {
    fontSize: s(12),
    fontWeight: FW.extra,
    color: c.dark,
    marginBottom: s(2),
  },
  heroMeta: {
    fontSize: s(5.5),
    color: c.textMuted,
  },

  /* Member dots */
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(10),
  },
  dot: {
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    borderWidth: 2,
    borderColor: 'white',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotImg: {
    width: '100%',
    height: '100%',
    borderRadius: s(7),
  },
  dotInitial: {
    color: 'white',
    fontSize: s(5.5),
    fontWeight: FW.bold,
  },
  dotMore: {
    fontSize: s(5),
    fontWeight: FW.semi,
    color: c.textMuted,
    marginLeft: s(3),
  },

  /* Group sections */
  groupSection: {
    marginBottom: s(8),
  },
  sectionLabel: {
    fontSize: s(5.5),
    fontWeight: FW.medium,
    color: c.textMuted,
    marginBottom: s(5),
    paddingHorizontal: s(2),
  },

  /* Group row — open, spacious */
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(6),
    paddingHorizontal: s(4),
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderSoft,
  },
  groupRowHighlight: {
    backgroundColor: c.accentLight,
    borderRadius: s(8),
    borderBottomWidth: 0,
    marginBottom: s(2),
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    flex: 1,
  },
  groupFlag: {
    fontSize: s(12),
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: c.dark,
  },
  groupSub: {
    fontSize: s(5),
    color: c.textMuted,
    marginTop: s(0.5),
  },

  /* Join buttons — friendly, rounded */
  joinBtn: {
    backgroundColor: c.primary,
    borderRadius: s(10),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: s(28),
  },
  joinBtnText: {
    fontSize: s(6),
    fontWeight: FW.bold,
    color: 'white',
  },
  joinedBtn: {
    backgroundColor: c.success,
    borderRadius: s(10),
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2),
    minWidth: s(28),
  },
  joinedBtnText: {
    fontSize: s(6),
    fontWeight: FW.bold,
    color: 'white',
  },
  joinedBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  leaveBtn: {
    backgroundColor: c.dangerSurface || '#FEE2E2',
    borderRadius: s(10),
    padding: s(3.5),
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* You badge */
  youBadge: {
    backgroundColor: c.accent,
    borderRadius: s(4),
    paddingHorizontal: s(3),
    paddingVertical: s(0.5),
  },
  youBadgeText: {
    color: 'white',
    fontSize: s(4),
    fontWeight: FW.bold,
  },

  loadingRow: {
    paddingVertical: s(10),
    alignItems: 'center',
  },
});
