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
// Address autocomplete uses the same Photon-backed helper that the
// map's pickMode search bar uses. One module, one set of results.
import { searchAddress as searchPhotonAddress, type GeoResult } from '../lib/locationServices';

export type CreationKind = 'status' | 'timer';
export type CreationStep = 'what' | 'when' | 'where' | 'who' | 'publish';

/** The user's "when?" answer — decides the server-side kind (timer
 *  vs status) and the expires_at math:
 *    - 'now'   → timer,   expires_at = now + durationMinutes
 *    - 'today' → status, flexible, expires_at = today 23:59
 *    - 'later' → status, scheduled at pickedDate/Time */
export type WhenChoice = 'now' | 'today' | 'later';

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
  /** First name of the logged-in user — goes into the WHAT step's
   *  personalized prompt "what are you up to, <Name>?". Rendered
   *  in Facebook blue so the user feels addressed by the app
   *  instead of filling out a generic form. */
  userName: string;
  /** Monotonically increasing token. The bubble resets its
   *  internal state ONLY when this value changes, NOT every time
   *  `visible` flips to true. That lets the parent hide + reopen
   *  the bubble around a pickMode round-trip without losing the
   *  user's text / category / age / duration. Parent increments
   *  it on fresh open (button tap); leaves it alone on restore. */
  sessionKey: number;
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

// Duration presets for the Timer flow — start at 30 min (15 min
// is too short to be useful for a "I'm at X for a while" signal)
// and top out at 120. Five options, all fit in one row.
const DURATION_PRESETS = [30, 45, 60, 90, 120];

export default function CreationBubble({
  visible, userName, sessionKey, userAvatarUrl, userFallback, userFallbackColor,
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

  /* When — drives whether the published checkin is a timer or a
   * scheduled status. Defaults to "now" so a user who does
   * nothing in the WHEN step gets the fastest, most common
   * outcome (1-hour timer right here, right now). */
  const [whenChoice, setWhenChoice] = useState<WhenChoice>('now');
  /** Only used when whenChoice === 'later'. Null means the user
   *  has not picked a time yet (Continue stays disabled). */
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  /* Address autocomplete state (WHERE step, row 2) */
  const [addressFocused, setAddressFocused] = useState(false);
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  /* ── Reset only when a FRESH session starts ──
   *
   * Keyed off `sessionKey`, NOT `visible`. Parent hides the
   * bubble (visible=false) while a pickMode round-trip runs on
   * the main map, then re-shows (visible=true) with the same
   * sessionKey to restore. Without this the old useEffect
   * reset text / category / age / duration on every such
   * restore and the user had to start over — exactly the bug
   * the product owner reported. */
  const lastSessionKey = useRef<number>(-1);
  useEffect(() => {
    if (!visible) return;
    if (sessionKey === lastSessionKey.current) return;
    lastSessionKey.current = sessionKey;
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
    setWhenChoice('now');
    setScheduledAt(null);
    // Auto-focus the input on step 1 — users expect the keyboard
    // the moment a creation bubble opens.
    setTimeout(() => textInputRef.current?.focus(), 180);
  }, [visible, sessionKey, seedLat, seedLng, seedAddress]);

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

  /* ── Address autocomplete (WHERE step, row 2) ──
   *
   * When the user types into the address input, we debounce a
   * Photon call (via the shared lib/locationServices helper) and
   * show the top results as a dropdown. Tapping a result updates
   * the bubble's lat/lng/address in one shot — no need to open
   * the full map for a known-name location. The map pill above
   * is still there for pan-to-pick. */
  const onAddressChange = useCallback((next: string) => {
    setAddress(next);
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (next.trim().length < 2) {
      setAddressResults([]);
      setAddressSearching(false);
      return;
    }
    setAddressSearching(true);
    addressSearchTimer.current = setTimeout(async () => {
      const results = await searchPhotonAddress(next.trim(), lat, lng, cityName);
      setAddressResults(results);
      setAddressSearching(false);
    }, 300);
  }, [lat, lng, cityName]);

  /** Tap a result → pin moves there, input closes, dropdown hides. */
  const onAddressPick = useCallback((r: GeoResult) => {
    const nextLat = parseFloat(r.lat);
    const nextLng = parseFloat(r.lon);
    if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
      setLat(nextLat);
      setLng(nextLng);
    }
    setAddress(r.subLine ? `${r.mainLine}, ${r.subLine}` : r.mainLine || r.display_name);
    setAddressResults([]);
    setAddressSearching(false);
    setAddressFocused(false);
    addressInputRef.current?.blur();
    Haptics.selectionAsync().catch(() => {});
  }, []);

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
    goTo('when');
  };

  const handleContinueFromWhen = () => {
    // "Later" requires a concrete scheduled date to advance.
    if (whenChoice === 'later' && !scheduledAt) return;
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

  /** Map the user's WHEN answer to the server-side shape. Timer vs
   *  status is derived, not pre-selected — the user never has to
   *  know the distinction exists. */
  const derivePublishPayload = (): CreationPayload => {
    let derivedKind: CreationKind;
    let derivedScheduledFor: Date | null;
    if (whenChoice === 'now') {
      derivedKind = 'timer';
      derivedScheduledFor = null;
    } else if (whenChoice === 'today') {
      derivedKind = 'status';
      // End-of-day — flexible window, no specific hour.
      const eod = new Date();
      eod.setHours(23, 59, 59, 999);
      derivedScheduledFor = eod;
    } else {
      derivedKind = 'status';
      derivedScheduledFor = scheduledAt;
    }
    return {
      kind: derivedKind,
      text: text.trim(),
      category,
      emoji,
      locationName: address || cityName,
      latitude: lat,
      longitude: lng,
      ageMin, ageMax,
      isOpen,
      durationMinutes,
      scheduledFor: derivedScheduledFor,
    };
  };

  const handlePublish = () => {
    if (publishing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPublish(derivePublishPayload());
  };

  const handleBack = () => {
    if (step === 'what') return onClose();
    if (step === 'when') return goTo('what');
    if (step === 'where') return goTo('when');
    if (step === 'who') return goTo('where');
    if (step === 'publish') return goTo('who');
  };

  /* ══════════════════════════════════════════════════════════════
     STEP RENDERERS — each fills the same bubble shell.
     ══════════════════════════════════════════════════════════ */

  const renderWhat = () => (
    <View style={st.stepBody}>
      {/* Personalized prompt — addresses the user by first name in
          Facebook blue. Stays above the input so the name is
          always visible, even while typing. The prompt is the only
          "chrome" on step 1; no back button, no step indicator,
          just their name and a blank canvas to express themselves. */}
      <Text style={st.whatPrompt}>
        {t('creation.what.promptPrefix')}
        <Text style={st.whatPromptName}>{userName || t('creation.what.promptNameFallback')}</Text>
        {t('creation.what.promptSuffix')}
      </Text>
      <TextInput
        ref={textInputRef}
        style={st.whatInput}
        value={text}
        onChangeText={handleTextChange}
        placeholder={t('creation.what.placeholder')}
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

  /* ═══ WHEN — the choice that drives timer vs. status ═══
   *
   * Three chips. User picks one, Continue advances. "Later" also
   * reveals a compact picker for the specific time; until a valid
   * time is set the Continue button stays disabled. */
  const renderWhen = () => {
    const chips: { key: WhenChoice; label: string; sub: string }[] = [
      { key: 'now',   label: t('creation.when.now'),   sub: t('creation.when.nowSub') },
      { key: 'today', label: t('creation.when.today'), sub: t('creation.when.todaySub') },
      { key: 'later', label: t('creation.when.later'), sub: t('creation.when.laterSub') },
    ];
    return (
      <View style={st.stepBody}>
        <Text style={st.stepEcho} numberOfLines={1}>"{text.trim()}"</Text>
        <Text style={st.stepLabel}>{t('creation.when.label')}</Text>
        <View style={st.whenList}>
          {chips.map((c) => {
            const active = whenChoice === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setWhenChoice(c.key);
                }}
                activeOpacity={0.8}
                style={[
                  st.whenRow,
                  { borderColor: active ? colors.primary : colors.borderSoft, backgroundColor: colors.card },
                  active && { borderWidth: 1.5 },
                ]}
              >
                <View style={[st.whenRadio, { borderColor: active ? colors.primary : colors.borderSoft }]}>
                  {active && <View style={[st.whenRadioDot, { backgroundColor: colors.primary }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.whenRowLabel, { color: colors.dark }]}>{c.label}</Text>
                  <Text style={[st.whenRowSub, { color: colors.textMuted }]}>{c.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
            onPress={handleContinueFromWhen}
            disabled={whenChoice === 'later' && !scheduledAt}
            style={[
              st.cta,
              st.ctaJoin,
              { flex: 2 },
              whenChoice === 'later' && !scheduledAt && { opacity: 0.5 },
            ]}
          >
            <Text style={st.ctaText}>{t('creation.continue')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWhere = () => {
    // When the user is actively typing an address, hide the echo
    // + "set pin" row to free vertical space for the search
    // dropdown. Preserving the fixed bubble height is the rule,
    // so the only way to make room is to hide less-relevant rows
    // while the dropdown is active.
    const compact = addressFocused;
    const showDropdown = addressFocused && (addressSearching || addressResults.length > 0);
    return (
      <View style={st.stepBody}>
        {!compact && (
          <Text style={st.stepEcho} numberOfLines={2}>"{text.trim()}"</Text>
        )}
        <Text style={st.stepLabel}>{t('creation.where.label')}</Text>

        {/* Row 1 — "Set pin on map". Hidden while typing an
            address so the dropdown has room. */}
        {!compact && (
          <TouchableOpacity
            style={[st.locationPill, { borderColor: colors.borderSoft, backgroundColor: colors.card }]}
            activeOpacity={0.7}
            onPress={handleTapLocation}
          >
            <NomadIcon name="pin" size={s(8)} color={colors.primary} strokeWidth={1.8} />
            <Text style={[st.locationActionText, { color: colors.dark }]} numberOfLines={1}>
              {t('creation.where.setPin')}
            </Text>
            <NomadIcon name="forward" size={s(6)} color={colors.textMuted} strokeWidth={1.6} />
          </TouchableOpacity>
        )}

        {/* Row 2 — address SEARCH. Type two characters and a
            Photon-backed dropdown of address suggestions appears;
            tap one and the pin snaps there. selectTextOnFocus so
            the autofill doesn't "stick" — first keystroke
            replaces it. × clears in one tap. */}
        <View style={[st.locationInputRow, { borderColor: colors.borderSoft, backgroundColor: colors.card }]}>
          <NomadIcon name="search" size={s(7)} color={colors.textMuted} strokeWidth={1.6} />
          <TextInput
            ref={addressInputRef}
            style={[st.locationInput, { color: colors.dark }]}
            placeholder={t('creation.where.searchPlaceholder')}
            placeholderTextColor={colors.textFaint}
            value={address}
            onChangeText={onAddressChange}
            onFocus={() => setAddressFocused(true)}
            onBlur={() => {
              // Delay the "unfocused" flag so a tap on a dropdown
              // result still fires onPress before we hide the list.
              setTimeout(() => setAddressFocused(false), 120);
            }}
            selectTextOnFocus
            returnKeyType="search"
            blurOnSubmit
          />
          {address.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setAddress('');
                setAddressResults([]);
                addressInputRef.current?.focus();
              }}
              hitSlop={10}
            >
              <NomadIcon name="close" size={s(5.5)} color={colors.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete dropdown — appears under the search input
            while the user is focused + typing. Max 3 results so it
            fits inside the bubble template. */}
        {showDropdown && (
          <View style={[st.addressDropdown, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}>
            {addressSearching ? (
              <Text style={[st.addressDropdownEmpty, { color: colors.textMuted }]}>…</Text>
            ) : (
              addressResults.slice(0, 3).map((r, i) => (
                <TouchableOpacity
                  key={`${r.lat},${r.lon}-${i}`}
                  style={[st.addressDropdownRow, { borderBottomColor: colors.borderSoft }]}
                  onPress={() => onAddressPick(r)}
                  activeOpacity={0.7}
                >
                  <NomadIcon name="pin" size={s(5)} color={colors.primary} strokeWidth={1.6} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.addressDropdownMain, { color: colors.dark }]} numberOfLines={1}>
                      {r.mainLine || r.display_name}
                    </Text>
                    {!!r.subLine && (
                      <Text style={[st.addressDropdownSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {r.subLine}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

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
  };

  const renderWho = () => (
    <View style={st.stepBody}>
      {/* NOTE: no stepEcho here. On the WHO step the user just
           came from WHERE, they remember what they typed — showing
           the quote again costs ~30px of vertical space we can't
           afford inside the 280 template. Echo stays on WHERE and
           PUBLISH where it adds context. */}

      {/* Duration chips show only for "now" (= timer kind); for
           "today" and "later" the duration is implied by the
           end-of-day / scheduled time, and we show the audience
           toggle (anyone vs. approval) instead. */}
      {whenChoice === 'now' ? (
        <>
          <Text style={st.stepLabel}>{t('creation.who.duration')}</Text>
          <View style={st.chipRowSingle}>
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
                    st.chipCompact,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  activeOpacity={0.8}
                >
                  {/* Uniform "Nm" labels (15m / 30m / 45m / 60m /
                       90m / 120m) — same pattern, predictable
                       width, six in one row. */}
                  <Text style={[
                    st.chipCompactText,
                    { color: active ? '#fff' : colors.dark },
                  ]}>
                    {`${mins}m`}
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

      {/* Age range — label on one line, "18–80" number inline in
           a smaller muted weight so it reads "age range · 18–80"
           at a glance without eating space. marginTop 2 pulls
           the slider right up under the chips. */}
      <View style={st.ageRangeHeader}>
        <Text style={[st.stepLabel, st.ageRangeLabel]}>
          {t('creation.who.ageRange')}
        </Text>
        <Text style={st.ageRangeValue}>
          {ageMin}–{ageMax}
        </Text>
      </View>
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
    const isNow = whenChoice === 'now';
    const whenSummary =
      whenChoice === 'now'
        ? `${durationMinutes}m`
        : whenChoice === 'today'
          ? t('creation.when.today')
          : (scheduledAt
              ? scheduledAt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : t('creation.when.later'));
    const audienceSummary = isOpen ? t('creation.who.openAll') : t('creation.who.private');
    return (
      <View style={st.stepBody}>
        <Text style={st.publishTitle} numberOfLines={2}>
          {emoji} {text.trim()}
        </Text>
        <View style={st.summaryRow}>
          <SummaryPill icon="pin" text={address || cityName} colors={colors} />
          {/* Time pill — shows the duration for "now", the window
              for "today", or the scheduled timestamp for "later". */}
          <SummaryPill icon={isNow ? 'timer' : 'calendar'} text={whenSummary} colors={colors} />
          {/* Audience pill — same meaning across all timing modes. */}
          <SummaryPill icon="users" text={audienceSummary} colors={colors} />
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
      {step === 'when' && renderWhen()}
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
  icon: 'pin' | 'timer' | 'users' | 'calendar';
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
    // FIXED height across all four steps so the bubble stays the
    // same size as the user progresses — locked rule per product
    // owner. Sized to fit the biggest step (WHO — echo + label +
    // one-row chips + age label + slider + CTA) without empty
    // air. If a future field forces a step beyond it, shrink the
    // field; don't invent scrolling or a second card.
    height: 280,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },

  /* STEP 1 — clean canvas */
  whatPrompt: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 6,
  },
  whatPromptName: {
    // Facebook's brand blue — gives the user's name a "you are
    // being addressed personally" feel on top of the canvas.
    color: '#1877F2',
    fontWeight: '900',
  },
  whatInput: {
    flex: 1,                        // fills the vertical space
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    // No border — feels like a blank page, not a form field.
  },

  /* STEP 2 — WHEN */
  whenList: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 6,
  },
  whenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  whenRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whenRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  whenRowLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  whenRowSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  whatCtaSlot: {
    // Bottom-pinned fixed-height slot so Continue appearing /
    // disappearing doesn't bounce the layout.
    height: 52,
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

  /* Location pill (step WHERE) — action row, one line, full
     width, generous vertical padding so it feels like a button
     the thumb can hit without aim. Tap opens pickMode. */
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 10,
    minHeight: 56,
  },
  locationActionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  /* Optional free-form address / label. Same footprint as the
     action pill above so the two stack cleanly and weigh the
     same visually. Holds an edit icon on the left, the input
     in the middle, and a clear × on the right when non-empty. */
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 0.5,
    marginBottom: 14,
    minHeight: 56,
  },
  locationInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },

  /* Address autocomplete dropdown (under the search input) */
  addressDropdown: {
    marginTop: -6,       // pulls it closer to the input
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  addressDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addressDropdownMain: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressDropdownSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  addressDropdownEmpty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },

  /* Chips — non-wrapping "status open/private" variant.
     Still uses flexWrap in case the translation strings grow. */
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 6,
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

  /* Compact chips — duration row (Timer flow). Sized so five
     "NNm" chips (30m / 45m / 60m / 90m / 120m) fit in a single
     line with room to spare on every phone width we target. */
  chipRowSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 6,
  },
  chipCompact: {
    flex: 1,                // equal-width across the row
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  chipCompactText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Age range header — label and "18–80" number on one line, the
     number smaller + muted so it reads as an annotation, not a
     second heading. marginTop 2 pulls the slider up snug under
     the duration chip row. */
  ageRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  ageRangeLabel: {
    // Inherits from stepLabel but drops its margin since the
    // parent row handles vertical spacing.
    marginBottom: 0,
  },
  ageRangeValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.3,
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
