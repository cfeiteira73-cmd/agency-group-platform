import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Açores 2026: Hotspot do Imobiliário Português',
  description: 'Guia completo do mercado imobiliário dos Açores 2026. Preços €1.952/m², São Miguel, Faial, Terceira. Investimento, turismo, alojamento local, risco e retorno. AMI 22506.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/acores-investimento-imobiliario-2026' },
  openGraph: {
    title: 'Açores 2026: O Próximo Hotspot do Imobiliário Português?',
    description: 'Preços 60% abaixo de Lisboa, +8-12% YoY, 2.1 milhões visitantes 2025. Análise completa do investimento imobiliário nos Açores.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/acores-investimento-imobiliario-2026',
    locale: 'pt_PT',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=A%C3%A7ores%202026%3A%20O%20Pr%C3%B3ximo%20Hotspot%20do%20Imobili%C3%A1rio%20Portugu%C3%AAs%3F&subtitle=Pre%C3%A7os%2060%25%20abaixo%20de%20Lisboa%2C%20%2B8-12%25%20YoY%2C%202.1%20milh%C3%B5es%20vi',
      width: 1200,
      height: 630,
      alt: 'Açores 2026: O Próximo Hotspot do Imobiliário Português?',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Açores 2026: O Próximo Hotspot do Imobiliário Português?',
    description: 'Preços 60% abaixo de Lisboa, +8-12% YoY, 2.1 milhões visitantes 2025. Análise completa do investimen',
    images: ['https://www.agencygroup.pt/api/og?title=A%C3%A7ores%202026%3A%20O%20Pr%C3%B3ximo%20Hotspot%20do%20Imobili%C3%A1rio%20Portugu%C3%AAs%3F&subtitle=Pre%C3%A7os%2060%25%20abaixo%20de%20Lisboa%2C%20%2B8-12%25%20YoY%2C%202.1%20milh%C3%B5es%20vi'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Açores 2026: O Próximo Hotspot do Imobiliário Português?',
  description: 'Guia completo do mercado imobiliário dos Açores 2026. Preços, turismo, ilhas, risco e retorno.',
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
  url: 'https://www.agencygroup.pt/blog/acores-investimento-imobiliario-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Açores imobiliário 2026' },
    { '@type': 'Thing', name: 'Investir Açores' },
    { '@type': 'Thing', name: 'São Miguel investimento imobiliário' },
  ],
}

export default function ArticleAcoresInvestimento() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }} />
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
        .ilha-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:32px 0}
        .ilha-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px;border-top:3px solid #c9a96e}
        .ilha-name{font-family:var(--font-cormorant),serif;font-size:1.3rem;font-weight:300;color:#1c4a35;margin-bottom:6px}
        .ilha-price{font-family:var(--font-dm-mono),monospace;font-size:.72rem;letter-spacing:.1em;color:#c9a96e;margin-bottom:10px}
        .ilha-desc{font-size:.82rem;line-height:1.72;color:rgba(14,14,13,.6)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.ilha-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
        <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>← Blog</Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → acores-investimento-imobiliario-2026
          </div>
          <div className="art-cat">Investimento · Açores · 2026</div>
          <h1 className="art-h1">Açores 2026:<br /><em>O Próximo Hotspot do Imobiliário Português?</em></h1>
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
          A €1.952/m² — 61% abaixo da mediana de Lisboa e 48% abaixo do Porto — os Açores representam o ponto de entrada
          mais acessível no imobiliário português insular. Com 2,1 milhões de visitantes em 2025 (recorde absoluto),
          restrições ao alojamento local menos severas do que no continente, e crescimento de preços de +8–12% nas ilhas
          principais, o arquipélago atlântico está a captar a atenção de investidores que chegaram tarde a Lisboa e Cascais.
          Mas o risco é real. Este guia analisa o potencial e os condicionalismos com dados de 2026.
        </p>

        <h2 className="s">1. Os Números que Justificam a Atenção</h2>
        <p className="t">
          Os Açores foram durante décadas um mercado imobiliário quase exclusivamente local — um mercado de açorianos para
          açorianos, com pouca exposição internacional e preços correspondentemente baixos. Esse paradigma está a mudar
          de forma acelerada. Os catalisadores são identificáveis e, na sua maioria, estruturais:
        </p>

        <div className="step-grid">
          {[
            { n: '2.1M', t: 'Visitantes em 2025', d: 'Recorde absoluto de turismo. Crescimento de +34% face a 2022. Rotas directas de Lisboa, Porto, Londres, Frankfurt, Boston e Toronto para Ponta Delgada (São Miguel).' },
            { n: '+10%', t: 'Valorização YoY', d: 'Crescimento médio de 8–12% YoY nas ilhas principais (São Miguel, Faial, Terceira) em 2024–2025. Ponto de partida baixo amplifica a percentagem.' },
            { n: '€1.952', t: 'Preço médio/m² (2026)', d: 'Mediana dos Açores vs €5.000 Lisboa, €3.643 Porto, €3.760 Madeira. O mercado mais barato de Portugal insular, com turismo em expansão acelerada.' },
            { n: '180 dias', t: 'Quota AL menos restrita', d: 'Os Açores não aplicaram as mesmas limitações ao Alojamento Local que Lisboa ou Porto. Em muitas freguesias ainda é possível obter licenças AL sem as quotas municipais do continente.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n" style={{ fontSize: '1.6rem', letterSpacing: '.02em', color: '#1c4a35' }}>{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Ilha a Ilha — Perfil e Oportunidade</h2>

        <div className="ilha-grid">
          {[
            {
              name: 'São Miguel — Ponta Delgada',
              price: '€1.800–€2.400/m²',
              desc: 'A ilha mais desenvolvida e com maior liquidez. Ponta Delgada tem aeroporto internacional com ligações directas à Europa e América do Norte. Maior concentração de imóveis disponíveis, maior procura de arrendamento turístico e de longa duração. Primeira escolha para investidores que querem liquidez de saída.',
            },
            {
              name: 'Faial — Horta',
              price: '€1.400–€1.900/m²',
              desc: 'A ilha dos veleiros. Horta é porto de escala obrigatório para travessias do Atlântico Norte. Marina internacional, forte comunidade de expats europeus ligados à náutica. Mercado mais pequeno e menos líquido, mas com procura turística distinta e estável.',
            },
            {
              name: 'Terceira — Angra do Heroísmo',
              price: '€1.500–€2.000/m²',
              desc: 'A ilha da estabilidade. Angra do Heroísmo é Património da Humanidade UNESCO desde 1983. Base aérea das Lajes (NATO/EUA) gera procura permanente de arrendamento residencial de longa duração. O mercado mais estável dos Açores — menor volatilidade, menor potencial de valorização acelerada.',
            },
            {
              name: 'Pico — Madalena',
              price: '€1.200–€1.700/m²',
              desc: 'A ilha do vinho e da paisagem dramática. Vinhas Património UNESCO, observação de baleias, alta montagem vulcânica. Menor oferta de imóveis e menor liquidez. Adequado para compradores de estilo de vida com horizonte de 10+ anos.',
            },
          ].map(i => (
            <div key={i.name} className="ilha-card">
              <div className="ilha-name">{i.name}</div>
              <div className="ilha-price">{i.price}</div>
              <p className="ilha-desc">{i.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Turismo como Motor de Valorização</h2>
        <p className="t">
          O turismo é o principal motor de valorização imobiliária nos Açores — e os números de 2025 são excepcionais.
          Os 2,1 milhões de visitantes representam um crescimento de 280% face a 2015. A capacidade hoteleira não acompanhou
          este ritmo, o que cria pressão estrutural sobre o alojamento local e os preços de arrendamento turístico.
        </p>
        <p className="t">
          Um apartamento de 2 quartos em Ponta Delgada bem posicionado para AL pode gerar €40.000–€70.000/ano em receita
          bruta durante a época alta (Maio–Outubro). Yield bruta de 8–14% sobre o preço de compra são possíveis — valores
          que Lisboa não oferece há anos. A sazonalidade é o risco: a época baixa (Novembro–Março) tem taxa de ocupação
          significativamente inferior.
        </p>

        <div className="callout">
          <p><strong>Regulação AL nos Açores:</strong> Ao contrário do continente, os Açores não implementaram quotas municipais de Alojamento Local nas principais cidades. Em 2026, é ainda possível obter licenças AL em São Miguel e Terceira sem as restrições que vigoram em Lisboa, Porto ou Cascais. Esta janela pode fechar — é um factor de urgência para quem pondera investir.</p>
        </div>

        <h2 className="s">4. Perfil do Comprador Internacional nos Açores</h2>

        <table className="cost-table">
          <thead><tr><th>Perfil</th><th>Motivação Principal</th><th>Ticket Médio</th><th>Ilha Preferida</th></tr></thead>
          <tbody>
            <tr><td>Portugueses da diáspora</td><td>Raízes familiares, custo de entrada acessível</td><td>€80K–€200K</td><td>São Miguel, Terceira</td></tr>
            <tr><td>Franceses</td><td>Natureza, surf, ritmo de vida, preço baixo</td><td>€150K–€350K</td><td>São Miguel, Faial</td></tr>
            <tr><td>Alemães</td><td>Ecoturismo, aventura, segundo imóvel</td><td>€120K–€280K</td><td>Pico, Faial</td></tr>
            <tr><td>Americanos (surf/outdoor)</td><td>Ondas, natureza, custo de vida</td><td>€100K–€250K</td><td>São Miguel</td></tr>
            <tr><td>Investidores AL</td><td>Yield elevada, mercado emergente</td><td>€150K–€500K</td><td>São Miguel (Ponta Delgada)</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. Risco vs Retorno — A Análise Honesta</h2>

        <h3 className="ss">Riscos a Considerar</h3>
        <p className="t">
          Os Açores são um arquipélago vulcânico activo na junção de três placas tectónicas. O risco sísmico e vulcânico
          é real e diferente de qualquer outra região portuguesa. Em 1997, um sismo destruiu parcialmente a ilha do Faial.
          As seguradoras cobram prémios mais elevados e algumas excluem cobertura de terramotos — verificar antes de comprar.
        </p>
        <p className="t">
          A liquidez é o segundo risco crítico. O mercado dos Açores é pequeno — em ilhas como o Pico ou o Corvo, a venda
          de um imóvel pode demorar 12–36 meses. São Miguel e Terceira têm maior liquidez, mas ainda distante de Lisboa
          ou Porto. Para investidores com horizonte de saída definido a 3–5 anos, os Açores são inadequados. Para quem
          tem 10+ anos de horizonte, o perfil de risco/retorno é muito atractivo.
        </p>

        <h3 className="ss">Os Retornos Possíveis</h3>
        <p className="t">
          Um apartamento T2 bem localizado em Ponta Delgada comprado por €160.000 em 2026 pode, com +10% de valorização
          anual durante 5 anos, valer €258.000. Acrescentando €40.000/ano de receita AL bruta (conservadora), o retorno
          total no período é superior a 200% do capital investido — numa tese de risco tolerável para investidores de
          médio-longo prazo com diversificação por Portugal continental.
        </p>

        <div className="callout">
          <p><strong>Comparação com Madeira:</strong> A Madeira (€3.760/m²) oferece maior liquidez, melhor infraestrutura, e mercado internacional mais maduro — mas a preços quase 93% acima dos Açores. Para investidores com budget limitado (€100K–€300K), os Açores oferecem uma alternativa às ilhas atlânticas com maior potencial de valorização percentual, ao custo de maior risco e menor liquidez.</p>
        </div>

        <h2 className="s">6. Como Comprar nos Açores — Especificidades</h2>
        <p className="t">
          O processo de compra nos Açores segue a legislação portuguesa standard (NIF, CPCV, IMT, Escritura), mas com
          algumas particularidades práticas:
        </p>

        <div className="step-grid">
          {[
            { n: '01', t: 'Inspecção Técnica', d: 'Fundamental nas ilhas. Verificar estado estrutural face a histórico sísmico, isolamento, certificação energética e sistema de águas. Contratar engenheiro independente — não o avaliador do banco.' },
            { n: '02', t: 'Seguro com Cobertura Sísmica', d: 'Exigir apólice com cobertura explícita de riscos sísmicos e vulcânicos. Algumas seguradoras não cobrem estas situações nos Açores. Verificar antes de fechar negócio.' },
            { n: '03', t: 'Licença AL Antecipada', d: 'Antes da compra, confirmar elegibilidade do imóvel para licença AL junto da Câmara Municipal. Verificar se a freguesia está sujeita a moratória ou quota — evitar surpresas pós-compra.' },
            { n: '04', t: 'Gestão à Distância', d: 'Para investidores do continente, contratar empresa de gestão AL local. Em São Miguel há operadores profissionais experientes. A gestão à distância sem parceiro local compromete o desempenho do imóvel.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">7. Conclusão — Vale a Pena Investir nos Açores?</h2>
        <p className="t">
          A resposta depende do perfil do investidor. Para quem tem budget de €100K–€300K, horizonte de 7–10 anos, e
          aceita liquidez de saída mais lenta e risco sísmico gerido via seguro adequado — os Açores são a melhor
          oportunidade de entrada a preço baixo em Portugal insular. São Miguel (Ponta Delgada) é a escolha óbvia para
          quem prioriza liquidez e yield turística. Terceira para quem prefere estabilidade e arrendamento de longa duração.
        </p>
        <p className="t">
          Para investidores com budget acima de €500K que querem mercado líquido, saída rápida, e perfil internacional
          consolidado — Lisboa, Cascais ou Porto continuam a ser escolhas superiores. Os Açores são um complemento
          estratégico num portefólio diversificado, não um substituto dos mercados maduros do continente.
        </p>

        <div className="cta-box">
          <h3>Interessado em imobiliário nos Açores ou no continente?</h3>
          <p>A Agency Group opera em Portugal continental e insular. Sem custos para o comprador — a comissão é paga pelo vendedor. AMI 22506 · +351 919 948 986 · www.agencygroup.pt</p>
          <Link href="/imoveis">Ver Imóveis Disponíveis →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/blog/madeira-island-property-investment" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Madeira</Link>
            <Link href="/blog/investir-imoveis-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Investir em Portugal</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
