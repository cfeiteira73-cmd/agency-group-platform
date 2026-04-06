import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'IMT & Property Taxes Portugal 2026: Foreign Buyers Guide',
  description: 'Complete guide to IMT, stamp duty, IMI and AIMI property taxes in Portugal 2026. Tax calculation examples for €500K, €1M and €3M properties. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
      'pt': 'https://www.agencygroup.pt/blog/imt-impostos-portugal-2026',
      'x-default': 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
    },
  },
  openGraph: {
    title: 'IMT and Property Taxes in Portugal 2026: What Foreign Buyers Must Know',
    description: 'IMT, stamp duty, IMI, AIMI — every property tax in Portugal explained with real calculation examples. IFICI tax benefits for new residents.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'IMT and Property Taxes in Portugal 2026: What Foreign Buyers Must Know',
  description: 'Complete guide to IMT, stamp duty, IMI and AIMI property taxes in Portugal 2026.',
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
  url: 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'IMT Portugal 2026' },
    { '@type': 'Thing', name: 'Property tax Portugal' },
    { '@type': 'Thing', name: 'Stamp duty Portugal' },
  ],
}

export default function ArticleTaxesIMT() {
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
        .art-hero{padding:140px 0 80px;background:#0c2030;position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 10% 85%,rgba(12,31,48,.7),transparent)}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .art-breadcrumb a:hover{color:#c9a96e}
        .art-cat{display:inline-block;background:rgba(201,169,110,.15);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px;border:1px solid rgba(201,169,110,.3)}
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
        .cost-table .total-row td{font-weight:600;color:#1c4a35;background:rgba(28,74,53,.05);border-bottom:none}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .callout-warn{background:#2e1a00;padding:28px 32px;margin:32px 0;border-left:3px solid #c9a96e}
        .callout-warn p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout-warn strong{color:#c9a96e}
        .tax-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin:28px 0}
        .tax-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .tax-card-name{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(14,14,13,.4);margin-bottom:8px}
        .tax-card-rate{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:#1c4a35;margin-bottom:8px}
        .tax-card-desc{font-size:.78rem;line-height:1.65;color:rgba(14,14,13,.55)}
        .example-block{background:#fff;border:1px solid rgba(14,14,13,.1);padding:32px;margin:28px 0}
        .example-title{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.2em;text-transform:uppercase;color:#c9a96e;margin-bottom:16px}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.tax-card-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → taxes-imt-portugal-2026
          </div>
          <div className="art-cat">Tax Guide</div>
          <h1 className="art-h1">IMT and Property Taxes in Portugal 2026:<br /><em>What Foreign Buyers Must Know</em></h1>
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
          Understanding Portuguese property taxes before you buy can save you tens of thousands of euros. Portugal imposes
          four main property-related taxes: IMT (transfer tax paid at purchase), Stamp Duty (also at purchase), IMI (annual
          municipal tax), and AIMI (additional annual tax on high-value portfolios). This guide explains each one with
          real calculation examples for €500K, €1M, and €3M properties, plus the IFICI tax regime that can dramatically
          reduce your overall tax burden if you become a Portuguese resident.
        </p>

        <h2 className="s">1. Overview — Four Property Taxes at a Glance</h2>
        <div className="tax-card-grid">
          {[
            { name: 'IMT', rate: '0% – 7.5%', desc: 'Property Transfer Tax. Paid once at purchase by the buyer. Graduated rates based on property value and use (primary residence vs. investment).' },
            { name: 'Stamp Duty (IS)', rate: '0.8%', desc: 'Imposto de Selo. Flat rate on the purchase price. Paid once at purchase. If mortgaged, additional 0.6% on the loan amount.' },
            { name: 'IMI', rate: '0.3% – 0.45%', desc: 'Annual municipal property tax on the official cadastral value (valor patrimonial tributário — typically 20–50% below market). Paid annually.' },
            { name: 'AIMI', rate: '0.7% – 1.5%', desc: 'Additional IMI. Applies only to property portfolios above €600,000 (individuals). Charged annually by the Portuguese Tax Authority.' },
          ].map(t => (
            <div key={t.name} className="tax-card">
              <div className="tax-card-name">{t.name}</div>
              <div className="tax-card-rate">{t.rate}</div>
              <p className="tax-card-desc">{t.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. IMT — Complete 2026 Rate Table</h2>
        <p className="t">
          IMT (Imposto Municipal sobre as Transmissões Onerosas de Imóveis) is the main property transfer tax. Rates depend
          on whether the property will be your primary residence (habitação própria e permanente) or an investment/secondary
          property. Non-residents always pay investment rates.
        </p>

        <h3 className="ss">Primary Residence (Residents Only)</h3>
        <table className="cost-table">
          <thead><tr><th>Purchase Price</th><th>Marginal Rate</th><th>Amount to Deduct</th></tr></thead>
          <tbody>
            <tr><td>Up to €97,064</td><td>0%</td><td>€0</td></tr>
            <tr><td>€97,065 – €132,774</td><td>2%</td><td>€1,941</td></tr>
            <tr><td>€132,775 – €182,349</td><td>5%</td><td>€5,924</td></tr>
            <tr><td>€182,350 – €316,772</td><td>7%</td><td>€9,561</td></tr>
            <tr><td>€316,773 – €633,453</td><td>8%</td><td>€16,729</td></tr>
            <tr><td>€633,454 – €1,050,400</td><td>6% (flat)</td><td>—</td></tr>
            <tr><td>Above €1,050,400</td><td>7.5% (flat)</td><td>—</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Investment / Non-Resident Purchase</h3>
        <table className="cost-table">
          <thead><tr><th>Purchase Price</th><th>Rate</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Up to €97,064</td><td>1%</td><td>No exemption for non-residents</td></tr>
            <tr><td>€97,065 – €633,453</td><td>Graduated 2%–8%</td><td>Same progressive table</td></tr>
            <tr><td>€633,454 – €1,050,400</td><td>6% (flat)</td><td>—</td></tr>
            <tr><td>Above €1,050,400</td><td>7.5% (flat)</td><td>—</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Important:</strong> Properties in blacklisted tax haven territories (offshore jurisdictions) are subject to a flat IMT rate of <strong>10%</strong>, regardless of price or use. Always use a clean acquisition structure.</p>
        </div>

        <h2 className="s">3. IMT Calculation Examples</h2>

        <div className="example-block">
          <div className="example-title">Example A — €500,000 Investment Property (Non-Resident)</div>
          <table className="cost-table">
            <thead><tr><th>Item</th><th>Calculation</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>IMT (graduated table)</td><td>€500,000 × 8% − €16,729</td><td>€23,271</td></tr>
              <tr><td>Stamp Duty</td><td>€500,000 × 0.8%</td><td>€4,000</td></tr>
              <tr className="total-row"><td>Total tax at purchase</td><td></td><td>€27,271</td></tr>
            </tbody>
          </table>
        </div>

        <div className="example-block">
          <div className="example-title">Example B — €1,000,000 Investment Property (Non-Resident)</div>
          <table className="cost-table">
            <thead><tr><th>Item</th><th>Calculation</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>IMT (flat 6% for this bracket)</td><td>€1,000,000 × 6%</td><td>€60,000</td></tr>
              <tr><td>Stamp Duty</td><td>€1,000,000 × 0.8%</td><td>€8,000</td></tr>
              <tr className="total-row"><td>Total tax at purchase</td><td></td><td>€68,000</td></tr>
            </tbody>
          </table>
        </div>

        <div className="example-block">
          <div className="example-title">Example C — €3,000,000 Investment Property (Non-Resident)</div>
          <table className="cost-table">
            <thead><tr><th>Item</th><th>Calculation</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>IMT (flat 7.5% for &gt;€1,050,400)</td><td>€3,000,000 × 7.5%</td><td>€225,000</td></tr>
              <tr><td>Stamp Duty</td><td>€3,000,000 × 0.8%</td><td>€24,000</td></tr>
              <tr className="total-row"><td>Total tax at purchase</td><td></td><td>€249,000</td></tr>
            </tbody>
          </table>
        </div>

        <h2 className="s">4. IMI — Annual Municipal Property Tax</h2>
        <p className="t">
          IMI is calculated on the official cadastral value (VPT — Valor Patrimonial Tributário), not the market price.
          For Lisbon, the VPT of a €1,000,000 apartment is typically €300,000–€500,000. Each municipality sets its own rate
          within the legal bands.
        </p>
        <table className="cost-table">
          <thead><tr><th>Property Type</th><th>IMI Rate</th><th>Example (VPT €400K)</th></tr></thead>
          <tbody>
            <tr><td>Urban — Lisbon</td><td>0.3%</td><td>€1,200 / year</td></tr>
            <tr><td>Urban — Other municipalities</td><td>0.3%–0.45%</td><td>€1,200–€1,800 / year</td></tr>
            <tr><td>Rural property</td><td>0.8%</td><td>€3,200 / year (VPT €400K)</td></tr>
          </tbody>
        </table>
        <p className="t">
          <strong>IMI Exemptions:</strong> Primary residences with VPT below €125,000 for households with taxable income
          below €153,300 are exempt. Newly rehabilitated urban properties can receive a 3-year exemption.
        </p>

        <h2 className="s">5. AIMI — Additional IMI for High-Value Portfolios</h2>
        <p className="t">
          AIMI applies annually to individuals who hold property with a combined VPT above €600,000. It targets
          high-value real estate portfolios and applies on top of regular IMI.
        </p>
        <table className="cost-table">
          <thead><tr><th>Combined VPT (Individual)</th><th>AIMI Rate</th></tr></thead>
          <tbody>
            <tr><td>Up to €600,000</td><td>0% (exempt)</td></tr>
            <tr><td>€600,001 – €1,000,000</td><td>0.7%</td></tr>
            <tr><td>€1,000,001 – €2,000,000</td><td>1.0%</td></tr>
            <tr><td>Above €2,000,000</td><td>1.5%</td></tr>
          </tbody>
        </table>
        <div className="callout-warn">
          <p><strong>AIMI Planning Tip:</strong> Holding properties through a company (sociedade) instead of personally eliminates the €600K individual exemption — companies pay AIMI at 0.4% from the first euro of VPT. Always model the personal vs. corporate structure with your tax adviser before acquiring.</p>
        </div>

        <h2 className="s">6. The IFICI Tax Regime — Flat 20% for 10 Years</h2>
        <p className="t">
          For foreign buyers planning to become tax residents in Portugal, the IFICI (successor to NHR) regime provides
          significant relief on income taxes — though it does not directly reduce IMT or IMI.
        </p>
        <table className="cost-table">
          <thead><tr><th>Income Type</th><th>Standard Rate</th><th>IFICI Rate</th></tr></thead>
          <tbody>
            <tr><td>Employment (eligible activities)</td><td>Up to 48%</td><td>20% flat</td></tr>
            <tr><td>Self-employment (eligible activities)</td><td>Up to 48%</td><td>20% flat</td></tr>
            <tr><td>Foreign-source pensions</td><td>Up to 48%</td><td>Potentially exempt</td></tr>
            <tr><td>Foreign dividends / interest</td><td>28% withholding</td><td>Potentially exempt</td></tr>
          </tbody>
        </table>
        <p className="t">
          Duration: 10 consecutive years from first year of residency. Eligibility requires not having been a Portuguese
          tax resident in the previous 5 years.
        </p>

        <h2 className="s">7. No Inheritance Tax on Direct Family</h2>
        <p className="t">
          Portugal abolished inheritance tax (Imposto sobre Sucessões) in 2004. Transfers between spouses, parents,
          and children are exempt from the main succession tax. A reduced Stamp Duty of 10% applies to transfers to
          non-direct relatives (siblings, nephews, etc.), but direct family transfers remain completely exempt.
          This makes Portugal particularly attractive for multigenerational wealth planning.
        </p>

        <div className="cta-box">
          <h3>Ready to model your acquisition costs?</h3>
          <p>Our advisors can calculate your exact IMT, stamp duty, annual IMI and AIMI before you commit. No obligation.</p>
          <Link href="/en">Talk to an Advisor →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer&apos;s Guide</Link>
            <Link href="/blog/capital-gains-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Capital Gains</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
