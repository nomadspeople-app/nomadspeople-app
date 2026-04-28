# nomadspeople — Project Dossier

> **This file is the single source of truth for everything non-code about
> the project.** Who owns it, where every email lands, which plan on
> which provider, what Apple/Google want from us, what's still pending.
>
> **Read this FIRST** before asking "where does X live?" If the answer
> is missing from this file, add it after you find it. The rule is: we
> answer any bureaucratic question *once*.
>
> **Last reviewed:** 2026-04-26 · **Next review:** when any row changes.

---

## 0A. Current Operational Snapshot (2026-04-26)

The single screen that answers "where are we right now":

| Layer | State | Detail |
|---|---|---|
| **Mobile AAB version** | `1.0.0 (14)` LIVE on Closed Testing | EAS build `3cc178ae-1702-4c85-9c24-c9c30ca1af33`, commit `35f8ecc` |
| **Closed Testing track** | Active, 14-day clock running from 2026-04-25 16:08 | 12 testers in `nomadspeople-testers` list — opt-in URL: `https://play.google.com/apps/testing/com.nomadspeople.app` |
| **Production access ETA** | 2026-05-09 (D+14 from clock start) | Then 7 more days for Google Production review |
| **App canonical folder on Mac** | `~/Desktop/nomadspeople-app` | **DO NOT use any other folder** — see PROJECT_LOCATION.md |
| **Web (landing + legal)** | Live at https://nomadspeople.com | Vercel project `nearby-discovery-pro`, deploys from `web/` on every push to `main` |
| **DB users** | 3 (Barak owner, App Store Reviewer demo, nomadspeople1 admin) | All 13 bots removed 2026-04-26 — see Rule Minus-One context |
| **Maps SDK Android** | API key configured 2026-04-26 | Stored in `app.json → expo.android.config.googleMaps.apiKey` (`AIzaSyCP1Nw0W0N5pnHcHSoYMU_2YAIyWR2E19E`) — restricted to Maps SDK for Android |
| **Google OAuth Android client** | SHA-1 = `F7:76:6B:EC:5D:13:7C:6A:87:66:CD:9E:48:5E:90:BD:E7:D0:8E:24` | **App Signing Key** SHA-1 from Play Console (NOT upload key). Without this, Google Sign-In fails with DEVELOPER_ERROR. |
| **Reviewer demo account** | `reviewer@nomadspeople.com` / `FOjVcpuGsbrwTH4f9*rNgBcM` | Profile complete, brand-logo avatar, 7-day check-in active at Nahalat Binyamin (re-seed before each Apple/Google review) |
| **Apple track** | BLOCKED on Uncle | See Section 8 |
| **Sentry alerts (mobile)** | 1 production crash on v12 (Maps API key missing) — RESOLVED in v14 | Sentry issue 115075601 |

**The Rule Minus-One** (CLAUDE.md): no native changes during Google review window. JS / DB / Cloud changes only.

---

## 0. How to use this file

- Sections are ordered from most-to-least frequently needed.
- `TBD` means the value exists somewhere but hasn't been pinned here yet — fill it in the moment you learn it.
- `PENDING` means the value does not yet exist in the world — there's a task to create it.
- **Never put actual secrets (passwords, private keys, `.p8` contents, Client Secrets) in this file.** Only pointers to where they live.

---

## 1. Identity

| Field | Value |
|---|---|
| Product name (lowercase, always) | `nomadspeople` |
| Apple bundle identifier | `com.nomadspeople.app` |
| Android package name | `com.nomadspeople.app` |
| Expo slug | `nomadspeople-app` |
| Expo owner | `nomadspeople` |
| Expo project ID | `f7b98f05-2cda-4e34-8ea2-b1782649d5e3` |
| App display name | `nomadspeople` |
| Primary brand color | `#E8614D` (coral — icon + splash bg) |
| Current version | `1.0.0` (build 1 on iOS — auto-increments on EAS production) |
| Target launch store | Apple App Store first, Google Play second |
| Supported app languages | `en`, `he`, `ru` (3 locales — every user-facing string lives in `lib/translations/`) |

---

## 2. People

| Role | Person | Contact |
|---|---|---|
| Founder / owner | Barak Perez | `barakperez@gmail.com` · day-to-day Google account: `shospeople@gmail.com` |
| Apple Developer account holder | Uncle (TBD — exact name) | Invoked when Apple-side setup is needed (Services ID, `.p8`, App Store Connect submission). See Section 8. |
| Legal beneficiary (for GDPR requests) | Barak Perez | `support@nomadspeople.com` |

`shospeople@gmail.com` is the operational account — it owns the Google Cloud project, the ImprovMX forwarding, most SaaS signups. Use it when a new service asks who owns the app.

---

## 3. Email routing (where does every email end up?)

**Policy:** users and service vendors only ever see `@nomadspeople.com` addresses. Those addresses are **forwarded** to `shospeople@gmail.com` via ImprovMX. No mailbox on `@nomadspeople.com` is independently readable — everything lands in Gmail.

| Address | Forwards to | Purpose | Provider |
|---|---|---|---|
| `support@nomadspeople.com` | `shospeople@gmail.com` | User support, Apple/Google reviewer contact, Google OAuth consent screen | ImprovMX (free plan, one alias) |
| `legal@nomadspeople.com` | `shospeople@gmail.com` | GDPR / DSAR / privacy requests — referenced in `/privacy` | ImprovMX |
| `privacy@nomadspeople.com` | `shospeople@gmail.com` | Alias for legal@ — referenced in privacy policy | ImprovMX |

Gmail filters in `shospeople@gmail.com` should tag incoming forwards by the original To: header so Barak can see which alias each message hit. TBD: confirm filters exist or create them.

Sending email FROM `@nomadspeople.com` — not configured yet. Magic-link signup emails come from Supabase SMTP (default `noreply@mail.app.supabase.io`); custom template set 2026-04-15 but still uses Supabase sender. No plan yet to migrate to Postmark / Resend. PENDING for post-launch.

---

## 4. Domain & DNS

| Item | Value |
|---|---|
| Domain | `nomadspeople.com` |
| Registrar | TBD — likely purchased via Namecheap or Google Domains by `shospeople@gmail.com`. Confirm next time we touch DNS. |
| DNS provider | Vercel (nameservers delegated) — confirmed 2026-04-22 when the domain migrated to the `nearby-discovery-pro` Vercel project. |
| Apex behavior | 307 redirect to `www.nomadspeople.com` (Vercel domain config) |
| MX records (email forwarding) | Points to ImprovMX servers (`mx1.improvmx.com`, `mx2.improvmx.com`) |

---

## 5. Backend — Supabase

| Item | Value |
|---|---|
| Organization | `nomadspeople` (id `xibxqkvryfbjhydmmzds`) |
| Project | `nomadspeople` (ref / id `apzpxnkmuhcwmvmgisms`) |
| **Plan** | **Pro** (confirmed 2026-04-23) — includes daily backups, 8 GB DB, 100 GB egress, custom SMTP option. The Free-plan egress scare (7.9 GB) happened before we upgraded. |
| Region | `eu-central-1` (Frankfurt) — keeps data inside the EU for GDPR |
| Postgres version | 17.6.1.084 |
| Project URL | `https://apzpxnkmuhcwmvmgisms.supabase.co` |
| Anon key | Committed in `lib/supabase.ts` (safe — anon key is public-by-design, RLS enforces access) |
| Service role key | **Never** committed. Lives in Supabase Dashboard → Settings → API. Used only by Edge Functions (auto-injected as `SUPABASE_SERVICE_ROLE_KEY`) and by Barak via the dashboard. |
| Dashboard | https://supabase.com/dashboard/project/apzpxnkmuhcwmvmgisms |
| Table naming rule | **App tables are prefixed `app_`** (e.g. `app_profiles`, `app_checkins`). Non-prefixed tables (`city_*`, `neighborhoods`, …) are legacy from an old project and must not be read by the mobile app. RLS is default-deny on all of them. |

### 5.1 Auth providers enabled

| Provider | Enabled? | Configured via |
|---|---|---|
| Email (magic link + password) | ✅ Always on | Supabase default |
| Google | ✅ Enabled 2026-04-22 | Web Client ID + Client Secret in Supabase Dashboard → Auth → Providers → Google. `googleIosClientId` listed under "Authorized Client IDs" so native iOS ID tokens verify. |
| Apple | ⏸ Off until Uncle grants Apple Developer access (see Section 8). Flag `extra.auth.appleEnabled = false` in `app.json`. |
| Anonymous | ❌ off |

### 5.2 Edge Functions

| Function | Purpose | Verify_jwt |
|---|---|---|
| `sitemap` | Serves `/sitemap.xml` for the landing page | false |
| `generate-neighborhood-intel` | Legacy — not called by the mobile app | false |
| `send-push-notification` | Called by DB trigger `trg_dispatch_push` to fan a new notification row out to the user's Expo push token | false |

### 5.3 pg_cron jobs

| Job | Schedule | What it does |
|---|---|---|
| `cleanup_expired_checkins_5min` | `*/5 * * * *` (every 5 min) | Flips `is_active = false` on `app_checkins` whose `expires_at` passed. Batches 500 rows `FOR UPDATE SKIP LOCKED`. |
| `generate-neighborhood-intel` | 1st of month 03:00 UTC | Calls the legacy Edge Function. Not relevant to the mobile app but kept for the old site. |
| `site-health-monitor` | Hourly | Pings the landing page; writes to `site_health_reports`. |

### 5.4 Storage buckets

| Bucket | Public? | Who writes | RLS |
|---|---|---|---|
| `avatars` | Public reads | Authenticated user, path `{userId}/{ts}.{ext}` | INSERT policy: anyone authed; UPDATE policy: same, with `bucket_id` check_expr (fixed 2026-04-22) |
| `post-images` | Public reads | Authenticated user. Also used by ChatScreen — attachments land under `chat/{conversationId}/{userId}-{ts}.{ext}` (one bucket for both). | Same structure as avatars |
| `videos` | Public reads | Authenticated user — auth.uid() must match the top folder | Legacy; not currently wired in the app |

### 5.5 Security posture (Supabase advisors, 2026-04-23)

- **0 ERRORS**
- 16 INFOs: `rls_enabled_no_policy` on legacy non-`app_` tables — intentional default-deny per CLAUDE.md Repo Boundary.
- ~14 WARNs: `function_search_path_mutable` on pre-existing functions. Not a blocker. `notify_on_new_checkin` was tightened today (2026-04-23) with `ALTER FUNCTION ... SET search_path = public, pg_temp`.

---

## 6. Web — Vercel

Three Vercel projects exist; only one matters for production.

| Vercel project | Purpose | Domain | Status |
|---|---|---|---|
| `nearby-discovery-pro` | **Canonical production** — serves nomadspeople.com from the `web/` folder of this repo. | `nomadspeople.com` (apex 307 → www) + `www.nomadspeople.com` | Active, receives every push to `main` |
| `nomadspeople-web` | Old Lovable-built neighborhoods page | `.vercel.app` only (domain removed 2026-04-22) | Inactive, kept as reference. Do not redeploy. |
| `nomadspeople-app` | Early scaffolding attempt | `.vercel.app` only | Inactive |

**Plan:** Hobby (free) — TBD if we move to Pro when we add analytics / A/B.

**Key build settings (for `nearby-discovery-pro`):**
- Root directory: `web`
- Build command: `npm run build` (= `vite build`; `tsc -b` is a separate `npm run typecheck` — do not chain)
- Output: `web/dist`
- SPA rewrite: `web/vercel.json` redirects all routes to `/index.html` so `/support`, `/privacy`, `/terms`, `/delete-account`, `/admin` resolve client-side.

Routes served:
- `/` — landing page
- `/privacy` — version-locked policy (see Section 10)
- `/terms` — Terms of Service
- `/support` — FAQ + contact, required by Apple Guideline 1.2
- `/delete-account` — magic-link account deletion flow (Apple Guideline 5.1.1(v))
- `/admin` — internal moderation view (not linked from public menus)

---

## 7. Mobile build — EAS / Expo

| Item | Value |
|---|---|
| Expo project ID | `f7b98f05-2cda-4e34-8ea2-b1782649d5e3` |
| Expo owner org | `nomadspeople` |
| EAS update URL | `https://u.expo.dev/f7b98f05-2cda-4e34-8ea2-b1782649d5e3` |
| Channels | `development` · `staging` · `production` |
| Runtime version policy | `appVersion` — each native bundle only receives OTA updates for the same `1.0.x` family |
| New Architecture | Enabled (`"newArchEnabled": true` in app.json) |
| Plan | Expo free tier. EAS Build has monthly limits — check dashboard quarterly. |

Build profiles (see `eas.json`):
- `development` — dev client, internal distribution, iOS simulator allowed
- `preview` — staging channel, internal
- `production` — autoIncrement build number, production channel

`eas.json → submit.production` still has **placeholder values** for Apple:
```
appleId, ascAppId, appleTeamId — all YOUR_...
```
These fill in when the Uncle grants access (Section 8). Do not `eas submit` before then.

---

## 7A. Google Play Developer (ACTIVE as of 2026-04-23)

| Field | Value |
|---|---|
| Account type | Personal |
| Account owner | `shospeople@gmail.com` (Barak Le May Perez) |
| Developer name (public on Play Store) | `nomadspeople` |
| Developer account ID | `6700370044457273942` |
| Developer email (public) | `nomadspeople1@gmail.com` |
| Website | `https://nomadspeople.com` |
| Paid $25 signup fee | ✅ 2026-04-23 |

Legal identity + private contact details (home address, phone, owner email) → **`docs/accounts-private.md`** (gitignored — PII). Never copy that content into PROJECT_DOSSIER.md or any committed file.

When you need to rescue the account, Google Password Recovery flow runs on `shospeople@gmail.com`.

---

## 8. Apple Developer (the uncle gate + 7-day timeline)

The Apple side has 3 gates: uncle pays $99, uncle creates Services ID + .p8, we build & submit. Total realistic timeline: **7 days from $99 payment to "live on App Store"**.

### Dependencies on the uncle

| Item | Value | Status |
|---|---|---|
| Uncle paid $99 | TBD — confirm in next call | Prerequisite to everything else |
| Team ID | PENDING | Needed for Supabase Apple provider + `eas.json` `submit.production.appleTeamId` |
| Services ID | PENDING (planned: `com.nomadspeople.app.signin`) | Needed for Supabase Apple provider |
| Key ID | PENDING | Needed for Supabase Apple provider |
| `.p8` private key file | PENDING — Barak must store it in 1Password the moment Uncle downloads it (Apple gives you ONE chance). | Needed for Supabase Apple provider |
| App Store Connect App ID (ascAppId) | PENDING | Needed for `eas submit` |
| Apple ID (for `eas submit`) | PENDING | Filled into `eas.json` when we submit |

Full step-by-step for the uncle-call: **`docs/2026-04-22-apple-google-signin.md`** sections 4 + 5.

### Realistic timeline (from $99 payment)

```
D0      Uncle pays $99 + uploads ID for Apple identity verification
D0-D2   Apple's automatic identity verification (24–48 hours)
D2      Uncle invites Barak as Admin to App Store Connect (5 min)
D2      Video call — uncle creates Services ID + .p8 (45 min, guided by Barak)
D2      Barak configures Supabase Apple provider + flips appleEnabled:true (15 min)
D2      EAS iOS build — runs ~20 min in cloud (default Xcode 26 + iOS 26 SDK)
D2      iOS screenshots in Xcode Simulator (30 min) — see docs/apple-screenshot-guide.md
D2      Create App Store Connect app record + fill metadata (30 min)
D2      Submit for Apple Review
D3-D5   Apple Review (human, 24–48 hours typical)
D5-D7   Publish live — or resolve any rejection feedback, resubmit, +1–2 days per cycle
```

**Compare:** Google Play = 21 days minimum (Closed Testing rule). Apple = 5-7 days typical. Ironically Apple is FASTER for small personal-account developers.

### Why we'd hit Apple Review in such fast window

We pass Apple's compliance requirements already (see `docs/apple-compliance-audit.md`):
- ✅ Sign in with Apple — scaffolded, just flip flag
- ✅ Account deletion in-app + web — `lib/accountDeletion.ts`
- ✅ UGC moderation — block, report, moderation events
- ✅ Privacy policy + Data Safety
- ✅ Consent checkboxes at signup
- ✅ Info.plist descriptions non-generic

Things we need to answer in App Store Connect at creation (not code-side):
- ⚠️ **Age Rating** — will be 17+ under 2026 new system (UGC + unrestricted chat)
- ⚠️ **EU Trader Status** — commercial app = Trader; public contact = `support@nomadspeople.com` + business address
- ⚠️ **Demo account for reviewer** — see `docs/reviewer-demo-account.md` for the full spec
- ⚠️ **iOS screenshots** — 8 at 1320×2868 via Xcode Simulator; see `docs/apple-screenshot-guide.md`

### If Apple rejects

Don't panic. Most first-time apps hit 1 rejection cycle. Common reasons + fixes live in `docs/apple-compliance-audit.md` §13.

---

## 9. Google OAuth (operational)

Google Cloud project owned by `shospeople@gmail.com`.

| Field | Value |
|---|---|
| Project name | `nomadspeople` (TBD: confirm the exact Cloud project ID) |
| OAuth consent screen | **External**, in "Production" mode |
| App name on consent | `nomadspeople` |
| App support email | `shospeople@gmail.com` (Google does not allow `support@nomadspeople.com` here — tried 2026-04-22, blocked. Alt-email added to Google account but dropdown still shows only primary.) |
| App domain | `nomadspeople.com` |
| Privacy URL | `https://nomadspeople.com/privacy` |
| Terms URL | `https://nomadspeople.com/terms` |
| Scopes | `email`, `profile`, `openid` |
| Developer contact | `shospeople@gmail.com` |

### OAuth 2.0 clients

| Client | Purpose | Client ID |
|---|---|---|
| `nomadspeople-web` | Supabase server-side token exchange | `622916189529-9plps2f4omirhkv7p88gi6237622mfoe.apps.googleusercontent.com` |
| `nomadspeople-ios` | Native Google Sign-In on iOS | `622916189529-1hqs52vr20nd6h72ca5pf5o86i9k83kl.apps.googleusercontent.com` |
| `NomadsPeople Android` | Native Google Sign-In on Android | `622916189529-4028d9a44b8odpduu49qk2ijv38qlpdo.apps.googleusercontent.com` · Package: `com.nomadspeople.app` · SHA-1: `F7:76:6B:EC:5D:13:7C:6A:87:66:CD:9E:48:5E:90:BD:E7:D0:8E:24` (App Signing Key from Play Console — set 2026-04-26) |
| `Maps SDK Android key` | Google Maps for Android (separate API key, not OAuth) | `AIzaSyCP1Nw0W0N5pnHcHSoYMU_2YAIyWR2E19E` — restricted to Maps SDK for Android, no app restriction yet (TODO: lock to package + SHA-1 post-launch) |

**Client Secret (Web only):** lives ONLY in Supabase Dashboard → Auth → Providers → Google. Do not copy elsewhere.

**Authorized Redirect URI (Web client):** `https://apzpxnkmuhcwmvmgisms.supabase.co/auth/v1/callback`

**iOS URL scheme** (reverse of iOS client ID): `com.googleusercontent.apps.622916189529-1hqs52vr20nd6h72ca5pf5o86i9k83kl` — already injected into the `google-signin` Expo plugin in `app.json`.

---

## 10. Legal & compliance

| Doc | Source of truth | Current version | URL |
|---|---|---|---|
| Privacy Policy | `lib/legal/content.ts` → `PRIVACY_TEXT` + `PRIVACY_VERSION` | `2026-04-22` | https://nomadspeople.com/privacy |
| Terms of Service | `lib/legal/content.ts` → `TERMS_TEXT` + `TERMS_VERSION` | `2026-04-22` | https://nomadspeople.com/terms |
| Community Guidelines | `lib/legal/content.ts` → `GUIDELINES_TEXT` | (unversioned) | In-app only (Settings → Guidelines) |
| Safety Info | `lib/legal/content.ts` → `SAFETY_TEXT` | (unversioned) | In-app only |
| Support / FAQ | `web/src/pages/SupportPage.tsx` | N/A | https://nomadspeople.com/support |
| Account deletion flow | `web/src/pages/DeleteAccountPage.tsx` + `lib/accountDeletion.ts` (shared) | N/A | https://nomadspeople.com/delete-account |
| Incident response runbook | `docs/incident-response.md` | 2026-04-22 | Internal |
| Privacy + Security master spec | `docs/product-decisions/2026-04-22-privacy-security-master-spec.md` | 2026-04-22 | Internal |

**GDPR posture:**
- Data stored in EU (Supabase Frankfurt + Sentry Frankfurt)
- Explicit opt-in at signup (4 consent checkboxes: age 18+, terms, privacy, marketing — first three required, marketing optional)
- Every consent event logged immutably in `app_consent_events`
- Right-to-delete implemented end-to-end via `lib/accountDeletion.ts` (used by both the mobile Settings screen and the /delete-account web flow — shared module, one source of truth)
- DPA-ready: we list 10 third-party sub-processors inside the Privacy Policy

---

## 11. Monitoring — Sentry

| Item | Value |
|---|---|
| Org | `nomadspeople-o7` |
| Mobile project | `nomadspeople-mobile` |
| Region | Frankfurt (EU) — `de.sentry.io` |
| DSN (mobile) | Committed in `app.json → extra.sentry.dsn` (`https://d0c5b1eec5c2b670b845ce487da0496f@o4511258504658944.ingest.de.sentry.io/4511258513702992`) — safe to commit, DSNs are public-by-design |
| PII filter | `lib/sentry.ts` strips messages/breadcrumbs; userId attached after auth; no email/display-name ever sent |
| Init gate | `__DEV__` builds skip sending (see `lib/sentry.ts`) |
| Plan | Free tier (includes 5k errors/month). Moderation reports are routed here with tag `report:moderation` to trigger the 24-hour SLA — see commit `c6e549b`. |

Dashboard: https://nomadspeople-o7.sentry.io/projects/nomadspeople-mobile/

---

## 12. Version control — GitHub

| Item | Value |
|---|---|
| Org/owner | `flippermaps-hash` |
| Repo | `flippermaps-hash/nomadspeople-app` |
| Default branch | `main` |
| Commit author (local override for this repo) | `flippermaps-hash <261786837+flippermaps-hash@users.noreply.github.com>` — required so Vercel attributes commits correctly |
| Vercel integration | Installed via GitHub OAuth on `nearby-discovery-pro`; auto-deploys `main` |

---

## 13. Third-party services summary (plans + costs)

| Service | Purpose | Plan | Monthly cost | Owner account |
|---|---|---|---|---|
| Supabase | Backend (DB + Auth + Storage + Edge + Realtime) | **Pro** | $25 | `shospeople@gmail.com` |
| Vercel | Web hosting for landing + legal pages | Hobby (free) | $0 | `shospeople@gmail.com` |
| Expo EAS | Mobile builds + OTA updates | Free tier | $0 | `shospeople@gmail.com` |
| Sentry | Error monitoring | Free tier | $0 | `shospeople@gmail.com` |
| ImprovMX | Email forwarding for `@nomadspeople.com` | Free (1 alias per domain) — TBD confirm we're not over the limit | $0 | `shospeople@gmail.com` |
| Google Cloud | OAuth consent + client IDs | Free (OAuth + Maps under free tier) | $0 | `shospeople@gmail.com` |
| Apple Developer Program | Required for App Store | $99/year | Uncle's account (not Barak's) |
| Google Play Developer | Required for Play Store | $25 one-time | ✅ Active — paid 2026-04-23, dev ID `6700370044457273942` |
| Domain registrar | `nomadspeople.com` | TBD | TBD | Probably `shospeople@gmail.com` |

**Estimated total monthly cost today:** ~$25 (Supabase Pro). Plus ~$8.25/mo amortized for the Apple developer membership.

---

## 14. Key source-of-truth locations inside this repo

| Topic | File |
|---|---|
| Architectural rules (map pin flow, avatar cache, RLS boundary, i18n rule) | `CLAUDE.md` |
| Auth / sign-in client code | `lib/auth.ts` |
| Apple + Google setup walkthrough | `docs/2026-04-22-apple-google-signin.md` |
| Account deletion (shared module) | `lib/accountDeletion.ts` |
| Push notification client wrapper | `lib/notifications.ts` |
| Supabase DB client | `lib/supabase.ts` |
| Sentry init + PII filter | `lib/sentry.ts` |
| Translations (en/he/ru) | `lib/translations/*.ts` |
| Legal text (single source) | `lib/legal/content.ts` |
| Image picker + uploader | `lib/imagePicker.ts` |
| Incident response runbook | `docs/incident-response.md` |
| Launch master plan | `docs/launch/MASTER-PLAN.md` |
| Compliance deep dive | `docs/launch/PART-2-DEEP-DIVE.md` |
| Privacy + Security master spec | `docs/product-decisions/2026-04-22-privacy-security-master-spec.md` |
| Store submission metadata | `docs/app-store-metadata.md` + `NomadsPeople-Store-Submission-Kit.docx` |
| Compliance audit | `docs/store-compliance-audit.md` |
| 2026-04-22 sprint log | `docs/2026-04-22-pre-launch-sprint.md` |

---

## 15. Pending bureaucracy — the short list

| # | Item | Blocker | Owner |
|---|---|---|---|
| 1 | Get Uncle's Apple Developer access | Uncle's availability | Barak |
| 2 | Create Apple Services ID + Key + `.p8` (see Section 8) | Task 1 | Barak + Uncle |
| 3 | Create App Store Connect record for `com.nomadspeople.app` | Task 1 | Barak |
| 4 | Enable Supabase Apple provider | Task 2 | Barak |
| 5 | Flip `appleEnabled = true` in `app.json`, rebuild via EAS | Task 4 | Barak |
| 6 | ✅ Google Play Developer account ($25 one-time) | done 2026-04-23 | Barak |
| 6A | Play Console phone verification (SMS) | None — can do now | Barak |
| 6B | Play Console Android device verification | Install Android Studio Emulator (see `docs/android-studio-emulator-setup.md`) | Barak |
| 7 | Generate Android SHA-1 via `eas credentials -p android` + add Android OAuth client | First EAS Android build success | Barak |
| 8 | Confirm domain registrar + add to this file | None — open Vercel DNS settings | Barak |
| 9 | Confirm ImprovMX alias count (free plan limit) | None | Barak |
| 10 | Gmail filters to tag forwarded `@nomadspeople.com` mail | None | Barak |
| 11 | Recruit 12+ Closed Testing testers | EAS AAB build success | Barak |
| 12 | Wait 14 continuous days with 12+ testers opted in | Tester recruitment | Time |
| 13 | Apply for Production Access | Task 12 | Barak (templates in `docs/play-production-access-answers.md`) |

When any of these closes, **update this file in the same commit as the underlying change**. That's the discipline.

---

## 16A. 21-Day path to Google Play launch (NEW rule for personal accounts)

Because our Play Console account is **Personal** and was created after 2023-11-13, Google requires a Closed Testing period of **12+ opted-in testers for 14 continuous days** before we can apply for Production Access. The path is:

```
D0   EAS build succeeds → AAB ready
D0   Create app record in Play Console
D0   Upload AAB to Closed Testing (NOT Internal — doesn't count)
D0-1 Recruit + invite 12+ testers
D1   12th tester opts in → 14-day clock starts
D1-14  Test period — gather feedback, ship OTA fixes
D14  Apply for Production Access (see docs/play-production-access-answers.md)
D14-21 Google reviews (~7 days)
D21+ Publish to Production — public launch
```

Reference docs:
- `docs/google-play-submission.md` — store listing copy, Data Safety, content rating
- `docs/play-tester-recruitment.md` — recruitment messages + tester checklist
- `docs/play-production-access-answers.md` — Day-14 application template
- `docs/android-studio-emulator-setup.md` — Emulator for device verification + screenshots
- `docs/play-policy-audit.md` — proactive policy compliance check (audit result: 0 blockers)

---

## 16. Support & rescue

If the account holder is unreachable and something breaks:

- **Supabase dashboard/billing:** `shospeople@gmail.com` — recovery via Google account recovery
- **Vercel dashboard:** `shospeople@gmail.com` (signed in via GitHub OAuth — `flippermaps-hash` GitHub account)
- **Expo/EAS dashboard:** `shospeople@gmail.com`
- **Sentry dashboard:** `shospeople@gmail.com`
- **ImprovMX dashboard:** `shospeople@gmail.com`
- **Apple Developer:** Uncle's Apple ID (document TBD)
- **Google Cloud / Play:** `shospeople@gmail.com`
- **GitHub:** `flippermaps-hash` + `shospeople@gmail.com`

Emergency legal / privacy contact (for users, via the app and the policy): `legal@nomadspeople.com` (forwards to Gmail).

---

## 17. Changelog of this file

| Date | Change | Author |
|---|---|---|
| 2026-04-23 | Created from scratch — consolidated info from HANDOFF.md, HANDOFF-PROMPT.md, CLAUDE_CODE_BRIEFING.md, `docs/launch/*`, `docs/product-decisions/*`, `app.json`, `eas.json`, and direct Supabase/Vercel/Google Cloud queries | Barak + Claude |
| 2026-04-25 | Submitted v8 (wrong folder), then v14 corrected. v14 approved by Google + LIVE on Closed Testing track. 14-day clock started 16:08 IDT. | Barak + Claude |
| 2026-04-26 | Added Section 0A (Operational Snapshot). Closed off Android OAuth client PENDING — now configured with App Signing Key SHA-1. Added Maps SDK Android key. Cleaned 13 bot users from DB (Misrepresentation Policy). Filled Reviewer demo profile. Added Rule Minus-One to CLAUDE.md (no native changes during Google review). | Barak + Claude |
| 2026-04-27 | Image-based marker refactor — replaced custom-View `<Marker>` rendering path with offscreen `react-native-view-shot` capture → `<Marker image={uri}>`. Fixes Samsung One UI half-rendered bubbles, "creators don't see their own pin", and "bubbles only appear after zoom" — all three traced to the Skia bitmap-snapshot path failing on One UI. JS-only change (view-shot 4.0.3 already in v14 AAB) — ships via EAS Update on production channel, no Rule Minus-One impact. New CLAUDE.md section "Image-Based Markers" supersedes the old "No Negative Offsets in Marker Subtree" rule (folded in). Known regression: hot-pin pulse animation is now a static halo (PNG can't capture mid-animation). | Barak + Claude |
| 2026-04-27 (evening) | Auth UX hardening — friendlyAuthError now recognises 7 explicit 422 codes (over_email_send_rate_limit, user_already_exists, signup_disabled, weak_password, email_address_invalid, email_address_not_authorized, over_request_rate_limit) so testers see actionable messages instead of "Something went wrong". Added a sublabel under the Continue with Google button ("Either way creates the same account…") to remove the confusion that drove Refael and Shahar to abandon signup. Default map zoom tightened from latitudeDelta 0.08 → 0.04 across both INITIAL_REGION and handleCitySelect so bubbles read at city-level view instead of dot-on-region. Created V15-CHECKLIST.md as the living queue of fixes that need the v15 native rebuild + post-launch Supabase hardening. | Barak + Claude |
| 2026-04-27 (late evening) | Supabase signup-config hardening — disabled "Prevent use of leaked passwords" (was rejecting common test passwords with silent 422), lowered Minimum password length 8 → 6 to match the AuthScreen client check. Both changes are reversible from the dashboard (queued in V15-CHECKLIST.md §2 "Post-v15 — Supabase Production Hardening" to re-enable after public launch). | Barak + Claude |
| 2026-04-28 (overnight batch) | DB: hardened `handle_new_user()` trigger with username-collision-safe candidate resolution — pre-computes a unique username via UUID-suffix loop with a timestamp fallback, so signups never crash on `app_profiles.username` UNIQUE. Code: split the GPS sync write in `HomeScreen.syncLiveCityFromGPS` so `last_active_at` (presence ping) fires on every tick regardless of whether the resolved city changed — fixes the "Eli disappears from People list because he's been in Tel Aviv all day" bug introduced by commit c9b3d64's 24h active-presence filter. ProfileScreen.handleAvatarPress now calls `bustAvatar()` from AvatarContext after a successful upload so map markers, People list, and Chat headers refetch the new image instead of serving the cached old URL. i18n cleanup batch — added 30 new keys (people.*, snooze.*, chat.staySafe*, flightDetail.title, groupInfo.*) across en/he/ru and replaced the corresponding hardcoded strings in PeopleScreen/ChatScreen/FlightDetailScreen/GroupInfoScreen. All four changes JS/DB only — ship in the same EAS Update batch with the marker + zoom + auth UX changes from earlier today. | Barak + Claude |
