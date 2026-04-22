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
  entity: 'nomadspeople',
  /** Public contact for legal questions (appears in every doc). */
  contactEmail: 'nomadspeople1@gmail.com',
  /** Effective date shown on Terms and Privacy. Update when
   *  content materially changes; minor wording tweaks do NOT
   *  need a new effective date. */
  effectiveDate: '2026-04-22',
} as const;

/* ── Versioned consent identifiers ──
 *
 * Written to app_profiles.{terms,privacy}_version_accepted and to
 * app_consent_events.version when a user signs up or re-consents.
 * When a material change to Terms or Privacy lands, bump the
 * corresponding version here AND add a forced re-consent prompt on
 * next launch.
 *
 * Format: 'YYYY-MM-DD' of the effective date of the version. */
export const TERMS_VERSION = '2026-04-22';
export const PRIVACY_VERSION = '2026-04-22';

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
  /** Meta line shown under the title ("nomadspeople · email ·
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
      title: 'Welcome to nomadspeople',
      body: [p(
        'nomadspeople is a platform that connects digital nomads and expats in your neighborhood. By using our app, you are agreeing to these terms. We built this for nomads by nomads, so we keep it real, respectful, and safe.'
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
        'When you post activities, messages, or update your profile, you retain ownership. But by posting, you give nomadspeople permission to use, display, and improve the platform based on your content (while keeping your data private per our Privacy Policy).'
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
        'nomadspeople, its logo, design, and features are ours. You cannot copy, modify, or use them without permission. Your content stays yours.'
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
        "nomadspeople is provided as-is. We don't run background checks, verify identities, or guarantee anyone's safety or authenticity. You use the platform at your own risk. Trust your instincts and follow our Safety Tips."
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
  meta: `${LEGAL_META.entity} · ${LEGAL_META.contactEmail} · Effective ${LEGAL_META.effectiveDate} · Version ${PRIVACY_VERSION}`,
  sections: [
    {
      title: 'Who We Are',
      body: [p(
        `nomadspeople is a social platform for digital nomads. This policy explains what personal data we collect, why we collect it, who we share it with, and the rights you have over your data. For any privacy question, email ${LEGAL_META.contactEmail}.`
      )],
    },
    {
      title: 'What We Collect',
      body: [ul(
        'Identity: email address, password (encrypted, never readable by us), display name, username',
        'Profile: photo, bio, interests, job type, home country, date of birth (for age verification)',
        'Location: approximate (city) and precise (latitude/longitude) — only shared when you publish a status, timer, or check-in',
        'Content you create: status posts, chat messages, photos, activity descriptions',
        'Device info: push notification token, device language, operating system version',
        'Usage signals: features you use, what you tap (only when the app is running)',
        'Diagnostics: crash reports tied to your user ID (helps us fix bugs you encountered)',
      )],
    },
    {
      title: 'Why We Collect It — Legal Basis (GDPR Article 6)',
      body: [
        p('Under the EU General Data Protection Regulation (GDPR), every piece of personal data must be processed under a lawful basis. Ours are:'),
        ul(
          'Contract — we cannot provide the service (profile, messaging, map) without processing your identity, profile, and location data. When you create an account, you enter a service agreement with us.',
          'Consent — marketing emails, push notifications, and cross-app tracking (iOS) all require your explicit opt-in. You can withdraw consent at any time in Settings.',
          'Legitimate interest — crash diagnostics, fraud prevention, and basic security telemetry help us keep the platform stable and safe. We minimize what we collect for these purposes.',
          'Legal obligation — when authorities issue a valid legal request, we comply within applicable law.',
        ),
      ],
    },
    {
      title: 'What We Share — Third-Party Processors',
      body: [
        p('We share your data only with service providers that help us deliver nomadspeople. Each of these parties is bound by a data-processing agreement (or equivalent) limiting how they can use your data:'),
        ul(
          'Supabase (EU, Frankfurt) — primary database and authentication. Stores all account and content data.',
          'Sentry (EU, Frankfurt) — crash and error reporting. Receives stack traces with your user ID attached (no chat content).',
          'Vercel — hosts nomadspeople.com (static website files only; no personal data processed here).',
          'ImprovMX — routes email sent to support@nomadspeople.com to our team inbox. Receives only message headers + body of support emails you choose to send.',
          'Apple Push Notification Service (APNs) — delivers push notifications to iOS devices. Receives your push token and the notification content.',
          'Google Firebase Cloud Messaging (FCM) — delivers push notifications to Android devices. Same data as Apple.',
          'OpenStreetMap Nominatim — reverse-geocodes coordinates to city/country names. Receives coordinates only; no user ID.',
          'Photon (Komoot) — search bar for addresses and cities. Receives your search query and the coordinates you are searching near.',
          'ipapi.co — coarse IP-based location as a fallback when GPS is unavailable. Receives your IP address only.',
        ),
        p('We do not sell your personal data to anyone. We do not share your data with advertisers.'),
      ],
    },
    {
      title: 'International Data Transfers',
      body: [
        p('Your data is processed primarily in the European Union (Supabase and Sentry are both hosted in Frankfurt, Germany). Some service providers listed above (Apple APNs, Google FCM, Vercel, ipapi.co) may process data in other regions including the United States. Where data leaves the EU, we rely on Standard Contractual Clauses (SCCs) and equivalent safeguards as required under GDPR Chapter V.'),
      ],
    },
    {
      title: 'Your Rights (GDPR + CCPA)',
      body: [
        p('Under EU GDPR and similar laws worldwide, you have the following rights regarding your personal data:'),
        ul(
          'Right of access (GDPR Art. 15) — request a copy of all personal data we hold on you.',
          'Right to rectification (Art. 16) — correct inaccurate data. You can edit most fields directly in your profile; for anything you cannot edit, email us.',
          'Right to erasure (Art. 17) — delete your account entirely. You can do this at Settings → Delete Account, or via nomadspeople.com/delete-account.',
          'Right to data portability (Art. 20) — receive your data in a structured, machine-readable format so you can move it to another service.',
          'Right to object (Art. 21) — stop us from processing your data for a particular purpose (e.g. marketing).',
          'Right to withdraw consent — opt out of marketing emails, push notifications, or cross-app tracking at any time.',
          'Right to lodge a complaint — if you are in the EU, you may file a complaint with your national data protection authority.',
        ),
        p(`To exercise any right listed above, email ${LEGAL_META.contactEmail} with your request. We respond within 14 days (30 days maximum under GDPR).`),
      ],
    },
    {
      title: 'Your Consent Choices',
      body: [
        p('When you sign up, we ask you to agree to the Terms of Service and Privacy Policy (required), confirm you are 18+ (required), and optionally opt in to marketing emails. These choices are logged with a timestamp so we can demonstrate compliance with GDPR Article 7(1).'),
        p('You can change any optional consent later in Settings → Email Preferences and Settings → Notifications. Withdrawing consent does not affect the lawfulness of processing that happened while you were opted in.'),
      ],
    },
    {
      title: 'Data Security',
      body: [
        p('We protect your data with:'),
        ul(
          'HTTPS/TLS encryption for every network request (no plaintext traffic anywhere).',
          'AES-256 encryption at rest in the Supabase database.',
          'bcrypt password hashing and automatic check against the HaveIBeenPwned breach corpus so compromised passwords are rejected.',
          'Row Level Security on every database table — users can only access their own rows, enforced at the database engine level.',
          'Automatic rate limits and content moderation to block abuse.',
          'Isolated European data residency (Frankfurt) for the primary database and error reporting.',
        ),
        p('No security system is 100 percent impenetrable. If a breach involves your personal data, we will notify you and, where required by law, the relevant data protection authority within 72 hours per GDPR Article 33.'),
      ],
    },
    {
      title: 'Data Retention',
      body: [
        p('We keep your data as follows:'),
        ul(
          'Account and profile data — as long as your account is active. Removed immediately on account deletion.',
          'Chat messages — retained in the conversation as long as it exists. When you delete your account, your messages are anonymized (the text remains so the chat makes sense to other members, but your authorship is removed).',
          'Crash reports — 90 days on Sentry by default, then automatically deleted.',
          'Database backups — 30 days rolling window (Supabase Pro). After 30 days, a deleted account is unrecoverable from backup.',
          'Support correspondence — as long as needed to handle your request and then archived for 12 months for compliance.',
        ),
      ],
    },
    {
      title: "Children's Privacy",
      body: [p(
        "nomadspeople is for adults aged 18 or older. We do not knowingly collect data from anyone under 18. If you believe we have collected data from a minor, contact us immediately and we will delete it. The 18+ requirement is enforced at signup (we ask for date of birth) and we will terminate any account found to violate it."
      )],
    },
    {
      title: 'Email Communications',
      body: [
        p('We send two types of emails:'),
        ul(
          'Transactional — account confirmation, password reset, security alerts, account deletion confirmations. These are essential to the service; you cannot opt out of them while you have an active account.',
          'Marketing — occasional product updates, tips, and announcements. These require your explicit opt-in at signup, and every message includes an unsubscribe link. You can change your preference anytime in Settings → Email Preferences.',
        ),
      ],
    },
    {
      title: 'Push Notifications',
      body: [p(
        'We send push notifications for messages, new followers, event joins, and similar activity. Your operating system asks for permission the first time we send one; you can revoke that permission anytime in your phone settings. Inside the app, Settings → Notifications lets you choose which categories you want to receive.'
      )],
    },
    {
      title: 'Changes to This Policy',
      body: [p(
        'We update this policy when our practices change. Material changes will be notified to you via email and/or an in-app prompt, and you may be asked to re-consent. Minor wording fixes do not require notification. The version and effective date at the top of this document always reflect the current live version.'
      )],
    },
    {
      title: 'Contact Us',
      body: [p(
        `For any privacy matter — including requests to exercise your rights — email ${LEGAL_META.contactEmail}. We respond within one business day for general questions and within 14 days for formal data-subject requests.`
      )],
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
        "nomadspeople is not a marketplace. Don't use it to advertise services, sell courses, recruit for MLMs, or blast promotional messages. Keep it social."
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
        'nomadspeople works because of trust. We are a community of real people looking for genuine connection. Keep it authentic, respectful, and safe.'
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
        'Keep chatting on nomadspeople until you feel comfortable',
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
        'Your safety comes first. Research local laws and customs before meeting up. Use nomadspeople visibility settings (city-only or invisible) if needed. Connect with community groups for support.'
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
        'Report the user on nomadspeople with details',
        'Contact your embassy if you are abroad',
      )],
    },
    {
      title: 'Trust Your Instincts',
      body: [p(
        "You know yourself. If something feels wrong, it probably is. There are plenty of good people on nomadspeople. Don't settle for anyone who makes you uncomfortable."
      )],
    },
    {
      title: 'Need Help?',
      body: [p(`Report a safety concern in the app anytime. Email ${LEGAL_META.contactEmail} for urgent issues.`)],
    },
  ],
};
