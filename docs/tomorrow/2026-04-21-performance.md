# Tomorrow — Performance Audit

Parked 2026-04-20 for a dedicated pass. These are the real cost
centers in the app. Translations are NOT on this list — they're
~30 KB compiled, O(1) lookup, not the problem.

## 1. Map markers (HomeScreen)

- `filteredCheckins.map(...)` rebuilds on every parent re-render
  unless the memo deps are stable. Verify `nomadMarkers` memo is
  holding across: GPS polls, hotCheckins refetches, pickMode
  transitions, region-change commits.
- `tracksViewChanges={false}` is locked in CLAUDE.md — confirm
  every Marker still has it (don't silently flip to true).
- `onRegionChangeComplete` must guard `setVisibleNomadIds` with
  the equality check (pattern in CLAUDE.md). New Set(...) on
  every pan = native markers "dance".
- Density = the feature. No clustering. But each marker's avatar
  image load should be cached — verify `avatarUri()` is
  memoized.

## 2. Profile avatars + map-tile images

- Every Marker renders an `<Image source={{ uri }}/>` for the
  nomad's avatar. On 100 active pins, that's 100 network
  fetches unless RN's image cache catches them.
- Try `expo-image` (listed as "future option" in CLAUDE.md's
  Avatar Cache System section) — it does disk + memory cache
  by default, handles placeholder/blur, and decodes off the JS
  thread.
- Map tiles: react-native-maps uses Apple/Google's own tile
  cache. Generally fine unless the user pans fast over a new
  region — watch network tab on a cold cache.

## 3. Supabase query volume

- `useActiveCheckins` polls every 120 s as a safety net on top
  of Realtime. Confirm Realtime is actually firing and the
  polls are truly redundant (they're billed).
- `useHotCheckins` subscribes to `app_conversations` UPDATE.
  Check how many events that fires per minute at 100 live
  nomads — could be chatty.
- `useProfile` refetches on every focus (`useFocusEffect` in
  HomeScreen). A user who bounces between tabs 10 times
  triggers 10 profile fetches. Cache it with a timestamp guard.

## 4. Re-render cascades

- SettingsScreen was the canary — it used to re-render on every
  age-slider tick. We fixed that by hoisting drag state into
  AgeRangeControl. Audit other "big screen with many controls"
  for the same pattern (HomeScreen's 600+ line render tree is
  a prime suspect).
- Every `useCallback` / `useMemo` in HomeScreen should have a
  stable dep list. A new `{ }` / `[ ]` in a dep array = cache
  miss every render = cascade.

## 5. Things that look expensive but aren't

- i18n (352 keys × 3 locales = ~30 KB, O(1) lookup). Ignore.
- NomadIcon SVG definitions. Static, no render cost.
- The AgeRangeControl / eventTime / AvatarContext helpers.
  Tiny.

## How to measure (before changing anything)

1. Run the app in dev + Flipper / React DevTools profiler.
2. Record a 10-second session of typical use (open map, tap a
   pin, open chat, back to map).
3. Flag any render > 16 ms (drops a frame).
4. Sort by "self time" in the profiler — that's the actual hot
   spot. Don't guess.

## Definition of done (tomorrow's commit)

- Map pans at 60 fps on iPhone 12.
- Tapping a pin → bubble opens in < 100 ms.
- Active-checkin refetch → map updates without visible lag.
- No new pins "dance" during micro-pans (regression test the
  existing fix).
