import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Crédito Habitação para Estrangeiros em Portugal 2026 · Agency Group',
  description: 'O que os bancos portugueses financiam a não residentes. LTV por país, spread, documentos, Islamic Finance. Guia completo 2026.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/credito-habitacao-estrangeiros-portugal' },
  openGraph: {
    title: 'Crédito Habitação para Estrangeiros em Portugal 2026',
    description: 'LTV por país, spread, documentos, Islamic Finance e exemplos reais. Guia completo do mortgage para não residentes em Portugal.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/credito-habitacao-estrangeiros-portugal',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Crédito Habitação para Estrangeiros em Portugal 2026',
  description: 'O que os bancos portugueses financiam a não residentes. LTV por país, spread, documentos, Islamic Finance. Guia completo 2026.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-03-25',
  dateModified: '2026-04-02',
  url: 'https://www.agencygroup.pt/blog/credito-habitacao-estrangeiros-portugal',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Crédito habitação estrangeiros Portugal' },
    { '@type': 'Thing', name: 'Mortgage Portugal non-resident' },
  ],
}

export default function ArticleCreditoEstrangeiros() {
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
            <Link href="/">Início</Link> → <Link href="/blog">Blog</Link> → Crédito Estrangeiros
          </div>
          <div className="art-cat">Financiamento</div>
          <h1 className="art-h1">Crédito Habitação para <em>Estrangeiros</em><br/>em Portugal 2026</h1>
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
          Portugal aceita compradores internacionais — mas os bancos portugueses não financiam todos da mesma
          forma. A sua nacionalidade, o seu país de residência fiscal e a fonte do seu rendimento determinam
          o LTV (Loan-to-Value) que consegue, a taxa de juro praticada e os documentos exigidos. Este guia
          desmonta a realidade do crédito habitação para não residentes em 2026, com dados reais de
          Millennium BCP, Santander, BPI e Caixa Geral de Depósitos — e inclui a opção de Islamic Finance
          para compradores do Médio Oriente que necessitem de financiamento conforme a Sharia.
        </p>

        <h2 className="s">1. LTV por País de Origem — A Realidade 2026</h2>
        <p className="t">
          O Banco de Portugal impõe um DSTI máximo de 40–50% e LTV máximo de 90% para residentes em Portugal.
          Para não residentes, cada banco aplica critérios próprios com base no risco percepcionado da
          jurisdição de origem, na facilidade de verificação de rendimentos e na existência de acordos
          fiscais bilaterais com Portugal. Os quatro perfis principais:
        </p>
        <div className="step-grid">
          {[
            {n:'80%',t:'UE / CPLP',d:'Cidadãos da União Europeia, Brasil e PALOP (Angola, Moçambique, Cabo Verde) beneficiam do LTV mais favorável. Acordos fiscais robustos, SEPA e facilidade de verificação de rendimentos. Spread típico: 0,95%–1,55%.'},
            {n:'70%',t:'UK / EUA / Canadá / Austrália',d:'Pós-Brexit e convenções fiscais bilaterais permitem LTV até 70%. Exige comprovativo de rendimentos apostilado (IRS, T4, SA302). Por vezes exige reconhecimento notarial adicional. Spread típico: 1,10%–1,75%.'},
            {n:'70%',t:'Emirados / Arábia Saudita',d:'LTV até 70% com comprovativo formal de rendimento e historial bancário de 6 meses. Islamic Finance disponível via estrutura Murabaha/Ijara para compras conformes à Sharia. Spread típico: 1,20%–1,90%.'},
            {n:'60%',t:'China',d:'LTV mais conservador dado o risco cambial percepcionado. Exige documentação SAFE (State Administration of Foreign Exchange) e historial bancário alargado de 12 meses. Spread típico: 1,30%–2,00%.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Exemplo Prático — Imóvel €500.000</h2>
        <p className="t">
          Comparação da entrada necessária e prestação estimada a 25 anos para um imóvel de €500.000
          em Lisboa, por perfil de comprador não residente. Valores calculados com Euribor 6M Março 2026
          (2,95%) + spread médio do intervalo indicado:
        </p>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Perfil / País</th>
              <th>LTV</th>
              <th>Entrada + Custos (6%)</th>
              <th>Montante Financiado</th>
              <th>Prestação Mensal Est.</th>
              <th>Spread Range</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Francês / Alemão (UE)</td><td>80%</td><td>~ € 130.000</td><td>€ 400.000</td><td>~ € 2.120 / mês</td><td>0,95%–1,55%</td></tr>
            <tr><td>Britânico / Americano</td><td>70%</td><td>~ € 180.000</td><td>€ 350.000</td><td>~ € 1.855 / mês</td><td>1,10%–1,75%</td></tr>
            <tr><td>Emirados / Saudita</td><td>70%</td><td>~ € 180.000</td><td>€ 350.000</td><td>~ € 1.900 / mês</td><td>1,20%–1,90%</td></tr>
            <tr><td>Chinês</td><td>60%</td><td>~ € 230.000</td><td>€ 300.000</td><td>~ € 1.620 / mês</td><td>1,30%–2,00%</td></tr>
            <tr><td>Capital mínimo necessário (entrada + custos)</td><td>—</td><td>€ 130.000 – € 230.000</td><td>—</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>

        <h2 className="s">3. Documentos Necessários</h2>
        <h3 className="ss">Identificação e Residência</h3>
        <p className="t">
          Passaporte válido · NIF português · Comprovativo de morada no país de origem (últimos 3 meses) ·
          Autorização de residência em Portugal (se aplicável) · NIF do cônjuge (se casados em regime de
          comunhão de adquiridos).
        </p>
        <h3 className="ss">Rendimento e Capacidade Financeira</h3>
        <p className="t">
          Últimas 3 declarações de imposto (IRS, Tax Return, IRPF ou equivalente — apostiladas e traduzidas
          para PT ou EN) · Últimos 3 recibos de vencimento ou extracto de pensão ·
          Extractos bancários dos últimos 6 meses da conta principal ·
          Declaração do empregador em papel timbrado com assinatura e carimbo ·
          Capital próprio demonstrado em conta bancária portuguesa cobrindo a entrada mais os custos de
          aquisição (IMT, IS, notário — tipicamente 6–8% do preço do imóvel).
        </p>
        <h3 className="ss">Documentação do Imóvel</h3>
        <p className="t">
          Certidão permanente do registo predial (predial online) · Caderneta predial actualizada ·
          Licença de utilização · Declaração de não existência de dívidas ao condomínio ·
          Avaliação bancária (realizada pelo banco — custo €250–€500, pago pelo requerente do crédito).
        </p>

        <h2 className="s">4. Os Quatro Principais Bancos — Perfil 2026</h2>
        <table className="cost-table">
          <thead><tr><th>Banco</th><th>Pontos Fortes para Não Residentes</th><th>Spread Indicativo</th></tr></thead>
          <tbody>
            <tr><td>Millennium BCP</td><td>O mais activo com não residentes. Balcões internacionais em França, Suíça e Luxemburgo. Processo digitalizado para europeus.</td><td>0,95%–1,60%</td></tr>
            <tr><td>Santander Portugal</td><td>Forte com ibero-americanos e britânicos. Aceita rendimento em GBP e USD. Exige domiciliação de salário na conta.</td><td>1,00%–1,75%</td></tr>
            <tr><td>BPI (CaixaBank)</td><td>Grupo CaixaBank facilita processo para espanhóis e franceses. Bom para quem tem activos na Europa Continental.</td><td>0,90%–1,55%</td></tr>
            <tr><td>Caixa Geral de Depósitos</td><td>Banco público — mais conservador, mas tem processo dedicado para clientes PALOP e brasileiros com vínculos históricos.</td><td>1,05%–1,70%</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Islamic Finance disponível em Portugal.</strong> Compradores muçulmanos que necessitem de financiamento conforme a Sharia têm acesso a estruturas de <strong>Murabaha</strong> (o banco compra o imóvel e revende ao comprador com margem fixa, sem juros) e <strong>Ijara</strong> (arrendamento com opção de compra). Intermediadas por bancos islâmicos internacionais em parceria com notários e estruturas legais portuguesas. Totalmente legal e válido em Portugal. Processo demora 60–90 dias adicionais, mas elimina qualquer componente de juro — o retorno do banco é uma margem comercial transparente.</p>
        </div>

        <h2 className="s">5. Condições Gerais — Abril 2026</h2>
        <table className="cost-table">
          <thead><tr><th>Parâmetro</th><th>Residente em Portugal</th><th>Não Residente</th></tr></thead>
          <tbody>
            <tr><td>LTV máximo</td><td>90%</td><td>60%–80% (por país)</td></tr>
            <tr><td>Prazo máximo</td><td>40 anos</td><td>30 anos</td></tr>
            <tr><td>Euribor 6M (Março 2026)</td><td colSpan={2}>2,95%</td></tr>
            <tr><td>Spread típico</td><td>0,90%–1,50%</td><td>1,00%–2,00%</td></tr>
            <tr><td>DSTI máximo (Banco de Portugal)</td><td>40%–50%</td><td>40%–50% sobre rendimento líquido</td></tr>
            <tr><td>Prazo médio de aprovação</td><td>15–30 dias úteis</td><td>45–90 dias úteis</td></tr>
          </tbody>
        </table>

        <h2 className="s">6. Dicas para Maximizar a Aprovação</h2>
        <p className="t">
          <strong>Abra conta bancária portuguesa com antecedência.</strong> Ter conta activa há 6+ meses
          antes de pedir o crédito demonstra estabilidade e facilita a análise de risco. Transfira
          regularmente ao longo desse período o montante previsto para a entrada, criando historial.
        </p>
        <p className="t">
          <strong>Pré-aprovação antes de assinar o CPCV.</strong> Nunca assine um contrato-promessa sem
          pré-aprovação bancária confirmada por escrito. A condição suspensiva de financiamento deve
          constar explicitamente do CPCV — caso contrário, arrisca perder o sinal se o banco recusar.
        </p>
        <p className="t">
          <strong>Documentação apostilada com antecedência.</strong> Tax returns, extractos de pensão e
          declarações de empregador exigem apostila e tradução juramentada — processo que pode demorar
          2–6 semanas consoante o país. Comece antes de identificar o imóvel específico.
        </p>
        <p className="t">
          <strong>Considere um intermediário de crédito especializado.</strong> Um broker com experiência
          em não residentes apresenta o processo a vários bancos em simultâneo, conhece os critérios
          específicos de cada instituição e aumenta a probabilidade de aprovação — sem custo para o
          comprador, pois a comissão é paga pelo banco aprovador.
        </p>

        <div className="cta-box">
          <h3>Quer saber exactamente o que consegue financiar?</h3>
          <p>A Agency Group trabalha com todos os principais bancos portugueses e intermediários de crédito especializados em não residentes. Simulação personalizada — resultado em 48 horas.</p>
          <Link href="/#credito">Simular Crédito Habitação →</Link>
        </div>
      </article>
    </>
  )
}
