import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mais-Valias Imobiliárias Portugal 2026: Calcular e Poupar',
  description: 'Como calcular as mais-valias na venda de imóvel em Portugal. Coeficientes AT 2026, isenção HPP, reinvestimento, taxa 28% não residentes. CIRS actualizado.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026',
    },
  },
  openGraph: {
    title: 'Mais-Valias Imobiliárias Portugal 2026: Calcular e Poupar',
    description: 'Fórmula CIRS, coeficientes AT 2026, isenção HPP, reinvestimento e taxa 28% para não residentes. Guia completo com exemplos práticos.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Mais-Valias Imobiliárias Portugal 2026: Calcular e Poupar',
  description: 'Como calcular as mais-valias na venda de imóvel em Portugal. Coeficientes AT 2026, isenção HPP, reinvestimento, taxa 28% não residentes. CIRS actualizado.',
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
  dateModified: '2026-04-02',
  url: 'https://www.agencygroup.pt/blog/mais-valias-imoveis-portugal-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Mais-valias imobiliárias Portugal' },
    { '@type': 'Thing', name: 'Impostos venda casa Portugal' },
  ],
}

export default function ArticleMaisValias() {
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
            <Link href="/">Início</Link> → <Link href="/blog">Blog</Link> → Mais-Valias Imobiliárias
          </div>
          <div className="art-cat">Fiscalidade Imobiliária</div>
          <h1 className="art-h1">Mais-Valias Imobiliárias <em>Portugal 2026</em></h1>
          <div className="art-meta">
            <span>10 min leitura</span>
            <span>·</span>
            <span>Actualizado Abril 2026</span>
            <span>·</span>
            <span>AMI 22506</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Quando vende um imóvel em Portugal por valor superior ao de compra, a diferença está sujeita a IRS.
          Mas o Código do IRS (CIRS) prevê mecanismos que reduzem significativamente — ou eliminam — a carga
          fiscal: coeficientes de desvalorização monetária que corrigem o valor de compra pela inflação
          acumulada, isenção total para habitação própria permanente com reinvestimento, e uma taxa especialmente
          favorável para residentes que optam pelo englobamento. Neste guia explicamos a fórmula completa,
          os coeficientes AT actualizados para 2026, as isenções disponíveis e como calcular o imposto
          antes de assinar qualquer escritura de venda.
        </p>

        <h2 className="s">1. A Fórmula CIRS — Os 4 Passos do Cálculo</h2>
        <div className="step-grid">
          {[
            {n:'01',t:'Ganho Bruto = Venda − (Compra × Coef AT)',d:'O valor de compra é corrigido pelo coeficiente de desvalorização monetária da AT (publicado anualmente em Portaria). A correcção reduz o ganho tributável — quanto mais antigo o imóvel, maior o benefício.'},
            {n:'02',t:'Deduções',d:'Do ganho bruto deduzem-se: IMT e IS pagos na compra, custos de obras documentadas com factura, comissão de agência com recibo, custos de notário e registo na compra e na venda, e certificação energética.'},
            {n:'03',t:'Ganho Tributável — 50% para Residentes',d:'Residentes fiscais em Portugal tributam apenas 50% do ganho bruto líquido (após deduções). Não residentes tributam 100%. Esta diferença pode representar dezenas de milhares de euros de imposto.'},
            {n:'04',t:'Imposto: 28% (NR) ou Tabela IRS (Residente)',d:'Não residentes pagam 28% sobre 100% do ganho. Residentes podem optar pelo englobamento (tabela IRS progressiva 14,5%–48% sobre 50% do ganho) ou pela taxa autónoma de 28% sobre 50% do ganho.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Coeficientes de Desvalorização Monetária AT — 2026</h2>
        <p className="t">
          A Portaria publicada anualmente pela Autoridade Tributária define os coeficientes que corrigem
          o valor de aquisição pela inflação acumulada. Aplicam-se a imóveis adquiridos há mais de 24 meses.
          Quanto mais antigo o imóvel, maior a correcção e menor o ganho tributável:
        </p>
        <table className="cost-table">
          <thead><tr><th>Ano de Aquisição</th><th>Coeficiente AT 2026</th><th>Efeito Prático</th></tr></thead>
          <tbody>
            <tr><td>2024 – 2025</td><td>1,00</td><td>Sem correcção (menos de 24 meses)</td></tr>
            <tr><td>2022 – 2023</td><td>1,07</td><td>Base sobe 7%</td></tr>
            <tr><td>2020 – 2021</td><td>1,12</td><td>Base sobe 12%</td></tr>
            <tr><td>2018 – 2019</td><td>1,18</td><td>Base sobe 18%</td></tr>
            <tr><td>2015 – 2017</td><td>1,27</td><td>Base sobe 27%</td></tr>
            <tr><td>2010 – 2014</td><td>1,38</td><td>Base sobe 38%</td></tr>
            <tr><td>2005 – 2009</td><td>1,52</td><td>Base sobe 52%</td></tr>
            <tr><td>2000 – 2004</td><td>1,72</td><td>Base sobe 72%</td></tr>
            <tr><td>1995 – 1999</td><td>2,01</td><td>Base duplica</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. Exemplo Prático Completo</h2>
        <p className="t">
          Imóvel comprado em 2015 por €200.000, vendido em 2026 por €380.000.
          Coeficiente AT 2026 para 2015: 1,37. Despesas e obras documentadas: €25.000.
        </p>
        <table className="cost-table">
          <thead><tr><th>Passo</th><th>Cálculo</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>Valor de venda</td><td>—</td><td>€ 380.000</td></tr>
            <tr><td>Valor de compra corrigido</td><td>€ 200.000 × 1,37</td><td>€ 274.000</td></tr>
            <tr><td>Ganho bruto antes de deduções</td><td>€ 380.000 − € 274.000</td><td>€ 106.000</td></tr>
            <tr><td>Deduções (obras + custos)</td><td>Facturas documentadas</td><td>− € 25.000</td></tr>
            <tr><td>Ganho bruto líquido</td><td>€ 106.000 − € 25.000</td><td>€ 81.000</td></tr>
            <tr><td>Base tributável — Residente (50%)</td><td>€ 81.000 × 50%</td><td>€ 40.500</td></tr>
            <tr><td>Imposto estimado — Residente (escalão ~45%)</td><td>€ 40.500 × ~45%</td><td>~ € 18.225</td></tr>
            <tr><td>Base tributável — Não Residente (100%)</td><td>€ 81.000 × 100%</td><td>€ 81.000</td></tr>
            <tr><td>Imposto — Não Residente (28% taxa autónoma)</td><td>€ 81.000 × 28%</td><td>~ € 22.680</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Isenção HPP — Art. 10º/5 CIRS:</strong> Vende habitação própria permanente e reinveste noutra HPP em Portugal, UE ou EEA? <strong>Isenção total de impostos sobre as mais-valias.</strong> Condições: o imóvel vendido deve ser a HPP do vendedor há pelo menos 24 meses; o produto da venda deve ser reinvestido na compra de nova HPP no prazo de 36 meses após a venda (ou 24 meses antes); o vendedor não pode ter beneficiado desta isenção nos 3 anos anteriores. Reinvestimento parcial: isenção proporcional.</p>
        </div>

        <h2 className="s">4. Isenções Disponíveis em 2026</h2>
        <h3 className="ss">Isenção HPP com Reinvestimento</h3>
        <p className="t">
          A principal isenção do CIRS para venda de imóveis. Aplica-se à alienação da habitação própria e
          permanente com reinvestimento do produto da venda noutra HPP. O reinvestimento pode ser total
          (isenção total) ou parcial (isenção proporcional ao valor reinvestido). Válida para residentes
          fiscais em Portugal — não residentes não têm acesso a esta isenção pela regra geral.
        </p>
        <h3 className="ss">Isenção por Prejuízo</h3>
        <p className="t">
          Se a venda originar menos-valia (vende por valor inferior à base de custo corrigida), não há
          imposto. A menos-valia pode ainda ser deduzida a mais-valias de outros imóveis no mesmo ano
          fiscal — ou reportada para os 5 anos seguintes.
        </p>
        <h3 className="ss">Isenção para Imóveis Adquiridos antes de 1989</h3>
        <p className="t">
          Imóveis adquiridos antes de 1 de Janeiro de 1989 (entrada em vigor do CIRS) estão totalmente
          isentos de mais-valias — independentemente do ganho realizado. Esta isenção é particularmente
          relevante para heranças ou imóveis familiares antigos.
        </p>

        <h2 className="s">5. Residente vs. Não Residente — Diferença Crítica</h2>
        <table className="cost-table">
          <thead><tr><th>Parâmetro</th><th>Residente Fiscal Portugal</th><th>Não Residente</th></tr></thead>
          <tbody>
            <tr><td>Base tributável</td><td>50% do ganho bruto líquido</td><td>100% do ganho bruto líquido</td></tr>
            <tr><td>Taxa aplicável</td><td>Englobamento (tabela IRS 14,5%–48%) ou 28% autónoma</td><td>Taxa autónoma de 28%</td></tr>
            <tr><td>Isenção HPP (Art. 10º/5)</td><td>Disponível com reinvestimento</td><td>Não disponível (regra geral)</td></tr>
            <tr><td>Coeficiente de desvalorização AT</td><td>Aplica-se</td><td>Aplica-se</td></tr>
            <tr><td>Encargos dedutíveis</td><td>Todos os documentados</td><td>Todos os documentados</td></tr>
            <tr><td>Imposto no exemplo €81K de ganho</td><td>~ € 18.225</td><td>~ € 22.680</td></tr>
          </tbody>
        </table>

        <h2 className="s">6. Como Reduzir o Imposto</h2>
        <p className="t">
          <strong>Documente todas as obras com factura.</strong> Cada euro de obra documentada deduz
          directamente ao ganho tributável. A diferença entre obras sem factura e obras com factura pode
          representar €5.000–€20.000 de imposto adicional a pagar. Exija sempre factura com NIF do
          prestador de serviços.
        </p>
        <p className="t">
          <strong>Inclua todos os custos de transacção.</strong> IMT e IS pagos na compra, comissão de
          agência na venda (com recibo), custos de notário e registo em ambas as transacções, certidão
          energética — todos são dedutíveis. Reúna os documentos de ambas as transacções antes de
          declarar à AT.
        </p>
        <p className="t">
          <strong>Avalie o reinvestimento antes de vender.</strong> Se a intenção é comprar outra
          habitação própria em Portugal, UE ou EEA, o planeamento antecipado do reinvestimento pode
          resultar em isenção total. O prazo é de 36 meses após a venda — mas pode reinvestir até
          24 meses antes da venda, contando retroactivamente.
        </p>
        <p className="t">
          <strong>Não residentes: avalie a residência fiscal.</strong> Estabelecer residência fiscal em
          Portugal antes da venda divide imediatamente a base tributável por 2 (de 100% para 50%).
          Combinado com o NHR/IFICI, os benefícios podem ser ainda mais expressivos. Consulte sempre
          um advogado fiscal especializado antes de tomar esta decisão.
        </p>

        <div className="cta-box">
          <h3>Vai vender um imóvel em Portugal?</h3>
          <p>A Agency Group estima as suas mais-valias, identifica todas as isenções aplicáveis e coordena com advogado fiscal para optimizar a sua posição. Consulta gratuita.</p>
          <Link href="/#contacto">Calcular as Minhas Mais-Valias →</Link>
        </div>
      </article>
    </>
  )
}
