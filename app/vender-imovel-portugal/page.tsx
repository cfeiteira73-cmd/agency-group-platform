import type { Metadata } from 'next'
import Link from 'next/link'

// =============================================================================
// /vender-imovel-portugal — SEO seller landing page
// Targets: "vender imóvel Portugal", "vender casa discretamente", "off-market Portugal"
// =============================================================================

export const metadata: Metadata = {
  title: 'Vender Imóvel em Portugal · Processo Discreto & Off-Market | Agency Group',
  description:
    'Venda o seu imóvel em Portugal de forma discreta, sem exposição pública. Acesso a compradores qualificados internacionais. Avaliação confidencial. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/vender-imovel-portugal',
    languages: {
      pt: 'https://www.agencygroup.pt/vender-imovel-portugal',
      'x-default': 'https://www.agencygroup.pt/vender-imovel-portugal',
    },
  },
  openGraph: {
    title: 'Vender Imóvel em Portugal · Processo Discreto | Agency Group',
    description: 'Venda sem exposição pública. Compradores qualificados. Processo controlado até escritura.',
    type: 'website',
    url: 'https://www.agencygroup.pt/vender-imovel-portugal',
    siteName: 'Agency Group',
  },
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Como posso vender o meu imóvel sem anúncios públicos em Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Através de um processo off-market: a propriedade é apresentada confidencialmente à nossa rede privada de compradores internacionais qualificados. Sem portais imobiliários, sem visitas abertas, sem exposição pública do preço ou das condições. A Agency Group (AMI 22506) gere todo o processo de forma discreta.' } },
    { '@type': 'Question', name: 'Quanto tempo demora a vender um imóvel premium em Portugal?', acceptedAnswer: { '@type': 'Answer', text: 'Imóveis premium em Lisboa e Cascais têm tempo médio de absorção de 45–90 dias em processo off-market com compradores qualificados. O processo tradicional em portais públicos pode demorar 6–18 meses. A abordagem discreta acelera a venda ao pré-qualificar o comprador antes da primeira visita.' } },
    { '@type': 'Question', name: 'Qual é a comissão da Agency Group para venda de imóvel?', acceptedAnswer: { '@type': 'Answer', text: 'A comissão standard da Agency Group é 5% sobre o preço de venda (+ IVA), paga em dois momentos: 50% na assinatura do CPCV e 50% na escritura. Esta estrutura alinha os interesses do consultor com os do proprietário. Não há custos de avaliação ou listagem.' } },
    { '@type': 'Question', name: 'A Agency Group vende imóveis fora de Lisboa?', acceptedAnswer: { '@type': 'Answer', text: 'Sim. A Agency Group opera em todo o território nacional, com mandatos activos em Lisboa, Cascais, Sintra, Comporta, Porto, Algarve e Madeira. Operamos também em Espanha (Madrid e Barcelona) para proprietários portugueses com activos ibéricos.' } },
    { '@type': 'Question', name: 'O que é um mandato exclusivo e quais as vantagens?', acceptedAnswer: { '@type': 'Answer', text: 'Um mandato exclusivo atribui à Agency Group a representação exclusiva na venda durante um período acordado (tipicamente 90 dias). As vantagens: investimento de marketing premium, acesso à rede internacional completa, e negociação mais forte porque o consultor não compete contra outros agentes. Proprietários com mandato exclusivo recebem prioridade de apresentação na rede privada.' } },
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Mediação de Venda Imobiliária Off-Market em Portugal',
  description: 'Serviço de venda imobiliária discreta para proprietários de ativos premium em Portugal. Processo off-market com acesso a compradores internacionais qualificados.',
  provider: {
    '@type': 'RealEstateAgent',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
    telephone: '+351919948986',
    email: 'geral@agencygroup.pt',
    areaServed: ['Lisboa', 'Cascais', 'Comporta', 'Porto', 'Algarve', 'Madeira'],
  },
  serviceType: 'Real Estate Sales',
  areaServed: { '@type': 'Country', name: 'Portugal' },
}

const STEPS = [
  {
    n: '01',
    title: 'Avaliação confidencial',
    desc: 'Analisamos o seu imóvel com dados reais de transacções recentes na zona. Sem visitas públicas, sem anúncios, sem compromisso.',
  },
  {
    n: '02',
    title: 'Acesso a compradores qualificados',
    desc: 'Apresentamos o ativo à nossa rede privada de compradores internacionais — Norte-americanos, Franceses, Britânicos, Médio Oriente e Asiáticos com capital disponível.',
  },
  {
    n: '03',
    title: 'Processo controlado até escritura',
    desc: 'Gerimos toda a negociação, CPCV e escritura. Controlo total em cada etapa. O proprietário decide sempre.',
  },
]

const ZONES = [
  { name: 'Lisboa', pm2: '€6.538/m²', growth: '+19%' },
  { name: 'Cascais', pm2: '€6.638/m²', growth: '+14%' },
  { name: 'Comporta', pm2: '€11.000/m²', growth: '+28%' },
  { name: 'Porto', pm2: '€4.528/m²', growth: '+12%' },
  { name: 'Algarve', pm2: '€5.200/m²', growth: '+10%' },
  { name: 'Madeira', pm2: '€3.760/m²', growth: '+20%' },
]

export default function VenderImovelPortugal() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <main style={{ fontFamily: "var(--font-jost, 'Jost', sans-serif)", color: '#0e0e0d', background: '#f4f0e6' }}>

        {/* ── Nav ── */}
        <nav style={{
          background: '#0c1f15', borderBottom: '1px solid rgba(201,169,110,.12)',
          padding: '18px 40px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#c9a96e', fontSize: '1rem', letterSpacing: '.08em', fontWeight: 600, fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)" }}>Agency</span>
            <span style={{ color: '#f4f0e6', fontSize: '1rem', letterSpacing: '.08em', fontWeight: 300, fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)" }}>Group</span>
          </Link>
          <Link href="/contacto" style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.6rem', letterSpacing: '.14em',
            textTransform: 'uppercase', color: '#c9a96e', textDecoration: 'none',
          }}>
            Avaliação Gratuita →
          </Link>
        </nav>

        {/* ── Hero ── */}
        <section style={{ background: '#0c1f15', padding: '96px 24px 80px', textAlign: 'center' }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.55rem', letterSpacing: '.2em',
            textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: 20,
          }}>
            Portugal · Venda Discreta · AMI 22506
          </div>
          <h1 style={{
            fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
            fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 300, color: '#f4f0e6',
            lineHeight: 1.12, margin: '0 auto 20px', maxWidth: 720,
          }}>
            Vender o seu imóvel em Portugal.<br />
            <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>Sem exposição. Com controlo.</em>
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.7rem', color: 'rgba(244,240,230,.5)',
            maxWidth: 520, margin: '0 auto 48px', lineHeight: 1.7, letterSpacing: '.03em',
          }}>
            Ligamos proprietários a compradores internacionais qualificados, sem anúncios públicos.
            Processo discreto, controlado e profissional até à escritura.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/off-market" style={{
              background: '#c9a96e', color: '#0c1f15',
              padding: '16px 40px', textDecoration: 'none',
              fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
              fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
            }}>
              Solicitar Avaliação Confidencial →
            </Link>
            <a href="https://wa.me/351919948986?text=Olá,%20pretendo%20vender%20o%20meu%20imóvel%20de%20forma%20discreta." target="_blank" rel="noopener noreferrer" style={{
              background: 'transparent', color: '#c9a96e',
              border: '1px solid rgba(201,169,110,.4)', padding: '16px 40px',
              textDecoration: 'none', fontFamily: "'Jost', sans-serif",
              fontSize: '.65rem', fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
            }}>
              Falar com Consultor →
            </a>
          </div>
        </section>

        {/* ── Como funciona ── */}
        <section style={{ padding: '88px 24px', maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.55rem', letterSpacing: '.18em',
            textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: 48, textAlign: 'center',
          }}>
            O processo
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{
                display: 'flex', gap: 24, alignItems: 'flex-start',
                padding: '24px 28px', background: '#fff',
                borderLeft: '2px solid rgba(201,169,110,.3)',
              }}>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: '.55rem',
                  color: 'rgba(201,169,110,.5)', letterSpacing: '.08em', flexShrink: 0, paddingTop: 3,
                }}>{s.n}</div>
                <div>
                  <h2 style={{
                    fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
                    fontSize: '1.3rem', fontWeight: 400, color: '#0e0e0d',
                    margin: '0 0 8px',
                  }}>{s.title}</h2>
                  <p style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.85rem',
                    color: 'rgba(14,14,13,.55)', lineHeight: 1.7, margin: 0,
                  }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Mid CTA ── */}
        <section style={{ borderTop: '1px solid rgba(14,14,13,.06)', borderBottom: '1px solid rgba(14,14,13,.06)', padding: '32px 24px', background: '#fff' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.5rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: 8 }}>
                Resposta em menos de 2h
              </div>
              <p style={{ fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)", fontSize: '1.2rem', fontWeight: 300, color: '#0e0e0d', margin: 0, lineHeight: 1.3 }}>
                Avaliação confidencial do seu imóvel, sem compromisso.
              </p>
            </div>
            <a href="https://wa.me/351919948986?text=Olá,%20pretendo%20saber%20o%20valor%20do%20meu%20imóvel%20de%20forma%20confidencial." target="_blank" rel="noopener noreferrer" style={{
              background: '#1c4a35', color: '#f4f0e6',
              padding: '14px 32px', textDecoration: 'none',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.16em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Falar no WhatsApp →
            </a>
          </div>
        </section>

        {/* ── Mercado por zona ── */}
        <section style={{ background: '#0c1f15', padding: '72px 24px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: '.55rem', letterSpacing: '.18em',
              textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: 40, textAlign: 'center',
            }}>
              Referências de mercado · Portugal 2026
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
            }}>
              {ZONES.map(z => (
                <div key={z.name} style={{
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(201,169,110,.1)',
                  padding: '16px 20px',
                }}>
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem',
                    fontWeight: 400, color: '#f4f0e6', marginBottom: 4,
                  }}>{z.name}</div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.6rem',
                    color: '#c9a96e', letterSpacing: '.04em',
                  }}>{z.pm2}</div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
                    color: 'rgba(244,240,230,.3)', letterSpacing: '.04em',
                  }}>{z.growth} · 2025</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Por que off-market ── */}
        <section style={{ padding: '80px 24px', maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
            fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 300, color: '#0e0e0d',
            marginBottom: 40, lineHeight: 1.2,
          }}>
            Por que vender sem<br />
            <em style={{ color: '#1c4a35', fontStyle: 'italic' }}>exposição pública?</em>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { title: 'Controlo total do processo', desc: 'O proprietário decide quem visita, quando e em que condições.' },
              { title: 'Acesso a compradores qualificados', desc: 'Network privado de compradores internacionais com capital disponível. Sem turistas, sem curiosos.' },
              { title: 'Preservação da privacidade', desc: 'Sem anúncios públicos, sem fotos online, sem exposição indesejada.' },
              { title: 'Negociação em posição de força', desc: 'Sem pressão pública de prazo, sem sinalização de urgência ao mercado.' },
            ].map(item => (
              <div key={item.title} style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#c9a96e',
                  flexShrink: 0, marginTop: 8,
                }} />
                <div>
                  <div style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.9rem',
                    fontWeight: 600, color: '#0e0e0d', marginBottom: 4,
                  }}>{item.title}</div>
                  <div style={{
                    fontFamily: "'Jost', sans-serif", fontSize: '.83rem',
                    color: 'rgba(14,14,13,.5)', lineHeight: 1.6,
                  }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section style={{
          background: '#1c4a35', padding: '72px 24px', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.55rem', letterSpacing: '.18em',
            textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: 20,
          }}>
            Avaliação confidencial · Sem compromisso
          </div>
          <h2 style={{
            fontFamily: "var(--font-cormorant, 'Cormorant Garamond', serif)",
            fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, color: '#f4f0e6',
            margin: '0 auto 16px', maxWidth: 560, lineHeight: 1.2,
          }}>
            Pronto para avaliar<br />o seu imóvel?
          </h2>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.65rem',
            color: 'rgba(244,240,230,.5)', marginBottom: 36, letterSpacing: '.04em',
          }}>
            Consultor contacta em menos de 2 horas. Processo 100% discreto.
          </p>
          <Link href="/contacto" style={{
            background: '#c9a96e', color: '#0c1f15',
            padding: '18px 48px', textDecoration: 'none',
            fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
            fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
            display: 'inline-block', marginBottom: 16,
          }}>
            Solicitar Avaliação Confidencial →
          </Link>
          <div style={{ marginTop: 8 }}>
            <a href="https://wa.me/351919948986?text=Olá,%20gostaria%20de%20uma%20avaliação%20confidencial%20do%20meu%20imóvel" target="_blank" rel="noopener noreferrer" style={{
              color: 'rgba(244,240,230,.5)', fontFamily: "'DM Mono', monospace",
              fontSize: '.55rem', letterSpacing: '.1em', textDecoration: 'none',
            }}>
              Ou fala connosco pelo WhatsApp →
            </a>
          </div>
        </section>

        {/* ── Related resources ── */}
        <section style={{ background: '#f4f0e6', padding: '60px 40px', maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.46rem', letterSpacing: '.2em', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', marginBottom: 24 }}>
            Recursos Relacionados
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {[
              { href: '/buy-property-portugal', label: 'Comprar Imóvel em Portugal →' },
              { href: '/invest-in-portugal-real-estate', label: 'Investimento Imobiliário Portugal →' },
              { href: '/off-market-portugal', label: 'Propriedades Off-Market →' },
              { href: '/imoveis', label: 'Ver Imóveis Disponíveis →' },
              { href: '/agente/carlos', label: 'Consultor Carlos Feiteira →' },
              { href: '/contacto', label: 'Contacto Directo →' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontFamily: "'Jost', sans-serif", fontSize: '.78rem', color: '#1c4a35', textDecoration: 'none', borderBottom: '1px solid rgba(28,74,53,.15)', paddingBottom: 12 }}>
                {l.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          background: '#0e0e0d', padding: '32px 40px', textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
            letterSpacing: '.18em', color: 'rgba(255,255,255,.2)',
          }}>
            © 2026 Agency Group – Mediação Imobiliária Lda · NIPC 516.833.960 · AMI 22506 · Lisboa
            {' · '}
            <Link href="/faq" style={{ color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>FAQ</Link>
            {' · '}
            <Link href="/blog" style={{ color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Blog</Link>
          </p>
        </footer>

      </main>
    </>
  )
}
