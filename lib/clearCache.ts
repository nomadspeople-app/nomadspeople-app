/**
 * Clear all app cache, storage, and session data
 * Use this if you're stuck with stale RLS policies or session issues
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export async function clearAllCache() {
  try {
    console.log('[clearCache] Starting full cache clear...');

    // 1. Clear AsyncStorage
    await AsyncStorage.clear();
    console.log('[clearCache] ✓ Cleared AsyncStorage');

    // 2. Sign out from Supabase (clears session)
    await supabase.auth.signOut();
    console.log('[clearCache] ✓ Signed out from Supabase');

    // 3. Clear Supabase cache if available
    if (supabase.realtime) {
      supabase.realtime.disconnect();
      console.log('[clearCache] ✓ Disconnected Realtime');
    }

    console.log('[clearCache] ✅ All cache cleared successfully!');
    return true;
  } catch (err) {
    console.error('[clearCache] Error:', err);
    return false;
  }
}

/**
 * Quick diagnostic - check what's in AsyncStorage
 */
export async function diagnoseStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('[diagnoseStorage] AsyncStorage keys:', keys);

    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`[diagnoseStorage] ${key}:`, value?.slice(0, 100));
    }
  } catch (err) {
    console.error('[diagnoseStorage] Error:', err);
  }
}
