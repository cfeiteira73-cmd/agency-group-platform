import type { Metadata } from 'next'
import Link from 'next/link'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'White-Label Platform para Agências Imobiliárias | Agency Group Tech',
  description:
    'Tecnologia AG Elite para a sua agência: AI Sofia, AVM proprietário, portal de gestão, blog SEO, CRM integrado. Beta para 5 agências seleccionadas. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/white-label',
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'White-Label Platform para Agências Imobiliárias | Agency Group Tech',
    description:
      'Tecnologia AG Elite para a sua agência: AI Sofia, AVM proprietário, portal de gestão, blog SEO, CRM integrado. Beta para 5 agências seleccionadas. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/white-label',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=White-Label+Platform&subtitle=AG+Tech+para+Ag%C3%AAncias+Imobili%C3%A1rias+%C2%B7+AMI+22506',
      width: 1200,
      height: 630,
      alt: 'White-Label Platform — Agency Group Tech',
    }],
    siteName: 'Agency Group',
  },
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Agency Group White-Label Platform',
  description:
    'Stack tecnológico completo em white-label para agências imobiliárias AMI: Sofia AI, AVM proprietário, portal de gestão, blog SEO automático, pesquisa semântica e analytics.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  provider: {
    '@type': 'RealEstateAgent',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
    telephone: '+351919948986',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '500',
      priceCurrency: 'EUR',
      billingIncrement: 'P1M',
      description: 'Sofia AI + AVM + Blog. Até 100 propriedades. Setup €1.500.',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '1000',
      priceCurrency: 'EUR',
      billingIncrement: 'P1M',
      description:
        'Tudo no Starter + Portal completo + Pesquisa semântica + Analytics avançado. Até 500 propriedades. Setup €2.500.',
    },
  ],
  url: 'https://www.agencygroup.pt/white-label',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'O domínio fica em meu nome?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. Configuramos o vosso domínio próprio. A plataforma funciona completamente em white-label — os vossos clientes nunca vêem referências à Agency Group.',
      },
    },
    {
      '@type': 'Question',
      name: 'Os dados dos clientes são nossos?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '100%. A vossa base de dados Supabase é separada e exclusiva. As vossas leads, os vossos dados, a vossa propriedade. Nunca partilhamos dados entre clientes white-label.',
      },
    },
    {
      '@type': 'Question',
      name: 'Podemos cancelar a qualquer momento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sim. Contrato mensal sem fidelização — exceto durante o período beta de 3 meses incluídos gratuitamente nas primeiras 5 vagas. Após o período beta, cancelamento com 30 dias de aviso.',
      },
    },
    {
      '@type': 'Question',
      name: 'Funciona para agências fora de Portugal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Actualmente apenas Portugal (dados AVM, blog SEO e modelos Sofia calibrados para o mercado português). Espanha está prevista para 2026 Q3.',
      },
    },
  ],
  twitter: {
    card: 'summary_large_image',
    title: 'White-Label Platform para Agências Imobiliárias | Agency Group Tech',
    description: 'Sofia AI + AVM + Blog. Até 100 propriedades. Setup €1.500.',
    images: ['https://www.agencygroup.pt/api/og?title=White-Label+Platform&subtitle=AG+Tech+para+Ag%C3%AAncias+Imobili%C3%A1rias+%C2%B7+AMI+22506'],
  },
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    number: '01',
    title: 'Sofia AI',
    desc: 'Assistente conversacional treinada com o seu catálogo. Qualificação de leads 24/7. Disponível no seu website como se fosse construída por si.',
  },
  {
    number: '02',
    title: 'AVM Proprietário',
    desc: 'Avaliação automatizada de imóveis com 47 variáveis. Resultado em 60 segundos. Integra com o seu CRM.',
  },
  {
    number: '03',
    title: 'Portal de Gestão',
    desc: 'Dashboard de deals, pipeline, CRM de leads, campanhas de email. Tudo num ecrã. Design Agency Group.',
  },
  {
    number: '04',
    title: 'Blog SEO Automático',
    desc: '50+ artigos indexados, schema markup, OG images dinâmicas. Autoridade SEO desde o dia 1.',
  },
  {
    number: '05',
    title: 'Pesquisa Semântica',
    desc: 'pgvector + OpenAI. Os seus clientes encontram imóveis por linguagem natural ("villa com vista mar perto de escola").',
  },
  {
    number: '06',
    title: 'Analytics & GTM',
    desc: 'GA4, conversões, UTM attribution, relatórios semanais. Sabe exactamente de onde vêm os leads.',
  },
]

const COMPARISON_ROWS = [
  { feature: 'Time to market', whitelabel: '4 semanas', own: '12–18 meses' },
  { feature: 'Investimento total', whitelabel: '€500–1.000/mês', own: '€150.000+' },
  { feature: 'IA Sofia', whitelabel: 'Incluída', own: 'Precisa desenvolver' },
  { feature: 'SEO blog (50+ artigos)', whitelabel: 'Incluído', own: 'Precisa criar' },
  { feature: 'Manutenção / updates', whitelabel: 'Incluída', own: 'Precisa equipa' },
  { feature: 'AVM', whitelabel: 'Incluído', own: 'Dados proprietários necessários' },
]

const TIMELINE = [
  { week: 'Semana 1', title: 'Setup técnico', desc: 'Configuração DNS, domínio próprio, onboarding da equipa.' },
  { week: 'Semana 2', title: 'Import & treino', desc: 'Import do catálogo, treino da Sofia com os vossos dados e linguagem.' },
  { week: 'Semana 3', title: 'Portal live', desc: 'Portal activo, blog a publicar, AVM calibrado para a vossa zona geográfica.' },
  { week: 'Semana 4', title: 'Go live', desc: 'Primeiros leads Sofia, primeiros relatórios, suporte dedicado activo.' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WhiteLabelPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d', backgroundColor: '#f4f0e6' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="White-Label Platform — introdução"
          style={{
            backgroundColor: '#0c1f15',
            padding: '100px 24px 80px',
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
            BETA PRIVADO · 5 VAGAS
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 'clamp(2.4rem, 6vw, 4rem)',
              fontWeight: 300,
              lineHeight: 1.1,
              color: '#f4f0e6',
              letterSpacing: '-0.01em',
              maxWidth: '760px',
              margin: '0 auto 28px',
            }}
          >
            Tecnologia de Classe Mundial.<br />Para a Sua Agência.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              fontWeight: 300,
              color: '#c8bfad',
              maxWidth: '640px',
              margin: '0 auto 40px',
              lineHeight: 1.7,
            }}
          >
            O mesmo stack tecnológico que alimenta agencygroup.pt — disponível em white-label
            para agências imobiliárias AMI seleccionadas.{' '}
            <strong style={{ color: '#c9a96e', fontWeight: 500 }}>
              Sofia AI, AVM proprietário, portal de gestão, blog SEO automático.
            </strong>
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              justifyContent: 'center',
            }}
          >
            <Link
              href="mailto:geral@agencygroup.pt?subject=Candidatura%20White-Label%20Beta&body=Ol%C3%A1%2C%0A%0AEstou%20interessado(a)%20na%20plataforma%20White-Label%20da%20Agency%20Group.%0A%0ANome%20da%20ag%C3%AAncia%3A%20%0AAMI%3A%20%0ASite%20actual%3A%20%0AN%C3%BA%20de%20agentes%3A%20%0APlano%20de%20interesse%3A%20Starter%20%E2%82%AC500%2Fm%C3%AAs%20%2F%20Pro%20%E2%82%AC1.000%2Fm%C3%AAs%0A%0ACom%20os%20melhores%20cumprimentos%2C"
              style={{
                display: 'inline-block',
                backgroundColor: '#c9a96e',
                color: '#0c1f15',
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                padding: '16px 32px',
                borderRadius: '3px',
              }}
            >
              Candidatar ao Beta
            </Link>
            <a
              href="https://wa.me/351919948986?text=Quero+saber+mais+sobre+o+White-Label"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
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
              <span aria-hidden="true">💬</span> WhatsApp
            </a>
          </div>

          <p
            style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '0.62rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(200,191,173,0.5)',
              marginTop: '32px',
            }}
          >
            AMI 22506 · Next.js 15 · Supabase · Anthropic Claude · Google Cloud
          </p>
        </section>

        {/* ── Features Grid ────────────────────────────────────────────────── */}
        <section
          aria-label="Funcionalidades da plataforma white-label"
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
              Seis Módulos. Uma Plataforma.
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                gap: '20px',
              }}
            >
              {FEATURES.map((feat) => (
                <div
                  key={feat.number}
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
                    {feat.number}
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
                    {feat.title}
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
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <section
          aria-label="Preços white-label"
          style={{ backgroundColor: '#0c1f15', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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
              Preços
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
              Dois Planos. Zero Surpresas.
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
                gap: '24px',
              }}
            >
              {/* Starter */}
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(201,169,110,0.2)',
                  borderRadius: '6px',
                  padding: '36px 32px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.62rem',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#c9a96e',
                    marginBottom: '16px',
                  }}
                >
                  Starter
                </p>
                <div style={{ marginBottom: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '3rem',
                      fontWeight: 300,
                      color: '#f4f0e6',
                      lineHeight: 1,
                    }}
                  >
                    €500
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.68rem',
                      color: 'rgba(200,191,173,0.6)',
                      marginLeft: '8px',
                    }}
                  >
                    /mês
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.62rem',
                    color: 'rgba(200,191,173,0.5)',
                    marginBottom: '28px',
                  }}
                >
                  Setup €1.500 · SLA 99.5% · 30 dias trial
                </p>
                <ul
                  style={{
                    margin: '0 0 32px',
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {[
                    'Sofia AI integrada',
                    'AVM proprietário (47 variáveis)',
                    'Blog SEO automático',
                    'Até 100 propriedades',
                    'Domínio próprio',
                    'Suporte por email',
                  ].map((item, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontSize: '0.86rem',
                        fontWeight: 300,
                        color: '#c8bfad',
                        paddingLeft: '16px',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          color: '#4ade80',
                          fontWeight: 500,
                        }}
                      >
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="mailto:geral@agencygroup.pt?subject=Candidatura%20White-Label%20Beta&body=Ol%C3%A1%2C%0A%0AEstou%20interessado(a)%20na%20plataforma%20White-Label%20da%20Agency%20Group.%0A%0ANome%20da%20ag%C3%AAncia%3A%20%0AAMI%3A%20%0ASite%20actual%3A%20%0AN%C3%BA%20de%20agentes%3A%20%0APlano%20de%20interesse%3A%20Starter%20%E2%82%AC500%2Fm%C3%AAs%20%2F%20Pro%20%E2%82%AC1.000%2Fm%C3%AAs%0A%0ACom%20os%20melhores%20cumprimentos%2C"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    backgroundColor: 'transparent',
                    color: '#c9a96e',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.72rem',
                    fontWeight: 400,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    padding: '14px 24px',
                    borderRadius: '3px',
                    border: '1.5px solid rgba(201,169,110,0.45)',
                  }}
                >
                  Candidatar ao Beta
                </Link>
              </div>

              {/* Pro */}
              <div
                style={{
                  backgroundColor: 'rgba(201,169,110,0.07)',
                  border: '1.5px solid rgba(201,169,110,0.5)',
                  borderRadius: '6px',
                  padding: '36px 32px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#c9a96e',
                    color: '#0c1f15',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.58rem',
                    fontWeight: 500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    padding: '4px 14px',
                    borderRadius: '2px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Mais Popular
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.62rem',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#c9a96e',
                    marginBottom: '16px',
                  }}
                >
                  Pro
                </p>
                <div style={{ marginBottom: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '3rem',
                      fontWeight: 300,
                      color: '#f4f0e6',
                      lineHeight: 1,
                    }}
                  >
                    €1.000
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.68rem',
                      color: 'rgba(200,191,173,0.6)',
                      marginLeft: '8px',
                    }}
                  >
                    /mês
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.62rem',
                    color: 'rgba(200,191,173,0.5)',
                    marginBottom: '28px',
                  }}
                >
                  Setup €2.500 · SLA 99.9% · Suporte dedicado
                </p>
                <ul
                  style={{
                    margin: '0 0 32px',
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {[
                    'Tudo no Starter',
                    'Portal de gestão completo',
                    'Pesquisa semântica pgvector',
                    'Analytics avançado + GTM',
                    'Até 500 propriedades',
                    'CRM de leads integrado',
                    'Suporte dedicado (telefone + email)',
                  ].map((item, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontSize: '0.86rem',
                        fontWeight: 300,
                        color: '#c8bfad',
                        paddingLeft: '16px',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          color: '#4ade80',
                          fontWeight: 500,
                        }}
                      >
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="mailto:geral@agencygroup.pt?subject=Candidatura%20White-Label%20Beta&body=Ol%C3%A1%2C%0A%0AEstou%20interessado(a)%20na%20plataforma%20White-Label%20da%20Agency%20Group.%0A%0ANome%20da%20ag%C3%AAncia%3A%20%0AAMI%3A%20%0ASite%20actual%3A%20%0AN%C3%BA%20de%20agentes%3A%20%0APlano%20de%20interesse%3A%20Starter%20%E2%82%AC500%2Fm%C3%AAs%20%2F%20Pro%20%E2%82%AC1.000%2Fm%C3%AAs%0A%0ACom%20os%20melhores%20cumprimentos%2C"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    backgroundColor: '#c9a96e',
                    color: '#0c1f15',
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    padding: '14px 24px',
                    borderRadius: '3px',
                  }}
                >
                  Candidatar ao Beta
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Beta Offer ───────────────────────────────────────────────────── */}
        <section
          aria-label="Oferta Beta Fechado"
          style={{ backgroundColor: '#c9a96e', padding: '72px 24px' }}
        >
          <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#0c1f15',
                marginBottom: '16px',
                opacity: 0.7,
              }}
            >
              Oferta Limitada
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
                fontWeight: 400,
                color: '#0c1f15',
                marginBottom: '20px',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              Beta Fechado — 5 Vagas Disponíveis
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '1.05rem',
                fontWeight: 300,
                color: '#1c3020',
                lineHeight: 1.7,
                marginBottom: '32px',
              }}
            >
              As primeiras 5 agências que adoptarem o stack ganham{' '}
              <strong style={{ fontWeight: 600 }}>3 meses grátis</strong> e formação no local em
              Lisboa.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(12,31,21,0.08)',
                borderRadius: '6px',
                padding: '24px 28px',
                marginBottom: '32px',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-dm-mono), monospace',
                  fontSize: '0.62rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#0c1f15',
                  marginBottom: '14px',
                  opacity: 0.7,
                }}
              >
                Requisitos de candidatura
              </p>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {[
                  'AMI válida e activa',
                  'Mínimo 2 agentes na equipa',
                  'Portfolio activo com mínimo 20 imóveis',
                ].map((req, i) => (
                  <li
                    key={i}
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.9rem',
                      fontWeight: 400,
                      color: '#0c1f15',
                      paddingLeft: '18px',
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, fontWeight: 600 }}>·</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="mailto:geral@agencygroup.pt?subject=Candidatura%20White-Label%20Beta&body=Ol%C3%A1%2C%0A%0AEstou%20interessado(a)%20na%20plataforma%20White-Label%20da%20Agency%20Group.%0A%0ANome%20da%20ag%C3%AAncia%3A%20%0AAMI%3A%20%0ASite%20actual%3A%20%0AN%C3%BA%20de%20agentes%3A%20%0APlano%20de%20interesse%3A%20Starter%20%E2%82%AC500%2Fm%C3%AAs%20%2F%20Pro%20%E2%82%AC1.000%2Fm%C3%AAs%0A%0ACom%20os%20melhores%20cumprimentos%2C"
              style={{
                display: 'inline-block',
                backgroundColor: '#0c1f15',
                color: '#f4f0e6',
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                padding: '16px 36px',
                borderRadius: '3px',
              }}
            >
              Candidatar-se ao Beta
            </Link>
          </div>
        </section>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <section
          aria-label="O que recebe desde o dia 1"
          style={{ backgroundColor: '#f4f0e6', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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
              Cronograma
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
              Operacional em 4 Semanas
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: '20px',
              }}
            >
              {TIMELINE.map((step, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e4ddd0',
                    borderRadius: '6px',
                    padding: '28px 24px',
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
                    {step.week}
                  </p>
                  <h3
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '1.15rem',
                      fontWeight: 500,
                      color: '#0c1f15',
                      marginBottom: '8px',
                      lineHeight: 1.25,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '0.84rem',
                      fontWeight: 300,
                      color: '#5a5040',
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison Table ─────────────────────────────────────────────── */}
        <section
          aria-label="White-label vs construir por conta própria"
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
              AG White-Label vs Construir por Conta Própria
            </h2>

            <div style={{ border: '1px solid rgba(201,169,110,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 160px',
                  backgroundColor: 'rgba(201,169,110,0.08)',
                  padding: '14px 24px',
                  borderBottom: '1px solid rgba(201,169,110,0.15)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,191,173,0.5)' }}>Factor</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9a96e', textAlign: 'center' }}>AG White-Label</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,191,173,0.5)', textAlign: 'center' }}>Build Your Own</span>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 160px 160px',
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
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.75rem',
                      color: '#4ade80',
                    }}
                  >
                    {row.whitelabel}
                  </span>
                  <span
                    style={{
                      textAlign: 'center',
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.75rem',
                      color: 'rgba(200,191,173,0.4)',
                    }}
                  >
                    {row.own}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social Proof ─────────────────────────────────────────────────── */}
        <section
          aria-label="Referências e prova social"
          style={{ backgroundColor: '#1c4a35', padding: '72px 24px' }}
        >
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.68rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#c9a96e',
                marginBottom: '16px',
              }}
            >
              Em produção desde 2026
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                fontWeight: 300,
                color: '#f4f0e6',
                marginBottom: '48px',
                letterSpacing: '-0.01em',
              }}
            >
              O Stack que Alimenta agencygroup.pt
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: '20px',
                marginBottom: '40px',
              }}
            >
              {[
                { label: '162', sub: 'API Routes' },
                { label: '0', sub: 'Downtime' },
                { label: '50+', sub: 'Artigos SEO' },
                { label: '47', sub: 'Variáveis AVM' },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(201,169,110,0.15)',
                    borderRadius: '6px',
                    padding: '24px 16px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: '2.4rem',
                      fontWeight: 300,
                      color: '#c9a96e',
                      lineHeight: 1,
                      marginBottom: '6px',
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      fontSize: '0.62rem',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'rgba(200,191,173,0.6)',
                      margin: 0,
                    }}
                  >
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>

            <p
              style={{
                fontFamily: 'var(--font-dm-mono), monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(200,191,173,0.45)',
              }}
            >
              Built on Next.js 15 · Supabase · Anthropic Claude · Google Cloud
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Perguntas frequentes white-label"
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

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Candidatura ao beta white-label"
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
              Beta Privado · 5 Vagas
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
              A sua agência.<br />A nossa tecnologia.
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
              Candidate-se agora ao beta fechado. As primeiras 5 agências AMI
              recebem 3 meses grátis e formação no local em Lisboa.
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
                href="https://wa.me/351919948986?text=Quero+saber+mais+sobre+o+White-Label"
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
                href="mailto:geral@agencygroup.pt?subject=Candidatura%20White-Label%20Beta&body=Ol%C3%A1%2C%0A%0AEstou%20interessado(a)%20na%20plataforma%20White-Label%20da%20Agency%20Group.%0A%0ANome%20da%20ag%C3%AAncia%3A%20%0AAMI%3A%20%0ASite%20actual%3A%20%0AN%C3%BA%20de%20agentes%3A%20%0APlano%20de%20interesse%3A%20Starter%20%E2%82%AC500%2Fm%C3%AAs%20%2F%20Pro%20%E2%82%AC1.000%2Fm%C3%AAs%0A%0ACom%20os%20melhores%20cumprimentos%2C"
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
                Formulário de Candidatura
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
              +351 919 948 986 · AMI 22506 · Agency Group
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
              { href: '/parceiros', label: 'Parceiros' },
              { href: '/concierge-estrangeiros', label: 'Concierge Estrangeiros' },
              { href: '/investor-intelligence', label: 'Investor Intelligence' },
              { href: '/blog', label: 'Blog' },
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
