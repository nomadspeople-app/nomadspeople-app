/**
 * countryNames — ISO 2-letter code ↔ localized country name.
 *
 * Distinct from `lib/countries.ts` which holds the full flag +
 * autocomplete list for onboarding. This file is tighter:
 * ~35 countries we expect to see in production, each with
 * English/Hebrew/Russian names, for the geo gate alerts.
 *
 * SPEC: docs/product-decisions/2026-04-20-geo-boundaries-spec.md
 *
 * When a new country appears in real usage that isn't in this
 * map, `localizedCountryName` returns null and the caller
 * falls back to the raw ISO code. Add the entry here, ship an
 * OTA update, done. Never blocks the user.
 */

import type { Locale } from './i18n';

type CountryNames = { en: string; he: string; ru: string };

const COUNTRY_NAMES: Record<string, CountryNames> = {
  // Launch core — expected most common countries for v1 users
  IL: { en: 'Israel',       he: 'ישראל',         ru: 'Израиль'   },
  US: { en: 'USA',          he: 'ארה"ב',         ru: 'США'       },
  GB: { en: 'UK',           he: 'בריטניה',       ru: 'Великобритания' },
  DE: { en: 'Germany',      he: 'גרמניה',        ru: 'Германия'  },
  FR: { en: 'France',       he: 'צרפת',          ru: 'Франция'   },
  ES: { en: 'Spain',        he: 'ספרד',          ru: 'Испания'   },
  IT: { en: 'Italy',        he: 'איטליה',        ru: 'Италия'    },
  PT: { en: 'Portugal',     he: 'פורטוגל',       ru: 'Португалия' },
  GR: { en: 'Greece',       he: 'יוון',          ru: 'Греция'    },
  NL: { en: 'Netherlands',  he: 'הולנד',         ru: 'Нидерланды' },
  BE: { en: 'Belgium',      he: 'בלגיה',         ru: 'Бельгия'   },
  CH: { en: 'Switzerland',  he: 'שווייץ',        ru: 'Швейцария' },
  AT: { en: 'Austria',      he: 'אוסטריה',       ru: 'Австрия'   },
  SE: { en: 'Sweden',       he: 'שוודיה',        ru: 'Швеция'    },
  DK: { en: 'Denmark',      he: 'דנמרק',         ru: 'Дания'     },
  CZ: { en: 'Czechia',      he: 'צ׳כיה',         ru: 'Чехия'     },
  PL: { en: 'Poland',       he: 'פולין',         ru: 'Польша'    },

  // Digital nomad magnets
  TH: { en: 'Thailand',     he: 'תאילנד',        ru: 'Таиланд'   },
  VN: { en: 'Vietnam',      he: 'וייטנאם',       ru: 'Вьетнам'   },
  ID: { en: 'Indonesia',    he: 'אינדונזיה',     ru: 'Индонезия' },
  PH: { en: 'Philippines',  he: 'פיליפינים',     ru: 'Филиппины' },
  JP: { en: 'Japan',        he: 'יפן',           ru: 'Япония'    },
  KR: { en: 'South Korea',  he: 'דרום קוריאה',   ru: 'Южная Корея' },
  MY: { en: 'Malaysia',     he: 'מלזיה',         ru: 'Малайзия'  },
  SG: { en: 'Singapore',    he: 'סינגפור',       ru: 'Сингапур'  },
  AE: { en: 'UAE',          he: 'איחוד האמירויות', ru: 'ОАЭ'     },
  TR: { en: 'Turkey',       he: 'טורקיה',        ru: 'Турция'    },
  IN: { en: 'India',        he: 'הודו',          ru: 'Индия'     },

  // Americas
  CA: { en: 'Canada',       he: 'קנדה',          ru: 'Канада'    },
  MX: { en: 'Mexico',       he: 'מקסיקו',        ru: 'Мексика'   },
  BR: { en: 'Brazil',       he: 'ברזיל',         ru: 'Бразилия'  },
  AR: { en: 'Argentina',    he: 'ארגנטינה',      ru: 'Аргентина' },
  CO: { en: 'Colombia',     he: 'קולומביה',      ru: 'Колумбия'  },

  // Oceania + Africa
  AU: { en: 'Australia',    he: 'אוסטרליה',      ru: 'Австралия' },
  NZ: { en: 'New Zealand',  he: 'ניו זילנד',     ru: 'Новая Зеландия' },
  ZA: { en: 'South Africa', he: 'דרום אפריקה',   ru: 'ЮАР'       },

  // Border neighbors (cross-border edge cases)
  JO: { en: 'Jordan',       he: 'ירדן',          ru: 'Иордания'  },
  EG: { en: 'Egypt',        he: 'מצרים',         ru: 'Египет'    },
  CY: { en: 'Cyprus',       he: 'קפריסין',       ru: 'Кипр'      },
};

/** Returns the localized country name, or null if the ISO code
 *  isn't in our map. Callers should fall back to the raw ISO
 *  code (`countryLabel` does this automatically). */
export function localizedCountryName(
  code: string | null | undefined,
  locale: Locale,
): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  const entry = COUNTRY_NAMES[upper];
  if (!entry) return null;
  return entry[locale] ?? entry.en;
}

/** Always returns a displayable string. Prefers localized name,
 *  falls back to the raw ISO code, then to `fallback`. */
export function countryLabel(
  code: string | null | undefined,
  locale: Locale,
  fallback: string = 'Unknown',
): string {
  return localizedCountryName(code, locale) ?? code?.toUpperCase() ?? fallback;
}
