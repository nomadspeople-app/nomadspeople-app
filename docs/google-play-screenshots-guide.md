# Google Play Screenshots Guide

**For:** `nomadspeople` v1.0.0 Play Store submission (GP-5)
**Target:** 8 portrait screenshots, 1080×2400 (or device-native — Play accepts 320–3840 px on both axes as long as ratio is 16:9 or taller).

This guide tells you *which* screens to capture, *in what state*, *in what order*, so the store listing reads like a tight product demo.

---

## Pre-capture setup (5 min, one time)

1. **Install the EAS build** on your Android device — download from the build URL or install the APK directly.
2. **Sign in** with a test account that has:
   - A finished profile (name + avatar + bio + social links)
   - You're currently "live on the map" (`show_on_map = true`)
   - At least 1 active status/check-in that's *yours*
3. **Set device locale to English** — Settings → System → Languages → English — so the screenshots match the Play Store default-language listing.
4. **Clear notifications** — swipe them away so the status bar is clean.
5. **Put device in "do not disturb"** so no incoming notifications leak into a screenshot.
6. **Connect to WiFi** so there's no cellular carrier name in the status bar (or it shows your carrier cleanly — either is acceptable).
7. **Time displayed:** doesn't matter, but keep it consistent across all shots if you care about polish.

---

## The 8 screenshots (in Play Store display order)

Play Store shows them left-to-right in a swipe gallery. The FIRST two are the ones 90 % of browsers actually see — the rest get swiped through fast. So lead with the strongest value-prop shots.

### 1. Hero — Home / Map with nomads visible
**Where:** Home tab (map).
**State:**
- Zoomed to a city with 6-10 visible nomad pins.
- The city search bar shows the current city name (e.g. "Tel Aviv, Israel").
- Vibe bar visible at top with at least 2-3 categories lit.
- No sheets or bubbles open.

**Why first:** instantly communicates "this is a map of nomads near you." Single sentence of product.

### 2. The nomads list (with the geo-blur in play)
**Where:** Tap the "nomads here" bubble in the top-left.
**State:**
- Sheet is open showing 15+ nomads.
- You're in the home country → first 8 are visible, rest are blurred with the "join from {country}" hint.
- OR, if you can only test from one country, use a clean in-country view with 8+ clear profiles.

**Why second:** shows the core "who's nearby" feature with real faces.

### 3. A live activity / check-in on the map
**Where:** Home tab, map with a visible group activity pin.
**State:**
- Tap a pin → the Activity detail sheet slides up → showing activity title, owner's avatar, countdown, member count.
- "Join" button visible.

**Why:** shows the create-and-join core loop.

### 4. Profile (your own or another nomad)
**Where:** Profile tab (your own) OR tap a nomad → UserProfile.
**State:**
- Avatar + display name + bio visible.
- DNA / tags filled in.
- Social links row visible with at least 2 icons (Instagram, LinkedIn, etc.).
- "Status" or "I'm live" indicator visible.

**Why:** shows that nomads are real people with personality, not just pins.

### 5. Chat — group conversation with image
**Where:** Pulse tab → open a group chat that has both text and image messages.
**State:**
- Conversation has at least 5 messages visible: mix of your messages and others'.
- One image attachment visible (mid-conversation).
- A date divider pill is visible ("Today" or a date).
- Chat header shows the group name + member count.

**Why:** shows the messaging quality — date dividers, photos, real groups.

### 6. Create a check-in — the CreationBubble
**Where:** Tap the Plus button (in the bottom tab bar).
**State:**
- CreationBubble is open mid-flow — ideally on the WHERE step (showing the map + pin).
- Or the WHAT step showing emoji + text input with an example like "coffee at Nahalat Binyamin ☕".

**Why:** shows how easy it is to announce something.

### 7. Pulse / Messages inbox
**Where:** Pulse tab (Messages).
**State:**
- 4-6 conversations listed.
- Mix of 1:1 DMs (circular avatars) and groups (squared peach avatars).
- At least one conversation has an unread badge.
- One conversation shows last-message preview with an image thumbnail.

**Why:** shows the social activity volume — this isn't a dead app.

### 8. Settings — visibility toggle (optional safety shot)
**Where:** Profile tab → Settings.
**State:**
- The "Show me on the map" toggle visible at the top.
- Dark-mode toggle or language picker visible below.

**Why:** ends the tour with a privacy-first signal — "you control what's shared." Appeals to reviewers and privacy-aware users.

---

## After capture

1. Save all files to `assets/store/play-screenshots/` in this order:
   - `01-home-map.png`
   - `02-nomads-list.png`
   - `03-activity-pin.png`
   - `04-profile.png`
   - `05-chat-group.png`
   - `06-create-checkin.png`
   - `07-messages-inbox.png`
   - `08-settings-visibility.png`

2. Verify each is 1080×2400 (or your device's native portrait size).

3. No text overlays, no frames, no device bezels — Play Store will render them inside a phone frame on the listing page itself.

---

## What Google checks

- **Readable text** — if text is too small or blurry, Play rejects.
- **No placeholder content** — "Lorem ipsum" or test names ("John Doe") will flag the listing.
- **No competitor names or trademarks** — don't show another app's logo in a background.
- **No explicit content** — none in our case.
- **Consistent quality** — don't mix low-res and high-res in the same gallery.

---

## Pro tip — lead with the map + people count

Screenshots 1 and 2 are what 90 % of browsers see. Your map screenshot with 10 faces on it is the single most important asset in the whole submission. Take 3-4 alternate versions and pick the best one.
