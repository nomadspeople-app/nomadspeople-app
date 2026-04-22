/**
 * English slurs list — narrow scope per launch freedom policy.
 *
 * ONLY identity-targeted slurs. Casual profanity (fuck, shit,
 * asshole, etc.) is explicitly allowed — see
 * docs/product-decisions/2026-04-20-launch-freedom-policy.md.
 *
 * Tokens are pre-normalized (lowercase, no diacritics,
 * leetspeak-collapsed). The scanner tokenizes input the same
 * way, then looks up each token here.
 *
 * Adding / removing terms:
 *   • Each entry must be a genuine identity slur, not strong
 *     language. If you're unsure, LEAVE IT OUT — a false
 *     positive costs more than a false negative at launch.
 *   • Expect a native English speaker + legal/safety review
 *     before expanding this list past ~40 items.
 */

export const ENGLISH_SLURS: ReadonlySet<string> = new Set([
  // Racial slurs (the ones Apple will definitely test with)
  'nigger', 'nigga', 'niger',        // Black
  'chink', 'gook',                    // East Asian
  'spic', 'wetback',                  // Latino
  'kike', 'yid',                      // Jewish
  'towelhead', 'camel jockey',        // Middle Eastern (phrase — may need split handling)
  'redskin',                          // Native American

  // Homophobic / queerphobic slurs
  'faggot', 'fag',
  'dyke',
  'tranny',

  // Misogynistic slurs that function as identity attack
  'cunt',                             // Borderline — UK/AU casual, US slur. Keep for US-centric App Store reviewer.

  // Disability slurs
  'retard', 'retarded',
]);
