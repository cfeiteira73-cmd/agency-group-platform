import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mais-Valias Imobiliárias Portugal 2026: Calcular e Poupar · Agency Group',
  description: 'Como calcular as mais-valias na venda de imóvel em Portugal. Coeficientes AT 2026, isenção HPP, reinvestimento, taxa 28% não residentes.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026' },
  openGraph: {
    title: 'Mais-Valias Imobiliárias Portugal 2026: Calcular e Poupar',
    description: 'Coeficientes AT 2026, isenção HPP, reinvestimento, taxa 28% não residentes. Guia completo com simulação linha a linha.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Mais-Valias Imobiliárias Portugal 2026: Calcular e Poupar',
  description: 'Como calcular as mais-valias na venda de imóvel em Portugal. Coeficientes AT 2026, isenção HPP, reinvestimento, taxa 28% não residentes.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-01',
  dateModified: '2026-04-01',
  url: 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Mais-valias imobiliárias Portugal' },
    { '@type': 'Thing', name: 'Impostos venda casa Portugal 2026' },
    { '@type': 'Thing', name: 'CIRS Art. 10 isenção HPP' },
  ],
}

export default function ArticleMaisValias() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(ARTICLE_SCHEMA)}}/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Jost',sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:'Cormorant',serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .art-hero{padding:140px 0 80px;background:#0c1f15;position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 10% 85%,rgba(28,74,53,.6),transparent)}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-breadcrumb{font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.5);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.5);text-decoration:none}
        .art-breadcrumb a:hover{color:#c9a96e}
        .art-cat{display:inline-block;background:#1c4a35;color:#c9a96e;font-family:'DM Mono',monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:'Cormorant',serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:'DM Mono',monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(244,240,230,.35)}
        .art-content{max-width:860px;margin:0 auto;padding:72px 56px;background:#f4f0e6}
        .art-lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2.s{font-family:'Cormorant',serif;font-weight:300;font-size:1.7rem;color:#1c4a35;margin:48px 0 20px;letter-spacing:.02em}
        h3.ss{font-family:'Jost',sans-serif;font-weight:500;font-size:.9rem;letter-spacing:.08em;color:#0e0e0d;margin:32px 0 12px;text-transform:uppercase}
        p.t{font-size:.9rem;line-height:1.88;color:rgba(14,14,13,.65);margin-bottom:20px}
        .step-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin:32px 0}
        .step-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:28px}
        .step-n{font-family:'Cormorant',serif;font-size:2.5rem;font-weight:300;color:rgba(28,74,53,.15);line-height:1;margin-bottom:12px}
        .step-t{font-family:'Jost',sans-serif;font-weight:500;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#1c4a35;margin-bottom:8px}
        .step-d{font-size:.83rem;line-height:1.75;color:rgba(14,14,13,.6)}
        .cost-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.85rem}
        .cost-table th{background:#1c4a35;color:#f4f0e6;padding:12px 16px;text-align:left;font-family:'DM Mono',monospace;font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;font-weight:400}
        .cost-table td{padding:12px 16px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7)}
        .cost-table tr:last-child td{border-bottom:none;font-weight:600;color:#1c4a35;background:rgba(28,74,53,.04)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:'Cormorant',serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:'DM Mono',monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → mais-valias-imoveis-portugal-2026
          </div>
          <div className="art-cat">Fiscalidade Imobiliária</div>
          <h1 className="art-h1">Mais-Valias Imobiliárias <em>Portugal 2026</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>1 Abril 2026</span>
            <span>·</span>
            <span>10 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Quando vende um imóvel em Portugal, o fisco pode reclamar uma fatia significativa do seu ganho.
          As mais-valias imobiliárias são tributadas ao abrigo do Art. 10.º do CIRS — mas a forma como
          o imposto é calculado, e as isenções disponíveis, dependem muito do seu perfil: residente ou não
          residente, habitação própria permanente ou investimento. Este guia explica o cálculo completo,
          com os coeficientes AT 2026 actualizados e as estratégias legais para minimizar o imposto.
        </p>

        <h2 className="s">1. Como se Calcula a Mais-Valia</h2>
        <p className="t">O cálculo segue quatro passos obrigatórios, aplicados por esta ordem:</p>
        <div className="step-grid">
          {[
            {n:'01',t:'Ganho Bruto',d:'Preço Venda − (Preço Compra × Coeficiente AT 2026). O coeficiente corrige a inflação e desvalorização da moeda desde a data de aquisição.'},
            {n:'02',t:'Deduções Legais',d:'Despesas de compra + venda + obras com factura emitida nos últimos 12 anos. Incluem IMT, IS, notário, comissão de agência e melhorias documentadas.'},
            {n:'03',t:'Ganho Tributável',d:'Residentes: apenas 50% do ganho líquido entra no IRS (Art. 43.º CIRS). Não residentes: 100% do ganho líquido é tributado.'},
            {n:'04',t:'Imposto Final',d:'Residentes: o ganho tributável soma-se aos restantes rendimentos e aplica-se a tabela IRS progressiva. Não residentes: taxa liberatória fixa de 28%.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Simulação Completa — Exemplo Real</h2>
        <p className="t">Imóvel comprado em 2015 por €200.000, vendido em 2026 por €380.000 (não HPP):</p>
        <table className="cost-table">
          <thead><tr><th>Item</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>Preço Venda</td><td>€380.000</td></tr>
            <tr><td>Coef. AT 2015</td><td>1,37</td></tr>
            <tr><td>Preço Compra Corrigido</td><td>€274.000</td></tr>
            <tr><td>Ganho Bruto</td><td>€106.000</td></tr>
            <tr><td>Despesas Compra+Venda</td><td>−€25.000</td></tr>
            <tr><td>Ganho Líquido</td><td>€81.000</td></tr>
            <tr><td>Ganho Tributável (Residente 50%)</td><td>€40.500</td></tr>
            <tr><td>Imposto Estimado (Residente)</td><td>≈ €9.000</td></tr>
            <tr><td>Ganho Tributável (Não Residente 100%)</td><td>€81.000</td></tr>
            <tr><td>Imposto Estimado (NR 28%)</td><td>≈ €22.680</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Isenção Total HPP:</strong> Se vender a sua habitação própria permanente e reinvestir o produto noutra HPP em Portugal ou UE nos 36 meses seguintes, pode ter <strong>isenção total de mais-valias</strong> (Art. 10.º/5 CIRS). Esta é a mais poderosa optimização fiscal disponível para particulares.</p>
        </div>

        <h2 className="s">3. Coeficientes de Desvalorização AT 2026</h2>
        <p className="t">A Autoridade Tributária publica anualmente os coeficientes de desvalorização da moeda. Quanto mais antigo o imóvel, maior o coeficiente — e menor o ganho tributável. Os valores para 2026:</p>
        <table className="cost-table">
          <thead><tr><th>Ano de Aquisição</th><th>Coeficiente AT 2026</th></tr></thead>
          <tbody>
            <tr><td>2000–2001</td><td>1,64–1,59</td></tr>
            <tr><td>2002–2003</td><td>1,55–1,52</td></tr>
            <tr><td>2004–2005</td><td>1,48–1,44</td></tr>
            <tr><td>2006–2007</td><td>1,40–1,37</td></tr>
            <tr><td>2008–2009</td><td>1,32–1,29</td></tr>
            <tr><td>2010</td><td>1,26</td></tr>
            <tr><td>2011–2012</td><td>1,23–1,20</td></tr>
            <tr><td>2013–2014</td><td>1,17–1,15</td></tr>
            <tr><td>2015</td><td>1,13</td></tr>
            <tr><td>2016–2017</td><td>1,11–1,09</td></tr>
            <tr><td>2018–2019</td><td>1,07–1,06</td></tr>
            <tr><td>2020</td><td>1,05</td></tr>
            <tr><td>2021–2022</td><td>1,04–1,03</td></tr>
            <tr><td>2023–2024</td><td>1,02–1,01</td></tr>
            <tr><td>2025</td><td>1,00</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. Isenções e Reduções Fiscais</h2>
        <p className="t"><strong>Isenção HPP (Art. 10.º/5 CIRS):</strong> A mais relevante. Se vender a sua habitação própria permanente e reinvestir na compra de outra HPP em Portugal, na UE ou no Espaço Económico Europeu, dentro de 36 meses após a venda (ou 24 meses antes), está isento de mais-valias na totalidade. O reinvestimento pode ser parcial — a isenção é proporcional.</p>
        <p className="t"><strong>Menos-valia (prejuízo):</strong> Se o preço de venda for inferior ao preço de compra corrigido, o resultado é €0 de imposto. As menos-valias imobiliárias não são dedutíveis a outros rendimentos.</p>
        <p className="t"><strong>Heranças e doações:</strong> A transmissão por herança ou doação não gera mais-valias no momento da transmissão. O herdeiro assume o valor matricial na data de aquisição — e só paga mais-valias quando vender.</p>
        <p className="t"><strong>Imóveis adquiridos antes de 1989:</strong> Estão totalmente isentos de mais-valias, independentemente do ganho obtido.</p>

        <h2 className="s">5. Residentes vs Não Residentes</h2>
        <p className="t">A diferença de tratamento fiscal entre residentes e não residentes em Portugal é substancial e deve ser conhecida antes de qualquer decisão:</p>
        <table className="cost-table">
          <thead><tr><th>Critério</th><th>Residente Fiscal PT</th><th>Não Residente</th></tr></thead>
          <tbody>
            <tr><td>Base tributável</td><td>50% do ganho líquido</td><td>100% do ganho líquido</td></tr>
            <tr><td>Taxa aplicável</td><td>Tabela progressiva IRS</td><td>28% taxa liberatória</td></tr>
            <tr><td>Isenção HPP</td><td>Sim (Art. 10.º/5)</td><td>Não (salvo UE/EEE residentes)</td></tr>
            <tr><td>NHR/IFICI</td><td>Potencial isenção adicional</td><td>Não aplicável</td></tr>
            <tr><td>Imposto efectivo típico</td><td>5–15% do ganho</td><td>28% do ganho líquido total</td></tr>
          </tbody>
        </table>
        <p className="t">Cidadãos da UE e do EEE não residentes podem optar por ser tributados como residentes (taxas progressivas + 50%), o que em muitos casos resulta em imposto mais baixo do que os 28% fixos.</p>

        <h2 className="s">6. Como Minimizar o Imposto Legalmente</h2>
        <p className="t"><strong>Obras documentadas:</strong> Todas as obras realizadas nos últimos 12 anos com factura em nome do proprietário são dedutíveis. Guarde sempre facturas de remodelações, ar condicionado, cozinha, casas de banho e outros melhoramentos.</p>
        <p className="t"><strong>Despesas de compra e venda:</strong> IMT, Imposto de Selo, honorários de advogado, comissão da agência imobiliária (da venda), custos de notário e registo — tudo dedutível ao ganho bruto. Guarde todos os recibos desde a aquisição.</p>
        <p className="t"><strong>Reinvestimento HPP:</strong> Se o imóvel é a sua habitação principal, planeie antecipadamente o reinvestimento. Os 36 meses dão margem considerável para encontrar o próximo imóvel sem pressão fiscal.</p>
        <p className="t"><strong>Estabelecer residência fiscal em Portugal:</strong> Para compradores internacionais com imóveis em Portugal, tornar-se residente fiscal (e beneficiar do NHR/IFICI) pode reduzir o imposto de 28% para 5–15%. Consulte um advogado fiscal antes de vender.</p>

        <div className="cta-box">
          <h3>Calcule as Suas Mais-Valias</h3>
          <p>Use o nosso simulador gratuito — coeficientes AT 2026, isenções automáticas, breakdown linha a linha.</p>
          <Link href="https://www.agencygroup.pt/#mais-valias">Simular Agora →</Link>
        </div>
      </article>
    </>
  )
}
