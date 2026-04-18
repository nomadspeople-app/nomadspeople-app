# NomadsPeople App — Development Rules

## Repo Boundary (Locked April 2026)

This repo is **only** the NomadsPeople mobile app and its marketing landing page. Nothing else.

**What lives here:**
- `/` — Expo / React Native mobile app (SDK 54)
- `/web/` — Vite + React landing page deployed to nomadspeople.com (routes: `/`, `/privacy`, `/terms`, `/delete-account`, `/admin`)
- `/assets/` — brand assets. `assets/icon.png` is the **single source of truth** for the app icon and gets resized into every web favicon derivative under `/web/public/`.

**What does NOT live here — do not add it:**
- No neighborhoods / city intelligence / "שכונות" code, data fetching, pages, or components.
- The שכונות project is a separate world with its own future repo. It will NOT be folded into this one.
- Tables like `city_*`, `neighborhoods`, `neighborhood_safety_reports` exist in the same Supabase project for historical reasons, but the app MUST NOT read from them. The app only reads tables prefixed with `app_`.

**Icon rule — single source of truth:**
- Master: `assets/icon.png` (1024×1024, brand orange #E8614D)
- Derivatives in `web/public/`: `favicon.png` (180), `favicon.ico` (16+32), `apple-touch-icon.png` (180), `og-image.png` (1200×630)
- Never hand-edit the derivatives. Regenerate them from `assets/icon.png` when the master changes.
- The landing page `<title>` and all meta/og tags live in `web/index.html`. Lovable is no longer involved — edit the source directly.

## Locked UX Flows

### Map Pin Tap Flow (Locked April 2026)
When a user taps ANY pin on the map:
1. **Zoom in smoothly** (400ms) to the pin's neighborhood (latitudeDelta: 0.008)
2. **Wait for animation** (450ms)
3. **Then open the popup** (TimerBubble for timers, ActivityDetailSheet for status)

**Rules — DO NOT CHANGE:**
- ALL pins are ALWAYS visible — density is the feature, never hide pins
- NO clustering, NO numbered bubble groups — we tried it, rejected it
- Nomads count bubble updates based on visible map region, not city total
- Full reference: `docs/map-pin-flow.md`

### Avatar Cache System (April 2026)
- AvatarContext with cache-busting (?v=N) across all components
- bustAvatar() called after profile image upload
- Full reference: `docs/avatar-cache-system.md`
- Future option: migrate to expo-image for cleaner approach

### i18n — Mandatory Translation Rule (Locked April 2026)
Every user-facing string in the app MUST use the `t()` function. No hardcoded text in any screen, component, sheet, modal, or Alert.

**Rules — DO NOT CHANGE:**
- ZERO hardcoded user-facing strings — every label, title, sublabel, placeholder, alert message, button text, and error message must use `t('key')`
- Every new `t()` key MUST be added to ALL 8 translation files: `en.ts`, `he.ts`, `es.ts`, `pt.ts`, `it.ts`, `fr.ts`, `de.ts`, `ru.ts`
- Translation files location: `lib/translations/`
- Supported locales defined in `lib/i18n.ts`: en, he, es, pt, it, fr, de, ru
- When adding a new screen or feature: add ALL strings as `t()` keys from the start — never "add translations later"
- Alert.alert() titles, messages, and button labels — ALL must use `t()`
- Section headers, sublabels, empty states, error messages — ALL must use `t()`

### Visibility — Reciprocal Rule (Locked April 2026)
If a user turns off "Show me on the map" (`show_on_map: false`):
- They become **invisible** to all other users
- They **cannot see** other users on the map or people list
- They **cannot join** new groups or activities
- They **keep access** to existing conversations and groups
- Confirmation alert is REQUIRED before going invisible (with clear explanation)
- `show_on_map` is the SINGLE source of truth — `snooze_mode` syncs from it for backward compat
- Premium exception (future): paid users may get "stealth mode" to watch without being seen

## Architecture Notes
- Expo SDK 54, React Native, TypeScript
- Supabase backend (project: apzpxnkmuhcwmvmgisms)
- react-native-maps 1.14 (NO clustering library in use)
- tracksViewChanges={false} on ALL markers (performance critical)
