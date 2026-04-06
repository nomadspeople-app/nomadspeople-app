/**
 * NomadIcon — Custom SVG icon system for NomadsPeople
 *
 * Modern, creative, fine-line icons with color support.
 * Designed to be unique to NomadsPeople — not Instagram, not Feather.
 *
 * Usage:
 *   <NomadIcon name="coffee" size={24} color="#E8614D" />
 */
import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline, G } from 'react-native-svg';

export type NomadIconName =
  | 'coffee' | 'food' | 'nightlife' | 'outdoors' | 'explore' | 'hangout' | 'work'
  | 'timer' | 'lightning' | 'heart' | 'heart-filled' | 'send' | 'chat' | 'chat-group' | 'users-3'
  | 'search' | 'bell' | 'bell-active' | 'camera' | 'image' | 'pin' | 'pin-live'
  | 'compass' | 'crosshair' | 'globe' | 'calendar' | 'clock'
  | 'user' | 'user-plus' | 'users' | 'star' | 'star-filled'
  | 'plus' | 'close' | 'back' | 'forward' | 'check' | 'settings'
  | 'edit' | 'share' | 'link' | 'lock' | 'unlock' | 'eye' | 'eye-off'
  | 'zap' | 'flame' | 'sparkle' | 'wave' | 'sunrise' | 'moon-stars'
  | 'backpack' | 'airplane' | 'surf' | 'music' | 'briefcase' | 'laptop'
  | 'trash' | 'grid' | 'copy' | 'dots'
  | 'logout' | 'refresh' | 'alert' | 'shield' | 'gift' | 'trending' | 'at-sign'
  | 'minus' | 'check-circle' | 'target'
  | 'paperclip' | 'info' | 'phone' | 'mail' | 'external-link' | 'x-circle' | 'plus-circle' | 'inbox' | 'navigation' | 'more-vertical';

interface Props {
  name: NomadIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function NomadIcon({ name, size = 24, color = '#1A1A1A', strokeWidth = 1.6 }: Props) {
  const sw = strokeWidth;
  const sc = 'round' as const;   // strokeLinecap
  const sj = 'round' as const;   // strokeLineJoin

  const icon = ICONS[name];
  if (!icon) return null;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {icon(color, sw, sc, sj)}
    </Svg>
  );
}

/* ═══════════════════════════════════════════
   ICON DEFINITIONS — each is a function that
   returns SVG children (Path, Circle, etc.)
   ═══════════════════════════════════════════ */

type IconFn = (c: string, sw: number, sc: 'butt' | 'round' | 'square', sj: 'miter' | 'round' | 'bevel') => React.ReactNode;

const ICONS: Record<NomadIconName, IconFn> = {

  /* ── Categories ── */

  coffee: (c, sw, sc) => (
    <G>
      {/* Cup body — rounded mug */}
      <Path d="M5 12V9a1 1 0 011-1h10a1 1 0 011 1v3a5 5 0 01-5 5H10a5 5 0 01-5-5z" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Handle — small ear on right */}
      <Path d="M17 10h1a2 2 0 010 4h-1" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Saucer */}
      <Path d="M6 19h10" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Steam — three playful wavy lines */}
      <Path d="M9 5c0-1 1-1.5 1-2.5" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.5} />
      <Path d="M12 5c0-1 1-1.5 1-2.5" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.5} />
      <Path d="M15 5c0-1-1-1.5-1-2.5" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.5} />
    </G>
  ),

  food: (c, sw, sc) => (
    <G>
      {/* Plate — wide circle */}
      <Circle cx="12" cy="14" r="7" stroke={c} strokeWidth={sw} />
      {/* Inner plate rim */}
      <Circle cx="12" cy="14" r="4" stroke={c} strokeWidth={1} opacity={0.3} />
      {/* Fork tines */}
      <Path d="M8 3v4M10 3v4M8 7a1 1 0 001 1h0a1 1 0 001-1" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Knife */}
      <Path d="M15 3v2a2 2 0 01-2 2h0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  nightlife: (c, sw, sc) => (
    <G>
      {/* Cocktail glass — V shape */}
      <Path d="M8 3h8l-3 8h-2L8 3z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      {/* Stem */}
      <Line x1="12" y1="11" x2="12" y2="17" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Base */}
      <Path d="M9 17h6" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Little star/sparkle */}
      <Path d="M18 6l.5-1.5L20 4l-1.5-.5L18 2l-.5 1.5L16 4l1.5.5L18 6z" fill={c} opacity={0.6} />
      {/* Olive/cherry */}
      <Circle cx="11" cy="7" r="1" fill={c} opacity={0.4} />
    </G>
  ),

  outdoors: (c, sw, sc) => (
    <G>
      {/* Sun — circle with short rays */}
      <Circle cx="12" cy="8" r="3" stroke={c} strokeWidth={sw} />
      <Path d="M12 2v1.5M12 12.5V14M6.5 8H5M19 8h-1.5M7.8 4.5l1 1M16.2 4.5l-1 1M7.8 11.5l1-1M16.2 11.5l-1-1" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.6} />
      {/* Ground/horizon with small hill */}
      <Path d="M3 18l4-4 3 2 4-5 4 3.5 3-1.5v5H3z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" fill="none" />
    </G>
  ),

  explore: (c, sw, sc) => (
    <G>
      {/* Compass outer ring */}
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
      {/* Compass diamond/arrow — pointing NE */}
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
      {/* Center dot */}
      <Circle cx="12" cy="12" r="1" fill={c} />
      {/* N marker */}
      <Path d="M12 3.5v0" stroke={c} strokeWidth={2.5} strokeLinecap={sc} />
    </G>
  ),

  hangout: (c, sw, sc) => (
    <G>
      {/* Two overlapping speech bubbles */}
      <Path d="M21 12a8.003 8.003 0 01-11.77 7.06L4 21l1.94-5.23A8 8 0 1121 12z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      {/* Three dots inside */}
      <Circle cx="8.5" cy="12" r="0.8" fill={c} />
      <Circle cx="12" cy="12" r="0.8" fill={c} />
      <Circle cx="15.5" cy="12" r="0.8" fill={c} />
    </G>
  ),

  work: (c, sw, sc) => (
    <G>
      {/* Laptop screen */}
      <Rect x="4" y="5" width="16" height="11" rx="1.5" stroke={c} strokeWidth={sw} />
      {/* Laptop base */}
      <Path d="M2 19h20" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Code brackets on screen */}
      <Path d="M9 9l-2 2 2 2M15 9l2 2-2 2" stroke={c} strokeWidth={1.3} strokeLinecap={sc} strokeLinejoin="round" opacity={0.5} />
    </G>
  ),

  /* ── Actions ── */

  timer: (c, sw, sc) => (
    <G>
      {/* Clock face */}
      <Circle cx="12" cy="13" r="8" stroke={c} strokeWidth={sw} />
      {/* Clock hands */}
      <Path d="M12 9v4l2.5 2.5" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Top button */}
      <Path d="M10 2h4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Line x1="12" y1="2" x2="12" y2="5" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  lightning: (c, sw, sc) => (
    <G>
      <Path d="M13 2L4.5 13H12l-1 9 8.5-11H12l1-9z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  zap: (c, sw, sc) => (
    <G>
      <Path d="M13 2L4.5 13H12l-1 9 8.5-11H12l1-9z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  heart: (c, sw, sc) => (
    <G>
      <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  'heart-filled': (c) => (
    <G>
      <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill={c} stroke={c} strokeWidth={1.2} />
    </G>
  ),

  send: (c, sw, sc) => (
    <G>
      <Path d="M22 2L11 13" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  chat: (c, sw, sc) => (
    <G>
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  'chat-group': (c, sw, sc) => (
    <G>
      <Path d="M17 18h1a2 2 0 002-2V8a2 2 0 00-2-2H8" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" opacity={0.4} />
      <Path d="M16 13a2 2 0 01-2 2H6l-3 3V5a2 2 0 012-2h9a2 2 0 012 2v8z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  search: (c, sw, sc) => (
    <G>
      <Circle cx="11" cy="11" r="7" stroke={c} strokeWidth={sw} />
      <Path d="M21 21l-4.35-4.35" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  bell: (c, sw, sc) => (
    <G>
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  'bell-active': (c, sw, sc) => (
    <G>
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="18" cy="4" r="3" fill="#E8614D" stroke="white" strokeWidth={1.5} />
    </G>
  ),

  camera: (c, sw, sc) => (
    <G>
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Circle cx="12" cy="13" r="4" stroke={c} strokeWidth={sw} />
    </G>
  ),

  image: (c, sw, sc) => (
    <G>
      <Rect x="3" y="3" width="18" height="18" rx="2" stroke={c} strokeWidth={sw} />
      <Circle cx="8.5" cy="8.5" r="1.5" fill={c} opacity={0.4} />
      <Path d="M21 15l-5-5L5 21" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  /* ── Location ── */

  pin: (c, sw, sc) => (
    <G>
      <Path d="M12 21s-7-5.75-7-10.5a7 7 0 0114 0C19 15.25 12 21 12 21z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Circle cx="12" cy="10.5" r="2.5" stroke={c} strokeWidth={sw} />
    </G>
  ),

  'pin-live': (c, sw, sc) => (
    <G>
      <Path d="M12 21s-7-5.75-7-10.5a7 7 0 0114 0C19 15.25 12 21 12 21z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Circle cx="12" cy="10.5" r="2.5" fill={c} stroke={c} strokeWidth={sw} />
      {/* Pulse rings */}
      <Circle cx="12" cy="10.5" r="5" stroke={c} strokeWidth={0.8} opacity={0.2} />
    </G>
  ),

  compass: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
    </G>
  ),

  crosshair: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="7" stroke={c} strokeWidth={sw} />
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  globe: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
      <Path d="M3.6 9h16.8M3.6 15h16.8" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.4} />
      <Path d="M12 3a15 15 0 014 9 15 15 0 01-4 9 15 15 0 01-4-9 15 15 0 014-9z" stroke={c} strokeWidth={sw} />
    </G>
  ),

  calendar: (c, sw, sc) => (
    <G>
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="8" cy="15" r="1" fill={c} opacity={0.4} />
      <Circle cx="12" cy="15" r="1" fill={c} opacity={0.4} />
      <Circle cx="16" cy="15" r="1" fill={c} opacity={0.4} />
    </G>
  ),

  clock: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
      <Path d="M12 7v5l3 3" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  /* ── People ── */

  user: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="8" r="4" stroke={c} strokeWidth={sw} />
      <Path d="M20 21a8 8 0 00-16 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  'user-plus': (c, sw, sc) => (
    <G>
      <Circle cx="10" cy="8" r="4" stroke={c} strokeWidth={sw} />
      <Path d="M18 21a8 8 0 00-16 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M20 8v4M18 10h4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  users: (c, sw, sc) => (
    <G>
      <Circle cx="9" cy="8" r="3.5" stroke={c} strokeWidth={sw} />
      <Path d="M17 21a8 8 0 00-16 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="17" cy="8" r="2.5" stroke={c} strokeWidth={1.2} opacity={0.5} />
      <Path d="M22 21a6 6 0 00-8-5.6" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.5} />
    </G>
  ),

  'users-3': (c, sw, sc) => (
    <G>
      {/* Left person */}
      <Circle cx="5.5" cy="7" r="2.3" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M1.5 20a4.5 4.5 0 019 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} fill="none" />
      {/* Right person */}
      <Circle cx="18.5" cy="7" r="2.3" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M14 20a4.5 4.5 0 019 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} fill="none" />
      {/* Center person (overlaps, slightly larger) */}
      <Circle cx="12" cy="6.5" r="2.8" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M6.5 20a5.5 5.5 0 0111 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} fill="none" />
    </G>
  ),

  star: (c, sw, sc) => (
    <G>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  'star-filled': (c) => (
    <G>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={c} stroke={c} strokeWidth={1.2} />
    </G>
  ),

  /* ── UI / Navigation ── */

  plus: (c, sw, sc) => (
    <G>
      <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  close: (c, sw, sc) => (
    <G>
      <Path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  back: (c, sw, sc) => (
    <G>
      <Path d="M15 18l-6-6 6-6" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  forward: (c, sw, sc) => (
    <G>
      <Path d="M9 18l6-6-6-6" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  check: (c, sw, sc) => (
    <G>
      <Path d="M20 6L9 17l-5-5" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  settings: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  edit: (c, sw, sc) => (
    <G>
      <Path d="M17 3a2.828 2.828 0 014 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  share: (c, sw, sc) => (
    <G>
      <Circle cx="18" cy="5" r="3" stroke={c} strokeWidth={sw} />
      <Circle cx="6" cy="12" r="3" stroke={c} strokeWidth={sw} />
      <Circle cx="18" cy="19" r="3" stroke={c} strokeWidth={sw} />
      <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  link: (c, sw, sc) => (
    <G>
      <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  lock: (c, sw, sc) => (
    <G>
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="12" cy="16" r="1" fill={c} />
    </G>
  ),

  unlock: (c, sw, sc) => (
    <G>
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M8 11V7a4 4 0 017.83-1" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="12" cy="16" r="1" fill={c} />
    </G>
  ),

  eye: (c, sw, sc) => (
    <G>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={sw} />
    </G>
  ),

  'eye-off': (c, sw, sc) => (
    <G>
      <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M1 1l22 22" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  /* ── Special / Nomad vibes ── */

  flame: (c, sw, sc) => (
    <G>
      <Path d="M12 22c-4.97 0-8-3.58-8-8 0-3.51 2.67-6.83 4-8 .52 2.81 3.07 4.47 4 5 1.03-1.75 2-4 2-6 2.78 2.16 6 5.81 6 9 0 4.42-3.03 8-8 8z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M12 22c-1.66 0-3-1.5-3-3.37 0-1.56 1.2-2.83 2-3.63.6 1.4 1.5 2.1 2 2.5.35-.6.7-1.2 1-2 .78.84 1 2.15 1 3.13 0 1.87-1.34 3.37-3 3.37z" stroke={c} strokeWidth={1.2} strokeLinecap={sc} strokeLinejoin="round" opacity={0.5} />
    </G>
  ),

  sparkle: (c, sw, sc) => (
    <G>
      {/* Main sparkle */}
      <Path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
      {/* Small sparkle */}
      <Path d="M19 17l.75 2.25L22 20l-2.25.75L19 23l-.75-2.25L16 20l2.25-.75L19 17z" stroke={c} strokeWidth={1.2} strokeLinejoin="round" opacity={0.5} />
    </G>
  ),

  wave: (c, sw, sc) => (
    <G>
      <Path d="M2 12c2-3 4-4 6-1s4 2 6-1 4-2 6 1" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M2 17c2-3 4-4 6-1s4 2 6-1 4-2 6 1" stroke={c} strokeWidth={sw} strokeLinecap={sc} opacity={0.4} />
      <Path d="M2 7c2-3 4-4 6-1s4 2 6-1 4-2 6 1" stroke={c} strokeWidth={sw} strokeLinecap={sc} opacity={0.4} />
    </G>
  ),

  sunrise: (c, sw, sc) => (
    <G>
      <Path d="M12 2v4M4.93 10.93l1.41 1.41M2 18h2M20 18h2M17.66 12.34l1.41-1.41" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M18 18a6 6 0 00-12 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M2 22h20" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  'moon-stars': (c, sw, sc) => (
    <G>
      <Path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M17 4l.6 1.8L19.4 6.4l-1.8.6L17 8.8l-.6-1.8L14.6 6.4l1.8-.6L17 4z" fill={c} opacity={0.4} />
    </G>
  ),

  /* ── Travel ── */

  backpack: (c, sw, sc) => (
    <G>
      <Rect x="6" y="8" width="12" height="14" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M9 8V5a3 3 0 016 0v3" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M6 14h12" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.3} />
      <Rect x="9" y="11" width="6" height="4" rx="1" stroke={c} strokeWidth={1.2} />
    </G>
  ),

  airplane: (c, sw, sc) => (
    <G>
      <Path d="M22 2L11 13" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M22 2l-7 20-4-9-9-4 20-7z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  surf: (c, sw, sc) => (
    <G>
      {/* Surfboard */}
      <Path d="M18 3c0 0 1 3 1 8s-1 10-1 10-1-5-1-10 1-8 1-8z" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      {/* Fin */}
      <Path d="M17 16l-2 2" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Wave */}
      <Path d="M2 18c2-2 4-2 6 0s4 2 6 0" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      {/* Person */}
      <Circle cx="9" cy="6" r="2" stroke={c} strokeWidth={sw} />
      <Path d="M9 8v4l-3 4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M9 10l4 2" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  music: (c, sw, sc) => (
    <G>
      <Path d="M9 18V5l12-2v13" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Circle cx="6" cy="18" r="3" stroke={c} strokeWidth={sw} />
      <Circle cx="18" cy="16" r="3" stroke={c} strokeWidth={sw} />
    </G>
  ),

  briefcase: (c, sw, sc) => (
    <G>
      <Rect x="2" y="7" width="20" height="14" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M2 13h20" stroke={c} strokeWidth={1.2} strokeLinecap={sc} opacity={0.3} />
    </G>
  ),

  laptop: (c, sw, sc) => (
    <G>
      <Rect x="3" y="4" width="18" height="12" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M1 20h22" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  trash: (c, sw, sc) => (
    <G>
      <Path d="M3 6h18" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M19 6l-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M10 11v5" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M14 11v5" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  grid: (c, sw, sc) => (
    <G>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth={sw} />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth={sw} />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth={sw} />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth={sw} />
    </G>
  ),

  copy: (c, sw, sc) => (
    <G>
      <Rect x="9" y="9" width="13" height="13" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  dots: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="1.5" fill={c} />
      <Circle cx="5" cy="12" r="1.5" fill={c} />
      <Circle cx="19" cy="12" r="1.5" fill={c} />
    </G>
  ),

  logout: (c, sw, sc) => (
    <G>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M16 17l5-5-5-5" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M21 12H9" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  refresh: (c, sw, sc) => (
    <G>
      <Path d="M21 2v6h-6" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M3 22v-6h6" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  alert: (c, sw, sc) => (
    <G>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
      <Path d="M12 9v4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="12" cy="17" r="0.5" fill={c} />
    </G>
  ),

  shield: (c, sw, sc) => (
    <G>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  gift: (c, sw, sc) => (
    <G>
      <Rect x="3" y="8" width="18" height="4" rx="1" stroke={c} strokeWidth={sw} />
      <Path d="M12 8v13" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M3 12h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
      <Path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 8 12 8" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M16.5 8a2.5 2.5 0 0 0 0-5C14.5 3 12 8 12 8" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  trending: (c, sw, sc) => (
    <G>
      <Path d="M23 6l-9.5 9.5-5-5L1 18" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M17 6h6v6" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  'at-sign': (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="4" stroke={c} strokeWidth={sw} />
      <Path d="M16 8v5a3 3 0 0 0 6 0V12a10 10 0 1 0-4 8" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  minus: (c, sw, sc) => (
    <G>
      <Path d="M5 12h14" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  'check-circle': (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
      <Path d="M9 12l2 2 4-4" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  target: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
      <Circle cx="12" cy="12" r="6" stroke={c} strokeWidth={sw} />
      <Circle cx="12" cy="12" r="2" stroke={c} strokeWidth={sw} />
    </G>
  ),

  paperclip: (c, sw, sc) => (
    <G>
      <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  info: (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
      <Path d="M12 16v-4" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Circle cx="12" cy="8" r="0.5" fill={c} />
    </G>
  ),

  phone: (c, sw, sc) => (
    <G>
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
    </G>
  ),

  mail: (c, sw, sc) => (
    <G>
      <Rect x="2" y="4" width="20" height="16" rx="2" stroke={c} strokeWidth={sw} />
      <Path d="M22 7l-10 6L2 7" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
    </G>
  ),

  'external-link': (c, sw, sc) => (
    <G>
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M15 3h6v6" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M10 14L21 3" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  'x-circle': (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
      <Path d="M15 9l-6 6" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M9 9l6 6" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  'plus-circle': (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} />
      <Path d="M12 8v8" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
      <Path d="M8 12h8" stroke={c} strokeWidth={sw} strokeLinecap={sc} />
    </G>
  ),

  inbox: (c, sw, sc) => (
    <G>
      <Path d="M22 12h-6l-2 3H10l-2-3H2" stroke={c} strokeWidth={sw} strokeLinecap={sc} strokeLinejoin="round" />
      <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
    </G>
  ),

  navigation: (c, sw, sc) => (
    <G>
      <Path d="M3 11l19-9-9 19-2-8-8-2z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
    </G>
  ),

  'more-vertical': (c, sw, sc) => (
    <G>
      <Circle cx="12" cy="5" r="1.5" fill={c} />
      <Circle cx="12" cy="12" r="1.5" fill={c} />
      <Circle cx="12" cy="19" r="1.5" fill={c} />
    </G>
  ),
};
