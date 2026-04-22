import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  MapPin, Users, MessageCircle, Globe, Zap, Shield,
  ArrowRight, Plane, Star, Download
} from 'lucide-react'

// ── Global CSS reset — injected once at module load so the page never
// overflows horizontally on iPhone / small screens. Without this, the
// browser default <body margin:8px> and missing box-sizing cause the
// "shakes sideways" symptom on mobile.
const GLOBAL_CSS = `
  html, body, #root {
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    -webkit-text-size-adjust: 100%;
  }
  *, *::before, *::after { box-sizing: border-box; }
  img, svg { max-width: 100%; display: block; }
  a { -webkit-tap-highlight-color: transparent; }
`

if (typeof document !== 'undefined' && !document.getElementById('np-landing-reset')) {
  const style = document.createElement('style')
  style.id = 'np-landing-reset'
  style.textContent = GLOBAL_CSS
  document.head.appendChild(style)
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

export default function LandingPage() {
  const [userCount, setUserCount] = useState(0)
  const [cityCount, setCityCount] = useState(0)
  const isMobile = useIsMobile()
  const styles = getStyles(isMobile)

  useEffect(() => {
    // Fetch real stats
    supabase.from('app_profiles').select('id', { count: 'exact', head: true })
      .then(({ count }) => setUserCount(count || 0))
    supabase.from('app_checkins').select('city', { count: 'exact', head: true })
      .eq('is_active', true)
      .then(({ count }) => setCityCount(count || 0))
  }, [])

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: '#1A1A1A', background: '#FAFAF8', width: '100%', overflowX: 'hidden' }}>
      {/* ── Nav ── */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <span style={styles.logo}>nomadspeople</span>
          <div style={styles.navLinks}>
            {!isMobile && <a href="#features" style={styles.navLink}>Features</a>}
            {!isMobile && <a href="#community" style={styles.navLink}>Community</a>}
            <a href="#download" style={styles.navBtn}>Get the App</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.badge}>
            <Plane size={14} /> Now in 5 cities
          </div>
          <h1 style={styles.heroTitle}>
            Find your people,<br />
            <span style={{ color: '#E8614D' }}>anywhere.</span>
          </h1>
          <p style={styles.heroSub}>
            The social map for digital nomads. See who's around you,
            join spontaneous meetups, and build real connections
            on the road.
          </p>
          <div style={styles.heroCtas}>
            <a href="#download" style={styles.ctaPrimary}>
              <Download size={18} /> Download Free
            </a>
            <a href="#features" style={styles.ctaSecondary}>
              Learn More <ArrowRight size={16} />
            </a>
          </div>
          <div style={styles.heroStats}>
            <div style={styles.stat}>
              <span style={styles.statNum}>{userCount || '19'}+</span>
              <span style={styles.statLabel}>Nomads</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.stat}>
              <span style={styles.statNum}>{cityCount || '5'}+</span>
              <span style={styles.statLabel}>Active Now</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.stat}>
              <span style={styles.statNum}>5</span>
              <span style={styles.statLabel}>Cities</span>
            </div>
          </div>
        </div>

        {/* Phone mockup */}
        <div style={styles.heroPhone}>
          <div style={styles.phoneMockup}>
            <div style={styles.phoneScreen}>
              <div style={{ fontSize: isMobile ? 40 : 48, marginBottom: 12 }}>🗺️</div>
              <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Live Map</p>
              <div style={styles.fakePins}>
                <span style={styles.fakePin}>📍 Tel Aviv</span>
                <span style={styles.fakePin}>📍 Bangkok</span>
                <span style={styles.fakePin}>📍 Canggu</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={styles.features}>
        <h2 style={styles.sectionTitle}>Why Nomads Love Us</h2>
        <p style={styles.sectionSub}>Built by nomads, for nomads. Every feature solves a real problem.</p>

        <div style={styles.featureGrid}>
          {[
            { icon: <MapPin size={24} />, title: 'Live Map', desc: 'See who is around you right now. Real people, real locations, real-time.' },
            { icon: <Users size={24} />, title: 'Spontaneous Groups', desc: 'Someone nearby wants coffee? Join with one tap. No planning needed.' },
            { icon: <MessageCircle size={24} />, title: 'Instant Chat', desc: 'Join a group and start chatting immediately. Groups auto-expire, keeping things fresh.' },
            { icon: <Globe size={24} />, title: 'City Intelligence', desc: 'Know where the nomads are before you fly. Real-time city data from the community.' },
            { icon: <Zap size={24} />, title: 'Smart Matching', desc: 'We learn who you want to meet and surface the right people at the right time.' },
            { icon: <Shield size={24} />, title: 'Privacy First', desc: 'Go invisible anytime. Control who sees you, when, and where. Your data stays yours.' },
          ].map((f, i) => (
            <div key={i} style={styles.featureCard}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social Proof ── */}
      <section id="community" style={styles.social}>
        <h2 style={styles.sectionTitle}>Built for the Nomad Lifestyle</h2>
        <div style={styles.testimonials}>
          {[
            { name: 'Jake M.', city: 'Bangkok', text: "Found 3 people to cowork with within 10 minutes of landing. This is what I needed.", stars: 5 },
            { name: 'Clara D.', city: 'Tel Aviv', text: "Finally an app that understands nomads aren't tourists. The spontaneous groups are genius.", stars: 5 },
            { name: 'Liv S.', city: 'Ko Pha Ngan', text: "Met my best travel buddy here. The vibe is so different from other social apps.", stars: 5 },
          ].map((t, i) => (
            <div key={i} style={styles.testimonialCard}>
              <div style={styles.stars}>
                {Array(t.stars).fill(0).map((_, j) => <Star key={j} size={14} fill="#F59E0B" color="#F59E0B" />)}
              </div>
              <p style={styles.testimonialText}>"{t.text}"</p>
              <div style={styles.testimonialAuthor}>
                <span style={styles.authorName}>{t.name}</span>
                <span style={styles.authorCity}>{t.city}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section id="download" style={styles.downloadSection}>
        <div style={styles.downloadInner}>
          <h2 style={styles.downloadTitle}>Ready to find your people?</h2>
          <p style={styles.downloadSub}>
            Join the community of digital nomads who stopped traveling alone.
          </p>
          <div style={styles.downloadBtns}>
            <a href="#" style={styles.storeBtn}>
              <span style={{ fontSize: 24 }}>🍎</span>
              <div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>Download on the</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>App Store</div>
              </div>
            </a>
            <a href="#" style={styles.storeBtn}>
              <span style={{ fontSize: 24 }}>▶️</span>
              <div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>Get it on</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Google Play</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <span style={styles.footerLogo}>nomadspeople</span>
          <div style={styles.footerLinks}>
            <a href="/privacy" style={styles.footerLink}>Privacy</a>
            <a href="/terms" style={styles.footerLink}>Terms</a>
            <a href="/delete-account" style={styles.footerLink}>Delete Account</a>
            <a href="/support" style={styles.footerLink}>Support</a>
          </div>
          <span style={styles.footerCopy}>&copy; {new Date().getFullYear()} NomadsPeople</span>
        </div>
      </footer>
    </div>
  )
}

// ── Responsive style factory ──────────────────────────────────────────
// All styles depend on isMobile so iPhone viewports (<768px) get a clean
// single-column layout with no horizontal overflow.
function getStyles(isMobile: boolean): Record<string, React.CSSProperties> {
  return {
    // Nav
    nav: { position: 'fixed', top: 0, left: 0, right: 0, background: 'rgba(250,250,248,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', zIndex: 100, borderBottom: '1px solid #eee' },
    navInner: { maxWidth: 1100, margin: '0 auto', padding: isMobile ? '12px 18px' : '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    logo: { fontSize: isMobile ? 18 : 20, fontWeight: 800, letterSpacing: -0.5, color: '#1A1A1A' },
    navLinks: { display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24 },
    navLink: { color: '#666', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
    navBtn: { background: '#1A1A1A', color: '#fff', padding: isMobile ? '8px 16px' : '8px 20px', borderRadius: 24, fontSize: isMobile ? 13 : 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' },

    // Hero
    hero: {
      maxWidth: 1100,
      margin: '0 auto',
      padding: isMobile ? '96px 20px 56px' : '140px 24px 80px',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: 'center',
      gap: isMobile ? 40 : 60,
      width: '100%',
    },
    heroContent: { flex: 1, width: '100%', minWidth: 0, textAlign: isMobile ? 'center' : 'left' },
    badge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFF0EE', color: '#E8614D', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 24 },
    heroTitle: {
      fontSize: isMobile ? 38 : 56,
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: isMobile ? -0.5 : -1.5,
      marginBottom: 20,
      marginTop: 0,
    },
    heroSub: {
      fontSize: isMobile ? 16 : 18,
      color: '#666',
      lineHeight: 1.6,
      maxWidth: 480,
      marginBottom: 32,
      marginLeft: isMobile ? 'auto' : 0,
      marginRight: isMobile ? 'auto' : 0,
    },
    heroCtas: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 16,
      marginBottom: 40,
      alignItems: isMobile ? 'stretch' : 'center',
      width: isMobile ? '100%' : 'auto',
    },
    ctaPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: '#E8614D',
      color: '#fff',
      padding: '14px 28px',
      borderRadius: 28,
      fontSize: 16,
      fontWeight: 700,
      textDecoration: 'none',
    },
    ctaSecondary: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: '#1A1A1A',
      padding: '14px 20px',
      fontSize: 16,
      fontWeight: 600,
      textDecoration: 'none',
    },
    heroStats: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? 20 : 32,
      justifyContent: isMobile ? 'center' : 'flex-start',
      flexWrap: 'wrap',
    },
    stat: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    statNum: { fontSize: isMobile ? 24 : 28, fontWeight: 800, color: '#1A1A1A' },
    statLabel: { fontSize: 13, color: '#999', fontWeight: 500, marginTop: 2 },
    statDivider: { width: 1, height: 40, background: '#ddd' },

    // Phone mockup
    heroPhone: { flex: isMobile ? '0 0 auto' : '0 0 320px', display: 'flex', justifyContent: 'center' },
    phoneMockup: {
      width: isMobile ? 220 : 280,
      height: isMobile ? 420 : 500,
      background: '#fff',
      borderRadius: 36,
      border: '8px solid #1A1A1A',
      overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    },
    phoneScreen: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #f8f8f6 0%, #fff 100%)' },
    fakePins: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 },
    fakePin: { background: '#FFF0EE', color: '#E8614D', padding: '6px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600 },

    // Features
    features: { maxWidth: 1100, margin: '0 auto', padding: isMobile ? '56px 20px' : '80px 24px', width: '100%' },
    sectionTitle: { fontSize: isMobile ? 28 : 36, fontWeight: 800, textAlign: 'center', marginBottom: 12, marginTop: 0, letterSpacing: -0.5 },
    sectionSub: { fontSize: isMobile ? 15 : 16, color: '#888', textAlign: 'center', marginBottom: isMobile ? 32 : 48, marginTop: 0 },
    featureGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: isMobile ? 16 : 24,
    },
    featureCard: { background: '#fff', borderRadius: 16, padding: isMobile ? 22 : 28, border: '1px solid #eee' },
    featureIcon: { width: 48, height: 48, borderRadius: 12, background: '#FFF0EE', color: '#E8614D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    featureTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8, marginTop: 0 },
    featureDesc: { fontSize: 14, color: '#666', lineHeight: 1.6, margin: 0 },

    // Social proof
    social: { maxWidth: 1100, margin: '0 auto', padding: isMobile ? '56px 20px' : '80px 24px', width: '100%' },
    testimonials: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
      gap: isMobile ? 16 : 24,
    },
    testimonialCard: { background: '#fff', borderRadius: 16, padding: isMobile ? 22 : 28, border: '1px solid #eee' },
    stars: { display: 'flex', gap: 2, marginBottom: 12 },
    testimonialText: { fontSize: 15, color: '#444', lineHeight: 1.6, marginBottom: 16, fontStyle: 'italic' },
    testimonialAuthor: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    authorName: { fontSize: 14, fontWeight: 700 },
    authorCity: { fontSize: 13, color: '#999' },

    // Download
    downloadSection: { padding: isMobile ? '56px 20px' : '80px 24px', background: '#1A1A1A' },
    downloadInner: { maxWidth: 600, margin: '0 auto', textAlign: 'center' },
    downloadTitle: { fontSize: isMobile ? 28 : 36, fontWeight: 800, color: '#fff', marginBottom: 12, marginTop: 0, letterSpacing: -0.5 },
    downloadSub: { fontSize: isMobile ? 15 : 16, color: '#aaa', marginBottom: 32, marginTop: 0 },
    downloadBtns: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    storeBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#333',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: 12,
      textDecoration: 'none',
      border: '1px solid #555',
      width: isMobile ? '100%' : 'auto',
      maxWidth: 260,
      justifyContent: 'center',
    },

    // Footer
    footer: { padding: isMobile ? '28px 20px' : '32px 24px', borderTop: '1px solid #eee' },
    footerInner: {
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: isMobile ? 14 : 0,
      textAlign: 'center',
    },
    footerLogo: { fontSize: 16, fontWeight: 800, letterSpacing: -0.5, color: '#999' },
    footerLinks: { display: 'flex', gap: isMobile ? 14 : 20, flexWrap: 'wrap', justifyContent: 'center' },
    footerLink: { color: '#999', textDecoration: 'none', fontSize: 13 },
    footerCopy: { fontSize: 13, color: '#ccc' },
  }
}
