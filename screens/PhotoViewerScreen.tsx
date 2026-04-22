import { useState, useContext, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, FlatList,
  Dimensions, TextInput, Modal, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Share, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { usePhotoLike, usePhotoComments } from '../lib/hooks';
import { AuthContext } from '../App';
import type { PhotoPost } from '../lib/hooks';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

/* ─── Comment Sheet ─── */
function CommentSheet({ postId, visible, onClose }: { postId: string; visible: boolean; onClose: () => void }) {
  const { userId } = useContext(AuthContext);
  const { comments, loading, addComment } = usePhotoComments(postId);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const commentStyles = useMemo(() => makeCommentStyles(colors), [colors]);

  function avatarColor(str: string): string {
    const colors = ['#E8614D', '#8B5CF6', '#34A853', '#F59E0B', '#2A9D8F', '#EC4899', '#6366F1', '#F97316'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

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
          <Text style={commentStyles.title}>Comments</Text>
          <ScrollView style={commentStyles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: s(10) }} />
            ) : comments.length === 0 ? (
              <Text style={commentStyles.empty}>No comments yet</Text>
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
              placeholder="Add a comment..."
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
            />
            <TouchableOpacity onPress={handleSend} style={commentStyles.sendBtn}>
              <NomadIcon name="send" size={s(8)} color={text.trim() ? colors.primary : colors.textFaint} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   SINGLE PHOTO POST CARD
   ═══════════════════════════════════════════ */
function PhotoPostCard({
  post, authorName, onLike, onComment, onShare,
}: {
  post: PhotoPost;
  authorName: string;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}) {
  const [activePhoto, setActivePhoto] = useState(0);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.postCard}>
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
          <Image source={{ uri: item.image_url }} style={styles.photo} resizeMode="cover" />
        )}
      />

      {/* Dots */}
      {post.photos.length > 1 && (
        <View style={styles.dotsRow}>
          {post.photos.map((_, i) => (
            <View key={i} style={[styles.dot, activePhoto === i && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Actions — like, comment, share */}
      <View style={styles.actionsRow}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity onPress={onLike} style={styles.actionBtn}>
            <NomadIcon
              name="heart"
              size={s(10)}
              color={post.liked_by_me ? colors.primary : colors.dark}
              strokeWidth={1.8}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onComment} style={styles.actionBtn}>
            <NomadIcon name="chat" size={s(10)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={styles.actionBtn}>
            <NomadIcon name="send" size={s(9)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Likes count + caption */}
      <View style={styles.infoArea}>
        <Text style={styles.likesText}>
          {post.likes_count} like{post.likes_count !== 1 ? 's' : ''}
        </Text>
        {post.caption && (
          <Text style={styles.caption}>
            <Text style={styles.captionBold}>{authorName} </Text>
            {post.caption}
          </Text>
        )}
        {post.comment_count > 0 && (
          <TouchableOpacity onPress={onComment}>
            <Text style={styles.viewComments}>
              View all {post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════
   MAIN SCREEN — photo feed, swipe right to dismiss
   ═══════════════════════════════════════════ */
export default function PhotoViewerScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const route = useRoute<any>();
  const { userId } = useContext(AuthContext);
  const { toggle: toggleLike } = usePhotoLike();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const posts: PhotoPost[] = route.params?.posts ?? [];
  const startIndex: number = route.params?.startIndex ?? 0;
  const authorName: string = route.params?.authorName ?? '';

  const [localPosts, setLocalPosts] = useState(posts);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  /* ─── Swipe-right-to-dismiss gesture ─── */
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only activate for horizontal swipes to the right
        return gs.dx > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5;
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          translateX.setValue(gs.dx);
          opacity.setValue(1 - gs.dx / SCREEN_W * 0.5);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SCREEN_W * 0.3 || gs.vx > 0.5) {
          // Dismiss
          Animated.parallel([
            Animated.timing(translateX, { toValue: SCREEN_W, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => nav.goBack());
        } else {
          // Snap back
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleLike = useCallback(async (postId: string, isLiked: boolean) => {
    if (!userId) return;
    await toggleLike(postId, userId, isLiked);
    setLocalPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
        : p
    ));
  }, [userId, toggleLike]);

  const handleShare = useCallback(async (caption?: string | null) => {
    try {
      await Share.share({ message: caption ? `${caption} — nomadspeople` : 'Check this out on nomadspeople!' });
    } catch (err) {
      // Share.share rejects only on real failures; user cancel
      // returns a clean object. Log so a broken share doesn't
      // vanish silently.
      console.warn('[PhotoViewerScreen] share failed:', err);
    }
  }, []);

  // FlatList ref to scroll to the tapped photo
  const listRef = useRef<FlatList>(null);

  return (
    <Animated.View
      style={[styles.root, { paddingTop: insets.top, transform: [{ translateX }], opacity }]}
      {...panResponder.panHandlers}
    >
      {/* ─── Minimal header bar ─── */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <NomadIcon name="back" size={s(9)} color={colors.dark} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{authorName}</Text>
        <View style={{ width: s(18) }} />
      </View>

      {/* ─── Vertical list of photo posts ─── */}
      <FlatList
        ref={listRef}
        data={localPosts}
        keyExtractor={(item) => item.id}
        initialScrollIndex={startIndex > 0 ? startIndex : undefined}
        getItemLayout={(_, index) => ({
          // Approximate height per post card for scrolling
          length: SCREEN_W + s(50),
          offset: (SCREEN_W + s(50)) * index,
          index,
        })}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: post }) => (
          <PhotoPostCard
            post={post}
            authorName={authorName}
            onLike={() => handleLike(post.id, post.liked_by_me)}
            onComment={() => setCommentPostId(post.id)}
            onShare={() => handleShare(post.caption)}
          />
        )}
        ListFooterComponent={<View style={{ height: insets.bottom + s(20) }} />}
        onScrollToIndexFailed={(info) => {
          // Fallback: scroll to approximate offset
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
      />

      {/* ─── Comment Sheet ─── */}
      {commentPostId && (
        <CommentSheet
          postId={commentPostId}
          visible={!!commentPostId}
          onClose={() => setCommentPostId(null)}
        />
      )}
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════ */
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(6),
    paddingVertical: s(5),
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderSoft,
    backgroundColor: c.bg,
  },
  backBtn: { padding: s(4) },
  headerTitle: {
    fontSize: s(8),
    fontWeight: FW.bold,
    color: c.dark,
  },

  /* Post card */
  postCard: {
    borderBottomWidth: 6,
    borderBottomColor: c.borderSoft,
    backgroundColor: c.card,
  },

  photo: {
    width: SCREEN_W,
    height: SCREEN_W,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(3),
    paddingVertical: s(5),
  },
  dot: {
    width: s(3),
    height: s(3),
    borderRadius: s(1.5),
    backgroundColor: '#ddd',
  },
  dotActive: {
    backgroundColor: c.primary,
  },

  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: s(6),
    paddingVertical: s(3),
  },
  actionsLeft: {
    flexDirection: 'row',
    gap: s(8),
  },
  actionBtn: {
    padding: s(2),
  },

  infoArea: {
    paddingHorizontal: s(8),
    paddingBottom: s(8),
  },
  likesText: {
    fontSize: s(6.5),
    fontWeight: FW.bold,
    color: c.dark,
    marginBottom: s(2),
  },
  caption: {
    fontSize: s(6.5),
    color: c.dark,
    lineHeight: s(9),
    marginBottom: s(2),
  },
  captionBold: {
    fontWeight: FW.bold,
  },
  viewComments: {
    fontSize: s(6),
    color: c.textMuted,
    marginBottom: s(1),
  },
  postTime: {
    fontSize: s(5.5),
    color: c.textMuted,
    marginTop: s(2),
  },
});

/* ─── Comment Sheet Styles ─── */
const makeCommentStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  content: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(14),
    borderTopRightRadius: s(14),
    maxHeight: '60%',
    padding: s(10),
  },
  handle: {
    width: s(20), height: s(2), backgroundColor: '#ddd',
    borderRadius: s(1), alignSelf: 'center', marginBottom: s(8),
  },
  title: { fontSize: s(9), fontWeight: FW.bold, color: c.dark, marginBottom: s(8) },
  list: { flex: 1, marginBottom: s(6) },
  empty: { fontSize: s(6.5), color: c.textMuted, textAlign: 'center', marginTop: s(10) },
  row: { flexDirection: 'row', gap: s(5), marginBottom: s(8) },
  av: { width: s(16), height: s(16), borderRadius: s(8), alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: s(5.5), fontWeight: FW.bold, color: 'white' },
  body: { flex: 1 },
  name: { fontSize: s(6), fontWeight: FW.bold, color: c.dark, marginBottom: s(1) },
  text: { fontSize: s(6.5), color: c.text, lineHeight: s(9) },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 0.5, borderTopColor: c.borderSoft, paddingTop: s(6), gap: s(4) },
  input: { flex: 1, borderWidth: 1, borderColor: c.borderSoft, borderRadius: s(10), paddingHorizontal: s(8), paddingVertical: s(5), fontSize: s(6.5), color: c.dark },
  sendBtn: { padding: s(4) },
});
