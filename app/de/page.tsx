import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Immobilien in Portugal kaufen 2026 | Agency Group · AMI 22506',
  description: 'Premium-Immobilien in Portugal: Lissabon, Cascais, Algarve, Porto. Deutschsprachige Beratung. NHR/IFICI Steuervorteile. AVM-Bewertung kostenlos.',
  robots: 'index, follow, max-image-preview:large',
  alternates: {
    canonical: 'https://agencygroup.pt/de',
    languages: {
      'de':    'https://agencygroup.pt/de',
      'pt-PT': 'https://agencygroup.pt',
      'en':    'https://agencygroup.pt/en',
    },
  },
  openGraph: {
    title: 'Immobilien Portugal 2026 · Agency Group',
    description: 'Luxusimmobilien: Lissabon, Cascais, Algarve. Steuervorteile NHR. AMI 22506.',
    type: 'website',
    url: 'https://agencygroup.pt/de',
  },
}

const MARKET_DATA = [
  { zone: 'Lissabon',  pm2: '€5.000/m²', yoy: '+14%', desc: 'Top 5 Luxus weltweit' },
  { zone: 'Cascais',   pm2: '€4.713/m²', yoy: '+14%', desc: 'Wo altes Geld auf den Atlantik trifft' },
  { zone: 'Algarve',   pm2: '€3.941/m²', yoy: '+18%', desc: 'Golf, Sonne, 300 Tage Sonnenschein' },
  { zone: 'Porto',     pm2: '€3.643/m²', yoy: '+13%', desc: 'Der Fluss, der alle verführt' },
  { zone: 'Madeira',   pm2: '€3.760/m²', yoy: '+20%', desc: 'Die Insel mit dem ewigen Frühling' },
  { zone: 'Comporta',  pm2: '€11.000/m²', yoy: '+28%', desc: 'Europas letzter unberührter Ort' },
]

const FAQ = [
  {
    q: 'Wie kauft man als Deutscher eine Immobilie in Portugal?',
    a: 'Das Verfahren hat 5 Schritte: (1) NIF-Steuernummer beantragen — 1 Tag; (2) Portugiesisches Bankkonto eröffnen — 1 Woche; (3) Immobilie auswählen und Angebot verhandeln; (4) CPCV (Kaufvorvertrag) mit 10–30% Anzahlung unterzeichnen; (5) Notarielle Ausfertigung (Escritura). Gesamtdauer: 2–3 Monate. Agency Group (AMI 22506) begleitet den gesamten Prozess auf Deutsch.',
  },
  {
    q: 'Welche Steuern fallen beim Kauf an?',
    a: 'Beim Immobilienkauf in Portugal fallen folgende Steuern an: IMT (Grunderwerbsteuer) bis 6,5% je nach Kaufpreis, Imposto de Selo (Stempelsteuer) 0,8%, Grundbucheintrag ca. €500, Notar ca. €500. Bei einem Kaufpreis von €500.000: IMT ~€28.900 + IS €4.000 + Kosten ~€2.000 = ~€35.000 gesamt (ca. 7%).',
  },
  {
    q: 'Was ist NHR und gilt es für Deutsche?',
    a: 'NHR (Nichthabitueller Wohnsitz) ist ein portugiesisches Steuerregime für neue Steueransässige: 10 Jahre lang 20% Pauschalsteuer auf qualifizierte Einkünfte statt der deutschen Spitzensteuersatz von bis zu 47%. Das neue IFICI-Regime (2024) gilt für qualifizierte Fachleute in Technologie, Forschung und Kreativwirtschaft. Ja, Deutsche können sich qualifizieren. Agency Group vermittelt steuerrechtliche Beratung.',
  },
  {
    q: 'Welche Visaoptionen gibt es für Deutsche in Portugal?',
    a: 'Als EU-Bürger haben Deutsche das Recht auf unbegrenzte Niederlassung in Portugal ohne Visum. Einfach Residenzkarte beim SEF/AIMA beantragen. Für Nicht-EU-Partner oder Familienangehörige stehen D7-Visum (passives Einkommen) und D8-Visum (digitale Nomaden) zur Verfügung.',
  },
]

const schemaLD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://agencygroup.pt/de#localbusiness',
  name: 'Agency Group – Mediação Imobiliária Lda',
  description: 'Deutschsprachige Immobilienberatung in Portugal. Luxusimmobilien in Lissabon, Cascais, Algarve und Madeira. AMI 22506.',
  url: 'https://agencygroup.pt/de',
  telephone: '+351919948986',
  email: 'geral@agencygroup.pt',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Lisboa',
    addressCountry: 'PT',
  },
  identifier: { '@type': 'PropertyValue', name: 'AMI', value: '22506' },
  areaServed: ['Lisboa', 'Cascais', 'Algarve', 'Porto', 'Madeira'],
  availableLanguage: [
    { '@type': 'Language', name: 'German' },
    { '@type': 'Language', name: 'Portuguese' },
    { '@type': 'Language', name: 'English' },
  ],
}

const schemaFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function DePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaLD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{font-size:16px;overflow-x:hidden}
        body{font-family:'Jost',sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        :root{--g:#1c4a35;--gd:#0c1f15;--gold:#c9a96e;--g2:#e2c99a;--cr:#f4f0e6;--ink2:rgba(14,14,13,.48)}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.94);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la{font-family:'Cormorant',serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:var(--g)}
        .lg{font-family:'Cormorant',serif;font-weight:300;font-size:.9rem;letter-spacing:.68em;text-transform:uppercase;color:var(--g);margin-left:.1em}
        .lang-sw{display:flex;gap:8px;align-items:center}
        .lang-btn{font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.15em;text-transform:uppercase;padding:5px 10px;border:1px solid rgba(28,74,53,.25);background:transparent;color:var(--g);cursor:pointer;text-decoration:none;opacity:.55;transition:opacity .3s,background .3s}
        .lang-btn.active,.lang-btn:hover{opacity:1;background:rgba(28,74,53,.06)}
        .hero{min-height:100vh;background:var(--gd);display:flex;align-items:flex-end;padding:0 80px 100px;position:relative;overflow:hidden}
        .hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 15% 85%,rgba(28,74,53,.55),transparent 65%),linear-gradient(155deg,#081510,#1c4a35 55%,#0a1b10)}
        .hero-content{position:relative;z-index:2;max-width:700px}
        .hero-eye{font-family:'DM Mono',monospace;font-size:.52rem;letter-spacing:.38em;text-transform:uppercase;color:rgba(201,169,110,.7);margin-bottom:32px;display:flex;align-items:center;gap:16px}
        .hero-eye::before{content:'';width:28px;height:1px;background:var(--gold);flex-shrink:0}
        .hero-h1{font-family:'Cormorant',serif;font-weight:300;font-size:clamp(3rem,5.5vw,5rem);line-height:1.04;color:#fff;letter-spacing:-.01em;margin-bottom:32px}
        .hero-h1 em{font-style:italic;color:var(--g2)}
        .hero-sub{font-size:.88rem;line-height:1.8;color:rgba(255,255,255,.42);max-width:400px;margin-bottom:48px}
        .hero-btns{display:flex;gap:18px;flex-wrap:wrap}
        .btn-gold{display:inline-flex;align-items:center;gap:11px;background:var(--gold);color:var(--g);font-size:.63rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;padding:15px 32px;text-decoration:none;transition:background .3s,transform .3s}
        .btn-gold:hover{background:var(--g2);transform:translateY(-2px)}
        .btn-outline{display:inline-flex;align-items:center;background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.55);font-size:.6rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;padding:14px 26px;text-decoration:none;transition:all .3s}
        .btn-outline:hover{color:#fff;border-color:rgba(255,255,255,.5)}
        .hero-stats{position:absolute;right:80px;bottom:100px;z-index:2;display:flex;flex-direction:column;gap:32px}
        .hs-n{font-family:'Cormorant',serif;font-size:2.2rem;font-weight:300;color:#fff;line-height:1;letter-spacing:-.02em}
        .hs-n em{font-style:normal;color:var(--gold);font-size:1.3rem}
        .hs-l{font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.32);margin-top:4px}
        .stats-bar{background:var(--g);padding:40px 80px;display:flex;gap:64px;flex-wrap:wrap}
        .stat-item{flex:1;min-width:140px}
        .stat-n{font-family:'Cormorant',serif;font-size:2.8rem;font-weight:300;color:#fff;line-height:1}
        .stat-n em{font-style:normal;color:var(--gold);font-size:1.6rem}
        .stat-l{font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-top:6px}
        .section{padding:100px 0}
        .sw{max-width:1160px;margin:0 auto;padding:0 56px}
        .sec-eye{font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);opacity:.7;margin-bottom:16px}
        .sec-h2{font-family:'Cormorant',serif;font-weight:300;font-size:clamp(2rem,3.5vw,3rem);line-height:1.08;color:var(--g);margin-bottom:32px}
        .sec-h2 em{font-style:italic;color:#0e0e0d}
        .why-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin-top:40px}
        .why-card{background:var(--gd);padding:36px 24px}
        .why-icon{font-size:1.8rem;margin-bottom:16px}
        .why-title{font-family:'Cormorant',serif;font-size:1.15rem;font-weight:300;color:var(--gold);margin-bottom:12px}
        .why-desc{font-size:.82rem;line-height:1.75;color:rgba(244,240,230,.5)}
        .why-highlight{font-family:'DM Mono',monospace;font-size:.7rem;color:#fff;margin-top:12px}
        .zones-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:40px}
        .zone-card{background:var(--gd);padding:32px 24px;position:relative;overflow:hidden}
        .zone-card::before{content:'';position:absolute;inset:0;background:rgba(28,74,53,.4);opacity:0;transition:opacity .4s}
        .zone-card:hover::before{opacity:1}
        .zc-tag{font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(201,169,110,.5);margin-bottom:12px}
        .zc-name{font-family:'Cormorant',serif;font-size:1.4rem;font-weight:300;color:var(--cr);margin-bottom:10px}
        .zc-data{display:flex;gap:16px;margin-bottom:8px}
        .zc-pm2{font-family:'DM Mono',monospace;font-size:.65rem;color:var(--gold)}
        .zc-yoy{font-family:'DM Mono',monospace;font-size:.65rem;color:rgba(244,240,230,.4)}
        .zc-desc{font-size:.78rem;color:rgba(244,240,230,.38);font-style:italic;line-height:1.6}
        .tax-banner{background:var(--gd);padding:80px 0}
        .tax-inner{max-width:1160px;margin:0 auto;padding:0 56px;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
        .tax-left .sec-h2{color:var(--cr)}
        .tax-left .sec-h2 em{color:var(--gold)}
        .tax-left .sec-eye{color:rgba(201,169,110,.7)}
        .tax-left p{font-size:.88rem;line-height:1.8;color:rgba(244,240,230,.5);margin-bottom:28px}
        .tax-left a{display:inline-block;background:var(--gold);color:var(--g);padding:13px 32px;text-decoration:none;font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase;transition:background .3s}
        .tax-left a:hover{background:var(--g2)}
        .tax-right{display:flex;flex-direction:column;gap:0}
        .tax-row{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid rgba(201,169,110,.1)}
        .tax-row:first-child{border-top:1px solid rgba(201,169,110,.1)}
        .tax-country{font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,240,230,.4)}
        .tax-from{font-family:'Cormorant',serif;font-size:1.6rem;font-weight:300;color:rgba(244,240,230,.6)}
        .tax-arrow{color:var(--gold);font-size:1rem;padding:0 16px}
        .tax-to{font-family:'Cormorant',serif;font-size:1.6rem;font-weight:300;color:var(--gold)}
        .faq-section{padding:80px 0;background:var(--cr)}
        .faq-list{margin-top:40px;display:flex;flex-direction:column;gap:0}
        .faq-item{border-bottom:1px solid rgba(14,14,13,.1);padding:28px 0}
        .faq-q{font-family:'Cormorant',serif;font-size:1.1rem;font-weight:400;color:var(--g);margin-bottom:12px}
        .faq-a{font-size:.85rem;line-height:1.8;color:var(--ink2)}
        .contact-bar{background:#0e0e0d;padding:48px 0}
        .cb-inner{max-width:1160px;margin:0 auto;padding:0 56px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:32px}
        .cb-items{display:flex;gap:48px;flex-wrap:wrap}
        .cb-lbl{font-family:'DM Mono',monospace;font-size:.45rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.25);display:block;margin-bottom:4px}
        .cb-val{font-size:.88rem;color:rgba(255,255,255,.7);text-decoration:none}
        .wa-btn{display:inline-flex;align-items:center;gap:10px;background:#25D366;color:#fff;padding:13px 28px;text-decoration:none;font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;transition:background .3s,transform .3s;flex-shrink:0}
        .wa-btn:hover{background:#1ebe59;transform:translateY(-1px)}
        footer{background:#080808;padding:32px 56px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
        footer p{font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(255,255,255,.2)}
        .footer-de{font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.1em;color:rgba(201,169,110,.4)}
        @media(max-width:1000px){
          nav{padding:16px 24px}
          .sw{padding-left:24px;padding-right:24px}
          .stats-bar{padding:32px 24px;gap:32px}
          .hero{padding:0 24px 80px}
          .hero-stats{display:none}
          .why-grid{grid-template-columns:1fr 1fr}
          .zones-grid{grid-template-columns:1fr}
          .tax-inner{padding-left:24px;padding-right:24px;grid-template-columns:1fr}
          .cb-inner{padding-left:24px;padding-right:24px}
          .cb-items{gap:24px}
          footer{padding:24px}
        }
        @media(max-width:600px){
          .why-grid{grid-template-columns:1fr}
        }
      `}</style>

      {/* Navigation */}
      <nav>
        <Link href="/" className="logo">
          <span className="la">Agency</span>
          <span className="lg">Group</span>
        </Link>
        <div className="lang-sw">
          <Link href="/"    className="lang-btn">PT</Link>
          <Link href="/en"  className="lang-btn">EN</Link>
          <Link href="/fr"  className="lang-btn">FR</Link>
          <Link href="/de"  className="lang-btn active">DE</Link>
          <Link href="/zh"  className="lang-btn">ZH</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <div className="hero-eye">Lissabon · Portugal · AMI 22506</div>
          <h1 className="hero-h1">
            Wo Portugal auf<br/>
            <em>die Welt trifft.</em>
          </h1>
          <p className="hero-sub">
            Premium-Immobilien in Portugal · €500K–€10M.
            Lissabon, Cascais, Algarve, Madeira.
            Deutschsprachige Beratung · Rechtssicherheit · NHR-Steuervorteil.
          </p>
          <div className="hero-btns">
            <Link href="/#avaliacao" className="btn-gold">Kostenlose AVM-Bewertung →</Link>
            <Link href="/#deal-radar" className="btn-outline">Deal Radar 16D</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <div className="hs-n">169<em>K</em></div>
            <div className="hs-l">Transaktionen 2025</div>
          </div>
          <div>
            <div className="hs-n">+17<em>%</em></div>
            <div className="hs-l">Wertzuwachs p.a.</div>
          </div>
          <div>
            <div className="hs-n">Top<em>5</em></div>
            <div className="hs-l">Luxus weltweit</div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="stats-bar">
        {[
          { n: '169', e: 'K',  l: 'Transaktionen PT 2025' },
          { n: '+17', e: '%',  l: 'Jährlicher Wertzuwachs' },
          { n: 'Top', e: '5',  l: 'Luxus weltweit' },
          { n: '44',  e: '%',  l: 'Internationale Käufer' },
        ].map(s => (
          <div key={s.l} className="stat-item">
            <div className="stat-n">{s.n}<em>{s.e}</em></div>
            <div className="stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Why Portugal */}
      <section className="section">
        <div className="sw">
          <div className="sec-eye">Investitionsstandort · Portugal 2026</div>
          <h2 className="sec-h2">Warum Portugal?<br/><em>4 überzeugende Gründe</em></h2>
          <div className="why-grid">
            <div className="why-card">
              <div className="why-icon">🏛</div>
              <div className="why-title">Steuervorteil NHR / IFICI</div>
              <p className="why-desc">Als neuer Steueransässiger in Portugal zahlen Sie nur 20% Pauschalsteuer auf qualifizierte Einkünfte — statt bis zu 47% in Deutschland.</p>
              <div className="why-highlight">Deutschland 47% → Portugal 20%</div>
            </div>
            <div className="why-card">
              <div className="why-icon">☀</div>
              <div className="why-title">300 Sonnentage</div>
              <p className="why-desc">Algarve und Madeira gehören zu den sonnigsten Regionen Europas. Ideales Klima für ganzjähriges Wohnen, Golf und aktiven Lebensstil.</p>
              <div className="why-highlight">Algarve · Madeira · 300+ Tage</div>
            </div>
            <div className="why-card">
              <div className="why-icon">⚖</div>
              <div className="why-title">Rechtssicherheit</div>
              <p className="why-desc">Portugal ist EU-Mitglied mit stabiler Demokratie. Notarielle Absicherung, transparentes Grundbuch und starker Eigentumsschutz.</p>
              <div className="why-highlight">EU-Recht · Notarielles System</div>
            </div>
            <div className="why-card">
              <div className="why-icon">📈</div>
              <div className="why-title">Wertzuwachs</div>
              <p className="why-desc">+17,6% Wertzuwachs im Jahr 2025. Lissabon unter den Top 5 Luxusstädten weltweit. Nachfrage übersteigt Angebot in allen Premiumlagen.</p>
              <div className="why-highlight">+17,6% in 2025 · Top 5 Luxus</div>
            </div>
          </div>
        </div>
      </section>

      {/* Market zones */}
      <section className="section" style={{ background: '#fff', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="sw">
          <div className="sec-eye">Marktdaten · Portugal 2026</div>
          <h2 className="sec-h2">Die Märkte,<br/><em>die wir in- und auswendig kennen</em></h2>
          <div className="zones-grid">
            {MARKET_DATA.map(z => (
              <div key={z.zone} className="zone-card">
                <div className="zc-tag">Premiummarkt</div>
                <div className="zc-name">{z.zone}</div>
                <div className="zc-data">
                  <span className="zc-pm2">{z.pm2}</span>
                  <span className="zc-yoy">{z.yoy}</span>
                </div>
                <div className="zc-desc">{z.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tax / NHR Banner */}
      <section className="tax-banner" id="steuer">
        <div className="tax-inner">
          <div className="tax-left">
            <div className="sec-eye">Steuerrecht · NHR / IFICI</div>
            <h2 className="sec-h2">10 Jahre<br/><em>niedrige Steuern</em></h2>
            <p>
              Portugal bietet eines der attraktivsten Steuerregimes für neue Steueransässige.
              20% Pauschalsteuersatz auf qualifizierte Einkünfte für 10 aufeinanderfolgende Jahre.
              Ideal für Deutsche mit einem Spitzensteuersatz von bis zu 47%.
            </p>
            <Link href="/blog/nhr-ifici-guia-completo">Vollständigen Leitfaden lesen →</Link>
          </div>
          <div className="tax-right">
            {[
              { country: 'Deutschland',    from: '37–47%', to: '20%' },
              { country: 'Österreich',     from: '36–55%', to: '20%' },
              { country: 'Schweiz',        from: '30–40%', to: '20%' },
              { country: 'Luxemburg',      from: '36–42%', to: '20%' },
            ].map(t => (
              <div key={t.country} className="tax-row">
                <span className="tax-country">{t.country}</span>
                <span className="tax-from">{t.from}</span>
                <span className="tax-arrow">→</span>
                <span className="tax-to">{t.to}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="faq">
        <div className="sw">
          <div className="sec-eye">Häufige Fragen · Deutschsprachige Beratung</div>
          <h2 className="sec-h2">Häufig gestellte<br/><em>Fragen</em></h2>
          <div className="faq-list">
            {FAQ.map(f => (
              <div key={f.q} className="faq-item">
                <div className="faq-q">{f.q}</div>
                <p className="faq-a">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact bar */}
      <div className="contact-bar" id="kontakt">
        <div className="cb-inner">
          <div className="cb-items">
            <div><span className="cb-lbl">Telefon</span><a href="tel:+351919948986" className="cb-val">+351 919 948 986</a></div>
            <div><span className="cb-lbl">E-Mail</span><a href="mailto:geral@agencygroup.pt" className="cb-val">geral@agencygroup.pt</a></div>
            <div><span className="cb-lbl">Büro</span><span className="cb-val">Amoreiras Square, Lissabon</span></div>
            <div><span className="cb-lbl">Lizenz</span><span className="cb-val" style={{ color: 'var(--gold)', fontWeight: 500 }}>AMI 22506</span></div>
          </div>
          <a
            href="https://wa.me/351919948986?text=Guten%20Tag%2C%20ich%20interessiere%20mich%20f%C3%BCr%20Luxusimmobilien%20in%20Portugal."
            target="_blank"
            rel="noreferrer"
            className="wa-btn"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp Jetzt
          </a>
        </div>
      </div>

      <footer>
        <p>© 2026 Agency Group – Mediação Imobiliária Lda · NIPC 516.833.960 · Lissabon, Portugal</p>
        <p className="footer-de">AMI 22506 · Deutschsprachige Beratung verfügbar · Lizenzierte Immobilienagentur</p>
      </footer>
    </>
  )
}
