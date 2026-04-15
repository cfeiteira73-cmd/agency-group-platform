import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Off-Market Properties Portugal — Private Access | Agency Group AMI 22506',
  description: 'Exclusive off-market properties in Portugal that never reach public portals. Lisbon, Cascais, Algarve, Comporta, Porto. Invite-only pre-market access for qualified buyers. AMI 22506.',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1',
  alternates: {
    canonical: 'https://www.agencygroup.pt/off-market-portugal',
    languages: {
      'x-default': 'https://www.agencygroup.pt/off-market-portugal',
      'en': 'https://www.agencygroup.pt/off-market-portugal',
      'pt-PT': 'https://www.agencygroup.pt/off-market-portugal',
    },
  },
  openGraph: {
    title: 'Off-Market Properties Portugal — Private Access | Agency Group',
    description: 'Properties that never appear on public portals. Pre-market exclusives, portfolio disposals, private vendor mandates. For qualified buyers and investors.',
    type: 'website',
    url: 'https://www.agencygroup.pt/off-market-portugal',
    siteName: 'Agency Group',
    locale: 'en_US',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Off-Market+Properties+Portugal&subtitle=Private+Access+%C2%B7+Agency+Group',
      width: 1200,
      height: 630,
      alt: 'Off-Market Properties Portugal — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Off-Market Properties Portugal — Private Access',
    description: 'Properties never reaching public portals. Pre-market exclusives for qualified buyers.',
    site: '@agencygroup_pt',
  },
}

const PAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Off-Market Properties Portugal — Private Access',
  description: 'Exclusive off-market properties in Portugal that never reach public portals.',
  url: 'https://www.agencygroup.pt/off-market-portugal',
  provider: {
    '@type': 'RealEstateAgent',
    name: 'Agency Group – Mediação Imobiliária Lda',
    url: 'https://www.agencygroup.pt',
    identifier: { '@type': 'PropertyValue', name: 'AMI', value: '22506' },
  },
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What does off-market mean in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Off-market properties in Portugal are properties for sale that are never publicly listed on real estate portals like Idealista, Casa Sapo, or Imovirtual. Sellers choose this approach for privacy, to avoid disrupting tenants, or to target a selective pool of pre-qualified buyers. Access requires a direct relationship with the agent holding the mandate.' } },
    { '@type': 'Question', name: 'What percentage of luxury sales in Portugal are off-market?', acceptedAnswer: { '@type': 'Answer', text: 'In the €2M+ segment, an estimated 30–45% of transactions in Lisbon, Cascais, and the Algarve occur off-market. In ultra-prime locations (Príncipe Real palacetes, Quinta do Lago super-villas), the off-market proportion exceeds 60%. Sellers at this level prioritise discretion over maximum market exposure.' } },
    { '@type': 'Question', name: 'How do I access off-market properties in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'You need a relationship with a specialist boutique agency that holds exclusive mandates. Agency Group (AMI 22506) maintains a curated pipeline of off-market properties through direct vendor relationships, network referrals, and developer pre-market allocations. Register your profile and criteria to receive notifications before properties go live.' } },
    { '@type': 'Question', name: 'What types of off-market properties are available in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Off-market stock in Portugal includes: prime Lisbon palacetes and penthouse apartments, Cascais and Estoril seafront villas, Comporta dune estates, Algarve golf and seafront properties, Porto historic buildings for refurbishment, Madeira luxury residences, and Alentejo farms and quintas. Price range: €500K–€50M.' } },
  ],
}

const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.agencygroup.pt' },
    { '@type': 'ListItem', position: 2, name: 'Off-Market Properties Portugal', item: 'https://www.agencygroup.pt/off-market-portugal' },
  ],
}

export default function OffMarketPortugalPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PAGE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .hero{padding:140px 0 90px;background:#080f0a;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 100% at 0% 100%,rgba(28,74,53,.4),transparent),radial-gradient(ellipse 40% 60% at 100% 0%,rgba(201,169,110,.06),transparent)}
        .hero-inner{max-width:900px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.4);margin-bottom:20px}
        .breadcrumb a{color:rgba(201,169,110,.4);text-decoration:none}
        .cat{display:inline-block;background:rgba(201,169,110,.12);border:1px solid rgba(201,169,110,.3);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.22em;text-transform:uppercase;padding:5px 14px;margin-bottom:20px}
        .h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,5vw,3.6rem);font-weight:300;color:#f4f0e6;line-height:1.08;margin-bottom:20px}
        .h1 em{color:#c9a96e;font-style:italic}
        .hero-sub{font-size:.9rem;color:rgba(244,240,230,.45);line-height:1.8;max-width:580px;margin-bottom:36px}
        .hero-badge{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.16em;color:rgba(201,169,110,.5);text-transform:uppercase;margin-bottom:28px;border:1px solid rgba(201,169,110,.15);padding:6px 14px}
        .hero-badge::before{content:'';width:6px;height:6px;background:#c9a96e;border-radius:50%;animation:pulse 2s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .hero-cta{display:inline-flex;align-items:center;gap:12px;background:#c9a96e;color:#0c1f15;text-decoration:none;padding:15px 36px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.22em;text-transform:uppercase;font-weight:700}
        .hero-cta-secondary{display:inline-flex;align-items:center;gap:12px;background:transparent;color:rgba(244,240,230,.55);text-decoration:none;padding:15px 36px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.18em;text-transform:uppercase;border:1px solid rgba(201,169,110,.2);margin-left:12px}
        .hero-btns{display:flex;gap:0;flex-wrap:wrap;margin-top:0}
        .content{max-width:900px;margin:0 auto;padding:72px 56px;background:#f4f0e6}
        .lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2{font-family:var(--font-cormorant),serif;font-size:clamp(1.4rem,3vw,2rem);font-weight:300;color:#0c1f15;margin:52px 0 20px;line-height:1.2}
        h2 em{color:#1c4a35;font-style:italic}
        h3{font-family:var(--font-jost),sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.08em;color:#1c4a35;text-transform:uppercase;margin:32px 0 12px}
        p{font-size:.88rem;line-height:1.9;color:rgba(14,14,13,.75);margin-bottom:20px}
        ul,ol{padding-left:24px;margin-bottom:20px}
        li{font-size:.88rem;line-height:1.9;color:rgba(14,14,13,.75);margin-bottom:6px}
        .types{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1px;background:rgba(14,14,13,.08);border:1px solid rgba(14,14,13,.08);margin:24px 0}
        .type-card{background:#fff;padding:28px 24px}
        .type-name{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#0c1f15;margin-bottom:6px}
        .type-range{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;color:#1c4a35;margin-bottom:8px}
        .type-note{font-size:.78rem;color:rgba(14,14,13,.5);line-height:1.6}
        .process{counter-reset:proc;margin:0;padding:0;list-style:none;border-top:1px solid rgba(14,14,13,.1)}
        .proc-item{counter-increment:proc;padding:28px 0 28px 72px;border-bottom:1px solid rgba(14,14,13,.07);position:relative}
        .proc-item::before{content:counter(proc);position:absolute;left:0;top:28px;font-family:var(--font-dm-mono),monospace;font-size:1.8rem;color:rgba(201,169,110,.2);font-weight:300;line-height:1}
        .proc-title{font-family:var(--font-jost),sans-serif;font-size:.82rem;font-weight:600;color:#0c1f15;margin-bottom:6px;letter-spacing:.02em}
        .box{background:#0c1f15;border:1px solid rgba(201,169,110,.25);padding:36px;margin:40px 0}
        .box-label{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.2em;color:rgba(201,169,110,.45);text-transform:uppercase;margin-bottom:10px}
        .box-h{font-family:var(--font-cormorant),serif;font-size:1.5rem;font-weight:300;color:#f4f0e6;margin-bottom:16px;line-height:1.2}
        .box-h em{color:#c9a96e;font-style:italic}
        .box p{color:rgba(244,240,230,.55);font-size:.84rem;line-height:1.8}
        .faq{margin:8px 0}
        .faq-q{font-family:var(--font-jost),sans-serif;font-size:.88rem;font-weight:500;color:#0c1f15;margin:0 0 8px}
        .faq-a{font-size:.84rem;line-height:1.8;color:rgba(14,14,13,.68);margin:0 0 28px;padding-bottom:28px;border-bottom:1px solid rgba(14,14,13,.07)}
        .trust-row{display:flex;gap:24px;flex-wrap:wrap;margin:32px 0}
        .trust-item{display:flex;align-items:center;gap:10px;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.12em;color:rgba(14,14,13,.5);text-transform:uppercase}
        .trust-check{width:18px;height:18px;background:#1c4a35;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#c9a96e;font-size:.5rem;flex-shrink:0}
        .cta-section{background:#080f0a;padding:100px 56px;text-align:center;position:relative;overflow:hidden}
        .cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 50% 100%,rgba(28,74,53,.3),transparent)}
        .cta-label{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.22em;color:rgba(201,169,110,.4);text-transform:uppercase;margin-bottom:20px;position:relative}
        .cta-h{font-family:var(--font-cormorant),serif;font-size:clamp(1.8rem,5vw,3rem);font-weight:300;color:#f4f0e6;margin-bottom:20px;position:relative;line-height:1.1}
        .cta-h em{color:#c9a96e;font-style:italic}
        .cta-sub{font-size:.82rem;color:rgba(244,240,230,.4);max-width:480px;margin:0 auto 40px;line-height:1.8;position:relative}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative}
        .btn-gold{background:#c9a96e;color:#0c1f15;text-decoration:none;padding:15px 36px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.22em;text-transform:uppercase;font-weight:700}
        .btn-outline{background:transparent;color:rgba(244,240,230,.6);text-decoration:none;padding:15px 36px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.18em;text-transform:uppercase;border:1px solid rgba(201,169,110,.25)}
        footer{background:#040806;padding:40px 56px;text-align:center}
        footer p{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;color:rgba(244,240,230,.18);line-height:2}
        footer a{color:rgba(201,169,110,.4);text-decoration:none}
        @media(max-width:768px){nav{padding:16px 24px}.hero-inner,.content,.cta-section{padding-left:24px;padding-right:24px}.hero{padding:110px 0 64px}.hero-cta-secondary{margin-left:0;margin-top:8px}footer{padding:32px 24px}}
      `}</style>

      <nav>
        <Link href="/" className="logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <Link href="/contacto" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.5rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(14,14,13,.5)', textDecoration: 'none' }}>
          Request Access →
        </Link>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="breadcrumb">
            <Link href="/">Home</Link> / Off-Market Properties Portugal
          </div>
          <div className="cat">● Live Pipeline · Private Access</div>
          <div className="hero-badge">Active off-market mandates across Portugal</div>
          <h1 className="h1">Off-Market Properties<br /><em>Portugal 2026</em></h1>
          <p className="hero-sub">
            The properties that never reach Idealista, Casa Sapo, or Rightmove.
            Pre-market exclusives, private vendor mandates, and portfolio disposals —
            available only to qualified buyers through Agency Group's private network.
          </p>
          <div className="hero-btns">
            <Link href="/contacto" className="hero-cta">Request Private Access →</Link>
            <Link href="/off-market" className="hero-cta-secondary">PT Version</Link>
          </div>
        </div>
      </section>

      <article className="content">
        <p className="lead">
          In Portugal's prime segment (€2M+), up to 45% of transactions happen off-market. Sellers choose discretion for professional privacy, to avoid tenant disruption, or to reach a curated selection of genuinely qualified buyers rather than browsing tourists. As a specialist boutique agency with exclusive mandates across Portugal, Agency Group is one of the few access points to this invisible inventory.
        </p>

        <div className="trust-row">
          {['AMI Licensed 22506', '€500K–€50M segment', 'Direct vendor mandates', 'Pre-screened buyers only', 'Confidential process', '5% commission — seller pays'].map(t => (
            <div key={t} className="trust-item">
              <div className="trust-check">✓</div>
              {t}
            </div>
          ))}
        </div>

        <h2>What Is Off-Market Real Estate<em> in Portugal</em>?</h2>
        <p>
          An off-market property in Portugal is one being sold without public advertising. The vendor has signed a mandate with Agency Group but has chosen not to appear on any property portal, in any window display, or in any public communication. Access is by direct agent introduction only — typically after the buyer has been pre-qualified and signed a confidentiality agreement.
        </p>
        <p>
          This is not the same as "coming soon" listings. Genuine off-market properties may never appear publicly — they are sold directly to a buyer in our network, or they are withdrawn if no qualifying match is found in the agreed timeline.
        </p>

        <h2>Types of <em>Off-Market Opportunities</em></h2>
        <div className="types">
          {[
            { name: 'Prime Lisbon Residences', range: '€800K–€15M', note: 'Palacetes, penthouses, and renovated apartments in Príncipe Real, Chiado, Lapa, and Santos. Owner discretion paramount.' },
            { name: 'Cascais & Estoril Villas', range: '€1.5M–€20M', note: 'Atlantic-facing estates and waterfront properties. High-profile vendor profiles. Zero public exposure.' },
            { name: 'Comporta Estate Land', range: '€500K–€10M', note: 'Dune and lagoon plots. Strict building regulations make existing permits highly valuable.' },
            { name: 'Algarve Super-Villas', range: '€2M–€30M', note: 'Quinta do Lago, Vale do Lobo, Vilamoura. Golf-front and seafront. Portfolio owner disposals.' },
            { name: 'Development Opportunities', range: '€1M–€50M', note: 'Buildings for refurbishment, land with planning, licensed residential projects. Developer mandates.' },
            { name: 'Porto & Madeira', range: '€500K–€5M', note: 'Foz do Douro seafront, historic centre buildings. Madeira luxury residences with tax advantages.' },
          ].map(t => (
            <div key={t.name} className="type-card">
              <div className="type-name">{t.name}</div>
              <div className="type-range">{t.range}</div>
              <div className="type-note">{t.note}</div>
            </div>
          ))}
        </div>

        <h2>The Private Access <em>Process</em></h2>
        <ol className="process">
          <li className="proc-item">
            <div className="proc-title">Submit Your Buyer Profile</div>
            <p style={{ margin: 0 }}>Complete our confidential buyer registration — your budget, preferred locations, property type, intended use, and timeline. This takes 5 minutes online or we can walk you through it on a call.</p>
          </li>
          <li className="proc-item">
            <div className="proc-title">Pre-Qualification</div>
            <p style={{ margin: 0 }}>Our team reviews your profile and, where appropriate, requests proof of funds or mortgage pre-approval. This step protects vendor confidentiality and ensures introductions are only made to serious buyers.</p>
          </li>
          <li className="proc-item">
            <div className="proc-title">Confidential Introductions</div>
            <p style={{ margin: 0 }}>When a property matching your criteria becomes available, you receive a private briefing — address, full photos, financial model, and any vendor constraints. A viewing can typically be arranged within 24–72 hours.</p>
          </li>
          <li className="proc-item">
            <div className="proc-title">Exclusive Due Diligence Window</div>
            <p style={{ margin: 0 }}>Qualified buyers receive a 72-hour exclusive window to conduct initial due diligence and submit an offer before the property is shown to the next buyer on the list.</p>
          </li>
          <li className="proc-item">
            <div className="proc-title">Negotiation & Completion</div>
            <p style={{ margin: 0 }}>Agency Group manages negotiation, legal coordination with your lawyer, IMT payment, and notary appointment. You close on your terms, without competing bidders or public scrutiny.</p>
          </li>
        </ol>

        <div className="box">
          <div className="box-label">Why Off-Market Matters</div>
          <div className="box-h">The Best Properties Never <em>Reach the Portal</em></div>
          <p>
            In Lisbon's Príncipe Real and the Algarve Golden Triangle, the finest properties trade
            quietly between agents and their known networks. By the time something exceptional appears on
            Idealista, it has already passed through three or four off-market conversations.
          </p>
          <p>
            Working with Agency Group as your buyer's representative gives you first access to mandates
            that never enter the public domain — and the ability to act quickly when the right property appears.
          </p>
        </div>

        <h2>Frequently Asked <em>Questions</em></h2>
        <div className="faq">
          {FAQ_SCHEMA.mainEntity.map((faq, i) => (
            <div key={i}>
              <div className="faq-q">{faq.name}</div>
              <div className="faq-a">{faq.acceptedAnswer.text}</div>
            </div>
          ))}
        </div>
      </article>

      <section className="cta-section">
        <div className="cta-label">Private Access · Qualified Buyers Only</div>
        <h2 className="cta-h">Access the <em>Invisible Inventory</em></h2>
        <p className="cta-sub">Register your buyer profile today. No obligation. No public record. The first step to properties that don't exist for everyone else.</p>
        <div className="cta-btns">
          <Link href="/contacto" className="btn-gold">Register Buyer Profile →</Link>
          <Link href="/imoveis" className="btn-outline">Browse Public Listings</Link>
        </div>
      </section>

      <section style={{ background: '#f4f0e6', padding: '60px 56px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.46rem', letterSpacing: '.2em', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', marginBottom: '24px' }}>Related</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '16px' }}>
          {[
            { href: '/buy-property-portugal', label: 'Buy Property in Portugal Guide →' },
            { href: '/invest-in-portugal-real-estate', label: 'Investment Returns Guide →' },
            { href: '/off-market', label: 'Off-Market Access (PT) →' },
            { href: '/imoveis', label: 'Public Property Listings →' },
            { href: '/blog/luxury-property-lisbon', label: 'Luxury Property Lisbon →' },
            { href: '/contacto', label: 'Contact Our Team →' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily: 'var(--font-jost)', fontSize: '.78rem', color: '#1c4a35', textDecoration: 'none', borderBottom: '1px solid rgba(28,74,53,.15)', paddingBottom: '12px' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      <footer>
        <p>
          <Link href="/">Agency Group</Link> · AMI 22506 · +351 919 948 986 · <Link href="mailto:geral@agencygroup.pt">geral@agencygroup.pt</Link>
          <br />
          © 2026 Agency Group – Mediação Imobiliária Lda · All off-market mandates are confidential. Property details shared only with pre-qualified buyers.
        </p>
      </footer>
    </>
  )
}
