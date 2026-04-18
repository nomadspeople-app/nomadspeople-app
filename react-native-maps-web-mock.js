// Web-only stub for `react-native-maps`.
// react-native-maps is native-only — on web it crashes the bundler.
// This file is aliased in metro.config.js ONLY when platform === 'web'.
// Native builds (iOS / Android / Expo Go) are unaffected.

import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const noop = () => {};
const asyncNoop = async () => ({});

const MapView = forwardRef(function MapViewWebStub(props, ref) {
  useImperativeHandle(ref, () => ({
    animateToRegion: noop,
    animateCamera: noop,
    fitToCoordinates: noop,
    fitToElements: noop,
    setCamera: noop,
    getCamera: asyncNoop,
    getMapBoundaries: async () => ({
      northEast: { latitude: 0, longitude: 0 },
      southWest: { latitude: 0, longitude: 0 },
    }),
  }));

  return (
    <View style={[styles.placeholder, props.style]}>
      <Text style={styles.text}>Map preview is not available on web</Text>
      <Text style={styles.hint}>(open the app on your phone to see the map)</Text>
      {props.children}
    </View>
  );
});

// Named exports used across the app
export const Marker = () => null;
export const Circle = () => null;
export const Callout = () => null;
export const Polyline = () => null;
export const Polygon = () => null;
export const Overlay = () => null;

// Map provider constants (some code references PROVIDER_GOOGLE / PROVIDER_DEFAULT)
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    padding: 16,
  },
  text: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});

export default MapView;
