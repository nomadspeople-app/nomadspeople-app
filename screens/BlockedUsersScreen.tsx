import { useState, useEffect, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { unblockUser } from '../lib/hooks';
import { AuthContext } from '../App';
import { useAvatar } from '../lib/AvatarContext';

interface BlockedProfile {
  blocked_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { userId } = useContext(AuthContext);
  const { avatarUri } = useAvatar();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [blocked, setBlocked] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocked = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('app_blocks')
      .select('blocked_id, profile:app_profiles!blocked_id(full_name, username, avatar_url)')
      .eq('blocker_id', userId);

    if (data) {
      setBlocked(
        data.map((row: any) => ({
          blocked_id: row.blocked_id,
          full_name: row.profile?.full_name || null,
          username: row.profile?.username || null,
          avatar_url: row.profile?.avatar_url || null,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchBlocked(); }, [userId]);

  const handleUnblock = (item: BlockedProfile) => {
    const name = item.full_name || item.username || 'this user';
    Alert.alert('Unblock', `Unblock ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          if (!userId) return;
          await unblockUser(userId, item.blocked_id);
          setBlocked(prev => prev.filter(b => b.blocked_id !== item.blocked_id));
        },
      },
    ]);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const renderItem = ({ item }: { item: BlockedProfile }) => (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        {item.avatar_url ? (
          <Image source={{ uri: avatarUri(item.avatar_url) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarTxt}>{getInitials(item.full_name)}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.dark }]}>{item.full_name || 'Unknown'}</Text>
        {item.username && (
          <Text style={[styles.username, { color: colors.textMuted }]}>@{item.username}</Text>
        )}
      </View>
      <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblock(item)}>
        <Text style={styles.unblockTxt}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.borderSoft }]}>
        <TouchableOpacity
          style={[styles.hdrBtn, { backgroundColor: colors.pill }]}
          onPress={() => nav.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <NomadIcon name="back" size={s(9)} color={colors.dark} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={[styles.hdrTitle, { color: colors.dark }]}>Blocked Users</Text>
        <View style={[styles.hdrBtn, { backgroundColor: 'transparent' }]} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.center}>
          <NomadIcon name="check-circle" size={s(18)} color={colors.textMuted} strokeWidth={1.2} />
          <Text style={[styles.emptyTitle, { color: colors.dark }]}>No blocked users</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Users you block won't be able to message you or see your activity.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.blocked_id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + s(10) }}
        />
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(6), paddingVertical: s(5),
    borderBottomWidth: 1,
  },
  hdrBtn: {
    width: s(15), height: s(15), borderRadius: s(7.5),
    alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: { fontSize: s(7.5), fontWeight: FW.bold },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(7), paddingVertical: s(5),
    borderBottomWidth: 1, borderBottomColor: c.borderSoft,
  },
  avatarWrap: { marginRight: s(5) },
  avatar: { width: s(18), height: s(18), borderRadius: s(9) },
  avatarFallback: {
    backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontSize: s(6.5), fontWeight: FW.bold },
  info: { flex: 1 },
  name: { fontSize: s(6.5), fontWeight: FW.semi },
  username: { fontSize: s(5.5), marginTop: s(1) },
  unblockBtn: {
    paddingHorizontal: s(6), paddingVertical: s(3),
    borderRadius: s(4), borderWidth: 1, borderColor: c.primary,
  },
  unblockTxt: { fontSize: s(5.5), fontWeight: FW.semi, color: c.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(10) },
  emptyTitle: { fontSize: s(7), fontWeight: FW.bold, marginTop: s(5) },
  emptySubtitle: { fontSize: s(5.5), textAlign: 'center', marginTop: s(3), lineHeight: s(8) },
});
