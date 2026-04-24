import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Investir em Imóveis na Comporta 2026: Guia Completo',
  description: 'Guia completo para investir em imóveis na Comporta 2026. Herdades €2M–10M+, preços €5.000–6.500/m², off-market, compradores internacionais, yields e processo de compra. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/investir-imoveis-comporta-2026',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
      'pt': 'https://www.agencygroup.pt/blog/investir-imoveis-comporta-2026',
      'x-default': 'https://www.agencygroup.pt/blog/property-investment-portugal-returns',
    },
  },
  openGraph: {
    title: 'Investir em Imóveis na Comporta 2026: Preços, Off-Market e Guia Completo',
    description: 'O Saint-Tropez português. Herdades exclusivas, reserva natural, limitações de construção. Acesso off-market exclusivo pela Agency Group.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/investir-imoveis-comporta-2026',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Investir%20em%20Im%C3%B3veis%20na%20Comporta%202026%3A%20Pre%C3%A7os%2C%20Off-Market%20e%20G&subtitle=O%20Saint-Tropez%20portugu%C3%AAs.%20Herdades%20exclusivas%2C%20reserva',
      width: 1200,
      height: 630,
      alt: 'Investir em Imóveis na Comporta 2026: Preços, Off-Market e Guia Completo',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Investir em Imóveis na Comporta 2026: Preços, Off-Market e Guia Completo',
    description: 'O Saint-Tropez português. Herdades exclusivas, reserva natural, limitações de construção. Acesso off',
    images: ['https://www.agencygroup.pt/api/og?title=Investir%20em%20Im%C3%B3veis%20na%20Comporta%202026%3A%20Pre%C3%A7os%2C%20Off-Market%20e%20G&subtitle=O%20Saint-Tropez%20portugu%C3%AAs.%20Herdades%20exclusivas%2C%20reserva'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Investir em Imóveis na Comporta 2026: Preços, Off-Market e Guia Completo',
  description: 'Guia completo para investir em imóveis na Comporta 2026. Herdades, preços, off-market e processo de compra.',
  image: {
    '@type': 'ImageObject',
    url: 'https://www.agencygroup.pt/og-image.jpg',
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
  datePublished: '2026-04-01',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/investir-imoveis-comporta-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Imóveis Comporta' },
    { '@type': 'Thing', name: 'Herdades Comporta' },
    { '@type': 'Thing', name: 'Investimento imobiliário Comporta' },
  ],
}

export default function ArticleComporta() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(ARTICLE_SCHEMA)}}/>
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
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        .zona-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:32px 0}
        .zona-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px;border-top:3px solid #1c4a35}
        .zona-name{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#1c4a35;margin-bottom:8px}
        .zona-price{font-family:var(--font-dm-mono),monospace;font-size:.8rem;color:#c9a96e;font-weight:400;margin-bottom:8px}
        .zona-desc{font-size:.8rem;line-height:1.7;color:rgba(14,14,13,.6)}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.zona-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → investir-imoveis-comporta-2026
          </div>
          <div className="art-cat">Investimento · Comporta</div>
          <h1 className="art-h1">Investir em Imóveis na Comporta 2026:<br/><em>Preços, Off-Market e Guia Completo</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>1 Abril 2026</span>
            <span>·</span>
            <span>13 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Comporta é o segredo mais bem guardado da Europa. A 90 minutos de Lisboa, entre o Oceano Atlântico e a Reserva Natural do Estuário do Sado, existe um território único: dunas de areia branca, arrozais, pinheiros centenários e uma arquitectura de palha que não existe em mais nenhum lugar do mundo. Chamam-lhe o Saint-Tropez português — mas com dez vezes menos construção e regulamentação que protege esse estatuto para sempre. Para investidores sérios com horizontes de 5–10 anos, Comporta é a aposta mais assimétrica do imobiliário europeu.
        </p>

        <h2 className="s">1. Porque a Comporta é Diferente de Tudo o Resto</h2>
        <p className="t">Comporta não é um resort. É um território com restrições de construção entre as mais rígidas de Portugal. A Lei de Bases da Política de Ordenamento do Território e as classificações de Reserva Ecológica Nacional (REN) e Reserva Agrícola Nacional (RAN) cobrem a maioria das terras. Resultado: o que existe hoje é, em grande parte, tudo o que existirá amanhã.</p>
        <p className="t">Esta escassez estrutural e irreversível cria uma dinâmica de preços fundamentalmente diferente dos mercados urbanos. Cada herdade, cada moradia de palha, cada terreno com alvará de construção é um activo genuinamente único e não replicável. Comporta não tem substituto.</p>

        <div className="callout">
          <p><strong>Contexto regulatório:</strong> Mais de 85% do território da Comporta está classificado como zona de protecção especial (REN, RAN, Reserva Natural, Rede Natura 2000). Novas construções são raríssimas e sujeitas a aprovação camarária demorada. O produto existente é o produto definitivo.</p>
        </div>

        <h2 className="s">2. Preços e Tipologias em 2026</h2>
        <p className="t">O mercado da Comporta divide-se em dois segmentos com dinâmicas distintas:</p>

        <h3 className="ss">Imóveis Habitacionais (Casas e Apartamentos)</h3>
        <p className="t">Casas de luxo em Comporta Village ou Carvalhal: €5.000–6.500/m². Uma moradia típica de 300m² com piscina e jardim situa-se entre €1,5M e €2,5M. Produtos excepcionais com localização de primeira linha e acabamentos de referência podem ultrapassar €4M.</p>

        <h3 className="ss">Herdades e Propriedades Rurais</h3>
        <p className="t">As herdades são o activo mais procurado e mais escasso. Grandes extensões de terra com casa principal, piscina, e potencial para desenvolvimento (agro-turismo, glamping, turismo rural com alvará): €2M–€10M+. Algumas propriedades icónicas excedem os €15M.</p>

        <table className="cost-table">
          <thead>
            <tr>
              <th>Tipologia</th>
              <th>Gama de Preços</th>
              <th>Yield Típica</th>
              <th>Perfil de Comprador</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Moradia de luxo (200–400m²)</td><td>€1,5M – €4M</td><td>3,5–4,5%</td><td>Famílias internacionais, segunda residência</td></tr>
            <tr><td>Casa de palha tradicional (100–200m²)</td><td>€800K – €2M</td><td>4,0–5,0%</td><td>Compradores europeus, estilo de vida</td></tr>
            <tr><td>Herdade (5–50ha)</td><td>€2M – €10M+</td><td>2,5–3,5%</td><td>Family offices, HNWI, investimento patrimonial</td></tr>
            <tr><td>Terreno com alvará (raro)</td><td>€300K – €2M</td><td>N/A — desenvolvimento</td><td>Promotores, construtores privados</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. Zonas da Comporta — Mapa Detalhado</h2>
        <div className="zona-grid">
          {[
            {name:'Comporta Village',price:'€5.500–6.500/m²',desc:'O coração histórico. Restaurantes de referência (Museu do Arroz, comporta Café), arquitectura de palha original, proximidade à praia. O mais caro e o mais difícil de encontrar.'},
            {name:'Carvalhal',price:'€5.000–6.000/m²',desc:'Zona residencial estabelecida com villas de luxo e resorts como Sublime Comporta. Misto de segunda residência e alojamento turístico premium. Forte procura francesa e britânica.'},
            {name:'Melides',price:'€4.500–5.500/m²',desc:'Descoberta mais recente. Ainda com algum produto a preços de entrada razoáveis. Lagoa de Melides, praias selvagens. O Azeite de Melides e Craveiral Farm atraíram atenção internacional.'},
            {name:'Grândola / Pedrógão',price:'€2.500–4.000/m²',desc:'Interior da Península de Setúbal. Herdades de maior dimensão a preços mais acessíveis. Potencial de desenvolvimento de turismo rural. Horizonte de investimento 7–10 anos.'},
          ].map(z=>(
            <div key={z.name} className="zona-card">
              <div className="zona-name">{z.name}</div>
              <div className="zona-price">{z.price}</div>
              <p className="zona-desc">{z.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Off-Market — O Único Acesso Real ao Melhor Produto</h2>
        <p className="t">Na Comporta, a realidade do mercado é brutal: o melhor produto nunca chega aos portais. Estimamos que mais de 60% das transacções acima de €1M na Comporta são off-market — vendas silenciosas entre redes de confiança, muitas vezes sem sequer sair de um grupo de WhatsApp fechado entre consultores de referência.</p>
        <p className="t">A razão é simples: os vendedores em Comporta valorizam a privacidade. Não querem fotógrafos, não querem visitas em massa, não querem a sua propriedade exposta ao mundo. Querem um comprador sério, qualificado, capaz de fechar rapidamente e discretamente.</p>
        <p className="t">A Agency Group tem relações estabelecidas com os principais proprietários e consultores locais da Comporta. O nosso acesso off-market é o nosso activo mais valioso — e o seu principal vantagem competitiva enquanto comprador qualificado.</p>

        <div className="callout">
          <p><strong>Off-Market Comporta:</strong> Na nossa base de dados actual existem <strong>3 herdades</strong> e <strong>7 moradias de luxo</strong> em Comporta/Melides que nunca foram a mercado público. Preços entre €1,2M e €8,5M. Disponíveis exclusivamente para compradores qualificados com carta de intenções.</p>
        </div>

        <h2 className="s">5. Perfil do Comprador na Comporta</h2>
        <div className="step-grid">
          {[
            {n:'35%',t:'Franceses',d:'O maior grupo. Comporta é conhecida em Paris como "o escape perfeito". Muitos têm residência em Lisboa e a Comporta como segunda ou terceira casa. Compradores sofisticados com processo de decisão rápido.'},
            {n:'20%',t:'Britânicos',d:'Segunda residência ou retirada antecipada. Apreciam o isolamento, a natureza e os preços ainda abaixo de Tuscânia ou Provença. Pós-Brexit, Portugal tornou-se destino preferencial.'},
            {n:'15%',t:'Portugueses',d:'Principalmente HNWIs lisboetas. Compras de segunda residência e investimento patrimonial de longo prazo. Conhecem o mercado e negoceiam com sofisticação.'},
            {n:'12%',t:'Alemães e Escandinavos',d:'Perfil de sustentabilidade e ligação à natureza. Apreciam a Reserva Natural e o silêncio. Tickets médios elevados, processo de decisão longo mas compromisso firme.'},
            {n:'8%',t:'Norte-Americanos',d:'Crescente. Descobriram Comporta via mídia de estilo de vida (Vogue, Condé Nast Traveller). Procuram experiências autênticas impossíveis de encontrar em Hampton ou Malibu.'},
            {n:'10%',t:'Outros',d:'Family offices do Médio Oriente, empresários brasileiros de alto nível e compradores asiáticos completam o panorama internacional de um mercado verdadeiramente global.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. Yields e Valorização</h2>
        <p className="t">A Comporta tem um perfil de retorno atípico face ao imobiliário convencional. A yield de arrendamento é inferior à de Lisboa (3,5–4,5% bruto), mas a valorização de capital tem sido extraordinária.</p>
        <h3 className="ss">Arrendamento de Curta Duração</h3>
        <p className="t">Uma moradia de luxo em Comporta Village arrendada via Airbnb/VRBO nas semanas de pico (Julho–Agosto) pode gerar €5.000–€15.000/semana. Gestão profissional é essencial — existem empresas especializadas no mercado local. Yield bruta anual efectiva com sazonalidade correcta: 4,5–6,5% em produtos de primeira linha.</p>
        <h3 className="ss">Valorização de Capital</h3>
        <p className="t">Propriedades adquiridas em Comporta em 2018–2020 valorizaram em média 120–180% até 2026. A escassez estrutural garante que não há diluição por nova oferta. O tecto de preço ainda está longe — os equivalentes em Saint-Tropez ou Ibiza custam 3–4x mais.</p>

        <h2 className="s">7. Processo Específico Comporta — O Que é Diferente</h2>
        <p className="t">Comprar na Comporta tem especificidades que distinguem este mercado do imobiliário urbano de Lisboa ou Porto:</p>
        <div className="step-grid">
          {[
            {n:'01',t:'Pesquisa Off-Market Primeiro',d:'Antes de visitar qualquer portal, contacte um consultor com rede local estabelecida. O melhor produto não está online. Carta de intenções e prova de fundos geralmente exigidas antes de visitar.'},
            {n:'02',t:'Due Diligence Rural',d:'Para herdades: verificar REN/RAN, servidões, escrituras de água, poços, acessos, licenças existentes, potencial de construção futuro. Processo mais complexo que imóvel urbano. Advogado especialista em direito rural obrigatório.'},
            {n:'03',t:'IMI Rústico',d:'Terrenos e herdades classificados como rústicos têm IMI de 0,8% (vs 0,3–0,45% para urbano). Para uma herdade com VPT de €1M, o IMI anual é €8.000. Factor importante no cash-flow.'},
            {n:'04',t:'NHR + Comporta',d:'Compradores que estabeleçam residência fiscal em Portugal (nem que seja com morada em Lisboa) podem beneficiar do IFICI. A combinação NHR/IFICI + propriedade em Comporta é a estratégia favorita dos HNWIs franceses.'},
            {n:'05',t:'CPCV e Prazos',d:'Prazos entre CPCV e escritura tendem a ser mais longos (90–180 dias) para herdades, dada a complexidade da due diligence. Sinais de 10–20% são norma. Cláusulas de suspensividade são comuns.'},
            {n:'06',t:'Gestão Pós-Compra',d:'Para arrendamento de curta duração, licença de Alojamento Local obrigatória. Várias empresas de gestão especializadas no mercado da Comporta. Taxas de gestão: 20–30% das receitas brutas.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">8. Agency Group na Comporta</h2>
        <p className="t">A Agency Group tem presença activa na Comporta desde 2022. Construímos relações com os principais proprietários locais, herdeiros de propriedades históricas e promotores de projectos exclusivos. O nosso modelo de trabalho na Comporta é diferente do urbano:</p>
        <p className="t">Trabalhamos em exclusivo com um número limitado de compradores qualificados por trimestre. Cada mandato começa com uma sessão de briefing detalhada — perfil de uso, orçamento, timeline, flexibilidade — e seguimos com apresentações curadas de 3–5 propriedades seleccionadas da nossa rede off-market. Sem visitas em massa, sem spam de listings.</p>
        <p className="t">A nossa comissão (5% + IVA) é paga pelo vendedor. Para o comprador, o acesso à nossa rede é gratuito.</p>

        <div className="cta-box">
          <h3>Acesso off-market à Comporta</h3>
          <p>Carta de intenções + prova de fundos. Apresentamos 3–5 propriedades exclusivas seleccionadas para o seu perfil.</p>
          <Link href="/imoveis">Explorar Imóveis Comporta →</Link>
        </div>
      </article>
    </>
  )
}
