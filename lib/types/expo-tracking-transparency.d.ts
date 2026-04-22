/**
 * Type stub for expo-tracking-transparency.
 *
 * Why this exists: the package isn't yet installed on this
 * machine (network access blocked in dev sandbox). We import
 * the package dynamically inside lib/permissions.ts so the
 * code compiles without it, and at runtime it gracefully
 * skips the ATT step until the package is added.
 *
 * On Barak's machine, run:
 *
 *     npx expo install expo-tracking-transparency
 *
 * That brings the real package + its real types in, which
 * shadow this stub. This file then becomes redundant — feel
 * free to delete it once the package is installed and you
 * confirm `npx tsc --noEmit` still passes.
 */

declare module 'expo-tracking-transparency' {
  export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'restricted';

  export interface TrackingPermissionResponse {
    status: PermissionStatus;
    granted: boolean;
    canAskAgain: boolean;
    expires: 'never';
  }

  export function requestTrackingPermissionsAsync(): Promise<TrackingPermissionResponse>;
  export function getTrackingPermissionsAsync(): Promise<TrackingPermissionResponse>;
}
