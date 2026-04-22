# nomadspeople — App Store Launch Checklist

**Generated:** April 9, 2026
**Target:** Apple App Store + Google Play (both)
**Status:** Pre-launch audit complete

---

## CRITICAL BLOCKERS (must fix before any build)

### 1. App Icon — WRONG SIZE
- **Current:** 180x180px (all 4 icon files are identical 31KB copies)
- **Required:** icon.png = 1024x1024px (no transparency, no alpha)
- **Required:** adaptive-icon.png = 1024x1024px (Android)
- **Action:** Design proper 1024x1024 icon, export all sizes

### 2. Splash Screen — Likely Same Issue
- splash-icon.png is same 31KB as icon → probably 180x180
- **Required:** At least 1284x2778px recommended for splash image

### 3. Missing eas.json — No Build Pipeline
- EAS project ID exists in app.json but no eas.json config
- Cannot run `eas build` without it
- **Action:** Create eas.json with development, preview, production profiles

### 4. Missing iOS Photo Library Permission
- App uses expo-image-picker but NSPhotoLibraryUsageDescription not declared
- App Store will reject
- **Action:** Add to app.json → ios → infoPlist

### 5. TypeScript Errors — 20 errors
- 7 duplicate translation keys (de, es, fr, he, it, pt, ru)
- Type mismatches in ActivityDetailSheet, ChatScreen
- Missing property references
- **Action:** Fix all 20 before production build

---

## DEVELOPER ACCOUNTS (do this NOW — takes time)

### Apple Developer Program
- **Cost:** $99/year
- **Sign up:** developer.apple.com/programs/enroll
- **Timeline:** Individual = 24-48h approval; if ID verification needed = up to 2 weeks
- **You need:** Apple ID, credit card, government ID
- **Tip:** Start enrollment TODAY — it's the longest wait

### Google Play Console
- **Cost:** $25 one-time
- **Sign up:** play.google.com/console/signup
- **Timeline:** Usually instant, but identity verification can take days
- **You need:** Google account, credit card, ID for verification

---

## APP.JSON — Fixes Needed

### iOS Section — Add These:
```json
"infoPlist": {
  "NSPhotoLibraryUsageDescription": "nomadspeople lets you upload a profile photo and share moments from your travels.",
  "NSCameraUsageDescription": "nomadspeople lets you take photos for your profile and moments.",
  "CFBundleDevelopmentRegion": "en",
  "CFBundleAllowMixedLocalizations": true,
  "ITSAppUsesNonExemptEncryption": false
}
```

### Android Section — Add These:
```json
"permissions": [
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION",
  "CAMERA",
  "READ_MEDIA_IMAGES"
]
```

### General — Update:
- `"version": "1.0.0"` ✅ (correct for first release)
- Add `"runtimeVersion"` for OTA updates
- Add `"updates"` config for EAS Update

---

## EAS.JSON — Create This File

```json
{
  "cli": { "version": ">= 15.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal"
      }
    }
  }
}
```

---

## STORE METADATA — Prepare These

### App Name
- **Primary:** nomadspeople
- **Subtitle (iOS):** Find Your Neighborhood, Not Just a City

### Description (both stores)
Need: Short description (80 chars) + Full description (4000 chars max)

### Keywords (iOS)
100 characters max. Suggested:
`digital nomad,remote work,travel,coworking,expat,nomad community,neighborhood,meetup,coliving`

### Category
- **Primary:** Travel (both stores)
- **Secondary:** Social Networking (both stores)

### Content Rating
- Questionnaire required on both platforms
- Expected rating: 4+ (iOS) / Everyone (Android)
- No violence, no gambling, no mature content

### Screenshots Required
| Device | iOS | Android |
|--------|-----|---------|
| iPhone 6.7" | 1290x2796 (required) | — |
| iPhone 6.5" | 1284x2778 (required) | — |
| iPad 12.9" | 2048x2732 (if supportsTablet=true) | — |
| Phone | — | Min 320px, max 3840px |
| 7" tablet | — | Optional |
| 10" tablet | — | Optional |

**Need 3-10 screenshots per device size.**

### Privacy Policy URL
- **Required by both stores**
- Must be publicly accessible URL
- Content exists in LegalScreen.tsx — need to host it online
- **Action:** Publish privacy policy to nomadspeople.com/privacy

### App Privacy (iOS) — Data Collection Labels
Apple requires declaring what data you collect:
- Location (approximate + precise) — for map features
- Contact Info (email) — for account
- User Content (photos, posts) — for profile & feed
- Identifiers (user ID) — for account
- Usage Data (interactions) — for analytics
- Diagnostics — for crash reports

---

## SECURITY — Before Going Public

### Supabase Keys — NOT a Critical Issue
- The `anon` key is designed to be public (it's like an API key)
- Row Level Security (RLS) is the real security layer
- **BUT:** Verify ALL tables have proper RLS policies
- **Action:** Audit RLS on every table in Supabase dashboard

### What to Actually Protect
- Supabase `service_role` key must NEVER be in client code (verify it's not)
- No admin endpoints exposed to client

---

## CLEANUP BEFORE BUILD

### Console Logs — 57 Found
- Strip all console.log/console.error from production
- Option A: Use babel plugin `babel-plugin-transform-remove-console`
- Option B: Manual cleanup (risky, might miss some)
- **Recommended:** Add babel plugin to babel.config.js

### Dead Code
- `PostFeedScreen.tsx` — exists but commented out in navigation
- `DNADetailsSheet.tsx` — no longer imported anywhere
- `react-native-map-clustering` — in package.json but may not be used
- **Action:** Remove or keep, but don't ship unused screens

### Empty Locales File
- `locales/en.json` is `{}` (empty)
- Referenced in app.json but unused (translations are in lib/)
- **Action:** Either populate or remove the reference

---

## BUILD & SUBMIT PIPELINE

### Step-by-Step Process

```
1. Fix all blockers above
2. Create eas.json
3. Run: eas build --platform ios --profile production
4. Run: eas build --platform android --profile production
5. Test the builds on real devices
6. Prepare store listings (screenshots, descriptions, etc.)
7. Submit: eas submit --platform ios
8. Submit: eas submit --platform android
9. Wait for review (iOS: 1-3 days, Android: hours to days)
```

### First Build — Expect Issues
- iOS code signing will need setup (certificates, provisioning)
- Android keystore will be auto-generated by EAS
- First build always takes longer (20-40 minutes)

---

## PRIORITY ORDER — What to Do First

| Priority | Task | Time Est. |
|----------|------|-----------|
| **TODAY** | Sign up for Apple Developer + Google Play Console | 15 min (approval takes days) |
| **TODAY** | Design proper 1024x1024 app icon | 1-2 hours |
| **Day 1** | Fix app.json permissions (photo, camera) | 30 min |
| **Day 1** | Create eas.json | 15 min |
| **Day 1** | Fix 20 TypeScript errors | 1-2 hours |
| **Day 1** | Add babel console strip plugin | 15 min |
| **Day 2** | Build splash screen (1284x2778) | 1 hour |
| **Day 2** | First EAS build (both platforms) | Wait for build |
| **Day 2** | Test on real devices | 2-3 hours |
| **Day 3** | Take screenshots for store | 2-3 hours |
| **Day 3** | Write store description + keywords | 1-2 hours |
| **Day 3** | Publish privacy policy to web | 30 min |
| **Day 4** | Submit to both stores | 30 min |
| **Day 5-7** | Wait for review, fix rejection issues | Variable |
