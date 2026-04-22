# NomadsPeople — Pre-Launch Master Plan

**Prepared:** 2026-04-20 (ערב יום הזיכרון)
**For:** Barak — return day, press play, start.
**Rule Zero:** no band-aids. Every item below is a full build, or
it doesn't ship.

---

## How to use this document

Work top-to-bottom. Sections are in the **exact order you should
execute them**, because later items depend on earlier ones being
in place (e.g., you can't push OTA updates before you install
`expo-updates`; you can't pass App Store review without content
moderation).

Each section has:
- **State now** — what exists.
- **What to build** — concrete scope.
- **Files / surfaces to touch** — exactly where.
- **Risk** — what could go wrong.
- **Time estimate** — honest.
- **Done when** — the definition of done.

---

## PART 1 — Three quick wins before anything else (1 day total)

These are the small bugs that accumulate friction on every
touch. Fix them first so the rest of the work happens on a
stable base.

### 1.1 Interests chip — screen jumps on every tap (item #1)

**State now:**
`SettingsScreen.tsx` defines `DNAEditorModal` as a nested
component *inside* the parent function (line 277). Every
`setInterests` call re-renders the parent, which re-creates the
`DNAEditorModal` function identity, which React interprets as a
brand-new component and fully unmounts + remounts the modal
subtree. Result: the ScrollView resets to top on every tap, the
screen visibly jumps.

**Root cause:** classic React anti-pattern — nested component
definition.

**What to build:**
1. Extract `DNAEditorModal` to its own file:
   `components/DNAEditorModal.tsx`, top-level export.
2. Pass the state (interests / lookingFor / featuredTags /
   nomadType) + setters + save callback as props.
3. Verify scroll position stays stable when tapping a chip.
4. No logic changes. Pure structural move.

**Risk:** low. TypeScript will catch any broken prop wiring.

**Time:** 45 min.

**Done when:** tap 5 interest chips in a row on a long list —
scroll position does not move a pixel.

### 1.2 Conflict banner timing in CreationBubble (item #6)

**State now:**
`components/CreationBubble.tsx` line 608 renders the amber
"this will replace your timer" banner the moment the user
arrives at the WHEN step, because `whenChoice` defaults to
`'now'` and the condition fires instantly if
`hasActiveTimer=true`. User has not done anything yet but is
already being warned.

**What to build:**
Replace the top-of-step banner with a **quiet inline note
beside the currently-selected row**. Neutral grey text, not
amber warning. Example copy: "publishing now will replace your
current timer (☕ coffee, 23m left)".

Rules:
- Shown inline next to the selected WHEN row, not as a separate
  banner above.
- Only shown when selection === conflicting kind, AND only
  AFTER the user touches the WHEN row at least once (tracks an
  `userTouchedWhen` bool set on first tap). Default state on
  open = no note, even though "now" is pre-selected.
- Kept on the PUBLISH summary step too, same tone — so the
  user sees it one last time before committing.
- `replaceBanner` style block keeps existing, but repurposed as
  `replaceInline` — smaller, grey-on-white, left-aligned.

**Files:** `components/CreationBubble.tsx` only.

**i18n keys to add (all 3 locales):**
- `creation.conflict.replaceTimerInline` — "will replace your
  current timer"
- `creation.conflict.replaceScheduledInline` — "will replace
  your current scheduled event"

**Risk:** low. Visual-only change, DB untouched.

**Time:** 40 min.

**Done when:**
- Open "+" with an active timer → no banner visible yet.
- Tap "later" → still no banner (cross-kind no-op).
- Tap "now" again → inline grey note appears next to the "now"
  row.
- Continue to PUBLISH → same note shown above the publish
  button.

### 1.3 TimerBubble fallback strings still in English (follow-up to #6)

**State now:**
The few remaining English strings in TimerBubble (e.g., the
`'Nomad'` / `'Timer'` defaults on lines 222 / 286) are fallbacks
used when the checkin has no `status_text` / `activity_text`.
They only surface in error-state scenarios but still count as
hardcoded user-facing text.

**What to build:**
- Add `event.fallback.creator` ("nomad" / "נווד" / "кочевник")
- Add `event.fallback.activity` ("something" / "משהו" / "что-то")
- Replace the literals in TimerBubble.

**Risk:** trivial.

**Time:** 15 min.

**Done when:** grep for `'Nomad'\|'Timer'` as string literals
in TimerBubble returns zero results (only type references).

---

## PART 2 — App Store compliance blockers (2 days)

**These are not optional.** Apple will reject the app without
them. Do NOT submit before every item below is ticked.

### 2.1 Proactive content moderation (Apple Guideline 1.2)

**State now:**
- `reportMessage()` exists — reactive reporting ✓
- `blockUser()` exists — user-to-user block ✓
- `removeGroupMember()` exists — creator can kick ✓
- **`app_reports` table exists but there's no PROACTIVE filter**
  that blocks objectionable content at send-time. Apple requires
  this for UGC apps.

**What to build:**

**Option A — On-device word-list filter (simplest):**
1. Create `lib/moderation.ts` with a multilingual profanity +
   hate-speech word list (English + Hebrew + Russian, ~200
   entries per language — use the `leo-profanity` library or
   a manual list).
2. At message send time in `ChatScreen`, run the message text
   through `moderation.scan(text)` before `supabase.insert`.
3. If flagged:
   - Block the send.
   - Show a polite alert: "your message looks like it might
     violate community guidelines. please rephrase."
   - DO NOT log the blocked content anywhere the user can see
     (privacy).
4. Same gate applies to `activity_text` when publishing a
   check-in.

**Option B — Server-side via Supabase edge function (more
correct long-term):**
1. Create `moderate-text` edge function that accepts `{text,
   lang}`, returns `{allowed, reason?}`.
2. Use a combination of word lists + OpenAI Moderation API (or
   equivalent) for coverage.
3. All chat sends + checkin posts POST here first; only
   proceed on `allowed=true`.
4. Failures log to a `app_moderation_events` table for
   analytics without exposing content to the user.

**Recommendation:** Do both. Option A is the client-side first
pass (instant, no network), Option B is the server-side safety
net (catches things the word list misses). Apple accepts either
alone; together is bulletproof.

**Files:**
- New: `lib/moderation.ts`
- New: `supabase/functions/moderate-text/`
- Update: `ChatScreen.tsx` (message send path)
- Update: `components/CreationBubble.tsx` (WHAT step validate)

**Time:** 1 day.

**Done when:**
- Posting the text "I want to hurt you" is blocked client-side.
- Posting similar text in Hebrew or Russian is also blocked.
- The blocked-attempt is logged server-side for admin review.
- App Store review reviewer can paste offensive text into chat
  and see it rejected.

### 2.2 Crash reporting (Sentry)

**State now:**
Zero crash reporter. When a user's app crashes in production,
we find out via App Store reviews. Unacceptable.

**What to build:**
1. `npm install @sentry/react-native sentry-expo`.
2. Wrap app root with Sentry.init in `App.tsx`.
3. Add DSN to EAS secrets (not checked in).
4. Configure release tagging so each EAS build registers its
   version to Sentry automatically.

**Files:** `App.tsx`, `eas.json` (env section).

**Time:** 1.5 hours.

**Done when:** force a crash on dev build → appears in Sentry
dashboard within 30 seconds.

### 2.3 iOS App Tracking Transparency (ATT) prompt

**State now:**
If the app uses any third-party analytics / ad SDK, iOS 14.5+
requires the ATT prompt before tracking across apps. We do
`trackEvent` to our own backend which is exempt, BUT if Sentry
or any future SDK uses IDFA, we need the prompt.

**What to build:**
1. Install `expo-tracking-transparency`.
2. Call `requestTrackingPermissionsAsync` once at first launch
   (after onboarding).
3. Add `NSUserTrackingUsageDescription` to `app.json`
   infoPlist: "NomadsPeople uses anonymous usage stats to
   improve the app. Your chats and location are NEVER
   tracked."

**Files:** `App.tsx` (first-launch effect), `app.json`.

**Time:** 30 min.

**Done when:** fresh install shows the ATT prompt after the
welcome screen.

### 2.4 EAS submit credentials + App Store Connect metadata

**State now:**
`eas.json` submit profile has placeholder values
(`YOUR_APPLE_ID@email.com` etc.). Can't submit.

**What to build:**
1. Fill `eas.json`:
   - appleId (Barak's Apple Developer account email)
   - ascAppId (from App Store Connect — you need to create the
     app listing first)
   - appleTeamId (from Apple Developer portal)
2. In App Store Connect, create:
   - App listing with name, subtitle, category (Social
     Networking)
   - Screenshots (6.7" iPhone and iPad sizes)
   - Privacy policy URL — already at
     `nomadspeople.com/privacy` ✓
   - Terms URL — already at `nomadspeople.com/terms` ✓
   - Account deletion URL — already at
     `nomadspeople.com/delete-account` ✓
   - Age rating: 17+ (social + UGC)
   - Support URL and Marketing URL
3. Submit App Privacy Nutrition Label:
   - Contact info: name, email, phone (collected)
   - User content: photos, messages (collected)
   - Identifiers: user ID (linked to identity)
   - Usage data: tapped pins, created events (not linked)
   - Location: precise (collected, linked)

**Files:** `eas.json` + external App Store Connect setup.

**Time:** half day (including screenshots + copy writing).

**Done when:** `eas submit -p ios --profile production` runs
without credential errors.

### 2.5 Privacy policy + Terms in-app links

**State now:**
Links exist in Settings → Legal. Need to verify they open
correctly on device and the URLs match what's in App Store
Connect.

**What to build:** manual verification step. Open Settings,
tap each legal link, confirm the page loads and is current.

**Time:** 15 min.

---

## PART 3 — Deployment infrastructure (half day)

### 3.1 EAS Update (OTA post-launch fixes) — answers item #2

**State now:**
No `expo-updates` package. Every code change requires a full
rebuild and App Store re-submission (days to weeks). When the
app is live with users, you cannot fix anything quickly.

**What to build:**

**Step 1 — Add the infrastructure:**
1. `npx expo install expo-updates`
2. `eas update:configure` — sets up the update channel.
3. Add three channels in `eas.json`:
   - `staging` — internal testers only
   - `production` — real users
   - `production-rollback` — emergency revert target

**Step 2 — Pick a strategy:**
- `production` channel auto-updates apps on next open.
- For emergency bugfixes: `eas update --branch production
  --message "..."`. Users get the fix on next app restart, no
  App Store review needed.
- Native code changes still require a rebuild (limitation —
  OTA can only ship JS/assets).

**Step 3 — Pre-launch smoke test:**
- Build a production binary with OTA enabled.
- Publish a dummy OTA update ("version 1.0.1-test").
- Confirm the build picks it up on next open.
- Confirm rollback works: push the previous build ID, confirm
  users revert.

**Step 4 — Answer Barak's workflow question (item #2):**

> "איך זה יעבוד כאשר האפליקציה חיה ובאוויר עם משתמשים אני לא
> אוכל לעבוד עליה ישירות?"

Answer: **the development flow doesn't change, only the
deployment flow.** You still write code locally, still hit
reload, still test on your device. But when you're ready to
ship:

- **JS/assets changes** (99% of what you'll iterate on) →
  `eas update --branch production`. Users get the fix on
  next open, ~5 minutes.
- **Native changes** (permissions, new packages, version
  bumps) → `eas build -p ios --profile production` + submit
  to App Store review. 1–3 days.

**Mockup → live flow:**
1. Barak works on a feature locally with hot reload.
2. When ready, pushes to a `feature/xyz` branch.
3. EAS build creates a staging build; installs on TestFlight
   for internal testers.
4. After QA, merge to `main` → CI auto-runs
   `eas update --branch production`.
5. Users get the update silently on next app open.

**Files:** `eas.json`, `App.tsx` (Updates.checkForUpdateAsync
on launch).

**Time:** 4 hours.

**Done when:**
- Staging build can receive an OTA update within 60 seconds of
  publish.
- Rollback to a previous update works.
- Documentation written in `docs/launch/ota-runbook.md`.

### 3.2 Staging environment in Supabase

**State now:**
One Supabase project (apzpxnkmuhcwmvmgisms) is both prod and
dev. If you run a destructive query by mistake, real user data
is gone.

**What to build:**

**Option A — Full clone (cleanest):**
1. Create `nomadspeople-staging` project in Supabase.
2. Use `supabase db dump --project-id apzpxnkmuhcwmvmgisms`
   to export schema + RLS + functions.
3. Apply to staging.
4. Set an env-switch in the app: `EXPO_PUBLIC_SUPABASE_URL`
   reads from `__DEV__` ? staging : prod.

**Option B — Branching (Supabase native):**
1. Use Supabase's new branching feature (if available on your
   plan).
2. `supabase branches create preview` — gives a fork of
   schema+data.
3. App points to the branch URL during dev.

**Recommendation:** Option B if your plan supports it (saves
sync work), otherwise Option A.

**Files:** `.env` variants, `lib/supabase.ts`.

**Time:** 2 hours (A) / 30 min (B).

**Done when:** running the dev build never touches production
data. A wrong query in dev cannot affect live users.

---

## PART 4 — Features to build BEFORE launch (3 days)

### 4.1 Share Bubble — multi-creator events (item #5)

**State now:**
Single creator per event, full ownership. Bubble shows one
avatar on top. DB has no co-creator concept.

**What Barak wants:**
An event can have 1–3 co-creators. The bubble shows all their
avatars stacked at the top (instead of one). This increases
social weight — the event feels bigger, less solo, more
"something's happening". Works for both timer and scheduled.

**What to build:**

**Step 1 — DB model (additive, won't break existing single-
creator events):**
```sql
CREATE TABLE app_checkin_co_creators (
  checkin_id  uuid REFERENCES app_checkins(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id)   ON DELETE CASCADE,
  invited_by  uuid REFERENCES auth.users(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (checkin_id, user_id)
);

-- The primary creator stays in app_checkins.user_id (no change).
-- co_creators stores additional hosts (max 2 per checkin).
CREATE UNIQUE INDEX app_checkin_co_creators_max_3
  ON app_checkin_co_creators (checkin_id)
  WHERE (SELECT count(*) FROM app_checkin_co_creators WHERE ... )
  — actually do this in a trigger that blocks INSERTs once
  count >= 2 (not an index).
```

**Step 2 — UI: multi-avatar shell in `Bubble.tsx`:**
- Accept an `avatars: Array<{url, fallback}>` prop (1–3 items).
- Render avatars stacked horizontally with -12px overlap,
  centered, overlapping the card top by 25px (same as
  current).
- First avatar (primary creator) slightly larger or with a
  small "host" ring; the rest uniform.
- Fallback: 1 avatar → identical to today's render.

**Step 3 — Invite flow:**
- New button inside TimerBubble (owner-only): "invite
  co-host".
- Opens a small sheet: pick from your followers / recent
  chatmates.
- On accept: INSERT into `app_checkin_co_creators`; both names
  appear in the bubble title ("Sofia & Marco · coffee on
  Rothschild").

**Step 4 — Permission model:**
- Primary creator can end the event, invite co-hosts, kick.
- Co-hosts can edit activity_text, location — **cannot** end
  the event or kick (those stay primary's authority).
- All hosts get all joiner-notifications.

**Step 5 — Publish via CreationBubble:**
- Stage 1: primary creator publishes normally (no change).
- Stage 2: future enhancement — "invite co-host before
  publish" as a step in the WHEN / WHERE / WHO flow. Scope
  this second stage separately once the infrastructure works.

**Files:**
- New: `lib/hooks.ts` → `inviteCoHost`, `acceptCoHost`,
  `fetchCheckinCoCreators`
- New migration
- Update: `components/Bubble.tsx` (avatar slot)
- Update: `components/TimerBubble.tsx` (invite button, title
  concat)
- Update: `lib/hooks.ts` `useActiveCheckins` (JOIN co-creators)

**Risk:** MEDIUM. First real schema extension. Watch for RLS
policy + realtime event mismatch.

**Time:** 2 days.

**Done when:**
- Sofia creates "coffee", invites Marco as co-host, Marco
  accepts, both avatars visible on the pin for visitors, both
  show up in the chat title, Marco can edit activity text but
  not end.

### 4.2 Missing notification triggers (item #4)

**State now:**
Triggers exist for new_checkin, new_message, new_follow, new
`app_notifications` row. But the app doesn't currently
trigger pushes for:
- Someone joined your checkin (creator's reward signal — the
  most important one you're missing)
- Scheduled event reminder 1 hour before
- Timer about to expire (10 min warning)
- Your event was reported / you received a warning

**What to build:**
1. **`trg_notify_on_join`** — INSERT trigger on
   `app_conversation_members`. When a new member joins a
   checkin-linked conversation, POST to
   `send-push-notification` targeting the checkin's creator
   (+ co-creators once #4.1 lands).
2. **Scheduled reminder cron** — pg_cron job every 5 minutes,
   queries for checkins where `scheduled_for` is 55–65 min
   from now AND no reminder sent; fires pushes to all
   members; marks with a `reminder_sent_at` column.
3. **Timer expiry warning** — similar cron for timers where
   `expires_at` is 5–10 min from now AND creator opted in.
4. **Moderation notification** — when a user's post/message
   is flagged, send a polite push: "your last message was
   held for review; please re-read community guidelines".

**Files:**
- Supabase migration: triggers + cron jobs + one new column.
- `supabase/functions/send-push-notification` — may need to
  be extended to accept bulk recipients (for scheduled
  reminder to all members).

**Time:** 1 day.

**Done when:**
- Joining someone's event instantly buzzes the creator's
  phone.
- An event scheduled 1 hour from now buzzes all RSVPs ~1h
  ahead.
- Timer with 5 min left buzzes the creator.

### 4.3 Creator kicks user — UI already exists, DB already works

**State now:** `removeGroupMember` exists in `lib/hooks.ts`,
surfaced in `MembersModal` with an × button for the creator.
No action needed — just verify on device.

**Done when:** Sofia can kick Marco from her coffee chat with
one tap, confirmation Alert, undo toast. Marco's device
receives a push: "you've been removed from the coffee chat".

---

## PART 5 — Launch Day Runbook

### Pre-launch checklist (run the day before)

- [ ] All Part 1 items merged + on device QA.
- [ ] All Part 2 items live and tested.
- [ ] EAS Update channel live, rollback tested.
- [ ] Staging environment separate from prod.
- [ ] Part 4.1 (Share Bubble) either fully shipped OR feature-
      flagged off.
- [ ] Part 4.2 notifications smoke-tested on a real device.
- [ ] Content moderation tested with a dozen edge cases per
      locale.
- [ ] Crash reporter DSN live, test crash went through.
- [ ] App Store Connect listing complete, privacy labels
      submitted.
- [ ] Screenshots captured in all 3 locales.
- [ ] TestFlight internal + external testers signed off.
- [ ] Support email inbox monitored (you need one — Apple
      requires it).
- [ ] `docs/launch/incident-playbook.md` printed and next to
      keyboard (see section 5.3 below).

### Launch day — the sequence

1. **08:00** — Build production: `eas build -p ios --profile
   production`. Get the IPA.
2. **10:00** — `eas submit -p ios --profile production`.
   Starts App Store review (1–3 days).
3. **While waiting** — continue preparing Part 4 items that
   didn't make launch.
4. **When approved** — schedule release for a Tuesday or
   Wednesday at 14:00 Israel time (Apple's recommended window,
   avoids weekend spike).
5. **T-0** — release goes live.
6. **T+5min** — open Supabase dashboard. Watch for:
   - Auth signup rate
   - Error rate in edge functions
   - Slow queries
7. **T+30min** — open Sentry. Any uncaught errors?
8. **T+1hr** — open the app yourself. Create a timer. Open
   someone else's event.
9. **T+3hr** — first support emails arrive. Expect mostly
   "how do I..." questions — good sign, no crashes.

### 5.3 Incident playbook (what to do when something breaks)

**Crash in TimerBubble → no one can tap a pin:**
1. Rollback OTA: `eas update --branch production --republish
   --group <previous-group-id>`.
2. Users get the previous JS bundle on next open.
3. Fix locally, test, publish new OTA.
4. Time to recovery: 15–30 min.

**DB under load → slow queries:**
1. Check Supabase dashboard → Database → Performance.
2. If it's a specific slow query, add an index or cache in
   hook.
3. Push OTA with the fix if it's client-side; apply migration
   if it's server-side.

**Spam / abuse burst:**
1. Disable signup via Supabase auth settings (kill switch).
2. Investigate the attack vector; patch.
3. Re-enable signup.

**App Store review rejection:**
1. Read the rejection reason carefully.
2. Most common: missing privacy policy link, incomplete UGC
   moderation demonstration, unclear permission strings.
3. Fix → resubmit.
4. Timeline: usually 48 hours per round.

---

## PART 6 — Post-launch (week 1+)

1. **Day 2** — First retention cohort read. Did D1 > 50%?
2. **Day 7** — Kick off the analytics plan from
   `docs/analytics/two-worlds-plan.md`. Instrument the missing
   events.
3. **Day 14** — First archetype split report. Hybrid hypothesis
   confirmed?
4. **Week 3** — Address the map + image perf pass from
   `docs/tomorrow/2026-04-21-performance.md` if D30 retention
   dropped.
5. **Week 4** — First "revisit the 5-step flow?" discussion
   with real funnel data.

---

## Time estimate summary

| Part | Content | Days |
|---|---|---|
| 1 | Three quick wins | 1 |
| 2 | Compliance blockers | 2 |
| 3 | Deployment infra | 0.5 |
| 4 | Features (share-bubble + pushes) | 3 |
| Total before launch | | **~7 working days** |
| App Store review | | +1–3 days |
| Total calendar | | **~10 days** |

---

## Red lines — never cross

1. Do not submit to App Store before Part 2 is complete. You
   will be rejected, and each rejection costs 1–3 days.
2. Do not ship the first version without `expo-updates` /
   OTA. If there's any bug, you need 15-min recovery, not
   1-week.
3. Do not touch the DB schema (#4.1 migration) without a
   backup. Supabase lets you snapshot — take one.
4. Do not mix the 5-step CreationBubble decision with
   anything here. That's a post-launch conversation
   (see `docs/product-decisions/2026-04-20-keep-5-step-creation.md`).
5. Do not "quickly fix" the one-per-kind rule
   (see `docs/product-decisions/2026-04-20-one-active-per-kind.md`).

---

## Closing note for Barak

Everything in this document is reversible except one:
**Part 4.1 migration (Share Bubble)**. Once that table exists
and rows are written, you have to migrate forward, not
backward. Before you run that migration, sleep on it one
night and confirm the product vision.

Everything else — if it doesn't feel right, undo and retry.
The infrastructure we built in the last session (publishCheckin,
AgeRangeControl, eventTime, unified TimerBubble) is solid
foundation. Don't break it. Build on it.

Press play Wednesday morning.
