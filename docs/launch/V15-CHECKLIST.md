# v15 Checklist — Native Rebuild + Production Hardening

> **המסמך הזה הוא רשימה חיה.** כל פעם שאנחנו מזהים תיקון שצריך לחכות
> ל-v15 (כי הוא דורש native rebuild) או ל-Production hardening (כי הוא
> דורש שינוי הגדרות אחרי שגוגל מאשרים), נוסיף אותו כאן. **הקובץ
> נצבר** — לא מוחקים פריטים שמומשו, רק מסמנים אותם `✅` עם תאריך, כדי
> שתמיד יהיה תיעוד מלא של מה ש-v15 הביא.

> **The MUST-be-in-v15 column is the native list.** Everything else is
> documented for visibility and to keep us honest about the order of
> operations after Google approves Production.

---

## When does v15 ship?

The v15 native rebuild is **explicitly blocked by Rule Minus-One**
(see `CLAUDE.md`) until Google gives the final verdict on the v14
Closed Testing → Production submission.

The current path:

```
2026-04-25 → v14 LIVE on Closed Testing (Day 1)
2026-04-25 → 2026-05-09 → 14-day Closed Testing window (12+ testers required)
2026-05-09 → Apply for Google Production access
2026-05-09 → 2026-05-16 → ~7 days Google Production review
2026-05-16 → Google approves → public launch
2026-05-17+ → v15 native rebuild starts here
2026-05-17 → 2026-05-20 → v15 build + submit + review (~3 days)
2026-05-21+ → v15 LIVE
```

Any item in the "MUST be in v15" section below CANNOT ship before
**2026-05-17 at the earliest**. JS/DB items can ship via OTA at any
time (subject to Rule Zero discipline).

---

## 1) MUST be in v15 — native code, requires `expo prebuild` + new AAB

### Image picker — broken native module

- **What:** `expo-image-picker@^55.0.14` calls `AppContext.getServices()`
  which doesn't exist in `expo-modules-core@3.0.29`. Every
  `launchImageLibraryAsync` call crashes with `NoSuchMethodError`.
- **Fix:** upgrade to `expo-image-picker@~17.0.10` (SDK 54 aligned).
- **Side effect:** also bump `expo-file-system` from `55.x` to
  `~19.0.21` so the legacy import path no longer needed.
- **Code touch:** `lib/imagePicker.ts` — remove `V14_PICKER_DISABLED`
  guard (line ~53). Search the codebase for `V14_PICKER_DISABLED` to
  catch every reference.
- **User impact today:** profile photo upload + post photo upload
  show "coming in next update" Alert. Avatars rendered as initials.
- **Status:** ⏳ Waiting for Google Production approval

### Apple Sign-In — flip flag + .p8

- **What:** Apple Sign-In is fully scaffolded (`lib/auth.ts`,
  `app.json` plugins) but disabled via `extra.auth.appleEnabled: false`.
  Required by App Store guideline 4.8 (any app with email/password
  signup needs Sign in with Apple too).
- **Blocker today:** Uncle's Apple Developer account ($99/year),
  Services ID `com.nomadspeople.app.signin`, Key ID, `.p8` file.
- **Fix in v15:**
  1. Get Uncle to deliver the `.p8` (one-shot — Apple gives ONE
     download, store immediately in 1Password)
  2. Enable Supabase Apple provider (Auth → Providers → Apple)
  3. Flip `app.json → extra.auth.appleEnabled` to `true`
  4. Native rebuild picks up the entitlement automatically
- **Status:** ⏳ Waiting on Uncle gate

### versionCode bump

- **What:** `app.json → expo.android.versionCode` from `14` to `15`.
- **Note:** EAS production profile has `autoIncrement: true` so this
  happens automatically — just don't override it.
- **Status:** Automatic on `eas build`

### Re-validate native plugin list

- **Check:** before running `expo prebuild`, audit every plugin in
  `app.json → plugins` against current SDK 54 versions. Anything
  that hasn't been touched since the v14 build should be re-pinned.
- **Plugins of note (verify each):**
  - `expo-router` (if used)
  - `@react-native-google-signin/google-signin` — currently `^16.1.2`
  - `expo-apple-authentication` — currently `~55.0.13`
  - `expo-image-picker` — see image picker section above
  - `expo-image` — currently `~3.0.11`
  - `expo-file-system` — see image picker section
  - `expo-clipboard` — currently `^55.0.11`
  - `react-native-view-shot` — currently `^4.0.3` (don't downgrade —
    image-based markers depend on this)
  - `react-native-maps` — currently `1.14.0`
- **Status:** ⏳ Audit before next prebuild

### Sentry production DSN verification

- **What:** `lib/sentry.ts` is graceful-no-op when DSN is missing.
  `app.json → extra.sentry.dsn` should carry the real DSN. Verify in
  Sentry Dashboard that v15 builds report errors. If alerts stop, the
  injection silently broke.
- **Why v15:** if we need to update the Sentry SDK alongside the
  build, it travels with v15.
- **Status:** ⏳ Sanity check on first v15 build

---

## 2) Post-v15 — Supabase Production Hardening (no AAB needed)

These are dashboard / Supabase config changes we made FOR Closed
Testing that need to revert / harden once Production launches. Not
in code, in the Supabase dashboard.

### Re-enable "Prevent use of leaked passwords"

- **Current state:** OFF (disabled 2026-04-27 evening to unblock
  Closed Testing signups — Refael, Shahar, others were getting
  silent 422s when their chosen password matched HaveIBeenPwned).
- **Where:** Supabase Dashboard → Authentication → Sign In/Providers
  → Email → "Prevent use of leaked passwords" toggle.
- **When:** the morning after public launch on Production.
- **Status:** ⏳ Post-Production launch

### Set up custom SMTP (Resend or Postmark)

- **Why:** Supabase's default SMTP enforces 2 emails/hour project-
  wide. Fine for the current Closed Testing posture (email confirm
  is OFF, so no emails sent), but the moment we re-enable email
  confirmation OR password reset, we hit the cap immediately.
- **Provider candidates:**
  - **Resend** — 3,000 emails/month free, simple DKIM setup
  - **Postmark** — 100 emails/month free trial, then $15/mo
- **Setup steps:**
  1. Create Resend / Postmark account on `shospeople@gmail.com`
  2. Verify the `nomadspeople.com` domain (DKIM TXT records via
     Vercel DNS)
  3. Supabase Dashboard → Authentication → Emails → Custom SMTP →
     fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
     `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`
  4. Then increase the email rate limit on the Rate Limits page from
     2 to 100 (or higher).
- **Status:** ⏳ Pre-Production launch

### Re-enable email confirmation

- **Current state:** OFF (already was OFF before our recent
  investigation — verified in the dashboard).
- **When:** after custom SMTP is set up.
- **Why:** stops fake email accounts at signup. Critical for a
  consumer social app.
- **Status:** ⏳ After SMTP setup

### Lower password length back to 8

- **Current state:** 6 (lowered from 8 on 2026-04-27 to match
  client's `password.length < 6` validation in AuthScreen).
- **When:** after custom SMTP + leaked-password protection are back.
  Update `AuthScreen.tsx` `password.length < 6` check to `< 8` in
  the same commit.
- **Status:** ⏳ Post-Production launch

### Configure password reset email URL

- **Current state:** Supabase reset email lands users on a
  `supabase.co` URL before redirecting to `nomadspeople.com/reset-
  password`. Confusing — user thinks they're on the wrong site.
- **Fix:** Supabase Dashboard → Authentication → Emails → Reset
  Password → custom template OR Auth Hooks integration to send the
  link directly to `nomadspeople.com/reset-password?token=...`.
- **Status:** ⏳ Pre-Production launch

---

## 3) JS-only items that COULD ship before v15 (no native required)

These don't strictly need v15 but might bundle into v15's release
window for tidiness. Each can also ship via OTA on the production
channel any time.

### `handle_new_user` trigger — ON CONFLICT username

- **Why:** the trigger generates a username from the email's local
  part. If two users sign up with `john@gmail.com` and
  `john@yahoo.com`, second one fails with username unique-constraint
  violation → 422 with no clear error.
- **Fix shipped:** DB migration `handle_new_user_username_collision_safe`
  (2026-04-28). The trigger now pre-resolves a unique candidate
  username via a 10-attempt UUID-suffix loop with a timestamp
  fallback. Signups never fail on collision — the trigger always
  returns NEW.
- **Status:** ✅ 2026-04-28

### Avatar bustAvatar wiring in ProfileScreen

- **Why:** when the user uploads a new avatar, AvatarContext should
  call `bustAvatar()` so every other surface (Map markers, People
  list, Chat headers) refetches the new image instead of serving
  the cached old URL.
- **Fix shipped:** `screens/ProfileScreen.tsx` now imports
  `useAvatar` and calls `bustAvatar()` on the success branch of
  `handleAvatarPress`, after the DB upsert succeeds. The web admin
  upload path (the only working upload route in v14) already
  benefits from this. When v15 lifts V14_PICKER_DISABLED, the
  mobile picker path will also benefit without further changes.
- **Status:** ✅ 2026-04-28 (cache-bust wired; mobile picker still
  blocked on v15 native rebuild)

### `last_active_at` sync regardless of city

- **Issue from operational-snapshot.md P1 §6:** `syncLiveCityFromGPS`
  in `screens/HomeScreen.tsx` short-circuited the entire DB sync
  (including `last_active_at` bump) when the city hadn't changed.
  Result: a user who stays in the same city was never re-stamped, got
  filtered out by the new 24h active-presence filter (commit
  `c9b3d64`), and "disappeared" from PeopleScreen even though
  they were online.
- **Fix shipped:** `syncLiveCityFromGPS` is now split into two writes:
  (a) presence ping — `last_active_at` + `last_location_*` — fires on
  every call regardless of city, (b) city change — only when the
  resolved cityName actually moved. The reverse-geocode short-circuit
  is preserved on path (b) so we still avoid the network round-trip
  when the user is stationary.
- **Status:** ✅ 2026-04-28

### Password reset email URL (client side)

- **Fix at code level:** in `AuthScreen.tsx` `handleForgotPassword`,
  the `redirectTo: 'https://nomadspeople.com/reset-password'` is
  already correct. The supabase.co intermediate page is the
  Supabase-side custom email template (see post-v15 hardening §
  above). Client side: nothing to do, just confirm the redirect once
  the email template is updated.
- **Status:** ⏳ Pairs with the Supabase email template work

### i18n cleanup — ~70 hardcoded English strings

- **Where:** `screens/PeopleScreen.tsx`, `screens/ChatScreen.tsx`,
  `screens/FlightDetailScreen.tsx`, `screens/GroupInfoScreen.tsx`.
- **What:** every user-facing string must use `t('key')` per the
  i18n discipline rule (CLAUDE.md). Translations exist in
  `lib/translations/{en,he,ru}.ts`; the `t()` calls were missing.
- **Status:** 🟡 PARTIAL 2026-04-28 — first batch wrapped:
  - PeopleScreen: header title, snooze overlay (title/sub/wakeUp),
    section titles (relevant activities, incoming flights, meetup
    people), all empty states, fallback name, nomad/nomads plural
  - ChatScreen: message-request banner, locked-chat label, stay-safe
    modal title/sub/CTA, image-preview Cancel/Send
  - FlightDetailScreen: header title (`useI18n` newly imported here)
  - GroupInfoScreen: hdr title (both surfaces), edit name, end event,
    Share Activity, Mute Notifications, Open in Maps, view all,
    Leave Chat (button + modal title)
  - 30 new keys added to en/he/ru in the same batch
- **Still pending:** the long-tail of in-component sub-text (tip
  rows, member-count formatting, edit-mode placeholders, etc.) —
  visible but lower priority. Will sweep in a follow-up.

---

## 4) Known regressions in v14 — revert behavior in v15

### Pulse animation on hot map pins

- **What changed:** image-based markers (CLAUDE.md "Image-Based
  Markers" rule) ship the pin as a static PNG. The animated
  `PulseRing` for hot pins (heat > 0) became a static halo at the
  brightest point of the breathing animation.
- **v15 path:** image markers stay (they're the structural fix for
  Samsung One UI). For hot pins specifically, render a SECOND
  animated `<Marker>` (no image, just `PulseRing` as a child) at
  the same coordinate. Layered behind the PNG marker. Doubles the
  marker count for hot pins only — manageable.
- **When to do this:** only if user feedback says the static halo
  isn't enough. Don't pre-emptively add complexity.
- **Status:** ⏳ Defer until evidence

---

## 5) Things we DELIBERATELY chose to skip

Documented so the next session knows these were considered and
rejected, not forgotten.

### Clipboard-based avatar paste (rejected 2026-04-27)

- **Why considered:** JS-only workaround to allow profile photo
  upload while expo-image-picker is broken in v14.
- **Why rejected (owner directive):** UX too weird — "open gallery,
  long-press, copy, return to app, paste" is not what 2026 users
  expect. The reputation risk during Closed Testing > the upload
  feature gain. Better to show a polite "coming next update" Alert
  and let v15 fix it properly.
- **Code state:** Not in `lib/imagePicker.ts`. Was briefly added then
  reverted in the same session. Don't re-introduce.

---

## 6) Append-here log

Whenever a new fix is identified that needs v15 or post-v15
hardening, add it to one of the sections above and ALSO log a
one-line entry here so the change history stays visible:

| Date | Item | Section | Added by |
|---|---|---|---|
| 2026-04-27 | Initial doc — image picker, Apple Sign-In, Supabase hardening, i18n, last_active_at, handle_new_user, pulse regression | All | Barak + Claude |
| 2026-04-28 | Marked completed: handle_new_user trigger ON CONFLICT (DB migration), bustAvatar wiring in ProfileScreen, last_active_at split write in HomeScreen, i18n cleanup batch 1 (30 keys + 4 screens). All ship in the same EAS Update with the marker + zoom + auth UX changes. | §3 | Claude |

---

## How to use this doc going forward

1. **New issue identified?** Add it to the right section. Use the
   same shape (What / Why / Where / Status).
2. **Item shipped?** Mark it `✅` with the date — don't delete.
3. **About to start v15 work?** Read this top-to-bottom. Every
   `⏳` in section 1 is a build-time dependency; everything else
   is sequencing context.
4. **Owner-side prep:** before we run `eas build` for v15, this
   doc must show every section 1 item as ready to merge.
