import type { Metadata } from 'next'
import Link from 'next/link'
import ConciergeIntakeForm from '@/app/components/ConciergeIntakeForm'
import HomeNav from '@/app/components/HomeNav'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Foreign Buyer Concierge — Compra de Imóvel em Portugal para Estrangeiros | Agency Group',
  description:
    'Serviço completo para compradores estrangeiros em Portugal: NIF, conta bancária, advogado, IFICI, AVM, hipoteca — tudo numa equipa. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/concierge-estrangeiros',
    languages: {
      pt: 'https://www.agencygroup.pt/concierge-estrangeiros',
      en: 'https://www.agencygroup.pt/concierge-estrangeiros',
      'x-default': 'https://www.agencygroup.pt/concierge-estrangeiros',
    },
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Foreign Buyer Concierge — Compra de Imóvel em Portugal para Estrangeiros | Agency Group',
    description:
      'Serviço completo para compradores estrangeiros em Portugal: NIF, conta bancária, advogado, IFICI, AVM, hipoteca — tudo numa equipa. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/concierge-estrangeiros',
    siteName: 'Agency Group',
  },
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Foreign Buyer Concierge — Agency Group',
  description:
    'Serviço completo para compradores estrangeiros em Portugal: NIF, conta bancária, advogado bilíngue, IFICI/NHR, hipoteca para não-residentes e gestão pós-compra.',
  provider: {
    '@type': 'RealEstateAgent',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
    telephone: '+351919948986',
    areaServed: ['Lisboa', 'Cascais', 'Comporta', 'Algarve', 'Porto', 'Madeira'],
    knowsLanguage: ['pt', 'en', 'fr', 'ar'],
  },
  serviceType: 'Real Estate Buyer Concierge',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
    description: 'Comissão 5% paga pelo vendedor. Comprador não paga.',
  },
  url: 'https://www.agencygroup.pt/concierge-estrangeiros',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Qual o prazo médio para comprar um imóvel em Portugal como estrangeiro?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Da pesquisa à escritura, o processo típico demora entre 45 e 120 dias. O CPCV (contrato-promessa) pode ser assinado em 2 a 4 semanas após selecção do imóvel. A escritura normalmente ocorre 30 a 90 dias depois. Com o nosso serviço Concierge, paralelizamos todas as tarefas burocráticas para minimizar o tempo total.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quanto custa o serviço Concierge para compradores estrangeiros?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Zero para o comprador. A nossa comissão de 5% é integralmente paga pelo vendedor, por contrato. O comprador não paga nenhuma taxa de mediação imobiliária à Agency Group. Os custos normais de transacção (IMT, IS, honorários de advogado, registo) continuam a cargo do comprador, conforme a lei portuguesa.',
      },
    },
    {
      '@type': 'Question',
      name: 'Como funciona o acesso a imóveis off-market?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A nossa rede off-market inclui vendedores que preferem discrição — propriedades que nunca chegam ao idealista ou Imovirtual. O acesso é exclusivo para clientes do Concierge com briefing activo. Partilhamos apenas propriedades que correspondam exactamente ao critério definido no primeiro contacto.',
      },
    },
    {
      '@type': 'Question',
      name: 'Sou elegível para o regime IFICI (ex-NHR)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'O regime IFICI (substituto do NHR desde 2024) aplica-se a novos residentes fiscais que não tenham sido residentes em Portugal nos últimos 5 anos. Taxas: 20% flat sobre rendimentos de trabalho qualificado. Elegibilidade depende da profissão e actividade. Incluímos uma simulação fiscal personalizada como parte do serviço Concierge — antes de qualquer compromisso.',
      },
    },
    {
      '@type': 'Question',
      name: 'É possível obter hipoteca como não-residente em Portugal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. Bancos portugueses como Millennium BCP, BPI e Novobanco financiam não-residentes até 70% do valor de compra (LTV). O processo requer NIF, prova de rendimentos estrangeiros e declaração fiscal do país de origem. Apresentamos o perfil do cliente aos bancos da nossa rede para obter indicação de elegibilidade antes de assinar qualquer compromisso.',
      },
    },
  ],
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const SERVICES = [
  {
    number: '01',
    title: 'AVM Gratuita',
    desc: 'Avaliação proprietária de 47 variáveis. Resultado em 60 segundos. Decisão de oferta fundamentada em dados.',
  },
  {
    number: '02',
    title: 'NIF + Conta Bancária',
    desc: 'Coordenamos com advogado e banco. Prazo: 5 a 10 dias úteis. Feito remotamente antes da primeira visita.',
  },
  {
    number: '03',
    title: 'Selecção Off-Market',
    desc: 'Acesso a propriedades antes dos portais públicos. Vendedores discretos. Sem concorrência de compradores externos.',
  },
  {
    number: '04',
    title: 'Due Diligence Jurídica',
    desc: 'Advogados bilíngues vetados: Carvalho & Associados e Raposo Subtil. Caderneta, registo, ónus, licenças.',
  },
  {
    number: '05',
    title: 'Simulação IFICI/NHR',
    desc: 'Estimativa de poupança fiscal ao longo de 10 anos. Baseada no perfil de rendimentos real do comprador.',
  },
  {
    number: '06',
    title: 'Hipoteca para Não-Residentes',
    desc: 'Introduções bancárias: Millennium BCP, Novobanco, BPI. 70% LTV. Elegibilidade verificada antes do CPCV.',
  },
  {
    number: '07',
    title: 'Gestão Pós-Compra',
    desc: 'Registo IMI, utilities, chaves, setup de arrendamento. Entregue o apartamento a render enquanto regressa ao país de origem.',
  },
]

const COMPARISON_ROWS = [
  { feature: 'Avaliação independente do imóvel', solo: false, concierge: true },
  { feature: 'Acesso off-market antes dos portais', solo: false, concierge: true },
  { feature: 'NIF + conta bancária coordenados', solo: false, concierge: true },
  { feature: 'Advogado bilíngue integrado', solo: false, concierge: true },
  { feature: 'Simulação fiscal IFICI/NHR', solo: false, concierge: true },
  { feature: 'Hipoteca para não-residentes', solo: false, concierge: true },
  { feature: 'Gestão pós-compra (IMI, utilities)', solo: false, concierge: true },
  { feature: 'Custo de mediação para o comprador', solo: true, concierge: false },
]

const AUDIENCES = [
  {
    flag: '🇺🇸',
    title: 'Americanos',
    subtitle: 'US Citizens & Green Card Holders',
    points: [
      'FATCA e FBAR não impedem a compra — apenas reportam contas estrangeiras.',
      'Treaty US–PT: evitar dupla tributação nos rendimentos imobiliários.',
      'IFICI: 20% flat sobre rendimentos qualificados vs taxas federais até 37%.',
      'Estimativa típica: €120.000–€220.000 de poupança fiscal anual.',
    ],
  },
  {
    flag: '🇫🇷',
    title: 'Franceses',
    subtitle: 'Résidents Fiscaux Français',
    points: [
      'Convention fiscale France–Portugal: zero dupla tributação.',
      'Regime IFICI: 20% sobre rendimentos de trabalho qualificado.',
      'Arrendamento Paris: rendimentos tributados apenas em Portugal.',
      'Processo simplificado: selecção remota, visita única possível.',
    ],
  },
  {
    flag: '🇬🇧',
    title: 'Britânicos',
    subtitle: 'Post-Brexit Process',
    points: [
      'Vistos D7 e Digital Nomad disponíveis para residência legal.',
      'Comunidade expat consolidada em Cascais e Estoril.',
      'Processo de compra sem restrições para cidadãos não-UE.',
      'Hipoteca possível: até 70% LTV com prova de rendimentos UK.',
    ],
  },
  {
    flag: '🇦🇪',
    title: 'Médio Oriente',
    subtitle: 'GCC & Family Offices',
    points: [
      'Experiência com family offices e HNWI do Golfo.',
      'Opções de financiamento compatíveis com princípios islâmicos (nota).',
      'Discrição total — sem exposição pública do perfil do comprador.',
      'Pipeline Comporta e Alentejo disponível para grandes parcelas.',
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConciergeEstrangeirosPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <HomeNav />

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d', backgroundColor: '#f4f0e6' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="Foreign Buyer Concierge — introdução"
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
            AMI 22506 · Foreign Buyer Concierge
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2.4rem, 6vw, 4rem)',
              fontWeight: 300,
              lineHeight: 1.1,
              color: '#f4f0e6',
              marginBottom: '28px',
              letterSpacing: '-0.01em',
              maxWidth: '760px',
              margin: '0 auto 28px',
            }}
          >
            A Equipa Completa para a<br />Sua Compra em Portugal.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              fontWeight: 300,
              color: '#c8bfad',
              maxWidth: '620px',
              margin: '0 auto 20px',
              lineHeight: 1.7,
            }}
          >
            Uma única chamada. Zero burocracia. Do NIF à escritura — gerimos tudo.
            A comissão é paga pelo vendedor.{' '}
            <strong style={{ color: '#c9a96e', fontWeight: 500 }}>O comprador não paga.</strong>
          </p>

          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.7rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(200,191,173,0.6)',
              marginTop: '12px',
            }}
          >
            Português · English · Français · العربية
          </p>
        </section>

        {/* ── Commission Banner ────────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: '#c9a96e',
            padding: '18px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.72rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#0c1f15',
              fontWeight: 500,
              margin: 0,
            }}
          >
            Comissão 5% · Paga integralmente pelo vendedor · Comprador paga zero
          </p>
        </div>

        {/* ── Services Grid ────────────────────────────────────────────────── */}
        <section
          aria-label="Serviços incluídos no Concierge"
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
              O que está incluído
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
              Sete Serviços. Uma Equipa.
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                gap: '20px',
              }}
            >
              {SERVICES.map((svc) => (
                <div
                  key={svc.number}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4ddd0',
                    borderRadius: '6px',
                    padding: '28px 28px 24px',
                    boxShadow: '0 1px 4px rgba(12,31,21,0.05)',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.6rem',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#c9a96e',
                      marginBottom: '10px',
                    }}
                  >
                    {svc.number}
                  </p>
                  <h3
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.2rem',
                      fontWeight: 500,
                      color: '#0c1f15',
                      marginBottom: '10px',
                      lineHeight: 1.2,
                    }}
                  >
                    {svc.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.86rem',
                      fontWeight: 300,
                      color: '#5a5040',
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {svc.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison Table ─────────────────────────────────────────────── */}
        <section
          aria-label="Concierge vs comprar sozinho"
          style={{ backgroundColor: '#0c1f15', padding: '80px 24px' }}
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
              Comparação
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
                fontWeight: 300,
                color: '#f4f0e6',
                textAlign: 'center',
                marginBottom: '48px',
                letterSpacing: '-0.01em',
              }}
            >
              Concierge vs Comprar Sozinho
            </h2>

            <div style={{ border: '1px solid rgba(201,169,110,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
              {/* Table header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px',
                  backgroundColor: 'rgba(201,169,110,0.08)',
                  padding: '14px 24px',
                  borderBottom: '1px solid rgba(201,169,110,0.15)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,191,173,0.5)' }}>Serviço</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,191,173,0.5)', textAlign: 'center' }}>Sozinho</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9a96e', textAlign: 'center' }}>Concierge</span>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 120px',
                    padding: '16px 24px',
                    borderBottom: i < COMPARISON_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.88rem',
                      fontWeight: 300,
                      color: '#c8bfad',
                    }}
                  >
                    {row.feature}
                  </span>
                  <span
                    style={{
                      textAlign: 'center',
                      fontSize: '1rem',
                      color: row.solo ? '#c9a96e' : 'rgba(200,191,173,0.25)',
                    }}
                  >
                    {row.solo ? '✓' : '✗'}
                  </span>
                  <span
                    style={{
                      textAlign: 'center',
                      fontSize: '1rem',
                      color: row.concierge ? '#4ade80' : 'rgba(200,191,173,0.25)',
                    }}
                  >
                    {row.concierge ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Audience Segments ────────────────────────────────────────────── */}
        <section
          aria-label="Serviço por nacionalidade"
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
              Por Perfil de Comprador
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 300,
                color: '#0c1f15',
                textAlign: 'center',
                marginBottom: '56px',
                letterSpacing: '-0.01em',
              }}
            >
              Adaptado à Sua Realidade
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
                gap: '20px',
              }}
            >
              {AUDIENCES.map((audience) => (
                <div
                  key={audience.title}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4ddd0',
                    borderRadius: '6px',
                    padding: '28px',
                    boxShadow: '0 1px 4px rgba(12,31,21,0.05)',
                  }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '8px' }}>{audience.flag}</span>
                    <h3
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: '1.25rem',
                        fontWeight: 500,
                        color: '#0c1f15',
                        marginBottom: '2px',
                        lineHeight: 1.2,
                      }}
                    >
                      {audience.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.6rem',
                        letterSpacing: '0.1em',
                        color: '#c9a96e',
                        textTransform: 'uppercase',
                        margin: 0,
                      }}
                    >
                      {audience.subtitle}
                    </p>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {audience.points.map((point, i) => (
                      <li
                        key={i}
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontSize: '0.83rem',
                          fontWeight: 300,
                          color: '#4a4030',
                          lineHeight: 1.6,
                          paddingLeft: '14px',
                          position: 'relative',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            color: '#1c4a35',
                            fontWeight: 500,
                          }}
                        >
                          ·
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section
          aria-label="Testemunhos de clientes"
          style={{ backgroundColor: '#1c4a35', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
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
              O Que Dizem os Clientes
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                gap: '24px',
              }}
            >
              {[
                {
                  quote: 'The process was far simpler than buying in the US. We were in by summer.',
                  attr: 'R. & S.M. · Quinta da Marinha · Cascais · 2025',
                  flag: 'US',
                },
                {
                  quote: "L'accompagnement était impeccable. Une seule agence, zéro complication.",
                  attr: 'P.D. · Chiado · Lisboa · 2025',
                  flag: 'FR',
                },
                {
                  quote: 'The team understood our requirements without us having to explain twice.',
                  attr: 'A.K. · Family Office · Comporta · 2025',
                  flag: 'AE',
                },
              ].map((t, i) => (
                <blockquote
                  key={i}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(201,169,110,0.2)',
                    borderRadius: '6px',
                    padding: '28px',
                    margin: 0,
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: 'clamp(1.05rem, 2.2vw, 1.25rem)',
                      fontWeight: 400,
                      fontStyle: 'italic',
                      color: '#f4f0e6',
                      lineHeight: 1.6,
                      marginBottom: '16px',
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <cite
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.62rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#c9a96e',
                      fontStyle: 'normal',
                    }}
                  >
                    {t.attr}
                  </cite>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Perguntas frequentes"
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                      fontSize: '1.1rem',
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

        {/* ── Intake Form ──────────────────────────────────────────────────── */}
        <section
          id="concierge-form"
          aria-label="Formulário de contacto Concierge"
          style={{ backgroundColor: '#0c1f15', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
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
              Intake — Confidencial
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 300,
                color: '#f4f0e6',
                textAlign: 'center',
                marginBottom: '12px',
                letterSpacing: '-0.01em',
              }}
            >
              Briefing Personalizado
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '0.9rem',
                fontWeight: 300,
                color: '#c8bfad',
                textAlign: 'center',
                lineHeight: 1.7,
                marginBottom: '40px',
              }}
            >
              Diga-nos o orçamento, a zona e o serviço pretendido.
              Respondemos em 24 horas com um plano à medida.
            </p>
            <ConciergeIntakeForm />
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Contacto Concierge Estrangeiros"
          style={{
            backgroundColor: '#1c4a35',
            padding: '56px 24px',
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
              Começar Agora
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
              Primeira consulta.<br />Sem compromisso.
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
              Diga-nos o orçamento, a zona preferida e a data de chegada a Portugal.
              Respondemos em 24 horas com um briefing personalizado.
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                justifyContent: 'center',
              }}
            >
              <a
                href="https://wa.me/351919948986?text=Quero%20saber%20mais%20sobre%20o%20Concierge%20para%20Estrangeiros"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#25d366',
                  color: '#ffffff',
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  padding: '16px 28px',
                  borderRadius: '3px',
                }}
              >
                <span aria-hidden="true">💬</span> WhatsApp
              </a>
              <Link
                href="/contacto"
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
                  padding: '15px 28px',
                  borderRadius: '3px',
                  border: '1.5px solid rgba(201,169,110,0.45)',
                }}
              >
                Formulário de Contacto
              </Link>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.62rem',
                letterSpacing: '0.1em',
                color: 'rgba(200,191,173,0.4)',
                marginTop: '24px',
              }}
            >
              +351 919 948 986 · Disponível em PT · EN · FR · AR
            </p>
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
              { href: '/investor-intelligence', label: 'Investor Intelligence' },
              { href: '/blog', label: 'Guias e Artigos' },
              { href: '/avm', label: 'AVM Gratuita' },
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
