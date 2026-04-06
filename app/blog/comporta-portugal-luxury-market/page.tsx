import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comporta Portugal Luxury Real Estate 2026',
  description: 'Comporta property market 2026: prices €4,200–€8,000/m², +22% YoY appreciation, rental yields 4.5–6.2%, traditional palheiros and eco-villas. Complete guide for luxury buyers. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/comporta-portugal-luxury-market',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/comporta-portugal-luxury-market',
    },
  },
  openGraph: {
    title: "Comporta Portugal Luxury Real Estate 2026: Europe's Last Unspoiled Paradise",
    description: 'Why hedge fund managers, family offices and celebrities are buying in Comporta. Prices, areas, investment data, legal restrictions and Agency Group listings.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/comporta-portugal-luxury-market',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "Comporta Portugal Luxury Real Estate 2026: Europe's Last Unspoiled Paradise",
  description: 'Complete guide to Comporta luxury property 2026. Prices €4,200–€8,000/m², key areas, rental yields 4.5–6.2%, legal restrictions, investment case and buying process.',
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
  url: 'https://www.agencygroup.pt/blog/comporta-portugal-luxury-market',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Comporta portugal luxury real estate' },
    { '@type': 'Thing', name: 'Comporta property 2026' },
    { '@type': 'Thing', name: 'Comporta villas for sale' },
  ],
}

export default function ArticleComportaLuxuryMarket() {
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
        .art-breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .art-breadcrumb a:hover{color:#c9a96e}
        .art-cat{display:inline-block;background:#1c4a35;color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.12em;color:rgba(244,240,230,.35)}
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
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
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
        .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:32px 0}
        .stat-card{background:#1c4a35;padding:24px;text-align:center}
        .stat-val{font-family:var(--font-cormorant),serif;font-size:2rem;font-weight:300;color:#c9a96e;line-height:1;margin-bottom:6px}
        .stat-lbl{font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,240,230,.5)}
        .highlight-box{background:rgba(201,169,110,.08);border-left:3px solid #c9a96e;padding:20px 24px;margin:24px 0}
        .highlight-box p{font-size:.88rem;line-height:1.8;color:rgba(14,14,13,.7);margin:0}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.loc-grid,.stat-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → comporta-portugal-luxury-market
          </div>
          <div className="art-cat">Luxury Market</div>
          <h1 className="art-h1">Comporta Portugal Luxury Real Estate 2026:<br /><em>Europe&apos;s Last Unspoiled Paradise</em></h1>
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
          Sixty kilometres south of Lisbon, where rice paddies meet an untouched Atlantic coastline, lies one of
          Europe&apos;s most coveted addresses: Comporta. Protected by law, inaccessible to high-rise development,
          and resolutely resistant to mass tourism, this stretch of the Alentejo coast has quietly become the
          destination of choice for ultra-high-net-worth buyers who have exhausted Ibiza, Saint-Tropez, and the
          Algarve. Prices rose +22% year-on-year in 2025–2026 — the strongest appreciation of any Portuguese
          coastal market. Supply remains structurally constrained. Gross rental yields reach 6.2% during peak
          season. This is what legally enforced scarcity looks like.
        </p>

        <div className="stat-grid">
          {[
            { val: '+22%', lbl: 'YoY Price Growth 2025–2026' },
            { val: '€8,000', lbl: 'Max per m² — Premium Villas' },
            { val: '6.2%', lbl: 'Peak Gross Rental Yield' },
            { val: '60km', lbl: 'Uninterrupted Atlantic Beach' },
          ].map(s => (
            <div key={s.lbl} className="stat-card">
              <div className="stat-val">{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        <h2 className="s">1. What Is Comporta?</h2>
        <p className="t">
          Comporta is a civil parish within the municipality of Alcácer do Sal, in the Setúbal district of the
          Alentejo Litoral. The area encompasses a protected natural reserve — the Reserva Natural do Estuário do
          Sado — and sits within one of the most rigorously controlled land-use zones in Portugal. The coastline
          stretches across approximately 60 kilometres of near-continuous beach, backed by umbrella pine forests,
          cork oak groves, and the storied rice fields that give the landscape its unmistakable pastoral character.
        </p>
        <p className="t">
          The town of Comporta itself is a small village of whitewashed houses, a handful of exceptional restaurants,
          and an unhurried pace entirely at odds with the property values attached to its addresses. Four principal
          beaches — Praia de Comporta, Praia do Carvalhal, Praia de Brejos da Carregueira, and Praia do Pego —
          form the spine of the luxury market. Each has a distinct character, price range, and buyer profile.
        </p>
        <p className="t">
          What differentiates Comporta from every other coastal luxury market in Portugal — or indeed in Europe —
          is the almost total absence of vertical development. The protected status of the natural reserve, combined
          with strict municipal planning rules, means that new construction is either prohibited or severely limited
          in most zones. The existing housing stock is largely composed of traditional Alentejo straw-roofed
          farmhouses called palheiros, converted agricultural buildings, and a limited number of architect-designed
          eco-villas built in harmony with the landscape. There are no hotels above a certain scale. No shopping
          malls. No tower blocks. This is, by design and by law, the last unspoiled paradise on the European
          Atlantic coast.
        </p>

        <div className="callout">
          <p><strong>Protected Status:</strong> The entire Comporta–Galé coastline falls under the Reserva Natural do Estuário do Sado and Rede Natura 2000. New construction permits are tightly controlled. Urban expansion is minimal. This legal scarcity is the single most powerful driver of long-term price appreciation in the Comporta market.</p>
        </div>

        <h2 className="s">2. Price Data: Comporta Property Market 2026</h2>
        <p className="t">
          Comporta property prices span a wide range depending on location, proximity to the beach, architectural
          quality, and plot size. The market broadly divides into three tiers. The figures below are based on
          Agency Group transaction data and market intelligence for the 12 months ending March 2026.
        </p>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Segment</th>
              <th>Price per m²</th>
              <th>Typical Price Range</th>
              <th>Profile</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Entry luxury — Comporta periphery</td>
              <td>€3,800–€4,800</td>
              <td>€800K–€2M</td>
              <td>Renovated palheiro, smaller plots, 3–4 bed</td>
            </tr>
            <tr>
              <td>Core luxury — Carvalhal / Comporta village</td>
              <td>€5,000–€6,500</td>
              <td>€2.8M–€6M</td>
              <td>Architect-designed villas, large plots, pool</td>
            </tr>
            <tr>
              <td>Ultra-premium — Pego / Torre beachfront</td>
              <td>€6,500–€8,000</td>
              <td>€6M–€12M+</td>
              <td>First-line sea views, 5+ bed, estate plots</td>
            </tr>
            <tr>
              <td>Buildable land (serviced, with licence)</td>
              <td>€250–€600 /m² plot</td>
              <td>€500K–€3M</td>
              <td>Extremely scarce — requires specialist search</td>
            </tr>
          </tbody>
        </table>

        <p className="t">
          Year-on-year price growth of +22% in 2025–2026 is the highest of any Portuguese coastal market. For
          context, Lisbon grew +14%, Cascais +12%, and the Algarve Golden Triangle +16% in the same period.
          Comporta is outperforming every comparable market precisely because supply is not growing while demand
          from an increasingly international buyer base continues to intensify.
        </p>

        <div className="highlight-box">
          <p>The median transaction price in Comporta for the 12 months ending March 2026 was €3.4M — nearly seven times the national median of €486K. The market is by definition ultra-premium and shows no structural basis for price correction given the legally enforced supply ceiling.</p>
        </div>

        <h2 className="s">3. Key Areas: Where to Buy in Comporta</h2>
        <p className="t">
          The Comporta market is not monolithic. Each micro-location carries a distinct character, access profile,
          and value proposition. Understanding these differences is essential for any serious buyer.
        </p>

        <div className="loc-grid">
          {[
            {
              name: 'Comporta Village',
              price: '€5,000–€6,800 /m²',
              desc: 'The historic core. Traditional palheiros on narrow sandy lanes. The highest concentration of well-known residents and the most established social scene. Extremely limited supply — authentic conversions command premium prices.',
            },
            {
              name: 'Carvalhal',
              price: '€4,200–€6,000 /m²',
              desc: 'South of the village, nearest to the beach cluster. Mix of original farmhouses and new eco-villas on generous plots. The most active transaction zone. Preferred by buyers seeking space, privacy, and proximity to the water.',
            },
            {
              name: 'Brejos da Carregueira',
              price: '€3,800–€5,200 /m²',
              desc: 'Further south, quieter and more rural. Larger land parcels, more accessible entry prices, strong long-term appreciation potential. Emerging as the next premium tier as Carvalhal approaches full saturation.',
            },
            {
              name: 'Torre',
              price: '€5,500–€7,200 /m²',
              desc: 'North of Comporta, sea-facing. Characterised by larger estate properties and some of the finest architect-designed villas in the region. Buyers here are typically experienced investors or private collectors.',
            },
            {
              name: 'Pego',
              price: '€6,000–€8,000 /m²',
              desc: 'The most exclusive micro-location. Praia do Pego attracts a discreet, affluent clientele. First-line properties here rarely reach the open market. Off-market transactions dominate — network access is essential.',
            },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Why the Ultra-Wealthy Choose Comporta</h2>
        <p className="t">
          Comporta&apos;s appeal to celebrities, hedge fund principals, tech founders, and family offices is not
          accidental — it is structural. The same factors that restrict supply also create the conditions that
          UHNWI buyers actively seek and are willing to pay a significant premium for.
        </p>

        <div className="step-grid">
          {[
            {
              n: '01',
              t: 'Radical Privacy',
              d: 'No large hotels, no package tourism, no intrusive infrastructure. The narrow sand tracks serving many properties actively filter out casual visitors. Privacy at this level is effectively impossible to replicate in any developed European resort.',
            },
            {
              n: '02',
              t: 'Authentic Landscape',
              d: 'Comporta has retained its pre-luxury character in a way that Saint-Tropez, Ibiza, and Mykonos lost decades ago. The rice fields, the storks, the traditional fishing boats on the Sado river estuary — these are the real landscape, not curated aesthetics.',
            },
            {
              n: '03',
              t: 'Lisbon Proximity',
              d: 'One hour by car (or 35 minutes by helicopter) from one of Europe\'s most dynamic capital cities. Private jet access via Lisbon Humberto Delgado. Comporta offers Alentejo remoteness with immediate metropolitan connectivity.',
            },
            {
              n: '04',
              t: 'Legal Scarcity',
              d: 'Protected reserve status and construction moratoriums mean supply cannot expand to meet demand. This is the most reliable long-term price appreciation mechanism in any real estate market: structural, legally enforced scarcity.',
            },
            {
              n: '05',
              t: 'Exceptional Climate',
              d: 'The Alentejo coast receives 300+ days of sunshine annually. The Setúbal peninsula geography moderates temperatures and the sea is warmer than Cascais. Comfortable from March through November — far longer than any northern European coastal market.',
            },
            {
              n: '06',
              t: 'Social Capital',
              d: 'The resident and visitor community includes internationally prominent figures from fashion, media, finance, and technology. For buyers to whom network access and discretion are equally important, Comporta uniquely offers both simultaneously.',
            },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">5. Investment Returns: Rental Yields and Capital Appreciation</h2>
        <p className="t">
          Comporta functions as both a primary and secondary residence market, and increasingly as a pure
          investment vehicle for family offices allocating to real assets. The investment case rests on two
          pillars: rental income during the season, and capital appreciation driven by structurally constrained
          supply.
        </p>

        <h3 className="ss">Rental Yield Data — 2025–2026 Season</h3>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Property Type</th>
              <th>Weekly Rate (Peak)</th>
              <th>Occupancy Jun–Sep</th>
              <th>Gross Annual Yield</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>3-bed palheiro — Comporta village</td>
              <td>€5,000–€7,500</td>
              <td>80–90%</td>
              <td>4.5–5.2%</td>
            </tr>
            <tr>
              <td>4-bed villa — Carvalhal, pool</td>
              <td>€7,500–€11,000</td>
              <td>75–85%</td>
              <td>4.8–5.6%</td>
            </tr>
            <tr>
              <td>5-bed estate villa — Torre / Pego</td>
              <td>€11,000–€15,000</td>
              <td>70–80%</td>
              <td>5.2–6.2%</td>
            </tr>
            <tr>
              <td>Off-season premium lets (Oct–May)</td>
              <td>€2,500–€5,000 /month</td>
              <td>40–60%</td>
              <td>+0.8–1.4% additional</td>
            </tr>
          </tbody>
        </table>

        <p className="t">
          Net yields after management fees (typically 20–25% of gross income for a full-service rental
          programme), IMI, maintenance, and insurance settle in the 3.0–4.5% range — competitive with
          Lisbon prime residential and significantly above Portuguese 10-year government bonds at 3.1%
          as of March 2026.
        </p>
        <p className="t">
          The capital appreciation component is the stronger investment argument. A villa in Carvalhal
          that transacted at €1.8M in 2021 is now valued at approximately €3.2M — a 78% appreciation
          over five years, or roughly 12.4% compound annual growth. These are documented market
          transactions, not projections.
        </p>

        <div className="callout">
          <p><strong>Total Return Estimate (5-year, core villa):</strong> Capital appreciation +22% YoY (2026 run rate) · Gross rental yield 4.5–6.2% · Net yield after costs 3.0–4.5% · Combined total return estimate: <strong>15–20% per annum</strong> for well-selected, well-managed properties. Past performance does not guarantee future results.</p>
        </div>

        <h2 className="s">6. Architecture: Palheiros, Eco-Villas, and the Comporta Aesthetic</h2>
        <p className="t">
          The architectural language of Comporta is unlike anywhere else in Portugal. The traditional palheiro —
          a one-storey farmhouse with a steep pitched roof thatched with straw (palha) from the local rice
          fields — evolved as a practical response to the Alentejo summer heat and the sandy, unstable terrain
          of the coastal dunes. These structures, originally built for agricultural workers, have been
          transformed over the past two decades into some of the most desirable residential properties in
          Europe.
        </p>
        <p className="t">
          A well-restored palheiro maintains the exterior silhouette and traditional materials — whitewashed
          render, timber frames, natural fibre roofing — while the interior is entirely contemporary:
          open-plan living spaces, bespoke joinery, limestone floors, and a restrained material palette that
          references the landscape rather than competing with it. The finest examples have been designed by
          Portuguese architects working within a rigorous environmental brief.
        </p>
        <p className="t">
          Modern new builds in permitted zones follow a strict eco-design ethos. Single-storey, low-profile,
          with large covered terraces, natural swimming pools, kitchen gardens, and solar infrastructure that
          can take properties off-grid during peak season. The planning authority enforces height restrictions
          (typically one storey plus roofline), plot coverage limits (typically 10–15% of land area), and
          material requirements that preserve the visual coherence of the landscape.
        </p>
        <p className="t">
          This architectural control is not a limitation — it is a value driver. The discipline imposed by
          the planning framework ensures that Comporta cannot become overdeveloped, which is the primary
          reason that the properties which do exist hold and grow their value with such consistency.
        </p>

        <h2 className="s">7. Legal Framework: Protected Zones and Construction Limits</h2>
        <p className="t">
          Buying property in Comporta requires specific legal due diligence beyond the standard Portuguese
          property transaction process. The protected reserve status introduces several layers of restriction
          and verification that a qualified property lawyer familiar with Alentejo Litoral regulations must
          navigate on behalf of any serious buyer.
        </p>

        <h3 className="ss">Key Legal Restrictions by Zone</h3>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Restriction Type</th>
              <th>Zone</th>
              <th>Buyer Impact</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rede Natura 2000</td>
              <td>Most of the coastal area</td>
              <td>New construction prohibited; existing structures can be renovated but not expanded beyond original footprint</td>
            </tr>
            <tr>
              <td>RAN (Reserva Agrícola Nacional)</td>
              <td>Rice fields and agricultural land</td>
              <td>No residential construction permitted; fundamental protection of landscape character</td>
            </tr>
            <tr>
              <td>REN (Reserva Ecológica Nacional)</td>
              <td>Dune systems, riparian zones</td>
              <td>Strict prohibition on construction; critical for coastal stability and dune preservation</td>
            </tr>
            <tr>
              <td>POOC (Coastal Planning Ordinance)</td>
              <td>Within 500m of sea</td>
              <td>Regulates access paths, vegetation clearance, and any infrastructure near the coast</td>
            </tr>
            <tr>
              <td>PDM Alcácer do Sal</td>
              <td>All private plots</td>
              <td>Sets height limits (typically 1 floor), coverage ratios (10–15%), and setback distances from boundaries</td>
            </tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Due Diligence Checklist:</strong> Before any Comporta purchase verify: (1) exact legal classification under the PDM, (2) whether the plot sits within RAN, REN, or Rede Natura perimeters, (3) licença de habitação status, (4) any outstanding IMI or AIMI payments, (5) access rights if served by a private track, (6) water and sewage connection status. <strong>Never purchase without a specialist Alentejo Litoral property lawyer.</strong></p>
        </div>

        <p className="t">
          Critically, the legal restrictions are a feature, not a bug, from an investment standpoint. They
          are precisely what prevents the market from being diluted by mass development. A buyer who
          understands that Comporta will never have a four-lane road, a high-rise hotel, or a commercial
          marina is acquiring something fundamentally different from conventional coastal real estate —
          a fixed asset in a legally protected, permanently scarce supply environment.
        </p>

        <h2 className="s">8. Nearby Destinations: The Comporta Ecosystem</h2>
        <p className="t">
          Comporta sits at the centre of an emerging ultra-premium coastal ecosystem. Buyers increasingly
          approach this region as a portfolio of complementary locations rather than a single point on the map.
        </p>

        <div className="loc-grid">
          {[
            {
              name: 'Melides',
              price: '€3,200–€5,500 /m²',
              desc: 'Northern neighbour, 15 minutes away. Currently the fastest-appreciating location in the ecosystem. Aman Melides has catalysed international attention and significant price growth in an area that was largely off the map before 2022.',
            },
            {
              name: 'Grândola',
              price: '€1,800–€3,200 /m²',
              desc: 'The nearest inland town. Administrative centre for the region. Good service infrastructure, access point for the A2 motorway. Lower prices for buyers seeking larger agricultural plots with rural character.',
            },
            {
              name: 'Alcácer do Sal',
              price: '€1,200–€2,400 /m²',
              desc: 'Historic river town on the Sado. Medieval castle, growing boutique hotel scene, exceptional gastronomy. Emerging as a destination in its own right for buyers priced out of the coastal strip.',
            },
            {
              name: 'Tróia Peninsula',
              price: '€2,800–€4,500 /m²',
              desc: '20 minutes north by ferry from Setúbal. More developed resort infrastructure, 18-hole golf course. Different market profile — resort-oriented rather than privacy-focused. Strong summer rental demand.',
            },
            {
              name: 'Carrasqueira',
              price: '€2,400–€4,000 /m²',
              desc: 'Traditional fishing village on the Sado estuary with iconic wooden stilt walkways. Authenticity preserved. Buyers here seek river lifestyle rather than ocean frontage at a meaningful discount to core Comporta.',
            },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">9. Who Is Buying in Comporta in 2026</h2>
        <p className="t">
          The buyer profile for Comporta has evolved significantly over the past five years. From a market
          dominated by upper-middle-class Portuguese families and a small cohort of French early adopters,
          it has become one of the most internationally diverse luxury markets in Europe.
        </p>
        <p className="t">
          <strong style={{ fontWeight: 500, color: '#1c4a35' }}>French buyers</strong> remain the largest international segment, accounting for approximately 25–30% of all international transactions above €1.5M. French cultural resonance with the Alentejo landscape, the French-language community in Lisbon, and tax efficiency considerations under the IFICI regime combine to make Comporta a natural destination.
        </p>
        <p className="t">
          <strong style={{ fontWeight: 500, color: '#1c4a35' }}>North American buyers</strong> — particularly from New York, Miami, and Los Angeles — are the fastest-growing segment. Driven by Lisbon&apos;s established American expat community and the value comparison with the Hamptons or Martha&apos;s Vineyard (where comparable properties trade at 3–5x Comporta prices), Americans are acquiring Comporta villas as European bases in increasing numbers.
        </p>
        <p className="t">
          <strong style={{ fontWeight: 500, color: '#1c4a35' }}>Middle Eastern and Asian family offices</strong> represent the highest average transaction value, typically seeking estate properties above €5M. These buyers are motivated primarily by portfolio diversification, EU asset base, and the generational wealth-preservation characteristics of a legally scarce luxury land holding.
        </p>
        <p className="t">
          <strong style={{ fontWeight: 500, color: '#1c4a35' }}>British buyers</strong>, constrained by Schengen&apos;s 90-day rule post-Brexit but not deterred, remain active in the €1.5M–€3M segment. Many manage their calendar across the year and use Comporta as a high-season base from May through October while renting privately for the weeks they are not present.
        </p>

        <h2 className="s">10. Comporta vs. European Luxury Coastal Markets</h2>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Price Range (luxury)</th>
              <th>YoY Growth 2026</th>
              <th>Scarcity Level</th>
              <th>Privacy Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Comporta, Portugal</td>
              <td>€4,200–€8,000/m²</td>
              <td>+22%</td>
              <td>Extreme (legally protected)</td>
              <td>Exceptional</td>
            </tr>
            <tr>
              <td>Algarve Golden Triangle</td>
              <td>€5,000–€12,000/m²</td>
              <td>+16%</td>
              <td>Moderate</td>
              <td>Good</td>
            </tr>
            <tr>
              <td>Ibiza, Spain</td>
              <td>€6,000–€15,000/m²</td>
              <td>+9%</td>
              <td>High (island constraint)</td>
              <td>Limited in season</td>
            </tr>
            <tr>
              <td>Saint-Tropez, France</td>
              <td>€8,000–€25,000/m²</td>
              <td>+7%</td>
              <td>High</td>
              <td>Low (mass tourism)</td>
            </tr>
            <tr>
              <td>Marbella Golden Mile</td>
              <td>€5,500–€14,000/m²</td>
              <td>+11%</td>
              <td>Low (over-developed)</td>
              <td>Moderate</td>
            </tr>
          </tbody>
        </table>
        <p className="t">
          Comporta&apos;s competitive position is unique: it combines near-maximum scarcity and privacy at price
          levels still below comparable European luxury coastal markets. The +22% appreciation differential
          versus the European luxury average of approximately +10% is the market correcting that discount.
          The window for value-relative acquisition is closing.
        </p>

        <h2 className="s">11. The Buying Process in Comporta</h2>
        <p className="t">
          The legal process for purchasing in Comporta follows the standard Portuguese framework — NIF, CPCV,
          Escritura — but with additional due diligence layers specific to protected zone properties.
        </p>

        <div className="step-grid">
          {[
            { n: '01', t: 'NIF + Bank Account', d: 'Standard Portuguese requirements: NIF (Número de Identificação Fiscal) obtained at a Finanças office or via a lawyer, plus a Portuguese bank account. Non-residents need a fiscal representative. Complete these before travelling.' },
            { n: '02', t: 'Protected Zone Due Diligence', d: 'Verify the property\'s PDM classification, RAN/REN status, Rede Natura designation, and habitation licence. For older palheiros, title regularisation may be required — factor 30–60 additional days if so.' },
            { n: '03', t: 'Off-Market Access', d: 'At least 30–40% of the best Comporta properties never reach public portals. Work with an agent who has genuine local relationships to access inventory that is not publicly listed. Agency Group (AMI 22506) covers this entire market.' },
            { n: '04', t: 'Offer + Negotiation', d: 'Written offer with a defined response window. In the premium Comporta market, negotiation is relationship-driven. A poorly structured offer can close doors permanently. Agency Group manages this protocol for buyers.' },
            { n: '05', t: 'CPCV — Promise of Purchase', d: 'Binding preliminary contract. Deposit typically 20–30% given the competitive market. If buyer withdraws: deposit lost. If seller withdraws: deposit returned double. Special conditions for protected zone properties must be carefully drafted.' },
            { n: '06', t: 'Escritura — Final Deed', d: 'Executed before a notary in Setúbal or Lisbon. IMT and Stamp Duty paid before signing. Registration at the Land Registry. Typical timeline CPCV to Deed: 60–90 days. Cash buyers can close at the lower end.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">12. Acquisition Costs — €3M Comporta Villa (2026)</h2>
        <p className="t">For a €3,000,000 villa purchase in Comporta by a non-resident investment buyer in 2026:</p>
        <table className="cost-table">
          <thead><tr><th>Cost Item</th><th>Rate</th><th>Estimated Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>IMT (Property Transfer Tax)</td>
              <td>Graduated — 7.5% for investment &gt;€1M</td>
              <td>€225,000</td>
            </tr>
            <tr>
              <td>Stamp Duty (Imposto de Selo)</td>
              <td>0.8% of purchase price</td>
              <td>€24,000</td>
            </tr>
            <tr>
              <td>Notary + Land Registry</td>
              <td>Fixed + variable</td>
              <td>€2,500–4,000</td>
            </tr>
            <tr>
              <td>Specialist Alentejo Litoral Lawyer</td>
              <td>0.75–1.0% of price</td>
              <td>€22,500–30,000</td>
            </tr>
            <tr>
              <td>Protected zone survey / legal report</td>
              <td>Fixed fee</td>
              <td>€1,500–3,000</td>
            </tr>
            <tr>
              <td>Agency Commission (paid by seller)</td>
              <td>5% + VAT</td>
              <td>€0 (seller&apos;s cost)</td>
            </tr>
            <tr>
              <td>Total acquisition costs</td>
              <td>~9.0–9.5% of price</td>
              <td>€275,500–286,000</td>
            </tr>
          </tbody>
        </table>

        <p className="t">
          Annual running costs for a property of this type — IMI (0.3–0.45% of cadastral value), maintenance,
          estate management, pool care, and landscaping — typically run €15,000–€35,000 per year depending on
          the size of the plot and whether a dedicated property manager is engaged. These costs are offset
          against rental income for properties that participate in a letting programme.
        </p>

        <h2 className="s">13. Agency Group in Comporta</h2>
        <p className="t">
          Agency Group (AMI 22506) maintains active buyer and seller relationships across the Comporta,
          Carvalhal, Brejos da Carregueira, Torre, and Pego markets, including access to off-market
          inventory that never appears on Idealista, Imovirtual, or international portals. We also
          operate in the emerging Melides and Alcácer do Sal corridor.
        </p>
        <p className="t">
          For buyers with a serious Comporta mandate, our process begins with a brief — location
          preferences, must-haves, budget range, timeline — and continues with a curated selection
          of properties matched to that mandate, including pre-market opportunities from our vendor
          relationships. There is no cost to the buyer: as in all Portuguese real estate transactions,
          our commission is paid by the seller.
        </p>

        <div className="callout">
          <p><strong>Agency Group Comporta Mandate:</strong> We actively represent buyers in the €800K–€12M+ segment across the Comporta–Melides–Alcácer corridor. Our off-market access covers Comporta village, Carvalhal, Torre, Pego, and Brejos da Carregueira. <strong>Commission paid exclusively by the seller. Zero cost to buyers.</strong> AMI 22506.</p>
        </div>

        <div className="cta-box">
          <h3>Looking for Comporta Villas or Land?</h3>
          <p>Access our off-market Comporta inventory. Carvalhal, Torre, Pego, and Comporta village. Properties from €800K to €12M+. Commission always paid by the seller — zero cost to buyers.</p>
          <Link href="/en">View Comporta Properties →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/luxury-property-lisbon" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Luxury Lisbon</Link>
            <Link href="/blog/luxury-villas-algarve-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Algarve Villas</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer&apos;s Guide</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
