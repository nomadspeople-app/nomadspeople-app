/**
 * ViewedCityContext — single source of truth for "where the user is
 * currently looking" inside the app.
 *
 * ─────────────────────────────────────────────────────────────────
 * THE TWO CONCEPTS
 * ─────────────────────────────────────────────────────────────────
 *
 *   1. `viewedCity` — the city the user is currently exploring on
 *      the map and in the People tab. Drives:
 *        • Map center (HomeScreen)
 *        • "Nomads in this city" pill (HomeScreen)
 *        • Active checkins fetch (HomeScreen + PeopleScreen)
 *        • Activities / nomad list filter (PeopleScreen)
 *        • Header city label everywhere
 *
 *      Can be changed by:
 *        • The user picking a city from CityPickerSheet
 *        • The user panning the map far enough to land in another city
 *        • The user tapping the "back to my location" FAB
 *        • A fresh GPS fix that reveals the user moved physically
 *
 *   2. `gpsCity` — the city resolved from the device's live GPS.
 *      Drives:
 *        • The DB write to `app_profiles.current_city` (so OTHER
 *          users see this nomad in the correct city's nomad list)
 *        • The "back to my location" FAB target
 *
 *      Updated only by the GPS sync loop in HomeScreen. Never set
 *      manually by user actions — it represents physical truth.
 *
 * ─────────────────────────────────────────────────────────────────
 * WHY TWO STATES, NOT ONE
 * ─────────────────────────────────────────────────────────────────
 *
 * Owner directive 2026-04-27:
 *   "המשתמש יכול ללכת לטייל במפה תמיד - אבל הוא יהיה רשום בסרגל
 *    הנוודים שלו איפה שה־GPS שלו"
 *
 * Translation: the user can browse the map (pan to other cities)
 * but their REGISTERED LOCATION (what others see) is always GPS.
 *
 * If we used one shared state for both:
 *   • User pans map to Rehovot → state := Rehovot → DB updated to
 *     Rehovot → other users now think this user is in Rehovot
 *     even though they're physically in Tel Aviv. Wrong.
 *
 * If we let GPS overwrite viewedCity on every tick:
 *   • User pans map to Rehovot → 30s later GPS ticks (still in
 *     Tel Aviv) → state := Tel Aviv → user's view is yanked back
 *     to Tel Aviv every 30 seconds. Unusable.
 *
 * Solution: the two concepts live in the same Context but as
 * separate fields. setGpsCity has a small piece of logic — if
 * the GPS city actually CHANGED (user physically moved), pull
 * viewedCity along. If it didn't change, leave viewedCity alone
 * so the user's manual exploration sticks.
 *
 * ─────────────────────────────────────────────────────────────────
 * USAGE
 * ─────────────────────────────────────────────────────────────────
 *
 * App.tsx:
 *   <ViewedCityProvider>...routes...</ViewedCityProvider>
 *
 * Any consuming screen / component:
 *   const { viewedCity, setViewedCity, gpsCity, setGpsCity } = useViewedCity();
 *
 * Pure read (PeopleScreen, header labels):
 *   const { viewedCity } = useViewedCity();
 *   const cityName = viewedCity.name;
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CITIES, type City } from '../components/CityPickerSheet';

export interface ViewedCityContextValue {
  /** The city the user is currently looking at — UI state. */
  viewedCity: City;
  /** Set viewedCity from a manual user action (pan / picker / FAB). */
  setViewedCity: (city: City) => void;
  /** GPS-resolved city — separate from viewedCity. Null until first
   *  GPS fix lands. */
  gpsCity: City | null;
  /** Update gpsCity from a GPS sync. If the new GPS city differs
   *  from the previous one (user physically moved), viewedCity is
   *  also re-synced to the new GPS city — so a moving user always
   *  sees their actual surroundings. If GPS city is unchanged
   *  (user is just sitting still while panning the map), viewedCity
   *  is left as the user set it. */
  setGpsCity: (city: City) => void;
}

const ViewedCityContext = createContext<ViewedCityContextValue>({
  viewedCity: CITIES[0],
  setViewedCity: () => {},
  gpsCity: null,
  setGpsCity: () => {},
});

export function ViewedCityProvider({ children }: { children: ReactNode }) {
  const [viewedCity, setViewedCity] = useState<City>(CITIES[0]);
  const [gpsCity, setGpsCityInternal] = useState<City | null>(null);

  const setGpsCity = useCallback((city: City) => {
    setGpsCityInternal(prev => {
      // First GPS fix → seed viewedCity from the live GPS so the user
      // never lands on the Tel Aviv default when their phone knows
      // exactly where they are.
      if (prev === null) {
        setViewedCity(city);
      }
      // GPS reports a different city than last time → user actually
      // moved (e.g. drove from Rehovot to Tel Aviv with the app open).
      // Pull viewedCity along — they want to see their new surroundings.
      else if (prev.name.toLowerCase() !== city.name.toLowerCase()) {
        setViewedCity(city);
      }
      // Same city as last GPS fix → the user might have manually
      // panned to look at another city. Don't yank them back.
      return city;
    });
  }, []);

  return (
    <ViewedCityContext.Provider value={{ viewedCity, setViewedCity, gpsCity, setGpsCity }}>
      {children}
    </ViewedCityContext.Provider>
  );
}

export function useViewedCity() {
  return useContext(ViewedCityContext);
}
