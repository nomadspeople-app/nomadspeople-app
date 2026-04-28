# nomadspeople — Handoff Prompt (11 אפריל 2026)

## מי אתה
אתה ממשיך פיתוח של **nomadspeople** — מוצר אחד עם שתי חזיתות:
1. **אפליקציית מובייל** (Expo React Native) — הלב
2. **דף נחיתה** (Vite + React, Vercel) — שיווק + privacy/terms/delete חובה לחנויות

שתיהן חולקות את אותו מסד נתונים של Supabase.

**כלל קריטי:** אנחנו לא נוגעים ב-nomadspeople.com של Lovable (אתר השכונות). זה פרויקט אחר לגמרי. אנחנו מתעסקים רק באפליקציה ובדף הנחיתה שלה.

---

## מה האפליקציה עושה
רשת חברתית מבוססת מפה לנומאדים דיגיטליים. המשתמש רואה נומאדים אחרים על מפה בזמן אמת (לפי שכונה), מצטרף לפעילויות ספונטניות (קפה, מפגש, עבודה משותפת), שולח הודעות ישירות וקבוצתיות, ומנהל פרופיל עם DNA נומאדי (סוג, מה מחפש, שפות, תחומי עניין).

**4 טאבים ראשיים:** Home (מפה), People (רשימת אנשים עם פילטרים), Pulse (Messages — שיחות DM + קבוצות עם swipe actions, mute, leave, lock), Profile.

**פיצ'רים מרכזיים:** check-in למפה עם neighborhood detection, timers לפעילויות, push notifications עם deep-linking, avatar cache system, 3 שפות (en/he/ru), light/dark mode, visibility reciprocal rule.

---

## מה דף הנחיתה עושה
עמוד שיווק באנגלית עם hero, features, CTA להורדה, וסטטיסטיקות חיות ("19+ nomads") שנשלפות ישירות מ-`app_profiles` ו-`app_checkins` של Supabase.

בנוסף כולל את העמודים החוקיים שחובה לכל אפליקציה בחנויות: `/privacy`, `/terms`, `/delete-account`, וגם `/admin` לניהול פנימי.

---

## איפה הקוד

```
~/nomadspeople-app/                 ← פרויקט האפליקציה
├── App.tsx                         (contexts, navigation, auth flow)
├── screens/                        (14 מסכים)
│   ├── HomeScreen.tsx              — מפה, פינים, טיימרים
│   ├── PeopleScreen.tsx            — רשימת אנשים
│   ├── PulseScreen.tsx             — שיחות (swipe, mute, leave)
│   ├── ProfileScreen.tsx           — פרופיל + תמונות + פעילויות
│   ├── ChatScreen.tsx              — צ'אט 1:1 וקבוצתי
│   ├── OnboardingScreen.tsx        — 5 שלבי הקמה
│   ├── AuthScreen.tsx              — email/password בלבד
│   ├── SettingsScreen.tsx, GroupInfoScreen, LegalScreen, ...
├── components/                     (23 קומפוננטות — Avatar, TimerBubble, DNA sheets...)
├── lib/
│   ├── supabase.ts                 — client config
│   ├── auth.ts                     — useAuth hook
│   ├── hooks.ts                    — 2,052 שורות: useProfile, useConversations, useActiveCheckins, useUnreadTotal...
│   ├── theme.ts                    — colors, s() scaling, FW font weights
│   ├── i18n.ts                     — useI18n hook
│   ├── translations/               — en, he, es, pt, it, fr, de, ru (חובה לעדכן את כל 8)
│   ├── AvatarContext.tsx           — cache busting (?v=N)
│   └── notifications.ts            — push + deep linking
├── docs/
│   ├── map-pin-flow.md             — הזרימה הנעולה של tap על pin
│   └── avatar-cache-system.md
├── assets/                         — icons, splash
├── CLAUDE.md                       — כללים נעולים (חובה לקרוא לפני עריכה)
├── HANDOFF.md                      — מצב מפורט של הפרויקט
└── web/                            ← פרויקט דף הנחיתה (נפרד, vite)
    ├── package.json                — react 19, react-router-dom 7, lucide-react
    ├── vercel.json
    └── src/
        ├── App.tsx                 — routes
        ├── pages/
        │   ├── LandingPage.tsx
        │   ├── PrivacyPage.tsx
        │   ├── TermsPage.tsx
        │   ├── DeleteAccountPage.tsx
        │   ├── AdminLogin.tsx
        │   └── AdminDashboard.tsx
        └── lib/supabase.ts
```

---

## איפה הדאטא

**Supabase project** (משותף לאפליקציה ולנדינג):
- Project ID: `apzpxnkmuhcwmvmgisms`
- Region: `eu-central-1`
- Postgres 17, סטטוס ACTIVE_HEALTHY
- Dashboard: https://supabase.com/dashboard/project/apzpxnkmuhcwmvmgisms

**טבלאות עם קידומת `app_` (כל הפעילות):**
- `app_profiles` — משתמשים (user_id, full_name, username, avatar_url, bio, job_type, dark_mode, app_language, onboarding_done)
- `app_checkins` — נוכחות על המפה (lat, lng, city, neighborhood, is_active, visibility: public/city_only/invisible)
- `app_conversations`, `app_conversation_members`, `app_messages` — צ'אט
- `app_events`, `app_event_members` — פעילויות
- `app_follows`, `app_blocks`, `app_notifications`, `app_profile_views`
- `app_photo_posts`, `app_photos`, `app_photo_likes`, `app_photo_comments`

**RPC functions** (להחלפת N+1):
- `get_unread_total(p_user_id)` · `get_conversations_summary(p_user_id)` · `get_profile_stats(p_user_id)`

**טריגר:** `on_auth_user_created` → יוצר שורת `app_profiles` אוטומטית אחרי הרשמה.

**Seed data:** 9 פרופילי דמה (IDs `b0000000-0000-0000-0000-00000000000X`) עם צ'קאינים ואירועים.

---

## מיילים וחשבונות

| מה | פרטים |
|---|---|
| Contact / support | `nomadspeople1@gmail.com` (מופיע בלנדינג, ב-CLAUDE.md, ב-app.json) |
| Barak (owner) | `barakperez@gmail.com` · User ID `91bfaacb-aea4-40d4-af67-7421b05be39d` |
| Apple Developer | Eyal Halaf (individual), הסכם נחתם אפריל 2026 |
| Expo owner | `nomadspeople` |
| Bundle ID | `com.nomadspeople.app` |
| EAS project ID | `f7b98f05-2cda-4e34-8ea2-b1782649d5e3` |
| Vercel project ID | `prj_Oa9Je0RfAW0fPafSaFyzfBzhS7DH` (team `team_ParOZfKJCYrKn5sbfhoq2Cue`) |

---

## איך נכנסים לעבוד

**אפליקציה:**
```bash
cd ~/nomadspeople-app
npx expo start --clear
```
רץ ב-Expo Go בפיתוח. כל שינוי ב-`App.tsx` או screens מתרענן אוטומטית.

**דף הנחיתה:**
```bash
cd ~/nomadspeople-app/web
npm run dev    # vite dev server
npm run build  # ל-production
```
דיפלוי אוטומטי מ-Vercel כשדוחפים ל-git.

---

## סטאק טכני
- **App:** Expo SDK 54.0.33, React Native 0.81.5, React 19.1.0, TypeScript 5.9, New Architecture
- **Navigation:** `@react-navigation/native` v7, native-stack, bottom-tabs
- **Maps:** `react-native-maps` 1.14.0 (בלי clustering — אסור)
- **Push:** `expo-notifications` עם deep-linking
- **Supabase client:** `@supabase/supabase-js` v2.101.1
- **Storage:** `@react-native-async-storage/async-storage` (session persistence)
- **Auth כרגע:** email/password בלבד. Google/Apple Sign-In מושבתים עד dev build.
- **Landing:** Vite 5, React 19, React Router v7, lucide-react, inline styles (לא Tailwind)

---

## כללים נעולים — לא לשנות

1. **המפה:** כל הפינים תמיד גלויים. אין clustering. הצפיפות היא הפיצ'ר. Tap על pin → zoom חלק (400ms) → המתנה (450ms) → popup. ראה `docs/map-pin-flow.md`.
2. **i18n:** כל טקסט משתמש חייב `t('key')`. כל מפתח חדש חייב להתווסף לכל 8 קבצי `lib/translations/`. אפס מחרוזות קשיחות.
3. **Visibility:** `show_on_map: false` → המשתמש רואה ולא רואה אף אחד (reciprocal). קיימות שיחות נשמרות. אישור חובה לפני.
4. **Avatars:** משתמשים ב-`AvatarContext` עם `bustAvatar()` אחרי העלאה. ראה `docs/avatar-cache-system.md`.
5. **Performance:** `tracksViewChanges={false}` על כל המרקרים — קריטי.
6. **עברית:** כותבים בעברית מימין לשמאל, לא מערבבים עם אנגלית באותו משפט.
7. **אתר vs אפליקציה:** לא נוגעים ב-nomadspeople.com (הלובאבל עם השכונות). רק באפליקציה + ב-`web/` שבתוכה.

---

## מה נעשה עד כה

**אפליקציה:**
- 14 מסכים בנויים (~16,744 שורות), 23 קומפוננטות, 3 שפות מלאות (en/he/ru).
- Auth email/password עובד, טריגר יצירת פרופיל אוטומטי ב-Supabase, safety net ב-App.tsx.
- Reset onboarding מתוקן (שומר ל-DB, לא דורס שדות קיימים).
- הוסר כל קוד dev-mode, user IDs מזויפים, shortcuts מסוכנים.
- נוסף מתג הצגת סיסמה, ספינר ב-ProfileScreen (במקום הבזק "Nomad").
- 10 אינדקסים קריטיים נוספו ל-DB, 3 RPC functions להחלפת N+1, polling ירד מ-15 ל-45 שניות.
- Swipeable conversations ב-Pulse עם mute/leave/delete/lock.
- Push notifications עם deep-linking פעילים.
- Apple Developer account פעיל, EAS מוגדר.

**לנדינג:**
- 6 routes בנויים (Landing, Privacy, Terms, Delete, Admin login, Admin dashboard).
- סטטיסטיקות חיות מ-Supabase.
- Vercel deploy עובד.

---

## מה עדיין צריך לעשות

1. 🔴 **RLS hardening** — Supabase Security Advisor מחזיר 10 ERRORs + 30+ warnings. טבלאות `app_*` רבות עם policies `dev_*` פתוחות (`USING true`). חובה להדק לפני submission. `leaked_password_protection` כבוי ב-Auth.
2. 🔴 **Google OAuth** ב-Supabase dashboard + redirect URLs + החזרת הכפתור ב-AuthScreen.
3. 🔴 **Apple Sign-In** — Service ID, Key עם Sign in with Apple capability, הגדרה ב-Supabase Auth Providers.
4. 🟡 **Development build עם EAS** — `eas build --profile development` ל-iOS (דורש מק).
5. 🟡 **App Store submission kit** — צילומי מסך, חשבון דמו לסוקרי Apple. יש `nomadspeople-Store-Submission-Kit.docx` בפרויקט.
6. 🟡 **Supabase Pro** — Free מוגבל ל-60 חיבורים. מומלץ לפני השקה (~$25/חודש).
7. 🟡 **בדיקה מקצה לקצה** — הרשמה חדשה → onboarding → avatar upload → check-in → map → שליחת הודעה.
8. 🟢 **ניקוי** — יש קבצי `web-preview-*.html` ישנים ב-root שמיותרים, עדיף להעביר ל-`docs/` או למחוק.

---

## לפני כל עבודה
1. קרא את `CLAUDE.md` שבתיקיית `~/nomadspeople-app` — שם הכללים הנעולים.
2. אל תוסיף מחרוזות קשיחות — רק `t('key')` + עדכון כל 8 קבצי התרגום.
3. בדוק ב-Supabase את המצב לפני שינוי schema.
4. התייעץ לפני שינויים בזרימות נעולות (map pin, visibility, avatar cache).
