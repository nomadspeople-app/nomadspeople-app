# Product Decision — Apple Developer Account Strategy

**Date:** 2026-04-20
**Decided by:** Barak (product owner)
**Status:** Locked.

## The plan

1. **Today** — Eyal Halef (Barak's uncle, US/Israel resident
   with valid address for Apple ID requirements) opens an
   **Individual Apple Developer Account** ($99/year).
2. **Same day** — Eyal adds Barak as Admin via App Store
   Connect → Users and Access. From this moment, Barak
   manages day-to-day operations using HIS own Apple ID;
   Eyal's involvement isn't required for releases, builds,
   analytics, support replies, etc.
3. **In parallel** — Barak requests a D-U-N-S number from
   dnb.com for the business name "nomadspeople". Free, takes
   5 business days to ~3 weeks.
4. **In ~4–8 weeks** — Eyal contacts Apple Developer Support
   to perform an **Entity Change** (Individual → Organization)
   on the SAME account, using the now-available D-U-N-S.
5. **Post-change** — the App Store listing's "Seller" field
   updates from "Eyal Halef" to "nomadspeople" with zero code
   change, zero downtime, zero data loss.

## Why Entity Change (A) over App Transfer (B)

Entity Change keeps a single account for the entire app
lifetime. App Transfer would create a parallel Organization
account ($198 first year) and move the app between them
(small downtime + complexity). For nomadspeople MVP, none of
the three legitimate reasons for App Transfer apply (Eyal
doesn't have other personal apps, no investor demands legal
separation, no account is in trouble).

Entity Change is the standard 95% startup MVP playbook.

## Account ownership map

| Account / Service | Email | Owner | Notes |
|---|---|---|---|
| Apple Developer Program | Eyal's Apple ID | Eyal | Required by Apple — tied to government ID. |
| App Store Connect (operational) | Barak's Apple ID | Barak (Admin role) | Day-to-day app management. |
| Sentry | nomadspeople1@gmail.com | Barak | Crash reporting. |
| EAS / Expo | nomadspeople1@gmail.com | Barak | Build infrastructure. |
| Supabase | (existing) | Barak | DB + edge functions. |
| OpenAI (deferred) | nomadspeople1@gmail.com | Barak | If we add server-side moderation. |
| Support email | shospeople@gmail.com | Barak | Customer-facing inbox. |

## Customer-facing impact

**During Individual phase (first ~6-8 weeks of launch):**
App Store listing shows "Seller: Eyal Halef" beside the app
name.

**After Entity Change:**
App Store listing shows "Seller: nomadspeople". All other
metadata (icon, screenshots, name, description, reviews,
ratings, downloads) stays exactly the same.

## What blocks the launch

The Individual account is enough to ship. We do NOT wait
for the Organization upgrade. The launch can happen as soon
as Apple approves the Individual account (typically 24-48
hours after Eyal completes enrollment).

## Red lines

1. Never create the App Store Connect listing under Eyal's
   personal name (e.g. "Eyal's nomadspeople") — the listing
   name should always be "nomadspeople" regardless of
   Seller field.
2. Never expose Eyal's Apple ID password to Barak. Barak's
   own Apple ID + Admin role is enough for everything.
3. Never run `eas submit` with Eyal's actual password —
   always use an App-Specific Password (ASP) generated
   under his Apple ID's Sign-in & Security panel.
