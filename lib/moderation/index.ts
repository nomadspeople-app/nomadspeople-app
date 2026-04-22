/**
 * Moderation entry point.
 *
 * Public surface:
 *   - scanText(text)         → sync, returns { allowed, … }
 *   - logModerationEvent(…)  → fire-and-forget DB log
 *   - checkSendBlock(uid)    → async, true if user is rate-limited
 *   - applyRateLimit(uid)    → set 1-hour block on profile
 *
 * Pipeline at every send / publish:
 *
 *   1. checkSendBlock(userId) — currently rate-limited?
 *      If yes → return blocked-reason 'rate_limited'.
 *   2. scanText(content) — does the text match a slur/threat
 *      /self-harm/sexual pattern?
 *      If no → return allowed.
 *      If yes:
 *        a. logModerationEvent — fire-and-forget log row.
 *        b. Count flags in last 24h for this user.
 *        c. If count >= 4 (this attempt is the 4th) →
 *           applyRateLimit + return 'rate_limited_just_now'.
 *        d. Else → return 'flagged' (caller shows the polite
 *           Alert).
 *
 * Per the launch freedom policy
 * (docs/product-decisions/2026-04-20-launch-freedom-policy.md):
 *   - profanity is NOT scanned
 *   - links / images / promotional content is NOT scanned
 *   - the filter is the Apple-1.2 minimum, nothing more
 */

import { supabase } from '../supabase';
import { normalize, tokenize, contentHash } from './normalize';
import { ALL_PATTERNS, type ModerationPattern } from './patterns';
import { ENGLISH_SLURS } from './wordlists/slurs.en';
import { HEBREW_SLURS } from './wordlists/slurs.he';
import { RUSSIAN_SLURS } from './wordlists/slurs.ru';

/* ─── Public types ─── */

export type ModerationCategory = 'slur' | 'threat' | 'sexual' | 'self_harm';
export type ModerationSurface = 'chat' | 'checkin' | 'profile';

export interface ScanResult {
  allowed: boolean;
  /** Present when allowed=false. */
  category?: ModerationCategory;
  /** Internal tag for logging. NEVER show to user. */
  matchedTerm?: string;
}

/* ─── Slur scan — single set lookup per token ─── */

const ALL_SLURS: ReadonlySet<string> = new Set([
  ...ENGLISH_SLURS,
  ...HEBREW_SLURS,
  ...RUSSIAN_SLURS,
]);

function scanSlurs(normalizedText: string): ScanResult {
  const tokens = tokenize(normalizedText);
  for (const token of tokens) {
    if (ALL_SLURS.has(token)) {
      return { allowed: false, category: 'slur', matchedTerm: token };
    }
  }
  return { allowed: true };
}

/* ─── Pattern scan — regex over normalized text ─── */

function scanPatterns(normalizedText: string): ScanResult {
  for (const p of ALL_PATTERNS) {
    if (p.regex.test(normalizedText)) {
      return { allowed: false, category: p.category, matchedTerm: p.tag };
    }
  }
  return { allowed: true };
}

/* ─── Public scan entry ─── */

export function scanText(text: string): ScanResult {
  if (!text || !text.trim()) return { allowed: true };

  const normalized = normalize(text);

  // Slurs first — fastest (set lookup) and most common.
  const slurResult = scanSlurs(normalized);
  if (!slurResult.allowed) return slurResult;

  // Then phrase patterns (regex — slightly more expensive).
  const patternResult = scanPatterns(normalized);
  if (!patternResult.allowed) return patternResult;

  return { allowed: true };
}

/* ─── DB integration: log + rate-limit ─── */

export interface LogEventInput {
  userId: string;
  surface: ModerationSurface;
  category: ModerationCategory;
  matchedTerm?: string;
  text: string;  // we'll hash it internally; never stored as plaintext
}

/** Fire-and-forget. Failures are swallowed (logged to console)
 *  because we never want a moderation log failure to BLOCK
 *  the user-facing path more than the moderation already
 *  does. */
export async function logModerationEvent(input: LogEventInput): Promise<void> {
  try {
    const hash = await contentHash(input.text);
    const { error } = await supabase.from('app_moderation_events').insert({
      user_id: input.userId,
      surface: input.surface,
      category: input.category,
      matched_term: input.matchedTerm ?? null,
      content_hash: hash,
      content_len: input.text.length,
    });
    if (error) {
      console.warn('[moderation] log insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[moderation] log unexpected failure:', err);
  }
}

/** True if the user is currently rate-limited from sending.
 *  Returns false (no block) on any DB error — fail-OPEN here,
 *  because failing closed would let a transient Supabase
 *  glitch silently lock out users. */
export async function checkSendBlock(userId: string): Promise<{
  blocked: boolean;
  until?: Date;
}> {
  try {
    const { data, error } = await supabase
      .from('app_profiles')
      .select('send_blocked_until')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data?.send_blocked_until) return { blocked: false };
    const until = new Date(data.send_blocked_until);
    if (until.getTime() <= Date.now()) {
      // Expired block — clean up so we don't keep checking.
      void supabase
        .from('app_profiles')
        .update({ send_blocked_until: null })
        .eq('user_id', userId);
      return { blocked: false };
    }
    return { blocked: true, until };
  } catch {
    return { blocked: false };
  }
}

/** Set the 1-hour rate-limit. Called from the gate when the
 *  user has reached 4 flagged attempts in the last 24h. */
export async function applyRateLimit(userId: string): Promise<void> {
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  try {
    await supabase
      .from('app_profiles')
      .update({ send_blocked_until: oneHourFromNow })
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[moderation] applyRateLimit failed:', err);
  }
}

/** Count flagged events for a user in the last 24h. Used by
 *  the gate to decide if THIS attempt should trigger the
 *  rate-limit. */
export async function countRecentFlags(userId: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('app_moderation_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/* ─── The single gate function ──────────────────────────────
 *
 * This is what callers use. It folds:
 *   - the pre-check rate-limit
 *   - the scan
 *   - the post-flag log + escalation
 *
 * Returns one of three states:
 *   'allowed'              — let the caller proceed
 *   'flagged'              — block + show polite alert
 *   'rate_limited'         — block + show "paused for an hour" alert
 *
 * Caller responsibility: surface the right localized Alert.
 * This function does not touch UI. */

export type GateOutcome =
  | { state: 'allowed' }
  | { state: 'flagged'; category: ModerationCategory }
  | { state: 'rate_limited'; until: Date };

export async function gateContent(input: {
  userId: string;
  surface: ModerationSurface;
  text: string;
}): Promise<GateOutcome> {
  // 1. Already-blocked check — fast path before scanning.
  const block = await checkSendBlock(input.userId);
  if (block.blocked) {
    return { state: 'rate_limited', until: block.until! };
  }

  // 2. Scan the content.
  const scan = scanText(input.text);
  if (scan.allowed) return { state: 'allowed' };

  // 3. Flagged — log it.
  await logModerationEvent({
    userId: input.userId,
    surface: input.surface,
    category: scan.category!,
    matchedTerm: scan.matchedTerm,
    text: input.text,
  });

  // 4. Decide if THIS attempt should trigger the rate-limit.
  //    The log just inserted IS counted in the "since 24h"
  //    query, so 4 flags total → this is the 4th → apply.
  const recentCount = await countRecentFlags(input.userId);
  if (recentCount >= 4) {
    await applyRateLimit(input.userId);
    const until = new Date(Date.now() + 60 * 60 * 1000);
    return { state: 'rate_limited', until };
  }

  return { state: 'flagged', category: scan.category! };
}
