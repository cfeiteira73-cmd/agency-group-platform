import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'NHR IFICI 2026: Guia do Regime Fiscal para Novos Residentes',
  description: 'Guia completo IFICI 2026 (sucessor do NHR). Quem pode candidatar, taxa de 20%, isenções de rendimentos estrangeiros, processo de candidatura e combinação com imobiliário. AMI 22506.',
  robots: 'index, follow',
  alternates: { canonical: 'https://www.agencygroup.pt/blog/nhr-ifici-2026-guia-completo' },
  openGraph: {
    title: 'NHR → IFICI 2026: Guia Completo do Regime Fiscal para Novos Residentes em Portugal',
    description: 'IFICI Portugal 2026: taxa flat 20%, isenção rendimentos estrangeiros, 10 anos. Quem elegível, como candidatar, diferenças vs NHR clássico.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/nhr-ifici-2026-guia-completo',
    locale: 'pt_PT',
      images: [{
      url: 'https://www.agencygroup.pt/api/og?title=NHR%20%E2%86%92%20IFICI%202026%3A%20Guia%20Completo%20do%20Regime%20Fiscal%20para%20Novos&subtitle=IFICI%20Portugal%202026%3A%20taxa%20flat%2020%25%2C%20isen%C3%A7%C3%A3o%20rendimentos',
      width: 1200,
      height: 630,
      alt: 'NHR → IFICI 2026: Guia Completo do Regime Fiscal para Novos Residentes em Portugal',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NHR → IFICI 2026: Guia Completo do Regime Fiscal para Novos Residentes em Portugal',
    description: 'IFICI Portugal 2026: taxa flat 20%, isenção rendimentos estrangeiros, 10 anos. Quem elegível, como c',
    images: ['https://www.agencygroup.pt/api/og?title=NHR%20%E2%86%92%20IFICI%202026%3A%20Guia%20Completo%20do%20Regime%20Fiscal%20para%20Novos&subtitle=IFICI%20Portugal%202026%3A%20taxa%20flat%2020%25%2C%20isen%C3%A7%C3%A3o%20rendimentos'],
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'NHR → IFICI 2026: Guia Completo do Regime Fiscal para Novos Residentes em Portugal',
  description: 'Guia completo IFICI 2026. Taxa flat 20%, isenções, elegibilidade, candidatura.',
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
  url: 'https://www.agencygroup.pt/blog/nhr-ifici-2026-guia-completo',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'NHR 2026 Portugal' },
    { '@type': 'Thing', name: 'IFICI Portugal' },
    { '@type': 'Thing', name: 'Regime fiscal estrangeiros Portugal' },
  ],
}

export default function ArticleNHRIFICI2026() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
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
        .diff-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:28px 0}
        .diff-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px}
        .diff-label{font-family:var(--font-dm-mono),monospace;font-size:.52rem;letter-spacing:.16em;text-transform:uppercase;margin-bottom:12px}
        .diff-label.old{color:rgba(14,14,13,.4)}
        .diff-label.new{color:#1c4a35}
        .diff-card ul{list-style:none;padding:0}
        .diff-card ul li{font-size:.83rem;line-height:1.75;color:rgba(14,14,13,.65);padding:4px 0;border-bottom:1px solid rgba(14,14,13,.05)}
        .diff-card ul li:last-child{border-bottom:none}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.diff-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
        <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: '#1c4a35', textDecoration: 'none' }}>← Blog</Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → nhr-ifici-2026-guia-completo
          </div>
          <div className="art-cat">Regime Fiscal · Guia 2026</div>
          <h1 className="art-h1">NHR → IFICI 2026:<br /><em>Guia Completo para Novos Residentes</em></h1>
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
          O NHR — Non-Habitual Resident — foi durante mais de uma década o regime fiscal mais atrativo da Europa para
          profissionais qualificados e reformados. Em 2024, o governo português substituiu-o pelo IFICI+: Incentivo Fiscal
          à Investigação Científica e Inovação. A estrutura central mantém-se — 20% de taxa flat durante 10 anos — mas
          as categorias elegíveis mudaram. Este guia explica tudo o que precisa de saber para candidatar em 2026.
        </p>

        <h2 className="s">1. O Que é o IFICI (Sucessor do NHR)</h2>
        <p className="t">
          O IFICI+ (Incentivo Fiscal à Investigação Científica e Inovação) é o regime criado pelo Orçamento de Estado
          2024 para substituir o NHR clássico. Mantém os benefícios nucleares — taxa reduzida de 20% sobre rendimentos
          de trabalho qualificado de fonte portuguesa e isenção de rendimentos estrangeiros — mas restringe a elegibilidade
          a categorias profissionais específicas que o Estado considera estratégicas para a economia nacional.
        </p>
        <p className="t">
          O regime aplica-se durante 10 anos contados a partir do ano de estabelecimento de residência fiscal em Portugal.
          Não é renovável. A candidatura é feita na declaração de IRS do próprio ano de chegada — ou no ano seguinte,
          até ao prazo limite de entrega.
        </p>

        <div className="callout">
          <p><strong>Resumo Executivo IFICI 2026:</strong> Taxa flat 20% sobre rendimentos qualificados de fonte PT · Isenção dividendos, juros e rendas estrangeiras · Duração 10 anos · Candidatura no ano de chegada · Não aplicável a quem foi residente fiscal em PT nos últimos 5 anos · Substituiu o NHR clássico a partir de 01/01/2024.</p>
        </div>

        <h2 className="s">2. NHR vs IFICI — As Diferenças Principais</h2>

        <div className="diff-grid">
          <div className="diff-card">
            <div className="diff-label old">NHR Clássico (encerrado 2023)</div>
            <ul>
              <li>Aberto a qualquer profissional de &quot;elevado valor acrescentado&quot;</li>
              <li>Lista de 29 profissões elegíveis (genérica)</li>
              <li>Reformados: isenção total de pensões estrangeiras</li>
              <li>Taxa flat 20% IRS sobre rendimentos PT</li>
              <li>Aplicável 10 anos</li>
              <li>Candidatura simples via portal das Finanças</li>
            </ul>
          </div>
          <div className="diff-card">
            <div className="diff-label new">IFICI+ (vigente desde 2024)</div>
            <ul>
              <li>Restrito a categorias específicas de alto impacto</li>
              <li>Foco em investigação, tecnologia, docência, startups</li>
              <li>Reformados: tratamento via convenções bilaterais</li>
              <li>Taxa flat 20% IRS sobre rendimentos qualificados PT</li>
              <li>Aplicável 10 anos</li>
              <li>Candidatura com declaração de atividade elegível</li>
            </ul>
          </div>
        </div>

        <h2 className="s">3. Quem Pode Candidatar ao IFICI em 2026</h2>
        <p className="t">
          O IFICI destina-se a profissionais que o Estado português quer atrair e reter. As principais categorias
          elegíveis em 2026 são:
        </p>

        <div className="step-grid">
          {[
            { n: '01', t: 'Investigadores e Cientistas', d: 'Profissionais a desenvolver actividade de I&D em entidades reconhecidas pelo FCT ou equivalente europeu. Inclui pós-doutorandos e investigadores contratados por empresas elegíveis.' },
            { n: '02', t: 'Profissionais de Tecnologia', d: 'Engenheiros de software, data scientists, especialistas em cibersegurança e IA contratados por empresas portuguesas ou a trabalhar remotamente para empresas estrangeiras em Portugal.' },
            { n: '03', t: 'Docentes Universitários', d: 'Professores de ensino superior contratados por universidades portuguesas. Inclui professores visitantes em regime de tempo integral com vínculo contratual formal.' },
            { n: '04', t: 'Fundadores de Startups', d: 'Fundadores e co-fundadores de empresas reconhecidas pela Startup Portugal ou registadas no regime de startups inovadoras. Condições específicas aplicam.' },
            { n: '05', t: 'Profissionais em Empresas Elegíveis', d: 'Trabalhadores qualificados de empresas certificadas como Empresas de Produção Audiovisual, PME Líder, ou entidades com estatuto de utilidade pública reconhecido.' },
            { n: '06', t: 'Investidores (condições específicas)', d: 'Investidores com capital aplicado em veículos elegíveis (fundos de capital de risco registados, projetos de investimento certificados pela AICEP). Consultar fiscalista.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">4. Os Benefícios em Detalhe</h2>

        <table className="cost-table">
          <thead><tr><th>Tipo de Rendimento</th><th>Tratamento IFICI</th><th>Notas</th></tr></thead>
          <tbody>
            <tr><td>Salário / Trabalho independente (fonte PT)</td><td>20% taxa flat IRS</td><td>Versus taxa marginal máxima 48% + sobretaxas</td></tr>
            <tr><td>Dividendos de fonte estrangeira</td><td>Isenção (método de isenção)</td><td>Sujeito a convenção bilateral vigente</td></tr>
            <tr><td>Juros de fonte estrangeira</td><td>Isenção (método de isenção)</td><td>Conta bancária no estrangeiro, rendimentos gerados fora de PT</td></tr>
            <tr><td>Rendimentos prediais estrangeiros</td><td>Isenção (método de isenção)</td><td>Imóvel arrendado fora de Portugal</td></tr>
            <tr><td>Mais-valias estrangeiras</td><td>Isenção (condições)</td><td>Depende da convenção; mais-valias imóveis PT taxadas normalmente</td></tr>
            <tr><td>Pensões estrangeiras</td><td>Tratamento via convenção bilateral</td><td>Já não isento por defeito — avaliar caso a caso</td></tr>
          </tbody>
        </table>

        <h3 className="ss">Exemplo de Poupança Fiscal</h3>
        <p className="t">
          Um engenheiro de software que se muda para Lisboa com um salário bruto de €120.000/ano pagaria, em regime
          normal IRS, cerca de €47.000 em imposto (taxa efectiva ~39%). Com o IFICI, paga €24.000 (20%), uma poupança
          anual de €23.000. Ao longo de 10 anos, e sem contar com inflação ou aumentos salariais, a poupança acumulada
          supera €230.000 — suficiente para financiar uma entrada significativa num imóvel em Lisboa.
        </p>

        <h2 className="s">5. Como Se Candidatar ao IFICI — Passo a Passo</h2>
        <div className="step-grid">
          {[
            { n: '01', t: 'Obter NIF', d: 'Número de Identificação Fiscal, obrigatório para qualquer formalidade em Portugal. Obtido no Serviço de Finanças (presencialmente ou via advogado) em 1–3 dias úteis. Não-residentes necessitam de representante fiscal.' },
            { n: '02', t: 'Estabelecer Residência Fiscal', d: 'Registar morada em Portugal como residência habitual (arrendamento ou propriedade). A data de início de residência fiscal é determinante para o prazo de candidatura IFICI.' },
            { n: '03', t: 'Verificar Atividade Elegível', d: 'Confirmar com fiscalista especializado que a actividade profissional se enquadra nas categorias IFICI. A incorrecta classificação pode resultar em recusa ou revisão fiscal posterior.' },
            { n: '04', t: 'Entregar Declaração IRS', d: 'Na declaração de IRS do ano de chegada (Modelo 3), indicar o código de actividade correcto e solicitar enquadramento no IFICI. Prazo: Abril–Junho do ano seguinte à chegada.' },
          ].map(s => (
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="callout">
          <p><strong>Atenção ao Prazo:</strong> A candidatura ao IFICI deve ser feita no próprio ano de chegada a Portugal (ou no ano seguinte). Quem chega em 2026 e não candidata na declaração de IRS de 2026 (entregue em 2027) perde o direito. Não existe retroactividade além do ano seguinte à chegada.</p>
        </div>

        <h2 className="s">6. IFICI + Imobiliário — A Dupla Vantagem</h2>
        <p className="t">
          A combinação de residência fiscal em Portugal com o regime IFICI cria uma vantagem composta raramente disponível
          noutros mercados europeus: poupança fiscal de 20–30 pontos percentuais sobre rendimentos de trabalho, combinada
          com valorização de capital imobiliário isenta de imposto no país de origem (dependendo da convenção bilateral).
        </p>
        <p className="t">
          Para um profissional americano ou britânico que compra um imóvel em Lisboa, estabelece residência fiscal
          e activa o IFICI, o cenário financeiro a 10 anos é consistentemente superior a permanecer na jurisdição de
          origem. A poupança fiscal anual financia parcialmente o custo de posse do imóvel, que por sua vez valoriza
          +10–15% ao ano nos segmentos prime.
        </p>
        <p className="t">
          A Agency Group trabalha regularmente com compradores em processo de relocalização fiscal. Podemos coordenar
          a pesquisa imobiliária com o calendário de candidatura IFICI — assegurando que a data de escritura (e portanto
          início de residência fiscal) está alinhada com os prazos de candidatura ao regime.
        </p>

        <div className="cta-box">
          <h3>Está a planear vir para Portugal?</h3>
          <p>Ajudamos a encontrar o imóvel certo e coordenamos com a sua equipa fiscal. Sem custos para o comprador. AMI 22506 · +351 919 948 986 · www.agencygroup.pt</p>
          <Link href="/imoveis">Ver Imóveis Disponíveis →</Link>
        </div>
      </article>

      <footer style={{ background: '#0c1f15', padding: '40px 56px', borderTop: '1px solid rgba(201,169,110,.12)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Blog</Link>
            <Link href="/blog/nhr-portugal-2026-guide" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>NHR Guide EN</Link>
            <Link href="/blog/comprar-casa-portugal-2026" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(244,240,230,.35)', textDecoration: 'none' }}>Comprar Casa PT</Link>
          </div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.2)' }}>© 2026 Agency Group · AMI 22506</span>
        </div>
      </footer>
    </>
  )
}
