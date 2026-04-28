I have all 11 files. Now I'll dump them verbatim per the user's specification.

═══════════════════════════════════
📄 docs/google-play-submission.md
═══════════════════════════════════

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

═══════════════════════════════════
📄 docs/play-tester-recruitment.md
═══════════════════════════════════

# Play Store Closed Testing — Recruitment Pack

**For:** Barak · **Launched:** 2026-04-23
**Goal:** Recruit 12+ testers (aim for 20-25 to cover drop-offs) who will stay opted-in to the closed test for **14 continuous days**. Once we have 12 stable opt-ins at day 14, we can apply for Production access.

---

## The 3 messages to send

### Message 1 — WhatsApp / iMessage (casual, short)

Send this to friends/family/colleagues one-on-one or in a group you already have.

**Hebrew:**

```
היי 👋

אני משיק אפליקציה שבניתי — nomadspeople. היא מפה חיה לנומאדים דיגיטליים שעובדים מכל מקום בעולם.

Google דורשת שאני ארוץ "closed test" עם 12 חברים לפני שאני יכול להשיק לציבור, ואני מחפש אנשים שיוכלו:

1. להתקין את האפליקציה על טלפון Android
2. להשאיר אותה מותקנת למשך 14 יום ברצף (לא חייב להשתמש כל יום — רק שתישאר מותקנת)
3. אם תרצו, לתת לי פידבק על מה עובד ומה לא — דרך הודעה פרטית אליי

אם אתם בעניין, שלחו לי את האימייל של Gmail שלכם (זה מה שגוגל צריכה) ואני אשלח לכם לינק התקנה.

תודה! 🙏
```

**English:**

```
Hey 👋

I'm about to launch an app I built — nomadspeople. It's a live map for digital nomads who work from anywhere.

Google requires a "closed test" with 12 friends before I can go live to the public, and I'm looking for people who can:

1. Install the app on an Android phone
2. Keep it installed for 14 continuous days (you don't need to use it daily — just leave it on your phone)
3. If you feel like it, share feedback on what works and what doesn't — via a private message to me

If you're in, send me your Gmail address (that's what Google needs) and I'll send you an install link.

Thanks! 🙏
```

---

### Message 2 — LinkedIn / Email (slightly more professional)

For colleagues, business contacts, Shos team, or anyone who'd appreciate context.

**Hebrew:**

```
שלום,

אני מבקש טובה קטנה. אני משיק בקרוב אפליקציה בשם nomadspeople — מפה חברתית לנומאדים דיגיטליים שמציגה מי נמצא בזמן אמת בעיר ובשכונה שלך.

לפני ההשקה הציבורית ב-Google Play, יש דרישה חדשה של גוגל (מנובמבר 2023) שלפיה מפתחים חדשים חייבים להריץ "closed test" עם לפחות 12 בודקים למשך 14 יום ברצף, לפני שאפשר בכלל לפרסם.

אשמח אם תוכל/י להצטרף כבודק/ת:
1. להתקין את האפליקציה על טלפון Android
2. להשאיר אותה מותקנת 14 יום (שימוש הוא בונוס — לא חובה)
3. להגיב אם יש לך תובנה או אם משהו לא עובד

אם כן, שלח/י לי את כתובת ה-Gmail שלך בתגובה או פרטית — ואני אוסיף אותך לרשימה ואשלח לינק התקנה.

תודה רבה,
ברק
```

**English:**

```
Hi,

I'm asking for a small favor. I'm about to launch an app called nomadspeople — a social map for digital nomads that shows who's around you in real time, down to the neighborhood level.

Before the public launch on Google Play, there's a new Google requirement (from November 2023) that new developers must run a "closed test" with at least 12 testers for 14 consecutive days before publishing.

I'd love it if you could join as a tester:
1. Install the app on an Android phone
2. Keep it installed for 14 days (using it is a bonus — not required)
3. Send feedback if you spot anything

If you're in, reply with your Gmail address — I'll add you to the list and send the install link.

Thanks a lot,
Barak
```

---

### Message 3 — The install instructions (send AFTER they agreed + after closed test is live)

This is the second message — send it only to confirmed testers once the closed test is live in Play Console.

**Hebrew:**

```
תודה שאתה/את בודק/ת! 🙌

הנה הוראות ההתקנה — 4 שלבים, 2 דקות:

1. פתח/י את הלינק הזה בטלפון Android:
   [הדבק כאן את הלינק מ-Play Console — Testing > Closed testing > View feedback URL]

2. לחץ/י "Become a tester"

3. לחץ/י "Download it on Google Play" — יפתח את Google Play עם דף האפליקציה

4. לחץ/י "Install" — ההתקנה רגילה לחלוטין. לצד שם האפליקציה יופיע "(לא פורסם)" או "(Unreleased)" — זה תקין, זה אומר שאתה/את בין הראשונים.

חשוב: השאר/השאירי את האפליקציה מותקנת לפחות 14 יום. אני מבטיח — אם יתגלה איזה באג או אם תרצה/תרצי להסיר — תודיע/י לי לפני ואני אדאג שזה יטופל בלי להוריד את האפליקציה.

הפידבק שלך ישלח דרך Play Store עצמו (יש אופציית "Submit feedback" בתוך האפליקציה) או ישירות אליי.

תודה ענקית!
ברק
```

**English:**

```
Thanks for being a tester! 🙌

Here are the install instructions — 4 steps, 2 minutes:

1. Open this link on your Android phone:
   [Paste the link from Play Console — Testing > Closed testing > View feedback URL]

2. Tap "Become a tester"

3. Tap "Download it on Google Play" — opens Play Store on the app's page

4. Tap "Install" — it's a normal install. You'll see "(Unreleased)" next to the app name. That's fine — means you're one of the first.

Important: Please keep the app installed for at least 14 days. If something breaks or if you want to uninstall — message me FIRST and I'll sort it out without you having to remove it.

Your feedback goes through Play Store itself (there's a "Submit feedback" option inside the app) or directly to me.

Huge thanks!
Barak
```

---

## Who to send to — checklist

Aim for **20-25 people** opted in so 12+ stay through day 14.

| Group | Target count | Notes |
|---|---|---|
| Immediate family | 2-4 | Mom, dad, siblings — most reliable |
| Close friends | 4-6 | Friends who like trying new things |
| Shos team | 3-5 | Ask at the office casually |
| Nomad community contacts | 4-6 | People Barak met through travel / co-working |
| Extended circle | 2-4 | Old classmates, ex-colleagues |
| Online communities (last resort) | — | Only if we're short on day 3 — Facebook nomad groups, Israeli dev Discord, etc. |

**Critical:** each tester needs a **Gmail** address (not outlook, not hotmail — Google requires Google accounts for Play testing). Most people have one even if they don't use it day-to-day.

---

## Tracking sheet

Keep a simple list — copy this into a Google Sheet called "nomadspeople testers":

| Name | Gmail address | Sent link? | Opted in? | Date opted in | Still in at day 14? |
|---|---|---|---|---|---|
| (example) Yossi | yossi@gmail.com | ✅ 2026-04-23 | ✅ 2026-04-23 | 2026-04-23 | ? |

When the list hits 12 with ALL opted-in for 14 continuous days, that's when we apply for Production Access.

---

## Pro tips

1. **Send the recruitment message all at once, not over days.** If we send over a week, the 14-day clock starts from the LATEST opt-in — so late testers = late clock. Batch = faster clock.

2. **Be clear about the commitment upfront.** "14 days of having the app on your phone." Don't hide it — people who agree will stay.

3. **Make a WhatsApp group of testers** after they opt in. It's easier to send updates ("v1.0.1 out, just update") and they feel like a community. Called something fun like "nomadspeople crew" or "ראשוני הנוודים".

4. **Thank testers publicly** on day 21 when we go live — in the Play Store description, Instagram, wherever. People love that.

5. **If someone accidentally uninstalls before day 14** — ask them to reinstall immediately. Google counts "continuous" opt-in, but a same-day reinstall is usually fine (Google looks at the account subscription, not the install itself).

═══════════════════════════════════
📄 docs/play-production-access-answers.md
═══════════════════════════════════

# Production Access Application — Pre-drafted Answers

**For use on Day 14+** when we click "Apply for production" in Play Console → Dashboard.

Google asks **3 sections of questions** before granting Production access for new personal accounts. This file holds pre-drafted answers so on Day 14 we don't have to write from scratch under deadline pressure. **Fill in the `{FILL}` placeholders with real data from the 14-day closed test before submitting.**

---

## Section 1 — About your closed test

### Q1.1: How easy was it to recruit testers for your app?

**Options:** Very easy · Easy · Moderate · Hard · Very hard

**Our answer:** `Moderate`

> *(Adjust on day 14 based on actual experience. "Very easy" signals strong community; "Very hard" flags that Google should look at the app. "Moderate" is the honest middle — true for most solo developers.)*

---

### Q1.2: Describe the engagement you received from testers during your closed test.

**Draft answer (420 characters — within Google's typical 500-char limit):**

```
Testers actively used the app's core flows: creating a profile, going live on the map, joining activities, and messaging other nomads 1-on-1 and in groups. Feature usage was well-distributed — {FILL: %} of testers sent at least one chat message, {FILL: %} created a check-in, {FILL: %} joined a group activity. Testers reported feedback via private Play Console feedback and direct messages to me.
```

**Fill from Supabase analytics on Day 14** — query:
```sql
-- % of testers who sent a chat message
SELECT ROUND(COUNT(DISTINCT sender_id)::numeric * 100 / {TOTAL_TESTERS}, 0)
FROM app_messages WHERE sender_id IN (SELECT user_id FROM tester_list);

-- % who created a check-in
SELECT ROUND(COUNT(DISTINCT user_id)::numeric * 100 / {TOTAL_TESTERS}, 0)
FROM app_checkins WHERE user_id IN (SELECT user_id FROM tester_list);

-- % who joined an activity
SELECT ROUND(COUNT(DISTINCT user_id)::numeric * 100 / {TOTAL_TESTERS}, 0)
FROM app_conversation_members WHERE user_id IN (SELECT user_id FROM tester_list);
```

---

### Q1.3: Summarize the feedback you received and how you collected it.

**Draft answer:**

```
Feedback came through three channels: (1) private Play Console feedback on the app's listing page, (2) a WhatsApp group of the 12+ testers for real-time issue reporting, (3) direct messages from testers to me personally. Main themes: {FILL — e.g. "Requests for additional language support", "Clearer onboarding around location permission", "Activity expiration times"}. We addressed {FILL: N} reported issues during the 14-day test via OTA updates (Expo expo-updates), all shipped to testers within 24 hours of reporting.
```

---

## Section 2 — About your app

### Q2.1: Who is the intended audience?

**Draft answer:**

```
Digital nomads — remote workers, long-term travelers, and location-independent professionals aged 25-45. Primary audience: individuals who relocate frequently (every 1-6 months) and need to connect with peers in a new city. Geographic distribution: global, with concentrations in recognized nomad hubs (Bangkok, Lisbon, Mexico City, Chiang Mai, Berlin, Tel Aviv, Buenos Aires, Bali, Medellín). Secondary audience: remote workers in their home city who want to meet others in the same lifestyle.
```

---

### Q2.2: Describe how your app provides value to users.

**Draft answer:**

```
nomadspeople solves the #1 problem of long-term travelers and remote workers: finding their community in a new city. Existing apps show city-level data (e.g. "Nomads in Berlin"); nomadspeople shows neighborhood-level data in real time — a user in Kreuzberg at 4pm can see who else is in Kreuzberg, create a co-working check-in, and connect in 2 taps. Key differentiators: real-time live-on-map presence (opt-in, reversible), neighborhood-resolution discovery, one-tap join on activities, and group chats tied to specific activities. Privacy-first: location sharing is a per-session toggle; a global "show on map" switch makes the user invisible to all others and hides the map data.
```

---

### Q2.3: How many installs do you expect in the first year?

**Our answer:** `10,000 – 50,000`

> *(Conservative realistic. Digital nomad market size is ~40M globally as of 2026; a 0.1% share in year one = 40K. If we do viral marketing well, we could exceed this; if we struggle, we undershoot. The range option gives Google context without over-promising.)*

---

## Section 3 — Production readiness

### Q3.1: What changes did you make based on closed test learnings?

**Draft answer:**

```
During the 14-day closed test we shipped {FILL: N} OTA updates addressing tester-reported issues. Top changes:
1. {FILL: e.g. "Fixed map pin flickering on low-end Android devices by memoizing marker list per CLAUDE.md"}
2. {FILL: e.g. "Clarified location permission copy after 3 testers asked what 'neighborhood visibility' means"}
3. {FILL: e.g. "Added date dividers in chat conversations"}
4. {FILL: e.g. "Reduced default activity duration from 4h to 60min — tester feedback that stale activities cluttered the map"}
5. {FILL: e.g. "Added Russian translation completeness pass after RU-speaking testers flagged 3 missing strings"}
Zero feature regressions reported by testers in the final 72 hours of the test period.
```

---

### Q3.2: How did you decide your app is ready for production?

**Draft answer:**

```
Three criteria were met by day 14:
(1) Stability — 12+ testers used the app continuously for 14 days across {FILL: X} distinct Android devices (low-end, mid-range, flagship). Crash-free rate tracked via Sentry was >{FILL: 99.5%}. Zero data-loss incidents.
(2) Compliance — GDPR consent infrastructure validated with EU-based testers (explicit opt-in at signup, audit log in app_consent_events table, working account deletion via web flow at nomadspeople.com/delete-account). Privacy policy, terms of service, and support contact all live at their respective URLs. Content moderation (block, report) tested end-to-end by 2 testers who reported one another in a dummy scenario.
(3) Value delivery — every core flow (sign up, go live on map, discover nearby nomads, create a check-in, join an activity, 1:1 chat, group chat, upload a photo) was exercised by >80% of testers. Tester sentiment via private feedback was overwhelmingly positive; main improvement areas have been addressed.
The app is production-ready.
```

---

## Day-14 execution checklist

Before clicking "Apply for production":

- [ ] Confirm 12+ testers still opted-in (Play Console → Testing → Closed testing → see tester count)
- [ ] Confirm 14 days continuous since the 12th tester opted in
- [ ] Fill in all `{FILL}` placeholders above with actual numbers
- [ ] Query Supabase for the % engagement metrics (Q1.2)
- [ ] Check Sentry dashboard for crash-free rate (Q3.2)
- [ ] Re-read each answer one last time — Google rejects vague applications
- [ ] Click Apply
- [ ] Wait ~7 days for review email

---

## If rejected — common reasons + response

**Reason 1: "Not enough testers opted in continuously for 14 days"**
- Recruit more testers. Common cause: someone uninstalled on day 13.
- Re-apply after the new testers have 14 days of continuous opt-in.

**Reason 2: "App doesn't comply with policies"**
- Read the specific policy cited. Fix it. Re-apply.
- Most common: location permission descriptions unclear (we're OK), age-rating mismatch (we said Teen which matches IARC), privacy policy missing (we're OK).

**Reason 3: "Engagement was insufficient"**
- Extend the test period. Encourage testers to use the app more actively.
- Add a reason to return — push a notification ("new nomads in your city") or a social push.
- Re-apply in 2 weeks.

Don't be alarmed by rejection — it's common and fixable. Google's review isn't punitive, it's a quality gate.

═══════════════════════════════════
📄 docs/play-policy-audit.md
═══════════════════════════════════

# Google Play Developer Policy — Audit Against nomadspeople

**Purpose:** proactively check every Play Store policy against our app BEFORE submission, so Google doesn't flag anything during review. Source of policies: [play.google/developer-content-policy](https://play.google/developer-content-policy/).

**Audit date:** 2026-04-23. Next audit: before each major release, or whenever Google publishes a policy deadline email.

---

## Summary — are we ready?

| Risk level | Count |
|---|---|
| 🟢 Compliant | 11 policies |
| 🟡 Needs attention (not blocking, but soften copy) | 2 policies |
| 🔴 Blocking | 0 policies |

**Conclusion:** submission-ready. Two copy tweaks recommended (see below) — not mandatory but prudent.

---

## 1. 🟢 User-Generated Content (UGC) — ALL required controls in place

Policy requires: reporting mechanism, blocking, moderation, published community standards.

| Requirement | Our implementation |
|---|---|
| In-app reporting for all UGC (messages, posts, profiles) | ✅ `app_reports` + `app_message_reports` tables; every message has a long-press → Report menu |
| User blocking (unable to see / contact blocked user) | ✅ `app_blocks` table; filtered in hooks.ts and group chats |
| Creator-level moderation (group creator can remove members) | ✅ `removeGroupMember()` in hooks.ts |
| Proactive content filter (server or client-side) | ✅ Profanity + slur filter inside `postEventSystemMessage` + Supabase trigger `app_moderation_events` |
| 24-hour SLA on egregious reports | ✅ Sentry alerts route to `nomadspeople1@gmail.com` with tag `report:moderation` (commit `c6e549b`) |
| Community guidelines published | ✅ `/terms` + `/privacy` + in-app Guidelines page (Settings → Community Guidelines) |

---

## 2. 🟢 Personal & Sensitive Information

Policy requires: clear disclosure, permission purposes match stated use, data handled securely.

| Requirement | Our implementation |
|---|---|
| Privacy Policy URL in store listing | ✅ `https://nomadspeople.com/privacy` |
| Policy accessible BEFORE install (Play Store listing field) | ✅ Listed in Play Console store listing |
| Policy accessible IN-APP | ✅ Settings → Privacy Policy (opens in-app webview) |
| Data Safety form matches code behavior | ✅ Cross-referenced — see `docs/google-play-submission.md` §3 |
| Consent collected for personal data | ✅ 4 consent checkboxes at signup, audit log `app_consent_events` |
| Encrypted in transit | ✅ HTTPS everywhere (Supabase, Sentry, Vercel); RLS on Supabase |
| Account deletion available | ✅ `/delete-account` web flow + in-app Settings → Delete Account |

---

## 3. 🟢 Location Data

Policy requires: foreground vs background declared accurately, permissions justified.

| Requirement | Our implementation |
|---|---|
| `NSLocationWhenInUseUsageDescription` accurate | ✅ "nomadspeople uses your location to show where you are on the map when you go live." |
| `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` declared in manifest | ✅ app.json `android.permissions` |
| Background location? | ❌ NOT requested — we only use foreground location |
| User can opt out | ✅ `show_on_map` toggle makes user invisible + stops location tracking |
| Location used only for disclosed purpose | ✅ Only for map display + proximity filtering, never sold/shared |

---

## 4. 🟢 Age Restrictions & Child Safety

Policy requires: honest content rating, 18+ enforcement if stated.

| Requirement | Our implementation |
|---|---|
| Age confirmation at signup | ✅ Required checkbox "I am 18 years or older" |
| Content rating matches actual content | ✅ Rated Teen (matches user-generated content + 1:1 messaging) |
| Not listed in Families category | ✅ We'll select Social |
| No design patterns targeting minors | ✅ No cartoonish UI, no in-app purchases, no gacha |
| Age gate can't be bypassed | ✅ Hard gate — no account is created without the checkbox |

---

## 5. 🟢 Impersonation

Policy requires: users cannot impersonate others. Our app's safeguards:

| Requirement | Our implementation |
|---|---|
| Display name restrictions | ✅ `full_name` cannot be changed after signup (prevents harassment handle-swapping) |
| Username uniqueness | ✅ Enforced at Supabase level |
| Clear ownership of content | ✅ Every message/post shows author's avatar + name |
| Flagging for impersonation | ✅ User-reporting flow covers this |

---

## 6. 🟢 Deceptive Behavior

Policy requires: app does exactly what the listing says. No hidden behavior, no malware.

| Requirement | Our implementation |
|---|---|
| App name matches actual app | ✅ `nomadspeople` everywhere |
| Icon matches actual app | ✅ New coral N icon consistent |
| Description accurate | ✅ See §11 below for one soften-the-copy note |
| No fake reviews / ratings manipulation | ✅ N/A — no rating gating features |
| No hidden ad placements | ✅ Zero ads in the app |

---

## 7. 🟢 Intellectual Property

Policy requires: all content you ship must be yours or licensed.

| Requirement | Our implementation |
|---|---|
| App name + icon owned by us | ✅ `nomadspeople` is our brand, icon designed for us |
| No copied copy from competitors | ✅ Original descriptions |
| No brand misuse (Apple, Google, Uber, Airbnb names) | ✅ We don't mention them in listing |
| All fonts used are licensed | ✅ Inter (OFL), system fonts |
| All code dependencies are licensed | ✅ All deps are MIT / BSD / Apache |

---

## 8. 🟢 Subscriptions / In-App Purchases

| Requirement | Our implementation |
|---|---|
| If using IAP, use Google Play Billing | N/A — no IAP in v1.0 |
| Free features must not be fake-locked | N/A |

If we add subscriptions post-launch, we'll need to (1) add Play Billing, (2) update Data Safety, (3) restart this audit.

---

## 9. 🟢 Safety — No Harm to Users

| Requirement | Our implementation |
|---|---|
| No stalking facilitation | ✅ Far-away banner in DM (>100 km) warns of distance; visibility is opt-in; block+report fast path |
| No doxing | ✅ Only display name + bio + social links shown — never email, phone, address |
| No incitement features | ✅ No public voting, no leaderboards that could be gamed |
| Emergency resources | 🟡 We don't currently link to crisis hotlines. **Consider adding for v1.1** — not required for launch but a signal of care |

---

## 10. 🟢 Technical Quality

| Requirement | Our implementation |
|---|---|
| targetSdkVersion meets Google's current minimum | ✅ Expo SDK 54 uses API 34 (Android 14) — above Google's Aug 2025 min of API 33 |
| AAB not APK | ✅ EAS production profile outputs AAB |
| 64-bit support | ✅ Default in RN 0.81 |
| App signing via Play App Signing | ✅ Enabled automatically on first upload |
| Apps runs on all screen sizes | ✅ React Native auto-handles; `ios.supportsTablet: true` |
| No crashes in first 30s of normal use | ✅ Closed testing will validate |

---

## 11. 🟡 Store Listing Metadata — Soften ONE phrase

**Source:** `docs/google-play-submission.md` §2 Full Description, last paragraph:

> *"Active in cities worldwide including Bangkok, Lisbon, Mexico City, Chiang Mai, Berlin, Buenos Aires, and wherever nomads roam."*

**Risk:** Google may flag this if we don't have demonstrated users in those cities at launch. The phrase "active in" is a factual claim. Review teams sometimes ask for substantiation.

**Recommended rewrite (same feel, safer):**

> *"Designed for global nomads — built for use in every major remote-work hub, from Bangkok to Lisbon to Mexico City."*

This shifts from a factual claim ("we have users there NOW") to a design/intent statement ("we built it for that").

**Action:** update `docs/google-play-submission.md` §2 + actual Play Store listing when filling. Trivial fix.

---

## 12. 🟡 Description "1-word" category keyword loading

Policy: listings cannot stuff keywords to game search. Looking at the short description:

> *"Find digital nomads near you. See who's in your neighborhood and connect."*

✅ This reads naturally. Not keyword-stuffed.

Full description has natural paragraphs. ✅ Fine.

**Soft issue:** the "3 languages at launch" claim is factual (en, he, ru). Google shouldn't push back. No change needed.

---

## 13. 🟢 App Icon — No generic / misleading icon

Icon: coral-background + hollow N ribbon with center loop. ✅ Original, distinctive, on-brand. No trademark risk.

---

## 14. 🟢 Push Notifications

| Requirement | Our implementation |
|---|---|
| Opt-in to receive (no permission bypass) | ✅ `registerForPushNotifications` checks permission, requests if needed |
| User can disable per-category | ✅ Settings has `notify_nearby`, `notify_chat`, etc. toggles |
| Notifications don't impersonate system alerts | ✅ Branded with our icon + coral |
| No excessive frequency | ✅ Rate-limited by trigger (e.g. max 1 per activity, not repeated) |
| Notifications don't contain ads | ✅ N/A |

---

## 15. 🟢 Health / Medical / Financial / Government

All N/A — we're a social/travel app, not any of these high-risk categories.

---

## Final actions before submission

### Fixed now (in the same session):
1. ✅ Updated `google-play-submission.md` §2 to soften "active in cities" → "designed for" (I'll do this next)

### To do on Day 0 (user actions):
- [ ] Android device verification via Emulator (see `docs/android-studio-emulator-setup.md`)
- [ ] Phone SMS verification in Play Console
- [ ] Create app record
- [ ] Fill store listing (use the updated copy)
- [ ] Upload icon, feature graphic
- [ ] Fill Data Safety form
- [ ] Fill Content rating questionnaire
- [ ] Upload AAB to Closed Testing

### To do on Day 14:
- [ ] Apply for Production Access (use `docs/play-production-access-answers.md`)

### To do if rejected during review:
- [ ] Read rejection email carefully
- [ ] Fix the specific issue
- [ ] Resubmit — no penalty for a single rejection, it's a normal part of the process

---

## If Google asks about something not covered here

The answer pattern for every policy question:

1. **What specific policy are they citing?** Quote it back to them.
2. **Where in our app does this apply?** Point to the specific screen or feature.
3. **What's our safeguard?** Reference our tables/flows (e.g. "report flow lives in `app_reports`, every user can access it via long-press on any UGC").
4. **Offer to demonstrate.** Provide test account + screen recording if asked.

Google reviewers appreciate direct, structured responses. Vague replies get rejected again. The `thorough` + `logic` skills in this repo exist for exactly this reason.

═══════════════════════════════════
📄 docs/android-studio-emulator-setup.md
═══════════════════════════════════

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

═══════════════════════════════════
📄 docs/google-play-screenshots-guide.md
═══════════════════════════════════

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

═══════════════════════════════════
📄 docs/app-store-metadata.md
═══════════════════════════════════

# nomadspeople — App Store Metadata
**Prepared:** April 9, 2026
**Status:** Ready for submission when Apple Developer account activates

---

## APP IDENTITY

- **App Name:** nomadspeople
- **Bundle ID:** com.nomadspeople.app
- **Version:** 1.0.0
- **Contact Email:** support@nomadspeople.com (ImprovMX forwards to team inbox)
- **Privacy Policy URL:** https://nomadspeople.com/privacy
- **Terms of Service URL:** https://nomadspeople.com/terms
- **Support URL:** https://nomadspeople.com/support
- **Account Deletion URL:** https://nomadspeople.com/delete-account

---

## APPLE APP STORE

### Subtitle (30 chars max)
Find Your People Anywhere

### Keywords (100 chars max)
digital nomad,remote work,travel,coliving,coworking,expat,nomad community,meetup,neighborhood

### Category
- **Primary:** Travel
- **Secondary:** Social Networking

### Promotional Text (170 chars max — can be updated without new build)
See who's in your neighborhood right now. nomadspeople is the real-time map for digital nomads to find each other and connect wherever they land.

### Description (4,000 chars max)
nomadspeople helps digital nomads find their people — not just a city, but a neighborhood.

See who's around you in real-time on the map. Join local activities. Connect with people who actually get the lifestyle. Whether you just landed or you've been here for months, nomadspeople shows you who's already nearby.

HOW IT WORKS

Go live on the map to show your neighborhood. Browse who's around you. Tap any pin to see their profile, what they do, and how long they're staying. It's like having a local network everywhere you go.

FIND YOUR PEOPLE

Browse nomads by neighborhood, not just city. See who's within walking distance. Filter by interests, profession, or travel style. Connect with people who are actually near you right now — not on the other side of town.

JOIN ACTIVITIES

Coworking sessions, dinners, hikes, weekend trips, language exchanges — join activities created by nomads in your area, or create your own. No more searching Facebook groups or hoping to bump into someone at a cafe.

REAL-TIME MAP

The map shows every nomad who's currently live in your area. Density is the feature — see at a glance which neighborhoods have the most nomads right now. Zoom into any neighborhood to see who's there.

PRIVACY FIRST

Go invisible anytime with one tap. When you're off the map, nobody can see you — and you can't see them. Your location is neighborhood-level, never exact. You're always in control.

FEATURES
• Live real-time map showing nomads in your neighborhood
• Create and join local activities (coworking, social, trips)
• Direct messaging and group chats
• Profile with your story, profession, and travel style
• Nomad count by neighborhood — see where the community is
• 3 languages at launch: English, Hebrew, Russian (more coming)
• Works worldwide — wherever digital nomads go

BUILT FOR NOMADS, BY NOMADS

nomadspeople was built because finding your people in a new city shouldn't be this hard. No algorithms, no feeds, no noise — just a map showing who's nearby and a simple way to connect.

Currently active in cities worldwide including Bangkok, Lisbon, Mexico City, Chiang Mai, Berlin, Buenos Aires, and everywhere nomads roam.

---

## GOOGLE PLAY STORE

### Short Description (80 chars max)
Find digital nomads near you. See who's in your neighborhood and connect.

### Full Description
(Same as Apple description above)

### Feature Graphic
- **Size:** 1024x500px
- **Status:** NEEDS CREATION
- **Content:** App name + tagline + map visual on brand color (#E8614D)

---

## CONTENT RATING

> **2026 UPDATE:** Apple rolled out a new granular age rating system
> (4+, 9+, 13+, 16+, 18+). The deadline for answering the new
> questions was **January 31, 2026** — past that, new submissions
> are blocked until we answer. We'll answer at App Store Connect
> record creation. Google Play uses IARC questionnaire (same answers
> map to Teen on Play Store).

### Expected Ratings (under new 2026 system)
- **Apple:** **17+** (user-generated content, unrestricted communication, shared user location)
  - Prior system said 12+; new 13+/16+/18+ options changed the math — we must choose 17+ under the new rating questions because UGC + location sharing + 1:1 private messaging combined pushes us above 16+
- **Google Play:** **Teen** (same underlying behavior, different label system — IARC questionnaire)
- **Self-declared minimum age (in Terms + signup consent):** 18

### Rating Questionnaire Answers (unchanged — same truthful answers, both stores)
- Violence: None
- Sexual content: None
- Profanity: None — but "unrestricted web access / user-to-user communication" = Yes (bumps the rating up)
- Drugs/alcohol: None
- Gambling: None
- User-generated content: Yes
- Users can communicate (1:1 and groups): Yes
- Location sharing: Yes (opt-in via "show me on map" toggle)
- Account required: Yes (18+ enforced at signup)
- Contests/prizes/sweepstakes: No
- Unrestricted web access: No (there are no open web browser views inside the app)

---

## APPLE PRIVACY NUTRITION LABELS

### Data Collected
| Data Type | Purpose | Linked to Identity |
|-----------|---------|-------------------|
| Precise Location | App Functionality | Yes |
| Email Address | App Functionality | Yes |
| Name | App Functionality | Yes |
| Photos | App Functionality | Yes |
| User Content (posts, messages) | App Functionality | Yes |
| User ID | App Functionality | Yes |
| Device ID (push tokens) | App Functionality | Yes |
| Crash Data | Analytics | No |

### Data NOT Collected
- Payment info (no in-app purchases yet)
- Health data
- Browsing history
- Search history
- Contacts
- Advertising data

---

## DEMO ACCOUNT FOR APPLE REVIEW

- **Email:** demo@nomadspeople.com
- **Password:** (to be set)
- **Notes for reviewer:** "This app requires location access to show your position on the map. For testing, the demo account is pre-positioned in Tel Aviv. You can browse other nomads on the map, view profiles, and join activities."

---

## REVIEW NOTES FOR APPLE

"nomadspeople is a real-time map-based social app for digital nomads. Users go live on the map to show their neighborhood, browse other nomads nearby, join activities, and chat. The app requires location permission to place the user on the map. A demo account is provided with pre-set location data for review purposes. The app connects to Supabase (PostgreSQL) for backend services."

═══════════════════════════════════
📄 docs/store-compliance-audit.md
═══════════════════════════════════

# nomadspeople — Store Compliance Audit
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
- **Required declarations for nomadspeople:**
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
- **Note:** No longer mandatory as exclusive login (changed January 2024), but nomadspeople already has it (expo-apple-authentication plugin in app.json)
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

═══════════════════════════════════
📄 docs/2026-04-22-pre-launch-sprint.md
═══════════════════════════════════

# 2026-04-22 — Pre-Launch Sprint Day

**Status:** Complete · **Owner:** Barak Perez · **Duration:** ~12 hours ·
**Outcome:** 43 commits deployed to production after 3 weeks of
accumulated work; `nomadspeople.com` serving the new codebase end-to-end.

---

## Why this day existed

Three weeks of code had accumulated on `main` without reaching production.
The landing page at `nomadspeople.com` was still serving a Lovable-built
neighborhoods page from April 1st. App Store submission was blocked because
`/support`, `/privacy`, `/delete-account`, and the `nomadspeople` rebrand
were all committed but invisible to any visitor. The sprint resolved every
layer of that gap — code, database, infrastructure, and domain — so that
the next morning we can ship to Apple.

Every change here follows Rule Zero (see `CLAUDE.md`): no band-aids, no
per-screen patches, no cosmetic rewrites. Every item is end-to-end or it
doesn't count.

---

## Work log by area

Five parallel streams closed today, summarised below. The detail sections
that follow each table tell you exactly where to look, what commit
introduced it, and how to verify it lives.

### 1 — Public web (`nomadspeople.com`)

| Item | File / commit | How to verify |
|---|---|---|
| New landing page ("Find your people, anywhere.") with Download CTA | `web/src/pages/LandingPage.tsx` — `a925016` | `nomadspeople.com/` shows the orange CTA |
| `/support` — FAQ + contact for Apple 1.2 | `web/src/pages/SupportPage.tsx` — `a925016` | `nomadspeople.com/support` shows "We're here to help" |
| `/privacy` — GDPR-compliant policy (10 third-party processors, Version 2026-04-22) | `lib/legal/content.ts` + `web/src/pages/PrivacyPage.tsx` — `f656a38` | Footer of `/privacy` reads `Version 2026-04-22` |
| `/terms` — Terms of Service with age, one-account, anti-impersonation clauses | `lib/legal/content.ts` — `f656a38` | `/terms` loads with "Welcome to nomadspeople" section |
| `/delete-account` — real magic-link deletion flow | `web/src/pages/DeleteAccountPage.tsx` + `lib/accountDeletion.ts` — `fdb2c2b` | Enter email, confirm post-link, verify user row removed in Supabase |
| Rebrand "NomadsPeople" → "nomadspeople" across all web surfaces | `web/index.html`, meta tags, React copy — `99c1e5f` | Every `<title>` now reads "nomadspeople" lowercase |
| 307 redirect apex → www | Vercel domain configuration | `curl -I nomadspeople.com` shows 307 → `www.nomadspeople.com` |

### 2 — Mobile app (Expo SDK 54)

| Item | File / commit | How to verify |
|---|---|---|
| Phase 2 geo gate — foreign viewers see only first 8 nomads, rest blurred | `lib/geo.ts` (`useViewerCountry`), `components/NomadsListSheet.tsx` — `a925016` | Mock a foreign location, open nomads list, row #9+ blurred |
| Phase 3 join gate — Join button disabled for foreign viewers | `components/TimerBubble.tsx`, `components/ActivityDetailSheet.tsx` — `a925016` | Outside home country, tap Join → disabled state |
| Consent infrastructure — 4 checkboxes at signup (age, terms, privacy, marketing) | `screens/AuthScreen.tsx` + `app_consent_events` table — `f656a38` | Sign up new user, check `app_consent_events` for 3 rows |
| Shared account deletion module — one procedure used by mobile Settings and web | `lib/accountDeletion.ts` (new), `lib/hooks.ts` (refactored) — `fdb2c2b` | Call deleteAccount from Settings, then try web flow — both remove same data |
| Sentry integration — EU Frankfurt region, PII filter, `__DEV__` skipped | `lib/sentry.ts` (new), `app.json` | `__DEV__` build: no events; production build: events in Sentry EU dashboard |
| Removed `http://ip-api.com` (iOS ATS violation) | `lib/locationServices.ts` — `a925016` | `grep -r "ip-api" lib/` returns nothing |
| Removed Google Translate unofficial endpoint | `screens/ChatScreen.tsx` — Phase A | `grep -r "translate.googleapis" .` returns nothing |
| Full locale coverage — every user-facing string via `t()`, 8 languages | `lib/translations/*.ts` | `tsc --noEmit` clean; parity script passes |
| Rebrand "NomadsPeople" → "nomadspeople" (51 files: splash, app.json, display name, copy) | `99c1e5f` | `grep -rE "NomadsPeople" --include='*.ts' --include='*.tsx' --include='*.json'` returns only historical docs |

### 3 — Backend (Supabase project `apzpxnkmuhcwmvmgisms`, region eu-central-1)

| Item | Migration | How to verify |
|---|---|---|
| Tightened RLS on `app_conversations` — dropped permissive policy, added precise read/write policies, allowed group creator SELECT for RETURNING clauses | `tighten_app_conversations_rls`, `fix_app_conversations_insert_for_groups`, `fix_group_insert_returning_select` | Create group conversation; confirm creator can insert+select, outsider cannot |
| Tightened RLS on `flight_groups`, `flight_members`, `flight_sub_groups` | `tighten_flight_rls` | Two test users, only members see their group data |
| Enabled RLS on 10 shared-project tables (`city_*`, `neighborhoods`, `pulse_*`) previously open | `enable_rls_on_nonapp_tables` | Supabase Advisors shows 0 ERRORS |
| Storage bucket listing made private | `drop_public_bucket_listing` | Anonymous `SELECT` on `storage.objects` returns 0 |
| Consent fields + audit table | `add_consent_fields_and_events` — 7 columns on `app_users`, plus new `app_consent_events` table | After signup, 3 rows appear in `app_consent_events` (age_verified, terms_accepted, privacy_accepted) |
| Message reporting policy (Apple 1.2) | `add_app_message_reports_insert_policy` | From two accounts, one reports the other; `app_message_reports` row exists |
| `createOrJoinStatusChat` refactor — `created_by = auth.uid()`, checkin_id dedup | `lib/hooks.ts` — `43bf...` → fdb2c2b | Two users checking into same place share one conversation; `created_by` is inserter |

Advisors at EOD: 0 ERRORS / 0 WARNS. We started the day with 9 / 11.

### 4 — Infrastructure (Vercel, Git, Sentry)

| Item | Detail | How to verify |
|---|---|---|
| Vercel project `nearby-discovery-pro` reconnected to the real repo `flippermaps-hash/nomadspeople-app` | Disconnected from old `flippermaps-hash/nearby-discovery-pro`, reconnected via GitHub OAuth | Vercel Settings → Git shows the correct repo |
| Git commit author set to `flippermaps-hash <261786837+flippermaps-hash@users.noreply.github.com>` for this repo | `git config user.email` local to this repo | Last commit's `%ae` matches the noreply format |
| Vercel Root Directory set to `web` | Vercel Settings → Build & Deployment | Vercel picks up `web/package.json` at build time |
| Build script split — `"build": "vite build"`, `"typecheck": "tsc -b"` separate | `web/package.json` — `1207286` | `npm run build` from `web/` completes without `tsc -b` |
| `lib/tsconfig.json` added — platform-neutral, stops esbuild from climbing to the Expo root tsconfig during web build | `lib/tsconfig.json` — `894df5d` | With `node_modules/expo` temporarily removed at repo root, `vite build` in `web/` still succeeds |
| Domain `nomadspeople.com` migrated from `nomadspeople-web` (Lovable neighborhoods project, untouched) to `nearby-discovery-pro` | Vercel Domains UI | Domains list under `nearby-discovery-pro` includes `nomadspeople.com` (apex) + `www.nomadspeople.com` + `.vercel.app` |
| Production deployment `4KjkTvjK4` — Ready, 16s build, branch `main`, commit `894df5d` | Vercel Deployments | `Current` badge on that deployment row |
| Sentry DSN wired, region EU | `app.json` + `lib/sentry.ts` | Trigger test error in prod build, confirm event in Sentry EU dashboard |

### 5 — Documentation (in-repo)

| File | Purpose |
|---|---|
| `docs/product-decisions/2026-04-22-privacy-security-master-spec.md` | 500-line privacy/security master spec covering GDPR Art. 6/7/15–22/33, Apple 1.2 + 5.1.1(v), and every third-party processor touched |
| `docs/incident-response.md` | Full breach-response plan aligned with GDPR Article 33 (72h DPA notification, Article 34 user notification, 5-channel detection, triage/contain/preserve/notify/review workflow) |
| `docs/2026-04-22-pre-launch-sprint.md` | This file |

---

## Today's commits (chronological, on `main`)

All commits authored as `flippermaps-hash <261786837+flippermaps-hash@users.noreply.github.com>`. Branch: `main`. Pushed to both `origin` (`nomadspeople-app/nomadspeople-app`) and `fh` (`flippermaps-hash/nomadspeople-app`).

| Hash | Subject | Area |
|---|---|---|
| `a925016` | Pre-launch wave: geo gates Phase 2+3, Sentry EU, web routes fix, RLS hardening, locationServices ATS fix, support page | App + Web + Backend |
| `fdb2c2b` | Fix /delete-account: actually delete after magic-link confirm; share logic with mobile via lib/accountDeletion | Web + Mobile |
| `99c1e5f` | Rebrand to all-lowercase 'nomadspeople' across all user-facing surfaces | App + Web |
| `c51f580` | Add vercel.json SPA rewrite — fixes /support and other client-side routes | Infra |
| `f656a38` | Phase A: privacy/security foundation — consent + GDPR policy + breach response + vercel SPA fix | Compliance |
| `1207286` | fix(web): split tsc from build — Vercel no longer blocked on parent tsconfig | Infra |
| `894df5d` | fix(web build): add lib/tsconfig.json to stop esbuild from climbing to root | Infra |

These chain fast-forward. `origin/main` and `fh/main` agree at EOD.

---

## The deploy saga — 6 layers of failure fixed in order

This sprint spent its last 3 hours diagnosing why a successful `git push`
never translated into a live site. The debugging was non-trivial and
documenting it here will save the next person a day.

1. **Wrong repo.** Vercel project `nearby-discovery-pro` was connected to
   `flippermaps-hash/nearby-discovery-pro` (stale), not
   `flippermaps-hash/nomadspeople-app`. Pushing to our repo did nothing.
2. **Author mismatch.** After reconnecting, deploys entered `Blocked`
   status. Vercel Hobby requires every commit's author email to map to a
   real GitHub account; our commits carried `flippermaps-1357@...` which
   doesn't exist. Fixed by setting this repo's `user.email` to the actual
   noreply address (`261786837+flippermaps-hash@users.noreply.github.com`)
   and amending the HEAD of `fh/main` with `--reset-author`.
3. **Root directory wrong.** With auth fixed, the build started and
   immediately failed with `vite: command not found` (exit 127). The
   project is an Expo repo with the web app in `web/`; Vercel was running
   at the repo root where Vite isn't installed. Set Root Directory to
   `web`.
4. **`tsc -b` against a parent Expo tsconfig.** Build got further —
   through `tsc -b` — which then failed on `../tsconfig.json` because it
   extends `expo/tsconfig.base` and Expo isn't in `web/node_modules`.
   Removed `tsc -b` from the build script (kept as a separate
   `typecheck` script).
5. **esbuild walks up the same way `tsc` did.** `vite build` alone *also*
   failed because esbuild walks upward from every `.ts` file looking for
   a tsconfig. When it hit `lib/accountDeletion.ts` (imported by the web's
   delete-account page), it found `../tsconfig.json` and the Expo
   extension broke it. Fixed by adding `lib/tsconfig.json` —
   platform-neutral, self-contained — so esbuild stops at `lib/` and
   never reaches the root.
6. **Domain on the wrong project.** With the deploy finally `Ready`,
   `nomadspeople.com/` still served the old Lovable neighborhoods site.
   There are three Vercel projects in this team; the apex domain was
   attached to the neighborhoods project (`nomadspeople-web`), not ours.
   Removed from there, added here.

Lesson for future: always check (a) the connected repo, (b) the root
directory, (c) the commit author, and (d) the domain attachment before
debugging any build output. In this case the build was correct *and*
shipped long before the apex domain pointed at it.

---

## State at end of day

**Live and verified from the browser:**
- `nomadspeople.com/` — new landing page
- `nomadspeople.com/support` — FAQ + contact
- `nomadspeople.com/privacy` — GDPR policy v2026-04-22
- `nomadspeople.com/terms` — Terms v2026-04-22
- `nomadspeople.com/delete-account` — magic-link flow
- apex → www 307 redirect confirmed

**Live but not yet user-tested:**
- Mobile geo gate Phase 2 / Phase 3 (code verified, runtime to be confirmed on TestFlight)
- Sentry event ingestion (DSN wired, first event still pending)
- Consent event insertion at signup (code verified, runtime to be confirmed with a fresh account)

**Pending (not done today, not blocking Apple submission):**
- Apple + Google Sign-In decision (task #40)
- Verify `support@nomadspeople.com` email forwarding once ImprovMX DNS
  has propagated (task #42)
- Custom SMTP (Resend) for branded emails
- Email preferences screen in Settings
- GDPR Article 20 data export
- Admin moderation dashboard

---

## Opening the roadmap next session

Anyone resuming work should:

1. Read this file first — it's the single source of truth for what was
   shipped today.
2. Check `docs/product-decisions/2026-04-22-privacy-security-master-spec.md`
   for the privacy/security contract we're operating under.
3. Consult `CLAUDE.md` for Rule Zero and the locked flows.
4. For any infrastructure work, read the "deploy saga" section above
   before touching Vercel, Git, or tsconfig files.

The project is ready for Apple + Google Play submission once the
Sign-In decision (task #40) is made and a TestFlight build passes a
final smoke test.

═══════════════════════════════════
📄 app.json
═══════════════════════════════════

{
  "expo": {
    "name": "nomadspeople",
    "slug": "nomadspeople-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#FC6B69"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.nomadspeople.app",
      "buildNumber": "1",
      "usesAppleSignIn": true,
      "config": {
        "usesNonExemptEncryption": false
      },
      "infoPlist": {
        "CFBundleDevelopmentRegion": "en",
        "CFBundleAllowMixedLocalizations": true,
        "CFBundleLocalizations": [
          "en",
          "he",
          "ru"
        ],
        "NSLocationWhenInUseUsageDescription": "nomadspeople uses your location to show where you are on the map when you go live.",
        "NSPhotoLibraryUsageDescription": "nomadspeople needs access to your photos so you can choose a profile picture or share images in group chats.",
        "NSPhotoLibraryAddUsageDescription": "nomadspeople may save images you share from the app.",
        "NSUserTrackingUsageDescription": "nomadspeople uses anonymous usage stats to improve the app. Your chats, profile, and location are NEVER tracked across other apps."
      }
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "nomadspeople uses your location to show where you are on the map when you go live."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#FC6B69",
          "defaultChannel": "default",
          "sounds": []
        }
      ],
      "expo-tracking-transparency",
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.622916189529-1hqs52vr20nd6h72ca5pf5o86i9k83kl"
        }
      ],
      [
        "@sentry/react-native/expo",
        {
          "organization": "nomadspeople-o7",
          "project": "nomadspeople-mobile",
          "url": "https://de.sentry.io/"
        }
      ]
    ],
    "locales": {
      "en": "./locales/en.json"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FC6B69"
      },
      "package": "com.nomadspeople.app",
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSyCP1Nw0W0N5pnHcHSoYMU_2YAIyWR2E19E"
        }
      },
      "edgeToEdgeEnabled": true,
      "permissions": [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "com.google.android.gms.permission.AD_ID"
      ],
      "predictiveBackGestureEnabled": false,
      "versionCode": 14
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "f7b98f05-2cda-4e34-8ea2-b1782649d5e3"
      },
      "sentry": {
        "dsn": "https://d0c5b1eec5c2b670b845ce487da0496f@o4511258504658944.ingest.de.sentry.io/4511258513702992"
      },
      "auth": {
        "// appleEnabled / googleEnabled": "Feature flags that gate the Apple / Google sign-in buttons in AuthScreen. Flip to true AFTER the Apple Developer + Google Cloud + Supabase Provider configuration is complete (see docs/2026-04-22-apple-google-signin.md). Until then the buttons stay hidden so we don't ship a non-working CTA.",
        "appleEnabled": false,
        "googleEnabled": true,
        "// googleWebClientId": "OAuth 2.0 Web Client ID — listed in Supabase Dashboard → Auth → Providers → Google → Client IDs (this one is the one paired with the Client Secret). Filled in 2026-04-22 from the 'NomadsPeople Production' OAuth client in nearby-discovery-pro Google Cloud project.",
        "googleWebClientId": "622916189529-9plps2f4omirhkv7p88gi6237622mfoe.apps.googleusercontent.com",
        "// googleIosClientId": "OAuth 2.0 iOS Client ID. GoogleSignin.configure uses this on iOS so the ID token's audience is iosClientId — Supabase has this same iosClientId added to its Authorized Client IDs list, so the audience check passes.",
        "googleIosClientId": "622916189529-1hqs52vr20nd6h72ca5pf5o86i9k83kl.apps.googleusercontent.com"
      }
    },
    "owner": "nomadspeople",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/f7b98f05-2cda-4e34-8ea2-b1782649d5e3"
    }
  }
}

═══════════════════════════════════
📄 eas.json
═══════════════════════════════════

{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "staging",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": {
        "SENTRY_DISABLE_AUTO_UPLOAD": "true"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}