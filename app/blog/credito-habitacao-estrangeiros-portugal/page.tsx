import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Crédito Habitação para Estrangeiros em Portugal 2026 · Agency Group',
  description: 'O que os bancos portugueses financiam a não residentes. LTV por país (60-80%), documentos, spread, Islamic Finance. Guia completo 2026.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/credito-habitacao-estrangeiros-portugal' },
  openGraph: {
    title: 'Crédito Habitação para Estrangeiros em Portugal 2026',
    description: 'O que os bancos portugueses financiam a não residentes. LTV por país (60-80%), documentos, spread, Islamic Finance. Guia completo 2026.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/credito-habitacao-estrangeiros-portugal',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Crédito Habitação para Estrangeiros em Portugal 2026',
  description: 'O que os bancos portugueses financiam a não residentes. LTV por país (60-80%), documentos, spread, Islamic Finance. Guia completo 2026.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-03-25',
  dateModified: '2026-03-25',
  url: 'https://www.agencygroup.pt/blog/credito-habitacao-estrangeiros-portugal',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Crédito habitação estrangeiros Portugal' },
    { '@type': 'Thing', name: 'Mortgage Portugal non-resident' },
    { '@type': 'Thing', name: 'Financiamento imobiliário Portugal 2026' },
  ],
}

export default function ArticleCreditoHabitacao() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → credito-habitacao-estrangeiros-portugal
          </div>
          <div className="art-cat">Financiamento Internacional</div>
          <h1 className="art-h1">Crédito Habitação para <em>Estrangeiros</em> em Portugal 2026</h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>25 Março 2026</span>
            <span>·</span>
            <span>10 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal é um dos mercados mais abertos da Europa para compradores internacionais — e os bancos
          portugueses financiam não residentes. Mas as condições variam significativamente consoante a
          nacionalidade, o país de residência fiscal e a origem do rendimento. LTV entre 60% e 80%,
          spreads de 0,85% a 1,8%, Islamic Finance disponível para o Médio Oriente. Este guia cobre
          tudo o que precisa saber para obter aprovação de crédito habitação em Portugal como estrangeiro.
        </p>

        <h2 className="s">1. LTV por País de Origem</h2>
        <p className="t">Os bancos portugueses segmentam os compradores internacionais por perfil de risco. A sua origem determina o máximo que consegue financiar:</p>
        <div className="step-grid">
          {[
            {n:'🇫🇷🇩🇪🇧🇷',t:'UE / CPLP',d:'LTV até 80% · Spread 0,85–1,25% · Processo mais simples. Inclui franceses, alemães, espanhóis, italianos, brasileiros e demais cidadãos CPLP.'},
            {n:'🇬🇧🇺🇸🇨🇦🇦🇺',t:'Anglo-Saxónico',d:'LTV até 70% · Spread 1,0–1,5% · Prova de rendimentos UK/US obrigatória. Documentação adicional pós-Brexit para britânicos.'},
            {n:'🇦🇪🇸🇦',t:'Médio Oriente',d:'LTV até 70% · Islamic Finance disponível · Estruturas Murabaha/Ijara compatíveis com Sharia. A Agency Group tem parcerias com especialistas nesta área.'},
            {n:'🇨🇳',t:'China',d:'LTV até 60% · Spread 1,25–1,8% · Apoio em transferências internacionais necessário. Documentação SAFE requerida pelos bancos portugueses.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Simulação — Imóvel €500K, Comprador Americano (LTV 70%)</h2>
        <table className="cost-table">
          <thead><tr><th>Item</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>Valor do Imóvel</td><td>€500.000</td></tr>
            <tr><td>LTV Máximo</td><td>70%</td></tr>
            <tr><td>Capital Financiado</td><td>€350.000</td></tr>
            <tr><td>Entrada Necessária</td><td>€150.000</td></tr>
            <tr><td>Spread Típico</td><td>1,25%</td></tr>
            <tr><td>Euribor 6M (Mar 2026)</td><td>2,95%</td></tr>
            <tr><td>TAN</td><td>≈ 4,20%</td></tr>
            <tr><td>Prazo</td><td>25 anos</td></tr>
            <tr><td>Prestação Estimada</td><td>≈ €1.880/mês</td></tr>
            <tr><td>IMT + IS + Custos</td><td>≈ €35.000</td></tr>
            <tr><td>Custo Total Aquisição</td><td>≈ €535.000</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Islamic Finance:</strong> Para compradores do Médio Oriente, os bancos portugueses oferecem estruturas <strong>Murabaha</strong> e <strong>Ijara</strong> compatíveis com a Sharia. A Agency Group tem parcerias com especialistas nesta área.</p>
        </div>

        <h2 className="s">3. Documentos Necessários</h2>
        <p className="t">Passaporte válido · NIF português · Últimos 3 recibos de vencimento ou declaração fiscal · Extractos bancários 6 meses · Contrato de trabalho ou prova de rendimentos · Se aplicável: declaração de IR do país de origem (apostilada e traduzida) · Comprovativo de capital próprio em conta bancária portuguesa.</p>

        <h2 className="s">4. Bancos que Financiam Não Residentes</h2>
        <p className="t"><strong>Millennium BCP</strong> — o mais flexível para compradores internacionais. Tem balcões em França, Suíça e Luxemburgo e processo digital para europeus. Primeiro banco a contactar para perfis UE e CPLP.</p>
        <p className="t"><strong>Santander Portugal</strong> — forte em clientes europeus e ibero-americanos. Aceita rendimento em GBP e USD. Exige conta Santander com domiciliação de ordenado.</p>
        <p className="t"><strong>BPI</strong> — parceiro preferencial para clientes com ligação ao grupo CaixaBank (Espanha). Bom processo para franceses, espanhóis e perfis de Europa Continental.</p>
        <p className="t"><strong>Caixa Geral de Depósitos</strong> — banco público, mais conservador com não residentes em geral, mas tem processo dedicado para habitação própria e clientes dos países de língua portuguesa.</p>

        <h2 className="s">5. Prazo e Processo</h2>
        <p className="t">O processo de aprovação de crédito para não residentes tem tipicamente quatro fases: <strong>Proposta inicial</strong> (análise preliminar, 1 semana) → <strong>Avaliação bancária</strong> do imóvel (2–3 semanas) → <strong>Aprovação formal</strong> (1–2 semanas) → <strong>Escritura</strong>. Total: 45 a 90 dias desde a proposta ao vendedor.</p>
        <p className="t">É fundamental ter o NIF português e conta bancária aberta em Portugal antes de avançar com o processo de crédito. Estes passos podem ser feitos em paralelo com a procura do imóvel.</p>

        <h2 className="s">6. Dicas para Aprovação</h2>
        <p className="t"><strong>Rendimentos documentados:</strong> Os bancos exigem prova formal de rendimento. Fontes informais, freelancing não declarado ou rendimentos de países com acordos fiscais limitados complicam o processo — e reduzem o LTV aprovado.</p>
        <p className="t"><strong>DSTI máximo 40–50%:</strong> O Banco de Portugal impõe que a prestação mensal não ultrapasse 35–40% do rendimento líquido. Calcule antecipadamente se os seus rendimentos suportam a prestação desejada.</p>
        <p className="t"><strong>Evitar dívidas no país de origem:</strong> Créditos automóvel, crédito pessoal ou hipotecas noutros países reduzem o DSTI disponível em Portugal e podem inviabilizar a aprovação.</p>
        <p className="t"><strong>Conta bancária portuguesa aberta antes:</strong> Abrir conta em Portugal antes de submeter o pedido de crédito acelera o processo e demonstra organização financeira. O Millennium BCP tem processo digital para abertura remota.</p>

        <div className="cta-box">
          <h3>Calcule o Seu Crédito em Portugal</h3>
          <p>Ferramenta gratuita — LTV, prestação e documentação necessária para o seu país de origem.</p>
          <Link href="https://www.agencygroup.pt">Calcular Agora →</Link>
        </div>
      </article>
    </>
  )
}
