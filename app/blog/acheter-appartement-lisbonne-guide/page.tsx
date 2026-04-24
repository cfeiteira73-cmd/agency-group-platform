import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Acheter un Appartement à Lisbonne 2026 : Guide Complet',
  description: "Guide complet pour acheter un appartement à Lisbonne en 2026. Prix par quartier, régime IFICI, processus d'achat, frais IMT, comparaison Paris vs Lisbonne. Communauté française. AMI 22506.",
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/acheter-appartement-lisbonne-guide',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/buy-property-cascais',
      'pt': 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
      'fr': 'https://www.agencygroup.pt/blog/acheter-appartement-lisbonne-guide',
      'x-default': 'https://www.agencygroup.pt/blog/buy-property-cascais',
    },
  },
  openGraph: {
    title: 'Acheter un Appartement à Lisbonne en 2026 : Guide Complet',
    description: "Chiado €7.000/m², IFICI 20% flat tax, Paris–Lisbonne 2h20. Le guide complet pour les acheteurs français à Lisbonne.",
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/acheter-appartement-lisbonne-guide',
    locale: 'fr_FR',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Acheter%20un%20Appartement%20%C3%A0%20Lisbonne%20en%202026%20%3A%20Guide%20Complet&subtitle=Chiado%20%E2%82%AC7.000%2Fm%C2%B2%2C%20IFICI%2020%25%20flat%20tax%2C%20Paris%E2%80%93Lisbonne%202h',
      width: 1200,
      height: 630,
      alt: 'Acheter un Appartement à Lisbonne en 2026 : Guide Complet',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acheter un Appartement à Lisbonne en 2026 : Guide Complet',
    description: 'Chiado €7.000/m², IFICI 20% flat tax, Paris–Lisbonne 2h20. Le guide complet pour les acheteurs franç',
    images: ['https://www.agencygroup.pt/api/og?title=Acheter%20un%20Appartement%20%C3%A0%20Lisbonne%20en%202026%20%3A%20Guide%20Complet&subtitle=Chiado%20%E2%82%AC7.000%2Fm%C2%B2%2C%20IFICI%2020%25%20flat%20tax%2C%20Paris%E2%80%93Lisbonne%202h'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Acheter un Appartement à Lisbonne en 2026 : Guide Complet',
  description: "Guide complet pour acheter un appartement à Lisbonne en 2026. Prix, IFICI, processus, communauté française.",
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
  url: 'https://www.agencygroup.pt/blog/acheter-appartement-lisbonne-guide',
  inLanguage: 'fr-FR',
  about: [
    { '@type': 'Thing', name: 'Acheter appartement Lisbonne' },
    { '@type': 'Thing', name: 'Immobilier Lisbonne 2026' },
    { '@type': 'Thing', name: 'Régime IFICI Portugal' },
    { '@type': 'Thing', name: 'Investissement immobilier Portugal Français' },
  ],
}

export default function ArticleAcheterAppartementLisbonne() {
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
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.loc-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → acheter-appartement-lisbonne-guide
          </div>
          <div className="art-cat">Guide d&apos;Achat</div>
          <h1 className="art-h1">Acheter un Appartement à Lisbonne en 2026 :<br /><em>Guide Complet pour Acheteurs Français</em></h1>
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
          Les Français constituent le deuxième groupe d&apos;acheteurs étrangers au Portugal, représentant 13% des
          transactions internationales en 2025. Lisbonne est aujourd&apos;hui la première destination d&apos;expatriation
          francophone en dehors de la zone francophone. Le vol Paris-Lisbonne dure 2h20 — moins que Paris-Marseille
          en voiture. Les appartements dans le Chiado s&apos;affichent à €7.000/m², soit moins de la moitié du prix
          équivalent dans le 6e arrondissement parisien (€15.000–€18.000/m²). Ce guide couvre tout ce qu&apos;un
          acheteur français doit savoir pour acquérir un bien à Lisbonne en 2026 : quartiers, prix, fiscalité,
          processus d&apos;achat et questions pratiques.
        </p>

        <h2 className="s">1. Pourquoi Lisbonne en 2026</h2>
        <p className="t">
          Lisbonne réunit plusieurs avantages structurels qui expliquent l&apos;attrait massif des Français. D&apos;abord,
          la proximité géographique : avec 6 à 8 vols quotidiens depuis Paris (CDG et Orly), Lyon, Bordeaux, Toulouse,
          et Nantes, Lisbonne est à portée de week-end. Ensuite, la langue : le portugais et le français partagent
          des racines latines communes, et une large partie de la population lisboète — surtout les moins de 45 ans —
          parle un anglais courant qui facilite les interactions au quotidien.
        </p>
        <p className="t">
          Sur le plan économique, Lisbonne offre un marché immobilier en forte croissance (+17,6% en 2025) mais
          encore loin des valorisations parisiennes. Un appartement de 120 m² dans le Príncipe Real coûte en moyenne
          €900.000–€1.200.000 — soit 3 à 4 fois moins qu&apos;un bien équivalent dans les beaux quartiers de Paris.
          Le rapport qualité-prix, combiné à une qualité de vie exceptionnelle (soleil, gastronomie, sécurité,
          services de santé), fait de Lisbonne l&apos;arbitrage le plus attractif d&apos;Europe occidentale pour un Français
          fortuné.
        </p>

        <div className="callout">
          <p><strong>Données de marché Lisbonne 2026 :</strong> Prix médian €5.000/m² · +17,6% sur 1 an · Français = 2e groupe d&apos;acheteurs étrangers (13%) · Top 5 mondial du luxe (Savills) · 169.812 transactions au Portugal en 2025 · Vol Paris-Lisbonne : 2h20.</p>
        </div>

        <h2 className="s">2. Prix par Quartier à Lisbonne</h2>

        <div className="loc-grid">
          {[
            { name: 'Chiado', price: '€7.000–€10.000 / m²', desc: "Le quartier le plus chic — librairies, cafés de légende, commerce de luxe. Très prisé des Français. Appartements T2 à partir de €700K. Forte demande locative touristique." },
            { name: 'Príncipe Real', price: '€7.400–€11.000 / m²', desc: "Le plus cher de Lisbonne. Palais haussmanniens réhabilités, jardins, galeries. Le «Marais lisboète». Appartements T3 €900K–€1,8M. Communauté française très présente." },
            { name: 'Santos / Lapa', price: '€5.800–€8.500 / m²', desc: "Vue sur le Tage, ambassades, calme résidentiel. Villas avec jardins €1,5M–€4M. Appartements T3 €600K–€1,2M. Quartier favori des diplomates français." },
            { name: 'Alfama / Mouraria', price: '€5.500–€8.000 / m²', desc: "Lisbonne authentique — fado, azulejos, ruelles médiévales. Immeubles classés réhabilités. Plus difficile à rénover mais caractère unique. €400K–€1M pour un T2." },
            { name: 'Parque das Nações', price: '€4.800–€6.500 / m²', desc: "Lisbonne moderne — Expo 98, tours contemporaines, bord du Tage. Écoles internationales proches. Appartements neufs T3 €500K–€900K. Communauté tech internationale." },
            { name: 'Belém / Restelo', price: '€4.500–€6.500 / m²', desc: "Lisbonne historique et résidentielle — Tour de Belém, Mosteiro dos Jerónimos. Villas familiales, calme. Très apprécié des familles françaises avec enfants." },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. La Communauté Française à Lisbonne</h2>
        <p className="t">
          La communauté française de Lisbonne compte aujourd&apos;hui environ 35.000 résidents officiellement enregistrés
          — le chiffre réel est probablement plus proche de 50.000, incluant les non-inscrits. C&apos;est la plus grande
          communauté française d&apos;Europe méridionale hors France. Cette masse critique a engendré une infrastructure
          francophone complète : le Lycée Français Charles Lepierre (1.800 élèves, de la maternelle au bac),
          l&apos;Institut Franco-Portugais, des médecins francophones, des avocats français spécialisés en droit immobilier
          portugais, et des dizaines de commerces et restaurants tenus par des Français.
        </p>
        <p className="t">
          Cette présence est un atout opérationnel considérable pour l&apos;acheteur. Trouver un avocat francophone pour
          la transaction est facile et recommandé — les subtilités du droit immobilier portugais (CPCV, caderneta
          predial, certidão de teor) méritent une explication en français avant signature. Les prix des avocats
          francophones à Lisbonne restent très inférieurs à leurs homologues parisiens : comptez €3.000–€8.000
          pour un accompagnement complet d&apos;une transaction à €500K–€1,5M.
        </p>

        <h2 className="s">4. Le Régime IFICI — L&apos;Avantage Fiscal Décisif</h2>
        <p className="t">
          Le Portugal a créé le régime IFICI (Incentivo Fiscal à Investigação Científica e Inovação) — successeur
          du célèbre NHR — pour attirer les résidents qualifiés. Pour un Français qui s&apos;installe au Portugal,
          ce régime représente potentiellement l&apos;avantage fiscal le plus significatif disponible en Europe en 2026.
        </p>
        <table className="cost-table">
          <thead><tr><th>Paramètre</th><th>IFICI Portugal</th><th>Fiscalité standard France</th></tr></thead>
          <tbody>
            <tr><td>Taux d&apos;imposition sur revenus qualifiés</td><td>20% flat</td><td>41–45% (TMI)</td></tr>
            <tr><td>Durée du régime</td><td>10 ans</td><td>Permanente</td></tr>
            <tr><td>Revenus étrangers (dividendes, loyers étrangers)</td><td>Potentiellement exonérés</td><td>Imposés + prélèvements sociaux 17,2%</td></tr>
            <tr><td>Impôt sur la fortune immobilière (IFI)</td><td>Néant (pas d&apos;équivalent)</td><td>0,5–1,5% sur patrimoine net &gt;€1,3M</td></tr>
            <tr><td>Droits de succession (enfants directs)</td><td>0%</td><td>20–45%</td></tr>
            <tr><td>Cotisations sociales sur revenus du capital</td><td>Très réduites ou nulles</td><td>17,2%</td></tr>
          </tbody>
        </table>
        <p className="t">
          Pour un cadre supérieur ou entrepreneur français avec des revenus de €200.000/an qui s&apos;installe à Lisbonne,
          le régime IFICI peut générer une économie fiscale annuelle de €40.000–€80.000 par rapport à son imposition
          en France. Sur 10 ans, cela représente €400.000–€800.000 — soit souvent davantage que la valeur d&apos;un
          appartement dans les quartiers centraux de Lisbonne.
        </p>

        <div className="callout">
          <p><strong>Conditions IFICI :</strong> Ne pas avoir été résident fiscal au Portugal durant les 5 années précédentes. Établir sa résidence principale au Portugal. Déposer la demande l&apos;année d&apos;établissement de la résidence. <strong>Consultez impérativement un conseiller fiscal franco-portugais avant tout déménagement — les règles varient selon le type de revenu et la convention fiscale franco-portugaise.</strong></p>
        </div>

        <h2 className="s">5. Processus d&apos;Achat : Les 6 Étapes</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'NIF — Numéro Fiscal', d: "Équivalent du numéro de Sécurité Sociale français. Obligatoire pour toute transaction. S'obtient en 1–2 jours au bureau Finanças local ou via un avocat. Les non-résidents ont besoin d'un représentant fiscal au Portugal." },
            { n: '02', t: 'Compte Bancaire Portugais', d: "Requis pour effectuer le paiement via le système bancaire portugais. Ouverture chez Millennium BCP, Santander ou Novobanco. Délai : 1–2 semaines. Documents : NIF + passeport + justificatif de domicile." },
            { n: '03', t: 'Due Diligence', d: "Vérification de la certidão predial (registre foncier), caderneta predial (dossier fiscal), licence d'habitation, charges de copropriété, et hypothèques éventuelles. Toujours via un avocat — jamais seul." },
            { n: '04', t: 'Offre & Négociation', d: "Offre écrite avec délai de 48–72h. La commission de l'agence (5% + TVA) est intégralement à la charge du vendeur. En tant qu'acheteur, vous bénéficiez d'une représentation professionnelle complète sans frais." },
            { n: '05', t: 'CPCV — Compromis de Vente', d: "Contrat préliminaire contraignant. Acompte de 10–30% du prix. Si l'acheteur se rétracte : perte de l'acompte. Si le vendeur se rétracte : restitution du double. Équivalent du compromis français, mais avec des effets juridiques différents." },
            { n: '06', t: 'Escritura — Acte Définitif', d: "Signé chez un notaire. L'IMT et l'Imposto de Selo sont réglés avant signature. Enregistrement au registre foncier. Délai typique du CPCV à l'acte : 45–90 jours." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. Coûts Totaux d&apos;Acquisition</h2>
        <p className="t">Pour un appartement de €800.000 à Lisbonne (acheteur non-résident, 2026) :</p>
        <table className="cost-table">
          <thead><tr><th>Poste</th><th>Taux / Montant</th><th>Estimation</th></tr></thead>
          <tbody>
            <tr><td>IMT (taxe de mutation immobilière)</td><td>Barème progressif — 6% pour investissement €633K–€1,05M</td><td>€48.000</td></tr>
            <tr><td>Imposto de Selo (droit de timbre)</td><td>0,8% du prix d&apos;achat</td><td>€6.400</td></tr>
            <tr><td>Registre foncier + Notaire</td><td>Fixe + variable</td><td>€1.500–€2.200</td></tr>
            <tr><td>Avocat (vivement conseillé)</td><td>0,5–1% du prix</td><td>€4.000–€8.000</td></tr>
            <tr><td>Commission agence (à la charge du vendeur)</td><td>5% + TVA</td><td>€0 (payé par le vendeur)</td></tr>
            <tr><td>Total frais d&apos;acquisition</td><td>~7,5–8,5% du prix</td><td>€59.900–€64.600</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Comparaison Frais Paris vs Lisbonne</h3>
        <table className="cost-table">
          <thead><tr><th>Frais</th><th>Paris (acheteur non-résident)</th><th>Lisbonne (acheteur non-résident)</th></tr></thead>
          <tbody>
            <tr><td>Droits de mutation</td><td>5,80% (DMTO)</td><td>IMT 6–7,5% (selon prix)</td></tr>
            <tr><td>Notaire</td><td>0,8–1,2%</td><td>0,2–0,4%</td></tr>
            <tr><td>Taxe foncière annuelle</td><td>0,5–1,5% valeur cadastrale</td><td>0,3–0,45% valeur matricielle</td></tr>
            <tr><td>IFI / Wealth tax</td><td>0,5–1,5% si patrimoine &gt;€1,3M</td><td>Néant</td></tr>
            <tr><td>Droits de succession enfants</td><td>20–45%</td><td>0%</td></tr>
          </tbody>
        </table>

        <h2 className="s">7. Paris vs Lisbonne : La Comparaison Directe</h2>
        <table className="cost-table">
          <thead><tr><th>Critère</th><th>Paris (6e–7e)</th><th>Lisbonne (Príncipe Real)</th></tr></thead>
          <tbody>
            <tr><td>Prix au m²</td><td>€14.000–€18.000</td><td>€7.400–€11.000</td></tr>
            <tr><td>Appartement 100m² vue dégagée</td><td>€1,4M–€1,8M</td><td>€740K–€1,1M</td></tr>
            <tr><td>Loyer mensuel 3-pièces (longue durée)</td><td>€2.800–€4.000</td><td>€1.500–€2.200</td></tr>
            <tr><td>Rendement locatif brut</td><td>2,5–3,5%</td><td>4,5–5,5%</td></tr>
            <tr><td>Ensoleillement annuel</td><td>1.800h/an</td><td>2.800h/an</td></tr>
            <tr><td>Indice de criminalité (Numbeo 2026)</td><td>58 (Modéré)</td><td>36 (Faible)</td></tr>
            <tr><td>Coût de la vie mensuel (couple)</td><td>€5.000–€8.000</td><td>€2.800–€4.200</td></tr>
          </tbody>
        </table>
        <p className="t">
          L&apos;arbitrage est saisissant : pour le même budget qu&apos;un appartement de 80 m² dans le 6e arrondissement,
          un acheteur français peut acquérir un appartement de 160 m² dans le Príncipe Real, avec terrasse et vue
          sur le Tage. La différence de qualité de vie — soleil, sécurité, coût de la vie — est encore plus
          significative que le différentiel de prix.
        </p>

        <h2 className="s">8. Questions Fréquentes des Acheteurs Français</h2>

        <div className="faq-item">
          <div className="faq-q">Un Français peut-il acheter librement en Portugal ?</div>
          <div className="faq-a">Oui, sans aucune restriction. Les citoyens de l&apos;Union Européenne bénéficient des mêmes droits d&apos;acquisition que les Portugais. Aucune autorisation préalable n&apos;est requise. Seul le NIF (numéro fiscal portugais) est obligatoire avant la transaction.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Faut-il absolument un avocat ?</div>
          <div className="faq-a">Ce n&apos;est pas légalement obligatoire au Portugal, mais c&apos;est vivement conseillé. Le droit immobilier portugais présente des spécificités importantes — notamment la distinction entre le registre foncier et le registre fiscal — qu&apos;un avocat maîtrise. Comptez €3.000–€8.000 selon la complexité du dossier.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Peut-on obtenir un crédit hypothécaire en tant que Français ?</div>
          <div className="faq-a">Oui. Les banques portugaises financent les non-résidents jusqu&apos;à 70% de la valeur du bien (LTV 70%), sur 30 ans maximum. Euribor 6M à 2,95% en mars 2026 + spread 1,5–2,5% pour non-résidents. Un dossier complet (3 derniers bulletins de salaire, avis d&apos;imposition, relevés bancaires 3 mois) est requis.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">La commission d&apos;agence est-elle à la charge de l&apos;acheteur ?</div>
          <div className="faq-a">Non. Au Portugal, la commission immobilière (5% + TVA) est intégralement à la charge du vendeur. En tant qu&apos;acheteur, vous bénéficiez d&apos;un accompagnement professionnel complet par Agency Group sans aucun frais de votre côté.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Comment fonctionne le CPCV comparé au compromis français ?</div>
          <div className="faq-a">Le CPCV (Contrato Promessa de Compra e Venda) est l&apos;équivalent du compromis. Principale différence : en France, l&apos;acheteur dispose d&apos;un délai de rétractation de 10 jours. Au Portugal, ce droit n&apos;existe pas. Une fois le CPCV signé, le retrait de l&apos;acheteur entraîne la perte de l&apos;acompte. La due diligence doit être faite AVANT la signature du CPCV.</div>
        </div>

        <div className="cta-box">
          <h3>Prêt à acheter à Lisbonne ?</h3>
          <p>Agency Group (AMI 22506) accompagne les acheteurs français à Lisbonne, Cascais, Algarve et Madeira. Consultation gratuite en français. Commission à la charge du vendeur.</p>
          <Link href="/fr">Explorer les Propriétés →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/fr" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Propriétés</Link>
            <Link href="/blog/buying-property-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide Acheteur</Link>
            <Link href="/blog/portugal-vs-spain-property-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Portugal vs Espagne</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
