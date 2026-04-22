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
