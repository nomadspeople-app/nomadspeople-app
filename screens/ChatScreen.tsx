import { useState, useRef, useContext, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Share, Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import NomadIcon from '../components/NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import type { RootStackParamList, AppMessage } from '../lib/types';
import {
  useMessages, markConversationRead, acceptDMRequest, declineDMRequest,
  blockUser, leaveGroupChat, deleteMessage, reportMessage,
  SEND_BLOCKED_MODERATION, SEND_BLOCKED_RATE_LIMIT,
} from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { renderChatContent } from '../lib/chatText';
import { AuthContext, UnreadContext } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;

/* ─── Helpers ─── */
const SENDER_COLORS = ['#E8614D', '#8B5CF6', '#10B981', '#F59E0B', '#2A9D8F', '#EC4899'];
const colorFor = (id: string) => SENDER_COLORS[id.charCodeAt(0) % SENDER_COLORS.length];
const initials = (name?: string | null) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 1).toUpperCase() : '?';
const formatTime = (d: string) => {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const isSystemMsg = (content: string) =>
  /^Created "/.test(content) ||
  /^Joined the activity/.test(content) ||
  /^.{0,30} left the group/.test(content) ||
  /^.{0,30} joined the group/.test(content);

const isJoinMsg = (content: string) =>
  /^Joined the activity/.test(content);

type MsgWithSender = AppMessage & { sender?: { full_name: string | null; avatar_url: string | null } };

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<Nav>();
  const route = useRoute<ChatRoute>();
  const { userId } = useContext(AuthContext);
  const { refetch: refetchUnread } = useContext(UnreadContext);
  const { conversationId, title, avatarColor, avatarText, isGroup } = route.params;
  const { messages, loading, send, refetch } = useMessages(conversationId);
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPendingRequest, setIsPendingRequest] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [createdBy, setCreatedBy] = useState<string | null>(null);

  // Long-press context menu
  const [activeMsg, setActiveMsg] = useState<MsgWithSender | null>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<MsgWithSender | null>(null);

  // Translations — map of message id → translated text
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null); // message id being translated

  // Image attach state:
  //   uploadingImage — flips true while the picked photo is being
  //     uploaded to Supabase Storage; the camera button swaps to a
  //     spinner and taps are ignored so we can't queue duplicate
  //     uploads.
  //   expandedImage — when the user taps an image message we open
  //     a full-screen modal with that URI. Null = modal closed.
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: convData }, { data: memberData }] = await Promise.all([
        supabase.from('app_conversations').select('is_locked, user_a, user_b, created_by').eq('id', conversationId).maybeSingle(),
        userId
          ? supabase.from('app_conversation_members').select('muted_at, status').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (convData?.is_locked) setIsLocked(true);
      if (convData?.created_by) setCreatedBy(convData.created_by);
      if (memberData?.muted_at) setIsMuted(true);
      if (memberData?.status === 'request') setIsPendingRequest(true);
      if (convData && userId) {
        const other = convData.user_a === userId ? convData.user_b : convData.user_a;
        if (other) setOtherUserId(other);
      }
      if (!isGroup && convData && !convData.is_locked) {
        const { count } = await supabase
          .from('app_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);
        if (count === 0) setShowSafety(true);
      }
    })();
  }, [conversationId]);

  const toggleMute = async () => {
    if (!userId) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await supabase
      .from('app_conversation_members')
      .update({ muted_at: newMuted ? new Date().toISOString() : null })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  };

  useEffect(() => {
    if (userId) {
      markConversationRead(conversationId, userId).then(() => refetchUnread());
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const handleSend = async (imageUrl?: string) => {
    // Defensive: only accept a string that looks like an http(s) URL.
    // Anything else (a touch event, undefined, '', a stray object) is
    // treated as 'no image'. Without this, an event object passed in
    // from a TouchableOpacity onPress turns into garbage in app_messages.
    const safeImageUrl =
      typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined;
    if ((!inputText.trim() && !safeImageUrl) || !userId) return;
    const text = inputText.trim();
    setInputText('');
    const { error } = await send(userId, text, replyTo?.id, safeImageUrl);
    if (error) {
      // Surface the failure instead of swallowing it silently. Restore the
      // text so the user doesn't lose what they typed.
      console.warn('[ChatScreen] send failed:', error);
      setInputText(text);

      /* Moderation gate outcomes are signalled via sentinel
       * error messages — translate them to localized alerts
       * so Hebrew / Russian users see their own language. */
      let alertTitle: string;
      let alertBody: string;
      if (error.message === SEND_BLOCKED_MODERATION) {
        alertTitle = t('moderation.blockedTitle');
        alertBody = t('moderation.blockedBody');
      } else if (error.message === SEND_BLOCKED_RATE_LIMIT) {
        alertTitle = t('moderation.rateLimitedTitle');
        alertBody = t('moderation.rateLimitedBody');
      } else {
        alertTitle = 'Message not sent';
        alertBody = error.message || 'Could not send message. Check your connection and try again.';
      }

      if (Platform.OS === 'web') {
        window.alert(`${alertTitle}\n${alertBody}`);
      } else {
        Alert.alert(alertTitle, alertBody);
      }
      return;
    }
    setReplyTo(null);
  };

  const handlePickPhoto = async () => {
    try {
      if (!userId) return;

      // Ask for permission explicitly first so we can surface a
      // clean message if the user previously declined in OS settings.
      // expo-image-picker's launchImageLibraryAsync throws an opaque
      // error in that case; requesting up-front turns it into a
      // friendly Alert.
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          'Photo access needed',
          'Allow nomadspeople access to your photos to share them in chat. You can change this in Settings.',
        );
        return;
      }

      // mediaTypes as an array of string literals — Expo SDK 54+
      // deprecated the MediaTypeOptions enum in favour of this
      // form. Keeping the old enum emits a console warning on
      // every pick; the new form is the only one documented going
      // forward.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];

      setUploadingImage(true);
      try {
        // Path layout:
        //   chat/{conversationId}/{userId}-{timestamp}.jpg
        //
        // Including userId in the filename is intentional — it makes
        // abuse cleanup trivial ("delete every chat image authored
        // by user X") and it lines up with what a future RLS policy
        // on storage.objects would enforce (uploader can only write
        // keys containing their own user_id).
        //
        // post-images is a public bucket with path-based isolation
        // (the UUID-ish conversation_id + timestamp make paths
        // unguessable). Same pattern Slack / Telegram use for their
        // CDN-hosted chat assets. When we move to a dedicated
        // chat-images bucket with signed URLs, this is the single
        // call site to update.
        const fileName = `chat/${conversationId}/${userId}-${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, {
            uri: asset.uri,
            type: 'image/jpeg',
            name: fileName,
          } as any);

        if (uploadError) {
          // Surface the real error — "Upload failed" with no body
          // leaves the user guessing. Most common causes: RLS
          // block, network drop, file too large. All three deserve
          // their actual message.
          console.warn('[ChatScreen] upload failed:', uploadError);
          Alert.alert('Upload failed', uploadError.message);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(fileName);

        await handleSend(urlData.publicUrl);
      } finally {
        setUploadingImage(false);
      }
    } catch (err: any) {
      console.warn('[ChatScreen] pick photo failed:', err);
      Alert.alert(
        'Could not attach photo',
        err?.message ?? 'Try again in a moment.',
      );
    }
  };

  /* ─── Context menu actions ─── */
  const handleCopy = useCallback(() => {
    if (!activeMsg) return;
    Clipboard.setStringAsync(activeMsg.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveMsg(null);
  }, [activeMsg]);

  const handleReply = useCallback(() => {
    if (!activeMsg) return;
    setReplyTo(activeMsg);
    setActiveMsg(null);
  }, [activeMsg]);

  const handleDelete = useCallback(() => {
    if (!activeMsg || !userId) return;
    const msgAge = Date.now() - new Date(activeMsg.sent_at).getTime();
    const ONE_HOUR = 60 * 60 * 1000;

    if (activeMsg.sender_id !== userId) {
      Alert.alert('cannot delete', 'you can only delete your own messages.');
      setActiveMsg(null);
      return;
    }

    if (msgAge > ONE_HOUR) {
      Alert.alert('cannot delete', 'messages can only be deleted within 1 hour of sending.');
      setActiveMsg(null);
      return;
    }

    Alert.alert('delete message?', 'this message will be removed for everyone.', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'delete', style: 'destructive',
        onPress: async () => {
          const { success, error } = await deleteMessage(activeMsg.id, userId);
          if (!success) Alert.alert('error', error || 'could not delete');
          setActiveMsg(null);
        },
      },
    ]);
  }, [activeMsg, userId]);

  const handleReport = useCallback(() => {
    if (!activeMsg || !userId) return;
    Alert.alert('report message?', 'this message will be flagged for review.', [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'report', style: 'destructive',
        onPress: async () => {
          await reportMessage(activeMsg.id, userId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('reported', 'thanks for keeping the community safe.');
          setActiveMsg(null);
        },
      },
    ]);
  }, [activeMsg, userId]);

  const handleTranslate = useCallback(async () => {
    /* Translation is disabled in v1.
     *
     * Before 2026-04-22 this called Google Translate's unofficial
     * `translate.googleapis.com/translate_a/single?client=gtx`
     * endpoint. That endpoint has no Terms of Service, no DPA, and
     * no contractual protection for the user data it receives —
     * we'd be sending potentially private chat content to a third
     * party without a data-processing agreement. Per GDPR Article 28
     * that's a violation even if the intent is benign.
     *
     * Removed for v1 per the privacy master spec
     * (docs/product-decisions/2026-04-22-privacy-security-master-spec.md).
     * Re-introduced post-launch once we move to a provider with a
     * signed DPA (DeepL Pro, or Google Translate API with Cloud
     * Terms). Until then, the Translate button remains in the UI
     * as a "coming soon" affordance. */
    if (!activeMsg) return;
    setActiveMsg(null);
    Alert.alert(
      'translate',
      'Message translation is coming in a future update.'
    );
  }, [activeMsg]);

  const openContextMenu = useCallback((msg: MsgWithSender) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveMsg(msg);
  }, []);

  /* Filter: hide "Joined the activity" from non-joiners */
  const visibleMessages = messages.filter((msg: MsgWithSender) => {
    if (isJoinMsg(msg.content) && msg.sender_id !== userId) return false;
    return true;
  });

  /* Build a map for reply previews */
  const msgMap = new Map(messages.map((m: MsgWithSender) => [m.id, m]));

  return (
    <KeyboardAvoidingView
      style={[st.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ─── Header ─── */}
      <View style={st.hdr}>
        <TouchableOpacity style={st.backBtn} onPress={() => nav.goBack()} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <NomadIcon name="back" size={s(9)} color={colors.dark} strokeWidth={1.8} />
        </TouchableOpacity>
        <TouchableOpacity
          style={st.hdrTap}
          activeOpacity={isGroup ? 0.7 : 1}
          onPress={() => { if (isGroup) nav.navigate('GroupInfo', { conversationId }); }}
        >
          <View style={[st.hdrAv, { backgroundColor: avatarColor || colors.accent }]}>
            <Text style={st.hdrAvText}>{avatarText || '?'}</Text>
          </View>
          <View style={st.hdrInfo}>
            <Text style={st.hdrName} numberOfLines={1}>{title || 'chat'}</Text>
          </View>
        </TouchableOpacity>
        <View style={st.hdrBtns}>
          <TouchableOpacity style={st.hdrBtn} activeOpacity={0.7}
            onPress={() => Share.share({ message: `Join our chat "${title}" on nomadspeople!` }).catch(() => {})}
          >
            <NomadIcon name="share" size={s(7)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity style={st.hdrBtn} activeOpacity={0.7}
            onPress={() => {
              const muteLabel = isMuted ? 'unmute conversation' : 'mute conversation';
              const buttons: any[] = [{ text: muteLabel, onPress: toggleMute }];
              if (isGroup) {
                buttons.push({ text: 'group info', onPress: () => nav.navigate('GroupInfo', { conversationId }) });
                buttons.push({
                  text: 'leave group', style: 'destructive' as const,
                  onPress: () => {
                    Alert.alert('leave group?', 'you will lose access to this chat and all its messages.', [
                      { text: 'cancel', style: 'cancel' },
                      { text: 'leave', style: 'destructive', onPress: async () => {
                        if (!userId) return;
                        const { success } = await leaveGroupChat(userId, conversationId);
                        if (success) nav.goBack();
                      }},
                    ]);
                  },
                });
              }
              if (!isGroup && otherUserId && userId) {
                buttons.push({
                  text: 'block user', style: 'destructive' as const,
                  onPress: () => {
                    Alert.alert('block user', 'they won\'t be able to send you messages anymore.', [
                      { text: 'cancel', style: 'cancel' },
                      { text: 'block', style: 'destructive', onPress: async () => {
                        await blockUser(userId, otherUserId);
                        nav.goBack();
                      }},
                    ]);
                  },
                });
              }
              buttons.push({ text: 'cancel', style: 'cancel' });
              Alert.alert('options', undefined, buttons);
            }}
          >
            <NomadIcon name="dots" size={s(7)} color={colors.dark} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Message Request Banner ─── */}
      {isPendingRequest && (
        <View style={st.reqBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: s(3) }}>
            <NomadIcon name="mail" size={14} color="#F59E0B" strokeWidth={1.4} />
            <Text style={st.reqText}>message request</Text>
          </View>
          <Text style={{ fontSize: s(5.5), color: '#92700C', marginBottom: s(4) }}>
            this person isn't in your contacts. approve to move to direct.
          </Text>
          <View style={{ flexDirection: 'row', gap: s(4) }}>
            <TouchableOpacity style={st.reqAcceptBtn} activeOpacity={0.7}
              onPress={async () => { if (!userId) return; await acceptDMRequest(conversationId, userId); setIsPendingRequest(false); }}>
              <Text style={st.reqAcceptText}>approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.reqDeclineBtn} activeOpacity={0.7}
              onPress={async () => { if (!userId) return; await declineDMRequest(conversationId, userId); nav.goBack(); }}>
              <Text style={st.reqDeclineText}>decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Messages ─── */}
      <ScrollView ref={scrollRef} style={st.msgs} contentContainerStyle={st.msgsInner} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingTop: s(30), alignItems: 'center' }}>
            <ActivityIndicator color={colors.dark} />
          </View>
        ) : visibleMessages.map((msg: MsgWithSender, i: number) => {
          const isMe = msg.sender_id === userId;
          const sender = msg.sender;
          const senderName = sender?.full_name || null;
          const senderAvatar = sender?.avatar_url || null;
          const senderInit = initials(senderName);
          const senderCol = colorFor(msg.sender_id);
          const isSys = isSystemMsg(msg.content);

          const prevMsg = i > 0 ? visibleMessages[i - 1] as MsgWithSender : null;
          const nextMsg = i < visibleMessages.length - 1 ? visibleMessages[i + 1] as MsgWithSender : null;
          const sameSenderPrev = prevMsg && prevMsg.sender_id === msg.sender_id && !isSystemMsg(prevMsg.content) && !isSys;
          const sameSenderNext = nextMsg && nextMsg.sender_id === msg.sender_id && !isSystemMsg(nextMsg.content);
          const isLastInGroup = !sameSenderNext;

          // Reply preview
          const repliedMsg = msg.reply_to_id ? msgMap.get(msg.reply_to_id) : null;

          if (isSys) {
            return (
              <View key={msg.id} style={st.sysRow}>
                <Text style={st.sysText}>{msg.content}</Text>
              </View>
            );
          }

          return (
            <View key={msg.id} style={[st.msgRow, isMe && st.msgRowMe, sameSenderPrev && { marginTop: s(0.5) }]}>
              {/* Avatar slot */}
              {!isMe && (
                <View style={st.avSlot}>
                  {isLastInGroup ? (
                    <View style={[st.tinyAv, { backgroundColor: senderCol }]}>
                      {senderAvatar ? (
                        <Image source={{ uri: senderAvatar }} style={st.tinyAvImg} />
                      ) : (
                        <Text style={st.tinyAvText}>{senderInit}</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              )}

              <View style={[st.bubbleCol, isMe && st.bubbleColMe]}>
                {/* Sender name — groups only, first in consecutive group */}
                {!isMe && isGroup && senderName && !sameSenderPrev && (
                  <View style={st.senderRow}>
                    <Text style={st.senderName}>{senderName}</Text>
                    {msg.sender_id === createdBy && (
                      <View style={st.creatorBadge}>
                        <Text style={st.creatorBadgeText}>creator</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Reply preview */}
                {repliedMsg && (
                  <View style={st.replyPreview}>
                    <Text style={st.replyName} numberOfLines={1}>
                      {repliedMsg.sender_id === userId ? 'you' : ((repliedMsg as MsgWithSender).sender?.full_name || 'someone')}
                    </Text>
                    <Text style={st.replyText} numberOfLines={1}>{repliedMsg.content}</Text>
                  </View>
                )}

                {typeof msg.image_url === 'string' && /^https?:\/\//i.test(msg.image_url) && (
                  <TouchableOpacity
                    style={st.imgHolder}
                    activeOpacity={0.8}
                    onPress={() => setExpandedImage(msg.image_url as string)}
                    onLongPress={() => openContextMenu(msg as MsgWithSender)}
                    delayLongPress={300}
                  >
                    <Image
                      source={{ uri: msg.image_url }}
                      style={{ width: '100%', height: s(50), borderRadius: s(2) }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {msg.content && (
                  <TouchableOpacity
                    style={[st.bubble, isMe ? st.bubbleMe : st.bubbleThem]}
                    activeOpacity={0.8}
                    onLongPress={() => openContextMenu(msg as MsgWithSender)}
                    delayLongPress={300}
                  >
                    <Text style={[st.bubbleText, isMe && st.bubbleTextMe]}>
                      {renderChatContent(msg.content, {
                        baseStyle: [st.bubbleText, isMe && st.bubbleTextMe],
                        linkStyle: { textDecorationLine: 'underline' },
                      })}
                    </Text>
                    {translating === msg.id && (
                      <Text style={{ fontSize: s(4.5), color: isMe ? 'rgba(255,255,255,0.6)' : colors.textMuted, marginTop: s(1.5), fontStyle: 'italic' }}>translating...</Text>
                    )}
                    {translations[msg.id] && (
                      <View style={{ marginTop: s(2), paddingTop: s(2), borderTopWidth: 0.5, borderTopColor: isMe ? 'rgba(255,255,255,0.2)' : '#E5E3DC' }}>
                        <Text style={{ fontSize: s(5.5), color: isMe ? 'rgba(255,255,255,0.85)' : colors.dark, fontStyle: 'italic' }}>
                          {translations[msg.id]}
                        </Text>
                        <Text style={{ fontSize: s(3.5), color: isMe ? 'rgba(255,255,255,0.4)' : colors.textFaint, marginTop: s(0.5) }}>translated</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Time — only on last message in a consecutive group */}
                {isLastInGroup && (
                  <Text style={[st.msgTime, isMe && st.msgTimeMe]}>{formatTime(msg.sent_at)}</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ─── Reply bar ─── */}
      {replyTo && (
        <View style={st.replyBar}>
          <View style={st.replyBarContent}>
            <View style={st.replyBarLine} />
            <View style={{ flex: 1 }}>
              <Text style={st.replyBarName} numberOfLines={1}>
                {replyTo.sender_id === userId ? 'you' : (replyTo.sender?.full_name || 'someone')}
              </Text>
              <Text style={st.replyBarText} numberOfLines={1}>{replyTo.content}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} activeOpacity={0.7} style={{ padding: s(2) }}>
            <NomadIcon name="close" size={s(5)} color="#999" strokeWidth={1.6} />
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Input Bar / Locked ─── */}
      {isLocked ? (
        <View style={[st.lockedBar, { paddingBottom: Math.max(insets.bottom, s(6)) }]}>
          <NomadIcon name="lock" size={s(5)} color="#9CA3AF" strokeWidth={1.6} />
          <Text style={st.lockedText}>this chat was closed by the creator</Text>
        </View>
      ) : (
        <View style={[st.inputArea, { paddingBottom: Math.max(insets.bottom, s(4)) }]}>
          <TextInput
            style={st.inputBox}
            placeholder={t('chat.placeholder')}
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity
            style={[st.cameraBtn, uploadingImage && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handlePickPhoto}
            disabled={uploadingImage}
          >
            {uploadingImage
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <NomadIcon name="camera" size={s(7)} color={colors.primary} strokeWidth={1.8} />}
          </TouchableOpacity>
          {inputText.trim() ? (
            // Wrap in arrow fn — TouchableOpacity passes the press event
            // as the first arg, which handleSend treats as `imageUrl`.
            // That's how messages like חחח and לללל ended up with
            // image_url = '{"dispatchConfig":null,...}' and later crashed
            // the iOS Image layout with 'URI parsing error'.
            <TouchableOpacity style={st.sendBtn} activeOpacity={0.7} onPress={() => handleSend()}>
              <NomadIcon name="send" size={s(6.5)} color="#FFFFFF" strokeWidth={1.8} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* ═══ Context Menu Modal — long press actions ═══ */}
      <Modal visible={!!activeMsg} transparent animationType="fade" onRequestClose={() => setActiveMsg(null)}>
        <TouchableOpacity style={st.ctxOverlay} activeOpacity={1} onPress={() => setActiveMsg(null)}>
          <View style={st.ctxSheet}>
            {/* Message preview */}
            {activeMsg && (
              <View style={st.ctxPreview}>
                <Text style={st.ctxPreviewText} numberOfLines={2}>{activeMsg.content}</Text>
              </View>
            )}

            {/* Actions */}
            <TouchableOpacity style={st.ctxAction} onPress={handleReply} activeOpacity={0.6}>
              <NomadIcon name="chat" size={s(5.5)} color={colors.dark} strokeWidth={1.4} />
              <Text style={st.ctxActionText}>reply</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.ctxAction} onPress={handleCopy} activeOpacity={0.6}>
              <NomadIcon name="link" size={s(5.5)} color={colors.dark} strokeWidth={1.4} />
              <Text style={st.ctxActionText}>copy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.ctxAction} onPress={handleTranslate} activeOpacity={0.6}>
              <NomadIcon name="globe" size={s(5.5)} color={colors.dark} strokeWidth={1.4} />
              <Text style={st.ctxActionText}>translate</Text>
            </TouchableOpacity>

            {/* Delete — only for sender, within 1 hour */}
            {activeMsg && activeMsg.sender_id === userId && (
              (() => {
                const ageMs = Date.now() - new Date(activeMsg.sent_at).getTime();
                const canDelete = ageMs < 60 * 60 * 1000;
                return canDelete ? (
                  <TouchableOpacity style={st.ctxAction} onPress={handleDelete} activeOpacity={0.6}>
                    <NomadIcon name="close" size={s(5.5)} color={colors.danger} strokeWidth={1.4} />
                    <Text style={[st.ctxActionText, { color: colors.danger }]}>delete</Text>
                  </TouchableOpacity>
                ) : null;
              })()
            )}

            {/* Report — only for other people's messages */}
            {activeMsg && activeMsg.sender_id !== userId && (
              <TouchableOpacity style={st.ctxAction} onPress={handleReport} activeOpacity={0.6}>
                <NomadIcon name="shield" size={s(5.5)} color={colors.danger} strokeWidth={1.4} />
                <Text style={[st.ctxActionText, { color: colors.danger }]}>report</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ═══ Safety Popup — first DM only ═══ */}
      <Modal visible={showSafety} transparent animationType="fade" onRequestClose={() => { setShowSafety(false); setTimeout(() => nav.goBack(), 300); }}>
        <View style={st.safeOverlay}>
          <View style={st.safeCard}>
            <TouchableOpacity style={st.safeClose} onPress={() => { setShowSafety(false); setTimeout(() => nav.goBack(), 300); }}>
              <NomadIcon name="close" size={s(6)} color="#94A3B8" strokeWidth={1.6} />
            </TouchableOpacity>
            <View style={st.safeIcon}>
              <NomadIcon name="shield" size={s(12)} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={st.safeTitle}>stay safe</Text>
            <Text style={st.safeSub}>a few things to keep in mind when connecting with new people</Text>
            <View style={st.safeTips}>
              {[
                { icon: 'pin' as const, text: 'meet in public, well-lit places' },
                { icon: 'phone' as const, text: 'let a friend know where you\'re going' },
                { icon: 'chat' as const, text: 'keep conversations on the app' },
                { icon: 'heart' as const, text: 'trust your instincts — it\'s ok to leave' },
              ].map((tip) => (
                <View key={tip.icon} style={st.safeTipRow}>
                  <NomadIcon name={tip.icon} size={s(5.5)} color={colors.accent} strokeWidth={1.4} />
                  <Text style={st.safeTipTxt}>{tip.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={st.safeBtn} onPress={() => setShowSafety(false)} activeOpacity={0.8}>
              <Text style={st.safeBtnTxt}>got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fullscreen image viewer — opens when the user taps an image
          message bubble. Deliberately minimal: pinch-to-zoom is
          deferred to a later PR; today's scope is 'let me see the
          photo at full size and tap-to-dismiss'. Black background so
          photos with their own border blend in, and a single absolutely
          positioned close button in the top-left so RTL users see it
          where their eye expects. */}
      <Modal
        visible={!!expandedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImage(null)}
      >
        <View style={st.fullscreenRoot}>
          <TouchableOpacity
            style={st.fullscreenClose}
            onPress={() => setExpandedImage(null)}
            hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
          >
            <NomadIcon name="close" size={s(8)} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
          {expandedImage && (
            <Image
              source={{ uri: expandedImage }}
              style={st.fullscreenImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════ */
const TINY_AV = s(14);

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.card },

  /* Header */
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingVertical: s(4), paddingHorizontal: s(6),
    backgroundColor: c.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft,
  },
  hdrTap: { flexDirection: 'row', alignItems: 'center', gap: s(4), flex: 1 },
  backBtn: { width: s(18), height: s(18), borderRadius: s(9), alignItems: 'center', justifyContent: 'center' },
  hdrAv: { width: s(20), height: s(20), borderRadius: s(10), alignItems: 'center', justifyContent: 'center' },
  hdrAvText: { fontSize: s(7), fontWeight: FW.bold, color: c.white },
  hdrInfo: { flex: 1, minWidth: 0 },
  hdrName: { fontSize: s(7), fontWeight: FW.bold, color: c.dark },
  hdrBtns: { flexDirection: 'row', gap: s(3) },
  hdrBtn: {
    width: s(18), height: s(18), borderRadius: s(9),
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },

  /* Messages */
  msgs: { flex: 1, backgroundColor: c.card },
  msgsInner: { paddingVertical: s(4), paddingHorizontal: s(6), gap: s(2) },

  /* System message */
  sysRow: { alignItems: 'center', paddingVertical: s(3) },
  sysText: { fontSize: s(5), color: c.textMuted, textAlign: 'center' },

  /* Message row */
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: s(3), marginTop: s(2) },
  msgRowMe: { flexDirection: 'row-reverse' },

  avSlot: { width: TINY_AV, alignItems: 'center', justifyContent: 'flex-end' },
  tinyAv: {
    width: TINY_AV, height: TINY_AV, borderRadius: TINY_AV / 2,
    overflow: 'hidden' as const, alignItems: 'center', justifyContent: 'center',
  },
  tinyAvImg: { width: TINY_AV, height: TINY_AV, borderRadius: TINY_AV / 2 },
  tinyAvText: { fontSize: s(5), fontWeight: FW.bold, color: c.white },

  bubbleCol: { maxWidth: '72%', gap: s(1) },
  bubbleColMe: { alignItems: 'flex-end' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: s(2), marginLeft: s(2), marginBottom: s(0.5) },
  senderName: { fontSize: s(5), color: c.textMuted },
  creatorBadge: {
    backgroundColor: c.primary || '#E8614D',
    borderRadius: s(2),
    paddingHorizontal: s(2),
    paddingVertical: s(0.5),
  },
  creatorBadgeText: {
    fontSize: s(3.5),
    fontWeight: FW.bold,
    color: '#fff',
    textTransform: 'lowercase' as const,
  },

  /* Bubble */
  bubble: { paddingVertical: s(3.5), paddingHorizontal: s(6), borderRadius: s(10) },
  bubbleMe: { backgroundColor: c.primary, borderBottomRightRadius: s(3) },
  bubbleThem: { backgroundColor: c.surface, borderBottomLeftRadius: s(3) },
  bubbleText: { fontSize: s(6.5), lineHeight: s(9.5), color: c.dark },
  bubbleTextMe: { color: c.white },

  /* Time */
  msgTime: { fontSize: s(4.5), color: c.textFaint, marginLeft: s(2), marginTop: s(0.5) },
  msgTimeMe: { marginRight: s(2), marginLeft: 0 },

  /* Reply preview (inside bubble) */
  replyPreview: {
    backgroundColor: c.pill, borderRadius: s(6), padding: s(3),
    borderLeftWidth: 2, borderLeftColor: c.primary, marginBottom: s(1),
  },
  replyName: { fontSize: s(4.5), fontWeight: FW.bold, color: c.textSec },
  replyText: { fontSize: s(4.5), color: c.textMuted, marginTop: s(0.5) },

  /* Reply bar (above input) */
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingVertical: s(3), paddingHorizontal: s(6),
    backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft,
  },
  replyBarContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(3) },
  replyBarLine: { width: 2, height: s(14), backgroundColor: c.primary, borderRadius: 1 },
  replyBarName: { fontSize: s(5), fontWeight: FW.bold, color: c.dark },
  replyBarText: { fontSize: s(5), color: c.textMuted },

  /* Image placeholder */
  imgHolder: {
    width: s(80), height: s(55), borderRadius: s(10),
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },

  /* Fullscreen image viewer (modal). */
  fullscreenRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImg: {
    width: '100%',
    height: '100%',
  },
  fullscreenClose: {
    position: 'absolute',
    top: s(12),
    left: s(6),
    zIndex: 10,
    width: s(18),
    height: s(18),
    borderRadius: s(9),
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Input */
  lockedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(3),
    paddingTop: s(6), paddingHorizontal: s(6), backgroundColor: c.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft,
  },
  lockedText: { fontSize: s(5.5), fontWeight: FW.medium, color: c.textMuted, fontStyle: 'italic' },
  inputArea: {
    flexDirection: 'row', alignItems: 'center', gap: s(3),
    paddingTop: s(4), paddingHorizontal: s(6), backgroundColor: c.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft,
  },
  inputBox: {
    flex: 1, backgroundColor: c.inputBg, borderRadius: s(18),
    paddingVertical: s(4), paddingHorizontal: s(8),
    fontSize: s(6.5), color: c.dark, minHeight: s(18),
  },
  cameraBtn: {
    width: s(16), height: s(16), borderRadius: s(8),
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },
  sendBtn: {
    width: s(16), height: s(16), borderRadius: s(8),
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
  },

  /* Context menu modal */
  ctxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  ctxSheet: {
    backgroundColor: c.card, borderTopLeftRadius: s(10), borderTopRightRadius: s(10),
    paddingTop: s(6), paddingBottom: s(12), paddingHorizontal: s(6),
  },
  ctxPreview: {
    backgroundColor: c.surface, borderRadius: s(8), padding: s(5),
    marginBottom: s(5), marginHorizontal: s(2),
  },
  ctxPreviewText: { fontSize: s(6), color: c.textSec },
  ctxAction: {
    flexDirection: 'row', alignItems: 'center', gap: s(5),
    paddingVertical: s(5.5), paddingHorizontal: s(4),
    borderRadius: s(6),
  },
  ctxActionText: { fontSize: s(6.5), fontWeight: FW.medium, color: c.dark },

  /* DM Request */
  reqBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: s(6), marginTop: 6, marginBottom: 2,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  reqText: { flex: 1, fontSize: 12, color: '#92700C', fontWeight: '500' as const },
  reqAcceptBtn: { paddingVertical: s(4), paddingHorizontal: s(14), borderRadius: s(10), backgroundColor: c.success },
  reqAcceptText: { fontSize: s(6.5), fontWeight: FW.bold, color: c.white },
  reqDeclineBtn: {
    paddingVertical: s(4), paddingHorizontal: s(14), borderRadius: s(10),
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  reqDeclineText: { fontSize: s(6.5), fontWeight: FW.bold, color: c.danger },

  /* Safety Popup */
  safeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: s(12) },
  safeCard: { width: '100%', backgroundColor: c.card, borderRadius: s(12), padding: s(12), alignItems: 'center' },
  safeClose: { position: 'absolute', top: s(6), right: s(6), padding: s(2) },
  safeIcon: {
    width: s(26), height: s(26), borderRadius: s(13), backgroundColor: c.dangerSurface,
    alignItems: 'center', justifyContent: 'center', marginBottom: s(6), marginTop: s(2),
  },
  safeTitle: { fontSize: s(10), fontWeight: FW.extra, color: c.dark, marginBottom: s(3) },
  safeSub: { fontSize: s(5.5), color: c.textSec, textAlign: 'center', lineHeight: s(8), marginBottom: s(8), paddingHorizontal: s(4) },
  safeTips: { width: '100%', gap: s(6), marginBottom: s(10) },
  safeTipRow: { flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(4) },
  safeTipTxt: { fontSize: s(6), color: c.textSec, fontWeight: FW.medium, flex: 1 },
  safeBtn: { width: '100%', backgroundColor: c.primary, borderRadius: s(12), paddingVertical: s(6.5), alignItems: 'center' },
  safeBtnTxt: { color: c.white, fontSize: s(7.5), fontWeight: FW.extra },
});
