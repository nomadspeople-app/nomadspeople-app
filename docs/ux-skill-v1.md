---
name: ux
description: The UI/UX contract for nomadspeople — the discipline that turns our social product into something nomads actually enjoy using instead of abandoning. Use this skill BEFORE adding, designing, editing, or reviewing ANY screen, sheet, modal, button, pill, input, toggle, or layout in the nomadspeople mobile app. Trigger whenever the work touches visual design, button placement, screen structure, modal vs sheet choice, copy, microinteractions, haptics, empty states, loading, error UX, role-aware affordances (creator vs participant), or anything a user's eye or finger will land on. Also trigger whenever the user says "ugly", "not consistent", "looks different from X", "button is wrong", "feels off", "it's crowded", "move this", "keyboard covers", "put it at the top", "רזה", "אסתטי", "קו אחיד", "מבלבל", or anything that signals a UX complaint — the app is a social product for anxious nomads with patchy 4G, and the margin for a cluttered or inconsistent interface is zero. If in doubt, trigger.
---

# UX — The UI/UX Contract for nomadspeople

## How to Communicate With the Product Owner

**Always respond in Hebrew, right-to-left.**

The product owner is a Hebrew speaker. Every reply in the conversation should be in Hebrew — including status updates, reasoning, alternatives, questions back to them, and task summaries. Technical identifiers that must stay in English (file paths, variable names, SQL keywords, hex colors, DB column names) stay in English inside the Hebrew prose — that's fine, mixed-direction text renders correctly in Hebrew RTL context.

Do not switch to English unless the user explicitly asks for it, or the entire requested artifact is inherently English (e.g., a code file, a commit message body, a SQL migration, an English README). Commit messages and code comments stay in English for future contributors; conversational replies to the product owner stay in Hebrew.

Keep the tone calm, direct, and specific — the product owner has pushed back on verbose or hedging language. Short Hebrew answers beat long ones.

---

## The One Principle

> **Every screen represents one concept. Every concept has exactly one screen, regardless of how the user arrived there. The creator sees extra management affordances at the top; everyone else sees the same surface underneath. If a view looks different depending on entry point, we've failed.**

Everything else in this skill is in service of that principle, plus the specific sensibility of our users: digital nomads, often alone in a new city, often on shaky 4G, often anxious. The app must *reduce* that anxiety on every tap. Delight them, don't overwhelm them.

---

## Who We're Designing For (The Nomad's Mental Model)

Before deciding where a button goes, picture the human:

- It's their second day in Lisbon. They don't know anyone. Their hostel wifi drops twice a minute.
- They're in the back of an Uber, one-handed on the phone, battery at 18%.
- Or they're sitting in a café alone pretending to work, really hoping someone tapped their Timer pin.
- They don't read labels. They scan for colors and shapes. If something looks like a button, they tap it. If nothing visibly responds, they decide the app is broken and close it.

Every UI decision must pass the **"coffee-in-hand, 4G-spotty, a-little-lonely"** test. Elegant is out. Calm, confident, instantly legible is in.

---

## The Unified-Surface Rule (the one we keep breaking)

**One concept → one screen → one layout. Ever.**

The same "activity info" view must render identically whether the user got there from the Messages tab, from their own profile card, from a push notification deep-link, or from a map pin tap. Role controls (edit, end, kick) are additional affordances rendered *inside the same screen* — they never trigger a parallel screen.

Concrete nomadspeople examples of this rule:

| Concept | Canonical screen | Who sees what |
|---|---|---|
| Activity / Group info | `screens/GroupInfoScreen.tsx` | Everyone sees emoji + name + member count + map + members + mute + share. Creator *also* sees the management pill row at the top. |
| Members list | `components/MembersModal.tsx` | Everyone sees the full list and can tap → profile. Creator *also* sees a small × next to each non-self, non-admin member. |
| Activity detail (before join) | `components/ActivityDetailSheet.tsx` | Everyone sees the same sheet. Creator sees "this is your event" banner + edit affordance; visitors see "Join". |

If you catch yourself building a second screen because "the creator needs something different" — stop. Add the affordance to the one screen, gated by `iAmCreator`.

---

## The Three Placement Rules (in order of importance)

### 1. Management controls live at the TOP of the screen.

Editing, renaming, canceling, ending, removing — all of it. Never at the bottom. Reason: when any of these controls opens a keyboard (text input for rename, date/time picker, location search), the keyboard rises from below and covers everything it can reach. An input at the top is always visible. An input near the bottom disappears under the keyboard and the user stops trusting the app.

Design pattern we've converged on (see `GroupInfoScreen`): a compact horizontal pill row directly under the screen's hero (emoji circle + name + count). Each pill is `[icon] [lowercase label]` inside a rounded rectangle with a subtle background. Danger actions use a pink-surface pill with red icon + text.

### 2. Destructive actions require both confirmation AND undo.

- Confirmation (`Alert.alert`) is the first gate — "Remove member?", "End event?". Never skip it.
- Undo is the second net — a floating toast at the bottom with an `UNDO` link, typically 4 seconds. For actions with a server write that can't be cancelled (e.g., hide conversation), show the undo toast *after* the write and implement the undo as a reverse write.
- The row/object disappears from the UI optimistically the moment the action is confirmed; the DB write is either deferred for 4s (pure delete) or immediate (hide/unhide).

Reference implementation: the `pending` system in `screens/PulseScreen.tsx`.

### 3. Input fields never live where the keyboard can cover them.

Wrap any screen that contains a text input or picker in `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`, and set `keyboardShouldPersistTaps="handled"` on surrounding ScrollViews so tapping Save while the keyboard is open works cleanly. Place the input in the upper half of the scrollable area, never the lower half.

---

## The Role-Aware UI Rule

There is no "creator screen" and "member screen". There is ONE screen. The difference shows up as:

- **Extra affordances, not a different layout.** Creator pills appear at the top of `GroupInfoScreen`. × buttons appear next to each member in `MembersModal`. "This is your event" banner appears inside `ActivityDetailSheet`. Nothing else changes.
- **Gated with `iAmCreator` / `isOwn`** — always use these flags, never duplicate a component.
- **Non-destructive by default.** A member can *always* leave their own chat; only the creator can end the event for everyone. A member can hide a chat locally; only the creator can remove someone else.

---

## Visual Language (concrete specs)

### Color

Brand primary is `#E8614D` (locked in `CLAUDE.md` as the master icon color). Everything else orbits around it in warm tones:

- **Group avatar palette (peach):** `['#FFCDB2', '#FFB4A2', '#FFAB91', '#FCC8B3', '#FFA07A', '#E5989B']` — cycle by index. Warm, pastel, friendly.
- **DM fallback color:** `#F4A582` — used when a DM partner has no avatar uploaded. Distinct from group tones so the two types read differently at a glance.
- **Text on peach:** `#3B1F1A` (dark chocolate). White text washes out on pastels; this reads cleanly on every tone above.
- **Dead / locked / expired:** `#D1D5DB` (neutral grey).
- **Danger surface:** `#FEF2F2` background with `colors.danger` text/icon (pink-50 with red-600, conceptually).
- **Section dividers:** `StyleSheet.hairlineWidth`, `colors.borderSoft`. Hairlines; never heavy borders.

### Typography

- **Labels are lowercase.** `edit name`, not `Edit Name`. `cancel`, not `Cancel`. Friendliness and quickness — we're not a corporate tool.
- **The activity's own name is capitalized as the user typed it.** We don't mess with user-authored content.
- **Weight scale:** `FW.regular` for body, `FW.medium` for secondary, `FW.semi` for labels, `FW.bold` for emphasis, `FW.extra` for hero headers.
- **Size scale (via `s()`):** titles `s(11)`, section headers `s(7)–s(8)`, body `s(5.5)–s(6.5)`, hints `s(4.5)`. Never two sizes that are 0.5 apart next to each other — it reads as a mistake.

### Spacing

- **Screen-edge padding:** `s(8)`. Everything breathes.
- **Between sections:** `s(6)`.
- **Inside rows:** `s(4)–s(5)` padding, `s(5)–s(6)` gap between icon and label.
- **Pill padding:** `s(5)` horizontal × `s(3)` vertical. Radius `s(10)`.

### Iconography

Use `components/NomadIcon.tsx` — our custom SVG set. Never mix icon libraries. Per-element sizes tend to:

- Swipe action icons: `s(6)` (down from `s(7)` — too heavy).
- Muted bell indicator on a row: `s(4)` at 40% opacity.
- Pill icons: `s(4.5)` with `strokeWidth={1.5}`.
- Hero section icons: `s(6)–s(7)`.
- Avatar placeholder characters: `s(6.5)–s(8)` depending on content (emoji/initials).

Never scale an icon past `s(9)` except inside a hero emoji circle. Big icons bully the rest of the page.

### Corners

- Pills / chips: `s(10)`.
- Cards: `s(6)–s(8)`.
- Avatars: circular (radius = size/2) for everyone. Group avatars become slightly squarish via `st.avatarGroup` (`borderRadius: s(8)`) only when we have a reason.
- Sheets: system default (pageSheet).

---

## Surface Vocabulary

We have four kinds of surface; use the right one for the job. Mixing them feels chaotic.

### Full screen (navigation push)
For sustained interaction: a chat, a profile, the map, a multi-step editor. Has back button, header, ScrollView. `GroupInfoScreen`, `ChatScreen`.

### PageSheet modal (slide up, full height)
For scoped lists or confirmations that deserve their own air: a member list, a report flow, a photo viewer. `MembersModal`. Dismissible with a drag-down or explicit close button. Use when the interaction is meaningful but not a whole screen.

### Bottom sheet / fixed bubble in place
For quick peek and immediate action: Timer bubble on the map (tap → see owner + countdown + cancel/join in place, no camera move). Nothing stops the main surface underneath from rendering.

### Floating toast
For transient feedback: saved, deleted, joined, hidden, undo window. Always at the bottom, above the tab bar and above the safe-area inset. Auto-dismisses.

**Do not mix.** A destructive action with undo is not a modal — it's a toast. A member list is not a full screen — it's a pageSheet. A tap on a timer pin is not a sheet — it's a bubble. Choosing the wrong surface is how the app starts to feel "off".

---

## Microinteractions

Small, quick, physical. Every tap produces a response inside 100 ms, visual or haptic or both.

### Haptics (`expo-haptics`)

- **Toggle / selection:** `Haptics.selectionAsync()` — the lightest tap.
- **Join, publish, send:** `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.
- **Leave, cancel, remove:** `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)`.
- **Success toast arrival:** `.Success` sparingly — don't buzz the phone for every save.

### Animations

- Map camera zoom on pin tap: `400ms` ease (see `CLAUDE.md` — map-pin-flow spec).
- Sheet open/close: system default.
- Swipe action spring: `Animated.spring` with `bounciness: 4`, driven by the current translateX + velocity, not by cumulative `gs.dx` (that one kept breaking — see `PulseScreen.tsx`).
- Toast slide: `200ms`.

### Loading

- **Optimistic first.** If we know the likely result, paint it immediately. Delete? Row disappears, DB catches up. Join? Member count increments, DB confirms.
- **Skeleton second.** For list/data that we don't yet have, prefer a calm skeleton over a spinner.
- **Spinner only for >1s blocking calls.** `ActivityIndicator` is the last resort.

---

## Copy Rules

Labels are social, not corporate. Write the way a friend would text:

| Don't say | Say |
|---|---|
| Submit | `send` / `publish` / `join` (the actual verb) |
| OK / Confirm | `done` / `got it` / the actual action word |
| Error occurred | (specifics) — `could not send — check your connection` |
| Are you sure you want to delete this item? | `delete this chat? this can't be undone.` |
| Please try again | (offer a tap-to-retry button instead) |
| This field is required | `add a name first` |

Principles:

- **Action-verb-first buttons.** `leave group`, not `group leave` or `leave the group`.
- **Lowercase for UI chrome.** The one exception is user-authored content (their activity name, their bio).
- **Say what happened, what to try, offer one tap to recover.** That's an error message.
- **Never "something went wrong".** If we don't know what went wrong, we write a fix or we stay silent.
- **Empty states are copy opportunities.** Not "no data". Something like `no timers nearby — drop yours and see who shows up`.

---

## Information Hierarchy

For any screen, in order of visual weight from top to bottom:

1. **Header** — back button, screen title, minimal. Stays still when scrolling.
2. **Hero** — the one object the screen is about, its name, and its state (e.g., countdown).
3. **Role affordances** — creator pills, if applicable. Under the hero.
4. **Primary actions** — share, mute, join. Compact row of tappable rows with icons.
5. **Context** — the map, the date, the location. Read-only when the user can't edit here.
6. **Relationships** — members, related chats. Tap → goes deeper.
7. **Destructive exit** — leave chat, delete account, etc. The last row. Intentionally hard to hit by accident.

---

## The Six Anti-Patterns We've Burned Our Fingers On

### 1. The Parallel Screen
Two different UIs for the same concept, diverging because "the creator needed more". The fix is always: one screen, add affordances to it. See: the Activity Info modal we retired in favor of `GroupInfoScreen`.

### 2. The Keyboard-Covered Input
Text input placed in the lower half of the screen; keyboard opens; user can't see what they're typing. Fix: `KeyboardAvoidingView` + input in upper half + `keyboardShouldPersistTaps="handled"`.

### 3. The Dead Header
Chat header shows a group name but isn't tappable (missing `isGroup: true` on navigation). User looks for "group info" and doesn't find it. Fix: every navigation to a group chat explicitly passes `isGroup: true`.

### 4. The Silent Save
Button saves, nothing visible happens, no optimistic update, no toast, no system message. User thinks the save failed. Fix: always either optimistically update *or* dismiss *or* toast, pick one per interaction. See `logic` skill for the full propagation rule.

### 5. The Ghost Button
A button that looks active but doesn't complete its ripple (e.g., rename that updates the DB but doesn't sync the chat title or post a system message). Fix: consult the `logic` skill's propagation map before shipping.

### 6. The Clutter Pile
Every little action gets its own icon, emoji, color, and weight. Result: the row's eye has nowhere to rest. Fix: shrink support icons (mute bell to `s(4)`, unread pill minWidth `s(7.5)` instead of `s(10)`), reserve color for primary actions, let whitespace do most of the work.

---

## Social-Product Specifics

Things that matter for a social product that don't matter in a productivity tool:

- **Avatars everywhere humans appear.** Never a name without a face, even if the face is initials on pastel. Names alone are cold.
- **Member count is always visible** on any group surface. You are not alone.
- **Countdown beats a calendar date.** `ends in 23m` conveys urgency + presence; `17:30` is just a number. Use countdowns on all time-sensitive surfaces (Timer cards, active event cards, chat headers if expiring).
- **One-tap join.** Never require a form to join an activity. If we ever do require approval (private events), the request is a single tap and the wait state is clearly shown.
- **Realtime wins over refetch.** For any shared surface (map pins, active chats, member lists), subscribe to Supabase realtime. Refetch on focus is a fallback, not the primary mechanism.
- **Chat is where things go when they're done.** Every action that changes a shared object (rename, move location, cancel, end) posts a visible system message into the chat. It's where the group narrative lives.

---

## Pre-Ship Checklist

Before calling any UI change done, run these seven questions in order:

1. **Unified?** Does this screen look identical from every entry point? (Messages / profile / deep-link / map / notification.)
2. **Role-aware, one layout?** Is the creator's extra UI an *addition* to the same layout, or did I accidentally fork a new screen?
3. **Keyboard-safe?** If an input is present, is it in the upper half of the scrollable area, and is `KeyboardAvoidingView` in place?
4. **Destructive → confirm + undo?** Any delete/end/remove has an `Alert` before and a 4-second undo toast after.
5. **Copy passes the friend-text test?** Lowercase, verb-first, no "please try again".
6. **Closes its loop?** DB write + chat system message (if shared) + UI refresh + push (if external humans affected) + error surfaced (if relevant). Full logic-skill propagation.
7. **Looks calm?** If I squint at the screen, is my eye pulled to one main action or does it bounce between five competing elements?

If any answer is no, fix it before committing.

---

## Reference Pointers

- `CLAUDE.md` — locked architectural invariants (map pin flow, avatar cache, visibility reciprocal rule, i18n). Read first.
- `docs/2026-04-19-daily-lock.md` — latest session summary + locked design decisions. Read this to know the live state.
- `logic` skill — closed-loop contract for every interactive element.
- `thorough` skill — investigation discipline before writing code.
- `nomadspeople` skill — product north star.
- Canonical working implementations:
  - **`components/Bubble.tsx`** — the bottom-docked sheet shell for pin-peek popups. Use for any new peek surface.
  - **`components/TimerBubble.tsx`** — content layout inside a Bubble (avatar-on-top, inline bold name + activity title, countdown, Facepile, fixed-height CTA).
  - `components/MembersModal.tsx` — pageSheet full members list with role-gated remove.
  - `screens/GroupInfoScreen.tsx` — unified info screen, creator pills at top.
  - `screens/PulseScreen.tsx` — Messages tab with peach palette, sticky swipe, hide-not-leave, undo toast.

---

## Locked Patterns (2026-04-19) — do not drift without a user ask

### Bubble shell — bottom-docked, no tail
  - 16px horizontal margin, `bottom: insets.bottom + s(3)`
  - 20px radius, shadow blur 20 opacity 0.15, padding 40/32/28/32
  - Avatar on top: 60×60, 4px white border, `marginBottom: -25`
  - Entry: spring `translateY` (friction 11, tension 68) + opacity fade
  - Exit: timing down + opacity; stays mounted through anim
  - Transparent full-screen Pressable backdrop for tap-to-dismiss
  - **Tail-anchored popup is retired.** Do not reintroduce.

### Map motion on pin tap — gentle
  - `animateToRegion` 320ms, `latitude - 0.0010` at `latDelta 0.014`
  - Do not use larger shifts; user rejected aggressive pan.

### Facepile — strict spec
  - 32×32 circles, uniform for every participant
  - 2px solid white border on each
  - `marginLeft: -14` from the 2nd avatar onwards (heavy overlap)
  - MAX 3 shown; overflow → 4th gray `#E5E7EB` circle with `+N`
  - NO usernames, NO highlight on "me", NO size variations
  - `N going` text next to stack (fontSize 14, color `#6B7280`)

### CTA inside a Bubble — fixed height across states
  - Visitor-not-joined: full-width JOIN `#E8614D`
  - Visitor-joined: Chat `#60A5FA` (flex 2.2) + Leave `#EF4444` (flex 1) on one row
  - Owner: full-width MANAGE `#E8614D`
  - All: padding 14, radius 14, white lowercase bold label fontSize 17

### Counts are optimistic
  - Display = `max(localParticipants, member_count + delta)`
  - +1 on Join tap, -1 on Leave tap, rolled back on server failure
  - Floor: 1 (the creator)

### Copy
  - lowercase verbs: `join` `chat` `leave` `manage` `edit name` etc.
  - counts read `N going`, not `N participants`

---

## One Last Thought

Digital nomads left "normal" life for a reason. They want freedom, not another corporate app. Every bit of friction we remove, every button we simplify, every surface we unify is us honoring that choice. Build like you're designing for a friend you want to see again.
