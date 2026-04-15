import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Invest in Portugal Real Estate 2026 — Returns, Areas & Strategy | Agency Group',
  description: 'Comprehensive guide to investing in Portuguese real estate in 2026. Rental yields, capital appreciation, IFICI tax regime, best investment areas and property types. AMI 22506.',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1',
  alternates: {
    canonical: 'https://www.agencygroup.pt/invest-in-portugal-real-estate',
    languages: {
      'x-default': 'https://www.agencygroup.pt/invest-in-portugal-real-estate',
      'en': 'https://www.agencygroup.pt/invest-in-portugal-real-estate',
      'pt-PT': 'https://www.agencygroup.pt/invest-in-portugal-real-estate',
    },
  },
  openGraph: {
    title: 'Invest in Portugal Real Estate 2026 — Returns, Strategy & Areas',
    description: 'Yields, appreciation, IFICI regime, family office structures. Expert Portuguese property investment guide for HNWI and institutional investors.',
    type: 'article',
    url: 'https://www.agencygroup.pt/invest-in-portugal-real-estate',
    siteName: 'Agency Group',
    locale: 'en_US',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Invest+in+Portugal+Real+Estate+2026&subtitle=Returns+%C2%B7+Strategy+%C2%B7+Expert+Guide',
      width: 1200,
      height: 630,
      alt: 'Invest in Portugal Real Estate 2026 — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Invest in Portugal Real Estate 2026',
    description: 'Yields, appreciation, IFICI, family office structures. Expert investment guide.',
    site: '@agencygroup_pt',
  },
}

const PAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Invest in Portugal Real Estate 2026: Returns, Areas & Strategy',
  description: 'Comprehensive guide to investing in Portuguese real estate in 2026.',
  image: { '@type': 'ImageObject', url: 'https://www.agencygroup.pt/api/og?title=Invest+in+Portugal+Real+Estate+2026&subtitle=Expert+Guide', width: 1200, height: 630 },
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt', logo: { '@type': 'ImageObject', url: 'https://www.agencygroup.pt/logo.png' } },
  datePublished: '2026-04-15',
  dateModified: '2026-04-15',
  url: 'https://www.agencygroup.pt/invest-in-portugal-real-estate',
  inLanguage: 'en-US',
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What rental yields can I expect in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Gross rental yields in Portugal range from 3.5–5.5% for prime Lisbon and Cascais locations, to 5–8% for Algarve short-term rental properties, and 6–10%+ for rural tourism and boutique hotels. Net yields after taxes, management, and maintenance typically run 1.5–3% lower.' } },
    { '@type': 'Question', name: 'How much has Portuguese property appreciated?', acceptedAnswer: { '@type': 'Answer', text: 'Portuguese residential property has appreciated 17.6% year-on-year in 2026 (national median). Luxury markets in Lisbon, Cascais, and the Algarve have seen 8–15% annual capital appreciation over the past 5 years, with Comporta and Madeira outperforming at 12–20% annually.' } },
    { '@type': 'Question', name: 'What taxes apply to rental income in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Rental income from Portuguese property is taxed at 28% for non-residents (flat rate), or at marginal rates (14.5–48%) for residents. Under the IFICI regime, qualifying residents pay 20% on Portuguese-sourced income. Allowable deductions include maintenance, management fees, mortgage interest, and depreciation.' } },
    { '@type': 'Question', name: 'Can I get a Portuguese mortgage as a foreign investor?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Portuguese banks lend to non-resident foreign investors. LTV is typically 60–70% for non-EU non-residents. Rates: Euribor 6M + 0.9–1.8% spread (variable) or fixed at 2.8–3.4%. Income from USD, GBP, AED sources is accepted at major banks.' } },
    { '@type': 'Question', name: 'Is Lisbon or Algarve better for investment?', acceptedAnswer: { '@type': 'Answer', text: 'Lisbon and Cascais offer higher capital appreciation and stronger long-term rental demand from expats and corporates. The Algarve (Golden Triangle) offers higher short-term rental yields and lifestyle value. For portfolio diversification, holding both provides the optimal risk-return profile.' } },
  ],
}

const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.agencygroup.pt' },
    { '@type': 'ListItem', position: 2, name: 'Invest in Portugal Real Estate', item: 'https://www.agencygroup.pt/invest-in-portugal-real-estate' },
  ],
}

export default function InvestPortugalPage() {
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
        .hero{padding:140px 0 80px;background:#0c1f15;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 20% 90%,rgba(28,74,53,.5),transparent)}
        .hero-inner{max-width:900px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .cat{display:inline-block;background:#1c4a35;color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,5vw,3.4rem);font-weight:300;color:#f4f0e6;line-height:1.1;margin-bottom:20px}
        .h1 em{color:#c9a96e;font-style:italic}
        .hero-sub{font-size:.9rem;color:rgba(244,240,230,.55);line-height:1.7;max-width:620px;margin-bottom:32px}
        .hero-cta{display:inline-flex;align-items:center;gap:12px;background:#c9a96e;color:#0c1f15;text-decoration:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;transition:all .2s}
        .content{max-width:900px;margin:0 auto;padding:72px 56px;background:#f4f0e6}
        .lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2{font-family:var(--font-cormorant),serif;font-size:clamp(1.4rem,3vw,2rem);font-weight:300;color:#0c1f15;margin:52px 0 20px;line-height:1.2}
        h2 em{color:#1c4a35;font-style:italic}
        h3{font-family:var(--font-jost),sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.08em;color:#1c4a35;text-transform:uppercase;margin:32px 0 12px}
        p{font-size:.88rem;line-height:1.9;color:rgba(14,14,13,.75);margin-bottom:20px}
        ul,ol{padding-left:24px;margin-bottom:20px}
        li{font-size:.88rem;line-height:1.9;color:rgba(14,14,13,.75);margin-bottom:6px}
        .metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(14,14,13,.08);margin:32px 0;border:1px solid rgba(14,14,13,.08)}
        .metric{background:#fff;padding:24px 20px}
        .metric-val{font-family:var(--font-cormorant),serif;font-size:2rem;font-weight:300;color:#0c1f15;line-height:1}
        .metric-val em{color:#1c4a35;font-style:normal}
        .metric-label{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.14em;color:rgba(14,14,13,.4);text-transform:uppercase;margin-top:4px}
        .yield-table{width:100%;border-collapse:collapse;margin:24px 0}
        .yield-table th{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(14,14,13,.4);padding:10px 16px;border-bottom:1px solid rgba(14,14,13,.1);text-align:left}
        .yield-table td{font-size:.82rem;padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.06);color:rgba(14,14,13,.75)}
        .box{background:#0c1f15;border:1px solid rgba(201,169,110,.25);padding:32px;margin:40px 0}
        .box-title{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.55);text-transform:uppercase;margin-bottom:12px}
        .box-h{font-family:var(--font-cormorant),serif;font-size:1.4rem;font-weight:300;color:#f4f0e6;margin-bottom:16px}
        .box p{color:rgba(244,240,230,.6)}
        .strategies{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin:24px 0}
        .strategy{border:1px solid rgba(14,14,13,.1);padding:24px;background:#fff}
        .strategy-icon{font-size:1.4rem;margin-bottom:12px}
        .strategy-name{font-family:var(--font-cormorant),serif;font-size:1.1rem;font-weight:300;color:#0c1f15;margin-bottom:6px}
        .strategy-note{font-size:.78rem;color:rgba(14,14,13,.55);line-height:1.6}
        .strategy-yield{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;color:#1c4a35;margin-top:8px}
        .faq{margin:8px 0}
        .faq-q{font-family:var(--font-jost),sans-serif;font-size:.88rem;font-weight:500;color:#0c1f15;margin:0 0 8px;cursor:default}
        .faq-a{font-size:.84rem;line-height:1.8;color:rgba(14,14,13,.68);margin:0 0 28px;padding-bottom:28px;border-bottom:1px solid rgba(14,14,13,.07)}
        .cta-section{background:#0c1f15;padding:80px 56px;text-align:center}
        .cta-h{font-family:var(--font-cormorant),serif;font-size:clamp(1.6rem,4vw,2.6rem);font-weight:300;color:#f4f0e6;margin-bottom:16px}
        .cta-h em{color:#c9a96e;font-style:italic}
        .cta-sub{font-size:.82rem;color:rgba(244,240,230,.5);max-width:520px;margin:0 auto 32px;line-height:1.7}
        .cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
        .btn-gold{background:#c9a96e;color:#0c1f15;text-decoration:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;transition:all .2s}
        .btn-outline{background:transparent;color:rgba(244,240,230,.7);text-decoration:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;border:1px solid rgba(201,169,110,.3);transition:all .2s}
        footer{background:#080f0a;padding:40px 56px;text-align:center}
        footer p{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;color:rgba(244,240,230,.2);line-height:2}
        footer a{color:rgba(201,169,110,.45);text-decoration:none}
        @media(max-width:768px){nav{padding:16px 24px}.hero-inner,.content,.cta-section{padding-left:24px;padding-right:24px}.hero{padding:110px 0 60px}footer{padding:32px 24px}}
      `}</style>

      <nav>
        <Link href="/" className="logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <Link href="/imoveis" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.5rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>
          View Properties →
        </Link>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="breadcrumb">
            <Link href="/">Home</Link> / Invest in Portugal Real Estate
          </div>
          <div className="cat">Investment Guide · 2026</div>
          <h1 className="h1">Invest in Portugal<br /><em>Real Estate 2026</em></h1>
          <p className="hero-sub">
            Yields, capital appreciation, tax efficiency, and the best property strategies
            for HNWI and institutional investors in the world's 5th-fastest appreciating
            luxury real estate market.
          </p>
          <Link href="/contacto" className="hero-cta">Request Investor Consultation →</Link>
        </div>
      </section>

      <article className="content">
        <p className="lead">
          Portugal's real estate market delivered 17.6% median price growth in 2026 against a backdrop of constrained supply, surging international demand, and one of Europe's most stable political environments. For foreign investors, the combination of competitive entry prices, IFICI tax efficiency, strong rental yields, and a liquid exit market creates a compelling risk-adjusted return profile unavailable elsewhere in Western Europe.
        </p>

        <h2>Market Performance: <em>2026 Key Metrics</em></h2>
        <div className="metrics">
          <div className="metric"><div className="metric-val">+<em>17.6</em>%</div><div className="metric-label">YoY price growth 2026</div></div>
          <div className="metric"><div className="metric-val"><em>169</em>K</div><div className="metric-label">Transactions in 2026</div></div>
          <div className="metric"><div className="metric-val">€<em>3,076</em></div><div className="metric-label">National median/m²</div></div>
          <div className="metric"><div className="metric-val">€<em>5,000</em></div><div className="metric-label">Lisbon prime/m²</div></div>
          <div className="metric"><div className="metric-val">Top <em>5</em></div><div className="metric-label">Global luxury ranking</div></div>
          <div className="metric"><div className="metric-val"><em>210</em>d</div><div className="metric-label">Avg days on market</div></div>
        </div>

        <h2>Investment Strategies & <em>Expected Returns</em></h2>
        <div className="strategies">
          {[
            { icon: '🏙', name: 'Urban Buy-to-Let', note: 'Long-term residential lets in Lisbon, Porto, Cascais. Stable tenant base, low management overhead.', yield: 'Gross yield: 3.5–5.5% · Appreciation: 6–12%/yr' },
            { icon: '☀️', name: 'Short-Term Rental (Algarve)', note: 'Golden Triangle villas. Peak season occupancy 85%+. Highest cash yield in Portugal.', yield: 'Gross yield: 6–10% · Appreciation: 5–8%/yr' },
            { icon: '🌿', name: 'Rural Tourism (Alentejo)', note: 'Boutique agritourism. Alto Alentejo, Comporta. Capital-light, strong lifestyle play.', yield: 'Gross yield: 5–8% · Appreciation: 8–15%/yr' },
            { icon: '🏝', name: 'Madeira Residences', note: 'Tax advantages + lifestyle. Funchal luxury and Calheta seafront. Emerging HNWI demand.', yield: 'Gross yield: 4–6% · Appreciation: 10–18%/yr' },
            { icon: '🏗', name: 'Development & Refurb', note: 'Lisbon historic palacetes and Porto buildings. Value-add plays with 15–25% margins.', yield: 'IRR: 12–22% · Hold: 18–36 months' },
            { icon: '🗂', name: 'Portfolio / Family Office', note: 'Multi-asset Portugal strategy. Diversification across residential, hospitality, commercial.', yield: 'Target IRR: 10–16% · 5–10yr horizon' },
          ].map(s => (
            <div key={s.name} className="strategy">
              <div className="strategy-icon">{s.icon}</div>
              <div className="strategy-name">{s.name}</div>
              <div className="strategy-note">{s.note}</div>
              <div className="strategy-yield">{s.yield}</div>
            </div>
          ))}
        </div>

        <h2>Rental Yields by <em>Location & Type</em></h2>
        <table className="yield-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Type</th>
              <th>Gross Yield</th>
              <th>5yr Appreciation</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><Link href="/zonas/lisboa" style={{color:'inherit',textDecoration:'underline',textDecorationColor:'rgba(28,74,53,.3)'}}>Lisbon (Chiado, Príncipe Real)</Link></td><td>Apartment</td><td>3.5–4.5%</td><td>+52%</td></tr>
            <tr><td><Link href="/zonas/cascais" style={{color:'inherit',textDecoration:'underline',textDecorationColor:'rgba(28,74,53,.3)'}}>Cascais (Estoril, Birre)</Link></td><td>Villa</td><td>4–5.5%</td><td>+48%</td></tr>
            <tr><td><Link href="/zonas/algarve" style={{color:'inherit',textDecoration:'underline',textDecorationColor:'rgba(28,74,53,.3)'}}>Algarve (Quinta do Lago)</Link></td><td>Villa (STR)</td><td>6–9%</td><td>+41%</td></tr>
            <tr><td><Link href="/zonas/porto" style={{color:'inherit',textDecoration:'underline',textDecorationColor:'rgba(28,74,53,.3)'}}>Porto (Foz do Douro)</Link></td><td>Apartment</td><td>4–5.5%</td><td>+44%</td></tr>
            <tr><td><Link href="/zonas/comporta" style={{color:'inherit',textDecoration:'underline',textDecorationColor:'rgba(28,74,53,.3)'}}>Comporta</Link></td><td>Villa</td><td>4–6%</td><td>+68%</td></tr>
            <tr><td><Link href="/zonas/madeira" style={{color:'inherit',textDecoration:'underline',textDecorationColor:'rgba(28,74,53,.3)'}}>Madeira (Funchal)</Link></td><td>Apartment</td><td>4.5–6%</td><td>+61%</td></tr>
            <tr><td>Alentejo (rural tourism)</td><td>Estate</td><td>5–8%</td><td>+35%</td></tr>
          </tbody>
        </table>

        <h2>Tax Efficiency: <em>IFICI & Corporate Structures</em></h2>
        <p>Portugal offers several legal structures to optimise investment returns:</p>
        <ul>
          <li><strong>IFICI (NHR 2.0):</strong> 20% flat rate on Portuguese income for qualifying new residents. 10-year duration. Covers employment, self-employment, rental income for eligible categories.</li>
          <li><strong>Luso-Swiss Double Tax Treaty:</strong> Zero withholding on dividends for Swiss-domiciled holding structures. Useful for family offices with Swiss presence.</li>
          <li><strong>Portuguese LDA (company):</strong> Corporate tax at 20% (21% standard rate; 17% for SMEs on first €50,000). Deduct finance costs, depreciation, management fees.</li>
          <li><strong>Non-Habitual Capital Gains:</strong> Capital gains on property held &gt;2 years receive 50% exclusion for reinvestment in Portuguese real estate.</li>
          <li><strong>IRS Categoria F (rental):</strong> 28% flat rate for non-residents. For residents under IFICI: 20% rate applies.</li>
        </ul>

        <div className="box">
          <div className="box-title">Agency Group · Investor Relations</div>
          <div className="box-h">Curated Off-Market Opportunities</div>
          <p>
            Our investor network receives exclusive access to properties and development opportunities
            that never reach the public market — pre-market exclusives, distressed sales,
            portfolio disposals, and off-plan with developer allocations.
          </p>
          <p>
            We work with family offices, private equity real estate, and HNWI investors allocating €500K–€50M.
            All opportunities are pre-screened, with financial models and due diligence packs available on request.
          </p>
        </div>

        <h2>How to Structure a Portuguese <em>Property Portfolio</em></h2>
        <p>The optimal holding structure depends on your tax residency, investment horizon, and return requirements:</p>
        <ul>
          <li><strong>Direct personal ownership:</strong> Simplest for single assets under €2M. IFICI residency required for optimal tax treatment.</li>
          <li><strong>Portuguese LDA (Lda.):</strong> Recommended for portfolios of 3+ assets or development projects. VAT registration, deductible costs, flexible profit distribution.</li>
          <li><strong>Foreign holding + Portugal Lda.:</strong> For non-resident investors. Holding in Luxembourg, Netherlands, or BVI to optimise withholding tax and exit structure.</li>
          <li><strong>SIGI (REIT equivalent):</strong> For institutional investment in €10M+ portfolios. Listed or unlisted. Tax-exempt at entity level if distributing 90%+ income.</li>
        </ul>

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
        <div className="cat">Investor Relations</div>
        <h2 className="cta-h">Access Our <em>Investment Portfolio</em></h2>
        <p className="cta-sub">Curated investment opportunities €500K–€50M. Off-market access. Financial models on request. No obligation.</p>
        <div className="cta-btns">
          <Link href="/off-market-portugal" className="btn-gold">Off-Market Access →</Link>
          <Link href="/contacto" className="btn-outline">Investor Consultation</Link>
        </div>
      </section>

      <section style={{ background: '#f4f0e6', padding: '60px 56px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.46rem', letterSpacing: '.2em', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', marginBottom: '24px' }}>Related Resources</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '16px' }}>
          {[
            { href: '/buy-property-portugal', label: 'Buy Property in Portugal Guide →' },
            { href: '/off-market-portugal', label: 'Off-Market Properties →' },
            { href: '/blog/property-investment-portugal-returns', label: 'Investment Returns Analysis 2026 →' },
            { href: '/blog/nhr-portugal-2026-guide', label: 'IFICI / NHR Tax Regime Guide →' },
            { href: '/imoveis', label: 'Browse Investment Properties →' },
            { href: '/contacto', label: 'Talk to Our Investment Team →' },
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
          © 2026 Agency Group – Mediação Imobiliária Lda · <Link href="/faq">FAQ</Link> · <Link href="/blog">Blog</Link> · <Link href="/imoveis">Properties</Link>
        </p>
      </footer>
    </>
  )
}
