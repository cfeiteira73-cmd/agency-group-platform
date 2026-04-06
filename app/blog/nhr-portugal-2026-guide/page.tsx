import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'NHR Portugal 2026: Complete IFICI Tax Guide for Foreign Residents · Agency Group',
  description: 'Complete guide to NHR Portugal 2026 and the new IFICI regime. Eligible income, 20% flat tax rate, how to apply, real examples for Americans, French and British. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
      'pt': 'https://www.agencygroup.pt/blog/nhr-ifici-guia-completo',
      'x-default': 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
    },
  },
  openGraph: {
    title: 'NHR Portugal 2026: Complete IFICI Tax Guide for Foreign Residents',
    description: 'NHR replaced by IFICI in 2024. 20% flat tax for 10 years. Eligible income, who qualifies, step-by-step application. Real case studies.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
    locale: 'en_US',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'NHR Portugal 2026: Complete IFICI Tax Guide for Foreign Residents',
  description: 'Complete guide to NHR Portugal 2026 and the new IFICI regime. Eligible income, 20% flat tax, how to apply, real examples.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
  inLanguage: 'en-US',
  about: [
    { '@type': 'Thing', name: 'NHR Portugal 2026' },
    { '@type': 'Thing', name: 'IFICI Portugal tax regime' },
    { '@type': 'Thing', name: 'Portugal non-habitual resident' },
  ],
}

export default function ArticleNHRPortugal2026() {
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
        .faq-item{border-bottom:1px solid rgba(14,14,13,.08);padding:24px 0}
        .faq-q{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.88rem;color:#1c4a35;margin-bottom:10px}
        .faq-a{font-size:.85rem;line-height:1.8;color:rgba(14,14,13,.65)}
        .case-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:28px;margin-bottom:20px}
        .case-tag{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.18em;text-transform:uppercase;color:#c9a96e;margin-bottom:10px}
        .case-title{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.1rem;color:#1c4a35;margin-bottom:12px}
        .case-body{font-size:.84rem;line-height:1.8;color:rgba(14,14,13,.65)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
        <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>← Blog</Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → nhr-portugal-2026-guide
          </div>
          <div className="art-cat">Tax Guide</div>
          <h1 className="art-h1">NHR Portugal 2026:<br /><em>Complete IFICI Tax Guide for Foreign Residents</em></h1>
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
          Portugal&apos;s Non-Habitual Resident (NHR) regime was one of the most generous tax incentives available to
          relocating foreigners anywhere in Europe. In 2024, it was replaced by the IFICI — Incentivo Fiscal à
          Investigação Científica e Inovação. The new regime is more targeted, but still highly advantageous for
          qualifying individuals: a 20% flat income tax rate for 10 years on qualifying Portuguese-source income,
          with potential exemption on foreign-source income. This guide explains everything you need to know — what
          changed, who qualifies, how to apply, and what the real tax savings look like with concrete examples.
        </p>

        <div className="callout">
          <p><strong>Important Disclaimer:</strong> This article is for informational purposes only and does not constitute legal or tax advice. Portuguese tax law is complex. Always engage a qualified Portuguese tax adviser before making relocation or tax planning decisions. <strong>Agency Group partners with leading tax and legal firms in Lisbon, Cascais, Porto, and the Algarve.</strong></p>
        </div>

        <h2 className="s">1. What Changed — NHR to IFICI</h2>
        <p className="t">
          The original NHR regime (introduced 2009) provided a 10-year flat tax of 20% on qualifying Portuguese-source
          income and full exemption on most foreign-source income (dividends, interest, capital gains, pensions, rental
          income from abroad). It was available to any non-resident who established Portuguese tax residency and had
          not been resident in the previous 5 years.
        </p>
        <p className="t">
          From 1 January 2024, NHR was closed to new applicants. The successor regime — IFICI — maintains the
          10-year duration and the 20% flat tax rate on qualifying employment and self-employment income from
          Portuguese sources, but narrows eligibility to specific professional categories and activities deemed
          strategically important to Portugal.
        </p>
        <p className="t">
          Existing NHR holders (registered before December 31, 2023) remain on the original regime for the remainder
          of their 10-year period. IFICI represents a significant narrowing of scope — but for qualifying individuals
          (tech workers, researchers, investment professionals, qualified expats), the tax benefit is substantial.
        </p>

        <h2 className="s">2. IFICI — Who Qualifies</h2>
        <p className="t">
          The IFICI regime targets individuals working in specific high-value categories. Eligibility requires
          employment or self-employment in one of the following activities:
        </p>

        <table className="cost-table">
          <thead><tr><th>Category</th><th>Examples</th><th>Documentation Required</th></tr></thead>
          <tbody>
            <tr><td>Scientific Research &amp; Innovation</td><td>Researchers, PhD scientists, R&amp;D professionals</td><td>Research institution contract or university affiliation</td></tr>
            <tr><td>Qualified Tech &amp; Information Technology</td><td>Software engineers, data scientists, AI/ML professionals</td><td>Employment contract with qualifying company</td></tr>
            <tr><td>Highly Qualified Professionals</td><td>Doctors, lawyers, architects, engineers, financial analysts</td><td>Professional qualification certificate + employment proof</td></tr>
            <tr><td>Start-up &amp; Innovation Economy</td><td>Founders, senior executives at certified start-ups</td><td>IAPMEI start-up certification + role documentation</td></tr>
            <tr><td>Investment Management</td><td>Fund managers, private equity, venture capital</td><td>CMVM registration or equivalent regulatory approval</td></tr>
            <tr><td>Teaching &amp; Academic Staff</td><td>University professors at Portuguese institutions</td><td>University contract in qualifying institution</td></tr>
          </tbody>
        </table>

        <p className="t">
          Self-employed individuals (trabalhadores independentes) can qualify if they work in eligible activity codes.
          Retirees and passive income recipients do not qualify for IFICI — for these profiles, other visa and residency
          routes (D7, D8) may be more appropriate.
        </p>

        <h2 className="s">3. Tax Rates — IFICI vs Standard Portugal vs UK/US</h2>
        <table className="cost-table">
          <thead><tr><th>Income Level</th><th>IFICI Rate</th><th>Portugal Standard</th><th>UK Rate</th><th>US Federal Rate</th></tr></thead>
          <tbody>
            <tr><td>€80,000</td><td>20%</td><td>37%</td><td>40%</td><td>22–24%</td></tr>
            <tr><td>€150,000</td><td>20%</td><td>48%</td><td>45%</td><td>32–35%</td></tr>
            <tr><td>€300,000</td><td>20%</td><td>48% + surcharges</td><td>45%</td><td>35–37%</td></tr>
            <tr><td>€500,000</td><td>20%</td><td>48% + surcharges</td><td>45%</td><td>37%</td></tr>
            <tr><td>Annual saving at €300K</td><td>—</td><td>€84,000 vs standard PT</td><td>€75,000 vs UK</td><td>variable (treaty)</td></tr>
          </tbody>
        </table>

        <p className="t">
          Note: US citizens remain subject to US worldwide taxation regardless of country of residence. However, the
          Foreign Earned Income Exclusion (FEIE) and Foreign Tax Credit (FTC) mechanisms can significantly reduce or
          eliminate double taxation. The Portugal–US Tax Treaty provides additional relief. Americans relocating to
          Lisbon should engage both a Portuguese tax adviser and a US CPA specialising in expat taxation.
        </p>

        <h2 className="s">4. Foreign Income Under IFICI</h2>
        <p className="t">
          Under IFICI, the treatment of foreign-source income is more nuanced than under the original NHR and depends
          on the applicable double tax treaty (DTT) between Portugal and the source country:
        </p>
        <table className="cost-table">
          <thead><tr><th>Income Type</th><th>IFICI Treatment</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Foreign employment income (qualifying activity)</td><td>20% flat rate or exempt (DTT-dependent)</td><td>Must be taxed in source country to qualify for exemption</td></tr>
            <tr><td>Foreign dividends</td><td>28% withholding or exempt (DTT)</td><td>OECD-model countries: generally exempt</td></tr>
            <tr><td>Foreign interest</td><td>28% withholding or exempt (DTT)</td><td>Similar DTT rules apply</td></tr>
            <tr><td>Foreign pensions</td><td>10% flat rate (if from qualifying activity)</td><td>Changed from original NHR full exemption</td></tr>
            <tr><td>Foreign rental income</td><td>Exempt if taxed abroad (DTT)</td><td>Must declare even if exempt</td></tr>
            <tr><td>Foreign capital gains (property)</td><td>Exempt or 28% (DTT-dependent)</td><td>Complex — requires case-by-case analysis</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. How to Apply — Step by Step</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Establish Tax Residency', d: 'Move to Portugal. Register your address with the local Junta de Freguesia and update your NIF with your Portuguese address at Finanças. You must spend 183+ days/year in Portugal OR maintain a habitual residence here.' },
            { n: '02', t: 'Obtain Portuguese NIF', d: 'If not already obtained, get your NIF (Número de Identificação Fiscal) at a Finanças office or via a lawyer. Essential for all subsequent steps. Non-residents can appoint a fiscal representative.' },
            { n: '03', t: 'Register as Tax Resident', d: 'File a change-of-address request with Autoridade Tributária e Aduaneira (AT), updating your status from non-resident to resident. This triggers your residency start date.' },
            { n: '04', t: 'Apply for IFICI', d: 'Submit the IFICI application via the AT portal (Portal das Finanças) in the year of residency establishment OR the following year. Include employment contract, professional qualifications, and activity documentation.' },
            { n: '05', t: 'AT Review', d: 'Autoridade Tributária reviews your application and documentation. Processing time: 4–8 weeks. AT may request additional documents. Approval is retroactive to your residency start date.' },
            { n: '06', t: 'Annual Tax Returns', d: 'File Portuguese IRS (Declaração Modelo 3) annually by June 30. Declare all worldwide income. IFICI rate (20%) applies automatically to qualifying income categories once registered.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. Real Case Studies</h2>

        <div className="case-card">
          <div className="case-tag">Case Study 01</div>
          <div className="case-title">American Tech Executive — San Francisco to Lisbon</div>
          <p className="case-body">
            <strong>Profile:</strong> Software engineering director at a US tech company. Remote work contract. Annual
            compensation: $420,000 (salary + RSUs). Moves to Lisbon with family. Purchases apartment in Parque das
            Nações for €950,000.<br /><br />
            <strong>Tax position without IFICI:</strong> Portugal standard: up to 48% marginal. Effective rate on $420K
            income: ~42%. Annual tax: ~$176,400.<br /><br />
            <strong>Tax position with IFICI (20% flat):</strong> Annual tax on Portuguese-source portion: ~$84,000.
            Foreign income (RSUs, investments) subject to US-Portugal DTT rules. Estimated combined effective rate: ~22%.<br /><br />
            <strong>Annual saving:</strong> Approximately $80,000–$120,000 depending on RSU vesting schedule and DTT
            treatment. Over 10-year IFICI period: potential saving of €700,000–€1,000,000 net of all costs.
          </p>
        </div>

        <div className="case-card">
          <div className="case-tag">Case Study 02</div>
          <div className="case-title">French Remote Worker — Paris to Cascais</div>
          <p className="case-body">
            <strong>Profile:</strong> Senior data scientist employed by French company on full remote contract.
            Annual salary: €180,000. Single, no dependants. Purchases studio + main apartment in Cascais for €680,000.<br /><br />
            <strong>Tax position without IFICI:</strong> France standard: marginal rate up to 45% + 9.1% social charges.
            Effective total on €180K: ~49%. Annual burden: ~€88,200.<br /><br />
            <strong>Tax position with IFICI:</strong> If employer work qualifies under IFICI eligible activities,
            flat 20% applies. Annual tax: €36,000. Saving vs France: €52,200/year.<br /><br />
            <strong>Note:</strong> France and Portugal have a DTT. Employer must stop applying French payroll tax.
            French social security position requires separate analysis. Works best with employer cooperation or
            transition to self-employed status.
          </p>
        </div>

        <div className="case-card">
          <div className="case-tag">Case Study 03</div>
          <div className="case-title">British Professional — London to Porto</div>
          <p className="case-body">
            <strong>Profile:</strong> Architectural practice partner. Moves firm operations to Porto.
            Annual drawings: £220,000. Purchases historic building in Baixa for €1,200,000 to renovate and
            partially rent.<br /><br />
            <strong>Tax position without IFICI:</strong> UK: 45% additional rate on income above £125,140.
            Effective on £220K: ~43%. Annual UK tax: ~£94,600.<br /><br />
            <strong>Tax position with IFICI:</strong> Architecture qualifies as highly qualified professional activity.
            IFICI 20% flat on Portuguese-sourced income. Annual Portuguese tax: ~€44,000 (at £220K / ~€257K).
            Saving vs UK: ~€65,000/year.<br /><br />
            <strong>Rental income:</strong> Porto property AL revenue (estimated €80,000/year gross) taxed
            separately — either as personal income (28%) or via company structure.
          </p>
        </div>

        <h2 className="s">7. NHR vs IFICI — Comparison Table</h2>
        <table className="cost-table">
          <thead><tr><th>Feature</th><th>NHR (pre-2024)</th><th>IFICI (2024 onwards)</th></tr></thead>
          <tbody>
            <tr><td>Duration</td><td>10 years</td><td>10 years</td></tr>
            <tr><td>PT-source income tax rate</td><td>20% flat</td><td>20% flat</td></tr>
            <tr><td>Foreign income exemption</td><td>Broad — most categories</td><td>Narrower — DTT-dependent</td></tr>
            <tr><td>Pension income (foreign)</td><td>Full exemption OR 10%</td><td>10% flat rate</td></tr>
            <tr><td>Eligible professions</td><td>All (broad list)</td><td>Targeted list (tech, research, qualified)</td></tr>
            <tr><td>Retirees</td><td>Eligible (10% pension rate)</td><td>Not eligible — consider D7 instead</td></tr>
            <tr><td>Application window</td><td>Closed Dec 31, 2023</td><td>Open — apply in year of residency or following year</td></tr>
            <tr><td>5-year prior non-residency</td><td>Required</td><td>Required</td></tr>
          </tbody>
        </table>

        <h2 className="s">8. Frequently Asked Questions</h2>

        {[
          { q: 'Can I still get NHR if I apply now?', a: 'No. The original NHR regime closed to new applicants on December 31, 2023. Existing NHR holders keep their status for the remaining years of their 10-year period. New applicants must apply for IFICI.' },
          { q: 'Does IFICI apply to my Airbnb/AL rental income?', a: 'AL income from Portuguese properties is taxed under the standard Portuguese IRS rules (28% withholding or category B income rules), not under IFICI, which applies to employment and qualifying self-employment income.' },
          { q: 'Can my spouse also apply for IFICI?', a: 'Yes, if your spouse independently qualifies through their own professional activity in an eligible category. Each person applies individually — there is no automatic spousal transfer of IFICI status.' },
          { q: 'What happens after the 10 years?', a: 'You revert to standard Portuguese IRS rates (up to 48%). Many IFICI beneficiaries use the 10-year period to structure their affairs (pension funds, property equity, investment structures) for the transition.' },
          { q: 'Is my US Social Security covered by the Portugal-US treaty?', a: 'The Portugal–US Tax Treaty covers various income types but the treatment of Social Security is complex. US citizens may owe US tax on SS benefits regardless. Consult a dual-qualified (PT + US) tax adviser.' },
          { q: 'Does purchasing property in Portugal affect my IFICI application?', a: 'Property purchase is separate from IFICI eligibility. However, owning property in Portugal can strengthen your residency claim. You must establish habitual residence — owning and living in a Portuguese property satisfies this requirement.' },
          { q: 'Can I keep my UK/French/German health insurance?', a: 'Most IFICI holders use private health insurance in Portugal (€80–€300/month for good coverage). Portugal also has universal public healthcare (SNS) available to tax residents. EU citizens retain EHIC rights for emergency care.' },
          { q: 'How long does the IFICI application take?', a: 'Typically 4–8 weeks from submission. AT may request additional documentation. The approval is backdated to your tax residency registration date, so there is no tax disadvantage from the processing delay.' },
          { q: 'What professional qualifications are accepted for highly qualified professionals?', a: 'Portuguese or recognised foreign university degrees in the relevant field. For regulated professions (doctor, architect, lawyer, engineer), registration with the relevant Portuguese professional body (Ordem) is generally required.' },
        ].map((f, i) => (
          <div key={i} className="faq-item">
            <p className="faq-q">{f.q}</p>
            <p className="faq-a">{f.a}</p>
          </div>
        ))}

        <div className="cta-box">
          <h3>Relocating to Portugal? Start with the right advice.</h3>
          <p>Agency Group connects international buyers with top-tier Portuguese tax advisers and legal professionals. Explore properties under IFICI-optimal locations — Lisbon, Cascais, Porto, Algarve.</p>
          <Link href="https://www.agencygroup.pt/portal">Explore Properties &amp; Get Tax Referral →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/en" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Properties</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Buyer&apos;s Guide</Link>
            <Link href="/blog/golden-visa-portugal-alternatives-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Visa Routes</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
