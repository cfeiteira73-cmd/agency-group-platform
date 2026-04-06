import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Relatórios de Mercado Imobiliário Portugal 2026 — Agency Group',
  description: 'Descarregue relatórios exclusivos do mercado imobiliário de luxo em Portugal: Lisboa, Cascais, Comporta, Porto, Algarve, Madeira. Dados 2026.',
}

// Reports data
const ZONE_REPORTS = [
  { zona: 'Lisboa', pages: 24, updated: 'Março 2026', price_range: '€890K–€6.5M', key_stat: '+14% YoY', color: '#1c3a5e', emoji: '🏛️', highlights: ['Top 5 Luxury Mundial (Savills 2026)', '€5.000/m² média', '4.2% yield bruto', 'Procura: EUA 16%, FR 13%, UK 9%'] },
  { zona: 'Cascais', pages: 18, updated: 'Março 2026', price_range: '€1.35M–€3.8M', key_stat: '+12% YoY', color: '#0e2a3a', emoji: '🏖️', highlights: ['Riviera Portuguesa', '€4.713/m² média', 'TASIS + CAISL escolas', 'Resorts golf exclusivos'] },
  { zona: 'Comporta', pages: 16, updated: 'Fevereiro 2026', price_range: '€2.8M–€6.5M', key_stat: '+22% YoY', color: '#2a1e0a', emoji: '🌾', highlights: ['O Hamptons Português', '€6.500/m² prime', '5.8% yield turismo', 'Natureza protegida por lei'] },
  { zona: 'Porto', pages: 20, updated: 'Março 2026', price_range: '€520K–€1.25M', key_stat: '+12% YoY', color: '#2a1505', emoji: '🍷', highlights: ['Melhor yield de Portugal', '€3.643/m² média', 'Foz Douro premium', 'Aeroporto directo NYC/GRU'] },
  { zona: 'Algarve', pages: 22, updated: 'Março 2026', price_range: '€1.1M–€4.2M', key_stat: '+11% YoY', color: '#2a1a05', emoji: '☀️', highlights: ['300 dias de sol/ano', '4.8% yield médio', 'Vale do Lobo + Quinta do Lago', 'Nobel International School'] },
  { zona: 'Madeira', pages: 14, updated: 'Fevereiro 2026', price_range: '€980K–€1.45M', key_stat: '+18% YoY', color: '#0a2a1e', emoji: '🌺', highlights: ['IFICI elegível', '€3.760/m² média', 'Nova construção 2024-2026', 'Único aeroporto Europa'] },
  { zona: 'Sintra', pages: 16, updated: 'Janeiro 2026', price_range: '€1.2M–€2.8M', key_stat: '+9% YoY', color: '#1e2a0a', emoji: '🏰', highlights: ['UNESCO World Heritage', '€3.200/m² média', 'Quintas históricas séc. XIX', 'A5: Lisboa 30 min'] },
  { zona: 'Ericeira', pages: 12, updated: 'Fevereiro 2026', price_range: '€650K–€1.1M', key_stat: '+15% YoY', color: '#0a1e2a', emoji: '🏄', highlights: ['World Surf Reserve', 'Yield turístico 6%', 'Comunidade criativa emergente', 'A21: Lisboa 40 min'] },
]

const THEMATIC_REPORTS = [
  { title: 'Guia NHR / IFICI 2026', subtitle: 'Regime Fiscal para Residentes Não Habituais', pages: 28, icon: '📋', tag: 'Fiscal', desc: 'Tudo sobre o regime de residentes não habituais e o novo IFICI. Comparação de 12 países, casos práticos e simulações.' },
  { title: 'Guia do Comprador Estrangeiro', subtitle: 'Comprar Imóvel em Portugal: Passo a Passo', pages: 32, icon: '🌍', tag: 'Jurídico', desc: 'Do NIF à Escritura. CPCV, IMT, IS, custos, advogados, bancos. Tudo o que precisa de saber para comprar em Portugal.' },
  { title: 'Outlook Investimento 2026-2030', subtitle: 'Perspectivas e Oportunidades no Mercado Português', pages: 36, icon: '📈', tag: 'Investimento', desc: 'Análise macroeconómica, yields projectados, zonas emergentes, factores de risco e estratégias de portfolio para os próximos 5 anos.' },
  { title: 'Luxury Market Portugal 2026', subtitle: 'O Segmento Premium €1M+ em Análise Profunda', pages: 44, icon: '💎', tag: 'Luxo', desc: 'Perfil do comprador de luxo, tendências arquitectónicas, zonas ultra-prime, e porque Lisboa entrou no Top 5 Mondiale de Savills.' },
]

export default function ReportsPage() {
  return (
    <div style={{ background: '#0c1f15', minHeight: '100vh', color: '#f4f0e6' }}>
      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900, background: 'rgba(12,31,21,.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: '68px' }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.25rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>Agency<span style={{ color: '#c9a96e' }}>Group</span></Link>
        <Link href="/imoveis" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.55)', textDecoration: 'none', textTransform: 'uppercase' }}>← Ver Imóveis</Link>
      </nav>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '128px 40px 96px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>
            Inteligência de Mercado · 2026
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: '#f4f0e6', margin: '0 0 20px', lineHeight: 1.1 }}>
            Relatórios de Mercado<br/>
            <em>Exclusivos</em>
          </h1>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.55)', maxWidth: '560px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Análises rigorosas do mercado imobiliário português elaboradas pela equipa de research da Agency Group. Dados actualizados, metodologia transparente.
          </p>
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['12', 'Relatórios'], ['2026', 'Dados Actualizados'], ['Gratuito', 'Para Clientes']].map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.8rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.35)', textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Reports */}
        <div style={{ marginBottom: '80px' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Relatórios por Zona
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {ZONE_REPORTS.map(r => (
              <ReportCard key={r.zona} report={r} type="zone" />
            ))}
          </div>
        </div>

        {/* Thematic Reports */}
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
            Relatórios Temáticos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {THEMATIC_REPORTS.map(r => (
              <ThematicCard key={r.title} report={r} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportCard({ report, type }: { report: typeof ZONE_REPORTS[0], type: string }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${report.color}40 0%, rgba(12,31,21,.8) 100%)`,
      border: '1px solid rgba(201,169,110,.12)',
      padding: '28px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{report.emoji}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '6px' }}>
        Relatório de Zona
      </div>
      <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.5rem', color: '#f4f0e6', margin: '0 0 16px' }}>
        Mercado {report.zona} 2026
      </h3>
      <div style={{ marginBottom: '20px' }}>
        {report.highlights.map((h, i) => (
          <div key={i} style={{ fontFamily: "'Jost', sans-serif", fontSize: '.65rem', color: 'rgba(244,240,230,.6)', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#c9a96e', fontSize: '.5rem' }}>→</span> {h}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid rgba(201,169,110,.1)' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {report.pages} pág · {report.updated}
        </div>
        <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', color: '#c9a96e' }}>{report.key_stat}</div>
      </div>
      <a
        href={`https://wa.me/351919948986?text=${encodeURIComponent(`Olá, gostaria de receber o Relatório de Mercado ${report.zona} 2026 da Agency Group.`)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'block', background: '#c9a96e', color: '#0c1f15',
          textAlign: 'center', padding: '12px',
          fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
          fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        Descarregar Grátis →
      </a>
    </div>
  )
}

function ThematicCard({ report }: { report: typeof THEMATIC_REPORTS[0] }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.025)',
      border: '1px solid rgba(201,169,110,.12)',
      padding: '28px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ fontSize: '2rem' }}>{report.icon}</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(201,169,110,.7)', textTransform: 'uppercase', background: 'rgba(201,169,110,.08)', padding: '4px 10px', border: '1px solid rgba(201,169,110,.2)' }}>
          {report.tag}
        </div>
      </div>
      <h3 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.3rem', color: '#f4f0e6', margin: '0 0 6px' }}>{report.title}</h3>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '16px' }}>{report.subtitle}</div>
      <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.68rem', color: 'rgba(244,240,230,.55)', lineHeight: 1.65, margin: '0 0 20px' }}>{report.desc}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(201,169,110,.1)', marginBottom: '20px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{report.pages} páginas</div>
      </div>
      <a
        href={`https://wa.me/351919948986?text=${encodeURIComponent(`Olá, gostaria de receber o relatório "${report.title}" da Agency Group.`)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'block', background: 'transparent', color: '#c9a96e',
          textAlign: 'center', padding: '12px',
          fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
          fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
          textDecoration: 'none', border: '1px solid rgba(201,169,110,.35)',
        }}
      >
        Solicitar Relatório →
      </a>
    </div>
  )
}
