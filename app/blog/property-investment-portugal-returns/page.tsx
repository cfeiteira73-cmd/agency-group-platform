import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Property Investment Portugal 2026: ROI & Yields Analysis',
  description: 'Complete analysis of property investment returns in Portugal 2026. Rental yields by zone, capital appreciation data, AL short-term rental returns, tax considerations and ROI examples. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
      'pt': 'https://www.agencygroup.pt/blog/investir-imoveis-comporta-2026',
      'x-default': 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
    },
  },
  openGraph: {
    title: 'Property Investment in Portugal 2026: ROI, Yields & Market Analysis',
    description: 'Portugal: €3,076/m² median, +17.6% YoY, 169,812 transactions. Rental yields 4.2–6.5%. Complete investment analysis with ROI calculator examples.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Property Investment in Portugal 2026: ROI, Yields & Market Analysis',
  description: 'Complete analysis of property investment returns in Portugal. Rental yields, capital appreciation, AL returns, tax, ROI examples.',
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
  url: 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Property investment Portugal' },
    { '@type': 'Thing', name: 'Portugal real estate returns 2026' },
    { '@type': 'Thing', name: 'Rental yield Portugal' },
  ],
}

export default function ArticlePropertyInvestmentPortugal() {
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
        .metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin:32px 0}
        .metric-card{background:#1c4a35;padding:28px 24px;text-align:center}
        .metric-val{font-family:var(--font-cormorant),serif;font-size:2.2rem;font-weight:300;color:#c9a96e;line-height:1;margin-bottom:8px}
        .metric-label{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,240,230,.5)}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .cost-table tr:last-child td{border-bottom:none;font-weight:600;color:#1c4a35;background:rgba(28,74,53,.04)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .roi-box{background:#fff;border:2px solid #1c4a35;padding:32px;margin:32px 0}
        .roi-title{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.3rem;color:#1c4a35;margin-bottom:16px}
        .roi-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(14,14,13,.06);font-size:.85rem;color:rgba(14,14,13,.7)}
        .roi-row:last-child{border-bottom:none;font-weight:600;color:#1c4a35;padding-top:16px}
        .roi-val{font-family:var(--font-dm-mono),monospace;font-size:.78rem;color:#c9a96e}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.metric-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
        <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>← Blog</Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → property-investment-portugal-returns
          </div>
          <div className="art-cat">Investment Analysis</div>
          <h1 className="art-h1">Property Investment in Portugal 2026:<br /><em>ROI, Yields &amp; Market Analysis</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>13 min read</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal recorded 169,812 property transactions in 2025 — a national all-time record. The median price
          reached €3,076/m², up +17.6% year-on-year (INE Q3 2025). Rental yields in Porto&apos;s historic centre
          reach 5.5%, while the Algarve&apos;s short-term rental sector generates gross yields of 6.5%+ in prime
          zones. Yet Portugal remains significantly undervalued versus comparable Western European markets. For
          international property investors, the combination of strong capital appreciation, meaningful rental income,
          favourable tax regimes, and EU legal certainty creates a compelling investment case. This guide provides
          the full data picture — by zone, by asset type, by strategy.
        </p>

        <div className="metric-grid">
          {[
            { val: '€3,076', label: 'Median price /m² (2025)' },
            { val: '+17.6%', label: 'YoY price growth' },
            { val: '169,812', label: 'Transactions (2025)' },
            { val: '5.5%', label: 'Peak yield (Porto historic)' },
            { val: '210', label: 'Days avg time on market' },
            { val: 'Top 5', label: 'Lisbon luxury globally' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-val">{m.val}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>

        <h2 className="s">1. Market Overview — Portugal 2026</h2>
        <p className="t">
          Portugal&apos;s property market has outperformed expectations consistently since 2015. The pandemic-driven
          acceleration (2020–2022) was followed by a brief moderation in 2023 as interest rates rose. But 2024–2025
          saw a new surge: record transaction volumes, record prices, and record international buyer participation.
          The structural drivers are clear and durable.
        </p>
        <p className="t">
          Supply remains chronically constrained. Portugal builds approximately 25,000–30,000 new residential units
          per year against estimated demand of 50,000–70,000 (IHRU 2025). This gap — particularly acute in Lisbon,
          Porto, and Cascais — creates a structural floor under prices regardless of cyclical interest rate movements.
          In prime segments (€500K+), cash buyers dominate (estimated 70–80%), making luxury prices largely
          insulated from credit market volatility.
        </p>

        <div className="callout">
          <p><strong>Why Portugal Outperforms:</strong> EU legal certainty · Supply shortage (chronic) · Tax incentives (IFICI) · Growing international buyer base (25%+ in premium segment) · Tourism infrastructure (Algarve, Lisbon) · Strong infrastructure investment (new metro, airport expansion) · Political stability.</p>
        </div>

        <h2 className="s">2. Rental Yields by Zone — Long-Term</h2>
        <p className="t">
          Gross rental yields are calculated as: (annual rent / purchase price) × 100. Net yields subtract
          vacancy, maintenance, property tax (IMI), property management fees, and income tax. The gap between
          gross and net is typically 25–35% of gross.
        </p>
        <table className="cost-table">
          <thead><tr><th>Zone</th><th>Avg Price/m²</th><th>Gross Yield (LT)</th><th>Net Yield (LT)</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Lisbon — Chiado / Príncipe Real</td><td>€8,500</td><td>4.2%</td><td>2.8%</td><td>Corporate + diplomat tenants. Low vacancy. Premium rents.</td></tr>
            <tr><td>Lisbon — Parque das Nações</td><td>€5,600</td><td>4.8%</td><td>3.2%</td><td>Tech sector. Modern stock. Strong demand.</td></tr>
            <tr><td>Lisbon — Outer zones</td><td>€3,800</td><td>5.2%</td><td>3.5%</td><td>Amadora, Odivelas, Loures. Higher yield, lower appreciation.</td></tr>
            <tr><td>Cascais — Centro</td><td>€6,500</td><td>4.5%</td><td>3.0%</td><td>Expat families. Seasonal uplift. Stable demand.</td></tr>
            <tr><td>Porto — Historic Centre</td><td>€5,200</td><td>5.5%</td><td>3.8%</td><td>University demand. Tourism. Strong appreciation trajectory.</td></tr>
            <tr><td>Porto — Foz do Douro</td><td>€4,800</td><td>5.0%</td><td>3.4%</td><td>Riverside. Family demand. Strong capital growth.</td></tr>
            <tr><td>Algarve — Vilamoura</td><td>€4,500</td><td>5.8%</td><td>4.0%</td><td>Golf + marina. Year-round demand. Corporate rentals.</td></tr>
            <tr><td>Algarve — Golden Triangle</td><td>€8,000</td><td>4.5%</td><td>3.0%</td><td>Vale do Lobo, Quinta do Lago. Elite segment. Exceptional capital growth.</td></tr>
            <tr><td>Madeira — Funchal</td><td>€3,760</td><td>5.5%</td><td>3.8%</td><td>Growing market. Digital nomad demand. IFICI applicable.</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. Short-Term Rental (AL) Returns</h2>
        <p className="t">
          Portugal&apos;s Alojamento Local (AL) regime allows property owners to rent short-term to tourists via
          platforms like Airbnb and Booking.com. AL properties in prime locations command significantly higher
          gross yields than long-term rentals, though with higher costs, more active management requirements,
          and evolving regulatory risk.
        </p>
        <table className="cost-table">
          <thead><tr><th>Zone</th><th>Peak Season ADR</th><th>Occupancy (Annual)</th><th>Gross Annual Revenue</th><th>Gross Yield (on €700K)</th></tr></thead>
          <tbody>
            <tr><td>Lisbon Centro (T2)</td><td>€180/night</td><td>72%</td><td>€47,300</td><td>6.8%</td></tr>
            <tr><td>Cascais Centre (T2)</td><td>€220/night</td><td>68%</td><td>€54,600</td><td>7.8%</td></tr>
            <tr><td>Algarve — Vilamoura (T2)</td><td>€260/night</td><td>65%</td><td>€61,700</td><td>8.8%</td></tr>
            <tr><td>Porto Historic (T2)</td><td>€160/night</td><td>70%</td><td>€40,900</td><td>5.8%</td></tr>
            <tr><td>Algarve — Albufeira (T2)</td><td>€200/night</td><td>68%</td><td>€49,600</td><td>7.1%</td></tr>
          </tbody>
        </table>

        <p className="t">
          AL regulatory risk: Lisbon municipality has imposed moratoriums on new AL licences in certain zones
          (Chiado, Alfama, Mouraria). New licences are available in other Lisbon neighbourhoods and across
          Porto, Cascais, and the Algarve. Always verify AL licence availability for a specific property address
          before purchasing for AL purposes.
        </p>

        <h2 className="s">4. Capital Appreciation — 10-Year Data</h2>
        <table className="cost-table">
          <thead><tr><th>Market</th><th>Price 2015 /m²</th><th>Price 2025 /m²</th><th>10Y Total Growth</th><th>CAGR</th></tr></thead>
          <tbody>
            <tr><td>Lisbon (average)</td><td>€2,100</td><td>€5,000</td><td>+138%</td><td>+9.1%</td></tr>
            <tr><td>Chiado / Príncipe Real</td><td>€3,500</td><td>€8,500</td><td>+143%</td><td>+9.3%</td></tr>
            <tr><td>Cascais</td><td>€2,000</td><td>€4,713</td><td>+136%</td><td>+8.9%</td></tr>
            <tr><td>Porto (average)</td><td>€1,400</td><td>€3,643</td><td>+160%</td><td>+10.0%</td></tr>
            <tr><td>Algarve (average)</td><td>€1,800</td><td>€3,941</td><td>+119%</td><td>+8.1%</td></tr>
            <tr><td>Madeira</td><td>€1,600</td><td>€3,760</td><td>+135%</td><td>+8.9%</td></tr>
            <tr><td>National median</td><td>€1,400</td><td>€3,076</td><td>+120%</td><td>+8.2%</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. Tax Considerations for Investors</h2>
        <h3 className="ss">Rental Income Tax</h3>
        <p className="t">
          Rental income (rendimentos prediais — Category F) is taxed at 28% flat rate for non-residents. Residents
          can opt for flat 28% or include rental income in their progressive IRS return (up to 48%). Deductible
          expenses: IMI, maintenance, insurance, management fees, condominium fees, depreciation (not applicable
          for land). Net taxable income after deductions is typically 30–45% lower than gross rent.
        </p>
        <h3 className="ss">Capital Gains Tax (Mais-Valias)</h3>
        <p className="t">
          For non-residents: 28% flat on real capital gain (sale price minus purchase price minus acquisition costs
          minus eligible renovation costs, adjusted for inflation coefficient). EU residents benefit from the same
          50% exclusion available to Portuguese residents if they elect Portuguese IRS. Non-EU residents pay 28%
          on the full gain. For a property held 10 years with 150% appreciation, the tax impact is significant —
          factor this into your exit strategy planning.
        </p>
        <h3 className="ss">IFICI for Investors</h3>
        <p className="t">
          If you establish Portuguese tax residency under IFICI, capital gains on foreign assets and dividends
          may be exempt or reduced under applicable DTTs. Portuguese property capital gains are taxed at 50% of
          the gain (same rate as residents) if you elect Portuguese IRS as an EU/EEA resident under IFICI.
        </p>

        <div className="callout">
          <p><strong>Key Tax Numbers:</strong> Rental income (non-resident) 28% flat · Capital gains (non-resident) 28% · Capital gains (EU resident electing PT IRS) 50% exclusion → effective ~14% · IMI 0.3–0.45%/year (cadastral value) · AIMI 0.7% (portfolio &gt;€600K) · No wealth tax in Portugal.</p>
        </div>

        <h2 className="s">6. ROI Calculator — €1,000,000 Investment</h2>

        <div className="roi-box">
          <div className="roi-title">Scenario A: Lisbon T3, Parque das Nações — Long-Term Rental</div>
          <div className="roi-row"><span>Purchase price</span><span className="roi-val">€1,000,000</span></div>
          <div className="roi-row"><span>Acquisition costs (IMT + IS + legal + notary)</span><span className="roi-val">€89,000</span></div>
          <div className="roi-row"><span>Total investment</span><span className="roi-val">€1,089,000</span></div>
          <div className="roi-row"><span>Gross annual rent (€4,200/month)</span><span className="roi-val">€50,400</span></div>
          <div className="roi-row"><span>Less: IMI + management + maintenance + vacancy (~25%)</span><span className="roi-val">-€12,600</span></div>
          <div className="roi-row"><span>Net pre-tax rent</span><span className="roi-val">€37,800</span></div>
          <div className="roi-row"><span>Tax on rent (28%)</span><span className="roi-val">-€10,584</span></div>
          <div className="roi-row"><span>Net annual income</span><span className="roi-val">€27,216</span></div>
          <div className="roi-row"><span>Net income yield on total investment</span><span className="roi-val">2.5%</span></div>
          <div className="roi-row"><span>Projected value Year 5 (8% CAGR)</span><span className="roi-val">€1,469,000</span></div>
          <div className="roi-row"><span>5Y total return (income + appreciation, pre-CGT)</span><span className="roi-val">€516,000 / +47%</span></div>
        </div>

        <div className="roi-box">
          <div className="roi-title">Scenario B: Algarve T2, Vilamoura — AL Short-Term Rental</div>
          <div className="roi-row"><span>Purchase price</span><span className="roi-val">€750,000</span></div>
          <div className="roi-row"><span>Acquisition costs + furnishing</span><span className="roi-val">€85,000</span></div>
          <div className="roi-row"><span>Total investment</span><span className="roi-val">€835,000</span></div>
          <div className="roi-row"><span>Gross AL revenue (65% occ. × €220/night)</span><span className="roi-val">€52,000</span></div>
          <div className="roi-row"><span>Less: platform fees + management + costs (~38%)</span><span className="roi-val">-€19,760</span></div>
          <div className="roi-row"><span>Net pre-tax AL income</span><span className="roi-val">€32,240</span></div>
          <div className="roi-row"><span>Tax on AL income (Cat. B, simplified 35% base)</span><span className="roi-val">-€3,200 approx.</span></div>
          <div className="roi-row"><span>Net annual income</span><span className="roi-val">€29,040</span></div>
          <div className="roi-row"><span>Net income yield on total investment</span><span className="roi-val">3.5%</span></div>
          <div className="roi-row"><span>Projected value Year 5 (7% CAGR)</span><span className="roi-val">€1,052,000</span></div>
          <div className="roi-row"><span>5Y total return (income + appreciation, pre-CGT)</span><span className="roi-val">€362,000 / +43%</span></div>
        </div>

        <h2 className="s">7. Exit Strategies</h2>
        <p className="t">
          Portuguese property is highly liquid in the €400K–€3M segment — this is where 80%+ of international
          transactions occur. Typical time from listing to accepted offer: 60–120 days for fairly priced assets.
          Above €5M, the market is thinner and transactions take longer, but motivated buyers do exist (family
          offices, UHNWI from Middle East and Asia).
        </p>
        <p className="t">
          Exit strategies for property investors in Portugal:
        </p>
        <table className="cost-table">
          <thead><tr><th>Exit Strategy</th><th>Typical Timeline</th><th>CGT Consideration</th><th>Best For</th></tr></thead>
          <tbody>
            <tr><td>Open market sale</td><td>60–150 days</td><td>28% on gain (non-res) or 50% exclusion (EU res)</td><td>Standard exit, full price realisation</td></tr>
            <tr><td>Sale-leaseback</td><td>30–60 days</td><td>Same CGT rules</td><td>Investors wanting liquidity while retaining occupancy</td></tr>
            <tr><td>Company structure sale</td><td>Variable</td><td>Corporate rate (21%) on company gain</td><td>Portfolios with multiple properties</td></tr>
            <tr><td>Estate / inheritance</td><td>—</td><td>No inheritance tax in Portugal (above €500 — 10% stamp duty on non-direct heirs)</td><td>Long-term wealth transfer</td></tr>
          </tbody>
        </table>

        <h2 className="s">8. Risk Factors</h2>
        <p className="t">
          Any investment analysis must account for risks. For Portuguese property in 2026:
        </p>
        <p className="t">
          <strong>Regulatory risk:</strong> AL licence restrictions are tightening in Lisbon and may spread to other
          municipalities. New housing legislation can affect rental contracts, price caps, or mandatory offers to
          municipalities. Monitor legislative developments, particularly if investing for AL income.
        </p>
        <p className="t">
          <strong>Currency risk:</strong> For non-EUR investors (USD, GBP, BRL), EUR/currency fluctuations affect
          returns when converted. The EUR/USD rate has been volatile in 2023–2025. Consider EUR-denominated financing
          or FX hedging for large exposures.
        </p>
        <p className="t">
          <strong>Interest rate risk:</strong> For leveraged investors, Euribor movements affect financing costs.
          Euribor 6M at 2.95% (March 2026) is significantly below the 2023 peak of 4.2%, and is expected to continue
          moderating in 2026–2027.
        </p>
        <p className="t">
          <strong>Concentration risk:</strong> Investing heavily in a single city or zone amplifies exposure to local
          regulatory or economic changes. Portfolio diversification across Lisbon + Algarve or Lisbon + Porto
          is prudent for larger exposures.
        </p>

        <h2 className="s">9. Why Agency Group for Investment Property</h2>
        <p className="t">
          Agency Group (AMI 22506) operates in the €100K–€100M segment across Portugal, Spain, Madeira, and the
          Azores. For investment buyers, we provide:
        </p>
        <p className="t">
          <strong>Off-market access:</strong> 30–40% of the best investment properties — AL-licenced apartments,
          portfolio deals, distressed assets — never reach public portals. Our network provides first-look access.
        </p>
        <p className="t">
          <strong>Yield analysis:</strong> Our AVM (Automated Valuation Model) provides rental income estimates,
          comparable transaction data, and yield projections for any address in Portugal within 60 seconds.
        </p>
        <p className="t">
          <strong>Zero buyer cost:</strong> Our commission is paid entirely by the seller (5% + VAT). As a buyer,
          you receive full representation — due diligence coordination, negotiation, CPCV review, referrals to lawyers
          and tax advisers — at no charge.
        </p>

        <div className="cta-box">
          <h3>Run your Portugal investment numbers.</h3>
          <p>Use our free AVM tool to get yield estimates and comparable data for any property in Portugal. No registration required. Connect with our investment team for off-market opportunities.</p>
          <Link href="https://www.agencygroup.pt/portal">Open Investment Portal →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/luxury-property-lisbon" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Luxury Lisbon</Link>
            <Link href="/blog/nhr-portugal-2026-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>NHR / IFICI</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
