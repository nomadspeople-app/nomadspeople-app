/**
 * Hebrew slurs list — narrow baseline.
 *
 * This is a STARTING POINT assembled by a non-native-speaker AI
 * based on widely-documented Hebrew identity slurs. It will
 * need 15-30 minutes of review by a native Hebrew speaker
 * (the product owner, Barak) to:
 *   1. Remove terms that are too mild / casual in context
 *   2. Add terms specific to Israeli cultural tensions that
 *      this baseline misses (Mizrahi/Ashkenazi, Haredi,
 *      Druze, Arab Israeli, Ethiopian, Russian immigrants,
 *      etc.)
 *
 * All tokens pre-normalized (lowercase of Hebrew is the same
 * since Hebrew has no case; no diacritics to strip from
 * standard modern Hebrew input).
 *
 * Rule of thumb for additions:
 *   A term belongs here ONLY if using it against someone
 *   would make a reasonable Israeli judge say "that's an
 *   identity slur, not just rude speech". Rude ≠ slur.
 */

export const HEBREW_SLURS: ReadonlySet<string> = new Set([
  // Anti-Arab / anti-Muslim (most common in Israeli context)
  'ערבוש',
  'מחבל',      // borderline — "terrorist" used as ethnic slur; keep
  'בוגד',      // borderline — depends heavily on context; review

  // Anti-Jewish sub-group slurs (intra-Israeli)
  'פריאר',     // borderline casual; likely REMOVE on review
  'חרדונים',
  'דוסים',     // slur against religious Jews; borderline — review

  // Anti-Ethiopian
  'כושי',      // widely considered offensive today

  // Anti-LGBTQ+ slurs
  'הומו',      // borderline — can be descriptive or slur based on context; review
  'מתרומם',    // slur usage

  // Misogynistic slurs (identity-attack level)
  'זונה',      // context-dependent — slur when directed at someone

  // Ableist slurs
  'מפגר',
  'פגוע',      // borderline; often descriptive; consider removing

  // NOTE for Barak (review):
  //   Please add/remove terms based on your Israeli context
  //   knowledge. The list above is the widely-documented
  //   set; you know the casual / regional usage far better.
]);
