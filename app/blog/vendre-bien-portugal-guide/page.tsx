import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Vendre son Bien au Portugal en 2026 : Guide Complet pour Propriétaires · Agency Group',
  description: "Guide complet pour vendre un bien au Portugal en 2026. Estimation AVM ±4.2%, plus-values 28%, IMT, CPCV, délais, frais. Convention Franco-Portugaise. Réseau international acheteurs. AMI 22506.",
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/vendre-bien-portugal-guide',
    languages: {
      'fr': 'https://www.agencygroup.pt/blog/vendre-bien-portugal-guide',
      'x-default': 'https://www.agencygroup.pt/blog/vendre-bien-portugal-guide',
    },
  },
  openGraph: {
    title: 'Vendre son Bien au Portugal en 2026 : Guide Complet pour Propriétaires',
    description: "169.812 transactions, 210 jours délai, plus-value 28%, CPCV 20–30%. Tout sur la vente immobilière au Portugal pour propriétaires français.",
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/vendre-bien-portugal-guide',
    locale: 'fr_FR',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Vendre son Bien au Portugal en 2026 : Guide Complet pour Propriétaires',
  description: "Guide complet vente immobilière Portugal 2026. Plus-values, CPCV, frais, délais, réseau acheteurs internationaux.",
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/vendre-bien-portugal-guide',
  inLanguage: 'fr-FR',
  about: [
    { '@type': 'Thing', name: 'Vendre bien Portugal' },
    { '@type': 'Thing', name: 'Vendre maison Portugal' },
    { '@type': 'Thing', name: 'Estimation immobilière Portugal' },
  ],
}

export default function ArticleVendreBienPortugal() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → vendre-bien-portugal-guide
          </div>
          <div className="art-cat">Guide Vendeur</div>
          <h1 className="art-h1">Vendre son Bien au Portugal en 2026 :<br /><em>Guide Complet pour Propriétaires</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>Avril 2026</span>
            <span>·</span>
            <span>13 min de lecture</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Le Portugal connaît un marché vendeur exceptionnel en 2026 : 169.812 transactions, des prix
          en hausse de +17,6%, et un délai de vente moyen de 210 jours en baisse constante. Que vous
          soyez propriétaire résident, non-résident français, investisseur ou héritier d&apos;un bien au
          Portugal, ce guide vous explique tout : comment estimer votre bien précisément, les taxes
          sur plus-values (et comment les optimiser), le processus de vente pas à pas, et pourquoi
          Agency Group maximise votre prix de vente grâce à un réseau d&apos;acheteurs internationaux
          dans 40 pays.
        </p>

        <h2 className="s">1. Le Marché Vendeur 2026 : Le Moment Est Venu</h2>
        <p className="t">
          Les indicateurs du marché portugais sont unanimes : 2026 est l&apos;une des meilleures années
          pour vendre depuis 2007. Le volume de transactions (169.812 en 2025) dépasse le précédent
          record historique. La demande internationale reste structurellement forte — les acheteurs
          américains, français, britanniques et du Moyen-Orient représentent plus de 25% des
          transactions au-dessus de €500.000.
        </p>
        <p className="t">
          Le délai de vente moyen de 210 jours représente une amélioration significative par rapport
          aux 280 jours de 2022–2023. Pour les biens bien présentés, bien estimés, et commercialisés
          avec un marketing international de qualité, les délais réels sont souvent inférieurs à
          120 jours. Les biens avec vue mer, piscine, ou dans les zones premium (Chiado, Príncipe Real,
          Quinta da Marinha, Golden Triangle Algarve) se vendent parfois en moins de 60 jours.
        </p>

        <div className="callout">
          <p><strong>Marché vendeur 2026 :</strong> 169.812 transactions · +17,6% prix · 210 jours délai moyen · 25%+ acheteurs étrangers &gt;€500K · Lisbonne top 5 mondial luxe (Savills) · Francophone = 2ème groupe acheteurs (13%).</p>
        </div>

        <h2 className="s">2. Préparation à la Vente : Les Documents Obligatoires</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Licença de Habitação', d: "Permis d'habiter (licence d'habitation) délivré par la Câmara Municipal. Obligatoire pour tout bien construit ou rénové après 1951. Sans ce document, la vente est juridiquement impossible. Délai d'obtention si manquant : 2–6 mois. À anticiper absolument." },
            { n: '02', t: 'Certificado Energético (CEE)', d: "Certificat de performance énergétique — obligatoire depuis 2013. Classes A+ à F. À réaliser par un technicien certifié. Validité 10 ans. Coût : €150–€350 selon la taille du bien. Impact sur la valeur : les acheteurs premium valorisent les classes A/B." },
            { n: '03', t: 'Caderneta Predial', d: "Document fiscal du bien — numéro de matrice, valeur patrimoniale, description. Obtenu gratuitement sur le portail e-Finanças. Mis à jour si nécessaire (après travaux, changement de description). L'acheteur et son avocat vérifieront ce document minutieusement." },
            { n: '04', t: 'Certidão Predial', d: "Extrait du registre foncier — historique des propriétaires, hypothèques, servitudes. Obtenu au Conservatória do Registo Predial ou en ligne sur predial.inci.pt. Coût : €15–€25. Doit être récent (moins de 6 mois) au moment de la vente." },
            { n: '05', t: 'Dettes Condominium', d: "Attestation du syndic de copropriété confirmant l'absence de dettes de copropriété (condominium). Obligatoire pour les appartements en copropriété. Les dettes de charges restent attachées au bien — pas au vendeur." },
            { n: '06', t: 'Ficha Técnica', d: "Fiche technique du logement (pour les biens construits ou rénovés après 2004) — description des matériaux, équipements, systèmes. Document à remettre à l'acheteur. Si manquante : demandez-la à l'architecte d'origine ou au promoteur." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Estimation du Prix : L&apos;AVM Agency Group</h2>
        <p className="t">
          Agency Group utilise un Automated Valuation Model (AVM) propriétaire avec une précision de
          ±4,2% — la meilleure du marché portugais. Notre AVM intègre 37 variables : prix des
          comparables vendus dans un rayon de 500m sur 18 mois, caractéristiques du bien (exposition,
          vue, étage, rénovation, énergie), tendances de prix par quartier, et demande actuellement active.
        </p>
        <p className="t">
          L&apos;erreur d&apos;estimation est le risque principal pour un vendeur. Un bien surestimé de 10%
          reste sur le marché 3 à 4 fois plus longtemps, attire une clientèle moins qualifiée, et
          finit souvent par se vendre en dessous de sa valeur réelle après une série de baisses de prix
          qui fragilisent la négociation. Une estimation professionnelle précise dès le départ est
          la clé d&apos;une vente rapide et au meilleur prix.
        </p>
        <p className="t">
          Utilisez notre <a href="/#avm" style={{ color: '#1c4a35', textDecoration: 'underline' }}>outil d&apos;estimation AVM gratuit</a> pour obtenir une première valorisation instantanée
          de votre bien au Portugal.
        </p>

        <h2 className="s">4. Plus-Values Immobilières : Ce que Vous Devrez Payer</h2>
        <p className="t">
          La plus-value immobilière (mais-valia) est la différence entre le prix de vente et le prix
          d&apos;achat corrigé. Au Portugal, les règles diffèrent selon votre statut de résidence :
        </p>
        <table className="cost-table">
          <thead><tr><th>Situation</th><th>Taux Plus-Value PT</th><th>Impact Convention Franco-Portugaise</th></tr></thead>
          <tbody>
            <tr><td>Non-résident (ex : Français vivant en France)</td><td>28% sur 100% de la plus-value</td><td>Crédit d&apos;impôt en France — pas de double imposition</td></tr>
            <tr><td>Résident fiscal Portugal (hors IFICI)</td><td>Barème progressif IRS sur 50% de la plus-value</td><td>Imposé uniquement au Portugal (résidence = Portugal)</td></tr>
            <tr><td>Résident IFICI</td><td>28% ou barème sur 50% (option la plus favorable)</td><td>Avantage : base réduite de 50%</td></tr>
            <tr><td>Résidence principale (résident PT)</td><td>Exonération si réinvestissement dans 36 mois</td><td>Exonération sous conditions strictes</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Calcul de la Plus-Value Imposable</h3>
        <p className="t">
          Prix de vente net − (Prix d&apos;achat × coefficient d&apos;actualisation + travaux déductibles + frais
          d&apos;acquisition + honoraires d&apos;agence). Les coefficients d&apos;actualisation monétaire (publiés
          annuellement par le ministère des Finances) réduisent la base imposable en tenant compte
          de l&apos;inflation. Pour un bien acquis il y a plus de 10 ans, l&apos;impact est significatif.
        </p>

        <div className="callout">
          <p><strong>Exemple :</strong> Villa acquise en 2015 à Cascais pour €600.000, revendue en 2026 pour €1.100.000. Plus-value brute : €500.000. Coefficient d&apos;actualisation 2015 (~1.15) : base corrigée ~€690.000. Plus-value imposable : ~€410.000. Impôt non-résident (28%) : ~€114.800. Crédit d&apos;impôt applicable en France. <strong>Un avocat fiscaliste peut optimiser ce calcul légalement.</strong></p>
        </div>

        <h2 className="s">5. IMI et AIMI : Les Taxes Annuelles du Vendeur</h2>
        <table className="cost-table">
          <thead><tr><th>Taxe</th><th>Base</th><th>Taux</th><th>Qui Paie ?</th></tr></thead>
          <tbody>
            <tr><td>IMI (Imposto Municipal Imóveis)</td><td>Valeur patrimoniale tributária</td><td>0,3–0,8% selon commune</td><td>Propriétaire au 31 déc. de chaque année</td></tr>
            <tr><td>AIMI (Adicional IMI)</td><td>Valeur patrimoniale &gt;€600.000</td><td>0,7% (€600K–€1M) / 1% (&gt;€1M) / 1,5% (sociétés)</td><td>Propriétaires avec portefeuille &gt;€600K VPT</td></tr>
          </tbody>
        </table>
        <p className="t">
          L&apos;IMI est dû par le propriétaire au 31 décembre de chaque année. En cas de vente en cours
          d&apos;année, il est d&apos;usage (et juridiquement possible) de prévoir un prorata dans le contrat de
          vente. La valeur patrimoniale tributária (VPT) est généralement 40–60% inférieure à la valeur
          marchande — ce qui limite mécaniquement l&apos;IMI à des montants raisonnables.
        </p>

        <h2 className="s">6. Le Processus de Vente en 4 Étapes</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Offre et Négociation', d: "Réception d'une offre écrite via l'agence. Délai de réponse : 48–72h standard. La contre-offre est fréquente. Agency Group négocie en votre nom pour maximiser le prix final et les conditions (date d'acte, mobilier inclus, conditions suspensives)." },
            { n: '02', t: 'CPCV (Compromis)', d: "Contrat Promesse d'Achat et de Vente — signé généralement 2–4 semaines après l'offre. Acompte versé par l'acheteur : 20–30% du prix. Si vous vous rétractez après le CPCV : vous devez restituer le DOUBLE de l'acompte reçu. Engagez-vous seulement si vous êtes certain de vendre." },
            { n: '03', t: 'Délai CPCV → Acte', d: "30 à 90 jours entre le CPCV et l'Escritura (acte définitif). Ce délai permet à l'acheteur d'obtenir son financement, à l'avocat de finaliser les vérifications, et aux taxes d'acquisition (IMT + Imposto de Selo) d'être calculées et payées par l'acheteur." },
            { n: '04', t: 'Escritura (Acte)', d: "Acte définitif devant notaire portugais. Présence obligatoire ou procuration notariée si vous êtes en France. Le prix net est viré sur votre compte bancaire portugais le jour de l'acte. La commission d'agence (5% + TVA = 6,15% TTC) est prélevée sur le prix de vente." },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">7. Frais de Vente : Ce que le Vendeur Supporte</h2>
        <table className="cost-table">
          <thead><tr><th>Poste</th><th>Montant</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>Commission agence (Agency Group)</td><td>5% + 23% TVA = 6,15% TTC</td><td>À charge exclusive du vendeur au Portugal</td></tr>
            <tr><td>Certificat énergétique (si absent)</td><td>€150 – €350</td><td>Obligatoire — à obtenir avant mise en vente</td></tr>
            <tr><td>Avocat vendeur (recommandé)</td><td>€1.500 – €4.000</td><td>Pour sécuriser le CPCV et l&apos;acte</td></tr>
            <tr><td>Impôt sur la plus-value</td><td>28% (non-résidents) sur base nette</td><td>Variable selon durée de détention et déductions</td></tr>
            <tr><td>Remboursement hypothèque éventuelle</td><td>Capital restant dû</td><td>Clôturé le jour de l&apos;acte</td></tr>
          </tbody>
        </table>

        <h2 className="s">8. Pourquoi Vendre avec Agency Group</h2>
        <p className="t">
          Agency Group dispose d&apos;un réseau d&apos;acheteurs qualifiés actifs dans 40 pays : Américains (16%),
          Français (13%), Britanniques (9%), Chinois (8%), Brésiliens (6%), Moyen-Orient. Pour un bien
          premium (€500K+), notre base d&apos;acheteurs pre-qualifiés nous permet de déclencher des offres
          sérieuses avant même la mise sur les portails publics.
        </p>
        <p className="t">
          Notre marketing multilingue (PT/EN/FR/ZH/AR) et nos campagnes ciblées sur les marchés
          américain, français et britannique maximisent l&apos;exposition de votre bien auprès des acheteurs
          capables de payer le prix maximum du marché. Notre AVM propriétaire (±4,2%) vous garantit
          une estimation juste — ni surestimation qui bloque la vente, ni sous-estimation qui vous
          fait perdre de l&apos;argent.
        </p>

        <h2 className="s">9. Questions Fréquentes des Vendeurs Français</h2>
        <div className="faq-item">
          <div className="faq-q">Peut-on vendre depuis la France sans se déplacer ?</div>
          <div className="faq-a">Oui. Une procuration notariée (en France, apostillée) donne à votre avocat au Portugal le pouvoir de signer le CPCV et l&apos;Escritura en votre nom. Le prix net est viré sur votre compte. Agency Group coordonne l&apos;ensemble du processus à distance. Coût procuration côté France : €200–€400.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">La plus-value portugaise est-elle aussi imposable en France ?</div>
          <div className="faq-a">En principe, la convention franco-portugaise attribue le droit d&apos;imposition à l&apos;État où se situe le bien (Portugal). Un crédit d&apos;impôt est accordé en France pour le montant d&apos;impôt payé au Portugal, évitant la double imposition effective. Consultez un fiscaliste pour votre situation spécifique.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Puis-je vendre si j&apos;ai un crédit hypothécaire portugais ?</div>
          <div className="faq-a">Oui. Le crédit est remboursé par anticipation le jour de l&apos;acte notarié, sur le produit de la vente. La banque procède à la mainlevée de l&apos;hypothèque simultanément à la signature. Agency Group coordonne cette étape avec votre banque portugaise.</div>
        </div>
        <div className="faq-item">
          <div className="faq-q">Comment fonctionne le mandat d&apos;exclusivité ?</div>
          <div className="faq-a">Agency Group travaille en général avec un mandat simple (non-exclusif) ou exclusif selon votre préférence. Le mandat exclusif — garanti sur 6 mois — permet une commercialisation plus intensive et un investissement marketing plus élevé de notre part. Nous pouvons discuter des meilleures conditions selon votre bien et vos objectifs.</div>
        </div>

        <div className="int-links">
          <p>Estimer et vendre votre bien :</p>
          <div className="int-links-row">
            <a href="/#avm">Estimation AVM gratuite →</a>
            <a href="/imoveis">Voir le marché actuel →</a>
            <a href="/fr">Contacter un consultant →</a>
          </div>
        </div>

        <div className="cta-box">
          <h3>Vendre votre Bien au Meilleur Prix</h3>
          <p>Agency Group (AMI 22506) commercialise votre bien auprès d&apos;acheteurs dans 40 pays. Estimation AVM précise, marketing multilingue, réseau international. Commission standard 5% + TVA.</p>
          <Link href="/fr">Demander une Estimation Gratuite →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/fr" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Propriétés</Link>
            <Link href="/blog/acheter-appartement-lisbonne-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide Acheteur Lisbonne</Link>
            <Link href="/blog/regime-ifici-nhr-france-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Guide IFICI</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
