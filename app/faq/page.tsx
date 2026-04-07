import type { Metadata } from 'next'
import Link from 'next/link'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'FAQ — Perguntas Frequentes sobre Imobiliário em Portugal | Agency Group',
  description:
    'Guia completo para comprar casa em Portugal: Golden Visa, NHR/IFICI, IMT, crédito habitação estrangeiros, Visto D7, mais-valias. Agency Group AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/faq',
    languages: {
      'pt': 'https://www.agencygroup.pt/faq',
      'en': 'https://www.agencygroup.pt/en/faq',
      'x-default': 'https://www.agencygroup.pt/faq',
    },
  },
  openGraph: {
    title: 'FAQ Imobiliário Portugal 2026 · Agency Group',
    description:
      'Todas as respostas: Golden Visa, NHR, IMT, crédito habitação para estrangeiros, Visto D7, mais-valias, processo de compra em Portugal.',
    type: 'website',
    url: 'https://www.agencygroup.pt/faq',
    siteName: 'Agency Group',
  },
}

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Como funciona o Golden Visa em Portugal em 2026?',
    a: 'Desde Outubro 2023, o Golden Visa (ARI) deixou de aceitar investimento imobiliário directo em habitação nas áreas metropolitanas. As modalidades disponíveis em 2026 incluem: fundos de investimento qualificados (€500K mínimo), criação de emprego (10 postos), transferência de capital (€1,5M), investigação científica (€500K) e artes/cultura (€250K). Contacte a Agency Group para encaminhamento a advogados especializados.',
  },
  {
    q: 'O que é o regime NHR / IFICI e como se aplica em Portugal?',
    a: 'O NHR (Residente Não Habitual) oferece isenção de IRS sobre rendimentos de fonte estrangeira por 10 anos para novos residentes fiscais em Portugal. O regime IFICI (2024) substituiu parcialmente o NHR com taxa flat de 20% sobre rendimentos qualificados para profissionais de tecnologia, investigação e artes. A Agency Group encaminha para parceiros fiscais especializados.',
  },
  {
    q: 'O que é o IMT e quanto se paga na compra de um imóvel em Portugal?',
    a: 'O IMT (Imposto Municipal sobre Transmissões Onerosas de Imóveis) é calculado sobre o valor de compra. Para habitação própria permanente: isento até €97.064, taxa de 2% até €132.774, 5% até €181.034, 7% até €301.688, 8% até €578.598, e 6% acima desse valor (taxa única). Para investimento: 6% acima de €97.064. A Agency Group fornece simulação detalhada gratuita.',
  },
  {
    q: 'Como comprar uma casa em Portugal sendo estrangeiro?',
    a: 'O processo tem 5 passos: (1) Obter NIF fiscal numa Finanças ou com advogado — 1 dia; (2) Abrir conta bancária portuguesa — 1 semana; (3) Escolher imóvel e negociar proposta; (4) Assinar CPCV com sinal de 10–30%; (5) Escritura pública no Cartório Notarial. O processo total demora 2–3 meses. A Agency Group (AMI 22506) acompanha todo o processo.',
  },
  {
    q: 'Os bancos portugueses financiam compradores estrangeiros?',
    a: 'Sim. Os bancos portugueses financiam não residentes com LTV entre 60–80% dependendo do país de origem: cidadãos UE (França, Alemanha, Brasil) até 80%; britânicos, americanos e emiratenses até 70%; chineses até 60%. Documentação exigida: prova de rendimentos, extractos bancários 6 meses, declaração fiscal do país de origem. Spread típico: 0,85–1,5% + Euribor 6M. A Agency Group tem parcerias com Millennium BCP, Santander e BPI.',
  },
  {
    q: 'O que é o Visto D7 e quem pode candidatar-se?',
    a: 'O Visto D7 (Rendimento Passivo) permite residência em Portugal a quem prove rendimentos regulares mínimos de €820/mês (salário mínimo nacional). Aceita rendimentos de pensões, arrendamentos, dividendos, juros ou trabalho remoto. O processo: obter NIF, conta bancária PT, arrendamento/propriedade, seguro saúde, e agendar na VFS Global ou Consulado. Aprovação em 60–90 dias. Compatível com regime NHR/IFICI para optimização fiscal.',
  },
  {
    q: 'Qual o preço por m² em Lisboa e nas principais zonas em 2026?',
    a: 'Em 2026 o preço médio em Lisboa ronda os €5.000–€6.500/m² dependendo da zona. Chiado e Santos: €6.200–7.500/m². Príncipe Real: €6.000–7.000/m². Alfama e Mouraria: €4.500–5.500/m². Cascais: €4.713/m² (média). Algarve: €3.941/m². Porto: €3.643/m². Madeira: €3.760/m². Valorização média anual de +17,6%. Fonte: Agency Group / INE 2026.',
  },
  {
    q: 'Quais os custos totais de transação na compra de imóvel em Portugal?',
    a: 'Para habitação própria: IMT (0–7,5% consoante valor), Imposto de Selo 0,8%, registo predial ~€500, advogado ~€1.500–3.000. Para imóvel de €500K HPP: IMT ~€28.900 + IS €4.000 + custos legais ~€2.000 = ~€35.000 total (7% do valor). A Agency Group fornece simulação detalhada gratuita.',
  },
  {
    q: 'Como se calculam as mais-valias imobiliárias em Portugal?',
    a: 'Mais-valia = (Preço Venda - Preço Compra × Coeficiente AT) - Despesas Compra - Despesas Venda - Obras (12 anos). Para residentes: 50% do ganho sujeito a englobamento IRS (Art. 43º CIRS). Para não residentes: taxa liberatória de 28% sobre 100% do ganho (Art. 72º CIRS). Isenção total para HPP se reinvestir noutra HPP (Art. 10º/5 CIRS). Use o calculador gratuito da Agency Group.',
  },
  {
    q: 'Qual a rentabilidade de imóveis para arrendamento em Portugal?',
    a: 'Yield bruta média em 2026: Lisboa 3,5–4,5%, Cascais 3,8–4,8%, Porto 4,0–5,5%, Algarve (sazonal) 5,0–8,0%, Comporta 4,5–6,0%. Yield líquida após custos e impostos tipicamente 2,5–4,0%. Valorização anual adicional +15–20% nas zonas prime.',
  },
  {
    q: 'Qual a comissão da Agency Group na compra e venda de imóveis?',
    a: 'A Agency Group cobra 5% do valor de transação, pago 50% no CPCV e 50% na Escritura. A comissão é paga pelo vendedor salvo acordo em contrário. AMI 22506 — mediação imobiliária licenciada em Portugal.',
  },
  {
    q: 'Qual o melhor momento para comprar imóvel em Portugal em 2026?',
    a: 'Em 2026 o mercado valoriza +17,6% YoY com 169.812 transacções previstas. O prazo médio de venda é 210 dias. Os meses de Setembro a Novembro têm tipicamente mais oferta e menos compradores activos — ligeira vantagem negocial. O mercado de luxo (€1M+) em Lisboa está no top 5 mundial de valorização. A Agency Group recomenda agir agora em imóveis de valor — a janela histórica de spreads baixos Euribor pode fechar em 2026.',
  },
]

// ─── JSON-LD FAQPage schema ───────────────────────────────────────────────────
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

// ─── BreadcrumbList schema ────────────────────────────────────────────────────
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: 'https://www.agencygroup.pt/' },
    { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://www.agencygroup.pt/faq' },
  ],
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function FAQPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div
        style={{
          minHeight: '100vh',
          background: '#0c1f15',
          color: '#f4f0e6',
          fontFamily: "var(--font-jost, 'Jost', sans-serif)",
        }}
      >
        {/* ── Nav strip ─────────────────────────────────────────────────────── */}
        <nav
          aria-label="Navegação principal"
          style={{
            borderBottom: '1px solid rgba(201,169,110,.12)',
            padding: '18px 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
              fontSize: '1.25rem',
              fontWeight: 300,
              color: '#f4f0e6',
              textDecoration: 'none',
              letterSpacing: '.04em',
            }}
          >
            Agency Group
          </Link>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <Link
              href="/imoveis"
              style={{
                color: 'rgba(244,240,230,.55)',
                textDecoration: 'none',
                fontSize: '.75rem',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
              }}
            >
              Imóveis
            </Link>
            <Link
              href="/#contacto"
              style={{
                color: 'rgba(244,240,230,.55)',
                textDecoration: 'none',
                fontSize: '.75rem',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
              }}
            >
              Contacto
            </Link>
          </div>
        </nav>

        {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
        <nav
          aria-label="Breadcrumb"
          style={{
            padding: '14px 40px',
            fontSize: '.7rem',
            letterSpacing: '.08em',
            color: 'rgba(244,240,230,.35)',
            textTransform: 'uppercase',
          }}
        >
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <li>
              <Link
                href="/"
                style={{ color: 'rgba(201,169,110,.7)', textDecoration: 'none' }}
              >
                Início
              </Link>
            </li>
            <li aria-hidden="true" style={{ opacity: 0.4 }}>›</li>
            <li aria-current="page" style={{ color: 'rgba(244,240,230,.55)' }}>FAQ</li>
          </ol>
        </nav>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <header
          style={{
            padding: '64px 40px 48px',
            maxWidth: '860px',
            margin: '0 auto',
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
              fontSize: '.52rem',
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              color: 'rgba(201,169,110,.65)',
              marginBottom: '16px',
            }}
          >
            Agency Group · AMI 22506
          </p>
          <h1
            style={{
              fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
              fontWeight: 300,
              fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
              lineHeight: 1.1,
              color: '#f4f0e6',
              margin: '0 0 24px',
            }}
          >
            Perguntas Frequentes sobre{' '}
            <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>
              Imobiliário em Portugal
            </em>
          </h1>
          <p
            style={{
              fontSize: '.95rem',
              color: 'rgba(244,240,230,.6)',
              lineHeight: 1.75,
              maxWidth: '640px',
            }}
          >
            Respostas completas e actualizadas a 2026 sobre Golden Visa, NHR/IFICI,
            IMT, processo de compra, crédito habitação para estrangeiros, Visto D7 e
            mais-valias imobiliárias em Portugal.
          </p>
        </header>

        {/* ── FAQ list ──────────────────────────────────────────────────────── */}
        <main
          id="main-faq"
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            padding: '0 40px 96px',
          }}
        >
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {FAQS.map(({ q, a }, i) => (
              <li
                key={i}
                style={{
                  borderTop: '1px solid rgba(201,169,110,.12)',
                  padding: '40px 0',
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
                    fontWeight: 400,
                    fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
                    color: '#f4f0e6',
                    margin: '0 0 18px',
                    lineHeight: 1.3,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
                      fontSize: '.5rem',
                      color: 'rgba(201,169,110,.5)',
                      letterSpacing: '.14em',
                      marginRight: '12px',
                      verticalAlign: 'middle',
                    }}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {q}
                </h2>
                <p
                  style={{
                    fontSize: '.9rem',
                    color: 'rgba(244,240,230,.65)',
                    lineHeight: 1.8,
                    margin: 0,
                    paddingLeft: '36px',
                  }}
                >
                  {a}
                </p>
              </li>
            ))}
          </ol>

          {/* ── Bottom divider ────────────────────────────────────────────── */}
          <div
            style={{
              borderTop: '1px solid rgba(201,169,110,.12)',
              paddingTop: '48px',
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <p
              style={{
                fontSize: '.82rem',
                color: 'rgba(244,240,230,.45)',
                lineHeight: 1.65,
                margin: 0,
                maxWidth: '520px',
              }}
            >
              Não encontrou a resposta que procura? Fale directamente com a nossa equipa.
              Respondemos em PT, EN, FR e DE.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                href="/#contacto"
                style={{
                  display: 'inline-block',
                  background: '#c9a96e',
                  color: '#0c1f15',
                  padding: '13px 32px',
                  fontFamily: "var(--font-jost, 'Jost', sans-serif)",
                  fontSize: '.6rem',
                  fontWeight: 600,
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Falar com Consultor
              </Link>
              <Link
                href="/imoveis"
                style={{
                  display: 'inline-block',
                  background: 'transparent',
                  color: '#c9a96e',
                  border: '1px solid rgba(201,169,110,.4)',
                  padding: '13px 32px',
                  fontFamily: "var(--font-jost, 'Jost', sans-serif)",
                  fontSize: '.6rem',
                  fontWeight: 600,
                  letterSpacing: '.18em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                }}
              >
                Ver Imóveis →
              </Link>
            </div>
          </div>
        </main>

        {/* ── Footer strip ─────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: '1px solid rgba(201,169,110,.08)',
            padding: '24px 40px',
            fontFamily: "var(--font-dm-mono, 'DM Mono', monospace)",
            fontSize: '.52rem',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'rgba(244,240,230,.2)',
            textAlign: 'center',
          }}
        >
          Agency Group · Mediação Imobiliária Lda · AMI 22506 · Lisboa, Portugal
        </footer>
      </div>
    </>
  )
}
