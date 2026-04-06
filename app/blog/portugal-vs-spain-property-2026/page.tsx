import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Portugal vs Spain: Property Investment in 2026',
  description: 'Portugal vs Spain property investment comparison 2026. Prices, taxes, NHR vs Beckham Law, rental yields, Golden Visa, quality of life. Clear verdict for international buyers. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/portugal-vs-spain-property-2026',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/portugal-vs-spain-property-2026',
      'pt': 'https://www.agencygroup.pt/blog/mercado-imoveis-porto-2026',
      'x-default': 'https://www.agencygroup.pt/blog/portugal-vs-spain-property-2026',
    },
  },
  openGraph: {
    title: 'Portugal vs Spain: Which Country for Property Investment in 2026?',
    description: 'Direct comparison: Lisbon vs Barcelona vs Madrid. Prices, taxes, NHR vs Beckham Law, yields. Portugal wins 7 of 10 criteria for €500K–€5M international buyers.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/portugal-vs-spain-property-2026',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Portugal vs Spain: Which Country for Property Investment in 2026?',
  description: 'Direct comparison: Portugal vs Spain property investment. Prices, taxes, yields, quality of life. Verdict for international buyers.',
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
  url: 'https://www.agencygroup.pt/blog/portugal-vs-spain-property-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Portugal vs Spain property' },
    { '@type': 'Thing', name: 'Buy property Portugal or Spain' },
    { '@type': 'Thing', name: 'Lisbon vs Barcelona property comparison' },
    { '@type': 'Thing', name: 'NHR vs Beckham Law' },
  ],
}

export default function ArticlePortugalVsSpain() {
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
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .cost-table tr:last-child td{border-bottom:none;font-weight:600;color:#1c4a35;background:rgba(28,74,53,.04)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .verdict-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:28px 0;border:1px solid rgba(14,14,13,.1)}
        .verdict-col{padding:0}
        .verdict-header{background:#1c4a35;color:#c9a96e;padding:16px 24px;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.2em;text-transform:uppercase;text-align:center}
        .verdict-header.es{background:#0c1f15}
        .verdict-item{padding:14px 24px;border-bottom:1px solid rgba(14,14,13,.08);font-size:.82rem;color:rgba(14,14,13,.65);line-height:1.5}
        .verdict-item.win{color:#1c4a35;font-weight:600}
        .verdict-item:last-child{border-bottom:none}
        .score-banner{background:#c9a96e;padding:24px 32px;margin:32px 0;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .score-banner .score{font-family:var(--font-cormorant),serif;font-size:3rem;font-weight:300;color:#0c1f15;line-height:1}
        .score-banner .label{font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(12,31,21,.65)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.verdict-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → portugal-vs-spain-property-2026
          </div>
          <div className="art-cat">Market Analysis</div>
          <h1 className="art-h1">Portugal vs Spain:<br /><em>Which Country for Property Investment in 2026?</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>April 2026</span>
            <span>·</span>
            <span>12 min read</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          For international buyers with €500,000–€5,000,000 to invest in Southern Europe, Portugal and Spain are
          the two dominant options. Both are EU members with excellent climate, strong expat communities, and
          well-developed real estate markets. But they are not equivalent. On 10 key criteria — price, tax, yield,
          Golden Visa, crime, healthcare, education, cost of living, Airbnb regulation, and market liquidity —
          Portugal wins 7 of 10 for the typical international buyer profile. Here is the data behind that verdict.
        </p>

        <h2 className="s">1. Property Prices: The Direct Comparison</h2>
        <p className="t">
          The most important immediate finding: Lisbon is significantly cheaper than Barcelona and Madrid for
          equivalent prime real estate. This price gap is narrowing — Lisbon has risen faster — but it persists
          and represents genuine value for quality-adjusted comparison.
        </p>
        <table className="cost-table">
          <thead><tr><th>City / Zone</th><th>Prime Price €/m²</th><th>5-Year Growth</th><th>Market Size</th></tr></thead>
          <tbody>
            <tr><td>Lisbon (Chiado, Príncipe Real)</td><td>€7,000–€12,000</td><td>+82%</td><td>Boutique</td></tr>
            <tr><td>Cascais / Sintra line</td><td>€4,200–€7,500</td><td>+68%</td><td>Medium</td></tr>
            <tr><td>Algarve Golden Triangle</td><td>€5,000–€8,000</td><td>+71%</td><td>Medium</td></tr>
            <tr><td>Barcelona (Eixample, Gràcia)</td><td>€5,500–€9,000</td><td>+45%</td><td>Large</td></tr>
            <tr><td>Madrid (Salamanca, Retiro)</td><td>€6,000–€10,000</td><td>+52%</td><td>Large</td></tr>
            <tr><td>Costa del Sol (Marbella)</td><td>€4,000–€10,000</td><td>+58%</td><td>Large</td></tr>
            <tr><td>Ibiza prime</td><td>€8,000–€18,000</td><td>+61%</td><td>Small</td></tr>
          </tbody>
        </table>
        <p className="t">
          Lisbon&apos;s prime market remains 20–35% cheaper than comparable Barcelona or Madrid stock, at higher
          recent growth rates. For buyers seeking maximum appreciation potential from a lower entry point,
          Portugal wins on price.
        </p>

        <h2 className="s">2. Taxation: NHR/IFICI vs Beckham Law</h2>
        <p className="t">
          Both Portugal and Spain offer preferential tax regimes for new residents. The comparison is important:
        </p>
        <table className="cost-table">
          <thead><tr><th>Parameter</th><th>Portugal — IFICI</th><th>Spain — Beckham Law</th></tr></thead>
          <tbody>
            <tr><td>Regime name</td><td>IFICI (ex-NHR)</td><td>Régimen de Impatriados (Art. 93 LIRPF)</td></tr>
            <tr><td>Duration</td><td>10 years</td><td>6 years</td></tr>
            <tr><td>Flat tax rate</td><td>20% (qualifying income)</td><td>24% (up to €600K) / 47% above</td></tr>
            <tr><td>Foreign income exemption</td><td>Partial to full (treaty-dependent)</td><td>Generally not exempt</td></tr>
            <tr><td>Eligibility lock-out</td><td>Not resident for 5 years</td><td>Not resident for 5 years</td></tr>
            <tr><td>Eligible professions</td><td>Broad (researchers, innovators, HNWI)</td><td>Employees with Spanish income</td></tr>
            <tr><td>Wealth tax</td><td>None nationally (some municipalities)</td><td>0.2–3.5% on global wealth &gt;€700K</td></tr>
            <tr><td>Inheritance tax</td><td>0% for direct family</td><td>0–34% (varies by region)</td></tr>
          </tbody>
        </table>
        <p className="t">
          Portugal&apos;s IFICI wins clearly on duration (10 vs 6 years), foreign income treatment, and Spain&apos;s
          wealth tax (which can represent €15,000–€300,000 annually for high-net-worth individuals). For
          passive income earners — investors, retirees, remote workers — Portugal&apos;s regime is structurally
          superior. For employed executives with a Spanish contract, the Beckham Law may be more accessible.
        </p>

        <div className="callout">
          <p><strong>Key Difference — Wealth Tax:</strong> Spain levies a wealth tax on global assets above €700,000 (in most regions), at rates up to 3.5%. For a buyer with a €5M asset portfolio, this is €70,000–€175,000 per year in additional tax. Portugal has no equivalent national wealth tax. <strong>This single factor can tip the entire investment calculus.</strong></p>
        </div>

        <h2 className="s">3. Golden Visa: Both Ended, But Differently</h2>
        <p className="t">
          Portugal ended its Golden Visa for residential real estate in October 2023. Spain announced the end of
          its Golden Visa programme in April 2025. Both routes are now closed for property-based residency permits.
          For buyers whose primary objective was a Golden Visa, neither country currently offers this option through
          residential real estate — the decision must therefore be made on pure property and lifestyle merits.
        </p>
        <p className="t">
          Both Portugal and Spain offer residency through the D7 (passive income) visa and Digital Nomad visa
          routes, which remain active and accessible for buyers who intend to establish genuine residency.
          These routes are more valuable than the Golden Visa for buyers who actually want to live in the country.
        </p>

        <h2 className="s">4. The 10-Criteria Verdict</h2>

        <div className="verdict-grid">
          <div className="verdict-col">
            <div className="verdict-header">Portugal</div>
            <div className="verdict-item win">Price value (vs equivalents): Portugal</div>
            <div className="verdict-item win">Tax regime quality (IFICI 10yr): Portugal</div>
            <div className="verdict-item win">Wealth tax (zero): Portugal</div>
            <div className="verdict-item win">Inheritance tax (0% direct family): Portugal</div>
            <div className="verdict-item win">Cost of living: Portugal</div>
            <div className="verdict-item win">Crime rate (lower): Portugal</div>
            <div className="verdict-item win">Expat integration (English spoken widely): Portugal</div>
            <div className="verdict-item">Market size and liquidity: Spain</div>
            <div className="verdict-item">Short-term rental regulation: Depends on zone</div>
            <div className="verdict-item">Healthcare infrastructure: Tie</div>
          </div>
          <div className="verdict-col">
            <div className="verdict-header es">Spain</div>
            <div className="verdict-item">Price value: Spain loses (higher prices)</div>
            <div className="verdict-item">Tax regime: Spain loses (Beckham 6yr, wealth tax)</div>
            <div className="verdict-item">Wealth tax: Spain loses (up to 3.5% on global assets)</div>
            <div className="verdict-item">Inheritance tax: Spain loses (up to 34%)</div>
            <div className="verdict-item">Cost of living: Spain loses (10–20% higher)</div>
            <div className="verdict-item">Crime rate: Spain loses (particularly urban theft)</div>
            <div className="verdict-item">Language barrier: Spain loses (English less universal)</div>
            <div className="verdict-item win">Market size and liquidity: Spain wins</div>
            <div className="verdict-item">Short-term rental: Zone-dependent</div>
            <div className="verdict-item">Healthcare: Comparable public system</div>
          </div>
        </div>

        <div className="score-banner">
          <div>
            <div className="score">7 / 10</div>
            <div className="label">Criteria won by Portugal</div>
          </div>
          <p style={{ fontSize: '.85rem', color: 'rgba(12,31,21,.7)', maxWidth: '420px', lineHeight: '1.7' }}>
            For international buyers in the €500K–€5M range, Portugal outperforms Spain on 7 of 10 key investment criteria. The decisive advantages: lower entry prices, superior tax regime (IFICI vs Beckham Law), zero wealth tax, zero inheritance tax for direct family, lower cost of living, and lower crime.
          </p>
        </div>

        <h2 className="s">5. Where Spain Wins</h2>
        <p className="t">
          Intellectual honesty requires acknowledging Spain&apos;s genuine advantages. The Spanish real estate market
          is approximately 5x larger than Portugal&apos;s — more properties, more liquidity, shorter average time-on-market
          in major cities, and more comparable transaction data. For investors who prioritise liquidity above all
          else, Spain&apos;s depth is a real advantage.
        </p>
        <p className="t">
          Specific zones where Spain clearly wins: the Costa Brava (stunning scenery, proximity to Barcelona,
          lower prices than Marbella), the Balearic Islands (Mallorca and Menorca offer authentic experiences
          at lower prices than Ibiza), and Valencia (city apartment yields of 6–7.5% are among the best in
          Southern Europe). For buyers who specifically want urban Barcelona or Madrid — with their world-class
          cultural infrastructure — Spain is the only choice.
        </p>
        <p className="t">
          Short-term rentals: Spain&apos;s regulation varies dramatically by autonomous community. Catalonia (Barcelona)
          has some of the most restrictive Airbnb rules in Europe. Andalucía (Marbella, Málaga) is more permissive.
          Portugal&apos;s AL (Alojamento Local) regime has tightened in Lisbon but remains functional in the Algarve,
          Madeira, and outside major urban zones. Neither country offers a clear advantage across the board.
        </p>

        <h2 className="s">6. The Lifestyle Comparison</h2>
        <table className="cost-table">
          <thead><tr><th>Factor</th><th>Lisbon</th><th>Barcelona</th><th>Madrid</th></tr></thead>
          <tbody>
            <tr><td>Monthly cost of living (couple)</td><td>€2,500–€3,800</td><td>€3,200–€4,800</td><td>€3,000–€4,500</td></tr>
            <tr><td>Restaurant meal (mid-range, 2)</td><td>€35–€55</td><td>€55–€85</td><td>€50–€80</td></tr>
            <tr><td>English widely spoken</td><td>Yes (very widely)</td><td>Partially</td><td>Less so</td></tr>
            <tr><td>Crime index (Numbeo 2026)</td><td>36 (Low)</td><td>58 (Moderate)</td><td>44 (Low-Moderate)</td></tr>
            <tr><td>International schools</td><td>25+ (growing)</td><td>50+ (established)</td><td>60+ (established)</td></tr>
            <tr><td>Airport international connections</td><td>Excellent (TAP hub)</td><td>Excellent (Iberia hub)</td><td>Excellent (Iberia hub)</td></tr>
            <tr><td>Summer temperature (avg high)</td><td>27°C</td><td>28°C</td><td>33°C</td></tr>
          </tbody>
        </table>

        <h2 className="s">7. Our Verdict for International Buyers</h2>
        <p className="t">
          For buyers with €500,000–€5,000,000 seeking a combination of lifestyle and investment returns,
          Portugal is the superior choice in 2026. The IFICI tax advantage alone can save a high-net-worth
          individual €400,000–€700,000 over 10 years — equivalent to 10–15% of a €5M property purchase.
          The lower entry prices in Lisbon versus comparable Spanish cities mean more property for the same budget.
          And the lower crime rate, more English-friendly environment, and zero inheritance tax create structural
          advantages that compound over time.
        </p>
        <p className="t">
          Spain remains the choice for buyers who specifically want Barcelona or Madrid for cultural and
          professional reasons, for investors prioritising pure market liquidity over everything else, or for
          buyers with a Spanish employment contract who qualify under the Beckham Law. These are legitimate
          cases — but they represent the minority of the international buyer pool.
        </p>
        <p className="t">
          Agency Group operates across both Portugal and Spain (Iberian mandate). Our advisers can structure
          a side-by-side comparison for your specific situation, budget, and objectives — at zero cost to the buyer.
        </p>

        <div className="cta-box">
          <h3>Portugal or Spain? Get a personalised comparison.</h3>
          <p>Agency Group (AMI 22506) operates across Portugal and Spain. Our licensed advisers will analyse your specific situation and give you a direct recommendation — no sales pitch, just data.</p>
          <Link href="/en">Speak to a Property Adviser →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer&apos;s Guide</Link>
            <Link href="/blog/luxury-villas-algarve-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Algarve Guide</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
