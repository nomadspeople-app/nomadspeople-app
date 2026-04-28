# Android Studio Emulator — Setup Guide

**Who:** Barak — Mac user without a physical Android device.
**Why:** Google Play Console requires Android device verification before we can create an app record. An emulator satisfies this requirement + doubles as a Play Store screenshot factory + a debug environment.
**Time:** 30 minutes end-to-end (20 min download, 10 min configuration).

---

## Step 1 — Download Android Studio

Open **https://developer.android.com/studio** on your Mac.

1. Click the big blue **"Download Android Studio"** button near the top.
2. Accept the license agreement.
3. Choose the **Mac with Apple chip (M1/M2/M3)** download if you have an Apple Silicon Mac, **or the Mac with Intel** version otherwise.
   - Check your Mac: Apple menu () → About This Mac. Look at "Chip" — if it says "Apple", use the Apple Silicon download.
4. The file is ~1.2 GB. Download takes 3–15 min depending on connection.

## Step 2 — Install

1. Open the downloaded `.dmg` file.
2. Drag the Android Studio icon into the Applications folder.
3. Eject the disk image.
4. Open Android Studio from Applications.
5. First-launch wizard:
   - "Import previous settings?" → **Do not import settings**
   - "Data sharing" → your choice (I recommend Don't send)
   - Welcome screen → click **Next**
   - Setup type → **Standard**
   - UI theme → your choice
   - Verify Settings → Next → Accept licenses → Finish
6. Downloads SDK components (~2 GB, 5–10 min).

## Step 3 — Create a Virtual Device (the emulator)

1. On the Welcome screen, click **More Actions → Virtual Device Manager** (or Tools menu → Device Manager if you already have a project open).
2. Click the **"+" Create Virtual Device** button (top-left of the Device Manager).
3. **Category:** Phone. **Device:** choose **Pixel 7** (best all-around) → Next.
4. **System image:** this is the critical step.
   - Click the **"Recommended"** tab at the top.
   - Look for **"API 34" (UpsideDownCake / Android 14)** — if it's not downloaded, click the ⬇ download icon next to it.
   - **Make sure the row you pick says `(Google Play)`** next to the image name — NOT just "Google APIs". Only Google Play images include Play Store app, which we need for device verification. If you only see "Google APIs" rows, switch to the **"x86_64 Images"** tab (or **"arm64-v8a Images"** on Apple Silicon) and look for one marked **(Google Play)**.
   - Accept the license if prompted. Download takes 3–5 min.
   - Select the downloaded row → Next.
5. **AVD name:** leave default (`Pixel 7 API 34`) → Finish.
6. Back in Device Manager, you now see your virtual device. Click the **▶ Play** button to start it.
7. The emulator boots in ~1 min. First boot is slowest; subsequent boots are ~15 sec.

## Step 4 — Sign in to Google

1. Inside the emulator, swipe up to open the app drawer.
2. Find and open **Play Store** (the triangle icon).
3. Sign in with **`shospeople@gmail.com`** (the Play Console owner account).
   - If asked for 2FA, approve via your phone.
4. Wait for Play Store to sync. It can take 1–2 min for Google to register the device under your account.

## Step 5 — Complete the Play Console device verification

1. On your Mac, open **Play Console** → Dashboard: `https://play.google.com/console/u/0/developers/6700370044457273942/app-list`
2. Top banner still says "סיום ההגדרה של חשבון הפיתוח". Click **"הצג פרטים"** next to **"עליך לאמת שיש לך גישה למכשיר נייד עם Android"**.
3. A checklist shows the devices Google has seen sign into your account recently. Your new emulator should appear within ~5 min of Play Store sign-in.
4. If it's not there yet, wait 5 more min and refresh. Google takes a moment to register emulators.
5. Once recognized, the checkmark turns green. Banner item clears.

## Step 6 — Verify the other blocker (phone SMS)

While you're in Play Console, also click **"הצג פרטים"** next to **"אימות מספר הטלפון ליצירת קשר"** and complete the SMS verification to `+972547770094`. 2 minutes, unblocks the final gate.

## Step 7 — Confirm "Create app" is now enabled

After both blockers clear, the big banner disappears and a **"Create app"** button appears at the top of the dashboard. That's the "go" signal to start filling in the store listing using **`docs/google-play-submission.md`** section 1.

---

## Bonus — what else the emulator is useful for

### Install a real AAB to test

Once `eas build -p android --profile production` succeeds and you have a `.aab` file, you can install it directly into the running emulator:

```bash
# convert aab → apks locally using bundletool (free from Google)
# or — simpler — skip straight to APK for local testing with:
eas build -p android --profile preview
# the preview profile outputs an APK that installs directly with:
adb install ~/Downloads/build-XXX.apk
```

(`adb` is inside Android Studio's sdk bin; add it to your PATH if not done: `export PATH=$PATH:~/Library/Android/sdk/platform-tools`)

### Capture Play Store screenshots (GP-5)

With the emulator running, use the sidebar's camera icon (**⊞ Extended controls → Snapshot**) to take screenshots at **1080 × 2400** resolution — Play Store's default portrait size. Save to `assets/store/play-screenshots/`.

The guide in `docs/google-play-screenshots-guide.md` explains the 8 scenes to capture.

---

## Troubleshooting

**"The emulator starts but is super slow"**
- Apple Silicon Macs need the **arm64-v8a** image (not x86_64). Recreate the AVD with an arm64 image.
- Allocate more RAM: Device Manager → ⋮ → Edit → Advanced Settings → RAM → 4096 MB (or 8192 if you have it).

**"Play Store shows nothing / won't sign in"**
- You picked a **Google APIs** image instead of **Google Play**. Only Play images include Play Store. Delete the AVD, make a new one with a Play image.

**"adb command not found"**
- Add to PATH: `echo 'export PATH=$PATH:~/Library/Android/sdk/platform-tools' >> ~/.zshrc && source ~/.zshrc`
- Or use the full path: `~/Library/Android/sdk/platform-tools/adb install ...`

**"Google didn't register the emulator"**
- Give it 10–15 min. Some accounts take longer.
- Make sure you signed in with `shospeople@gmail.com` and NOT a different Google account.
- Force a Play Store update: inside Play Store → profile icon → Settings → About → Play Store version → tap repeatedly until it says "updated".

---

## Summary

| Step | Time | Action |
|---|---|---|
| 1 | 15 min | Download Android Studio |
| 2 | 10 min | Install + SDK setup |
| 3 | 5 min | Create Pixel 7 AVD with Google Play image |
| 4 | 2 min | Sign in to Play Store |
| 5 | 5 min | Verify in Play Console |
| 6 | 2 min | Verify phone SMS |
| 7 | 0 | "Create app" button unlocked |

**Total: ~40 min to a fully-unblocked Play Console.**
