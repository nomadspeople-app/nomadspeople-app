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
