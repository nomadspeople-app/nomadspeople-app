/**
 * normalize — text preprocessing for the moderation scanner.
 *
 * Goal: defeat the most casual obfuscation tricks (leetspeak,
 * stretched letters, bidi-control insertion) without
 * over-aggressive normalization that would create false
 * positives.
 *
 * What we DON'T try to do:
 *   - Catch every determined troll. Once someone deliberately
 *     spaces "f-u-c-k" with weird unicode, they'll get
 *     through. That's where reportMessage takes over.
 *   - Detect intent. We work at the surface level only.
 *
 * Public entry: `normalize(text)` returns a lowercased,
 * de-obfuscated string suitable for substring + word-token
 * matching by the scanner.
 */

/* Unicode bi-directional control characters that can be
 * sneaked in to confuse a scanner. Strip them entirely.
 * (Hebrew/Arabic users normally don't need these in text.) */
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/* Zero-width joiners & friends — used by some attacks to
 * insert invisible characters between letters. */
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/* Common leetspeak substitutions. Order matters: longer
 * sequences first (we don't have any here, but if we add
 * "ph→f" later it must come before "p→p"). */
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

/* Convert combining diacritics → base letter. e.g. é → e.
 * Using NFD then stripping combining marks (\p{M}) leaves us
 * with the bare letter. Required for Spanish-speaking nomads
 * who type "señor" — we want to scan "senor" not "se?or". */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/* Collapse runs of repeated letters (3+) down to 2. e.g.
 * "fuckkkkkkk" → "fuckk". Keeps double letters intact (e.g.
 * "see") but defeats stretched-letter bypass. */
function collapseStretched(s: string): string {
  return s.replace(/(.)\1{2,}/g, '$1$1');
}

/* The full pipeline. */
export function normalize(text: string): string {
  if (!text) return '';

  let out = text;

  // 1. Strip invisible chars (bidi controls, zero-width).
  out = out.replace(BIDI_CONTROLS, '');
  out = out.replace(ZERO_WIDTH, '');

  // 2. Collapse diacritics (Latin scripts).
  out = stripDiacritics(out);

  // 3. Lowercase everything (Hebrew/Russian unaffected; Latin
  //    becomes uniform).
  out = out.toLowerCase();

  // 4. Defeat leetspeak.
  out = out.replace(/[0134578@$]/g, ch => LEET_MAP[ch] ?? ch);

  // 5. Defeat stretched letters.
  out = collapseStretched(out);

  return out;
}

/* Tokenize normalized text into individual words. Splits on
 * any non-letter / non-digit (space, punctuation, emoji,
 * etc.). Preserves Hebrew and Cyrillic letters via the \p{L}
 * Unicode category. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  // \p{L} = any letter (Latin, Hebrew, Cyrillic, Arabic, etc.)
  // \p{N} = any number (kept since leetspeak might leave some)
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 0);
}

/* Hash a normalized text for dedup logging. We never store
 * the plaintext — only this hash.
 *
 * v1 uses a compact non-cryptographic hash (djb2-style) —
 * fine for dedup counting at launch scale (admin wants to
 * see "phrase X was caught Y times" without reading content).
 * Not cryptographic; admins could theoretically brute-force
 * very short messages, but realistic attack surface is tiny.
 *
 * v2 upgrade path: once `expo-crypto` is added to the package
 * (next native rebuild), swap the body for SHA-256. The public
 * API of this function (async → string) stays the same so
 * callers aren't disturbed. */
export async function contentHash(text: string): Promise<string> {
  const normalized = normalize(text);
  // Double-hash (forward + reverse) for better distribution
  // than a single djb2 pass.
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 31) + c;
    h1 |= 0;
    h2 |= 0;
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return (a + b).slice(0, 16);
}
