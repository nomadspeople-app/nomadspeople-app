import { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, Image, Modal, Alert,
  FlatList, TextInput, KeyboardAvoidingView, Platform, Share,
  PanResponder, Switch,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList } from '../lib/types';
import { useProfile, useFollow, usePhotoPosts, usePhotoLike, usePhotoComments, createOrJoinStatusChat, createOrFindDM, calcAge, getZodiac, blockUser, type FollowerPreview } from '../lib/hooks';
import { AuthContext, useAuthContext } from '../App';
import type { PhotoPost } from '../lib/hooks';
import { pickAndUploadAvatar, pickAndUploadPostImage } from '../lib/imagePicker';
import { supabase } from '../lib/supabase';
import { trackProfileView } from '../lib/tracking';
import StatusCreationFlow, { type ActivityData } from '../components/StatusCreationFlow';
import FlightRouteStrip from '../components/profile/FlightRouteStrip';
import NextDestinationSection from '../components/profile/NextDestinationSection';
import TripManagerSheet from '../components/TripManagerSheet';
import MyWorkSection from '../components/profile/MyWorkSection';
import PhotoMomentsSection from '../components/profile/PhotoMomentsSection';
import { useI18n } from '../lib/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W } = Dimensions.get('window');


/* ─── Helpers ─── */
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function avatarColor(str: string): string {
  const colors = ['#E8614D', '#8B5CF6', '#34A853', '#F59E0B', '#2A9D8F', '#EC4899', '#6366F1', '#F97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ─── Frame color options (pastel / subtle) ─── */
const FRAME_OPTIONS: { key: string; label: string; color: string | null; colors?: string[] }[] = [
  { key: 'red',     label: 'Red',        color: '#E8A0A3' },
  { key: 'white',   label: 'White',      color: '#E8E6E0' },
  { key: 'pride',   label: 'Pride',      color: null, colors: ['#E8A0A3', '#E8C8A0', '#E8E0A0', '#A0E8B0', '#A0C0E8', '#C8A0E8'] },
  { key: 'pink',    label: 'Pink',       color: '#E8B0C8' },
  { key: 'none',    label: 'None',       color: 'transparent' },
];

/* ─── Mock data (fallback) ─── */
/* ─── All tag options for featured display ─── */
const TAG_EMOJI_MAP: Record<string, string> = {
  'Digital Nomad': '💻', 'Remote Worker': '🏠', 'Startup Founder': '🚀',
  'Freelancer': '✍️', 'Expat': '🌍', 'Traveler': '🎒',
  'Co-working': '💻', 'Cafe Work': '☕', 'Fast WiFi': '📡', 'Networking': '🤝',
  'Nightlife': '🍻', 'Events': '🎉', 'Food & Drinks': '🍽️', 'Meetups': '💬',
  'Surfing': '🏄', 'Hiking': '🥾', 'Cycling': '🚴', 'Yoga': '🧘',
  'Photography': '📸', 'Music': '🎵', 'Reading': '📚', 'Wellness': '🌱',
  'Friends': '👋', 'Travel Buddies': '🧳', 'Work Partners': '💼',
  'Dating': '❤️', 'Roommates': '🏠',
};

const PROFILE = {
  initials: 'NP',
  username: 'nomadspeople',
  displayName: 'NomadsPeople',
  creatorTag: true,
  bio: 'Your neighborhood-level intelligence platform\nFind YOUR neighborhood, not just a city\nWhere nomads like you actually live',
  website: 'nomadspeople.com',
  mutualFollowers: ['Tom', 'Sarah'],
  mutualExtra: 184,
  activeEvent: {
    title: 'Morning Work @ Mindspace TLV',
    date: 'Mar 20',
    time: '09:00',
    joined: 12,
  },
};

/* ═══════════════════════════════════════════
   COMMENT SHEET (reused in feed mode)
   ═══════════════════════════════════════════ */
function CommentSheet({
  postId, visible, onClose, colors, commentStyles,
}: {
  postId: string;
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  commentStyles: ReturnType<typeof makeCommentStyles>;
}) {
  const { userId } = useContext(AuthContext);
  const { comments, loading, addComment } = usePhotoComments(postId);
  const [text, setText] = useState('');
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const handleSend = async () => {
    if (!text.trim() || !userId) return;
    await addComment(userId, text.trim());
    setText('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={commentStyles.overlay}>
        <TouchableOpacity style={commentStyles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[commentStyles.content, { paddingBottom: insets.bottom }]}
        >
          <View style={commentStyles.handle} />
          <Text style={commentStyles.title}>{t('profile.comments')}</Text>
          <ScrollView style={commentStyles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: s(10) }} />
            ) : comments.length === 0 ? (
              <Text style={commentStyles.empty}>{t('profile.noComments')}</Text>
            ) : comments.map((c) => (
              <View key={c.id} style={commentStyles.row}>
                <View style={[commentStyles.av, { backgroundColor: avatarColor(c.user_id) }]}>
                  <Text style={commentStyles.avText}>{(c.author?.full_name ?? '?')[0]}</Text>
                </View>
                <View style={commentStyles.body}>
                  <Text style={commentStyles.name}>{c.author?.full_name ?? 'Unknown'}</Text>
                  <Text style={commentStyles.text}>{c.content}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={commentStyles.inputRow}>
            <TextInput
              style={commentStyles.input}
              placeholder={t('profile.addComment')}
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity onPress={handleSend} style={commentStyles.sendBtn}>
              <NomadIcon name="send" size={s(8)} color={text.trim() ? colors.primary : colors.textFaint} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   INLINE PHOTO POST CARD (used in feed mode)
   ═══════════════════════════════════════════ */
function InlinePhotoCard({
  post, authorName, onLike, onComment, onShare, colors, feedStyles,
}: {
  post: PhotoPost;
  authorName: string;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  colors: ThemeColors;
  feedStyles: ReturnType<typeof makeFeedStyles>;
}) {
  const [activePhoto, setActivePhoto] = useState(0);

  return (
    <View style={feedStyles.postCard}>
      {/* Horizontal photo swipe */}
      <FlatList
        data={post.photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setActivePhoto(idx);
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image source={{ uri: item.image_url }} style={feedStyles.photo} resizeMode="cover" />
        )}
      />

      {/* Dots */}
      {post.photos.length > 1 && (
        <View style={feedStyles.dotsRow}>
          {post.photos.map((_, i) => (
            <View key={i} style={[feedStyles.dot, activePhoto === i && feedStyles.dotActive]} />
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={feedStyles.actionsRow}>
        <TouchableOpacity onPress={onLike} style={feedStyles.actionBtn}>
          <NomadIcon name={post.liked_by_me ? 'heart-filled' : 'heart'} size={s(10)} color={post.liked_by_me ? colors.primary : colors.dark} strokeWidth={1.8} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onComment} style={feedStyles.actionBtn}>
          <NomadIcon name="chat" size={s(10)} color={colors.dark} strokeWidth={1.8} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} style={feedStyles.actionBtn}>
          <NomadIcon name="send" size={s(9)} color={colors.dark} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={feedStyles.infoArea}>
        <Text style={feedStyles.likesText}>
          {post.likes_count} like{post.likes_count !== 1 ? 's' : ''}
        </Text>
        {post.caption && (
          <Text style={feedStyles.caption}>
            <Text style={feedStyles.captionBold}>{authorName} </Text>
            {post.caption}
          </Text>
        )}
        {post.comment_count > 0 && (
          <TouchableOpacity onPress={onComment}>
            <Text style={feedStyles.viewComments}>
              View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={feedStyles.postTime}>{timeAgo(post.created_at)}</Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════
   MAIN PROFILE SCREEN
   ═══════════════════════════════════════════ */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'UserProfile'>>();
  const { userId: myUserId, signOut } = useAuthContext();
  const { toggle: toggleLike } = usePhotoLike();
  const { colors } = useTheme();
  const { t } = useI18n();

  const styles = useMemo(() => makeStyles(colors), [colors]);
  const feedStyles = useMemo(() => makeFeedStyles(colors), [colors]);
  const commentStyles = useMemo(() => makeCommentStyles(colors), [colors]);
  const aiStyles = useMemo(() => makeAiStyles(colors), [colors]);

  const routeUserId = (route.params as any)?.userId as string | undefined;
  const profileUserId = routeUserId || myUserId;
  const isOwner = !routeUserId || routeUserId === myUserId;
  const cameViaLink = !!routeUserId; // true = navigated here via link, needs back button

  const { profile, stats, followerPreviews, loading, refetch } = useProfile(profileUserId);
  const { toggle: toggleFollow, isFollowing: checkFollowing } = useFollow(myUserId);
  const { posts: photoPosts, loading: photosLoading } = usePhotoPosts(profileUserId, myUserId);
  const [isFollowing, setIsFollowing] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);
  const [reportingUser, setReportingUser] = useState(false);

  // View mode: 'grid' or 'feed'
  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('grid');
  const [feedStartIndex, setFeedStartIndex] = useState(0);
  const [localPosts, setLocalPosts] = useState<PhotoPost[]>([]);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  // ScrollView ref for scrolling to feed position
  const scrollRef = useRef<ScrollView>(null);
  // Track where the tabs section starts (to scroll right to the feed)
  const [tabsY, setTabsY] = useState(0);

  // Frame state
  const [frameKey, setFrameKey] = useState<string>('red');
  const [showFramePicker, setShowFramePicker] = useState(false);

  // Publishing activity state (prevent double-click)
  const [publishing, setPublishing] = useState(false);

  // Inline bio editor
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState('');
  const bioInputRef = useRef<TextInput>(null);

  // Swipe-right to go back to grid (feed mode only)
  // No translateX animation — just detect the gesture and switch mode
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture horizontal right swipes
        return gs.dx > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2;
      },
      onPanResponderRelease: (_, gs) => {
        // If swiped right far enough or fast enough → back to grid
        if (gs.dx > 80 || gs.vx > 0.4) {
          setViewMode('grid');
        }
      },
    })
  ).current;

  // Sync local posts
  useEffect(() => {
    setLocalPosts(photoPosts);
  }, [photoPosts]);

  // Sync follow state
  useEffect(() => {
    if (profileUserId && myUserId && profileUserId !== myUserId) {
      setIsFollowing(checkFollowing(profileUserId));
    }
  }, [profileUserId, myUserId, checkFollowing]);

  // When switching to feed, scroll to tabs area so the feed is visible
  useEffect(() => {
    if (viewMode === 'feed' && tabsY > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: tabsY, animated: true });
      }, 50);
    }
  }, [viewMode, tabsY]);

  // Refetch profile EVERY time screen gains focus (e.g. returning from Settings, after onboarding)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Track profile view when viewing another user's profile
  useEffect(() => {
    if (!isOwner && myUserId && profileUserId) {
      trackProfileView(myUserId, profileUserId);
    }
  }, [profileUserId, myUserId, isOwner]);

  /* ─── Avatar upload ─── */
  const [avatarUploading, setAvatarUploading] = useState(false);
  const handleAvatarPress = async () => {
    if (!isOwner || !myUserId) return;
    setAvatarUploading(true);
    try {
      const url = await pickAndUploadAvatar(myUserId);
      if (url) {
        await supabase
          .from('app_profiles')
          .update({ avatar_url: url })
          .eq('user_id', myUserId);
        refetch();
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  /* ─── Inline bio save ─── */
  const handleBioSave = async () => {
    if (!myUserId) return;
    const trimmed = bioText.trim();
    await supabase
      .from('app_profiles')
      .update({ bio: trimmed || null })
      .eq('user_id', myUserId);
    setEditingBio(false);
    refetch();
  };

  const handleBioOpen = () => {
    setBioText(profile?.bio || '');
    setEditingBio(true);
    setTimeout(() => bioInputRef.current?.focus(), 100);
  };

  /* ─── Post image upload (grid tab +) ─── */
  const [uploading, setUploading] = useState(false);
  const handleNewPost = async () => {
    if (!myUserId) return;
    setUploading(true);
    try {
      const url = await pickAndUploadPostImage(myUserId);
      if (url) {
        // Create photo post
        const { data: postData } = await supabase
          .from('app_photo_posts')
          .insert({
            user_id: myUserId,
            caption: '',
            city: profile?.current_city || null,
          })
          .select()
          .single();

        if (postData) {
          // Add photo to the post
          await supabase.from('app_photos').insert({
            post_id: postData.id,
            image_url: url,
            sort_order: 0,
          });
        }
        refetch();
      }
    } finally {
      setUploading(false);
    }
  };

  /* ─── Status / Activity creation flow ─── */
  const [showStatusFlow, setShowStatusFlow] = useState(false);

  /* ─── Active checkins (user can have status + timer at same time) ─── */
  const [activeStatus, setActiveStatus] = useState<any>(null);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const activeCheckin = activeStatus || activeTimer; // backward compat: first non-null
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [checkinRefreshKey, setCheckinRefreshKey] = useState(0);
  const [showActivityInfo, setShowActivityInfo] = useState(false);
  const [showTripManager, setShowTripManager] = useState(false);
  const [tripMeta, setTripMeta] = useState<{ tripVibe: string | null; tripCompanion: string | null }>({ tripVibe: null, tripCompanion: null });
  const [editCheckin, setEditCheckin] = useState<any>(null);
  const [editPrivate, setEditPrivate] = useState(false);
  const [editMuted, setEditMuted] = useState(false);

  // Inline pickers for Activity Info editing
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [editHour, setEditHour] = useState(12);
  const [editMinute, setEditMinute] = useState(0);
  const [editDay, setEditDay] = useState(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<{ name: string; sub: string; lat: number; lng: number }[]>([]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build next 7 days for date picker
  const EDIT_DAYS = useRef((() => {
    const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const out: { label: string; num: string; date: Date; full: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      out.push({
        label: i === 0 ? 'today' : names[d.getDay()],
        num: `${d.getDate()}`,
        date: d,
        full: d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
    return out;
  })()).current;
  const EDIT_HOURS = Array.from({ length: 24 }, (_, i) => i);
  const EDIT_MINUTES = [0, 15, 30, 45];
  const fmtTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const fetchActiveCheckin = useCallback(async () => {
    if (!profileUserId) return;
    const { data, error } = await supabase
      .from('app_checkins')
      .select('id, user_id, city, checkin_type, status_text, status_emoji, category, activity_text, location_name, latitude, longitude, member_count, is_active, checked_in_at, expires_at')
      .eq('user_id', profileUserId)
      .eq('is_active', true)
      .order('checked_in_at', { ascending: false });
    if (error) console.error('Error fetching active checkins:', error);
    const items = data || [];
    setActiveStatus(items.find((c: any) => c.checkin_type === 'status') || null);
    setActiveTimer(items.find((c: any) => c.checkin_type === 'timer') || null);
  }, [profileUserId]);

  useEffect(() => {
    fetchActiveCheckin();
  }, [profileUserId, showStatusFlow, checkinRefreshKey]);

  // Also refresh when the screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      fetchActiveCheckin();
    }, [fetchActiveCheckin])
  );

  const handlePublishActivity = async (data: ActivityData) => {
    if (!myUserId || publishing) return;
    setPublishing(true);
    try {
      // Expire only active STATUS checkins (keep timers alive)
      const { error: updateErr } = await supabase
        .from('app_checkins')
        .update({ is_active: false })
        .eq('user_id', myUserId)
        .eq('is_active', true)
        .eq('checkin_type', 'status');

      if (updateErr) console.error('Error expiring old checkin:', updateErr);

      // Insert new activity checkin — always public (user chose to post)
      const { data: newCheckin, error: insertErr } = await supabase.from('app_checkins').insert({
        user_id: myUserId,
        city: profile?.current_city || 'Unknown',
        checkin_type: 'status',
        status_text: data.activityText,
        status_emoji: data.emoji,
        category: data.category,
        activity_text: data.activityText,
        location_name: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        scheduled_for: data.scheduledFor?.toISOString() ?? null,
        is_flexible_time: data.isFlexibleTime,
        is_open: data.isOpen,
        visibility: 'public',
        is_active: true,
        member_count: 1,
        age_min: data.ageMin,
        age_max: data.ageMax,
      }).select('id').single();

      if (insertErr) {
        console.error('Error creating checkin:', insertErr);
        return;
      }

      // Auto-create group chat with all activity metadata
      const { conversationId } = await createOrJoinStatusChat(
        myUserId,
        myUserId,
        data.activityText,
        {
          emoji: data.emoji,
          category: data.category,
          activityText: data.activityText,
          locationName: data.locationName,
          latitude: data.latitude,
          longitude: data.longitude,
          isGeneralArea: data.isGeneralArea,
          scheduledFor: data.scheduledFor?.toISOString() ?? null,
          isOpen: data.isOpen,
          checkinId: newCheckin?.id || undefined,
        },
      );

      // Refresh profile + active checkin, then navigate to Home with popup
      setShowStatusFlow(false);
      setTimeout(() => {
        refetch();
        setCheckinRefreshKey(k => k + 1); // force re-fetch active checkin
        nav.navigate('Home' as any, {
          newActivity: { text: data.activityText, emoji: data.emoji, category: data.category },
        });
      }, 200);
    } catch (err) {
      console.error('Unexpected error publishing activity:', err);
    } finally {
      setPublishing(false);
    }
  };

  // Derive display values
  const displayName = profile?.display_name || profile?.full_name || profile?.username || 'Nomad';
  const username = profile?.username || 'nomad';
  const bio = profile?.bio || '';
  const website = profile?.website_url || '';
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isCreator = profile?.creator_tag ?? false;
  const age = calcAge(profile?.birth_date);
  const zodiac = getZodiac(profile?.birth_date);

  const handleFollow = async () => {
    if (!profileUserId || !myUserId) return;
    await toggleFollow(profileUserId);
    setIsFollowing(!isFollowing);
  };

  const handleMessage = async () => {
    if (!myUserId || !profileUserId || messageSending) return;
    setMessageSending(true);
    try {
      const { conversationId, error } = await createOrFindDM(myUserId, profileUserId);
      if (error === 'blocked') {
        Alert.alert('Blocked', 'You cannot message this user.');
        return;
      }
      if (!conversationId) {
        console.warn('[handleMessage] no conversationId, error:', error);
        return;
      }
      nav.navigate('Chat', {
        conversationId,
        title: displayName,
        avatarColor: colors.primary,
        avatarText: initials,
      });
    } finally {
      setMessageSending(false);
    }
  };

  const handleBlock = async () => {
    if (!myUserId || !profileUserId) return;
    setBlockingUser(true);
    try {
      const { error } = await blockUser(myUserId, profileUserId);
      if (error) {
        Alert.alert('Error', 'Failed to block user');
        return;
      }
      Alert.alert('Blocked', `You have blocked ${displayName}`, [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back after blocking
            if (cameViaLink) {
              nav.goBack();
            }
          },
        },
      ]);
    } finally {
      setBlockingUser(false);
    }
  };

  const showReportOptions = () => {
    const reasons = ['Spam', 'Inappropriate content', 'Harassment', 'Other'];
    Alert.alert(
      'Report User',
      'Please select a reason',
      [
        ...reasons.map((reason) => ({
          text: reason,
          onPress: () => handleReport(reason),
        })),
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
      ]
    );
  };

  const handleReport = async (reason: string) => {
    if (!myUserId || !profileUserId) return;
    setReportingUser(true);
    try {
      const { error } = await supabase.from('app_reports').insert({
        user_id: myUserId,
        reported_user_id: profileUserId,
        reason,
      });
      if (error) {
        Alert.alert('Error', 'Failed to report user');
        return;
      }
      Alert.alert('Report Submitted', 'Thank you for reporting this user. We will review it shortly.');
    } finally {
      setReportingUser(false);
    }
  };

  const showMoreOptions = () => {
    Alert.alert(
      'More Options',
      '',
      [
        {
          text: 'Block User',
          onPress: handleBlock,
          style: 'destructive',
        },
        {
          text: 'Report User',
          onPress: showReportOptions,
          style: 'destructive',
        },
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
      ]
    );
  };

  const handleAddPlace = async (place: { city: string; country: string; lat: number; lng: number; year?: number }) => {
    if (!profileUserId) return;
    const current = (profile as any)?.visited_places || [];
    const updated = [...current, place];
    await supabase
      .from('app_profiles')
      .update({ visited_places: updated })
      .eq('user_id', profileUserId);
    refetch();
  };

  const handlePhotoTap = (postIdx: number) => {
    setFeedStartIndex(postIdx);
    setViewMode('feed');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
  };

  const handleLike = useCallback(async (postId: string, isLiked: boolean) => {
    if (!myUserId) return;
    await toggleLike(postId, myUserId, isLiked);
    setLocalPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
        : p
    ));
  }, [myUserId, toggleLike]);

  const handleShare = useCallback(async (caption?: string | null) => {
    try {
      await Share.share({ message: caption ? `${caption} — NomadsPeople` : 'Check this out on NomadsPeople!' });
    } catch {}
  }, []);

  const screenW = Dimensions.get('window').width;
  const cellSize = (screenW - s(1) * 2) / 3;

  const currentFrame = FRAME_OPTIONS.find(f => f.key === frameKey) || FRAME_OPTIONS[0];

  // Reorder posts for feed view: tapped post first, then remaining
  const feedPosts = viewMode === 'feed'
    ? [...localPosts.slice(feedStartIndex), ...localPosts.slice(0, feedStartIndex)]
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>

      {/* ─── Header ─── */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.borderSoft }]}>
        {/* Left: back button (only when not on own grid) */}
        {viewMode === 'feed' ? (
          <TouchableOpacity style={styles.hdrBtnDark} activeOpacity={0.7} onPress={handleBackToGrid} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <NomadIcon name="back" size={s(9)} color="#1A1A1A" strokeWidth={1.8} />
          </TouchableOpacity>
        ) : (!isOwner || cameViaLink) ? (
          <TouchableOpacity style={styles.hdrBtnDark} activeOpacity={0.7} onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <NomadIcon name="back" size={s(9)} color="#1A1A1A" strokeWidth={1.8} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: s(22) }} />
        )}

        <Text style={[styles.hdrName, { color: colors.dark }]}>{username}</Text>

        {/* Right: share + settings (owner) or dots (visitor) */}
        <View style={styles.hdrRight}>
          {isOwner && viewMode === 'grid' && (
            <>
              <TouchableOpacity
                style={styles.hdrBtnDark}
                activeOpacity={0.7}
                onPress={() => Share.share({ message: `Check out ${username} on NomadsPeople!` }).catch(() => {})}
              >
                <NomadIcon name="share" size={s(7)} color="#1A1A1A" strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.hdrBtnDark} activeOpacity={0.7} onPress={() => nav.navigate('Settings' as any)}>
                <NomadIcon name="settings" size={s(7)} color="#1A1A1A" strokeWidth={1.8} />
              </TouchableOpacity>
            </>
          )}
          {!isOwner && viewMode === 'grid' && (
            <TouchableOpacity
              style={styles.hdrBtnDark}
              activeOpacity={0.7}
              onPress={() => Share.share({ message: `Check out ${username} on NomadsPeople!` }).catch(() => {})}
            >
              <NomadIcon name="dots" size={s(6)} color="#1A1A1A" strokeWidth={1.4} />
            </TouchableOpacity>
          )}
          {viewMode === 'feed' && <View style={{ width: s(22) }} />}
        </View>
      </View>

      <ScrollView ref={scrollRef} style={[styles.scrollArea, { backgroundColor: colors.card }]} showsVerticalScrollIndicator={false}>

        {/* ─── Avatar + Status Button + Name + Badge + Bio (centered, compact) ─── */}
        <View style={styles.profTop}>
          <View style={styles.avWrapper}>
            <TouchableOpacity
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={isOwner ? handleAvatarPress : undefined}
              onLongPress={isOwner ? () => setShowFramePicker(true) : undefined}
              disabled={avatarUploading}
            >
              <View style={[
                styles.avRing,
                currentFrame.color === 'transparent'
                  ? { backgroundColor: 'transparent', borderWidth: 0 }
                  : currentFrame.colors
                    ? { backgroundColor: currentFrame.colors[0] }
                    : { backgroundColor: currentFrame.color || colors.primary }
              ]}>
                <View style={styles.avInner}>
                  {avatarUploading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avText}>{initials}</Text>
                  )}
                </View>
              </View>
              {isOwner && !avatarUploading && (
                <View style={[styles.cameraIconOverlay, { backgroundColor: colors.primary }]}>
                  <NomadIcon name="camera" size={s(7)} color={colors.white} strokeWidth={1.4} />
                </View>
              )}
            </TouchableOpacity>
            {/* Status button removed — now on HomeScreen map as green FAB */}
          </View>
          {/* ── 1. Name + Creator badge ── */}
          <Text style={[styles.displayName, { color: colors.dark }]}>{displayName}</Text>
          {isCreator && (
            <View style={styles.creatorBadge}>
              <NomadIcon name="star" size={s(4.5)} color={colors.primary} strokeWidth={1.4} />
              <Text style={styles.creatorText}>{t('profile.official')}</Text>
            </View>
          )}

          {/* ── 1b. Age + Zodiac ── */}
          {(age || zodiac) && (
            <View style={styles.ageZodiacRow}>
              {age && <Text style={styles.ageZodiacText}>{age}</Text>}
              {age && zodiac && <Text style={styles.ageZodiacDot}> · </Text>}
              {zodiac && <Text style={styles.ageZodiacText}>{zodiac.symbol} {zodiac.name}</Text>}
            </View>
          )}

          {/* ── 2. Location badge (city only — job is in MyWork section) ── */}
          {profile?.current_city && (
            <View style={styles.locationBadge}>
              <NomadIcon name="pin" size={s(3.5)} color={colors.textMuted} strokeWidth={1.4} />
              <Text style={styles.locationText}>{profile.current_city}</Text>
            </View>
          )}

          {/* ── 3. Checked-in indicator ── */}
          {(activeStatus || activeTimer) && (
            <View style={styles.checkedInRow}>
              <View style={styles.checkedInDot} />
              <Text style={styles.checkedInText}>{t('profile.checkedInAt', { location: (activeStatus || activeTimer).city || (activeStatus || activeTimer).location_name })}</Text>
            </View>
          )}

          {/* ── 4. Bio or "Build your bio" inline editor ── */}
          {editingBio ? (
            <View style={styles.bioEditWrap}>
              <TextInput
                ref={bioInputRef}
                style={styles.bioInput}
                value={bioText}
                onChangeText={setBioText}
                placeholder={t('profile.bioPlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                maxLength={150}
                autoFocus
              />
              <View style={styles.bioEditActions}>
                <TouchableOpacity onPress={() => setEditingBio(false)} style={styles.bioEditCancel}>
                  <Text style={styles.bioEditCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBioSave} style={styles.bioEditSave}>
                  <Text style={styles.bioEditSaveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : bio ? (
            <TouchableOpacity activeOpacity={isOwner ? 0.7 : 1} onPress={isOwner ? handleBioOpen : undefined} style={styles.bioRow}>
              <Text style={[styles.bioText, { color: colors.textSec }]}>{bio}</Text>
              {isOwner && <NomadIcon name="edit" size={s(4)} color={colors.textFaint} strokeWidth={1.4} />}
            </TouchableOpacity>
          ) : isOwner ? (
            <TouchableOpacity style={styles.buildBioBtn} activeOpacity={0.7} onPress={handleBioOpen}>
              <NomadIcon name="edit" size={s(5)} color={colors.primary} strokeWidth={1.4} />
              <Text style={styles.buildBioText}>{t('profile.buildBio')}</Text>
            </TouchableOpacity>
          ) : null}
          {website ? (
            <View style={styles.bioLinkRow}>
              <NomadIcon name="link" size={s(4.5)} color={colors.accent} strokeWidth={1.4} />
              <Text style={styles.bioLink}>{website}</Text>
            </View>
          ) : null}

          {/* ── 5. Featured Tags (up to 4) ── */}
          {(profile?.featured_tags ?? []).length > 0 && (
            <View style={styles.featuredRow}>
              {(profile?.featured_tags ?? []).slice(0, 4).map((tag) => (
                <View key={tag} style={styles.featuredChip}>
                  <Text style={styles.featuredEmoji}>{TAG_EMOJI_MAP[tag] || '✨'}</Text>
                  <Text style={styles.featuredLabel}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── 6. Followed by — only if followers exist, capped at 100 ── */}
          {stats.followers > 0 && (
            <View style={styles.followedByRow}>
              <View style={styles.followedByAvatars}>
                {followerPreviews.slice(0, 3).map((f, i) => (
                  <View key={f.user_id} style={[styles.followedByAvWrap, { marginLeft: i === 0 ? 0 : -s(3.5), zIndex: 3 - i }]}>
                    {f.avatar_url ? (
                      <Image source={{ uri: f.avatar_url }} style={styles.followedByAvImg} />
                    ) : (
                      <View style={[styles.followedByAvFallback, { backgroundColor: avatarColor(f.user_id) }]}>
                        <Text style={styles.followedByAvText}>{(f.full_name ?? '?')[0]}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <Text style={[styles.followedByText, { color: colors.textSec }]} numberOfLines={2}>
                {t('profile.followedBy')}{' '}
                {followerPreviews.slice(0, 2).map((f, i) => (
                  <Text key={f.user_id} style={styles.followedByName}>
                    {f.full_name || f.username || 'Someone'}
                    {i === 0 && followerPreviews.length > 1 ? ', ' : ''}
                  </Text>
                ))}
                {stats.followers > 2 && (
                  <Text>
                    {' '}{t('profile.andOthers', { count: Math.min(stats.followers - 2, 98) })}
                  </Text>
                )}
              </Text>
            </View>
          )}
        </View>

        {/* ─── Active Events (status + timer shown separately) ─── */}
        {[activeStatus, activeTimer].filter(Boolean).map((checkin: any) => {
          const isTimerType = checkin.checkin_type === 'timer';
          const accentColor = isTimerType ? '#FF6B6B' : '#4ADE80';
          const bgColor = isTimerType ? 'rgba(255,107,107,0.1)' : 'rgba(74,222,128,0.1)';
          const label = isTimerType ? 'Timer' : t('common.activeNow');
          const minsLeft = checkin.expires_at ? Math.max(0, Math.round((new Date(checkin.expires_at).getTime() - Date.now()) / 60000)) : null;

          return (
            <TouchableOpacity
              key={checkin.id}
              style={styles.activeEvent}
              activeOpacity={isOwner ? 0.7 : 1}
              onPress={() => {
                if (!isOwner) return;
                setEditCheckin(checkin);
                setEditPrivate(!checkin.is_open);
                setEditMuted(false);
                setShowActivityInfo(true);
              }}
            >
              <View style={[styles.aeIcon, { backgroundColor: bgColor, borderWidth: 2, borderColor: accentColor }]}>
                <Text style={{ fontSize: s(5.5) }}>{checkin.status_emoji || '📍'}</Text>
              </View>
              <View style={styles.aeInfo}>
                <View style={styles.aeTagRow}>
                  <View style={[styles.aeDot, { backgroundColor: accentColor }]} />
                  <Text style={styles.aeTag}>{label}</Text>
                  {isTimerType && minsLeft !== null && (
                    <Text style={[styles.aeTag, { color: '#FF6B6B', marginLeft: s(2) }]}>
                      {minsLeft < 60 ? `${minsLeft}m left` : `${Math.floor(minsLeft / 60)}h${minsLeft % 60}m left`}
                    </Text>
                  )}
                </View>
                <Text style={styles.aeTitle} numberOfLines={1}>{checkin.activity_text || checkin.status_text || 'Activity'}</Text>
                <Text style={styles.aeMeta}>
                  {checkin.location_name || checkin.city}
                  {checkin.member_count > 1 ? ` · ${checkin.member_count} joined` : ''}
                </Text>
              </View>
              {isOwner ? (
                <NomadIcon name="forward" size={s(7)} color={colors.textMuted} strokeWidth={1.6} />
              ) : (
                <TouchableOpacity
                  style={styles.aeBtn}
                  activeOpacity={0.7}
                  onPress={async () => {
                    if (!myUserId || !profileUserId) return;
                    const statusText = checkin.activity_text || checkin.status_text || 'Activity';
                    const { conversationId } = await createOrJoinStatusChat(myUserId, profileUserId, statusText);
                    if (conversationId) {
                      nav.navigate('Chat', {
                        conversationId,
                        title: statusText,
                        avatarColor: accentColor,
                        avatarText: (checkin.status_emoji || '📍'),
                        isGroup: true,
                      });
                    }
                  }}
                >
                  <Text style={styles.aeBtnText}>{t('common.join')}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {/* ─── Action Buttons (visitors only) ─── */}
        {!isOwner && (
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={[styles.abtn, isFollowing ? styles.abtnDefault : styles.abtnFollow]}
              onPress={handleFollow} activeOpacity={0.7}
            >
              <NomadIcon name="user-plus" size={s(7)} color={isFollowing ? colors.dark : 'white'} strokeWidth={1.6} />
              <Text style={[styles.abtnText, !isFollowing && styles.abtnTextWhite]}>
                {isFollowing ? t('common.following') : t('common.follow')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.abtn, styles.abtnDefault, messageSending && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={handleMessage}
              disabled={messageSending}
            >
              {messageSending ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <NomadIcon name="chat" size={s(7)} color="#1A1A1A" strokeWidth={1.6} />
              )}
              <Text style={styles.abtnText}>{t('common.message')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.abtn, styles.abtnDefault, (blockingUser || reportingUser) && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={showMoreOptions}
              disabled={blockingUser || reportingUser}
            >
              <NomadIcon name="more-vertical" size={s(7)} color="#1A1A1A" strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ STORY SECTIONS ═══ */}

        {/* ── Next Destination ── */}
        {(profile as any)?.next_destination ? (
          <NextDestinationSection
            destination={(profile as any)?.next_destination || null}
            date={(profile as any)?.next_destination_date || null}
            flag={(profile as any)?.next_destination_flag || null}
            isOwner={isOwner}
            onEdit={() => setShowTripManager(true)}
            onPress={async () => {
              if (isOwner) { setShowTripManager(true); return; }
              const dest = (profile as any)?.next_destination;
              if (!dest) return;
              const { data: fg } = await supabase
                .from('flight_groups')
                .select('id')
                .eq('country', dest)
                .maybeSingle();
              if (fg?.id) {
                nav.navigate('FlightDetail' as any, { flightGroupId: fg.id });
              }
            }}
          />
        ) : isOwner ? (
          <TouchableOpacity
            style={styles.addTripCard}
            onPress={() => setShowTripManager(true)}
            activeOpacity={0.7}
          >
            <View style={styles.addTripIconWrap}>
              <Text style={{ fontSize: s(10) }}>✈️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addTripTitle}>got a trip coming up?</Text>
              <Text style={styles.addTripSub}>let nomads know you're on the way</Text>
            </View>
            <NomadIcon name="plus" size={s(7)} color={colors.primary} strokeWidth={1.8} />
          </TouchableOpacity>
        ) : null}

        {/* ── Flight Route Strip — replaces passport stamps ── */}
        <FlightRouteStrip
          places={(profile as any)?.visited_places || []}
          isOwner={isOwner}
          onAddPlace={handleAddPlace}
          nextDestination={(profile as any)?.next_destination || null}
          nextDestinationFlag={(profile as any)?.next_destination_flag || null}
        />

        {/* ── My Work — hidden for visitors if nothing is filled ── */}
        {(isOwner || profile?.job_type || (profile as any)?.skills?.length || (profile as any)?.portfolio_url || profile?.website_url) && (
          <MyWorkSection
            jobType={profile?.job_type || null}
            skills={(profile as any)?.skills || null}
            openToWork={(profile as any)?.open_to_work || false}
            portfolioUrl={(profile as any)?.portfolio_url || null}
            websiteUrl={profile?.website_url || null}
            isOwner={isOwner}
            onSave={async (data) => {
              if (!profileUserId) return;
              const { error } = await supabase
                .from('app_profiles')
                .update(data)
                .eq('user_id', profileUserId);
              if (error) console.error('MyWork save error:', error);
              refetch();
            }}
          />
        )}

        {/* Photo Moments section removed — photos shown in grid below */}

        {/* ─── Groups empty state (owner only) ─── */}
        {isOwner && (
          <View style={styles.groupsEmptyRow}>
            <NomadIcon name="users" size={s(7)} color={colors.textFaint} strokeWidth={1.4} />
            <Text style={styles.groupsEmptyText}>{t('profile.noGroups')}</Text>
          </View>
        )}

        {/* ─── Content Tabs ─── */}
        <View
          style={styles.tabs}
          onLayout={(e) => setTabsY(e.nativeEvent.layout.y)}
        >
          <View style={styles.tab} />
          <TouchableOpacity
            style={[styles.tab, viewMode === 'grid' && styles.tabActive]}
            activeOpacity={0.7}
            onPress={handleBackToGrid}
          >
            <NomadIcon name="grid" size={s(7)} color={viewMode === 'grid' ? colors.dark : colors.textFaint} strokeWidth={1.4} />
          </TouchableOpacity>
          {isOwner ? (
            <TouchableOpacity style={styles.tab} activeOpacity={0.7} onPress={handleNewPost} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <NomadIcon name="plus" size={s(7)} color={colors.textFaint} strokeWidth={1.4} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.tab} />
          )}
        </View>

        {/* ═══ GRID MODE ═══ */}
        {viewMode === 'grid' && (
          <View style={styles.grid}>
            {photosLoading ? (
              <View style={{ width: screenW, paddingVertical: s(20), alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : localPosts.length === 0 ? (
              <View style={{ width: screenW, paddingVertical: s(20), alignItems: 'center' }}>
                <NomadIcon name="camera" size={s(14)} color={colors.textFaint} strokeWidth={1.2} />
                <Text style={{ fontSize: s(7), color: colors.textMuted, marginTop: s(4) }}>{t('profile.noPhotos')}</Text>
              </View>
            ) : localPosts.map((post, postIdx) => (
              <TouchableOpacity
                key={post.id}
                style={[styles.gcell, { width: cellSize, height: cellSize }]}
                activeOpacity={0.8}
                onPress={() => handlePhotoTap(postIdx)}
              >
                <Image
                  source={{ uri: post.photos[0]?.image_url }}
                  style={{ width: cellSize, height: cellSize }}
                  resizeMode="cover"
                />
                {post.photos.length > 1 && (
                  <View style={styles.multiIcon}>
                    <NomadIcon name="copy" size={s(5)} color="white" strokeWidth={1.4} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ═══ FEED MODE (inline, swipe-right to go back to grid) ═══ */}
        {viewMode === 'feed' && (
          <View
            {...panResponder.panHandlers}
          >
            {feedPosts.map((post) => (
              <InlinePhotoCard
                key={post.id}
                post={post}
                authorName={displayName}
                onLike={() => handleLike(post.id, post.liked_by_me)}
                onComment={() => setCommentPostId(post.id)}
                onShare={() => handleShare(post.caption)}
                colors={colors}
                feedStyles={feedStyles}
              />
            ))}
          </View>
        )}

        <View style={{ height: s(20) }} />
      </ScrollView>

      {/* ═══ STATUS / ACTIVITY CREATION FLOW ═══ */}
      <StatusCreationFlow
        visible={showStatusFlow}
        onClose={() => setShowStatusFlow(false)}
        onPublish={handlePublishActivity}
        userCity={profile?.current_city || 'Tel Aviv'}
        cityLat={32.0853}
        cityLng={34.7818}
      />

      {/* ═══ ACTIVITY INFO — full management sheet ═══ */}
      <Modal visible={showActivityInfo && !!editCheckin} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.card }}>
          {/* Header */}
          <View style={{ paddingTop: insets.top + s(4), paddingHorizontal: s(10), paddingBottom: s(4), flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.borderSoft }}>
            <TouchableOpacity onPress={() => setShowActivityInfo(false)} style={{ padding: s(2) }}>
              <NomadIcon name="back" size={s(9)} color={colors.dark} strokeWidth={1.8} />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: s(8), fontWeight: FW.bold, color: colors.dark }}>Activity Info</Text>
            <View style={{ width: s(13) }} />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + s(10) }}>
            {/* Emoji + Title + Members */}
            {editCheckin && (
              <View style={{ alignItems: 'center', paddingTop: s(12), paddingBottom: s(8) }}>
                <Text style={{ fontSize: s(20) }}>{editCheckin.status_emoji || '📍'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), marginTop: s(4) }}>
                  <Text style={{ fontSize: s(8), fontWeight: FW.bold, color: colors.dark }}>
                    {editCheckin.activity_text || editCheckin.status_text || 'Activity'}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    if (Alert.prompt) {
                      Alert.prompt('Edit Title', '', (text: string) => {
                        if (!text?.trim()) return;
                        supabase.from('app_checkins').update({ activity_text: text.trim(), status_text: text.trim() }).eq('id', editCheckin.id).then(() => {
                          setEditCheckin({ ...editCheckin, activity_text: text.trim(), status_text: text.trim() });
                          refetch();
                        });
                      });
                    } else {
                      Alert.alert('Edit', 'Use the activity creation flow to edit the title');
                    }
                  }}>
                    <NomadIcon name="edit" size={s(5.5)} color={colors.textMuted} strokeWidth={1.4} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: s(5.5), color: colors.textMuted, marginTop: s(2) }}>
                  {editCheckin.member_count || 1} member{(editCheckin.member_count || 1) > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Action rows */}
            <View style={{ paddingHorizontal: s(10) }}>
              {/* Share Activity */}
              <TouchableOpacity
                style={aiStyles.row}
                activeOpacity={0.6}
                onPress={() => {
                  Share.share({ message: `Join my activity: ${editCheckin?.activity_text || 'Activity'} on NomadsPeople!` });
                }}
              >
                <View style={[aiStyles.rowIcon, { backgroundColor: colors.surface }]}>
                  <NomadIcon name="share" size={s(7)} color={colors.dark} strokeWidth={1.6} />
                </View>
                <Text style={aiStyles.rowLabel}>Share Activity</Text>
                <NomadIcon name="forward" size={s(6)} color="#CCC" strokeWidth={1.6} />
              </TouchableOpacity>

              <View style={aiStyles.divider} />

              {/* Mute Notifications */}
              <View style={aiStyles.row}>
                <View style={[aiStyles.rowIcon, { backgroundColor: colors.warnSurface }]}>
                  <NomadIcon name="bell" size={s(7)} color="#F97316" strokeWidth={1.6} />
                </View>
                <Text style={aiStyles.rowLabel}>Mute Notifications</Text>
                <Switch
                  value={editMuted}
                  onValueChange={setEditMuted}
                  trackColor={{ false: '#D1D5DB', true: colors.success }}
                  ios_backgroundColor="#D1D5DB"
                  thumbColor="white"
                />
              </View>

              <View style={aiStyles.divider} />

              {/* Private Activity */}
              <View style={aiStyles.row}>
                <View style={[aiStyles.rowIcon, { backgroundColor: colors.dangerSurface }]}>
                  <NomadIcon name="lock" size={s(7)} color={colors.primary} strokeWidth={1.6} />
                </View>
                <Text style={aiStyles.rowLabel}>Private Activity</Text>
                <Switch
                  value={editPrivate}
                  onValueChange={(val) => {
                    setEditPrivate(val);
                    if (editCheckin) {
                      supabase.from('app_checkins').update({ is_open: !val }).eq('id', editCheckin.id).then(() => refetch());
                    }
                  }}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  ios_backgroundColor="#D1D5DB"
                  thumbColor="white"
                />
              </View>

              <View style={aiStyles.divider} />

              {/* Change Location */}
              <TouchableOpacity
                style={aiStyles.row}
                activeOpacity={0.6}
                onPress={() => { setShowLocationSearch(!showLocationSearch); setShowDatePicker(false); setShowTimePicker(false); }}
              >
                <View style={[aiStyles.rowIcon, { backgroundColor: colors.accentSurface }]}>
                  <NomadIcon name="pin" size={s(7)} color="#EC4899" strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={aiStyles.rowLabel}>Location</Text>
                  {editCheckin?.location_name && (
                    <Text style={{ fontSize: s(4.5), color: colors.textMuted, marginTop: s(0.5) }} numberOfLines={1}>
                      {editCheckin.location_name}
                    </Text>
                  )}
                </View>
                <NomadIcon name={showLocationSearch ? 'close' : 'forward'} size={s(6)} color="#CCC" strokeWidth={1.6} />
              </TouchableOpacity>

              {/* Inline location search */}
              {showLocationSearch && (
                <View style={{ paddingHorizontal: s(4), paddingBottom: s(4) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: s(6), paddingHorizontal: s(4), height: s(18) }}>
                    <NomadIcon name="search" size={s(6)} color={colors.textMuted} strokeWidth={1.4} />
                    <TextInput
                      style={{ flex: 1, marginLeft: s(3), fontSize: s(6), color: colors.dark }}
                      placeholder="search for a place..."
                      placeholderTextColor={colors.textFaint}
                      value={locationQuery}
                      onChangeText={(text) => {
                        setLocationQuery(text);
                        if (locationTimer.current) clearTimeout(locationTimer.current);
                        if (text.length < 2) { setLocationResults([]); return; }
                        locationTimer.current = setTimeout(async () => {
                          try {
                            const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5`);
                            const json = await res.json();
                            const results = (json.features || []).map((f: any) => {
                              const p = f.properties || {};
                              const coords = f.geometry?.coordinates || [0, 0];
                              return {
                                name: p.name || p.street || text,
                                sub: [p.city, p.state, p.country].filter(Boolean).join(', '),
                                lat: coords[1],
                                lng: coords[0],
                              };
                            });
                            setLocationResults(results);
                          } catch {}
                        }, 400);
                      }}
                      autoFocus
                    />
                  </View>
                  {locationResults.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: s(4), paddingHorizontal: s(2), borderBottomWidth: 0.5, borderBottomColor: colors.borderSoft }}
                      onPress={async () => {
                        if (!editCheckin) return;
                        await supabase.from('app_checkins').update({
                          location_name: `${r.name}, ${r.sub}`,
                          latitude: r.lat,
                          longitude: r.lng,
                        }).eq('id', editCheckin.id);
                        setEditCheckin({ ...editCheckin, location_name: `${r.name}, ${r.sub}`, latitude: r.lat, longitude: r.lng });
                        setShowLocationSearch(false);
                        setLocationQuery('');
                        setLocationResults([]);
                        refetch();
                      }}
                    >
                      <NomadIcon name="pin" size={s(5)} color={colors.textMuted} strokeWidth={1.4} />
                      <View style={{ marginLeft: s(3), flex: 1 }}>
                        <Text style={{ fontSize: s(5.5), fontWeight: FW.medium, color: colors.dark }}>{r.name}</Text>
                        <Text style={{ fontSize: s(4.5), color: colors.textMuted }}>{r.sub}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={aiStyles.divider} />

              {/* Change Date */}
              <TouchableOpacity
                style={aiStyles.row}
                activeOpacity={0.6}
                onPress={() => {
                  setShowDatePicker(!showDatePicker);
                  setShowTimePicker(false);
                  setShowLocationSearch(false);
                  // Init editDay from current scheduled_for
                  if (editCheckin?.scheduled_for) {
                    const d = new Date(editCheckin.scheduled_for);
                    const today = new Date();
                    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
                    setEditDay(Math.max(0, Math.min(6, diffDays)));
                  }
                }}
              >
                <View style={[aiStyles.rowIcon, { backgroundColor: colors.accentSurface }]}>
                  <NomadIcon name="calendar" size={s(7)} color={colors.accent} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={aiStyles.rowLabel}>Date</Text>
                  {editCheckin?.scheduled_for && (
                    <Text style={{ fontSize: s(4.5), color: colors.textMuted, marginTop: s(0.5) }}>
                      {new Date(editCheckin.scheduled_for).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>
                <NomadIcon name={showDatePicker ? 'close' : 'forward'} size={s(6)} color="#CCC" strokeWidth={1.6} />
              </TouchableOpacity>

              {/* Inline date picker */}
              {showDatePicker && (
                <View style={{ paddingHorizontal: s(4), paddingBottom: s(4) }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: s(3), paddingVertical: s(3) }}>
                      {EDIT_DAYS.map((day, i) => {
                        const active = editDay === i;
                        return (
                          <TouchableOpacity
                            key={i}
                            style={{ alignItems: 'center', paddingVertical: s(3), paddingHorizontal: s(5), borderRadius: s(6), backgroundColor: active ? colors.primary : colors.surface }}
                            onPress={async () => {
                              setEditDay(i);
                              if (!editCheckin) return;
                              const newDate = new Date(day.date);
                              if (editCheckin.scheduled_for) {
                                const old = new Date(editCheckin.scheduled_for);
                                newDate.setHours(old.getHours(), old.getMinutes(), 0, 0);
                              }
                              const iso = newDate.toISOString();
                              await supabase.from('app_checkins').update({ scheduled_for: iso }).eq('id', editCheckin.id);
                              setEditCheckin({ ...editCheckin, scheduled_for: iso });
                              refetch();
                            }}
                          >
                            <Text style={{ fontSize: s(4.5), fontWeight: FW.medium, color: active ? C.white : colors.textMuted }}>{day.label}</Text>
                            <Text style={{ fontSize: s(7), fontWeight: FW.bold, color: active ? C.white : colors.dark, marginTop: s(1) }}>{day.num}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={aiStyles.divider} />

              {/* Change Time */}
              <TouchableOpacity
                style={aiStyles.row}
                activeOpacity={0.6}
                onPress={() => {
                  setShowTimePicker(!showTimePicker);
                  setShowDatePicker(false);
                  setShowLocationSearch(false);
                  // Init from current scheduled_for
                  if (editCheckin?.scheduled_for) {
                    const d = new Date(editCheckin.scheduled_for);
                    setEditHour(d.getHours());
                    setEditMinute(Math.round(d.getMinutes() / 15) * 15);
                  }
                }}
              >
                <View style={[aiStyles.rowIcon, { backgroundColor: colors.warnSurface }]}>
                  <NomadIcon name="clock" size={s(7)} color="#F59E0B" strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={aiStyles.rowLabel}>Time</Text>
                  {editCheckin?.scheduled_for && !editCheckin.is_flexible_time && (
                    <Text style={{ fontSize: s(4.5), color: colors.textMuted, marginTop: s(0.5) }}>
                      {fmtTime(new Date(editCheckin.scheduled_for).getHours(), new Date(editCheckin.scheduled_for).getMinutes())}
                    </Text>
                  )}
                  {editCheckin?.is_flexible_time && (
                    <Text style={{ fontSize: s(4.5), color: colors.textMuted, marginTop: s(0.5) }}>flexible</Text>
                  )}
                </View>
                <NomadIcon name={showTimePicker ? 'close' : 'forward'} size={s(6)} color="#CCC" strokeWidth={1.6} />
              </TouchableOpacity>

              {/* Inline time picker */}
              {showTimePicker && (
                <View style={{ paddingHorizontal: s(4), paddingBottom: s(4) }}>
                  <View style={{ flexDirection: 'row', borderRadius: s(6), backgroundColor: colors.surface, overflow: 'hidden', height: s(65) }}>
                    {/* Hours */}
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                      {EDIT_HOURS.map((h) => (
                        <TouchableOpacity
                          key={h}
                          style={{ paddingVertical: s(3), alignItems: 'center', backgroundColor: editHour === h ? colors.primary : 'transparent', borderRadius: s(3), marginHorizontal: s(1), marginVertical: s(0.5) }}
                          onPress={() => setEditHour(h)}
                        >
                          <Text style={{ fontSize: s(6), fontWeight: editHour === h ? FW.bold : FW.medium, color: editHour === h ? C.white : colors.dark }}>
                            {h.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={{ width: 1, backgroundColor: colors.borderSoft }} />
                    {/* Minutes */}
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                      {EDIT_MINUTES.map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={{ paddingVertical: s(3), alignItems: 'center', backgroundColor: editMinute === m ? colors.primary : 'transparent', borderRadius: s(3), marginHorizontal: s(1), marginVertical: s(0.5) }}
                          onPress={() => setEditMinute(m)}
                        >
                          <Text style={{ fontSize: s(6), fontWeight: editMinute === m ? FW.bold : FW.medium, color: editMinute === m ? C.white : colors.dark }}>
                            {m.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {/* Save time button */}
                  <TouchableOpacity
                    style={{ marginTop: s(3), backgroundColor: colors.primary, borderRadius: s(6), paddingVertical: s(4), alignItems: 'center' }}
                    onPress={async () => {
                      if (!editCheckin) return;
                      const base = editCheckin.scheduled_for ? new Date(editCheckin.scheduled_for) : new Date();
                      base.setHours(editHour, editMinute, 0, 0);
                      const iso = base.toISOString();
                      await supabase.from('app_checkins').update({ scheduled_for: iso, is_flexible_time: false }).eq('id', editCheckin.id);
                      setEditCheckin({ ...editCheckin, scheduled_for: iso, is_flexible_time: false });
                      setShowTimePicker(false);
                      refetch();
                    }}
                  >
                    <Text style={{ fontSize: s(5.5), fontWeight: FW.bold, color: colors.white }}>
                      set {fmtTime(editHour, editMinute)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Mini Map */}
            {editCheckin?.latitude && editCheckin?.longitude && (
              <View style={{ marginHorizontal: s(10), marginTop: s(8), borderRadius: s(10), overflow: 'hidden', height: s(70) }}>
                <MapView
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: editCheckin.latitude,
                    longitude: editCheckin.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: editCheckin.latitude, longitude: editCheckin.longitude }} />
                </MapView>
              </View>
            )}

            {/* Delete Button */}
            <TouchableOpacity
              style={{ marginHorizontal: s(10), marginTop: s(10), height: s(22), backgroundColor: colors.dangerSurface, borderRadius: s(10), borderWidth: 1, borderColor: '#FFCDD0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: s(3) }}
              activeOpacity={0.7}
              onPress={() => {
                setShowActivityInfo(false);
                setTimeout(() => setShowDeleteConfirm(true), 300);
              }}
            >
              <NomadIcon name="trash" size={s(7)} color={colors.primary} strokeWidth={1.6} />
              <Text style={{ fontSize: s(7), fontWeight: FW.semi, color: colors.primary }}>Delete Activity</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ═══ DELETE ACTIVITY CONFIRMATION — bottom sheet style ═══ */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <View style={{
            backgroundColor: colors.card, borderTopLeftRadius: s(14), borderTopRightRadius: s(14),
            paddingHorizontal: s(12), paddingTop: s(5), paddingBottom: insets.bottom + s(6),
          }}>
            <View style={{ width: s(20), height: s(2), borderRadius: s(1), backgroundColor: colors.textFaint, alignSelf: 'center', marginBottom: s(6) }} />
            <Text style={{ fontSize: s(8), fontWeight: FW.bold, color: colors.dark, textAlign: 'center', marginBottom: s(3) }}>
              {t('profile.deleteActivityTitle')}
            </Text>
            <Text style={{ fontSize: s(5.5), color: colors.textMuted, textAlign: 'center', lineHeight: s(8), marginBottom: s(7) }}>
              This will remove your activity from the map. This cannot be undone.
            </Text>
            <View style={{ gap: s(4) }}>
              <TouchableOpacity
                onPress={() => {
                  if (!myUserId || !activeCheckin) return;
                  const checkinId = activeCheckin.id;
                  const isTimer = activeCheckin.checkin_type === 'timer';
                  // Optimistic: remove from UI immediately
                  setShowDeleteConfirm(false);
                  if (isTimer) setActiveTimer(null); else setActiveStatus(null);
                  // Then delete in background
                  supabase
                    .from('app_checkins')
                    .update({ is_active: false })
                    .eq('id', checkinId)
                    .then(() => refetch());
                }}
                style={{
                  height: 44, backgroundColor: colors.primary, borderRadius: s(12),
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: FW.semi, color: colors.white }}>{t('profile.deleteActivity')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
                style={{
                  height: 44, backgroundColor: colors.surface, borderRadius: s(12),
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: FW.semi, color: colors.textSec }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Comment Sheet ─── */}
      {commentPostId && (
        <CommentSheet
          postId={commentPostId}
          visible={!!commentPostId}
          onClose={() => setCommentPostId(null)}
          colors={colors}
          commentStyles={commentStyles}
        />
      )}

      {/* ═══ Frame Picker — bottom sheet style ═══ */}
      <Modal visible={showFramePicker} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setShowFramePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: s(14), borderTopRightRadius: s(14),
            paddingHorizontal: s(12), paddingTop: s(5), paddingBottom: insets.bottom + s(6),
            alignItems: 'center',
          }}>
            <View style={{ width: s(20), height: s(2), borderRadius: s(1), backgroundColor: colors.textFaint, alignSelf: 'center', marginBottom: s(6) }} />
            <Text style={styles.framePickerTitle}>{t('profile.profileFrame')}</Text>
            <View style={styles.frameOptions}>
              {FRAME_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={styles.frameOption}
                  onPress={() => { setFrameKey(f.key); setShowFramePicker(false); }}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.frameSwatch,
                    f.color === 'transparent'
                      ? { borderWidth: 1.5, borderColor: colors.textMuted, borderStyle: 'dashed', backgroundColor: 'transparent' }
                      : f.colors
                        ? { backgroundColor: f.colors[0], borderWidth: 1.5, borderColor: f.colors[3] }
                        : { backgroundColor: f.color || colors.textMuted },
                    frameKey === f.key && styles.frameSwatchActive,
                  ]} />
                  <Text style={[styles.frameLabel, frameKey === f.key && { color: colors.primary, fontWeight: FW.bold }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.frameChangeBtn} onPress={() => setShowFramePicker(false)}>
              <Text style={styles.frameChangeBtnText}>{t('profile.changePhoto')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Settings moved to SettingsScreen */}

      {/* Trip Manager Sheet */}
      <TripManagerSheet
        visible={showTripManager}
        onClose={() => setShowTripManager(false)}
        onSaved={() => { refetch(); }}
        existing={(profile as any)?.next_destination ? {
          country: (profile as any).next_destination,
          flag: (profile as any).next_destination_flag || '',
          arrivalDate: (profile as any).next_destination_date || null,
          departureDate: (profile as any).next_departure_date || null,
          tripVibe: null,
          tripCompanion: null,
        } : null}
      />

    </View>
  );
}

/* ═══════════════════════════════════════════
   STYLES — Profile
   ═══════════════════════════════════════════ */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: s(6), paddingBottom: s(4), paddingHorizontal: s(10),
    backgroundColor: c.card, borderBottomWidth: 0.5, borderBottomColor: c.borderSoft,
  },
  hdrBtn: {
    width: s(20), height: s(20), borderRadius: s(10), backgroundColor: c.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  hdrBtnDark: {
    width: s(22), height: s(22), borderRadius: s(11), backgroundColor: c.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  hdrName: { fontSize: s(9), fontWeight: FW.extra, color: c.dark },
  hdrRight: { flexDirection: 'row', gap: s(5) },

  scrollArea: { flex: 1, backgroundColor: c.card },

  /* Profile top — compact, centered, bio integrated */
  profTop: { paddingTop: s(10), paddingHorizontal: s(12), paddingBottom: s(6), alignItems: 'center', gap: s(4) },
  avRing: { width: s(45), height: s(45), borderRadius: s(22.5), padding: s(1.5), alignItems: 'center', justifyContent: 'center' },
  avInner: {
    width: '100%', height: '100%', borderRadius: s(21), backgroundColor: c.primary,
    borderWidth: s(1.5), borderColor: c.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avImage: { width: '100%', height: '100%' },
  avText: { fontSize: s(14), fontWeight: FW.extra, color: c.white },
  displayName: { fontSize: s(10), fontWeight: FW.extra, color: c.dark },
  creatorBadge: { flexDirection: 'row', alignItems: 'center', gap: s(2), backgroundColor: c.dangerSurface, paddingVertical: s(1.5), paddingHorizontal: s(6), borderRadius: s(8) },
  creatorText: { fontSize: s(6.5), fontWeight: FW.semi, color: c.primary },

  /* Age + Zodiac */
  ageZodiacRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: s(1.5),
  },
  ageZodiacText: { fontSize: s(5), fontWeight: FW.medium, color: c.textMuted },
  ageZodiacDot: { fontSize: s(5), color: c.textFaint },

  /* Sub-info row: Job · Location (single compact line) */
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: s(1.5),
    backgroundColor: c.surface, borderRadius: s(6),
    paddingHorizontal: s(4), paddingVertical: s(1.5),
    marginTop: s(1),
  },
  locationText: { fontSize: s(4.5), fontWeight: FW.medium, color: c.textMuted },

  /* Checked-in indicator */
  checkedInRow: { flexDirection: 'row', alignItems: 'center', gap: s(3), paddingVertical: s(2.5), paddingHorizontal: s(8), backgroundColor: 'rgba(0,166,153,0.08)', borderRadius: s(8) },
  checkedInDot: { width: s(3.5), height: s(3.5), borderRadius: s(2), backgroundColor: c.accent },
  checkedInText: { fontSize: s(5.5), fontWeight: FW.medium, color: c.accent },

  /* Bio + Build bio + inline editor */
  bioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(2) },
  bioText: { fontSize: s(6.5), color: c.textSec, lineHeight: s(9.5), textAlign: 'center', flex: 1 },
  bioPencil: { marginTop: s(1) },
  buildBioBtn: { flexDirection: 'row', alignItems: 'center', gap: s(2), paddingVertical: s(3), paddingHorizontal: s(8), backgroundColor: c.dangerSurface, borderRadius: s(8), borderWidth: 0.5, borderColor: '#FFCDD0' },
  buildBioText: { fontSize: s(6), fontWeight: FW.semi, color: c.primary },
  bioEditWrap: { width: '100%', backgroundColor: c.surface, borderRadius: s(6), padding: s(4), gap: s(3) },
  bioInput: { fontSize: s(6.5), color: c.dark, lineHeight: s(9.5), textAlign: 'center', minHeight: s(25), textAlignVertical: 'top' },
  bioEditActions: { flexDirection: 'row', justifyContent: 'center', gap: s(4) },
  bioEditCancel: { paddingVertical: s(2.5), paddingHorizontal: s(8), borderRadius: s(6), backgroundColor: c.pill },
  bioEditCancelText: { fontSize: s(5.5), fontWeight: FW.semi, color: c.textSec },
  bioEditSave: { paddingVertical: s(2.5), paddingHorizontal: s(8), borderRadius: s(6), backgroundColor: c.primary },
  bioEditSaveText: { fontSize: s(5.5), fontWeight: FW.semi, color: c.white },
  bioLinkRow: { flexDirection: 'row', alignItems: 'center', gap: s(2) },
  bioLink: { fontSize: s(6.5), color: c.accent },

  /* Followed by row */
  followedByRow: { flexDirection: 'row', alignItems: 'center', gap: s(3), paddingHorizontal: s(2) },
  followedByAvatars: { flexDirection: 'row', alignItems: 'center' },
  followedByAvWrap: {
    width: s(11), height: s(11), borderRadius: s(5.5),
    borderWidth: 1.5, borderColor: c.white, overflow: 'hidden',
  },
  followedByAvImg: { width: '100%', height: '100%', borderRadius: s(5.5) },
  followedByAvFallback: {
    width: '100%', height: '100%', borderRadius: s(5.5),
    alignItems: 'center', justifyContent: 'center',
  },
  followedByAvText: { fontSize: s(4.5), fontWeight: FW.semi, color: c.white },
  followedByText: { fontSize: s(5.5), color: c.textSec, flex: 1, lineHeight: s(7.5) },
  followedByName: { fontWeight: FW.semi },

  /* Featured tags */
  featuredRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: s(3), marginTop: s(3) },
  featuredChip: {
    flexDirection: 'row', alignItems: 'center', gap: s(2),
    paddingVertical: s(2.5), paddingHorizontal: s(5),
    borderRadius: s(8), backgroundColor: c.dangerSurface,
    borderWidth: 0.5, borderColor: '#FFCDD0',
  },
  featuredEmoji: { fontSize: s(5.5) },
  featuredLabel: { fontSize: s(5.5), fontWeight: FW.medium, color: c.primary },

  activeEvent: {
    marginHorizontal: s(10), marginBottom: s(4), backgroundColor: c.dangerSurface, borderRadius: s(6),
    paddingVertical: s(3), paddingHorizontal: s(5), borderWidth: 0.5, borderColor: '#FFCDD0',
    flexDirection: 'row', alignItems: 'center', gap: s(4),
  },
  aeIcon: { width: s(15), height: s(15), borderRadius: s(5), backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  aeInfo: { flex: 1, minWidth: 0 },
  aeTagRow: { flexDirection: 'row', alignItems: 'center', gap: s(2), marginBottom: s(0.5) },
  aeDot: { width: s(2), height: s(2), borderRadius: s(1), backgroundColor: c.primary },
  aeTag: { fontSize: s(4.5), fontWeight: FW.bold, color: c.primary },
  aeTitle: { fontSize: s(6), fontWeight: FW.bold, color: c.dark },
  aeMeta: { fontSize: s(4.5), color: c.textMuted },
  aeActions: { flexDirection: 'row', gap: s(2) },
  aeBtn: { borderWidth: 0.5, borderColor: '#FFCDD0', backgroundColor: c.card, paddingVertical: s(2), paddingHorizontal: s(5), borderRadius: s(5) },
  aeBtnText: { fontSize: s(4.5), fontWeight: FW.bold, color: c.primary },

  actionBtns: { flexDirection: 'row', gap: s(4), paddingHorizontal: s(8), paddingTop: s(2), paddingBottom: s(6) },
  abtn: { flex: 1, height: s(22), borderRadius: s(11), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(3) },
  abtnFollow: { backgroundColor: c.primary, borderWidth: 0.5, borderColor: c.primary },
  abtnDefault: { backgroundColor: c.pill, borderWidth: 0.5, borderColor: c.borderSoft },
  abtnText: { fontSize: s(7), fontWeight: FW.bold, color: c.dark },
  abtnTextWhite: { color: c.white },

  groupsEmptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(3), paddingVertical: s(5), marginHorizontal: s(10), marginBottom: s(4), backgroundColor: c.surface, borderRadius: s(8) },
  groupsEmptyText: { fontSize: s(6), color: c.textFaint, fontWeight: FW.medium },

  tabs: { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: c.borderSoft, backgroundColor: c.card },
  tab: { flex: 1, height: s(24), alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: c.dark },

  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.borderSoft, gap: s(1) },
  gcell: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  multiIcon: { position: 'absolute', top: s(3), right: s(3), backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: s(3), padding: s(2) },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  framePickerCard: { width: '80%', backgroundColor: c.card, borderRadius: s(12), padding: s(12), alignItems: 'center' },
  framePickerTitle: { fontSize: s(9), fontWeight: FW.bold, color: c.dark, marginBottom: s(10) },
  frameOptions: { flexDirection: 'row', justifyContent: 'center', gap: s(8), marginBottom: s(10), flexWrap: 'wrap' },
  frameOption: { alignItems: 'center', gap: s(3) },
  frameSwatch: { width: s(22), height: s(22), borderRadius: s(11) },
  frameSwatchActive: { borderWidth: 2.5, borderColor: c.dark },
  frameLabel: { fontSize: s(5.5), color: c.textMuted, fontWeight: FW.medium },
  frameChangeBtn: { backgroundColor: c.pill, paddingVertical: s(5), paddingHorizontal: s(14), borderRadius: s(8), borderWidth: 0.5, borderColor: c.borderSoft },
  frameChangeBtnText: { fontSize: s(7), fontWeight: FW.bold, color: c.dark },

  /* Avatar wrapper */
  avWrapper: { position: 'relative' },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: s(15), height: s(15),
    borderRadius: s(7.5),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: c.white,
  },

  /* Add trip empty state card */
  addTripCard: {
    marginHorizontal: s(8),
    marginTop: s(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    borderRadius: s(10),
    padding: s(6),
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderStyle: 'dashed',
  },
  addTripIconWrap: {
    width: s(16), height: s(16), borderRadius: s(8),
    backgroundColor: c.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addTripTitle: {
    fontSize: s(6.5),
    fontWeight: FW.bold,
    color: c.dark,
  },
  addTripSub: {
    fontSize: s(5),
    color: c.textMuted,
    marginTop: s(1),
  },

});

/* ═══════════════════════════════════════════
   STYLES — Inline Feed Cards
   ═══════════════════════════════════════════ */
const makeFeedStyles = (c: ThemeColors) => StyleSheet.create({
  postCard: { borderBottomWidth: 6, borderBottomColor: c.borderSoft, backgroundColor: c.card },
  photo: { width: SCREEN_W, height: SCREEN_W },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: s(3), paddingVertical: s(5) },
  dot: { width: s(3), height: s(3), borderRadius: s(1.5), backgroundColor: c.textFaint },
  dotActive: { backgroundColor: c.primary },
  actionsRow: { flexDirection: 'row', paddingHorizontal: s(6), paddingVertical: s(3), gap: s(8) },
  actionBtn: { padding: s(2) },
  infoArea: { paddingHorizontal: s(8), paddingBottom: s(8) },
  likesText: { fontSize: s(6.5), fontWeight: FW.bold, color: c.dark, marginBottom: s(2) },
  caption: { fontSize: s(6.5), color: c.dark, lineHeight: s(9), marginBottom: s(2) },
  captionBold: { fontWeight: FW.bold },
  viewComments: { fontSize: s(6), color: c.textMuted, marginBottom: s(1) },
  postTime: { fontSize: s(5.5), color: c.textMuted, marginTop: s(2) },
});

/* ─── Comment Sheet Styles ─── */
const makeCommentStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  content: { backgroundColor: c.card, borderTopLeftRadius: s(14), borderTopRightRadius: s(14), maxHeight: '60%', padding: s(10) },
  handle: { width: s(20), height: s(2), backgroundColor: c.textFaint, borderRadius: s(1), alignSelf: 'center', marginBottom: s(8) },
  title: { fontSize: s(9), fontWeight: FW.bold, color: c.dark, marginBottom: s(8) },
  list: { flex: 1, marginBottom: s(6) },
  empty: { fontSize: s(6.5), color: c.textMuted, textAlign: 'center', marginTop: s(10) },
  row: { flexDirection: 'row', gap: s(5), marginBottom: s(8) },
  av: { width: s(16), height: s(16), borderRadius: s(8), alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: s(5.5), fontWeight: FW.bold, color: c.white },
  body: { flex: 1 },
  name: { fontSize: s(6), fontWeight: FW.bold, color: c.dark, marginBottom: s(1) },
  text: { fontSize: s(6.5), color: c.text, lineHeight: s(9) },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 0.5, borderTopColor: c.borderSoft, paddingTop: s(6), gap: s(4) },
  input: { flex: 1, borderWidth: 1, borderColor: c.borderSoft, borderRadius: s(10), paddingHorizontal: s(8), paddingVertical: s(5), fontSize: s(6.5), color: c.dark },
  sendBtn: { padding: s(4) },
});

/* ── Activity Info styles ── */
const makeAiStyles = (c: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(6),
    gap: s(5),
  },
  rowIcon: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: s(7),
    fontWeight: FW.medium as any,
    color: c.dark,
  },
  divider: {
    height: 0.5,
    backgroundColor: c.borderSoft,
    marginLeft: s(21),
  },
});
