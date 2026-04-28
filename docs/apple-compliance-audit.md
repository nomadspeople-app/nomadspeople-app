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
