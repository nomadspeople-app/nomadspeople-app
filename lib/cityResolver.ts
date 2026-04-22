/**
 * City resolution — find the best city match for GPS coordinates
 *
 * Strategy:
 * 1. Check if coordinates are within 50km of a known city
 * 2. If yes, return that city name
 * 3. If no, fall back to Nominatim reverse geocoding
 */

import { CITIES } from '../components/CityPickerSheet';
import { haversineKm } from './distance';
import { fetchJsonWithTimeout } from './fetchWithTimeout';

// Was 50 km — too wide. A user picking a Rehovot venue (≈20 km from Tel
// Aviv) was getting their event tagged 'Tel Aviv' because Tel Aviv was
// the nearest CITIES entry within 50 km. 15 km matches "same urban area
// / immediate suburbs only" — anything further falls through to Nominatim,
// which returns the actual city name.
const CITY_SEARCH_RADIUS_KM = 15;

/** Rich reverse-geocode result — what callers need when they're
 *  building a full City object (HomeScreen's "my location" crosshair
 *  flow). Keeps every caller on one Nominatim roundtrip + one set
 *  of extraction rules instead of inlining them per screen. */
export interface ReverseGeocodeCityFull {
  /** e.g. 'Tel Aviv'. '' on any failure. */
  cityName: string;
  /** Full country name, e.g. 'Israel'. '' when not returned. */
  country: string;
  /** ISO 3166-1 alpha-2 country code, uppercased. undefined
   *  when Nominatim doesn't return `country_code` (rare). */
  countryCode: string | undefined;
}

/** The ONE Nominatim reverse-geocode call in cityResolver — returns
 *  the full triplet. Never throws. On timeout / network error,
 *  returns empty fields. Other functions in this module are thin
 *  wrappers that project out the field they need — there is NEVER
 *  a second place in this file (or the codebase) that calls
 *  Nominatim with zoom=10. */
export async function reverseGeocodeCityFull(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeCityFull> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`;
  const data = await fetchJsonWithTimeout<any>(url, { tag: 'nominatim.reverse', timeoutMs: 8000 });
  if (!data) return { cityName: '', country: '', countryCode: undefined };
  const addr = data.address || {};
  const cityName: string = addr.city || addr.town || addr.village || addr.state || '';
  const country: string = addr.country || '';
  const rawCC: string | undefined = addr.country_code;
  const countryCode = rawCC ? rawCC.toUpperCase() : undefined;
  return { cityName, country, countryCode };
}

/** City-name-only convenience wrapper. Kept for callers that don't
 *  need the country + code. Delegates to reverseGeocodeCityFull so
 *  there is exactly one Nominatim URL + extraction pipeline in the
 *  module. */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  const { cityName } = await reverseGeocodeCityFull(lat, lng);
  return cityName;
}

/**
 * Find the closest city in our CITIES database within maxKm radius
 */
export function findNearestCityInDB(lat: number, lng: number, maxKm = 50): { name: string; distance: number } | null {
  let best: { name: string; distance: number } | null = null;
  let bestDist = maxKm;

  for (const city of CITIES) {
    const dist = haversineKm(lat, lng, city.lat, city.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = { name: city.name, distance: dist };
    }
  }

  return best;
}

/**
 * Resolve the best city name for given GPS coordinates
 *
 * Priority:
 * 1. Check CITIES database for a city within CITY_SEARCH_RADIUS_KM
 * 2. Fall back to Nominatim reverse geocoding
 * 3. If all fails, return fallback city name
 */
export async function resolveCityFromCoordinates(
  lat: number,
  lng: number,
  fallbackCity: string = 'Unknown',
): Promise<string> {
  // 1. Try to find nearest city in our database
  const nearestCity = findNearestCityInDB(lat, lng, CITY_SEARCH_RADIUS_KM);
  if (nearestCity) {
    if (nearestCity.distance > 0) {
      console.log(`[City Resolver] Found nearby city: ${nearestCity.name} (${nearestCity.distance.toFixed(0)}km)`);
    }
    return nearestCity.name;
  }

  // 2. Fall back to Nominatim reverse geocoding
  const nominatimCity = await reverseGeocodeCity(lat, lng);
  if (nominatimCity) {
    console.log(`[City Resolver] Nominatim resolved to: ${nominatimCity}`);
    return nominatimCity;
  }

  // 3. All failed, use fallback
  console.warn(`[City Resolver] No city found, using fallback: ${fallbackCity}`);
  return fallbackCity;
}
