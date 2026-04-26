import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder, Modal, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NomadIcon from './NomadIcon';
import type { NomadIconName } from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { supabase } from '../lib/supabase';

const { height: SH } = Dimensions.get('window');
const SHEET_H = SH * 0.65;

/* ─── Icon mapping per notification type ─── */
const TYPE_CONFIG = (colors: ThemeColors): Record<string, { icon: NomadIconName; color: string }> => ({
  chat_message:      { icon: 'chat', color: '#8B5CF6' },
  activity_nearby:   { icon: 'pin',        color: '#10B981' },
  activity_joined:   { icon: 'user-plus',      color: colors.accent },
  area_heating:      { icon: 'trending',    color: '#F59E0B' },
  profile_view:      { icon: 'eye',            color: '#6366F1' },
  dna_match:         { icon: 'heart',          color: '#EC4899' },
  flight_incoming:   { icon: 'navigation',     color: '#0EA5E9' },
  follow_new:        { icon: 'user-plus',      color: colors.primary },
  timer_expiring:    { icon: 'clock',          color: '#F97316' },
  activity_reminder: { icon: 'bell',           color: '#8B5CF6' },
});

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotifRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  color: string | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  metadata: any;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  onNavigate?: (screen: string, params: Record<string, any>) => void;
  /** Called once after the sheet's mark-all-as-read DB update lands.
   *  Lets the parent (HomeScreen) refetch its own useNotifications
   *  hook so the bell badge updates in lockstep with the per-row
   *  visual state in the sheet. Without this, the parent's badge
   *  count and the sheet's per-row "unread dot" drift apart. */
  onMarkedAllRead?: () => void;
}

export default function NotificationsSheet({ visible, onClose, userId, onNavigate, onMarkedAllRead }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as NotifRow[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [userId]);

  // Fetch on open
  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      fetchNotifications();

      // Mark all as read after a short delay so the user sees which
      // rows were unread before they're cleared. Pre-fix this only
      // updated the DB; the local rows kept their old `is_read=false`
      // and the parent's bell badge (driven by useNotifications)
      // didn't refetch — both read as "still unread" until the user
      // killed and reopened the sheet. Tester report 2026-04-26:
      // "עדין יש נקודה אדומה שהנוטיפיקיישן לא נקראה / וגם לא מופיע
      // לי סימון על הפעמון של נוטיפיקיישן". Now we update DB +
      // local state + tell the parent to refetch its hook in one
      // synchronized step so badge + per-row dot agree.
      const timer = setTimeout(async () => {
        const nowIso = new Date().toISOString();
        const { error: updErr } = await supabase
          .from('app_notifications')
          .update({ is_read: true, read_at: nowIso })
          .eq('user_id', userId)
          .eq('is_read', false);
        if (updErr) {
          console.warn('[NotificationsSheet] markAllRead failed:', updErr.message);
          return; // leave local state alone so we don't lie to the user
        }
        // 1) Patch the local list — per-row red dot disappears.
        setNotifications(prev =>
          prev.map(n => n.is_read ? n : { ...n, is_read: true, read_at: nowIso })
        );
        // 2) Tell the parent — bell badge in HomeScreen drops to 0.
        onMarkedAllRead?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, userId]);

  // Animation
  useEffect(() => {
    if (visible) {
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

  const handleNotifPress = (notif: NotifRow) => {
    onClose();
    if (!onNavigate) return;

    const meta = notif.metadata || {};
    switch (notif.type) {
      case 'chat_message':
        if (meta.conversationId) {
          onNavigate('Chat', { conversationId: meta.conversationId, title: meta.senderName || 'Chat' });
        }
        break;
      case 'profile_view':
      case 'follow_new':
      case 'dna_match':
      case 'flight_incoming':
        if (notif.entity_id || meta.userId) {
          onNavigate('UserProfile', { userId: notif.entity_id || meta.userId, name: meta.userName });
        }
        break;
      case 'activity_nearby':
      case 'activity_joined':
      case 'area_heating':
      case 'timer_expiring':
      case 'activity_reminder': {
        // Open Home with a focus param so the map centres on the
        // activity's pin and pops the TimerBubble for it. Pre-fix
        // this case was an empty `break;` — the comment said
        // "Go to home/map" but the code did nothing, producing a
        // dead-end button. Tester report 2026-04-26: "אבל זה לא
        // מכניס אותי לאירוע / לחיצה על הנוטיפיקיישן לא פותח לי
        // את האירוע". `entity_id` is set on every activity_* row
        // (the trigger writes NEW.id::text); `metadata.checkinId`
        // is a redundant fallback the trigger also fills.
        const checkinId = notif.entity_id || meta.checkinId;
        if (checkinId) {
          // Date.now() nonce ensures HomeScreen's useEffect
          // re-fires even if the user was already on Home and
          // had previously focused the same pin — same pattern
          // as the openCreate deep-link in HomeScreen.
          onNavigate('Home', { focusCheckinId: checkinId, focusNonce: Date.now() });
        } else {
          // No id we can navigate to — at least take them to the
          // map. Falling through to plain Home is still better
          // than the previous empty break (which closed the sheet
          // and stranded them on whatever screen was behind it).
          onNavigate('Home', {});
        }
        break;
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={[st.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + s(6) }]} {...panResponder.panHandlers}>
          <TouchableOpacity activeOpacity={1}>
            <View style={st.handle} />
            <View style={st.header}>
              <Text style={st.title}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            {loading ? (
              <View style={st.center}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={st.center}>
                <NomadIcon name="bell" size={s(16)} color="#CBD5E1" strokeWidth={1.8} />
                <Text style={st.emptyText}>No notifications yet</Text>
                <Text style={st.emptySubtext}>When something happens, you'll see it here</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: SHEET_H - s(50) }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              >
                {notifications.map((n) => {
                  const config = TYPE_CONFIG(colors)[n.type] || { icon: 'bell', color: '#64748B' };
                  const iconName = (n.icon as NomadIconName) || config.icon;
                  const iconColor = n.color || config.color;

                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[st.notifRow, !n.is_read && st.notifUnread]}
                      activeOpacity={0.7}
                      onPress={() => handleNotifPress(n)}
                    >
                      <View style={[st.notifIcon, { backgroundColor: iconColor + '18' }]}>
                        <NomadIcon name={iconName} size={s(6)} color={iconColor} strokeWidth={1.4} />
                      </View>
                      <View style={st.notifInfo}>
                        <Text style={[st.notifText, !n.is_read && st.notifTextUnread]} numberOfLines={2}>
                          {n.title}
                        </Text>
                        {n.body ? (
                          <Text style={st.notifBody} numberOfLines={1}>{n.body}</Text>
                        ) : null}
                        <Text style={st.notifTime}>{getTimeAgo(n.created_at)}</Text>
                      </View>
                      {!n.is_read && <View style={st.unreadDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    height: SHEET_H, backgroundColor: c.card,
    borderTopLeftRadius: s(14), borderTopRightRadius: s(14),
    paddingHorizontal: s(12), paddingTop: s(6),
  },
  handle: { width: s(20), height: s(2), borderRadius: s(1), backgroundColor: c.pill, alignSelf: 'center', marginBottom: s(8) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: s(8), gap: s(4) },
  title: { fontSize: s(10), fontWeight: FW.extra, color: c.dark },
  badge: {
    backgroundColor: c.primary, borderRadius: s(5),
    paddingHorizontal: s(4), paddingVertical: s(1),
    minWidth: s(10), alignItems: 'center',
  },
  badgeText: { fontSize: s(5), fontWeight: FW.bold, color: 'white' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: s(30) },
  emptyText: { fontSize: s(7), fontWeight: FW.medium, color: '#94A3B8', marginTop: s(6) },
  emptySubtext: { fontSize: s(5.5), color: '#CBD5E1', marginTop: s(2) },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(7),
    paddingVertical: s(6), borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  notifUnread: {
    backgroundColor: c.warnSurface,
    marginHorizontal: -s(4),
    paddingHorizontal: s(4),
    borderRadius: s(4),
  },
  notifIcon: {
    width: s(18), height: s(18), borderRadius: s(9),
    alignItems: 'center', justifyContent: 'center',
  },
  notifInfo: { flex: 1 },
  notifText: { fontSize: s(6), fontWeight: FW.medium, color: c.dark, lineHeight: s(9) },
  notifTextUnread: { fontWeight: FW.bold },
  notifBody: { fontSize: s(5.5), color: c.textMuted, marginTop: s(1), lineHeight: s(8) },
  notifTime: { fontSize: s(5), color: c.textMuted, marginTop: s(1) },
  unreadDot: {
    width: s(4), height: s(4), borderRadius: s(2),
    backgroundColor: c.primary,
  },
});
