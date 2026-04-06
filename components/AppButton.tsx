import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useMemo } from 'react';

type ButtonVariant = 'primary' | 'success' | 'secondary' | 'tertiary';

interface AppButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;           // optional left icon
  compact?: boolean;                 // smaller padding for inline use
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function AppButton({
  label,
  variant = 'primary',
  onPress,
  loading = false,
  disabled = false,
  icon,
  compact = false,
  style,
  textStyle,
}: AppButtonProps) {
  const { colors } = useTheme();
  const variants = useMemo(() => getVariants(colors), [colors]);
  const v = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        v.container,
        compact && styles.compact,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.loaderColor} />
      ) : (
        <>
          {icon}
          <Text style={[v.text, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/* ─── Variant definitions ─── */
const getVariants = (c: ThemeColors): Record<ButtonVariant, { container: ViewStyle; text: TextStyle; loaderColor: string }> => ({
  primary: {
    container: { backgroundColor: c.primary },
    text: { color: '#FFF', fontSize: s(6.5), fontWeight: FW.bold },
    loaderColor: '#FFF',
  },
  success: {
    container: { backgroundColor: c.success },
    text: { color: '#FFF', fontSize: s(6.5), fontWeight: FW.bold },
    loaderColor: '#FFF',
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    text: { color: c.accent, fontSize: s(6.5), fontWeight: FW.semi },
    loaderColor: c.accent,
  },
  tertiary: {
    container: { backgroundColor: 'transparent' },
    text: { color: c.textMuted, fontSize: s(6), fontWeight: FW.medium },
    loaderColor: c.textMuted,
  },
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2.5),
    paddingVertical: s(5.5),
    paddingHorizontal: s(10),
    borderRadius: s(12),
  },
  compact: {
    paddingVertical: s(3.5),
    paddingHorizontal: s(7),
    borderRadius: s(10),
  },
  disabled: {
    opacity: 0.45,
  },
});
