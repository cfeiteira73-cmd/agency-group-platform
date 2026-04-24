import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Agency Group · Luxury Real Estate Portugal · AMI 22506",
  description: "Buy luxury property in Portugal. Lisbon €6,200/m², Cascais €4,713/m², Comporta €8,500/m². NHR/IFICI tax regime. Free AVM. AMI 22506.",
  robots: "index, follow, max-image-preview:large",
  alternates: {
    canonical: "https://www.agencygroup.pt/en",
    languages: {
      'pt': 'https://www.agencygroup.pt/',
      'en': 'https://www.agencygroup.pt/en',
      'fr': 'https://www.agencygroup.pt/fr',
      'de': 'https://www.agencygroup.pt/de',
      'zh-Hans': 'https://www.agencygroup.pt/zh',
      'ar': 'https://www.agencygroup.pt/ar',
      'x-default': 'https://www.agencygroup.pt/',
    },
  },
  openGraph: {
    title: "Agency Group · Luxury Real Estate Portugal",
    description: "Portugal's premier luxury real estate boutique. Lisbon, Cascais, Comporta, Porto, Algarve, Madeira. AMI 22506.",
    type: "website", url: "https://www.agencygroup.pt/en",
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Luxury+Real+Estate+Portugal+2026&subtitle=Lisbon+%C2%B7+Cascais+%C2%B7+Algarve+%C2%B7+Madeira+%C2%B7+Porto',
      width: 1200,
      height: 630,
      alt: 'Agency Group · Luxury Real Estate Portugal',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agency Group · Luxury Real Estate Portugal',
    description: 'Portugal\'s premier luxury real estate boutique. Lisbon, Cascais, Algarve. AMI 22506.',
    images: ['https://www.agencygroup.pt/api/og?title=Luxury+Real+Estate+Portugal+2026&subtitle=Lisbon+%C2%B7+Cascais+%C2%B7+Algarve+%C2%B7+Madeira+%C2%B7+Porto'],
  },
}

const ZONES = [
  { name: "Lisbon", pm2: "€6,200/m²", yoy: "+17.6%", tag: "Europe's most desirable capital", color: "#1c3a5e" },
  { name: "Cascais", pm2: "€4,713/m²", yoy: "+14%", tag: "Portugal's Riviera", color: "#0e2a3a" },
  { name: "Comporta", pm2: "€8,500/m²", yoy: "+28%", tag: "The last unspoiled paradise", color: "#2a1e0a" },
  { name: "Porto", pm2: "€3,643/m²", yoy: "+13%", tag: "The city that seduced the world", color: "#2a1505" },
  { name: "Algarve", pm2: "€3,941/m²", yoy: "+12%", tag: "300 days of sunshine", color: "#1a2e0a" },
  { name: "Madeira", pm2: "€3,760/m²", yoy: "+20%", tag: "Atlantic island, tax haven", color: "#0a2a1e" },
]

const WHY_PT = [
  { icon: "💼", title: "NHR / IFICI Tax Regime", desc: "Flat 20% income tax for 10 years for new residents. Zero tax on most foreign-sourced income." },
  { icon: "🏛️", title: "No Wealth Tax", desc: "Portugal has no wealth tax, no inheritance tax between direct heirs, and favourable CGT treatment." },
  { icon: "🛡️", title: "Safe & Stable", desc: "4th safest country in the world (Global Peace Index). NATO member. Schengen access. Rule of law." },
  { icon: "🌞", title: "Best Climate in Europe", desc: "300+ days of sun per year. Atlantic breeze. No extreme temperatures. Year-round outdoor living." },
  { icon: "✈️", title: "Hub for the World", desc: "Lisbon: 3h to London, 1.5h to Madrid, 6.5h to New York. Direct flights to 150+ destinations." },
  { icon: "📈", title: "+17.6% Growth 2026", desc: "169,812 transactions. Luxury Lisbon ranks top 5 worldwide (Savills 2026). Sustained demand." },
]

const STEPS = [
  { n: "01", title: "Get NIF Number", desc: "Obtain a Portuguese tax identification number at a Finanças office or through a lawyer. Takes 1 business day." },
  { n: "02", title: "Open Bank Account", desc: "Open a Portuguese bank account (Millennium BCP, Santander, BPI). Required for transaction. Takes ~1 week." },
  { n: "03", title: "Search & Offer", desc: "Agency Group presents curated properties matching your criteria. We negotiate directly on your behalf." },
  { n: "04", title: "Sign CPCV", desc: "Promissory purchase contract with 10–30% deposit. Legal protection for both parties. Notarised." },
  { n: "05", title: "Final Deed (Escritura)", desc: "Public deed at a Portuguese Notary. Full transfer of ownership. Keys in hand. Total process: 2–3 months." },
]

const TESTIMONIALS = [
  { author: "James & Sarah Mitchell", country: "United Kingdom 🇬🇧", text: "Carlos found our dream villa in Cascais in under 3 weeks. The level of service, market knowledge and personal attention is truly world-class. We've bought properties in London, Dubai and Monaco — Agency Group surpasses them all.", property: "Villa Quinta da Marinha · €3.8M" },
  { author: "Mohammed Al-Rashidi", country: "Dubai, UAE 🇦🇪", text: "The Comporta herdade acquisition was seamlessly executed. Carlos anticipated every regulatory challenge, negotiated masterfully, and delivered 15% below asking price. ROI already exceeding projections.", property: "Herdade Comporta · €6.5M" },
  { author: "Chen Wei", country: "Hong Kong 🇨🇳", text: "As overseas buyers navigating Portuguese law for the first time, we needed someone we could trust completely. Agency Group delivered end-to-end excellence — from NIF to final deed. Exceptional.", property: "Penthouse Príncipe Real · €2.85M" },
]

export default function EnPage() {
  const waMsg = "Hello, I'm interested in buying luxury property in Portugal. Can you help me?"

  return (
    <div style={{ background: '#060d08', minHeight: '100vh', color: '#f4f0e6', fontFamily: "'Jost', sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(6,13,8,.97)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(201,169,110,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', height: '72px' }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
          <Link href="/imoveis" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Properties</Link>
          <Link href="/reports" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Reports</Link>
          <Link href="/agente/carlos" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Agent</Link>
          <Link href="/" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>🇵🇹 PT</Link>
        </div>
        <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
          style={{ background: '#c9a96e', color: '#0c1f15', padding: '10px 28px', fontFamily: "'Jost', sans-serif", fontSize: '.6rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Contact →
        </a>
      </nav>

      {/* HERO */}
      <div style={{ paddingTop: '72px', background: 'linear-gradient(160deg, #0a1f12 0%, #060d08 60%, #0c1a10 100%)', minHeight: '70vh', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(201,169,110,.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 60px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.34em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: '20px' }}>
            Portfolio · 20 Properties · Portugal 2026
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(3rem, 6vw, 5.5rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.05, maxWidth: '800px' }}>
            Portugal&apos;s Premier<br /><em style={{ fontStyle: 'italic', color: '#c9a96e' }}>Luxury Real Estate</em>
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '1rem', color: 'rgba(244,240,230,.5)', maxWidth: '540px', lineHeight: 1.75, margin: '0 0 40px' }}>
            From Lisbon&apos;s historic palaces to Comporta&apos;s dune villas — we represent the finest properties in Portugal for international buyers. AMI 22506.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/imoveis" style={{ background: '#c9a96e', color: '#0c1f15', padding: '16px 40px', fontFamily: "'Jost', sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
              View Properties →
            </Link>
            <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
              style={{ background: 'transparent', color: '#c9a96e', padding: '16px 32px', border: '1px solid rgba(201,169,110,.4)', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Talk to an Expert
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '0', marginTop: '60px', borderTop: '1px solid rgba(201,169,110,.1)', paddingTop: '32px' }}>
            {[['€500M+','Portfolio Value'],['127','Transactions'],['4.9★','Client Rating'],['30+','Nationalities']].map(([val, label], i) => (
              <div key={label} style={{ paddingRight: '40px', marginRight: '40px', borderRight: i < 3 ? '1px solid rgba(201,169,110,.08)' : 'none' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '2.2rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>{val}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MARKET DATA */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '96px 60px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
          Market Intelligence · 2026
        </div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15 }}>
          Portugal&apos;s Key Markets
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {ZONES.map(z => (
            <div key={z.name} style={{ background: `linear-gradient(135deg, ${z.color}, #060d08)`, border: '1px solid rgba(201,169,110,.1)', padding: '28px' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.3rem', color: '#f4f0e6', marginBottom: '6px' }}>{z.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.55)', marginBottom: '16px', textTransform: 'uppercase' }}>{z.tag}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', color: '#c9a96e', fontWeight: 300 }}>{z.pm2}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: '#4a9c7a', background: 'rgba(28,74,53,.3)', padding: '3px 8px', border: '1px solid rgba(28,74,53,.5)' }}>{z.yoy}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WHY PORTUGAL */}
      <div style={{ background: 'rgba(201,169,110,.03)', borderTop: '1px solid rgba(201,169,110,.08)', borderBottom: '1px solid rgba(201,169,110,.08)', padding: '96px 60px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px', textAlign: 'center' }}>
            Why Portugal
          </div>
          <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15, textAlign: 'center' }}>
            6 reasons every investor chooses Portugal
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {WHY_PT.map(w => (
              <div key={w.title} style={{ background: 'rgba(6,13,8,.6)', border: '1px solid rgba(201,169,110,.1)', padding: '28px' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '14px' }}>{w.icon}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.15rem', fontWeight: 300, color: '#f4f0e6', marginBottom: '10px' }}>{w.title}</div>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.65, margin: 0 }}>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BUYER JOURNEY */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '96px 60px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
          How to Buy
        </div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15 }}>
          5 steps to owning property in Portugal
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0' }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ borderLeft: i === 0 ? '1px solid rgba(201,169,110,.15)' : 'none', borderRight: '1px solid rgba(201,169,110,.15)', borderTop: '1px solid rgba(201,169,110,.15)', borderBottom: '1px solid rgba(201,169,110,.15)', padding: '28px 20px' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '2.5rem', color: 'rgba(201,169,110,.2)', fontWeight: 300, marginBottom: '12px' }}>{s.n}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', fontWeight: 300, color: '#f4f0e6', marginBottom: '10px', lineHeight: 1.3 }}>{s.title}</div>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.45)', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Buying costs */}
        <div style={{ marginTop: '48px', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)', padding: '32px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.2em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '20px' }}>Estimated Transaction Costs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            {[['IMT (Transfer Tax)', '0–7.5%'],['Stamp Duty', '0.8%'],['Legal Fees', '~€1,500–3,000'],['Agency Commission', '5% (paid by seller)']].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TESTIMONIALS */}
      <div style={{ background: 'rgba(201,169,110,.03)', borderTop: '1px solid rgba(201,169,110,.08)', padding: '96px 60px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px', textAlign: 'center' }}>Client Testimonials</div>
          <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15, textAlign: 'center' }}>What our clients say</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: 'linear-gradient(135deg, rgba(201,169,110,.06) 0%, rgba(12,31,21,.3) 100%)', border: '1px solid rgba(201,169,110,.12)', padding: '32px' }}>
                <div style={{ color: '#c9a96e', fontSize: '1rem', marginBottom: '16px' }}>★★★★★</div>
                <p style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', lineHeight: 1.75, color: 'rgba(244,240,230,.75)', fontWeight: 300, fontStyle: 'italic', margin: '0 0 20px' }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.45)', marginBottom: '14px', background: 'rgba(201,169,110,.05)', padding: '6px 10px', textTransform: 'uppercase' }}>🏠 {t.property}</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: '#f4f0e6', fontWeight: 600 }}>{t.author}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.35)' }}>{t.country}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '96px 60px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Start Your Journey</div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: '#f4f0e6', margin: '0 0 16px' }}>Ready to invest in Portugal?</h2>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.9rem', color: 'rgba(244,240,230,.45)', maxWidth: '500px', margin: '0 auto 40px', lineHeight: 1.7 }}>
          Private consultation. Response in under 2 hours. No commitment required.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
            style={{ background: '#25D366', color: '#fff', padding: '18px 48px', fontFamily: "'Jost', sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
            WhatsApp Us Now →
          </a>
          <a href="mailto:geral@agencygroup.pt?subject=Luxury Property Enquiry Portugal"
            style={{ background: 'transparent', color: '#c9a96e', padding: '18px 40px', border: '1px solid rgba(201,169,110,.4)', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Send Email
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(201,169,110,.1)', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.1rem', color: '#c9a96e' }}>Agency<span style={{ color: '#f4f0e6' }}>Group</span></div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', textTransform: 'uppercase' }}>AMI 22506 · Lisboa, Portugal · Licensed Real Estate Agent</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textDecoration: 'none', textTransform: 'uppercase' }}>🇵🇹 PT</Link>
          <Link href="/fr" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textDecoration: 'none', textTransform: 'uppercase' }}>🇫🇷 FR</Link>
        </div>
      </div>
    </div>
  )
}
