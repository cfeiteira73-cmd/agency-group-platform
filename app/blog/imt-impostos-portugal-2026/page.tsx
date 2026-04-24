import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'IMT, IMI e IS em Portugal 2026: Guia de Impostos',
  description: 'Tabelas IMT 2026 completas para habitação própria e investimento. Imposto de Selo 0,8%, IMI, AIMI, retenção na fonte. Exemplos práticos com imóveis de €300K, €500K e €1M. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/imt-impostos-portugal-2026',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
      'pt': 'https://www.agencygroup.pt/blog/imt-impostos-portugal-2026',
      'x-default': 'https://www.agencygroup.pt/blog/taxes-imt-portugal-2026',
    },
  },
  openGraph: {
    title: 'IMT, IMI, IS em Portugal 2026: Guia Completo de Impostos na Compra de Imóvel',
    description: 'Tabelas IMT 2026, Imposto de Selo, IMI, AIMI e exemplos reais com €300K, €500K e €1M. Tudo o que precisa de saber antes de comprar.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/imt-impostos-portugal-2026',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=IMT%2C%20IMI%2C%20IS%20em%20Portugal%202026%3A%20Guia%20Completo%20de%20Impostos%20na&subtitle=Tabelas%20IMT%202026%2C%20Imposto%20de%20Selo%2C%20IMI%2C%20AIMI%20e%20exemplos',
      width: 1200,
      height: 630,
      alt: 'IMT, IMI, IS em Portugal 2026: Guia Completo de Impostos na Compra de Imóvel',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IMT, IMI, IS em Portugal 2026: Guia Completo de Impostos na Compra de Imóvel',
    description: 'Tabelas IMT 2026, Imposto de Selo, IMI, AIMI e exemplos reais com €300K, €500K e €1M. Tudo o que pre',
    images: ['https://www.agencygroup.pt/api/og?title=IMT%2C%20IMI%2C%20IS%20em%20Portugal%202026%3A%20Guia%20Completo%20de%20Impostos%20na&subtitle=Tabelas%20IMT%202026%2C%20Imposto%20de%20Selo%2C%20IMI%2C%20AIMI%20e%20exemplos'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'IMT, IMI, IS em Portugal 2026: Guia Completo de Impostos na Compra de Imóvel',
  description: 'Tabelas IMT 2026 completas para habitação própria e investimento. Imposto de Selo 0,8%, IMI, AIMI, retenção na fonte. Exemplos práticos com imóveis de €300K, €500K e €1M.',
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
  datePublished: '2026-03-15',
  dateModified: '2026-04-01',
  url: 'https://www.agencygroup.pt/blog/imt-impostos-portugal-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'IMT 2026' },
    { '@type': 'Thing', name: 'Imposto compra casa Portugal' },
    { '@type': 'Thing', name: 'IMI Portugal' },
    { '@type': 'Thing', name: 'Custos compra imóvel' },
  ],
}

export default function ArticleIMT() {
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
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">Início</Link> → <Link href="/blog">Blog</Link> → IMT, IMI, IS em Portugal 2026
          </div>
          <div className="art-cat">Fiscalidade Imobiliária</div>
          <h1 className="art-h1">IMT, IMI, IS em Portugal 2026:<br/><em>Guia Completo de Impostos</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>15 Março 2026</span>
            <span>·</span>
            <span>10 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Comprar um imóvel em Portugal implica pagar impostos e taxas que podem representar 6% a 10% do preço de compra.
          Conhecer exactamente o que paga — e quando — é essencial para orçamentar correctamente a aquisição.
          Este guia cobre o IMT (Imposto Municipal sobre Transmissões), o Imposto de Selo, o IMI anual, o AIMI
          e a retenção na fonte para não residentes, com exemplos reais para imóveis de €300.000, €500.000 e €1.000.000.
        </p>

        <h2 className="s">1. Os Quatro Impostos que Precisa de Conhecer</h2>
        <div className="step-grid">
          {[
            {n:'IMT',t:'Imposto Municipal sobre Transmissões',d:'Pago uma vez na compra. Progressivo para habitação própria, taxa única para investimento e não residentes. Calculado sobre o maior valor entre escritura e VPT.'},
            {n:'IS',t:'Imposto de Selo',d:'0,8% sobre o preço de compra. Adicional de 0,6% sobre o montante do crédito habitação. Pago no mesmo momento que o IMT, antes da escritura.'},
            {n:'IMI',t:'Imposto Municipal sobre Imóveis',d:'Imposto anual sobre o VPT (Valor Patrimonial Tributário). Taxa: 0,3%–0,45% urbano. Pago pelo proprietário a 30 de Abril / Maio (colecta > €500 parcelado).'},
            {n:'AIMI',t:'Adicional ao IMI',d:'Aplica-se a patrimónios imobiliários acima de €600.000 (singular) ou €1.200.000 (casal). Taxa: 0,7% até €1M, 1% até €2M, 1,5% acima. Pago em Setembro.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Tabela IMT 2026 — Habitação Própria e Permanente</h2>
        <p className="t">Para residência principal em Portugal continental. Aplica-se apenas a cidadãos que estabelecem residência efectiva no imóvel.</p>
        <table className="cost-table">
          <thead><tr><th>Escalão de Valor</th><th>Taxa Marginal</th><th>Parcela a Abater</th></tr></thead>
          <tbody>
            <tr><td>Até €97.064</td><td>0% (isento)</td><td>€ 0</td></tr>
            <tr><td>€97.065 – €132.774</td><td>2%</td><td>€ 1.941,28</td></tr>
            <tr><td>€132.775 – €182.349</td><td>5%</td><td>€ 5.924,50</td></tr>
            <tr><td>€182.350 – €316.772</td><td>7%</td><td>€ 9.560,94</td></tr>
            <tr><td>€316.773 – €633.453</td><td>8%</td><td>€ 16.727,66</td></tr>
            <tr><td>€633.454 – €1.050.400</td><td>6% (taxa única)</td><td>—</td></tr>
            <tr><td>Acima de €1.050.400</td><td>7,5% (taxa única)</td><td>—</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Atenção:</strong> A tabela acima aplica-se à habitação própria e permanente. Para imóveis de rendimento, investimento, ou compra por não residentes sem intenção de fixar residência, aplica-se a taxa de <strong>6,5%</strong> (urbano) até €92.407 isento, e depois escalonamento próprio — ou directamente <strong>7,5%</strong> acima de €1.050.400.</p>
        </div>

        <h2 className="s">3. Tabela IMT 2026 — Investimento e Não Residentes</h2>
        <table className="cost-table">
          <thead><tr><th>Escalão de Valor</th><th>Taxa Marginal</th><th>Parcela a Abater</th></tr></thead>
          <tbody>
            <tr><td>Até €92.407</td><td>1%</td><td>€ 0</td></tr>
            <tr><td>€92.408 – €126.403</td><td>2%</td><td>€ 924,07</td></tr>
            <tr><td>€126.404 – €172.348</td><td>5%</td><td>€ 4.716,14</td></tr>
            <tr><td>€172.349 – €287.213</td><td>7%</td><td>€ 9.159,06</td></tr>
            <tr><td>€287.214 – €574.323</td><td>8%</td><td>€ 12.033,19</td></tr>
            <tr><td>€574.324 – €1.050.400</td><td>6% (taxa única)</td><td>—</td></tr>
            <tr><td>Acima de €1.050.400</td><td>7,5% (taxa única)</td><td>—</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. Exemplos Práticos — Cálculo Total de Impostos</h2>
        <h3 className="ss">Imóvel €300.000 — Habitação Própria (Residente)</h3>
        <table className="cost-table">
          <thead><tr><th>Imposto / Custo</th><th>Taxa / Base</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>IMT</td><td>Tabela progressiva HPP</td><td>€ 7.234</td></tr>
            <tr><td>Imposto de Selo (compra)</td><td>0,8% × €300.000</td><td>€ 2.400</td></tr>
            <tr><td>Imposto de Selo (crédito 80%)</td><td>0,6% × €240.000</td><td>€ 1.440</td></tr>
            <tr><td>Notário + Registo</td><td>Estimativa</td><td>€ 1.500</td></tr>
            <tr><td>Total impostos e custos</td><td>~4,2% do preço</td><td>€ 12.574</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Imóvel €500.000 — Investimento ou Não Residente</h3>
        <table className="cost-table">
          <thead><tr><th>Imposto / Custo</th><th>Taxa / Base</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>IMT</td><td>Tabela progressiva investimento</td><td>€ 27.967</td></tr>
            <tr><td>Imposto de Selo (compra)</td><td>0,8% × €500.000</td><td>€ 4.000</td></tr>
            <tr><td>Notário + Registo</td><td>Estimativa</td><td>€ 1.800</td></tr>
            <tr><td>Total impostos e custos</td><td>~6,8% do preço</td><td>€ 33.767</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Imóvel €1.000.000 — Habitação Própria (Residente)</h3>
        <table className="cost-table">
          <thead><tr><th>Imposto / Custo</th><th>Taxa / Base</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>IMT</td><td>6% taxa única × €1.000.000</td><td>€ 60.000</td></tr>
            <tr><td>Imposto de Selo (compra)</td><td>0,8% × €1.000.000</td><td>€ 8.000</td></tr>
            <tr><td>Notário + Registo</td><td>Estimativa</td><td>€ 2.200</td></tr>
            <tr><td>Total impostos e custos</td><td>~7,0% do preço</td><td>€ 70.200</td></tr>
          </tbody>
        </table>

        <h2 className="s">5. IMI Anual — O Imposto que Fica Para Sempre</h2>
        <p className="t">Após a compra, o IMI é cobrado anualmente pelo município onde o imóvel está localizado. A base de cálculo é o VPT (Valor Patrimonial Tributário), que tende a ser inferior ao valor de mercado — especialmente em zonas premium.</p>
        <table className="cost-table">
          <thead><tr><th>Município</th><th>Taxa IMI Urbano</th><th>Notas</th></tr></thead>
          <tbody>
            <tr><td>Lisboa</td><td>0,3%</td><td>Mínimo legal para municípios grandes</td></tr>
            <tr><td>Cascais</td><td>0,34%</td><td>Desconto para HPP + eficiência energética</td></tr>
            <tr><td>Porto</td><td>0,33%</td><td>Isenção 3 anos HPP (rend. ≤ €153K)</td></tr>
            <tr><td>Sintra</td><td>0,35%</td><td>—</td></tr>
            <tr><td>Faro / Algarve</td><td>0,36%–0,45%</td><td>Varia por município</td></tr>
            <tr><td>Funchal (Madeira)</td><td>0,30%</td><td>—</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Isenção IMI HPP:</strong> Habitação própria e permanente com VPT até €125.000 e rendimento colectável do agregado até €153.300 beneficia de isenção permanente de IMI. Requer pedido formal nas Finanças nos 60 dias seguintes à escritura.</p>
        </div>

        <h2 className="s">6. AIMI e Retenção na Fonte para Não Residentes</h2>
        <p className="t">O AIMI incide sobre o somatório do VPT de todos os imóveis detidos em Portugal a 1 de Janeiro de cada ano. Pessoas singulares têm dedução de €600.000 (€1.200.000 para casais). Empresas não têm dedução e pagam 0,4% sobre o total.</p>
        <p className="t">Rendas pagas a não residentes estão sujeitas a retenção na fonte de 25% (IRS). Alienação de imóveis por não residentes: as mais-valias são tributadas à taxa autónoma de 28% sobre a totalidade da mais-valia (residentes incluem apenas 50% no englobamento).</p>

        <div className="cta-box">
          <h3>Calcule os seus impostos antes de comprar</h3>
          <p>A Agency Group dispõe de simuladores de IMT, IS e custos totais de aquisição. Consulta gratuita. Sem compromisso.</p>
          <a href="https://www.agencygroup.pt">Simular custos agora →</a>
        </div>
      </article>
    </>
  )
}
