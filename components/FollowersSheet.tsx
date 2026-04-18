/**
 * FollowersSheet — Modal list of followers or following users.
 *
 * Two tabs: Followers | Following
 * Each row: avatar + name + tap → UserProfile
 */
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, FlatList,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import NomadIcon from './NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useAvatar } from '../lib/AvatarContext';

const { height: SH } = Dimensions.get('window');

interface FollowUser {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialTab?: 'followers' | 'following';
  followerCount: number;
  followingCount: number;
  onViewProfile: (userId: string, name: string) => void;
}

export default function FollowersSheet({
  visible, onClose, userId, initialTab = 'followers',
  followerCount, followingCount, onViewProfile,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { avatarUri } = useAvatar();
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset tab when sheet opens
  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  // Fetch data when tab changes
  useEffect(() => {
    if (!visible || !userId) return;
    const fetchList = async () => {
      setLoading(true);
      if (tab === 'followers') {
        const { data: rows } = await supabase
          .from('app_follows')
          .select('follower_id')
          .eq('following_id', userId)
          .limit(200);
        if (rows && rows.length > 0) {
          const ids = rows.map(r => r.follower_id);
          const { data: profiles } = await supabase
            .from('app_profiles')
            .select('user_id, full_name, display_name, username, avatar_url, bio')
            .in('user_id', ids);
          setFollowers((profiles || []) as FollowUser[]);
        } else {
          setFollowers([]);
        }
      } else {
        const { data: rows } = await supabase
          .from('app_follows')
          .select('following_id')
          .eq('follower_id', userId)
          .limit(200);
        if (rows && rows.length > 0) {
          const ids = rows.map(r => r.following_id);
          const { data: profiles } = await supabase
            .from('app_profiles')
            .select('user_id, full_name, display_name, username, avatar_url, bio')
            .in('user_id', ids);
          setFollowing((profiles || []) as FollowUser[]);
        } else {
          setFollowing([]);
        }
      }
      setLoading(false);
    };
    fetchList();
  }, [visible, userId, tab]);

  const data = tab === 'followers' ? followers : following;

  const getInitials = (name?: string | null) =>
    name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const renderUser = ({ item }: { item: FollowUser }) => {
    const name = item.display_name || item.full_name || item.username || 'Nomad';
    return (
      <TouchableOpacity
        style={st.row}
        activeOpacity={0.7}
        onPress={() => {
          onClose();
          setTimeout(() => onViewProfile(item.user_id, name), 200);
        }}
      >
        <View style={st.avWrap}>
          {item.avatar_url ? (
            <Image source={{ uri: avatarUri(item.avatar_url) }} style={st.avImg} />
          ) : (
            <View style={st.avFallback}>
              <Text style={st.avTxt}>{getInitials(item.full_name)}</Text>
            </View>
          )}
        </View>
        <View style={st.infoCol}>
          <Text style={st.userName} numberOfLines={1}>{name}</Text>
          {item.bio ? (
            <Text style={st.userBio} numberOfLines={1}>{item.bio}</Text>
          ) : null}
        </View>
        <NomadIcon name="forward" size={s(5)} color={colors.textMuted} strokeWidth={1.6} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <TouchableOpacity style={{ flex: 0.15 }} activeOpacity={1} onPress={onClose} />
        <View style={st.sheet}>
          {/* Handle */}
          <View style={st.handle} />

          {/* Tabs */}
          <View style={st.tabRow}>
            <TouchableOpacity
              style={[st.tab, tab === 'followers' && st.tabActive]}
              onPress={() => setTab('followers')}
              activeOpacity={0.7}
            >
              <Text style={[st.tabCount, tab === 'followers' && st.tabCountActive]}>
                {followerCount}
              </Text>
              <Text style={[st.tabLabel, tab === 'followers' && st.tabLabelActive]}>
                Followers
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.tab, tab === 'following' && st.tabActive]}
              onPress={() => setTab('following')}
              activeOpacity={0.7}
            >
              <Text style={[st.tabCount, tab === 'following' && st.tabCountActive]}>
                {followingCount}
              </Text>
              <Text style={[st.tabLabel, tab === 'following' && st.tabLabelActive]}>
                Following
              </Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <View style={st.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item.user_id}
              renderItem={renderUser}
              contentContainerStyle={st.listContent}
              ItemSeparatorComponent={() => <View style={st.separator} />}
              ListEmptyComponent={
                <View style={st.emptyWrap}>
                  <NomadIcon name="users" size={s(12)} color={colors.textFaint} strokeWidth={1.2} />
                  <Text style={st.emptyText}>
                    {tab === 'followers' ? 'No followers yet' : 'Not following anyone'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    flex: 1,
    backgroundColor: c.card,
    borderTopLeftRadius: s(10),
    borderTopRightRadius: s(10),
  },
  handle: {
    width: s(16),
    height: s(1.5),
    borderRadius: s(1),
    backgroundColor: c.pill,
    alignSelf: 'center',
    marginTop: s(4),
    marginBottom: s(2),
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: c.pill,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(4),
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: c.dark,
  },
  tabCount: {
    fontSize: s(7),
    fontWeight: '800' as any,
    color: c.textMuted,
  },
  tabCountActive: {
    color: c.dark,
  },
  tabLabel: {
    fontSize: s(4.5),
    fontWeight: '500' as any,
    color: c.textMuted,
    marginTop: s(0.5),
  },
  tabLabelActive: {
    color: c.dark,
  },

  /* List */
  listContent: {
    paddingHorizontal: s(6),
    paddingTop: s(3),
    paddingBottom: s(10),
  },
  separator: {
    height: 0.5,
    backgroundColor: c.pill,
    marginLeft: s(18),
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(4),
  },
  avWrap: {},
  avImg: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
  },
  avFallback: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avTxt: {
    color: 'white',
    fontSize: s(6),
    fontWeight: '700' as any,
  },
  infoCol: { flex: 1 },
  userName: {
    fontSize: s(5.5),
    fontWeight: '700' as any,
    color: c.dark,
  },
  userBio: {
    fontSize: s(4.5),
    color: c.textSec,
    marginTop: s(0.5),
  },

  /* Empty / Loading */
  loadingWrap: {
    paddingTop: s(20),
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: s(20),
    gap: s(4),
  },
  emptyText: {
    fontSize: s(5.5),
    color: c.textMuted,
  },
});
