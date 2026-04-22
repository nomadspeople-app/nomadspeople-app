# Commands to Run on Your Machine

**Why this file exists:** the dev sandbox here doesn't have
network access, so `npm install` and similar commands can't
run. These are the exact commands you (Barak) need to run
on YOUR machine before / during the launch sequence.

Run from the project root: `~/.../nomadspeople-app`

---

## Right now (anytime today / tomorrow)

### 1. Install ATT package (for #2.3)

```bash
npx expo install expo-tracking-transparency
```

Why: I wrote the orchestrator (`lib/permissions.ts`) with a
dynamic import that gracefully degrades when this package
isn't installed. Once you run this, ATT prompts actually fire
on iOS.

After install: you can DELETE `lib/types/expo-tracking-transparency.d.ts`
(it was a temporary type stub). Optional cleanup, not breaking.

### 1b. Install expo-image (perf fix — map pin avatars)

```bash
npx expo install expo-image
```

Why: `components/CachedImage.tsx` uses expo-image when it's
installed for on-disk image caching. Without it, it falls back
to React Native's default Image (memory cache only — slow on
cold start, the exact problem we're solving). Same try/require
pattern as ATT: safe to run or not run, but activates the fast
path when you do.

After install: `lib/types/expo-image.d.ts` becomes redundant
(real package types supersede it). Optional to delete.

Expected visible impact: ~70% faster map-pin avatar load on
cold cache, near-instant on warm cache (disk-backed).

### 1c. Install + configure expo-updates (OTA launch-readiness)

This is the most important of the three. Without OTA, any
post-launch bugfix = App Store resubmission (1-3 days). With
OTA, `eas update --branch production` ships fixes in minutes.

```bash
npx expo install expo-updates
eas update:configure
```

The second command adds two fields to `app.json`:
  - `expo.updates.url` (a unique URL on expo.dev)
  - `expo.updates.enabled: true`

`lib/updates.ts` is already wired into App.tsx via a
cold-launch check that becomes active the moment this package
is installed. No code change needed.

After install: `lib/types/expo-updates.d.ts` can be deleted
(real package supersedes). Not breaking to leave it.

### Rollback command — LEARN THIS BY HEART before launch

When a production OTA push breaks something, this is the
command that saves you:

```bash
# See recent updates:
eas update:list --branch production

# Find the LAST KNOWN GOOD `update-group-id`, then:
eas update:republish --group <group-id>
```

That re-points the production channel at an older working
bundle. Users get the rollback on their next cold launch.
Time to recovery: ~5 minutes.

### Typical post-launch fix flow

```bash
# 1. Fix the bug locally, test in dev.
# 2. Type-check:
node_modules/.bin/tsc --noEmit
# 3. Push to the staging channel first:
eas update --branch staging --message "fix: X"
# 4. Open the TestFlight preview build → verify the fix.
# 5. Promote to production:
eas update --branch production --message "fix: X"
# 6. Users get the fix on next cold launch.
```

### 2. Install Sentry (for #2.2 — when we wire it up next)

Wait — I'll write this section when I actually wire Sentry.
Coming soon.

---

## Before first production build (during #2.4)

### 3. Create EAS secrets

After Eyal completes Apple Developer enrollment AND you have
a Sentry account, run:

```bash
# Sentry DSN (you get this from sentry.io after creating project)
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://YOUR_SENTRY_DSN_HERE"

# Apple credentials (from Eyal's Developer + App Store Connect setup)
eas secret:create --scope project --name APPLE_ID --value "eyals_apple_id@email.com"
eas secret:create --scope project --name APPLE_TEAM_ID --value "ABC123XYZ"
eas secret:create --scope project --name ASC_APP_ID --value "1234567890"

# Supabase prod (you already have these — copy from your existing config)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_PROD --value "https://apzpxnkmuhcwmvmgisms.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY_PROD --value "eyJhbGc..."

# Supabase staging (after we create the staging project)
# (deferred — see #3.2)
```

### 4. Verify secrets are live

```bash
eas secret:list
```

You should see all 5+ secrets listed. Values aren't shown
(they're encrypted at rest).

---

## When ready to ship (during #5 launch sequence)

### 5. Build production binary

```bash
eas build -p ios --profile production
```

Expects: takes 15-30 min, produces an .ipa file. Pulls the
production secrets automatically.

### 6. Submit to App Store

```bash
eas submit -p ios --profile production
```

Expects: prompts for an App-Specific Password from Eyal's
Apple ID (he generates it from
`appleid.apple.com → Sign in & Security → App-Specific Passwords`).
Submission completes in 5 minutes; Apple review takes
1–3 days.

---

## Useful diagnostic commands

```bash
# What dependencies are missing or out of date?
npx expo doctor

# What's in the current build profile?
cat eas.json

# Type-check the app right now
node_modules/.bin/tsc --noEmit

# See current EAS account
eas whoami
```
