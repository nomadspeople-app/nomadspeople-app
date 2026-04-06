/**
 * NomadsPeople i18n system
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

/* ── All supported locales ── */
export const SUPPORTED_LOCALES = ['en', 'he', 'es', 'pt', 'it', 'fr', 'de', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_META: Record<Locale, { label: string; native: string; flag: string; rtl: boolean }> = {
  en: { label: 'English',    native: 'English',    flag: '🇬🇧', rtl: false },
  he: { label: 'עברית',      native: 'Hebrew',     flag: '🇮🇱', rtl: true },
  es: { label: 'Español',    native: 'Spanish',    flag: '🇪🇸', rtl: false },
  pt: { label: 'Português',  native: 'Portuguese',  flag: '🇵🇹', rtl: false },
  it: { label: 'Italiano',   native: 'Italian',    flag: '🇮🇹', rtl: false },
  fr: { label: 'Français',   native: 'French',     flag: '🇫🇷', rtl: false },
  de: { label: 'Deutsch',    native: 'German',     flag: '🇩🇪', rtl: false },
  ru: { label: 'Русский',    native: 'Russian',    flag: '🇷🇺', rtl: false },
};

/* ── Import translations ── */
import { en } from './translations/en';
import { he } from './translations/he';
import { es } from './translations/es';
import { pt } from './translations/pt';
import { it } from './translations/it';
import { fr } from './translations/fr';
import { de } from './translations/de';
import { ru } from './translations/ru';

const TRANSLATIONS: Record<Locale, TranslationMap> = { en, he, es, pt, it, fr, de, ru };

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

export function applyRTL(locale: Locale) {
  const rtl = isRTL(locale);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    I18nManager.allowRTL(rtl);
  }
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
