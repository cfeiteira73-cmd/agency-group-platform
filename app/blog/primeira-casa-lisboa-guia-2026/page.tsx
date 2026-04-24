import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comprar a Primeira Casa em Lisboa 2026: Guia Completo',
  description: 'Isenção total de IMT para jovens até 35 anos, garantia pública, Euribor 2.3%. Zonas acessíveis, simulador de prestação e processo CPCV→Escritura. AMI 22506.',
  keywords: 'comprar primeira casa lisboa 2026, crédito habitação jovens, imt isenção primeira habitação, primeira casa lisboa, apoios habitação 2026',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/primeira-casa-lisboa-guia-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/primeira-casa-lisboa-guia-2026',
    },
  },
  openGraph: {
    title: 'Comprar a Primeira Casa em Lisboa em 2026: Guia Completo',
    description: 'IMT isento para jovens, garantia pública, crédito a 3.2%, zonas acessíveis a partir de €1.600/m². Tudo o que precisa de saber.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/primeira-casa-lisboa-guia-2026',
    locale: 'pt_PT',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Comprar%20a%20Primeira%20Casa%20em%20Lisboa%20em%202026%3A%20Guia%20Completo&subtitle=IMT%20isento%20para%20jovens%2C%20garantia%20p%C3%BAblica%2C%20cr%C3%A9dito%20a%203.2',
      width: 1200,
      height: 630,
      alt: 'Comprar a Primeira Casa em Lisboa em 2026: Guia Completo',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comprar a Primeira Casa em Lisboa em 2026: Guia Completo',
    description: 'IMT isento para jovens, garantia pública, crédito a 3.2%, zonas acessíveis a partir de €1.600/m². Tu',
    images: ['https://www.agencygroup.pt/api/og?title=Comprar%20a%20Primeira%20Casa%20em%20Lisboa%20em%202026%3A%20Guia%20Completo&subtitle=IMT%20isento%20para%20jovens%2C%20garantia%20p%C3%BAblica%2C%20cr%C3%A9dito%20a%203.2'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Comprar a Primeira Casa em Lisboa em 2026: Guia Completo',
  description: 'Guia para compra de primeira habitação em Lisboa em 2026: apoios fiscais, crédito habitação, zonas acessíveis e processo passo a passo.',
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
  url: 'https://www.agencygroup.pt/blog/primeira-casa-lisboa-guia-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Primeira habitação Lisboa 2026' },
    { '@type': 'Thing', name: 'IMT isenção jovens' },
    { '@type': 'Thing', name: 'Crédito habitação 2026' },
  ],
}

const ZONAS_ACESSIVEIS = [
  { zona: 'Barreiro', pm2: '€1.600', commute: '30 min (ferry)', t2: '~€160K', nota: 'Melhor relação qualidade-preço da AML. Regeneração em curso.' },
  { zona: 'Amadora', pm2: '€1.900', commute: '20 min (metro)', t2: '~€190K', nota: 'Boa rede de transportes. Zona Venteira e Falagueira em valorização.' },
  { zona: 'Odivelas', pm2: '€2.200', commute: '15 min (metro)', t2: '~€220K', nota: 'Metro linha amarela. Muito procurado por jovens casais. A valorizar.' },
  { zona: 'Benfica', pm2: '€2.800', commute: '10 min (metro)', t2: '~€280K', nota: 'Dentro de Lisboa. Boa oferta de T2. Alta demanda — actuar rápido.' },
  { zona: 'Moscavide', pm2: '€3.000', commute: '12 min (metro)', t2: '~€300K', nota: 'Em valorização acelerada. Próximo do Parque das Nações. Vista Tejo.' },
  { zona: 'Marvila', pm2: '€3.200', commute: '15 min (metro)', t2: '~€320K', nota: 'Zona criativa emergente. +22% YoY. Ideal para perfil crescimento.' },
]

export default function ArticlePrimeiraCasaLisboa2026() {
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
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 50% at 50% 100%,rgba(28,74,53,.4),transparent)}
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
        .apoio-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin:28px 0}
        .apoio-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px;border-top:3px solid #1c4a35}
        .apoio-title{font-family:var(--font-jost),sans-serif;font-weight:600;font-size:.82rem;letter-spacing:.06em;color:#1c4a35;margin-bottom:8px;text-transform:uppercase}
        .apoio-desc{font-size:.82rem;line-height:1.75;color:rgba(14,14,13,.6)}
        .apoio-tag{display:inline-block;background:rgba(28,74,53,.08);color:#1c4a35;font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.12em;padding:3px 8px;margin-top:10px}
        .zona-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .zona-table th{background:#0c1f15;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;font-weight:400}
        .zona-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7);vertical-align:top}
        .zona-table tr:hover td{background:rgba(28,74,53,.03)}
        .zona-nm{font-weight:600;color:#1c4a35}
        .zona-nota{font-size:.78rem;color:rgba(14,14,13,.5);font-style:italic}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .cost-table tr:last-child td{border-bottom:none;font-weight:600;color:#1c4a35;background:rgba(28,74,53,.04)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .example-box{background:rgba(201,169,110,.08);border:1px solid rgba(201,169,110,.25);padding:28px 32px;margin:32px 0}
        .example-box h3{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#1c4a35;margin-bottom:16px}
        .example-line{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(14,14,13,.06);font-size:.85rem}
        .example-line:last-child{border-bottom:none;font-weight:600;color:#1c4a35;margin-top:4px;padding-top:12px}
        .example-label{color:rgba(14,14,13,.6)}
        .example-val{font-family:var(--font-dm-mono),monospace;font-size:.82rem;color:#1c4a35}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.apoio-grid{grid-template-columns:1fr}.zona-table{font-size:.75rem}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → primeira-casa-lisboa-guia-2026
          </div>
          <div className="art-cat">Primeira Habitação · Lisboa</div>
          <h1 className="art-h1">Comprar a Primeira Casa<br />em Lisboa em 2026:<br /><em>Guia Completo</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>Abril 2026</span>
            <span>·</span>
            <span>11 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          2026 é o melhor ano da última década para comprar a primeira casa em Lisboa. A Euribor 6M caiu para
          ~2,3%, o spread médio está em 0,9%, e o governo mantém apoios históricos: isenção total de IMT para
          jovens até 35 anos, isenção de Imposto de Selo, e garantia pública do crédito habitação. Um apartamento
          T2 em zonas acessíveis de Lisboa pode ser financiado a partir de €750–€850/mês. Este guia explica tudo
          — apoios, zonas, processo e documentação necessária.
        </p>

        <h2 className="s">Apoios 2026: O Que Mudou para Jovens Compradores</h2>
        <div className="apoio-grid">
          <div className="apoio-card">
            <div className="apoio-title">Isenção Total de IMT</div>
            <div className="apoio-desc">
              Jovens até 35 anos que comprem habitação própria permanente (HPP) estão totalmente isentos
              de IMT (Imposto Municipal sobre Transmissões). Para uma casa de €290.000, a poupança é de
              aproximadamente €12.600.
            </div>
            <span className="apoio-tag">Até 35 anos · HPP · Lei 2024</span>
          </div>
          <div className="apoio-card">
            <div className="apoio-title">Isenção de Imposto de Selo</div>
            <div className="apoio-desc">
              O Imposto de Selo (0,8% do valor de compra) é igualmente isento para jovens na aquisição
              de HPP ao abrigo da mesma lei. Para €290.000, representa mais €2.320 de poupança
              adicional — total: ~€14.920 apenas em isenções fiscais.
            </div>
            <span className="apoio-tag">0,8% poupado · Automático</span>
          </div>
          <div className="apoio-card">
            <div className="apoio-title">Garantia Pública do Estado</div>
            <div className="apoio-desc">
              O Estado garante até 15% do valor do imóvel para jovens sem entrada suficiente. Permite
              financiamento acima dos habituais 90% LTV, tornando a compra viável mesmo sem poupanças
              de entrada significativas. Sujeito a aprovação bancária e limites de preço por zona.
            </div>
            <span className="apoio-tag">Até 15% garantido · Jovens HPP</span>
          </div>
        </div>

        <h2 className="s">Crédito Habitação 2026: Taxas e Condições</h2>
        <p className="t">
          A Euribor 6 meses desceu de 4,0% (pico 2023) para aproximadamente 2,3% em Abril de 2026. Com
          spreads bancários médios de 0,9%, a taxa total efectiva ronda os 3,2% — o nível mais favorável
          desde 2022. Os bancos com melhores condições actuais para jovens compradores de HPP são Millennium BCP,
          Santander e CGD, com promoções específicas para clientes abaixo dos 35 anos.
        </p>

        <div className="example-box">
          <h3>Exemplo Prático: T2 em Benfica, €290.000</h3>
          <div className="example-line"><span className="example-label">Valor do imóvel</span><span className="example-val">€290.000</span></div>
          <div className="example-line"><span className="example-label">Financiamento (90% LTV)</span><span className="example-val">€261.000</span></div>
          <div className="example-line"><span className="example-label">Prazo</span><span className="example-val">30 anos</span></div>
          <div className="example-line"><span className="example-label">Taxa total (Euribor 2,3% + spread 0,9%)</span><span className="example-val">3,2% variável</span></div>
          <div className="example-line"><span className="example-label">Prestação mensal estimada</span><span className="example-val">~€1.130/mês</span></div>
          <div className="example-line"><span className="example-label">IMT (jovem até 35 anos · HPP)</span><span className="example-val">€0 (isento)</span></div>
          <div className="example-line"><span className="example-label">Imposto de Selo (jovem até 35 anos)</span><span className="example-val">€0 (isento)</span></div>
          <div className="example-line"><span className="example-label">Entrada necessária (10%)</span><span className="example-val">€29.000</span></div>
        </div>

        <div className="callout">
          <p><strong>Atenção DSTI:</strong> O Banco de Portugal impõe um rácio máximo de DSTI (debt service-to-income) de 35-40% para crédito habitação. Com prestação de €1.130/mês, o rendimento líquido mensal mínimo do agregado deve ser €2.825–€3.228. Rendimentos conjugados facilitam aprovação.</p>
        </div>

        <h2 className="s">Zonas Acessíveis em Lisboa e AML</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="zona-table">
            <thead>
              <tr>
                <th>Zona</th>
                <th>€/m²</th>
                <th>Comute para Lisboa Centro</th>
                <th>T2 típico</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {ZONAS_ACESSIVEIS.map(z => (
                <tr key={z.zona}>
                  <td className="zona-nm">{z.zona}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: '.78rem', whiteSpace: 'nowrap' }}>{z.pm2}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: '.72rem', color: '#c9a96e' }}>{z.commute}</td>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: '.78rem', fontWeight: 600, color: '#1c4a35', whiteSpace: 'nowrap' }}>{z.t2}</td>
                  <td className="zona-nota">{z.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="s">Documentação Necessária para o Crédito</h2>
        <p className="t">Os bancos exigem, tipicamente, o seguinte conjunto de documentos para análise do crédito habitação:</p>
        <table className="cost-table">
          <thead><tr><th>Documento</th><th>Detalhe</th></tr></thead>
          <tbody>
            <tr><td>Declaração de IRS</td><td>Últimos 3 anos + nota de liquidação</td></tr>
            <tr><td>Recibos de vencimento</td><td>Últimos 3 meses (trabalhadores por conta de outrem)</td></tr>
            <tr><td>Extractos bancários</td><td>Últimos 6 meses (conta principal)</td></tr>
            <tr><td>BI / Cartão de Cidadão</td><td>Frente e verso válidos</td></tr>
            <tr><td>NIF</td><td>Número de Identificação Fiscal</td></tr>
            <tr><td>Certidão de nascimento/casamento</td><td>Se aplicável ao estado civil</td></tr>
            <tr><td>Contrato de trabalho</td><td>Ou declaração de actividade para trabalhadores independentes</td></tr>
            <tr><td>Caderneta predial do imóvel</td><td>Fornecida pelo vendedor</td></tr>
          </tbody>
        </table>

        <h2 className="s">Processo Passo a Passo: CPCV → Escritura</h2>
        <p className="t">
          <strong>1. Pré-aprovação bancária (1–2 semanas):</strong> Antes de fazer uma oferta, obtenha uma
          carta de aprovação de princípio do banco. Fortalece a negociação e confirma o orçamento real disponível.
        </p>
        <p className="t">
          <strong>2. Oferta e CPCV (1 semana após aceitação):</strong> O CPCV (Contrato-Promessa de Compra e
          Venda) bloqueia o imóvel. Sinal típico de 10% do valor — pago por transferência bancária. Reveja
          sempre o CPCV com advogado antes de assinar.
        </p>
        <p className="t">
          <strong>3. Processo bancário (4–8 semanas):</strong> O banco encomenda avaliação do imóvel e conclui
          análise de crédito. Este é o passo mais demorado. Com pré-aprovação, o prazo reduz-se significativamente.
        </p>
        <p className="t">
          <strong>4. Escritura (dia D):</strong> Assinada em notária com o banco, o vendedor e o comprador.
          Paga IMT e Imposto de Selo antes da escritura (ou presenta isenção se aplicável). As chaves são
          entregues no mesmo dia.
        </p>

        <div className="cta-box">
          <h3>Consultores especializados em primeira habitação</h3>
          <p>Agency Group (AMI 22506) apoia compradores de primeira habitação em toda a AML. Orientação gratuita sobre apoios, zonas e financiamento.</p>
          <a href="tel:+351919948986">+351 919 948 986 · Falar com Consultor</a>
        </div>

        <p className="t" style={{ fontSize: '.78rem', color: 'rgba(14,14,13,.4)', marginTop: '24px' }}>
          Agency Group · AMI 22506 · info@agencygroup.pt · www.agencygroup.pt · +351 919 948 986
        </p>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/blog/comprar-casa-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Comprar Portugal</Link>
            <Link href="/blog/imt-impostos-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>IMT e Impostos</Link>
            <Link href="/blog/credito-habitacao-estrangeiros-portugal" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Crédito Habitação</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
