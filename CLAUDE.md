# nomadspeople App — Development Rules

## Rule Minus-One — No Native Changes During Google Review (Locked 2026-04-26)

> **While the app is in any active Google Play review window, NATIVE
> code changes are FORBIDDEN. Only JS / DB / backend / Cloud Console
> changes are allowed.**

### Why this rule exists

Every native change forces a new AAB upload, which restarts the
Google review clock (1-3 days for Closed Testing, 7+ for Production).
On 2026-04-26 we burned a full day rebuilding through 6 AAB versions
(v8 → v14) chasing native config issues. The owner explicitly locked
this in: until Google gives a final verdict, the app native surface
is FROZEN.

### What counts as "native" — FORBIDDEN during review

- Anything in `app.json` plugins, permissions, android.config,
  ios.infoPlist, ios.config
- Adding/removing/upgrading any package that has a native module
  (anything in `node_modules` with `android/` or `ios/` folders)
- AndroidManifest.xml or Info.plist direct edits
- Anything that requires re-running `expo prebuild`
- Adding new SDKs (Firebase, OneSignal, RevenueCat, etc.)
- Changing app icon / splash screen image references
- versionCode bumps without a real reason

### What's ALLOWED during review — these can ship via EAS Update or DB

- `screens/*.tsx`, `components/*.tsx`, `lib/*.ts(x)` — JS/TS only
- `lib/translations/*.ts` — copy changes
- Supabase SQL: schema, RLS, policies, edge functions
- Storage bucket changes
- Google Cloud Console (OAuth clients, API keys, restrictions)
- Sentry / Vercel / external service configs
- Adding/removing Closed Testing testers in Play Console
- Web (`/web`) — Vite SPA changes deploy via Vercel, no Play involved

### When the owner asks for a native change during review

Treat it as a **WARNING LIGHT 🚨** and refuse the rebuild. Steps:
1. Surface the request and name it native explicitly
2. Explain the cost (new review cycle, 1-3 days minimum)
3. Offer a JS-only / DB-only alternative if one exists
4. Only proceed with native + new AAB if the owner explicitly
   acknowledges the cost and confirms in writing

### When this rule lifts

Only after Google gives the **final verdict** on the current submission:
- ✅ Approved → free to plan next native change cycle
- ❌ Rejected with concrete fix → that fix is the only allowed native change

Until then: JS, DB, Cloud only.

---

## Rule Two — Creator vs Participant (Locked 2026-04-26)

> **יוצר ≠ משתמש. They are different people with different controls.
> Never the same set of buttons. Never gated inline.**

### The principle

A nomadspeople conversation has at most one **creator** — the person who
started the underlying event (status / timer) or, for ad-hoc groups,
who first opened the chat. Everyone else is a **participant**. These
are not interchangeable. They never see the same UI.

- Creator can: end event, edit title / time / location / privacy,
  remove members, rename the chat. **Cannot** "leave" — that orphans
  the bubble on the map and leaves participants without an admin.
- Participant can: leave, mute, view info. **Cannot** end, edit, or
  remove anyone.
- 1-on-1 chats: no creator role. Both sides are peers; "leave" is
  replaced by "block".

### How to enforce it

The single source of truth is **`lib/roles.ts`**. Every UI surface
that decides "show this button to X but not Y" MUST import from there:

```typescript
import { canEndEvent, canLeaveGroup, canRemoveMember } from '../lib/roles';

const roleCtx = { userId, conversation, checkin };
{canEndEvent(roleCtx)   && <EndEventButton/>}
{canLeaveGroup(roleCtx) && <LeaveButton/>}
```

### Forbidden patterns

- ❌ `userId === conversation.created_by` inline. After the April 2026
  RLS hardening, `app_conversations.created_by` is "the first user to
  insert the row" — often the FIRST JOINER of an event, not its owner.
  Tester report 2026-04-26 ("חבר ראה End Event") was caused by this.
- ❌ Local `iAmCreator = ...` derivations in screen code.
- ❌ Passing `conversation.created_by` to `<MembersModal creatorUserId>`
  for event-linked chats. Pass the EVENT owner (`app_checkins.user_id`).
- ❌ Hardcoding "creator only" or "members only" without a `lib/roles`
  helper to gate it.

### When you add a new role-aware affordance

1. Add a `canFooBar` helper to `lib/roles.ts` — never reuse an
   unrelated one to save typing.
2. Import it at the call site, gate via `{canFooBar(ctx) && <Btn/>}`.
3. If it depends on event ownership, make sure the calling screen
   loads the linked `app_checkins.user_id` and threads it through
   the `roleCtx`.
4. Document the helper in `lib/roles.ts` with one sentence on
   "what creator can vs what participant sees".

### Why this rule exists

We shipped the inverse failure mode twice in a single day:
- 2026-04-26 morning: a creator could "leave" their own group →
  bubble stayed alive on map without an owner.
- 2026-04-26 afternoon: a participant who joined someone else's
  status saw "End Event" → could destroy a group they don't own.

Both were the same root cause: `created_by` interpreted as "creator"
without checking whether it was an event chat. Roles must live in
one file or this drift recurs every sprint.

---

## Rule Zero — No Band-Aids (Locked April 2026)

> **There are no patches. There are no small fixes. Every change is a full
> engineering build, or it does not ship.**

This is the single most important rule in the repo and it overrides
everything below it. Read it before every task, every commit, every PR.

### What a band-aid is

A band-aid is any change that makes the reported symptom disappear for
one user, on one screen, in one scenario — while leaving the underlying
structure that produced the bug in place. Band-aids always break again,
usually within days, usually louder, and always in front of a new user.

Concrete examples from this codebase that are **forbidden**:

- Adding `setPinLat(finalLat)` inside `TimerSheet` to match what
  `QuickStatusSheet` already does. That is two copies of the same idea
  diverging. Correct move: one `useLiveLocation()` hook, one
  `<LocationPickerMap/>`, both sheets consume them.
- Guarding `setVisibleNomadIds` with an equality check to silence re-
  render thrash. That is a symptom-level fix. Correct move: one
  `MapView`, one render pipeline, markers memoized per checkin id with
  a stable coordinate reference.
- Duplicating geocoding / GPS / reverse-geocode logic across
  `QuickStatusSheet`, `TimerSheet`, `StatusCreationFlow`,
  `HomeScreen`, `cityResolver`. Correct move: one module, one set of
  tests, every caller uses it.
- Fixing a hardcoded string in one language file. Correct move: add
  the `t()` key to all supported locales, every time.
- "Let me just set the default to true for now." No. Default is part of
  the schema. Do it properly in the migration.

### The rule

1. **Treat the cause, never the symptom.** If two screens diverge, you
   do not patch one to match the other — you extract the shared core
   and point both at it.
2. **If you find yourself writing the same block twice, stop.** Extract
   it on the spot. There is never a "later" to clean up duplication.
3. **Every fix is end-to-end.** DB state + RLS + hook + screen + cache
   + error path + translation + commit message — all in the same
   change. If any of those is missing, the fix is incomplete and must
   not be committed.
4. **A fix that works for one user or one flow is not a fix.** It is a
   band-aid. Design for N users, N statuses, N timers — the system
   must be stable at production scale from the first commit, not after
   a future "performance pass".
5. **Never ship speed over correctness.** The owner is building a
   social product nomads abandon within one session if it feels
   unstable. Every band-aid we ship ruins that trust.

### Concrete test before every commit

Before `git commit`, answer out loud:

- If 100 nomads opened a status and 100 opened a timer right now, would
  the code I just wrote still behave correctly? If not, it's a band-aid.
- Does my change leave a second place in the codebase that still holds
  the old broken pattern? If yes, it's a band-aid.
- If a new engineer read only my diff, would they know the full scope
  of the problem I fixed? If no, I stopped too early.

If any answer is no / yes / no — do not commit. Go back and do the full
build.

### Why this rule exists

Every band-aid we have shipped has broken within hours:

- DEV_MODE auto-signin "for development only" → users were auto-logged
  as the wrong account in production.
- pg_cron `cleanup_checkins` running every minute → took the DB down
  overnight, killed 100 live users.
- Duplicate map sheets with copy-pasted GPS fetchers → live location
  worked in Status but not in Timer, silently, for weeks.

Each one was a "quick fix" at the time. Each one cost a day of
firefighting and user trust that is not fully recoverable.

There are no patches. There are no small fixes. Build it right, or
don't ship.

## Repo Boundary (Locked April 2026)

This repo is **only** the nomadspeople mobile app and its marketing landing page. Nothing else.

**What lives here:**
- `/` — Expo / React Native mobile app (SDK 54)
- `/web/` — Vite + React landing page deployed to nomadspeople.com (routes: `/`, `/privacy`, `/terms`, `/delete-account`, `/admin`)
- `/assets/` — brand assets. `assets/icon.png` is the **single source of truth** for the app icon and gets resized into every web favicon derivative under `/web/public/`.

**What does NOT live here — do not add it:**
- No neighborhoods / city intelligence / "שכונות" code, data fetching, pages, or components.
- The שכונות project is a separate world with its own future repo. It will NOT be folded into this one.
- Tables like `city_*`, `neighborhoods`, `neighborhood_safety_reports` exist in the same Supabase project for historical reasons, but the app MUST NOT read from them. The app only reads tables prefixed with `app_`.

**Icon rule — single source of truth:**
- Master: `assets/icon.png` (1024×1024, brand orange #E8614D)
- Derivatives in `web/public/`: `favicon.png` (180), `favicon.ico` (16+32), `apple-touch-icon.png` (180), `og-image.png` (1200×630)
- Never hand-edit the derivatives. Regenerate them from `assets/icon.png` when the master changes.
- The landing page `<title>` and all meta/og tags live in `web/index.html`. Lovable is no longer involved — edit the source directly.

## Locked UX Flows

### Map Pin Tap Flow (Locked April 2026)
When a user taps ANY pin on the map:
1. **Zoom in smoothly** (400ms) to the pin's neighborhood (latitudeDelta: 0.008)
2. **Wait for animation** (450ms)
3. **Then open the popup** (TimerBubble for timers, ActivityDetailSheet for status)

**Rules — DO NOT CHANGE:**
- ALL pins are ALWAYS visible — density is the feature, never hide pins
- NO clustering, NO numbered bubble groups — we tried it, rejected it
- Nomads count bubble updates based on visible map region, not city total
- Full reference: `docs/map-pin-flow.md`

### Avatar Cache System (April 2026)
- AvatarContext with cache-busting (?v=N) across all components
- bustAvatar() called after profile image upload
- Full reference: `docs/avatar-cache-system.md`
- Future option: migrate to expo-image for cleaner approach

### i18n — Mandatory Translation Rule (Locked April 2026)
Every user-facing string in the app MUST use the `t()` function. No hardcoded text in any screen, component, sheet, modal, or Alert.

**Rules — DO NOT CHANGE:**
- ZERO hardcoded user-facing strings — every label, title, sublabel, placeholder, alert message, button text, and error message must use `t('key')`
- Every new `t()` key MUST be added to ALL 3 translation files: `en.ts`, `he.ts`, `ru.ts`. (An earlier version of this file listed 8 locales — es/pt/it/fr/de were removed during the MVP scope cut. `lib/i18n.ts → SUPPORTED_LOCALES` is the canonical list.)
- Translation files location: `lib/translations/`
- Supported locales defined in `lib/i18n.ts`: en, he, ru
- When adding a new screen or feature: add ALL strings as `t()` keys from the start — never "add translations later"
- Alert.alert() titles, messages, and button labels — ALL must use `t()`
- Section headers, sublabels, empty states, error messages — ALL must use `t()`

### Visibility — Reciprocal Rule (Locked April 2026)
If a user turns off "Show me on the map" (`show_on_map: false`):
- They become **invisible** to all other users
- They **cannot see** other users on the map or people list
- They **cannot join** new groups or activities
- They **keep access** to existing conversations and groups
- Confirmation alert is REQUIRED before going invisible (with clear explanation)
- `show_on_map` is the SINGLE source of truth for both visibility AND the notification quiet-mode. The old `snooze_mode` column is deprecated and no longer read or written anywhere in the client (Stage 9 of the no-band-aids refactor, April 2026). Do NOT re-introduce reads/writes to `snooze_mode`.
- Premium exception (future): paid users may get "stealth mode" to watch without being seen

## Architecture Notes
- Expo SDK 54, React Native, TypeScript
- Supabase backend (project: apzpxnkmuhcwmvmgisms)
- react-native-maps 1.14 (NO clustering library in use)
- tracksViewChanges starts TRUE, flips to FALSE after content paints
  (was hardcoded false — caused invisible markers per 2026-04-26
  tester report. Marker hit-targets existed but the bitmap snapshot
  was empty because it captured pre-image-load layout. Pattern owned
  by NomadMarker component in screens/HomeScreen.tsx.)

### One Map — Locked April 2026

The app has EXACTLY ONE active MapView at any time. That is
`HomeScreen`'s map. Status creation, Timer creation, and any
future "drop a pin" flow all use `HomeScreen`'s `pickMode` —
never a new MapView inside a sheet or modal.

Rules:
- `QuickStatusSheet`, `TimerSheet`: when opened they receive
  `initialPick: { latitude, longitude, address }` from HomeScreen's
  pickMode. They MUST NOT render their own MapView. Any remaining
  MapView code in those files is legacy and scheduled for deletion
  — do not "temporarily re-enable" it.
- `ProfileScreen` and `GroupInfoScreen` still render tiny static
  map thumbnails with a single marker. These are read-only
  previews, not pickers — they're allowed but should share a
  `<MapThumbnail/>` component if we ever need a third thumbnail.
- All GPS / geocoding / IP-fallback / spoof detection lives in
  `lib/locationServices.ts`. No caller reaches into
  `expo-location` or the Photon / Nominatim APIs directly.
- If a new feature needs location picking, extend pickMode —
  do NOT add a new MapView instance anywhere.

### Map Pin Flow Perf Rule — Locked April 2026

`onRegionChangeComplete` on HomeScreen MUST guard its setState
calls against no-op updates. A fresh `new Set(...)` on every pan
invalidates the Marker render list and makes the native markers
"dance" side-to-side on every micro-adjustment. Use the pattern:

```
setVisibleNomadIds(prev => {
  if (prev.size === next.length && next.every(id => prev.has(id))) {
    return prev;
  }
  return new Set(next);
});
```
