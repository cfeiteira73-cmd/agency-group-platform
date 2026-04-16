import type { Metadata } from 'next'
import Link from 'next/link'

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
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const CASE_STUDIES = [
  {
    id: 1,
    index: '01',
    flag: 'US',
    archetype: 'Família Americana · Cascais',
    client: 'R. & S.M.',
    origin: 'San Francisco, Califórnia',
    brief: 'Casal de tecnologia vendeu startup e relocalizou família para Portugal — lifestyle premium, otimização fiscal e educação internacional.',
    property: 'Villa · Quinta da Marinha, Cascais',
    specs: '4 quartos · 380m² · Piscina · Vista mar',
    price: '€ 2.450.000',
    timeline: '45 dias — primeiro contacto a CPCV',
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
    client: 'P.D.',
    origin: 'Paris, França',
    brief: 'Segunda residência em Lisboa com estratégia fiscal NHR — relocação parcial, manutenção da carreira em Paris.',
    property: 'Apartamento · Chiado, Lisboa',
    specs: '3 quartos · 185m² · Renovado · Terraço sul',
    price: '€ 1.850.000',
    timeline: '3 semanas de pesquisa · 90 dias até escritura',
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
    client: 'A.K.',
    origin: 'Dubai, Emirados Árabes',
    brief: 'Aquisição de terreno em Comporta para construção de villa privada — investimento de longo prazo com valor de saída elevado.',
    property: 'Terreno · Comporta · 2.800m²',
    specs: '2.800m² · Licença aprovada · Construção 600m²',
    price: '€ 1.200.000',
    timeline: '2 meses de pesquisa · Escritura com extensão de 90 dias',
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

      <main style={{ fontFamily: 'var(--font-jost), sans-serif', color: '#0e0e0d', backgroundColor: '#f4f0e6' }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-label="Casos de sucesso Agency Group"
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
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '64px' }}>
            {CASE_STUDIES.map((cs) => (
              <article
                key={cs.id}
                aria-label={cs.archetype}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e4ddd0',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(12,31,21,0.06)',
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    backgroundColor: '#0c1f15',
                    padding: '32px 40px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: '#c9a96e',
                        display: 'block',
                        marginBottom: '12px',
                      }}
                    >
                      Caso {cs.index}
                    </span>
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
                        fontSize: '0.65rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(200,191,173,0.7)',
                        marginTop: '6px',
                        marginBottom: 0,
                      }}
                    >
                      {cs.timeline}
                    </p>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

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

                  {/* Timeline */}
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.62rem',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#c9a96e',
                        marginBottom: '16px',
                      }}
                    >
                      O Processo
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {cs.steps.map((step, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 1fr',
                            gap: '16px',
                            alignItems: 'start',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-dm-mono), monospace',
                              fontSize: '0.65rem',
                              letterSpacing: '0.08em',
                              color: '#1c4a35',
                              fontWeight: 500,
                              paddingTop: '2px',
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
                      ))}
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e8e2d9', margin: 0 }} />

                  {/* Outcome */}
                  <div
                    style={{
                      backgroundColor: 'rgba(28,74,53,0.05)',
                      border: '1px solid rgba(28,74,53,0.12)',
                      borderRadius: '4px',
                      padding: '20px 24px',
                    }}
                  >
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

                  {/* Quote */}
                  <blockquote
                    style={{
                      borderLeft: `3px solid #c9a96e`,
                      paddingLeft: '20px',
                      margin: 0,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
                        fontWeight: 400,
                        fontStyle: 'italic',
                        color: '#0c1f15',
                        lineHeight: 1.55,
                        marginBottom: '8px',
                      }}
                    >
                      &ldquo;{cs.quote}&rdquo;
                    </p>
                    <cite
                      style={{
                        fontFamily: 'var(--font-dm-mono), monospace',
                        fontSize: '0.65rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: '#7a6f5e',
                        fontStyle: 'normal',
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
                          borderRadius: '2px',
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
