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
