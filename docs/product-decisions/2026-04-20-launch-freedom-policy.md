# Product Decision — Launch Freedom Policy

**Date:** 2026-04-20
**Decided by:** Barak (product owner)
**Status:** Locked for launch v1. Revisit after 8 weeks of
real-world data.

## The principle

**Maximum user freedom at launch.** Filter only what Apple
explicitly forbids. Defer all other restrictions until
behavior data shows real harm.

## What's allowed

- All profanity (English, Hebrew, Russian — casual swearing
  is normal speech, not abuse)
- All hyperlinks
- All images (photos, screenshots, memes)
- All promotional content (if a user posts about their event,
  that's an interaction, not spam)
- All emoji combinations
- All conversational tone (sarcastic, blunt, sexual jokes
  among consenting adults, etc.)

## What's blocked (the Apple-required minimum, nothing more)

- Identity slurs (racial, ethnic, religious, gender, sexuality)
- Direct threats of violence aimed at a specific person
- Sexual content directed at a specific person without consent
  cue
- Self-harm encouragement ("kys", "תהרוג את עצמך", etc.)

That's it. Four narrow categories. Everything else flies.

## Why

**Industry precedent:** WhatsApp doesn't filter profanity.
Discord doesn't filter promotional content. iMessage doesn't
filter anything. Heavy-handed filters drive users away faster
than they protect them.

**Engagement trumps tidiness for a launch product:** With
~100-200 nomads in the first month, every blocked legitimate
message is a lost conversation. With a tight community at this
stage, peer reporting (`reportMessage`) catches what the
narrow filter misses.

**Apple compliance is satisfied:** The 4 narrow categories
above hit every checkbox in Guideline 1.2. We don't need to
be more restrictive than that.

**Data first:** After 8 weeks, we look at:
- How many `reportMessage` calls came in?
- What % were about content the filter SHOULD have caught?
- What % were about ACTUAL spam / harassment that needed
  filtering?
- If real harm patterns emerge → tighten specific dimensions.

## Scope of the moderation filter (the "lib/moderation" module)

Implementation impact: the wordlists are now NARROW, not
broad.

| List | Per language | Examples |
|---|---|---|
| `slurs/` | ~15-20 terms each (en/he/ru) | identity-targeted hate words ONLY |
| `threats/` | ~8-10 patterns (regex) each | "I will [kill\|hurt\|find\|get] you" |
| `selfharm/` | ~5-6 patterns each | "kys", "go kill yourself" |
| `sexual_directed/` | composite — pattern + @target | "@user [explicit verb]" with consent absence cues |

**Total filter footprint: ~80 entries across all 3 languages.**
Tight, focused, fast to scan, low false-positive rate.

## What this means in product terms

A user can:
- Curse freely in chat
- Share their event link in another chat
- Post a sarcastic comment about a place
- Post a meme
- Use crude humor
- Send a flirty message (consenting context implied)

A user CANNOT:
- Call someone an [identity slur]
- Threaten violence
- Send unsolicited explicit content to someone
- Encourage self-harm

## Trigger conditions to revisit this policy

After launch, ANY of these data points would justify tightening:

1. >5% of weekly active users receive a complaint via
   `reportMessage` about a single category not currently
   filtered (e.g. "lots of unsolicited DMs that aren't quite
   sexual but feel harassing")
2. App Store reviewer feedback flags a specific gap
3. Regulatory request (EU DSA, etc.)

UNTIL one of those triggers fires, the policy stays at
"maximum freedom + 4 narrow Apple-required filters."

## Red line — do NOT widen the filter on gut feeling

A future engineer or PM who thinks "let's also block
promotional links because it feels spammy" without data is
making the app less alive. Don't. Bring data, then we
discuss.
