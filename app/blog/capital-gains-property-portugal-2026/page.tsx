import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Capital Gains Tax on Property in Portugal 2026: Complete Guide · Agency Group',
  description: 'How capital gains tax works on Portuguese property in 2026. Residents vs. non-residents, reinvestment exemption, inflation coefficients, and strategies to minimize tax. AMI 22506.',
  robots: 'index, follow',
  alternates: { canonical: 'https://agencygroup.pt/blog/capital-gains-property-portugal-2026' },
  openGraph: {
    title: 'Capital Gains Tax on Property in Portugal 2026: Complete Guide',
    description: 'Residents vs. non-residents, reinvestment exemption, inflation coefficients, age exemption, and strategic tips to minimize capital gains on Portuguese property.',
    type: 'article',
    url: 'https://agencygroup.pt/blog/capital-gains-property-portugal-2026',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Capital Gains Tax on Property in Portugal 2026: Complete Guide',
  description: 'How capital gains tax works on Portuguese property in 2026. Residents vs. non-residents, exemptions, and strategies.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://agencygroup.pt' },
  datePublished: '2026-04-02',
  dateModified: '2026-04-02',
  url: 'https://agencygroup.pt/blog/capital-gains-property-portugal-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Capital gains tax Portugal' },
    { '@type': 'Thing', name: 'Property sale tax Portugal 2026' },
    { '@type': 'Thing', name: 'Mais-valias Portugal' },
  ],
}

export default function ArticleCapitalGains() {
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
        .art-hero{padding:140px 0 80px;background:linear-gradient(135deg,#1a0a2e,#0c1f15);position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 70% at 5% 90%,rgba(26,10,46,.8),transparent)}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .art-breadcrumb a:hover{color:#c9a96e}
        .art-cat{display:inline-block;background:rgba(201,169,110,.12);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px;border:1px solid rgba(201,169,110,.25)}
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
        .cost-table .total-row td{font-weight:600;color:#1c4a35;background:rgba(28,74,53,.05);border-bottom:none}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .callout-warn{background:#1a0a2e;padding:28px 32px;margin:32px 0;border-left:3px solid #c9a96e}
        .callout-warn p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout-warn strong{color:#c9a96e}
        .formula-block{background:#fff;border:1px solid rgba(28,74,53,.2);border-left:4px solid #1c4a35;padding:28px;margin:28px 0}
        .formula-label{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.2em;text-transform:uppercase;color:#1c4a35;margin-bottom:12px}
        .formula{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#0c1f15;line-height:1.6}
        .example-block{background:#fff;border:1px solid rgba(14,14,13,.1);padding:32px;margin:28px 0}
        .example-title{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.2em;text-transform:uppercase;color:#c9a96e;margin-bottom:16px}
        .tip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin:28px 0}
        .tip-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .tip-icon{font-family:var(--font-cormorant),serif;font-size:1.5rem;font-weight:300;color:#c9a96e;margin-bottom:8px}
        .tip-title{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#1c4a35;margin-bottom:8px}
        .tip-desc{font-size:.8rem;line-height:1.7;color:rgba(14,14,13,.6)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.tip-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → capital-gains-property-portugal-2026
          </div>
          <div className="art-cat">Tax Guide</div>
          <h1 className="art-h1">Capital Gains Tax on Property in Portugal 2026:<br /><em>Complete Guide</em></h1>
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
          Capital gains on Portuguese property — known as mais-valias imobiliárias — are one of the most misunderstood
          aspects of the market. The rules differ significantly for residents versus non-residents, and several important
          exemptions can reduce or eliminate your tax bill entirely. With Portugal&apos;s market up +17.6% in 2025 alone,
          understanding the exit tax is as important as understanding the entry costs. This guide covers the 2026 rules,
          the full gain calculation formula, inflation adjustment coefficients, and strategic ways to minimize what you owe.
        </p>

        <h2 className="s">1. Residents vs. Non-Residents — The Key Distinction</h2>
        <p className="t">
          The tax treatment of capital gains on Portuguese property has historically differed substantially between
          Portuguese tax residents and non-residents. A landmark court ruling, followed by legislative changes effective
          from 2023, brought the two closer together.
        </p>
        <table className="cost-table">
          <thead><tr><th>Status</th><th>How Gains Are Taxed</th><th>Effective Rate</th></tr></thead>
          <tbody>
            <tr><td>Portuguese resident</td><td>50% of net gain added to total income, taxed at marginal rate</td><td>~14%–24% (at marginal rate on half the gain)</td></tr>
            <tr><td>Non-resident (default)</td><td>Flat 28% on the full net gain</td><td>28%</td></tr>
            <tr><td>Non-resident (election)</td><td>Can elect to be taxed as resident: 50% of gain at marginal rate</td><td>Often lower than 28% if other income is modest</td></tr>
          </tbody>
        </table>
        <div className="callout">
          <p><strong>Non-resident election:</strong> Since the 2023 rule change, non-residents can elect to be taxed on property gains using the same rules as residents (50% of gain, marginal rates). This election applies only to Portuguese-source property gains and must be made in the annual tax return. <strong>For high-gain disposals, this can significantly reduce the tax burden.</strong></p>
        </div>

        <h2 className="s">2. The Capital Gain Calculation Formula</h2>
        <p className="t">
          The taxable gain is not simply &quot;sale price minus purchase price.&quot; Portuguese law allows several deductions
          to arrive at the net gain.
        </p>
        <div className="formula-block">
          <div className="formula-label">Formula</div>
          <div className="formula">
            Net Gain = Sale Price − [ (Purchase Price × Inflation Coefficient) + Acquisition Costs + Improvement Costs ]
          </div>
        </div>

        <h3 className="ss">Deductible Items</h3>
        <table className="cost-table">
          <thead><tr><th>Deduction</th><th>What Qualifies</th><th>Documentation Required</th></tr></thead>
          <tbody>
            <tr><td>Purchase price × inflation coeff.</td><td>Original purchase price adjusted for inflation (official AT coefficient)</td><td>Original deed (escritura)</td></tr>
            <tr><td>Acquisition costs</td><td>IMT, stamp duty, notary, land registry fees paid when buying</td><td>Receipts from AT + notary</td></tr>
            <tr><td>Improvement costs</td><td>Capital improvements made in the last 12 years (not maintenance)</td><td>Invoices with NIF from licensed contractors</td></tr>
            <tr><td>Sale costs</td><td>Real estate commission (if paid by seller) + energy certificate + lawyer</td><td>Invoices</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. Inflation Coefficients 2026 Table</h2>
        <p className="t">
          The Portuguese Tax Authority (Autoridade Tributária) publishes official inflation coefficients each year.
          These are applied to the original purchase price to adjust for inflation, reducing the taxable gain.
          A property purchased in 2010 and sold in 2026 uses the 2010 coefficient.
        </p>
        <table className="cost-table">
          <thead><tr><th>Year of Purchase</th><th>Inflation Coefficient (2026)</th></tr></thead>
          <tbody>
            <tr><td>2010</td><td>1.27</td></tr>
            <tr><td>2011</td><td>1.24</td></tr>
            <tr><td>2012</td><td>1.22</td></tr>
            <tr><td>2013</td><td>1.22</td></tr>
            <tr><td>2014</td><td>1.22</td></tr>
            <tr><td>2015</td><td>1.22</td></tr>
            <tr><td>2016</td><td>1.21</td></tr>
            <tr><td>2017</td><td>1.19</td></tr>
            <tr><td>2018</td><td>1.16</td></tr>
            <tr><td>2019</td><td>1.13</td></tr>
            <tr><td>2020</td><td>1.11</td></tr>
            <tr><td>2021</td><td>1.10</td></tr>
            <tr><td>2022</td><td>1.05</td></tr>
            <tr><td>2023</td><td>1.04</td></tr>
            <tr><td>2024</td><td>1.02</td></tr>
            <tr><td>2025</td><td>1.00</td></tr>
          </tbody>
        </table>
        <p className="t"><em>Approximate values for illustrative purposes. Always verify the official AT despacho for the current year before filing.</em></p>

        <h2 className="s">4. Full Calculation Example</h2>
        <div className="example-block">
          <div className="example-title">Example: Lisbon Apartment Purchased 2015, Sold 2026</div>
          <table className="cost-table">
            <thead><tr><th>Item</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Sale price (2026)</td><td>€1,200,000</td></tr>
              <tr><td>Purchase price (2015)</td><td>€550,000</td></tr>
              <tr><td>Inflation coefficient (2015)</td><td>× 1.22</td></tr>
              <tr><td>Adjusted purchase price</td><td>€671,000</td></tr>
              <tr><td>Original acquisition costs (IMT + IS + notary)</td><td>€36,000</td></tr>
              <tr><td>Improvements (last 12 years, documented)</td><td>€45,000</td></tr>
              <tr><td>Sale costs (commission + lawyer + cert.)</td><td>€18,000</td></tr>
              <tr><td>Total deductions</td><td>€770,000</td></tr>
              <tr className="total-row"><td>Net taxable gain</td><td>€430,000</td></tr>
            </tbody>
          </table>
          <p className="t" style={{marginTop:'16px'}}>
            <strong>As a Portuguese resident</strong> (IFICI or standard): 50% of €430,000 = €215,000 added to income.
            At a marginal rate of 48%: tax on gains ≈ €103,200. Effective rate on total gain: ~24%.
          </p>
          <p className="t">
            <strong>As a non-resident (default)</strong>: €430,000 × 28% = €120,400. Non-resident election at resident
            rates may be more favorable depending on total worldwide income.
          </p>
        </div>

        <h2 className="s">5. The Reinvestment Exemption (Primary Residence)</h2>
        <p className="t">
          This is the most powerful capital gains exemption available in Portugal. If you sell your primary residence
          (habitação própria e permanente) and reinvest the proceeds in another primary residence, the gain is exempt
          from tax — in full or proportionally.
        </p>
        <table className="cost-table">
          <thead><tr><th>Condition</th><th>Detail</th></tr></thead>
          <tbody>
            <tr><td>Seller must be a Portuguese tax resident</td><td>And have been using the property as primary residence</td></tr>
            <tr><td>Reinvestment window</td><td>24 months before or 36 months after the sale</td></tr>
            <tr><td>Reinvestment destination</td><td>New primary residence in Portugal or another EU/EEA country</td></tr>
            <tr><td>Partial reinvestment</td><td>Exemption is proportional — e.g. reinvest 70% → 70% of gain exempt</td></tr>
            <tr><td>Declaration requirement</td><td>Must declare intention to reinvest in the year of sale (IRS return)</td></tr>
          </tbody>
        </table>
        <div className="callout">
          <p><strong>Key Point:</strong> The sale proceeds — not just the gain — must be reinvested. If you sell for €1,200,000 (with a €430,000 gain), you must reinvest the full €1,200,000 to achieve a 100% exemption. Reinvesting €900,000 gives a 75% exemption.</p>
        </div>

        <h2 className="s">6. Age Exemption — Over 65 Reinvesting in Life Annuity</h2>
        <p className="t">
          Sellers aged 65 or over (or retired, receiving a pension) can qualify for a capital gains exemption by
          reinvesting the sale proceeds in a life annuity (contrato de seguro de vida, plano de pensões, or equivalent)
          within 6 months of the sale.
        </p>
        <p className="t">
          The annuity must be payable monthly, for life, to the seller (and spouse). The exemption is proportional to
          the amount reinvested relative to the total sale proceeds. This exemption is independent of the primary
          residence exemption — it applies to any property, not just primary residences.
        </p>

        <h2 className="s">7. Strategic Tips to Minimize Capital Gains</h2>
        <div className="tip-grid">
          {[
            { icon: '01', title: 'Document all improvements', desc: 'Keep every invoice from licensed contractors with their NIF. Renovations in the last 12 years reduce your taxable gain euro for euro.' },
            { icon: '02', title: 'Time your sale', desc: 'Selling after establishing Portuguese tax residency and qualifying for IFICI can reduce effective CGT rate versus the flat 28% non-resident rate.' },
            { icon: '03', title: 'Use the reinvestment exemption', desc: 'If selling a primary residence, the 36-month reinvestment window gives you flexibility to buy at the right time and price.' },
            { icon: '04', title: 'Elect resident taxation', desc: 'Non-residents with modest global income should model whether electing resident taxation (50% of gain) beats the flat 28% rate.' },
            { icon: '05', title: 'Consider the age exemption', desc: 'Sellers over 65 selling any Portuguese property can potentially reinvest in a qualifying annuity and eliminate CGT entirely.' },
            { icon: '06', title: 'Engage a Portuguese tax adviser', desc: 'The rules interact in complex ways. A qualified adviser typically saves 5–10× their fee on transactions above €500K.' },
          ].map(t => (
            <div key={t.icon} className="tip-card">
              <div className="tip-icon">{t.icon}</div>
              <div className="tip-title">{t.title}</div>
              <p className="tip-desc">{t.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">8. Related Articles</h2>
        <p className="t">
          Capital gains are just one part of the Portuguese property tax picture. For the full acquisition cost breakdown,
          see our guide on <Link href="/blog/taxes-imt-portugal-2026" style={{ color: '#1c4a35', textDecoration: 'underline' }}>IMT and Property Taxes in Portugal 2026</Link>.
          For the complete buying process from NIF to deed, read our <Link href="/blog/buying-property-portugal-2026" style={{ color: '#1c4a35', textDecoration: 'underline' }}>Complete Guide for Foreign Buyers</Link>.
        </p>

        <div className="cta-box">
          <h3>Planning to sell property in Portugal?</h3>
          <p>Our advisors can model your exact capital gains tax position before you commit to a sale. Speak to a specialist today.</p>
          <Link href="/en">Contact an Advisor →</Link>
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
