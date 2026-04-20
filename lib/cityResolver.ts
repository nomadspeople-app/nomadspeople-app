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

/** Reverse geocode using Nominatim — returns city name or empty string.
 *  Never throws. On timeout / network error, returns '' and the caller
 *  falls back to its default. */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`;
  const data = await fetchJsonWithTimeout<any>(url, { tag: 'nominatim.reverse', timeoutMs: 8000 });
  if (!data) return '';
  const addr = data.address || {};
  return addr.city || addr.town || addr.village || addr.state || '';
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
