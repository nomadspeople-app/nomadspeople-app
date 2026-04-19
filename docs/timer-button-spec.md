# Timer Button — Locked Spec (2026-04-19)

## Concept

> **A Timer is a Tweet.** Short-lived, fire-and-forget, immediate. "I'm at the café RIGHT NOW for the next 45 min — who wants to come?" or "Running to the beach in 15 min — pick me up." Publish and forget. No scheduling, no planning, no approvals. When the clock runs out, the pin disappears.

**Timer is NOT a Status.** A Status is a mini event you plan ahead (date + time + optional privacy). A Timer is a pulse — right-here, right-now, deadline in minutes, everyone welcome.

If it feels like a 2-hour Status, we built it wrong.

## Locked principles

1. **Time-boxed at source.** Every timer has a hard `expires_at = now + durationMinutes`. No flexible time, no scheduled future, no grace period.
2. **Always public.** Privacy and approval flows are Status territory. A timer says "come" to everyone in range or it says nothing.
3. **Minimal editing.** Once published, the ONLY field the owner can change is the short status text (`status_text` / `activity_text`) — the message that appears under the emoji. Location, time, category, privacy are all frozen at publish. To move to a new spot or change duration: cancel and publish a new timer.
4. **Short copy, big emoji.** The pin, bubble, and chat header emphasize urgency and vibe, not details.
5. **One active timer per user.** Publishing a new one replaces the old one (same one-slot rule as Status).
6. **Red = Timer.** Green = Status. This is the universal color code on the map and in every UI surface.

## Lifecycle

```
PUBLISHED  ─tap red FAB→ TimerSheet → publish
            │
            ├─ is_active = true
            ├─ scheduled_for = NULL (never scheduled)
            ├─ is_open = true (always)
            ├─ is_flexible_time = false
            ├─ expires_at = now + durationMinutes  (15 / 30 / 45 / 60 / 90 / 120 min options)
            └─ member_count = 1 (owner)

ALIVE      visible on map with red ring + minutes-left counter
            │
            ├─ visitor taps  → TimerBubble in place (no map camera move)
            ├─ visitor joins → added to chat, count++, "joined" message
            ├─ owner taps    → TimerBubble with "cancel timer" option
            └─ owner extends → expires_at pushed further into the future

ENDED      cron flips is_active=false when expires_at < now
            │ chat survives (members can still chat the afterglow)
            └─ pin disappears from every map filter
```

## Fields in `app_checkins` for a timer

| Field | Value |
|---|---|
| `checkin_type` | `'timer'` |
| `status_text` / `activity_text` | user's short free text (e.g. "at Cafelix, come sit") |
| `status_emoji` | category emoji |
| `category` | coffee / food / outdoors / work / ... |
| `latitude`, `longitude`, `location_name` | live GPS snapshot |
| `city` | resolved via `resolveCityFromCoordinates` (CITIES DB 15 km → Nominatim fallback) |
| `scheduled_for` | **always NULL** — a timer is never scheduled |
| `is_flexible_time` | **always false** |
| `expires_at` | `now + durationMinutes` |
| `is_open` | **always true** |
| `is_active` | true until cron flips it |
| `member_count` | 1, incremented on each approved join |
| `age_min` / `age_max` | joiner age filter (same bidirectional filter as Status) |

## Visual contract

### Map pin
- Same avatar ring as a Status, but with a **red border (`#FF6B6B`)** instead of green
- Live countdown label under the pin (e.g. `23m` / `1h15m`)
- When `expires_at ≤ now`, border turns gray and pin is at 50 % opacity (the cron picks it up within 5 min and removes it entirely)
- `tracksViewChanges={false}` always (no flicker — same rule as Status, from CLAUDE.md)

### Timer bubble (on tap, anyone)
- Overlays the pin in place — the map does NOT animate or move
- Shows: emoji + owner avatar + short text + countdown
- Visitor buttons: **Join** (bottom) + **X** (top-right close)
- Owner buttons: **Cancel Timer** (primary) + **X** (close) + (eventually **Extend time**)

### Active card in owner's profile
- Same `activeEvent` card used for Status, but with red left-bar accent and the countdown in place of a future date

## Each button — owner side

### 1. Red FAB (Create)
- **Location**: HomeScreen, FAB column, bottom of the three
- **Hidden when** snooze mode is on
- **Tap when active timer exists** → "Cancel & replace?" sheet (same one-slot rule as Status)
- **Tap when no active timer** → opens `TimerSheet`

### 2. TimerSheet → Publish
- User picks: short text + category + duration (15/30/45/60/90/120 min) + age range
- Location = live GPS (no search — speed matters; if they want to pin a specific address, that's a Status)
- `is_open` is locked to true; the UI never shows a Private toggle for timers
- Insert into `app_checkins` + `addOptimistic` so the red pin appears instantly
- Deactivates any prior `checkin_type='timer'` row for this user (one-slot enforcement) — the DB update runs BEFORE the insert

### 3. Tap own timer pin on map
- `handlePinTap` detects `isTimer && isOwn`
- Opens `TimerBubble` in place. No map animation. (Previously it flew the map to the owner's live GPS — that was a bug, removed earlier this session.)
- Bubble shows **Cancel Timer** as the primary action, not Join.

### 4. Cancel Timer (owner only, from the bubble)
- Confirmation alert
- Sets `is_active = false` (no hard delete; chat survives for the aftermath)
- Pin disappears from map immediately via optimistic state + refetch on focus
- Posts "❌ Timer cancelled" to the chat if a chat exists

### 5. Extend time (reserved)
- NOT YET implemented. Design: small `+15m` / `+30m` chips on the owner's timer bubble. On tap, `expires_at += minutes`.
- For now the owner's only path to stretch time is to cancel and re-publish.

## Each button — visitor side

### 1. Tap a timer pin on map
- `handlePinTap` detects `isTimer && !isOwn`
- Opens `TimerBubble` in place — **no map animation, no sheet-sized takeover**. Tweet-like: quick peek, quick action.

### 2. Join (from the bubble)
- `createOrJoinStatusChat(myId, ownerId, timerText, ..., requiresApproval=false)` — always false because timers are always public
- Member row inserted as `status='active'`, "joined" message in chat, `member_count++`
- Haptic, then the bubble shows "Chat" in place of "Join"

### 3. Chat (after join)
- Same group chat as a Status chat, but auto-closes on the consumer side once `expires_at` passes and the pin is gone — the chat itself isn't deleted.

## Map filter (how timers show up on the map)

Same `useActiveCheckins` that feeds Status pins:
- `is_active = true`
- `city ILIKE currentCity`
- `visibility IN ('public','city_only')`
- not `show_on_map = false` for the creator
- bidirectional age filter
- `expires_at > now()` (client-side enforcement)

Timers and Statuses come from the same query; the pin renderer (`buildNomadMarker`) switches visual style by `checkin_type`.

## Chat semantics

- Timer chat created lazily on first join, same as Status (`createOrJoinStatusChat`).
- Owner is 'admin' member. Joiners are 'active' members (never 'request' — timers have no approval).
- System messages posted by owner when they cancel the timer: "❌ Timer cancelled" (uses the same `postEventSystemMessage` helper, `sender_id = ownerUserId` so RLS passes).
- Block / Report / Delete Message / Leave — all exist via shared chat infra.
- Chat survives after the pin disappears, so the few minutes of afterglow ("we did sunset already, next time?") aren't cut short.

## Red lines (never cross)

- **Timer has no `scheduled_for`.** Ever. If someone tries to add it, it stops being a timer.
- **Timer has no `is_open = false`.** No private timers, no approval flow.
- **Timer has no editable location / time / category / privacy.** The ONLY editable field is `status_text` (the short message). Anything else → cancel + repost.
- **Timer has no "scheduled specific time" branch.** The `expires_at` policy is always `now + durationMinutes`.
- **Timer tap never flies the map.** Bubble in place. (The old `(isOwn && isTimer && userLat)` special case was removed this session.)
- **Timer border is always red** (`#FF6B6B`) or gray when expired. Never green.

## Files in scope

```
screens/
  HomeScreen.tsx               ← red FAB, handlePinTap routing, handleTimerPublish
components/
  TimerSheet.tsx               ← create form
  TimerBubble.tsx              ← in-place bubble for tap
  QuickStatusSheet.tsx         ← separate: Status creation (do NOT confuse)
lib/
  hooks.ts                     ← useActiveCheckins (shared with Status),
                                 createOrJoinStatusChat (shared — works for timer too)
  cityResolver.ts              ← resolveCityFromCoordinates
  eventSystemMessages.ts       ← postEventSystemMessage (for cancel notice)
DB:
  app_checkins                 ← rows with checkin_type='timer'
  app_conversations            ← chat per timer, created on first join
  app_conversation_members     ← timer members (always 'active', never 'request')
  pg_cron expire-old-checkins  ← same cron, same rule: is_active=false WHERE expires_at<now
```

## Test scenarios — tick before declaring "timer flow works"

- [ ] Owner publishes a 30-min timer → red pin appears on map instantly with `30m` countdown
- [ ] Another user (in age range) taps pin → TimerBubble opens in place, map does NOT move
- [ ] User outside age range → never sees the pin
- [ ] Visitor taps Join → immediately added to chat, "joined" message appears, member_count++
- [ ] Owner taps own pin → TimerBubble shows "Cancel Timer", NOT "Join"
- [ ] Owner taps "Cancel Timer" → confirmation → is_active=false → pin disappears, chat survives
- [ ] 30 min later (or force expire via DB) → cron flips is_active=false within 5 min, pin is gone for everyone
- [ ] Publishing a new timer while one is active → old one auto-deactivates; only the new one remains on the map
- [ ] `handlePinTap` on timer does NOT zoom the map (vs. Status which animates to the neighborhood)
- [ ] Chat of an expired timer still opens for its members (just no pin on the map)

## Summary — why this stays light

A Timer feels like a Tweet because:
- Max 1 active at a time per user → no inventory stress
- No editing surface → nothing to "manage"
- No approvals → one tap from seeing to joining
- Short countdown visible in the pin → urgency is obvious
- Auto-expires → no cleanup nagging, just disappears

If any change ever adds a field, option, or button to this flow, check it against the red lines. When in doubt, move it to Status.
