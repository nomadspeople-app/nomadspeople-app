# Part 2 — Compliance Blockers: Deep Dive

**Status:** Pre-implementation architecture review. No code
changes yet.

**Scope:** Everything Apple will reject us for if missing.
Systemic designs, single source of truth per concern, no
duct-tape.

**Rule Zero check:** every design below survives this test:
*If 100 users trigger this surface simultaneously, does the
code still behave correctly? If the answer requires a
workaround — it's a band-aid.*

---

## 2.1 — Content Moderation (Proactive Filter)

### Current state

**What exists:**
- `reportMessage(messageId, reporterId, reason)` — reactive.
  Fills `app_message_reports`.
- `reportContent(reporterId, 'user'|'post'|'comment', …)` —
  reactive for other surfaces. Fills `app_reports`.
- `blockUser(myUserId, blockedUserId)` — user-level block.
  Fills `app_blocks` (cols: `blocker_id`, `blocked_id`).
- `removeGroupMember(creator, conversationId, targetUser)` —
  creator kicks from their own group chat.
- Sending flow: `ChatScreen.handleSend` (line 121) →
  `useMessages().send` in `lib/hooks.ts` (line 782) →
  `supabase.from('app_messages').insert(...)`.
- Publishing flow (activity text): `CreationBubble` →
  `handleCreationPublish` → `publishCheckin` in HomeScreen →
  `supabase.from('app_checkins').insert(...)`.

**What's missing (the Apple 1.2 blocker):**
- Zero pre-send content scanning. A user types a death threat
  in Hebrew, hits send — it lands in `app_messages` without
  any check.
- No `app_moderation_events` table → no visibility into
  blocked attempts for admin tuning.
- No privacy-preserving logging — we don't know what kinds of
  content get rejected.
- No localization awareness — filter must cover en, he, ru.

### Systemic design

**Core principle:** ONE gateway for all outbound UGC. Both
chat-message sends AND checkin-publishes pass through it
before they hit the DB. Not two parallel filters. Not a
per-surface check.

#### File layout

```
lib/
├── moderation/
│   ├── index.ts          ← public entry: scanText(text, { locale, context })
│   ├── wordlists/
│   │   ├── en.ts         ← English word list (~250 terms)
│   │   ├── he.ts         ← Hebrew word list (~200 terms)
│   │   └── ru.ts         ← Russian word list (~200 terms)
│   ├── categories.ts     ← exported enum: 'profanity' | 'hate' | 'violence' | 'sexual' | 'self_harm'
│   └── normalize.ts      ← strip diacritics, lowercase, leetspeak
└── hooks.ts              ← existing send() adds scanText() guard
```

`supabase/functions/moderate-text/` for the server-side second
pass — deferred to Week 1 post-launch (client-side filter is
the App Store compliance essentials; server-side is belt-and-
suspenders).

#### The `scanText` contract

```typescript
export interface ModerationInput {
  text: string;
  locale?: 'en' | 'he' | 'ru';  // optional; when absent, scan ALL locales
  context: 'chat_message' | 'checkin_text' | 'profile_bio';
}

export interface ModerationResult {
  allowed: boolean;
  reason?: 'profanity' | 'hate' | 'violence' | 'sexual' | 'self_harm';
  matchedTerm?: string;  // for internal logging ONLY — never shown to user
}

export function scanText(input: ModerationInput): ModerationResult;
```

**Design choices:**
- **Sync function, not async.** No network. Runs entirely on
  device, O(length × avg_list_size). At ~200 terms per locale
  and messages typically < 200 characters, this is
  sub-millisecond.
- **`locale` optional.** When the user is typing in a known
  locale we scan only that list. When absent (e.g., a user
  with `app_language='en'` types Hebrew for the first time),
  we scan all 3 — small perf cost, big safety net.
- **`context` affects thresholds.** Profile bios get a
  looser filter (no profanity block, since some users use
  mild words as self-description), chat messages get the
  full lock. Gives us one place to tune tolerance.
- **`matchedTerm` never surfaces to UI.** The user sees a
  polite generic message. The term is only for admin review
  to adjust the word list (reduce false positives).

#### Integration points

**Chat path** (lib/hooks.ts, inside `send()`):
```typescript
const send = async (userId, content, replyToId?, imageUrl?) => {
  // ...existing preconditions
  
  if (content.trim()) {
    const result = scanText({ text: content, context: 'chat_message' });
    if (!result.allowed) {
      // Log the attempt (without exposing content to user)
      await supabase.from('app_moderation_events').insert({
        user_id: userId,
        surface: 'chat',
        category: result.reason,
        matched_term: result.matchedTerm,
        content_hash: await sha256(content),  // for dedup without storing plaintext
        created_at: new Date().toISOString(),
      });
      return { error: new Error(MODERATION_BLOCKED_CODE) };
    }
  }
  
  // ...existing insert
};
```

**Checkin path** (HomeScreen's `publishCheckin`, before INSERT):
```typescript
const result = scanText({ text: input.text, context: 'checkin_text' });
if (!result.allowed) {
  Alert.alert(
    t('moderation.blockedTitle'),
    t('moderation.blockedBody')
  );
  await supabase.from('app_moderation_events').insert({ ... });
  return;
}
```

**ChatScreen.handleSend** — when `send()` returns the
`MODERATION_BLOCKED_CODE` error, show a localized polite
alert: "your message looks like it might violate community
guidelines. please rephrase." Restore the text in the input
so the user can edit.

#### New DB table

```sql
CREATE TABLE app_moderation_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface      text NOT NULL CHECK (surface IN ('chat','checkin','profile')),
  category     text NOT NULL,  -- matches ModerationResult.reason
  matched_term text,            -- what the filter caught
  content_hash text,            -- sha256 for dedup; no plaintext
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON app_moderation_events (user_id, created_at DESC);
CREATE INDEX ON app_moderation_events (category, created_at DESC);

-- RLS: only service_role reads; users can never see their own events
ALTER TABLE app_moderation_events ENABLE ROW LEVEL SECURITY;
-- NO policies for authenticated role — effectively service-role only.
```

#### Privacy-first logging

- We log that a user tried to send flagged content, BUT we
  never store the message text. Content is hashed (SHA-256)
  for dedup (lets admins see "this same phrase was caught
  47 times this week" without reading it).
- `matched_term` gives admins enough info to tune the list
  without reading the full message.
- RLS denies user read access — admin/service-role only.

#### Repeat-offender policy (v1)

- First 3 flags in 24h: show the polite alert, log the event,
  let user try again.
- 4th flag in 24h: show "community guidelines violated
  repeatedly; this account is temporarily limited. you may
  browse but not send messages for 1 hour." → set
  `app_profiles.send_blocked_until` (new column).
- 3 separate day-windows of 4+ flags each: flag account for
  manual review (admin dashboard).

v1 of the policy is intentionally mild — we don't want false
positives banning legitimate users. Tune after launch based
on `app_moderation_events` data.

#### Word list sourcing

- English: start from `leo-profanity`'s list as baseline,
  prune US-centric slang that's fine in travel context
  ("damn" etc.), add hate terms.
- Hebrew: manual curation. No mainstream Hebrew profanity
  list exists; we need to build one. Budget: half a day
  with a native speaker. Focus on:
  - Direct slurs (racial, ethnic, religious)
  - Explicit violence
  - Sexual content directed at specific people
- Russian: similar manual curation; reference existing
  OSS Russian profanity lists (e.g. `bad-words-ru`).

**Systemic checkpoint:** ONE file per locale, all in
`lib/moderation/wordlists/`. When an admin wants to add a
term, they edit the file. No hardcoded terms anywhere else
in the app.

#### i18n keys to add (3 locales)

```
moderation.blockedTitle       — "couldn't send"
moderation.blockedBody        — "your message looks like it might violate community guidelines. please rephrase."
moderation.blockedCheckinBody — "your activity text looks like it might violate community guidelines. please rephrase."
moderation.rateLimitedTitle   — "paused briefly"
moderation.rateLimitedBody    — "you've been limited from sending messages for an hour. try again later."
```

### Risks

| Risk | Mitigation |
|---|---|
| False positives ("scunthorpe problem") | Word list per locale with careful curation; `matchedTerm` logged so admin can tune fast. |
| User bypass via leetspeak / diacritics | `normalize.ts` strips those before scan. |
| Performance on long messages | Capped at 2,000 chars; O(n × list_size) = ~200 KB operations, sub-ms on any modern device. |
| Hebrew right-to-left encoding gotchas | Normalize strips bidi control chars before scan. |
| Word list privacy (user fingerprinting) | List is compiled into JS bundle. No network call to reveal terms. |
| App Store reviewer tests with creative attack | Client-side filter is minimal compliance; server-side OpenAI Moderation API (deferred) catches what client-side misses. |

### Test plan

1. **Green-path:** "let's meet at the park" → allowed,
   arrives in chat.
2. **Profanity:** English profanity → blocked, polite alert.
3. **Hate speech Hebrew:** slur in Hebrew → blocked.
4. **Hate speech Russian:** slur in Russian → blocked.
5. **Leetspeak bypass attempt:** obfuscated profanity →
   blocked after `normalize()`.
6. **Edge — empty string:** allowed (no-op).
7. **Edge — whitespace only:** caught by earlier "empty text"
   guard before hitting scanText.
8. **Repeat offender:** send 4 flagged messages in 1 hour →
   rate-limited with alert.
9. **App Store reviewer path:** paste the Apple standard
   test phrase (they have a list) → blocked.

### Time

1.5 days (0.5 day for architecture + code, 0.5 day for
Hebrew+Russian word list curation, 0.5 day for QA).

---

## 2.2 — Crash Reporting (Sentry)

### Current state

- Zero. No Sentry, no Bugsnag, no Firebase Crashlytics.
- No ErrorBoundary anywhere in the component tree.
- When a user's app crashes in production, we find out via
  App Store reviews if at all.

### Systemic design

**Core principle:** ONE `Sentry.init()` call at App.tsx's
top, wrapped by ONE ErrorBoundary around the navigation
root. Breadcrumbs via automatic integration with `fetch` and
Supabase client + the existing `trackEvent` pipeline.

#### Integration

```typescript
// App.tsx — top of the file
import * as Sentry from '@sentry/react-native';
import { isDevClient } from './lib/env';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !isDevClient(),           // don't spam Sentry with local crashes
  tracesSampleRate: 0.05,            // 5% of transactions
  environment: __DEV__ ? 'development' : 'production',
  release: Constants.expoConfig?.version + '-' + Constants.expoConfig?.ios?.buildNumber,
  beforeBreadcrumb: (breadcrumb) => {
    // Don't record password fields or message content as breadcrumbs
    if (breadcrumb.category === 'xhr' && /password|content/.test(breadcrumb.data?.url || '')) {
      breadcrumb.data = { ...breadcrumb.data, scrubbed: true };
    }
    return breadcrumb;
  },
});

// Wrap the App at export:
export default Sentry.wrap(App);
```

**Where to wrap:** `Sentry.wrap()` handles ErrorBoundary for
us. Alternative: explicit `<ErrorBoundary fallback={...}/>`
around `<NavigationContainer>`. We use `Sentry.wrap` because
it's one line and the fallback is a built-in (matches brand
with `errorBoundaryOptions.fallback` custom view).

#### Breadcrumbs — tie into existing `trackEvent`

Currently `trackEvent(userId, eventName, ...)` logs to our
own analytics. We extend it to also fire a Sentry breadcrumb:

```typescript
// lib/tracking.ts
import * as Sentry from '@sentry/react-native';

export function trackEvent(userId, eventName, ...) {
  // ...existing analytics logging
  
  Sentry.addBreadcrumb({
    category: 'user.action',
    message: eventName,
    data: { userId, ... },
    level: 'info',
  });
}
```

Result: when a crash happens, Sentry shows the last 20 user
actions leading up to it — "tap_map_pin" → "view_checkin" →
"join_timer" → 💥. Makes reproduction 10× easier.

#### DSN storage

**Never hardcoded.** Uses `EXPO_PUBLIC_SENTRY_DSN` env var:
- Defined in `.env.local` (gitignored) for dev.
- Defined as EAS secret (`eas secret:create`) for builds.
- Loaded via Expo's automatic env-var pipeline.

#### Release tagging

EAS auto-increments iOS `buildNumber` and Android
`versionCode` per build. The `Sentry.init.release` field
captures that number so Sentry groups crashes by build. If
Build 47 has a crash and Build 48 fixes it, Sentry shows the
fix date clearly.

### Risks

| Risk | Mitigation |
|---|---|
| Over-sampling fills quota | `tracesSampleRate: 0.05` — 5% is plenty for detection. |
| PII in breadcrumbs | `beforeBreadcrumb` scrubs URLs with sensitive keywords. |
| Sentry itself crashes | `Sentry.init` is wrapped in try/catch internally; its failure never bubbles up. |
| Development noise | `enabled: !isDevClient()` — no dev crashes to Sentry. |
| DSN leaked to git | `EXPO_PUBLIC_SENTRY_DSN` is a `process.env` var, not committed. |

### Test plan

1. `throw new Error('smoke test')` in a button handler →
   Sentry dashboard shows it within 30 s.
2. Verify `release` tag matches the build number in Sentry's
   "Issues" panel.
3. Trigger a navigation sequence, then crash, verify
   breadcrumb trail in Sentry issue detail.
4. Verify production build (EAS Preview) logs to Sentry but
   dev build does not.

### Time

2 hours (1 hour install + wire, 1 hour QA).

---

## 2.3 — iOS App Tracking Transparency

### Current state

- No `expo-tracking-transparency` package.
- No `NSUserTrackingUsageDescription` in app.json.
- No centralized "first-launch permission" orchestration —
  today, permissions fire on-demand from 8 different call
  sites (see audit: 7 Location, 1 Notification).

### Systemic design

**Core principle:** ONE permission orchestrator. Runs once
per install, after onboarding completes, in a deliberate
sequence that respects user fatigue (don't stack 3 system
prompts in 2 seconds).

#### File

```
lib/permissions.ts  ← new. Centralizes request orchestration.
```

```typescript
export type PermissionKey = 'location' | 'notifications' | 'tracking';

export interface PermissionOutcome {
  key: PermissionKey;
  status: 'granted' | 'denied' | 'undetermined' | 'not-applicable';
}

export async function requestOnboardingPermissions(): Promise<PermissionOutcome[]> {
  const results: PermissionOutcome[] = [];
  
  // 1. Location — we need this for the map to be useful.
  //    Ask FIRST, because it's the most core.
  results.push(await requestLocation());
  
  // 2. Notifications — ask second, after location. Gives
  //    the user a beat between prompts.
  await delay(400);
  results.push(await requestNotifications());
  
  // 3. ATT — iOS-only. Ask LAST because it's the least
  //    intuitive (and the least required).
  if (Platform.OS === 'ios') {
    await delay(400);
    results.push(await requestTracking());
  } else {
    results.push({ key: 'tracking', status: 'not-applicable' });
  }
  
  return results;
}

async function requestTracking(): Promise<PermissionOutcome> {
  const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
  const { status } = await requestTrackingPermissionsAsync();
  return {
    key: 'tracking',
    status: status === 'granted' ? 'granted'
          : status === 'denied'  ? 'denied'
                                  : 'undetermined',
  };
}
```

**Why centralize:**
- Onboarding fires `requestOnboardingPermissions()` once.
- If user denied at onboarding but later tries to use
  location, the individual call sites (HomeScreen,
  PeopleScreen, etc.) still call
  `Location.requestForegroundPermissionsAsync()` directly —
  unchanged. The onboarding module doesn't replace those; it
  pre-warms them.

#### app.json addition

```json
"infoPlist": {
  // ...existing
  "NSUserTrackingUsageDescription":
    "NomadsPeople uses anonymous usage stats to improve the app. Your chats, profile, and location are NEVER tracked across apps."
}
```

Wording calibrated: Apple reviewers care that the copy
explicitly names what is NOT tracked. The "NEVER tracked
across apps" line is the magic phrase.

### Risks

| Risk | Mitigation |
|---|---|
| User denies all 3 permissions | App still functions in degraded mode (no map, no push, no tracking). Re-request path exists per permission. |
| ATT denied — our analytics break | `trackEvent` already no-ops on denied; no breakage. |
| iOS SDK version mismatch | `expo-tracking-transparency` handles Expo SDK 54 compatibility. |
| User closes during prompt stack | Each prompt is independent; progress isn't lost. |

### Test plan

1. Fresh install → onboard → after welcome screen sees 3
   system prompts in sequence (Location → Notifications →
   ATT on iOS).
2. Reject ATT → app still works, `trackEvent` silently
   no-ops, no crash.
3. Accept all 3 → map loads, push fires, analytics tracks.
4. Settings → re-request any permission individually (the
   existing per-feature paths).

### Time

45 min.

---

## 2.4 — EAS Credentials + App Store Connect Metadata

### Current state

- `eas.json` has `YOUR_APPLE_ID@email.com` placeholders.
- No `EXPO_PUBLIC_*` env-var files.
- App Store Connect listing not yet created.
- No TestFlight configured.

### Systemic design

**Core principle:** TWO separate concerns. Credentials live
in EAS secrets (per-environment). Metadata lives in App Store
Connect (shared across builds of the same app). Never
conflate them.

#### Credential layout

```
EAS secrets (eas secret:create):
- APPLE_ID               — Barak's Apple Developer email
- ASC_APP_ID             — from App Store Connect → App Info
- APPLE_TEAM_ID          — from Apple Developer → Membership
- SENTRY_DSN             — from Sentry project
- SUPABASE_URL_PROD      — current prod URL
- SUPABASE_ANON_KEY_PROD — current prod anon key
- SUPABASE_URL_STAGING   — staging URL (after 3.2)
- SUPABASE_ANON_KEY_STAGING
```

#### eas.json — final shape

```json
{
  "cli": { "version": ">= 15.0.0", "appVersionSource": "local" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "$SUPABASE_URL_STAGING",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY_STAGING",
        "EXPO_PUBLIC_SENTRY_DSN": "$SENTRY_DSN"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "$SUPABASE_URL_STAGING",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY_STAGING",
        "EXPO_PUBLIC_SENTRY_DSN": "$SENTRY_DSN"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "$SUPABASE_URL_PROD",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY_PROD",
        "EXPO_PUBLIC_SENTRY_DSN": "$SENTRY_DSN"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "$APPLE_ID",
        "ascAppId": "$ASC_APP_ID",
        "appleTeamId": "$APPLE_TEAM_ID"
      },
      "android": { "track": "internal", "releaseStatus": "draft" }
    }
  }
}
```

**The `$VAR` syntax** is EAS native — it reads from the EAS
secrets layer, NOT from local shell env. Never leaks into
git.

#### App Store Connect metadata checklist

Barak must do this in the Apple web portal:

1. **App Info**:
   - Name: "NomadsPeople"
   - Subtitle: "find your people, right now"
   - Primary category: Social Networking
   - Secondary: Travel
2. **Version info**:
   - Description (4000 chars max) — needs marketing copy
   - Keywords (100 chars, comma separated)
   - Support URL: https://nomadspeople.com/support (create
     this page first)
   - Marketing URL: https://nomadspeople.com
   - Version: 1.0.0
3. **Screenshots** (required sizes):
   - 6.7" iPhone (iPhone 15 Pro Max, 1290×2796)
   - 6.5" iPhone (iPhone 14 Plus, 1284×2778)
   - 5.5" iPhone (SE-class, 1242×2208)
   - 12.9" iPad (2048×2732) — required because app.json
     has `supportsTablet: true`
4. **Privacy policy URL**: https://nomadspeople.com/privacy ✓
5. **Age rating**: 17+ (UGC, location, dating-like features)
6. **App Privacy Nutrition Labels** — most misunderstood
   part of submission. Need to declare per data type:
   - Contact info (email) — collected, linked to user,
     used for app functionality only
   - Location (precise) — collected, linked, used for app
     functionality
   - User content (photos, messages) — collected, linked
   - Identifiers (user ID) — collected, linked
   - Usage data (tapped pins, created events) — collected,
     NOT linked (anonymized)

### Risks

| Risk | Mitigation |
|---|---|
| Placeholder secrets committed by mistake | `$VAR` syntax makes them reference-only in git. Real values live in EAS. |
| Wrong Sentry DSN in production build | Separate EAS secrets per environment; `eas build --profile production` pulls prod secret only. |
| App Store reviewer rejects privacy labels | Follow the checklist strictly; mismatch between declared labels and actual data collection is THE common rejection reason for social apps. |
| Accidentally submit dev build | `autoIncrement: true` only on production profile; dev builds never get submitted. |

### Time

- Credential setup: 30 min (creating EAS secrets).
- App Store Connect listing: half day (copy + screenshots).
- Privacy labels: 30 min (filling the form).
- **Total: 4–6 hours.**

---

## 2.5 — Legal Links

### Current state

- `SettingsScreen` → "Legal & Safety" row navigates to
  in-app `LegalScreen.tsx`.
- `LegalScreen` has 4 tabs: Terms / Privacy / Guidelines /
  Safety. Content is RENDERED INLINE (not WebView). 
- All content is TypeScript constants in
  `screens/LegalScreen.tsx`.

**Why in-app is better than WebView:**
- No network required to read legal
- No risk of site being down during App Store review
- Content is frozen to the build (no post-launch surprise
  changes that reviewers didn't see)

### Systemic design

**Core principle:** Legal text is part of the app binary,
not fetched. Updates require a build + OTA (acceptable, since
legal updates are rare).

#### Content audit (the actual work for this item)

Open each tab and verify:
1. **Terms** — reference to "NomadsPeople", mention of
   account deletion, age requirement (17+), UGC policy,
   termination clause, jurisdiction (Israeli law).
2. **Privacy** — mention of every data type we collect,
   third parties (Supabase = EU-hosted, Sentry = EU-hosted
   if we pick EU region, Apple push notifications),
   retention period, account deletion mechanism.
3. **Community Guidelines** — explicit list of disallowed
   content (matches the moderation categories above:
   profanity / hate / violence / sexual / self-harm).
   Reviewers check this specifically.
4. **Safety Tips** — meeting in public places, trusting
   your instinct, blocking + reporting instructions.

#### Web copy sync

Our website already has `nomadspeople.com/privacy` and
`nomadspeople.com/terms` pages. They must MATCH the in-app
content, because:
- App Store lists the web URL as the canonical privacy policy.
- Mismatch between app copy and web copy = App Store
  rejection.

**Action:** diff the two sources, reconcile to a single
canonical copy. The app is the source of truth; web pages
should render FROM the same TypeScript constants (via a
small extraction to `lib/legal/content.ts` shared between
mobile + web).

### Risks

| Risk | Mitigation |
|---|---|
| Web / app legal copy drift | Extract shared content module; both consume from it. |
| Legal copy outdated for post-launch policy changes | Changes require a build + OTA. Budget: 1 day per legal update. |
| Missing required sections (arbitration, data-retention period) | Checklist in the audit above. Consult a lawyer before 1.0 ship. |

### Time

- Content audit + sync: 2 hours.
- Shared extraction: 1 hour.
- Lawyer review (separate task, schedule externally): 1–2
  days calendar time.

---

## Dependencies between Part 2 items

```
2.4 (EAS secrets layout)
   └─> 2.2 (Sentry needs DSN in EAS secrets)
   └─> 3.1 (OTA needs channel config in eas.json)
   └─> 3.2 (Staging needs URL in EAS secrets)
2.1 (moderation wordlists + DB migration)
   ├─ independent
2.2 (Sentry)
   ├─ independent (once DSN exists)
2.3 (ATT)
   ├─ independent
2.5 (legal links audit)
   ├─ independent
```

**Recommended execution order:**
1. Do 2.4 first (infrastructure — secrets needed by 2.2 / 3.1 / 3.2).
2. Do 2.2 in parallel with 2.1 (different files).
3. Do 2.3 + 2.5 last (quick wins, no dependencies).

---

## Pre-flight checklist (before calling Part 2 "done")

- [ ] `lib/moderation/` folder exists with 3 word lists and scanText passing unit tests.
- [ ] `app_moderation_events` table created with RLS.
- [ ] `send()` in `lib/hooks.ts` gated by scanText.
- [ ] `publishCheckin` in `HomeScreen.tsx` gated by scanText.
- [ ] User sees a localized polite Alert when their input is blocked.
- [ ] Sentry.init at App.tsx top with DSN from EAS secret.
- [ ] ErrorBoundary wraps navigation root via `Sentry.wrap(App)`.
- [ ] `trackEvent` emits Sentry breadcrumbs.
- [ ] Test crash shows up in Sentry dashboard.
- [ ] `expo-tracking-transparency` installed.
- [ ] `requestOnboardingPermissions` orchestrator in
      `lib/permissions.ts`.
- [ ] `NSUserTrackingUsageDescription` in app.json.
- [ ] ATT prompt fires after onboarding on iOS fresh install.
- [ ] `eas.json` uses `$VAR` references, zero literals.
- [ ] 8 EAS secrets created.
- [ ] App Store Connect listing created with screenshots +
      privacy labels + metadata.
- [ ] Legal content audited; in-app + web pages match.
- [ ] Shared legal content module.

---

## Total time estimate

| Item | Time |
|---|---|
| 2.1 Moderation | 1.5 days |
| 2.2 Sentry | 2 hours |
| 2.3 ATT | 45 min |
| 2.4 EAS + App Store metadata | 4–6 hours |
| 2.5 Legal links | 3 hours |
| **Total** | **2.5 days** |

All items must ship together; App Store review will catch
any one that's missing.
