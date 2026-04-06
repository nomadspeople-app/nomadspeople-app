import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { s, C, useTheme, type ThemeColors } from '../lib/theme';

interface AvatarProps {
  initials: string;
  color?: string;
  size?: number;        // mockup px — will be scaled
  borderWidth?: number; // mockup px
  showGradientRing?: boolean;
}

export default function Avatar({
  initials,
  color,
  size = 26,
  borderWidth = 1,
  showGradientRing = false,
}: AvatarProps) {
  const { colors } = useTheme();
  const resolvedColor = color || colors.primary;
  const st = useMemo(() => makeStyles(colors), [colors]);
  const sz = s(size);
  const bw = s(borderWidth);
  const fontSize = s(size * 0.27);

  if (showGradientRing) {
    const ringSize = sz + s(4);
    return (
      <View style={[st.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        <View style={[st.avatar, { width: sz, height: sz, borderRadius: sz / 2, borderWidth: bw, backgroundColor: resolvedColor }]}>
          <Text style={[st.text, { fontSize }]}>{initials}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[st.avatar, { width: sz, height: sz, borderRadius: sz / 2, borderWidth: bw, backgroundColor: resolvedColor }]}>
      <Text style={[st.text, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  ring: {
    backgroundColor: c.primary,
    padding: s(1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: s(1) },
    shadowOpacity: 0.15,
    shadowRadius: s(3),
    elevation: 4,
  },
  text: {
    color: 'white',
    fontWeight: '700',
  },
});
