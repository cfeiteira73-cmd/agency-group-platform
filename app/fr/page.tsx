import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Agency Group · L'Immobilier de Luxe au Portugal · AMI 22506",
  description: "Achetez un bien de prestige au Portugal. Lisbonne €6 200/m², Cascais €4 713/m², Comporta €8 500/m². Régime fiscal NHR/IFICI. Estimation AVM gratuite. AMI 22506.",
  robots: "index, follow, max-image-preview:large",
  alternates: { canonical: "https://agencygroup.pt/fr" },
  openGraph: {
    title: "Agency Group · L'Immobilier de Luxe au Portugal",
    description: "L'agence de référence pour l'immobilier de prestige au Portugal. Lisbonne, Cascais, Comporta, Porto, Algarve, Madère. AMI 22506.",
    type: "website", url: "https://agencygroup.pt/fr",
  },
}

const ZONES = [
  { name: "Lisbonne", pm2: "€ 6 200/m²", yoy: "+17,6 %", tag: "La capitale la plus convoitée d'Europe", color: "#1c3a5e" },
  { name: "Cascais", pm2: "€ 4 713/m²", yoy: "+14 %", tag: "La Riviera Portugaise", color: "#0e2a3a" },
  { name: "Comporta", pm2: "€ 8 500/m²", yoy: "+28 %", tag: "Les Hamptons Portugais", color: "#2a1e0a" },
  { name: "Porto", pm2: "€ 3 643/m²", yoy: "+13 %", tag: "La ville qui a séduit le monde entier", color: "#2a1505" },
  { name: "Algarve", pm2: "€ 3 941/m²", yoy: "+12 %", tag: "300 jours de soleil par an", color: "#1a2e0a" },
  { name: "Madère", pm2: "€ 3 760/m²", yoy: "+20 %", tag: "L'île atlantique, paradis fiscal", color: "#0a2a1e" },
]

const WHY_PT = [
  { icon: "💼", title: "Régime NHR / IFICI", desc: "Imposition forfaitaire à 20 % pendant 10 ans pour les nouveaux résidents. Exonération quasi totale sur les revenus de source étrangère." },
  { icon: "🏛️", title: "Aucun impôt sur la fortune", desc: "Le Portugal n'applique ni ISF, ni droits de succession entre héritiers directs, et bénéficie d'une fiscalité avantageuse sur les plus-values." },
  { icon: "🛡️", title: "Sécurité & Stabilité", desc: "4e pays le plus sûr au monde (Global Peace Index). Membre de l'OTAN. Accès Schengen. État de droit solide et institutions fiables." },
  { icon: "🌞", title: "Le meilleur climat d'Europe", desc: "Plus de 300 jours de soleil par an. Brise atlantique. Températures douces toute l'année. Art de vivre en plein air en toutes saisons." },
  { icon: "✈️", title: "Carrefour du monde", desc: "Lisbonne : 2h de Paris, 3h de Londres, 6h30 de New York. Vols directs vers plus de 150 destinations internationales." },
  { icon: "📈", title: "+17,6 % de croissance en 2026", desc: "169 812 transactions enregistrées. Le marché du luxe lisbonnais se classe dans le top 5 mondial (Savills 2026). Une demande soutenue et durable." },
]

const STEPS = [
  { n: "01", title: "Obtenir le NIF", desc: "Numéro d'identification fiscale portugais, obtenu en bureau des Finanças ou via avocat. Délai : 1 jour ouvré." },
  { n: "02", title: "Ouvrir un compte bancaire", desc: "Ouverture d'un compte au Portugal (Millennium BCP, Santander, BPI). Indispensable pour la transaction. Délai : environ 1 semaine." },
  { n: "03", title: "Recherche & Offre", desc: "Agency Group vous présente une sélection rigoureuse de biens correspondant à vos critères. Nous négocions directement en votre nom." },
  { n: "04", title: "Signature du CPCV", desc: "Contrat promesse d'achat avec acompte de 10 à 30 %. Protection juridique pour les deux parties. Acte authentifié par notaire." },
  { n: "05", title: "Acte définitif (Escritura)", desc: "Acte public signé devant notaire portugais. Transfert complet de propriété. Remise des clés. Durée totale du processus : 2 à 3 mois." },
]

const TESTIMONIALS = [
  { author: "Isabelle & Frédéric Dumont", country: "France 🇫🇷", text: "Carlos nous a trouvé notre villa de rêve à Cascais en moins de trois semaines. Le niveau de service, la connaissance du marché et l'attention personnelle sont véritablement d'exception. Nous avons acheté à Paris, Londres et Genève — Agency Group les surpasse tous.", property: "Villa Quinta da Marinha · 3,8 M€" },
  { author: "Mohammed Al-Rashidi", country: "Dubaï, EAU 🇦🇪", text: "L'acquisition de la herdade à Comporta s'est déroulée avec une fluidité remarquable. Carlos a anticipé chaque obstacle réglementaire, négocié avec maestria et obtenu 15 % sous le prix demandé. Le ROI dépasse déjà nos projections initiales.", property: "Herdade Comporta · 6,5 M€" },
  { author: "Jean-Marc Lefèvre", country: "Belgique 🇧🇪", text: "En tant qu'acquéreurs étrangers découvrant le droit portugais pour la première fois, nous avions besoin d'un interlocuteur en qui placer une confiance absolue. Agency Group a assuré un suivi irréprochable, du NIF à l'acte final. Une excellence rare.", property: "Penthouse Príncipe Real · 2,85 M€" },
]

export default function FrPage() {
  const waMsg = "Bonjour, je suis intéressé(e) par l'acquisition d'un bien de prestige au Portugal. Pouvez-vous m'accompagner ?"

  return (
    <div style={{ background: '#060d08', minHeight: '100vh', color: '#f4f0e6', fontFamily: "'Jost', sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(6,13,8,.97)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(201,169,110,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', height: '72px' }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
          <Link href="/imoveis" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Biens</Link>
          <Link href="/reports" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Rapports</Link>
          <Link href="/agente/carlos" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Agent</Link>
          <Link href="/" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.5)', textDecoration: 'none' }}>🇵🇹 PT</Link>
        </div>
        <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
          style={{ background: '#c9a96e', color: '#0c1f15', padding: '10px 28px', fontFamily: "'Jost', sans-serif", fontSize: '.6rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Nous Contacter →
        </a>
      </nav>

      {/* HERO */}
      <div style={{ paddingTop: '72px', background: 'linear-gradient(160deg, #0a1f12 0%, #060d08 60%, #0c1a10 100%)', minHeight: '70vh', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(201,169,110,.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 60px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.34em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: '20px' }}>
            Portefeuille · 20 Biens · Portugal 2026
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(3rem, 6vw, 5.5rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.05, maxWidth: '800px' }}>
            L&apos;Immobilier de Prestige<br /><em style={{ fontStyle: 'italic', color: '#c9a96e' }}>au Portugal</em>
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '1rem', color: 'rgba(244,240,230,.5)', maxWidth: '560px', lineHeight: 1.75, margin: '0 0 40px' }}>
            Des palais historiques de Lisbonne aux villas sur dunes de Comporta — nous représentons les biens d&apos;exception du Portugal pour une clientèle internationale exigeante. AMI 22506.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Link href="/imoveis" style={{ background: '#c9a96e', color: '#0c1f15', padding: '16px 40px', fontFamily: "'Jost', sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Voir les Biens →
            </Link>
            <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
              style={{ background: 'transparent', color: '#c9a96e', padding: '16px 32px', border: '1px solid rgba(201,169,110,.4)', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Parler à un Expert
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '0', marginTop: '60px', borderTop: '1px solid rgba(201,169,110,.1)', paddingTop: '32px' }}>
            {[['+ 500 M€','Valeur Portefeuille'],['127','Transactions'],['4,9 ★','Note Clients'],['30 +','Nationalités']].map(([val, label], i) => (
              <div key={label} style={{ paddingRight: '40px', marginRight: '40px', borderRight: i < 3 ? '1px solid rgba(201,169,110,.08)' : 'none' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '2.2rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>{val}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginTop: '4px' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MARKET DATA */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '96px 60px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
          Intelligence Marché · 2026
        </div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15 }}>
          Les Marchés Phares du Portugal
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {ZONES.map(z => (
            <div key={z.name} style={{ background: `linear-gradient(135deg, ${z.color}, #060d08)`, border: '1px solid rgba(201,169,110,.1)', padding: '28px' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.3rem', color: '#f4f0e6', marginBottom: '6px' }}>{z.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.55)', marginBottom: '16px', textTransform: 'uppercase' }}>{z.tag}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', color: '#c9a96e', fontWeight: 300 }}>{z.pm2}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', color: '#4a9c7a', background: 'rgba(28,74,53,.3)', padding: '3px 8px', border: '1px solid rgba(28,74,53,.5)' }}>{z.yoy}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* POURQUOI LE PORTUGAL */}
      <div style={{ background: 'rgba(201,169,110,.03)', borderTop: '1px solid rgba(201,169,110,.08)', borderBottom: '1px solid rgba(201,169,110,.08)', padding: '96px 60px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px', textAlign: 'center' }}>
            Pourquoi le Portugal
          </div>
          <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15, textAlign: 'center' }}>
            6 raisons pour lesquelles tout investisseur choisit le Portugal
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {WHY_PT.map(w => (
              <div key={w.title} style={{ background: 'rgba(6,13,8,.6)', border: '1px solid rgba(201,169,110,.1)', padding: '28px' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '14px' }}>{w.icon}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.15rem', fontWeight: 300, color: '#f4f0e6', marginBottom: '10px' }}>{w.title}</div>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.65, margin: 0 }}>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PARCOURS D'ACQUISITION */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '96px 60px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
          Comment Acheter
        </div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15 }}>
          5 étapes pour devenir propriétaire au Portugal
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0' }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ borderLeft: i === 0 ? '1px solid rgba(201,169,110,.15)' : 'none', borderRight: '1px solid rgba(201,169,110,.15)', borderTop: '1px solid rgba(201,169,110,.15)', borderBottom: '1px solid rgba(201,169,110,.15)', padding: '28px 20px' }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '2.5rem', color: 'rgba(201,169,110,.2)', fontWeight: 300, marginBottom: '12px' }}>{s.n}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', fontWeight: 300, color: '#f4f0e6', marginBottom: '10px', lineHeight: 1.3 }}>{s.title}</div>
              <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.75rem', color: 'rgba(244,240,230,.45)', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Frais d'acquisition */}
        <div style={{ marginTop: '48px', background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)', padding: '32px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.44rem', letterSpacing: '.2em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '20px' }}>Frais de Transaction Estimés</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            {[['IMT (Taxe de Mutation)', '0 – 7,5 %'],['Droit de Timbre', '0,8 %'],['Honoraires Juridiques', '~1 500 – 3 000 €'],['Commission Agence', '5 % (à charge du vendeur)']].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TÉMOIGNAGES */}
      <div style={{ background: 'rgba(201,169,110,.03)', borderTop: '1px solid rgba(201,169,110,.08)', padding: '96px 60px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px', textAlign: 'center' }}>Témoignages Clients</div>
          <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 48px', lineHeight: 1.15, textAlign: 'center' }}>Ce que disent nos clients</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} style={{ background: 'linear-gradient(135deg, rgba(201,169,110,.06) 0%, rgba(12,31,21,.3) 100%)', border: '1px solid rgba(201,169,110,.12)', padding: '32px' }}>
                <div style={{ color: '#c9a96e', fontSize: '1rem', marginBottom: '16px' }}>★★★★★</div>
                <p style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', lineHeight: 1.75, color: 'rgba(244,240,230,.75)', fontWeight: 300, fontStyle: 'italic', margin: '0 0 20px' }}>&ldquo;{t.text}&rdquo;</p>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.45)', marginBottom: '14px', background: 'rgba(201,169,110,.05)', padding: '6px 10px', textTransform: 'uppercase' }}>🏠 {t.property}</div>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: '#f4f0e6', fontWeight: 600 }}>{t.author}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.35)' }}>{t.country}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NHR FOCUS */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '96px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '14px' }}>
              Fiscalité · Résidence Portugaise
            </div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 3.5vw, 3rem)', color: '#f4f0e6', margin: '0 0 24px', lineHeight: 1.15 }}>
              Régime NHR / IFICI :<br /><em style={{ color: '#c9a96e', fontStyle: 'italic' }}>10 ans de fiscalité allégée</em>
            </h2>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.88rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.8, marginBottom: '16px' }}>
              Le Portugal propose l&apos;un des régimes fiscaux les plus attractifs du monde pour les nouveaux résidents. Taux forfaitaire de 20 % ou exonération totale sur les revenus de source étrangère pendant 10 années consécutives.
            </p>
            <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.88rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.8, marginBottom: '32px' }}>
              Particulièrement avantageux pour les résidents français soumis à la tranche marginale de 45 %, les Belges à 50 % ou les Suisses. Un levier patrimonial considérable sur une décennie.
            </p>
            <a href={`https://wa.me/351919948986?text=${encodeURIComponent("Bonjour, je souhaite en savoir plus sur le régime NHR/IFICI au Portugal.")}`} target="_blank" rel="noopener noreferrer"
              style={{ background: '#c9a96e', color: '#0c1f15', padding: '14px 32px', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}>
              Consulter un Expert →
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { c: 'France', from: '41–45 %', to: '20 %' },
              { c: 'Belgique', from: '40–50 %', to: '20 %' },
              { c: 'Suisse', from: '30–40 %', to: '20 %' },
              { c: 'Luxembourg', from: '36–42 %', to: '20 %' },
            ].map(n => (
              <div key={n.c} style={{ background: 'rgba(201,169,110,.04)', border: '1px solid rgba(201,169,110,.12)', padding: '24px' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.42rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '8px' }}>{n.c}</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', fontWeight: 300, color: 'rgba(244,240,230,.6)', lineHeight: 1 }}>{n.from}</div>
                <div style={{ fontSize: '.85rem', color: '#c9a96e', margin: '6px 0' }}>↓ Portugal NHR</div>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.6rem', fontWeight: 300, color: '#c9a96e', lineHeight: 1 }}>{n.to}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '96px 60px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.3em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Commencer Votre Projet</div>
        <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: '#f4f0e6', margin: '0 0 16px' }}>Prêt à investir au Portugal ?</h2>
        <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.9rem', color: 'rgba(244,240,230,.45)', maxWidth: '500px', margin: '0 auto 40px', lineHeight: 1.7 }}>
          Consultation privée. Réponse en moins de 2 heures. Aucun engagement requis.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
            style={{ background: '#25D366', color: '#fff', padding: '18px 48px', fontFamily: "'Jost', sans-serif", fontSize: '.68rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
            WhatsApp Maintenant →
          </a>
          <a href="mailto:geral@agencygroup.pt?subject=Demande Immobilier de Prestige Portugal"
            style={{ background: 'transparent', color: '#c9a96e', padding: '18px 40px', border: '1px solid rgba(201,169,110,.4)', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Envoyer un Email
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(201,169,110,.1)', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.1rem', color: '#c9a96e' }}>Agency<span style={{ color: '#f4f0e6' }}>Group</span></div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.4rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', textTransform: 'uppercase' }}>AMI 22506 · Lisbonne, Portugal · Agence Immobilière Agréée</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textDecoration: 'none', textTransform: 'uppercase' }}>🇵🇹 PT</Link>
          <Link href="/en" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textDecoration: 'none', textTransform: 'uppercase' }}>🇬🇧 EN</Link>
        </div>
      </div>
    </div>
  )
}
