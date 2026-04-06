import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useMemo } from 'react';
import NomadIcon from '../NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

const screenW = Dimensions.get('window').width;
const CARD_W = screenW * 0.58;
const CARD_H = CARD_W * 1.2;

interface Post {
  id: string;
  image_url: string | null;
  content: string | null;
  city: string | null;
  created_at: string;
}

interface Props {
  posts: Post[];
  isOwner: boolean;
  onPhotoPress: (index: number) => void;
  onAddPhoto?: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function PhotoMomentsSection({ posts, isOwner, onPhotoPress, onAddPhoto }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const iconColor = colors.primary;

  const photoPosts = posts.filter(p => p.image_url);

  if (photoPosts.length === 0 && !isOwner) return null;

  return (
    <View style={st.wrap}>
      {/* Header */}
      <View style={st.headerRow}>
        <View style={st.headerLeft}>
          <NomadIcon name="camera" size={s(6)} color={colors.dark} strokeWidth={1.6} />
          <Text style={st.headerTitle}>{t('profile.moments')}</Text>
          {photoPosts.length > 0 && (
            <Text style={st.photoCount}>{photoPosts.length}</Text>
          )}
        </View>
        {isOwner && (
          <TouchableOpacity onPress={onAddPhoto} activeOpacity={0.7} style={st.addBtn}>
            <NomadIcon name="plus" size={s(5)} color={colors.primary} strokeWidth={1.6} />
          </TouchableOpacity>
        )}
      </View>

      {photoPosts.length > 0 ? (
        /* Horizontal scroll of moment cards */
        <View style={st.scrollRow}>
          {photoPosts.slice(0, 8).map((post, idx) => (
            <TouchableOpacity
              key={post.id}
              style={st.card}
              activeOpacity={0.85}
              onPress={() => onPhotoPress(idx)}
            >
              <Image source={{ uri: post.image_url! }} style={st.cardImage} resizeMode="cover" />

              {/* Gradient overlay at bottom */}
              <View style={st.cardOverlay}>
                {/* Location + date */}
                <View style={st.cardMeta}>
                  {post.city && (
                    <View style={st.cardLocRow}>
                      <NomadIcon name="pin" size={s(3.5)} color="rgba(255,255,255,0.85)" strokeWidth={1.4} />
                      <Text style={st.cardLoc}>{post.city}</Text>
                    </View>
                  )}
                  <Text style={st.cardDate}>{formatDate(post.created_at)}</Text>
                </View>

                {/* Caption */}
                {post.content && (
                  <Text style={st.cardCaption} numberOfLines={2}>{post.content}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}

          {/* Add more photo tile (owner only) */}
          {isOwner && (
            <TouchableOpacity style={st.addMoreCard} activeOpacity={0.7} onPress={onAddPhoto}>
              <NomadIcon name="plus" size={s(10)} color={colors.textFaint} strokeWidth={1.6} />
            </TouchableOpacity>
          )}

          {/* "See all" card if more than 8 */}
          {photoPosts.length > 8 && (
            <TouchableOpacity style={st.seeAllCard} activeOpacity={0.7} onPress={() => onPhotoPress(0)}>
              <Text style={st.seeAllNum}>+{photoPosts.length - 8}</Text>
              <Text style={st.seeAllText}>{t('profile.seeAll')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : isOwner ? (
        <TouchableOpacity style={st.emptyWrap} activeOpacity={0.7} onPress={onAddPhoto}>
          <View style={st.emptyIconWrap}>
            <NomadIcon name="camera" size={s(10)} color={colors.textFaint} strokeWidth={1.4} />
            <View style={st.emptyPlusBadge}>
              <NomadIcon name="plus" size={s(4)} color="#fff" strokeWidth={2.2} />
            </View>
          </View>
          <Text style={st.emptyTitle}>{t('profile.momentsEmpty')}</Text>
          <Text style={st.emptySub}>{t('profile.momentsEmptySub')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  wrap: { marginTop: s(4), paddingLeft: s(8) },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(4), paddingRight: s(8) },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  headerTitle: { fontSize: s(7), fontWeight: FW.extra, color: c.dark },
  photoCount: { fontSize: s(5), fontWeight: FW.bold, color: c.textMuted, backgroundColor: c.surface, borderRadius: s(4), paddingHorizontal: s(3), paddingVertical: s(0.5) },
  addBtn: {
    width: s(16), height: s(16), borderRadius: s(8),
    backgroundColor: c.dangerSurface, alignItems: 'center', justifyContent: 'center',
  },

  /* Horizontal scroll */
  scrollRow: {
    flexDirection: 'row',
    gap: s(4),
    paddingRight: s(8),
  },

  /* Moment card */
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: s(10),
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  cardImage: { width: '100%', height: '100%' },
  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: s(5),
    paddingTop: s(12),
    backgroundColor: 'transparent',
    // Gradient simulation via multiple layers
    borderBottomLeftRadius: s(10),
    borderBottomRightRadius: s(10),
  },
  cardMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', gap: s(1.5) },
  cardLoc: { fontSize: s(4.5), fontWeight: FW.bold, color: 'white', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardDate: { fontSize: s(4), color: 'rgba(255,255,255,0.8)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardCaption: {
    fontSize: s(4.5), color: 'white', marginTop: s(2),
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  /* See all */
  addMoreCard: {
    width: s(35), height: CARD_H,
    borderRadius: s(10),
    backgroundColor: c.bg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: c.borderSoft, borderStyle: 'dashed' as const,
  },
  seeAllCard: {
    width: s(35), height: CARD_H,
    borderRadius: s(10),
    backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center',
    gap: s(2),
  },
  seeAllNum: { fontSize: s(10), fontWeight: FW.extra, color: c.dark },
  seeAllText: { fontSize: s(5), fontWeight: FW.medium, color: c.textMuted },

  /* Empty */
  emptyWrap: {
    alignItems: 'center', paddingVertical: s(14), gap: s(3),
    marginRight: s(8),
    backgroundColor: c.bg, borderRadius: s(10),
    borderWidth: 1.5, borderColor: c.borderSoft, borderStyle: 'dashed',
  },
  emptyIconWrap: {
    position: 'relative',
    marginBottom: s(2),
  },
  emptyPlusBadge: {
    position: 'absolute', bottom: -s(2), right: -s(3),
    width: s(9), height: s(9), borderRadius: s(5),
    backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: c.bg,
  },
  emptyTitle: { fontSize: s(6), fontWeight: FW.bold, color: c.dark },
  emptySub: { fontSize: s(5), color: c.textMuted, textAlign: 'center' },
});
