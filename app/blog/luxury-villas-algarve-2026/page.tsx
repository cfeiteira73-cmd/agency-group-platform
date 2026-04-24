import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Luxury Villas Algarve 2026: Golf Resorts & Investment',
  description: 'Complete guide to buying luxury villas in the Algarve in 2026. Vale do Lobo, Quinta do Lago, Vilamoura prices, rental yields 5.5–6.5%, golf resorts, and step-by-step buying process. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/luxury-villas-algarve-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/luxury-villas-algarve-2026',
    },
  },
  openGraph: {
    title: 'Luxury Villas in Algarve 2026: Prices, Golf Resorts & Investment Guide',
    description: 'Vale do Lobo, Quinta do Lago, Vilamoura — real prices, rental yields up to 6.5%, and the complete buying guide for the Algarve luxury market.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/luxury-villas-algarve-2026',
    locale: 'en_US',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Luxury%20Villas%20in%20Algarve%202026%3A%20Prices%2C%20Golf%20Resorts%20%26%20Invest&subtitle=Vale%20do%20Lobo%2C%20Quinta%20do%20Lago%2C%20Vilamoura%20%E2%80%94%20real%20prices%2C',
      width: 1200,
      height: 630,
      alt: 'Luxury Villas in Algarve 2026: Prices, Golf Resorts & Investment Guide',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Luxury Villas in Algarve 2026: Prices, Golf Resorts & Investment Guide',
    description: 'Vale do Lobo, Quinta do Lago, Vilamoura — real prices, rental yields up to 6.5%, and the complete bu',
    images: ['https://www.agencygroup.pt/api/og?title=Luxury%20Villas%20in%20Algarve%202026%3A%20Prices%2C%20Golf%20Resorts%20%26%20Invest&subtitle=Vale%20do%20Lobo%2C%20Quinta%20do%20Lago%2C%20Vilamoura%20%E2%80%94%20real%20prices%2C'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Luxury Villas in Algarve 2026: Prices, Golf Resorts & Investment Guide',
  description: 'Complete guide to buying luxury villas in the Algarve in 2026. Vale do Lobo, Quinta do Lago, Vilamoura, rental yields 5.5–6.5%.',
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
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/luxury-villas-algarve-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Luxury villas Algarve' },
    { '@type': 'Thing', name: 'Algarve property investment 2026' },
    { '@type': 'Thing', name: 'Vale do Lobo real estate' },
    { '@type': 'Thing', name: 'Quinta do Lago property' },
    { '@type': 'Thing', name: 'Vilamoura real estate' },
  ],
}

export default function ArticleLuxuryVillasAlgarve() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → luxury-villas-algarve-2026
          </div>
          <div className="art-cat">Investment Guide</div>
          <h1 className="art-h1">Luxury Villas in Algarve 2026:<br /><em>Prices, Golf Resorts &amp; Investment Guide</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>10 min read</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          The Algarve is not just Portugal&apos;s most visited region — it is the country&apos;s highest-performing luxury real estate
          market. With 330 days of sunshine per year, 36 championship golf courses, and the Golden Triangle commanding
          €5,000–€8,000/m², the Algarve attracts the largest share of British buyers (35% of foreign transactions) and
          delivers the best rental yields in Portugal: 5.5%–6.5% gross on premium villas. This guide covers every zone,
          every price point, and the complete buying process for 2026.
        </p>

        <h2 className="s">1. Why the Algarve in 2026</h2>
        <p className="t">
          The Algarve&apos;s appeal is both lifestyle and financial. On the lifestyle side: 300+ km of Atlantic coastline,
          330 days of average sunshine (the most of any mainland European region), 36 golf courses — more than any other
          European tourist region — and direct flights from 45+ international airports. On the financial side: rental
          demand outstrips supply every summer, occupancy rates for quality villas exceed 85% in peak season
          (June–September), and price appreciation has averaged +9.2% per year over the past five years.
        </p>
        <p className="t">
          The Algarve is also Europe&apos;s most established international property market for British buyers, who represent
          approximately 35% of all foreign transactions. Germans account for 12%, Dutch 9%, French 8%, and Irish 6%.
          The region&apos;s legal infrastructure, English-speaking lawyers, and mature estate agency market make it particularly
          accessible for first-time buyers from the UK, Ireland, and North America.
        </p>

        <div className="callout">
          <p><strong>Algarve 2026 Market Data:</strong> Average price €3,941/m² · Golden Triangle premium zones €5,000–€8,000/m² · Gross rental yields 5.5–6.5% · 330 days annual sunshine · 36 golf courses · 35% British buyers · Direct flights from 45+ airports year-round.</p>
        </div>

        <h2 className="s">2. Zones and Prices: The Complete Picture</h2>
        <p className="t">The Algarve is not a single market. Understanding which zone matches your objectives — whether lifestyle, yield, or capital appreciation — is critical. Here is the definitive zone-by-zone breakdown for 2026:</p>

        <div className="loc-grid">
          {[
            { name: 'Vale do Lobo', price: '€4,500–€6,000 / m²', desc: 'The most exclusive gated resort in Portugal. Two championship golf courses, beach access, private security. Villas €2M–€12M. Strong British buyer base. 87% summer occupancy for managed rentals.' },
            { name: 'Quinta do Lago', price: '€5,000–€8,000 / m²', desc: 'Portugal\'s premier address. 27-hole golf course, luxury hotel amenities, Ria Formosa Natural Park border. Ultra-prime villas €3M–€20M+. Off-market transactions dominate. 5-year appreciation: +62%.' },
            { name: 'Vilamoura', price: '€3,500–€4,500 / m²', desc: 'Europe\'s largest private marina (1,000 berths). Four golf courses including the legendary Old Course. Apartments €500K–€1.2M, villas €1.5M–€5M. Excellent rental yields 5.8–6.2%.' },
            { name: 'Almancil / Loulé', price: '€3,200–€4,800 / m²', desc: 'Between Quinta do Lago and Vilamoura — captures spill-over demand from both. Service hub for the Golden Triangle. Emerging luxury residential. Villas €900K–€3M.' },
            { name: 'Portimão / Alvor', price: '€2,800–€3,500 / m²', desc: 'Atlantic coast with Praia da Rocha and Alvor lagoon. More accessible price points. Growing international community. Strong year-round rental market. Villas €600K–€2M.' },
            { name: 'Lagos / Luz', price: '€3,000–€4,200 / m²', desc: 'Western Algarve — dramatic cliffs, golden beaches, historic town. Increasingly popular with French and American buyers. Character properties and modern villas. €700K–€3.5M.' },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="ss">Zone Comparison Table</h3>
        <table className="cost-table">
          <thead><tr><th>Zone</th><th>Price Range</th><th>Gross Yield</th><th>Best For</th><th>Liquidity</th></tr></thead>
          <tbody>
            <tr><td>Quinta do Lago</td><td>€5,000–€8,000/m²</td><td>4.5–5.5%</td><td>Capital appreciation / Ultra-prime</td><td>Medium (off-market)</td></tr>
            <tr><td>Vale do Lobo</td><td>€4,500–€6,000/m²</td><td>5.0–6.0%</td><td>Resort lifestyle + yield</td><td>Good</td></tr>
            <tr><td>Vilamoura</td><td>€3,500–€4,500/m²</td><td>5.8–6.2%</td><td>Yield + marina lifestyle</td><td>Excellent</td></tr>
            <tr><td>Lagos / Luz</td><td>€3,000–€4,200/m²</td><td>5.5–6.5%</td><td>Western lifestyle / character</td><td>Good</td></tr>
            <tr><td>Portimão / Alvor</td><td>€2,800–€3,500/m²</td><td>6.0–6.5%</td><td>Value + yield</td><td>Very Good</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. Golf — The Algarve&apos;s Unique Asset</h2>
        <p className="t">
          The Algarve has 36 golf courses — more than any other European tourist region and a key driver of year-round
          demand. Unlike seasonal beach markets, golf attracts high-net-worth visitors from October to April, when northern
          Europe is cold. This extends peak rental periods and supports winter occupancy rates of 65–75% for golf-adjacent
          villas — a performance unmatched anywhere else in Portugal.
        </p>
        <p className="t">
          Key courses and their property impact: the Old Course at Vilamoura (opened 1969, ranked top 5 in Portugal),
          San Lorenzo at Quinta do Lago (European Tour venue, ultra-premium adjacency), Royal Golf Vale do Lobo
          (Ocean Course — cliff-edge views, global top 100), and Amendoeira Golf Resort near Silves (more accessible,
          emerging area). Properties within 500m of a top-ranked course command a 15–25% premium over equivalent
          properties without golf access.
        </p>

        <h2 className="s">4. Rental Yields: Portugal&apos;s Best Performer</h2>
        <p className="t">
          The Algarve delivers the highest gross rental yields in Portugal, outperforming Lisbon (4.5–5.5%),
          Porto (4.8–5.8%), and Cascais (4.0–5.0%) across most sub-segments. A €2M villa in Vale do Lobo
          typically generates €80,000–€120,000 in gross rental income per year through managed short-term rentals —
          a gross yield of 4%–6% before management fees (typically 20–25% of revenue).
        </p>
        <table className="cost-table">
          <thead><tr><th>Property Type</th><th>Price Range</th><th>Annual Gross Rental</th><th>Gross Yield</th></tr></thead>
          <tbody>
            <tr><td>3-bed villa, Vilamoura</td><td>€900K–€1.4M</td><td>€50,000–€75,000</td><td>5.5–6.2%</td></tr>
            <tr><td>4-bed villa, Vale do Lobo</td><td>€2M–€3.5M</td><td>€100,000–€160,000</td><td>4.8–5.5%</td></tr>
            <tr><td>5-bed villa, Quinta do Lago</td><td>€4M–€8M</td><td>€160,000–€280,000</td><td>3.8–4.5%</td></tr>
            <tr><td>3-bed villa, Lagos / Luz</td><td>€700K–€1.2M</td><td>€45,000–€70,000</td><td>5.8–6.5%</td></tr>
            <tr><td>2-bed apartment, Vilamoura</td><td>€350K–€600K</td><td>€22,000–€38,000</td><td>5.5–6.5%</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Important:</strong> Gross yields do not account for management fees (20–25%), property tax (IMI 0.3–0.45%), maintenance (1–2% of value annually), insurance, and local accommodation licence costs. Net yields typically run 2.5–4% for professionally managed villas. <strong>Always model net yield before purchase.</strong></p>
        </div>

        <h2 className="s">5. Buying a Villa in the Algarve: Step by Step</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'NIF & Bank Account', d: 'Your Portuguese tax number (NIF) is mandatory. Obtain it in 1–2 days at Finanças or via a lawyer. Open a Portuguese bank account at Millennium BCP, Santander, or Novobanco. Non-residents need a fiscal representative.' },
            { n: '02', t: 'Define Your Brief', d: 'Zone, golf access, sea views, pool, number of beds, rental programme or personal use? The Algarve has 36 golf courses and 300km of coast — narrowing your brief saves weeks of searching.' },
            { n: '03', t: 'Due Diligence', d: 'Verify land registry (certidão predial), habitation licence, condominium debts, planning permissions, and resort rules (if applicable). Resorts like Vale do Lobo have specific rules on rental, renovation, and use.' },
            { n: '04', t: 'Offer & CPCV', d: 'Written offer with 48–72h deadline. If accepted, the CPCV (promise of purchase) is signed with a 10–30% deposit. If the seller withdraws, the deposit is returned double. The Agency Group commission is paid by the seller.' },
            { n: '05', t: 'Taxes Before Escritura', d: 'IMT (property transfer tax) and Stamp Duty (0.8%) must be paid before the final deed. For a €2M villa: IMT at 7.5% = €150,000 + IS €16,000 + notary €2,500. Total acquisition costs: ~8–9%.' },
            { n: '06', t: 'Escritura & Registration', d: 'Final deed before a notary. Keys handed over. Registration at the Land Registry completes the process. Typical total timeline: 60–90 days from offer acceptance.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. IMT and Acquisition Costs</h2>
        <p className="t">For a €2,000,000 Algarve villa (investment/non-resident purchase, 2026):</p>
        <table className="cost-table">
          <thead><tr><th>Cost</th><th>Rate / Amount</th><th>Estimated Value</th></tr></thead>
          <tbody>
            <tr><td>IMT (Property Transfer Tax)</td><td>7.5% for investment properties &gt;€1.05M</td><td>€150,000</td></tr>
            <tr><td>Stamp Duty (Imposto de Selo)</td><td>0.8% of purchase price</td><td>€16,000</td></tr>
            <tr><td>Land Registry + Notary</td><td>Fixed + variable</td><td>€2,000–3,000</td></tr>
            <tr><td>Lawyer (strongly recommended)</td><td>0.5–1% of price</td><td>€10,000–20,000</td></tr>
            <tr><td>Agency Commission (paid by seller)</td><td>5% + VAT</td><td>€0 (paid by seller)</td></tr>
            <tr><td>Total acquisition costs</td><td>~8–9% of price</td><td>€178,000–189,000</td></tr>
          </tbody>
        </table>

        <h2 className="s">7. IFICI Tax Regime and the Algarve</h2>
        <p className="t">
          For buyers who relocate to Portugal, the IFICI regime (successor to NHR) provides a flat 20% income tax rate
          for 10 years on eligible income. The Algarve qualifies for IFICI — establishing a primary residence in Loulé,
          Albufeira, Lagos, or anywhere else in the region counts for tax residency purposes.
        </p>
        <p className="t">
          For a British buyer with £200,000 in annual income relocating to the Algarve, IFICI can mean a tax saving of
          €40,000–€80,000 per year versus remaining UK-tax-resident — far exceeding the annual running costs of a villa.
          The programme requires you to not have been Portuguese tax-resident in the previous 5 years.
        </p>

        <h2 className="s">8. Who Is Buying in the Algarve?</h2>
        <p className="t">
          The Algarve&apos;s buyer profile is uniquely international. British buyers lead at approximately 35% of all foreign
          transactions — the largest concentration of UK buyers anywhere in Europe outside London. This is partly cultural
          (the Algarve has been a British holiday destination since the 1960s), partly linguistic (English is universally
          spoken), and partly financial (Portugal offers better value than the Costa del Sol or Tuscany at comparable
          lifestyle levels).
        </p>
        <p className="t">
          Germans (12%), Dutch (9%), French (8%), and Irish (6%) complete the top five. American buyers have grown
          significantly since 2022, now representing approximately 5% of transactions above €1M. Scandinavians —
          particularly Swedish and Danish — are the fastest-growing segment in 2025–2026, attracted by the year-round
          warmth and direct flight connections.
        </p>
        <p className="t">
          The typical Algarve buyer in the €1M–€5M segment is: aged 45–65, semi-retired or working remotely, purchasing
          as a primary residence or second home with rental income to offset costs, drawn by golf and lifestyle,
          and planning to hold for 7–15 years. The market&apos;s maturity — with established letting agents, property managers,
          and English-speaking professionals — makes it genuinely accessible.
        </p>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f4f0e6', border: '1px solid rgba(28,74,53,.15)', borderRadius: '4px' }}>
          <p style={{ fontSize: '.85rem', color: '#1c4a35', fontWeight: '600', marginBottom: '.75rem' }}>
            Explore Algarve properties:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            <a href="/zonas/algarve" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Algarve zone — available properties →</a>
            <a href="/imoveis?zona=Algarve" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>All Algarve listings →</a>
            <a href="/imoveis" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>View all properties in Portugal →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Ready to find your Algarve villa?</h3>
          <p>Agency Group (AMI 22506) has exclusive access to off-market inventory across Vale do Lobo, Quinta do Lago, Vilamoura, and Lagos. Get matched with properties that never appear on public portals.</p>
          <Link href="/en">Explore Algarve Properties →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer&apos;s Guide</Link>
            <Link href="/blog/taxes-imt-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>IMT &amp; Taxes</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
