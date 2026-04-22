# Product Decision — Moderation Severity Level

**Date:** 2026-04-20
**Decided by:** Barak (product owner)
**Status:** Locked for launch v1. Revisit after 4+ weeks
  of real abuse-attempt data.

## ⚠️ Updated 2026-04-20 (later same day) — Scope narrowed

The original filter scope (profanity + slurs + threats +
spam) was rejected by the product owner: "curses are part
of conversation, not threats. give the user a free hand."

**New scope — minimum required by Apple Guideline 1.2 only:**

- ❌ Hate speech / slurs (n-word, racial / homophobic /
  religious targeting)
- ❌ Direct threats ("I'll kill you", "אני אהרוג אותך")
- ❌ Sexual content directed at a specific person
- ❌ Self-harm encouragement ("kys", "תהרוג את עצמך")
- ✅ Casual profanity ("fuck", "shit", "באסה", "блять") —
  ALLOWED, normal speech
- ✅ Links — ALLOWED
- ✅ Images — ALLOWED
- ✅ Promotional content — ALLOWED (if it's an actual event,
  that's a feature, not spam)

The Level 2 escalation policy below STILL applies, just
fires less often because the filter is narrower.

---

## The rule

**Level 2 — "Soft warnings, escalate to rate limit on
repeat."**

Specifically:
- Flagged attempt #1 in a 24-hour window → polite Alert
  ("your message may violate community guidelines, please
  rephrase"), no penalty.
- Flagged attempts #2 and #3 in same window → same polite
  Alert, no penalty.
- Flagged attempt #4 in same window → stronger Alert
  ("you've been temporarily limited from sending messages
  for 1 hour") + `app_profiles.send_blocked_until` set to
  `now() + 1 hour`.
- After the hour expires, user returns to normal state
  automatically. The daily counter resets at each rolling
  24-hour window.

All flagged attempts are logged in `app_moderation_events`
with content hash (not plaintext) + matched term + category,
for admin review and false-positive tuning.

## Why this level

During launch, two risks are asymmetric:

- **False positive** (filter catches a legit user) — HIGH
  impact. Early user base is small and every loss matters
  100× more than in steady state.
- **False negative** (troll slips through filter) — LOW
  impact. User base at launch is ~100–200 curated nomads,
  cohort integrity is still strong, peer reporting
  (`reportMessage`) catches slippage.

Given the asymmetry, Level 2 is the right tradeoff:
- Soft on individual mistakes (forgiving language typos,
  angry-moment misphrasings, etc.).
- Firm on repeat offenders (the 4th flag shows intent).
- Proportional — no "infinite strikes" (Level 1) nor
  "instant ban" (Level 4).

## Why this passes Apple App Store review (Guideline 1.2)

Apple's UGC requirements check for a CREDIBLE mechanism,
not a specific severity. Level 2 satisfies all four
Apple 1.2 criteria:

1. Proactive filter at send-time ✓ (scanText gate).
2. Reporting mechanism ✓ (reportMessage exists).
3. User-blocking ability ✓ (blockUser + rate limit).
4. Published contact info — fulfilled by Part 2.4
   (support URL on App Store Connect).

App Store reviewers test social apps by sending provocative
content. Level 2 plays well here: reviewer sends 1–3 bad
messages → sees warnings → sends a 4th → sees the hour-long
rate limit kick in → understands we have real escalation.
"Instant ban" (Level 4) would actually look MORE suspicious
to a reviewer ("are you over-filtering legit users?").

## What to watch post-launch

After 4 weeks of production data, pull these numbers:

1. How many moderation events fired total?
2. What % of users triggered ≥1?
3. What % escalated to rate limit (the 4th flag)?
4. Of rate-limited users, what % sent a flagged message
   AFTER the hour-long cooldown?
5. False positive rate estimate: sample 50 random events,
   manually review if the match was legitimate.

Decision triggers:
- If false positive rate > 20% → tune word list down.
- If >2% of users hit rate limit weekly → Level 2 may be
  too loose; consider bump to Level 3 (escalating
  durations).
- If troll reports (`reportMessage`) spike despite rate
  limit → peer moderation isn't keeping up; upgrade to
  Level 3 or add server-side OpenAI Moderation API.

## Red line — do NOT change without data

A future engineer or PM who thinks "let's make this harsher"
without the above numbers will be deleting legitimate users.
This decision is data-driven and any change must be
data-driven too.

If reviewer data from real operation suggests Level 3/4, that's
a product decision to escalate. The change is simple: tune the
threshold in `lib/moderation/index.ts` (one constant).
