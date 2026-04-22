/**
 * Phrase-level patterns — threats + self-harm + sexual
 * targeting.
 *
 * Unlike slurs which are single-token matches, these are
 * multi-word expressions that only make sense as a phrase
 * ("I will kill you" ≠ "I will"). Regex runs against the
 * NORMALIZED text (not individual tokens).
 *
 * Keep the list short and precise. Each added pattern must
 * describe a clear threat / self-harm call — not ambiguous
 * phrasing that could appear innocently in conversation.
 *
 * To add a pattern: include anchor words so it doesn't match
 * inside an unrelated sentence. E.g. prefer `\bi will kill\b`
 * over `kill` (the latter would block "kill it on stage").
 */

export interface ModerationPattern {
  regex: RegExp;
  category: 'threat' | 'self_harm' | 'sexual';
  /** Short tag logged in app_moderation_events.matched_term
   *  for admin tuning. Never shown to user. */
  tag: string;
}

/* ─── English threats ─── */
const EN_THREATS: ModerationPattern[] = [
  {
    // Classic direct threat framing
    regex: /\bi (will|'ll|am (going|gonna)|gonna|gunna) (kill|hurt|beat|destroy|end|murder|find|get|break) (you|u|him|her|them)\b/i,
    category: 'threat',
    tag: 'en.threat.direct',
  },
  {
    // "I'll come for you" / "come after you"
    regex: /\b(i('ll| will)? )?come (for|after) (you|u|him|her|them)\b/i,
    category: 'threat',
    tag: 'en.threat.come_for',
  },
  {
    // "I know where you live/work"
    regex: /\bi know where (you|u) (live|work|sleep)\b/i,
    category: 'threat',
    tag: 'en.threat.know_where',
  },
  {
    // "You're dead" / "You're gonna die"
    regex: /\b(you're|you are|ur|u'?re) (dead|going to die|gonna die|done)\b/i,
    category: 'threat',
    tag: 'en.threat.dead',
  },
];

/* ─── English self-harm encouragement ─── */
const EN_SELF_HARM: ModerationPattern[] = [
  {
    regex: /\bkys\b/i,
    category: 'self_harm',
    tag: 'en.selfharm.kys',
  },
  {
    regex: /\b(go|just) (kill|off) (yourself|urself|yrself)\b/i,
    category: 'self_harm',
    tag: 'en.selfharm.kill_yourself',
  },
  {
    regex: /\bhang yourself\b/i,
    category: 'self_harm',
    tag: 'en.selfharm.hang',
  },
  {
    regex: /\byou should die\b/i,
    category: 'self_harm',
    tag: 'en.selfharm.should_die',
  },
];

/* ─── Hebrew threats ─── */
const HE_THREATS: ModerationPattern[] = [
  {
    regex: /אני (אהרוג|אכסח|אתפוס|אמצא|אשבור|אחסל) אותך/,
    category: 'threat',
    tag: 'he.threat.direct',
  },
  {
    regex: /אני יודע איפה אתה (גר|עובד|ישן)/,
    category: 'threat',
    tag: 'he.threat.know_where',
  },
  {
    regex: /אתה (מת|הלך עלייך|גמרת)/,
    category: 'threat',
    tag: 'he.threat.dead',
  },
];

/* ─── Hebrew self-harm ─── */
const HE_SELF_HARM: ModerationPattern[] = [
  {
    regex: /(תהרוג|תחסל) את עצמך/,
    category: 'self_harm',
    tag: 'he.selfharm.yourself',
  },
  {
    regex: /(לך|תלך) תמות/,
    category: 'self_harm',
    tag: 'he.selfharm.go_die',
  },
  {
    regex: /תתלה את עצמך/,
    category: 'self_harm',
    tag: 'he.selfharm.hang',
  },
];

/* ─── Russian threats ─── */
const RU_THREATS: ModerationPattern[] = [
  {
    regex: /я (убью|найду|поймаю|уничтожу|прикончу) тебя/i,
    category: 'threat',
    tag: 'ru.threat.direct',
  },
  {
    regex: /я знаю где ты (живёшь|живешь|работаешь)/i,
    category: 'threat',
    tag: 'ru.threat.know_where',
  },
];

/* ─── Russian self-harm ─── */
const RU_SELF_HARM: ModerationPattern[] = [
  {
    regex: /убей себя/i,
    category: 'self_harm',
    tag: 'ru.selfharm.kill_self',
  },
  {
    regex: /иди сдохни/i,
    category: 'self_harm',
    tag: 'ru.selfharm.go_die',
  },
];

/* ─── Sexual targeting (all languages) ───
 *
 * Much harder to detect with regex alone — intent
 * determines whether "I want to kiss you" is flirty in a
 * consenting context or harassment. For v1 we ONLY catch
 * the most obvious patterns: direct explicit demands paired
 * with a "you"-target cue.
 *
 * Defer deeper detection to OpenAI Moderation API (server-
 * side, post-launch). */
const SEXUAL_TARGETED: ModerationPattern[] = [
  {
    // Unsolicited explicit body-part demands aimed at someone
    regex: /\b(send|show) (me )?(your|ur) (nudes?|tits|dick|pussy|boobs|ass)\b/i,
    category: 'sexual',
    tag: 'en.sexual.demand_photos',
  },
  {
    regex: /\bi want (to )?(fuck|bang|rape) (you|u|her|him)\b/i,
    category: 'sexual',
    tag: 'en.sexual.intent',
  },
  {
    // Hebrew equivalent
    regex: /(שלחי|שלח) לי (תמונות? ?עירום|ציצים|תחת)/,
    category: 'sexual',
    tag: 'he.sexual.demand_photos',
  },
  {
    regex: /(שלחи|пришли) (мне )?(голые фото|нюдсы)/i,
    category: 'sexual',
    tag: 'ru.sexual.demand_photos',
  },
];

export const ALL_PATTERNS: ReadonlyArray<ModerationPattern> = [
  ...EN_THREATS,
  ...EN_SELF_HARM,
  ...HE_THREATS,
  ...HE_SELF_HARM,
  ...RU_THREATS,
  ...RU_SELF_HARM,
  ...SEXUAL_TARGETED,
];
