import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Investir dans l'Immobilier en Algarve en 2026 : Guide Complet pour Investisseurs Français · Agency Group",
  description: "Guide complet pour investir en Algarve 2026. €3.941/m², rendement 5.8%, Golden Triangle Vale do Lobo/Quinta do Lago/Vilamoura. Location courte durée €40K–€80K/an. Comparatif Côte d'Azur. AMI 22506.",
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/investir-immobilier-algarve-2026',
    languages: {
      'fr': 'https://www.agencygroup.pt/blog/investir-immobilier-algarve-2026',
      'en': 'https://www.agencygroup.pt/blog/luxury-villas-algarve-2026',
      'x-default': 'https://www.agencygroup.pt/blog/luxury-villas-algarve-2026',
    },
  },
  openGraph: {
    title: "Investir dans l'Immobilier en Algarve en 2026 : Guide Complet",
    description: "Algarve €3.941/m², rendement 5.8% (meilleur du Portugal), 300 jours de soleil. Golden Triangle. 40% moins cher que la Côte d'Azur.",
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/investir-immobilier-algarve-2026',
    locale: 'fr_FR',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "Investir dans l'Immobilier en Algarve en 2026 : Guide Complet pour Investisseurs Français",
  description: "Guide investissement immobilier Algarve 2026. Rendement 5.8%, Golden Triangle, location saisonnière, IFICI.",
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/investir-immobilier-algarve-2026',
  inLanguage: 'fr-FR',
  about: [
    { '@type': 'Thing', name: 'Investir immobilier Algarve' },
    { '@type': 'Thing', name: 'Acheter villa Algarve' },
    { '@type': 'Thing', name: 'Rendement locatif Algarve Portugal' },
  ],
}

export default function ArticleInvestirAlgarve() {
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
        .faq-item{border-bottom:1px solid rgba(14,14,13,.1);padding:20px 0}
        .faq-q{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.9rem;color:#1c4a35;margin-bottom:10px}
        .faq-a{font-size:.85rem;line-height:1.8;color:rgba(14,14,13,.65)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        .int-links{margin-top:2rem;padding:1.5rem;background:#f4f0e6;border:1px solid rgba(28,74,53,.15);border-radius:4px}
        .int-links p{font-size:.85rem;color:#1c4a35;font-weight:600;margin-bottom:.75rem}
        .int-links-row{display:flex;flex-wrap:wrap;gap:.5rem}
        .int-links-row a{color:#c9a96e;text-decoration:underline;font-size:.875rem}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.loc-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → investir-immobilier-algarve-2026
          </div>
          <div className="art-cat">Guide Investissement</div>
          <h1 className="art-h1">Investir dans l&apos;Immobilier en Algarve en 2026 :<br /><em>Guide Complet pour Investisseurs Français</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>Avril 2026</span>
            <span>·</span>
            <span>12 min de lecture</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          L&apos;Algarve offre le meilleur rendement locatif brut du Portugal en 2026 : 5,8%, soit presque
          le double de Paris (3%). Avec 300 jours de soleil par an, 25 golfs world-class, et des plages
          classées parmi les plus belles d&apos;Europe, la côte sud du Portugal attire une clientèle internationale
          de très haut niveau. Les Français représentent 15% des acheteurs étrangers en Algarve. Cette région
          est 40% moins chère que la Côte d&apos;Azur pour une qualité de vie comparable — et des rendements
          incomparablement meilleurs. Voici le guide complet pour investir intelligemment en Algarve.
        </p>

        <h2 className="s">1. L&apos;Algarve en Chiffres 2026</h2>
        <p className="t">
          Le marché immobilier de l&apos;Algarve présente une dynamique unique : prix médian de €3.941/m² en
          hausse de +15% sur douze mois, avec des écarts de prix considérables selon les zones. Le Golden
          Triangle — Vale do Lobo, Quinta do Lago et Vilamoura — concentre les transactions premium entre
          €5.000 et €9.000/m², tandis que les villes côtières comme Portimão, Lagos ou Tavira offrent
          des prix d&apos;entrée bien inférieurs pour des rendements locatifs élevés.
        </p>

        <div className="callout">
          <p><strong>Algarve 2026 en chiffres :</strong> €3.941/m² médian · +15% YoY · Rendement locatif 5,8% (meilleur du Portugal) · 300 jours de soleil/an · 15% acheteurs étrangers français · 25 terrains de golf · Aéroport Faro : 12 vols Paris/semaine.</p>
        </div>

        <h2 className="s">2. Le Golden Triangle : L&apos;Adresse des Ultra-Premium</h2>

        <div className="loc-grid">
          {[
            { name: 'Vale do Lobo', price: '€4.500–€7.000 / m²', desc: "Domaine résidentiel privé de prestige — 36 trous de golf, plages dorées, villas architecturales. La référence absolue de l'Algarve. Villas €1,5M–€6M. Forte demande locative haut de gamme (€5.000–€12.000/sem en haute saison)." },
            { name: 'Quinta do Lago', price: '€5.000–€9.000 / m²', desc: "Le plus exclusif — accès au Parc Naturel Ria Formosa, 3 parcours de golf (top 10 Europe), beach club privé. Villas contemporaines €2M–€12M. La clientèle : HNWI monde entier, Middle East, UK, FR." },
            { name: 'Vilamoura', price: '€3.200–€5.500 / m²', desc: "La marina la plus fréquentée du Portugal — 1.000 anneaux, casino, 5 golfs. Appartements T2 €350K–€700K, villas €800K–€2,5M. Meilleur rendement locatif du triangle : 6,2% brut." },
            { name: 'Albufeira', price: '€2.800–€4.500 / m²', desc: "La capitale touristique de l'Algarve — plages primées, nightlife, animation. Idéal pour la location courte durée à rendement maximal. T2 €250K–€500K. Taux d'occupation 140+ jours/an." },
            { name: 'Lagos / Sagres', price: '€3.000–€5.000 / m²', desc: "L'Algarve sauvage — falaises spectaculaires, surf, authenticité. Forte demande de la clientèle française. Villas surplombant l'océan €800K–€2,5M. Marché en forte croissance (+22% en 2025)." },
            { name: 'Tavira / Sotavento', price: '€2.200–€3.800 / m²', desc: "L'Algarve authentique — architecture mauresque, Ria Formosa, calme. Moins touristique, plus résidentiel. Meilleur rapport qualité-prix de la région. Idéal pour résidence principale." },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Stratégie Location Courte Durée : Les Chiffres Réels</h2>
        <p className="t">
          L&apos;Algarve génère la plus forte rentabilité touristique d&apos;Europe du Sud après les îles grecques.
          Une villa de 4 chambres à Vale do Lobo (valeur €2M) peut générer des revenus bruts de
          €80.000–€120.000 par an sur 140 à 180 jours d&apos;occupation. Après frais de gestion (15–20%),
          TVA, IMI et entretien, le net se situe entre €45.000 et €70.000 — soit un rendement net de
          2,3% à 3,5% sur la valeur du bien, auxquels s&apos;ajoute la plus-value potentielle.
        </p>
        <table className="cost-table">
          <thead><tr><th>Scénario</th><th>Villa €2M (Vale do Lobo)</th><th>Appartement €500K (Vilamoura)</th></tr></thead>
          <tbody>
            <tr><td>Jours loués / an</td><td>150 jours</td><td>140 jours</td></tr>
            <tr><td>Tarif nuit moyen</td><td>€800–€1.200/nuit</td><td>€180–€280/nuit</td></tr>
            <tr><td>Revenus bruts annuels</td><td>€90.000–€120.000</td><td>€22.000–€32.000</td></tr>
            <tr><td>Frais gestion (18%) + charges</td><td>€22.000–€28.000</td><td>€6.000–€8.000</td></tr>
            <tr><td>Revenu net estimé</td><td>€62.000–€82.000</td><td>€16.000–€24.000</td></tr>
            <tr><td>Rendement net estimé</td><td>3,1–4,1%</td><td>3,2–4,8%</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. Algarve vs Côte d&apos;Azur : Le Comparatif Décisif</h2>
        <table className="cost-table">
          <thead><tr><th>Critère</th><th>Côte d&apos;Azur (Cannes/Antibes)</th><th>Algarve Golden Triangle</th></tr></thead>
          <tbody>
            <tr><td>Prix villa 4 ch. avec piscine</td><td>€3M – €8M</td><td>€1,5M – €4M</td></tr>
            <tr><td>Prix au m²</td><td>€7.000 – €15.000</td><td>€4.500 – €7.000</td></tr>
            <tr><td>Rendement locatif brut</td><td>2,5 – 3,5%</td><td>5,0 – 6,5%</td></tr>
            <tr><td>Jours de soleil / an</td><td>300 jours</td><td>300 jours</td></tr>
            <tr><td>IFI (si résident)</td><td>Applicable si &gt;€1,3M</td><td>Aucun équivalent (IFICI)</td></tr>
            <tr><td>Droits de succession</td><td>20 – 45% (enfants)</td><td>0% (Portugal)</td></tr>
            <tr><td>Vols depuis Paris</td><td>2h10 (CDG–NCE)</td><td>2h45 (CDG–FAO)</td></tr>
          </tbody>
        </table>
        <p className="t">
          L&apos;arbitrage est sans appel : pour le budget d&apos;une villa moyenne sur la Côte d&apos;Azur, un investisseur
          français acquiert en Algarve une propriété comparable avec un rendement double, une fiscalité
          optimisée, et des perspectives de plus-value structurellement meilleures.
        </p>

        <h2 className="s">5. Réglementation Location Touristique (AL) en 2026</h2>
        <p className="t">
          Le régime AL (Alojamento Local) est la licence obligatoire pour toute location touristique de
          courte durée au Portugal. En 2026, les règles ont évolué dans certaines zones :
        </p>
        <div className="step-grid">
          {[
            { n: '01', t: 'Zones de Contenção', d: "Certaines communes d'Algarve ont défini des zones où les nouvelles licences AL sont restreintes. Vérifiez impérativement le statut AL du bien avant l'achat si cet usage est prévu. Vale do Lobo et Quinta do Lago sont généralement en dehors de ces restrictions." },
            { n: '02', t: 'Maximum 75 nuits', d: "Dans certaines zones résidentielles déclarées sous pression, la location est limitée à 120 jours/an par logement. Cette règle ne s'applique pas aux logements dédiés à la location (non résidence principale du propriétaire)." },
            { n: '03', t: 'IRS sur revenus AL', d: "Les revenus locatifs AL sont soumis à l'IRS portugais. Taux : 25% pour non-résidents (ou barème général optionnel). Déductions admises : frais d'entretien, amortissements, charges de copropriété, gestion." },
            { n: '04', t: 'TVA et IMI', d: "TVA 6% sur les nuitées. IMI : 0,3–0,5% de la valeur patrimoniale/an pour les propriétés urbaines. AIMI si portefeuille >€600K : taux progressif 0,7–1,5% sur l'excédent." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. Acheter à Distance depuis la France</h2>
        <p className="t">
          L&apos;achat d&apos;un bien en Algarve est entièrement réalisable depuis la France, sans déplacement sur
          place sauf pour la signature finale (ou avec une procuration notariée en France). Agency Group
          prend en charge l&apos;intégralité du processus à distance :
        </p>
        <p className="t">
          La procuration (procuração) permet à votre avocat portugais d&apos;agir en votre nom pour toutes
          les étapes : signature du CPCV, paiement des taxes, et même l&apos;Escritura finale si vous ne
          pouvez pas vous déplacer. La procuration doit être apostillée par un notaire français avant envoi
          au Portugal. Comptez €200–€400 de frais de procuration côté français.
        </p>

        <div className="callout">
          <p><strong>Avantage fiscal IFICI + Algarve :</strong> En établissant votre résidence fiscale au Portugal (Algarve ou ailleurs), vous bénéficiez du régime IFICI — 20% flat sur revenus qualifiés pendant 10 ans. Combiné avec les revenus locatifs AL optimisés, l&apos;économie globale sur 10 ans peut atteindre €300.000–€700.000 pour un investisseur avec revenus significatifs.</p>
        </div>

        <h2 className="s">7. Questions Fréquentes</h2>
        <div className="faq-item">
          <div className="faq-q">Faut-il créer une société pour investir en Algarve ?</div>
          <div className="faq-a">Pour un bien ou deux, l&apos;achat en nom propre est généralement plus simple. Pour un portefeuille de plusieurs biens (>€2M), une Lda (SARL portugaise) peut offrir des avantages fiscaux sur la gestion locative et les amortissements. Consultez un expert-comptable franco-portugais.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">La plus-value est-elle imposable en France si je vends ?</div>
          <div className="faq-a">Les plus-values immobilières réalisées au Portugal sont imposables au Portugal (28% pour non-résidents) et potentiellement en France, sous réserve de la convention fiscale franco-portugaise qui prévoit un crédit d&apos;impôt pour éviter la double imposition. La plus-value est toujours imposée dans le pays où se situe le bien.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Quelle est la saison haute en Algarve ?</div>
          <div className="faq-a">Juillet-août représentent les 2 mois les plus rentables (taux d&apos;occupation 95%+, tarifs maximum). La saison s&apos;étend de mai à octobre avec une forte demande. Novembre à mars : off-season pour les touristes mais idéal pour les résidents à l&apos;année. Les golfeurs occupent la région 10 mois sur 12.</div>
        </div>

        <div className="int-links">
          <p>Explorer les propriétés en Algarve :</p>
          <div className="int-links-row">
            <a href="/zonas/algarve">Zone Algarve — propriétés disponibles →</a>
            <a href="/imoveis?zona=Algarve">Toutes les annonces Algarve →</a>
            <a href="/imoveis">Voir tous les biens au Portugal →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Investir en Algarve avec Agency Group</h3>
          <p>Agency Group (AMI 22506) accompagne les investisseurs français en Algarve. Sélection off-market, analyse de rendement personnalisée, accompagnement IFICI. Commission à la charge du vendeur.</p>
          <Link href="/fr">Découvrir les Propriétés →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/fr" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Propriétés</Link>
            <Link href="/blog/acheter-appartement-lisbonne-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide Lisbonne</Link>
            <Link href="/blog/regime-ifici-nhr-france-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide IFICI</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
