import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mercado Imobiliário do Porto 2026: Preços, Zonas Premium e Investimento · Agency Group',
  description: 'Guia completo do mercado imobiliário do Porto 2026. Foz do Douro, Boavista, Cedofeita, Bonfim, Matosinhos. Yields 4,8–5,5%, Porto vs Lisboa análise, NHR/IFICI. AMI 22506.',
  robots: 'index, follow',
  alternates: { canonical: 'https://agencygroup.pt/blog/mercado-imoveis-porto-2026' },
  openGraph: {
    title: 'Mercado Imobiliário do Porto 2026: Preços, Zonas Premium e Investimento',
    description: 'O melhor preço/qualidade de Portugal. Foz do Douro €4.000/m², yields 4,8–5,5%, a cidade mais cool da Europa.',
    type: 'article',
    url: 'https://agencygroup.pt/blog/mercado-imoveis-porto-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Mercado Imobiliário do Porto 2026: Preços, Zonas Premium e Investimento',
  description: 'Guia completo do mercado imobiliário do Porto 2026. Preços por zona, yields, Porto vs Lisboa e processo de compra.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://agencygroup.pt' },
  datePublished: '2026-04-01',
  dateModified: '2026-04-06',
  url: 'https://agencygroup.pt/blog/mercado-imoveis-porto-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Imóveis Porto 2026' },
    { '@type': 'Thing', name: 'Foz do Douro imóveis' },
    { '@type': 'Thing', name: 'Investimento imobiliário Porto' },
  ],
}

export default function ArticlePorto() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(ARTICLE_SCHEMA)}}/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → mercado-imoveis-porto-2026
          </div>
          <div className="art-cat">Mercado · Porto</div>
          <h1 className="art-h1">Mercado Imobiliário do Porto 2026:<br/><em>Preços, Zonas Premium e Investimento</em></h1>
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
          O Porto é hoje, sem discussão possível, a cidade com melhor relação qualidade-preço do imobiliário em Portugal. Com yields brutas de 4,8–5,5% — as melhores do país — e preços ainda 30–40% abaixo de Lisboa nas zonas prime, o Porto oferece ao investidor sofisticado o que raramente existe em simultâneo: valorização de capital sólida, rendimento de arrendamento robusto, e um lifestyle urbano que não tem paralelo no Sul da Europa. Em 2025, Porto foi eleita a cidade mais cool da Europa por múltiplos rankings internacionais. O imobiliário reflecte exactamente isso.
        </p>

        <h2 className="s">1. Porto em 2026 — O Momento Certo</h2>
        <p className="t">O mercado imobiliário do Porto está num ponto de inflexão interessante. Após anos de crescimento acelerado post-pandémico (2021–2024), o mercado estabilizou numa trajectória de valorização sustentável de 8–12% ao ano. A procura internacional continua robusta, com franceses e brasileiros na liderança, mas com crescente presença americana e holandesa.</p>
        <p className="t">O principal catalisador de 2026 é o investimento em infraestrutura: expansão do Metro (linha Rosa para Gaia, nova ligação ao aeroporto), reabilitação do eixo Boavista-Mar, e a chegada de novos hotéis e escritórios premium que elevam o nível urbano de bairros historicamente desvalorizados como Bonfim e Campanhã.</p>

        <div className="callout">
          <p><strong>Porto vs Outras Cidades Europeias:</strong> Barcelona €5.800/m² · Amesterdão €6.200/m² · Madrid €5.100/m² · Porto €3.643/m² (mediana). Para um investidor com €500K de capital, o Porto oferece 30–40% mais metros quadrados em zona comparável. E yields superiores.</p>
        </div>

        <h2 className="s">2. Zonas e Preços — Q1 2026</h2>
        <div className="zona-grid">
          {[
            {name:'Foz do Douro',price:'€3.800–4.400/m²',desc:'O endereço mais nobre do Porto. Foz Velha, frente mar, proximidade com o jardim da Sereia. Moradias com jardim, apartamentos de pé-direito alto, vista para o oceano. Produto raro e muito procurado.'},
            {name:'Boavista',price:'€3.200–3.800/m²',desc:'Eixo empresarial e residencial premium. Casa da Música, hotéis de 5 estrelas, escritórios internacionais. Excelente liquidez de arrendamento. Novos projectos de luxo em desenvolvimento.'},
            {name:'Cedofeita / Miragaia',price:'€2.800–3.400/m²',desc:'Bairro histórico com renovação acelerada. Galerias de arte, restauração de referência, espaços criativos. Muito procurado por nómadas digitais e profissionais jovens de alto rendimento.'},
            {name:'Bonfim',price:'€2.500–3.000/m²',desc:'O bairro mais em transformação do Porto. Ainda com produto a preço de entrada razoável, mas valorização acelerada. Metro, proximidade com Campanhã (hub ferroviário europeu futuro).'},
            {name:'Matosinhos',price:'€2.800–3.400/m²',desc:'A zona de praia do Porto. Frente mar, o melhor marisco de Portugal, comunidade jovem e internacional. Muito forte em arrendamento de curta duração. Ligação rápida ao centro do Porto.'},
            {name:'Gaia Ribeirinha',price:'€2.500–3.200/m²',desc:'Frente do rio com vista para o Porto histórico. Caves do vinho do Porto, novos empreendimentos de luxo com vistas únicas. Yields de arrendamento excelentes por proximidade ao turismo.'},
          ].map(z=>(
            <div key={z.name} className="zona-card">
              <div className="zona-name">{z.name}</div>
              <div className="zona-price">{z.price}</div>
              <p className="zona-desc">{z.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Tabela Comparativa de Zonas (Q1 2026)</h2>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Zona</th>
              <th>Preço Médio/m²</th>
              <th>Yield Bruta</th>
              <th>Valorização YoY</th>
              <th>Perfil</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Foz do Douro</td><td>€4.100/m²</td><td>4,0–4,5%</td><td>+14%</td><td>Luxo, famílias</td></tr>
            <tr><td>Boavista</td><td>€3.500/m²</td><td>4,5–5,0%</td><td>+12%</td><td>Premium, executivos</td></tr>
            <tr><td>Cedofeita</td><td>€3.100/m²</td><td>5,0–5,5%</td><td>+13%</td><td>Criativo, jovens</td></tr>
            <tr><td>Matosinhos</td><td>€3.100/m²</td><td>5,5–6,0%</td><td>+11%</td><td>Praia, turismo</td></tr>
            <tr><td>Bonfim</td><td>€2.750/m²</td><td>5,5–6,5%</td><td>+16%</td><td>Emergente, ROI</td></tr>
            <tr><td>Gaia Ribeirinha</td><td>€2.850/m²</td><td>5,5–6,5%</td><td>+15%</td><td>Turismo, vista rio</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. Perfil do Comprador Internacional no Porto</h2>
        <div className="step-grid">
          {[
            {n:'20%',t:'Franceses',d:'O maior grupo no Porto. Muitos são da comunidade française estabelecida há anos, atraídos pelo custo de vida, gastronomia e qualidade de vida. Preferem Cedofeita, Foz e Boavista.'},
            {n:'15%',t:'Brasileiros',d:'Maior crescimento recente. Atraídos pela língua, pela cultura e pelos preços ainda acessíveis vs Lisboa. Porto tem uma das maiores comunidades brasileiras de Portugal.'},
            {n:'12%',t:'Norte-Americanos',d:'Nómadas digitais e reformados antecipados. Porto tem um custo de vida 40% inferior a Lisboa. Preferem apartamentos T2/T3 em Cedofeita ou Bonfim.'},
            {n:'10%',t:'Holandeses e Alemães',d:'Perfil de investimento puro. Compram para arrendar. Processo de decisão analítico, due diligence rigorosa, mas compromisso firme quando decidem.'},
            {n:'8%',t:'Britânicos',d:'Segunda residência e reforma antecipada. Apreciam a escala humana do Porto, a gastronomia e a proximidade com o aeroporto Francisco Sá Carneiro.'},
            {n:'35%',t:'Outros',d:'Espanhóis, italianos, canadianos, australianos. Porto tornou-se um destino verdadeiramente global com presença de compradores de mais de 30 nacionalidades em 2025.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">5. Porto vs Lisboa — Análise Comparativa</h2>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Factor</th>
              <th>Porto</th>
              <th>Lisboa</th>
              <th>Vantagem</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Preço médio/m² (prime)</td><td>€3.643</td><td>€5.000+</td><td>Porto (−27%)</td></tr>
            <tr><td>Yield bruta típica</td><td>4,8–5,5%</td><td>4,2–4,5%</td><td>Porto (+0,8pp)</td></tr>
            <tr><td>Valorização 2025 YoY</td><td>+13%</td><td>+17,6%</td><td>Lisboa</td></tr>
            <tr><td>Custo de vida</td><td>Índice 72</td><td>Índice 100</td><td>Porto (−28%)</td></tr>
            <tr><td>Aeroporto</td><td>15 min</td><td>30 min</td><td>Porto</td></tr>
            <tr><td>Escolas internacionais</td><td>4 de referência</td><td>12+</td><td>Lisboa</td></tr>
            <tr><td>Turismo</td><td>+32% 2025</td><td>+28% 2025</td><td>Porto</td></tr>
            <tr><td>Hub corporativo</td><td>Emergente</td><td>Estabelecido</td><td>Lisboa</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Conclusão Porto vs Lisboa:</strong> Para investidores puros com foco em ROI, o Porto oferece yields superiores e valorização sólida com capital de entrada menor. Para famílias internacionais com filhos em escolas internacionais e hubs corporativos, Lisboa permanece a escolha natural. Muitos clientes da Agency Group têm propriedades em ambas as cidades.</p>
        </div>

        <h2 className="s">6. Novos Projectos e Oportunidades 2026</h2>
        <h3 className="ss">Boavista Prime</h3>
        <p className="t">O eixo Boavista está a receber investimento significativo em 2025–2026. Novos empreendimentos residenciais premium junto à Casa da Música combinam arquitectura contemporânea com localização central. Preços de lançamento (fase 1): €3.200–3.600/m². Entrega prevista: Q4 2027.</p>
        <h3 className="ss">Foz Mar</h3>
        <p className="t">Produto raro: apartamentos de tipologia grande (T3–T4, 150–220m²) com vista para o Atlântico em frente de mar de Foz. Oferta escassíssima. Quando aparecem, são absorvidos em dias. Preços: €4.200–4.800/m².</p>
        <h3 className="ss">Campanhã / Hub Ferroviário</h3>
        <p className="t">Com o planeado hub ferroviário europeu em Campanhã (conexão TGV Madrid-Paris via Porto), o bairro adjacente está a captar investimento especulativo com horizonte 2028–2030. Risco mais elevado, mas upside potencial significativo para early movers.</p>

        <h2 className="s">7. NHR/IFICI + Porto — A Combinação Inteligente</h2>
        <p className="t">Para compradores não-residentes que pretendem estabelecer residência fiscal em Portugal, o Porto oferece uma alternativa inteligente a Lisboa: custo de vida 28% inferior, imóvel 27% mais barato, mas os mesmos benefícios fiscais IFICI de taxa plana de 20% sobre rendimentos portugueses e isenção de rendimentos estrangeiros durante 10 anos.</p>
        <p className="t">Um casal americano com rendimentos de €300K/ano que se instale no Porto vs Boston pode poupar €80K–€120K/ano em impostos — e viver melhor, com Foz do Douro como morada, por €2.500/mês de renda (vs €8.000/mês em Boston ou €6.000/mês em Lisboa).</p>

        <div className="cta-box">
          <h3>Descubra o Porto com a Agency Group</h3>
          <p>AVM gratuito, simulador de retorno e acesso às melhores oportunidades off-market do Porto. Sem custos para o comprador.</p>
          <Link href="/imoveis">Ver Imóveis no Porto →</Link>
        </div>
      </article>
    </>
  )
}
