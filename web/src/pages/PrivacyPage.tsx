export default function PrivacyPage() {
  return (
    <div style={wrap}>
      <nav style={nav}>
        <a href="/" style={logo}>nomadspeople</a>
      </nav>

      <article style={article}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={meta}>NomadsPeople &middot; nomadspeople1@gmail.com &middot; Last updated April 9, 2026</p>

        <p style={p}>
          NomadsPeople (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the NomadsPeople mobile
          application. This document explains exactly what personal data we collect, why, and what
          control you have over it.
        </p>

        <h2 style={h2}>1 &mdash; Data We Collect</h2>
        <p style={p}>We collect only what is needed to run a social map for digital nomads:</p>
        <p style={p}>
          <strong>Account data</strong> &mdash; email address and authentication token from your
          sign-in provider (Apple or Google). We never see or store your password.
        </p>
        <p style={p}>
          <strong>Profile data</strong> &mdash; display name, photo, bio, birth year, home country,
          current city, job type, nomad type, interests (&ldquo;DNA&rdquo;), and featured tags you
          choose.
        </p>
        <p style={p}>
          <strong>Location</strong> &mdash; when you allow it, we record your geographic coordinates
          to place you on the live map. Your position is displayed at a neighborhood level
          (approximately 500&ndash;800&thinsp;m precision). You can disable this at any time with the
          &ldquo;Show me on the map&rdquo; toggle, which makes you fully invisible.
        </p>
        <p style={p}>
          <strong>Content you create</strong> &mdash; posts, comments, group-chat messages, activity
          listings, and photos you upload.
        </p>
        <p style={p}>
          <strong>Device &amp; usage info</strong> &mdash; device model, OS version, push-notification
          token, and anonymized interaction events (which screens you open, how long you stay). We
          do not collect advertising identifiers.
        </p>

        <h2 style={h2}>2 &mdash; Why We Use It</h2>
        <p style={p}>
          <strong>Core functionality</strong> &mdash; display your pin on the map, match you with
          nearby nomads via interests (&ldquo;DNA matching&rdquo;), deliver messages and
          notifications, and show group activities.
        </p>
        <p style={p}>
          <strong>Safety &amp; moderation</strong> &mdash; investigate reports, enforce our community
          guidelines, and prevent abuse.
        </p>
        <p style={p}>
          <strong>Product improvement</strong> &mdash; anonymized analytics help us understand which
          features are used and where the app can improve. We do not build advertising profiles.
        </p>

        <h2 style={h2}>3 &mdash; Who Sees Your Data</h2>
        <p style={p}>
          <strong>Other users</strong> &mdash; your public profile (name, photo, bio, interests,
          city) is visible to other NomadsPeople members when you have &ldquo;Show me on the
          map&rdquo; turned on. When it is off, nobody can see you.
        </p>
        <p style={p}>
          <strong>Infrastructure providers</strong> &mdash; we use Supabase (PostgreSQL database with
          Row-Level Security) for storage and Expo for push notifications. These providers process
          data on our behalf under strict contractual obligations.
        </p>
        <p style={p}>
          <strong>Law enforcement</strong> &mdash; we will share data only when legally compelled
          (court order, subpoena).
        </p>
        <p style={p}>We do not sell, rent, or trade personal data. Ever.</p>

        <h2 style={h2}>4 &mdash; Security</h2>
        <p style={p}>
          All traffic between the app and our servers travels over TLS (HTTPS). Our database enforces
          Row-Level Security so every query is scoped to the requesting user. Authentication uses
          industry-standard tokens. No system is bulletproof, but we apply reasonable technical
          safeguards. If a breach occurs, we will notify affected users promptly.
        </p>

        <h2 style={h2}>5 &mdash; Your Rights &amp; Choices</h2>
        <p style={p}>
          <strong>Access</strong> &mdash; request a machine-readable export of your data by emailing
          us.
        </p>
        <p style={p}>
          <strong>Correction</strong> &mdash; edit your profile at any time inside the app.
        </p>
        <p style={p}>
          <strong>Deletion</strong> &mdash; delete your account from Settings inside the app, or
          from our <a href="/delete-account" style={link}>web deletion page</a>. Deletion removes
          your profile, posts, messages, photos, and map presence. We may retain minimal anonymized
          records for abuse-prevention purposes as permitted by law.
        </p>
        <p style={p}>
          <strong>Visibility</strong> &mdash; toggle &ldquo;Show me on the map&rdquo; to become
          instantly invisible. While invisible you cannot see others and others cannot see you.
        </p>
        <p style={p}>
          <strong>Notifications</strong> &mdash; disable any notification category in Settings, or
          revoke push permissions at the OS level.
        </p>

        <h2 style={h2}>6 &mdash; Data Retention</h2>
        <p style={p}>
          Profile data persists until you delete your account. Messages persist as long as the
          conversation exists. Anonymized analytics are retained indefinitely to improve the
          service.
        </p>

        <h2 style={h2}>7 &mdash; Age Restriction</h2>
        <p style={p}>
          NomadsPeople is strictly for users aged 18 and over. We verify age during onboarding. If
          we discover an underage user, we will terminate the account and delete all associated data
          immediately.
        </p>

        <h2 style={h2}>8 &mdash; International Transfers</h2>
        <p style={p}>
          We operate globally. Your data may be processed in countries other than where you reside.
          By using NomadsPeople you acknowledge this. We ensure our providers maintain appropriate
          safeguards regardless of geography.
        </p>

        <h2 style={h2}>9 &mdash; Changes</h2>
        <p style={p}>
          We may revise this policy. Material changes will be communicated through the app.
          Continued use after notification constitutes acceptance.
        </p>

        <h2 style={h2}>10 &mdash; Contact</h2>
        <p style={p}>
          Questions about your privacy? Email <a href="mailto:nomadspeople1@gmail.com" style={link}>nomadspeople1@gmail.com</a>.
        </p>
      </article>

      <footer style={footer}>
        <div style={footerInner}>
          <a href="/" style={footerLink}>Home</a>
          <a href="/terms" style={footerLink}>Terms</a>
          <a href="/privacy" style={footerLink}>Privacy</a>
          <a href="/delete-account" style={footerLink}>Delete Account</a>
        </div>
        <p style={footerCopy}>&copy; {new Date().getFullYear()} NomadsPeople</p>
      </footer>
    </div>
  )
}

const wrap: React.CSSProperties = { fontFamily: "'Inter', -apple-system, sans-serif", color: '#1A1A1A', background: '#FAFAF8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }
const nav: React.CSSProperties = { padding: '16px 24px', borderBottom: '1px solid #eee', background: 'rgba(250,250,248,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }
const logo: React.CSSProperties = { fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: '#1A1A1A', textDecoration: 'none' }
const article: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px', flex: 1 }
const h1: React.CSSProperties = { fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 }
const meta: React.CSSProperties = { fontSize: 13, color: '#999', marginBottom: 32 }
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: '#444', marginBottom: 12 }
const link: React.CSSProperties = { color: '#E8614D', textDecoration: 'none' }
const footer: React.CSSProperties = { borderTop: '1px solid #eee', padding: '24px', textAlign: 'center' }
const footerInner: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }
const footerLink: React.CSSProperties = { color: '#999', textDecoration: 'none', fontSize: 13 }
const footerCopy: React.CSSProperties = { fontSize: 12, color: '#ccc', margin: 0 }
