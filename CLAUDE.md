# NomadsPeople App — Development Rules

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

This repo is **only** the NomadsPeople mobile app and its marketing landing page. Nothing else.

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
- Every new `t()` key MUST be added to ALL 8 translation files: `en.ts`, `he.ts`, `es.ts`, `pt.ts`, `it.ts`, `fr.ts`, `de.ts`, `ru.ts`
- Translation files location: `lib/translations/`
- Supported locales defined in `lib/i18n.ts`: en, he, es, pt, it, fr, de, ru
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
- `show_on_map` is the SINGLE source of truth — `snooze_mode` syncs from it for backward compat
- Premium exception (future): paid users may get "stealth mode" to watch without being seen

## Architecture Notes
- Expo SDK 54, React Native, TypeScript
- Supabase backend (project: apzpxnkmuhcwmvmgisms)
- react-native-maps 1.14 (NO clustering library in use)
- tracksViewChanges={false} on ALL markers (performance critical)

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
