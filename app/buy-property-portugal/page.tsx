import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Buy Property in Portugal 2026 — Complete Guide for Foreign Buyers | Agency Group',
  description: 'Step-by-step guide to buying property in Portugal in 2026. NIF, CPCV, IMT, mortgage, IFICI tax regime. Real costs, best areas, expert advice. AMI 22506.',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1',
  alternates: {
    canonical: 'https://www.agencygroup.pt/buy-property-portugal',
    languages: {
      'x-default': 'https://www.agencygroup.pt/buy-property-portugal',
      'en': 'https://www.agencygroup.pt/buy-property-portugal',
      'pt-PT': 'https://www.agencygroup.pt/buy-property-portugal',
    },
  },
  openGraph: {
    title: 'Buy Property in Portugal 2026 — Complete Foreign Buyer Guide',
    description: 'NIF to Deed — the complete process. IMT calculator, mortgage eligibility, IFICI regime, best areas ranked. €500K–€3M specialist.',
    type: 'article',
    url: 'https://www.agencygroup.pt/buy-property-portugal',
    siteName: 'Agency Group',
    locale: 'en_US',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Buy+Property+in+Portugal+2026&subtitle=Complete+Guide+for+Foreign+Buyers',
      width: 1200,
      height: 630,
      alt: 'Buy Property in Portugal 2026 — Agency Group Guide',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy Property in Portugal 2026 — Complete Guide',
    description: 'NIF to Deed. Real costs, best areas, IFICI tax regime. Expert foreign buyer advice.',
    site: '@agencygroup_pt',
  },
}

const PAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Buy Property in Portugal 2026: Complete Guide for Foreign Buyers',
  description: 'Step-by-step guide to buying property in Portugal in 2026. NIF, CPCV, IMT, mortgage, IFICI.',
  image: { '@type': 'ImageObject', url: 'https://www.agencygroup.pt/api/og?title=Buy+Property+in+Portugal+2026&subtitle=Foreign+Buyer+Guide', width: 1200, height: 630 },
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt', logo: { '@type': 'ImageObject', url: 'https://www.agencygroup.pt/logo.png' } },
  datePublished: '2026-04-15',
  dateModified: '2026-04-15',
  url: 'https://www.agencygroup.pt/buy-property-portugal',
  inLanguage: 'en-US',
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Can foreigners buy property in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — Portugal has no restrictions on foreign property ownership. EU, non-EU, and non-resident buyers can all purchase freely. You need a Portuguese NIF (tax number) and a local bank account.' } },
    { '@type': 'Question', name: 'How much does it cost to buy property in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Budget 7–10% of the purchase price for transaction costs: IMT (0–7.5%), Imposto do Selo (0.8%), notary and land registry (~0.5%), legal fees (~1%). On a €1M property, total closing costs are typically €75,000–€100,000.' } },
    { '@type': 'Question', name: 'What is the CPCV in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'The CPCV (Contrato-Promessa de Compra e Venda) is the promissory purchase contract. You pay 10–30% deposit and commit to complete within 60–90 days. If the buyer pulls out, the deposit is forfeited. If the seller pulls out, they must return double the deposit.' } },
    { '@type': 'Question', name: 'What is the IFICI / NHR regime for Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'IFICI (the replacement for NHR) offers a flat 20% income tax on Portuguese-sourced income for qualifying foreign residents for 10 years. It applies to new residents who have not been tax resident in Portugal in the past 5 years.' } },
    { '@type': 'Question', name: 'How long does it take to buy property in Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Typically 60–120 days from offer accepted to completion. Get your NIF and bank account first (1–2 weeks). CPCV typically 2–4 weeks after offer. Deed (Escritura) 60–90 days after CPCV.' } },
  ],
}

const BREADCRUMB_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.agencygroup.pt' },
    { '@type': 'ListItem', position: 2, name: 'Buy Property in Portugal', item: 'https://www.agencygroup.pt/buy-property-portugal' },
  ],
}

export default function BuyPropertyPortugalPage() {
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
        .hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 10% 85%,rgba(28,74,53,.6),transparent)}
        .hero-inner{max-width:900px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .cat{display:inline-block;background:#1c4a35;color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,5vw,3.4rem);font-weight:300;color:#f4f0e6;line-height:1.1;margin-bottom:20px}
        .h1 em{color:#c9a96e;font-style:italic}
        .hero-sub{font-family:var(--font-jost),sans-serif;font-size:.9rem;color:rgba(244,240,230,.55);line-height:1.7;max-width:620px;margin-bottom:32px}
        .hero-cta{display:inline-flex;align-items:center;gap:12px;background:#c9a96e;color:#0c1f15;text-decoration:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;transition:all .2s}
        .hero-cta:hover{background:#e2c08a}
        .content{max-width:900px;margin:0 auto;padding:72px 56px;background:#f4f0e6}
        .lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2{font-family:var(--font-cormorant),serif;font-size:clamp(1.4rem,3vw,2rem);font-weight:300;color:#0c1f15;margin:52px 0 20px;line-height:1.2}
        h2 em{color:#1c4a35;font-style:italic}
        h3{font-family:var(--font-jost),sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.08em;color:#1c4a35;text-transform:uppercase;margin:32px 0 12px}
        p{font-size:.88rem;line-height:1.9;color:rgba(14,14,13,.75);margin-bottom:20px}
        ul,ol{padding-left:24px;margin-bottom:20px}
        li{font-size:.88rem;line-height:1.9;color:rgba(14,14,13,.75);margin-bottom:6px}
        .box{background:#0c1f15;border:1px solid rgba(201,169,110,.25);padding:32px;margin:40px 0}
        .box-title{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.55);text-transform:uppercase;margin-bottom:12px}
        .box-h{font-family:var(--font-cormorant),serif;font-size:1.4rem;font-weight:300;color:#f4f0e6;margin-bottom:16px}
        .box p{color:rgba(244,240,230,.6)}
        .steps{counter-reset:steps;margin:0;padding:0;list-style:none}
        .step{counter-increment:steps;padding:24px 0 24px 68px;border-bottom:1px solid rgba(14,14,13,.08);position:relative}
        .step::before{content:counter(steps,'0'counter(steps));position:absolute;left:0;top:24px;font-family:var(--font-dm-mono),monospace;font-size:1.4rem;color:rgba(201,169,110,.25);font-weight:300;line-height:1}
        .step strong{display:block;font-family:var(--font-jost),sans-serif;font-size:.82rem;font-weight:600;color:#0c1f15;margin-bottom:6px;letter-spacing:.03em}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0}
        .cost-table th{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(14,14,13,.4);padding:10px 16px;border-bottom:1px solid rgba(14,14,13,.1);text-align:left}
        .cost-table td{font-size:.82rem;padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.06);color:rgba(14,14,13,.75)}
        .cost-table tr:last-child td{font-weight:600;color:#0c1f15;border-bottom:none}
        .areas{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin:24px 0}
        .area-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:20px;transition:all .2s}
        .area-card:hover{border-color:rgba(201,169,110,.4)}
        .area-name{font-family:var(--font-cormorant),serif;font-size:1.1rem;font-weight:300;color:#0c1f15;margin-bottom:4px}
        .area-price{font-family:var(--font-dm-mono),monospace;font-size:.5rem;color:#1c4a35;letter-spacing:.12em}
        .area-note{font-size:.72rem;color:rgba(14,14,13,.5);margin-top:6px}
        .faq{margin:8px 0}
        .faq-q{font-family:var(--font-jost),sans-serif;font-size:.88rem;font-weight:500;color:#0c1f15;margin:0 0 8px;cursor:default}
        .faq-a{font-size:.84rem;line-height:1.8;color:rgba(14,14,13,.68);margin:0 0 28px;padding-bottom:28px;border-bottom:1px solid rgba(14,14,13,.07)}
        .cta-section{background:#0c1f15;padding:80px 56px;text-align:center;margin-top:0}
        .cta-section .cat{margin:0 auto 20px}
        .cta-h{font-family:var(--font-cormorant),serif;font-size:clamp(1.6rem,4vw,2.6rem);font-weight:300;color:#f4f0e6;margin-bottom:16px}
        .cta-h em{color:#c9a96e;font-style:italic}
        .cta-sub{font-size:.82rem;color:rgba(244,240,230,.5);max-width:520px;margin:0 auto 32px;line-height:1.7}
        .cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
        .btn-gold{background:#c9a96e;color:#0c1f15;text-decoration:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;transition:all .2s}
        .btn-outline{background:transparent;color:rgba(244,240,230,.7);text-decoration:none;padding:14px 32px;font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;border:1px solid rgba(201,169,110,.3);transition:all .2s}
        footer{background:#080f0a;padding:40px 56px;text-align:center}
        footer p{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;color:rgba(244,240,230,.2);line-height:2}
        footer a{color:rgba(201,169,110,.45);text-decoration:none}
        footer a:hover{color:#c9a96e}
        @media(max-width:768px){
          nav{padding:16px 24px}
          .hero-inner,.content,.cta-section{padding-left:24px;padding-right:24px}
          .hero{padding:110px 0 60px}
          .content{padding-top:48px;padding-bottom:48px}
          .cost-table{font-size:.78rem}
          .cta-btns{flex-direction:column;align-items:center}
          footer{padding:32px 24px}
        }
      `}</style>

      {/* Nav */}
      <nav>
        <Link href="/" className="logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <Link href="/imoveis" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.5rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>
          View Properties →
        </Link>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="breadcrumb">
            <Link href="/">Home</Link> / Buy Property in Portugal
          </div>
          <div className="cat">Complete Buyer Guide · 2026</div>
          <h1 className="h1">Buy Property in Portugal 2026<br /><em>The Foreign Buyer's Guide</em></h1>
          <p className="hero-sub">
            Everything you need to know — from NIF to Deed. Transaction costs, best areas,
            mortgage eligibility for non-residents, IFICI tax regime, and the exact step-by-step
            process used by international buyers in 2026.
          </p>
          <Link href="/contacto" className="hero-cta">Book a Free Consultation →</Link>
        </div>
      </section>

      {/* Content */}
      <article className="content">
        <p className="lead">
          Portugal remains one of Europe's most accessible real estate markets for foreign buyers — no ownership restrictions, competitive prices relative to comparable Western European locations, a stable legal framework, and exceptional lifestyle value. In 2026, the market recorded 169,812 transactions at a median of €3,076/m², with luxury markets in Lisbon, Cascais, and the Algarve continuing to outperform.
        </p>

        <h2>Can Foreigners Buy Property in <em>Portugal</em>?</h2>
        <p>
          Yes — Portugal imposes no restrictions on foreign property ownership. EU citizens, non-EU citizens, and non-residents can all purchase freely, in any location, at any price point. The only requirements are:
        </p>
        <ul>
          <li>A Portuguese NIF (Número de Identificação Fiscal) — your tax identification number</li>
          <li>A Portuguese bank account (required for mortgage financing; optional for cash purchases)</li>
          <li>A valid passport or EU identity card</li>
        </ul>

        <div className="box">
          <div className="box-title">Pro Tip · Agency Group</div>
          <div className="box-h">Get Your NIF Before You Fly</div>
          <p>You can obtain a Portuguese NIF in one day at any Finanças office, or remotely via a Portuguese lawyer acting as your fiscal representative. Cost: €0–€300. Without an NIF, you cannot sign any purchase documents — get it first.</p>
        </div>

        <h2>The <em>Step-by-Step</em> Buying Process</h2>
        <p>Here is the exact process used by international buyers working with Agency Group in 2026:</p>

        <ol className="steps">
          <li className="step">
            <strong>Obtain NIF + Open Bank Account</strong>
            Required for all transactions. Takes 1 day in person, 1–2 weeks remotely. Recommended banks for non-residents: Millennium BCP, Santander Portugal, BPI, Caixa Geral de Depósitos.
          </li>
          <li className="step">
            <strong>Property Search + Offer</strong>
            Work with Agency Group to identify on-market and off-market opportunities. Submit a written Letter of Offer specifying price, conditions, and timeline. Negotiation typically achieves 3–8% below asking price in the current market.
          </li>
          <li className="step">
            <strong>Legal Due Diligence</strong>
            Your Portuguese lawyer checks: title deed, land registry, caderneta predial (tax register), licença de utilização (habitation licence), energy certificate, outstanding charges. Budget: €1,500–€3,000 for a standard transaction.
          </li>
          <li className="step">
            <strong>CPCV — Promissory Contract</strong>
            Contrato-Promessa de Compra e Venda signed with a 10–30% deposit. Legally binding on both parties. If buyer withdraws: deposit is forfeited. If seller withdraws: double deposit returned. Typical timeline to Deed: 60–90 days.
          </li>
          <li className="step">
            <strong>Pay IMT + Imposto do Selo</strong>
            Paid before the Deed. IMT calculated on purchase price (see table below). Imposto do Selo: 0.8% of purchase price. Paid at Finanças or online via Portal das Finanças.
          </li>
          <li className="step">
            <strong>Escritura — Public Deed</strong>
            Signed before a Notary. Title transfers. Land registry updated within 5 days. Agency Group accompanies you at the Notary — before, during, and after.
          </li>
        </ol>

        <h2>Transaction Costs: <em>What You Actually Pay</em></h2>
        <p>Budget 7–10% of the purchase price for all transaction costs. Here is a realistic breakdown for a €1,000,000 property (principal residence):</p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Cost</th>
              <th>Rate</th>
              <th>On €1M</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>IMT — Property Transfer Tax</td><td>Marginal rates 0–7.5%</td><td>~€52,000</td></tr>
            <tr><td>Imposto do Selo (Stamp Duty)</td><td>0.8%</td><td>€8,000</td></tr>
            <tr><td>Notary + Land Registry</td><td>~0.3–0.5%</td><td>~€3,500</td></tr>
            <tr><td>Legal Fees (lawyer)</td><td>0.5–1.5%</td><td>~€8,000</td></tr>
            <tr><td>Agency Commission (seller pays)</td><td>5% + VAT</td><td>€0 to buyer</td></tr>
            <tr><td><strong>Total Buyer Costs</strong></td><td></td><td><strong>~€71,500 (7.15%)</strong></td></tr>
          </tbody>
        </table>

        <p style={{ fontSize: '.78rem', opacity: .6 }}>Note: IMT is exempt on properties below €97,064 for primary residence. Higher rates apply to non-resident investment purchases. Always verify current rates with your lawyer.</p>

        <h2>Best Areas to Buy in <em>Portugal 2026</em></h2>
        <div className="areas">
          {[
            { name: 'Lisboa', slug: 'lisboa', price: '€5,000/m²', note: 'Finest address in Iberia. Príncipe Real, Chiado, Lapa dominate luxury demand.' },
            { name: 'Cascais', slug: 'cascais', price: '€4,713/m²', note: 'Atlantic coast. Families, HNWI expats. Strong rental yields. 25min from Lisbon.' },
            { name: 'Comporta', slug: 'comporta', price: '€4,200/m²', note: 'Ultra-exclusive. Cap Ferret of Portugal. Dunes, rice fields, no mass tourism.' },
            { name: 'Algarve', slug: 'algarve', price: '€3,941/m²', note: 'Golden Triangle: Quinta do Lago, Vale do Lobo, Vilamoura. Golf, sea, sun.' },
            { name: 'Porto', slug: 'porto', price: '€3,643/m²', note: 'Emerging luxury. Foz do Douro, Boavista. Strong appreciation momentum.' },
            { name: 'Madeira', slug: 'madeira', price: '€3,760/m²', note: 'Tax-advantaged. Funchal residences + Calheta. Growing HNWI demand.' },
            { name: 'Sintra', slug: 'sintra', price: '€3,200/m²', note: 'UNESCO-listed palaces. Quintas & estates. 40min from Lisbon.' },
            { name: 'Açores', slug: null, price: '€1,952/m²', note: 'Emerging market. Lowest entry point. Exceptional natural beauty.' },
          ].map(a => (
            a.slug ? (
              <Link key={a.name} href={`/zonas/${a.slug}`} className="area-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <div className="area-name">{a.name} →</div>
                <div className="area-price">Avg. {a.price}</div>
                <div className="area-note">{a.note}</div>
              </Link>
            ) : (
              <div key={a.name} className="area-card">
                <div className="area-name">{a.name}</div>
                <div className="area-price">Avg. {a.price}</div>
                <div className="area-note">{a.note}</div>
              </div>
            )
          ))}
        </div>

        <h2>The IFICI / NHR Tax Regime for <em>New Residents</em></h2>
        <p>
          Since January 2024, Portugal replaced the NHR (Non-Habitual Resident) regime with IFICI (Incentivo Fiscal à Investigação Científica e Inovação), colloquially still called "NHR 2.0". For most buyers relocating to Portugal, this offers:
        </p>
        <ul>
          <li><strong>20% flat rate</strong> on Portuguese-sourced employment and self-employment income</li>
          <li><strong>10-year duration</strong> — starting from the year you become tax resident</li>
          <li><strong>Eligible categories:</strong> high-value activities including tech, finance, real estate, research, and qualified professions</li>
          <li><strong>Condition:</strong> not been tax resident in Portugal in the past 5 years</li>
          <li><strong>Foreign pension income:</strong> exempt from Portuguese tax under many double taxation treaties</li>
        </ul>
        <p>
          Agency Group works with specialist tax lawyers who calculate your exact benefit before you commit. <Link href="/contacto" style={{ color: '#1c4a35', textDecoration: 'underline' }}>Request a free IFICI consultation →</Link>
        </p>

        <h2>Mortgage for <em>Non-Residents</em></h2>
        <p>
          Portuguese banks lend to non-residents and non-EU citizens. Key parameters in 2026:
        </p>
        <ul>
          <li><strong>LTV:</strong> Up to 80% for EU residents; 60–70% for non-EU non-residents</li>
          <li><strong>Rate:</strong> Euribor 6M + spread 0.9–1.8% (variable); fixed rates 2.8–3.4% available</li>
          <li><strong>DSTI:</strong> Monthly instalments must not exceed 35–40% of net monthly income</li>
          <li><strong>Currency income:</strong> USD, GBP, AED income accepted by most Portuguese banks (converted at official rates)</li>
          <li><strong>Documents required:</strong> Last 3 months payslips or 2 years tax returns (self-employed), 3 months bank statements, property valuation</li>
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

        <div className="box">
          <div className="box-title">Agency Group · AMI 22506</div>
          <div className="box-h">Why Work with a Specialist?</div>
          <p>
            Agency Group focuses exclusively on the €500K–€10M segment in Portugal and Spain.
            We have access to off-market properties that never appear on public portals,
            a network of trusted notaries, lawyers, and tax advisors, and
            direct relationships with 16 Portuguese and international banks for mortgage pre-approval.
          </p>
          <p>Our commission is paid by the seller (5% + VAT). Your consultation is free.</p>
        </div>
      </article>

      {/* CTA */}
      <section className="cta-section">
        <div className="cat">Ready to Buy?</div>
        <h2 className="cta-h">Start Your Search <em>Today</em></h2>
        <p className="cta-sub">Browse curated properties €500K–€10M or request a private consultation with our team of specialists. No obligation.</p>
        <div className="cta-btns">
          <Link href="/imoveis" className="btn-gold">View Properties →</Link>
          <Link href="/contacto" className="btn-outline">Free Consultation</Link>
        </div>
      </section>

      {/* Related Links */}
      <section style={{ background: '#f4f0e6', padding: '60px 56px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.46rem', letterSpacing: '.2em', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', marginBottom: '24px' }}>Related Guides</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '16px' }}>
          {[
            { href: '/invest-in-portugal-real-estate', label: 'Invest in Portuguese Real Estate →' },
            { href: '/off-market-portugal', label: 'Off-Market Properties Portugal →' },
            { href: '/blog/buying-property-portugal-2026', label: 'Buying Property Portugal — Full Guide →' },
            { href: '/blog/nhr-portugal-2026-guide', label: 'NHR / IFICI 2026 Tax Guide →' },
            { href: '/blog/luxury-property-lisbon', label: 'Luxury Property in Lisbon →' },
            { href: '/imoveis', label: 'Browse All Properties →' },
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
