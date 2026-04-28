# Google Play Closed Testing — Submission State of Truth

> **Single source of truth for Google Play status as of 2026-04-25 10:12 IDT.**
> If a future Claude session is asked anything about the Play Console submission,
> read THIS file first. Anything below is what we shipped. Anything not here was
> not done.

**Status:** ✅ **SUBMITTED — 12 changes under Google review.**
**Submitted:** 2026-04-25 (after 2-day sprint, 24-25 April 2026)
**Track:** Alpha (Closed Testing)
**Version code:** 8 (versionName 1.0.0)
**Decision expected:** 24 hours – 7 days (typical: 1–2 days)
**Notification email:** `barakperez@gmail.com`

---

## TL;DR — Where to look for what

| If you need to… | Look at |
|---|---|
| The complete Play account / IDs / addresses | `docs/accounts-private.md` |
| Tester recruitment messages (3 templates × 2 langs) | `docs/play-tester-recruitment.md` |
| Reviewer demo account spec (for App Review) | `docs/reviewer-demo-account.md` |
| Apple submission state (separate, pending uncle access) | `docs/apple-compliance-audit.md` |
| Original full submission plan (pre-execution) | `docs/google-play-submission.md` |
| THIS file | What actually got shipped + what we're waiting on |

---

## 1. Account / Identity

| Field | Value |
|---|---|
| Account type | **Personal** (not company) |
| Developer account ID | `6700370044457273942` |
| App ID (internal) | `4972661267015236694` |
| Package name | `com.nomadspeople.app` |
| Account owner login (Google) | `shospeople@gmail.com` |
| **Notification contact email** | **`barakperez@gmail.com`** ← Google sends review decisions here |
| Public developer email (Store) | `nomadspeople1@gmail.com` |
| Public contact email (in-Store details) | `nomadspeople1@gmail.com` |
| Public website | `https://nomadspeople.com` |
| Developer legal name (back office) | חלף אייל / Halef Ayal |
| Developer address | יהודה הימית 40, Tel Aviv-Yafo, 6813446, Israel |
| Operational lead | Barak Perez (`+972547770094`) |

> ⚠️ Three emails, three jobs:
> - `shospeople@gmail.com` = LOGIN to Play Console.
> - `barakperez@gmail.com` = Where Google's review decisions arrive.
> - `nomadspeople1@gmail.com` = Public store-listing contact for users.

---

## 2. Build identity (what users will install)

| Field | Value |
|---|---|
| versionName | `1.0.0` |
| versionCode | **`8`** ← we used 7 first, Google rejected it as already-used (artifact of an earlier deleted draft), so EAS auto-bumped to 8 |
| AAB filename | `application-ecf3b28c-118e-4f94-a3c7-0d8f797df1dd.aab` (~16 MB update size; ~60 MB download artifact) |
| EAS Build ID | `ecf3b28c-118e-4f94-a3c7-0d8f797df1dd` |
| EAS Build URL | https://expo.dev/accounts/nomadspeople/projects/nomadspeople-app/builds/ecf3b28c-118e-4f94-a3c7-0d8f797df1dd |
| Git commit | `88623c5` — *"Fix: remove profile views, add location tracking, update settings"* |
| Expo SDK | 54.0.0 |
| Target Android API | SDK 36 |
| Min Android API | 24+ (Android 7.0) |
| ABIs | 4 (arm64-v8a, armeabi-v7a, x86, x86_64) |
| Screen sizes | 4 (small, normal, large, xlarge) |
| Required features | 5 |
| Signing | Google Play App Signing (key managed by Google) |
| EAS keystore alias | `Build Credentials 5A2MeSO5GZ (default)` |

**Bumping next version:** `eas.json` has `autoIncrement: true` for the production profile, so the next `eas build -p android --profile production` will automatically be versionCode 9. Don't manually edit `expo.android.versionCode` in `app.json`.

> Failed builds in EAS history (1.0.0 (2)–(6)) are noise from earlier debugging — only (7) and (8) were ever uploaded to Play Console; (7) is now in the bundle library but not attached to any release.

---

## 3. The 12 changes that are under Google review

These are the actual items submitted on 2026-04-25:

| # | Section | What we changed |
|---|---|---|
| 1 | Countries / Regions | Decoupled Alpha track from Production sync |
| 2 | Track status | Continued the track |
| 3 | Testers | Bound `nomadspeople-testers` email list to Alpha |
| 4 | Store listing pages (parent) | Marked "save for later" — children below contain the actual changes |
| 5 | en-US store listing | Added language (en-US), filled app name (`nomadspeople`), short desc, full desc, all required fields |
| 6 | App content (icon section header) | — |
| 7 | Content rating | Submitted IARC questionnaire — got rating issued |
| 8 | Target audience & content | Set age range to 18+ |
| 9 | Privacy policy URL | `https://nomadspeople.com/privacy` |
| 10 | Ads declaration | "App does NOT contain ads" |
| 11 | Data Safety | Filled the full questionnaire (all 12 sub-items below) |
| 12 | Store settings | App category = **Social Networks** (`רשתות חברתיות`) |

---

## 4. Data Safety — what we declared (12 sub-items)

We declared these **collected** (none shared with third parties):

**Personal info (3):**
- Name — Required, App functionality + Account management
- Email — Required, App functionality + Account management
- User IDs — Required, App functionality + Account management

**Location (2):**
- Approximate location — Required, App functionality
- Precise location — Required, App functionality

**Messages (1):**
- Other in-app messages — Required, App functionality

**Photos (1):**
- Photos — Required, App functionality (profile photo + checkin photo)

**App info & performance (2):**
- Crash logs — Required, Analytics + Fraud prevention
- Diagnostics — Required, Analytics + Fraud prevention

**App activity (2):**
- App interactions — Required, Analytics
- Other user-generated content — Required, App functionality

**Device or other IDs (1):**
- Device ID — Required, Analytics + Fraud prevention

**Step 2 answers:**
- Encrypted in transit: Yes
- Users can request data deletion: No (we have a full account-deletion flow but not a partial-deletion flow)

---

## 5. Store listing — what's live in the listing

| Field | Value |
|---|---|
| App name (en-US) | `nomadspeople` |
| Short description | (See `docs/app-store-metadata.md` for canonical copy) |
| Full description | "Initial release of nomadspeople. Find digital nomads near you, see who is in your neighborhood in real-time, join local activities and connect with people who get the lifestyle." (en-US, ~2,165 chars filled) |
| Icon | `assets/icon.png` (1024×1024, brand orange #E8614D) — 512×512 derivative is `assets/store/play-icon-512.png` |
| Feature graphic | `assets/store/play-feature-graphic.png` (1024×500) |
| Phone screenshots | **2 placeholders** generated 2026-04-25: `assets/store/screenshots/screenshot_1_map.png` + `screenshot_2_status.png` (both 1080×1920) |
| Tablet screenshots | None |

> ⚠️ The 2 phone screenshots are **branded mockups**, not real device screenshots. They satisfy Google's 2-image minimum so we could ship Closed Testing today. **Before opening Production**, replace them with 4+ real screenshots taken from a Samsung A07 (or any Android phone) running the actual app.

---

## 6. App Access (reviewer credentials)

For Google's reviewers if they need to log in:

| Field | Value |
|---|---|
| Email (alias) | `reviewer@nomadspeople.com` (forwards via ImprovMX → `nomadspeople1@gmail.com`) |
| Password | `FOjVcpuGsbrwTH4f9*rNgBcM` (also in `docs/accounts-private.md`) |
| Supabase auth user UUID | `571bfd43-cdf5-4935-99f7-5e4edf5b95ab` |
| Supabase profile name | `App Store Reviewer` (display: `Reviewer`) |
| Seeded check-in | Active check-in at Nahalat Binyamin, Tel Aviv (32.0720, 34.7714) |
| Note | If the active check-in expires (4-hour TTL via `pg_cron`), re-seed it before each review submission |

---

## 7. Closed Testing — Track configuration

| Field | Value |
|---|---|
| Track | Alpha (ID `4698687347033907974`) |
| Status | Active, draft awaiting Google review |
| Countries | Israel only (1 country) |
| Form factors | Phones, tablets, Chrome OS, Android XR |
| Tester source | Email list `nomadspeople-testers` (account-level, can be edited without re-review) |
| **Tester count** | **12** ✅ |
| Release notes (en-US) | "Initial release of nomadspeople. Find digital nomads near you, see who is in your neighborhood in real-time, join local activities and connect with people who get the lifestyle." |

### Tester list — `nomadspeople-testers` (12 emails)

| # | Name | Email | Notes |
|---|---|---|---|
| 1 | עוז וידל | `ozvidal@gmail.com` | |
| 2 | אתה (אמולטור) | `shospeople@gmail.com` | Same as account owner — uses Android emulator |
| 3 | כפיר פרץ | `Johnnybravo1477@gmail.com` | |
| 4 | יובל חלף | `yuvalhalaf1@gmail.com` | |
| 5 | ניר חלף | `Nirhalaf17@gmail.com` | |
| 6 | אורנה חלף | `Ornahalaf@gmail.com` | |
| 7 | דניס | `Ftr077@gmail.com` | |
| 8 | לין מלול | `lynnkfir@gmail.com` | |
| 9 | בת אל פרץ | `Batelsabag25@gmail.com` | |
| 10 | אלי | `Elisaidi74@gmail.com` | |
| 11 | שחר | `danoss2@gmail.com` | |
| 12 | מור חלף | `morreyal@gmail.com` | Samsung S21 — added 2026-04-25 |

**Rejected (need replacement before Production):**
- עלי — `Ate16051988@gmail.com` — Google said "this email address does not exist". Try a different Gmail with him; meanwhile we're at 12 with Mor.

> Once the test is live and any tester drops out, the count drops below 12 → re-add immediately. Production access requires 12 testers continuously opted-in for 14 days.

---

## 8. Policies & declarations submitted

All filled today:

| Declaration | Answer |
|---|---|
| Privacy policy URL | `https://nomadspeople.com/privacy` |
| Ads | **No ads** in the app |
| In-app purchases | None (nothing to declare for Q1) |
| Target audience | **18+ only** (no children) |
| Content rating (IARC) | Submitted, rating issued by IARC |
| App access (reviewer login) | Provided (see §6) |
| Government app | No |
| Financial features | None |
| Health features | None |
| Data Safety | Full questionnaire submitted (see §4) |
| Advertising ID (Android 13+) | **Does NOT use Advertising ID** |
| Children's safety standards | Standards URL = `https://nomadspeople.com/privacy`, contact = `barakperez@gmail.com`, both attestation checkboxes ticked (in-app reporting + legal compliance) |
| App category | **Social Networks** (`רשתות חברתיות`) |
| Public contact email | `nomadspeople1@gmail.com` |
| Public contact website | `https://nomadspeople.com` |

---

## 9. Known warning we accepted (NOT blocking)

**R8 / ProGuard mapping file (deobfuscation):**
A yellow warning saying we didn't upload a deobfuscation mapping file for the AAB. This means crash reports in Play Console won't be deobfuscated automatically — stack traces will look like `a.b.c()` instead of full class names. **Not blocking.** For Closed Testing this is fine because Sentry handles our crash visibility. To fix later: enable proguard mapping upload in `eas.json` or upload manually from the bundle's `mapping.txt`.

---

## 10. What's pending Google's side

After we hit "Submit for review":

1. **Quick checks (~13 min):** Automated policy/quality scan. If it finds something, the submission halts and shows up in `/publishing` for us to fix.
2. **Main review (1–7 days, typical 1–2 days):** Human or hybrid review. Outcomes:
   - **Approved** → AAB rolls out to the Alpha track. Tester invite link becomes active. Testers get an email from Google Play within hours.
   - **Rejected** → Google emails `barakperez@gmail.com` with the specific policy/issue. We fix in Play Console, re-submit.
3. **The tester invite link** lives at: Play Console → Testing → Closed testing → Alpha → **Testers** tab → "How can testers join your test" → copy URL. Right now this link is greyed-out / not yet generated.

### When approval lands — exact next steps

1. Open `barakperez@gmail.com` and confirm the approval email.
2. Go to: https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/tracks/4698687347033907974?tab=testers
3. Scroll to "איך בודקים יכולים להצטרף לבדיקה שלך" → click "העתקת הקישור".
4. Send Message #3 from `docs/play-tester-recruitment.md` to all 12 testers (WhatsApp / direct message), pasting the link in.
5. Track opt-ins (when they click the link they show up in Play Console statistics within ~30 min).
6. **The 14-day Production-access clock starts on the day the FIRST tester opts in**, not the day Google approves. So get all 12 to opt in within 24 hours of the approval to keep the clock tight.

---

## 11. What we did NOT do (deliberate scope cuts)

- **Real device screenshots** — using mockups for now (see §5). Replace before Production rollout.
- **In-app purchase products** — not configured (we don't sell anything yet).
- **Pre-registration** — not enabled.
- **Open testing track** — not configured (we're going Closed → Production directly).
- **Internal testing track** — exists but not used for this submission. Reserved for future fast-iteration with the Shos team.
- **Multilingual store listing** — only en-US. Hebrew + Russian translations exist in the app's `lib/translations/` but the store listing is English-only for the MVP.
- **Apple App Store** — separate flow, blocked on uncle's Apple Developer account access. Track in `docs/apple-compliance-audit.md`. iOS testers will be a different list / different process — the 12 testers above are Android only.
- **Google Group for testers** — not set up. Email list is fine for 12 people; Google Group would only matter if scaling past ~50.
- **Production access application** — locked until 14 continuous days with 12+ testers. Don't apply early.

---

## 12. Important infrastructure hooked into the submission

| Service | Purpose | Owner login |
|---|---|---|
| Supabase | Backend / DB / auth | `shospeople@gmail.com` (project `apzpxnkmuhcwmvmgisms`) |
| EAS / Expo | Builds | `nomadspeople1@gmail.com` (org `nomadspeople`) |
| Sentry | Crash + error monitoring | `nomadspeople1@gmail.com` |
| ImprovMX | `support@nomadspeople.com` + `reviewer@nomadspeople.com` aliases | `shospeople@gmail.com` |
| Vercel | Marketing site + `/privacy`, `/terms`, `/delete-account`, `/support`, `/admin` routes | (Lovable handed over to direct edits per repo CLAUDE.md) |
| GitHub | Source repo `flippermaps-hash/nomadspeople-app` | `flippermaps-hash` (recovery email separate, see Barak) |

---

## 13. If you need to make changes RIGHT NOW (while in review)

**Safe to change without re-review:**
- Tester email list (`nomadspeople-testers`) — add/remove members anytime.
- Countries (we're in Israel; adding more is a fresh release though).
- Store listing draft (saves silently; will be queued for a follow-up review).

**Will trigger a re-review:**
- Anything in the AAB (which means new build → new versionCode → re-upload).
- Privacy policy URL change.
- Data Safety answers.
- Content Rating answers.
- Target audience change.
- Adding new countries.

**Don't touch:**
- The current draft release while it's "in review" — wait for the verdict.
- Don't delete the draft release in `releases/1` mid-review (Google can cancel the review and you'd start over).

---

## 14. Open follow-ups (in priority order)

1. **Wait for Google verdict** (1–7 days) — check `barakperez@gmail.com` daily.
2. **On approval:** copy the testers link → send to all 12 → track opt-ins.
3. **Replace placeholder screenshots** with 4+ real device screenshots before Production rollout (target: Samsung A07).
4. **Find a real Gmail for עלי** to replace `Ate16051988@gmail.com` if we lose any of the 12 during the 14-day window.
5. **R8 mapping file** — set up deobfuscation upload in `eas.json` (low priority, only matters once we have real crashes).
6. **Apple submission** — separate track, see `docs/apple-compliance-audit.md`. Apple has its own reviewer flow (`reviewer@nomadspeople.com` works for both). The 12 Android testers do NOT carry over to TestFlight — Apple needs its own list.
7. **Day 14:** apply for Production access via Play Console → Production → Apply.

---

## 15. Time-stamp of this state

- Document created: 2026-04-25 10:12 IDT (Saturday)
- Last action in Play Console: Mor Halaf added to tester list (12/12)
- Submission timestamp (12 changes sent for review): ~2026-04-25 morning
- Earliest expected verdict: 2026-04-25 evening
- Latest expected verdict: 2026-05-02

---

## Appendix A — All Play Console URLs we used

| Page | URL |
|---|---|
| App dashboard | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/app-dashboard |
| Main store listing | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/main-store-listing |
| Bundle explorer | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/bundle-explorer-selector |
| App content (Data Safety etc.) | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/app-content |
| Data Safety | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/app-content/data-privacy-security |
| Content Rating | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/app-content/content-rating-overview |
| Ads ID declaration | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/app-content/ad-id-declaration |
| Children's safety | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/app-content/child-safety |
| Store settings (categories + contact) | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/store-settings |
| Closed Testing — Alpha | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/tracks/4698687347033907974 |
| Alpha Testers tab | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/tracks/4698687347033907974?tab=testers |
| Publishing summary | https://play.google.com/console/u/0/developers/6700370044457273942/app/4972661267015236694/publishing |

---

## Appendix B — How to onboard a future Claude session quickly

> If a future Claude is asked "what's the state of Google Play submission?", point it here:
>
> 1. Read `docs/launch/2026-04-25-google-play-submission-state.md` (this file).
> 2. Read `docs/accounts-private.md` for the exact credentials and IDs.
> 3. Read `docs/play-tester-recruitment.md` for the messages to send testers.
> 4. Read `docs/google-play-submission.md` for the original (pre-submission) plan, only if the question is about decisions that were made.
>
> Together those 4 files describe the entire Play Console state of the project.
