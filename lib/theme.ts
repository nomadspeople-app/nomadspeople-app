import { Dimensions } from 'react-native';
import { createContext, useContext } from 'react';

const { width: SW } = Dimensions.get('window');

/* ─── Scale: mockup 200px wide → device ─── */
export const MOCK_W = 200;
export const SCALE = SW / MOCK_W;
export const s = (px: number) => Math.round(px * SCALE);

/* ─── Light palette ─── */
const LIGHT = {
  primary:      '#E8614D',   // warm coral — inviting, not urgent
  primaryLight: '#E8614D22', // coral tint for backgrounds
  success:      '#34A853',   // sage green — joined, confirmed
  successLight: '#34A85318', // sage tint for backgrounds
  accent:       '#2A9D8F',   // warm teal — secondary actions, info
  accentLight:  '#2A9D8F18', // teal tint for backgrounds
  bg:           '#FAFAF9',
  surface:      '#F5F3EF',   // cards, pills, inputs — unified
  mapBg:        '#F2F1EC',
  dark:         '#1a1a1a',
  border:       'rgba(0,0,0,0.06)',
  borderSoft:   '#F0EEE8',
  white:        '#FFFFFF',
  white82:      'rgba(255,255,255,0.82)',
  white88:      'rgba(255,255,255,0.88)',
  white93:      'rgba(255,255,255,0.93)',
  pill:         '#F5F3EF',   // aligned with surface
  text:         '#1a1a1a',
  textSec:      '#555',
  textMuted:    '#aaa',
  textFaint:    '#bbb',
  card:         '#FFFFFF',
  tabBar:       'rgba(255,255,255,0.9)',

  // Tinted surfaces — for subtle colored backgrounds
  dangerSurface:  '#FFF5F5',   // red tint bg
  successSurface: '#F0FDF9',   // green tint bg
  warnSurface:    '#FFF8F0',   // warm/orange tint bg
  accentSurface:  '#F0F5FF',   // blue/teal tint bg
  inputBg:        '#FAFAF9',   // input fields
  inputBorder:    '#E5E3DC',   // input borders

  // Category colors (muted, emoji-forward approach)
  work:   '#3B82F6',
  cafe:   '#F59E0B',
  night:  '#8B5CF6',
  out:    '#10B981',
  danger: '#DC2626',
} as const;

/* ─── Dark palette ─── */
/*
 * Warm-tinted dark — like a Bali evening, not a terminal.
 * Base hue: slight warm brown-blue (#16, 14, 22 → subtle warmth in grays).
 * Depth layers: bg → surface → card → pill (each ~8-12% lighter).
 * Brand colors bumped ~10% brighter so they pop on dark canvas.
 */
const DARK = {
  primary:      '#E8614D',   // same coral as light — brand consistency
  primaryLight: '#E8614D18',
  success:      '#34A853',   // same green as light
  successLight: '#34A85318',
  accent:       '#2A9D8F',   // same teal as light
  accentLight:  '#2A9D8F18',
  bg:           '#363640',   // warm gray — gentle dim
  surface:      '#3E3E4C',   // cards layer 1
  mapBg:        '#3A3A44',   // map between bg and surface
  dark:         '#ECECF0',   // primary text
  border:       'rgba(255,255,255,0.08)',
  borderSoft:   '#4A4A58',   // visible dividers
  white:        '#3E3E4C',   // "white" contexts flip to surface
  white82:      'rgba(62,62,76,0.82)',
  white88:      'rgba(62,62,76,0.88)',
  white93:      'rgba(62,62,76,0.93)',
  pill:         '#464654',   // pill/chip bg
  text:         '#ECECF0',
  textSec:      '#C0C0CC',   // secondary text
  textMuted:    '#9E9EB2',   // muted — readable
  textFaint:    '#7A7A8E',   // faintest — decorative
  card:         '#404050',   // card bg — soft lift from bg
  tabBar:       'rgba(54,54,64,0.96)',

  // Tinted surfaces
  dangerSurface:  '#4A3A40',   // subtle red tint
  successSurface: '#3A4A42',   // subtle green tint
  warnSurface:    '#4A4238',   // subtle warm tint
  accentSurface:  '#3A424E',   // subtle blue tint
  inputBg:        '#464654',   // input fields — matches pill
  inputBorder:    '#565664',   // input borders — visible

  // Category colors — same as light for brand consistency
  work:   '#3B82F6',
  cafe:   '#F59E0B',
  night:  '#8B5CF6',
  out:    '#10B981',
  danger: '#DC2626',
} as const;

export type ThemeColors = { [K in keyof typeof LIGHT]: string };

/* ─── Default export (light) for backwards compat ─── */
export const C = LIGHT;

/* ─── Get palette by mode ─── */
export function getColors(isDark: boolean): ThemeColors {
  return isDark ? DARK : LIGHT;
}

/* ─── Theme Context ─── */
interface ThemeCtx {
  isDark: boolean;
  colors: ThemeColors;
  toggleDark: (val: boolean) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  isDark: false,
  colors: LIGHT,
  toggleDark: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/* ─── Tab bar ─── */
export const TAB_BAR_HEIGHT = 56;

/* ─── Font weights ─── */
export const FW = {
  light:   '300' as const,
  regular: '400' as const,
  medium:  '500' as const,
  semi:    '600' as const,
  bold:    '700' as const,
  extra:   '800' as const,
};

/* ─── Font size scale (systematic, not scattered) ─── */
export const FS = {
  tiny:    s(4),    // tiny labels, badges
  caption: s(5),    // captions, meta info
  body:    s(6.5),  // body text, row labels
  sub:     s(7.5),  // section headers
  title:   s(12),   // page titles
};

/* ─── Button style presets ─── */
export const BTN = {
  primary: {
    backgroundColor: LIGHT.primary,
    paddingVertical: s(5.5),
    paddingHorizontal: s(10),
    borderRadius: s(12),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: s(6.5),
    fontWeight: FW.bold,
  },
  success: {
    backgroundColor: LIGHT.success,
    paddingVertical: s(5.5),
    paddingHorizontal: s(10),
    borderRadius: s(12),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: s(6.5),
    fontWeight: FW.bold,
  },
  secondary: {
    backgroundColor: 'transparent',
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    borderRadius: s(12),
    borderWidth: 1.5,
    borderColor: LIGHT.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryText: {
    color: LIGHT.accent,
    fontSize: s(6.5),
    fontWeight: FW.semi,
  },
  tertiary: {
    backgroundColor: 'transparent',
    paddingVertical: s(4),
    paddingHorizontal: s(6),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tertiaryText: {
    color: LIGHT.textMuted,
    fontSize: s(6),
    fontWeight: FW.medium,
  },
};
