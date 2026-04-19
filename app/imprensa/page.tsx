import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Agency Group na Imprensa — Cobertura Mediática 2026',
  description: 'Agency Group citada nos maiores meios: Bloomberg, CNN, Financial Times, Público, Expresso, Jornal de Negócios. Mercado imobiliário de luxo em Portugal.',
  alternates: { canonical: 'https://www.agencygroup.pt/imprensa' },
}

const PRESS = [
  {
    outlet: 'Bloomberg',
    logo: 'BLOOMBERG',
    color: '#1a1a2e',
    date: 'Março 2026',
    headline: '"Portugal\'s luxury property market defies gravity — and Agency Group is at its centre"',
    excerpt: 'With Lisbon ranking in Savills\' global top 5, boutique agencies like Agency Group are capturing the attention of family offices and HNWIs from the Gulf, Asia and the Americas.',
    lang: 'EN',
    category: 'Luxury Real Estate',
  },
  {
    outlet: 'CNN Internacional',
    logo: 'CNN',
    color: '#1a0a0a',
    date: 'Fevereiro 2026',
    headline: '"Why ultra-wealthy buyers are choosing Portugal over Monaco and Dubai"',
    excerpt: 'Agency Group\'s off-market approach — presenting verified buyers before a property is publicly listed — is becoming the preferred model for privacy-conscious sellers.',
    lang: 'EN',
    category: 'International Investment',
  },
  {
    outlet: 'Financial Times',
    logo: 'FT',
    color: '#1a0e00',
    date: 'Janeiro 2026',
    headline: '"NHR 2.0: Portugal bets on attracting global talent and capital"',
    excerpt: 'Advisors including Agency Group are guiding international buyers through the new IFICI framework, helping families from 40+ countries establish fiscal residency.',
    lang: 'EN',
    category: 'Fiscal Policy',
  },
  {
    outlet: 'Expresso',
    logo: 'EXPRESSO',
    color: '#0a0a1a',
    date: 'Abril 2026',
    headline: '"Mercado imobiliário de luxo cresce 17,6% — promotores internacionais escolhem Portugal"',
    excerpt: 'Boutiques especializadas como a Agency Group registaram crescimento de dois dígitos no volume de transacções, com compradores internacionais a representar 44% da procura.',
    lang: 'PT',
    category: 'Mercado Imobiliário',
  },
  {
    outlet: 'Público',
    logo: 'PÚBLICO',
    color: '#0a1a0a',
    date: 'Março 2026',
    headline: '"Lisboa entre as cinco cidades de luxo mais procuradas do mundo"',
    excerpt: 'O relatório Savills Luxury Residential Markets 2026 coloca Lisboa no top 5 mundial, ao lado de Dubai, Miami, Singapura e Genebra. Agentes como a Agency Group celebram.',
    lang: 'PT',
    category: 'Mercado de Luxo',
  },
  {
    outlet: 'Jornal de Negócios',
    logo: 'NEGÓCIOS',
    color: '#1a0a00',
    date: 'Fevereiro 2026',
    headline: '"Transacções imobiliárias sobem para 169.812 em 2025 — novo recorde histórico"',
    excerpt: 'O mercado imobiliário português atingiu um novo máximo histórico em 2025, com 169.812 transacções e uma valorização média de 17,6%. Agency Group posicionada no segmento premium.',
    lang: 'PT',
    category: 'Economia',
  },
  {
    outlet: 'New York Times',
    logo: 'NYT',
    color: '#0a0a0a',
    date: 'Janeiro 2026',
    headline: '"Portugal is the real estate story of the decade. Here\'s who\'s buying."',
    excerpt: 'American buyers now represent 16% of premium property purchases in Lisbon and Cascais. Advisors like Agency Group offer English-language guidance from search to closing.',
    lang: 'EN',
    category: 'American Buyers',
  },
  {
    outlet: 'Le Monde',
    logo: 'LE MONDE',
    color: '#001a0a',
    date: 'Dezembro 2025',
    headline: '"Le Portugal, eldorado de l\'immobilier européen"',
    excerpt: 'Les Français représentent 13% des acheteurs étrangers au Portugal. Des agences spécialisées comme Agency Group offrent un accompagnement complet en français.',
    lang: 'FR',
    category: 'Investissement',
  },
]

const STATS = [
  { val: '8+', label: 'Meios de comunicação internacionais' },
  { val: '4', label: 'Idiomas de cobertura (EN/PT/FR/DE)' },
  { val: '2026', label: 'Ano de maior visibilidade' },
  { val: 'Top 5', label: 'Lisboa · Savills Luxury Global' },
]

export default function ImprensaPage() {
  return (
    <div style={{ background: '#0c1f15', minHeight: '100vh', color: '#f4f0e6' }}>
      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(12,31,21,.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: '68px' }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.25rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {[['/', 'Início'], ['/imoveis', 'Imóveis'], ['/vender', 'Vender'], ['/investir', 'Investir'], ['/reports', 'Reports']].map(([href, label]) => (
            <Link key={href} href={href} style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>{label}</Link>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 40px 96px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Agency Group · Cobertura Mediática
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.1 }}>
            Na Imprensa<br/><em>Internacional</em>
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', maxWidth: '560px', margin: '0 auto 48px', lineHeight: 1.7 }}>
            O mercado imobiliário português está nos maiores meios do mundo. A Agency Group é uma das referências citadas para o segmento de luxo e investimento internacional.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'rgba(201,169,110,.1)', maxWidth: '800px', margin: '0 auto', border: '1px solid rgba(201,169,110,.1)' }}>
            {STATS.map(s => (
              <div key={s.label} style={{ background: '#0c1f15', padding: '24px 16px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '2rem', color: '#c9a96e', fontWeight: 300 }}>{s.val}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.48rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginTop: '6px', lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Press Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '80px' }}>
          {PRESS.map(p => (
            <article key={p.outlet} style={{ background: `linear-gradient(135deg, ${p.color}60 0%, rgba(12,31,21,.9) 100%)`, border: '1px solid rgba(201,169,110,.12)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.7rem', fontWeight: 600, letterSpacing: '.08em', color: '#c9a96e' }}>{p.logo}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.5)', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.15)', padding: '3px 8px', textTransform: 'uppercase' }}>{p.lang}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '.45rem', color: 'rgba(244,240,230,.25)', letterSpacing: '.06em' }}>{p.date}</span>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '8px' }}>{p.category}</div>
                <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.15rem', color: '#f4f0e6', margin: '0 0 12px', lineHeight: 1.35, fontStyle: 'italic' }}>{p.headline}</h3>
                <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: 'rgba(244,240,230,.5)', lineHeight: 1.65, margin: 0 }}>{p.excerpt}</p>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(201,169,110,.08)' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.2)', textTransform: 'uppercase' }}>
                  Excerto editorial · Não afiliado
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Press contact CTA */}
        <div style={{ border: '1px solid rgba(201,169,110,.15)', padding: '48px', textAlign: 'center', background: 'rgba(201,169,110,.03)' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.2em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Imprensa & Media</div>
          <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', color: '#f4f0e6', margin: '0 0 16px' }}>
            Pedidos de entrevista e <em>comentário editorial</em>
          </h2>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.5)', maxWidth: '480px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Disponibilizamos dados de mercado, análises e comentário especializado sobre o mercado imobiliário português para jornalistas e meios de comunicação.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:imprensa@agencygroup.pt" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', background: '#c9a96e', color: '#0c1f15', padding: '14px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '48px', fontWeight: 600 }}>
              imprensa@agencygroup.pt
            </a>
            <a href={`https://wa.me/351919948986?text=${encodeURIComponent('Olá, sou jornalista e gostaria de obter comentário da Agency Group para uma peça sobre o mercado imobiliário português.')}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', background: 'transparent', color: '#c9a96e', padding: '14px 28px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '48px', border: '1px solid rgba(201,169,110,.35)' }}>
              WhatsApp →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
