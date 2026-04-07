import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Retire in Portugal 2026: Guide for Americans & Europeans',
  description: 'Complete guide to retiring in Portugal 2026. D7 Passive Income Visa, NHR/IFICI tax benefits, best cities, healthcare, cost of living and property buying process. AMI 22506.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/portugal-retirement-haven-2026' },
  openGraph: {
    title: 'Retire in Portugal 2026: The Ultimate Guide for Americans & Europeans',
    description: '300 days sun, 4th safest globally, €2,500/month for a couple. D7 Visa guide, IFICI pension tax, best cities for retirees. Complete guide.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/portugal-retirement-haven-2026',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Retire in Portugal 2026: The Ultimate Guide for Americans & Europeans',
  description: 'Complete guide to retiring in Portugal 2026. D7 Visa, IFICI tax benefits, best cities, healthcare, cost of living.',
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
  url: 'https://www.agencygroup.pt/blog/portugal-retirement-haven-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Retire in Portugal 2026' },
    { '@type': 'Thing', name: 'Portugal retirement visa' },
    { '@type': 'Thing', name: 'D7 Visa Portugal' },
    { '@type': 'Thing', name: 'Best places retire Portugal' },
  ],
}

export default function ArticlePortugalRetirement() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → portugal-retirement-haven-2026
          </div>
          <div className="art-cat">Retirement Guide · D7 Visa</div>
          <h1 className="art-h1">Retire in Portugal 2026:<br /><em>The Ultimate Guide for Americans &amp; Europeans</em></h1>
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
          Portugal consistently ranks among the world&apos;s top retirement destinations — and the numbers tell a compelling
          story. 300 days of sunshine annually, ranked 4th safest country globally (Global Peace Index 2025), a couple can
          live comfortably in Lisbon or Cascais for €2,500/month versus €6,000+ in London. Add a straightforward D7
          Passive Income Visa, a favourable pension tax regime, world-class private healthcare at a fraction of US costs,
          and you have the complete retirement package. This guide covers everything you need to make the move in 2026.
        </p>

        <h2 className="s">1. Why Portugal for Retirement</h2>
        <p className="t">
          Portugal offers retirees from the US, UK, Canada, and Northern Europe something increasingly rare: a high quality
          of life at sustainable cost, in a safe, English-friendly environment within Schengen Europe. The Atlantic climate
          is mild year-round — no brutal winters, no extreme heat. The food, wine, and culture are world-class. Healthcare,
          while imperfect in the public system, is excellent in private clinics at €150–300/month for comprehensive
          insurance.
        </p>
        <p className="t">
          The expat community is extensive and established: Cascais alone has a British population of several thousand,
          while the Algarve&apos;s British-Irish community numbers in the tens of thousands. For Americans, Lisbon and Porto
          have thriving and growing communities with English-language resources, churches, social clubs, and professional
          networks.
        </p>

        <div className="callout">
          <p><strong>Portugal at a Glance:</strong> 300+ days sunshine · 4th safest globally (GPI 2025) · Schengen EU member · English widely spoken · €2,500/month couple budget (Lisbon) · Private healthcare €150–300/month · D7 Visa minimum income €760/month · No capital gains on primary residence sale after 2 years.</p>
        </div>

        <h2 className="s">2. The D7 Passive Income Visa</h2>
        <p className="t">
          The D7 — formally the Visto de Residência para Pessoas com Rendimentos Próprios — is the most straightforward
          route to Portuguese residency for retirees. Unlike the Golden Visa, it does not require a property investment;
          it requires proof of regular passive income sufficient to support yourself without working in Portugal.
        </p>

        <div className="step-grid">
          {[
            { n: '01', t: 'Income Requirements', d: 'Minimum €760/month (100% of Portuguese minimum wage) for the primary applicant. Spouse adds 50% (€380/month). Each dependent child adds 30% (€228/month). Most retirees with US Social Security, UK pension, or investment income qualify comfortably.' },
            { n: '02', t: 'Documentation', d: 'Valid passport, proof of passive income (pension statements, investment income, rental income abroad), criminal record certificate, proof of accommodation in Portugal (lease or property), travel insurance initially, NIF.' },
            { n: '03', t: 'Apply at Portuguese Consulate', d: 'Apply in your country of residence. Once approved, you receive a D7 entry visa valid 4 months. You then enter Portugal and apply at AIMA (Agency for Integration, Migration and Asylum) for the full residency permit.' },
            { n: '04', t: 'Residence Permit', d: 'Initial permit valid 2 years, renewable for 3 years. After 5 years total, eligible for permanent residence or citizenship. Portugal is one of the few EU countries offering citizenship via residency to non-EU nationals on a clear timeline.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Tax Treatment of Pension Income</h2>
        <p className="t">
          For retirees, the tax landscape under IFICI (the NHR successor) changed significantly in 2024. The prior NHR
          regime offered a full 10-year exemption on foreign pension income — that specific benefit no longer applies
          under IFICI for new applicants.
        </p>
        <p className="t">
          However, Portugal has bilateral tax conventions with the US, UK, France, Germany, and most major pension-source
          countries. Under many of these treaties, pension income is taxable only in the country of source (not Portugal),
          or is eligible for credit relief. The actual tax outcome depends heavily on your specific pension type, country
          of origin, and treaty provisions. Professional tax advice from a Portugal-licensed fiscalista is essential before
          relocating.
        </p>

        <table className="cost-table">
          <thead><tr><th>Pension Type</th><th>Typical Treatment</th><th>Action Required</th></tr></thead>
          <tbody>
            <tr><td>US Social Security (American)</td><td>Taxable in US only (US–PT treaty)</td><td>File US taxes; declare in Portugal for information only</td></tr>
            <tr><td>UK State/Private Pension</td><td>Taxable in UK or Portugal depending on pension type</td><td>Obtain specialist UK–PT dual tax advice</td></tr>
            <tr><td>Government pension (most countries)</td><td>Typically taxable in source country</td><td>Verify via bilateral treaty — significant variation</td></tr>
            <tr><td>Private/occupational pension</td><td>Portugal may tax at standard IRS rates</td><td>Review IFICI eligibility and treaty position</td></tr>
            <tr><td>Investment income (dividends, interest)</td><td>Potentially exempt if foreign-source</td><td>IFICI application recommended if professionally active</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. Best Cities for Retirement in Portugal</h2>

        <div className="loc-grid">
          {[
            { name: 'Cascais', price: '€2,800–€4,500/m² buy', desc: 'Top choice for British and American retirees. Established expat community, international schools, beach lifestyle. 30 min from Lisbon by train. English spoken everywhere.' },
            { name: 'Algarve', price: '€2,500–€5,500/m² buy', desc: 'The classic British-Irish retirement destination. Faro, Lagos, Tavira. Warm winters, golf, beaches. Large English-speaking healthcare and services network.' },
            { name: 'Porto', price: '€3,643/m² avg buy', desc: 'Cultural, walkable, authentic. Growing expat community. Excellent private hospitals. Less hot than the south — suitable for Northern Europeans uncomfortable with Algarve summers.' },
            { name: 'Alentejo', price: '€1,200–€2,200/m² buy', desc: 'Rural peace, wine country, lowest cost of living in Portugal. Évora UNESCO city. Ideal for those seeking space, nature, and complete change of pace. 1.5h from Lisbon.' },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">5. Cost of Living — The Real Numbers</h2>

        <table className="cost-table">
          <thead><tr><th>Expense</th><th>Cascais/Lisbon</th><th>Algarve</th><th>Porto</th></tr></thead>
          <tbody>
            <tr><td>Rent — 2 bed furnished apartment</td><td>€1,800–€2,800/mo</td><td>€1,200–€2,000/mo</td><td>€1,200–€1,800/mo</td></tr>
            <tr><td>Groceries (couple)</td><td>€400–€600/mo</td><td>€350–€500/mo</td><td>€350–€500/mo</td></tr>
            <tr><td>Private health insurance (couple)</td><td>€250–€450/mo</td><td>€200–€350/mo</td><td>€200–€350/mo</td></tr>
            <tr><td>Dining out (couple, 3x/week)</td><td>€400–€600/mo</td><td>€300–€500/mo</td><td>€300–€450/mo</td></tr>
            <tr><td>Utilities + internet</td><td>€150–€250/mo</td><td>€120–€200/mo</td><td>€120–€200/mo</td></tr>
            <tr><td>Total estimated (couple)</td><td>€3,000–€4,700/mo</td><td>€2,170–€3,550/mo</td><td>€2,170–€3,300/mo</td></tr>
          </tbody>
        </table>

        <p className="t">
          Comparison: London couple equivalent lifestyle costs €6,500–€9,000/month. New York: €7,000–€11,000/month.
          The Portugal advantage is structural — not a short-term currency anomaly. Property ownership rather than renting
          reduces monthly costs by €1,200–€2,000, making the case for buying even stronger for long-term retirees.
        </p>

        <h2 className="s">6. Healthcare in Portugal</h2>
        <p className="t">
          Portugal has a public national health service (SNS) available to registered residents, plus an extensive
          private healthcare network. For retirees, private health insurance at €150–300/month per person (depending on
          age and coverage level) gives access to private hospitals — CUF, Lusíadas, Hospital da Luz — where wait times
          are minimal and English-speaking doctors are common.
        </p>
        <p className="t">
          Dental care in Portugal is particularly competitive: quality private dental treatment costs 40–60% less than
          in the UK or US. The Algarve and Cascais have specialist clinics catering specifically to the expat community,
          with English-speaking staff throughout.
        </p>

        <h2 className="s">7. Buying Property as a Non-Resident Retiree</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Get Your NIF', d: 'Portuguese tax number — mandatory before any purchase. Non-residents need a fiscal representative (often your lawyer). Takes 1–3 days. Also needed to open a bank account.' },
            { n: '02', t: 'Open a Bank Account', d: 'Required for property purchase funds. Millennium BCP, Santander Portugal, and Novobanco are the most expat-friendly. Process: 1–2 weeks. Requires NIF + passport + proof of address.' },
            { n: '03', t: 'Legal Due Diligence', d: 'Hire a Portuguese lawyer (not the agency\'s lawyer — independent). They verify the property registry, habitation licence, energy certificate, and confirm no debts or charges exist against the property.' },
            { n: '04', t: 'CPCV & Escritura', d: 'The two-stage Portuguese purchase: CPCV (binding preliminary contract with 10–30% deposit), then Escritura (final deed at notary). Total process: 60–120 days from accepted offer to keys.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="callout">
          <p><strong>Agency Group Retirement Support:</strong> We specialise in assisting international retirees relocate to Portugal. Our bilingual team coordinates the property search with your visa timeline, introduces trusted lawyers and fiscal advisors, and handles the entire purchase process in English. We represent buyers at <strong>zero commission cost</strong> — our 5% fee (AMI 22506) is paid exclusively by the seller.</p>
        </div>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f4f0e6', border: '1px solid rgba(28,74,53,.15)', borderRadius: '4px' }}>
          <p style={{ fontSize: '.85rem', color: '#1c4a35', fontWeight: '600', marginBottom: '.75rem' }}>
            Find your retirement property in Portugal:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            <a href="/imoveis" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>View all properties →</a>
            <a href="/zonas/cascais" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Cascais zone →</a>
            <a href="/zonas/algarve" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Algarve zone →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Ready to retire in Portugal?</h3>
          <p>We help Americans and Europeans find the right property and navigate the entire relocation process. Start with a free consultation. AMI 22506 · +351 919 948 986 · www.agencygroup.pt</p>
          <Link href="/imoveis">Find Your Retirement Home →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/blog/buy-property-cascais" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Cascais Guide</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer&apos;s Guide</Link>
            <Link href="/blog/nhr-portugal-2026-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>NHR / IFICI</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
