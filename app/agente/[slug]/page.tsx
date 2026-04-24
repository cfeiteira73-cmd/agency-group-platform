import type { Metadata } from 'next'
import Link from 'next/link'

const AGENTS: Record<string, {
  nome: string, titulo: string, foto_initials: string,
  linguas: string[], ami: string, telefone: string, email: string,
  stats: { vendidos: string, transacoes: string, anos: string, rating: string },
  especialidades: string[], track_record: Array<{nome: string, preco: string, ano: string, zona: string}>,
  testemunhos: Array<{autor: string, pais: string, flag: string, texto: string, data: string}>,
  servicos: string[], bio: string
}> = {
  'carlos': {
    nome: 'Carlos Feiteira',
    titulo: 'Consultor Sénior · Imobiliário de Luxo',
    foto_initials: 'CF',
    linguas: ['🇵🇹 Português', '🇬🇧 English', '🇫🇷 Français'],
    ami: 'AMI 22506',
    telefone: '+351 919 948 986',
    email: 'geral@agencygroup.pt',
    stats: { vendidos: '€45M+', transacoes: '127', anos: '11', rating: '4.9★' },
    especialidades: [
      'Lisboa Prime (Príncipe Real · Chiado · Belém)',
      'Cascais & Estoril (Quinta da Marinha)',
      'Comporta & Alentejo Litoral',
      'Algarve Premium (Vale do Lobo · Quinta do Lago)',
      'Madeira (Funchal · Câmara de Lobos)',
      'Sintra & Serra de Sintra',
    ],
    track_record: [
      { nome: 'Penthouse Príncipe Real', preco: '€2.85M', ano: '2026', zona: 'Lisboa' },
      { nome: 'Villa Quinta da Marinha', preco: '€3.8M', ano: '2026', zona: 'Cascais' },
      { nome: 'Herdade Comporta Exclusiva', preco: '€6.5M', ano: '2025', zona: 'Comporta' },
      { nome: 'Apartamento Chiado Premium', preco: '€1.45M', ano: '2025', zona: 'Lisboa' },
      { nome: 'Villa Vale do Lobo Golf', preco: '€4.2M', ano: '2025', zona: 'Algarve' },
      { nome: 'Quinta Histórica Sintra', preco: '€2.8M', ano: '2024', zona: 'Sintra' },
    ],
    testemunhos: [
      { autor: 'James & Sarah Mitchell', pais: 'United Kingdom', flag: '🇬🇧', data: 'Janeiro 2026',
        texto: 'Carlos found our dream villa in Cascais in under 3 weeks. The level of service, market knowledge and personal attention is truly world-class. We\'ve bought properties in London, Dubai and Monaco — Agency Group surpasses them all.' },
      { autor: 'Mohammed Al-Rashidi', pais: 'Dubai, UAE', flag: '🇦🇪', data: 'Dezembro 2025',
        texto: 'The Comporta herdade acquisition was seamlessly executed. Carlos anticipated every regulatory challenge before it arose, negotiated masterfully on our behalf, and delivered 15% below the initial asking price.' },
      { autor: 'Chen Wei', pais: 'Hong Kong', flag: '🇨🇳', data: 'Novembro 2025',
        texto: 'As overseas buyers navigating Portuguese law for the first time, we needed an advisor we could trust completely. Agency Group provided end-to-end support — from NIF to final deed — with exceptional competence and discretion.' },
    ],
    servicos: [
      'Compra e Venda de Imóvel',
      'Valorização AVM Gratuita',
      'Consultoria de Investimento',
      'Gestão de Arrendamento',
      'Apoio Fiscal (NHR/IFICI)',
      'Coordenação Jurídica',
    ],
    bio: 'Com mais de 11 anos de experiência exclusiva no segmento de luxo em Portugal, Carlos Feiteira é reconhecido como um dos consultores imobiliários mais bem posicionados do mercado ibérico. Formado em Economia pela Nova SBE e com MBA em Real Estate pela INSEAD, combina rigor analítico com um profundo conhecimento dos mercados de Lisboa, Cascais, Comporta e Algarve. Fluente em português, inglês e francês, trabalha com compradores de 30+ nacionalidades e é especialista em transacções de €1M a €10M.',
  }
}

export function generateStaticParams() {
  return Object.keys(AGENTS).map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const agent = AGENTS[slug]
  if (!agent) return {}
  const ogImgUrl = `https://www.agencygroup.pt/api/og?title=${encodeURIComponent(agent.nome)}&subtitle=${encodeURIComponent(agent.titulo + ' · ' + agent.stats.vendidos + ' vendidos')}`
  return {
    title: `${agent.nome} · Consultor Luxury Real Estate · Agency Group`,
    description: `Consultor sénior de imobiliário de luxo em Portugal. ${agent.stats.vendidos} vendidos. Lisboa, Cascais, Comporta, Algarve. ${agent.ami}.`,
    alternates: { canonical: `https://www.agencygroup.pt/agente/${slug}` },
    openGraph: {
      title: `${agent.nome} · Agency Group`,
      description: `${agent.titulo} · ${agent.stats.vendidos} vendidos · Lisboa, Cascais, Algarve. ${agent.ami}.`,
      type: 'profile',
      url: `https://www.agencygroup.pt/agente/${slug}`,
      siteName: 'Agency Group',
      images: [{ url: ogImgUrl, width: 1200, height: 630, alt: agent.nome }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${agent.nome} · Agency Group`,
      description: `${agent.titulo} · ${agent.stats.vendidos} vendidos · AMI 22506.`,
      images: [ogImgUrl],
    },
  }
}

export default async function AgentePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agent = AGENTS[slug]
  if (!agent) return <div>Agente não encontrado</div>

  const waMsg = `Olá ${agent.nome}, gostaria de falar sobre imobiliário de luxo em Portugal.`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: agent.nome,
    jobTitle: agent.titulo,
    worksFor: { '@type': 'Organization', name: 'Agency Group' },
    telephone: agent.telefone,
    email: agent.email,
    knowsLanguage: ['pt', 'en', 'fr'],
  }

  return (
    <div style={{ background: '#060d08', minHeight: '100vh', color: '#f4f0e6', fontFamily: "'Jost', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        background: 'rgba(6,13,8,.97)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(201,169,110,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 60px', height: '72px',
      }}>
        <Link href="/" style={{ fontFamily: "'Cormorant', serif", fontSize: '1.3rem', fontWeight: 300, color: '#f4f0e6', textDecoration: 'none', letterSpacing: '.08em' }}>
          Agency<span style={{ color: '#c9a96e' }}>Group</span>
        </Link>
        <div style={{ display: 'flex', gap: '32px' }}>
          <Link href="/imoveis" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Imóveis</Link>
          <Link href="/reports" style={{ fontFamily: "'Jost', sans-serif", fontSize: '.7rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(244,240,230,.55)', textDecoration: 'none' }}>Relatórios</Link>
        </div>
        <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
          style={{ background: '#25D366', color: '#fff', padding: '10px 28px', fontFamily: "'Jost', sans-serif", fontSize: '.6rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
          WhatsApp →
        </a>
      </nav>

      {/* HERO */}
      <div style={{
        paddingTop: '72px',
        background: 'linear-gradient(160deg, #0a1f12 0%, #060d08 50%, #0c1a10 100%)',
        borderBottom: '1px solid rgba(201,169,110,.1)',
        padding: '120px 60px 80px',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '60px', alignItems: 'center' }}>
          {/* Avatar */}
          <div style={{
            width: '200px', height: '200px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #1c4a35, #0c1f15)',
            border: '2px solid rgba(201,169,110,.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'Cormorant', serif", fontSize: '4rem', fontWeight: 300, color: '#c9a96e', letterSpacing: '.1em' }}>{agent.foto_initials}</span>
          </div>

          {/* Info */}
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.28em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '12px' }}>
              {agent.ami} · Consultor de Luxo
            </div>
            <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: '#f4f0e6', margin: '0 0 8px', lineHeight: 1.1 }}>
              {agent.nome}
            </h1>
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.9rem', color: 'rgba(244,240,230,.5)', marginBottom: '20px' }}>
              {agent.titulo}
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
              {agent.linguas.map(l => (
                <span key={l} style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(201,169,110,.7)', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.2)', padding: '4px 12px' }}>{l}</span>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '0', borderTop: '1px solid rgba(201,169,110,.1)', paddingTop: '24px' }}>
              {[
                ['Volume Vendas', agent.stats.vendidos],
                ['Transacções', agent.stats.transacoes],
                ['Anos Exp.', agent.stats.anos],
                ['Rating', agent.stats.rating],
              ].map(([label, val], i) => (
                <div key={label} style={{ paddingRight: '32px', marginRight: '32px', borderRight: i < 3 ? '1px solid rgba(201,169,110,.1)' : 'none' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.8rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BIO */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '72px 60px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '20px' }}>Sobre</div>
            <p style={{ fontFamily: "'Cormorant', serif", fontSize: '1.2rem', lineHeight: 1.8, color: 'rgba(244,240,230,.75)', fontWeight: 300, margin: 0 }}>{agent.bio}</p>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '20px' }}>Especialidades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agent.especialidades.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px solid rgba(201,169,110,.1)', background: 'rgba(201,169,110,.03)' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#c9a96e', flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: 'rgba(244,240,230,.65)' }}>{e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TRACK RECORD */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '72px 60px 0' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
          Track Record · Selecção de Transacções
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {agent.track_record.map((t, i) => (
            <div key={i} style={{ background: '#0a1a10', border: '1px solid rgba(201,169,110,.1)', padding: '24px' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(201,169,110,.5)', textTransform: 'uppercase', marginBottom: '8px' }}>{t.zona} · {t.ano}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', fontWeight: 300, color: '#f4f0e6', marginBottom: '10px', lineHeight: 1.3 }}>{t.nome}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.5rem', color: '#c9a96e', fontWeight: 300 }}>{t.preco}</div>
              <div style={{ marginTop: '12px', display: 'inline-block', background: 'rgba(28,74,53,.4)', border: '1px solid rgba(28,74,53,.6)', color: '#4a9c7a', fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', padding: '3px 10px', textTransform: 'uppercase' }}>Vendido</div>
            </div>
          ))}
        </div>
      </div>

      {/* TESTEMUNHOS */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '72px 60px 0' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '32px' }}>
          Testemunhos de Clientes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {agent.testemunhos.map((t, i) => (
            <div key={i} style={{ background: 'linear-gradient(135deg, rgba(201,169,110,.06) 0%, rgba(12,31,21,.3) 100%)', border: '1px solid rgba(201,169,110,.12)', padding: '28px' }}>
              <div style={{ color: '#c9a96e', fontSize: '1rem', marginBottom: '16px', letterSpacing: '.1em' }}>★★★★★</div>
              <p style={{ fontFamily: "'Cormorant', serif", fontSize: '1.05rem', lineHeight: 1.7, color: 'rgba(244,240,230,.75)', fontWeight: 300, fontStyle: 'italic', margin: '0 0 20px' }}>"{t.texto}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(201,169,110,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant', serif", fontSize: '.9rem', color: '#c9a96e' }}>{t.autor[0]}</div>
                <div>
                  <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: '#f4f0e6', fontWeight: 600 }}>{t.autor}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.35)' }}>{t.flag} {t.pais} · {t.data}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SERVIÇOS */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '72px 60px 0' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '24px' }}>Serviços</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {agent.servicos.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', border: '1px solid rgba(201,169,110,.1)', background: 'rgba(201,169,110,.03)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c9a96e' }} />
              <span style={{ fontFamily: "'Jost', sans-serif", fontSize: '.8rem', color: 'rgba(244,240,230,.7)' }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{
        maxWidth: '1100px', margin: '72px auto 0', padding: '0 60px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,169,110,.08) 0%, rgba(12,31,21,.4) 100%)',
          border: '1px solid rgba(201,169,110,.15)',
          padding: '64px', textAlign: 'center',
          marginBottom: '80px',
        }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.24em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '16px' }}>Disponível para nova consulta</div>
          <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f4f0e6', margin: '0 0 12px' }}>Pronto para encontrar a sua propriedade ideal?</h2>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.82rem', color: 'rgba(244,240,230,.45)', maxWidth: '500px', margin: '0 auto 36px', lineHeight: 1.7 }}>
            Serviço completamente personalizado. Resposta em menos de 2 horas. Sem compromisso.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
              style={{ background: '#25D366', color: '#fff', padding: '16px 40px', fontFamily: "'Jost', sans-serif", fontSize: '.65rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Iniciar Conversa WhatsApp →
            </a>
            <a href={`mailto:${agent.email}`}
              style={{ background: 'transparent', color: '#c9a96e', padding: '16px 32px', border: '1px solid rgba(201,169,110,.4)', fontFamily: "'Jost', sans-serif", fontSize: '.62rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Enviar Email
            </a>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(201,169,110,.1)', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.1rem', color: '#c9a96e' }}>Agency<span style={{ color: '#f4f0e6' }}>Group</span></div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.25)', textTransform: 'uppercase' }}>{agent.ami} · Lisboa, Portugal</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)' }}>{agent.telefone}</div>
      </div>
    </div>
  )
}
