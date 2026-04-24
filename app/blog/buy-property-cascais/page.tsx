import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Buy Property in Cascais 2026: Prices, Zones & Expat Guide',
  description: 'Complete guide to buying property in Cascais 2026. Quinta da Marinha, Estoril, Birre prices. International schools, golf, expat community. Villas €1.5M–€8M. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/buy-property-cascais',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/buy-property-cascais',
      'pt': 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
      'fr': 'https://www.agencygroup.pt/blog/acheter-appartement-lisbonne-guide',
      'x-default': 'https://www.agencygroup.pt/blog/buy-property-cascais',
    },
  },
  openGraph: {
    title: 'Buy Property in Cascais 2026: Prices, Zones & Expat Guide',
    description: 'Cascais €4,713/m² average. Quinta da Marinha to Estoril. International schools, golf, marina. 20 min from Lisbon. Complete buyer guide.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/buy-property-cascais',
    locale: 'en_US',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Buy%20Property%20in%20Cascais%202026%3A%20Prices%2C%20Zones%20%26%20Expat%20Guide&subtitle=Cascais%20%E2%82%AC4%2C713%2Fm%C2%B2%20average.%20Quinta%20da%20Marinha%20to%20Estoril',
      width: 1200,
      height: 630,
      alt: 'Buy Property in Cascais 2026: Prices, Zones & Expat Guide',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy Property in Cascais 2026: Prices, Zones & Expat Guide',
    description: 'Cascais €4,713/m² average. Quinta da Marinha to Estoril. International schools, golf, marina. 20 min',
    images: ['https://www.agencygroup.pt/api/og?title=Buy%20Property%20in%20Cascais%202026%3A%20Prices%2C%20Zones%20%26%20Expat%20Guide&subtitle=Cascais%20%E2%82%AC4%2C713%2Fm%C2%B2%20average.%20Quinta%20da%20Marinha%20to%20Estoril'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Buy Property in Cascais 2026: Prices, Zones & Expat Guide',
  description: 'Complete guide to buying property in Cascais. Quinta da Marinha, Estoril, Birre. International schools, golf, expat community.',
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
  url: 'https://www.agencygroup.pt/blog/buy-property-cascais',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Buy property Cascais' },
    { '@type': 'Thing', name: 'Cascais real estate 2026' },
    { '@type': 'Thing', name: 'Estoril property' },
  ],
}

export default function ArticleBuyPropertyCascais() {
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
        <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>← Blog</Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → buy-property-cascais
          </div>
          <div className="art-cat">Location Guide</div>
          <h1 className="art-h1">Buy Property in Cascais 2026:<br /><em>Prices, Zones &amp; Expat Guide</em></h1>
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
          Cascais is the premier expat destination on the Portuguese Riviera — 20 minutes from Lisbon by train,
          fronting the Atlantic Ocean, with four world-class golf courses, a working marina, international schools,
          and one of the largest English-speaking communities in Continental Europe. With a market average of €4,713/m²
          (2026) and prime addresses reaching €8,000–€10,000/m², Cascais occupies a unique position: accessible luxury
          within commuting distance of the capital. This guide covers every zone, every school, every price data point,
          and the full buying process for international buyers.
        </p>

        <h2 className="s">1. Why Cascais — The Key Advantages</h2>
        <p className="t">
          Cascais has been an aristocratic retreat since King Luís I established his summer palace here in 1870.
          That heritage — elegant palaces, tree-lined boulevards, a pristine historic centre — gives the town a
          character that purely modern resort developments cannot replicate. Yet Cascais is fully functional as
          a primary residence: excellent hospitals, international restaurants, high-speed internet, and Lisbon
          airport reachable in 30 minutes.
        </p>
        <p className="t">
          For families, the concentration of international schools is unmatched in Portugal outside Lisbon itself.
          For golf enthusiasts, Oitavos Dunes (ranked in World Top 100), Quinta da Marinha, Penha Longa, and CCC
          are all within 15 minutes. For those seeking investment returns, the short-term rental market on the
          Linha de Cascais generates some of the strongest AL yields in Portugal — 6–8% gross in peak season zones.
        </p>

        <div className="callout">
          <p><strong>Cascais 2026 Key Stats:</strong> Average price €4,713/m² · Quinta da Marinha prime €6,500–€10,000/m² · Estoril €4,200–€7,500/m² · 12,000+ British residents · 4 World-class golf courses · 87-day average time-on-market for luxury villas · Largest British expat community in Portugal.</p>
        </div>

        <h2 className="s">2. Zones and Price Guide</h2>
        <p className="t">
          The Cascais market is highly segmented. The right zone depends on your lifestyle priorities: proximity to
          the beach, the golf courses, the international schools, or the train connection to Lisbon. Here is a
          comprehensive breakdown:
        </p>

        <table className="cost-table">
          <thead><tr><th>Zone</th><th>Price Range / m²</th><th>Best For</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Quinta da Marinha</td><td>€6,500–€10,000</td><td>HNWI families, golf lifestyle</td><td>Gated community, golf club, spa, 5-star hotel. Most exclusive address in Cascais.</td></tr>
            <tr><td>Cascais Centro / Village</td><td>€5,500–€8,000</td><td>Walkability seekers, couples, investors</td><td>Historic centre, restaurants, marina. Best short-term rental yields. Limited supply.</td></tr>
            <tr><td>Estoril</td><td>€4,200–€7,500</td><td>Classic luxury, families</td><td>Casino, Grand Prix circuit, elegant villas. Quieter than Cascais centre.</td></tr>
            <tr><td>Birre / Areia</td><td>€3,800–€5,500</td><td>Families seeking space</td><td>Larger plots, more affordable. 5–10 min drive from beach and schools.</td></tr>
            <tr><td>Alcabideche / Malveira</td><td>€2,800–€3,800</td><td>Value buyers, first purchase</td><td>Inland. Access to Cascais by car. Larger homes at lower prices per m².</td></tr>
            <tr><td>Parede / São João</td><td>€3,200–€4,800</td><td>Beach proximity, commuters</td><td>On the Linha de Cascais train. Good beaches. 15–18 min to Lisbon Cais do Sodré.</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. International Schools in Cascais</h2>
        <p className="t">
          The quality and concentration of international schools in the Cascais municipality is a primary driver for
          family buyers. Portugal&apos;s school system is solid, but international families overwhelmingly prefer
          English-medium education that maintains home-country curriculum continuity.
        </p>

        <div className="loc-grid">
          {[
            { name: "St. Julian's School", price: 'Ages 3–18 · IB + IGCSE', desc: 'Estrada de Janes, Carcavelos. Founded 1932. One of Portugal\'s most prestigious international schools. English-medium. Competitive admissions. Fees €8,000–€15,000/year.' },
            { name: 'TASIS Portugal', price: 'Ages 3–18 · IB · American', desc: 'Quinta da Beloura, Sintra (10 min from Cascais). American curriculum + IB. Boarding available. Large US expatriate community. Fees €12,000–€22,000/year.' },
            { name: 'CAISL', price: 'Ages 4–18 · AP + American', desc: 'Cascais International Academy. American curriculum. Smaller community. Strong pastoral care. Good fit for American families. Fees €10,000–€18,000/year.' },
            { name: 'Deutsche Schule', price: 'Ages 3–18 · German curriculum', desc: 'German school Cascais. Bilingual (DE/PT). Excellent academic results. Popular with German and Austrian expat families. Fees €5,000–€9,000/year.' },
            { name: 'Colégio Salesianos', price: 'Ages 5–18 · Portuguese', desc: 'Estoril. Portuguese curriculum with English instruction. Well-regarded locally. Good option for families integrating into Portuguese society. More affordable.' },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Golf Courses on the Linha de Cascais</h2>
        <p className="t">
          For serious golfers, the Cascais area offers a concentration of top courses unmatched in Portugal outside
          the Algarve — and unlike the Algarve, you are within 20 minutes of Lisbon&apos;s business district.
        </p>
        <table className="cost-table">
          <thead><tr><th>Course</th><th>Ranking</th><th>Distance from Cascais</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Oitavos Dunes</td><td>World Top 100 (Golf Digest)</td><td>5 min</td><td>Links course on Sintra-Cascais Natural Park. Member-only + hotel guests.</td></tr>
            <tr><td>Quinta da Marinha</td><td>National Top 10</td><td>8 min</td><td>Robert Trent Jones Jr. design. Integrated with the Oitavos Hotel resort.</td></tr>
            <tr><td>Penha Longa</td><td>National Top 5</td><td>12 min</td><td>Two 18-hole courses. Ritz-Carlton hotel on-site. European Tour Host.</td></tr>
            <tr><td>CCC (Cascais Country Club)</td><td>Regional</td><td>10 min</td><td>Approachable for all levels. Strong expat member community.</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. The International Community</h2>
        <p className="t">
          Cascais hosts the largest British expat community in Continental Portugal — estimated at 12,000+ residents
          in the municipality. The British presence dates to the 19th century, creating a deeply established community
          with its own social infrastructure: St. George&apos;s Anglican Church, British-style pubs, English-language
          bookshops, and cricket grounds.
        </p>
        <p className="t">
          The American community has grown significantly since 2020, driven by remote work and the D7/IFICI regimes.
          Americans now represent approximately 18% of the €1.5M+ buyer segment in Cascais. French buyers (14%) and
          Brazilian buyers (9%) round out the top international buyer groups. The result is a genuinely cosmopolitan
          town where English is the de facto international language and where arriving without Portuguese is
          entirely manageable.
        </p>

        <h2 className="s">6. Property Types and Typical Prices</h2>
        <table className="cost-table">
          <thead><tr><th>Property Type</th><th>Zone</th><th>Typical Price Range</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>T2 apartment</td><td>Cascais centre</td><td>€450,000–€750,000</td><td>Strong AL rental demand. Excellent investment.</td></tr>
            <tr><td>T3 apartment</td><td>Estoril / Parede</td><td>€550,000–€900,000</td><td>Family-sized. Good long-term rental demand.</td></tr>
            <tr><td>Townhouse / moradia</td><td>Birre / Areia</td><td>€800,000–€1,800,000</td><td>Garden + pool common. Popular with British families.</td></tr>
            <tr><td>Villa with pool</td><td>Quinta da Marinha</td><td>€1,500,000–€6,000,000</td><td>Gated estate. 87-day average time on market in 2025.</td></tr>
            <tr><td>Luxury palace / quinta</td><td>Greater Cascais</td><td>€3,000,000–€12,000,000</td><td>Historic estates. Scarce. Often off-market.</td></tr>
          </tbody>
        </table>

        <h2 className="s">7. The Buying Process in Cascais</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Define Budget & Zone', d: 'Cascais offers entry points from €400K (apartments) to €12M+ (palaces). Define whether you prioritise golf access, school proximity, beach, or train connection to Lisbon. Each zone is meaningfully different.' },
            { n: '02', t: 'NIF & Banking', d: 'Get your NIF (Portuguese tax number) before anything else. Open a Portuguese bank account. Both take 1–2 weeks and can be arranged remotely with power of attorney via a local lawyer.' },
            { n: '03', t: 'Legal Due Diligence', d: 'Engage a Portuguese property lawyer (not the seller\'s lawyer). Verify certidão predial, caderneta predial, licença de utilização, condominium accounts, and any heritage or planning restrictions.' },
            { n: '04', t: 'CPCV (Promise Contract)', d: 'Binding preliminary contract with 10–30% deposit. Standard in Cascais: 10–20% for apartments, 20–30% for villas. If seller defaults: deposit returned double. Governs all conditions and timeline.' },
            { n: '05', t: 'IMT & Stamp Duty', d: 'Pay taxes before the final deed. For a €1.5M Cascais villa: IMT ~€112,500 (7.5%) + Stamp Duty €12,000 (0.8%) = ~€124,500. Plus notary €2,000–3,000 and lawyer fees €7,500–15,000.' },
            { n: '06', t: 'Escritura (Deed)', d: 'Sign before a notary in Cascais or Sintra. Funds transferred via IBAN. Keys collected at signing. Property registration at the Conservatória takes 1–3 business days.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">8. Market Outlook — Cascais 2026</h2>
        <p className="t">
          The Cascais market is driven by constrained supply and consistent international demand. The municipality&apos;s
          Plano Director Municipal imposes strict limits on new construction — particularly in the coastal areas and
          within the Sintra-Cascais Natural Park (which covers approximately 40% of the municipality). This means
          that new supply is predominantly rehabilitation of existing buildings, not greenfield development.
        </p>
        <p className="t">
          Villa inventory in Quinta da Marinha and Estoril is extremely limited — at any given time, fewer than 80
          prime villas are actively listed. With demand from 5–6 buyer nationalities and growing awareness of Cascais
          internationally, the supply-demand imbalance is structural. Our 3-year price forecast: +9–13% annually
          for prime Cascais (Quinta da Marinha, Cascais centro, Estoril).
        </p>
        <p className="t">
          For investors, the rental market is equally compelling. Short-term (AL) apartments in Cascais centro
          achieve 75–85% occupancy at €180–€350/night in high season (June–September). Long-term furnished rentals
          to corporate expats command €2,500–€5,000/month for 3-bedroom apartments and €5,000–€12,000/month for villas.
        </p>

        <div className="callout">
          <p><strong>Agency Group in Cascais:</strong> We maintain a dedicated off-market database of Cascais villas and prime apartments. If you are looking for Quinta da Marinha, Estoril, or Cascais centro properties that do not appear on Idealista or ERA, <strong>contact us directly</strong>. Our commission is paid by the seller — buyer representation costs you nothing.</p>
        </div>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f4f0e6', border: '1px solid rgba(28,74,53,.15)', borderRadius: '4px' }}>
          <p style={{ fontSize: '.85rem', color: '#1c4a35', fontWeight: '600', marginBottom: '.75rem' }}>
            Explore Cascais properties:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            <a href="/zonas/cascais" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Cascais zone — available properties →</a>
            <a href="/imoveis?zona=Cascais" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>All Cascais listings →</a>
            <a href="/imoveis" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>View all properties in Portugal →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Looking for property in Cascais?</h3>
          <p>Access off-market villas and apartments. Free automated valuation tool. Direct connection to our Cascais-based team. AMI 22506.</p>
          <Link href="https://www.agencygroup.pt/portal">Explore Cascais Properties →</Link>
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
