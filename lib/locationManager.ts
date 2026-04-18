/**
 * Location Manager — THE SOURCE OF TRUTH for user location
 * ═══════════════════════════════════════════════════════════
 * Every user has ONE location. It's captured, stored, and synced.
 * NO edge cases. NO failures. NO embarrassments.
 */

import * as Location from 'expo-location';
import { supabase } from './supabase';

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
}

interface LocationState {
  current: UserLocation | null;
  lastSyncTime: number;
  isWatching: boolean;
}

class LocationManager {
  private state: LocationState = {
    current: null,
    lastSyncTime: 0,
    isWatching: false,
  };

  private watchSubscription: Location.LocationSubscription | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;

  /**
   * INITIALIZE: Get permissions + capture first location
   * This runs ONCE on app startup. Every user must have a location.
   */
  async initialize(userId: string): Promise<UserLocation | null> {
    this.userId = userId;

    try {
      // 1. Request permission (required for iOS/Android)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('[LocationManager] Permission denied');
        return null;
      }

      // 2. Try cached location FIRST (instant, may be stale)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        this.state.current = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy || 50,
          timestamp: lastKnown.timestamp,
        };
        // Don't wait — sync async
        this.syncLocationToDB().catch(e => console.warn('[LocationManager] Async sync failed:', e));
      }

      // 3. Request FRESH location with HIGH accuracy (1-5 seconds)
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (fresh) {
        this.state.current = {
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
          accuracy: fresh.coords.accuracy || 50,
          timestamp: fresh.timestamp,
        };

        // 4. Sync to database IMMEDIATELY
        await this.syncLocationToDB();

        // 5. Start watching for location changes
        this.startWatching();

        return this.state.current;
      }

      return this.state.current;
    } catch (error) {
      console.error('[LocationManager] Initialize error:', error);
      return null;
    }
  }

  /**
   * START WATCHING: Continuous location updates
   * Every 30 seconds OR when location changes significantly (>100m)
   */
  private startWatching() {
    if (this.state.isWatching) return;

    this.state.isWatching = true;

    // Watch location with threshold of 100m (better UX than every tiny change)
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100, // Only update if moved 100m+
        timeInterval: 30000, // Or every 30 seconds
      },
      (location) => {
        const newLoc: UserLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 50,
          timestamp: location.timestamp,
        };

        // Update state
        this.state.current = newLoc;

        // Sync to DB (debounced — max once per 10 seconds)
        if (Date.now() - this.state.lastSyncTime > 10000) {
          this.syncLocationToDB().catch(e => console.warn('[LocationManager] Watch sync failed:', e));
        }
      }
    ).then(sub => {
      this.watchSubscription = sub;
    }).catch(error => {
      console.error('[LocationManager] Watch error:', error);
      this.state.isWatching = false;
    });

    // Ensure sync every 60 seconds even if location hasn't changed
    this.syncInterval = setInterval(() => {
      if (this.state.current && this.userId) {
        this.syncLocationToDB().catch(e => console.warn('[LocationManager] Interval sync failed:', e));
      }
    }, 60000);
  }

  /**
   * SYNC TO DATABASE: The single source of truth
   * Updates user's location in app_profiles
   */
  private async syncLocationToDB(): Promise<void> {
    if (!this.state.current || !this.userId) return;

    try {
      const { error } = await supabase
        .from('app_profiles')
        .update({
          last_location_latitude: this.state.current.latitude,
          last_location_longitude: this.state.current.longitude,
          last_location_accuracy: this.state.current.accuracy,
          last_location_timestamp: new Date(this.state.current.timestamp).toISOString(),
        })
        .eq('user_id', this.userId);

      if (error) {
        console.error('[LocationManager] DB sync error:', error);
        return;
      }

      this.state.lastSyncTime = Date.now();
      console.log('[LocationManager] Location synced:', {
        lat: this.state.current.latitude,
        lng: this.state.current.longitude,
        accuracy: this.state.current.accuracy,
      });
    } catch (error) {
      console.error('[LocationManager] Sync exception:', error);
    }
  }

  /**
   * GET CURRENT: Return user's current location
   * This is THE location to use everywhere
   */
  getCurrent(): UserLocation | null {
    return this.state.current;
  }

  /**
   * GET COORDS: Quick access to lat/lng (for maps, etc.)
   */
  getCoords(): { latitude: number | null; longitude: number | null } {
    return {
      latitude: this.state.current?.latitude ?? null,
      longitude: this.state.current?.longitude ?? null,
    };
  }

  /**
   * CLEANUP: Stop watching location (on app background)
   */
  cleanup() {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.state.isWatching = false;
  }

  /**
   * FORCE REFRESH: Get fresh location immediately (e.g., after permissions change)
   */
  async forceRefresh(): Promise<UserLocation | null> {
    try {
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (fresh) {
        this.state.current = {
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
          accuracy: fresh.coords.accuracy || 50,
          timestamp: fresh.timestamp,
        };

        await this.syncLocationToDB();
        return this.state.current;
      }

      return null;
    } catch (error) {
      console.error('[LocationManager] Force refresh error:', error);
      return null;
    }
  }

  /**
   * Is user location available + valid?
   */
  isReady(): boolean {
    return this.state.current !== null && this.state.current.latitude !== undefined && this.state.current.longitude !== undefined;
  }
}

// Singleton instance
export const locationManager = new LocationManager();
