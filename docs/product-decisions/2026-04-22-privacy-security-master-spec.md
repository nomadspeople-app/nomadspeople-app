# אפיון אבטחת מידע, פרטיות, והסכמות — nomadspeople

**סטטוס:** טיוטה לאישור · **תאריך:** 22 באפריל 2026 · **לפני:** submission ל־App Store ו־Google Play

---

## 0. תקציר מנהלים

המסמך הזה מאפיין את כל שכבת הפרטיות, האבטחה, וההסכמות של nomadspeople. הוא מחליף את הגישה שלנו עד היום (טלאי־פלאי) בארכיטקטורה מערכתית אחת. מטרתו: אפס פלסטרים, אפס חורי־ציות, אפס הפתעות ב־review של החנויות.

**המסמך מחולק לשלושה חלקים:**
1. **הרקע** (סעיפים 1-14) — מה המערכת צריכה להיות מבחינת חוק, תקן, וצרכי משתמש.
2. **המצב בפועל** (סעיף 15) — מה כבר מומש, מה חסר.
3. **תוכנית עבודה** (סעיפים 16-17) — מה בונים מחר, בשבוע הקרוב, ואחרי הלאנץ׳.

ברגע שתאשר את האפיון — אנחנו מתחילים לבנות לפי הסדר. אפס קפיצה מנושא לנושא.

---

## 1. מסגרת חוקית — איפה אנחנו משחקים

nomadspeople זמינה גלובלית. לכן אנחנו חייבים לעמוד במינימום של כל אחת מהמסגרות הבאות:

**האיחוד האירופי — GDPR (General Data Protection Regulation).**
הרגולציה המחמירה ביותר בעולם. מחייבת: הסכמה מפורשת לפני עיבוד נתונים, זכויות גישה/מחיקה/תיקון/העברה, הודעה על פריצה תוך 72 שעות, ו־DPO (Data Protection Officer) לארגונים מעל סף מסוים (אנחנו מתחת).

**ארצות הברית — CCPA/CPRA (California Consumer Privacy Act).**
דומה ל־GDPR אבל מינוריסטי. מחייבת: הודעה על איסוף נתונים, אופציה להגביל מכירה (opt-out), זכות למחיקה.

**קנדה — CASL + PIPEDA.**
CASL הכי מחמירה בעולם לגבי מיילים מסחריים — חובה opt-in מפורש לפני שליחה, לא רק unsubscribe בתחתית.

**ישראל — חוק הגנת הפרטיות (תיקון 13, נכנס לתוקף אוגוסט 2025).**
הותאם ל־GDPR. מחייב הסכמה בהקלטת עסקה.

**אפל — App Store Review Guidelines 5.1 + 1.2.**
חייב Privacy Policy, אופציה למחיקת חשבון, הגנה על קטינים, Age Rating, App Privacy nutrition label.

**גוגל — Google Play Data Safety Form.**
כל מידע שנאסף חייב להיות מוצהר ב־form ייעודי.

**המסקנה:** אם נעמוד ב־GDPR + CASL + הנחיות אפל, אנחנו מכוסים בכל מקום אחר.

---

## 2. מה אנחנו אוספים — קטגוריות נתונים

כל מערכת צריכה לפתוח בלהבין מה בדיוק היא שומרת. זה המיפוי המלא:

### 2א׳. זיהוי והתקשרות (Identity & Contact)
- אימייל (חובה, כניסה למערכת)
- סיסמה (מוצפנת bcrypt)
- שם מלא (display_name)
- שם משתמש (username)
- תמונת פרופיל (avatar)
- ביוגרפיה (bio)
- תחומי עניין (interests)

### 2ב׳. דמוגרפי (Demographic)
- תאריך לידה (חובה לאימות גיל 18+)
- מגדר
- מדינת מוצא (home_country)

### 2ג׳. מיקום (Location)
- קורדינטות GPS מדויקות (latitude/longitude) — רק בזמן פרסום צ׳ק־אין או טיימר
- עיר נוכחית (current_city)
- קוד מדינה (country — ISO code)

### 2ד׳. תוכן יצירת משתמש (User-Generated Content)
- הודעות בצ׳אטים (app_messages)
- סטטוסים ותוכן פעילויות (app_checkins)
- פוסטים ותמונות בפרופיל (app_photo_posts)
- דיווחים על תוכן פוגעני (app_message_reports)

### 2ה׳. מידע על המכשיר (Device)
- Push token (לשליחת התראות)
- Device ID (רק אם המשתמש אישר ATT ב־iOS)
- Locale (שפה)

### 2ו׳. מידע אבחון (Diagnostics)
- Crash logs דרך Sentry (אחרי הלאנץ׳)
- Stack traces עם user_id מקושר

### 2ז׳. מטא־דאטה של חשבון
- created_at, last_active_at
- onboarding_done
- age_verified
- show_on_map, hide_distance (העדפות פרטיות)

---

## 3. בסיס משפטי לעיבוד (Legal Basis) — GDPR סעיף 6

כל קטגוריית נתון שאנחנו מעבדים חייבת להיות מבוססת על אחד מששת ה־legal bases של GDPR:

| קטגוריה | בסיס משפטי | הסבר |
|---|---|---|
| אימייל, סיסמה, פרופיל | **חוזה (Contract)** | המשתמש מסכים לתנאי שירות = חוזה. בלי זה אי אפשר לקיים שירות. |
| מיקום | **חוזה** (כשפעיל) + **הסכמה** (GPS permission) | המיקום הכרחי לפונקציונליות הבסיסית (מפה). |
| תוכן (הודעות, פוסטים) | **חוזה** | חלק מהשירות שהם משלמים עליו (חינם אבל שירות). |
| תאריך לידה | **אינטרס לגיטימי** (הגנה על קטינים) | חובה חוקית לוודא 18+. |
| Crash logs (Sentry) | **אינטרס לגיטימי** (אבטחת המערכת) | המשתמש לא ניפגע, המערכת שורדת. |
| Push notifications | **הסכמה** (OS permission) | המשתמש יכול לכבות. |
| **מיילים שיווקיים** | **הסכמה מפורשת** (opt-in) | חובה checkbox, כבוי כברירת מחדל. |
| **Cookies אנליטיקה** (לעתיד) | **הסכמה** | Banner חובה באירופה. |

---

## 4. זכויות המשתמש

לפי GDPR (ומקבילות ב־CCPA):

### 4א׳. זכות גישה (Right of Access — Article 15)
המשתמש יכול לבקש עותק של כל הנתונים שלנו עליו. **חסר**: צריך להוסיף כפתור "Download my data" שיוצר JSON עם כל הנתונים שלו.

### 4ב׳. זכות תיקון (Right to Rectification — Article 16)
המשתמש יכול לערוך את הפרופיל שלו. **קיים** דרך Profile → Edit.

### 4ג׳. זכות למחיקה (Right to Erasure — Article 17)
המשתמש יכול למחוק את החשבון. **קיים** דרך Settings → Delete Account וגם nomadspeople.com/delete-account.

### 4ד׳. זכות העברה (Right to Data Portability — Article 20)
המשתמש יכול לבקש את הנתונים בפורמט נייד (JSON/CSV) להעברה לשירות אחר. **חסר** — נוסיף את זה כחלק מ־4א׳.

### 4ה׳. זכות להתנגד (Right to Object — Article 21)
המשתמש יכול להתנגד לעיבוד נתונים מסוים. **חסר** — נוסיף כ־"Pause my account" וכ־unsubscribe מקטלוג המיילים.

### 4ו׳. זכות שלא להיות נושא להחלטה אוטומטית (Article 22)
אנחנו לא עושים profiling אוטומטי שמקבל החלטות בעלות משמעות משפטית. לא רלוונטי היום.

---

## 5. ארכיטקטורת הסכמות — זה הלב של המסמך

### 5א׳. מה המשתמש צריך לאשר ומתי

**בזמן הרשמה (חובה, חוסם יצירת חשבון):**
1. ✅ "I am 18 years or older" — כבר קיים.
2. ❌ "I agree to the Terms of Service" — **חסר**.
3. ❌ "I agree to the Privacy Policy" — **חסר**.

שלושה אלה חובה, checkbox שחייב להיות מסומן, עם לינק לדפים הרלוונטיים באתר.

**בזמן הרשמה (אופציונלי, כבוי כברירת מחדל):**
4. ❌ "I'd like to receive product updates and tips from nomadspeople (optional)" — **חסר**.

זה ה־opt-in למיילים שיווקיים. כבוי כברירת מחדל כמתחייב ב־GDPR.

**בזמן שימוש (OS-level, לא שלנו):**
5. הרשאת מיקום (Location permission) — האפליקציה מבקשת כשצריך.
6. הרשאת התראות (Notification permission) — האפליקציה מבקשת אחרי onboarding.
7. App Tracking Transparency (iOS) — אם נרצה לעקוב בין אפליקציות. כרגע לא נדרש.

### 5ב׳. מה נשמור ב־DB — שדות חדשים

צריך להוסיף ל־`app_profiles` את השדות הבאים:

```
terms_accepted_at              TIMESTAMP
terms_version_accepted         TEXT (e.g., "2026-04-21")
privacy_accepted_at            TIMESTAMP
privacy_version_accepted       TEXT
marketing_emails_opt_in        BOOLEAN DEFAULT false
marketing_opt_in_at            TIMESTAMP NULL
marketing_opt_out_at           TIMESTAMP NULL
```

**למה גרסה נשמרת?** אם יום אחד נעדכן את ה־Terms, אנחנו צריכים לבקש מכל משתמש לאשר את הגרסה החדשה. השדה `terms_version_accepted` מאפשר לנו לזהות מי עוד לא אישר את הגרסה האחרונה.

### 5ג׳. איך לוגים של הסכמות נשמרים

כל פעולת הסכמה (הן ב־signup והן בעדכון בהמשך) נשמרת בטבלה ייעודית:

```
app_consent_events:
  id, user_id, event_type ('terms' | 'privacy' | 'marketing_opt_in' | 'marketing_opt_out'),
  version, ip_address, user_agent, timestamp
```

זה מספק **ראיה משפטית** שהמשתמש הסכים מתי ומה. חובה אם יום אחד יגיע סכסוך.

### 5ד׳. מסך Email Preferences ב־Settings

משתמש יכול תמיד לעדכן את ההסכמות שלו:
- מתג "Marketing emails" (מחובר ל־`marketing_emails_opt_in`).
- מתג "Transactional emails" — לא יכול לכבות (חובה לקבל אישור מחיקה, איפוס סיסמה).
- קישור "Download my data" — מפעיל זכות 4א׳.
- קישור "Delete my account" — קיים.

---

## 6. אבטחה טכנית

### 6א׳. הצפנה בהעברה (Encryption in Transit)
HTTPS/TLS 1.2+ בכל הקריאות. **בוצע ✅** (כולל הסרת ATS violation ל־ip-api.com).

### 6ב׳. הצפנה במנוחה (Encryption at Rest)
Supabase מצפין DB וגיבויים אוטומטית ב־AES-256. **בוצע ✅**.

### 6ג׳. אבטחת סיסמאות
- bcrypt בצד Supabase (אוטומטי).
- מינימום 8 תווים. **בוצע ✅**.
- בדיקה מול HaveIBeenPwned. **בוצע ✅**.
- דרישת סיסמה נוכחית לעדכון. **בוצע ✅**.
- אבטחת החלפת סיסמה. **בוצע ✅**.

### 6ד׳. Row-Level Security
כל טבלה עם נתוני משתמש מוגנת. **בוצע ✅** (אחרי ההקשחות של אתמול).

### 6ה׳. מניעת rate limiting / abuse
- Supabase Auth מגביל ניסיונות כניסה אוטומטית.
- Moderation rate limit על שליחת הודעות (`SEND_BLOCKED_RATE_LIMIT`). **בוצע ✅**.

### 6ו׳. הגנה מפני פריצה לתוכן
- Content moderation פילטר slurs/threats — **בוצע ✅**.
- דיווח על הודעות → `app_message_reports` — **בוצע ✅** (תיקנתי את ה־RLS אתמול).
- חסימת משתמשים — **בוצע ✅**.

### 6ז׳. Monitoring + Incident Response
- Sentry לקריסות. **בוצע ✅**.
- Supabase logs לאימות. **בוצע ✅**.
- **חסר:** מסמך Incident Response עם צעדי תגובה לפריצה.

---

## 7. ספקי צד שלישי — מיפוי מלא

כל מי שנוגע בנתוני המשתמש שלנו חייב להיות מוצהר במדיניות הפרטיות ובטופס Data Safety של גוגל.

| ספק | מה הוא מקבל | למה | Data Processing Agreement |
|---|---|---|---|
| Supabase (EU-Frankfurt) | כל הנתונים | עיבוד ראשי (DB + Auth) | כלול ב־ToS של Supabase, GDPR-ready |
| Vercel | HTML/JS של האתר | אירוח האתר הסטטי | כלול ב־ToS של Vercel |
| Sentry (EU-Frankfurt) | Crash logs עם user_id | אבחון באגים | DPA ב־ToS |
| ImprovMX | כותרות מייל + כתובות אל/מ | הפניית מייל support | DPA חתום (free tier) |
| Apple APNs | Push token + תוכן התראה | שליחת push ל־iOS | כלול ב־Apple Dev Agreement |
| Google FCM (עתידי) | Push token + תוכן התראה | שליחת push ל־Android | כלול ב־Google Dev Agreement |
| Nominatim (OpenStreetMap) | קורדינטות (אנונימי) | reverse geocoding | שימוש חופשי, ללא עיבוד אישי |
| Photon (Komoot) | קורדינטות + שאילתת חיפוש | address search | שימוש חופשי |
| ipapi.co | IP של המשתמש (אנונימי) | IP-based location fallback | כלול ב־ToS |
| **Google Translate (Unofficial gtx)** | **תוכן הודעות** (כשנלחץ translate) | **תרגום** | **⚠️ אין DPA — זה unofficial endpoint. סיכון בעתיד לעבור ל־DeepL או ל־Google הרשמי** |

### שינוי מומלץ לפני הלאנץ׳
**Google Translate** הוא הסיכון היחיד במיפוי. שימוש ב־unofficial endpoint בלי חוזה = אסור תיאורטית ב־GDPR. יש שלוש אפשרויות:

1. **מעבר ל־DeepL Pro** (חוזה חתום, €5.49/חודש) — אידיאלי.
2. **מעבר ל־Google Translate API הרשמי** עם חתימה על DPA (חינם עד 500K תווים).
3. **דחיית תרגום מיידי** — המשתמש רואה הודעה "תרגום יגיע בגרסה 1.1" ולא שולחים שום דבר לגוגל.

**ההמלצה שלי:** אפשרות 3 לפני הלאנץ׳ (הסרת הפיצ׳ר זמנית), מעבר ל־DeepL אחרי.

---

## 8. מיילים — סוגים ומנגנונים

### 8א׳. מיילים טרנזקציוניים (לא דורשים opt-in)
- אישור הרשמה (Supabase Auth)
- איפוס סיסמה (Supabase Auth)
- אישור מחיקת חשבון (Magic Link template — **בוצע ✅** עם מיתוג nomadspeople)
- התראה על כניסה ממכשיר חדש (Supabase Auth)

כל אלה מותרים לשלוח למשתמש בלי הסכמה נפרדת כי הם מהווים שירות הכרחי.

### 8ב׳. מיילים שיווקיים (דורשים opt-in מפורש)
- ניוזלטר חודשי
- עדכוני פיצ׳רים
- הזמנות לאירועים (webinars וכו׳)

**כל מייל שיווקי חייב:**
- ללכת רק למי ש־`marketing_emails_opt_in = true`.
- להכיל לינק unsubscribe פעיל בתחתית.
- להכיל את שם החברה וכתובת פיזית (CASL).
- להשתמש ב־SMTP מותאם (Resend, עם שם השולח "nomadspeople").

### 8ג׳. מיילים שיווקיים — לא נשלחים עד שנחליט להוסיף ניוזלטר.
**כרגע אין ניוזלטר. הבעיה היחידה היא שאין לנו תשתית למקרה שנרצה להתחיל.** האפיון מציע לבנות את התשתית עכשיו (שדה DB + checkbox + Settings) אבל לא לבנות ספק שליחת מיילים עד שיש באמת מה לשלוח.

### 8ד׳. SMTP מותאם (Custom SMTP)
**כרגע:** Supabase שולח מ־`noreply@mail.app.supabase.io`. לא מקצועי.

**המלצה לפני הלאנץ׳:** לפתוח חשבון Resend (חינמי עד 3,000 מיילים/חודש), להגדיר ב־Supabase → Authentication → SMTP Settings. כל המיילים יוצאים מ־`noreply@nomadspeople.com` או `hello@nomadspeople.com` עם שם השולח "nomadspeople".

---

## 9. Push Notifications

### 9א׳. מה נשלח
- הודעה חדשה בצ׳אט
- מישהו הצטרף לסטטוס שלך
- timer שלך מסתיים עוד 10 דקות
- עוקב חדש

### 9ב׳. איך המשתמש מנהל
**ב־OS (iOS/Android):** Settings → Notifications → nomadspeople → כיבוי מלא.
**ב־App:** Settings → Notifications → מתגים נפרדים לכל סוג (notify_messages, notify_timer, notify_follows — **שדות קיימים ✅**).

### 9ג׳. מה חסר
אימות שה־toggles באמת משפיעים על הלוגיקה של `dispatch_push_notification`. זה דורש בדיקה במכשיר אמיתי ו/או בדיקת הקוד של ה־Edge Function.

---

## 10. Support & Contact

### 10א׳. מה קיים
- דף `/support` באתר עם אימייל + 6 שאלות נפוצות. **בוצע ✅**.
- הפנייה של `support@nomadspeople.com` ל־gmail שלך דרך ImprovMX. **בוצע ✅**.

### 10ב׳. מה חסר
- טופס יצירת קשר מתוך האפליקציה (Settings → Help → Contact). כרגע רק mailto.
- לוג של פניות (טבלה `app_support_requests`). חשוב אם יום אחד נתמוך ביותר מפניה בשבוע.

### 10ג׳. SLA (Service Level Agreement)
צריך להצהיר על זמן תגובה במדיניות הפרטיות ובדף Support: **"We respond within 1 business day"**.

---

## 11. בטיחות קהילה ומודרציה

### 11א׳. מה קיים (Apple Guideline 1.2)
- פילטר תוכן (slurs/threats, en/he/ru). **בוצע ✅**.
- חסימת משתמשים. **בוצע ✅**.
- דיווח על הודעות. **בוצע ✅** (RLS תוקן אתמול).
- מחיקת הודעות עצמיות. **בוצע ✅**.

### 11ב׳. מה חסר
- **Moderation dashboard** לפעילות יומית — איפה אני רואה כל דיווח שהגיע? היום הם יושבים בטבלה בלי UI. צריך להוסיף `/admin/reports` באתר.
- **Automated actions** — אם משתמש דווח 5 פעמים על תוכן פוגעני, אוטומטית להשעות אותו. חסר מנגנון.
- **Response SLA** — תוך כמה זמן אנחנו מטפלים בדיווח? צריך להצהיר.

---

## 12. הגנה על קטינים

### 12א׳. מה קיים
- שער גיל 18+ חובה ב־onboarding. **בוצע ✅**.
- `age_verified: true` נשמר בפרופיל. **בוצע ✅**.

### 12ב׳. מה חסר
- אם משתמש משקר על גילו — אין מנגנון תיקון. אפל לא דורשת אבל זה best practice.
- **COPPA** (ארה"ב) — אם מזהים משתמש מתחת ל־13, חובה למחוק מיידית. כרגע אין מנגנון.

---

## 13. שמירת נתונים ומחיקה

### 13א׳. מחיקת חשבון ידנית
**בוצע ✅.** מוחק את כל ה־PII + מאנונמז הודעות.

### 13ב׳. משתמש לא פעיל
GDPR דורש לא לשמור נתונים לנצח. **חסר:** מדיניות — אם משתמש לא התחבר תוך שנה, אנחנו מודיעים לו ומוחקים אחרי 90 יום.

### 13ג׳. לוגים וגיבויים
Supabase שומר גיבויים 7 ימים (free tier) או 30 יום (Pro). **בוצע ✅**. אחרי זה נמחקים אוטומטית.

---

## 14. תגובה לפריצה (Breach Response)

### 14א׳. מה חסר לגמרי
אין מסמך Incident Response. חובה לפני לאנץ׳:
- מי מקבל התראה אם Supabase מודיע על פריצה? (אתה + אייל)
- תוך כמה זמן מודיעים לרשות הגנת הפרטיות? (72 שעות ב־GDPR)
- תוך כמה זמן מודיעים למשתמשים? (תלוי בחומרה)
- באיזה ערוץ? (מייל לכל המשתמשים המושפעים + הודעה באפליקציה)

---

## 15. המצב בפועל — סיכום "מה כבר בוצע"

### ✅ מבנה משפטי
- Privacy Policy קיים ברור ונגיש (`/privacy`)
- Terms of Service קיים ונגיש (`/terms`)
- Delete Account flow פעיל (גם באפליקציה וגם באתר)
- Support page פעיל (`/support`)
- FAQ עם 6 שאלות נפוצות

### ✅ אבטחה טכנית
- HTTPS בכל המקומות
- RLS מהודק על כל הטבלאות
- Leaked password protection
- Minimum 8 chars
- Secure password change + require current
- Encryption at rest (Supabase)

### ✅ זכויות משתמש
- Right to Erasure (מחיקת חשבון)
- Right to Rectification (עריכת פרופיל)

### ✅ מודרציה
- Content filter (slurs/threats)
- Block users
- Report messages
- Delete own messages

### ✅ קטינים
- 18+ age gate בכפיה

### ✅ מיתוג
- nomadspeople (אותיות קטנות, יחיד) בכל מקום לקוחות רואים

---

## 16. גאפים — מה חסר (ממוין לפי דחיפות)

### 🔴 דחוף — חוסם לאנץ׳
1. **Terms + Privacy consent checkbox ב־signup** — בלי זה המשתמש לא הסכים פורמלית, ולא נוכל להוכיח במקרה של סכסוך.
2. **שדות consent ב־`app_profiles`** — `terms_accepted_at`, `privacy_accepted_at`, versioning.
3. **טבלת `app_consent_events`** — לוג משפטי של כל הסכמה/התנגדות.
4. **vercel.json SPA rewrite** — חסר, לכן `/support` ריק. **תקנתי, צריך לדחוף.**
5. **הסרה / החלפה של Google Translate unofficial** — סיכון GDPR ממשי.

### 🟡 חשוב — לא חוסם אבל מומלץ לפני לאנץ׳
6. **Marketing opt-in infrastructure** — שדה DB + checkbox ב־onboarding (אופציונלי).
7. **Email Preferences screen ב־Settings** — עם toggle למיילים שיווקיים.
8. **Data export (Right to Portability)** — כפתור ב־Settings שמוריד JSON עם כל הנתונים.
9. **Custom SMTP (Resend)** — מיילים יוצאים עם מיתוג nomadspeople ולא Supabase.
10. **Incident Response doc** — מסמך תגובה לפריצה.
11. **Update Privacy Policy** — להכליל את כל ספקי הצד השלישי + זכויות GDPR.

### 🟢 יכול לחכות לגרסה 1.1
12. **Admin moderation dashboard** — UI לסקירת דיווחים.
13. **Automated moderation actions** — השעיה אוטומטית אחרי N דיווחים.
14. **Inactive user cleanup** — מחיקה אוטומטית אחרי שנה + 90 יום.
15. **Contact form** בתוך האפליקציה (במקום mailto).
16. **COPPA compliance** — אם מזהים מתחת ל־13, מחיקה אוטומטית.
17. **In-app support ticket tracking** — טבלה `app_support_requests`.

---

## 17. תוכנית עבודה — סדר ביצוע מוצע

### שלב A — לפני submission (אני עושה, ~4-6 שעות עבודה)

**A1.** יצירת טבלה `app_consent_events` במיגרציה ייעודית.
**A2.** הוספת 7 השדות ל־`app_profiles` (terms/privacy/marketing + timestamps + versions).
**A3.** עריכת OnboardingScreen — הוספת 3 checkboxes חובה + 1 אופציונלי לפני יצירת חשבון, עם לינקים ל־/terms ו־/privacy.
**A4.** עריכת AuthScreen — לפני signUp, כתיבת שורות ל־`app_consent_events`.
**A5.** עריכת Privacy Policy ב־`lib/legal/content.ts` להוסיף את כל 10 ספקי צד שלישי + זכויות GDPR.
**A6.** מיגרציה מ־Google Translate (unofficial) — הסרת הפיצ׳ר זמנית או מעבר ל־DeepL.
**A7.** דחיפת vercel.json (כבר תקנתי, ממתין לדחיפה).
**A8.** כתיבת `docs/incident-response.md` עם תגובה לפריצה.

### שלב B — לפני הלאנץ׳ הפומבי (אחרי TestFlight Beta, ~4-6 שעות)

**B1.** הגדרת Custom SMTP עם Resend → כל המיילים עם מיתוג nomadspeople.
**B2.** עריכת Supabase email templates (confirm signup, reset password) עם המיתוג של nomadspeople.
**B3.** הוספת מסך "Email Preferences" ב־Settings.
**B4.** הוספת "Download my data" ב־Settings → מפעיל זכות GDPR 20.

### שלב C — לאחרי הלאנץ׳ (גרסה 1.1, שבועיים אחרי)

**C1.** Admin moderation dashboard באתר.
**C2.** Automated moderation actions.
**C3.** Inactive user cleanup cron.
**C4.** In-app contact form.

---

## 18. אישור והתקדמות

ברגע שאתה מאשר את המסמך הזה ואת שלב A, אני מתחיל מיד. סדר הבנייה יהיה:

1. vercel.json push (5 דקות)
2. מיגרציית DB עם consent fields (30 דקות)
3. AuthScreen + OnboardingScreen עם consent checkboxes (שעה וחצי)
4. עדכון Privacy Policy (30 דקות)
5. הסרת Google Translate או החלפה (שעה)
6. מסמך Incident Response (30 דקות)

**זמן כולל לשלב A: 4-5 שעות.**

אחרי שלב A, אנחנו עומדים בכל הדרישות של אפל וגוגל ויכולים לעשות submission בלי חשש סירוב על פרטיות/הסכמות.

אישור שלך?
