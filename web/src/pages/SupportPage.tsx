/**
 * SupportPage — /support route. Required by Apple App Store listing
 * (the "Support URL" field) and Google Play's developer info.
 *
 * Intentionally minimal: one contact email, a short FAQ covering the
 * few questions real users actually ask (account deletion, location,
 * reporting abuse, data export). No chatbot, no ticket form — those
 * come post-launch.
 */

const contactEmail = 'nomadspeople1@gmail.com';

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: '#fff',
    color: '#1A1A1A',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  hero: {
    padding: '80px 24px 48px',
    maxWidth: 720,
    margin: '0 auto',
  },
  kicker: {
    color: '#E8614D',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  h1: {
    fontSize: 38,
    fontWeight: 800,
    lineHeight: 1.15,
    margin: 0,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  lead: {
    fontSize: 18,
    lineHeight: 1.55,
    color: '#4B5563',
    margin: 0,
    marginBottom: 32,
  },
  contactCard: {
    padding: '24px 28px',
    borderRadius: 12,
    background: '#FFF5F3',
    border: '1px solid #FADFD9',
    marginBottom: 40,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#9B4A40',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  contactLink: {
    fontSize: 20,
    fontWeight: 700,
    color: '#E8614D',
    textDecoration: 'none',
  },
  faqTitle: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  faqItem: {
    borderTop: '1px solid #E5E7EB',
    padding: '20px 0',
  },
  faqQ: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    marginBottom: 8,
  },
  faqA: {
    fontSize: 15,
    lineHeight: 1.55,
    color: '#4B5563',
    margin: 0,
  },
  footer: {
    marginTop: 'auto',
    padding: '32px 24px',
    borderTop: '1px solid #E5E7EB',
    background: '#FAFAFA',
    fontSize: 13,
    color: '#6B7280',
  },
  footerInner: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLink: {
    color: '#6B7280',
    textDecoration: 'none',
  },
};

const faqs = [
  {
    q: 'How do I delete my account?',
    a: 'Open the app → Settings → Delete Account. Your profile, posts, checkins, and group memberships are removed. Messages you sent are anonymized so other members can still read the chat context. You can also delete your account from the web at nomadspeople.com/delete-account.',
  },
  {
    q: 'How does location work? Who sees where I am?',
    a: 'Your location is only shared when you publish a status or timer. Settings → "Show me on the map" toggles off all visibility globally. "Hide distance" hides how far you are from other nomads. You can only see nomads in the same country you\'re physically in.',
  },
  {
    q: 'How do I report inappropriate content or block someone?',
    a: 'On any message, tap and hold → Report. On any profile, tap the menu → Block. Blocked users can\'t message you and are removed from any shared DM. Manage your blocked list in Settings → Safety → Blocked Users.',
  },
  {
    q: 'Can I change my home country or city later?',
    a: 'Yes. Profile → edit your home country. Your current city updates automatically based on your GPS when you open the app.',
  },
  {
    q: 'I didn\'t get my email confirmation or password reset',
    a: 'Check your spam folder. If it\'s not there after 10 minutes, email us at ' + contactEmail + ' and we\'ll reset it manually.',
  },
  {
    q: 'How do I request my data?',
    a: 'Email ' + contactEmail + ' with "Data request" in the subject. We respond within 14 days per GDPR / CCPA requirements.',
  },
];

export default function SupportPage() {
  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.kicker}>Support</div>
        <h1 style={styles.h1}>We're here to help.</h1>
        <p style={styles.lead}>
          nomadspeople is built by a small team. For the fastest reply, email us
          directly — we usually respond within one business day.
        </p>

        <div style={styles.contactCard}>
          <div style={styles.contactLabel}>Contact</div>
          <a href={`mailto:${contactEmail}`} style={styles.contactLink}>
            {contactEmail}
          </a>
        </div>

        <h2 style={styles.faqTitle}>Frequently asked</h2>
        {faqs.map((f, i) => (
          <div key={i} style={styles.faqItem}>
            <p style={styles.faqQ}>{f.q}</p>
            <p style={styles.faqA}>{f.a}</p>
          </div>
        ))}
      </div>

      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <a href="/" style={styles.footerLink}>Home</a>
          <a href="/privacy" style={styles.footerLink}>Privacy</a>
          <a href="/terms" style={styles.footerLink}>Terms</a>
          <a href="/delete-account" style={styles.footerLink}>Delete Account</a>
        </div>
      </footer>
    </div>
  );
}
