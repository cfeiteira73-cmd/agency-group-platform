import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'NHR vs IFICI 2024: Guia Completo para Estrangeiros em Portugal · Agency Group',
  description: 'NHR clássico vs IFICI 2024 — diferenças, elegibilidade, poupança fiscal. Como se candidatar. Comparação com UK, EUA, França. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/nhr-ifici-guia-completo',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
      'pt': 'https://www.agencygroup.pt/blog/nhr-ifici-guia-completo',
      'x-default': 'https://www.agencygroup.pt/blog/nhr-portugal-2026-guide',
    },
  },
  openGraph: {
    title: 'NHR vs IFICI 2024: Guia Completo',
    description: '10 anos de tributação reduzida. Processo, elegibilidade, comparação internacional.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/nhr-ifici-guia-completo',
  },
}

export default function ArticleNHR() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: 'NHR vs IFICI 2024: Guia Completo para Estrangeiros em Portugal',
        author: { '@type': 'Organization', name: 'Agency Group' },
        publisher: { '@type': 'Organization', name: 'Agency Group' },
        datePublished: '2026-02-15', dateModified: '2026-03-30',
        url: 'https://www.agencygroup.pt/blog/nhr-ifici-guia-completo',
        inLanguage: 'pt-PT',
      })}}/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .art-hero{padding:140px 0 80px;background:linear-gradient(135deg,#2e1f08,#0c1f15);position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 50% 80% at 10% 85%,rgba(201,169,110,.15),transparent)}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-breadcrumb{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;color:rgba(201,169,110,.4);margin-bottom:20px}
        .art-breadcrumb a{color:rgba(201,169,110,.4);text-decoration:none}
        .art-cat{display:inline-block;background:rgba(201,169,110,.15);border:1px solid rgba(201,169,110,.3);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(244,240,230,.3)}
        .art-content{max-width:860px;margin:0 auto;padding:72px 56px}
        .art-lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2.s{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.7rem;color:#1c4a35;margin:48px 0 20px}
        h3.ss{font-family:var(--font-jost),sans-serif;font-weight:500;font-size:.85rem;letter-spacing:.1em;color:#0e0e0d;margin:28px 0 10px;text-transform:uppercase}
        p.t{font-size:.9rem;line-height:1.88;color:rgba(14,14,13,.65);margin-bottom:20px}
        .compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}
        .compare-card{padding:28px;border:1px solid rgba(14,14,13,.1)}
        .compare-card.nhr{background:#1c4a35;border-color:#1c4a35}
        .compare-card.ifici{background:#f4f0e6;border:1px solid rgba(14,14,13,.12)}
        .cc-label{font-family:var(--font-dm-mono),monospace;font-size:.5rem;letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px}
        .compare-card.nhr .cc-label{color:rgba(201,169,110,.7)}
        .compare-card.ifici .cc-label{color:rgba(14,14,13,.4)}
        .cc-title{font-family:var(--font-cormorant),serif;font-size:1.3rem;font-weight:300;margin-bottom:12px}
        .compare-card.nhr .cc-title{color:#f4f0e6}
        .compare-card.ifici .cc-title{color:#1c4a35}
        .cc-rate{font-family:var(--font-cormorant),serif;font-size:3rem;font-weight:300;line-height:1;margin-bottom:4px}
        .compare-card.nhr .cc-rate{color:#c9a96e}
        .compare-card.ifici .cc-rate{color:#1c4a35}
        .cc-rate-lbl{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.1em;margin-bottom:20px}
        .compare-card.nhr .cc-rate-lbl{color:rgba(244,240,230,.35)}
        .compare-card.ifici .cc-rate-lbl{color:rgba(14,14,13,.4)}
        .cc-items{display:flex;flex-direction:column;gap:8px}
        .cc-item{font-size:.8rem;line-height:1.6;padding-left:16px;position:relative}
        .cc-item::before{content:'·';position:absolute;left:0;color:#c9a96e}
        .compare-card.nhr .cc-item{color:rgba(244,240,230,.65)}
        .compare-card.ifici .cc-item{color:rgba(14,14,13,.65)}
        .savings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin:32px 0}
        .savings-card{background:#0c1f15;padding:24px;text-align:center}
        .sc-country{font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,240,230,.4);margin-bottom:8px}
        .sc-rate{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:rgba(244,240,230,.8);line-height:1;margin-bottom:4px}
        .sc-arrow{font-size:1.2rem;color:#c9a96e;margin:8px 0}
        .sc-pt{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:#c9a96e;line-height:1;margin-bottom:4px}
        .sc-label{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.1em;color:rgba(244,240,230,.25)}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .process-steps{display:flex;flex-direction:column;gap:0;margin:24px 0}
        .ps-item{display:flex;gap:20px;padding:20px 0;border-bottom:1px solid rgba(14,14,13,.08)}
        .ps-n{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:rgba(28,74,53,.2);flex-shrink:0;width:40px}
        .ps-body .ps-t{font-weight:500;font-size:.85rem;margin-bottom:4px;color:#0e0e0d}
        .ps-body .ps-d{font-size:.83rem;line-height:1.75;color:rgba(14,14,13,.6)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.compare-grid{grid-template-columns:1fr}.savings-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → nhr-ifici-guia-completo
          </div>
          <div className="art-cat">Fiscalidade · NHR · IFICI</div>
          <h1 className="art-h1">NHR vs IFICI 2024:<br/><em>Guia Completo</em><br/>para Estrangeiros em Portugal</h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>15 Fevereiro 2026</span>
            <span>·</span>
            <span>15 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal oferece há mais de uma década um dos regimes fiscais mais atractivos do mundo para novos residentes.
          O NHR (Residente Não Habitual) foi substituído em 2024 pelo IFICI, mas os princípios mantêm-se:
          tributação reduzida ou nula por 10 anos. Neste guia explicamos tudo — do zero.
        </p>

        <h2 className="s">NHR Clássico vs IFICI: Diferenças Fundamentais</h2>
        <div className="compare-grid">
          <div className="compare-card nhr">
            <div className="cc-label">NHR Clássico</div>
            <div className="cc-title">Residente Não Habitual</div>
            <div className="cc-rate">20%</div>
            <div className="cc-rate-lbl">rendimentos PT de alta qualificação · rendimentos estrangeiros isentos</div>
            <div className="cc-items">
              <div className="cc-item">Válido para candidaturas até 31/12/2023</div>
              <div className="cc-item">Duração: 10 anos consecutivos</div>
              <div className="cc-item">Rendimentos estrangeiros: isenção (em regra)</div>
              <div className="cc-item">Dividendos estrangeiros: 0%</div>
              <div className="cc-item">Pensões estrangeiras: 0% (ou 10% pós-2020)</div>
              <div className="cc-item">Salário PT em actividade qualificada: 20%</div>
            </div>
          </div>
          <div className="compare-card ifici">
            <div className="cc-label">IFICI 2024+</div>
            <div className="cc-title">Incentivo Fiscal à Investigação e Inovação</div>
            <div className="cc-rate">20%</div>
            <div className="cc-rate-lbl">taxa flat sobre rendimentos qualificados · duração 10 anos</div>
            <div className="cc-items">
              <div className="cc-item">Disponível a partir de 2024 (AT)</div>
              <div className="cc-item">Duração: 10 anos consecutivos</div>
              <div className="cc-item">Foco em actividades tech, investigação, artes, ensino</div>
              <div className="cc-item">20% flat sobre todos os rendimentos qualificados</div>
              <div className="cc-item">Isenção de IRS adicional para rendimentos estrangeiros específicos</div>
              <div className="cc-item">Não requer actividade de alto valor previamente listada</div>
            </div>
          </div>
        </div>

        <h2 className="s">Poupança Real: Comparação com Outros Países</h2>
        <p className="t">Para um rendimento anual de €200.000 (salário + dividendos típicos):</p>
        <div className="savings-grid">
          {[
            {country:'Reino Unido',rate:'40–45%',pt_rate:'20%'},
            {country:'Estados Unidos',rate:'32–37%',pt_rate:'20%'},
            {country:'França',rate:'41–45%',pt_rate:'20%'},
            {country:'Alemanha',rate:'37–42%',pt_rate:'20%'},
            {country:'Brasil',rate:'22–27%',pt_rate:'20%'},
            {country:'Países Baixos',rate:'42–49%',pt_rate:'20%'},
          ].map(c=>(
            <div key={c.country} className="savings-card">
              <div className="sc-country">{c.country}</div>
              <div className="sc-rate">{c.rate}</div>
              <div className="sc-arrow">↓</div>
              <div className="sc-pt">{c.pt_rate}</div>
              <div className="sc-label">Portugal NHR/IFICI</div>
            </div>
          ))}
        </div>
        <p className="t">Poupança típica para rendimento €200K/ano: <strong>€40.000–€50.000 anuais</strong>. Em 10 anos: <strong>€400.000–€500.000</strong> (assumindo crescimento 3% a.a.).</p>

        <div className="callout">
          <p><strong>Importante:</strong> O NHR clássico ainda está disponível para quem se candidatou antes de 31/12/2023. Para novas candidaturas em 2024+, aplica-se o regime IFICI. Em ambos os casos, o prazo de 10 anos conta a partir do ano de candidatura aprovada.</p>
        </div>

        <h2 className="s">Como Candidatar-se: Processo Completo</h2>
        <div className="process-steps">
          {[
            {n:'01',t:'Obter NIF',d:'Serviço de Finanças com passaporte ou carta de condução + comprovativo de morada. 1-2 dias. Pode ser feito por representante legal.'},
            {n:'02',t:'Estabelecer Residência Fiscal em Portugal',d:'Não basta passar 183 dias — é necessário habitação estável. Arrendamento ou compra de imóvel. Registar morada no Serviço de Finanças (AT).'},
            {n:'03',t:'Registar no Portal das Finanças (AT)',d:'Portal e-Financas → IRS → Pedido de NHR/IFICI. Preencher formulário com dados pessoais, histórico de residência, tipo de rendimento.'},
            {n:'04',t:'Aguardar Validação AT',d:'Prazo típico: 4-6 semanas. AT verifica que não foi residente fiscal em Portugal nos últimos 5 anos.'},
            {n:'05',t:'Confirmação e Primeira Declaração IRS',d:'Na declaração IRS do ano seguinte, indicar regime NHR/IFICI e tipo de rendimentos. Recomendado trabalhar com contabilista certificado (TOC).'},
          ].map(p=>(
            <div key={p.n} className="ps-item">
              <div className="ps-n">{p.n}</div>
              <div className="ps-body"><div className="ps-t">{p.t}</div><div className="ps-d">{p.d}</div></div>
            </div>
          ))}
        </div>

        <h2 className="s">Elegibilidade: Quem Pode Candidatar-se?</h2>
        <h3 className="ss">NHR Clássico (candidaturas até 31/12/2023)</h3>
        <p className="t">Qualquer pessoa que não tenha sido residente fiscal em Portugal nos últimos 5 anos. Cidadãos de qualquer nacionalidade. Inclui retornados portugueses que viveram no estrangeiro.</p>
        <h3 className="ss">IFICI 2024+</h3>
        <p className="t">Mesma condição de não-residência anterior (5 anos). MAIS: actividade profissional qualificada em Portugal — tecnologia, investigação científica, ensino superior, actividades artísticas de alto nível, ou profissionais de alta qualificação em empresa com investimento relevante em I&D.</p>

        <h2 className="s">Tipos de Rendimento: O que está coberto?</h2>
        <table style={{width:'100%',borderCollapse:'collapse',margin:'24px 0',fontSize:'.85rem'}}>
          <thead><tr style={{background:'#1c4a35'}}><th style={{padding:'12px 16px',textAlign:'left',color:'#f4f0e6',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.15em',textTransform:'uppercase',fontWeight:400}}>Tipo Rendimento</th><th style={{padding:'12px 16px',textAlign:'left',color:'#f4f0e6',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.15em',textTransform:'uppercase',fontWeight:400}}>NHR Clássico</th><th style={{padding:'12px 16px',textAlign:'left',color:'#f4f0e6',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.15em',textTransform:'uppercase',fontWeight:400}}>IFICI 2024</th></tr></thead>
          <tbody>
            {[
              ['Salário (actividade qualificada PT)','20% flat','20% flat'],
              ['Dividendos (fonte estrangeira)','0% isenção','0–20% (varia)'],
              ['Rendas (fonte estrangeira)','0% isenção','0–20% (varia)'],
              ['Pensões (fonte estrangeira)','10% flat','10% flat'],
              ['Mais-valias (acções/cripto)','28% (standard)','28% (standard)'],
              ['Rendimentos PT outros','IRS normal','IRS normal'],
            ].map(([tipo,nhr,ifici])=>(
              <tr key={tipo}><td style={{padding:'12px 16px',borderBottom:'1px solid rgba(14,14,13,.08)',color:'rgba(14,14,13,.7)'}}>{tipo}</td><td style={{padding:'12px 16px',borderBottom:'1px solid rgba(14,14,13,.08)',color:'#1c4a35',fontWeight:500}}>{nhr}</td><td style={{padding:'12px 16px',borderBottom:'1px solid rgba(14,14,13,.08)',color:'#1c4a35',fontWeight:500}}>{ifici}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="cta-box">
          <h3>Calcule a sua poupança fiscal agora</h3>
          <p>Use a nossa calculadora NHR/IFICI gratuita — resultados em 10 segundos.</p>
          <Link href="/#nhr">Calcular Poupança →</Link>
        </div>
      </article>
    </>
  )
}
