export default function TermsPage() {
  return (
    <div style={wrap}>
      <nav style={nav}>
        <a href="/" style={logo}>nomadspeople</a>
      </nav>

      <article style={article}>
        <h1 style={h1}>Terms of Service</h1>
        <p style={meta}>NomadsPeople &middot; nomadspeople1@gmail.com &middot; Last updated April 9, 2026</p>

        <p style={p}>
          These terms govern your use of the NomadsPeople mobile application (&ldquo;the
          app&rdquo;). By creating an account you accept them in full.
        </p>

        <h2 style={h2}>1 &mdash; Eligibility</h2>
        <p style={p}>
          You must be at least 18 years old to use NomadsPeople. We verify age during onboarding
          and reserve the right to terminate any account that misrepresents age. One person, one
          account. No bots, no impersonation.
        </p>

        <h2 style={h2}>2 &mdash; Your Account</h2>
        <p style={p}>
          You are responsible for everything that happens under your account. Use a real name (or
          authentic nickname) and a genuine photo. Keep your credentials private and notify us
          immediately if you suspect unauthorized access.
        </p>

        <h2 style={h2}>3 &mdash; Content Ownership</h2>
        <p style={p}>
          You own the content you post (text, photos, activities). By posting it on NomadsPeople
          you grant us a limited, non-exclusive license to display, distribute, and cache it within
          the app for the purpose of operating the service. We will never sell your content.
        </p>

        <h2 style={h2}>4 &mdash; Prohibited Conduct</h2>
        <p style={p}>The following are strictly prohibited on NomadsPeople:</p>
        <ul style={ul}>
          <li style={li}>Harassment, bullying, hate speech, or discrimination of any kind</li>
          <li style={li}>Threats, violence, or illegal activity</li>
          <li style={li}><strong>Child sexual abuse material (CSAM) or any content that sexualizes,
            exploits, or endangers minors &mdash; zero tolerance, reported to law
            enforcement</strong></li>
          <li style={li}>Spam, scams, pyramid schemes, or unsolicited commercial messages</li>
          <li style={li}>Sexually explicit or unsolicited intimate content</li>
          <li style={li}>Fake profiles, impersonation, or identity manipulation</li>
          <li style={li}>Sharing another person&rsquo;s private information without their consent</li>
          <li style={li}>Automated access, scraping, bots, or reverse-engineering</li>
        </ul>

        <h2 style={h2}>5 &mdash; Location &amp; Visibility</h2>
        <p style={p}>
          NomadsPeople shows your position on a live map at neighborhood precision. You control
          this entirely through the &ldquo;Show me on the map&rdquo; toggle. When turned off, you
          become invisible: you cannot see others, others cannot see you, and you cannot join new
          groups or activities. Existing conversations remain accessible.
        </p>

        <h2 style={h2}>6 &mdash; Notifications</h2>
        <p style={p}>
          We send push notifications for messages, nearby activity, and safety alerts. You can
          disable any category individually in Settings. We will not use notifications for
          unsolicited marketing unless you explicitly opt in.
        </p>

        <h2 style={h2}>7 &mdash; Intellectual Property</h2>
        <p style={p}>
          The NomadsPeople name, logo, design system, and underlying technology are our property.
          You may not copy, adapt, or distribute them without written permission.
        </p>

        <h2 style={h2}>8 &mdash; Reporting &amp; Moderation</h2>
        <p style={p}>
          You can report any user, post, comment, or message through the app. We review reports
          and take action within 24 hours. Enforcement ranges from a warning on a first offense
          to permanent removal for serious or repeated violations.
        </p>

        <h2 style={h2}>9 &mdash; Disclaimer</h2>
        <p style={p}>
          NomadsPeople is provided &ldquo;as-is.&rdquo; We do not run background checks or verify
          identities beyond basic age confirmation. Use your own judgment when meeting people.
        </p>

        <h2 style={h2}>10 &mdash; Limitation of Liability</h2>
        <p style={p}>
          To the maximum extent permitted by law, NomadsPeople is not liable for: harm arising
          from in-person meetings arranged through the app; loss or theft of personal property;
          service interruptions; data loss; or any indirect, consequential, or incidental damages.
        </p>

        <h2 style={h2}>11 &mdash; Account Deletion</h2>
        <p style={p}>
          You may delete your account at any time from Settings inside the app or via our
          <a href="/delete-account" style={link}> web deletion page</a>. Upon deletion we
          remove your profile, posts, photos, messages, and map presence. Some anonymized data
          may be retained for legal or safety purposes.
        </p>

        <h2 style={h2}>12 &mdash; Termination by Us</h2>
        <p style={p}>
          We may suspend or terminate accounts that violate these terms, our community guidelines,
          or applicable law. Serious violations (threats, CSAM, illegal activity) result in
          immediate permanent removal without prior warning.
        </p>

        <h2 style={h2}>13 &mdash; Changes</h2>
        <p style={p}>
          We may update these terms. Material changes will be communicated in the app. Continued
          use after notification constitutes acceptance.
        </p>

        <h2 style={h2}>14 &mdash; Contact</h2>
        <p style={p}>
          Questions? Email <a href="mailto:nomadspeople1@gmail.com" style={link}>nomadspeople1@gmail.com</a>.
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
const ul: React.CSSProperties = { paddingLeft: 20, marginBottom: 12 }
const li: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: '#444', marginBottom: 6 }
const link: React.CSSProperties = { color: '#E8614D', textDecoration: 'none' }
const footer: React.CSSProperties = { borderTop: '1px solid #eee', padding: '24px', textAlign: 'center' }
const footerInner: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 }
const footerLink: React.CSSProperties = { color: '#999', textDecoration: 'none', fontSize: 13 }
const footerCopy: React.CSSProperties = { fontSize: 12, color: '#ccc', margin: 0 }
