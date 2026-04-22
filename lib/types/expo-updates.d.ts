/**
 * Type stub for expo-updates.
 *
 * Same pattern as expo-image and expo-tracking-transparency:
 * the real package shadows this file once `npx expo install
 * expo-updates` has run. Until then, TypeScript uses this
 * stub so our `lib/updates.ts` compiles.
 *
 * Run on your machine to activate OTA:
 *
 *   npx expo install expo-updates
 *   eas update:configure
 *
 * After the second command, an Updates URL is added to
 * app.json automatically, and the build starts accepting
 * `eas update --branch ...` pushes.
 */

declare module 'expo-updates' {
  export const isEnabled: boolean;
  export const channel: string | null;
  export const runtimeVersion: string | null;
  export const updateId: string | null;

  export interface UpdateCheckResult {
    isAvailable: boolean;
    manifest?: { id: string; createdAt: string; [key: string]: unknown };
  }

  export interface UpdateFetchResult {
    isNew: boolean;
    manifest?: { id: string; createdAt: string; [key: string]: unknown };
  }

  export function checkForUpdateAsync(): Promise<UpdateCheckResult>;
  export function fetchUpdateAsync(): Promise<UpdateFetchResult>;
  export function reloadAsync(): Promise<void>;
}
