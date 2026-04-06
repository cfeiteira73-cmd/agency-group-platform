import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Visto D7 Portugal 2026: Rendimento Passivo e Residência',
  description: 'Guia completo do Visto D7 Portugal 2026. Requisitos, rendimento mínimo €820/mês, documentos, processo passo a passo. Compatível com NHR/IFICI.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/visto-d7-portugal-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/visto-d7-portugal-2026',
    },
  },
  openGraph: {
    title: 'Visto D7 Portugal 2026: Rendimento Passivo e Residência',
    description: 'Requisitos, rendimento mínimo €820/mês, documentos e processo passo a passo. Compatível com NHR/IFICI.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/visto-d7-portugal-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Visto D7 Portugal 2026: Rendimento Passivo e Residência',
  description: 'Guia completo do Visto D7 Portugal 2026. Requisitos, rendimento mínimo €820/mês, documentos, processo passo a passo. Compatível com NHR/IFICI.',
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
  datePublished: '2026-03-20',
  dateModified: '2026-04-02',
  url: 'https://www.agencygroup.pt/blog/visto-d7-portugal-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Visto D7 Portugal' },
    { '@type': 'Thing', name: 'Residência passiva Portugal' },
    { '@type': 'Thing', name: 'NHR Portugal' },
  ],
}

export default function ArticleVistoD7() {
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
            <Link href="/">Início</Link> → <Link href="/blog">Blog</Link> → Visto D7
          </div>
          <div className="art-cat">Imigração &amp; Residência</div>
          <h1 className="art-h1">Visto D7 Portugal 2026:<br/><em>Rendimento Passivo</em> e Residência</h1>
          <div className="art-meta">
            <span>8 min leitura</span>
            <span>·</span>
            <span>Actualizado Abril 2026</span>
            <span>·</span>
            <span>AMI 22506</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          O Visto D7 — oficialmente «Visto de Residência para Actividades com Rendimentos de Outras Fontes»
          — é a via mais directa para quem quer viver em Portugal sem depender de um contrato de trabalho
          português. Reformados com pensão estrangeira, investidores com dividendos, proprietários com rendas,
          trabalhadores remotos para entidades não portuguesas: todos se enquadram neste visto. Em 2026, o D7
          continua a ser a porta de entrada preferida dos norte-americanos, britânicos e brasileiros que
          escolhem Portugal como residência permanente — e, acima de tudo, a porta de acesso ao regime
          NHR/IFICI, que pode transformar radicalmente a carga fiscal nos próximos 10 anos.
        </p>

        <h2 className="s">1. O que é o Visto D7</h2>
        <p className="t">
          Criado pelo Decreto Regulamentar n.º 84/2007, o D7 destina-se a cidadãos não-UE que demonstrem
          rendimento passivo regular e suficiente para se sustentarem em Portugal. Ao contrário do extinto
          Golden Visa (ARI), não exige qualquer investimento mínimo em imóvel — basta comprovar rendimento
          acima do salário mínimo nacional.
        </p>
        <p className="t">
          O processo decorre em duas fases: primeiro, a obtenção do visto D7 no consulado português do país
          de residência do requerente (válido por 4 meses); depois, já em Portugal, o agendamento no AIMA
          (Agência para a Integração, Migrações e Asilo) para conversão em Autorização de Residência — válida
          inicialmente por 2 anos, renovável por períodos de 3 anos. Após 5 anos de residência legal
          contínua, o titular pode requerer residência permanente ou iniciar processo de naturalização.
        </p>

        <h2 className="s">2. Quem Pode Candidatar-se</h2>
        <p className="t">
          Cidadãos de países fora do Espaço Schengen (cidadãos UE/EEA não precisam de visto para residir
          em Portugal). Os perfis mais aprovados em 2026:
        </p>
        <p className="t">
          <strong>Reformados</strong> com pensão americana, britânica, brasileira ou alemã transferida
          regularmente para conta bancária em Portugal — o perfil com maior taxa de aprovação consular.
          {' '}<strong>Investidores com rendimentos de capital</strong>: dividendos, juros, royalties ou
          rendimentos de fundos de investimento.{' '}
          <strong>Proprietários com rendas</strong> de imóveis no país de origem ou em Portugal.{' '}
          <strong>Trabalhadores remotos</strong> com contrato ou prestação de serviços exclusivamente
          para entidades estrangeiras.{' '}
          <strong>Empreendedores</strong> que recebam dividendos de empresa constituída no estrangeiro.
        </p>

        <h2 className="s">3. Rendimento Mínimo 2026</h2>
        <p className="t">
          O rendimento exigido é indexado ao Salário Mínimo Nacional Garantido (RMNG) português — €820/mês
          em 2026. Os consulados aplicam os seguintes critérios mínimos:
        </p>
        <table className="cost-table">
          <thead><tr><th>Perfil do Requerente</th><th>Rendimento Mínimo Mensal</th><th>Rendimento Mínimo Anual</th></tr></thead>
          <tbody>
            <tr><td>Titular individual</td><td>€ 820 / mês</td><td>€ 9.840</td></tr>
            <tr><td>Casal (cônjuge dependente)</td><td>€ 1.230 / mês</td><td>€ 14.760</td></tr>
            <tr><td>Por cada filho menor dependente</td><td>+ € 246 / mês</td><td>+ € 2.952</td></tr>
            <tr><td>Recomendado para aprovação confortável</td><td>€ 1.500+ / mês</td><td>€ 18.000+</td></tr>
          </tbody>
        </table>
        <p className="t">
          Na prática, os consulados apreciam margem acima do mínimo legal. Um rendimento demonstrado de
          €1.500–€2.000/mês para um titular individual reduz significativamente o risco de recusa e pedidos
          de documentação adicional. É também indispensável comprovar que o rendimento é estável e recorrente
          — extractos bancários dos últimos 6 meses são sempre exigidos.
        </p>

        <h2 className="s">4. Processo Passo a Passo</h2>
        <div className="step-grid">
          {[
            {n:'01',t:'NIF',d:'Número de Identificação Fiscal obtido nas Finanças portuguesas ou via advogado com procuração. Pode ser feito remotamente a partir do país de origem. Prazo: 1-3 dias úteis.'},
            {n:'02',t:'Conta Bancária',d:'Abertura de conta num banco português (Millennium BCP, Santander, Novobanco, BPI). Necessário NIF + passaporte válido. Algumas contas podem ser abertas online. Prazo: 1-2 semanas.'},
            {n:'03',t:'Contrato Arrendamento / Propriedade',d:'Apresentar contrato de arrendamento em Portugal com prazo mínimo de 12 meses, escritura de imóvel próprio, ou declaração de alojamento por familiar residente em Portugal.'},
            {n:'04',t:'Seguro de Saúde',d:'Seguro válido em Portugal para toda a duração do visto, cobrindo hospitalização, evacuação e repatriamento. Obrigatório na candidatura consular. Custo típico: ~€400/ano.'},
            {n:'05',t:'Candidatura VFS Global',d:'Submeter documentação completa no centro VFS Global do país de residência. Após emissão do visto D7 (4 meses de validade), entrar em Portugal e agendar AIMA para Autorização de Residência.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">5. Documentos Necessários</h2>
        <h3 className="ss">Documentação Obrigatória</h3>
        <p className="t">
          Passaporte válido com pelo menos 6 meses de validade além da data de candidatura ·
          Formulário de visto preenchido e assinado · 2 fotografias tipo passe recentes ·
          Comprovativo de meios de subsistência: extractos bancários dos últimos 6 meses mais
          declaração de rendimentos (pensão, dividendos, contrato de trabalho remoto) ·
          Comprovativo de alojamento em Portugal (contrato de arrendamento mínimo 12 meses ou escritura) ·
          Seguro de saúde válido em Portugal com cobertura mínima €30.000 ·
          Certificado de registo criminal do país de residência com Apostila de Haia ·
          NIF português · Comprovativo de pagamento da taxa consular.
        </p>
        <h3 className="ss">Documentação Adicional Recomendada</h3>
        <p className="t">
          Declaração fiscal do último ano (IRS, Tax Return, IRPF conforme o país) ·
          Extractos de contas de investimento, pensão ou fundo com histórico de 12 meses ·
          Carta de motivação explicando os planos de vida e residência em Portugal ·
          Comprovativo de propriedade de imóveis geradores de renda (se aplicável) ·
          Histórico bancário demonstrando regularidade e estabilidade dos rendimentos.
        </p>

        <h2 className="s">6. Custos Estimados do Processo</h2>
        <table className="cost-table">
          <thead><tr><th>Item</th><th>Custo Estimado</th></tr></thead>
          <tbody>
            <tr><td>Taxa VFS Global (submissão)</td><td>€ 90</td></tr>
            <tr><td>Taxa consular (visto D7)</td><td>€ 90</td></tr>
            <tr><td>Seguro de saúde (anual)</td><td>~ € 400 / ano</td></tr>
            <tr><td>Advogado / traduções juramentadas</td><td>€ 800 – 1.500</td></tr>
            <tr><td>Apostilas e certificações</td><td>€ 100 – 300</td></tr>
            <tr><td>Taxa AIMA (Autorização de Residência)</td><td>€ 320</td></tr>
            <tr><td>Total estimado — processo completo</td><td>€ 1.300 – 2.000</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>O D7 é a porta de entrada para o regime NHR/IFICI.</strong> Uma vez residente fiscal em Portugal via D7, pode candidatar-se ao IFICI (sucessor do NHR, vigente desde 2024) e beneficiar de <strong>taxa fixa de 20% sobre rendimentos de trabalho de fonte portuguesa</strong> e isenção — ou taxa reduzida — sobre pensões e rendimentos de fonte estrangeira durante 10 anos consecutivos. Para um reformado americano com pensão de $4.000/mês, a poupança fiscal estimada supera <strong>€80.000 ao longo da década</strong> face à tributação nos EUA ou no Reino Unido.</p>
        </div>

        <h2 className="s">7. Prazo e Renovação</h2>
        <p className="t">
          O processo total divide-se em duas fases. A <strong>fase consular</strong> (no país de origem)
          tem prazo de decisão de 60 a 90 dias após entrega de documentação completa. O visto emitido tem
          validade de 4 meses — suficientes para entrar em Portugal e iniciar a segunda fase.
        </p>
        <p className="t">
          A <strong>fase AIMA</strong> (já em Portugal) consiste no agendamento para obtenção da Autorização
          de Residência (AR). A AR inicial tem validade de 2 anos. A primeira renovação é por 3 anos. Após
          5 anos de residência legal contínua, o titular pode requerer residência permanente e,
          posteriormente, a cidadania portuguesa — mediante aprovação em teste de língua portuguesa A2.
        </p>
        <p className="t">
          <strong>Presença mínima obrigatória:</strong> O titular do D7 deve residir efectivamente em
          Portugal — presença mínima de 6 meses por ano (contínuos ou interpolados) para manter a residência
          fiscal válida e os benefícios NHR/IFICI activos. A maioria dos titulares cumpre esta condição
          naturalmente, dado que escolheu Portugal como base de vida.
        </p>

        <h2 className="s">8. Agency Group — Do Visto ao Imóvel Certo</h2>
        <p className="t">
          A Agency Group acompanha clientes internacionais em todo o processo de instalação em Portugal.
          Desde a identificação do imóvel ideal para arrendamento ou compra até à coordenação com advogados
          especializados em imigração, fiscalidade NHR/IFICI e planeamento patrimonial internacional.
        </p>
        <p className="t">
          Para clientes D7, o imóvel certo é determinante: um contrato de arrendamento sólido em zona
          prime de Lisboa (€5.000/m²), Cascais (€4.713/m²) ou Algarve (€3.941/m²) serve simultaneamente
          como comprovativo de residência para o visto e como base de vida de qualidade. A Agency Group
          (AMI 22506) tem carteira exclusiva de imóveis para arrendamento de médio e longo prazo —
          e para quem prefere investir na propriedade desde o primeiro dia.
        </p>

        <div className="cta-box">
          <h3>Planeia mudar-se para Portugal com D7?</h3>
          <p>Falamos consigo sobre imóvel, advogado de imigração e regime NHR/IFICI. Sem custos, sem compromisso.</p>
          <Link href="/#contacto">Falar com a Agency Group →</Link>
        </div>
      </article>
    </>
  )
}
