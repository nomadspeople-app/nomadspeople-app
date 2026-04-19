# 2026-04-19 — Daily Lock (what we shipped, what's locked, what's next)

Single source of truth for the April 19 session. Anyone (human or
agent) picking up this codebase on April 20 or later should read
this first.

---

## What we shipped today

### Fixes from the prioritised list (1 → 6 → 5 → 4 → 2 → 3)

- **Task #1 — Timer lock** (`screens/ProfileScreen.tsx`)
  Timer owners can only edit `status_text`. Location shown read-only,
  Time replaced by a live "Ends in Xh Ym" countdown. Mute hidden,
  Private hidden (timers are always public), Date hidden (timers
  have no `scheduled_for`). Map stays visible for both owner and
  visitor. Spec at `docs/timer-button-spec.md`.

- **Task #6 — Swipe-to-delete UX** (`screens/PulseScreen.tsx`)
  1. Sticky swipe — release decision uses the live `translateX._value`
     + velocity, not cumulative `gs.dx`. No more snap-back after
     drag-past-threshold-then-drift-back.
  2. Hide-not-leave for active groups — new
     `app_conversation_members.hidden_at timestamptz`. Swiping an
     active group where you're a (non-creator) member hides it
     from your Messages list without removing membership. A new
     message auto-unhides (client-side filter + fire-and-forget
     `hidden_at = null` on detection).
  3. Undo toast — 4s floating toast at the bottom with
     UNDO. Hide is immediate DB write + undo calls
     `unhideConversation`; delete/leave/lock defer the DB write
     4s and undo cancels the timer.

- **Task #5 — Event-ended auto-message** (DB cron)
  `cleanup_checkins()` now does the `is_active=false` flip AND
  posts a system message into the linked chat in one atomic CTE.
  Copy:
    - `checkin_type='timer'` → `⏰ Timer ended`
    - anything else (`status` / null) → `🏁 Event ended`
  Manual cancels from the client already post `❌ Cancelled` so
  they're excluded by the `is_active=true` filter. `SECURITY DEFINER`
  so the cron bypasses the `messages_insert` RLS. Doc at
  `docs/migration-2026-04-19-end-event-messages.md`.

- **Task #4 — Messages tab visual refresh** (`screens/PulseScreen.tsx`)
  Peach pastel palette for group avatars
  `['#FFCDB2','#FFB4A2','#FFAB91','#FCC8B3','#FFA07A','#E5989B']`,
  DM fallback `#F4A582`, dark brown text on peach `#3B1F1A`.
  Smaller mute icon `s(4)`, tighter badge (minWidth s(7.5), font
  s(4.2)). Swipe action icons `s(7) → s(6)`; bulk-delete stays
  `s(7)` (prominent).

- **Task "#6 of the day" — Creator tools moved to the top of GroupInfo**
  Edit Name + End Event are now compact pills under the group name
  (not at the bottom). `KeyboardAvoidingView` wraps the screen + the
  edit input is at the top so the keyboard can't cover it.
  `handleEditName` now posts `✏️ Event renamed to X` system message
  and syncs `app_checkins.activity_text` + `status_text` — closing
  a silent-save loophole from before.

### Bugs discovered and fixed in passing

- `savingTitle` dead reference in ProfileScreen (ReferenceError at
  render time). Removed.
- `TimerBubble.handleChat` didn't pass `isGroup: true` when
  navigating to Chat — chat header was dead on timer chats.
- GroupInfoScreen's coordinate fallback used
  `user_id=created_by AND is_active=true` which breaks when an
  owner has both a timer AND a status open. Switched to
  `app_conversations.checkin_id` (exact link) with a
  `created_by + is_active` fallback for legacy chats (ORDER BY
  created_at DESC LIMIT 1 for determinism).
- Chat/Leave buttons in the new TimerBubble did nothing because
  `createOrJoinStatusChat` created conversations WITHOUT
  `checkin_id` and `useJoinedMembers` queried by `checkin_id` → no
  match → `conversationId` stayed null → guards fired. Fix:
  (a) `TimerBubble.handleJoin` now passes metadata including
  `checkinId` so new conversations are properly linked; (b) we
  `setConversationId(cid)` immediately from the helper's return
  so the buttons work in the same session; (c)
  `useJoinedMembers` has a `type+name+created_by` fallback for
  older conversations with no `checkin_id`.

### New canonical components built today

- **`components/Bubble.tsx`** — the bottom-docked sheet shell.
  Absolute-positioned, edge-to-edge (16px margin), 12px above the
  safe area. Avatar overlaps from top, white rounded card, no
  tail. Spring slide-up entry, timing slide-down exit. Stays
  mounted through exit animation so dismissal doesn't glitch.
  (Earlier in the day we built it as a Waze-tail anchored popup;
  that version is gone — the user found the required map motion
  dizzying. Do not re-introduce the tail.)

- **`components/TimerBubble.tsx`** — content that fills Bubble.
  Final content layout (post-iteration):
    - 60px avatar at top, 4px white border, overlaps -25px
    - Title: one block, `Barak` in weight 900 inline followed by
      the activity text in weight 500 at fontSize 22/lineHeight 30
    - Subtitle: just the countdown (`ends in 1h58m`)
    - Facepile (locked spec below) + `X going` count text
    - CTA row: Join (coral) OR Chat (blue) + Leave (red) OR
      Manage (coral)

- **`components/MembersModal.tsx`** — pageSheet modal for the
  full participants list. Tap a row → UserProfile. Creator sees a
  red × next to every non-self member → `removeGroupMember()`
  which closes the loop (delete row + ❌ system msg by admin +
  member_count--).

- **`lib/hooks.ts` additions** — `hideConversation`,
  `unhideConversation`, `removeGroupMember`.

### UX skill created

- **`docs/ux-skill-v1.md`** + `ux.skill` package. Canonical UX
  contract for NomadsPeople. Reference this, ux skill in
  `.claude/skills/ux/`, and the logic skill together for every UI
  change.

---

## LOCKED DESIGN LANGUAGE — do not drift

Everything below is what the user signed off on after multiple
iterations. Deviations must be justified in the conversation before
shipping.

### Bubble (pin popup) pattern

- Bottom-docked sheet. **Not** anchored to a pin with a tail. We
  tried tail-anchoring (Waze-style) earlier today; it required
  too much map motion and felt dizzying. Removed permanently.
- Edge-to-edge with `s(8)` (~16px) horizontal margin.
- `bottom: insets.bottom + s(3)` — close to tab bar, doesn't touch.
- Card: white `#FFFFFF`, `borderRadius: 20`, shadow blur 20 opacity
  0.15, padding `40 / 32 / 28 / 32` (top/right/bottom/left).
- Avatar: 60×60, `borderRadius: 30`, 4px white border, subtle
  shadow, `marginBottom: -25` to overlap the card.
- Entry: `Animated.parallel` — spring `translateY` from `SCREEN_H`
  to 0 (friction 11, tension 68), timing opacity to 1 (180ms).
- Exit: timing `translateY` to 40% of screen (200ms), timing opacity
  to 0 (180ms). Stays `mounted` until animation completes.
- Backdrop: full-screen invisible Pressable. Transparent — we
  don't dim the map.
- Dismisses on: backdrop tap, map `onPress`, re-tap same pin.
  Map pan/zoom does **not** dismiss (bubble is bottom-docked so
  map moves don't affect it).

### Map motion on pin tap

- A soft `animateToRegion` that shifts camera by `latitude - 0.0010`
  at `latDelta 0.014` over 320ms. Pin moves up ~7% of map height
  to "organize the area" — user explicitly liked this.
- Do NOT use the older aggressive 0.0035 shift; it was dizzying.
- The bubble anchor is pre-computed synchronously on tap (no wait).
  Map motion and bubble entry run in parallel.

### Facepile (participants row)

Exact locked spec (reached after Instagram-reference iteration):

- Uniform **32×32** circles for every participant.
- 2px solid white border on each.
- Overlap: `marginLeft: -14` on every avatar after the first.
- MAX 3 avatars shown from the participants array (creator first,
  then joiners, then optimistic me).
- Overflow: a 4th circle with gray `#E5E7EB` background, `+N` text
  inside. Also gets `marginLeft: -14` so it sits in the stack.
- **No usernames anywhere in the strip or beside it.**
- **No highlight on "me"** — every dot is identical.
- Next to the stack: `N going` text (fontSize 14, weight 500,
  color `#6B7280`). No names, just a count.

### CTA buttons inside the Bubble

- Constant total height across ALL states (so the bubble doesn't
  resize between "not joined" and "joined").
- Visitor-not-joined: full-width `JOIN` — brand coral `#E8614D`.
- Visitor-joined: two buttons on one row:
    - Chat: blue `#60A5FA`, `flex: 2.2` (~65% width), chat icon.
    - Leave: red `#EF4444`, `flex: 1` (~30% width), label only.
- Owner: full-width `MANAGE` — brand coral.
- All CTA buttons: padding `14`, radius `14`, shadow in their own
  tone, label in lowercase bold white `fontSize: 17`.

### Count with optimistic bumps

- Base = `checkin.member_count` (DB; includes creator; min 1).
- `countDelta` state: +1 on Join, −1 on Leave, rolled back on
  server failure. Reset on `checkin.id` change.
- Display = `max(allParticipants.length, baseCount + countDelta)`.
- Visible from screen one — `1 going` is the floor.

### Group info screen (the "room" everyone enters)

- ONE screen: `screens/GroupInfoScreen.tsx`. Used by everyone
  regardless of entry point (Messages tab header, profile card,
  future push-deep-link).
- Creator affordances live at the TOP as pills under the group
  name (never at the bottom — keyboard safety rule from the
  logic skill). Hidden entirely for non-creators via
  `iAmCreator`.
- `KeyboardAvoidingView` wraps the screen so the edit-name
  input stays above the keyboard.

### Messages tab

- Peach palette for group avatars; DM fallback `#F4A582`;
  dark brown `#3B1F1A` text on peach.
- Swipe action icons `s(6)`; mute indicator `s(4)`; unread
  badge `s(7.5)`.
- Swipe on active group member → Hide (not Leave).
- Every destructive swipe → Undo toast (4s).

### Copy rules

- Lowercase labels everywhere (`join`, `chat`, `leave`, `manage`,
  `edit name`, `end event`, `hide`, `mute`). User-authored
  content (activity title, bio) stays as the user typed it.
- Action-verb-first. No "please", no "something went wrong".
- Counts read like `3 going`, `1 going`, not `3 participants` or
  `3 people`.

### Microinteractions

- Selection haptic on pin tap (`Haptics.selectionAsync`).
- Impact Light haptic on Join, Publish, Send.
- Notification Warning on Leave.
- Spring for any "appearing" element; timing for any "disappearing".

---

## Files that now embody each pattern

Use these as the canonical reference when building new surfaces.

| Pattern | File |
|---|---|
| Bubble shell (bottom-sheet) | `components/Bubble.tsx` |
| Timer peek content | `components/TimerBubble.tsx` |
| Members list "window" | `components/MembersModal.tsx` |
| Activity info room (unified for creator + visitor) | `screens/GroupInfoScreen.tsx` |
| Messages list + swipe + undo toast | `screens/PulseScreen.tsx` |
| Hide / unhide / remove helpers | `lib/hooks.ts` |
| Event-end cron + system messages | `cleanup_checkins()` DB function |
| UX contract | `docs/ux-skill-v1.md` |

---

## Tomorrow's plan (April 20+)

### Priority order agreed with user

1. **Header reorganization** — paused from today; no longer
   blocking (bubble moved to bottom sheet), still worth doing for
   general UX cleanup. Open questions still awaiting user
   decision:
   - Logo size: `s(9)` (current, own row) or `s(7)` (inline with
     city + bell)?
   - Tap-to-search on the city label?
   - Nomads bubble: bottom-right floating vs inside the header?
2. **Pin highlight when Bubble is open** — small `scale` + subtle
   ring on the selected pin. Closes the visual loop between
   bottom-sheet bubble and the pin it came from. Not critical
   (bottom position is predictable) but nice for social presence.
3. **Extend the canonical Bubble pattern to Status pins** — today
   it's timer-only per scope. The `ActivityDetailSheet` used for
   status pin taps should evolve toward the same Bubble shell,
   same facepile, same CTA flavors. Unified visual language.
4. **Task #2 — Apple compliance + moderation audit**. Block
   flow, report flow, moderation queue, docs. Large scope —
   will need to break into sub-tasks.
5. **Task #3 — Settings visual refresh**.

### Design continuity rules for tomorrow's work

- Every new popup/sheet uses **`Bubble.tsx`** as its visual
  shell, or stays in the same language (edge-to-edge, 16px
  margin, 20px radius, soft shadow, avatar-overlaps-top when
  there's a "hero" identity).
- Every new participant row uses the **facepile spec**
  (32×32, 2px white border, -14 overlap, max 3 + N pill).
- Every destructive action uses **Alert confirm + 4s undo toast**.
- Every shared-entity save writes DB + posts chat system
  message + fires UI optimistic update + surfaces error.
- `iAmCreator` gates creator affordances ON THE SAME SCREEN
  everyone sees. Never fork a second screen.
- Read `docs/ux-skill-v1.md` first when in doubt.

### What never to change without an explicit user ask

- The bottom-sheet Bubble pattern (no tail).
- Facepile: 3 avatars + N pill, no usernames, no highlight on me.
- Creator controls at the top of the relevant screen.
- Lowercase labels.
- Peach palette for groups / DM fallback `#F4A582`.

---

## Active seed data (Tel Aviv)

Four test pins live in the DB for UI testing (2 timers, 2
statuses). May have expired / been deleted by the time you read
this. Cleanup query is trivial:

```sql
DELETE FROM app_checkins
WHERE status_text IN (
  'at cafelix, come sit',
  'sunset at gordon, joining?',
  'dinner @ the port tonight',
  'morning run @ yarkon — 10am'
);
```

Creator user IDs: `a3333333-` (Maya), `a4444444-` (Amir),
`a5555555-` (Tal), `99999999-` (Noa).
