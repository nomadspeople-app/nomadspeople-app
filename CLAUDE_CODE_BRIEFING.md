# 🚀 CLAUDE CODE — NEXT TASKS BRIEFING
**Date:** April 15, 2026 | **Status:** Ready for handoff

---

## 📋 SUMMARY OF WHAT WE'RE DOING

We have a **working nomads map app** (nomadspeople). Barak just:
1. Fixed Timer/Status button taps (hitSlop + instant feedback)
2. Fixed city validation (wrong city on checkins)
3. Fixed Realtime filter (case-sensitive bug)
4. Reverted Claude Code's 77 experimental changes
5. **Turned OFF DEV_MODE** (now requires real login)

**This session:** Fix specific bugs, test map flow, and plan v1.1 feature storage.

---

## 🔴 CRITICAL ISSUES TO FIX

### Issue #1: Password Visibility Toggle Missing
**What's wrong:**
- AuthScreen has no "show/hide password" toggle
- User can't verify they typed password correctly
- User types `barakperez@gmail.com` password blindly

**What to do:**
- Add `showPassword` state in AuthScreen
- Toggle icon button (eye icon) to show/hide password in TextInput
- Use Lucide or NomadIcon for the toggle button

**File:** `screens/AuthScreen.tsx` (lines ~60-80, TextInput for password)

---

### Issue #2: Map Live Location Button (Timer) Not Working
**What's wrong:**
- Click "Live Location" on Timer button
- System shows **wrong city** (different from where the bubble shows)
- Example: Bubble shows "Tel Aviv", but live location says "Bangkok"

**What to do:**
1. Check `HomeScreen.tsx` line ~1310 (Timer onPress handler)
2. Verify `resolveCheckinCity()` function is working correctly
3. Test with actual GPS coordinates (simulate if needed)
4. Log to console: `[Timer] City resolved to: ${city}`
5. Verify city matches GPS location within 50km
6. If still wrong, check Nominatim reverse geocoding fallback

**Files:** 
- `screens/HomeScreen.tsx` (lines 1300-1340, Timer button logic)
- `lib/hooks.ts` (findNearestCity, haversineKm functions)

---

### Issue #3: Map Select → Shows Different City
**What's wrong:**
- Click "Select on Map" (tap bubble location)
- User taps a location on map
- App shows different city than where user tapped

**What to do:**
1. Find map tap handler in `HomeScreen.tsx`
2. Check coordinates passed to city resolver
3. Verify Nominatim reverse geocoding URL is correct
4. Log: `[MapTap] Coordinates: lat=${lat}, lng=${lng} → City: ${city}`
5. Test multiple locations (Bangkok, Tel Aviv, Lisbon)

**File:** `screens/HomeScreen.tsx` (map onPress handler, ~line ~900)

---

### Issue #4: Bubble Tap → Should Open Bubble, Not Move Map
**What's wrong:**
- Tap a bubble on map
- Map zooms to bubble location instead of opening bubble details
- Bubble popup doesn't appear OR gets hidden after zoom

**What's supposed to happen:**
1. Tap bubble
2. Map smooth zoom (400ms) to neighborhood (latitudeDelta: 0.008)
3. Wait (450ms)
4. Open popup (TimerBubble or ActivityDetailSheet)

**What to do:**
1. Check `HomeScreen.tsx` line ~380 (map marker onPress)
2. Verify timing: `animateToRegion` → `setTimeout(450ms)` → `setShowPopup(true)`
3. Make sure popup component is rendered AFTER zoom completes
4. Test: tap 3 different bubbles, verify popup opens after zoom

**Reference:** `docs/map-pin-flow.md` (locked flow — don't change)

**File:** `screens/HomeScreen.tsx` (lines 380-450, marker tap handler)

---

### Issue #5: Full Map & Navigation Test
**What to test:**
1. ✅ Login with email/password (Barak)
2. ✅ See map with pinned bubbles
3. ✅ Tap Home tab → map loads
4. ✅ Tap People tab → people list loads
5. ✅ Tap Pulse tab → messages load
6. ✅ Tap Profile tab → profile loads
7. ✅ Return to Home → map still there (no flickering/jumping)
8. ✅ Tap bubble on map → zoom smooth, popup opens
9. ✅ Swipe bubble → view other bubbles
10. ✅ Click timer button → sheet opens, can set activity
11. ✅ Click status button → sheet opens, can set status
12. ✅ Close sheet → back to map (not jumping/glitching)
13. ✅ Click "Live Location" button → shows correct city
14. ✅ Click "Select on Map" → shows correct city after tap

**Report:** Any lag, jumps, crashes, or visual glitches

**Files to check:**
- `screens/HomeScreen.tsx` (main map logic)
- `components/` (all sheet components)
- `lib/hooks.ts` (Realtime subscriptions)

---

## 🟡 QUESTION FOR BARAK: Feature Download Storage (v1.1)

**The Ask:**
Barak wants to know: If we download/implement features in MVP (v1.0), can we "save" them separately to upload as v1.1 later?

**What this means:**
- Today: Build MVP with core features (map, checkin, messages)
- Barak's question: Can features be isolated in branches/folders so they can be shipped v1.0 without them, then added in v1.1?

**Answer depends on:**
1. Which features are "optional" vs "core"?
2. Should they be feature flags (code present but disabled)?
3. Or separate branches that merge later?
4. How to test v1.0 without incomplete features?

**Barak: Decide before I start work**

---

## 📝 PROBLEMS FOUND (Before starting work)

### ✅ Fixed Already:
- DEV_MODE was ON (now OFF) — good for security
- Timer/Status button taps were slow — fixed with hitSlop + instant feedback
- City validation was wrong — added resolveCheckinCity() function
- Realtime filter was case-sensitive — now client-side filtering

### ⚠️ Remaining Issues:
1. **Password toggle missing** — AuthScreen can't show password
2. **Timer live location wrong city** — GPS city mismatch
3. **Map select shows wrong city** — tap location city mismatch
4. **Bubble tap zooms instead of opening** — popup timing issue
5. **No full map/nav test yet** — need to verify smooth flow

### ❓ Unknown status:
- Are there other small glitches?
- Does the app crash on certain flows?
- Are there visual jumps/flickering on navigation?

---

## 🎯 HANDOFF CHECKLIST

✅ App is running (DEV_MODE = false)
✅ User can login with email + password
✅ Onboarding marked as done in DB
✅ All previous commits are clean
✅ Timer/Status button fixes are in place
✅ City validation code is in place

❌ **NOT YET DONE:**
- [ ] Password visibility toggle added
- [ ] Timer live location city issue fixed
- [ ] Map select city issue fixed
- [ ] Bubble tap → popup flow verified
- [ ] Full map navigation test completed
- [ ] v1.1 feature storage strategy decided

---

## 📌 FILES CLAUDE CODE NEEDS TO WORK ON

**Primary:**
- `screens/AuthScreen.tsx` — Add password toggle
- `screens/HomeScreen.tsx` — Fix map issues (4 separate problems)
- `lib/hooks.ts` — Verify city resolution functions

**Testing:**
- Full app navigation flow
- Map interaction (tap, zoom, popup)
- Tab switching

**Decision needed:**
- v1.1 feature storage approach

---

## 🚀 READY TO HANDOFF

This briefing is **complete and self-contained**. Claude Code has:
1. Clear problem descriptions
2. Exact file locations
3. Line number references
4. What to test
5. What decision is needed

**Status:** Ready for Claude Code to take over.
