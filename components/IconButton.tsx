import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';
import NomadIcon from './NomadIcon';
import type { NomadIconName } from './NomadIcon';
import { s, C } from '../lib/theme';

interface IconButtonProps {
  name: NomadIconName;
  size?: number;     // mockup px for icon
  btnSize?: number;  // mockup px for button
  color?: string;
  bg?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function IconButton({
  name,
  size = 5,
  btnSize = 22,
  color = '#555',
  bg,
  onPress,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const bgColor = bg ?? colors.white82;
  const bsz = s(btnSize);
  const strokeWidth = size < s(6) ? 1.4 : size > s(10) ? 1.8 : 1.6;
  return (
    <TouchableOpacity
      style={[styles.btn, { width: bsz, height: bsz, borderRadius: bsz / 2, backgroundColor: bgColor }, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <NomadIcon name={name} size={s(size)} color={color} strokeWidth={strokeWidth} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(0.5) },
    shadowOpacity: 0.08,
    shadowRadius: s(2),
  },
});
