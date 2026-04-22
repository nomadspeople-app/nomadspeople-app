/**
 * legal/content — THE canonical source of truth for all
 * legal documents (Terms, Privacy, Guidelines, Safety).
 *
 * Why this file exists:
 *   Before 2026-04-20, legal text was hardcoded inside
 *   both `screens/LegalScreen.tsx` (app) and
 *   `web/src/pages/PrivacyPage.tsx` / `TermsPage.tsx`
 *   (website). The two had drifted in wording — same
 *   intent, different phrasing — which is the kind of
 *   mismatch App Store reviewers flag ("your in-app
 *   Privacy Policy says X, the linked URL says Y").
 *
 *   This module is the ONE place legal content lives.
 *   Both the mobile app and the marketing website read
 *   from it via their respective renderers. When we
 *   update the text, we update it HERE — and both
 *   surfaces pick up the change.
 *
 * Shape:
 *   Each document is a list of sections. Each section has
 *   a title and a body — an array of paragraphs / lists.
 *   Pure data. No React, no HTML. Each renderer decides
 *   how to present it.
 */

/* ── Canonical metadata — single source of truth ── */

export const LEGAL_META = {
  /** Name used in headers and as the copyright holder. */
  entity: 'NomadsPeople',
  /** Public contact for legal questions (appears in every doc). */
  contactEmail: 'nomadspeople1@gmail.com',
  /** Effective date shown on Terms and Privacy. Update when
   *  content materially changes; minor wording tweaks do NOT
   *  need a new effective date. */
  effectiveDate: '2026-04-05',
} as const;

/* ── Structural types ── */

export interface LegalParagraph {
  kind: 'paragraph';
  text: string;
}

export interface LegalList {
  kind: 'list';
  items: string[];
}

export type LegalBlock = LegalParagraph | LegalList;

export interface LegalSection {
  title: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  /** Document title — "Terms of Service", "Privacy Policy", etc. */
  title: string;
  /** Meta line shown under the title ("NomadsPeople · email ·
   *  Effective April 5, 2026"). */
  meta: string;
  sections: LegalSection[];
}

/* ── Block constructors — tiny helpers for readability ── */

const p = (text: string): LegalParagraph => ({ kind: 'paragraph', text });
const ul = (...items: string[]): LegalList => ({ kind: 'list', items });

/* ══════════════════════════════════════════════════════════
   TERMS OF SERVICE
   ══════════════════════════════════════════════════════════ */

export const TERMS: LegalDocument = {
  title: 'Terms of Service',
  meta: `${LEGAL_META.entity} · ${LEGAL_META.contactEmail} · Effective ${LEGAL_META.effectiveDate}`,
  sections: [
    {
      title: 'Welcome to NomadsPeople',
      body: [p(
        'NomadsPeople is a platform that connects digital nomads and expats in your neighborhood. By using our app, you are agreeing to these terms. We built this for nomads by nomads, so we keep it real, respectful, and safe.'
      )],
    },
    {
      title: 'Who Can Use This',
      body: [ul(
        'You must be at least 18 years old',
        'You agree to use your real name or authentic nickname and real photo',
        'One person, one account only',
        'No impersonation, bots, or fake profiles',
        'You can only use this if you agree to follow our guidelines',
      )],
    },
    {
      title: 'Your Account & Responsibilities',
      body: [p(
        "You are responsible for keeping your password secure and for everything that happens on your account. If someone unauthorized uses it, tell us right away. Don't share your login with anyone else."
      )],
    },
    {
      title: 'Content You Create',
      body: [p(
        'When you post activities, messages, or update your profile, you retain ownership. But by posting, you give NomadsPeople permission to use, display, and improve the platform based on your content (while keeping your data private per our Privacy Policy).'
      )],
    },
    {
      title: 'What is Not Allowed',
      body: [ul(
        'Harassment, bullying, hate speech, or discrimination',
        'Threats, violence, or illegal activity',
        'Spam, scams, or commercial solicitation',
        'Explicit or unsolicited sexual content',
        'Fake profiles or impersonation',
        "Sharing other people's personal info without consent",
        'Hacking, bots, or automated abuse',
      )],
    },
    {
      title: 'Intellectual Property',
      body: [p(
        'NomadsPeople, its logo, design, and features are ours. You cannot copy, modify, or use them without permission. Your content stays yours.'
      )],
    },
    {
      title: 'Location Features and Your Privacy',
      body: [p(
        'We show your location on the map at a city-level grid for your safety and discovery. You control your visibility with Snooze Mode to hide from the map anytime. Check our Privacy Policy for full details.'
      )],
    },
    {
      title: 'Push Notifications',
      body: [p(
        'We send you notifications about matches, nearby people, and messages you want to know about. You can turn these off anytime in your settings.'
      )],
    },
    {
      title: 'No Guarantees (Disclaimer)',
      body: [p(
        "NomadsPeople is provided as-is. We don't run background checks, verify identities, or guarantee anyone's safety or authenticity. You use the platform at your own risk. Trust your instincts and follow our Safety Tips."
      )],
    },
    {
      title: 'We are Not Liable For…',
      body: [ul(
        'Harm from meetings arranged through the app',
        'Lost, stolen, or damaged items',
        'Issues with other users',
        'Service interruptions or data loss',
        'Any indirect or consequential damages',
      )],
    },
    {
      title: 'Account Termination',
      body: [p(
        'We can remove your account if you break these rules or our guidelines. You can delete your account anytime in Settings. We will keep some data for legal/safety reasons but will stop using it.'
      )],
    },
    {
      title: 'Changes to Terms',
      body: [p(
        'We may update these terms. If we make big changes, we will let you know. Continuing to use the app means you accept the new terms.'
      )],
    },
    {
      title: 'Questions?',
      body: [p(`Email us at ${LEGAL_META.contactEmail}`)],
    },
  ],
};

/* ══════════════════════════════════════════════════════════
   PRIVACY POLICY
   ══════════════════════════════════════════════════════════ */

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  meta: `${LEGAL_META.entity} · ${LEGAL_META.contactEmail} · Effective ${LEGAL_META.effectiveDate}`,
  sections: [
    {
      title: 'What We Collect',
      body: [ul(
        'Profile info: name, photo, bio, interests, job, home country',
        'Location: city-level grid position for map display',
        'Activity: statuses, activities, timers you create',
        'Messages: DMs and group chat conversations',
        'Device info: phone type, OS version, unique identifiers',
        'Usage: features you use, how long, what you tap',
        'Push notification preferences',
      )],
    },
    {
      title: 'How We Use Your Data',
      body: [ul(
        'Show your profile and location to other nomads in your city',
        'Match you with people based on interests (DNA matching)',
        'Deliver push notifications you have opted into',
        'Improve the app with analytics (anonymized)',
        'Support you with customer service',
        'Keep the platform safe from abuse',
      )],
    },
    {
      title: 'What We Share',
      body: [
        p('Your Public Profile — other users see your name, photo, bio, interests, and location (city-level grid).'),
        p('Service Providers — we use Supabase (PostgreSQL) for data storage and Expo for push notifications. They have access to your data to provide these services.'),
        p('Law Enforcement — if required by law, we may share data with authorities.'),
        p('We never sell your data to third parties.'),
      ],
    },
    {
      title: 'Data Security',
      body: [p(
        'We use encryption, secure authentication, and Row Level Security (database-level protection) to keep your data safe. But no system is 100 percent secure. If there is a breach, we will notify you.'
      )],
    },
    {
      title: 'Your Rights',
      body: [ul(
        'Access your data: request a copy of what we have on you',
        'Delete your account: removes your profile and messages',
        'Export your data: get your profile info in a portable format',
        'Correct info: update your profile anytime',
        'Block users: they cannot see you or message you',
      )],
    },
    {
      title: 'Data Retention',
      body: [p(
        'Messages are kept as long as the conversation exists. Your profile data stays until you delete it. We keep some anonymized usage data to improve the service.'
      )],
    },
    {
      title: "Children's Privacy",
      body: [p(
        "NomadsPeople is for ages 18+. We don't knowingly collect data from minors. If we find out a user is under 18, we will terminate their account."
      )],
    },
    {
      title: 'International Data',
      body: [p(
        'We operate globally. Your data may be processed in different countries. By using NomadsPeople, you consent to this.'
      )],
    },
    {
      title: 'Changes to This Policy',
      body: [p(
        'We update this policy as needed. Big changes will be notified to you. Continuing to use means you accept the changes.'
      )],
    },
    {
      title: 'Contact Us',
      body: [p(`Have privacy questions? Email ${LEGAL_META.contactEmail}`)],
    },
  ],
};

/* ══════════════════════════════════════════════════════════
   COMMUNITY GUIDELINES
   ══════════════════════════════════════════════════════════ */

export const GUIDELINES: LegalDocument = {
  title: 'Community Guidelines',
  meta: `${LEGAL_META.entity} · Community Standards · Effective ${LEGAL_META.effectiveDate}`,
  sections: [
    {
      title: 'Be Real',
      body: [p(
        'Use your authentic name (or genuine nickname), a real photo of your face, and honest info. Fake profiles kill the vibe and get removed fast.'
      )],
    },
    {
      title: 'Be Respectful',
      body: [ul(
        'No harassment, hate speech, or discrimination of any kind',
        "Respect people's identities, beliefs, and backgrounds",
        'Disagree politely. We are from all over the world',
        "Don't spam, troll, or bait people",
      )],
    },
    {
      title: 'Keep It Safe',
      body: [ul(
        'No threats, violence, or illegal activity',
        'No explicit sexual content or unsolicited nudes',
        'No selling drugs, weapons, or stolen goods',
        'No scams, MLM schemes, or financial manipulation',
      )],
    },
    {
      title: 'No Spam or Selling',
      body: [p(
        "NomadsPeople is not a marketplace. Don't use it to advertise services, sell courses, recruit for MLMs, or blast promotional messages. Keep it social."
      )],
    },
    {
      title: 'Profile Rules',
      body: [ul(
        'Real photo of your face (not a meme, celebrity, or your dog)',
        'Use your real name or authentic nickname',
        "Don't put links to external sites in your bio",
        'Keep sensitive info (address, ID, finances) off the platform',
        'One account per person',
      )],
    },
    {
      title: 'Chat Etiquette',
      body: [ul(
        "Respect people's boundaries. If they are not interested, accept it",
        "Don't send unsolicited explicit images",
        "Keep conversations on the app (don't immediately ask for WhatsApp)",
        'Report any uncomfortable behavior',
      )],
    },
    {
      title: 'Activity Rules',
      body: [ul(
        'Post activities for public places and legitimate meetups',
        'Be honest about timing, location, and what you are doing',
        'Respect others time. Cancel if you cannot make it',
        'No activities for selling, recruiting, or promoting commercial stuff',
      )],
    },
    {
      title: 'Blocking and Reporting',
      body: [p(
        'See someone breaking the rules? Report them. Block anyone who makes you uncomfortable. We will investigate reports and remove accounts that violate guidelines.'
      )],
    },
    {
      title: 'Enforcement',
      body: [ul(
        'First offense: warning and explanation',
        'Second offense: 7-day suspension',
        'Third offense or serious violations: permanent ban',
        'We may terminate immediately for threats, harassment, or illegal activity',
      )],
    },
    {
      title: 'The Bottom Line',
      body: [p(
        'NomadsPeople works because of trust. We are a community of real people looking for genuine connection. Keep it authentic, respectful, and safe.'
      )],
    },
  ],
};

/* ══════════════════════════════════════════════════════════
   SAFETY TIPS
   ══════════════════════════════════════════════════════════ */

export const SAFETY: LegalDocument = {
  title: 'Safety Tips',
  meta: `${LEGAL_META.entity} · Safety Guide · Keep Yourself Safe`,
  sections: [
    {
      title: 'Before You Meet Someone',
      body: [ul(
        'Meet in a public place (cafe, restaurant, co-working space)',
        'Tell a trusted friend where you are going and who you are meeting',
        'Keep chatting on NomadsPeople until you feel comfortable',
        'Trust your gut. If something feels off, cancel',
        'Plan to leave whenever you want (no obligation to stay)',
        "Check the person's profile history and mutual connections",
      )],
    },
    {
      title: 'During the Meetup',
      body: [ul(
        'Stay aware of your surroundings',
        'Keep your phone charged and accessible',
        "Don't share financial info, ID numbers, or passwords",
        'Keep your valuables with you',
        'It is OK to leave early if you are uncomfortable',
        'If anyone makes you feel unsafe, get out and report it',
      )],
    },
    {
      title: 'After the Meetup',
      body: [ul(
        'Let your friend know you are safe',
        'If something felt wrong, block and report the person',
        'Stay in touch with people you genuinely connected with',
        'Leave feedback to help the community stay safe',
      )],
    },
    {
      title: 'Online Safety',
      body: [ul(
        'Never send money, even if the story sounds real',
        "Don't share passwords, bank info, or ID numbers",
        'Be skeptical of too-good-to-be-true offers',
        "Use the app to communicate. Don't move to personal channels too fast",
        'Scammers prey on lonely travelers. Stay aware.',
      )],
    },
    {
      title: 'For LGBTQ+ Nomads',
      body: [p(
        'Your safety comes first. Research local laws and customs before meeting up. Use NomadsPeople visibility settings (city-only or invisible) if needed. Connect with community groups for support.'
      )],
    },
    {
      title: 'Global Emergency Resources',
      body: [ul(
        "US/Canada: 911 (or your country's emergency number)",
        'Europe: 112 (across EU)',
        'International SOS: +1-215-537-7600',
        'Polaris Project (trafficking): 1-844-888-FREE',
        'RAINN (sexual assault): 1-800-656-HOPE',
      )],
    },
    {
      title: 'If Something Goes Wrong',
      body: [ul(
        'Contact local police if you are in immediate danger',
        'Tell a trusted friend or family member',
        'Document what happened (screenshots, times, dates)',
        'Report the user on NomadsPeople with details',
        'Contact your embassy if you are abroad',
      )],
    },
    {
      title: 'Trust Your Instincts',
      body: [p(
        "You know yourself. If something feels wrong, it probably is. There are plenty of good people on NomadsPeople. Don't settle for anyone who makes you uncomfortable."
      )],
    },
    {
      title: 'Need Help?',
      body: [p(`Report a safety concern in the app anytime. Email ${LEGAL_META.contactEmail} for urgent issues.`)],
    },
  ],
};
