import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mercado de Luxo em Portugal 2026: Lisboa Top 5 Mundial',
  description: 'Lisboa Top 5 mundial Savills. Cascais €12.000/m². Comporta +28%. Análise completa do mercado prime 2026. Compradores internacionais, zonas emergentes e previsões. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/mercado-luxo-portugal-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/mercado-luxo-portugal-2026',
    },
  },
  openGraph: {
    title: 'Mercado de Luxo em Portugal 2026: Lisboa Top 5 Mundial',
    description: 'Lisboa Top 5 mundial. Cascais €12.000/m². Comporta +28%. Análise completa.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/mercado-luxo-portugal-2026',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=Mercado%20de%20Luxo%20em%20Portugal%202026%3A%20Lisboa%20Top%205%20Mundial&subtitle=Lisboa%20Top%205%20mundial.%20Cascais%20%E2%82%AC12.000%2Fm%C2%B2.%20Comporta%20%2B28%25',
      width: 1200,
      height: 630,
      alt: 'Mercado de Luxo em Portugal 2026: Lisboa Top 5 Mundial',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mercado de Luxo em Portugal 2026: Lisboa Top 5 Mundial',
    description: 'Lisboa Top 5 mundial. Cascais €12.000/m². Comporta +28%. Análise completa.',
    images: ['https://www.agencygroup.pt/api/og?title=Mercado%20de%20Luxo%20em%20Portugal%202026%3A%20Lisboa%20Top%205%20Mundial&subtitle=Lisboa%20Top%205%20mundial.%20Cascais%20%E2%82%AC12.000%2Fm%C2%B2.%20Comporta%20%2B28%25'],
  },
}

const ZONAS_LUXO = [
  { zona: 'Quinta do Lago', pm2: '€12.000', volume: '€380M', intl: '78%', trend: '↑ +18%', nota: 'Melhor resort da Europa. Procura HNWI imune a ciclos económicos' },
  { zona: 'Comporta', pm2: '€11.000', volume: '€290M', intl: '72%', trend: '↑ +28%', nota: 'Legislação ambiental = zero nova oferta. Escassez estrutural permanente' },
  { zona: 'Cascais — Marina', pm2: '€9.500', volume: '€520M', intl: '58%', trend: '↑ +14%', nota: 'Mercado mais líquido do país. Family offices europeus' },
  { zona: 'Lisboa — Príncipe Real', pm2: '€8.800', volume: '€680M', intl: '55%', trend: '↑ +16%', nota: 'Coração do luxo lisboeta. Americanos e britânicos dominam' },
  { zona: 'Lisboa — Chiado', pm2: '€7.200', volume: '€420M', intl: '52%', trend: '↑ +14%', nota: 'Walk score máximo. Boutiques e restaurantes Michelin à porta' },
  { zona: 'Estoril', pm2: '€5.800', volume: '€180M', intl: '44%', trend: '↑ +12%', nota: 'Golden Mile. Villas históricas com jardins. Procura crescente' },
  { zona: 'Madeira — Funchal', pm2: '€4.200', volume: '€95M', intl: '42%', trend: '↑ +20%', nota: 'IFICI + clima = magnet para nómadas digitais ricos' },
  { zona: 'Porto — Foz', pm2: '€5.800', volume: '€210M', intl: '38%', trend: '↑ +13%', nota: 'Porto emergente. Ainda 30% abaixo de Lisboa. Upside enorme' },
]

const COMPRADORES = [
  { origem: 'Norte-americanos', quota: '16%', ticket: '€1.8M médio', motivacao: 'NHR + segurança + qualidade de vida' },
  { origem: 'Franceses', quota: '13%', ticket: '€890K médio', motivacao: 'Língua, clima, fiscalidade IFICI' },
  { origem: 'Britânicos', quota: '9%', ticket: '€1.2M médio', motivacao: 'Pós-Brexit relocation + NHR pensões' },
  { origem: 'Chineses', quota: '8%', ticket: '€2.1M médio', motivacao: 'Diversificação geográfica + Golden Visa histórico' },
  { origem: 'Brasileiros', quota: '6%', ticket: '€650K médio', motivacao: 'Idioma + cidadania UE + instabilidade política' },
  { origem: 'Alemães', quota: '5%', ticket: '€1.4M médio', motivacao: 'Alta carga fiscal Alemanha vs 20% PT' },
]

export default function ArticleLuxo() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: 'Mercado de Luxo em Portugal 2026: Lisboa Top 5 Mundial',
        description: 'Lisboa Top 5 mundial Savills. Cascais €12.000/m². Comporta +28%. Análise completa do mercado prime 2026.',
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
        datePublished: '2026-02-15', dateModified: '2026-03-30',
        url: 'https://www.agencygroup.pt/blog/mercado-luxo-portugal-2026',
        inLanguage: 'pt-PT',
        about: [
          { '@type': 'Thing', name: 'Mercado de luxo Portugal' },
          { '@type': 'Thing', name: 'Imóveis de luxo Lisboa' },
          { '@type': 'Thing', name: 'Quinta do Lago investimento' },
          { '@type': 'Thing', name: 'Comporta imóveis' },
        ],
      })}}/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .art-hero{padding:140px 0 80px;background:linear-gradient(135deg,#1a0a2e,#0c1f15);position:relative;overflow:hidden}
        .art-hero::before{content:'';position:absolute;top:-50%;right:-20%;width:600px;height:600px;background:radial-gradient(circle,rgba(201,169,110,.08),transparent 70%);pointer-events:none}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-cat{display:inline-block;background:rgba(201,169,110,.15);border:1px solid rgba(201,169,110,.4);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(244,240,230,.3)}
        .art-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(244,240,230,.08);margin-top:40px}
        .art-kpi{background:#0c1f15;padding:20px 16px;text-align:center}
        .art-kpi-v{font-family:var(--font-cormorant),serif;font-size:1.8rem;font-weight:300;color:#c9a96e}
        .art-kpi-l{font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,240,230,.35);margin-top:4px}
        .art-content{max-width:860px;margin:0 auto;padding:72px 56px}
        .art-lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2.s{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.7rem;color:#1c4a35;margin:48px 0 20px}
        p.t{font-size:.9rem;line-height:1.88;color:rgba(14,14,13,.65);margin-bottom:20px}
        .lx-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.82rem}
        .lx-table th{background:#0c1f15;color:#f4f0e6;padding:12px 14px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.44rem;letter-spacing:.14em;text-transform:uppercase;font-weight:400}
        .lx-table td{padding:12px 14px;border-bottom:1px solid rgba(14,14,13,.07);color:rgba(14,14,13,.7);vertical-align:top}
        .lx-table tr:hover td{background:rgba(28,74,53,.03)}
        .lx-nm{font-weight:600;color:#1c4a35}
        .lx-pm2{font-family:var(--font-dm-mono),monospace;font-size:.75rem;color:#0e0e0d}
        .lx-trend{color:#1c4a35;font-weight:600;font-family:var(--font-dm-mono),monospace;font-size:.75rem}
        .lx-nota{font-size:.75rem;color:rgba(14,14,13,.5);font-style:italic}
        .lx-intl{font-family:var(--font-dm-mono),monospace;font-size:.72rem;color:#c9a96e}
        .comp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}
        .comp-card{border:1px solid rgba(14,14,13,.08);padding:20px;background:#fff}
        .comp-origem{font-weight:600;color:#1c4a35;font-size:.9rem;margin-bottom:6px}
        .comp-quota{font-family:var(--font-cormorant),serif;font-size:2rem;font-weight:300;color:#c9a96e;line-height:1}
        .comp-ticket{font-family:var(--font-dm-mono),monospace;font-size:.6rem;color:rgba(14,14,13,.5);margin:6px 0}
        .comp-motiv{font-size:.72rem;color:rgba(14,14,13,.55);line-height:1.6;font-style:italic}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .callout-gold{background:#c9a96e;padding:28px 32px;margin:32px 0}
        .callout-gold p{color:rgba(12,31,21,.8);font-size:.85rem;line-height:1.8}
        .callout-gold strong{color:#0c1f15}
        .trend-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}
        .trend-card{padding:24px;border-left:3px solid #1c4a35;background:rgba(28,74,53,.04)}
        .trend-card h3{font-family:var(--font-cormorant),serif;font-weight:400;font-size:1.1rem;color:#1c4a35;margin-bottom:8px}
        .trend-card p{font-size:.78rem;line-height:1.7;color:rgba(14,14,13,.6)}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.art-kpis{grid-template-columns:1fr 1fr}.comp-grid{grid-template-columns:1fr}.trend-grid{grid-template-columns:1fr}.lx-table{font-size:.72rem}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-cat">Mercado de Luxo · Portugal 2026</div>
          <h1 className="art-h1">Mercado de Luxo<br/>em Portugal 2026:<br/><em>Lisboa Top 5 Mundial</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>15 Fevereiro 2026</span>
            <span>·</span>
            <span>12 min leitura</span>
          </div>
          <div className="art-kpis">
            <div className="art-kpi"><div className="art-kpi-v">Top 5</div><div className="art-kpi-l">Mundial Savills</div></div>
            <div className="art-kpi"><div className="art-kpi-v">+28%</div><div className="art-kpi-l">Comporta 2025</div></div>
            <div className="art-kpi"><div className="art-kpi-v">€12K</div><div className="art-kpi-l">Quinta do Lago /m²</div></div>
            <div className="art-kpi"><div className="art-kpi-v">44%</div><div className="art-kpi-l">Compradores Int.</div></div>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal entrou definitivamente no mapa do luxo mundial. Em 2025, Lisboa foi classificada Top 5 global pela Savills World Cities Prime Residential Index.
          A Comporta cresceu +28%, transformando-se no destino mais cobiçado da Europa. A Quinta do Lago atingiu €12.000/m². O que está a acontecer — e onde investir.
        </p>

        <h2 className="s">Panorama do Mercado Prime Portugal 2026</h2>
        <p className="t">O mercado de luxo português ({'>'}€1M) registou em 2025 um volume de €4,2 mil milhões — crescimento de 31% face a 2024. A escassez de oferta premium em Lisboa e no Algarve está a criar uma espiral de valorização sem precedentes.</p>
        <p className="t">O que distingue Portugal de outros mercados de luxo europeus: ainda há oportunidades de valorização significativa em zonas emergentes como a Madeira, o Porto e o Litoral Alentejano, enquanto o mercado prime de Paris, Londres e Madrid está saturado.</p>

        <h2 className="s">Zonas Prime: Preços e Potencial</h2>
        <p className="t">Dados: Savills Portugal + INE/AT Q3 2025. Volume anualizado 2025.</p>
        <div style={{overflowX:'auto'}}>
          <table className="lx-table">
            <thead>
              <tr>
                <th>Zona</th>
                <th>€/m² Prime</th>
                <th>Volume Anual</th>
                <th>Compradores Int.</th>
                <th>Variação</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {ZONAS_LUXO.map(z => (
                <tr key={z.zona}>
                  <td className="lx-nm">{z.zona}</td>
                  <td className="lx-pm2">{z.pm2}</td>
                  <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.72rem'}}>{z.volume}</td>
                  <td className="lx-intl">{z.intl}</td>
                  <td className="lx-trend">{z.trend}</td>
                  <td className="lx-nota">{z.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="callout">
          <p><strong>Porquê Portugal vs outros mercados de luxo?</strong> Segurança (ranking global top 10), clima 300 dias de sol, gastronomia/cultura únicas, NHR/IFICI 10 anos, custo de vida 30–40% abaixo de Paris/Londres, e um mercado imobiliário com runway de valorização ainda significativo.</p>
        </div>

        <h2 className="s">Quem Compra Luxo em Portugal</h2>
        <p className="t">Em 2025, 44% das transacções acima de €1M envolveram compradores internacionais. Norte-americanos ultrapassaram os britânicos pela primeira vez como compradores mais activos no segmento €1M–€5M.</p>
        <div className="comp-grid">
          {COMPRADORES.map(c => (
            <div key={c.origem} className="comp-card">
              <div className="comp-origem">{c.origem}</div>
              <div className="comp-quota">{c.quota}</div>
              <div className="comp-ticket">{c.ticket}</div>
              <div className="comp-motiv">{c.motivacao}</div>
            </div>
          ))}
        </div>

        <h2 className="s">4 Tendências que Vão Moldar o Luxo em 2026</h2>
        <div className="trend-grid">
          <div className="trend-card">
            <h3>Branded Residences</h3>
            <p>Hotéis de luxo a lançar residências em Portugal: Aman, Four Seasons, Mandarin Oriental. Valorização 25–40% premium vs mercado.</p>
          </div>
          <div className="trend-card">
            <h3>Sustentabilidade como Must-Have</h3>
            <p>HNWI exigem certificação BREEAM/LEED. Imóveis sem certif. energética A/B enfrentam desconto crescente de 8–15%.</p>
          </div>
          <div className="trend-card">
            <h3>Off-Market Explode</h3>
            <p>Em 2025, 68% das transacções {'>'}€3M foram off-market em Lisboa. Redes de mediação exclusiva tornam-se o único acesso real.</p>
          </div>
          <div className="trend-card">
            <h3>Tech + Proptech</h3>
            <p>Compradores HNWI exigem AVM instantâneo, visitas VR e análise de dados em tempo real. Mediadores sem tech perdem negócios.</p>
          </div>
        </div>

        <h2 className="s">Comporta: O Caso de Estudo</h2>
        <p className="t">De 2019 a 2025, a Comporta valorizou 312%. Hoje, uma herdade que em 2019 custava €1,5M vale €4,5M–€6M. O que criou esta valorização extraordinária?</p>
        <p className="t"><strong>Oferta estruturalmente limitada:</strong> A Reserva Natural do Estuário do Sado proíbe nova construção na maioria do território. Menos de 50 novas unidades premium por ano. A procura cresce 30%/ano. A matemática é simples.</p>
        <p className="t"><strong>Posicionamento internacional:</strong> Reportagens no New York Times, Financial Times e Vogue elevaram a Comporta a destino de renome mundial. Hoje compete directamente com Ibiza e Saint-Tropez — a um terço do preço.</p>
        <p className="t"><strong>Off-market domina:</strong> Mais de 80% das transacções acima de €2M na Comporta são off-market. Sem acesso à rede certa, simplesmente não há imóveis disponíveis.</p>

        <div className="callout-gold">
          <p><strong>Previsão 2026–2030:</strong> Comporta deve atingir €15.000–€18.000/m² nos próximos 4 anos. Quinta do Lago pode ultrapassar €20.000/m² com a expansão do resort e procura HNWI global crescente. Lisboa prime projecta +4–6%/ano (Savills).</p>
        </div>

        <h2 className="s">Processo de Compra: 5 Erros Críticos dos Investidores Internacionais</h2>
        <p className="t"><strong>1. Não activar NHR antes da compra:</strong> O estatuto NHR/IFICI deve ser pedido antes de qualquer transacção para optimizar a estrutura fiscal. Muitos chegam depois da escritura — tarde demais.</p>
        <p className="t"><strong>2. Confiar em avaliações de portais:</strong> O price/m² de portais públicos está 15–25% desactualizado em relação ao mercado real. Use AVM calibrado com dados INE/AT actuais.</p>
        <p className="t"><strong>3. Comprar sem advogado independente:</strong> Em Portugal, o advogado não está incluído na comissão. Honorários: €3.000–€8.000. ROI: proteção total do seu investimento.</p>
        <p className="t"><strong>4. Ignorar o mercado off-market:</strong> Os melhores imóveis nunca chegam aos portais. Parcerias com mediadores como a Agency Group (AMI 22506) dão acesso imediato.</p>
        <p className="t"><strong>5. Subestimar os custos de transacção:</strong> IMT (0–8%), IS (0,8%), registo (~€1.500), notário (~€1.000). Para um imóvel de €1M: total de custos ~€80.000–€90.000. Planeie antecipadamente.</p>

        <div className="cta-box">
          <h3>Aceda ao Portfolio Exclusivo</h3>
          <p>Imóveis de luxo off-market em Lisboa, Cascais, Comporta e Algarve. Análise gratuita com o nosso motor AVM.</p>
          <Link href="/#avaliacao">Avaliação Gratuita →</Link>
        </div>
      </article>
    </>
  )
}
