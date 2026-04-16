import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mercado Imobiliário Portugal: Análise Abril 2026',
  description: 'Análise do mercado imobiliário português em Abril 2026. Preços, transacções, zonas em valorização, perspectivas. Dados INE, Savills, Knight Frank. AMI 22506.',
  robots: 'index, follow',
  keywords: 'mercado imobiliário portugal 2026, preços imoveis portugal, investimento imobiliário lisboa, algarve cascais',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/mercado-imoveis-abril-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/mercado-imoveis-abril-2026',
    },
  },
  openGraph: {
    title: 'Mercado Imobiliário Portugal: Análise Abril 2026',
    description: 'Análise do mercado imobiliário português em Abril 2026. Preços, transacções, zonas em valorização e perspectivas de investimento.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/mercado-imoveis-abril-2026',
    locale: 'pt_PT',
    images: [
      {
        url: 'https://www.agencygroup.pt/api/og?title=Mercado%20Imobili%C3%A1rio%20Portugal%3A%20An%C3%A1lise%20Abril%202026&subtitle=Mercado',
        width: 1200,
        height: 630,
        alt: 'Mercado Imobiliário Portugal Análise Abril 2026',
      },
    ],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Mercado Imobiliário Portugal: Análise Abril 2026',
  description: 'Análise do mercado imobiliário português em Abril 2026. Preços, transacções, zonas em valorização, perspectivas. Dados INE, Savills, Knight Frank.',
  image: {
    '@type': 'ImageObject',
    url: 'https://www.agencygroup.pt/api/og?title=Mercado%20Imobili%C3%A1rio%20Portugal%3A%20An%C3%A1lise%20Abril%202026&subtitle=Mercado',
    width: 1200,
    height: 630,
  },
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: {
    '@type': 'Organization',
    name: 'Agency Group',
    url: 'https://www.agencygroup.pt',
    '@id': 'https://www.agencygroup.pt',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.agencygroup.pt/logo.png',
      width: 200,
      height: 60,
    },
  },
  datePublished: '2026-04-16',
  dateModified: '2026-04-16',
  url: 'https://www.agencygroup.pt/blog/mercado-imoveis-abril-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Mercado imobiliário Portugal 2026' },
    { '@type': 'Thing', name: 'Preços imóveis Portugal' },
    { '@type': 'Thing', name: 'Investimento imobiliário Lisboa' },
  ],
}

export default function ArticleMercadoImoveisAbril2026() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .art-hero{padding:140px 0 80px;background:#0c1f15;position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 10% 85%,rgba(28,74,53,.6),transparent)}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .art-breadcrumb a:hover{color:#c9a96e}
        .art-cat{display:inline-block;background:#1c4a35;color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(244,240,230,.35)}
        .art-content{max-width:860px;margin:0 auto;padding:72px 56px;background:#f4f0e6}
        .art-lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2.s{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.7rem;color:#1c4a35;margin:48px 0 20px;letter-spacing:.02em}
        h3.ss{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.9rem;letter-spacing:.08em;color:#0e0e0d;margin:32px 0 12px;text-transform:uppercase}
        p.t{font-size:.9rem;line-height:1.88;color:rgba(14,14,13,.65);margin-bottom:20px}
        .step-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin:32px 0}
        .step-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:28px}
        .step-n{font-family:var(--font-cormorant),serif;font-size:2.5rem;font-weight:300;color:rgba(28,74,53,.15);line-height:1;margin-bottom:12px}
        .step-t{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#1c4a35;margin-bottom:8px}
        .step-d{font-size:.83rem;line-height:1.75;color:rgba(14,14,13,.6)}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .cost-table tr:last-child td{border-bottom:none;font-weight:600;color:#1c4a35;background:rgba(28,74,53,.04)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .loc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:28px 0}
        .loc-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .loc-name{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#1c4a35;margin-bottom:8px}
        .loc-price{font-family:var(--font-dm-mono),monospace;font-size:.7rem;letter-spacing:.1em;color:#c9a96e;margin-bottom:6px}
        .loc-desc{font-size:.78rem;line-height:1.65;color:rgba(14,14,13,.55)}
        .zone-badge{display:inline-block;background:rgba(201,169,110,.12);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.16em;text-transform:uppercase;padding:3px 8px;margin-left:8px;vertical-align:middle}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.loc-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → mercado-imoveis-abril-2026
          </div>
          <div className="art-cat">Mercado</div>
          <h1 className="art-h1">Mercado Imobiliário Portugal:<br /><em>Análise Abril 2026</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>Abril 2026</span>
            <span>·</span>
            <span>10 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          O mercado imobiliário português entra em Abril de 2026 com um dos ciclos mais resilientes da Europa Ocidental.
          O 1.º trimestre de 2026 confirmou a aceleração: volume de transacções estimado em 42.000+, crescimento anual
          de +8%, preço mediano nacional a €3.076/m² e o segmento de luxo (acima de €1M) a registar +22% em volume.
          Lisboa mantém-se no top 5 mundial de mercados de luxo (Savills World Cities 2026). Esta análise reúne os dados
          mais recentes do INE, Savills, Knight Frank e Banco de Portugal para orientar compradores, investidores e
          proprietários nas decisões de 2026.
        </p>

        <h2 className="s">1. Snapshot Q1 2026 — Dados Nacionais</h2>
        <p className="t">
          O arranque de 2026 superou as expectativas consensuais. O mercado beneficia de três motores simultâneos: procura
          interna robusta (emprego em máximo histórico, confiança do consumidor positiva), procura estrangeira diversificada
          (compradores norte-americanos, franceses, britânicos, médio-orientais) e oferta nova ainda muito condicionada
          pelos ciclos de licenciamento e construção (24–36 meses). Esta equação de desequilíbrio estrutural sustenta
          preços, mesmo num ambiente de taxas ainda acima dos mínimos históricos.
        </p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Q1 2026</th>
              <th>Q1 2025</th>
              <th>Var. YoY</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Transacções estimadas (Q1)</td>
              <td>42.000+</td>
              <td>~38.900</td>
              <td>+8%</td>
            </tr>
            <tr>
              <td>Preço mediano nacional</td>
              <td>€3.076/m²</td>
              <td>€2.614/m²</td>
              <td>+17,6%</td>
            </tr>
            <tr>
              <td>Lisboa — preço médio</td>
              <td>€5.000/m²</td>
              <td>€4.300/m²</td>
              <td>+16,3%</td>
            </tr>
            <tr>
              <td>Segmento luxo &gt;€1M — volume</td>
              <td>+22% YoY</td>
              <td>—</td>
              <td>+22%</td>
            </tr>
            <tr>
              <td>Quota compradores estrangeiros (&gt;€500K)</td>
              <td>25%</td>
              <td>22%</td>
              <td>+3pp</td>
            </tr>
            <tr>
              <td>Dias médios em mercado</td>
              <td>210 dias</td>
              <td>228 dias</td>
              <td>-18 dias</td>
            </tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Fontes:</strong> INE Índice de Preços da Habitação Q4 2025 (publicado Março 2026) · Savills World Cities Prime Residential 2026 · Knight Frank Prime International Residential Index Q1 2026 · Banco de Portugal Boletim Económico Março 2026.</p>
        </div>

        <h2 className="s">2. Análise por Zona — Preços e Dinâmicas</h2>
        <p className="t">
          O mercado português não é homogéneo. A divergência entre zonas é crescente: mercados prime de Lisboa e Cascais
          crescem a ritmo diferente da periferia e do interior. Três zonas em particular estão a registar aceleração
          acima da média nacional em 2026.
        </p>

        <div className="loc-grid">
          {[
            {
              name: 'Lisboa',
              price: '€5.000 / m²',
              desc: 'Capital. Chiado, Príncipe Real e Avenida da Liberdade ultrapassam €10.000/m² no stock premium. Rendimento bruto prime: 3,5–4,2%. Top 5 mundial de luxo (Savills 2026).',
            },
            {
              name: 'Cascais',
              price: '€4.713 / m²',
              desc: '30 min de Lisboa. Costa atlântica, escolas internacionais, golfe, marina. Grande comunidade de expatriados norte-americanos e britânicos. Moradias €1,5M–€8M.',
            },
            {
              name: 'Algarve',
              price: '€3.941 / m²',
              desc: 'Costa sul. Golden Triangle (Vale do Lobo, Quinta do Lago, Vilamoura) atinge €5.000–€12.000/m². Lifestyle de resort. Forte procura britânica, alemã e escandinava.',
            },
            {
              name: 'Porto',
              price: '€3.643 / m²',
              desc: 'Segunda cidade. Centro histórico (UNESCO), Foz do Douro, Matosinhos. Rendimento de arrendamento acima da média nacional. Base crescente de compradores internacionais.',
            },
            {
              name: 'Madeira',
              price: '€3.760 / m²',
              desc: 'Ilha atlântica. Clima ameno todo o ano. Funchal e Calheta. Regime fiscal IFICI aplicável. Segmento de luxo em aceleração. Procura forte de nórdicos e alemães.',
            },
            {
              name: 'Açores',
              price: '€1.952 / m²',
              desc: 'Arquipélago atlântico. Preço de entrada ainda acessível. Ponta Delgada lidera. Mercado em fase de descoberta por compradores internacionais. Potencial de valorização elevado.',
            },
          ].map(l => (
            <div key={l.name} className="loc-card">
              <div className="loc-name">{l.name}</div>
              <div className="loc-price">{l.price}</div>
              <p className="loc-desc">{l.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="ss">Zonas em Aceleração — Oportunidades de 2026</h3>
        <p className="t">
          Três mercados emergentes registam crescimento acima da média nacional e atraem a atenção de investidores
          early-mover que procuram yield e valorização simultâneos:
        </p>

        <div className="step-grid">
          <div className="step-card">
            <div className="step-n">+18%</div>
            <div className="step-t">Comporta <span className="zone-badge">Alentejo Litoral</span></div>
            <p className="step-d">O destino mais exclusivo de Portugal. Oferta ultra-restrita, compradores internacionais de alto poder aquisitivo (médio-orientais, norte-americanos, franceses). Moradias e terrenos em escassez crescente. Preços a aproximar-se de €6.000–€8.000/m² para stock prime.</p>
          </div>
          <div className="step-card">
            <div className="step-n">+16%</div>
            <div className="step-t">Alcântara <span className="zone-badge">Lisboa Ocidental</span></div>
            <p className="step-d">Zona ribeirinha de Lisboa em franca regeneração. Projectos de reabilitação premium a transformar a frente de rio. Proximidade ao centro sem o preço de Chiado. Perfil comprador: jovens profissionais, investidores de rendimento, compradores franceses.</p>
          </div>
          <div className="step-card">
            <div className="step-n">+14%</div>
            <div className="step-t">Ericeira <span className="zone-badge">Reserva Mundial Surf</span></div>
            <p className="step-d">Única reserva mundial de surf da Europa. 45 minutos de Lisboa. Procura de compradores de lifestyle (surf, natureza, comunidade criativa). Moradias e quintas em zona de Reserva Natural. Preços ainda 30–40% abaixo de Cascais com trajectória ascendente.</p>
          </div>
        </div>

        <h2 className="s">3. Segmento de Luxo — Análise Detalhada</h2>
        <p className="t">
          O segmento acima de €1 milhão é o que regista maior dinamismo em 2026. O volume de transacções cresceu +22%
          face ao mesmo período de 2025, reflexo de procura internacional diversificada e oferta extremamente limitada
          de produto de qualidade. A escassez de stock é a principal característica do mercado de luxo português: as
          melhores propriedades são vendidas fora de portal, por rede de contactos e mandato exclusivo.
        </p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Sub-segmento</th>
              <th>Gama de Preços</th>
              <th>Principais Zonas</th>
              <th>Perfil Comprador</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Apartamento Prime Urbano</td>
              <td>€1M–€3M</td>
              <td>Lisboa (Chiado, PR, Av. Liberdade)</td>
              <td>Franceses, Britânicos, Brasileiros</td>
            </tr>
            <tr>
              <td>Moradia Costa / Resort</td>
              <td>€1,5M–€6M</td>
              <td>Cascais, Algarve Golden Triangle</td>
              <td>Norte-americanos, Britânicos, Alemães</td>
            </tr>
            <tr>
              <td>Quinta / Herdade</td>
              <td>€2M–€15M</td>
              <td>Alentejo, Comporta, Douro</td>
              <td>Médio Oriente, Family Offices, HNWI globais</td>
            </tr>
            <tr>
              <td>Ultra-Luxo (&gt;€5M)</td>
              <td>€5M–€100M</td>
              <td>Lisboa, Comporta, Algarve</td>
              <td>UHNWI, Family Offices, Asiáticos</td>
            </tr>
          </tbody>
        </table>

        <p className="t">
          O mercado off-market representa 30–40% das transacções acima de €1M. A Agency Group (AMI 22506) mantém
          acesso privilegiado a inventário exclusivo não publicado em portais — um diferencial crítico para compradores
          que procuram produto de qualidade em zonas prime.
        </p>

        <h2 className="s">4. Perfis de Compradores — Mercado 2026</h2>
        <p className="t">
          Portugal atrai um espectro diversificado de compradores internacionais, cada um com motivações e zonas
          preferenciais distintas. Compreender este mapa é essencial para antecipar tendências de procura e preço.
        </p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Nacionalidade</th>
              <th>Quota (&gt;€500K)</th>
              <th>Gama Típica</th>
              <th>Zonas Preferenciais</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Norte-americanos</td>
              <td>16%</td>
              <td>€800K–€3M</td>
              <td>Cascais, Lisboa, Algarve</td>
            </tr>
            <tr>
              <td>Franceses</td>
              <td>13%</td>
              <td>€500K–€2M</td>
              <td>Lisboa (Alcântara, Mouraria), Porto, Algarve</td>
            </tr>
            <tr>
              <td>Britânicos</td>
              <td>9%</td>
              <td>€600K–€2,5M</td>
              <td>Algarve, Cascais, Lisboa</td>
            </tr>
            <tr>
              <td>Chineses</td>
              <td>8%</td>
              <td>€500K–€2M</td>
              <td>Lisboa, Porto</td>
            </tr>
            <tr>
              <td>Brasileiros</td>
              <td>6%</td>
              <td>€400K–€1,5M</td>
              <td>Lisboa, Cascais, Porto</td>
            </tr>
            <tr>
              <td>Alemães</td>
              <td>5%</td>
              <td>€600K–€2M</td>
              <td>Algarve, Alentejo, Madeira</td>
            </tr>
            <tr>
              <td>Médio Oriente</td>
              <td>crescente</td>
              <td>€2M–€50M+</td>
              <td>Comporta, Lisboa ultra-prime, Algarve</td>
            </tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Nota sobre compradores portugueses (€100K–€500K):</strong> No segmento de acesso, portugueses lideram em volume com brasileiros como segunda maior comunidade, seguidos de angolanos e franceses. A procura primeira habitação mantém-se robusta apesar das taxas, suportada por estabilidade laboral e apoios governamentais para jovens até 35 anos (IMT e IS isentos desde 2024).</p>
        </div>

        <h2 className="s">5. Ambiente de Taxas e Financiamento</h2>
        <p className="t">
          A Euribor a 6 meses situava-se em 2,95% em Março de 2026 — uma redução significativa face ao pico de 4,1%
          em 2023/24. O BCE sinalizou pausa no ciclo de cortes, com a taxa de depósito nos 2,5%. Para o crédito à
          habitação, o impacto é positivo mas ainda não transformador: os spreads bancários mantêm-se em 1,2–1,8%
          para residentes e 1,8–2,5% para não-residentes.
        </p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Parâmetro</th>
              <th>Residentes</th>
              <th>Não-Residentes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Euribor 6M (Março 2026)</td>
              <td colSpan={2}>2,95%</td>
            </tr>
            <tr>
              <td>Spread típico</td>
              <td>1,2–1,8%</td>
              <td>1,8–2,5%</td>
            </tr>
            <tr>
              <td>TAN total estimada</td>
              <td>4,15–4,75%</td>
              <td>4,75–5,45%</td>
            </tr>
            <tr>
              <td>LTV máximo (Banco de Portugal)</td>
              <td>90%</td>
              <td>70%</td>
            </tr>
            <tr>
              <td>Prestação mensal (€500K, 30 anos, 80% LTV)</td>
              <td>~€1.850–€2.050</td>
              <td>~€2.100–€2.350</td>
            </tr>
          </tbody>
        </table>

        <p className="t">
          No segmento acima de €1M, as compras a pronto dominam: estima-se que 60–70% das transacções de luxo em Lisboa
          e Cascais sejam realizadas sem recurso a financiamento. Para investidores com capital disponível, a compra a
          pronto confere poder de negociação significativo e capacidade de fechar em 30–45 dias.
        </p>

        <h2 className="s">6. Rendimento e Perspectiva de Investimento</h2>
        <p className="t">
          O imobiliário português oferece duas formas complementares de retorno: rendimento de arrendamento e valorização
          de capital. Em 2026, o rendimento bruto prime em Lisboa situa-se em 3,5–4,2%, reflectindo a forte valorização
          dos últimos anos. No Algarve, o arrendamento sazonal de curta duração pode atingir 6–9% bruto em semanas de
          pico, com rentabilidade líquida anualizada de 4–5%.
        </p>

        <div className="step-grid">
          <div className="step-card">
            <div className="step-n">3,5–4,2%</div>
            <div className="step-t">Rendimento Bruto Lisboa Prime</div>
            <p className="step-d">Apartamentos T2–T3 em Chiado, Príncipe Real e Campo de Ourique. Arrendamento de longa duração a famílias internacionais e profissionais. Valorização esperada: +8–12% em 2026.</p>
          </div>
          <div className="step-card">
            <div className="step-n">4–6%</div>
            <div className="step-t">Rendimento Bruto Porto / Gaia</div>
            <p className="step-d">Segunda cidade com spread de rendimento superior a Lisboa. Foz do Douro e Matosinhos lideram. Forte procura de arrendamento por universitários e profissionais tech. Oferta nova escassa.</p>
          </div>
          <div className="step-card">
            <div className="step-n">6–9%</div>
            <div className="step-t">Algarve AL Curta Duração</div>
            <p className="step-d">Alojamento Local sazonal no Algarve Golden Triangle. Semanas de pico Junho–Setembro. Gestão profissional essencial. Regulamentação AL estabilizada desde 2025. Produto de resort sem restrições.</p>
          </div>
        </div>

        <h3 className="ss">Perspectivas para 2026–2027</h3>
        <p className="t">
          O consenso de analistas (Savills, JLL, CBRE Portugal, Knight Frank) aponta para crescimento sustentado em
          2026–2027, com as seguintes premissas: (1) Euribor a estabilizar em 2,5–3,0%; (2) oferta nova insuficiente
          para absorver a procura, especialmente no segmento premium; (3) procura internacional a manter-se forte,
          suportada pelo regime IFICI, pela reputação de Portugal como destino de qualidade de vida, e pela atractividade
          comparativa face a outros mercados europeus; (4) turismo em máximo histórico (28M visitantes em 2025),
          suportando o mercado de Alojamento Local.
        </p>
        <p className="t">
          Os riscos a monitorizar incluem: eventual revisão do regime de Alojamento Local nas zonas de pressão urbana,
          alterações fiscais ao arrendamento, e abrandamento da economia global. Contudo, a estrutura fundamental do
          mercado — escassez de oferta, procura diversificada, enquadramento jurídico sólido — permanece favorável
          para compradores e investidores de médio-longo prazo.
        </p>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f4f0e6', border: '1px solid rgba(28,74,53,.15)', borderRadius: '4px' }}>
          <p style={{ fontSize: '.85rem', color: '#1c4a35', fontWeight: '600', marginBottom: '.75rem' }}>
            Explore imóveis nas zonas analisadas:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            <Link href="/imoveis" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Ver todos os imóveis →</Link>
            <Link href="/zonas/lisboa" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Zona Lisboa →</Link>
            <Link href="/zonas/cascais" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Zona Cascais →</Link>
            <Link href="/zonas/algarve" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Zona Algarve →</Link>
            <Link href="/#avaliacao" style={{ color: '#c9a96e', textDecoration: 'underline', fontSize: '.875rem' }}>Avaliação gratuita →</Link>
          </div>
        </div>

        <div className="cta-box">
          <h3>Quer investir no mercado imobiliário português?</h3>
          <p>Consulte o nosso portfólio actual, obtenha uma avaliação gratuita e fale com os nossos consultores licenciados. Acesso a imóveis off-market incluído.</p>
          <Link href="/imoveis">Ver Imóveis Disponíveis →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/imoveis" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Imóveis</Link>
            <Link href="/blog/mercado-luxo-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Mercado Luxo</Link>
            <Link href="/blog/investir-imoveis-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Investir Portugal</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
