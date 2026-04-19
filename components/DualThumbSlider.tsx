import React, { useRef, useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent, findNodeHandle, UIManager, Platform } from 'react-native';
import { s, C, FW, useTheme, type ThemeColors } from '../lib/theme';

interface DualThumbSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
  step?: number;
  trackColor?: string;
  activeColor?: string;
  thumbColor?: string;
}

const THUMB_SIZE = s(14);
const TRACK_HEIGHT = s(1.5);
const HIT_EXTRA = s(10); // extra touch area around thumb

export default function DualThumbSlider({
  min, max, valueMin, valueMax,
  onChangeMin, onChangeMax,
  step = 1,
  trackColor,
  activeColor,
  thumbColor,
}: DualThumbSliderProps) {
  const { colors } = useTheme();
  const trackColorFinal = trackColor ?? '#E5E7EB';
  const activeColorFinal = activeColor ?? colors.primary;
  const thumbColorFinal = thumbColor ?? colors.primary;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const trackWidth = useRef(0);
  const trackPageX = useRef(0);
  const trackRef = useRef<View>(null);
  const [ready, setReady] = useState(false);

  // Keep current values in refs so PanResponder closures always see latest
  const valMinRef = useRef(valueMin);
  const valMaxRef = useRef(valueMax);
  valMinRef.current = valueMin;
  valMaxRef.current = valueMax;

  const onChangeMinRef = useRef(onChangeMin);
  const onChangeMaxRef = useRef(onChangeMax);
  onChangeMinRef.current = onChangeMin;
  onChangeMaxRef.current = onChangeMax;

  const pxToValue = useCallback((px: number) => {
    if (trackWidth.current === 0) return min;
    const ratio = Math.max(0, Math.min(1, px / trackWidth.current));
    const raw = min + ratio * (max - min);
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  }, [min, max, step]);

  const valueToPx = useCallback((value: number) => {
    if (trackWidth.current === 0) return 0;
    return ((value - min) / (max - min)) * trackWidth.current;
  }, [min, max]);

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width - THUMB_SIZE;
    setReady(true);
    // Measure absolute position on screen after layout settles
    setTimeout(() => {
      if (trackRef.current) {
        const handle = findNodeHandle(trackRef.current);
        if (handle) {
          UIManager.measure(handle, (_x, _y, _w, _h, pageX) => {
            trackPageX.current = pageX + THUMB_SIZE / 2;
          });
        }
      }
    }, 50);
  };

  // Convert screen touch X to track-relative px
  const touchToPx = (moveX: number) => moveX - trackPageX.current;

  // Re-measure on touch start (handles scroll offset changes)
  const remeasure = () => {
    if (trackRef.current) {
      const handle = findNodeHandle(trackRef.current);
      if (handle) {
        UIManager.measure(handle, (_x, _y, _w, _h, pageX) => {
          trackPageX.current = pageX + THUMB_SIZE / 2;
        });
      }
    }
  };

  // Min thumb
  const minPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { remeasure(); },
      onPanResponderMove: (evt) => {
        const px = touchToPx(evt.nativeEvent.pageX);
        const newVal = pxToValue(px);
        if (newVal < valMaxRef.current && newVal !== valMinRef.current) {
          onChangeMinRef.current(newVal);
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // Max thumb
  const maxPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { remeasure(); },
      onPanResponderMove: (evt) => {
        const px = touchToPx(evt.nativeEvent.pageX);
        const newVal = pxToValue(px);
        if (newVal > valMinRef.current && newVal !== valMaxRef.current) {
          onChangeMaxRef.current(newVal);
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  const leftPos = valueToPx(valueMin);
  const rightPos = valueToPx(valueMax);

  // Web: PanResponder can't handle mouse drag reliably through react-native-web,
  // so fall back to two native HTML <input type="range"> elements stacked.
  // They respond to mouse, trackpad, and keyboard (arrow keys) out of the box.
  if (Platform.OS === 'web') {
    const rangeStyle: any = {
      width: '100%',
      accentColor: activeColorFinal,
      cursor: 'pointer',
      height: 24,
    };
    const handleMinChange = (e: any) => {
      const v = Number(e.target.value);
      if (v < valueMax) onChangeMin(v);
      else onChangeMin(Math.max(min, valueMax - step));
    };
    const handleMaxChange = (e: any) => {
      const v = Number(e.target.value);
      if (v > valueMin) onChangeMax(v);
      else onChangeMax(Math.min(max, valueMin + step));
    };
    return (
      <View style={styles.container}>
        <View style={styles.labelsRow}>
          <Text style={[styles.label, { color: activeColorFinal }]}>{valueMin}</Text>
          <Text style={styles.dash}>—</Text>
          <Text style={[styles.label, { color: activeColorFinal }]}>
            {valueMax >= max ? `${max}+` : String(valueMax)}
          </Text>
        </View>
        <View style={styles.webRangesWrapper}>
          {React.createElement('input', {
            type: 'range', min, max, step, value: valueMin,
            onChange: handleMinChange, style: rangeStyle,
            'aria-label': 'Minimum age',
          })}
          {React.createElement('input', {
            type: 'range', min, max, step, value: valueMax,
            onChange: handleMaxChange, style: rangeStyle,
            'aria-label': 'Maximum age',
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Labels */}
      <View style={styles.labelsRow}>
        <Text style={[styles.label, { color: activeColorFinal }]}>{valueMin}</Text>
        <Text style={styles.dash}>—</Text>
        <Text style={[styles.label, { color: activeColorFinal }]}>
          {valueMax >= max ? `${max}+` : String(valueMax)}
        </Text>
      </View>

      {/* Track area */}
      <View
        ref={trackRef}
        style={styles.trackContainer}
        onLayout={onLayout}
      >
        {/* Background track */}
        <View style={[styles.track, { backgroundColor: trackColorFinal }]} />

        {ready && (
          <>
            {/* Active range highlight */}
            <View style={[
              styles.activeTrack,
              {
                backgroundColor: activeColorFinal,
                left: leftPos + THUMB_SIZE / 2,
                width: Math.max(0, rightPos - leftPos),
              },
            ]} />

            {/* Min thumb — large hit area wrapping the visible dot */}
            <View
              style={[styles.thumbHit, { left: leftPos - HIT_EXTRA / 2 }]}
              {...minPan.panHandlers}
            >
              <View style={[styles.thumb, { backgroundColor: thumbColorFinal }]}>
                <View style={styles.thumbInner} />
              </View>
            </View>

            {/* Max thumb */}
            <View
              style={[styles.thumbHit, { left: rightPos - HIT_EXTRA / 2 }]}
              {...maxPan.panHandlers}
            >
              <View style={[styles.thumb, { backgroundColor: thumbColorFinal }]}>
                <View style={styles.thumbInner} />
              </View>
            </View>
          </>
        )}
      </View>

    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: s(2),
    paddingVertical: s(4),
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(3),
    marginBottom: s(6),
  },
  label: {
    fontSize: s(11),
    fontWeight: FW.extra,
  },
  dash: {
    fontSize: s(7),
    color: '#CBD5E1',
    fontWeight: FW.medium,
  },
  trackContainer: {
    height: THUMB_SIZE + HIT_EXTRA,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    width: '100%',
  },
  activeTrack: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    top: (THUMB_SIZE + HIT_EXTRA - TRACK_HEIGHT) / 2,
  },
  thumbHit: {
    position: 'absolute',
    width: THUMB_SIZE + HIT_EXTRA,
    height: THUMB_SIZE + HIT_EXTRA,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbInner: {
    width: THUMB_SIZE * 0.35,
    height: THUMB_SIZE * 0.35,
    borderRadius: THUMB_SIZE * 0.175,
    backgroundColor: c.white,
  },
  webRangesWrapper: {
    gap: s(3),
    paddingTop: s(2),
  },
});
