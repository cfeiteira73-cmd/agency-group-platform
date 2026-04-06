import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comprar Casa em Portugal 2026: Guia Definitivo · Agency Group',
  description: 'Guia completo para comprar casa em Portugal 2026. NIF, conta bancária, CPCV, IMT, IS, escritura. Custos reais, processo passo a passo. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/comprar-casa-portugal-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/comprar-casa-portugal-2026',
    },
  },
  openGraph: {
    title: 'Comprar Casa em Portugal 2026: O Guia Definitivo',
    description: 'NIF, CPCV, IMT, IS, escritura — o processo completo de ponta a ponta. Custos reais. O que mudou em 2026.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/comprar-casa-portugal-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Comprar Casa em Portugal 2026: Guia Definitivo',
  description: 'Guia completo para comprar casa em Portugal 2026. NIF, CPCV, IMT, IS, escritura.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-03-01',
  dateModified: '2026-03-30',
  url: 'https://www.agencygroup.pt/blog/comprar-casa-portugal-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Comprar imóvel Portugal' },
    { '@type': 'Thing', name: 'IMT Portugal 2026' },
    { '@type': 'Thing', name: 'CPCV Portugal' },
  ],
}

export default function ArticleComprarCasa() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → comprar-casa-portugal-2026
          </div>
          <div className="art-cat">Guia de Compra</div>
          <h1 className="art-h1">Comprar Casa em Portugal 2026:<br/><em>O Guia Definitivo</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>1 Março 2026</span>
            <span>·</span>
            <span>12 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal registou 169.812 transacções imobiliárias em 2025 — o recorde histórico absoluto.
          Os preços subiram +17,6% (INE Q3 2025). Lisboa está no Top 5 do luxo mundial (Savills 2026).
          Se está a pensar comprar, este guia cobre tudo: do NIF à escritura, com custos reais actualizados.
        </p>

        <h2 className="s">1. O Processo Passo a Passo</h2>
        <div className="step-grid">
          {[
            {n:'01',t:'NIF Fiscal',d:'Obtido no Serviço de Finanças ou via advogado (1-2 dias). Indispensável para qualquer transacção em Portugal.'},
            {n:'02',t:'Conta Bancária',d:'Abrir conta num banco português (Millennium BCP, Santander, Novobanco). 1-2 semanas. Necessário NIF + passaporte.'},
            {n:'03',t:'Due Diligence',d:'Verificar certidão de registo predial, caderneta predial, licença de habitação, dívidas ao condomínio. Advogado recomendado.'},
            {n:'04',t:'Proposta & Negociação',d:'Proposta por escrito com prazo (48-72h). Use o Deal Radar da Agency Group para determinar a oferta óptima.'},
            {n:'05',t:'CPCV — Sinal',d:'Contrato-promessa. Sinal típico: 10-30% do preço. Se o comprador desiste, perde o sinal. Se o vendedor desiste, devolve em dobro.'},
            {n:'06',t:'Escritura',d:'Outorgada em notário. IMT + IS pagos antes. Registo definitivo na Conservatória. Prazo médio CPCV → Escritura: 45-90 dias.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">2. Custos Reais de Aquisição</h2>
        <p className="t">Para um imóvel de €500.000 em Lisboa (habitação própria, 2026):</p>
        <table className="cost-table">
          <thead><tr><th>Custo</th><th>Taxa/Valor</th><th>Valor Estimado</th></tr></thead>
          <tbody>
            <tr><td>IMT (Imposto Municipal sobre Transmissões)</td><td>Tabela progressiva até 7,5%</td><td>€ 21.271</td></tr>
            <tr><td>IS (Imposto de Selo)</td><td>0,8% sobre o preço</td><td>€ 4.000</td></tr>
            <tr><td>Registo Predial + Notário</td><td>Fixo + variável</td><td>€ 1.200–2.000</td></tr>
            <tr><td>Advogado (recomendado)</td><td>0,5–1% do preço</td><td>€ 2.500–5.000</td></tr>
            <tr><td>Comissão Agência (do vendedor)</td><td>3–5% + IVA</td><td>€ 0 (pago pelo vendedor)</td></tr>
            <tr><td>Total custos de aquisição</td><td>~5–6% do preço</td><td>€ 28.500–32.000</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Nota IMT 2026:</strong> Residência permanente tem isenção até €97.064. Acima disso, aplica-se a tabela progressiva. Não residentes e investimento pagam a tabela completa sem isenção.</p>
        </div>

        <h2 className="s">3. IMT — Tabela 2026 Completa</h2>
        <table className="cost-table">
          <thead><tr><th>Preço</th><th>Taxa Marginal</th><th>Parcela a Abater</th></tr></thead>
          <tbody>
            <tr><td>Até €97.064</td><td>0%</td><td>€0</td></tr>
            <tr><td>€97.065 – €132.774</td><td>2%</td><td>€1.941</td></tr>
            <tr><td>€132.775 – €182.349</td><td>5%</td><td>€5.924</td></tr>
            <tr><td>€182.350 – €316.772</td><td>7%</td><td>€9.561</td></tr>
            <tr><td>€316.773 – €633.453</td><td>8%</td><td>€16.729</td></tr>
            <tr><td>€633.454 – €1.050.400</td><td>6% (taxa única)</td><td>—</td></tr>
            <tr><td>Acima de €1.050.400</td><td>7,5% (taxa única)</td><td>—</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. O CPCV em Detalhe</h2>
        <p className="t">O Contrato Promessa de Compra e Venda (CPCV) é o momento mais crítico da transacção. Define preço, prazo para escritura, e penalidades em caso de incumprimento.</p>
        <h3 className="ss">O que deve incluir o CPCV</h3>
        <p className="t">Identificação completa das partes · Identificação do imóvel (artigo matricial, descrição predial) · Preço e forma de pagamento · Valor do sinal · Prazo para escritura · Condições suspensivas (ex: aprovação de crédito) · Penalidades por incumprimento · Estado do imóvel na data da escritura.</p>

        <div className="callout">
          <p><strong>Atenção:</strong> Exija sempre que o CPCV seja revisto por advogado antes de assinar. Os €1.500–3.000 de honorários podem poupar dezenas de milhares em disputas futuras.</p>
        </div>

        <h2 className="s">5. Crédito Habitação em Portugal</h2>
        <p className="t">Residentes em Portugal (europeus e não-europeus com título de residência) têm acesso a crédito habitação nos bancos portugueses. Condições actuais (Março 2026):</p>
        <table className="cost-table">
          <thead><tr><th>Parâmetro</th><th>Habitação Própria</th><th>Investimento</th></tr></thead>
          <tbody>
            <tr><td>LTV máximo</td><td>90%</td><td>75%</td></tr>
            <tr><td>Prazo máximo</td><td>40 anos</td><td>30 anos</td></tr>
            <tr><td>Euribor 6M (Março 2026)</td><td colSpan={2}>2,95%</td></tr>
            <tr><td>Spread típico</td><td>0,9–1,5%</td><td>1,5–2,5%</td></tr>
            <tr><td>DSTI máximo (BdP)</td><td>35%</td><td>35%</td></tr>
          </tbody>
        </table>
        <p className="t">Use o nosso Simulador de Crédito na página principal para calcular a sua prestação exacta com a tabela de amortização completa.</p>

        <h2 className="s">6. Dicas Exclusivas Agency Group</h2>
        <p className="t"><strong>Deal Radar antes de qualquer oferta:</strong> A nossa ferramenta analisa 16 dimensões de qualquer imóvel e calcula o valor justo em 30 segundos. Nunca faça uma oferta sem ele.</p>
        <p className="t"><strong>Timing:</strong> O mercado português tem menos liquidez em Agosto e Janeiro. Negoceie nestes períodos — vendedores têm menos alternativas.</p>
        <p className="t"><strong>Off-Market:</strong> 30-40% das melhores oportunidades nunca chegam aos portais. A Agency Group tem acesso exclusivo a este inventário.</p>
        <p className="t"><strong>NHR/IFICI:</strong> Se vai mudar para Portugal, candidature-se ao NHR/IFICI imediatamente após estabelecer residência fiscal. Pode poupar €50.000–€500.000 em impostos nos próximos 10 anos.</p>

        <div className="cta-box">
          <h3>Pronto para começar?</h3>
          <p>AVM gratuito, Deal Radar e Simulador de Crédito disponíveis agora. Sem registo. Sem custos.</p>
          <Link href="/#avaliacao">Avaliar o meu imóvel →</Link>
        </div>
      </article>
    </>
  )
}
