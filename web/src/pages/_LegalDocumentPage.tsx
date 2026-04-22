/**
 * _LegalDocumentPage — shared web renderer for any
 * LegalDocument from `lib/legal/content`. Used by both
 * PrivacyPage and TermsPage. The underscore prefix signals
 * "internal helper, not a public route".
 */
import type { LegalDocument, LegalBlock } from '../../../lib/legal/content';

export default function LegalDocumentPage({ doc }: { doc: LegalDocument }) {
  return (
    <div style={wrap}>
      <nav style={nav}>
        <a href="/" style={logo}>nomadspeople</a>
      </nav>

      <article style={article}>
        <h1 style={h1}>{doc.title}</h1>
        <p style={meta}>{doc.meta}</p>

        {doc.sections.map((section, i) => (
          <section key={i}>
            <h2 style={h2}>
              {i + 1} &mdash; {section.title}
            </h2>
            {section.body.map((block: LegalBlock, j) =>
              block.kind === 'paragraph' ? (
                <p key={j} style={p}>{block.text}</p>
              ) : (
                <ul key={j} style={ul}>
                  {block.items.map((item, k) => (
                    <li key={k} style={li}>{item}</li>
                  ))}
                </ul>
              )
            )}
          </section>
        ))}
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
  );
}

/* ─── Styles — same look & feel the old hand-coded pages had ─── */

const wrap: React.CSSProperties = { fontFamily: "'Inter', -apple-system, sans-serif", color: '#1A1A1A', background: '#FAFAF8', minHeight: '100vh', display: 'flex', flexDirection: 'column' };
const nav: React.CSSProperties = { padding: '16px 24px', borderBottom: '1px solid #eee', background: 'rgba(250,250,248,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 };
const logo: React.CSSProperties = { fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: '#1A1A1A', textDecoration: 'none' };
const article: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px', flex: 1 };
const h1: React.CSSProperties = { fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 40, marginBottom: 12 };
const meta: React.CSSProperties = { fontSize: 13, color: '#999', marginBottom: 32 };
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: '#444', marginBottom: 12 };
const ul: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: '#444', marginBottom: 12, paddingLeft: 24 };
const li: React.CSSProperties = { marginBottom: 6 };
const footer: React.CSSProperties = { borderTop: '1px solid #eee', padding: '24px', textAlign: 'center' };
const footerInner: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12 };
const footerLink: React.CSSProperties = { color: '#999', textDecoration: 'none', fontSize: 13 };
const footerCopy: React.CSSProperties = { fontSize: 12, color: '#ccc', margin: 0 };
