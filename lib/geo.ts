/**
 * geo — THE one geo helper. Every country-based rule in the
 * app consults this module. No surface writes its own.
 *
 * SPEC: docs/product-decisions/2026-04-20-geo-boundaries-spec.md
 * (The Torah. Read it before editing this file.)
 *
 * THE FOUR FUNCTIONS
 * ─────────────────
 *
 *   resolveCurrentCountry()     → user's country right now, from GPS
 *   pinCountryFromCoords(...)   → country of a specific lat/lng
 *   isSameCountryAsViewer(...)  → boolean gate primitive
 *   canJoinEvent(...)           → the "can this viewer join?" gate
 *
 * THE THREE GATES
 * ──────────────
 *
 * Gate 1 — Publish (HomeScreen.publishCheckin):
 *    resolve current country → pin country from coords →
 *    isSameCountryAsViewer? → proceed or block.
 *
 * Gate 2 — Sidebar render (nomads list):
 *    per-row index check. First 8 foreign rows render clear,
 *    rest render blurred. Uses isSameCountryAsViewer internally.
 *
 * Gate 3 — Join button (TimerBubble):
 *    canJoinEvent() gates the Join CTA.
 *
 * FAIL MODES
 * ──────────
 *
 *   - GPS denied / unavailable      → resolveCurrentCountry returns null
 *   - Geocoder network failure      → pinCountryFromCoords returns null
 *   - Unknown country (null)        → isSameCountryAsViewer returns TRUE
 *     (fail-open for legacy/unknown data; only the PUBLISH gate
 *     fails-closed, handled at the call site)
 */

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { fetchJsonWithTimeout } from './fetchWithTimeout';

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

/** ISO 3166-1 alpha-2 country code, uppercase. 'IL', 'TH', etc. */
export type CountryCode = string;

/* ═══════════════════════════════════════════
   CACHES — module-level, session-scoped.
   Cleared when the app process dies. Never
   persisted (no AsyncStorage, no DB) because
   the user's country is ephemeral data.
   ═══════════════════════════════════════════ */

/** Current user country — resolved once per app session. Cleared on
 *  bustCurrentCountry() (used when the app detects a significant
 *  location change). Lasts ~app lifetime otherwise. */
let _currentCountry: { value: CountryCode | null; at: number } | null = null;
const CURRENT_COUNTRY_TTL_MS = 10 * 60 * 1000;  // 10 min freshness

/** Per-coord-cell cache for pin country lookups. Keyed by a coarse
 *  lat/lng bucket (~1.1 km cell). Two events at the same cafe never
 *  re-query. */
const _pinCountryCache = new Map<string, { value: CountryCode | null; at: number }>();
const PIN_COUNTRY_TTL_MS = 24 * 60 * 60 * 1000;  // 24 h (country boundaries are stable)

/** Bucket coords into ~1.1 km cells for cache keying. */
function cellKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/* ═══════════════════════════════════════════
   RESOLVE CURRENT COUNTRY — user's GPS → country
   ═══════════════════════════════════════════ */

/** Resolve the user's CURRENT country via GPS + reverse geocode.
 *
 *  Returns null when:
 *    - Location permission is denied
 *    - GPS reading fails
 *    - The reverse-geocode call fails
 *
 *  Callers at publish time MUST treat null as "block — can't verify".
 *  Callers at view time treat null as "fail-open" via
 *  isSameCountryAsViewer, so the viewer sees a normal local
 *  experience instead of an empty map while GPS warms up.
 *
 *  Session-memoized. Repeat calls within the TTL return the cached
 *  value without hitting GPS or the network. */
export async function resolveCurrentCountry(): Promise<CountryCode | null> {
  // Fresh cache hit → return immediately.
  if (_currentCountry && Date.now() - _currentCountry.at < CURRENT_COUNTRY_TTL_MS) {
    return _currentCountry.value;
  }

  try {
    // Permission check. If not granted, request — user may have
    // granted before, the request is a no-op for them.
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') {
        _currentCountry = { value: null, at: Date.now() };
        return null;
      }
    }

    // Last-known position is the fastest path; we prefer it for
    // the instant UX, then let a background refresh refine. For
    // country-level resolution, last-known is plenty accurate.
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        lat = last.coords.latitude;
        lng = last.coords.longitude;
      }
    } catch {
      /* fall through to fresh read */
    }

    if (lat == null || lng == null) {
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      lat = fresh.coords.latitude;
      lng = fresh.coords.longitude;
    }

    const country = await pinCountryFromCoords(lat, lng);
    _currentCountry = { value: country, at: Date.now() };
    return country;
  } catch (err) {
    console.warn('[geo] resolveCurrentCountry failed:', err);
    _currentCountry = { value: null, at: Date.now() };
    return null;
  }
}

/** Invalidate the cached current country. Call after the user's
 *  location has meaningfully changed (crossed a border, opened the
 *  app in a new country). The next call to resolveCurrentCountry
 *  will re-query. */
export function bustCurrentCountry(): void {
  _currentCountry = null;
}

/* ═══════════════════════════════════════════
   PIN COUNTRY FROM COORDS — lat/lng → country
   ═══════════════════════════════════════════ */

/** Reverse-geocode a lat/lng into its ISO 2-letter country code.
 *
 *  Caching: per-cell (~1.1 km). The same cafe is queried once per
 *  24 hours, not once per render.
 *
 *  Returns null on geocoder failure or when the response has no
 *  country field (very rare — open ocean, disputed territories). */
export async function pinCountryFromCoords(
  lat: number,
  lng: number,
): Promise<CountryCode | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const key = cellKey(lat, lng);
  const hit = _pinCountryCache.get(key);
  if (hit && Date.now() - hit.at < PIN_COUNTRY_TTL_MS) {
    return hit.value;
  }

  try {
    // Nominatim returns addr.country_code in lowercase. Zoom=3 is
    // country-level (cheaper for their servers than zoom=18).
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=json&lat=${lat}&lon=${lng}&zoom=3&accept-language=en`;
    const data = await fetchJsonWithTimeout<any>(url, {
      tag: 'nominatim.country',
      timeoutMs: 6000,
    });
    const raw: string | undefined = data?.address?.country_code;
    const iso = raw ? raw.toUpperCase() : null;
    _pinCountryCache.set(key, { value: iso, at: Date.now() });
    return iso;
  } catch (err) {
    console.warn('[geo] pinCountryFromCoords failed:', err);
    // Don't cache failures — let the next attempt try again.
    return null;
  }
}

/* ═══════════════════════════════════════════
   SAME COUNTRY CHECK — the boolean primitive
   ═══════════════════════════════════════════ */

/** Fail-open check: if either country is unknown (null), treat as
 *  same-country. Callers that need fail-closed (publish gate) check
 *  for null explicitly BEFORE calling this — we never want to block
 *  legitimate users because of a momentary geocoder hiccup. */
export function isSameCountryAsViewer(
  viewerCountry: CountryCode | null,
  eventCountry: CountryCode | null,
): boolean {
  if (viewerCountry == null || eventCountry == null) return true;
  return viewerCountry === eventCountry;
}

/* ═══════════════════════════════════════════
   CAN JOIN EVENT — the gate 3 primitive
   ═══════════════════════════════════════════ */

/** True when the viewer's home country matches the event's country.
 *  Used by TimerBubble to decide whether to show the Join button or
 *  the "far from home" disabled label.
 *
 *  Explicit null handling matches isSameCountryAsViewer: unknown
 *  data is fail-open. A viewer whose GPS hasn't resolved yet can
 *  still see a working UI — they just won't be blocked. The publish
 *  gate is the strict one. */
export function canJoinEvent(
  viewerCountry: CountryCode | null,
  event: { country?: CountryCode | null } | null | undefined,
): boolean {
  if (!event) return false;
  return isSameCountryAsViewer(viewerCountry, event.country ?? null);
}

/* ═══════════════════════════════════════════
   useViewerCountry — React hook for UI gates
   ═══════════════════════════════════════════ */

/** React hook that resolves the viewer's current country once on
 *  mount and exposes it to the render tree. Returns null until the
 *  GPS + geocode round-trip completes (or if GPS is denied / offline).
 *
 *  Callers that gate UI (NomadsListSheet, TimerBubble Join button)
 *  consume the returned value through isSameCountryAsViewer /
 *  canJoinEvent, both of which fail-open on null — so the UI renders
 *  the local experience while the hook is warming up, then refines
 *  to the foreign experience once the country is known.
 *
 *  IMPORTANT: This is intentionally a one-shot hook. It doesn't
 *  re-poll on focus or listen to AppState changes, because
 *  resolveCurrentCountry() is session-memoized (10 min TTL) and every
 *  consumer in a given render tree should see the same value. If the
 *  user travels mid-session, the bustCurrentCountry() invalidation
 *  path is how the session refreshes — NOT this hook. */
export function useViewerCountry(): CountryCode | null {
  const [country, setCountry] = useState<CountryCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveCurrentCountry()
      .then((c) => {
        if (!cancelled) setCountry(c);
      })
      .catch(() => {
        // resolveCurrentCountry already swallows errors and returns null,
        // but belt-and-braces — a thrown promise here shouldn't crash the
        // tree.
        if (!cancelled) setCountry(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return country;
}
