/**
 * AgeRangeControl — the ONLY age-range slider in the app.
 *
 * Used identically in:
 *   • SettingsScreen (creator age range)
 *   • OnboardingScreen (step 5)
 *   • CreationBubble WHO step
 *
 * Why one component:
 *   Before this refactor, each screen wired DualThumbSlider
 *   directly and tracked min/max in parent state. Every drag tick
 *   fired setState on a large parent (SettingsScreen has ~40
 *   other fields; HomeScreen has the whole map), which made the
 *   thumb feel stuck and jumpy on real devices. The fix is NOT
 *   a debounce on the save — the fix is to own the drag state
 *   locally so the parent stops re-rendering on every tick.
 *
 * Contract:
 *   - Internal state owns the visible position during a drag.
 *   - `onCommit(min, max)` fires 400 ms after the user stops
 *     dragging, with the final values. Caller writes to Supabase
 *     and/or updates its own state there.
 *   - `initialMin` / `initialMax` seed the internal state. If the
 *     parent pushes NEW initial values later (e.g. profile loads
 *     after mount), we sync — but only when the parent's seed
 *     actually changed, so an active drag never gets yanked.
 *   - The component also calls `bustViewerAgeCache()` after every
 *     commit so the map filter picks up the new preference on
 *     the next refetch. Settings / Onboarding don't have to
 *     remember this — it lives here because it's inseparable
 *     from writing these fields.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DualThumbSlider from './DualThumbSlider';
import { bustViewerAgeCache } from '../lib/hooks';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';

interface Props {
  /** Min age seed. Defaults to 18 when undefined. */
  initialMin?: number | null;
  /** Max age seed. Defaults to 100 when undefined. */
  initialMax?: number | null;
  /** Fires 400 ms after drag stops. Caller persists. */
  onCommit: (min: number, max: number) => void;
  /** Localized label shown above the slider ("age range").
   *  Pass empty string to suppress the row entirely when the
   *  parent already renders its own title. */
  label?: string;
  /** Wrap the slider in a soft grey rounded frame so it reads
   *  as a controlled field (default: true — matches Settings,
   *  Onboarding, CreationBubble). Set false if the surrounding
   *  screen already provides a container. */
  framed?: boolean;
}

const MIN = 18;
const MAX = 100;
const COMMIT_DELAY_MS = 400;

const clampMin = (v: number | null | undefined) =>
  Math.max(MIN, Math.min(MAX - 1, v ?? MIN));
const clampMax = (v: number | null | undefined) =>
  Math.max(MIN + 1, Math.min(MAX, v ?? MAX));

export default function AgeRangeControl({
  initialMin, initialMax, onCommit, label, framed = true,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [min, setMin] = useState(() => clampMin(initialMin));
  const [max, setMax] = useState(() => clampMax(initialMax));

  // Re-seed when the parent actually hands us a new initial
  // value (e.g. profile arrives post-mount). We compare against
  // the last seed we accepted so a drag tick in progress never
  // triggers a "re-sync" to its own in-flight value.
  const prevSeed = useRef<{ min: number | null | undefined; max: number | null | undefined }>({
    min: initialMin,
    max: initialMax,
  });
  useEffect(() => {
    if (prevSeed.current.min !== initialMin || prevSeed.current.max !== initialMax) {
      setMin(clampMin(initialMin));
      setMax(clampMax(initialMax));
      prevSeed.current = { min: initialMin, max: initialMax };
    }
  }, [initialMin, initialMax]);

  // Latest callback captured in a ref so we don't reschedule
  // commits every render.
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommitted = useRef<{ min: number; max: number }>({
    min: clampMin(initialMin),
    max: clampMax(initialMax),
  });

  const scheduleCommit = (nextMin: number, nextMax: number) => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      // Skip no-op commits — don't thrash the DB if the user
      // just tapped the thumb without actually moving it.
      if (
        lastCommitted.current.min === nextMin &&
        lastCommitted.current.max === nextMax
      ) {
        return;
      }
      lastCommitted.current = { min: nextMin, max: nextMax };
      bustViewerAgeCache();
      onCommitRef.current(nextMin, nextMax);
    }, COMMIT_DELAY_MS);
  };

  useEffect(() => () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
  }, []);

  const handleChangeMin = (v: number) => {
    setMin(v);
    scheduleCommit(v, max);
  };
  const handleChangeMax = (v: number) => {
    setMax(v);
    scheduleCommit(min, v);
  };

  const valueText = `${min}–${max >= MAX ? `${MAX}+` : max}`;

  const inner = (
    <>
      {label ? (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{valueText}</Text>
        </View>
      ) : null}
      <DualThumbSlider
        min={MIN}
        max={MAX}
        valueMin={min}
        valueMax={max}
        onChangeMin={handleChangeMin}
        onChangeMax={handleChangeMax}
        step={1}
        activeColor="#1A1A1A"
        thumbColor="#1A1A1A"
        labelFontSize={13}
      />
    </>
  );

  return framed ? (
    <View style={styles.frame}>{inner}</View>
  ) : (
    <View style={styles.flat}>{inner}</View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: s(5),
    backgroundColor: '#FAFAFA',
    paddingHorizontal: s(8),
    paddingTop: s(4),
    paddingBottom: s(2),
  },
  flat: {
    paddingVertical: s(2),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(2),
  },
  label: {
    fontSize: s(5.5),
    color: c.textMuted,
    fontWeight: FW.medium,
    letterSpacing: 0.1,
  },
  value: {
    fontSize: s(5.5),
    color: '#1A1A1A',
    fontWeight: FW.bold,
  },
});
