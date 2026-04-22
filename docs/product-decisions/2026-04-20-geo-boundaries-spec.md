# Geo Boundaries — The Specification

**Date:** 2026-04-20
**Status:** FINAL SPEC. Pre-implementation.
**Decided by:** Barak (product owner)
**Authoritative document.** Any future engineer modifying
geo behavior MUST read this file first.

---

## The One Rule

> **nomadspeople is "real place, real time, real people".
> Creation and participation are anchored to the physical
> country the user is currently in. Browsing is lightly
> restricted so a foreign viewer feels the density without
> seeing every face.**

Any design choice below flows from this principle. If a
future change seems to contradict it — stop and re-read.

---

## The Three Gates (the heart of the design)

The system uses **one helper module, three gates**. No
duplicated logic. Every geographical decision in the app
passes through the helper in `lib/geo.ts`.

```
                    ┌──────── lib/geo.ts ─────────┐
                    │  resolveCurrentCountry()     │
                    │  pinCountryFromCoords(lat,lng)│
                    │  isSameCountryAsViewer(...)   │
                    │  canJoinEvent(...)            │
                    └──────────┬─────────────────┘
                               │
           ┌───────────────────┼────────────────────┐
           ▼                   ▼                    ▼
  GATE 1: PUBLISH       GATE 2: SIDEBAR      GATE 3: JOIN
  (publishCheckin)      (nomads list render) (TimerBubble)
  ─────────────────     ────────────────     ──────────────
  Block if event        First 8 clear,       Disable Join
  country ≠ user        rest blurred at      button + show
  country               60% opacity          "far from home"
```

**Each gate is a pure boolean query to the helper.** The
helper NEVER touches state; it's a stateless reasoning layer.

---

## Definitions — every term used below

| Term | Definition |
|---|---|
| **Home country** | The country the user is CURRENTLY in, derived from GPS on app launch + periodic refresh. ISO 2-letter code ('IL', 'TH', etc.). NEVER derived from `profile.home_country` (that field is for personal info only). |
| **Event country** | The country derived from `checkin.latitude` / `checkin.longitude`. Stored on `app_checkins.country` at publish time. Never recomputed after. |
| **Foreign viewer** | A user whose home country ≠ the country being viewed. |
| **Local viewer** | A user whose home country = the country being viewed. |
| **Same-country check** | The single boolean the three gates consult: `isSameCountryAsViewer(viewerCountry, eventCountry)`. |

---

## GATE 1 — Publish gate

**When it fires:** every call to `publishCheckin()` in
HomeScreen.

**What it does:** blocks the INSERT if the user's home
country doesn't match the country of the pin coordinates.

**Algorithm:**
```
1. Resolve user's current GPS → home_country ISO code.
2. If no GPS:
     → BLOCK with geo.block.publishNoGps.
3. Reverse-geocode event's lat/lng → event_country ISO code.
4. If home_country !== event_country:
     → BLOCK with geo.block.publishBody showing both countries.
5. Otherwise: proceed to INSERT.
6. Pass the resolved event_country through to the INSERT
    payload — written to app_checkins.country.
```

**Ordering critical:** the gate runs BEFORE the moderation
gate and BEFORE the other INSERT logic. Because a foreign
pin should never be submitted for moderation — it's
categorically invalid.

**Buffer for borderlands:** 5 km margin. If the event pin
is within 5 km of the user's GPS AND the reverse-geocoder
returns different countries (e.g. Eilat ↔ Aqaba), TRUST
the user's actual GPS country. This prevents Jordan-Israel
border false rejections.

**Edge cases:**

| Case | Behavior |
|---|---|
| GPS permission denied | Block. Alert: "enable location to post." |
| GPS > 2 min old | Re-request fresh GPS; retry gate. |
| Reverse-geocode API timeout | Treat as network error; show retry Alert. Do NOT fail open — Rule Zero. |
| User on airplane | GPS unavailable → blocked naturally. Publishing while flying is an edge we don't optimize for. |
| Just crossed border | Next GPS reading updates home country. Already solved. |
| VPN / mocked location | We trust what the OS returns. Cheat detection is v2+. Flag for telemetry but don't enforce. |
| Empty country code from geocoder | Block. Alert: "couldn't verify your location. try again in a moment." |

---

## GATE 2 — Sidebar (Nomads list) gate

**When it fires:** every render of the nomads list (the
scroll of active checkins visible in a sidebar / People tab).

**What it does:** applies a visual treatment — first 8
entries in the list are clear, all subsequent entries are
blurred + opacity 60% + non-interactive.

**Algorithm (per-row render):**
```
For each row i in the nomads list:
  if rowCountry === viewerCountry:
     render normally (no blur, full interactivity)
  else if i < 8:
     render normally (same as local viewer sees)
  else:
     render blurred:
       • opacity: 60%
       • avatar: blur filter (or swap with generic silhouette)
       • name: replace with "—" or leave blurred
       • tappable: NO
       • onPress: no-op
```

**Why first-8 and not a random sample:**
- User scrolls → sees density → feels the vibe.
- First 8 means the most-recent-check-ins (ordered by
  `checked_in_at DESC`). Most relevant to "who's active
  right now".
- Consistent between renders (no flicker).

**Critical — the list ALWAYS shows everyone.** The 92
blurred nomads aren't hidden. They're visually attenuated.
The user gets "wow, 100 people here" without learning who
each one is.

**What "blurred" means concretely:**
- `opacity: 0.6` on the Row container.
- Avatar image: `blurRadius={8}` on the Image component
  (React Native supports this natively).
- Name: renders as literal `"—"` or (preferred) a short
  soft placeholder like `"· · ·"`.
- No tap handler attached. Tapping literally does nothing.
- Subtle lock glyph in the corner is allowed (not required)
  to signal "this is restricted" rather than "this is
  broken".

---

## GATE 3 — Join gate (map bubble)

**When it fires:** every render of TimerBubble's action
buttons.

**What it does:** disables the Join button when the event's
country ≠ viewer's home country. Replaces its label with
a clear "far from home — travel to join" message.

**The map itself is UNTOUCHED.** Foreign viewers see every
pin. They can tap any pin. The bubble opens fully —
identical to local view. Activity text, creator, members,
countdown — all visible.

**Algorithm:**
```
When rendering the bubble CTA row:
  if eventCountry === viewerCountry:
     render Join button normally (or Chat+Leave if already joined)
  else:
     render disabled pill:
       • style: grey fill, no primary color
       • icon: location marker or passport glyph
       • text: t('geo.block.joinDisabledLabel')  // "far from home"
       • subtext: t('geo.block.joinDisabledSub', { country })
       • onPress: nothing (or opens an educational modal; v2)
```

**Chat / Leave / End buttons when viewer is foreign:**
- Chat: disabled (user isn't a member; nothing to open).
- Leave: N/A (they never joined).
- End: N/A (foreign viewer is never the creator of a
  foreign pin — publishing would have been blocked).

**What a foreign viewer CAN do via the bubble:**
- See activity text, creator name + avatar, emoji,
  location, time/countdown, member facepile, member count.
- Tap creator avatar → profile (follows the existing
  profile-visit rules — nothing special).
- Share the event to external apps (WhatsApp etc.).
- Follow the creator.

These are all unchanged from today.

---

## Data model — the new column

```sql
ALTER TABLE app_checkins
  ADD COLUMN country text;  -- ISO 2-letter, e.g. 'IL', 'TH'

-- Index for fast viewer-country filtering.
CREATE INDEX app_checkins_country_active_idx
  ON app_checkins (country, is_active)
  WHERE is_active = true;

-- Backfill existing rows (run ONCE, offline, before gate goes live).
-- At ~60 rows in production today, a manual Supabase MCP
-- reverse-geocode pass is trivial.
```

**The column becomes NOT NULL after backfill.** Until then,
`NULL` rows are treated as "same country as viewer" —
fail-open for legacy data only. New rows always carry a
country.

**We do NOT add `app_profiles.current_country`.** The user's
country is ephemeral (changes with travel); caching it in
the profile table would invite stale-data bugs. The client
resolves it on demand from GPS via `lib/geo.ts`. A
session-scoped memoization (lasts while the app is open)
gives us the performance without the staleness.

---

## `lib/geo.ts` — the one helper module

Single file, four functions, zero side effects (other than
the one async GPS call in resolveCurrentCountry).

```typescript
/** Session-memoized. Resolves the user's current country
 *  from GPS. Returns null if GPS unavailable / denied. */
export async function resolveCurrentCountry(): Promise<string | null>

/** Pure. Given coordinates, returns the ISO country code
 *  via a reverse-geocode call. Memoized per-coord-cell
 *  so identical lat/lng don't re-query. Returns null on
 *  geocoder failure. */
export async function pinCountryFromCoords(
  lat: number,
  lng: number,
): Promise<string | null>

/** Pure, sync. The atomic check every gate uses. */
export function isSameCountryAsViewer(
  viewerCountry: string | null,
  eventCountry: string | null,
): boolean {
  // fail-open for unknown data — viewer with no resolved
  // country still sees their local map.
  if (viewerCountry == null || eventCountry == null) return true;
  return viewerCountry === eventCountry;
}

/** Pure, sync. Gate 3 reads this. */
export function canJoinEvent(
  viewerCountry: string | null,
  event: { country: string | null },
): boolean {
  return isSameCountryAsViewer(viewerCountry, event.country);
}
```

**Every gate calls one of these four functions.** Nothing
else. No per-gate geo logic. That's how we prevent drift.

---

## Integration points — exactly where each gate lives

### Gate 1 — `screens/HomeScreen.tsx` → `publishCheckin`
Before the existing moderation gate:
```typescript
const publishCheckin = async (input) => {
  // NEW — geo gate, FIRST in the chain
  const viewerCountry = await resolveCurrentCountry();
  const eventCountry = await pinCountryFromCoords(
    input.latitude,
    input.longitude,
  );
  if (!isSameCountryAsViewer(viewerCountry, eventCountry)) {
    Alert.alert(
      t('geo.block.publishTitle'),
      t('geo.block.publishBody', {
        eventCountry: localizedCountryName(eventCountry, locale),
        homeCountry: localizedCountryName(viewerCountry, locale),
      }),
    );
    return;
  }

  // existing moderation gate, existing expire logic, existing INSERT.
  // INSERT payload now also includes `country: eventCountry`.
};
```

### Gate 2 — `screens/PeopleScreen.tsx` (or wherever the nomads list renders)
Each list-row component receives a `viewerCountry` prop.
Before rendering, it checks index + country match:
```typescript
function NomadRow({ nomad, index, viewerCountry }) {
  const isForeign = !isSameCountryAsViewer(
    viewerCountry,
    nomad.country,
  );
  const isBlurred = isForeign && index >= 8;
  return (
    <View style={[styles.row, isBlurred && styles.blurred]}>
      <Image
        source={{ uri: nomad.avatar_url }}
        blurRadius={isBlurred ? 8 : 0}
        style={styles.avatar}
      />
      <Text>{isBlurred ? '· · ·' : nomad.name}</Text>
    </View>
  );
}
```

The parent list component sorts by `checked_in_at DESC`
before applying the index-based rule, so "first 8" means
"most recent 8 check-ins".

### Gate 3 — `components/TimerBubble.tsx`
Inside the CTA render block:
```typescript
const foreignEvent = !canJoinEvent(viewerCountry, checkin);

if (foreignEvent) {
  return (
    <View style={styles.ctaDisabled}>
      <NomadIcon name="pin" size={s(6)} color="#6B7280" />
      <Text style={styles.ctaDisabledText}>
        {t('geo.block.joinDisabledLabel')}
      </Text>
      <Text style={styles.ctaDisabledSub}>
        {t('geo.block.joinDisabledSub', { country: ... })}
      </Text>
    </View>
  );
}
// existing join / chat / leave / end buttons unchanged.
```

---

## i18n — keys to add, all three locales

```
geo.block.publishTitle       — "can't publish here" / "אי אפשר לפרסם פה" / "нельзя публиковать здесь"
geo.block.publishBody        — "this pin is in {{eventCountry}} but you're in {{homeCountry}}. you can only post events where you are."
geo.block.publishNoGps       — "enable location to post. we need to verify where you are."
geo.block.publishGeocodeFail — "couldn't verify your location. try again in a moment."
geo.block.joinDisabledLabel  — "far from home"
geo.block.joinDisabledSub    — "travel to {{country}} to join"
geo.nomad.blurredName        — "· · ·"  (used as placeholder on blurred rows)
```

**Note:** country names themselves (`{{country}}`) render via
a localized country-name map in `lib/countries.ts`. Covers
~30 common travel countries at launch; expands over time.

---

## Edge cases — the catalog

| # | Case | Resolution |
|---|---|---|
| 1 | User's GPS returns country A, IP says country B | Trust GPS. |
| 2 | User on a cruise ship in international waters | GPS returns nearest country; treat as that. |
| 3 | Pin on the border (within 5 km of viewer GPS) and geocoder disagrees | Trust user's GPS country. |
| 4 | Reverse-geocode API is rate-limited | Retry with backoff. If still fails, BLOCK with retry Alert — never fail-open on publish. |
| 5 | User opens app for the first time before GPS resolves | Show a mild "finding you..." state. List is empty but not broken. Publish is disabled with "locating you..." until GPS returns. |
| 6 | User flies mid-event (published in TLV, now in Bangkok) | Event's country stays 'IL' (locked at publish). User's home_country updates on landing GPS. Gate 3 sees event.country='IL' ≠ home='TH' → Join becomes disabled even for the creator. This is correct — they're now browsing another country. They can still read chat (they were a legitimate member). |
| 7 | 100-person list where viewer is local (all in same country) | No blur. Index-based rule only fires for foreign-country rows. |
| 8 | Mixed list with both local and foreign entries (viewer on "world view" page, if we ever add one) | Apply index separately within each country group. (Moot for v1 — we don't have a world view.) |
| 9 | Creator ends their event while viewer is looking at the bubble | Normal — unchanged. Foreign viewer already couldn't join; this doesn't affect them. |
| 10 | User denies location then tries to publish | Block with `publishNoGps` key. Give them Settings link to re-grant. |

---

## Success metrics — post-launch

Weekly review:

1. **Publish rejections by gate.** `app_moderation_events`-style
   log of every blocked publish with the reason (no GPS /
   country mismatch / geocoder fail). Target: < 2% of
   publishes blocked; if higher → tune buffer or GPS staleness threshold.

2. **Blurred-row tap attempts.** Tapping a blurred row is a
   no-op, but we instrument the attempt. This tells us how
   curious foreign viewers are. High number = good signal
   that they want the full access.

3. **Foreign-bubble opens.** How often does a foreign viewer
   open a bubble they can't join? If high → the "see
   everything, participate nothing" balance is working. If
   very low → they gave up scrolling; consider relaxing.

4. **Cross-border retention.** Do users who peek at another
   country's map TODAY actually show up there LATER and
   engage? If yes, the 15% of wait-and-plan works — the
   foreign view is a marketing funnel, not just a
   restriction.

---

## Implementation phases — 3 code pushes

### Phase 1 — Publish gate (THE MOST URGENT)
Fixes the bug Barak found. Biggest integrity risk today.

**Files:**
- NEW: `lib/geo.ts` (the helper)
- NEW: `lib/countries.ts` (ISO ↔ localized name map)
- DB migration: add `app_checkins.country` column
- Modified: `screens/HomeScreen.tsx` (publishCheckin gate)
- Modified: `lib/translations/{en,he,ru}.ts` (keys)
- One-time SQL: backfill existing rows via reverse-geocode

**Estimated time:** 4 hours.
**Gate goes live:** after backfill complete + tsc + device test.

### Phase 2 — Nomads list blur (foreign viewer sidebar)
Makes the foreign-browsing experience respectful.

**Files:**
- Modified: `screens/PeopleScreen.tsx` (list rendering, index-based blur)
- Modified: row components (blurRadius + opacity + name swap)
- Modified: `lib/hooks.ts` — useActiveCheckins returns `viewerCountry` alongside checkins

**Estimated time:** 3 hours.

### Phase 3 — Join button disabled + label
Seals the "participation" side.

**Files:**
- Modified: `components/TimerBubble.tsx`
- Modified: i18n keys confirmed

**Estimated time:** 1.5 hours.

**TOTAL: ~1 day of focused work across three commits,
each independently testable and reversible.**

---

## Red lines — never cross

1. **Never allow a publish without country verification.**
   Silent fail = fake pins = dead product.
2. **Never hide foreign pins from the map.** Density is the
   product. Blur is only for the SIDEBAR, never for the map.
3. **Never duplicate geo logic across surfaces.** One helper,
   three callers. If you're writing a 4th surface — make it
   a 4th caller of the existing helper.
4. **Never persist GPS beyond the current session.** The
   resolved country is memoized in memory only, never in
   AsyncStorage or DB.
5. **Never auto-ban a user for being in the "wrong" country.**
   The gates restrict actions, not identity. Movement is
   normal.
6. **Never add a "see everything" premium unlock without
   re-reading this spec.** If product evolves to "pay to see
   Bangkok pins fully", that's a meaningful change to the
   privacy contract. Not a casual addition.

---

## Open for future (explicitly NOT v1)

1. **Invited access across borders.** Creator can tag an event
   "open to visitors" — foreign users can join. Deferred.
2. **Premium "world view" unlock.** Paid tier sees more than
   8 rows. Deferred + needs privacy conversation.
3. **Explicit travel planning.** User declares "I'll be in
   Bangkok Apr 28 – May 3" → during that window their gate
   shifts. Deferred.
4. **Border cities UX** (Laredo / Nuevo Laredo): today we
   treat them as separate. Could later recognize sister-city
   pairs.
5. **Server-side enforcement.** Today the gates live in the
   client. A determined attacker could bypass by calling
   Supabase directly with forged coords. RLS policies
   matching `user.raw_user_meta_data.current_country` would
   close that loop — deferred because we don't have
   user-metadata updates wired for country yet.

---

## Summary in 5 lines

1. **Publish:** blocked if user's GPS country ≠ pin country.
2. **Map:** unchanged for everyone, everywhere.
3. **Nomads list:** for foreign viewers, first 8 clear, rest
   blurred and untappable.
4. **Bubble on tap:** opens fully for everyone; Join button
   disabled for foreigners.
5. **Chat groups:** only members can enter; foreigners can't
   become members of cross-border events in v1.

---

That is the Torah. Code against this; don't improvise.
