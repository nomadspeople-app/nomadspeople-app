import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder, Modal, FlatList, Image,
} from 'react-native';
import { useRef, useEffect, useMemo } from 'react';
import NomadIcon from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import type { NomadInCity } from '../lib/hooks';

const { height: SH } = Dimensions.get('window');
const SHEET_H = SH * 0.72;

interface Props {
  visible: boolean;
  onClose: () => void;
  nomads: NomadInCity[];
  cityName: string;
  onViewProfile: (userId: string, name: string) => void;
}

export default function NomadsListSheet({ visible, onClose, nomads, cityName, onViewProfile }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SHEET_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: SHEET_H, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) onClose();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const getInitials = (name?: string | null) =>
    name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

  const renderNomad = ({ item }: { item: NomadInCity }) => {
    const name = item.display_name || item.full_name || item.username || 'Nomad';
    return (
      <TouchableOpacity
        style={st.nomadRow}
        activeOpacity={0.7}
        onPress={() => onViewProfile(item.user_id, name)}
      >
        {/* Avatar */}
        <View style={st.avWrap}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={st.avImg} />
          ) : (
            <View style={st.avFallback}>
              <Text style={st.avTxt}>{getInitials(item.full_name)}</Text>
            </View>
          )}
          {/* Green online dot */}
          <View style={st.onlineDot} />
        </View>

        {/* Info */}
        <View style={st.infoCol}>
          <Text style={st.nomadName} numberOfLines={1}>{name}</Text>
          {item.job_type ? (
            <Text style={st.nomadJob} numberOfLines={1}>{item.job_type}</Text>
          ) : item.bio ? (
            <Text style={st.nomadJob} numberOfLines={1}>{item.bio}</Text>
          ) : null}
          {item.home_country ? (
            <Text style={st.nomadFrom} numberOfLines={1}>{item.home_country}</Text>
          ) : null}
        </View>

        {/* Arrow */}
        <NomadIcon name="forward" size={s(5.5)} color={colors.textMuted} strokeWidth={1.6} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[st.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={st.handle} />

            {/* Header */}
            <View style={st.headerRow}>
              <View>
                <Text style={st.title}>{t('nomadsList.title')}</Text>
                <Text style={st.subtitle}>
                  {nomads.length} {t('nomadsList.inCity', { city: cityName })}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={st.closeBtn}>
                <NomadIcon name="close" size={s(6)} color="#1A1A1A" strokeWidth={1.6} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Nomad list */}
          <FlatList
            data={nomads}
            keyExtractor={(item) => item.user_id}
            renderItem={renderNomad}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.listContent}
            ItemSeparatorComponent={() => <View style={st.separator} />}
            ListEmptyComponent={
              <View style={st.emptyWrap}>
                <NomadIcon name="users" size={s(14)} color={colors.textMuted} strokeWidth={1.8} />
                <Text style={st.emptyText}>{t('nomadsList.empty')}</Text>
              </View>
            }
          />
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: SHEET_H,
    backgroundColor: c.card,
    borderTopLeftRadius: s(14),
    borderTopRightRadius: s(14),
    paddingTop: s(5),
  },
  handle: {
    width: s(20), height: s(2), borderRadius: s(1),
    backgroundColor: c.pill, alignSelf: 'center', marginBottom: s(6),
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: s(10),
    marginBottom: s(4),
  },
  title: { fontSize: s(8), fontWeight: FW.extra, color: c.dark },
  subtitle: { fontSize: s(5.5), color: c.textMuted, marginTop: s(1) },
  closeBtn: {
    width: s(20), height: s(20), borderRadius: s(10),
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },

  /* List */
  listContent: { paddingHorizontal: s(10), paddingBottom: s(20) },
  separator: { height: 0.5, backgroundColor: c.pill, marginLeft: s(22) },

  /* Nomad row */
  nomadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(5),
  },

  /* Avatar */
  avWrap: { position: 'relative' },
  avImg: { width: s(22), height: s(22), borderRadius: s(11) },
  avFallback: {
    width: s(22), height: s(22), borderRadius: s(11),
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
  },
  avTxt: { color: 'white', fontSize: s(7), fontWeight: FW.bold },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: s(5), height: s(5), borderRadius: s(2.5),
    backgroundColor: '#10B981', borderWidth: 1.5, borderColor: 'white',
  },

  /* Info */
  infoCol: { flex: 1 },
  nomadName: { fontSize: s(6.5), fontWeight: FW.bold, color: c.dark },
  nomadJob: { fontSize: s(5), color: c.textSec, marginTop: s(1) },
  nomadFrom: { fontSize: s(4.5), color: c.textMuted, marginTop: s(0.5) },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingTop: s(20), gap: s(5) },
  emptyText: { fontSize: s(6), color: c.textMuted },
});
