import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import NomadIcon from '../NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

interface Props {
  destination: string | null;
  date: string | null;  // ISO date string
  flag?: string | null;
  isOwner: boolean;
  onEdit?: () => void;
  onPress?: () => void;
}

function formatCountdown(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Now';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `in ${diff} days`;
  const weeks = Math.floor(diff / 7);
  if (weeks === 1) return 'in 1 week';
  if (weeks < 5) return `in ${weeks} weeks`;
  const months = Math.floor(diff / 30);
  return months === 1 ? 'in 1 month' : `in ${months} months`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NextDestinationSection({ destination, date, flag, isOwner, onEdit, onPress }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  if (!destination) return null;

  const countdown = date ? formatCountdown(date) : null;
  const dateLabel = date ? formatDate(date) : null;

  return (
    <TouchableOpacity
      style={st.card}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Airplane icon circle */}
      <View style={st.iconWrap}>
        <NomadIcon name="airplane" size={s(7)} color={colors.accent} strokeWidth={1.6} />
      </View>

      {/* Info */}
      <View style={st.infoCol}>
        <Text style={st.label}>Incoming Flight</Text>
        <View style={st.destRow}>
          {flag ? <Text style={st.flag}>{flag}</Text> : null}
          <Text style={st.city} numberOfLines={1}>{destination}</Text>
        </View>
        {dateLabel && (
          <View style={st.dateRow}>
            <NomadIcon name="calendar" size={s(4)} color={colors.textMuted} strokeWidth={1.4} />
            <Text style={st.dateText}>{dateLabel}</Text>
            {countdown && <Text style={st.countdown}>{countdown}</Text>}
          </View>
        )}
      </View>

      {/* Right side: edit or chevron */}
      {isOwner && onEdit ? (
        <TouchableOpacity onPress={onEdit} style={st.editBtn} activeOpacity={0.7}>
          <NomadIcon name="edit" size={s(4.5)} color={colors.textMuted} strokeWidth={1.6} />
        </TouchableOpacity>
      ) : (
        <NomadIcon name="forward" size={s(6)} color={colors.textFaint} strokeWidth={1.4} />
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    marginHorizontal: s(8),
    marginTop: s(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: 'transparent',
    borderRadius: s(10),
    padding: s(6),
    borderWidth: 1,
    borderColor: c.borderSoft,
  },

  iconWrap: {
    width: s(16), height: s(16), borderRadius: s(8),
    backgroundColor: c.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },

  infoCol: { flex: 1 },
  label: {
    fontSize: s(4.5),
    color: c.textMuted,
    fontWeight: FW.medium,
    letterSpacing: 0.3,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    marginTop: s(1),
  },
  flag: {
    fontSize: s(7),
  },
  city: {
    fontSize: s(7.5),
    fontWeight: FW.extra,
    color: c.dark,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    marginTop: s(2),
  },
  dateText: { fontSize: s(4.5), color: c.textMuted },
  countdown: {
    fontSize: s(4.5), fontWeight: FW.bold, color: c.accent,
    backgroundColor: c.accentLight,
    paddingHorizontal: s(3), paddingVertical: s(1), borderRadius: s(4),
  },

  editBtn: {
    width: s(14), height: s(14), borderRadius: s(7),
    backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center',
  },
});
