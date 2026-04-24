import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Investir na Madeira 2026: Mercado em Crescimento',
  description: 'Madeira €3.760/m², +28% YoY — o mercado de crescimento mais rápido de Portugal. IFICI+, Zona Franca, yields 5.2%. Análise completa por zona. AMI 22506.',
  keywords: 'investir madeira 2026, imóveis funchal, madeira mercado imobiliário, ifici madeira, zona franca madeira, funchal imobiliário',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/investir-madeira-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/investir-madeira-2026',
    },
  },
  openGraph: {
    title: 'Investir na Madeira em 2026: O Mercado Que Não Para de Crescer',
    description: '+28% YoY, IFICI+, Zona Franca, yield 5.2%. A Madeira ainda 25% abaixo de Cascais — janela de entrada em 2026.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/investir-madeira-2026',
    locale: 'pt_PT',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Investir%20na%20Madeira%20em%202026%3A%20O%20Mercado%20Que%20N%C3%A3o%20Para%20de%20Cresc&subtitle=%2B28%25%20YoY%2C%20IFICI%2B%2C%20Zona%20Franca%2C%20yield%205.2%25.%20A%20Madeira%20ai',
      width: 1200,
      height: 630,
      alt: 'Investir na Madeira em 2026: O Mercado Que Não Para de Crescer',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Investir na Madeira em 2026: O Mercado Que Não Para de Crescer',
    description: '+28% YoY, IFICI+, Zona Franca, yield 5.2%. A Madeira ainda 25% abaixo de Cascais — janela de entrada',
    images: ['https://www.agencygroup.pt/api/og?title=Investir%20na%20Madeira%20em%202026%3A%20O%20Mercado%20Que%20N%C3%A3o%20Para%20de%20Cresc&subtitle=%2B28%25%20YoY%2C%20IFICI%2B%2C%20Zona%20Franca%2C%20yield%205.2%25.%20A%20Madeira%20ai'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Investir na Madeira em 2026: O Mercado Que Não Para de Crescer',
  description: 'Análise completa do mercado imobiliário da Madeira em 2026. IFICI+, Zona Franca, yields, zonas e comparação com Canárias.',
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
  datePublished: '2026-04-06',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/investir-madeira-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Investimento imobiliário Madeira' },
    { '@type': 'Thing', name: 'Imóveis Funchal 2026' },
    { '@type': 'Thing', name: 'IFICI Madeira' },
    { '@type': 'Thing', name: 'Zona Franca Madeira' },
  ],
}

const ZONAS = [
  {
    zona: 'Funchal Prime',
    pm2: '€4.000–5.500',
    yoy: '+26%',
    yield: '4.8%',
    nota: 'Zona Alta, Lido, Santa Maria. Alta liquidez. Penthouses com vista mar comandam prémio de 30–40%.',
  },
  {
    zona: 'Câmara de Lobos',
    pm2: '€2.800–3.800',
    yoy: '+31%',
    yield: '5.4%',
    nota: 'Maior crescimento percentual da ilha. Churchill pintou aqui. Infraestrutura em rápida melhoria.',
  },
  {
    zona: 'Caniçal / Porto Santo',
    pm2: '€1.900–2.800',
    yoy: '+22%',
    yield: '5.8%',
    nota: 'Porto Santo = praias de areia dourada. Ticket de entrada mais baixo, yields mais altos da Madeira.',
  },
  {
    zona: 'Monte / Quinta Grande',
    pm2: '€2.200–3.500',
    yoy: '+24%',
    yield: '4.6%',
    nota: 'Quintas históricas com quinta grande. Clima temperado de altitude. Procura crescente de nómadas digitais.',
  },
]

export default function ArticleInvestirMadeira2026() {
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
        .art-hero{padding:140px 0 80px;background:linear-gradient(150deg,#0c2010 0%,#0c1f15 60%,#091824 100%);position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 90% at 20% 60%,rgba(28,74,53,.5),transparent)}
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
        .zona-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .zona-table th{background:#0c1f15;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;font-weight:400}
        .zona-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7);vertical-align:top}
        .zona-table tr:hover td{background:rgba(28,74,53,.03)}
        .zona-nm{font-weight:600;color:#1c4a35;white-space:nowrap}
        .zona-pm2{font-family:var(--font-dm-mono),monospace;font-size:.78rem;white-space:nowrap}
        .zona-yoy{color:#1c4a35;font-weight:600;font-family:var(--font-dm-mono),monospace;font-size:.78rem}
        .zona-yield{color:#c9a96e;font-weight:600;font-family:var(--font-dm-mono),monospace;font-size:.78rem}
        .zona-nota{font-size:.78rem;color:rgba(14,14,13,.5);font-style:italic}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:32px 0}
        .stat-box{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px;text-align:center}
        .stat-val{font-family:var(--font-cormorant),serif;font-size:2.2rem;font-weight:300;color:#1c4a35;line-height:1;margin-bottom:8px}
        .stat-label{font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(14,14,13,.4)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.stat-row{grid-template-columns:1fr}.zona-table{font-size:.75rem}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → investir-madeira-2026
          </div>
          <div className="art-cat">Madeira · Investimento</div>
          <h1 className="art-h1">Investir na Madeira em 2026:<br /><em>O Mercado Que Não<br />Para de Crescer</em></h1>
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
          A Madeira registou uma valorização de +28% em 2026 — o crescimento mais rápido de qualquer mercado
          imobiliário em Portugal. O preço médio atingiu €3.760/m², com Funchal Prime a superar €5.500/m² nas
          tipologias premium. Os catalisadores são estruturais: regime IFICI+, Zona Franca Internacional da Madeira,
          clima inigualável, e um fluxo crescente de nómadas digitais, HNWIs e famílias em busca de fiscalidade
          optimizada. Os preços ainda estão 25% abaixo de Cascais. A janela de entrada está aberta — mas não por
          muito tempo.
        </p>

        <div className="stat-row">
          <div className="stat-box">
            <div className="stat-val">+28%</div>
            <div className="stat-label">Valorização YoY 2026</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">5,2%</div>
            <div className="stat-label">Yield bruto médio</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">€3.760</div>
            <div className="stat-label">Preço médio por m²</div>
          </div>
        </div>

        <h2 className="s">Por Que a Madeira Cresceu Tanto?</h2>
        <p className="t">
          O crescimento não é acidental. Quatro forças estruturais convergiram em 2024–2026. Primeiro, a
          pandemia revelou à escala global que trabalho e localização podem ser separados — e a Madeira, com
          Wi-Fi robusto, clima ameno todo o ano, e fusão horária europeia, tornou-se a capital não oficial
          do nomadismo digital no Atlântico. Segundo, o IFICI+ (sucessor do NHR) aplica-se a residentes na
          Madeira em condições idênticas ao continente, mas com a vantagem da Zona Franca Internacional.
          Terceiro, a oferta é estruturalmente limitada: trata-se de uma ilha vulcânica com topografia
          abrupta — não se constrói onde se quer. Quarto, a visibilidade internacional da Madeira disparou:
          Cristiano Ronaldo, o aeroporto renovado, e uma cobertura mediática crescente em mercados como
          o alemão, britânico e norte-americano.
        </p>

        <h2 className="s">IFICI+ e a Zona Franca da Madeira</h2>
        <p className="t">
          A Zona Franca Internacional da Madeira (ZFM/CINM) é um regime fiscal aprovado pela União Europeia
          que permite a empresas registadas na Madeira beneficiar de uma taxa de IRC reduzida (5% até 2027).
          Para HNWIs e empreendedores que estabelecem residência fiscal na Madeira, a combinação IFICI+
          (20% flat sobre rendimentos elegíveis) com a estrutura empresarial ZFM pode representar uma
          poupança fiscal total de €50.000–€300.000 anuais dependendo do perfil de rendimentos.
        </p>
        <p className="t">
          Ao contrário do que acontece com algumas jurisdições de baixa fiscalidade, a Madeira tem substância
          real: serviços públicos de qualidade, hospitais privados, escolas internacionais em Funchal,
          ligações aéreas directas a Lisboa (1h), Londres, Frankfurt, Paris e Amesterdão. Não é um destino
          de papel — é um destino de vida.
        </p>

        <div className="callout">
          <p><strong>Vantagem fiscal dupla:</strong> IFICI+ residência Madeira + estrutura ZFM = combinação exclusiva dentro da UE. Rendimentos de fonte estrangeira (dividendos, rendas, mais-valias) podem beneficiar de isenção total durante 10 anos sob IFICI+. <strong>Consulte um advogado fiscal antes de estruturar.</strong></p>
        </div>

        <h2 className="s">Análise por Zona: Onde Investir na Madeira</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="zona-table">
            <thead>
              <tr>
                <th>Zona</th>
                <th>€/m²</th>
                <th>Var. Homóloga</th>
                <th>Yield Bruto</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {ZONAS.map(z => (
                <tr key={z.zona}>
                  <td className="zona-nm">{z.zona}</td>
                  <td className="zona-pm2">{z.pm2}</td>
                  <td className="zona-yoy">{z.yoy}</td>
                  <td className="zona-yield">{z.yield}</td>
                  <td className="zona-nota">{z.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="s">Tipologias Mais Procuradas</h2>
        <p className="t">
          <strong>Penthouses em Funchal (€600K–€2M):</strong> A tipologia de maior procura e menor oferta.
          Vistas sobre a baía do Funchal, terraços generosos, e rendas de curto prazo entre €3.000–€8.000/semana
          na época alta. Escassez absoluta de stock de qualidade.
        </p>
        <p className="t">
          <strong>Quintas do campo / Monte (€800K–€3M):</strong> Propriedades históricas com jardins de
          espécies raras, piscina, e privacidade total. Procura crescente de famílias europeias em
          reposicionamento fiscal. Tipicamente fora de mercado — acesso via mandato exclusivo com agente local.
        </p>
        <p className="t">
          <strong>Villas em Câmara de Lobos (€350K–€1,2M):</strong> O mercado de maior crescimento percentual
          da ilha. Infraestrutura a melhorar rapidamente. Ticket de entrada acessível com perspectiva de
          valorização acelerada nos próximos 3 anos à medida que a zona ganha visibilidade.
        </p>

        <h2 className="s">Madeira vs. Canárias: Comparação para Investidores</h2>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Critério</th>
              <th>Madeira (PT)</th>
              <th>Canárias (ES)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Fiscalidade pessoal</td><td>IFICI+ 20% flat (10 anos)</td><td>Beckham Law 24% (até 10 anos)</td></tr>
            <tr><td>Fiscalidade empresarial</td><td>ZFM IRC 5%</td><td>ZEC Canárias IRC 4%</td></tr>
            <tr><td>Preço médio</td><td>€3.760/m²</td><td>€2.800/m² (Tenerife/Gran Canária)</td></tr>
            <tr><td>Valorização YoY</td><td>+28%</td><td>+14%</td></tr>
            <tr><td>Yield médio</td><td>5.2%</td><td>5.8%</td></tr>
            <tr><td>Conectividade</td><td>Lisboa 1h · LHR 2h40 · FRA 3h</td><td>Madrid 2h20 · LHR 4h</td></tr>
            <tr><td>Quadro legal</td><td>Portugal (UE)</td><td>Espanha (UE)</td></tr>
            <tr><td>Vantagem</td><td>IFICI + ZFM + valorização acelerada</td><td>Yields ligeiramente superiores</td></tr>
          </tbody>
        </table>

        <h2 className="s">Perspectiva 2027: A Janela de Entrada</h2>
        <p className="t">
          A Madeira ainda transaciona com um desconto de 25% face a Cascais (€4.713/m²) e 32% abaixo de Lisboa
          (€5.000/m²). Com os catalisadores em curso — IFICI+, ZFM, visibilidade internacional, limitação
          estrutural de oferta — o consenso de analistas aponta para convergência parcial com o continente
          até 2028. Quem entrar em 2026 beneficia de um mercado ainda em fase de descoberta de preço.
          A diferença entre agir agora e agir em 2028 pode representar 20–30% de valorização adicional.
        </p>

        <div className="cta-box">
          <h3>Explore imóveis na Madeira com a Agency Group</h3>
          <p>AMI 22506 activo nas ilhas. Acesso a portfólio off-market, análise fiscal integrada e acompanhamento total da transacção.</p>
          <a href="tel:+351919948986">+351 919 948 986 · Falar com Consultor Madeira</a>
        </div>

        <p className="t" style={{ fontSize: '.78rem', color: 'rgba(14,14,13,.4)', marginTop: '24px' }}>
          Agency Group · AMI 22506 · info@agencygroup.pt · www.agencygroup.pt · +351 919 948 986
        </p>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/blog/madeira-island-property-investment" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Madeira EN</Link>
            <Link href="/blog/nhr-ifici-2026-guia-completo" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>IFICI Guia</Link>
            <Link href="/blog/investir-imoveis-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Investir Portugal</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
