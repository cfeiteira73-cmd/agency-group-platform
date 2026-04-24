import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Acheter une Maison à Cascais en 2026 : Prix, Quartiers et Conseils d'Experts · Agency Group",
  description: "Guide complet pour acheter une maison à Cascais en 2026. Prix €4.713/m², meilleurs quartiers, villas avec vue mer, processus d'achat, fiscalité IFICI. Communauté française établie. AMI 22506.",
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/acheter-maison-cascais-portugal',
    languages: {
      'fr': 'https://www.agencygroup.pt/blog/acheter-maison-cascais-portugal',
      'en': 'https://www.agencygroup.pt/blog/buy-property-cascais',
      'pt': 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
      'x-default': 'https://www.agencygroup.pt/blog/buy-property-cascais',
    },
  },
  openGraph: {
    title: "Acheter une Maison à Cascais en 2026 : Prix, Quartiers et Conseils d'Experts",
    description: "Cascais €4.713/m², +19% YoY, côte dorée à 30 min de Lisbonne. Villas €1,5M–€4M. Communauté française. IFICI 20% flat tax.",
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/acheter-maison-cascais-portugal',
    locale: 'fr_FR',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Acheter+une+Maison+%C3%A0+Cascais+2026&subtitle=%E2%82%AC4.713%2Fm%C2%B2+%C2%B7+C%C3%B4te+Dor%C3%A9e+%C2%B7+IFICI+20%25+Flat+Tax',
      width: 1200,
      height: 630,
      alt: 'Acheter une Maison à Cascais en 2026 — Agency Group',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acheter une Maison à Cascais en 2026',
    description: 'Cascais €4.713/m², +19% YoY, côte dorée à 30 min de Lisbonne. Villas €1,5M–€4M. IFICI 20% flat tax.',
    images: ['https://www.agencygroup.pt/api/og?title=Acheter+une+Maison+%C3%A0+Cascais+2026&subtitle=%E2%82%AC4.713%2Fm%C2%B2+%C2%B7+C%C3%B4te+Dor%C3%A9e+%C2%B7+IFICI+20%25+Flat+Tax'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "Acheter une Maison à Cascais en 2026 : Prix, Quartiers et Conseils d'Experts",
  description: "Guide complet pour acheter une maison à Cascais Portugal en 2026. Prix, quartiers, processus d'achat, fiscalité IFICI.",
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/acheter-maison-cascais-portugal',
  inLanguage: 'fr-FR',
  about: [
    { '@type': 'Thing', name: 'Acheter maison Cascais' },
    { '@type': 'Thing', name: 'Propriété Cascais Portugal' },
    { '@type': 'Thing', name: 'Villa Cascais prix 2026' },
    { '@type': 'Thing', name: 'Immobilier Cascais Français' },
  ],
}

export default function ArticleAcheterMaisonCascais() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → acheter-maison-cascais-portugal
          </div>
          <div className="art-cat">Guide d&apos;Achat</div>
          <h1 className="art-h1">Acheter une Maison à Cascais en 2026 :<br /><em>Prix, Quartiers et Conseils d&apos;Experts</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>Avril 2026</span>
            <span>·</span>
            <span>11 min de lecture</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Cascais est aujourd&apos;hui la destination résidentielle la plus prisée du Portugal par les acheteurs
          étrangers fortunés. À 30 minutes de Lisbonne, cette ancienne cité royale balnéaire combine un
          littoral atlantique exceptionnel, des écoles internationales de renom, une sécurité remarquable
          et une communauté française de plus de 8.000 résidents. En 2026, le prix médian atteint
          €4.713/m² (+19% sur un an), et les villas avec vue mer s&apos;échangent entre €1,5M et €8M.
          Voici tout ce qu&apos;un acheteur français doit savoir pour acquérir un bien à Cascais.
        </p>

        <h2 className="s">1. Cascais en 2026 : Le Marché en Chiffres</h2>
        <p className="t">
          Cascais affiche l&apos;une des croissances immobilières les plus soutenues du Portugal. Le prix médian
          de €4.713/m² représente une hausse de +19% sur douze mois, portée par une demande internationale
          structurellement supérieure à l&apos;offre disponible. La ligne côtière entre Estoril et Guincho — surnommée
          la &quot;Côte Dorée&quot; — concentre les transactions les plus significatives : villas avec piscine et vue mer
          entre €1,5M et €8M, appartements premium entre €600K et €1,5M.
        </p>
        <p className="t">
          Le marché de Cascais reste profondément différent de celui de Lisbonne. Ici, la maison individuelle
          avec jardin prime sur l&apos;appartement en copropriété. Les acheteurs recherchent avant tout l&apos;espace,
          la vue, la proximité immédiate de la mer et la tranquillité résidentielle — tout en bénéficiant
          d&apos;une accessibilité immédiate à Lisbonne via l&apos;autoroute A5 ou le train côtier.
        </p>

        <div className="callout">
          <p><strong>Données de marché Cascais 2026 :</strong> Prix médian €4.713/m² · +19% YoY · Français = 15% des transactions internationales · Temps de trajet Lisbonne : 30 min (A5) / 40 min (train) · 300 jours de soleil/an · 4 terrains de golf world-class · École St. Julian&apos;s (IB).</p>
        </div>

        <h2 className="s">2. Pourquoi les Français Choisissent Cascais</h2>
        <p className="t">
          Les Français représentent 15% des transactions internationales à Cascais — l&apos;une des communautés
          étrangères les plus importantes de la région. Plusieurs facteurs expliquent cette préférence marquée.
        </p>
        <p className="t">
          <strong>Les écoles internationales</strong> sont un argument décisif pour les familles. St. Julian&apos;s School
          (programme IB de la maternelle au baccalauréat) est considérée parmi les cinq meilleures écoles
          britanniques d&apos;Europe et accueille une proportion importante d&apos;enfants français. Le Carlucci American
          International School of Lisbon et l&apos;École Française Charles Lepierre (à Lisbonne, accessible en 30 min)
          complètent l&apos;offre éducative francophone.
        </p>
        <p className="t">
          <strong>La sécurité</strong> est un argument fort : Cascais figure régulièrement parmi les villes
          les plus sûres d&apos;Europe occidentale. Les résidents étrangers témoignent d&apos;une qualité de vie sans
          comparaison — enfants qui rentrent seuls de l&apos;école, terrasses ouvertes la nuit, liberté de circulation
          totale. Cette sécurité, rare en Europe, est souvent citée comme le facteur déterminant par les familles
          françaises qui ont choisi Cascais après avoir vécu à Paris, Lyon ou Bordeaux.
        </p>
        <p className="t">
          <strong>Le lifestyle atlantique</strong> — surf, voile, golf, équitation, randonnée dans le Parc Naturel
          de Sintra-Cascais — offre un cadre de vie sans équivalent en Europe à ce niveau de prix. La marina
          de Cascais, le casino d&apos;Estoril et la gastronomie locale (fruits de mer, vins du Douro) complètent
          un art de vivre authentiquement méditerranéen-atlantique.
        </p>

        <h2 className="s">3. Les Meilleurs Quartiers de Cascais</h2>

        <div className="loc-grid">
          {[
            { name: 'Centre Historique', price: '€4.200–€6.500 / m²', desc: "Le cœur de Cascais — rues pavées, palais du XIXe, restaurants de poisson. Appartements dans d'anciens hôtels particuliers réhabilités. Proximité de la plage et des commerces. Très prisé des acheteurs français." },
            { name: 'Monte Estoril', price: '€4.800–€7.500 / m²', desc: "Quartier résidentiel premium dominant la mer. Villas Art Déco et contemporaines avec jardins. Vue sur l'océan depuis presque toutes les propriétés. Budget villa €1,8M–€5M." },
            { name: 'Estoril', price: '€4.500–€7.000 / m²', desc: "La Riviera portugaise — casino légendaire, hôtels palace, terrain de golf mythique. Villas Belle Époque rénovées, appartements de prestige. Proximité immédiate de la gare." },
            { name: 'Guincho', price: '€5.500–€9.000 / m²', desc: "L'adresse la plus exclusive — dunes sauvages, Parc Naturel, plage de surf world-class. Villas architecturales isolées sur les hauteurs. Intimité absolue. Budget €2,5M–€8M." },
            { name: 'Birre / Alapraia', price: '€3.800–€5.500 / m²', desc: "Quartiers résidentiels calmes en retrait du littoral. Maisons individuelles avec jardins. Très prisé des familles avec enfants — St. Julian's à 5 min. Meilleur rapport qualité-prix." },
            { name: 'Quinta da Marinha', price: '€5.000–€8.000 / m²', desc: "Domaine résidentiel golfique privé — condominium avec sécurité 24h. Villas contemporaines, terrain de golf Oitavos Dunes (top 5 Europe). La référence pour les acheteurs internationaux." },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Types de Biens et Fourchettes de Prix</h2>
        <table className="cost-table">
          <thead><tr><th>Type de Bien</th><th>Localisation</th><th>Fourchette de Prix</th></tr></thead>
          <tbody>
            <tr><td>Villa avec vue mer (4–5 chambres)</td><td>Guincho, Monte Estoril</td><td>€2,5M – €8M</td></tr>
            <tr><td>Villa dans condominium golfique</td><td>Quinta da Marinha</td><td>€1,5M – €4M</td></tr>
            <tr><td>Maison individuelle avec jardin</td><td>Birre, Alapraia, Cascais Centre</td><td>€900K – €2M</td></tr>
            <tr><td>Appartement premium T3/T4</td><td>Centre, Estoril, Monte Estoril</td><td>€600K – €1,5M</td></tr>
            <tr><td>Appartement neuf T2</td><td>Cascais Centre, São João do Estoril</td><td>€400K – €700K</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. Processus d&apos;Achat pour Résidents Français</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'NIF Portugais', d: "Numéro d'identification fiscale, équivalent du SIRET/numéro de SS. Obligatoire avant toute transaction. Obtenu en 1–2 jours au bureau Finanças de Cascais ou via un avocat local. Les non-résidents UE n'ont pas besoin de représentant fiscal." },
            { n: '02', t: 'Compte Bancaire PT', d: "Obligatoire pour le paiement. Ouverture chez Millennium BCP, Santander Portugal ou Novobanco. Apportez : NIF + passeport + justificatif de domicile français + 3 relevés bancaires. Délai : 1–2 semaines." },
            { n: '03', t: 'Due Diligence', d: "Vérification par avocat : certidão predial permanente (registre foncier), caderneta predial (dossier fiscal), licença de habitação (permis d'habiter), dettes de condominium, hypothèques éventuelles. Étape non négociable." },
            { n: '04', t: 'CPCV', d: "Contrat Promesse d'Achat et de Vente — équivalent du compromis mais sans droit de rétractation. Acompte 20–30% du prix. Si l'acheteur se désiste : perte de l'acompte. Due diligence OBLIGATOIRE avant signature." },
            { n: '05', t: 'IMT + Imposto de Selo', d: "Taxes payées AVANT l'acte notarié. IMT : barème progressif (6% entre €633K–€1,05M, 7,5% au-delà pour investissement). Imposto de Selo : 0,8% du prix. À prévoir dans votre budget." },
            { n: '06', t: 'Escritura', d: "Acte définitif devant notaire portugais. Signature en présence des deux parties (ou procuration). Enregistrement au Conservatória do Registo Predial. Remise des clés. Délai CPCV → Escritura : 45–90 jours." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. Fiscalité Avantageuse : L&apos;IFICI+</h2>
        <p className="t">
          Pour un Français qui s&apos;installe à Cascais, le régime IFICI (Incentivo Fiscal à Investigação
          Científica e Inovação) — successeur du NHR depuis 2024 — représente l&apos;avantage fiscal le plus
          significatif disponible en Europe occidentale en 2026.
        </p>
        <table className="cost-table">
          <thead><tr><th>Paramètre</th><th>IFICI Portugal</th><th>Régime Standard France</th></tr></thead>
          <tbody>
            <tr><td>Taux sur revenus d&apos;activité qualifiée</td><td>20% flat pendant 10 ans</td><td>41–45% (TMI)</td></tr>
            <tr><td>Dividendes et intérêts étrangers</td><td>Potentiellement exonérés</td><td>30% (PFU)</td></tr>
            <tr><td>Retraites de source étrangère</td><td>10% plafonné</td><td>Barème progressif + 17,2%</td></tr>
            <tr><td>Droits de succession enfants</td><td>0% (pas d&apos;IS au Portugal)</td><td>20–45%</td></tr>
            <tr><td>IFI / Impôt sur la Fortune</td><td>Aucun équivalent</td><td>0,5–1,5% si &gt;€1,3M</td></tr>
          </tbody>
        </table>
        <p className="t">
          Exemple concret : un entrepreneur français de 45 ans avec des revenus annuels de €250.000 (dividendes
          d&apos;une SAS + salaire) économise en moyenne €50.000–€80.000 d&apos;impôts par an en s&apos;installant à Cascais
          sous le régime IFICI. Sur 10 ans, l&apos;économie fiscale cumulée (€500K–€800K) dépasse souvent la
          valeur du bien immobilier acquis.
        </p>

        <div className="callout">
          <p><strong>Condition clé IFICI :</strong> Ne pas avoir été résident fiscal au Portugal durant les 5 années précédant la demande. La demande doit être déposée l&apos;année d&apos;établissement de la résidence. <strong>Un conseil fiscal franco-portugais est indispensable avant tout projet de relocalisation.</strong></p>
        </div>

        <h2 className="s">7. Rendement Locatif à Cascais</h2>
        <p className="t">
          Pour les acheteurs qui souhaitent rentabiliser leur investissement, Cascais offre un rendement
          locatif brut moyen de 4,2% en location longue durée — supérieur aux grandes villes françaises
          (Paris 2,5–3,5%, Lyon 3,2–3,8%). La demande locative longue durée est structurellement forte :
          expatriés, cadres de multinationales, diplomates. Les délais de relocation sont courts (2–4 semaines).
        </p>
        <p className="t">
          Pour la location courte durée (Airbnb / Booking), les règles varient selon les zones de Cascais.
          Certains condominiums privés (Quinta da Marinha, Bairro do Rosário) n&apos;autorisent pas la location
          touristique. Renseignez-vous avant l&apos;achat si cet usage est envisagé.
        </p>

        <h2 className="s">8. Questions Fréquentes des Acheteurs Français</h2>
        <div className="faq-item">
          <div className="faq-q">Peut-on acheter à Cascais sans parler portugais ?</div>
          <div className="faq-a">Absolument. La communauté française de Cascais est suffisamment établie pour trouver un avocat, un notaire et un banquier francophones. Agency Group assure l&apos;intégralité de l&apos;accompagnement en français, de la recherche de bien jusqu&apos;à l&apos;acte notarié.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">La commission d&apos;agence est-elle à ma charge en tant qu&apos;acheteur ?</div>
          <div className="faq-a">Non. Au Portugal, la commission immobilière (5% + 23% TVA) est intégralement à la charge du vendeur. Vous bénéficiez d&apos;un accompagnement complet Agency Group sans aucun frais direct.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Peut-on financer l&apos;achat avec un crédit portugais ?</div>
          <div className="faq-a">Oui. Les banques portugaises financent les non-résidents jusqu&apos;à 70% de la valeur du bien (LTV 70%), sur 30 ans maximum. Taux variable Euribor 6M (2,95% mars 2026) + spread 1,5–2,5%. Un apport minimum de 30% est requis pour les non-résidents.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Combien coûtent les charges de copropriété dans les condominiums ?</div>
          <div className="faq-a">Dans les condominiums haut de gamme (Quinta da Marinha, Bairro do Rosário), les charges mensuelles varient entre €300 et €900/mois selon la taille du bien et les services inclus (sécurité 24h, piscines communes, jardins, golf). À intégrer dans le calcul de rentabilité.</div>
        </div>

        <div className="int-links">
          <p>Explorer les propriétés à Cascais :</p>
          <div className="int-links-row">
            <a href="/zonas/cascais">Zone Cascais — propriétés disponibles →</a>
            <a href="/imoveis?zona=Cascais">Toutes les annonces Cascais →</a>
            <a href="/imoveis">Voir tous les biens au Portugal →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Prêt à acheter à Cascais ?</h3>
          <p>Agency Group (AMI 22506) accompagne les acheteurs français à Cascais, Lisbonne, Algarve et Madère. Consultation gratuite en français. Commission à la charge du vendeur.</p>
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
