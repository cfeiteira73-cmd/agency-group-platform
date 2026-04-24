import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Portugal vs Spain for Tax Residency 2026: Comparison',
  description: 'IFICI+ (Portugal, 20% flat) vs Beckham Law (Spain, 24% flat). Cost of living, safety, education, property costs. Which country wins by profile in 2026? AMI 22506.',
  keywords: 'portugal vs spain tax residency 2026, portugal spain comparison expats, where to live portugal spain, ifici vs beckham law, portugal spain property',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/portugal-vs-spain-tax-residency-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/portugal-vs-spain-tax-residency-2026',
    },
  },
  openGraph: {
    title: 'Portugal vs Spain for Tax Residency in 2026: The Definitive Comparison',
    description: 'IFICI+ vs Beckham Law. Property costs €3K–5K/m² vs €5K–8K/m². Safety #4 vs #30. Full breakdown by expat profile.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/portugal-vs-spain-tax-residency-2026',
    locale: 'en_US',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Portugal%20vs%20Spain%20for%20Tax%20Residency%20in%202026%3A%20The%20Definitive&subtitle=IFICI%2B%20vs%20Beckham%20Law.%20Property%20costs%20%E2%82%AC3K%E2%80%935K%2Fm%C2%B2%20vs%20%E2%82%AC5K%E2%80%93',
      width: 1200,
      height: 630,
      alt: 'Portugal vs Spain for Tax Residency in 2026: The Definitive Comparison',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portugal vs Spain for Tax Residency in 2026: The Definitive Comparison',
    description: 'IFICI+ vs Beckham Law. Property costs €3K–5K/m² vs €5K–8K/m². Safety #4 vs #30. Full breakdown by ex',
    images: ['https://www.agencygroup.pt/api/og?title=Portugal%20vs%20Spain%20for%20Tax%20Residency%20in%202026%3A%20The%20Definitive&subtitle=IFICI%2B%20vs%20Beckham%20Law.%20Property%20costs%20%E2%82%AC3K%E2%80%935K%2Fm%C2%B2%20vs%20%E2%82%AC5K%E2%80%93'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Portugal vs Spain for Tax Residency in 2026: The Definitive Comparison',
  description: 'IFICI+ vs Beckham Law, property prices, cost of living, safety, education and verdict by expat profile for 2026.',
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
  url: 'https://www.agencygroup.pt/blog/portugal-vs-spain-tax-residency-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Portugal tax residency 2026' },
    { '@type': 'Thing', name: 'Spain Beckham Law vs Portugal IFICI' },
    { '@type': 'Thing', name: 'Expat relocation Portugal Spain' },
  ],
}

const VERDICTS = [
  {
    profile: 'Retirees & passive income',
    winner: 'Portugal',
    reason: 'IFICI+ exempts foreign pension income, D7 passive income visa, safety #4 globally (GPI 2025), lower cost of living by 15–20%, Algarve climate equivalent to Costa del Sol.',
  },
  {
    profile: 'Tech entrepreneurs & freelancers',
    winner: 'Portugal',
    reason: 'IFICI+ at 20% flat on qualifying employment/self-employment. Lisbon tech ecosystem growing at top-3 EU pace. Digital Nomad visa. English penetration high in Lisbon, Porto, Algarve.',
  },
  {
    profile: 'Finance & banking professionals',
    winner: 'Tie',
    reason: 'Madrid is a larger financial hub (IBEX 35 companies, EU Banking Authority). Lisbon is the fastest-growing fintech cluster in Southern Europe. Both offer 20–24% flat tax regimes.',
  },
  {
    profile: 'Families with children',
    winner: 'Spain (Madrid/Barcelona)',
    reason: 'Greater concentration of international schools in Madrid and Barcelona. Larger expat communities. More direct flight connections. However, Cascais/Sintra (Portugal) is a credible alternative for families prioritising safety and lifestyle over city infrastructure.',
  },
  {
    profile: 'HNWI wealth preservation',
    winner: 'Portugal',
    reason: 'IFICI+ covers foreign-source dividends and capital gains (often fully exempt). Property prices 30–40% below comparable Spanish prime markets. Portugal #4 globally for safety — a genuine consideration for HNWI families.',
  },
]

export default function ArticlePortugalVsSpainTaxResidency() {
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
        .art-hero{padding:140px 0 80px;background:linear-gradient(135deg,#0c1a2e 0%,#0c1f15 100%);position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 90% 30%,rgba(201,169,110,.06),transparent)}
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
        .compare-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .compare-table th{padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .compare-table th:first-child{background:#0c1f15;color:#f4f0e6}
        .compare-table th:nth-child(2){background:#1c4a35;color:#c9a96e}
        .compare-table th:nth-child(3){background:#1a1a2e;color:#c9a96e}
        .compare-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7);vertical-align:top}
        .compare-table td:nth-child(2){background:rgba(28,74,53,.03)}
        .compare-table td:nth-child(3){background:rgba(26,26,46,.02)}
        .compare-table tr:last-child td{border-bottom:none}
        .pt-win{color:#1c4a35;font-weight:600}
        .es-win{color:#2d4a7a;font-weight:600}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .verdict-grid{display:grid;gap:20px;margin:28px 0}
        .verdict-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:28px;display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start}
        .verdict-badge{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;padding:4px 10px;white-space:nowrap}
        .badge-pt{background:#1c4a35;color:#c9a96e}
        .badge-es{background:#1a1a2e;color:#c9a96e}
        .badge-tie{background:#c9a96e;color:#0c1f15}
        .verdict-content{}
        .verdict-profile{font-family:var(--font-jost),sans-serif;font-weight:600;font-size:.85rem;letter-spacing:.04em;color:#0e0e0d;margin-bottom:8px}
        .verdict-reason{font-size:.82rem;line-height:1.78;color:rgba(14,14,13,.6)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.verdict-card{grid-template-columns:1fr}.compare-table{font-size:.75rem}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → portugal-vs-spain-tax-residency-2026
          </div>
          <div className="art-cat">Tax Residency · HNWI</div>
          <h1 className="art-h1">Portugal vs Spain<br />for Tax Residency in 2026:<br /><em>The Definitive Comparison</em></h1>
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
          Both Portugal and Spain compete aggressively for international tax residents — and both have compelling
          offers. Portugal&apos;s IFICI+ regime taxes qualifying income at a flat 20% for 10 years, with
          foreign-source dividends and capital gains often fully exempt. Spain&apos;s Beckham Law charges 24%
          flat for up to 10 years on Spanish-source income. The difference seems minor until you model it over
          a decade with a multi-million portfolio. This is the complete, unsanitised comparison — with a clear
          verdict for each expat profile.
        </p>

        <div className="callout">
          <p><strong>Executive summary:</strong> Portugal wins on tax efficiency, safety, property value, and cost of living. Spain wins on city infrastructure, international school density, and business network size. Neither is objectively &quot;better&quot; — the right choice depends entirely on your profile and priorities.</p>
        </div>

        <h2 className="s">Tax Regime Head-to-Head</h2>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Tax Dimension</th>
              <th>Portugal — IFICI+</th>
              <th>Spain — Beckham Law</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Flat rate</td>
              <td className="pt-win">20%</td>
              <td>24% (up to €600K) · 47% above</td>
            </tr>
            <tr>
              <td>Duration</td>
              <td>10 years</td>
              <td className="es-win">10 years (recently extended)</td>
            </tr>
            <tr>
              <td>Foreign dividends</td>
              <td className="pt-win">Often exempt (treaty dependent)</td>
              <td>Taxed at Spanish rates</td>
            </tr>
            <tr>
              <td>Foreign capital gains</td>
              <td className="pt-win">Often exempt (treaty dependent)</td>
              <td>Taxed in Spain</td>
            </tr>
            <tr>
              <td>Foreign rental income</td>
              <td className="pt-win">Often exempt</td>
              <td>Taxed in Spain</td>
            </tr>
            <tr>
              <td>Pensions from abroad</td>
              <td>10% (since 2024 reform)</td>
              <td>Taxed at standard Spanish rates</td>
            </tr>
            <tr>
              <td>Wealth tax</td>
              <td className="pt-win">None</td>
              <td>Solidarity Tax on wealth (2023–): up to 3.5%</td>
            </tr>
            <tr>
              <td>Eligibility</td>
              <td>Not tax resident in PT last 5 years</td>
              <td>Not tax resident in ES last 10 years</td>
            </tr>
          </tbody>
        </table>

        <p className="t">
          The practical difference for a high-net-worth individual with €500,000 in annual foreign dividend
          income: under IFICI+ (Portugal), this income may be fully exempt — €0 tax. Under the Beckham Law
          (Spain), it is taxed at Spanish personal income tax rates — potentially €150,000–€200,000 annually.
          Over 10 years: a €1.5M–€2M difference, before considering property acquisition costs and wealth tax.
        </p>

        <h2 className="s">Property Costs: Portugal vs Spain</h2>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Portugal Price Range</th>
              <th>Spain Equivalent</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Capital prime</td><td>Lisbon €5,000–10,000/m²</td><td>Madrid €6,000–12,000/m²</td></tr>
            <tr><td>Coastal premium</td><td>Cascais €4,713/m²</td><td>Barcelona coast €6,500/m²</td></tr>
            <tr><td>Luxury resort</td><td>Algarve Golden Triangle €5,000–9,000/m²</td><td>Marbella Golden Mile €7,000–15,000/m²</td></tr>
            <tr><td>Second cities</td><td>Porto €3,643/m²</td><td>Valencia €2,800/m² · Seville €2,600/m²</td></tr>
            <tr><td>Purchase taxes</td><td className="pt-win">IMT 6–7.5% + Stamp 0.8%</td><td>ITP 6–10% (varies by region)</td></tr>
            <tr><td>Annual property tax</td><td className="pt-win">IMI 0.3–0.45% of cadastral value</td><td>IBI 0.4–1.1% of cadastral value</td></tr>
          </tbody>
        </table>

        <h2 className="s">Lifestyle and Quality of Life Comparison</h2>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Portugal</th>
              <th>Spain</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Global Peace Index 2025</td>
              <td className="pt-win">#4 (safest countries in world)</td>
              <td>#30</td>
            </tr>
            <tr>
              <td>Cost of living vs Western Europe</td>
              <td className="pt-win">15–20% below Spain equivalent</td>
              <td>Reference benchmark</td>
            </tr>
            <tr>
              <td>Climate</td>
              <td>300+ sunshine days (Algarve/Lisbon)</td>
              <td>300+ sunshine days (Costa del Sol/BCN)</td>
            </tr>
            <tr>
              <td>Private healthcare</td>
              <td>~€250/month (full coverage)</td>
              <td>~€300/month (full coverage)</td>
            </tr>
            <tr>
              <td>English penetration</td>
              <td>High in Lisbon, Porto, Algarve, expat areas</td>
              <td className="es-win">Higher in Barcelona; lower in Madrid</td>
            </tr>
            <tr>
              <td>Language barrier</td>
              <td>Portuguese — more isolating for monolinguals</td>
              <td className="es-win">Spanish — globally more useful</td>
            </tr>
            <tr>
              <td>International schools (primary)</td>
              <td>15+ in Lisbon area, 8+ in Cascais/Sintra</td>
              <td className="es-win">40+ Madrid, 25+ Barcelona</td>
            </tr>
            <tr>
              <td>Digital nomad infrastructure</td>
              <td className="pt-win">Top 3 globally (Nomad List 2025)</td>
              <td>Top 10 (Barcelona strong)</td>
            </tr>
          </tbody>
        </table>

        <h2 className="s">Verdict by Profile</h2>
        <div className="verdict-grid">
          {VERDICTS.map(v => (
            <div key={v.profile} className="verdict-card">
              <div>
                <span className={`verdict-badge ${v.winner === 'Portugal' ? 'badge-pt' : v.winner === 'Spain (Madrid/Barcelona)' ? 'badge-es' : 'badge-tie'}`}>
                  {v.winner}
                </span>
              </div>
              <div className="verdict-content">
                <div className="verdict-profile">{v.profile}</div>
                <p className="verdict-reason">{v.reason}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="s">The Bottom Line</h2>
        <p className="t">
          For the majority of internationally mobile individuals — retirees, passive income recipients, tech
          professionals, and HNWI wealth preservers — Portugal offers a structurally superior proposition
          in 2026. The IFICI+ tax advantage over the Beckham Law is not marginal; for someone with significant
          foreign-source income, it can be worth €1M+ over the 10-year regime period. Combined with Portugal&apos;s
          position as the fourth safest country in the world, property prices that are 20–40% below comparable
          Spanish markets, and a lower cost of living, the calculus is clear for most profiles.
        </p>
        <p className="t">
          Spain wins for families who need a denser international school ecosystem (Madrid/Barcelona) and for
          finance professionals who need proximity to the larger Iberian corporate network. Both are exceptional
          countries — but they are not interchangeable, and the choice deserves a proper analysis rather than
          defaulting to the more familiar brand.
        </p>

        <div className="cta-box">
          <h3>Portugal specialists — for buyers choosing where to land</h3>
          <p>Agency Group (AMI 22506) works with international buyers from pre-decision research through property acquisition and fiscal setup. Bilingual team, off-market access, full transaction support.</p>
          <a href="tel:+351919948986">+351 919 948 986 · Speak with a Portugal Specialist</a>
        </div>

        <p className="t" style={{ fontSize: '.78rem', color: 'rgba(14,14,13,.4)', marginTop: '24px' }}>
          Agency Group · AMI 22506 · info@agencygroup.pt · www.agencygroup.pt · +351 919 948 986
        </p>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/nhr-portugal-2026-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>IFICI Tax Guide</Link>
            <Link href="/blog/portugal-vs-spain-property-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>PT vs ES Property</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
