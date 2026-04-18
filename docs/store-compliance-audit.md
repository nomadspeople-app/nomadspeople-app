# NomadsPeople — Store Compliance Audit
**Date:** April 9, 2026 | **Target:** Apple App Store + Google Play Store

---

## CRITICAL BLOCKERS (Must Fix Before Submission)

### 1. App Icons — 180x180px → Need 1024x1024px
- **Status:** ❌ BLOCKER
- **Current:** All 4 icon files (icon.png, adaptive-icon.png, favicon.png, splash-icon.png) are 180x180px / 31KB
- **Required:** icon.png = 1024x1024px (no transparency, no alpha channel, RGB)
- **Required:** adaptive-icon.png = 1024x1024px (Android adaptive icon)
- **Affects:** Both Apple and Google — instant reject without proper icons
- **Action:** Design and export new icon at 1024x1024px

### 2. Splash Screen — 180x180px → Need ~1284x2778px
- **Status:** ❌ BLOCKER
- **Current:** splash-icon.png is 180x180px
- **Required:** Minimum 1284x2778px for proper display on modern devices
- **Action:** Design proper splash screen asset

### 3. Privacy Policy — No Public URL
- **Status:** ❌ BLOCKER
- **Current:** Full privacy policy exists in LegalScreen.tsx (effective April 5, 2026) — but only accessible inside the app
- **Required by Apple:** Privacy policy URL in App Store Connect metadata
- **Required by Google:** Privacy policy on active URL (not PDF), linked from Data Safety section
- **Action:** Publish privacy policy to public URL (e.g., nomadspeople.com/privacy)

### 4. Account Deletion Web Page (Google Play Only)
- **Status:** ❌ BLOCKER (Android)
- **Current:** In-app account deletion works perfectly (SettingsScreen.tsx → handleDeleteAccount)
- **Required by Google:** Account deletion must ALSO be accessible via web page, without needing the app installed
- **Action:** Create web page at nomadspeople.com/delete-account with authentication + deletion flow

### 5. Post/Comment Reporting — Missing
- **Status:** ❌ BLOCKER
- **Apple Guideline 1.2:** UGC apps must have reporting on ALL user-generated content
- **Current:** Reporting exists for chat messages (ChatScreen) and user profiles (ProfileScreen)
- **Missing:** No report button on posts or comments in PostFeedScreen.tsx
- **Action:** Add report option to posts and comments in the feed

### 6. Developer Accounts — Not Created
- **Status:** ❌ BLOCKER
- **Apple Developer Program:** $99/year — enrollment takes 24-48 hours
- **Google Play Console:** $25 one-time — new personal accounts require 12 testers / 14 days closed testing before production access
- **Action:** Sign up for both accounts immediately

### 7. Screenshots — Not Created
- **Status:** ❌ BLOCKER
- **Apple:** Up to 10 screenshots per device size (iPhone 6.9", 6.7", 6.5", 5.5"; iPad Pro 13")
- **Google:** Minimum 2, recommended 3-8 screenshots per form factor
- **Google Feature Graphic:** 1024x500px (mandatory)
- **Action:** Take screenshots of all key flows on multiple device sizes

### 8. Empty Database — No Content for Review
- **Status:** ❌ BLOCKER
- **Apple Guideline 2.1 (Completeness):** App must demonstrate full functionality; empty/broken apps are rejected (~40% of rejections)
- **Current:** Database was wiped clean — 0 nomads, 0 posts, 0 activities
- **Required:** Seed data showing the app works — sample nomads on map, sample posts, sample activities
- **Action:** Create realistic seed data (NOT fake users — clearly labeled demo content or real test accounts)

---

## HIGH PRIORITY (Should Fix Before Submission)

### 9. Terms of Service — No Explicit CSAM Clause
- **Status:** ⚠️ HIGH
- **Current:** ToS prohibits "explicit or unsolicited sexual content" — but no specific mention of CSAM/child exploitation
- **Google requires:** ToS must explicitly prohibit child sexual abuse and exploitation
- **Apple requires:** Same for UGC apps
- **Action:** Add explicit CSAM prohibition clause to Terms of Service in LegalScreen.tsx

### 10. Content Moderation — No Automated System
- **Status:** ⚠️ HIGH
- **Apple Guideline 1.2:** Must have "content filtering" mechanism
- **Current:** Reports are stored in app_message_reports and app_reports tables, but no automated review process
- **Minimum viable:** Manual review via admin dashboard (exists) + documented moderation process + 24-hour response SLA
- **Action:** Document moderation workflow, ensure admin dashboard can handle reports, set up email alerts for new reports

### 11. Store Metadata — Not Prepared
- **Status:** ⚠️ HIGH
- **Apple:** App name (30 chars), subtitle (30 chars), keywords (100 chars), description (4,000 chars), promotional text (170 chars)
- **Google:** Short description (80 chars), full description (4,000 chars), feature graphic (1024x500px)
- **Action:** Write all store copy in English (+ Hebrew if you want Israeli store)

### 12. Content Rating Questionnaire — Not Completed
- **Status:** ⚠️ HIGH
- **Apple:** Age rating questionnaire in App Store Connect
- **Google:** IARC content rating questionnaire in Play Console
- **Expected rating:** 12+ / Teen (due to location sharing, UGC, user interaction)
- **Action:** Complete during store listing setup

### 13. Google Play Closed Testing (14-Day Requirement)
- **Status:** ⚠️ HIGH (affects timeline)
- **Rule:** New personal developer accounts must run closed testing with 12+ testers for 14 consecutive days
- **Impact:** Adds minimum 2-3 weeks to Google Play launch timeline
- **Action:** Set up closed testing track immediately after Google Play Console account creation, recruit 12+ testers

---

## MEDIUM PRIORITY (Recommended Before Submission)

### 14. Apple Privacy Nutrition Labels
- **Status:** ⚠️ MEDIUM
- **Required declarations for NomadsPeople:**
  - Location (precise) — map pins, show_on_map
  - User Content — posts, comments, photos, chat messages
  - Contact Info — name, email
  - Identifiers — push notification tokens, device ID
  - Usage Data — feature interactions, analytics
  - Diagnostics — crash data
- **Action:** Complete during App Store Connect setup

### 15. Google Data Safety Section
- **Status:** ⚠️ MEDIUM
- **Required declarations:**
  - Location (precise), User Content, Contacts, Photos, Messages, Identifiers, Usage Data
  - Encryption in transit: Yes (Supabase uses HTTPS)
  - Account deletion link: Yes (needs web page — see blocker #4)
- **Action:** Complete during Play Console setup

### 16. Sign in with Apple — Currently Implemented
- **Status:** ✅ PASS
- **Note:** No longer mandatory as exclusive login (changed January 2024), but NomadsPeople already has it (expo-apple-authentication plugin in app.json)
- **No action needed**

### 17. Android Target API Level
- **Status:** ⚠️ CHECK
- **Required by August 31, 2025:** targetSdkVersion 35 (Android 15)
- **Current:** Not explicitly set in app.json — relies on Expo SDK 54 defaults
- **Expo SDK 54 default:** Should be API 34 or 35 — verify during EAS build
- **Action:** Verify targetSdkVersion in build output, upgrade if needed

### 18. Android Photo Picker Policy
- **Status:** ✅ PASS
- **Current:** Uses expo-image-picker with READ_MEDIA_IMAGES (scoped permission), not broad gallery access
- **Compliant:** Uses system photo picker approach

---

## ALREADY COMPLIANT (No Action Needed)

| Requirement | Status | Details |
|---|---|---|
| Account Deletion (in-app) | ✅ | SettingsScreen.tsx → handleDeleteAccount — deletes all data |
| User Blocking | ✅ | BlockedUsersScreen.tsx — full block/unblock with UI |
| Chat Message Reporting | ✅ | ChatScreen.tsx → handleReport → app_message_reports |
| User Profile Reporting | ✅ | ProfileScreen.tsx → app_reports table |
| Age Verification | ✅ | OnboardingScreen.tsx → 18+ check at signup, age_verified flag |
| Notification Opt-in | ✅ | notifications.ts → requestPermissionsAsync + per-type toggles |
| Notification Channels (Android) | ✅ | 4 channels: Messages, Activities, Social, Reminders |
| Privacy Policy Content | ✅ | Full policy in LegalScreen.tsx — covers all required topics |
| Terms of Service Content | ✅ | Full ToS in LegalScreen.tsx — prohibited content, termination |
| Support/Contact Info | ✅ | Email links in Settings (nomadspeople1@gmail.com) |
| Location Permission Strings | ✅ | Clear purpose strings in app.json for iOS and Android |
| Camera Permission Strings | ✅ | NSCameraUsageDescription and plugin config in app.json |
| Photo Library Permission Strings | ✅ | NSPhotoLibraryUsageDescription and expo-image-picker plugin |
| Encryption Declaration | ✅ | ITSAppUsesNonExemptEncryption: false (standard HTTPS only) |
| Push Token Cleanup | ✅ | unregisterPushToken on logout |
| i18n Support | ✅ | 8 languages: en, he, es, pt, it, fr, de, ru |
| show_on_map Visibility Control | ✅ | Reciprocal visibility — users can go invisible |
| Bundle Identifier | ✅ | com.nomadspeople.app (both platforms) |
| EAS Build Pipeline | ✅ | eas.json with dev/preview/production profiles |
| Production Console Stripping | ✅ | babel transform-remove-console in production |
| TypeScript Errors | ✅ | 0 errors (all 20 fixed in previous session) |

---

## SUBMISSION TIMELINE ESTIMATE

### Apple App Store
1. Sign up for Apple Developer ($99/year) — 24-48 hours
2. Fix all blockers (icons, screenshots, privacy URL, seed data, post reporting) — 3-5 days
3. Complete App Store Connect metadata — 1 day
4. Submit for review — 24-48 hours review time
5. **Estimated total: 1-2 weeks**

### Google Play Store
1. Sign up for Google Play Console ($25) — 1-2 days
2. Fix all blockers (same as Apple + web deletion page) — 3-5 days
3. Set up closed testing with 12+ testers — 14 days mandatory wait
4. Complete Play Console metadata + Data Safety — 1 day
5. Request production access — up to 7 days review
6. **Estimated total: 4-5 weeks** (due to 14-day testing requirement)

---

## ACTION ITEMS PRIORITY ORDER

1. **Sign up for developer accounts** (Apple + Google) — START NOW
2. **Design 1024x1024 app icon** — you need this for both stores
3. **Design splash screen** (1284x2778px minimum)
4. **Publish privacy policy to public URL**
5. **Add post/comment reporting** to PostFeedScreen.tsx
6. **Add CSAM clause** to Terms of Service
7. **Create web account deletion page** (for Google Play)
8. **Create seed data** — sample nomads, posts, activities for reviewers
9. **Take screenshots** on multiple device sizes
10. **Write store metadata** — descriptions, keywords
11. **Start Google closed testing** immediately after account creation
12. **Complete privacy/data safety declarations** in both stores
13. **Complete content rating questionnaires** in both stores
14. **Submit to Apple** (can happen before Google is ready)
15. **Request Google production access** after 14-day testing period
