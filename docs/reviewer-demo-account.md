# Reviewer Demo Account — Spec

**For:** Apple App Review + Google Play Review
**Purpose:** Both stores' review teams manually open the app and need credentials to sign in. Our app requires auth for anything useful, so without a demo account the reviewer cannot exercise the core flows — and they reject.

This document specifies the demo account we'll create **after** App Store Connect / Play Console app records exist. The spec is written now so the moment we have access, we just follow the recipe.

---

## Credentials

| Field | Value |
|---|---|
| Email | `reviewer@nomadspeople.com` |
| Password | (generate strong, 24 chars, store in 1Password as "nomadspeople — reviewer demo") |
| Display name | `App Store Reviewer` |
| Date of birth (for age gate) | 1990-01-01 (makes them 35+ in 2026 — well above 18) |
| Location (simulated) | Tel Aviv, Israel (32.0853° N, 34.7818° E) |

## Setting up the email alias

`reviewer@nomadspeople.com` is not a real mailbox — it's an alias that forwards to `shospeople@gmail.com` via ImprovMX. To create:

1. Log in to ImprovMX dashboard (shospeople@gmail.com)
2. Add alias: `reviewer@nomadspeople.com` → `shospeople@gmail.com`
3. Verify by sending a test email from outside

This way Apple/Google's password reset emails or magic-link verifications go to your Gmail.

---

## Pre-populate the account (for reviewer UX)

A fresh account with nothing to do = reviewer scrolls an empty map and rejects for "app does not function as described". We need to seed the account with minimal demo data so the reviewer sees a working product on sign-in.

### What to seed (before first review submission):

1. **Profile:**
   - Full name: "App Store Reviewer"
   - Display name: "Reviewer"
   - Bio: "Checking out nomadspeople for review"
   - Avatar: upload a placeholder (can be the app icon)
   - Current city: "Tel Aviv, Israel"
   - Location: set via `last_location_latitude: 32.0853, last_location_longitude: 34.7818` in `app_profiles`
   - `show_on_map: true`

2. **One active check-in** (so the map isn't empty):
   - Activity text: "Reviewing the app at a café"
   - Status emoji: ☕
   - Location: Nahalat Binyamin, Tel Aviv
   - Expires in 4 hours from seeding (fresh each submission)

3. **One conversation with a mock friend:**
   - Create a second seed user "nomad-friend@nomadspeople.com" (never logged in, just a data target)
   - Start a DM between them
   - 3 messages: "hey! welcome to nomadspeople", "thanks!", "let me know if you find my pin"

4. **Nearby nomads on the map:**
   - Our existing live users should already be visible on the map
   - Bonus: if map is empty, seed 4-5 pinned users around Tel Aviv temporarily

### Seed procedure (run as SQL in Supabase Dashboard when needed):

```sql
-- 1. Create the reviewer auth user (via Supabase Auth UI, not SQL)
-- Manually: Dashboard → Auth → Users → Add user → email reviewer@nomadspeople.com + password

-- 2. Insert profile (replace {REVIEWER_UUID} after step 1)
INSERT INTO app_profiles (
  user_id, full_name, display_name, bio,
  avatar_url, current_city, country_code,
  last_location_latitude, last_location_longitude,
  show_on_map, visibility, creator_tag, is_premium,
  terms_accepted_at, terms_version_accepted,
  privacy_accepted_at, privacy_version_accepted,
  onboarding_done
) VALUES (
  '{REVIEWER_UUID}',
  'App Store Reviewer',
  'Reviewer',
  'Checking out nomadspeople for review',
  NULL,
  'Tel Aviv',
  'IL',
  32.0853, 34.7818,
  true, 'public', false, false,
  now(), '2026-04-22',
  now(), '2026-04-22',
  true
);

-- 3. Insert a fresh check-in (run before each submission so expires_at is fresh)
INSERT INTO app_checkins (
  user_id, activity_text, status_emoji,
  latitude, longitude, location_name, city,
  is_active, checkin_type, expires_at, checked_in_at
) VALUES (
  '{REVIEWER_UUID}',
  'Reviewing the app at a café',
  '☕',
  32.0720, 34.7714, 'Nahalat Binyamin, Tel Aviv', 'Tel Aviv',
  true, 'status', now() + interval '4 hours', now()
);
```

---

## Apple App Review — what goes into App Store Connect

In App Store Connect → Version → **App Review Information**:

### Sign-in required
- Tick **Yes** (our app requires sign-in for any useful flow)

### Username
```
reviewer@nomadspeople.com
```

### Password
```
[the 24-char password from 1Password]
```

### Notes for the Reviewer (up to 4000 chars — be helpful)

Sample text to paste:

```
Hi Apple Review team,

Thanks for reviewing nomadspeople.

## What the app does
nomadspeople is a real-time social map for digital nomads. A user goes "live on the map" to show their neighborhood, and they can see other nomads nearby, join activities (co-working, meetups), and chat 1-on-1 or in groups.

## How to test
1. Open the app — you land on the Auth screen.
2. Tap "Sign in with Apple" (recommended) OR enter demo credentials below.
3. After sign-in, you'll see the Home tab with a live map of Tel Aviv.
4. The demo account is pre-positioned in Tel Aviv with one sample check-in at Nahalat Binyamin.

## Demo account (if Sign in with Apple doesn't work)
- Email: reviewer@nomadspeople.com
- Password: [password]

## Key flows to test
1. **Map view** — pinch/pan, tap any pin to see that user's activity
2. **Create check-in** — tap the white Plus button (center of tab bar) → type an activity → set location → Publish
3. **Chat** — tap any nomad, tap "Say hi" → sends a DM → try sending an image
4. **Account deletion** — Settings → Delete Account (tests Guideline 5.1.1(v) — fully functional)
5. **Report/block** — long-press any message → Report / Block

## Contact
If you hit any issue during review, please email support@nomadspeople.com. We monitor it actively and respond within 24 hours.

## Privacy
Full privacy policy: https://nomadspeople.com/privacy
Terms: https://nomadspeople.com/terms
Account deletion (public): https://nomadspeople.com/delete-account

Thank you!
```

---

## Google Play Review — what goes into Play Console

In Play Console → App content → **App access**:

### Tick "All or some functionality is restricted"

### Provide test credentials:
- **Username:** `reviewer@nomadspeople.com`
- **Password:** [same as Apple's demo password]
- **Any other info the reviewer needs:** (paste the Notes block above, slightly adapted)

Google's reviewer uses the same account — no need for separate setup.

---

## After first review — maintenance

- Every new version submission: **re-seed the check-in** (the cron kills expired check-ins every 5 min)
- If the reviewer reports the account is locked / flagged → unlock via Supabase auth dashboard
- Never delete the reviewer user — every version review uses the same account
- Rotate the password yearly (or if a leak is suspected)

---

## Security note

Both Apple and Google **do not share** reviewer credentials externally. They go to a specific review team. The account is **low-risk** because:
- It's a demo account with no real data
- The password is strong and stored only in 1Password
- We can rotate the password anytime and update the review info
- If leaked, the worst case is someone can log in and see the demo data

Don't reuse this password anywhere.
