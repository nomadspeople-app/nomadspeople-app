═══════════════════════════════════
📄 docs/2026-04-22-apple-google-signin.md
═══════════════════════════════════

# 2026-04-22 — Apple + Google Sign-In Setup Guide

**Status:** client code landed · server-side setup pending · not yet
enabled in production. Flip `extra.auth.appleEnabled` /
`googleEnabled` in `app.json` to `true` ONLY after every checkbox
below is ticked.

---

## Why we're adding this

Apple App Store Review Guideline 4.8 does NOT require Sign in with
Apple when the app uses email/password only. It DOES require it as
soon as we add any other social login (Google, Facebook, …). So if
we want Google, Apple comes along with it.

The bigger reason is pragmatic: Magic Link / email-password signup
loses ~40-50 % of would-be users to friction. Apple and Google
one-taps land ~70-85 %. That's worth half a day of setup.

A secondary benefit: App Store and Play Store reviewers can sign in
with their own Apple ID / Google account, so we don't have to ship
demo credentials.

---

## What's already in the repo (done without credentials)

| File | What changed |
|---|---|
| `package.json` | Added `expo-apple-authentication ~55.0.13` and `@react-native-google-signin/google-signin ^16.1.2` |
| `app.json` → `ios.usesAppleSignIn` | Set to `true` — Expo will add the entitlement on build |
| `app.json` → `plugins` | Added `expo-apple-authentication` and `@react-native-google-signin/google-signin` (with a placeholder `iosUrlScheme` that gets replaced in step 2 below) |
| `app.json` → `extra.auth` | Feature flags: `appleEnabled`, `googleEnabled`, `googleWebClientId`, `googleIosClientId`. All default to disabled until the steps below are finished. |
| `lib/auth.ts` | New exports: `isAppleSignInEnabled`, `isGoogleSignInEnabled`, `signInWithApple()`, `signInWithGoogle()`. Both lazy-import the native SDK, call Supabase `signInWithIdToken`, handle cancel-by-user silently. |
| `screens/AuthScreen.tsx` | Renders two branded buttons (black Apple, white Google with border) + "or" divider ABOVE the email form — but ONLY when the feature flag says the provider is active. Default is nothing rendered, nothing broken. |

Mobile `tsc --noEmit`: clean. Nothing changes in production until the
flags below are flipped.

---

## 1 — Google Cloud Console (doable with Barak's own Google account)

Goal: three OAuth 2.0 Client IDs (iOS, Android, Web).

1. Go to https://console.cloud.google.com/ (sign in with the account
   that will own the app's Google integration — can be Barak's, does
   not need to be the uncle's Apple Developer account).
2. Create a new project named `nomadspeople` (or select an existing
   one).
3. **APIs & Services → OAuth consent screen**
   - User type: External.
   - App name: `nomadspeople`.
   - User support email: `support@nomadspeople.com`.
   - App logo: upload `assets/icon.png`.
   - App domain: `nomadspeople.com`.
   - Privacy URL: `https://nomadspeople.com/privacy`.
   - Terms URL: `https://nomadspeople.com/terms`.
   - Scopes: `email`, `profile`, `openid`.
   - Save.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - **Web** client — name: `nomadspeople-web`.
     Authorized redirect URI:
     `https://apzpxnkmuhcwmvmgisms.supabase.co/auth/v1/callback`.
     Save. Copy the **Client ID** AND **Client Secret** — these go
     into Supabase in step 3.
   - **iOS** client — name: `nomadspeople-ios`.
     Bundle ID: `com.nomadspeople.app`.
     Save. Copy the **Client ID** — goes into `app.json` below.
   - **Android** client — name: `nomadspeople-android`.
     Package name: `com.nomadspeople.app`.
     SHA-1 fingerprint: get it with
     `eas credentials -p android` after we've run one EAS build;
     until then skip the Android client and revisit.

---

## 2 — `app.json` — inject the Google Client IDs

Replace the placeholder in `app.json` with the real iOS client ID.
The iOS URL scheme format is the iOS Client ID **reversed** — e.g.
client ID `1234-abcd.apps.googleusercontent.com` becomes URL scheme
`com.googleusercontent.apps.1234-abcd`.

```json
"plugins": [
  ...
  [
    "@react-native-google-signin/google-signin",
    { "iosUrlScheme": "com.googleusercontent.apps.<REVERSED_IOS_CLIENT_ID>" }
  ],
  ...
]
```

In `extra.auth`:
- `googleWebClientId`: the **Web** Client ID (ends with
  `.apps.googleusercontent.com`).
- `googleIosClientId`: the **iOS** Client ID.

Leave `googleEnabled` at `false` for now — we flip it at the end.

---

## 3 — Supabase Dashboard — Google Provider

1. https://supabase.com/dashboard/project/apzpxnkmuhcwmvmgisms/auth/providers
2. Enable **Google**.
3. Paste the **Web** Client ID and **Web** Client Secret from step 1.
4. Authorized Client IDs (comma-separated, this is the field that
   lets native-login ID tokens verify): include BOTH the iOS Client
   ID and the Web Client ID.
5. Save.

---

## 4 — Apple Developer Console (requires the uncle's account)

Call the uncle when we reach this step. ~30 minutes.

1. Sign in to https://developer.apple.com/account → Certificates, IDs
   & Profiles.
2. **Identifiers → App IDs → com.nomadspeople.app** (create if it
   doesn't exist). Tick **Sign in with Apple**. Save.
3. **Identifiers → Services IDs → +** — create new:
   - Description: `nomadspeople Sign In`.
   - Identifier: `com.nomadspeople.app.signin` (or similar — must NOT
     match the App ID).
   - Enable **Sign in with Apple**. Configure:
     - Primary App ID: `com.nomadspeople.app`.
     - Return URLs:
       `https://apzpxnkmuhcwmvmgisms.supabase.co/auth/v1/callback`.
   - Save.
4. **Keys → +** — create new:
   - Name: `nomadspeople Apple Sign In Key`.
   - Tick **Sign in with Apple**. Configure → Primary App ID →
     `com.nomadspeople.app`.
   - Save → DOWNLOAD the `.p8` file (you only get ONE chance to
     download it, keep it safe).
   - Note the **Key ID** (visible next to the key name).
5. Note the **Team ID** (top-right of the developer account, format:
   10-character alphanumeric).

You now have:
- Services ID: `com.nomadspeople.app.signin`
- Team ID: `XXXXXXXXXX`
- Key ID: `XXXXXXXXXX`
- `.p8` file contents

---

## 5 — Supabase Dashboard — Apple Provider

1. Same URL as step 3.
2. Enable **Apple**.
3. Fill in:
   - Client ID (Services ID): `com.nomadspeople.app.signin`
   - Secret Key: Supabase will generate a JWT for you if you paste the
     **.p8 contents + Team ID + Key ID**. (Or you can pre-generate a
     JWT yourself and paste that — Supabase accepts either.)
4. Save.

---

## 6 — Flip the feature flags

In `app.json`:

```json
"extra": {
  "auth": {
    "appleEnabled": true,
    "googleEnabled": true,
    "googleWebClientId": "...apps.googleusercontent.com",
    "googleIosClientId": "...apps.googleusercontent.com"
  }
}
```

Commit → push → rebuild via EAS:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Install the dev build on your test device. Open AuthScreen — the two
buttons now appear above the email form. Tap one → the native sheet
opens → you land inside the app.

---

## 7 — Add to store submission checklists

Once production-enabled:

- **App Store Connect → App Review Information → Demo Account**:
  leave empty. Add a note in "Notes for reviewer":
  > "Sign in with Apple is available on the first screen. Reviewers
  > can use their Apple ID; a session will be created automatically
  > and will have full access to the app."
- **Play Console → Data safety**: update the data types section to
  include "Name" and "Email" collected via Google Sign-In.

---

## Rollback

If a serious issue appears after flipping the flags:

```json
"appleEnabled": false,
"googleEnabled": false
```

Commit + rebuild. The buttons disappear, the email form stays intact,
existing sessions are unaffected. No data migration required.

═══════════════════════════════════
📄 docs/apple-compliance-audit.md
═══════════════════════════════════

# Apple App Store — Deep Compliance Audit (2026)

**Date:** 2026-04-23
**Sources:** Verified against live Apple Developer docs, Expo changelog, and 2026 policy updates
**Conclusion at the top:** We have **4 critical items to handle** before App Store submission. None are showstoppers, but each can cause rejection if skipped.

---

## Executive summary

| Category | Status | Action needed |
|---|---|---|
| Xcode 26 / iOS 26 SDK (Apr 28 deadline) | ✅ Compliant | Expo SDK 54 + EAS cloud build default to Xcode 26 |
| Sign in with Apple (Guideline 4.8) | ⚠️ Scaffolded, not activated | Uncle call to create Services ID + .p8, activate flag |
| Privacy Manifest (since May 2024) | ⚠️ Auto-handled by Expo, unverified | Test with EAS iOS build; check for dup PrivacyInfo errors |
| Age Rating (new 2026 system, deadline Jan 31) | ❌ Not answered | Answer new age questions in App Store Connect before submit |
| EU Trader Status (since Feb 2025) | ❌ Not declared | Declare in App Store Connect before submission to EU |
| UGC moderation (Guideline 1.2) | ✅ Compliant | Block, report, moderation events table, 24h SLA all live |
| Account deletion (5.1.1(v)) | ✅ Compliant | In-app Settings + nomadspeople.com/delete-account |
| Privacy Policy + Data Safety | ✅ Live | nomadspeople.com/privacy, answers drafted |
| Demo account for Review | ⚠️ Not created | Create dedicated demo account before submit |
| Screenshots from real iOS | ❌ Not captured | Need Xcode Simulator or iPhone physical device |

---

## 1. Xcode / iOS SDK version (CRITICAL deadline)

**Apple's rule:** Starting **April 28, 2026**, all new App Store submissions must be built with **Xcode 26 and iOS 26 SDK**. Apple jumped from Xcode 16 directly to Xcode 26 (year-based naming).

**Our state:**
- Expo SDK 54 (in our `package.json`)
- Expo SDK 54 **explicitly supports iOS 26 and Xcode 26** (per Expo changelog)
- EAS Build's cloud pipeline **defaults to Xcode 26** for SDK 54 projects without explicit image
- Our `eas.json` production profile does not override the image → uses default = Xcode 26

**Verdict:** ✅ **Compliant.** The next EAS iOS build will use Xcode 26 + iOS 26 SDK automatically. No code changes needed. Apple will accept the submission.

Only catch: if Apple later bumps to Xcode 27 / iOS 27 and we don't upgrade Expo SDK, we'd be blocked. Not a 2026 issue.

---

## 2. Sign in with Apple — Guideline 4.8 (NUANCE from 2024)

**Apple revised the rule in January 2024.** Before: if you used any third-party login (Google, Facebook), you HAD to offer Sign in with Apple. Now: you must offer an "equivalent privacy-focused option" — which includes Sign in with Apple, OR any login that:

1. Limits data collection to name + email
2. Allows user to keep email private
3. Does not collect app interactions for advertising without consent

**Our state:**
- Google Sign-In enabled ✅
- Email magic link + password ✅
- Sign in with Apple scaffolded but flag `appleEnabled: false` ⚠️

**Risk analysis:** Apple's revised rule might mean Google Sign-In alone (with proper privacy config) is enough. But:
- Reviewers are inconsistent — some still flag this during review
- Our privacy config with Google is technically fine (Google allows email-hide per OAuth config) but demonstrating this to a reviewer during review is tricky
- Adding Sign in with Apple is the SAFER path — zero chance of rejection under 4.8

**Recommendation:** Activate Sign in with Apple before submission. We already have the client code — just need uncle's 45-min call to generate Services ID + .p8, paste into Supabase, flip `appleEnabled: true` in `app.json`, rebuild.

**Verdict:** ⚠️ Rejection-proof approach = activate. We have the plan in `docs/2026-04-22-apple-google-signin.md`.

---

## 3. Privacy Manifest — PrivacyInfo.xcprivacy

**Apple's rule since May 2024:** Every iOS app must include a `PrivacyInfo.xcprivacy` file declaring:
- Which "Required Reason APIs" the app uses (UserDefaults, file timestamp, disk space, active keyboard, system boot time)
- Privacy tracking data types
- Data collection types

**Our state:**
- Expo SDK 54 auto-includes PrivacyInfo files for its own packages ✅
- Our `app.json` does NOT have an explicit `ios.privacyManifests` section ⚠️
- We use `@react-native-async-storage/async-storage` which accesses UserDefaults — but the package itself should include a PrivacyInfo

**Potential risks:**
- If EAS build produces a single PrivacyInfo that's missing a required declaration → App Store reject
- If multiple packages each include their own PrivacyInfo → duplicate-file error during Xcode build

**Verdict:** ⚠️ Untested. The fix:
1. Let EAS iOS build #1 run
2. If it succeeds — we're fine, Expo handled everything
3. If it fails with "Multiple commands produce PrivacyInfo.xcprivacy" or "Missing Required Reason" — we add explicit `ios.privacyManifests` to `app.json`

Since build #5 of Android is still queued, we haven't tried iOS yet. Will know on first iOS build.

---

## 4. Age Rating — NEW system with DEADLINE PASSED ⚠️

**Apple updated the rating system in July 2025** — added 13+, 16+, 18+ (previously only 4+, 9+, 12+, 17+).

**Critical deadline:** By **January 31, 2026**, all developers had to answer new age rating questions for existing apps. Past that date, app updates are blocked until questions are answered.

**Our state:** We don't have an App Store Connect app record yet (the uncle hasn't paid $99 + created one). When we do create it, we'll be asked the new questions at creation time.

**Expected rating for nomadspeople:** **17+ or 18+** (based on social features + UGC chat + photos + location sharing).

**Our IARC-style answers** (from `docs/app-store-metadata.md`):
- Violence: None ✅
- Sexual content: None ✅
- Drugs/alcohol: None ✅
- User-generated content: Yes
- Users can communicate: Yes
- Location sharing: Yes

**Under the new Apple system,** our answers lead to 17+ (primarily due to UGC + unrestricted communication). We've been drafting for "Teen / 13+" earlier — need to update expectations to 17+.

**Verdict:** ❌ Need to answer the new questions at App Store Connect record creation time. Not hard, but non-negotiable.

---

## 5. EU Trader Status (Digital Services Act)

**Apple's rule since February 17, 2025:** All developers distributing apps in the EU must declare Trader or Non-Trader status. Apps without declaration are **removed from EU App Store**.

**Trader requirement:** If you develop commercially (for business purposes), you're a Trader. Must provide:
- Public business address
- Public phone number
- Public email address

**All three shown on App Store product page in EU.**

**Our state:** nomadspeople is a commercial app (not a hobby). We're a Trader.

**Implications:**
- Uncle's Apple Developer account details become public in EU App Store
- If uncle's personal address shows, that's a privacy concern
- Better to use a business address (Shos company address?) and `support@nomadspeople.com` + business phone

**Verdict:** ❌ Must declare in App Store Connect before submission. Decide what contact info is shown publicly.

---

## 6. UGC Moderation — Guideline 1.2 (we PASS)

**Apple's requirement:** Apps with UGC need:
- Filter for objectionable content
- Report mechanism
- Block abusive users
- Published contact info

**Our state:**
- `app_reports` + `app_message_reports` tables ✅
- Long-press → Report menu in ChatScreen ✅
- `app_blocks` table + hooks filter blocked users ✅
- Creator can kick members (`removeGroupMember`) ✅
- Pre-send content filter in `postEventSystemMessage` ✅
- Supabase trigger logs to `app_moderation_events` ✅
- Sentry alerts on reports (24h SLA, tag `report:moderation`) ✅
- Community guidelines at `/terms` and in-app ✅
- Support contact: `support@nomadspeople.com` ✅

**Verdict:** ✅ **Fully compliant.** More robust than most 2-person apps.

---

## 7. Account Deletion — Guideline 5.1.1(v) (we PASS)

**Apple's requirement:** Any app that lets users create accounts must offer in-app deletion that also wipes data.

**Our state:**
- In-app: Settings → Delete Account → magic link confirmation → full deletion
- Web: `nomadspeople.com/delete-account` (shared code via `lib/accountDeletion.ts`)
- Deletion cascades through all tables (covered in migration + RLS)

**Verdict:** ✅ **Fully compliant.**

---

## 8. Privacy Policy + Data Safety (we PASS)

**Our state:**
- Privacy Policy live: `nomadspeople.com/privacy` (v2026-04-22)
- Version tracked in `app_profiles.privacy_version_accepted`
- Consent audit log: `app_consent_events`
- Data Safety answers drafted (see `docs/google-play-submission.md` §3)
- Apple Privacy Nutrition Labels drafted (see `docs/app-store-metadata.md`)
- GDPR: data in Frankfurt (Supabase + Sentry EU regions)
- DPA-ready: 10 sub-processors listed in privacy policy

**Verdict:** ✅ **Fully compliant.**

---

## 9. Demo Account for App Review

**Apple's requirement:** Apps requiring login must provide demo credentials in App Review Information:
- Username / email
- Password
- Notes for reviewer

**Our state:** Not created yet. ⚠️

**Recommendation:** Create a dedicated account:
- Email: `reviewer@nomadspeople.com` (set up alias → forwards to `shospeople@gmail.com`)
- Password: strong, stored in 1Password
- Pre-populate with Tel Aviv location, 1 check-in, 2 chat messages with mock contacts

**Reviewer notes template** (Hebrew, for our records):
```
Hi Apple Review team,

The app requires location access to place the user on the map. Use the demo account below to sign in:

Email: reviewer@nomadspeople.com
Password: [set before submit]

The account is pre-positioned in Tel Aviv with one sample check-in. You can browse other mock nomads on the map, tap their profile, and test the chat.

Sign in options: "Sign in with Apple" is on the first screen (recommended for testing).

If you have questions, please reach us at support@nomadspeople.com. We typically respond within 24 hours.
```

**Verdict:** ❌ Create before submit. 30 min work.

---

## 10. Screenshots — must be from iOS, not emulator

**Apple's rule:** Screenshots must be real-device or iOS Simulator captures, at specific sizes:
- 6.9" Display (iPhone 16 Pro Max, 1320×2868)
- 6.5" Display (iPhone 14+, 1284×2778) — REQUIRED
- 5.5" Display (iPhone 8 Plus, 1242×2208) — REQUIRED

Android emulator screenshots CANNOT be used.

**Our state:** We don't have any iOS screenshots yet. Android emulator screenshots are for Play Store only.

**Options:**
1. **Xcode Simulator on uncle's Mac** — free, easy, produces Apple-accepted sizes
2. **Xcode Simulator on our Mac** — requires Xcode install (~15 GB)
3. **Physical iPhone** — if accessible

**Verdict:** ❌ Need iOS screenshots before submit. Can be done after EAS iOS build in Simulator.

---

## 11. Enhanced Developer Verification (2024+)

**Apple may ask for:** government ID upload, phone verification, 2FA.

**For the uncle's account:** this should already be complete if the $99 was paid. If the account is new, additional verification may add 24-72 hours.

**Verdict:** depends on uncle's account age. Old account = already verified.

---

## 12. Distribution Certificate + Provisioning Profile

**Apple's requirement:** iOS apps must be signed with a Distribution Certificate (annual, renewed via Apple Developer), and use a Provisioning Profile matching the bundle identifier.

**Our state:** EAS handles this automatically. When we run `eas build -p ios --profile production`, EAS:
- Uses remote iOS credentials (Apple Developer account)
- Generates cert + profile on-demand
- Signs the IPA before upload

**Verdict:** ✅ Automated via EAS.

---

## 13. What rejection looks like

**If Apple rejects the app,** the rejection email specifies:
- The exact guideline number (e.g., "Guideline 2.1 - App Completeness")
- A screenshot or description of the issue
- A link to Resolution Center for communication

**Common first-submit rejection reasons for social apps:**
1. **Guideline 2.1** — feature doesn't work (e.g., sign-in flow fails on reviewer's device)
2. **Guideline 4.8** — Sign in with Apple missing
3. **Guideline 2.3.1 or 2.3.10** — screenshots don't match app
4. **Guideline 1.2** — UGC moderation incomplete (unlikely for us)
5. **Guideline 5.1.1** — privacy policy mentions data we don't collect or vice versa

**Typical timeline:**
- First submit: 24-48 hours for first review
- If rejected: fix + resubmit → 24-48 hours again
- Most apps reach approval by 2nd or 3rd submission

**Our estimated timeline:**
- **Best case:** 3-5 days from submission to live (if first submit passes)
- **Typical:** 7-10 days (1 rejection cycle)
- **Worst:** 14-20 days (2 rejection cycles)

---

## Action list before iOS submission

### Critical (must do)
1. **Uncle pays $99** + completes identity verification (24-48h wait)
2. **Uncle call** to create Services ID + .p8 (45 min)
3. **Activate Sign in with Apple** — `appleEnabled: true`, rebuild via EAS
4. **Answer new age rating questions** in App Store Connect (expect 17+)
5. **Declare EU Trader Status** with business contact info
6. **Create demo account** (reviewer@nomadspeople.com + password)
7. **Capture iOS screenshots** (Simulator or physical device)
8. **Run EAS iOS build** — will also validate Privacy Manifest

### Before submit (nice to have)
- Create `reviewer@` email alias via ImprovMX
- Record a 30-second screen recording of the app (App Previews — optional asset)
- Test Sign in with Apple flow on a real Apple device

### After submit
- Monitor email from Apple
- Respond within 24h to any Resolution Center messages
- Don't submit multiple times — iterate based on reviewer feedback

---

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-04-23 | Created — deep audit with verified 2026 requirements | Claude (after user's pushback) |

## Sources

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)
- [Apple Privacy Manifest docs](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [EU DSA Trader Status](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
- [Apple Age Rating Updates 2026](https://developer.apple.com/news/upcoming-requirements/?id=07242025a)
- [Sign in with Apple rule change 2024](https://9to5mac.com/2024/01/27/sign-in-with-apple-rules-app-store/)

═══════════════════════════════════
📄 docs/apple-screenshot-guide.md
═══════════════════════════════════

# Apple App Store — Screenshot Capture Guide

**For:** `nomadspeople` v1.0.0 submission to App Store Connect
**Target:** 8 portrait screenshots at required iPhone sizes.

This complements `docs/google-play-screenshots-guide.md` — the *content* of the 8 shots is nearly identical, but Apple requires different dimensions and rejects Android emulator captures.

---

## Required iPhone sizes (Apple submission — Spring 2026)

Apple accepts screenshots at several display sizes, but **submitting at the largest current size auto-covers smaller devices** (Apple downscales). As of 2026:

| Display | Resolution (portrait) | Required for v1.0? |
|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | **1320 × 2868** | ✅ REQUIRED |
| iPhone 6.5" (iPhone XS Max / 14 Plus) | **1284 × 2778** | ✅ REQUIRED |
| iPhone 5.5" (iPhone 8 Plus — legacy) | **1242 × 2208** | ⚠️ still required for some submissions |

**Easiest path:** capture at 1320×2868 on the 6.9" simulator — that version is required and covers larger devices. For the other sizes, either capture separately or use an image editor to pad/resize.

Apple rejects screenshots that are **blurry, stretched, or at the wrong aspect ratio**. Don't upscale from a smaller source.

---

## Setup — Xcode Simulator (30 min one-time)

Since we don't have a physical iPhone, Xcode Simulator on a Mac is the path.

### Step 1 — Install Xcode

Xcode is free but huge (~15 GB). Download:

1. **Mac App Store → Xcode → Get.** Takes 30–60 min depending on connection.
2. After install, open Xcode once, agree to the license.
3. First-run SDK download (~5–10 min).

### Step 2 — Install iPhone 16 Pro Max simulator

1. Xcode → Settings → Platforms
2. Look for **iOS 26.x** row — download it if not present (~5 GB, one-time).
3. Close Settings.

### Step 3 — Launch a simulator

- Xcode → Open Developer Tool → Simulator
- Simulator → File → New Simulator → select **iPhone 16 Pro Max** + **iOS 26.x** → Create
- The simulator appears. Resolution is correct for 1320×2868 captures (via Simulator's hidden high-res capture mode).

---

## Installing the app on the simulator

Once EAS iOS build produces an IPA, we can install it on the simulator. BUT — normal EAS production builds are for REAL devices (arm64), which don't run on simulator (x86_64 intel macs) or Apple silicon simulator (arm64 simulator slice).

Two options:

### Option A — EAS preview profile for simulator builds

Add a new profile to `eas.json` (requires iOS simulator slice):

```json
"preview-sim": {
  "distribution": "internal",
  "ios": {
    "simulator": true
  }
}
```

Then: `eas build -p ios --profile preview-sim` → produces a `.tar.gz` with an `.app` file for the simulator. Drag the `.app` onto the running simulator. The app installs.

### Option B — Run from Xcode locally (needs full project)

Expo prebuild: `npx expo prebuild -p ios` → generates an `ios/` folder. Open `ios/nomadspeople.xcworkspace` in Xcode → Select the simulator target → ⌘R Run. The app compiles and runs. This gives full dev-loop including debugging.

**For screenshots: Option A is easier.** Option B is for if we need real-device debugging.

---

## The 8 screenshots (same as Play Store, different sizes)

Follow the same scene descriptions as in `docs/google-play-screenshots-guide.md` §The 8 screenshots. Scenes are:

1. **Hero — Home map with nomads visible** — 6-10 visible pins, city search bar shows "Tel Aviv, Israel", vibe bar lit.
2. **Nomads list with geo-blur** — sheet open, 15+ nomads, blur after 8 if foreign-view.
3. **Live activity pin + Activity detail sheet** — Join button visible.
4. **Profile with DNA + social links** — avatar, bio, tags, Instagram/LinkedIn icons.
5. **Group chat with image + date divider** — text + image + "Today" pill.
6. **CreationBubble (Plus button tapped)** — WHERE step on map OR WHAT step with text input.
7. **Pulse / Messages inbox** — 4–6 conversations, mix of 1:1 + groups, unread badges.
8. **Settings — Show on map toggle** — privacy-first signal.

---

## Capturing in the Xcode Simulator

1. Set up the simulator state per scene (login, navigate, etc.)
2. **⌘S** or Simulator → File → Save Screen (Cmd+S on keyboard)
3. Screenshot lands in `~/Desktop/Simulator Screen Shot - iPhone 16 Pro Max - [timestamp].png`
4. Move to `assets/store/ios-screenshots/` with names:
   - `ios-01-home-map.png`
   - `ios-02-nomads-list.png`
   - `ios-03-activity-pin.png`
   - `ios-04-profile.png`
   - `ios-05-chat-group.png`
   - `ios-06-create-checkin.png`
   - `ios-07-messages-inbox.png`
   - `ios-08-settings-visibility.png`

---

## Verifying size

```bash
cd assets/store/ios-screenshots
for f in *.png; do
  sips -g pixelWidth -g pixelHeight "$f"
done
```

Each must be **1320 × 2868** (iPhone 16 Pro Max portrait). If Xcode Simulator captures at a smaller size, use `sips -z 2868 1320 *.png` to scale — but only if they're the right aspect ratio (1:2.17).

---

## What Apple rejects

- **Mock / fake content** — "Lorem ipsum", test names like "John Doe", placeholder avatars
- **Stretched or blurry** images
- **Bad aspect ratio** — Apple rejects if ratio is off by > 1%
- **Other apps' branding** in background (banks, social networks, etc.)
- **Text that doesn't match the app** — if your screenshot shows features you don't actually ship
- **Device frames** — don't add iPhone frames; Apple puts its own

---

## Pro tip — lead with the map

Screenshots 1 and 2 get 90 % of the browser's attention on the App Store listing. Your map screenshot with real nomad faces on it is the most important asset in the entire submission. Take 3–4 alternate versions and pick the best.

═══════════════════════════════════
📄 docs/reviewer-demo-account.md
═══════════════════════════════════

# Reviewer Demo Account — Spec

**For:** Apple App Review + Google Play Review
**Purpose:** Both stores' review teams manually open the app and need credentials to sign in. Our app requires auth for anything useful, so without a demo account the reviewer cannot exercise the core flows — and they reject.

This document specifies the demo account we'll create **after** App Store Connect / Play Console app records exist. The spec is written now so the moment we have access, we just follow the recipe.

---

## Credentials

| Field | Value |
|---|---|
| Email | `reviewer@nomadspeople.com` |
| Password | (generate strong, 24 chars, store in 1Password as "nomadspeople — reviewer demo") |
| Display name | `App Store Reviewer` |
| Date of birth (for age gate) | 1990-01-01 (makes them 35+ in 2026 — well above 18) |
| Location (simulated) | Tel Aviv, Israel (32.0853° N, 34.7818° E) |

## Setting up the email alias

`reviewer@nomadspeople.com` is not a real mailbox — it's an alias that forwards to `shospeople@gmail.com` via ImprovMX. To create:

1. Log in to ImprovMX dashboard (shospeople@gmail.com)
2. Add alias: `reviewer@nomadspeople.com` → `shospeople@gmail.com`
3. Verify by sending a test email from outside

This way Apple/Google's password reset emails or magic-link verifications go to your Gmail.

---

## Pre-populate the account (for reviewer UX)

A fresh account with nothing to do = reviewer scrolls an empty map and rejects for "app does not function as described". We need to seed the account with minimal demo data so the reviewer sees a working product on sign-in.

### What to seed (before first review submission):

1. **Profile:**
   - Full name: "App Store Reviewer"
   - Display name: "Reviewer"
   - Bio: "Checking out nomadspeople for review"
   - Avatar: upload a placeholder (can be the app icon)
   - Current city: "Tel Aviv, Israel"
   - Location: set via `last_location_latitude: 32.0853, last_location_longitude: 34.7818` in `app_profiles`
   - `show_on_map: true`

2. **One active check-in** (so the map isn't empty):
   - Activity text: "Reviewing the app at a café"
   - Status emoji: ☕
   - Location: Nahalat Binyamin, Tel Aviv
   - Expires in 4 hours from seeding (fresh each submission)

3. **One conversation with a mock friend:**
   - Create a second seed user "nomad-friend@nomadspeople.com" (never logged in, just a data target)
   - Start a DM between them
   - 3 messages: "hey! welcome to nomadspeople", "thanks!", "let me know if you find my pin"

4. **Nearby nomads on the map:**
   - Our existing live users should already be visible on the map
   - Bonus: if map is empty, seed 4-5 pinned users around Tel Aviv temporarily

### Seed procedure (run as SQL in Supabase Dashboard when needed):

```sql
-- 1. Create the reviewer auth user (via Supabase Auth UI, not SQL)
-- Manually: Dashboard → Auth → Users → Add user → email reviewer@nomadspeople.com + password

-- 2. Insert profile (replace {REVIEWER_UUID} after step 1)
INSERT INTO app_profiles (
  user_id, full_name, display_name, bio,
  avatar_url, current_city, country_code,
  last_location_latitude, last_location_longitude,
  show_on_map, visibility, creator_tag, is_premium,
  terms_accepted_at, terms_version_accepted,
  privacy_accepted_at, privacy_version_accepted,
  onboarding_done
) VALUES (
  '{REVIEWER_UUID}',
  'App Store Reviewer',
  'Reviewer',
  'Checking out nomadspeople for review',
  NULL,
  'Tel Aviv',
  'IL',
  32.0853, 34.7818,
  true, 'public', false, false,
  now(), '2026-04-22',
  now(), '2026-04-22',
  true
);

-- 3. Insert a fresh check-in (run before each submission so expires_at is fresh)
INSERT INTO app_checkins (
  user_id, activity_text, status_emoji,
  latitude, longitude, location_name, city,
  is_active, checkin_type, expires_at, checked_in_at
) VALUES (
  '{REVIEWER_UUID}',
  'Reviewing the app at a café',
  '☕',
  32.0720, 34.7714, 'Nahalat Binyamin, Tel Aviv', 'Tel Aviv',
  true, 'status', now() + interval '4 hours', now()
);
```

---

## Apple App Review — what goes into App Store Connect

In App Store Connect → Version → **App Review Information**:

### Sign-in required
- Tick **Yes** (our app requires sign-in for any useful flow)

### Username
```
reviewer@nomadspeople.com
```

### Password
```
[the 24-char password from 1Password]
```

### Notes for the Reviewer (up to 4000 chars — be helpful)

Sample text to paste:

```
Hi Apple Review team,

Thanks for reviewing nomadspeople.

## What the app does
nomadspeople is a real-time social map for digital nomads. A user goes "live on the map" to show their neighborhood, and they can see other nomads nearby, join activities (co-working, meetups), and chat 1-on-1 or in groups.

## How to test
1. Open the app — you land on the Auth screen.
2. Tap "Sign in with Apple" (recommended) OR enter demo credentials below.
3. After sign-in, you'll see the Home tab with a live map of Tel Aviv.
4. The demo account is pre-positioned in Tel Aviv with one sample check-in at Nahalat Binyamin.

## Demo account (if Sign in with Apple doesn't work)
- Email: reviewer@nomadspeople.com
- Password: [password]

## Key flows to test
1. **Map view** — pinch/pan, tap any pin to see that user's activity
2. **Create check-in** — tap the white Plus button (center of tab bar) → type an activity → set location → Publish
3. **Chat** — tap any nomad, tap "Say hi" → sends a DM → try sending an image
4. **Account deletion** — Settings → Delete Account (tests Guideline 5.1.1(v) — fully functional)
5. **Report/block** — long-press any message → Report / Block

## Contact
If you hit any issue during review, please email support@nomadspeople.com. We monitor it actively and respond within 24 hours.

## Privacy
Full privacy policy: https://nomadspeople.com/privacy
Terms: https://nomadspeople.com/terms
Account deletion (public): https://nomadspeople.com/delete-account

Thank you!
```

---

## Google Play Review — what goes into Play Console

In Play Console → App content → **App access**:

### Tick "All or some functionality is restricted"

### Provide test credentials:
- **Username:** `reviewer@nomadspeople.com`
- **Password:** [same as Apple's demo password]
- **Any other info the reviewer needs:** (paste the Notes block above, slightly adapted)

Google's reviewer uses the same account — no need for separate setup.

---

## After first review — maintenance

- Every new version submission: **re-seed the check-in** (the cron kills expired check-ins every 5 min)
- If the reviewer reports the account is locked / flagged → unlock via Supabase auth dashboard
- Never delete the reviewer user — every version review uses the same account
- Rotate the password yearly (or if a leak is suspected)

---

## Security note

Both Apple and Google **do not share** reviewer credentials externally. They go to a specific review team. The account is **low-risk** because:
- It's a demo account with no real data
- The password is strong and stored only in 1Password
- We can rotate the password anytime and update the review info
- If leaked, the worst case is someone can log in and see the demo data

Don't reuse this password anywhere.

═══════════════════════════════════
📄 docs/launch/MASTER-PLAN.md
═══════════════════════════════════

# nomadspeople — Pre-Launch Master Plan

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
   infoPlist: "nomadspeople uses anonymous usage stats to
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

═══════════════════════════════════
📄 docs/launch/PART-2-DEEP-DIVE.md
═══════════════════════════════════

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
    "nomadspeople uses anonymous usage stats to improve the app. Your chats, profile, and location are NEVER tracked across apps."
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
   - Name: "nomadspeople"
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
1. **Terms** — reference to "nomadspeople", mention of
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