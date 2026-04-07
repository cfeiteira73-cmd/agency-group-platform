import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Lisbon vs Porto: Where to Invest in Property 2026',
  description: 'Lisbon vs Porto property investment 2026. Compare prices (€5,000/m² vs €3,643/m²), rental yields, appreciation, neighbourhoods and buyer profiles. Full analysis by Agency Group. AMI 22506.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/lisbon-vs-porto-investment-2026' },
  openGraph: {
    title: 'Lisbon vs Porto: Where to Invest in Portuguese Property in 2026?',
    description: 'Porto yields 5.1% vs Lisbon 4.4%. Lisbon leads appreciation. Full comparison of prices, zones, and buyer profiles for international investors.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/lisbon-vs-porto-investment-2026',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Lisbon vs Porto: Where to Invest in Portuguese Property in 2026?',
  description: 'Full comparison of Lisbon vs Porto property investment 2026. Prices, yields, appreciation, buyer profiles.',
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
  url: 'https://www.agencygroup.pt/blog/lisbon-vs-porto-investment-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Lisbon vs Porto property investment' },
    { '@type': 'Thing', name: 'Buy property Porto vs Lisbon' },
    { '@type': 'Thing', name: 'Portugal property comparison 2026' },
  ],
}

export default function ArticleLisbonVsPorto() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
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
        .vs-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:28px 0}
        .vs-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .vs-city{font-family:var(--font-cormorant),serif;font-size:1.3rem;font-weight:300;color:#1c4a35;margin-bottom:4px}
        .vs-price{font-family:var(--font-dm-mono),monospace;font-size:.75rem;letter-spacing:.1em;color:#c9a96e;margin-bottom:12px}
        .vs-card ul{list-style:none;padding:0}
        .vs-card ul li{font-size:.82rem;line-height:1.75;color:rgba(14,14,13,.65);padding:3px 0;border-bottom:1px solid rgba(14,14,13,.05)}
        .vs-card ul li:last-child{border-bottom:none}
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
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.vs-grid,.step-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
        <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>← Blog</Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → lisbon-vs-porto-investment-2026
          </div>
          <div className="art-cat">Investment Comparison · 2026</div>
          <h1 className="art-h1">Lisbon vs Porto:<br /><em>Where to Invest in 2026?</em></h1>
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
          Portugal&apos;s two great cities offer distinct investment propositions. Lisbon, at €5,000/m², is a global luxury
          benchmark ranking in the top 5 worldwide — higher appreciation, more international liquidity, deeper off-market
          inventory. Porto, at €3,643/m², is the yield champion: 5.1% gross rental returns, +18% YoY price growth, and
          entry prices 28% below Lisbon. Neither answer is universally correct. The right choice depends on your budget,
          investment goal, and lifestyle priorities. This guide gives you the data to decide.
        </p>

        <h2 className="s">1. The Headline Numbers (Q1 2026)</h2>

        <table className="cost-table">
          <thead><tr><th>Metric</th><th>Lisbon</th><th>Porto</th></tr></thead>
          <tbody>
            <tr><td>Average price/m²</td><td>€5,000</td><td>€3,643</td></tr>
            <tr><td>YoY price growth</td><td>+17.6%</td><td>+18.2%</td></tr>
            <tr><td>Gross rental yield (prime)</td><td>4.4%</td><td>5.1%</td></tr>
            <tr><td>Average days on market</td><td>45 days</td><td>65 days</td></tr>
            <tr><td>€300K budget buys</td><td>~60m² (peripheral)</td><td>~82m² (central)</td></tr>
            <tr><td>€500K budget buys</td><td>~100m² (mid-zone)</td><td>~137m² (prime)</td></tr>
            <tr><td>International buyers (€500K+)</td><td>Americans 16%, French 13%</td><td>French 18%, Brazilians 14%</td></tr>
            <tr><td>Global luxury ranking</td><td>Top 5 (Savills 2026)</td><td>Emerging — not yet ranked</td></tr>
          </tbody>
        </table>

        <h2 className="s">2. Lisbon — The Case for the Capital</h2>
        <p className="t">
          Lisbon is a mature luxury market with deep international demand and a globally recognised brand. The combination
          of UNESCO-adjacent heritage architecture, Michelin-starred dining, Atlantic beaches within 30 minutes, and the
          IFICI tax regime makes it the default choice for HNWI buyers relocating from the US, UK, or the Middle East.
        </p>

        <h3 className="ss">Lisbon Prime Neighbourhoods</h3>
        <div className="vs-grid">
          <div className="vs-card">
            <div className="vs-city">Chiado / Príncipe Real</div>
            <div className="vs-price">€7,000–€10,000/m²</div>
            <ul>
              <li>Most desirable addresses globally</li>
              <li>Luxury retail, Michelin restaurants</li>
              <li>Strong demand from Americans & French</li>
              <li>Very limited inventory — 45-day avg sale</li>
            </ul>
          </div>
          <div className="vs-card">
            <div className="vs-city">Parque das Nações</div>
            <div className="vs-price">€4,800–€6,500/m²</div>
            <ul>
              <li>Modern waterfront — marina & convention centre</li>
              <li>Best yield in Lisbon: 5.1%</li>
              <li>Corporate & tech executive demand</li>
              <li>Largest new supply pipeline in Lisbon</li>
            </ul>
          </div>
          <div className="vs-card">
            <div className="vs-city">Baixa / Alfama</div>
            <div className="vs-price">€5,500–€7,500/m²</div>
            <ul>
              <li>Historic core, UNESCO buffer zone</li>
              <li>Top AL (short-term rental) performance</li>
              <li>Renovation potential — historic buildings</li>
              <li>High tourist concentration, limited parking</li>
            </ul>
          </div>
          <div className="vs-card">
            <div className="vs-city">Estrela / Santos</div>
            <div className="vs-price">€5,800–€8,000/m²</div>
            <ul>
              <li>Residential elegance, embassy district</li>
              <li>Large apartments & townhouses with gardens</li>
              <li>British and German buyer preference</li>
              <li>Slower appreciation vs Chiado</li>
            </ul>
          </div>
        </div>

        <h2 className="s">3. Porto — The Case for the North</h2>
        <p className="t">
          Porto is where yield-focused investors are winning in 2026. The city&apos;s transformation over the past decade —
          from industrial port to cultural capital and digital nomad hub — is structurally similar to Lisbon&apos;s trajectory
          of 2012–2018. Buyers entering Porto today are capturing a market still 28% below Lisbon&apos;s absolute price levels
          but appreciating at virtually the same rate.
        </p>

        <h3 className="ss">Porto Prime Neighbourhoods</h3>
        <div className="vs-grid">
          <div className="vs-card">
            <div className="vs-city">Foz do Douro</div>
            <div className="vs-price">€4,500–€6,500/m²</div>
            <ul>
              <li>Porto&apos;s most prestigious address</li>
              <li>Ocean frontage, Atlantic boulevard</li>
              <li>Villas and luxury apartments</li>
              <li>Attracts Porto&apos;s equivalent of Lisbon HNWI</li>
            </ul>
          </div>
          <div className="vs-card">
            <div className="vs-city">Bonfim / Cedofeita</div>
            <div className="vs-price">€3,200–€4,500/m²</div>
            <ul>
              <li>Creative district — highest YoY appreciation</li>
              <li>Young professional & digital nomad demand</li>
              <li>Best AL yield in Porto: 5.8–6.5%</li>
              <li>Significant renovation inventory</li>
            </ul>
          </div>
          <div className="vs-card">
            <div className="vs-city">Miragaia / Ribeira</div>
            <div className="vs-price">€3,800–€5,500/m²</div>
            <ul>
              <li>Douro riverside — UNESCO World Heritage</li>
              <li>Tourism concentration, wine culture</li>
              <li>Strong short-term rental performance</li>
              <li>Limited supply, heritage constraints</li>
            </ul>
          </div>
          <div className="vs-card">
            <div className="vs-city">Baixa / Bolhão</div>
            <div className="vs-price">€3,000–€4,200/m²</div>
            <ul>
              <li>City centre regeneration zone</li>
              <li>Best entry-price prime location in Portugal</li>
              <li>French and Brazilian buyer preference</li>
              <li>Improving infrastructure, metro access</li>
            </ul>
          </div>
        </div>

        <h2 className="s">4. The Verdict — Which City Wins for Your Goal?</h2>

        <div className="step-grid">
          {[
            { n: 'YIELD', t: 'Porto Wins', d: '5.1% gross yield vs 4.4% in Lisbon. Bonfim and Cedofeita achieve 5.8–6.5% on well-managed AL properties. Porto is the clear choice if income return is the primary objective.' },
            { n: 'GROWTH', t: 'Lisbon Leads', d: 'Prime Lisbon (Chiado, Príncipe Real) has delivered +22–24% YoY in 2025. Porto at +18% is strong but has less international demand depth. Lisbon premium assets are more globally liquid.' },
            { n: 'ENTRY', t: 'Porto Wins', d: '€300K buys a premium apartment in Porto\'s centre. The same budget gets a peripheral Lisbon property with limited upside. For buyers under €500K, Porto offers dramatically better buying power.' },
            { n: 'LIFESTYLE', t: 'Depends', d: 'Lisbon: cosmopolitan, warm, beaches, international schools. Porto: authentic, cultural, Atlantic coast, less crowded. HNWI lifestyle buyers increasingly choose Porto for quality of life per euro.' },
            { n: 'LIQUIDITY', t: 'Lisbon Wins', d: '45 days on market vs 65 for Porto. Lisbon\'s larger international buyer pool means easier exit at peak valuations. Critical for investors with a defined 3–5 year horizon.' },
            { n: 'VERDICT', t: 'Split Portfolio', d: 'Optimal strategy for a €1M budget: €600K Lisbon (capital appreciation anchor) + €400K Porto (yield generator). Diversification across both cities optimises risk-adjusted returns.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n" style={{ fontSize: '1.2rem', letterSpacing: '.04em', color: '#1c4a35' }}>{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="callout">
          <p><strong>Agency Group Operates in Both Cities:</strong> We have active inventory and buyer representation in Lisbon, Cascais, and Porto. Our Deal Radar system analyses 16 variables to identify optimal entry points in each market. Whether you&apos;re choosing one city or building a diversified Portuguese portfolio, we provide the data-driven advisory to make it work.</p>
        </div>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f4f0e6', border: '1px solid rgba(28,74,53,.15)', borderRadius: '4px' }}>
          <p style={{ fontSize: '.85rem', color: '#1c4a35', fontWeight: '600', marginBottom: '.75rem' }}>
            Explore properties in Lisbon and Porto:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            <a href="/zonas/lisboa" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Lisbon zone →</a>
            <a href="/zonas/porto" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Porto zone →</a>
            <a href="/imoveis" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>View all properties →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Lisbon, Porto, or both — we help you decide.</h3>
          <p>Free automated valuation, off-market access, and bilingual advisory. No cost to the buyer. AMI 22506 · +351 919 948 986 · www.agencygroup.pt</p>
          <Link href="/imoveis">Explore Available Properties →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/blog/luxury-property-lisbon" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Luxury Lisbon</Link>
            <Link href="/blog/mercado-imoveis-porto-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Porto Market</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
