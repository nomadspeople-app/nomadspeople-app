# Session Lock — 2026-04-19

Everything landed in today's session, in order. Every item below is **live on `main`** (both remotes: `flippermaps-hash/nomadspeople-app` and `nomadspeople-app/nomadspeople-app`) and **backed by a DB patch where relevant**. Nothing is "half-done" unless marked ⏳.

## New system skills (for future sessions)

| Skill | Purpose |
|---|---|
| `logic` | Every button must close its loop — writes DB, ripples to every affected surface, posts system messages, surfaces success/failure. No hollow toggles. |
| `thorough` | Before any code change: query DB, grep all read/write sites, check RLS and cron jobs, patch stale data in the same commit. |

Both are installed as `.skill` packages. They trigger automatically for nomadspeople work in future sessions.

## Dev environment

- **Code lives at** `~/Desktop/nomadspeople-app` on the Mac
- **Two GitHub backups**: `flippermaps-hash/nomadspeople-app` (active), `nomadspeople-app/nomadspeople-app` (backup mirror)
- **Supabase project**: `apzpxnkmuhcwmvmgisms`
- **Expo account**: `nomadspeople` (nomadspeople1@gmail.com), Expo CLI authenticated via `EXPO_TOKEN` env var
- **DEV_MODE**: `__DEV__` — on in dev only, off in production. Single dev account: `barakperez@gmail.com` (real founder profile)

## Fixes by domain

### Status button (create + display + edit + lifecycle)

- **Create flow**: QuickStatusSheet writes to `app_checkins`. `city` is resolved via `resolveCityFromCoordinates` (CITIES DB 15 km radius → Nominatim fallback). Photon's `p.city` is NEVER trusted directly — it returns district, not city, in Israel.
- **expires_at policy** (final):
  - Immediate status (no `scheduled_for`) → `now + 60 min`
  - Scheduled specific time → `expires_at = scheduled_for`
  - Scheduled flexible time → `expires_at = 23:59:59 of scheduled_for's date`
- **pg_cron `expire-old-checkins`** now just respects `expires_at`: `UPDATE SET is_active = false WHERE is_active = true AND expires_at < now()`. No more special-case for scheduled events.
- **useActiveCheckins client filter** simplified to match the cron (expires_at only, no 12h grace).

### Map display

- **Marker flicker**: `tracksViewChanges={false}` on ALL markers (per CLAUDE.md). The "hot" visual stays in border color only.
- **Pin label**: prefers `display_name` over `full_name` (legacy `'Deleted User'` defaults no longer surface).
- **Zoom on city switch**: `latitudeDelta = 0.035` (city-center view), was 0.08 (regional).
- **Tap on pin**:
  - Timer pin → open bubble in place, no map motion.
  - Owner tapping own status → navigate to Profile (not the Join sheet).
  - Visitor tapping status → zoom 400 ms → `ActivityDetailSheet` after 450 ms.

### Activity Info (owner management modal in Profile)

- Every editable field stages into `stagedChanges`. The bottom Save bar appears only when there are pending changes.
- **Save button count** reflects user-visible edits (title/location/time/privacy), not underlying DB column count.
- **Save path**:
  1. `app_checkins` upsert with all staged fields
  2. If title changed → `app_conversations.name` + `activity_text` renamed
  3. One chat system message per changed field (via `postEventSystemMessage`)
  4. Refetch profile + active checkin
  5. Success `Alert` listing what changed
- **Location change** writes `city` correctly via `resolveCityFromCoordinates`.
- **Mini-map** uses `region` (controlled), moves immediately to staged coords.
- **Pending requests row** (private events only): horizontal avatars, tap → profile, ✓ approves in place, ✗ denies.
- **Active members row**: up to 3 avatars + "+N more" chip. Tap → profile.

### Private events (request-to-join + approval)

- `createOrJoinStatusChat(..., requiresApproval)` inserts the joiner with `status='request'` when the event is private. No chat access, no `member_count` bump.
- `approvePendingMember(convId, userId, ownerId)` → flips to `active`, bumps count, posts "Welcome" in chat.
- `denyPendingMember(convId, userId)` → flips to `declined`. They stay out.
- **DB CHECK constraint**: `status ∈ {'active','request','declined'}`. Do NOT use `'pending'`/`'denied'` — the DB rejects them.
- **RLS policies added**:
  - Admin can view all members of conversations they own (`is_conversation_admin` SECURITY DEFINER function)
  - Admin can update member statuses in their conversations

### Visitor sheet (ActivityDetailSheet)

- `this is your event · manage from Profile` banner shown if viewer is the owner (belt-and-suspenders in case the sheet opens via an unexpected path).
- `Join` button label becomes `request to join` for private events. On tap → inserts `status='request'`, shows "request sent — waiting for approval" state.
- **Active members row**: 3 avatars + "+N" chip in the sheet. Overlapping white-bordered circles.
- Title rendered centered with `paddingHorizontal: s(10)` + `alignSelf: stretch` + `numberOfLines={2}` (no side clipping).

### Profile screen

- **Social icons** (IG / TikTok / LinkedIn): circular brand icons via Google favicon service, under the avatar. Website moved to MyWork section only (no duplicate).
- **Settings → your links**: single "social & website" row opens a modal with IG/TikTok/LinkedIn only (website is in MyWork).
- **Zodiac**: thin-outlined circle badge on the LEFT of the avatar. Age stays in its own line below the name.
- **MyWork section**:
  - Single `website` input (dropped the 3-link array)
  - Skills + website + Open-to-work toggle
  - Save uses UPSERT (no silent no-op), Alert on error
  - Edit pencil: `s(6)` in primary color, pill background (impossible to miss)
  - All action icons prominent with hit-slop ≥ 8 px
- **Active event card**: rectangular, padded, s(18) icon, soft shadow. No longer looks squeezed.
- **Photo grid**: renders immediately with photos, enrichment (likes/comments) loads in background. No 3N-query wait.
- **"My travel" block** (Next Destination + trip card + FlightRouteStrip): removed per product decision.
- **"your groups will appear here" empty row**: removed (no signal for the user).

### Onboarding

- UPDATE → UPSERT everywhere (handleSaveProfile, handleAddTripAndFinish, handleOnboardingComplete). Fresh users with no `app_profiles` row no longer silently drop their entire onboarding.
- Step 3 (birthday) age-confirm uses `window.confirm` on web (Alert buttons don't render there).

### Delete Account

- Previously: fake (set `full_name='Deleted User'` + `visibility='invisible'`). Apple would reject.
- Now: full data deletion — checkins, memberships, messages (anonymized, sender_id = null), blocks, follows, profile views, notifications, photo_posts (soft), profile row. Signs user out. Auth.users hard-delete deferred to an Edge Function (not blocking Apple since PII is already gone).
- **Two-step confirmation**: Step 1 spells out exactly what's deleted and what survives and how. Step 2 is the final "Delete Forever" tap.

### Recent cities (search bar)

- Stored in `app_profiles.recent_cities` (jsonb, max 5).
- AsyncStorage is a warm cache only (no longer source of truth).
- Dropdown only — no always-visible chip strip (removed for UI density).
- Each recent item has an X to remove it. Tapping the row still opens the city.
- No auto-save of current city on mount; only explicit user-selected searches count.

### DB / Infra

- **pg_cron job `expire-old-checkins`** — updated to respect the new expires_at policy.
- **RLS**: new SELECT + UPDATE policies on `app_conversation_members` so conversation admins can see and update pending requests.
- **New column**: `app_profiles.recent_cities` (jsonb default `[]`).
- **Stale data patched**: user's `full_name='Deleted User'` → reset to display_name; scheduled events that were wrongly auto-expired → revived with correct `expires_at`; status row stuck with `city='מחוז תל אביב'` → corrected to `Bat Yam` / `Rehovot`.

### Web dev preview (earlier in the session)

- `public/index.html` + `public/frame.html`: iframe phone-frame wrapper (390×844) so `Dimensions.window.width` reports 390 in dev preview.
- `react-native-maps-web-mock.js` + `metro.config.js` alias: web stubs for `react-native-maps` (native-only lib).
- `babel-plugin-transform-remove-console` added to devDependencies.

## Known open items (not today's fix, documented for next session)

- ⏳ `npx expo install --fix` must be run on the Mac (the sandbox blocks `api.expo.dev`). 9 packages drift from SDK 54 expected versions.
- ⏳ `eas.json` Apple submit placeholders (`appleId`, `ascAppId`, `appleTeamId`) — need real values before EAS production build.
- ⏳ Password `nomadspeopleDev2026!` is in `App.tsx` git history. Before public launch: reset via Supabase Auth + move to `.env.local`.
- ⏳ PAT token exposed in `origin` remote URL (`ghp_...@github.com/nomadspeople-app/...`). Rotate and replace.
- ⏳ Push notifications for event changes (currently only in-chat system messages — push wrapper deferred to an Edge Function).
- ⏳ Auth.users hard-delete via Edge Function (deleteAccount handles PII; auth row is soft-orphaned).
- ⏳ Kick-with-ban from group (prevent rejoin). Currently `handleRemoveMember` just deletes; a banned user can re-request. Add a `banned_at` column or reuse `status='declined'` with a re-request block.

## What Apple requires (confirmed scope)

Apple reviewers do a 5–10 minute manual walkthrough. They check:
1. Block user — visible ✅
2. Report content — visible ✅
3. Delete own content — works ✅
4. Delete account (Guideline 5.1.1(v), June 2022) — **fixed today** ✅
5. Privacy Policy + Terms URLs — files exist; must also be set in App Store Connect metadata

Apple does NOT check: rate limiting, E2E encryption, ban-from-group, AI content moderation, admin dashboards. Keep it lean.

## Reference

- See `docs/status-button-spec.md` for the full button-by-button spec of the Status flow.
- See `CLAUDE.md` for locked architectural rules (repo boundary, map pin flow, avatar cache, i18n, visibility reciprocal rule, `tracksViewChanges=false`, `app_*` table prefix).
