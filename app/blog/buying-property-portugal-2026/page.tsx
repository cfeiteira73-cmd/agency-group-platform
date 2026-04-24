import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Buying Property in Portugal 2026: Guide for Foreign Buyers',
  description: 'Complete guide to buying property in Portugal in 2026. NIF, CPCV, IMT, stamp duty, IFICI regime. Real costs, step-by-step process for foreign buyers. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/buying-property-portugal-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/buying-property-portugal-2026',
    },
  },
  openGraph: {
    title: 'Buying Property in Portugal in 2026: Complete Guide for Foreign Buyers',
    description: 'NIF, CPCV, IMT, stamp duty, deed — the complete process end to end. Real costs. Key locations. What changed in 2026.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/buying-property-portugal-2026',
    locale: 'en_US',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Buying%20Property%20in%20Portugal%20in%202026%3A%20Complete%20Guide%20for%20Fore&subtitle=NIF%2C%20CPCV%2C%20IMT%2C%20stamp%20duty%2C%20deed%20%E2%80%94%20the%20complete%20process',
      width: 1200,
      height: 630,
      alt: 'Buying Property in Portugal in 2026: Complete Guide for Foreign Buyers',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buying Property in Portugal in 2026: Complete Guide for Foreign Buyers',
    description: 'NIF, CPCV, IMT, stamp duty, deed — the complete process end to end. Real costs. Key locations. What ',
    images: ['https://www.agencygroup.pt/api/og?title=Buying%20Property%20in%20Portugal%20in%202026%3A%20Complete%20Guide%20for%20Fore&subtitle=NIF%2C%20CPCV%2C%20IMT%2C%20stamp%20duty%2C%20deed%20%E2%80%94%20the%20complete%20process'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Buying Property in Portugal in 2026: Complete Guide for Foreign Buyers',
  description: 'Complete guide to buying property in Portugal in 2026. NIF, CPCV, IMT, stamp duty, IFICI.',
  image: {
    '@type': 'ImageObject',
    url: 'https://www.agencygroup.pt/og-image.jpg',
    width: 1200,
    height: 630,
  },
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: {
    '@type': 'Organization',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
    '@id': 'https://www.agencygroup.pt',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.agencygroup.pt/logo.png',
      width: 200,
      height: 60,
    },
  },
  datePublished: '2026-04-02',
  dateModified: '2026-04-02',
  url: 'https://www.agencygroup.pt/blog/buying-property-portugal-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Buying property in Portugal' },
    { '@type': 'Thing', name: 'Portugal real estate 2026' },
    { '@type': 'Thing', name: 'Foreign buyers Portugal' },
  ],
}

export default function ArticleBuyingPropertyPortugal() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .art-hero{padding:140px 0 80px;background:#0c1f15;position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 10% 85%,rgba(28,74,53,.6),transparent)}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .art-breadcrumb a:hover{color:#c9a96e}
        .art-cat{display:inline-block;background:#1c4a35;color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(244,240,230,.35)}
        .art-content{max-width:860px;margin:0 auto;padding:72px 56px;background:#f4f0e6}
        .art-lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2.s{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.7rem;color:#1c4a35;margin:48px 0 20px;letter-spacing:.02em}
        h3.ss{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.9rem;letter-spacing:.08em;color:#0e0e0d;margin:32px 0 12px;text-transform:uppercase}
        p.t{font-size:.9rem;line-height:1.88;color:rgba(14,14,13,.65);margin-bottom:20px}
        .step-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin:32px 0}
        .step-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:28px}
        .step-n{font-family:var(--font-cormorant),serif;font-size:2.5rem;font-weight:300;color:rgba(28,74,53,.15);line-height:1;margin-bottom:12px}
        .step-t{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#1c4a35;margin-bottom:8px}
        .step-d{font-size:.83rem;line-height:1.75;color:rgba(14,14,13,.6)}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .cost-table tr:last-child td{border-bottom:none;font-weight:600;color:#1c4a35;background:rgba(28,74,53,.04)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .loc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:28px 0}
        .loc-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .loc-name{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#1c4a35;margin-bottom:8px}
        .loc-price{font-family:var(--font-dm-mono),monospace;font-size:.7rem;letter-spacing:.1em;color:#c9a96e;margin-bottom:6px}
        .loc-desc{font-size:.78rem;line-height:1.65;color:rgba(14,14,13,.55)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.loc-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → buying-property-portugal-2026
          </div>
          <div className="art-cat">Buyer&apos;s Guide</div>
          <h1 className="art-h1">Buying Property in Portugal in 2026:<br /><em>Complete Guide for Foreign Buyers</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>11 min read</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal recorded 169,812 property transactions in 2025 — an all-time record. Prices rose +17.6% (INE Q3 2025).
          Lisbon ranks in the global top 5 for luxury real estate (Savills 2026). Whether you are relocating, investing,
          or acquiring a second home, this guide covers the entire process: from getting your NIF number to signing the deed,
          with real costs, up-to-date tax tables, and insider tips from a licensed agent.
        </p>

        <h2 className="s">1. Why Portugal in 2026</h2>
        <p className="t">
          Portugal combines political stability, EU membership, mild climate, and genuine quality of life with property
          prices still significantly below comparable Western European markets. Despite strong price growth, Lisbon at
          €5,000/m² average remains far below Paris (€10,000+), London (€12,000+), or Monaco (€48,000+).
        </p>
        <p className="t">
          Foreign buyers represent over 25% of all transactions above €500,000. The market is mature, transparent,
          and supported by a strong legal framework. For buyers from North America, France, the UK, and the Middle East,
          Portugal offers a rare combination: affordable luxury, EU legal protection, and exceptional lifestyle.
        </p>

        <div className="callout">
          <p><strong>2026 Market Data:</strong> Median price €3,076/m² nationally · +17.6% YoY · 169,812 transactions · 210 days average time on market · Lisbon luxury in global top 5 (Savills).</p>
        </div>

        <h2 className="s">2. Key Locations and Prices</h2>
        <p className="t">Portugal offers distinct markets at different price points. Here are the primary destinations for international buyers:</p>

        <div className="loc-grid">
          {[
            { name: 'Lisbon', price: '€5,000 / m²', desc: 'Capital and most dynamic market. Chiado, Príncipe Real and Avenida da Liberdade exceed €10,000/m² for premium stock. Top 5 luxury market globally.' },
            { name: 'Cascais', price: '€4,713 / m²', desc: '30 min from Lisbon. Atlantic coast, international schools, golf, marina. Large British and American expat community. Villas €1.5M–€8M.' },
            { name: 'Algarve', price: '€3,941 / m²', desc: 'Southern coast. Golden Triangle (Vale do Lobo, Quinta do Lago, Vilamoura) commands €5,000–€12,000/m². Resort lifestyle, golf, beaches.' },
            { name: 'Porto', price: '€3,643 / m²', desc: 'Second city. Historic centre (UNESCO), Foz do Douro (riverfront), Matosinhos (beach). Strong rental yields. Growing international buyer base.' },
            { name: 'Madeira', price: '€3,760 / m²', desc: 'Atlantic island. Year-round mild climate. Funchal city and Calheta coast. IFICI tax regime applies. Growing luxury segment.' },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. The Legal Process Step by Step</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'NIF Fiscal Number', d: 'Your Portuguese tax identification number. Mandatory for any property transaction. Obtained at a Finanças office or via a lawyer (1–2 days). Non-residents need a fiscal representative.' },
            { n: '02', t: 'Portuguese Bank Account', d: 'Required to make payment via Portuguese banking system. Open at Millennium BCP, Santander, or Novobanco. Takes 1–2 weeks. Requires NIF + passport + proof of address.' },
            { n: '03', t: 'Due Diligence', d: 'Verify the property\'s land registry certificate (certidão predial), tax record (caderneta predial), habitation licence, outstanding charges, and condominium debts. Always use a lawyer.' },
            { n: '04', t: 'Offer & Negotiation', d: 'Written offer with a 48–72h deadline. The Agency Group commission (5%) is paid by the seller — you pay nothing for buyer representation.' },
            { n: '05', t: 'CPCV — Promise of Purchase', d: 'Binding preliminary contract. Deposit typically 10–30% of price. If buyer withdraws: deposit lost. If seller withdraws: deposit returned double.' },
            { n: '06', t: 'Escritura — Final Deed', d: 'Executed before a notary. IMT and Stamp Duty paid before signing. Registration at the Land Registry. Typical timeline CPCV to Deed: 45–90 days.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Taxes and Acquisition Costs</h2>
        <p className="t">For a €1,000,000 property in Lisbon (non-resident investment purchase, 2026):</p>
        <table className="cost-table">
          <thead><tr><th>Cost</th><th>Rate / Amount</th><th>Estimated Value</th></tr></thead>
          <tbody>
            <tr><td>IMT (Property Transfer Tax)</td><td>Graduated table — 7.5% for investment properties &gt;€1M</td><td>€75,000</td></tr>
            <tr><td>Stamp Duty (Imposto de Selo)</td><td>0.8% of purchase price</td><td>€8,000</td></tr>
            <tr><td>Land Registry + Notary</td><td>Fixed + variable</td><td>€1,500–2,500</td></tr>
            <tr><td>Lawyer (strongly recommended)</td><td>0.5–1% of price</td><td>€5,000–10,000</td></tr>
            <tr><td>Agency Commission (paid by seller)</td><td>5% + VAT</td><td>€0 (paid by seller)</td></tr>
            <tr><td>Total acquisition costs</td><td>~8–9% of price</td><td>€89,500–95,500</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Annual Property Tax (IMI)</h3>
        <p className="t">
          After purchase, you pay IMI (Imposto Municipal sobre Imóveis) annually. Urban properties: 0.3%–0.45% of the
          cadastral value (valor patrimonial tributário — typically 20–50% below market value). Rural properties: 0.8%.
          For high-value portfolios above €600,000, AIMI (Additional IMI) applies at 0.7%–1.5%.
        </p>

        <h2 className="s">5. Mortgage Financing for Foreign Buyers</h2>
        <p className="t">Portuguese banks do offer mortgages to non-residents, though conditions differ from residents:</p>
        <table className="cost-table">
          <thead><tr><th>Parameter</th><th>Residents</th><th>Non-Residents</th></tr></thead>
          <tbody>
            <tr><td>Maximum LTV</td><td>90%</td><td>70%</td></tr>
            <tr><td>Maximum term</td><td>40 years</td><td>30 years</td></tr>
            <tr><td>Euribor 6M (March 2026)</td><td colSpan={2}>2.95%</td></tr>
            <tr><td>Typical spread</td><td>0.9–1.5%</td><td>1.5–2.5%</td></tr>
            <tr><td>DSTI maximum (Bank of Portugal)</td><td>35%</td><td>35%</td></tr>
          </tbody>
        </table>
        <p className="t">
          Cash purchases are common in the €1M+ segment. For financed purchases, get a mortgage pre-approval letter
          before submitting an offer — it strengthens your negotiating position significantly.
        </p>

        <h2 className="s">6. IFICI — The NHR Successor Tax Regime</h2>
        <p className="t">
          The Golden Visa programme ended for residential real estate in 2023. However, the IFICI (Incentivo Fiscal à
          Investigação Científica e Inovação) regime — the successor to NHR — remains available for qualifying individuals
          who establish tax residency in Portugal.
        </p>
        <p className="t">
          Under IFICI, qualifying income (employment, self-employment in eligible activities, pensions from abroad) is
          taxed at a flat 20% rate for 10 years, versus marginal rates up to 48%. For high earners relocating to Portugal,
          this can represent €50,000–€500,000 in tax savings over the regime period.
        </p>
        <div className="callout">
          <p><strong>IFICI Eligibility:</strong> Must not have been tax resident in Portugal in the previous 5 years. Must establish primary residence. Application must be submitted in the year of residency establishment or the following year. <strong>Consult a Portuguese tax adviser before relocating.</strong></p>
        </div>

        <h2 className="s">7. Typical Transaction Timeline</h2>
        <p className="t">From the moment you identify a property to collecting the keys, expect the following timeline:</p>
        <table className="cost-table">
          <thead><tr><th>Stage</th><th>Typical Duration</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>NIF + bank account</td><td>1–2 weeks</td><td>Can be done before you find a property</td></tr>
            <tr><td>Property search</td><td>1–8 weeks</td><td>Depends on budget and zone</td></tr>
            <tr><td>Due diligence + negotiation</td><td>1–2 weeks</td><td>Lawyer review essential</td></tr>
            <tr><td>CPCV signing</td><td>1 week after acceptance</td><td>Deposit paid at signing</td></tr>
            <tr><td>CPCV to Deed</td><td>45–90 days</td><td>Longer if mortgage involved (60–90 days)</td></tr>
            <tr><td>Total process</td><td>60–120 days</td><td>Cash buyers can close faster</td></tr>
          </tbody>
        </table>

        <h2 className="s">8. Agency Commission — Who Pays?</h2>
        <p className="t">
          In Portugal, real estate agency commissions are paid exclusively by the seller, not the buyer. The standard
          commission is 5% + 23% VAT of the sale price. As a buyer, you benefit from full agency representation
          at zero cost to you.
        </p>
        <p className="t">
          Agency Group (AMI 22506) represents buyers and sellers in the €100K–€100M segment across Portugal, Spain,
          Madeira, and the Azores. Our mandate includes access to off-market inventory — 30–40% of the best opportunities
          never reach public portals.
        </p>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f4f0e6', border: '1px solid rgba(28,74,53,.15)', borderRadius: '4px' }}>
          <p style={{ fontSize: '.85rem', color: '#1c4a35', fontWeight: '600', marginBottom: '.75rem' }}>
            Explore properties across Portugal:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            <a href="/imoveis" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>View all properties →</a>
            <a href="/zonas/lisboa" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Lisbon zone →</a>
            <a href="/zonas/cascais" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Cascais zone →</a>
            <a href="/#avm" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Free AVM valuation →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Ready to buy property in Portugal?</h3>
          <p>Get a free property valuation, explore current listings, and connect with our licensed advisors. No registration required.</p>
          <Link href="/en">Explore Properties →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/taxes-imt-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>IMT &amp; Taxes</Link>
            <Link href="/blog/capital-gains-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Capital Gains</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
