import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Porto 2026 : Pourquoi les Français Investissent Massivement dans la Deuxième Ville du Portugal · Agency Group',
  description: "Guide complet pour acheter un appartement à Porto 2026. €3.643/m², rendement 5.1%, Français = 1ère nationalité étrangère. Foz do Douro, Bonfim, Baixa. Comparatif Bordeaux. AMI 22506.",
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/acheter-appartement-porto-france',
    languages: {
      'fr': 'https://www.agencygroup.pt/blog/acheter-appartement-porto-france',
      'en': 'https://www.agencygroup.pt/blog/lisbon-vs-porto-investment-2026',
      'pt': 'https://www.agencygroup.pt/blog/mercado-imoveis-porto-2026',
      'x-default': 'https://www.agencygroup.pt/blog/lisbon-vs-porto-investment-2026',
    },
  },
  openGraph: {
    title: 'Porto 2026 : Pourquoi les Français Investissent Massivement dans la Deuxième Ville du Portugal',
    description: "Porto €3.643/m², rendement 5.1%, Français = 1ère nationalité étrangère. 50% moins cher que Bordeaux, même qualité de vie.",
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/acheter-appartement-porto-france',
    locale: 'fr_FR',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Porto%202026%20%3A%20Pourquoi%20les%20Fran%C3%A7ais%20Investissent%20Massivement&subtitle=Agency%20Group%20%C2%B7%20Portugal%20Property',
      width: 1200,
      height: 630,
      alt: 'Porto 2026 : Pourquoi les Français Investissent Massivement dans la Deuxième Ville du Portugal',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Porto 2026 : Pourquoi les Français Investissent Massivement dans la Deuxième Ville du Portugal',
    description: 'Agency Group · Portugal Property',
    images: ['https://www.agencygroup.pt/api/og?title=Porto%202026%20%3A%20Pourquoi%20les%20Fran%C3%A7ais%20Investissent%20Massivement&subtitle=Agency%20Group%20%C2%B7%20Portugal%20Property'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Porto 2026 : Pourquoi les Français Investissent Massivement dans la Deuxième Ville du Portugal',
  description: "Guide achat appartement Porto pour Français. Prix, rendements, quartiers, comparatif Bordeaux, vols directs depuis Paris.",
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/acheter-appartement-porto-france',
  inLanguage: 'fr-FR',
  about: [
    { '@type': 'Thing', name: 'Acheter appartement Porto' },
    { '@type': 'Thing', name: 'Investir Porto Portugal' },
    { '@type': 'Thing', name: 'Prix immobilier Porto 2026' },
  ],
}

export default function ArticleAcheterPorto() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → acheter-appartement-porto-france
          </div>
          <div className="art-cat">Guide Investissement</div>
          <h1 className="art-h1">Porto 2026 :<br /><em>Pourquoi les Français Investissent Massivement dans la Deuxième Ville du Portugal</em></h1>
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
          Porto est devenue la destination d&apos;investissement immobilier préférée des Français au Portugal.
          Avec un prix médian de €3.643/m² (+18% YoY) et un rendement locatif moyen de 5,1% — le
          meilleur des grandes villes portugaises — Porto offre un rapport qualité-prix-rendement
          sans équivalent en Europe de l&apos;Ouest. Les Français représentent 20% des acheteurs étrangers
          à Porto, la première nationalité. Paris-Porto en 2h15, trois compagnies low cost, un centre
          historique classé UNESCO, une gastronomie mondiale : voici pourquoi Porto est le meilleur
          investissement immobilier d&apos;Europe en 2026.
        </p>

        <h2 className="s">1. Porto en 2026 : Le Marché en Chiffres</h2>
        <p className="t">
          Le marché immobilier de Porto présente des fondamentaux exceptionnels. À €3.643/m² de moyenne,
          Porto reste significativement moins chère que Lisbonne (€5.000/m²) tout en affichant une
          dynamique de croissance comparable (+18% sur douze mois). Cette situation reflète un rattrapage
          structurel : Porto était historiquement sous-valorisée par rapport à son statut de deuxième
          ville du pays, et les investisseurs l&apos;ont compris.
        </p>
        <p className="t">
          Les quartiers en transformation rapide — Bonfim (+25% en 2025), Cedofeita, Campanhã —
          offrent encore des opportunités à des prix d&apos;entrée accessibles pour des rendements locatifs
          élevés. La demande locative à Porto est structurellement forte : étudiants (28.000 à
          l&apos;Universidade do Porto), salariés des entreprises tech internationales, touristes, et une
          communauté croissante de digital nomads.
        </p>

        <div className="callout">
          <p><strong>Porto 2026 en chiffres :</strong> €3.643/m² médian · +18% YoY · Rendement locatif 5,1% · Français = 20% des acheteurs étrangers (1ère nationalité) · Vol Paris-Porto : 2h15 · Web Summit localisé à Porto depuis 2023 · Centre UNESCO World Heritage.</p>
        </div>

        <h2 className="s">2. Les Français : La Première Communauté Étrangère à Porto</h2>
        <p className="t">
          Contrairement à Lisbonne et Cascais — où les Britanniques et les Américains dominent le
          marché premium — Porto est une ville qui séduit particulièrement les Français. Plusieurs
          raisons expliquent cette affinité. La gastronomie d&apos;abord : Porto partage avec Lyon et
          Bordeaux une culture culinaire profonde, articulée autour du produit local, du vin (Douro
          à 1h de route), et des restaurants de quartier à prix raisonnables. Le caractère de la ville
          ensuite : authentique, populaire, sans la gentrification excessive de Lisbonne, Porto évoque
          les belles villes de province françaises qui ont su préserver leur âme.
        </p>
        <p className="t">
          L&apos;accessibilité Paris-Porto joue également un rôle décisif. Trois compagnies opèrent des
          vols directs quotidiens : Ryanair depuis Paris Beauvais (1h50), Transavia depuis Paris Orly
          (2h15), Air France depuis CDG (2h20). Pour un investisseur parisien, Porto est accessible
          le week-end pour surveiller son bien ou en profiter — un avantage psychologique fort.
        </p>

        <h2 className="s">3. Les Meilleurs Quartiers pour Investir</h2>

        <div className="loc-grid">
          {[
            { name: 'Foz do Douro', price: '€4.500–€7.000 / m²', desc: "Le quartier premium de Porto — bord de mer, villas Belle Époque, restaurants gastronomiques. La résidence principale des familles fortunées. T3 €500K–€1,2M. Rendement locatif 4,2%." },
            { name: 'Bonfim', price: '€2.800–€4.500 / m²', desc: "Le Marais de Porto — en pleine gentrification, +25% en 2025. Lofts industriels reconvertis, restaurants tendance, galeries. Meilleur potentiel de plus-value à court terme. T2 €250K–€450K." },
            { name: 'Baixa / Aliados', price: '€3.200–€5.500 / m²', desc: "Le centre historique — grands boulevards haussmanniens, librairie Lello, Palácio da Bolsa. Appartements dans immeubles de caractère rénovés. Fort rendement locatif touristique 6,5%." },
            { name: 'Miragaia', price: '€3.500–€5.500 / m²', desc: "Vue sur le Douro, azulejos, rues médiévales. Bord des quais de la Ribeira. Appartements atypiques avec vue fleuve. Demande touristique forte. T1/T2 €220K–€480K." },
            { name: 'Cedofeita', price: '€2.500–€4.000 / m²', desc: "Quartier culturel et bohème — galeries, librairies, restaurants végétariens. Très prisé des étudiants et jeunes professionnels. Forte demande locative longue durée. Meilleur rendement 5,8%." },
            { name: 'Matosinhos', price: '€2.200–€3.800 / m²', desc: "Plage à 10 min du centre — the meilleur restaurant de fruits de mer du monde (Lareira). En fort développement. Appartements neufs face à l'Atlantique. T2 neuf €200K–€380K." },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Exemple d&apos;Investissement Concret : T2 à €400K</h2>
        <p className="t">
          Prenons un T2 de 85m² dans le quartier Bonfim, acquis à €400.000 en 2026. Voici la
          projection financière réaliste sur 5 ans :
        </p>
        <table className="cost-table">
          <thead><tr><th>Paramètre</th><th>Données</th></tr></thead>
          <tbody>
            <tr><td>Prix d&apos;achat</td><td>€400.000</td></tr>
            <tr><td>Frais d&apos;acquisition (IMT + IS + notaire + avocat)</td><td>~€30.000 (7,5%)</td></tr>
            <tr><td>Coût total</td><td>€430.000</td></tr>
            <tr><td>Loyer mensuel longue durée (5,1% brut)</td><td>€1.700/mois</td></tr>
            <tr><td>Charges et IMI annuels</td><td>€2.400/an</td></tr>
            <tr><td>Revenu locatif net annuel</td><td>~€17.800/an</td></tr>
            <tr><td>Rendement net sur coût total</td><td>4,1%</td></tr>
            <tr><td>Valeur estimée 2031 (+18%/an → +15% tendance)</td><td>~€550.000–€620.000</td></tr>
          </tbody>
        </table>
        <p className="t">
          Sur 5 ans : revenus locatifs nets cumulés ~€89.000 + plus-value potentielle €120.000–€190.000
          = retour total estimé €209.000–€279.000 sur un investissement initial de €430.000.
          Soit un ROI total de 49%–65% en 5 ans dans le scénario médian.
        </p>

        <h2 className="s">5. Porto vs Bordeaux : Le Comparatif Décisif</h2>
        <table className="cost-table">
          <thead><tr><th>Critère</th><th>Bordeaux (centre)</th><th>Porto (Bonfim / Baixa)</th></tr></thead>
          <tbody>
            <tr><td>Prix au m²</td><td>€4.800 – €7.000</td><td>€2.800 – €5.500</td></tr>
            <tr><td>T2 85m² typique</td><td>€408.000 – €595.000</td><td>€238.000 – €468.000</td></tr>
            <tr><td>Rendement locatif brut</td><td>3,2 – 4,5%</td><td>5,1 – 6,5%</td></tr>
            <tr><td>Taxe foncière annuelle</td><td>1.200 – 2.400€/an</td><td>300 – 600€/an (IMI)</td></tr>
            <tr><td>IFI (si applicable)</td><td>Oui, 0,5–1,5%</td><td>Aucun équivalent</td></tr>
            <tr><td>Vols Paris</td><td>TGV 2h (Paris Montparnasse)</td><td>2h15 (avion Paris-Porto)</td></tr>
            <tr><td>Gastronomie mondiale</td><td>Oui (vins, cuisine régionale)</td><td>Oui (vins Douro, fruits de mer)</td></tr>
          </tbody>
        </table>

        <h2 className="s">6. L&apos;Écosystème Tech de Porto : L&apos;Atout IFICI</h2>
        <p className="t">
          Porto est devenue une capitale européenne de la tech. Depuis l&apos;implantation de Web Summit en
          2023, la ville attire des milliers de startups, investisseurs et talents tech internationaux.
          Les grandes entreprises (Booking.com, Critical Software, Farfetch) ont leur siège ou des
          centres majeurs à Porto. Cette dynamique crée une demande locative premium pour des professionnels
          qualifiés — exactement la cible du régime IFICI.
        </p>
        <p className="t">
          Pour un entrepreneur ou développeur français qui souhaite s&apos;installer à Porto sous le régime IFICI,
          la ville offre la combinaison idéale : qualité de vie, communauté tech active, coût de la vie
          45% inférieur à Paris, et un appartement de qualité à €300K–€500K dans les meilleurs quartiers.
        </p>

        <h2 className="s">7. Questions Fréquentes des Investisseurs Français</h2>
        <div className="faq-item">
          <div className="faq-q">Porto ou Lisbonne pour un premier investissement ?</div>
          <div className="faq-a">Pour la rentabilité pure, Porto gagne : rendement 5,1% vs 4,5% à Lisbonne, prix d&apos;entrée 27% inférieurs. Pour la revente et la liquidité, Lisbonne reste le marché le plus profond. Pour un budget €300K–€800K, Porto est clairement le meilleur choix rendement-prix. Au-delà de €1M, Lisbonne ou Cascais offrent plus d&apos;options premium.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Peut-on louer en courte durée (Airbnb) à Porto ?</div>
          <div className="faq-a">Oui, mais avec des restrictions. Porto a défini des zones de contenção (restrictions AL) dans certains secteurs du centre historique. Hors de ces zones, la licence AL reste accessible. Le rendement en location courte durée à Porto peut atteindre 7–8% brut en haute saison. Vérifiez le zonage avant l&apos;achat.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Les immeubles anciens de Porto sont-ils en bon état ?</div>
          <div className="faq-a">La qualité varie considérablement. Porto a beaucoup de bâtiments du XIXe et début XXe siècle en cours de réhabilitation — les &quot;ruínas&quot;. Un rapport d&apos;expertise structurelle (vistoria) par un ingénieur ou architecte est indispensable avant tout achat dans l&apos;ancien. Les réhabilitations récentes (post-2015) offrent généralement d&apos;excellentes prestations.</div>
        </div>

        <div className="int-links">
          <p>Explorer les propriétés à Porto :</p>
          <div className="int-links-row">
            <a href="/zonas/porto">Zone Porto — propriétés disponibles →</a>
            <a href="/imoveis?zona=Porto">Toutes les annonces Porto →</a>
            <a href="/imoveis">Voir tous les biens au Portugal →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Investir à Porto avec Agency Group</h3>
          <p>Agency Group (AMI 22506) accompagne les investisseurs français à Porto. Sélection rigoureuse, analyse de rendement personnalisée, accompagnement bilingue. Commission à la charge du vendeur.</p>
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
