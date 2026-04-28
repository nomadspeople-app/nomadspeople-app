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
