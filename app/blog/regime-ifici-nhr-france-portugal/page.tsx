import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'IFICI (ex-NHR) 2026 : Le Guide Fiscal Complet pour les Résidents Français au Portugal · Agency Group',
  description: "Guide fiscal complet IFICI Portugal 2026 pour Français. 20% flat tax 10 ans, dividendes exonérés, retraites, convention Franco-Portugaise. Professions éligibles. Comment s'inscrire. AMI 22506.",
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/regime-ifici-nhr-france-portugal',
    languages: {
      'fr': 'https://www.agencygroup.pt/blog/regime-ifici-nhr-france-portugal',
      'en': 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
      'pt': 'https://www.agencygroup.pt/blog/nhr-ifici-2026-guia-completo',
      'x-default': 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
    },
  },
  openGraph: {
    title: 'IFICI (ex-NHR) 2026 : Le Guide Fiscal Complet pour les Résidents Français au Portugal',
    description: "20% flat tax pendant 10 ans, dividendes exonérés, 0% droits de succession. Le guide IFICI complet pour les expatriés français au Portugal.",
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/regime-ifici-nhr-france-portugal',
    locale: 'fr_FR',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'IFICI (ex-NHR) 2026 : Le Guide Fiscal Complet pour les Résidents Français au Portugal',
  description: "Guide IFICI Portugal pour Français. 20% flat tax, professions éligibles, convention fiscale franco-portugaise, démarches d'inscription.",
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/regime-ifici-nhr-france-portugal',
  inLanguage: 'fr-FR',
  about: [
    { '@type': 'Thing', name: 'IFICI Portugal Français' },
    { '@type': 'Thing', name: 'NHR Portugal 2026 Français' },
    { '@type': 'Thing', name: 'Impôts expatriés Portugal France' },
    { '@type': 'Thing', name: 'Fiscalité Portugal résidents français' },
  ],
}

export default function ArticleIFICIGuide() {
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
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → regime-ifici-nhr-france-portugal
          </div>
          <div className="art-cat">Guide Fiscal</div>
          <h1 className="art-h1">IFICI (ex-NHR) 2026 :<br /><em>Le Guide Fiscal Complet pour les Résidents Français</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>Avril 2026</span>
            <span>·</span>
            <span>14 min de lecture</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Le régime IFICI (Incentivo Fiscal à Investigação Científica e Inovação) est le successeur légal
          du célèbre NHR (Non-Habituel Resident), supprimé fin 2023 et remplacé dès 2024 par ce nouveau
          statut fiscal. Pour un Français qui s&apos;installe au Portugal en 2026, l&apos;IFICI reste l&apos;avantage fiscal
          le plus significatif d&apos;Europe occidentale : 20% flat tax pendant 10 ans sur les revenus d&apos;activité
          qualifiée, exonérations sur les revenus étrangers, 0% de droits de succession entre héritiers
          directs, et aucun équivalent de l&apos;IFI français. Ce guide couvre tout ce qu&apos;un expatrié français
          doit savoir avant de faire le saut.
        </p>

        <div className="callout">
          <p><strong>Avertissement :</strong> Ce guide est à titre informatif uniquement. La fiscalité internationale est complexe et personnelle. <strong>Consultez impérativement un conseiller fiscal franco-portugais agréé avant toute décision de relocalisation.</strong> Les règles changent et les situations individuelles varient considérablement.</p>
        </div>

        <h2 className="s">1. Qu&apos;est-ce que l&apos;IFICI ? Le Successeur du NHR</h2>
        <p className="t">
          Le régime NHR (Residente Não Habitual) avait été créé en 2009 pour attirer des résidents
          qualifiés au Portugal. Il permettait une imposition à 20% flat sur les revenus de source
          portugaise qualifiée et une exonération quasi totale sur les revenus de source étrangère,
          pendant 10 ans. Son succès massif — plus de 50.000 bénéficiaires dont une proportion
          importante de Français — a conduit à sa suppression pour les nouveaux demandeurs à partir
          du 1er janvier 2024.
        </p>
        <p className="t">
          L&apos;IFICI, entré en vigueur le 1er janvier 2024 et pleinement opérationnel en 2026, reprend
          les grandes lignes du NHR en les recentrant sur les professionnels qualifiés dans des secteurs
          stratégiques. Les retraités et certaines professions libérales non qualifiées — qui bénéficiaient
          largement du NHR — ont des conditions plus restrictives sous l&apos;IFICI. En revanche, pour les
          cadres, entrepreneurs tech, chercheurs, enseignants et professions libérales qualifiées, les
          avantages restent très substantiels.
        </p>

        <h2 className="s">2. Les Avantages Fiscaux IFICI en Détail</h2>
        <table className="cost-table">
          <thead><tr><th>Type de Revenu</th><th>Traitement IFICI</th><th>Comparaison France</th></tr></thead>
          <tbody>
            <tr><td>Revenus d&apos;activité qualifiée (salaires, honoraires PT)</td><td>20% flat pendant 10 ans</td><td>41–45% (TMI) + 9,7% CS</td></tr>
            <tr><td>Dividendes de source étrangère</td><td>Potentiellement exonérés (selon convention)</td><td>30% PFU (flat tax)</td></tr>
            <tr><td>Intérêts de source étrangère</td><td>Potentiellement exonérés</td><td>30% PFU</td></tr>
            <tr><td>Revenus locatifs de source étrangère</td><td>Potentiellement exonérés</td><td>Barème progressif + 17,2%</td></tr>
            <tr><td>Plus-values immobilières PT</td><td>28% (résidents) ou 50% exonéré si réinvestissement</td><td>19% + 17,2% PS (non-résidents)</td></tr>
            <tr><td>Retraites de source étrangère</td><td>10% (taux préférentiel sous conditions)</td><td>Barème progressif + 7,4–8,3%</td></tr>
            <tr><td>Droits de succession (héritiers directs)</td><td>0% (pas d&apos;impôt successoral au Portugal)</td><td>20–45%</td></tr>
            <tr><td>Équivalent IFI</td><td>Néant</td><td>0,5–1,5% si patrimoine net &gt;€1,3M</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. La Convention Fiscale Franco-Portugaise</h2>
        <p className="t">
          La France et le Portugal ont conclu une convention fiscale de non-double imposition (modèle
          OCDE). Cette convention détermine dans quel pays chaque type de revenu est imposable. Les
          grands principes :
        </p>
        <p className="t">
          <strong>Revenus immobiliers</strong> : imposables dans le pays où se situe le bien. Un Français
          résident au Portugal qui perçoit des loyers d&apos;un appartement à Paris paiera l&apos;impôt en France
          sur ces loyers — mais bénéficiera d&apos;un crédit d&apos;impôt en France pour éviter la double imposition.
        </p>
        <p className="t">
          <strong>Salaires et revenus d&apos;activité</strong> : imposables dans le pays où l&apos;activité est exercée.
          Si vous travaillez au Portugal, vos revenus professionnels sont imposés au Portugal (20% IFICI).
          Le travail à distance pour un employeur français peut créer une situation complexe — à clarifier
          impérativement avec un fiscaliste avant la relocalisation.
        </p>
        <p className="t">
          <strong>Dividendes</strong> : en principe imposables dans le pays de résidence, avec retenue à la
          source possible dans le pays d&apos;origine (généralement 15% selon la convention). Les dividendes
          de sociétés françaises perçus par un résident portugais IFICI peuvent être exonérés au Portugal,
          mais la retenue à la source française (15%) reste applicable.
        </p>

        <h2 className="s">4. Professions Éligibles à l&apos;IFICI en 2026</h2>
        <p className="t">
          Contrairement au NHR qui était ouvert à un large spectre de professions, l&apos;IFICI cible
          spécifiquement les activités à haute valeur ajoutée dans des secteurs stratégiques pour
          l&apos;économie portugaise :
        </p>
        <div className="step-grid">
          {[
            { n: '01', t: 'Recherche & Développement', d: "Chercheurs, ingénieurs R&D, scientifiques travaillant dans des institutions de recherche accréditées ou des entreprises investissant en R&D au Portugal. Codes CAE : 7210, 7220, 8542." },
            { n: '02', t: 'Technologies & Innovation', d: "Ingénieurs logiciels, développeurs, architectes systèmes, experts en cybersécurité, data scientists, professionnels IA/ML. Le Portugal abrite Web Summit et un écosystème tech mondial." },
            { n: '03', t: 'Enseignement Supérieur', d: "Professeurs d'université, directeurs d'établissements d'enseignement supérieur accrédités, formateurs dans des programmes reconnus. Très prisé des universitaires français." },
            { n: '04', t: 'Professions Libérales Qualifiées', d: "Médecins (spécialistes), avocats internationaux, experts-comptables reconnus, architectes, ingénieurs qualifiés exerçant des activités transfrontalières à haute valeur ajoutée." },
            { n: '05', t: 'Direction d\'Entreprise', d: "PDG, directeurs généraux, directeurs financiers de sociétés opérant dans des secteurs stratégiques. L'entreprise doit exercer une activité éligible au Portugal." },
            { n: '06', t: 'Investisseurs Qualifiés', d: "Certains investisseurs apportant capitaux et activité économique au Portugal. Conditions spécifiques — à vérifier avec un fiscaliste. Les simples investisseurs passifs ne sont généralement pas éligibles." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">5. Ce qui a Changé par rapport au NHR Ancien</h2>
        <table className="cost-table">
          <thead><tr><th>Paramètre</th><th>NHR Ancien (avant 2024)</th><th>IFICI 2026</th></tr></thead>
          <tbody>
            <tr><td>Professions éligibles</td><td>Liste large — 82 professions qualifiées</td><td>Recentré sur R&D, Tech, Enseignement, certaines libérales</td></tr>
            <tr><td>Retraites étrangères</td><td>Exonérées (0%) puis 10% depuis 2020</td><td>10% (maintenu sous conditions)</td></tr>
            <tr><td>Taux sur revenus qualifiés PT</td><td>20% flat</td><td>20% flat (inchangé)</td></tr>
            <tr><td>Durée du régime</td><td>10 ans non renouvelables</td><td>10 ans non renouvelables</td></tr>
            <tr><td>Revenus étrangers</td><td>Généralement exonérés</td><td>Exonérés sous conditions (méthode d&apos;exemption ou crédit)</td></tr>
            <tr><td>Délai de demande</td><td>Avant le 31 mars de l&apos;année suivante</td><td>Année d&apos;établissement de la résidence (recommandé)</td></tr>
          </tbody>
        </table>

        <h2 className="s">6. Comment S&apos;Inscrire : Les 5 Étapes</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Obtenir le NIF', d: "Numéro d'Identification Fiscale portugais — premier document obligatoire. Obtenu en 1–2 jours au bureau Finanças de votre ville d'installation ou via un avocat. Apportez passeport + justificatif de domicile futur." },
            { n: '02', t: 'Établir la Résidence', d: "Louer ou acheter un logement au Portugal qui servira de résidence principale. Obtenir le Atestado de Residência (attestation de résidence) auprès de la mairie (Junta de Freguesia) locale. Document essentiel pour la demande IFICI." },
            { n: '03', t: 'Déclaration IRS', d: "Déposer votre déclaration IRS (impôt sur le revenu portugais) pour l'année d'établissement de la résidence. Cochez la case de demande de statut IFICI. Délai : avant le 30 juin de l'année suivant l'établissement." },
            { n: '04', t: 'Code d\'Activité CAE', d: "Déclarer votre activité professionnelle avec le code CAE correspondant à votre profession éligible. Si salarié : votre employeur déclare votre activité. Si indépendant : création de l'activité chez Finanças obligatoire." },
            { n: '05', t: 'Confirmation et Suivi', d: "Les Finanças portugaises confirment l'attribution du statut IFICI par courrier. Conservez précieusement ce document. La durée de 10 ans commence l'année d'établissement de la résidence, que vous ayez ou non des revenus imposables au Portugal cette année-là." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">7. Exemple Concret : Un Entrepreneur Français</h2>
        <p className="t">
          Prenons le cas de Marc, 42 ans, entrepreneur français dirigeant une SAS tech valorisée à €4M,
          avec des revenus annuels de €200.000 (dividendes €150.000 + salaire €50.000). Il envisage
          de s&apos;installer à Cascais avec sa famille et d&apos;acheter une villa à €1,2M.
        </p>
        <table className="cost-table">
          <thead><tr><th>Poste fiscal</th><th>En France (actuel)</th><th>Au Portugal IFICI</th><th>Économie annuelle</th></tr></thead>
          <tbody>
            <tr><td>Impôt sur salaire €50K</td><td>€18.500 (41% TMI)</td><td>€10.000 (20%)</td><td>€8.500</td></tr>
            <tr><td>Flat tax dividendes €150K</td><td>€45.000 (30% PFU)</td><td>Potentiellement €0 (exonéré)</td><td>€45.000</td></tr>
            <tr><td>IFI sur villa €1,2M (net ~€1M)</td><td>€5.500/an</td><td>€0</td><td>€5.500</td></tr>
            <tr><td>Total économie fiscale / an</td><td>—</td><td>—</td><td>~€59.000/an</td></tr>
            <tr><td>Économie sur 10 ans IFICI</td><td>—</td><td>—</td><td>~€590.000</td></tr>
          </tbody>
        </table>
        <p className="t">
          Sur 10 ans, l&apos;économie fiscale cumulée de Marc (€590.000 dans ce scénario simplifié) dépasse
          presque la moitié de la valeur de sa villa. L&apos;immobilier à Cascais sert alors de réservoir
          de valeur au sein d&apos;une optimisation patrimoniale globale.
        </p>

        <div className="callout">
          <p><strong>Avantage combiné IFICI + Immobilier :</strong> Un acheteur qui s&apos;installe à Lisbonne ou Cascais sous le régime IFICI réalise une optimisation patrimoniale maximale — économie fiscale annuelle importante + plus-value immobilière structurelle + 0% droits de succession. <strong>C&apos;est la combinaison la plus puissante disponible en Europe occidentale en 2026 pour un patrimoine de €1M–€10M.</strong></p>
        </div>

        <h2 className="s">8. Questions Fréquentes des Français</h2>
        <div className="faq-item">
          <div className="faq-q">Peut-on conserver des actifs immobiliers en France sous IFICI ?</div>
          <div className="faq-a">Oui, absolument. Le régime IFICI s&apos;applique à votre résidence fiscale portugaise — il ne vous impose pas de céder vos biens français. Les revenus locatifs de ces biens restent imposables en France (selon la convention). L&apos;IFI français ne s&apos;applique plus si vous n&apos;êtes plus résident fiscal français — un avantage considérable pour les patrimoines immobiliers importants.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Le Portugal peut-il taxer les retraites françaises ?</div>
          <div className="faq-a">Depuis 2020, les retraites de source étrangère perçues par des résidents portugais IFICI sont imposées à 10% au Portugal. La convention franco-portugaise prévoit que les retraites publiques françaises (fonctionnaires) sont imposables en France uniquement. Les retraites privées peuvent être soumises au taux IFICI de 10% au Portugal.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Que se passe-t-il après 10 ans ?</div>
          <div className="faq-a">À l&apos;issue des 10 ans IFICI, vous basculez sur le régime standard portugais — nettement plus avantageux que la fiscalité française mais sans les taux préférentiels IFICI. Le taux marginal d&apos;imposition IRS portugais atteint 48% au-delà de €81.199/an. Une planification patrimoniale anticipée (10–15 ans avant la fin du régime) est fortement recommandée.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Peut-on cotiser à un système de retraite français depuis le Portugal ?</div>
          <div className="faq-a">En tant que non-résident français, vous ne pouvez plus cotiser au régime général de retraite français (Sécurité Sociale). Des assurances retraite privées (Madelin équivalent, PER international) et des plans d&apos;épargne retraite internationaux peuvent être souscrits. C&apos;est un aspect crucial à planifier avant le départ.</div>
        </div>

        <div className="int-links">
          <p>Explorer les propriétés au Portugal :</p>
          <div className="int-links-row">
            <a href="/imoveis">Voir tous les biens au Portugal →</a>
            <a href="/zonas/lisboa">Lisbonne — propriétés disponibles →</a>
            <a href="/zonas/cascais">Cascais — propriétés disponibles →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Conseil Patrimonial Intégré IFICI + Immobilier</h3>
          <p>Agency Group accompagne les expatriés français dans leur projet Portugal — de la stratégie fiscale IFICI à l&apos;acquisition immobilière. Consultation gratuite. AMI 22506.</p>
          <Link href="/fr">Discuter de votre Projet →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/fr" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Propriétés</Link>
            <Link href="/blog/acheter-appartement-lisbonne-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide Lisbonne</Link>
            <Link href="/blog/acheter-maison-cascais-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide Cascais</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
