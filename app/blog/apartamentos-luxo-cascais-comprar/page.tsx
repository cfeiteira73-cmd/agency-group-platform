import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Moradias de Luxo em Cascais: Guia de Compra 2026',
  description: 'Guia completo para comprar apartamentos e moradias de luxo em Cascais 2026. Quinta da Marinha, Estoril, Centro. Escolas internacionais, golfe, comunidade internacional, NHR. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/buy-property-cascais',
      'pt': 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
      'fr': 'https://www.agencygroup.pt/blog/acheter-appartement-lisbonne-guide',
      'x-default': 'https://www.agencygroup.pt/blog/buy-property-cascais',
    },
  },
  openGraph: {
    title: 'Apartamentos e Moradias de Luxo em Cascais: Guia de Compra 2026',
    description: '20 minutos de Lisboa, praias, golfe, escolas internacionais. Quinta da Marinha €4.800/m². O lifestyle perfeito para famílias internacionais.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Apartamentos e Moradias de Luxo em Cascais: Guia de Compra 2026',
  description: 'Guia completo para comprar apartamentos e moradias de luxo em Cascais 2026. Zonas, preços, escolas, golfe e processo de compra.',
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
  url: 'https://www.agencygroup.pt/blog/apartamentos-luxo-cascais-comprar',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Apartamentos luxo Cascais' },
    { '@type': 'Thing', name: 'Moradias Cascais comprar' },
    { '@type': 'Thing', name: 'Quinta da Marinha imóveis' },
  ],
}

export default function ArticleCascais() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → apartamentos-luxo-cascais-comprar
          </div>
          <div className="art-cat">Guia de Compra · Cascais</div>
          <h1 className="art-h1">Apartamentos e Moradias de Luxo em Cascais:<br/><em>Guia de Compra 2026</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>1 Abril 2026</span>
            <span>·</span>
            <span>14 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Cascais é, para uma parte significativa da comunidade internacional de Portugal, o endereço preferido. A 20 minutos de Lisboa pela A5 ou pela linha ferroviária mais bela da Europa, Cascais oferece praias atlânticas, quatro campos de golfe de referência internacional, as melhores escolas internacionais de Portugal, um centro histórico encantador e um lifestyle que combina o melhor do campo com o melhor do mar — a menos de meia hora de uma capital europeia de primeiro nível. Em 2026, a procura continua a superar a oferta disponível.
        </p>

        <h2 className="s">1. Cascais — Porque é o Endereço Eleito pela Comunidade Internacional</h2>
        <p className="t">Cascais não é apenas uma localização geográfica — é um estilo de vida. A pergunta que ouvimos regularmente de famílias internacionais é: "Lisboa ou Cascais?" A resposta depende do perfil, mas para famílias com filhos em idade escolar, praticantes de golfe ou surf, e quem valoriza espaço, jardim e ar puro sem abdicar de acesso rápido à cidade, Cascais ganha sempre.</p>
        <p className="t">A prova está nos números: mais de 40% da população estrangeira que compra imóvel na Grande Lisboa escolhe Cascais ou o eixo Estoril–Cascais. Os britânicos são o maior grupo individual — com uma comunidade estabelecida de décadas, duas escolas britânicas de referência, e um clube de cricket (sim, cricket). Os americanos são o grupo de maior crescimento em 2025–2026.</p>

        <div className="callout">
          <p><strong>Linha de Cascais:</strong> O comboio Lisboa Cais do Sodré → Cascais faz o percurso em 40 minutos, com ligação cada 20 minutos em hora de ponta. É uma das linhas ferroviárias mais belas da Europa, com vistas sobre o estuário do Tejo e o Atlântico. Para quem trabalha em Lisboa mas quer viver em Cascais, é a solução ideal.</p>
        </div>

        <h2 className="s">2. Zonas e Preços em Cascais (Q1 2026)</h2>
        <div className="zona-grid">
          {[
            {name:'Centro de Cascais',price:'€4.200–4.800/m²',desc:'Coração histórico. Praça do Município, marina, passeio marítimo. Apartamentos em edifícios reabilitados com charme histórico. Muito procurado por compradores sem filhos ou reformados.'},
            {name:'Estoril',price:'€3.800–4.400/m²',desc:'Casino, Hotel Palácio, praia. Produto misto entre apartamentos de luxo em altura e moradias de época reabilitadas. Forte presença britânica e americana. Preços ligeiramente abaixo de Cascais centro.'},
            {name:'Quinta da Marinha',price:'€4.500–5.200/m²',desc:'O condomínio mais exclusivo de Cascais. Campo de golfe Quinta da Marinha, Club House, segurança 24h. Moradias com jardim de €1,5M–€5M. O favorito das famílias americanas e do Médio Oriente.'},
            {name:'Birre',price:'€3.500–4.000/m²',desc:'Entre Cascais e a Quinta da Marinha. Mais espaço pelo mesmo preço. Terrenos maiores, moradias com jardim amplo. Excelente para famílias que querem piscina e jardim sem preço de Quinta da Marinha.'},
            {name:'Alcabideche / Areia',price:'€2.800–3.400/m²',desc:'Interior do concelho. Quintas rurais, espaço, silêncio. 15 minutos de Cascais centro. O entry point do concelho para quem quer mais por menos. Valorização acelerada nos últimos 3 anos.'},
            {name:'Avenida Marginal (Estoril-Cascais)',price:'€4.800–6.500/m²',desc:'A linha de costa. Apartamentos com vista mar na primeira linha. Produto raro e muito cobiçado. Quando surge a mercado, é absorvido rapidamente. Os preços mais elevados do concelho.'},
          ].map(z=>(
            <div key={z.name} className="zona-card">
              <div className="zona-name">{z.name}</div>
              <div className="zona-price">{z.price}</div>
              <p className="zona-desc">{z.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Escolas Internacionais — O Factor Decisivo para Famílias</h2>
        <p className="t">Para famílias internacionais com filhos em idade escolar, a oferta de escolas internacionais é muitas vezes o factor número um na decisão de localização. Cascais e a linha de Cascais têm a melhor concentração de escolas internacionais de Portugal:</p>
        <div className="step-grid">
          {[
            {n:'01',t:"St. Julian's School",d:'A escola britânica de referência em Portugal. Desde 1932. Cascais. Currículo britânico, IGCSE e A-Levels. Reconhecida internacionalmente. Lista de espera recomendada com 2-3 anos de antecedência.'},
            {n:'02',t:'TASIS Portugal',d:'American School of Lisbon. São João do Estoril. Currículo americano, AP (Advanced Placement), IB Diploma. A escolha das famílias americanas. Excelentes resultados de admissão em universidades americanas.'},
            {n:'03',t:'CAISL',d:'Carlucci American International School of Lisbon. Beloura, Sintra (próximo de Cascais). Currículo americano completo. Instalações modernas, campus verde. Alternativa à TASIS.'},
            {n:'04',t:'Deutsche Schule Lissabon',d:'A escola alemã, em São João do Estoril. Para famílias alemãs ou que queiram currículo alemão. Diplomas reconhecidos na Alemanha, Áustria e Suíça.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Golfe — Quatro Campos de Referência Internacional</h2>
        <p className="t">Cascais é o destino de golfe mais sofisticado de Portugal Ocidental. Quatro campos a menos de 20 minutos entre si:</p>
        <table className="cost-table">
          <thead><tr><th>Campo</th><th>Localização</th><th>Características</th><th>Green Fee</th></tr></thead>
          <tbody>
            <tr><td>Quinta da Marinha Golf</td><td>Quinta da Marinha</td><td>18 buracos, Robert Trent Jones Jr., vista Atlântico</td><td>€85–120</td></tr>
            <tr><td>Penha Longa Golf</td><td>Sintra</td><td>18+9 buracos, Ritz-Carlton, Serra de Sintra</td><td>€90–140</td></tr>
            <tr><td>Estoril Golf</td><td>Estoril</td><td>18 buracos histórico, desde 1929, desafio técnico</td><td>€65–95</td></tr>
            <tr><td>Golf do Beloura</td><td>Sintra</td><td>18 buracos, design moderno, driving range</td><td>€55–80</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. Moradias vs Apartamentos — Análise de ROI</h2>
        <h3 className="ss">Moradias em Cascais</h3>
        <p className="t">Moradias com jardim e piscina são o produto mais procurado e o mais raro. Tipicamente 200–500m² de área útil, lote de 500m²–2.000m². Preços: €800K–€4M+ dependendo de zona, estado e qualidades. Yield de arrendamento de longa duração: 3,5–4,2%. Arrendamento de curta duração (verão): potencial de €4.000–€10.000/semana.</p>
        <h3 className="ss">Apartamentos de Luxo</h3>
        <p className="t">Melhor liquidez, menor custo de manutenção, mais fácil de arrendar durante todo o ano. T2 e T3 de luxo (100–180m²): €450K–€1,2M. Yield de longa duração: 4,0–4,8%. Produto de entrada mais acessível para investidores que querem exposição a Cascais.</p>

        <div className="callout">
          <p><strong>Recomendação Agency Group:</strong> Para investimento puro, apartamentos de luxo em Estoril ou Cascais centro oferecem melhor yield e liquidez. Para famílias internacionais em uso pessoal com arrendamento sazonal, moradia com jardim em Quinta da Marinha ou Birre é a escolha imbatível para qualidade de vida.</p>
        </div>

        <h2 className="s">6. NHR/IFICI + Cascais — A Combinação Perfeita</h2>
        <p className="t">Cascais tem a maior concentração de beneficiários do regime NHR/IFICI de Portugal. Não é coincidência — a combinação de lifestyle premium, escolas internacionais, golfe e benefício fiscal cria uma proposta de valor única para HNWI internacionais.</p>
        <p className="t">Para um casal britânico com rendimentos de £400K/ano (dividendos + rendas UK): com NHR/IFICI activo em Portugal, os rendimentos estrangeiros podem ser isentos de imposto português durante 10 anos. Poupança anual estimada: £60K–£100K vs residência no Reino Unido. Mais: saem de um ambiente de impostos crescentes (UK) para um dos regimes mais favoráveis da Europa.</p>
        <p className="t">A Agency Group trabalha em estreita colaboração com advogados fiscais especializados em NHR/IFICI para acompanhar compradores internacionais no processo de candidatura ao regime.</p>

        <h2 className="s">7. Tabela Resumo — Cascais para o Comprador Internacional</h2>
        <table className="cost-table">
          <thead><tr><th>Factor</th><th>Cascais</th><th>vs Lisboa</th></tr></thead>
          <tbody>
            <tr><td>Preço médio/m² (prime)</td><td>€4.713</td><td>−6% vs Lisboa prime</td></tr>
            <tr><td>Yield bruta (apartamentos)</td><td>4,0–4,8%</td><td>Equivalente</td></tr>
            <tr><td>Espaço típico por €1M</td><td>~200–220m²</td><td>+20% vs Lisboa</td></tr>
            <tr><td>Jardim/Piscina disponível</td><td>Comum</td><td>Raro em Lisboa</td></tr>
            <tr><td>Escolas internacionais</td><td>4 de referência</td><td>Lisboa tem mais</td></tr>
            <tr><td>Acesso a Lisboa</td><td>20 min (A5/comboio)</td><td>—</td></tr>
            <tr><td>Praias</td><td>10+ praias em 20 min</td><td>Limitado em Lisboa</td></tr>
            <tr><td>Golfe</td><td>4 campos top</td><td>Inferior em Lisboa</td></tr>
          </tbody>
        </table>

        <div className="cta-box">
          <h3>Encontre a sua casa em Cascais</h3>
          <p>AVM gratuito, acesso a moradias e apartamentos de luxo em Cascais, Estoril e Quinta da Marinha. Sem custos para o comprador.</p>
          <Link href="/imoveis">Ver Imóveis em Cascais →</Link>
        </div>
      </article>
    </>
  )
}
