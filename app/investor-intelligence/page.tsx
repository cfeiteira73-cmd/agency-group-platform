import type { Metadata } from 'next'
import Link from 'next/link'
import InvestorLeadForm from '@/app/components/InvestorLeadForm'
import HomeNav from '@/app/components/HomeNav'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Investor Intelligence — Relatório de Inteligência Imobiliária Portugal 2026 | Agency Group',
  description:
    'Subscrição mensal: dados de mercado em tempo real, alertas de off-market, análises de rendimento, relatório trimestral. Portugal real estate intelligence. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/investor-intelligence',
    languages: {
      pt: 'https://www.agencygroup.pt/investor-intelligence',
      en: 'https://www.agencygroup.pt/investor-intelligence',
      'x-default': 'https://www.agencygroup.pt/investor-intelligence',
    },
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Investor Intelligence — Relatório de Inteligência Imobiliária Portugal 2026 | Agency Group',
    description:
      'Subscrição mensal: dados de mercado em tempo real, alertas de off-market, análises de rendimento, relatório trimestral. Portugal real estate intelligence. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/investor-intelligence',
    siteName: 'Agency Group',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Investor+Intelligence&subtitle=Portugal+Real+Estate+%C2%B7+2026+Data+%C2%B7+AMI+22506',
      width: 1200,
      height: 630,
      alt: 'Investor Intelligence Portugal 2026 — Agency Group',
    }],
  },
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Investor Intelligence — Agency Group',
  description:
    'Subscrição de inteligência imobiliária para Portugal: dados de mercado semanais, alertas de off-market, relatório trimestral, calculadora de rendimento, índices de preços por zona.',
  brand: {
    '@type': 'Brand',
    name: 'Agency Group',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Newsletter mensal, blog, AVM básica.',
    },
    {
      '@type': 'Offer',
      name: 'Intelligence',
      price: '49',
      priceCurrency: 'EUR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '49',
        priceCurrency: 'EUR',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: '1',
          unitCode: 'MON',
        },
      },
      description: 'Digest semanal, índices de preços por zona, calculadora de rendimento, alertas de listagens.',
    },
    {
      '@type': 'Offer',
      name: 'Elite',
      price: '199',
      priceCurrency: 'EUR',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '199',
        priceCurrency: 'EUR',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: '1',
          unitCode: 'MON',
        },
      },
      description: 'Alertas off-market em 24h, relatório PDF trimestral, consulta privada trimestral, rede de investidores.',
    },
  ],
  url: 'https://www.agencygroup.pt/investor-intelligence',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Os dados são baseados em transacções reais ou estimativas?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Os dados do Intelligence Report combinam três fontes: transacções registadas no INE e Confidencial Imobiliário, pipeline de listagens activas nos portais públicos, e dados exclusivos da Agency Group sobre imóveis off-market e em fase de negociação. Os índices de preços são calculados semanalmente sobre amostras de mais de 200 transacções por zona.',
      },
    },
    {
      '@type': 'Question',
      name: 'Posso cancelar a subscrição a qualquer momento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. Sem permanência mínima. Cancela via portal em qualquer momento e o acesso termina no final do período já pago. Não há penalizações nem taxas de cancelamento.',
      },
    },
    {
      '@type': 'Question',
      name: 'O que são os alertas de off-market do plano Elite?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Quando um imóvel que corresponde ao perfil de investimento definido no briefing inicial entra na nossa rede off-market, o subscritor Elite recebe uma notificação por WhatsApp e email dentro de 24 horas — antes de qualquer publicação pública. Inclui: localização, tipologia, preço indicativo e fotos preliminares.',
      },
    },
    {
      '@type': 'Question',
      name: 'O relatório trimestral está disponível em inglês?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. O relatório trimestral Portugal Real Estate Intelligence Report é publicado em português e inglês simultaneamente. Assinantes Elite recebem o PDF por email no primeiro dia útil de cada trimestre.',
      },
    },
  ],
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const TIERS = [
  {
    name: 'Free',
    price: '€0',
    period: '/mês',
    tagline: 'Para quem está a explorar',
    highlight: false,
    features: [
      'Newsletter mensal de mercado',
      'Acesso ao blog (guias e análises)',
      'AVM básica — estimativa de valor',
      'Estatísticas públicas por zona',
    ],
    cta: 'Subscrever Grátis',
    ctaHref: 'mailto:geral@agencygroup.pt?subject=Investor%20Intelligence%20Free&body=Ol%C3%A1%2C%20quero%20aceder%20ao%20plano%20gratuito%20do%20Investor%20Intelligence.',
    ctaStyle: 'outline',
  },
  {
    name: 'Intelligence',
    price: '€49',
    period: '/mês',
    tagline: 'Para investidores activos',
    highlight: true,
    features: [
      'Digest semanal de mercado (5 pontos)',
      'Índice de preços por zona — actualizado semanalmente',
      'Calculadora de rendimento líquido',
      'Mapa de calor de procura de arrendamento',
      'Alertas por email — listagens correspondentes ao critério',
      'Acesso ao arquivo histórico (12 meses)',
    ],
    cta: 'Começar Intelligence',
    ctaHref: 'mailto:geral@agencygroup.pt?subject=Investor%20Intelligence%20%E2%82%AC49%2Fm%C3%AAs&body=Ol%C3%A1%2C%0A%0AQuero%20subscrever%20o%20plano%20Intelligence%20%E2%82%AC49%2Fm%C3%AAs.%0A%0ANome%3A%20%0APa%C3%ADs%3A%20%0AObjetivo%3A%20%0A%0ACom%20os%20melhores%20cumprimentos%2C',
    ctaStyle: 'gold',
  },
  {
    name: 'Elite',
    price: '€199',
    period: '/mês',
    tagline: 'Para decisores e family offices',
    highlight: false,
    features: [
      'Tudo do plano Intelligence',
      'Alertas off-market — WhatsApp + email em 24h',
      'Relatório trimestral PDF (60+ páginas)',
      '1 consulta privada/trimestre',
      'Acesso ao pipeline de deals Agency Group',
      'Eventos rede de investidores',
    ],
    cta: 'Activar Elite',
    ctaHref: 'mailto:geral@agencygroup.pt?subject=Investor%20Intelligence%20Elite%20%E2%82%AC199%2Fm%C3%AAs&body=Ol%C3%A1%2C%0A%0AQuero%20subscrever%20o%20plano%20Elite%20%E2%82%AC199%2Fm%C3%AAs.%0A%0ANome%3A%20%0APa%C3%ADs%3A%20%0APortef%C3%B3lio%20imobili%C3%A1rio%20atual%3A%20%0AObjetivo%3A%20%0A%0ACom%20os%20melhores%20cumprimentos%2C',
    ctaStyle: 'dark',
  },
]

const DELIVERABLES = [
  {
    label: 'Weekly Bulletin',
    title: 'Boletim Semanal',
    desc: '5 pontos fixos: Euribor, volume de transacções, contagem de novas listagens, variações de preço por zona, alertas regulatórios.',
  },
  {
    label: 'Zone Price Index',
    title: 'Índice de Preços por Zona',
    desc: 'Lisboa, Cascais, Comporta, Algarve, Porto, Madeira — actualizado semanalmente com base em listagens activas e transacções fechadas.',
  },
  {
    label: 'Off-Market Pipeline',
    title: 'Pipeline Off-Market',
    desc: 'Imóveis antes de chegarem aos portais públicos. Vendedores discretos. Acesso exclusivo para subscritores Elite.',
  },
  {
    label: 'Quarterly Report',
    title: 'Relatório Trimestral',
    desc: 'Visão geral de mercado, 6 análises de zona em profundidade, rankings de investimento, deal do trimestre. PDF 60+ páginas.',
  },
]

const SAMPLE_DATA = [
  {
    zone: 'Comporta',
    preview: '+18% YoY · 23 listagens activas · 6 sob oferta...',
    blurred: true,
  },
  {
    zone: 'Off-Market Alert',
    preview: 'Villa Cascais €2.1M · 4Q · Apresentação privada...',
    blurred: true,
  },
  {
    zone: 'Rendimento Q1 2026',
    preview: 'Chiado 3.8% · Príncipe Real 3.5% · Parque Nações 4.6%...',
    blurred: false,
  },
  {
    zone: 'Euribor 6M',
    preview: '3.12% (abr 2026) · Tendência: −0.15bp/mês...',
    blurred: true,
  },
]

const SUBSCRIBER_PROFILES = [
  { icon: '🏢', title: 'Family Offices', desc: 'Acompanhamento de portfolio e oportunidades de entrada em Portugal.' },
  { icon: '💼', title: 'HNWI', desc: 'Compradores activos com critérios definidos. Alertas off-market em 24h.' },
  { icon: '🏗️', title: 'Promotores', desc: 'Dados de terreno, licenciamento e análise de pipeline de desenvolvimento.' },
  { icon: '🤝', title: 'Consultores', desc: 'Agentes e advogados que acompanham clientes internacionais em Portugal.' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InvestorIntelligencePage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <HomeNav />

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d', backgroundColor: '#f4f0e6' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="Investor Intelligence — introdução"
          style={{
            backgroundColor: '#0c1f15',
            padding: '140px 24px 80px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.72rem',
              fontWeight: 400,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#c9a96e',
              marginBottom: '24px',
            }}
          >
            AMI 22506 · Portugal Real Estate Intelligence
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2.6rem, 6vw, 4.2rem)',
              fontWeight: 300,
              lineHeight: 1.1,
              color: '#f4f0e6',
              marginBottom: '28px',
              letterSpacing: '-0.01em',
              maxWidth: '800px',
              margin: '0 auto 28px',
            }}
          >
            Intelligence That<br />Creates Alpha.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              fontWeight: 300,
              color: '#c8bfad',
              maxWidth: '600px',
              margin: '0 auto 40px',
              lineHeight: 1.7,
            }}
          >
            Dados de mercado imobiliário em Portugal — antes de chegarem à imprensa.
            Da Comporta ao Chiado, da Euribor ao pipeline off-market.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            <Link
              href="mailto:geral@agencygroup.pt?subject=Investor%20Intelligence&body=Ol%C3%A1%2C%20tenho%20interesse%20no%20Investor%20Intelligence%20da%20Agency%20Group."
              style={{
                display: 'inline-block',
                backgroundColor: '#c9a96e',
                color: '#0c1f15',
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                padding: '16px 32px',
                borderRadius: '3px',
              }}
            >
              Ver Planos e Preços
            </Link>
            <Link
              href="/relatorio-2026"
              style={{
                display: 'inline-block',
                backgroundColor: 'transparent',
                color: '#f4f0e6',
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.75rem',
                fontWeight: 400,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                padding: '15px 32px',
                borderRadius: '3px',
                border: '1.5px solid rgba(201,169,110,0.4)',
              }}
            >
              Ver Amostra
            </Link>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <section
          aria-label="Planos e preços Investor Intelligence"
          style={{ backgroundColor: '#f4f0e6', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              Escolha o Plano
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                fontWeight: 300,
                color: '#0c1f15',
                textAlign: 'center',
                marginBottom: '56px',
                letterSpacing: '-0.01em',
              }}
            >
              Três Níveis de Acesso
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                gap: '20px',
                alignItems: 'start',
              }}
            >
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  style={{
                    backgroundColor: tier.highlight ? '#0c1f15' : '#ffffff',
                    border: tier.highlight ? '2px solid #c9a96e' : '1px solid #e4ddd0',
                    borderRadius: '8px',
                    padding: '36px 28px',
                    boxShadow: tier.highlight
                      ? '0 8px 32px rgba(12,31,21,0.18)'
                      : '0 1px 4px rgba(12,31,21,0.05)',
                    position: 'relative',
                  }}
                >
                  {tier.highlight && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-1px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#c9a96e',
                        color: '#0c1f15',
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.58rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        padding: '4px 14px',
                        borderRadius: '0 0 4px 4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Mais Popular
                    </div>
                  )}

                  <p
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.65rem',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: tier.highlight ? '#c9a96e' : '#c9a96e',
                      marginBottom: '8px',
                    }}
                  >
                    {tier.name}
                  </p>

                  <div style={{ marginBottom: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: '2.6rem',
                        fontWeight: 600,
                        color: tier.highlight ? '#f4f0e6' : '#0c1f15',
                        lineHeight: 1,
                      }}
                    >
                      {tier.price}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.65rem',
                        letterSpacing: '0.08em',
                        color: tier.highlight ? 'rgba(200,191,173,0.6)' : '#9a8e7e',
                        marginLeft: '4px',
                      }}
                    >
                      {tier.period}
                    </span>
                  </div>

                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.85rem',
                      fontWeight: 300,
                      color: tier.highlight ? '#c8bfad' : '#7a6f5e',
                      marginBottom: '24px',
                      lineHeight: 1.5,
                    }}
                  >
                    {tier.tagline}
                  </p>

                  <hr
                    style={{
                      border: 'none',
                      borderTop: tier.highlight
                        ? '1px solid rgba(201,169,110,0.2)'
                        : '1px solid #e8e2d9',
                      marginBottom: '20px',
                    }}
                  />

                  <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tier.features.map((f, i) => (
                      <li
                        key={i}
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontSize: '0.86rem',
                          fontWeight: 300,
                          color: tier.highlight ? '#c8bfad' : '#4a4030',
                          lineHeight: 1.5,
                          paddingLeft: '18px',
                          position: 'relative',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            color: '#c9a96e',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                          }}
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <InvestorLeadForm
                    tier={tier.name as 'Free' | 'Intelligence' | 'Elite'}
                    ctaLabel={tier.cta}
                    ctaStyle={tier.ctaStyle as 'outline' | 'gold' | 'dark'}
                    highlight={tier.highlight}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Deliverables ─────────────────────────────────────────────────── */}
        <section
          aria-label="O que recebe com a subscrição"
          style={{ backgroundColor: '#0c1f15', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              Deliverables
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 300,
                color: '#f4f0e6',
                textAlign: 'center',
                marginBottom: '56px',
                letterSpacing: '-0.01em',
              }}
            >
              O Que Recebe
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: '20px',
              }}
            >
              {DELIVERABLES.map((d) => (
                <div
                  key={d.label}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(201,169,110,0.15)',
                    borderRadius: '6px',
                    padding: '24px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.58rem',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#c9a96e',
                      marginBottom: '10px',
                    }}
                  >
                    {d.label}
                  </p>
                  <h3
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      color: '#f4f0e6',
                      marginBottom: '10px',
                      lineHeight: 1.3,
                    }}
                  >
                    {d.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.84rem',
                      fontWeight: 300,
                      color: '#c8bfad',
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {d.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sample Data Preview ──────────────────────────────────────────── */}
        <section
          aria-label="Prévia dos dados — amostra"
          style={{ backgroundColor: '#f4f0e6', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              Amostra
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                fontWeight: 300,
                color: '#0c1f15',
                textAlign: 'center',
                marginBottom: '12px',
                letterSpacing: '-0.01em',
              }}
            >
              Prévia dos Dados
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '0.9rem',
                fontWeight: 300,
                color: '#7a6f5e',
                textAlign: 'center',
                marginBottom: '40px',
              }}
            >
              Os dados completos estão disponíveis para subscritores.
              Veja a amostra completa em{' '}
              <Link href="/relatorio-2026" style={{ color: '#1c4a35', textDecoration: 'underline' }}>
                /relatorio-2026
              </Link>
              .
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {SAMPLE_DATA.map((row, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4ddd0',
                    borderRadius: '4px',
                    padding: '16px 20px',
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr',
                    gap: '16px',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.62rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#1c4a35',
                      fontWeight: 500,
                    }}
                  >
                    {row.zone}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.88rem',
                      fontWeight: 300,
                      color: row.blurred ? 'transparent' : '#3a3028',
                      textShadow: row.blurred ? '0 0 8px rgba(58,48,40,0.8)' : 'none',
                      filter: row.blurred ? 'blur(4px)' : 'none',
                      userSelect: row.blurred ? 'none' : 'auto',
                    }}
                  >
                    {row.preview}
                  </span>
                </div>
              ))}
            </div>

            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.62rem',
                letterSpacing: '0.1em',
                color: '#9a8e7e',
                textAlign: 'center',
                marginTop: '20px',
              }}
            >
              Dados parcialmente redactados · Subscrição necessária para acesso completo
            </p>
          </div>
        </section>

        {/* ── Who Subscribes ───────────────────────────────────────────────── */}
        <section
          aria-label="Quem subscreve o Investor Intelligence"
          style={{ backgroundColor: '#1c4a35', padding: '72px 24px' }}
        >
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                fontWeight: 300,
                color: '#f4f0e6',
                textAlign: 'center',
                marginBottom: '48px',
                letterSpacing: '-0.01em',
              }}
            >
              Quem Subscreve
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: '20px',
              }}
            >
              {SUBSCRIBER_PROFILES.map((profile) => (
                <div
                  key={profile.title}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(201,169,110,0.15)',
                    borderRadius: '6px',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '12px' }}>{profile.icon}</span>
                  <h3
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.1rem',
                      fontWeight: 500,
                      color: '#f4f0e6',
                      marginBottom: '8px',
                      lineHeight: 1.2,
                    }}
                  >
                    {profile.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.82rem',
                      fontWeight: 300,
                      color: 'rgba(200,191,173,0.8)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {profile.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Perguntas frequentes Investor Intelligence"
          style={{ backgroundColor: '#f4f0e6', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              FAQ
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                fontWeight: 300,
                color: '#0c1f15',
                textAlign: 'center',
                marginBottom: '48px',
                letterSpacing: '-0.01em',
              }}
            >
              Perguntas Frequentes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {faqJsonLd.mainEntity.map((faq, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4ddd0',
                    borderRadius: '6px',
                    padding: '24px 28px',
                    boxShadow: '0 1px 4px rgba(12,31,21,0.04)',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.08rem',
                      fontWeight: 500,
                      color: '#0c1f15',
                      marginBottom: '10px',
                      lineHeight: 1.35,
                    }}
                  >
                    {faq.name}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.88rem',
                      fontWeight: 300,
                      color: '#4a4030',
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {faq.acceptedAnswer.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Subscrever Investor Intelligence"
          style={{
            backgroundColor: '#0c1f15',
            padding: '80px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '620px', margin: '0 auto' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                marginBottom: '20px',
              }}
            >
              Começar Hoje
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.9rem, 4vw, 2.8rem)',
                fontWeight: 300,
                color: '#f4f0e6',
                marginBottom: '20px',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              Dados que os outros<br />não têm ainda.
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '1rem',
                fontWeight: 300,
                color: '#c8bfad',
                lineHeight: 1.7,
                marginBottom: '40px',
              }}
            >
              Comece com o plano gratuito. Cancele quando quiser.
              Os dados chegam antes do mercado saber.
            </p>
            <div style={{ maxWidth: '380px', margin: '0 auto' }}>
              <InvestorLeadForm
                tier="Intelligence"
                ctaLabel="Subscrever Agora"
                ctaStyle="gold"
              />
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Link
                  href="/relatorio-2026"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'transparent',
                    color: 'rgba(200,191,173,0.7)',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.68rem',
                    fontWeight: 400,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    padding: '12px 24px',
                    borderRadius: '3px',
                    border: '1px solid rgba(201,169,110,0.3)',
                  }}
                >
                  Ver Amostra do Relatório
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Internal links ───────────────────────────────────────────────── */}
        <section
          aria-label="Explorar mais"
          style={{ backgroundColor: '#f4f0e6', padding: '56px 24px' }}
        >
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'center',
            }}
          >
            {[
              { href: '/imoveis', label: 'Ver Imóveis' },
              { href: '/casos-de-sucesso', label: 'Casos de Sucesso' },
              { href: '/concierge-estrangeiros', label: 'Concierge Estrangeiros' },
              { href: '/relatorio-2026', label: 'Relatório 2026' },
              { href: '/blog', label: 'Guias e Análises' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.68rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#1c4a35',
                  textDecoration: 'none',
                  padding: '10px 18px',
                  border: '1px solid rgba(28,74,53,0.25)',
                  borderRadius: '3px',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
