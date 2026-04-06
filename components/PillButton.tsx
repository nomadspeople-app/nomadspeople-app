import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native';
import { useMemo } from 'react';
import NomadIcon from './NomadIcon';
import type { NomadIconName } from './NomadIcon';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';

interface PillButtonProps {
  label: string;
  icon?: NomadIconName;
  iconColor?: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function PillButton({ label, icon, iconColor, active, onPress, style }: PillButtonProps) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[st.pill, active && st.pillActive, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <View style={{ marginRight: s(1) }}>
          <NomadIcon
            name={icon}
            size={s(3.5)}
            color={active ? 'white' : (iconColor || colors.textSec)}
            strokeWidth={1.4}
          />
        </View>
      )}
      <Text style={[st.text, active && st.textActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(7),
    paddingVertical: s(3),
    borderRadius: s(10),
    backgroundColor: c.white88,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.04,
    shadowRadius: s(1.5),
  },
  pillActive: {
    backgroundColor: c.dark,
    borderColor: c.dark,
  },
  text: {
    fontSize: s(6),
    fontWeight: FW.semi,
    color: c.textSec,
  },
  textActive: {
    color: 'white',
  },
});
