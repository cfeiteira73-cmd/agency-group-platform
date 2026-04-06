import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Investir em Imobiliário em Portugal 2026: Yields e ROI',
  description: 'Comporta +28%, Quinta do Lago yield 2.8%, Lisboa yield 3.8%. Análise completa zona a zona. Onde investir em 2026 para maximizar retorno. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/investir-imoveis-portugal',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/investir-imoveis-portugal',
    },
  },
  openGraph: {
    title: 'Investir em Imobiliário em Portugal 2026',
    description: 'Comporta +28%, Lisboa top 5 mundial. Yields e ROI por zona — análise completa.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/investir-imoveis-portugal',
  },
}

const ZONAS_DATA = [
  { zona: 'Comporta', pm2: '€11.000', yoy: '+28%', yield: '2.7%', ci: '72%', potencial: '★★★★★', nota: 'Legislação ambiental limita nova oferta — escassez estrutural' },
  { zona: 'Quinta do Lago', pm2: '€12.000', yoy: '+18%', yield: '2.8%', ci: '78%', potencial: '★★★★★', nota: 'Top 5 resort mundial. Procura de HNWI global permanente' },
  { zona: 'Lisboa — Chiado', pm2: '€7.200', yoy: '+14%', yield: '3.4%', ci: '55%', potencial: '★★★★☆', nota: 'Liquidez máxima. Sempre comprador no mercado' },
  { zona: 'Cascais', pm2: '€6.638', yoy: '+14%', yield: '3.9%', ci: '52%', potencial: '★★★★☆', nota: 'Mercado mais premium do país. Off-market fundamental' },
  { zona: 'Porto — Foz', pm2: '€5.800', yoy: '+13%', yield: '3.8%', ci: '45%', potencial: '★★★★☆', nota: 'Valorização consistente. Mercado mais acessível que Lisboa' },
  { zona: 'Madeira', pm2: '€3.959', yoy: '+20%', yield: '4.7%', ci: '42%', potencial: '★★★★☆', nota: 'Fiscalidade IFICI + clima + crescimento. Subsub-avaliado' },
  { zona: 'Ericeira', pm2: '€3.200', yoy: '+15%', yield: '4.6%', ci: '30%', potencial: '★★★☆☆', nota: 'World Surf Reserve. Procura crescente, preços ainda razoáveis' },
  { zona: 'Évora', pm2: '€1.400', yoy: '+18%', yield: '5.6%', ci: '12%', potencial: '★★★☆☆', nota: 'UNESCO. Yields altos, ticket de entrada baixo. Alto potencial' },
]

export default function ArticleInvestir() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: 'Investir em Imobiliário em Portugal 2026: Yields, ROI e Zonas',
        description: 'Comporta +28%, Quinta do Lago yield 2.8%, Lisboa yield 3.8%. Análise completa zona a zona.',
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
        datePublished: '2026-01-20', dateModified: '2026-03-30',
        url: 'https://www.agencygroup.pt/blog/investir-imoveis-portugal',
        inLanguage: 'pt-PT',
        about: [
          { '@type': 'Thing', name: 'Investimento imobiliário Portugal' },
          { '@type': 'Thing', name: 'Yield imobiliário Portugal 2026' },
          { '@type': 'Thing', name: 'ROI imóveis Portugal' },
        ],
      })}}/>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:var(--font-jost),sans-serif;background:#f4f0e6;color:#0e0e0d;-webkit-font-smoothing:antialiased}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:20px 64px;background:rgba(244,240,230,.96);backdrop-filter:blur(28px);border-bottom:1px solid rgba(14,14,13,.08);display:flex;align-items:center;justify-content:space-between}
        .logo{text-decoration:none;display:flex;flex-direction:column;line-height:1;gap:1px}
        .la,.lg{font-family:var(--font-cormorant),serif;font-weight:300;font-size:.9rem;letter-spacing:.44em;text-transform:uppercase;color:#1c4a35}
        .lg{letter-spacing:.68em}
        .art-hero{padding:140px 0 80px;background:linear-gradient(135deg,#0c2030,#0c1f15);position:relative;overflow:hidden}
        .art-hero-inner{max-width:860px;margin:0 auto;padding:0 56px;position:relative;z-index:2}
        .art-cat{display:inline-block;background:rgba(28,74,53,.5);border:1px solid rgba(28,74,53,.8);color:#c9a96e;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.2em;text-transform:uppercase;padding:5px 12px;margin-bottom:20px}
        .art-h1{font-family:var(--font-cormorant),serif;font-size:clamp(2rem,4.5vw,3.2rem);font-weight:300;color:#f4f0e6;line-height:1.1;letter-spacing:-.01em;margin-bottom:20px}
        .art-h1 em{color:#c9a96e;font-style:italic}
        .art-meta{display:flex;gap:24px;font-family:var(--font-dm-mono),monospace;font-size:.48rem;letter-spacing:.12em;color:rgba(244,240,230,.3)}
        .art-content{max-width:860px;margin:0 auto;padding:72px 56px}
        .art-lead{font-size:1.05rem;line-height:1.85;color:rgba(14,14,13,.7);margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid rgba(14,14,13,.1)}
        h2.s{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.7rem;color:#1c4a35;margin:48px 0 20px}
        p.t{font-size:.9rem;line-height:1.88;color:rgba(14,14,13,.65);margin-bottom:20px}
        .zona-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:.82rem}
        .zona-table th{background:#0c1f15;color:#f4f0e6;padding:12px 14px;text-align:left;font-family:var(--font-dm-mono),monospace;font-size:.46rem;letter-spacing:.14em;text-transform:uppercase;font-weight:400}
        .zona-table td{padding:12px 14px;border-bottom:1px solid rgba(14,14,13,.08);color:rgba(14,14,13,.7);vertical-align:top}
        .zona-table tr:hover td{background:rgba(28,74,53,.03)}
        .zona-nm{font-weight:600;color:#1c4a35}
        .zona-pm2{font-family:var(--font-dm-mono),monospace;font-size:.75rem}
        .zona-yoy{color:#1c4a35;font-weight:600;font-family:var(--font-dm-mono),monospace;font-size:.75rem}
        .zona-yield{color:#c9a96e;font-weight:600;font-family:var(--font-dm-mono),monospace;font-size:.75rem}
        .zona-nota{font-size:.75rem;color:rgba(14,14,13,.5);font-style:italic}
        .callout{background:#1c4a35;padding:28px 32px;margin:32px 0}
        .callout p{color:rgba(244,240,230,.75);font-size:.85rem;line-height:1.8}
        .callout strong{color:#c9a96e}
        .cta-box{background:#c9a96e;padding:40px;margin:48px 0;text-align:center}
        .cta-box h3{font-family:var(--font-cormorant),serif;font-weight:300;font-size:1.6rem;color:#0c1f15;margin-bottom:12px}
        .cta-box p{font-size:.83rem;color:rgba(12,31,21,.7);margin-bottom:24px}
        .cta-box a{display:inline-block;background:#0c1f15;color:#f4f0e6;padding:13px 32px;text-decoration:none;font-family:var(--font-dm-mono),monospace;font-size:.55rem;letter-spacing:.18em;text-transform:uppercase}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.zona-table{font-size:.75rem}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-cat">Investimento Imobiliário</div>
          <h1 className="art-h1">Investir em Imobiliário<br/>em Portugal 2026:<br/><em>Yields, ROI e Zonas</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>20 Janeiro 2026</span>
            <span>·</span>
            <span>10 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Portugal registou 169.812 transacções em 2025 — recorde histórico. Investimento imobiliário atingiu €2,8 mil milhões (+22%). Lisboa está no Top 5 do luxo mundial.
          Mas onde investir realmente para maximizar retorno em 2026? Analisámos todos os mercados com dados INE/AT Q3 2025.
        </p>

        <h2 className="s">Análise Zona a Zona: Yields e Potencial</h2>
        <p className="t">Dados: INE/AT Q3 2025 (publicado Fevereiro 2026). Yield bruto calculado com rendas medianas Q4 2024.</p>
        <div style={{overflowX:'auto'}}>
          <table className="zona-table">
            <thead>
              <tr>
                <th>Zona</th>
                <th>€/m²</th>
                <th>Var. Homóloga</th>
                <th>Yield Bruto</th>
                <th>Compradores Int.</th>
                <th>Potencial 5A</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {ZONAS_DATA.map(z => (
                <tr key={z.zona}>
                  <td className="zona-nm">{z.zona}</td>
                  <td className="zona-pm2">{z.pm2}</td>
                  <td className="zona-yoy">{z.yoy}</td>
                  <td className="zona-yield">{z.yield}</td>
                  <td style={{fontFamily:"'DM Mono',monospace",fontSize:'.75rem'}}>{z.ci}</td>
                  <td style={{letterSpacing:'.05em',fontSize:'.8rem'}}>{z.potencial}</td>
                  <td className="zona-nota">{z.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="callout">
          <p><strong>Yield bruto vs yield líquido:</strong> O yield bruto mostrado não inclui IMI (0,3%), condomínio, manutenção (~1%) e vacância (~10%). Yield líquido típico = yield bruto × 0,75. Lisboa 3,8% bruto → ~2,85% líquido.</p>
        </div>

        <h2 className="s">A Estratégia de Investimento Certa para Cada Perfil</h2>
        <p className="t"><strong>Capital Preservation (€3M+):</strong> Comporta, Quinta do Lago, Lisboa Chiado. Valorização garantida por escassez estrutural e procura internacional inelástica. Yield secundário.</p>
        <p className="t"><strong>Yield Focus (€500K–€2M):</strong> Madeira, Ericeira, Évora, Braga. Yields 4-6%+, mercados em crescimento, ticket de entrada acessível.</p>
        <p className="t"><strong>Crescimento Acelerado (€1M–€5M):</strong> Lisboa Marvila/Beato (valorização +22% YoY), Matosinhos, Setúbal. Mercados ainda abaixo do potencial com catalisadores identificados.</p>
        <p className="t"><strong>Diversificação:</strong> Portfolio de 3-5 imóveis em diferentes zonas reduz risco e optimiza retorno médio. Use o nosso Investor Dashboard para comparar oportunidades em simultâneo.</p>

        <h2 className="s">Fiscalidade do Investimento Imobiliário em Portugal</h2>
        <p className="t"><strong>Rendas:</strong> Tributadas a 25% de IRS (taxa liberatória) ou taxa marginal se optado pelo englobamento. Despesas dedutíveis: IMI, juros do crédito, seguros, obras de conservação.</p>
        <p className="t"><strong>Mais-valias (venda):</strong> 50% da mais-valia englobada nos rendimentos (se propriedade por menos de 2 anos: 100%). Isenção se reinvestir em habitação própria permanente dentro de 36 meses.</p>
        <p className="t"><strong>IMI anual:</strong> 0,3% do valor patrimonial tributário (VPT) para propriedades urbanas. Para imóveis de elevado valor ({'>'} €1M): adicional IMI (AIMI) de 0,7–1,5%.</p>
        <p className="t"><strong>NHR/IFICI + investimento:</strong> Sob NHR, rendas de fonte estrangeira são isentas. Para investidores que residem em Portugal sob NHR, pode optimizar a estrutura fiscal.</p>

        <div className="cta-box">
          <h3>Analise qualquer imóvel em 30 segundos</h3>
          <p>Deal Radar 16D: valor justo, oferta recomendada, yield, mensagem WhatsApp. Gratuito para agentes.</p>
          <Link href="/#deal-radar">Analisar com Deal Radar →</Link>
        </div>
      </article>
    </>
  )
}
