import { useEffect, useState } from 'react';

/**
 * eventTime — the ONE helper for "when is this event happening?"
 *
 * Called from:
 *   • TimerBubble          — subtitle under the title on map pin tap
 *   • GroupInfoScreen      — the WHEN row under the activity name
 *
 * Why one helper:
 *   Pre-refactor, each surface had its own inline `formatDate` /
 *   `formatCountdown` that diverged over time (e.g. ActivityDetailSheet
 *   said "today", TimerBubble said "live now", GroupInfoScreen said
 *   nothing at all). The product owner reported that the user could
 *   never be sure WHEN an event was happening. We extract once here,
 *   every surface reads it, the answer is always consistent.
 *
 * Shape:
 *   The function returns a STRUCTURED state — kind + short labels —
 *   and the caller localizes via t(). This keeps strings out of the
 *   helper (CLAUDE.md i18n mandatory rule) while keeping the date/
 *   duration math in one place.
 */

export type EventTimeKind =
  | 'timer-live'   // type=timer, not expired — show countdown "ends in {dur}"
  | 'timer-ended' // type=timer, expires_at already past
  | 'starts-soon' // type=status, scheduled_for in future, < 24h — "starts in {dur}"
  | 'starts-on'   // type=status, scheduled_for ≥ 24h away — "tomorrow · 18:00" / "Mon 21 apr · 18:00"
  | 'live-now'    // type=status, scheduled_for already started but expires_at future
  | 'ended';      // everything else past the end

export interface EventTimeState {
  kind: EventTimeKind;
  /** "23m" / "1h 5m" / "2d 4h" — present on timer-live, starts-soon, live-now. */
  durationShort?: string;
  /** One of 'today' | 'tomorrow' when scheduled within the next
   *  36h; null otherwise (caller uses `dayLabel` instead). */
  dayKey?: 'today' | 'tomorrow' | null;
  /** Human day label for starts-on — English weekday + short date
   *  fallback, e.g. "mon 21 apr". Lowercase per nomadspeople copy
   *  rules. */
  dayLabel?: string;
  /** "18:00" in 24h format; null if flexible/all-day. */
  timeShort?: string | null;
  /** True when the creator marked the scheduled event as all-day. */
  flexible?: boolean;
}

export interface EventTimeInput {
  type: 'timer' | 'status';
  scheduledFor: string | null;
  expiresAt: string | null;
  isFlexible?: boolean | null;
  /** Override "now" — used by tests and the useEventTime hook's tick. */
  now?: number;
}

/** "23m" / "1h 5m" / "2d 4h" — always positive, always at least "1m". */
export function formatDurationShort(ms: number): string {
  const safe = Math.max(60 * 1000, ms); // never return "0m"
  const minsTotal = Math.floor(safe / 60000);
  if (minsTotal < 60) return `${minsTotal}m`;
  const hrsTotal = Math.floor(minsTotal / 60);
  if (hrsTotal < 24) {
    const rm = minsTotal % 60;
    return rm > 0 ? `${hrsTotal}h ${rm}m` : `${hrsTotal}h`;
  }
  const days = Math.floor(hrsTotal / 24);
  const rh = hrsTotal % 24;
  return rh > 0 ? `${days}d ${rh}h` : `${days}d`;
}

/** 'today' if same calendar day, 'tomorrow' if next, null otherwise. */
function dayOffset(targetMs: number, nowMs: number): 'today' | 'tomorrow' | null {
  const a = new Date(nowMs);
  const b = new Date(targetMs);
  const dayA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const dayB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  const diff = Math.round((dayB - dayA) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return null;
}

/** "mon 21 apr" — lowercase, English, used only when dayKey is null. */
function formatDayLabel(ms: number): string {
  try {
    return new Date(ms)
      .toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
      .toLowerCase();
  } catch {
    return '';
  }
}

function formatTimeShort(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function describeEventWhen(input: EventTimeInput): EventTimeState {
  const now = input.now ?? Date.now();
  const sched = input.scheduledFor ? new Date(input.scheduledFor).getTime() : null;
  const exp = input.expiresAt ? new Date(input.expiresAt).getTime() : null;
  const flex = !!input.isFlexible;

  if (input.type === 'timer') {
    if (!exp || exp <= now) return { kind: 'timer-ended' };
    return { kind: 'timer-live', durationShort: formatDurationShort(exp - now) };
  }

  // type === 'status' (scheduled)
  if (sched && sched > now) {
    const diff = sched - now;
    // <24h away → countdown feels more alive than a date
    if (diff < 24 * 60 * 60 * 1000) {
      return { kind: 'starts-soon', durationShort: formatDurationShort(diff) };
    }
    // ≥24h → show the day + time.
    //
    // We ALWAYS populate timeShort when scheduled_for is set.
    // The `flex` flag on `app_checkins` is a policy switch for
    // pin lifetime (is_flexible_time=true → pin expires at end
    // of day, lets late joiners still find the event) — it's
    // NOT a signal that the creator didn't pick a specific
    // hour. Conflating the two used to make scheduled events
    // display as "tomorrow · all day" even when the user had
    // picked 18:00 in the WHEN picker. See the 2026-04-20
    // display fix.
    return {
      kind: 'starts-on',
      dayKey: dayOffset(sched, now),
      dayLabel: dayOffset(sched, now) === null ? formatDayLabel(sched) : undefined,
      timeShort: formatTimeShort(sched),
      flexible: flex,
    };
  }

  // scheduled_for already in the past
  if (exp && exp > now) {
    return { kind: 'live-now', durationShort: formatDurationShort(exp - now) };
  }
  return { kind: 'ended' };
}

/** React hook — describeEventWhen with a 30 s tick so the countdown
 *  text refreshes while the screen is open. 30 s is the same tick
 *  rate TimerBubble's old inline `useCountdown` used — fine for
 *  minute-level precision and cheap on battery. */
export function useEventTime(
  input: Omit<EventTimeInput, 'now'>
): EventTimeState {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);
  return describeEventWhen({ ...input, now });
}
