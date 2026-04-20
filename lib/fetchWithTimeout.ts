/**
 * fetchWithTimeout — resilient wrapper around fetch() for external APIs.
 *
 * Problem it solves: React Native's fetch has variable default timeouts
 * (iOS 60s, Android worse) and when a public free API like Photon or
 * Nominatim is slow, the request hangs and eventually throws
 * "TypeError: Network request timed out" into LogBox — which shows up
 * as a scary red error to the user on dev builds and clutters logs on
 * production.
 *
 * This wrapper:
 *  - Enforces an explicit timeout via AbortController (default 8s).
 *  - Catches timeout, abort, and network failures as a single typed
 *    outcome so callers don't have to handle each case separately.
 *  - Never throws. Returns `null` on failure; caller decides fallback.
 *  - Logs failures once, with a tidy tag, so we can trace which API
 *    flaked without bubbling up a stack trace.
 *
 * Use this for every fetch() to a URL we DON'T own (Photon, Nominatim,
 * ipapi, etc.). For Supabase, keep using the supabase client — it has
 * its own retry/timeout handling.
 */

interface Options {
  /** Max time to wait, in ms. Default 8000. */
  timeoutMs?: number;
  /** Headers to pass through. User-Agent is always set to NomadsPeople. */
  headers?: Record<string, string>;
  /** Tag used in the console log when it fails. Defaults to the URL host. */
  tag?: string;
}

/**
 * Fetch with timeout. Returns parsed JSON on success, or null on any
 * failure (timeout, network error, non-2xx, JSON parse error).
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  opts: Options = {},
): Promise<T | null> {
  const { timeoutMs = 8000, headers = {}, tag } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const label = tag || new URL(url).host;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NomadsPeople/1.0', ...headers },
    });
    if (!res.ok) {
      console.warn(`[${label}] ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    return data as T;
  } catch (err: any) {
    // AbortController aborts show up as DOMException "Aborted" on web
    // and AbortError on RN. TypeError is RN's Network request failed.
    const isAbort = err?.name === 'AbortError' || /abort/i.test(err?.message || '');
    const isTimeout = isAbort; // abort from our own timer = timeout
    const kind = isTimeout ? 'timeout' : 'network';
    // Warn, don't throw. The LogBox error the user saw is exactly what
    // we're preventing — callers get null and can choose their fallback.
    console.warn(`[${label}] ${kind} after ${timeoutMs}ms`, err?.message || '');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
