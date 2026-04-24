import type { Metadata } from 'next'
import Link from 'next/link'
import HomeNav from '@/app/components/HomeNav'

// ─── SEO Metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Casos de Sucesso · Transacções de Referência | Agency Group AMI 22506',
  description:
    'Três casos de sucesso Agency Group: comprador americano em Cascais, família francesa em Lisboa, investidor em Comporta. AMI 22506.',
  alternates: {
    canonical: 'https://www.agencygroup.pt/casos-de-sucesso',
    languages: {
      pt: 'https://www.agencygroup.pt/casos-de-sucesso',
      'x-default': 'https://www.agencygroup.pt/casos-de-sucesso',
    },
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Casos de Sucesso · Transacções de Referência | Agency Group AMI 22506',
    description:
      'Três casos de sucesso Agency Group: comprador americano em Cascais, família francesa em Lisboa, investidor em Comporta. AMI 22506.',
    type: 'website',
    url: 'https://www.agencygroup.pt/casos-de-sucesso',
    siteName: 'Agency Group',
    images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Casos+de+Sucesso&subtitle=Transa%C3%A7%C3%B5es+de+Refer%C3%AAncia+%C2%B7+Agency+Group',
      width: 1200,
      height: 630,
      alt: 'Casos de Sucesso — Agency Group AMI 22506',
    }],
  },
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Casos de Sucesso — Agency Group AMI 22506',
  description:
    'Transacções de referência: compradores internacionais em Cascais, Lisboa e Comporta.',
  url: 'https://www.agencygroup.pt/casos-de-sucesso',
  numberOfItems: 3,
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      item: {
        '@type': 'Article',
        name: 'Família Americana em Cascais — Villa Quinta da Marinha',
        description:
          'Casal tech da Califórnia adquire villa de €2.450.000 em Cascais em 45 dias, com aprovação IFICI.',
      },
    },
    {
      '@type': 'ListItem',
      position: 2,
      item: {
        '@type': 'Article',
        name: 'Executivo Francês no Chiado — Apartamento de €1.850.000',
        description:
          'Executivo parisiense adquire apartamento off-market no Chiado com estratégia fiscal NHR.',
      },
    },
    {
      '@type': 'ListItem',
      position: 3,
      item: {
        '@type': 'Article',
        name: 'Family Office UAE em Comporta — Terreno para Villa Privada',
        description:
          'Family office de Dubai adquire parcela de 2.800m² em Comporta para desenvolvimento de villa avaliada em €4.2M.',
      },
    },
  ],
  twitter: {
    card: 'summary_large_image',
    title: 'Casos de Sucesso · Transacções de Referência | Agency Group AMI 22506',
    description: 'Boutique imobiliária de luxo em Portugal. AMI 22506.',
    images: ['https://www.agencygroup.pt/api/og?title=Casos+de+Sucesso&subtitle=Transa%C3%A7%C3%B5es+de+Refer%C3%AAncia+%C2%B7+Agency+Group'],
  },
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const CASE_STUDIES = [
  {
    id: 1,
    index: '01',
    flag: 'US',
    archetype: 'Família Americana · Cascais',
    typeLabel: 'Relocalização Familiar',
    client: 'R. & S.M.',
    origin: 'San Francisco, Califórnia',
    brief: 'Casal de tecnologia vendeu startup e relocalizou família para Portugal — lifestyle premium, otimização fiscal e educação internacional.',
    property: 'Villa · Quinta da Marinha, Cascais',
    specs: '4 quartos · 380m² · Piscina · Vista mar',
    price: '€ 2.450.000',
    timeline: '45 dias — primeiro contacto a CPCV',
    metrics: [
      { value: '€ 2.45M', label: 'Valor de transacção' },
      { value: '45 dias', label: 'Contacto → CPCV' },
      { value: '€ 180K/ano', label: 'Poupança IFICI est.' },
      { value: '380 m²', label: 'Área de habitação' },
    ],
    tags: ['Off-Market', 'Internacional', '€2M+'],
    steps: [
      { label: 'Semana 1', text: 'Consulta NHR/IFICI e briefing de mercado — Cascais vs Lisboa vs Algarve.' },
      { label: 'Semanas 2–3', text: '12 propriedades analisadas, 5 visitadas em 3 dias de deslocação.' },
      { label: 'Semana 4', text: 'Oferta ao preço pedido. Advogado bilíngue contactado. Due diligence iniciada.' },
      { label: 'Semana 6', text: 'CPCV assinado. 60 dias de prazo para escritura.' },
      { label: 'Mês 3', text: 'Escritura realizada. Família instalada até Junho 2025.' },
    ],
    outcome: 'Família de 4 instalada em Junho 2025. Filhos matriculados na Cascais International School. IFICI aprovado — poupança estimada de €180.000/ano vs carga fiscal californiana.',
    quote: 'The process was far simpler than buying in the US. We were in by summer.',
    quoteAttr: 'R. & S.M. · Quinta da Marinha · 2025',
    accentColor: '#c9a96e',
  },
  {
    id: 2,
    index: '02',
    flag: 'FR',
    archetype: 'Executivo Francês · Chiado',
    typeLabel: 'Segunda Residência + NHR',
    client: 'P.D.',
    origin: 'Paris, França',
    brief: 'Segunda residência em Lisboa com estratégia fiscal NHR — relocação parcial, manutenção da carreira em Paris.',
    property: 'Apartamento · Chiado, Lisboa',
    specs: '3 quartos · 185m² · Renovado · Terraço sul',
    price: '€ 1.850.000',
    timeline: '3 semanas de pesquisa · 90 dias até escritura',
    metrics: [
      { value: '€ 1.85M', label: 'Valor de transacção' },
      { value: '−4%', label: 'Negociação obtida' },
      { value: '20%', label: 'Taxa NHR aprovada' },
      { value: '185 m²', label: 'Área de habitação' },
    ],
    tags: ['Chiado', 'Estratégia Fiscal', 'Off-Market'],
    steps: [
      { label: 'Semana 1', text: 'Selecção remota. Briefing por videochamada. Portfolio de 8 imóveis off-market.' },
      { label: 'Semanas 2–6', text: '3 visitas a Lisboa em fins-de-semana. Apartamento seleccionado na segunda visita.' },
      { label: 'Negociação', text: '-4% sobre o preço pedido. Condição: prazo de escritura de 90 dias.' },
      { label: 'Mês 2', text: 'Due diligence concluída. Advogado bilíngue — Carvalho & Associados.' },
      { label: 'Mês 3', text: 'Escritura realizada. Residência fiscal estabelecida Q3 2025.' },
    ],
    outcome: 'Residência fiscal em Portugal estabelecida Q3 2025. NHR aprovado. Rendimentos de arrendamento do apartamento de Paris agora tributados a 20% de taxa fixa vs 41% marginal anterior.',
    quote: "L'accompagnement était impeccable. Une seule agence, zéro complication.",
    quoteAttr: 'P.D. · Chiado · 2025',
    accentColor: '#1c4a35',
  },
  {
    id: 3,
    index: '03',
    flag: 'AE',
    archetype: 'Family Office UAE · Comporta',
    typeLabel: 'Investimento e Desenvolvimento',
    client: 'A.K.',
    origin: 'Dubai, Emirados Árabes',
    brief: 'Aquisição de terreno em Comporta para construção de villa privada — investimento de longo prazo com valor de saída elevado.',
    property: 'Terreno · Comporta · 2.800m²',
    specs: '2.800m² · Licença aprovada · Construção 600m²',
    price: '€ 1.200.000',
    timeline: '2 meses de pesquisa · Escritura com extensão de 90 dias',
    metrics: [
      { value: '€ 1.2M', label: 'Custo de aquisição' },
      { value: '€ 4.2M', label: 'Valor estimado concluído' },
      { value: '3.5×', label: 'ROI sobre terreno' },
      { value: '2.800 m²', label: 'Área do terreno' },
    ],
    tags: ['Comporta', 'Terreno', 'Desenvolvimento', '€1M+'],
    steps: [
      { label: 'Mês 1', text: 'Contacto via website. Portfolio briefing. Visitas a Comporta e Melides.' },
      { label: 'Mês 2', text: 'Terreno seleccionado. Due diligence: verificação REN, restrições, licença de construção confirmada.' },
      { label: 'Mês 2–3', text: 'Complexidade da titularidade exigiu extensão de CPCV de 90 dias — cláusula negociada.' },
      { label: 'Mês 5', text: 'Escritura concluída após resolução total da cadeia de titularidade.' },
      { label: 'Q1 2026', text: 'Construção iniciada. Conclusão projectada Q4 2026.' },
    ],
    outcome: 'Construção iniciada Q1 2026. Conclusão projectada Q4 2026. Valor estimado da villa concluída: €4.200.000 — retorno de 3,5x sobre o custo do terreno.',
    quote: 'The team understood our requirements without us having to explain twice.',
    quoteAttr: 'A.K. · Family Office · Comporta · 2025',
    accentColor: '#c9a96e',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CasosDeSucessoPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <HomeNav />

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d', backgroundColor: '#f4f0e6' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="Casos de sucesso Agency Group"
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
            AMI 22506 · Resultados Reais
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
            }}
          >
            Track Record.<br />Resultados Reais.
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
              fontWeight: 300,
              color: '#c8bfad',
              maxWidth: '640px',
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Três transacções documentadas em detalhe. Compradores internacionais com objectivos
            distintos — todos alcançados. Identidades protegidas, dados reais.
          </p>
        </section>

        {/* ── Stats Bar ────────────────────────────────────────────────────── */}
        <section
          aria-label="Métricas das transacções"
          style={{ backgroundColor: '#c9a96e', padding: '40px 24px' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '32px',
              maxWidth: '900px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            {[
              { value: '3 mercados', label: 'Cascais · Lisboa · Comporta' },
              { value: '€5.5M', label: 'Em transacções' },
              { value: '45–90 dias', label: 'Da pesquisa à escritura' },
              { value: '100%', label: 'Off-market ou exclusivo' },
            ].map((stat) => (
              <div key={stat.label}>
                <p
                  style={{
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
                    fontWeight: 600,
                    color: '#0e0e0d',
                    lineHeight: 1,
                    marginBottom: '8px',
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-dm-mono), monospace',
                    fontSize: '0.65rem',
                    fontWeight: 400,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#3a2e1e',
                  }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Case Studies ─────────────────────────────────────────────────── */}
        <section
          aria-label="Casos de sucesso detalhados"
          style={{ backgroundColor: '#f4f0e6', padding: '80px 24px' }}
        >
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '72px' }}>
            {CASE_STUDIES.map((cs) => (
              <article
                key={cs.id}
                aria-label={cs.archetype}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e4ddd0',
                  borderLeft: '4px solid #c9a96e',
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(12,31,21,0.08)',
                }}
              >
                {/* ── Card header ─────────────────────────────────────────── */}
                <div
                  style={{
                    backgroundColor: '#0c1f15',
                    padding: '32px 40px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '20px',
                  }}
                >
                  <div>
                    {/* Index + type badge row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.65rem',
                          letterSpacing: '0.2em',
                          textTransform: 'uppercase',
                          color: '#c9a96e',
                        }}
                      >
                        Caso {cs.index}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.6rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'rgba(201,169,110,0.55)',
                          border: '1px solid rgba(201,169,110,0.2)',
                          padding: '2px 8px',
                        }}
                      >
                        {cs.typeLabel}
                      </span>
                    </div>
                    <h2
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
                        fontWeight: 400,
                        color: '#f4f0e6',
                        margin: 0,
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {cs.archetype}
                    </h2>
                    <p
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontSize: '0.85rem',
                        fontWeight: 300,
                        color: '#c8bfad',
                        marginTop: '8px',
                        marginBottom: 0,
                      }}
                    >
                      {cs.origin}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                        fontWeight: 600,
                        color: '#c9a96e',
                        margin: 0,
                        lineHeight: 1,
                      }}
                    >
                      {cs.price}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.62rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(200,191,173,0.6)',
                        marginTop: '8px',
                        marginBottom: 0,
                      }}
                    >
                      {cs.timeline}
                    </p>
                  </div>
                </div>

                {/* ── Deal metrics strip ──────────────────────────────────── */}
                <div
                  style={{
                    backgroundColor: '#0c1f15',
                    padding: '20px 40px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '8px',
                  }}
                >
                  {cs.metrics.map((m) => (
                    <div key={m.label} style={{ textAlign: 'center', padding: '8px 0' }}>
                      <p
                        style={{
                          fontFamily: 'var(--font-cormorant), serif',
                          fontSize: 'clamp(1.2rem, 2.5vw, 1.55rem)',
                          fontWeight: 600,
                          color: '#c9a96e',
                          margin: 0,
                          lineHeight: 1,
                        }}
                      >
                        {m.value}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.58rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'rgba(200,191,173,0.5)',
                          marginTop: '5px',
                          marginBottom: 0,
                        }}
                      >
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Card body ───────────────────────────────────────────── */}
                <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

                  {/* Brief + Property */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '24px',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.62rem',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: '#c9a96e',
                          marginBottom: '8px',
                        }}
                      >
                        O Briefing
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontSize: '0.92rem',
                          fontWeight: 300,
                          color: '#3a3028',
                          lineHeight: 1.7,
                          margin: 0,
                        }}
                      >
                        {cs.brief}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.62rem',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: '#c9a96e',
                          marginBottom: '8px',
                        }}
                      >
                        O Imóvel
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-cormorant), serif',
                          fontSize: '1.05rem',
                          fontWeight: 500,
                          color: '#0c1f15',
                          lineHeight: 1.4,
                          marginBottom: '4px',
                        }}
                      >
                        {cs.property}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontSize: '0.82rem',
                          fontWeight: 300,
                          color: '#7a6f5e',
                          margin: 0,
                        }}
                      >
                        {cs.specs}
                      </p>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e8e2d9', margin: 0 }} />

                  {/* ── Visual timeline ─────────────────────────────────── */}
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.62rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#c9a96e',
                        marginBottom: '20px',
                      }}
                    >
                      O Processo
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {cs.steps.map((step, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'flex-start',
                          }}
                        >
                          {/* Dot + connector */}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              width: '20px',
                              flexShrink: 0,
                              paddingTop: '3px',
                            }}
                          >
                            <div
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#c9a96e',
                                flexShrink: 0,
                                boxShadow: '0 0 0 3px rgba(201,169,110,0.15)',
                              }}
                            />
                            {i < cs.steps.length - 1 && (
                              <div
                                style={{
                                  width: '1px',
                                  backgroundColor: 'rgba(201,169,110,0.22)',
                                  flex: 1,
                                  minHeight: '32px',
                                  marginTop: '4px',
                                }}
                              />
                            )}
                          </div>
                          {/* Content */}
                          <div style={{ paddingBottom: i < cs.steps.length - 1 ? '20px' : 0 }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-dm-mono), monospace',
                                fontSize: '0.64rem',
                                letterSpacing: '0.08em',
                                color: '#1c4a35',
                                fontWeight: 500,
                                display: 'block',
                                marginBottom: '4px',
                              }}
                            >
                              {step.label}
                            </span>
                            <span
                              style={{
                                fontFamily: 'var(--font-jost), sans-serif',
                                fontSize: '0.88rem',
                                fontWeight: 300,
                                color: '#4a4030',
                                lineHeight: 1.6,
                              }}
                            >
                              {step.text}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e8e2d9', margin: 0 }} />

                  {/* ── Outcome ─────────────────────────────────────────── */}
                  <div
                    style={{
                      backgroundColor: 'rgba(28,74,53,0.05)',
                      border: '1px solid rgba(28,74,53,0.12)',
                      borderLeft: '3px solid #1c4a35',
                      padding: '20px 24px',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Check icon */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    >
                      <circle cx="10" cy="10" r="9" stroke="#1c4a35" strokeWidth="1.5" />
                      <path d="M6 10l3 3 5-5" stroke="#1c4a35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.62rem',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: '#1c4a35',
                          marginBottom: '8px',
                        }}
                      >
                        Resultado
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontSize: '0.92rem',
                          fontWeight: 400,
                          color: '#1c3a28',
                          lineHeight: 1.7,
                          margin: 0,
                        }}
                      >
                        {cs.outcome}
                      </p>
                    </div>
                  </div>

                  {/* ── Pull quote ──────────────────────────────────────── */}
                  <blockquote
                    style={{
                      margin: 0,
                      padding: '28px 32px',
                      backgroundColor: '#0c1f15',
                      position: 'relative',
                    }}
                  >
                    {/* Large decorative quote mark */}
                    <span
                      aria-hidden="true"
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: '5rem',
                        lineHeight: 1,
                        color: 'rgba(201,169,110,0.18)',
                        position: 'absolute',
                        top: '10px',
                        left: '24px',
                        userSelect: 'none',
                      }}
                    >
                      &ldquo;
                    </span>
                    <p
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: 'clamp(1.15rem, 2.5vw, 1.45rem)',
                        fontWeight: 400,
                        fontStyle: 'italic',
                        color: '#f4f0e6',
                        lineHeight: 1.55,
                        marginBottom: '14px',
                        paddingLeft: '16px',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      &ldquo;{cs.quote}&rdquo;
                    </p>
                    <cite
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.62rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'rgba(201,169,110,0.65)',
                        fontStyle: 'normal',
                        paddingLeft: '16px',
                        display: 'block',
                      }}
                    >
                      — {cs.quoteAttr}
                    </cite>
                  </blockquote>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {cs.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontFamily: 'var(--font-dm-mono), monospace',
                          fontSize: '0.6rem',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: '#1c4a35',
                          border: '1px solid rgba(28,74,53,0.25)',
                          background: 'rgba(28,74,53,0.04)',
                          padding: '3px 10px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section
          aria-label="Contacto para novo caso de sucesso"
          style={{
            backgroundColor: '#0c1f15',
            padding: '80px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
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
              O Próximo Caso
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
              Quer ser o próximo<br />caso de sucesso?
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
              Uma equipa. Uma chamada. Zero burocracia. Da pesquisa à escritura,
              tratamos de tudo — em português, inglês, francês ou árabe.
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
                href="/concierge-estrangeiros"
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
                Concierge Estrangeiros
              </Link>
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
                  padding: '15px 32px',
                  borderRadius: '3px',
                  border: '1.5px solid rgba(201,169,110,0.45)',
                }}
              >
                Falar com Consultor
              </Link>
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
              { href: '/vendidos', label: 'Track Record' },
              { href: '/concierge-estrangeiros', label: 'Concierge Estrangeiros' },
              { href: '/investor-intelligence', label: 'Investor Intelligence' },
              { href: '/blog', label: 'Guias e Artigos' },
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
