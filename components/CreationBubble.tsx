/**
 * CreationBubble — unified status / timer creation flow.
 * ══════════════════════════════════════════════════════════════════
 *
 * The user creates a status or a timer by stepping through ONE
 * bubble that changes its contents in place:
 *
 *     1. WHAT   — what are you doing?  (clean input line, no noise)
 *     2. WHERE  — where? (default = GPS, tap-to-change opens pickMode)
 *     3. WHO    — with whom / how long / which age range
 *     4. PUBLISH — summary + single Publish button
 *
 * The bubble shell is the EXACT same `<Bubble/>` component used by
 * TimerBubble (the pin-tap popup). That gives us one consistent
 * visual language: what you upload is what people see when they
 * tap your pin. Same position, same shadow, same avatar overlap,
 * same rounded card. No new styles leak between "creating" and
 * "viewing" — they're one bubble with different content slots.
 *
 * Step 1 deliberately renders almost nothing: just the input
 * caret. The Continue button materializes ONLY after the user
 * types the first character. This matches the "clean page"
 * instruction from the product owner — step 1 must feel like a
 * blank canvas.
 *
 * Size: every step fills roughly the same vertical space as
 * TimerBubble's content (title + subtitle + members row + CTA),
 * so the bubble does NOT grow / shrink as the user progresses.
 * Consistent height across all four steps is a locked rule.
 *
 * RTL: layouts are written LTR; React Native's I18nManager flips
 * them automatically when the app is in Hebrew / Arabic mode.
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, Easing, Platform, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Bubble from './Bubble';
import NomadIcon from './NomadIcon';
import DualThumbSlider from './DualThumbSlider';
import { s, FW, useTheme, type ThemeColors } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import { detectCategories } from '../lib/categoryDetector';

export type CreationKind = 'status' | 'timer';
export type CreationStep = 'what' | 'where' | 'who' | 'publish';

/** Data emitted when the user hits Publish — identical shape to
 *  what QuickStatusSheet / TimerSheet used to emit, so the parent's
 *  existing handleQuickPublish / handleTimerPublish handlers keep
 *  working without changes. */
export interface CreationPayload {
  kind: CreationKind;
  text: string;
  category: string;
  emoji: string;
  locationName: string;
  latitude: number;
  longitude: number;
  ageMin: number;
  ageMax: number;
  /** Status only — whether the activity is open-join or requires
   *  creator approval. Ignored for timers (always open). */
  isOpen: boolean;
  /** Timer only — minutes. Ignored for status. */
  durationMinutes: number;
  /** Status only — scheduled date/time in ISO or null for "now". */
  scheduledFor: Date | null;
}

interface Props {
  visible: boolean;
  kind: CreationKind;
  /** User's avatar for the Bubble shell's overlap-on-top circle. */
  userAvatarUrl?: string | null;
  userFallback: string;
  userFallbackColor?: string;
  /** Seed location — where the user appears to be right now. If
   *  they don't touch "change location", this is what gets
   *  published. Usually the GPS from HomeScreen. */
  seedLat: number;
  seedLng: number;
  seedAddress: string;
  cityName: string;
  /** True while parent is actually saving to Supabase. Disables
   *  the Publish button and swaps it for a spinner. */
  publishing?: boolean;
  /** Parent closes the bubble (tap on backdrop or Cancel). */
  onClose: () => void;
  /** Parent should open HomeScreen's pickMode map overlay. When
   *  the user commits or cancels the pick, the parent calls back
   *  into this component via `updateLocation` (received as a
   *  ref). Keeping this as a two-step protocol means the bubble
   *  doesn't have to own a MapView — one map, one pipeline. */
  onRequestLocationPick: (current: { lat: number; lng: number; address: string }) => void;
  /** Called when the user hits Publish on the final step. Parent
   *  inserts the checkin and (optionally) calls onClose when done. */
  onPublish: (data: CreationPayload) => void;
  /** If the parent wants to push a new location into the bubble
   *  (e.g. after pickMode commits), it assigns this ref's current
   *  to the updater function. The bubble fills it on mount. */
  locationUpdaterRef?: React.MutableRefObject<((loc: { lat: number; lng: number; address: string }) => void) | null>;
}

/* ─── Category emoji lookup — matches QuickStatusSheet's existing
 *     categoryDetector output so "coffee" → ☕ etc. */
const CATEGORY_EMOJI: Record<string, string> = {
  coffee: '☕', food: '🍽️', nightlife: '🎉', outdoors: '🥾',
  sightseeing: '🗿', entertainment: '🎬', shopping: '🛍️',
  wellness: '🧘', rideshare: '🚗', social: '💬', work: '💻',
  beach: '🏖', sport: '🏃', bar: '🍺', other: '✨',
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export default function CreationBubble({
  visible, kind, userAvatarUrl, userFallback, userFallbackColor,
  seedLat, seedLng, seedAddress, cityName, publishing,
  onClose, onRequestLocationPick, onPublish, locationUpdaterRef,
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const st = useMemo(() => styles(colors), [colors]);

  /* ── Step + per-field state ── */
  const [step, setStep] = useState<CreationStep>('what');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [emoji, setEmoji] = useState<string>('✨');
  const [lat, setLat] = useState(seedLat);
  const [lng, setLng] = useState(seedLng);
  const [address, setAddress] = useState(seedAddress);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(80);
  const [isOpen, setIsOpen] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(60);

  const textInputRef = useRef<TextInput>(null);

  /* ── Reset every time the bubble opens afresh ── */
  useEffect(() => {
    if (visible) {
      setStep('what');
      setText('');
      setCategory('other');
      setEmoji('✨');
      setLat(seedLat);
      setLng(seedLng);
      setAddress(seedAddress);
      setAgeMin(18);
      setAgeMax(80);
      setIsOpen(true);
      setDurationMinutes(60);
      // Auto-focus the input on step 1 — users expect the keyboard
      // the moment a creation bubble opens.
      setTimeout(() => textInputRef.current?.focus(), 180);
    }
  }, [visible, seedLat, seedLng, seedAddress]);

  /* ── Expose a location updater so the parent (HomeScreen) can
   *    push the result of pickMode back into the bubble without
   *    unmounting it. */
  useEffect(() => {
    if (!locationUpdaterRef) return;
    locationUpdaterRef.current = (loc) => {
      setLat(loc.lat);
      setLng(loc.lng);
      setAddress(loc.address || cityName);
    };
    return () => {
      if (locationUpdaterRef) locationUpdaterRef.current = null;
    };
  }, [locationUpdaterRef, cityName]);

  /* ── Category autodetect from the typed text ── */
  const handleTextChange = useCallback((next: string) => {
    setText(next);
    const detected = detectCategories(next);
    if (detected.length > 0) {
      const first = detected[0];
      setCategory(first.key);
      setEmoji(first.emoji || CATEGORY_EMOJI[first.key] || '✨');
    } else {
      setCategory('other');
      setEmoji('✨');
    }
  }, []);

  const canContinueFromWhat = text.trim().length > 0;

  /* ── Step transitions — always with a light haptic so the
   *    change of contents feels intentional, not a glitch. */
  const goTo = useCallback((next: CreationStep) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(next);
  }, []);

  const handleContinueFromWhat = () => {
    if (!canContinueFromWhat) return;
    goTo('where');
  };

  const handleTapLocation = () => {
    // Hand off to the parent to open pickMode on the main map. The
    // parent is responsible for closing / re-opening our bubble
    // around the pick, and will push the new coords back via
    // locationUpdaterRef.
    onRequestLocationPick({ lat, lng, address });
  };

  const handleContinueFromWhere = () => {
    goTo('who');
  };

  const handleContinueFromWho = () => {
    goTo('publish');
  };

  const handlePublish = () => {
    if (publishing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPublish({
      kind,
      text: text.trim(),
      category,
      emoji,
      locationName: address || cityName,
      latitude: lat,
      longitude: lng,
      ageMin, ageMax,
      isOpen,
      durationMinutes,
      scheduledFor: null, // scheduling handled by a future step or sheet
    });
  };

  const handleBack = () => {
    if (step === 'what') return onClose();
    if (step === 'where') return goTo('what');
    if (step === 'who') return goTo('where');
    if (step === 'publish') return goTo('who');
  };

  /* ══════════════════════════════════════════════════════════════
     STEP RENDERERS — each fills the same bubble shell.
     ══════════════════════════════════════════════════════════ */

  const renderWhat = () => (
    <View style={st.stepBody}>
      {/* Clean canvas — only the input line sits in the middle.
          No back button, no step indicator, no labels. Just cursor.
          This is the "blank page" the product owner asked for. */}
      <TextInput
        ref={textInputRef}
        style={st.whatInput}
        value={text}
        onChangeText={handleTextChange}
        placeholder={kind === 'timer'
          ? t('creation.what.timerPlaceholder')
          : t('creation.what.statusPlaceholder')}
        placeholderTextColor={colors.textFaint}
        multiline
        textAlignVertical="center"
        autoFocus
        returnKeyType="done"
        blurOnSubmit
      />

      {/* Continue button — appears only once the user has typed
          a character. Fades in, doesn't push layout. */}
      <View style={st.whatCtaSlot}>
        {canContinueFromWhat && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleContinueFromWhat}
            style={[st.cta, st.ctaJoin]}
          >
            <Text style={st.ctaText}>{t('creation.continue')}</Text>
            <NomadIcon name="forward" size={s(6)} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderWhere = () => (
    <View style={st.stepBody}>
      {/* Echo of what the user typed — a small quote at the top
          so they remember what they're locating. Same font rhythm
          as TimerBubble's title but smaller; it's context, not
          the star of the step. */}
      <Text style={st.stepEcho} numberOfLines={2}>"{text.trim()}"</Text>

      {/* Where pill — the default is "here" (seed location). Tap
          to open the main map's pickMode for a different spot. */}
      <Text style={st.stepLabel}>{t('creation.where.label')}</Text>
      <TouchableOpacity
        style={[st.locationPill, { borderColor: colors.borderSoft, backgroundColor: colors.surface }]}
        activeOpacity={0.7}
        onPress={handleTapLocation}
      >
        <NomadIcon name="pin" size={s(7)} color={colors.primary} strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <Text style={[st.locationAddress, { color: colors.dark }]} numberOfLines={1}>
            {address || cityName || t('creation.where.fallback')}
          </Text>
          <Text style={[st.locationHint, { color: colors.textMuted }]}>
            {t('creation.where.tapToChange')}
          </Text>
        </View>
        <NomadIcon name="forward" size={s(5)} color={colors.textMuted} strokeWidth={1.6} />
      </TouchableOpacity>

      <View style={st.rowCtaWrap}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={[st.cta, st.ctaGhost, { flex: 1, borderColor: colors.borderSoft }]}
        >
          <Text style={[st.ctaText, { color: colors.textMuted }]}>{t('creation.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContinueFromWhere}
          style={[st.cta, st.ctaJoin, { flex: 2 }]}
        >
          <Text style={st.ctaText}>{t('creation.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderWho = () => (
    <View style={st.stepBody}>
      <Text style={st.stepEcho} numberOfLines={1}>"{text.trim()}"</Text>

      {kind === 'timer' ? (
        <>
          <Text style={st.stepLabel}>{t('creation.who.duration')}</Text>
          <View style={st.chipWrap}>
            {DURATION_PRESETS.map((mins) => {
              const active = durationMinutes === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDurationMinutes(mins);
                  }}
                  style={[
                    st.chip,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    st.chipText,
                    { color: active ? '#fff' : colors.dark },
                  ]}>
                    {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 ? `${mins % 60}m` : ''}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <Text style={st.stepLabel}>{t('creation.who.audience')}</Text>
          <View style={st.chipWrap}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setIsOpen(true); }}
              style={[st.chip, isOpen && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={[st.chipText, { color: isOpen ? '#fff' : colors.dark }]}>
                {t('creation.who.openAll')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setIsOpen(false); }}
              style={[st.chip, !isOpen && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={[st.chipText, { color: !isOpen ? '#fff' : colors.dark }]}>
                {t('creation.who.private')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={[st.stepLabel, { marginTop: 14 }]}>
        {t('creation.who.ageRange')} · {ageMin}–{ageMax}
      </Text>
      <View style={{ paddingHorizontal: 6 }}>
        <DualThumbSlider
          min={18} max={80}
          valueMin={ageMin} valueMax={ageMax}
          onChangeMin={setAgeMin} onChangeMax={setAgeMax}
        />
      </View>

      <View style={st.rowCtaWrap}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={[st.cta, st.ctaGhost, { flex: 1, borderColor: colors.borderSoft }]}
        >
          <Text style={[st.ctaText, { color: colors.textMuted }]}>{t('creation.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContinueFromWho}
          style={[st.cta, st.ctaJoin, { flex: 2 }]}
        >
          <Text style={st.ctaText}>{t('creation.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPublish = () => {
    const whoSummary = kind === 'timer'
      ? (durationMinutes < 60 ? `${durationMinutes}m` : `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? `${durationMinutes % 60}m` : ''}`)
      : (isOpen ? t('creation.who.openAll') : t('creation.who.private'));
    return (
      <View style={st.stepBody}>
        <Text style={st.publishTitle} numberOfLines={2}>
          {emoji} {text.trim()}
        </Text>
        <View style={st.summaryRow}>
          <SummaryPill icon="pin" text={address || cityName} colors={colors} />
          <SummaryPill
            icon={kind === 'timer' ? 'timer' : 'users'}
            text={whoSummary}
            colors={colors}
          />
          <SummaryPill icon="users" text={`${ageMin}–${ageMax}`} colors={colors} />
        </View>

        <View style={st.rowCtaWrap}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            disabled={publishing}
            style={[st.cta, st.ctaGhost, { flex: 1, borderColor: colors.borderSoft, opacity: publishing ? 0.5 : 1 }]}
          >
            <Text style={[st.ctaText, { color: colors.textMuted }]}>{t('creation.back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePublish}
            disabled={publishing}
            style={[st.cta, st.ctaJoin, { flex: 2, opacity: publishing ? 0.7 : 1 }]}
          >
            {publishing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <NomadIcon name="zap" size={s(6)} color="#fff" strokeWidth={1.8} />
                <Text style={st.ctaText}>{t('creation.publish')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Bubble
      visible={visible}
      avatarUrl={userAvatarUrl || null}
      avatarFallback={userFallback}
      avatarFallbackColor={userFallbackColor || colors.primary}
      onDismiss={onClose}
    >
      {step === 'what' && renderWhat()}
      {step === 'where' && renderWhere()}
      {step === 'who' && renderWho()}
      {step === 'publish' && renderPublish()}
    </Bubble>
  );
}

/* ─── Small inline helper: pill showing one summary field ─── */
function SummaryPill({
  icon, text, colors,
}: {
  icon: 'pin' | 'timer' | 'users';
  text: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[summaryPillStyles.pill, { backgroundColor: colors.pill, borderColor: colors.borderSoft }]}>
      <NomadIcon name={icon} size={s(5)} color={colors.dark} strokeWidth={1.6} />
      <Text style={[summaryPillStyles.text, { color: colors.dark }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const summaryPillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 0.5,
    maxWidth: '100%',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});

/* ─── Bubble content styles ───
 *
 * The numbers below are sized to match TimerBubble's vertical
 * rhythm: ~22px title → 14px step label → body → CTA. Keep this
 * file in lock-step with TimerBubble's styles block — if that
 * file's paddings change, mirror them here. */
const styles = (c: ThemeColors) => StyleSheet.create({
  stepBody: {
    width: '100%',
    alignItems: 'stretch',
    // Min height roughly matches TimerBubble's content block so
    // the bubble's total height stays stable across all four
    // steps. No jumpy reflows between WHAT and PUBLISH.
    minHeight: 180,
  },

  /* STEP 1 — clean canvas */
  whatInput: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    minHeight: 90,
    maxHeight: 140,
    paddingHorizontal: 4,
    paddingVertical: 8,
    // No border — feels like a blank page, not a form field.
  },
  whatCtaSlot: {
    // Fixed height slot so the Continue button appearing doesn't
    // bounce the layout when it materializes.
    minHeight: 52,
    justifyContent: 'flex-end',
    marginTop: 8,
  },

  /* Steps 2–4 — shared framing */
  stepEcho: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  stepLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },

  /* Location pill (step WHERE) */
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 20,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '700',
  },
  locationHint: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },

  /* Chips (step WHO) */
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 10,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Summary (step PUBLISH) */
  publishTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
  },

  /* CTA row — matches TimerBubble's CTA exactly (coral, 14 radius,
     white bold lowercase text). */
  rowCtaWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  ctaJoin: {
    backgroundColor: '#E8614D',
    shadowColor: '#E8614D',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  ctaGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
});
