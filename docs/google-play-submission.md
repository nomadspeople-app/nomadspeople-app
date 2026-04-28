# Google Play Store — Submission Pack

**For:** Barak · **Package:** `com.nomadspeople.app` · **Version:** 1.0.0
**Use this file to copy-paste into each Play Console form.** Every field you'll be asked for is here, in submission order.

---

## CRITICAL — 21-day path (new Personal account rule)

> Our Play Console account is **Personal** and was created **2026-04-23** (after Nov 13, 2023). Per Google's new rule ([support.google.com/.../answer/14151465](https://support.google.com/googleplay/android-developer/answer/14151465)), we **cannot publish directly to Production**. The path is:
>
> 1. Create app + upload store listing content (day 0)
> 2. Upload AAB to **Closed testing** track — not Internal
> 3. Recruit **12+ testers**, get them all opted-in
> 4. Wait **14 continuous days** with 12+ testers opted-in
> 5. Apply for Production Access — answer 3 question sections
> 6. Google reviews ~7 days
> 7. Publish to Production
>
> **Total minimum: 21 days from AAB upload to public launch.**

Recruitment plan + message templates live in **`docs/play-tester-recruitment.md`**. Start recruiting testers on Day 0 — the sooner the 12th opt-in happens, the sooner the 14-day clock completes.

During the 14 days, the app IS fully usable by testers — not a downtime period. Use it to collect feedback, push OTA bug fixes (via `expo-updates`), and polish.

---

## 0. Before you start

You need:
- ✅ Google Play Developer account (paid 2026-04-23, `shospeople@gmail.com`)
- ✅ Dev account ID `6700370044457273942`
- ⏳ Android device verification (Play Console → Developer account → verification) — install Play Store on any Android, sign in
- ⏳ Phone verification (Play Console → Developer account → verification) — Google sends SMS to `+972547770094`

Until both verifications are green, `Create app` in Play Console is disabled.

---

## 1. Create app (Play Console → All apps → Create app)

| Field | Value |
|---|---|
| App name | `nomadspeople` |
| Default language | English (United States) — en-US |
| App or game | App |
| Free or paid | Free |
| Declarations — Developer Program Policies | ✅ |
| Declarations — US export laws | ✅ |
| Declarations — Play App Signing ToS | ✅ |
| Declarations — Guidelines acceptance | ✅ |

---

## 2. Store listing (Main store listing)

### App name (30 chars max)
```
nomadspeople
```

### Short description (80 chars max)
```
Find digital nomads near you. See who's in your neighborhood and connect.
```
*(Length: 71 chars)*

### Full description (4000 chars max)
```
nomadspeople helps digital nomads find their people — not just a city, but a neighborhood.

See who's around you in real-time on the map. Join local activities. Connect with people who actually get the lifestyle. Whether you just landed or you've been here for months, nomadspeople shows you who's already nearby.

HOW IT WORKS

Go live on the map — a pin drops in your neighborhood so other nomads can see you're around. Browse who's nearby and tap any profile to say hi. Create a check-in when you're heading somewhere — to a co-working space, a coffee shop, a beach — and other nomads can join. Chat in direct messages or group chats tied to specific activities.

FEATURES

• Live real-time map showing nomads in your neighborhood
• Create and join local activities (coworking, social, trips)
• Direct messages and group chats
• Profile with your story, profession, and travel style
• Nomad count by neighborhood — see where the community is
• 3 languages at launch: English, Hebrew, Russian (more coming)
• Works worldwide — wherever digital nomads go

BUILT FOR NOMADS, BY NOMADS

nomadspeople was built because finding your people in a new city shouldn't be this hard. No algorithms, no feeds, no noise — just a map showing who's nearby and a simple way to connect.

Designed for global nomads — built for use in every major remote-work hub, from Bangkok to Lisbon to Mexico City.

PRIVACY-FIRST

Your location is only shared while you choose to be "live on the map" — turn it off any time and you become invisible. Block, report, and account-deletion tools are built in.
```

### App icon
Use `assets/icon-1024.png` (1024×1024, no alpha channel — Play Store requires this exact spec). ✅ Ready.

### Feature graphic
Use `assets/store/play-feature-graphic.png` (1024×500). ✅ Ready.

### Phone screenshots (upload 2–8)
Pending — see Section 5.

### 7-inch tablet screenshots (optional)
Skip for v1.0.

### 10-inch tablet screenshots (optional)
Skip for v1.0.

### App category
- **Category:** Social
- **Tags (up to 5):** `Social`, `Travel & Local`, `Messaging`, `Community`, `Networking`

### Store listing contact details
- **Website:** `https://nomadspeople.com`
- **Email:** `support@nomadspeople.com`
- **Phone number:** leave empty (optional)
- **External marketing (tick):** allow external marketing activities

### Privacy Policy
```
https://nomadspeople.com/privacy
```

---

## 3. App content → Data safety (Dashboard → App content)

This is Google's "privacy nutrition label" — take time to answer carefully. Below are every answer for each screen.

### Section A: Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes |
| Do you provide a way for users to request that their data be deleted? | Yes |

### Section B: Data types collected

Tick each of these. For each, answer: Collected? Shared? Processing ephemeral? Required or optional?

**Location**
- Approximate location: Collected · Not shared · Not ephemeral · Required · Purpose: App functionality
- Precise location: Collected · Not shared · Not ephemeral · Required · Purpose: App functionality

**Personal info**
- Name: Collected · Not shared · Not ephemeral · Required · Purpose: App functionality
- Email address: Collected · Not shared · Not ephemeral · Required · Purpose: App functionality, Account management
- User IDs: Collected · Not shared · Not ephemeral · Required · Purpose: App functionality, Account management

**Photos and videos**
- Photos: Collected · Not shared · Not ephemeral · Optional · Purpose: App functionality

**Messages**
- Other in-app messages: Collected · Not shared · Not ephemeral · Optional · Purpose: App functionality

**App activity**
- App interactions: Collected · Not shared · Not ephemeral · Optional · Purpose: Analytics
- Other user-generated content (posts, check-ins): Collected · Not shared · Not ephemeral · Optional · Purpose: App functionality

**App info and performance**
- Crash logs: Collected · Not shared · Not ephemeral · Optional · Purpose: Analytics (via Sentry, Frankfurt EU)
- Diagnostics: Collected · Not shared · Not ephemeral · Optional · Purpose: Analytics

**Device or other IDs**
- Device or other IDs: Collected · Not shared · Not ephemeral · Required · Purpose: App functionality (push tokens for notifications)

### Section C: NOT collected (leave unticked)
- Financial info
- Health and fitness
- Audio files
- Files and docs
- Calendar
- Contacts
- Web browsing history
- Search history
- Installed apps
- Other user-generated content types beyond the above
- Advertising data

---

## 4. App content → Content rating (IARC questionnaire)

| Question | Answer |
|---|---|
| Category | Social networking |
| Violence | No |
| Sexuality / nudity | No |
| Profanity | No |
| Drugs, alcohol, tobacco | No |
| Gambling | No |
| Mature or suggestive themes | No |
| User-generated content | Yes — users post status text, check-ins, photos |
| Users can interact / communicate | Yes — 1:1 DMs and group chats |
| Shares user location | Yes — location is shared with other users on the map |
| Digital purchases | No (for now) |

**Expected final rating:** Teen (13+) in most regions.

---

## 5. App content → Ads

**Does your app contain ads?** No

---

## 6. App content → Target audience and content

- **Target age:** 18+
- **Appeals to children?** No
- **Ads served to users under 13?** N/A (app is 18+)

---

## 7. App content → News app

**Is this a news app?** No

---

## 8. App content → COVID-19 contact tracing

**Does it contain contact-tracing or status features?** No

---

## 9. App content → Government app

**Is this a government app?** No

---

## 10. App content → Financial features

**Does your app have any financial features?** No

---

## 11. App content → Health

**Does your app contain health-related features?** No

---

## 12. Build upload (Play Console → Testing → **Closed testing**)

**Go to CLOSED TESTING, not Internal.** Internal doesn't count toward the Production access requirement. The 14-day clock only starts ticking when testers are opted in to a Closed track.

Use the AAB generated by `eas build -p android --profile production`. Production profile in `eas.json` has `autoIncrement: true`, so every build increments the versionCode automatically.

1. Play Console → **Testing → Closed testing** → **Create track** → name it "Open" or "Production-bound"
2. Inside the new track → **Create new release** → upload AAB
3. Release name: `1.0.0` (first release)
4. What's new (500 chars max):
   ```
   Initial release — nomadspeople launches.
   Find your people, anywhere.
   ```
5. In the **Testers** tab of the track → add testers by email list or by Google Group (see `docs/play-tester-recruitment.md`)
6. Save → Review → Start rollout to Closed testing

Once the track is live, Play Console gives you a URL like:
```
https://play.google.com/apps/testing/com.nomadspeople.app
```
Send this URL to all testers (using the template in `docs/play-tester-recruitment.md` Message 3).

**From this point, the 14-day timer starts ticking** — but only once a tester is opted-in. Track the opt-in dates in a Google Sheet per the recruitment doc.

---

## 13. Apply for Production Access (day 14+)

Once you have **12+ testers opted-in for 14 continuous days:**

1. Play Console → **Dashboard** → top of page shows "Apply for production" button (was disabled before, now enabled)
2. Click → answer 3 sections:

   **Section A: About your closed test**
   - How easy was it to recruit testers? (Very easy / Easy / Moderate / Hard / Very hard)
   - Describe the engagement you received from testers during the closed test
   - Summarize the feedback collected and how you collected it

   **Section B: About your app/game**
   - Intended audience (draft: "Digital nomads aged 25-45, remote workers, long-term travelers. Global — active users in Bangkok, Lisbon, Mexico City, Tel Aviv, Bali, Berlin, Buenos Aires.")
   - How your app provides value (draft: "nomadspeople solves the #1 problem of remote workers: finding their people in a new city. Existing apps show city-level data; we show neighborhood-level, real-time. A nomad in Bangkok can see who's in Sukhumvit at 4pm and join a co-working session in 2 taps.")
   - First-year install estimate (choose range — start with 10,000-50,000)

   **Section C: Production readiness**
   - Changes made based on closed test learnings (fill at day 14 with actual changes)
   - How you decided the app is production-ready (draft at day 14: "All reported crashes resolved. Core flows (sign-up, go live on map, create activity, DM another nomad) tested across 12+ real users for 14 days. Zero data loss incidents. Privacy policy + account deletion validated by 3 independent testers.")

3. Submit → Google reviews ~7 days → email arrives with outcome

---

## 14. Promotion to Production (day 21+)

Only after Production Access is granted by Google:

1. Play Console → **Production** → Create new release
2. **Add from library** → pick the same AAB we used in Closed testing (no need to rebuild)
3. Release notes: same as Closed testing
4. Review → Start rollout to Production → set rollout percentage (start at 20% for first 24h, then 100%)

Google reviews this final submission in 1-3 days for policy compliance. The Closed test pre-clears most of this, so it's usually fast.

---

## 14. Post-launch hooks

Wire these up in Play Console after first publish:

- **Pre-launch report** — run automatically on every upload, catches crashes on real Firebase Test Lab devices
- **Android Vitals** — crash rate + ANR rate dashboards
- **Reviews** — reply to reviews from the Console (direct, doesn't need the app user's email)
- **Play Store policy updates** — subscribe to the emails so we see changes before they become violations

---

## 15. Rollback plan

If a release breaks:
1. Play Console → Production → Select release → Halt rollout
2. Previous version stays published for new installs
3. Upload a fix version (increment versionCode), submit for review
4. OTA via EAS `expo-updates` can patch JS-only bugs without a new Play build

---

## Status checklist

- [x] GP-1: Play Console account created + paid ($25 paid 2026-04-23)
- [ ] GP-1A: Android device access verified (user action — install Play Store app on any Android, sign in)
- [ ] GP-1B: Phone SMS verified (user action — Play Console → Developer account → Verification)
- [ ] GP-2: App record created (blocked by GP-1A + GP-1B)
- [ ] GP-3: First EAS Android build + SHA-1 recorded (build #2 running)
- [x] GP-4: Feature graphic ready (`assets/store/play-feature-graphic.png`)
- [ ] GP-5: 2–8 phone screenshots captured (after EAS build lands)
- [ ] GP-5A: 12+ testers recruited (see `docs/play-tester-recruitment.md`)
- [x] GP-6: Store listing copy finalized (this document)
- [x] GP-7: Data Safety answers drafted (Section 3 of this document)
- [ ] GP-8: Content rating questionnaire answered in Console (after GP-2)
- [ ] GP-9: AAB uploaded to **Closed testing** track (not Internal!)
- [ ] GP-9A: Testers opted in — 14-day clock starts when 12th opt-in happens
- [ ] GP-10: Apply for Production Access on day 14+ with 12 opted-in testers
- [ ] GP-10A: Production Access approved by Google (~7-day review)
- [ ] GP-11: Promote AAB to Production track + submit for final review
- [ ] GP-11A: Google final review passes (~1-3 days)
- [ ] **🎉 Public launch — nomadspeople live on Play Store**
