# Product Decision — One Active Checkin PER KIND (not one total)

**Date:** 2026-04-20
**Decided by:** Barak (product owner)
**Status:** Locked for the MVP / launch phase, revisitable post-launch

## The rule

A single user MAY hold at most **one active timer** AND at most
**one active scheduled status** at the same time — up to 2
active rows total per user.

This is the CURRENT behavior of `publishCheckin` in HomeScreen:
each publish expires only prior active checkins of the SAME
`checkin_type`. Cross-kind coexistence is allowed.

## Why — the primary reason

**Timers and scheduled events are two different cognitive
lanes. Collapsing them into one slot kills the weaker of the
two.**

- **Scheduled = planning-brain.** Long-form ("drinks at Gordon
  in 5 days"). One active at a time because one plan per
  horizon is enough.
- **Timer = impulse-brain.** Short-form ("I'm at coffee
  right now"). One active at a time because the user is
  physically in one place.

Each lane is useful on its own. Users who plan are NOT the
same users who show up spontaneously — often they're the
same person in different moods of the same day.

If we forced a single-slot rule ("only one active of either
kind"), a user who scheduled drinks for next Friday would be
**locked out of posting a spontaneous coffee right now** for
the next 7 days. Their choice: delete the future plan to live
in the present, or stay silent in the present to keep the
future plan. Neither is acceptable. Most users would just
delete the scheduled event — and the app loses the long-term
social value (the friend who'd have shown up next Friday).

**The per-kind rule preserves spontaneity without sacrificing
planning.** That is the single biggest reason it exists.

## Why — the secondary reason (marketing / density)

During the MVP / launch phase, cities will be sparse. Letting
each active user contribute up to 2 pins (one timer + one
scheduled) roughly doubles the perceived density for zero
extra marketing spend. Standard supply-thin bootstrap tactic.
This is NICE TO HAVE; the spontaneity argument above is the
core reason.

## Why it's technically safe

Full audit was done on 2026-04-20. Every surface that could
break under "2 active per user" was verified clean:

- **Map rendering** — each pin is a separate checkin row; two
  pins by the same user render correctly even at identical
  coords (react-native-maps stacks them).
- **CreationBubble's replace banner** — `hasActiveTimer` and
  `hasActiveScheduled` are independent flags. The banner only
  fires on SAME-kind conflicts, so cross-kind coexistence
  triggers no warning.
- **publishCheckin** — by design, only expires same-kind prior
  rows (`.eq('checkin_type', input.kind)`). Not a bug, a
  deliberate policy switch.
- **TimerBubble** — stateless per-pin; no cross-contamination.
- **Chat conversations** — each checkin creates its own
  `app_conversations` row with its own `checkin_id`, its own
  memberships, its own message stream. Independent.
- **Notifications** — per-conversation. No cross-stream
  leakage.
- **RLS / constraints** — no unique index on
  `(user_id, is_active=true)`. DB explicitly allows multiple
  active rows per user.
- **Realtime** — subscribes to all checkin changes; both rows
  broadcast normally.
- **useActiveCheckins** — returns all matching rows; both
  pins visible to peers.

## What to watch out for (not urgent, but good hygiene)

1. **Analytics reports** that compute "events per user" will
   skew higher than they would under a strict 1-per-user rule.
   Note this in dashboards so future PMs don't misread it.

2. **A future "3+ per user" request** would break assumptions.
   If that day comes, the UI will need to decide how to
   display stacked pins or switch to a list-first layout. Do
   NOT implement this incrementally without product review.

3. **Creator's profile view** currently shows all of a user's
   active events. Under "2 per kind", a profile could show 2
   simultaneous events. Observe during launch whether this
   reads as "active" or "spammy" to peers. Tune copy /
   ordering if needed.

## What this rule does NOT permit

- Multiple timers active at once (`publishCheckin` blocks via
  same-kind expire).
- Multiple scheduled events active at once (same block).
- Posting via bypass paths (admin tools, seeds) without
  respecting the rule — any future seed script or import tool
  must enforce it to keep the rule consistent.

## When to revisit

Post-launch, once we have ≥4 weeks of real data:

- Do users actually post both kinds? What % of the time?
- Does having 2 pins by the same user confuse viewers? (Open
  research: interview 5–10 users, show them a creator
  profile, ask what they infer.)
- Does the "doubled density" feeling actually correlate with
  lift in join / message rates? If not, the bootstrap argument
  loses its weight — consider dropping to 1-per-user for
  simpler mental model.

Bring data to a product review. Not before.

## Red line — do NOT change silently

A future engineer who thinks "this double-posting thing must
be a bug" and writes `.neq('user_id', userId)` without
`.eq('checkin_type', kind)` would silently break the growth
tactic. This document exists to prevent that. If you want to
remove cross-kind coexistence, read this doc first, then talk
to the product owner.
