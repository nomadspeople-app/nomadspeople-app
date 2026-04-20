/**
 * locationServices — THE SINGLE SOURCE OF TRUTH for one-shot
 * location operations used by the Status and Timer creation flows.
 * ════════════════════════════════════════════════════════════════
 *
 * Before this module existed, `QuickStatusSheet`, `TimerSheet`, and
 * `StatusCreationFlow` each held their own private copy of:
 *   - formatPhoton / searchAddress / reverseGeocode
 *   - getIpLocation
 *   - distKm (itself already duplicated — `haversineKm` in distance.ts)
 *   - the GPS + IP + spoof-detection fetch flow
 *
 * That was the textbook band-aid pattern — fix a behavior in one
 * sheet, forget the other, ship the inconsistency, lose trust. Per
 * CLAUDE.md Rule Zero: one module, every caller points here.
 *
 * Scope of this file:
 *   - Pure geocoding helpers (Photon + Nominatim over
 *     `fetchJsonWithTimeout` so a 5xx / timeout never throws).
 *   - IP-based geolocation fallback with a secondary provider.
 *   - `resolveLiveLocation()` — one-shot GPS + IP with a 5 km drift
 *     spoof check. Returns a tagged result so callers don't have to
 *     reinvent the failure branches.
 *   - `useLiveLocation()` — React hook wrapping the above plus the
 *     address reverse-geocode, so a screen can say `const { lat,
 *     lng, addr, gpsWarning, refresh, loading } = useLiveLocation({
 *     fallbackLat: cityLat, fallbackLng: cityLng })` and be done.
 *
 * What this file deliberately does NOT do:
 *   - It does not start background watching. That is
 *     `locationManager.ts`'s job (app-lifetime singleton).
 *   - It does not write anything to Supabase. Sheets decide when to
 *     commit a location as part of a publish payload; this module
 *     only reads.
 *   - It does not own any React state beyond the hook's own local
 *     state. Callers pass fallbacks in and get plain values back.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { fetchJsonWithTimeout } from './fetchWithTimeout';
import { haversineKm } from './distance';

/* ══════════════════════════════════════════════════════════════════
 * Types
 * ════════════════════════════════════════════════════════════════ */

/** Parsed result from Photon or any autocomplete-style geocoder. */
export interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  mainLine: string;
  subLine: string;
}

/** Outcome of a one-shot live-location resolution. */
export interface LiveLocationResult {
  latitude: number;
  longitude: number;
  /** GPS/IP drifted by more than 5 km OR GPS was unavailable and we
   *  fell back to the coarse IP lookup. Callers should surface a
   *  soft warning when this is true. */
  spoofSuspected: boolean;
  /** True if both GPS and IP failed and we returned the fallback
   *  coords (typically city center). In that case the caller should
   *  stop treating the result as "live". */
  usedFallback: boolean;
  /** "granted" | "denied" | "undetermined" — lets callers tell the
   *  user why nothing was found. */
  permissionStatus: Location.PermissionStatus;
}

/* ══════════════════════════════════════════════════════════════════
 * Photon / Nominatim — geocoding helpers
 *
 * Kept byte-identical to the copies that previously lived inside
 * QuickStatusSheet and TimerSheet so migrating callers is a pure
 * import swap with zero behavior change. The comments explain each
 * field choice so a future engineer doesn't "simplify" them and
 * regress the address label on edge cases (Israeli addresses, pins
 * without a street number, rural POIs without a city field, etc.).
 * ════════════════════════════════════════════════════════════════ */

/** Parse a Photon GeoJSON feature into our GeoResult shape.
 *
 *  Israeli (and many non-English) Photon results often put the
 *  city name inside the `name` field when the query already
 *  contained it — e.g. typing "קלישר 20 תל אביב" yields a feature
 *  whose `name` is "Kalischer Tel Aviv" AND whose `city` is also
 *  "Tel Aviv". A naive "mainLine, city" concatenation prints the
 *  city twice. This parser is careful to:
 *    1. Build the mainLine from street+number first (that's the
 *       real address), falling back to `name` only when there's
 *       no street.
 *    2. Drop any hood/city token from the subLine when it's
 *       already substring-matched by the mainLine — no more
 *       duplicates.
 */
export function formatPhoton(f: any): GeoResult {
  const p = f.properties || {};
  const coords = f.geometry?.coordinates || [0, 0]; // [lon, lat]
  const name = p.name || '';
  const street = p.street || '';
  const num = p.housenumber || '';
  const hood = p.suburb || p.district || '';
  const city = p.city || p.town || p.village || '';

  // Main line — prefer "<street> <num>" because that's the
  // actionable address. Fall back to `name` (POI / landmark) when
  // no street is present.
  let mainLine: string;
  if (street && num) mainLine = `${street} ${num}`;
  else if (street) mainLine = street;
  else mainLine = name;

  // If mainLine came from `name` and already has commas (meaning
  // Photon packed multiple parts in there), keep only the first
  // segment so we don't duplicate when we add the subLine.
  if (mainLine && !street && mainLine.includes(',')) {
    mainLine = mainLine.split(',')[0].trim();
  }

  // Dedupe: drop any sub-line token whose value already appears
  // inside mainLine (case-insensitive substring). Typical case:
  // name="Kalischer Tel Aviv" + city="Tel Aviv" — we skip the city.
  const mainLC = mainLine.toLowerCase();
  const subParts = [hood, city]
    .filter(Boolean)
    .filter((part: string) => !mainLC.includes(part.toLowerCase()));
  const subLine = subParts.length
    ? subParts.join(', ')
    : (p.state || p.country || '');

  // display_name is the single-line form for fallbacks — also
  // deduped so the free-text search result looks right.
  const display = [mainLine, ...subParts].filter(Boolean).join(', ');

  return {
    display_name: display,
    lat: String(coords[1]),
    lon: String(coords[0]),
    mainLine,
    subLine,
  };
}

/**
 * Photon autocomplete — designed for partial / typeahead queries.
 *   "nahala" → "Nahalat Binyamin"
 *   "rothsch" → "Rothschild Boulevard"
 * Location-biased by `lat` / `lng` so local results come first.
 *
 * Returns `[]` on any network failure (`fetchJsonWithTimeout`
 * already logs + swallows) so the caller can stay on the existing
 * result list without a red error banner for a transient hiccup.
 */
export async function searchAddress(
  q: string,
  lat: number,
  lng: number,
  _city?: string,
): Promise<GeoResult[]> {
  if (q.length < 2) return [];
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&lat=${lat}&lon=${lng}&limit=5&lang=en`;
  const data = await fetchJsonWithTimeout<any>(url, {
    tag: 'photon.address',
    timeoutMs: 7000,
  });
  if (data?.features?.length > 0) return data.features.map(formatPhoton);
  return [];
}

/**
 * Reverse geocode — Nominatim at zoom=18 (building-level), English
 * names so our UI stays consistent across locales. Returns a short
 * single-line address suitable for the pill above the map.
 *
 * Returns `''` on failure. The caller decides whether to fall back
 * to the city name or hide the label.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=en`;
  const data = await fetchJsonWithTimeout<any>(url, {
    tag: 'nominatim.reverse',
    timeoutMs: 7000,
  });
  if (!data) return '';
  const addr = data.address || {};
  const parts = [addr.road, addr.house_number, addr.neighbourhood || addr.suburb]
    .filter(Boolean);
  return parts.join(' ') || data.display_name?.split(',').slice(0, 2).join(',') || '';
}

/* ══════════════════════════════════════════════════════════════════
 * IP-based geolocation — coarse, spoof-resistant
 *
 * We call the primary provider first (ipapi.co), then fall back to
 * ip-api.com if the primary returns nothing or times out. Used in
 * two places: (a) the spoof-detection drift check against GPS,
 * (b) the final fallback when GPS is unavailable entirely.
 * ════════════════════════════════════════════════════════════════ */

export async function getIpLocation(): Promise<{ lat: number; lng: number } | null> {
  const primary = await fetchJsonWithTimeout<any>('https://ipapi.co/json/', {
    tag: 'ipapi',
    timeoutMs: 6000,
  });
  if (primary?.latitude && primary?.longitude) {
    return { lat: primary.latitude, lng: primary.longitude };
  }
  const backup = await fetchJsonWithTimeout<any>(
    'http://ip-api.com/json/?fields=lat,lon',
    { tag: 'ip-api.com', timeoutMs: 6000 },
  );
  if (backup?.lat && backup?.lon) return { lat: backup.lat, lng: backup.lon };
  return null;
}

/* ══════════════════════════════════════════════════════════════════
 * One-shot "where am I right now" resolver — GPS-first
 *
 * Priority order, highest to lowest:
 *
 *   1. GPS. If the phone has a fix, we USE IT. No IP override, ever.
 *      Residential ISPs in many countries (notably Israel) route
 *      traffic through datacenters dozens of kilometers from the
 *      actual user, so a "GPS says Tel Aviv, IP says Be'er Sheva"
 *      disagreement almost always means the IP is wrong — NOT that
 *      the GPS is spoofed.
 *   2. IP geolocation. Used only when GPS is unavailable
 *      (permission denied, indoors with no signal, etc.).
 *   3. Fallback coords (typically the current city's center).
 *
 * `spoofSuspected` is kept as an output flag for callers that want
 * to show a soft "your location may be approximate" banner, but it
 * is a HINT — we never act on it internally. The flag is raised
 * when (a) we had to fall back to IP, or (b) GPS and IP disagreed
 * by more than ~50 km (which is past any reasonable ISP routing
 * drift and actually suggests something odd). Pure spoof-vs-real
 * detection needs server-side signals and is not this module's
 * job; this module's job is to land the user's pin where they
 * actually are.
 * ════════════════════════════════════════════════════════════════ */

/** The drift above which we log a warning but STILL prefer GPS.
 *  Used only for the spoofSuspected flag, never to override GPS. */
const DRIFT_SUSPECT_KM = 50;

export async function resolveLiveLocation(
  fallbackLat: number,
  fallbackLng: number,
): Promise<LiveLocationResult> {
  // 1) Permission — without this GPS cannot run at all.
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    // Try IP as a last resort so the map at least lands in the
    // right country even without foreground permission.
    const ip = await getIpLocation();
    if (ip) {
      return {
        latitude: ip.lat,
        longitude: ip.lng,
        spoofSuspected: true, // IP is always coarse
        usedFallback: false,
        permissionStatus: status,
      };
    }
    return {
      latitude: fallbackLat,
      longitude: fallbackLng,
      spoofSuspected: false,
      usedFallback: true,
      permissionStatus: status,
    };
  }

  // 2) Fire both lookups in parallel. GPS is authoritative; IP is
  //    only used when GPS fails.
  const [gpsResult, ipResult] = await Promise.allSettled([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    getIpLocation(),
  ]);

  const gpsPos = gpsResult.status === 'fulfilled' ? gpsResult.value : null;
  const ipPos = ipResult.status === 'fulfilled' ? ipResult.value : null;

  // 3) GPS wins if we have it — full stop. IP is only consulted to
  //    raise the soft warning, never to override coords.
  if (gpsPos) {
    let warn = false;
    if (ipPos) {
      const drift = haversineKm(
        gpsPos.coords.latitude, gpsPos.coords.longitude,
        ipPos.lat, ipPos.lng,
      );
      if (drift > DRIFT_SUSPECT_KM) {
        console.warn(
          `[resolveLiveLocation] GPS vs IP drift ${drift.toFixed(0)} km — ` +
          'probably just ISP routing, keeping GPS.',
        );
        warn = true;
      }
    }
    return {
      latitude: gpsPos.coords.latitude,
      longitude: gpsPos.coords.longitude,
      spoofSuspected: warn,
      usedFallback: false,
      permissionStatus: status,
    };
  }

  // 4) GPS failed — IP is the best we have.
  if (ipPos) {
    return {
      latitude: ipPos.lat,
      longitude: ipPos.lng,
      spoofSuspected: true,
      usedFallback: false,
      permissionStatus: status,
    };
  }

  // 5) Both failed — fallback to the city center the caller passed.
  return {
    latitude: fallbackLat,
    longitude: fallbackLng,
    spoofSuspected: false,
    usedFallback: true,
    permissionStatus: status,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * useLiveLocation — React hook wrapper
 *
 * Typical usage inside a sheet:
 *
 *   const { lat, lng, addr, loading, gpsWarning, refresh } =
 *     useLiveLocation({
 *       fallbackLat: cityLat,
 *       fallbackLng: cityLng,
 *       cityLabel: cityName,
 *       autoFetch: visible,
 *     });
 *
 * The hook does NOT mutate the caller's pin state — callers decide
 * whether to mirror `{ lat, lng }` into their own pin when the live
 * coords arrive, or to treat them as a separate "blue-dot" layer.
 * That decision was the divergence that made Status and Timer
 * behave differently before; now both flows see the same shape and
 * it's a product decision, not an accidental one.
 * ════════════════════════════════════════════════════════════════ */

interface UseLiveLocationOptions {
  /** Where to center if both GPS and IP are unavailable. */
  fallbackLat: number;
  fallbackLng: number;
  /** Label to display when no street-level address is returned. */
  cityLabel?: string;
  /** When true the hook fetches once on mount and whenever this
   *  value flips from false → true. Pass the sheet's `visible` so
   *  we only burn GPS battery while the user is actually picking. */
  autoFetch?: boolean;
}

export interface UseLiveLocationValue {
  /** Last resolved live coordinates — null until the first fetch
   *  completes. Callers can treat null as "still loading". */
  lat: number | null;
  lng: number | null;
  /** Human-readable address, e.g. "Nahalat Binyamin 11". Falls
   *  back to the cityLabel, then to the city-level display name. */
  addr: string;
  /** Fetch is in flight. UI should show a spinner near the label. */
  loading: boolean;
  /** True if IP-only or GPS/IP disagreed — caller should show a
   *  soft warning and offer a "drop a pin manually" path. */
  gpsWarning: boolean;
  /** True if both GPS and IP failed and we returned fallback. */
  usedFallback: boolean;
  /** Re-run the resolver on demand (e.g. user taps a refresh icon). */
  refresh: () => Promise<void>;
}

export function useLiveLocation(opts: UseLiveLocationOptions): UseLiveLocationValue {
  const { fallbackLat, fallbackLng, cityLabel = '', autoFetch = true } = opts;

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [addr, setAddr] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsWarning, setGpsWarning] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  // Capture the latest fallback in a ref so the stable `refresh`
  // callback always reads fresh values without invalidating its
  // identity. Without this, every cityLat/cityLng prop change
  // would re-create `refresh`, which would re-run the `autoFetch`
  // effect and double-call the resolver — exactly the kind of
  // silent double-fire that drained battery in earlier versions.
  const fallbackRef = useRef({ lat: fallbackLat, lng: fallbackLng, label: cityLabel });
  fallbackRef.current = { lat: fallbackLat, lng: fallbackLng, label: cityLabel };

  const refresh = useCallback(async () => {
    setLoading(true);
    setGpsWarning(false);
    try {
      const { lat: fLat, lng: fLng, label } = fallbackRef.current;
      const res = await resolveLiveLocation(fLat, fLng);
      setLat(res.latitude);
      setLng(res.longitude);
      setGpsWarning(res.spoofSuspected);
      setUsedFallback(res.usedFallback);
      // Reverse-geocode for the label. Do this AFTER setting coords
      // so the map can move immediately; the label catches up.
      const street = await reverseGeocode(res.latitude, res.longitude);
      setAddr(street || label || '');
    } catch (err) {
      // Only reached if something above throws unexpectedly —
      // resolveLiveLocation itself is fully try-wrapped internally.
      console.warn('[useLiveLocation] refresh threw:', err);
      const { lat: fLat, lng: fLng, label } = fallbackRef.current;
      setLat(fLat);
      setLng(fLng);
      setAddr(label || '');
      setGpsWarning(true);
      setUsedFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount and on autoFetch transitions false → true.
  // We use a ref to avoid double-firing in StrictMode's intentional
  // double-mount in development.
  const firedRef = useRef(false);
  useEffect(() => {
    if (!autoFetch) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    refresh();
  }, [autoFetch, refresh]);

  return { lat, lng, addr, loading, gpsWarning, usedFallback, refresh };
}
