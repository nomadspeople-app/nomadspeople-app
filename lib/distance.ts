/**
 * Distance utilities — Haversine formula + formatting
 *
 * Used across the app to show user-to-user, user-to-activity,
 * and user-to-city distances. Respects distance_unit preference (km/mi).
 */

const EARTH_RADIUS_KM = 6371;
const KM_TO_MI = 0.621371;

/** Haversine distance between two lat/lng points → km */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format a distance for display, respecting the user's unit preference */
export function formatDistance(km: number, unit: 'km' | 'mi' = 'km'): string {
  const val = unit === 'mi' ? km * KM_TO_MI : km;

  if (val < 1) {
    // Show meters/yards for very short distances
    if (unit === 'mi') {
      const yards = Math.round(val * 1760);
      return `${yards} yd`;
    }
    const meters = Math.round(val * 1000);
    return `${meters} m`;
  }

  if (val < 10) {
    return `${val.toFixed(1)} ${unit}`;
  }

  if (val < 1000) {
    return `${Math.round(val)} ${unit}`;
  }

  // 1000+ → show with comma: "8,750 km"
  return `${Math.round(val).toLocaleString()} ${unit}`;
}

/** Convenience: compute + format in one call */
export function distanceBetween(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  unit: 'km' | 'mi' = 'km',
): string {
  const km = haversineKm(lat1, lng1, lat2, lng2);
  return formatDistance(km, unit);
}

/** Check if a point is within a radius (km) */
export function isWithinRadius(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  radiusKm: number,
): boolean {
  return haversineKm(lat1, lng1, lat2, lng2) <= radiusKm;
}
