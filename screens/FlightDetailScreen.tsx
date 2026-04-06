/**
 * FlightDetailScreen — Full-page view of a flight destination
 *
 * Shows: country, total people, date range, main group join button,
 * then sub-groups by origin country each with their own join button.
 * Only after joining does the chat appear in Messages tab.
 */
import React, { useState, useContext, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../lib/types';
import { useFlightGroupDetail, joinFlightChat, leaveGroupChat, FlightSubGroup } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { AuthContext } from '../App';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FlightDetail'>;

function formatDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function FlightDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { userId } = useContext(AuthContext);

  const { detail, loading, refetch } = useFlightGroupDetail(params.flightGroupId, userId);
  const [joiningMain, setJoiningMain] = useState(false);
  const [joiningSub, setJoiningSub] = useState<string | null>(null);
  const [homeCountry, setHomeCountry] = useState<string | null>(null);

  // Fetch user's home_country to highlight their origin sub-group
  useEffect(() => {
    if (!userId) return;
    supabase.from('app_profiles').select('home_country').eq('user_id', userId).single()
      .then(({ data }) => { if (data?.home_country) setHomeCountry(data.home_country); });
  }, [userId]);

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

  const handleOpenChat = useCallback((conversationId: string, name: string, emoji: string) => {
    nav.navigate('Chat', {
      conversationId,
      title: name,
      avatarText: emoji,
      isGroup: true,
    });
  }, [nav]);

  if (loading || !detail) {
    return (
      <View style={[st.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const mainJoined = detail.joinedMainGroup;

  return (
    <View style={[st.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + s(2) }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={st.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <NomadIcon name="back" size={s(9)} color={colors.text} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.text }]}>incoming flight</Text>
        <View style={{ width: s(10) }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero: flag + country */}
        <View style={st.hero}>
          <Text style={st.heroFlag}>{detail.country_flag}</Text>
          <Text style={[st.heroCountry, { color: colors.text }]}>{detail.country.toLowerCase()}</Text>
          <Text style={[st.heroMeta, { color: colors.textSec }]}>
            {detail.member_count} nomads  ·  {formatDate(detail.min_arrival)} – {formatDate(detail.max_departure)}
          </Text>
        </View>

        {/* Main group join button */}
        <View style={st.section}>
          <Text style={[st.sectionLabel, { color: colors.textSec }]}>everyone going to {detail.country.toLowerCase()}</Text>
          {mainJoined ? (
            <View style={st.joinedRow}>
              <TouchableOpacity
                style={[st.joinBtn, st.joinedBtn, { flex: 1 }]}
                onPress={() => detail.conversation_id && handleOpenChat(detail.conversation_id, `${detail.country_flag} ${detail.country.toLowerCase()}`, detail.country_flag)}
              >
                <NomadIcon name="check" size={s(7)} color="#fff" strokeWidth={2} />
                <Text style={st.joinedText}>chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.leaveBtnSmall} onPress={handleLeaveMain}>
                <NomadIcon name="close" size={s(5)} color={colors.danger} strokeWidth={1.6} />
                <Text style={st.leaveText}>leave</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[st.joinBtn, st.pendingBtn]}
              onPress={handleJoinMain}
              disabled={joiningMain}
            >
              {joiningMain ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <NomadIcon name="airplane" size={s(7)} color="#fff" strokeWidth={1.8} />
                  <Text style={st.joinText}>join {detail.country.toLowerCase()} group</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Divider */}
        <View style={[st.divider, { backgroundColor: colors.border }]} />

        {/* Sub-groups by origin — user's country first */}
        <View style={st.section}>
          <Text style={[st.sectionLabel, { color: colors.textSec }]}>by where they're coming from</Text>

          {[...detail.sub_groups]
            .sort((a, b) => {
              const aIsUser = homeCountry && a.origin_country === homeCountry ? -1 : 0;
              const bIsUser = homeCountry && b.origin_country === homeCountry ? -1 : 0;
              return aIsUser - bIsUser;
            })
            .map((sub) => {
            const isJoined = sub.conversation_id ? detail.joinedSubGroups.has(sub.conversation_id) : false;
            const isJoining = joiningSub === sub.id;
            const isUserOrigin = homeCountry && sub.origin_country === homeCountry;

            return (
              <View key={sub.id} style={[st.subCard, { borderColor: isUserOrigin ? colors.primary : colors.border }, isUserOrigin && st.subCardHighlight]}>
                {isUserOrigin && <View style={st.youBadge}><Text style={st.youBadgeText}>you</Text></View>}
                <View style={st.subLeft}>
                  <Text style={st.subFlag}>{sub.origin_flag}</Text>
                  <View style={st.subInfo}>
                    <Text style={[st.subCountry, { color: colors.text }]}>{sub.origin_country.toLowerCase()}</Text>
                    <Text style={[st.subMeta, { color: colors.textSec }]}>
                      {sub.member_count} people  ·  {formatDate(sub.min_arrival)} – {formatDate(sub.max_departure)}
                    </Text>
                  </View>
                </View>

                {isJoined ? (
                  <View style={st.subJoinedRow}>
                    <TouchableOpacity
                      style={[st.subJoinBtn, st.subJoinedBtn]}
                      onPress={() => sub.conversation_id && handleOpenChat(
                        sub.conversation_id,
                        `${sub.origin_flag} ${sub.origin_country.toLowerCase()} → ${detail.country.toLowerCase()}`,
                        sub.origin_flag,
                      )}
                    >
                      <NomadIcon name="check" size={s(6)} color="#fff" strokeWidth={2} />
                      <Text style={st.subJoinedText}>chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.subLeaveBtn} onPress={() => handleLeaveSub(sub)}>
                      <NomadIcon name="close" size={s(4)} color={colors.danger} strokeWidth={1.6} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[st.subJoinBtn, st.subPendingBtn]}
                    onPress={() => handleJoinSub(sub)}
                    disabled={isJoining}
                  >
                    {isJoining ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={st.subJoinText}>join</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: s(20) }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(6),
    paddingBottom: s(4),
  },
  backBtn: { width: s(10), alignItems: 'flex-start' },
  headerTitle: { fontSize: s(7), fontWeight: FW.semi as any },

  scroll: { paddingHorizontal: s(6) },

  /* Hero */
  hero: { alignItems: 'center', paddingTop: s(6), paddingBottom: s(8) },
  heroFlag: { fontSize: s(24) },
  heroCountry: { fontSize: s(12), fontWeight: FW.bold as any, marginTop: s(2) },
  heroMeta: { fontSize: s(5.5), marginTop: s(2) },

  /* Section */
  section: { marginBottom: s(4) },
  sectionLabel: { fontSize: s(5), fontWeight: FW.medium as any, marginBottom: s(3) },

  /* Main join button */
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(5),
    borderRadius: s(5),
    gap: s(3),
  },
  pendingBtn: { backgroundColor: c.primary },
  joinedBtn: { backgroundColor: c.success },
  joinText: { color: '#fff', fontSize: s(6.5), fontWeight: FW.semi as any },
  joinedText: { color: '#fff', fontSize: s(6.5), fontWeight: FW.semi as any },
  joinedRow: {
    flexDirection: 'row',
    gap: s(3),
    alignItems: 'stretch',
  },
  leaveBtnSmall: {
    backgroundColor: c.dangerSurface || '#FEE2E2',
    borderRadius: s(4),
    paddingHorizontal: s(4),
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(1),
  },
  leaveText: {
    color: c.danger,
    fontSize: s(4.5),
    fontWeight: FW.semi as any,
  },

  /* Divider */
  divider: { height: 1, marginVertical: s(6) },

  /* Sub-group card */
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: s(4),
    padding: s(4),
    marginBottom: s(3),
  },
  subCardHighlight: {
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,90,95,0.04)',  // dynamic primary with opacity
  },
  youBadge: {
    position: 'absolute',
    top: -s(3),
    right: s(4),
    backgroundColor: c.primary,
    paddingHorizontal: s(3),
    paddingVertical: s(0.5),
    borderRadius: s(2),
  },
  youBadgeText: {
    color: '#fff',
    fontSize: s(4),
    fontWeight: FW.semi as any,
  },
  subLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  subFlag: { fontSize: s(10), marginRight: s(3) },
  subInfo: { flex: 1 },
  subCountry: { fontSize: s(6), fontWeight: FW.semi as any },
  subMeta: { fontSize: s(4.5), marginTop: s(0.5) },

  /* Sub join button */
  subJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(5),
    paddingVertical: s(2.5),
    borderRadius: s(3),
    gap: s(1.5),
    minWidth: s(22),
  },
  subPendingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  subJoinedBtn: { backgroundColor: c.success },
  subJoinText: { color: c.primary, fontSize: s(5.5), fontWeight: FW.semi as any },
  subJoinedText: { color: '#fff', fontSize: s(5.5), fontWeight: FW.semi as any },
  subJoinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  subLeaveBtn: {
    backgroundColor: c.dangerSurface || '#FEE2E2',
    borderRadius: s(3),
    padding: s(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
