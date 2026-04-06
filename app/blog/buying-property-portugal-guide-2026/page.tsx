import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'The Complete Guide to Buying Property in Portugal 2026 · Agency Group',
  description: 'Step-by-step guide to buying property in Portugal 2026. NIF, bank account, CPCV, IMT rates, Escritura. Total costs 6-8%. Timeline 4-12 weeks. AMI 22506.',
  keywords: 'buying property portugal 2026, how to buy house portugal, portugal property purchase guide, NIF portugal, CPCV portugal, IMT rates 2026',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/buying-property-portugal-guide-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/buying-property-portugal-guide-2026',
    },
  },
  openGraph: {
    title: 'The Complete Guide to Buying Property in Portugal 2026',
    description: 'NIF, CPCV, due diligence, IMT taxes, Escritura — the entire process for international buyers. Real costs, timelines, and insider tips. AMI 22506.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/buying-property-portugal-guide-2026',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Complete Guide to Buying Property in Portugal 2026',
  description: 'Step-by-step guide to buying property in Portugal in 2026 for international buyers. NIF, CPCV, IMT, Escritura, costs and timeline.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/buying-property-portugal-guide-2026',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'Buying property in Portugal 2026' },
    { '@type': 'Thing', name: 'Portugal property purchase guide' },
    { '@type': 'Thing', name: 'Portugal NIF CPCV Escritura' },
  ],
}

export default function ArticleBuyingPropertyGuide2026() {
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
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 70% at 80% 20%,rgba(201,169,110,.08),transparent)}
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
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → buying-property-portugal-guide-2026
          </div>
          <div className="art-cat">Buyer&apos;s Guide</div>
          <h1 className="art-h1">The Complete Guide to<br />Buying Property in Portugal<br /><em>2026 Edition</em></h1>
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
          Over 169,000 properties changed hands in Portugal in 2025 — an all-time record. International buyers
          account for more than 25% of all transactions above €500,000, attracted by EU legal certainty, IFICI
          tax benefits, and some of the most competitive luxury pricing in Western Europe. If you are considering
          buying property in Portugal in 2026, this is the only guide you need: seven clear steps, real costs,
          current IMT rates, and the exact documentation required.
        </p>

        <h2 className="s">Step 1 — Get Your NIF (Tax Identification Number)</h2>
        <p className="t">
          The NIF (Número de Identificação Fiscal) is the foundation of every Portuguese property transaction.
          Without it, you cannot open a bank account, sign a contract, or pay taxes. As a non-resident, you
          can obtain your NIF at any Finanças office with your passport — it takes under one hour. Alternatively,
          a Portuguese lawyer can obtain it on your behalf remotely, which is the preferred route for buyers
          purchasing before relocating. Non-residents must appoint a fiscal representative.
        </p>

        <h2 className="s">Step 2 — Open a Portuguese Bank Account</h2>
        <p className="t">
          Portuguese banks require funds to be transferred through the local banking system for property
          transactions. The main banks for foreign buyers are Millennium BCP, Caixa Geral de Depósitos (CGD),
          and Novobanco — all have English-speaking international teams. Required documents: NIF, valid passport,
          proof of address from your home country, and proof of income source. Account opening typically takes
          5–10 business days. Many buyers open accounts during a scouting visit to Portugal.
        </p>

        <h2 className="s">Step 3 — Choose Your Location</h2>
        <p className="t">Portugal offers distinct markets at very different price points. Your choice should reflect lifestyle priorities, investment horizon, and budget:</p>

        <div className="loc-grid">
          {[
            { name: 'Lisboa', price: '€5,000 / m²', desc: 'Capital. Chiado, Príncipe Real and Avenida da Liberdade reach €10,000+/m². Top 5 global luxury market. Highest liquidity.' },
            { name: 'Cascais', price: '€4,713 / m²', desc: 'Atlantic coast, 30 min from Lisbon. International schools, golf, marina. Strong British and American expat community.' },
            { name: 'Porto', price: '€3,643 / m²', desc: 'Second city. UNESCO historic centre, Foz do Douro riverfront, Matosinhos beach. Rental yields 4–5%. Growing fast.' },
            { name: 'Algarve', price: '€3,941 / m²', desc: 'Southern resort coast. Golden Triangle (Vale do Lobo, Quinta do Lago, Vilamoura) commands €5,000–€12,000/m².' },
            { name: 'Madeira', price: '€3,760 / m²', desc: 'Atlantic island, year-round mild climate. +28% YoY in 2026 — fastest growing market in Portugal. IFICI applies.' },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">Step 4 — Make an Offer and Sign the CPCV</h2>
        <p className="t">
          Once you identify your property, your agent submits a written offer specifying price, conditions, and
          a response deadline (typically 48–72 hours). In Portugal, agency commissions (5% + VAT) are paid
          exclusively by the seller — buyer representation costs you nothing.
        </p>
        <p className="t">
          After acceptance, you sign the CPCV (Contrato-Promessa de Compra e Venda) — a legally binding
          preliminary purchase contract. The standard deposit is 10–30% of the agreed price. The CPCV locks
          the property: if the buyer withdraws without justification, the deposit is forfeited. If the seller
          withdraws, they must return double the deposit. Always have a lawyer review the CPCV before signing.
        </p>

        <h2 className="s">Step 5 — Due Diligence</h2>
        <p className="t">
          Due diligence in Portugal covers four key documents: the <strong>certidão predial</strong> (land
          registry certificate confirming ownership and charges), the <strong>caderneta predial urbana</strong>
          (tax record with cadastral value), the <strong>licença de utilização</strong> (habitation licence),
          and the <strong>certificado energético</strong> (energy performance certificate — mandatory for all
          sales). Your lawyer will also verify that there are no outstanding condominium debts, mortgages, or
          tax liens attached to the property.
        </p>

        <div className="callout">
          <p><strong>Critical check:</strong> Always verify that the property&apos;s description in the land registry matches its physical reality (area, boundaries, outbuildings). Discrepancies are common in older properties and must be rectified before the deed. Budget €1,500–€3,000 for a full legal review — it can save you €50,000+ in disputes.</p>
        </div>

        <h2 className="s">Step 6 — Final Deed (Escritura)</h2>
        <p className="t">
          The Escritura Pública de Compra e Venda is the final transfer deed, executed before a licensed
          notary. Before signing, you must pay IMT and Stamp Duty to the Portuguese tax authority (AT).
          The notary verifies all documents, reads the deed aloud, and both parties sign. The remaining
          purchase price (70–90%) is transferred on the day of signing via certified bank cheque or wire
          transfer. The process takes approximately 2 hours.
        </p>

        <h2 className="s">Step 7 — Register at the Land Registry</h2>
        <p className="t">
          After the deed, your lawyer or the notary submits the registration to the Conservatória do Registo
          Predial. Registration is confirmed within 2–5 business days. Only at this point is your ownership
          officially recorded and fully protected under Portuguese law. You will also need to update the
          caderneta predial at Finanças to reflect the new ownership.
        </p>

        <h2 className="s">Taxes and Total Acquisition Costs</h2>
        <h3 className="ss">IMT — Property Transfer Tax (2026 Rates)</h3>
        <table className="cost-table">
          <thead><tr><th>Purchase Price (Primary Residence)</th><th>IMT Rate</th></tr></thead>
          <tbody>
            <tr><td>Up to €97,064</td><td>0% (exempt)</td></tr>
            <tr><td>€97,064 – €132,774</td><td>2%</td></tr>
            <tr><td>€132,774 – €181,034</td><td>5%</td></tr>
            <tr><td>€181,034 – €301,688</td><td>7%</td></tr>
            <tr><td>€301,688 – €603,289</td><td>8%</td></tr>
            <tr><td>Above €603,289 (primary residence)</td><td>6% flat</td></tr>
            <tr><td>Investment / secondary / non-resident</td><td>7.5% above €1M</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Total Transaction Cost Breakdown (€500,000 investment purchase)</h3>
        <table className="cost-table">
          <thead><tr><th>Cost Item</th><th>Rate</th><th>Estimated Amount</th></tr></thead>
          <tbody>
            <tr><td>IMT (Property Transfer Tax)</td><td>~6%</td><td>€30,000</td></tr>
            <tr><td>Stamp Duty (Imposto de Selo)</td><td>0.8%</td><td>€4,000</td></tr>
            <tr><td>Notary + Land Registry</td><td>Fixed</td><td>€1,200–€2,000</td></tr>
            <tr><td>Lawyer (due diligence + deed)</td><td>0.5–1%</td><td>€2,500–€5,000</td></tr>
            <tr><td>Agency commission (paid by seller)</td><td>5% + VAT</td><td>€0 to buyer</td></tr>
            <tr><td>Total acquisition costs</td><td>~7–8%</td><td>€37,700–€41,000</td></tr>
          </tbody>
        </table>

        <p className="t">
          Annual property tax (IMI) runs at 0.3–0.45% of the cadastral value (valor patrimonial tributário),
          which is typically set at 20–50% below market value. For a €500,000 property, expect annual IMI
          of €500–€900. Portfolios above €600,000 attract AIMI (Additional IMI) at 0.7–1.5%.
        </p>

        <h2 className="s">Timeline: From Offer to Keys</h2>
        <table className="cost-table">
          <thead><tr><th>Stage</th><th>Typical Duration</th></tr></thead>
          <tbody>
            <tr><td>NIF + bank account (can be done in advance)</td><td>1–2 weeks</td></tr>
            <tr><td>Property search and visits</td><td>1–8 weeks</td></tr>
            <tr><td>Due diligence + negotiation</td><td>1–2 weeks</td></tr>
            <tr><td>CPCV signing</td><td>Within 1 week of acceptance</td></tr>
            <tr><td>CPCV to Escritura (cash purchase)</td><td>4–6 weeks</td></tr>
            <tr><td>CPCV to Escritura (with mortgage)</td><td>8–12 weeks</td></tr>
            <tr><td>Land registry confirmation</td><td>2–5 business days after deed</td></tr>
          </tbody>
        </table>

        <div className="cta-box">
          <h3>Get your free buyer&apos;s guide — speak with a licensed advisor</h3>
          <p>Agency Group (AMI 22506) provides bilingual, full-service transaction support at zero cost to the buyer. We cover Lisboa, Cascais, Algarve, Porto, Madeira and beyond.</p>
          <a href="tel:+351919948986">+351 919 948 986 · Request Free Buyer&apos;s Guide</a>
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
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer Guide</Link>
            <Link href="/blog/taxes-imt-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>IMT &amp; Taxes</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
