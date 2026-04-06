import { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Image, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import type { NomadIconName } from '../components/NomadIcon';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { usePosts, useLikePost, useComments, useCreatePost } from '../lib/hooks';
import type { PostWithAuthor } from '../lib/hooks';
import { AuthContext } from '../App';

/* ─── Post type config (static parts; colors are set dynamically per theme) ─── */
const TYPE_CONFIG_STATIC: Record<string, { label: string; icon: string }> = {
  status:     { label: 'Status',      icon: 'edit' },
  looking_for:{ label: 'Looking For', icon: 'search' },
  question:   { label: 'Question',    icon: 'help-circle' },
  opportunity:{ label: 'Opportunity', icon: 'briefcase' },
  checkin:    { label: 'Check-in',    icon: 'pin' },
};

/* ─── Get full type config with theme-aware colors ─── */
function getTypeConfig(colors: ThemeColors): Record<string, { label: string; color: string; icon: string }> {
  return {
    status:     { label: 'Status',      color: colors.accent, icon: 'edit' },
    looking_for:{ label: 'Looking For', color: '#10B981', icon: 'search' },
    question:   { label: 'Question',    color: '#F59E0B', icon: 'help-circle' },
    opportunity:{ label: 'Opportunity', color: '#8B5CF6', icon: 'briefcase' },
    checkin:    { label: 'Check-in',    color: colors.primary, icon: 'pin' },
  };
}

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

type FilterTab = 'All' | 'Status' | 'Questions' | 'Opportunities';
const FILTERS: FilterTab[] = ['All', 'Status', 'Questions', 'Opportunities'];
const FILTER_MAP: Record<FilterTab, string | null> = {
  All: null, Status: 'status', Questions: 'question', Opportunities: 'opportunity',
};

/* ─── Comment Sheet ─── */
function CommentSheet({ postId, visible, onClose }: { postId: string; visible: boolean; onClose: () => void }) {
  const { userId } = useContext(AuthContext);
  const { comments, loading, addComment } = useComments(postId);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleSend = async () => {
    if (!text.trim() || !userId) return;
    await addComment(userId, text.trim());
    setText('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheetContent, { paddingBottom: insets.bottom }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Comments</Text>

          <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: s(10) }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet — be the first!</Text>
            ) : comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <View style={[styles.commentAv, { backgroundColor: avatarColor(c.user_id) }]}>
                  {(c.author as any)?.avatar_url ? (
                    <Image source={{ uri: (c.author as any).avatar_url }} style={styles.commentAvImg} />
                  ) : (
                    <Text style={styles.commentAvText}>
                      {(c.author?.full_name ?? '?')[0]}
                    </Text>
                  )}
                </View>
                <View style={styles.commentBody}>
                  <Text style={styles.commentName}>{c.author?.full_name ?? 'Unknown'}</Text>
                  <Text style={styles.commentText}>{c.content}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Write a comment..."
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity onPress={handleSend} style={styles.commentSendBtn}>
              <NomadIcon name="send" size={s(8)} color={text.trim() ? colors.primary : colors.textFaint} strokeWidth={1.6} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ─── Create Post Sheet ─── */
function CreatePostSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { userId } = useContext(AuthContext);
  const { create } = useCreatePost();
  const [type, setType] = useState('status');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const typeConfig = useMemo(() => getTypeConfig(colors), [colors]);

  const handlePost = async () => {
    if (!content.trim() || !userId) return;
    setPosting(true);
    await create(userId, type, content.trim(), 'Tel Aviv');
    setPosting(false);
    setContent('');
    setType('status');
    onCreated();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheetContent, { paddingBottom: insets.bottom }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>New Post</Text>

          {/* Type selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <TouchableOpacity
                key={key}
                style={[styles.typeChip, type === key && { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}
                onPress={() => setType(key)}
              >
                <NomadIcon name={cfg.icon as NomadIconName} size={s(5)} color={type === key ? cfg.color : '#1A1A1A'} strokeWidth={1.4} />
                <Text style={[styles.typeChipText, type === key && { color: cfg.color }]}>{cfg.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.createInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textFaint}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
          />

          <TouchableOpacity
            style={[styles.postBtn, !content.trim() && { opacity: 0.4 }]}
            onPress={handlePost}
            disabled={!content.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════ */

export default function PostFeedScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useContext(AuthContext);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { posts, loading, fetch: fetchPosts } = usePosts();
  const { toggle: toggleLike } = useLikePost();
  const [filter, setFilter] = useState<FilterTab>('All');
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const typeConfig = useMemo(() => getTypeConfig(colors), [colors]);

  useEffect(() => {
    fetchPosts(userId ?? undefined);
  }, [userId]);

  const handleLike = useCallback(async (post: PostWithAuthor) => {
    if (!userId) return;
    await toggleLike(post.id, userId, post.liked_by_me);
    fetchPosts(userId);
  }, [userId, toggleLike, fetchPosts]);

  const filtered = posts.filter(p => {
    const typeFilter = FILTER_MAP[filter];
    return typeFilter ? p.type === typeFilter : true;
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
      </View>

      {/* ─── Filters ─── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ─── Posts ─── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <NomadIcon name="inbox" size={s(16)} color={colors.textFaint} strokeWidth={1.8} />
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          ) : filtered.map((post) => {
            const cfg = typeConfig[post.type] ?? typeConfig.status;

            return (
              <View key={post.id} style={styles.postCard}>
                {/* Author row */}
                <View style={styles.authorRow}>
                  <View style={[styles.authorAv, { backgroundColor: avatarColor(post.user_id) }]}>
                    {(post.author as any)?.avatar_url ? (
                      <Image source={{ uri: (post.author as any).avatar_url }} style={styles.authorAvImg} />
                    ) : (
                      <Text style={styles.authorAvText}>
                        {(post.author?.full_name ?? '?')[0]}
                      </Text>
                    )}
                  </View>
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>{post.author?.full_name ?? 'Unknown'}</Text>
                    <Text style={styles.authorMeta}>
                      {post.author?.job_type ?? ''}{post.city ? ` · ${post.city}` : ''} · {timeAgo(post.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: cfg.color + '15' }]}>
                    <NomadIcon name={cfg.icon as NomadIconName} size={s(4)} color={cfg.color} strokeWidth={1.4} />
                    <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Content */}
                <Text style={styles.postContent}>{post.content}</Text>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {post.tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(post)}>
                    <NomadIcon
                      name="heart"
                      size={s(7)}
                      color={post.liked_by_me ? colors.primary : '#1A1A1A'}
                      strokeWidth={1.6}
                    />
                    <Text style={[styles.actionText, post.liked_by_me && { color: colors.primary }]}>
                      {post.likes_count}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentPostId(post.id)}>
                    <NomadIcon name="chat" size={s(7)} color="#1A1A1A" strokeWidth={1.6} />
                    <Text style={styles.actionText}>{post.comment_count}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Share.share({ message: `${post.content} — NomadsPeople` }).catch(() => {})}
                  >
                    <NomadIcon name="share" size={s(7)} color="#1A1A1A" strokeWidth={1.6} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: s(20) }} />
        </ScrollView>
      )}

      {/* ─── FAB — Create Post ─── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + s(10) }]}
        activeOpacity={0.85}
        onPress={() => setShowCreate(true)}
      >
        <NomadIcon name="plus" size={s(10)} color="white" strokeWidth={1.8} />
      </TouchableOpacity>

      {/* ─── Comment Sheet ─── */}
      {commentPostId && (
        <CommentSheet
          postId={commentPostId}
          visible={!!commentPostId}
          onClose={() => setCommentPostId(null)}
        />
      )}

      {/* ─── Create Post Sheet ─── */}
      <CreatePostSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchPosts(userId ?? undefined)}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: s(10),
    paddingHorizontal: s(12),
    paddingBottom: s(6),
    backgroundColor: c.card,
  },
  title: {
    fontSize: s(13),
    fontWeight: FW.extra,
    color: c.dark,
  },
  /* FAB */
  fab: {
    position: 'absolute',
    right: s(10),
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },

  /* Filters */
  filterRow: {
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    gap: s(4),
    backgroundColor: c.card,
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderSoft,
  },
  filterChip: {
    paddingVertical: s(3),
    paddingHorizontal: s(9),
    borderRadius: s(14),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  filterChipOn: {
    backgroundColor: c.dark,
    borderColor: c.dark,
  },
  filterText: {
    fontSize: s(6.5),
    fontWeight: FW.semi,
    color: '#777',
  },
  filterTextOn: { color: 'white' },

  scroll: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: s(30), gap: s(4) },
  emptyText: { fontSize: s(7), color: c.textMuted },

  /* Post Card */
  postCard: {
    backgroundColor: c.card,
    marginHorizontal: s(8),
    marginTop: s(6),
    borderRadius: s(12),
    padding: s(10),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(6),
  },
  authorAvImg: { width: s(20), height: s(20), borderRadius: s(10) },
  authorAv: {
    width: s(20),
    height: s(20),
    borderRadius: s(10),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  authorAvText: {
    fontSize: s(7),
    fontWeight: FW.bold,
    color: 'white',
  },
  authorInfo: {
    flex: 1,
    marginLeft: s(5),
  },
  authorName: {
    fontSize: s(6.5),
    fontWeight: FW.bold,
    color: c.dark,
  },
  authorMeta: {
    fontSize: s(5),
    color: c.textMuted,
    marginTop: s(0.5),
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    paddingVertical: s(2),
    paddingHorizontal: s(5),
    borderRadius: s(8),
  },
  typeBadgeText: {
    fontSize: s(5),
    fontWeight: FW.semi,
  },

  postContent: {
    fontSize: s(7),
    color: c.dark,
    lineHeight: s(10),
    marginBottom: s(5),
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(3),
    marginBottom: s(6),
  },
  tag: {
    backgroundColor: c.bg,
    paddingVertical: s(1.5),
    paddingHorizontal: s(5),
    borderRadius: s(6),
  },
  tagText: {
    fontSize: s(5.5),
    color: c.textMuted,
    fontWeight: FW.medium,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(14),
    borderTopWidth: 0.5,
    borderTopColor: c.borderSoft,
    paddingTop: s(5),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
  },
  actionText: {
    fontSize: s(6),
    color: c.textMuted,
    fontWeight: FW.medium,
  },

  /* Sheet (shared) */
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContent: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(14),
    borderTopRightRadius: s(14),
    maxHeight: '70%',
    padding: s(10),
  },
  sheetHandle: {
    width: s(20),
    height: s(2),
    backgroundColor: '#ddd',
    borderRadius: s(1),
    alignSelf: 'center',
    marginBottom: s(8),
  },
  sheetTitle: {
    fontSize: s(9),
    fontWeight: FW.bold,
    color: c.dark,
    marginBottom: s(8),
  },

  /* Comments */
  commentList: { flex: 1, marginBottom: s(6) },
  noComments: { fontSize: s(6.5), color: c.textMuted, textAlign: 'center', marginTop: s(10) },
  commentRow: {
    flexDirection: 'row',
    gap: s(5),
    marginBottom: s(8),
  },
  commentAvImg: { width: s(16), height: s(16), borderRadius: s(8) },
  commentAv: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  commentAvText: { fontSize: s(5.5), fontWeight: FW.bold, color: 'white' },
  commentBody: { flex: 1 },
  commentName: { fontSize: s(6), fontWeight: FW.bold, color: c.dark, marginBottom: s(1) },
  commentText: { fontSize: s(6.5), color: c.text, lineHeight: s(9) },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 0.5,
    borderTopColor: c.borderSoft,
    paddingTop: s(6),
    gap: s(4),
  },
  commentTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: s(10),
    paddingHorizontal: s(8),
    paddingVertical: s(5),
    fontSize: s(6.5),
    maxHeight: s(40),
    color: c.dark,
  },
  commentSendBtn: {
    padding: s(4),
  },

  /* Create Post */
  typeRow: { marginBottom: s(8), maxHeight: s(20) },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(3),
    paddingHorizontal: s(7),
    borderRadius: s(10),
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    marginRight: s(4),
  },
  typeChipText: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.textMuted,
  },
  createInput: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: s(10),
    padding: s(8),
    fontSize: s(7),
    color: c.dark,
    minHeight: s(40),
    textAlignVertical: 'top',
    marginBottom: s(8),
  },
  postBtn: {
    backgroundColor: c.primary,
    height: s(22),
    borderRadius: s(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: {
    fontSize: s(8),
    fontWeight: FW.bold,
    color: 'white',
  },
});
