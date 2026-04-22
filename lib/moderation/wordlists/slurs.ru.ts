/**
 * Russian slurs list — narrow baseline.
 *
 * NARROW ONLY — excludes the full мат vocabulary (casual
 * Russian profanity like "блять", "пиздец" is allowed per
 * the launch freedom policy).
 *
 * This is a STARTING POINT. A native Russian speaker should
 * review within 4-8 weeks post-launch (or use OpenAI
 * Moderation API for server-side coverage). Same rule of
 * thumb: identity attack → include; casual rude → exclude.
 */

export const RUSSIAN_SLURS: ReadonlySet<string> = new Set([
  // Ethnic slurs (xenophobia toward non-Russians)
  'хач',        // anti-Caucasian/Armenian
  'чурка',      // anti-Central Asian
  'жид',        // anti-Jewish
  'негр',       // anti-Black (context-dependent in RU but widely considered offensive)

  // Anti-LGBTQ+
  'пидор', 'пидорас',
  'педик',

  // Anti-Roma
  'цыганва',

  // Anti-disabled
  'даун',       // slur usage (not the medical term спроси down syndrome)
  'дебил',      // borderline — casual rude in RU, but counts as ableist slur

  // Misogynistic identity attack
  'шлюха',      // context-dependent when directed at someone
]);
