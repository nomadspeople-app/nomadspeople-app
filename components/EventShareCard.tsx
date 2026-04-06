/**
 * EventShareCard — A beautiful card component for sharing events to Instagram Stories.
 *
 * Dimensions: 1080x1920 (Instagram Story size)
 * Designed to be rendered off-screen and captured via react-native-view-shot.
 *
 * Usage:
 *   const ref = useRef<ViewShot>(null);
 *   <EventShareCard
 *     ref={ref}
 *     emoji="☕"
 *     activityText="Coffee Meetup"
 *     locationName="Downtown Cafe"
 *     category="coffee"
 *     memberCount={8}
 *     creatorName="Alex"
 *     dateText="Tomorrow at 3pm"
 *   />
 *   // Then capture: captureCard(ref)
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { s, FW, useTheme } from '../lib/theme';

export interface EventShareCardProps {
  emoji: string;
  activityText: string;
  locationName?: string;
  category?: string;
  memberCount?: number;
  creatorName?: string;
  dateText?: string;
  countdownText?: string;
}

/* ─── Category color mapping ─── */
const CATEGORY_COLORS: Record<string, string> = {
  coffee: '#8B6914',
  food: '#D4603A',
  nightlife: '#9333EA',
  outdoors: '#059669',
  sightseeing: '#7C3AED',
  entertainment: '#EC4899',
  shopping: '#F97316',
  wellness: '#06B6D4',
  rideshare: '#3B82F6',
  social: '#A855F7',
  work: '#6366F1',
  beach: '#14B8A6',
  sport: '#EF4444',
  bar: '#F59E0B',
  other: '#6B7280',
};

function getCategoryColor(category?: string): string {
  if (!category) return '#6B7280';
  return CATEGORY_COLORS[category] || '#6B7280';
}

/* ─── Instagram Story dimensions (1080x1920 base, scaled for device) ─── */
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const DEVICE_WIDTH = Dimensions.get('window').width;
const SCALE_FACTOR = DEVICE_WIDTH / STORY_WIDTH;

const makeStyles = (bgColor: string) =>
  StyleSheet.create({
    container: {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      backgroundColor: bgColor,
      justifyContent: 'space-between',
      paddingVertical: s(60) / SCALE_FACTOR,
      paddingHorizontal: s(50) / SCALE_FACTOR,
    },
    header: {
      alignItems: 'center',
      marginTop: s(40) / SCALE_FACTOR,
    },
    logo: {
      fontSize: s(14) / SCALE_FACTOR,
      fontWeight: FW.bold,
      color: '#FFFFFF',
      letterSpacing: 2,
      textTransform: 'lowercase',
    },
    emojiSection: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      marginVertical: s(60) / SCALE_FACTOR,
    },
    emoji: {
      fontSize: s(180) / SCALE_FACTOR,
      marginBottom: s(30) / SCALE_FACTOR,
    },
    activityText: {
      fontSize: s(72) / SCALE_FACTOR,
      fontWeight: FW.bold,
      color: '#FFFFFF',
      textAlign: 'center',
      lineHeight: s(85) / SCALE_FACTOR,
      marginBottom: s(20) / SCALE_FACTOR,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: s(20) / SCALE_FACTOR,
      marginBottom: s(50) / SCALE_FACTOR,
    },
    locationPin: {
      fontSize: s(18) / SCALE_FACTOR,
      marginRight: s(8) / SCALE_FACTOR,
    },
    locationText: {
      fontSize: s(28) / SCALE_FACTOR,
      fontWeight: FW.medium,
      color: 'rgba(255,255,255,0.9)',
    },
    metaSection: {
      alignItems: 'center',
      marginBottom: s(40) / SCALE_FACTOR,
    },
    metaText: {
      fontSize: s(20) / SCALE_FACTOR,
      fontWeight: FW.medium,
      color: 'rgba(255,255,255,0.85)',
      marginBottom: s(10) / SCALE_FACTOR,
      textAlign: 'center',
    },
    creatorText: {
      fontSize: s(18) / SCALE_FACTOR,
      fontWeight: FW.regular,
      color: 'rgba(255,255,255,0.75)',
      marginBottom: s(8) / SCALE_FACTOR,
    },
    footer: {
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
      paddingTop: s(25) / SCALE_FACTOR,
    },
    footerText: {
      fontSize: s(20) / SCALE_FACTOR,
      fontWeight: FW.bold,
      color: '#FFFFFF',
      marginBottom: s(12) / SCALE_FACTOR,
    },
    qrPattern: {
      width: s(60) / SCALE_FACTOR,
      height: s(60) / SCALE_FACTOR,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: s(8) / SCALE_FACTOR,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrDot: {
      width: s(8) / SCALE_FACTOR,
      height: s(8) / SCALE_FACTOR,
      backgroundColor: '#FFFFFF',
      borderRadius: s(4) / SCALE_FACTOR,
      margin: s(3) / SCALE_FACTOR,
    },
  });

const QRPattern = ({ color: bgColor }: { color?: string }) => {
  const st = useMemo(() => makeStyles(bgColor || '#6B7280'), [bgColor]);

  return (
    <View style={st.qrPattern}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
        <View style={st.qrDot} />
        <View style={st.qrDot} />
        <View style={st.qrDot} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
        <View style={st.qrDot} />
        <View style={st.qrDot} />
        <View style={st.qrDot} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
        <View style={st.qrDot} />
        <View style={st.qrDot} />
        <View style={st.qrDot} />
      </View>
    </View>
  );
};

const EventShareCard = React.forwardRef<View, EventShareCardProps>(
  (
    {
      emoji,
      activityText,
      locationName,
      category,
      memberCount,
      creatorName,
      dateText,
      countdownText,
    },
    ref
  ) => {
    const bgColor = getCategoryColor(category);
    const st = useMemo(() => makeStyles(bgColor), [bgColor]);

    return (
      <View ref={ref} style={st.container}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.logo}>nomadspeople</Text>
        </View>

        {/* Emoji & Activity Name */}
        <View style={st.emojiSection}>
          <Text style={st.emoji}>{emoji}</Text>
          <Text style={st.activityText}>{activityText}</Text>

          {/* Location */}
          {locationName && (
            <View style={st.locationRow}>
              <Text style={st.locationPin}>📍</Text>
              <Text style={st.locationText}>{locationName}</Text>
            </View>
          )}
        </View>

        {/* Meta Info */}
        <View style={st.metaSection}>
          {dateText && <Text style={st.metaText}>{dateText}</Text>}
          {countdownText && <Text style={st.metaText}>{countdownText}</Text>}

          {memberCount !== undefined && (
            <Text style={st.metaText}>{memberCount} nomads joined</Text>
          )}

          {creatorName && <Text style={st.creatorText}>Created by {creatorName}</Text>}
        </View>

        {/* Footer */}
        <View style={st.footer}>
          <Text style={st.footerText}>Join the adventure</Text>
          <Text style={[st.footerText, { fontSize: s(16) / SCALE_FACTOR, marginBottom: s(10) / SCALE_FACTOR }]}>
            nomadspeople.com
          </Text>
          <QRPattern color={bgColor} />
        </View>
      </View>
    );
  }
);

EventShareCard.displayName = 'EventShareCard';

export default EventShareCard;
