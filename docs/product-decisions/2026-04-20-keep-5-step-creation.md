# Product Decision — Keep the 5-step Creation Flow

**Date:** 2026-04-20
**Decided by:** Barak (product owner)
**Status:** Locked until user-behavior data justifies re-evaluating

## What was proposed

During the 2026-04-20 audit pass, I flagged the CreationBubble's
5-step WHAT → WHEN → WHERE → WHO → PUBLISH flow as "heavy" —
users who want to post a quick "coffee now" still have to tap
"continue" 4 times even though every default is already correct
(GPS location, profile age range, "now" / 60m duration,
"open to all").

I proposed flattening to a single-screen design with a preview
strip + "publish" button + an "options" link that expands the
existing steps as an accordion. Would have reduced a quick post
from 5 taps to 1 tap.

## What was decided

**Keep the 5-step flow. Do NOT flatten.**

Barak's reasoning:
- The process itself is part of the product — users feel they
  "built something" rather than "filled a form"
- Wants to give users room to **discover** and **explore** each
  decision deliberately (the "surprise" of finding out what
  WHEN / WHERE / WHO mean on first use)
- Prefers to let actual usage data surface the real friction
  before inventing a solution to an assumed one

## Why this matters for future engineers

If you see this flow and think "this is heavy, let me flatten
it" — STOP. This decision was made deliberately. The product
owner wants the step-by-step experience as-is. You may re-open
the conversation IF AND ONLY IF one of the following is true:

1. User-behavior analytics show a drop-off rate > 25% between
   steps — i.e., people genuinely abandoning mid-flow.
2. Explicit product-owner request to revisit, with behavior
   data in hand.
3. A new requirement (e.g., app-wide redesign) forces a
   revisit.

In the absence of any of the above, the 5-step flow is the
product. Don't "quietly improve" it.

## What's still valid to change

These are orthogonal to the flow structure — still fair game:

- **Visual refinements inside each step** (typography, spacing,
  colors) — welcome, same constraints as anywhere in UX.
- **Reducing cognitive load within a step** (better labels,
  clearer state indicators, haptics) — welcome.
- **Fixing bugs** in the flow (e.g., default not loading from
  profile — that was fixed in #AgeRangeControl refactor).
- **i18n completeness** — every step must still use `t()`.

What's NOT fair game without revisiting this decision:

- Skipping steps
- Auto-advancing past steps that show only defaults
- Collapsing steps into one screen
- Adding a "quick publish" button that bypasses steps
- Adding a "detailed mode vs quick mode" toggle

## When to revisit

Post-launch, once we have ≥2 weeks of real user data:
- What % of users complete all 5 steps?
- How long does each step take on average?
- Are there steps where users just tap "continue" without
  touching any control? (That's the "default lockstep" signal
  that the step is redundant to them.)
- Does retention differ between users who customize the
  defaults vs. those who just flow through?

Bring those numbers to the next product review. Not before.
