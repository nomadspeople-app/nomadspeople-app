# Status Button — Locked Spec (2026-04-19)

The status flow is the core of NomadsPeople: how a nomad announces "I'm here doing X" or "I'm planning event Y, who's in?". Everything below is the **locked logic**. Any change must respect every section of this document or revisit the spec first.

## Concept

> **A status is a future or immediate event with a place and (optionally) a time. The owner publishes it. Other nomads in the matching age range see it on the map. They can join (or request to join, if private) and chat with the owner + other joiners until the event happens.**

Status ≠ Timer. Timer is "I'm at this spot for a short window" — different lifecycle, different bubble color, different rules.

## Locked architecture

| Layer | Where | What it owns |
|---|---|---|
| Create button | `screens/HomeScreen.tsx` — green FAB in `fabColumn` | Tapping shows `QuickStatusSheet` (or replace prompt if existing active status) |
| Create form | `components/QuickStatusSheet.tsx` | The 5-step wizard. Outputs `QuickActivityData` |
| Publish | `screens/HomeScreen.tsx::handleQuickPublish` | Resolves city, computes `expires_at`, inserts into `app_checkins`, creates the chat lazily on first join |
| Map render | `screens/HomeScreen.tsx::buildNomadMarker` | Visual: avatar + ring + emoji + label. `tracksViewChanges={false}` always |
| Visibility filter | `lib/hooks.ts::useActiveCheckins` | Server-side `.eq('is_active', true).ilike('city', currentCity)` + client filter for `expires_at`, `show_on_map`, age range |
| Visitor sheet | `components/ActivityDetailSheet.tsx` | What a visitor sees on tap. Join flow + active members strip |
| Owner sheet | `screens/ProfileScreen.tsx` Activity Info modal | Owner's management. Stage edits → bottom Save bar. Pending requests + active members rows |
| Chat helpers | `lib/hooks.ts::createOrJoinStatusChat` `approvePendingMember` `denyPendingMember` | Single source of truth for join + approval mechanics |
| System messages | `lib/eventSystemMessages.ts` | Posts `app_messages` rows with `sender_id = null` for change notifications |
| Cron | Supabase pg_cron `expire-old-checkins` | Marks `is_active = false` when `expires_at < now()` |

## Lifecycle (every state transition)

```
PUBLISHED  ─tap green FAB→ QuickStatusSheet → publish
            │
            ├─ is_active = true
            ├─ scheduled_for ∈ {NULL, future Date}
            ├─ is_open ∈ {true=public, false=private}
            ├─ expires_at = (see "Lifetime" below)
            └─ member_count = 1

ALIVE      visible on map, tappable
            │
            ├─ visitor taps  → ActivityDetailSheet → Join | request
            ├─ owner edits   → Activity Info modal → stage → Save
            └─ owner deletes → confirm → is_active=false → pin gone

ENDED      cron flips is_active=false when expires_at < now
            │ chat survives (separate entity)
            └─ pin disappears from every map filter
```

## Lifetime — `expires_at` policy

| Case | `scheduled_for` | `is_flexible_time` | `expires_at` |
|---|---|---|---|
| Immediate "I'm here now" | NULL | n/a | `now + 60 min` |
| Scheduled, specific time | future Date | false | `= scheduled_for` (event start) |
| Scheduled, flexible time | future Date | true | `23:59:59 of scheduled_for's local day` |

The cron job `expire-old-checkins` (every 5 min) and the client filter in `useActiveCheckins` BOTH respect `expires_at` exclusively. No grace periods, no scheduled_for special-casing.

## Privacy — `is_open` semantics

| `is_open` | Map visibility (within age range) | Join behavior |
|---|---|---|
| `true` (public) | Visible to all matching nomads | Tap Join → instant member, "Joined" message in chat, `member_count++` |
| `false` (private) | Visible to all matching nomads | Tap "request to join" → `app_conversation_members.status='request'` → owner approves/denies |

**Privacy does NOT hide the event from the map.** Age range does. Anyone outside the `[age_min, age_max]` range never sees the pin.

## Each button — owner side

### 1. Green FAB (Create)
- **Hidden when** snooze mode is on
- **Tap when active status exists** → "Replace existing status?" alert
- **Tap when no active status** → opens `QuickStatusSheet`

### 2. QuickStatusSheet → Publish
- Validates: title, location, date+time (if scheduled)
- Resolves `city` via `resolveCheckinCity` (Mac GPS → CITIES DB 15 km → Nominatim)
- Inserts `app_checkins` with all fields
- Optimistic UI: `addOptimistic` so pin appears instantly without waiting for refetch

### 3. Tap own pin on map
- `handlePinTap` detects `isOwn === true`
- → Navigates to `UserProfile` with `openCheckinId` (does NOT show the visitor sheet)

### 4. Profile → Active Event card → tap
- Opens `Activity Info` modal (the owner's management screen)
- On open: fetches pending requests + active members for the event's conversation

### 5. Activity Info modal — every editable field

| Field | Stage to | DB column written | Chat system message |
|---|---|---|---|
| Title (inline editor) | `stagedChanges.activity_text` + `status_text` | `app_checkins.activity_text/status_text` + `app_conversations.name/activity_text` | `✏️ Event renamed to "X"` |
| Location | `stagedChanges.location_name/lat/lng/city` | same | `📍 Location moved to X` |
| Date | `stagedChanges.scheduled_for` | same | `📅 Moved to X` (when day changed) |
| Time | `stagedChanges.scheduled_for + is_flexible_time` | same | `⏰ Time moved to HH:MM` (when only time changed) |
| Private toggle | `stagedChanges.is_open` | same | `🔒 Now private` / `🌐 Now public` |

Mute Notifications toggle currently does NOT persist (known open item — it's local state only).

### 6. Bottom Save bar
- Visible only when `Object.keys(stagedChanges).length > 0`
- "Save N changes" — N is computed from user-visible edits only (title/location/time/privacy), not raw DB column count
- On Save:
  1. `app_checkins` updated with all staged fields (single round trip)
  2. Conversation rename if title changed
  3. One system message per changed field
  4. `refetch()` + `fetchActiveCheckin()` (the latter selects ALL fields the modal reads — `scheduled_for`, `is_open`, `is_flexible_time` — bug we fixed today)
  5. Success `Alert` with summary
- Discard button clears `stagedChanges` without writing

### 7. Pending requests row (private events only)
- Horizontal avatar strip above the action rows
- Tap avatar → that user's full Profile (owner decides informed)
- ✓ green → `approvePendingMember`: status='active', count++, "Welcome 👋" in chat
- ✗ neutral → `denyPendingMember`: status='declined', stays out

### 8. Active members row
- Horizontal: up to 3 avatars + "+N more" chip
- Tap avatar → user's profile
- Owner excluded from the strip (they know they're the admin)

### 9. Delete Activity (red button at bottom)
- Confirmation alert
- Sets `is_active = false` (no hard delete; chat survives)
- TODO: post `❌ Event cancelled` to chat (not yet wired)

## Each button — visitor side

### 1. Tap pin on map
- `handlePinTap` detects `isOwn === false`
- For status: 400 ms zoom into the pin's neighborhood → 450 ms wait → `ActivityDetailSheet` slides up
- For timer: bubble in place, no map motion

### 2. ActivityDetailSheet contents (top → bottom)
- Drag handle, X close button
- Emoji
- Title (centered, max 2 lines, padded sides)
- Active members strip (3 avatars + "+N")
- "N nomads joined" count
- Creator avatar + name
- Meta pills: 📍 location, ⏰ countdown / 📅 date
- Action button:
  - Owner viewing own → "this is your event · manage from Profile" banner
  - Public event → "join" → instant
  - Private event → "request to join" → pending state
  - Already joined → "chat" (opens conversation) + "leave"
  - Already requested → "request sent — waiting for approval" yellow bar
  - Expired → "this event has ended"
- Share to Story (if Instagram installed)

### 3. Join (public)
- `createOrJoinStatusChat(myId, ownerId, statusText, metadata, requiresApproval=false)`
- Inserts `app_conversation_members.status='active'`
- "Joined the activity 🤙" message
- `member_count++`
- Push notification to owner (via DB trigger `notify_on_activity_join`)
- Sheet stays open with "chat" + "leave" buttons

### 4. Request to join (private)
- Same call with `requiresApproval=true`
- Inserts `status='request'`. No join message. No count bump. No chat access.
- Yellow "request sent" bar. The owner sees the request in their Activity Info pending row.

## Forbidden / red lines

- **Never use `tracksViewChanges={true}`** on map markers (causes flicker, locked in CLAUDE.md).
- **Never use `'pending'` or `'denied'`** as `status` values — DB CHECK constraint allows only `{'active','request','declined'}`.
- **Never trust Photon's `p.city`** for the `city` field — use `resolveCityFromCoordinates`.
- **Never write `expires_at = now + duration`** for a future-scheduled event — use the lifetime table above.
- **Never use `.update().eq('user_id', uid)`** when the row's existence isn't guaranteed — `.upsert({user_id, ...}, { onConflict: 'user_id' })`.
- **Never modify a checkin field that's used in chat or the map without ALSO** posting a system message AND firing `refetch()` / `fetchActiveCheckin()`.

## Files in scope

```
screens/
  HomeScreen.tsx              ← green FAB, map render, handlePinTap, handleQuickPublish
  ProfileScreen.tsx           ← Active Event card, Activity Info modal, all owner edits
components/
  QuickStatusSheet.tsx        ← create wizard
  ActivityDetailSheet.tsx     ← visitor view
lib/
  hooks.ts                    ← useActiveCheckins, createOrJoinStatusChat,
                                approvePendingMember, denyPendingMember
  eventSystemMessages.ts      ← postEventSystemMessage + eventSystemMsg.* formatters
  cityResolver.ts             ← resolveCityFromCoordinates (15 km radius + Nominatim)
DB:
  app_checkins                ← the rows
  app_conversations           ← chat per checkin (created lazily on first join)
  app_conversation_members    ← members + status
  app_messages                ← chat history (sender_id=null for system msgs)
  pg_cron expire-old-checkins ← every 5 min UPDATE is_active=false WHERE expires_at<now
```

## What this spec does NOT cover

- Push notifications (deferred — Edge Function pending)
- Kick-from-group with ban (deferred — currently uses `leaveGroupChat`, no rejoin block)
- Auth.users hard-delete (Apple-compliant PII delete is done in `deleteAccount`; auth row left orphaned for now)

## Test scenarios — tick before declaring "status flow works"

- [ ] Owner publishes immediate status → pin appears on map, owner sees chip in profile
- [ ] Visitor in age range taps pin → ActivityDetailSheet shows correct fields
- [ ] Visitor outside age range → never sees the pin
- [ ] Visitor taps Join on public event → instant join, chat opens, member_count++
- [ ] Visitor taps "request to join" on private event → yellow waiting bar appears
- [ ] Owner sees pending request in Activity Info as avatar with ✓/✗
- [ ] Owner taps ✓ → requester becomes active member, count++, "Welcome" in chat
- [ ] Owner edits location to a different city → pin moves to new city's map (current city's map no longer shows it)
- [ ] Owner edits date → expires_at follows the new scheduled_for; pin stays visible until then
- [ ] Owner taps own pin on map → navigates to Profile (NOT Join sheet)
- [ ] Status with `scheduled_for = next Sunday 17:30` is still on map at Sunday 17:00, gone at 17:31 (specific) or midnight (flexible)
- [ ] Owner deletes event → pin disappears from map immediately
