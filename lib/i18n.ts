/**
 * nomadspeople i18n system
 * ─────────────────────────
 * Lightweight translation engine with React context.
 *
 * Usage:
 *   const { t } = useI18n();
 *   <Text>{t('home.searchTitle')}</Text>
 *   <Text>{t('home.activeCount', { count: 12 })}</Text>
 */
import { createContext, useContext } from 'react';
import { I18nManager } from 'react-native';

/* ── Translation map type ── */
export type TranslationMap = Record<string, string>;

/* ── Supported locales ──
 * Trimmed 2026-04-20: removed es/pt/it/fr/de — their translation files
 * were only 19–73 % complete and shipping half-translated UI would fail
 * the App Store review guideline on language completeness. Files still
 * live in lib/translations/ for future re-introduction once fully
 * translated. When re-enabling a locale: add its code here AND in
 * CFBundleLocalizations in app.json. */
export const SUPPORTED_LOCALES = ['en', 'he', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_META: Record<Locale, { label: string; native: string; flag: string; rtl: boolean }> = {
  en: { label: 'English', native: 'English', flag: '🇬🇧', rtl: false },
  he: { label: 'עברית',   native: 'Hebrew',  flag: '🇮🇱', rtl: true  },
  ru: { label: 'Русский', native: 'Russian', flag: '🇷🇺', rtl: false },
};

/* ── Import translations — only the three supported locales ── */
import { en } from './translations/en';
import { he } from './translations/he';
import { ru } from './translations/ru';

const TRANSLATIONS: Record<Locale, TranslationMap> = { en, he, ru };

/* ── Interpolation: t('key', { count: 5 }) → replaces {{count}} ── */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}

/* ── Core translate function ── */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const map = TRANSLATIONS[locale] || TRANSLATIONS.en;
  const template = map[key] ?? TRANSLATIONS.en[key] ?? key;
  return interpolate(template, vars);
}

/* ── RTL helpers ── */
export function isRTL(locale: Locale): boolean {
  return LOCALE_META[locale]?.rtl ?? false;
}

export function applyRTL(_locale: Locale) {
  /* DELIBERATELY DISABLED — 2026-04-27.
   *
   * Tester directive: "זה שהוא החליף את השפה לעברית - זה לא אומר
   * שכל המערכת צריכה להיות מצד ימין / זה תקלה מטורפת / המערכת
   * צריכה להיות אותו הדבר / הפרופיל תמיד צריך להיות מצד ימין /
   * המערכת עצמה לא צריכה לשנות צד / רק השפה."
   *
   * We do NOT mirror the entire layout when the locale is Hebrew /
   * Arabic. Only the TEXT content within strings flips direction
   * (React Native's Text renderer handles bidi automatically — a
   * Hebrew word inside an English sentence aligns RTL, but the
   * Text element itself stays in its English-laid-out container).
   *
   * Concrete: the profile tab stays bottom-right, the back button
   * stays top-left, lists scroll left-to-right — exactly like the
   * English layout — even when the user picks Hebrew. They get
   * Hebrew COPY but the same SHAPE of app.
   *
   * Force-flipping the entire layout via I18nManager.forceRTL is
   * a Native setting that requires app restart to take effect
   * AND inverts every Stack/Flex direction across the app, which
   * the user explicitly does not want for nomadspeople.
   *
   * If we ever change our mind: re-enable forceRTL + allowRTL,
   * audit every screen for hardcoded `flexDirection: 'row'`
   * (which auto-flips to row-reverse under RTL), and ship a
   * NATIVE rebuild so existing users pick up the change.
   */
  // No-op. Locale text changes still happen via translate().
}

/* ── React Context ── */
export interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isRTL: boolean;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  isRTL: false,
});

export function useI18n() {
  return useContext(I18nContext);
}
