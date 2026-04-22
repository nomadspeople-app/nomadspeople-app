# Analytics Plan — Two Worlds, One Person

**Status:** Planning document. Not built yet. Do not delete;
it's the blueprint for the analytics pass that follows launch.

**Created:** 2026-04-20
**Product owner:** Barak

---

## The Thesis

Every active user on nomadspeople is actually two users
cognitively, depending on the moment:

- The **Scheduler** — the version of them planning next
  Friday's drinks, three days out.
- The **Impulsive** — the version of them sitting in a cafe
  right now, wanting someone to show up in 20 minutes.

The product allows each user one active pin per cognitive
lane (one timer + one scheduled — see
`docs/product-decisions/2026-04-20-one-active-per-kind.md`).
The analytics must reflect this structural split.

**The big hypothesis:** users who engage BOTH lanes ("hybrid")
retain longer and refer more peers than users who stick to
one lane. If true, the whole growth strategy points toward
making the second lane easy to discover for single-lane users.

To test the hypothesis, we must measure each lane independently
AND measure the cross-lane interaction as a first-class metric.

---

## Three Dashboards

### Dashboard A — The Scheduler

Audience: users who have posted ≥1 scheduled event in the
trailing 30 days.

Key metrics:

| Metric | Formula | Why |
|---|---|---|
| Scheduled events per user / month | count(status) / MAU_scheduler | Planning frequency |
| Lead time distribution | histogram(scheduled_for - created_at) | Are they last-minute or long-horizon? |
| Categories | pct(nightlife \| coffee \| outdoors \| …) | What gets scheduled? |
| Join rate | count(scheduled with ≥1 other member) / total | Does anyone actually come? |
| Member attachment lead | histogram(joined_at - created_at) | How early do joiners commit? |
| Cancellation rate | count(status ended before scheduled_for) / total | Flakiness signal |
| Repeat pattern detection | users with same weekday + category weekly | Power-schedulers |
| No-show estimate | TBD — needs in-chat "here" signal | Trust signal |

### Dashboard B — The Impulsive

Audience: users who have posted ≥1 timer in the trailing 30
days.

Key metrics:

| Metric | Formula | Why |
|---|---|---|
| Timers per user / week | count(timer) / WAU_impulsive | Spontaneity frequency |
| Duration distribution | histogram(duration_minutes) | 30m? 60m? all-day? |
| Hour-of-day distribution | histogram(hour(created_at)) | When do people get impulsive? |
| Day-of-week distribution | histogram(dow(created_at)) | Weekday vs weekend |
| Time-to-first-join | median(first_join_at - created_at) | Liquidity |
| Abandonment rate | count(timer expired with 0 joiners) / total | Dead-pin rate |
| Same-location repeat | count(users posting same geohash ≥3 times) | Regulars vs explorers |
| Geographic spread | heatmap by geohash | Where do impulses fire? |

### Dashboard C — The Hybrid (the strategic one)

Audience: ALL active users, split by archetype.

Key metrics:

| Metric | Formula | Why |
|---|---|---|
| Archetype distribution | pct(scheduler_only \| impulsive_only \| hybrid \| lurker) | Baseline shape |
| Archetype by tenure | archetype × weeks_since_signup | Do people move toward hybrid over time? |
| Time-to-first-hybrid | median days from signup to first "both active" moment | Onboarding signal |
| Retention by archetype | D1/D7/D30 retention × archetype | THE big question |
| Referrals by archetype | avg invites sent × archetype | Network growth |
| Churn by archetype | % inactive for 14 days × archetype | Leak locations |
| Archetype flip rate | users who moved from scheduler_only → hybrid (or vice versa) per week | Natural conversion |
| LTV by archetype | revenue (if any) × archetype | Eventual monetization |

---

## Archetype Classification

A single SQL function to label every user. Baseline rule:

```sql
CREATE OR REPLACE FUNCTION app_user_archetype(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  WITH activity AS (
    SELECT
      count(*) FILTER (WHERE checkin_type = 'timer')  AS timers,
      count(*) FILTER (WHERE checkin_type = 'status') AS statuses
    FROM app_checkins
    WHERE user_id = p_user_id
      AND created_at > now() - interval '30 days'
  )
  SELECT CASE
    WHEN timers = 0 AND statuses = 0 THEN 'lurker'
    WHEN timers > 0 AND statuses = 0 THEN 'impulsive_only'
    WHEN timers = 0 AND statuses > 0 THEN 'scheduler_only'
    ELSE 'hybrid'
  END
  FROM activity;
$$;
```

Use it in every dashboard as a split dimension.
**Do NOT hardcode archetype classification in app code** —
it belongs in the DB so every report agrees on the same
definition.

Refinements to consider after first run:
- Maybe 'hybrid' should require ≥2 of each kind (not just 1),
  to separate "tried it once" from "real hybrid".
- Maybe weight recency (last 7 days vs last 30) — a "former
  hybrid who went silent" is different from an "active
  hybrid".

---

## Tracking Events — What We Have vs. What We Need

### Already instrumented (via `trackEvent`)

- `create_status` — fires when user publishes a scheduled event
- `create_timer` — fires when user publishes a timer
- `tap_map_pin` — pin tap (both kinds)
- `view_checkin` — opening a checkin detail
- `join_timer` — visitor joins a timer's chat

### Missing — must add before running Dashboard A / B / C

| Event | Where to fire | Payload |
|---|---|---|
| `join_status` | TimerBubble's doJoin when checkin.checkin_type='status' | checkin_id, lead_time_to_event |
| `leave_checkin` | TimerBubble's handleLeave | checkin_id, kind, time_in_group |
| `end_own_checkin` | TimerBubble's handleEnd (onOwnerEnd) | checkin_id, kind, time_alive |
| `expire_checkin` | Server-side (cron or client-side observer when pin first expires) | checkin_id, kind, members_at_expire |
| `publish_abandoned` | CreationBubble onClose without publish | last_step_reached |
| `step_viewed` | Each step render in CreationBubble | step_name, kind_so_far |
| `option_changed` | When user touches a non-default chip/toggle in any step | step, field, before, after |

The last three are what give us the **funnel separation** —
drop-off per step for timer flow vs. scheduled flow.

---

## Funnel Schema

Two distinct funnels, plotted side by side. Same x-axis
(step name), separate y-axis (distinct users per step).

**Timer funnel:**
1. `open_creation` (from any source — FAB tap, deep link)
2. `step_viewed` where step='what'
3. Typed ≥1 character
4. `step_viewed` where step='when' (chose 'now')
5. `step_viewed` where step='where'
6. `step_viewed` where step='who'
7. `step_viewed` where step='publish'
8. `create_timer`

**Scheduled funnel:**
1. `open_creation`
2. `step_viewed` where step='what'
3. Typed ≥1 character
4. `step_viewed` where step='when' (chose 'later')
5. Day picked
6. Hour picked
7. `step_viewed` where step='where'
8. `step_viewed` where step='who'
9. `step_viewed` where step='publish'
10. `create_status`

Drop-off at each step is a design / copy question. If 40% of
timer users quit at WHERE, maybe GPS permission is denied. If
40% of scheduled users quit between day-pick and hour-pick,
maybe the hour scroller is confusing.

Don't optimize these on gut feel — wait for real funnel data.

---

## Cohort Analyses to Run Monthly

1. **Week-over-week archetype shifts** — did lurkers become
   impulsive? Did impulsive become hybrid?

2. **Retention curves per archetype** — the Hybrid Hypothesis
   stands or falls here. Expected visualisation: 4 retention
   curves on one chart (lurker / impulsive_only /
   scheduler_only / hybrid). If hybrid sits above the others
   at D30, hypothesis confirmed.

3. **Archetype × referrals** — which archetype brings friends?
   If hybrid leads here too, the bootstrap play doubles down.

4. **Archetype × messaging volume** — chat engagement is the
   real social loop. Who talks more after joining a group?

---

## Definition of Done (for when we build this)

1. All 7 missing events instrumented and firing.
2. `app_user_archetype()` SQL function created.
3. Dashboard A rendering with ≥14 days of scheduler data.
4. Dashboard B rendering with ≥14 days of timer data.
5. Dashboard C rendering with archetype split.
6. Retention curves per archetype available on weekly cadence.
7. A single one-page summary (weekly email to product owner)
   of "today's hybrid %, today's retention per archetype,
   today's biggest funnel drop-off."

---

## What NOT to do

- Do not aggregate timer + scheduled into one "events" metric.
  The whole point of this plan is keeping them separate.
- Do not fire event-tracking in a render loop. Each event
  corresponds to a real user action.
- Do not build the archetype classification in the React layer.
  It lives in SQL so every surface agrees.
- Do not compare hybrid to impulsive-only on metrics that
  inherently advantage hybrids (e.g., "total events posted" —
  of course hybrids post more, they have two lanes). Stick to
  per-user-per-lane metrics for fair comparison.

---

## Why this document exists

After launch, someone (PM, data analyst, or future engineer)
will ask "how do we know if the per-kind rule is working?".
This plan is the answer. Its numbers will either confirm the
hypothesis and justify doubling down, or disprove it and
trigger a product pivot. Either way, we know what to look at.
