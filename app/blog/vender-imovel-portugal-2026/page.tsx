import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Vender Imóvel em Portugal em 2026: Guia Completo para Proprietários · Agency Group',
  description: 'Guia completo para vender casa em Portugal 2026. Mais-valias, isenções, homestaging, CPCV, documentos, IMI, AVM gratuito. Processo passo a passo para proprietários. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/vender-imovel-portugal-2026',
    languages: {
      'x-default': 'https://www.agencygroup.pt/blog/vender-imovel-portugal-2026',
    },
  },
  openGraph: {
    title: 'Vender Imóvel em Portugal em 2026: Guia Completo para Proprietários',
    description: 'Mercado vendedor em 2026. Mais-valias, isenções, homestaging, documentos necessários, CPCV. Tudo o que precisa de saber para vender ao melhor preço.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/vender-imovel-portugal-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Vender Imóvel em Portugal em 2026: Guia Completo para Proprietários',
  description: 'Guia completo para vender casa em Portugal 2026. Mais-valias, processo, documentos e como maximizar o preço de venda.',
  author: { '@type': 'Organization', name: 'Agency Group', url: 'https://www.agencygroup.pt' },
  publisher: { '@type': 'Organization', name: 'Agency Group', '@id': 'https://www.agencygroup.pt' },
  datePublished: '2026-04-01',
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/vender-imovel-portugal-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Vender casa Portugal' },
    { '@type': 'Thing', name: 'Mais-valias imóveis Portugal' },
    { '@type': 'Thing', name: 'Vender imóvel Lisboa 2026' },
  ],
}

export default function ArticleVenderImovel() {
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
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → vender-imovel-portugal-2026
          </div>
          <div className="art-cat">Guia do Vendedor</div>
          <h1 className="art-h1">Vender Imóvel em Portugal 2026:<br/><em>Guia Completo para Proprietários</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>1 Abril 2026</span>
            <span>·</span>
            <span>15 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          2026 é um ano excepcionalmente favorável para vender imóvel em Portugal. Os preços atingiram máximos históricos (+17,6% YoY segundo o INE), a procura internacional continua a superar a oferta em todos os segmentos premium, e o prazo médio de venda desceu para 210 dias — com produtos bem posicionados a fechar em 60–90 dias. Se tem estado a ponderar vender, dificilmente haverá momento melhor na última década. Este guia cobre todo o processo: da preparação ao cheque do notário.
        </p>

        <h2 className="s">1. O Mercado em 2026 — É um Mercado de Vendedor</h2>
        <p className="t">Portugal registou 169.812 transacções em 2025 — o recorde histórico absoluto. A mediana nacional de preço subiu para €3.076/m², com Lisboa acima de €5.000/m² e Cascais a €4.713/m². A procura internacional mantém-se forte com compradores de 40+ países activos no mercado, e o segmento acima de €500K cresceu 28% em volume face a 2024.</p>
        <p className="t">Para o vendedor, este contexto é o melhor em 15 anos. A combinação de alta procura, stock reduzido em zonas prime e compradores internacionais bem capitalizados cria condições para obter preços máximos — mas apenas com a estratégia certa. Produtos mal posicionados, com fotos amadoras ou preço acima do mercado, continuam a ficar meses sem comprador.</p>

        <div className="callout">
          <p><strong>Contexto histórico:</strong> Os preços médios em Lisboa subiram 127% entre 2015 e 2026. Um apartamento comprado por €250.000 em 2015 vale hoje cerca de €567.500 — mais-valia bruta de €317.500 antes de impostos. Saber gerir esta mais-valia fiscalmente é tão importante quanto obter o melhor preço.</p>
        </div>

        <h2 className="s">2. Mais-Valias Imobiliárias — Cálculo e Isenções</h2>
        <p className="t">A mais-valia imobiliária é calculada como: Valor de Venda — Valor de Aquisição (actualizado pelo coeficiente de desvalorização monetária) — Despesas dedutíveis (obras, comissões, IMT pago na compra, etc.).</p>

        <h3 className="ss">Taxa de Mais-Valias para Residentes</h3>
        <p className="t">Para residentes fiscais em Portugal, as mais-valias imobiliárias são englobadas com outros rendimentos e tributadas à taxa marginal (pode chegar a 48%). Contudo, apenas 50% da mais-valia entra para englobamento. Na prática, a taxa efectiva situa-se entre 14% e 24% para a maioria dos contribuintes.</p>

        <h3 className="ss">Taxa de Mais-Valias para Não-Residentes</h3>
        <p className="t">Não residentes pagam 28% sobre 100% da mais-valia (sem o benefício dos 50%). Esta é uma área onde o planeamento fiscal pode fazer diferenças significativas — vale a pena consultar um fiscal antes de vender.</p>

        <h3 className="ss">Isenções Fundamentais</h3>
        <table className="cost-table">
          <thead><tr><th>Isenção</th><th>Condições</th><th>Impacto</th></tr></thead>
          <tbody>
            <tr><td>Habitação Própria e Permanente (HPP)</td><td>Venda de HPP + reinvestimento em nova HPP em 24 meses (ou 36 meses se compra antes da venda)</td><td>Isenção total da mais-valia proporcional ao valor reinvestido</td></tr>
            <tr><td>Isenção Total HPP — Residentes +65</td><td>Vendedor com +65 anos + reinvestimento em contrato de seguro, fundo de pensões ou PPR</td><td>Isenção total se reinvestir 100%</td></tr>
            <tr><td>Imóvel adquirido antes de 1989</td><td>Aquisição anterior a 1 Janeiro 1989</td><td>Isenção total — mais-valia não tributada</td></tr>
            <tr><td>Coeficiente de desvalorização monetária</td><td>Aplicado automaticamente se propriedade detida há mais de 2 anos</td><td>Reduz a mais-valia tributável em 10–40% dependendo do ano de aquisição</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>NHR + Mais-Valias:</strong> Beneficiários do regime NHR/IFICI que vendam imóvel em Portugal estão sujeitos às regras normais para residentes (50% englobamento). Contudo, o planeamento do timing da venda face ao período NHR pode optimizar a carga fiscal. Consulte sempre um advogado fiscal especializado antes de concluir qualquer transacção acima de €500K.</p>
        </div>

        <h2 className="s">3. Preparação para Venda — As Decisões que Fazem a Diferença</h2>
        <h3 className="ss">AVM — Avaliação Automática de Mercado</h3>
        <p className="t">O primeiro passo é perceber o valor justo de mercado. A Agency Group disponibiliza gratuitamente o nosso AVM (Automated Valuation Model) que cruza dados de 169.812 transacções registadas, dados de oferta activa nos principais portais, e os nossos dados exclusivos de transacções off-market. O resultado é uma estimativa de valor de mercado com intervalo de confiança e comparáveis reais — em 30 segundos, sem registo.</p>

        <h3 className="ss">Homestaging — Retorno Médio de 5–8% no Preço Final</h3>
        <p className="t">Estudos do mercado português mostram que propriedades com homestaging profissional vendem em média 23 dias mais rápido e por preços 5–8% superiores a propriedades equivalentes sem staging. Para um imóvel de €600.000, são €30.000–48.000 adicionais por um investimento de €2.000–5.000 em staging. O ROI raramente tem paralelo.</p>
        <p className="t">Princípios básicos: despersonalizar (retirar fotos pessoais, objectos muito específicos), neutralizar paleta de cores (tons creme e cinza claro), garantir luz natural máxima, e eliminar desordem. A Agency Group tem parceiros de homestaging que actuam em parceria com os nossos mandatos.</p>

        <h3 className="ss">Fotografia e Vídeo Profissional</h3>
        <p className="t">82% dos compradores de imóvel fazem a primeira selecção online, baseados exclusivamente em fotos. Fotos amadoras são o principal motivo de descarte prematuro de um imóvel que poderia ser excelente. A Agency Group inclui fotografia HDR profissional, vídeo walkthrough e planta vectorizada em todos os mandatos de venda.</p>

        <h2 className="s">4. O Preço Certo — A Variável Mais Crítica</h2>
        <p className="t">Proprietários sobrevalorizam consistentemente o seu imóvel em 12–18% face ao valor real de mercado. As razões são psicológicas (apego emocional, memórias do espaço, custo de obras realizadas) mas as consequências são práticas: o imóvel fica meses no mercado, acumula visitas sem ofertas, e eventualmente vende por menos do que teria vendido se correctamente posicionado desde o início.</p>
        <p className="t">O preço certo é o preço que maximiza o retorno no prazo razoável — não o preço mais alto possível. Um imóvel bem posicionado recebe 3–5 propostas nas primeiras semanas, criando competição entre compradores que muitas vezes eleva o preço final. Um imóvel sobreavaliado fica "queimado" no mercado e vende com desconto.</p>

        <h2 className="s">5. Processo Completo de Venda — Passo a Passo</h2>
        <div className="step-grid">
          {[
            {n:'01',t:'AVM + Estratégia de Preço',d:'Avaliação de mercado objectiva. Definição de preço de listagem, preço alvo e preço mínimo aceitável. Análise de comparáveis activos e vendidos nos últimos 6 meses.'},
            {n:'02',t:'Mandato e Preparação',d:'Assinatura de contrato de mediação (exclusivo ou não exclusivo). Homestaging, fotografia, vídeo, planta. Preparação da pasta de documentação completa antes da listagem.'},
            {n:'03',t:'Angariação e Exposição',d:'Listagem em todos os portais nacionais e internacionais. Base de dados de compradores qualificados Agency Group. Campanha digital segmentada para compradores internacionais do perfil alvo.'},
            {n:'04',t:'Visitas e Qualificação',d:'Qualificação prévia de visitantes (capacidade financeira, timeline, motivação). Visitas acompanhadas por consultor. Feedback sistematizado após cada visita.'},
            {n:'05',t:'Proposta e Negociação',d:'Gestão de propostas escritas. Negociação profissional de preço e condições. Contra-proposta fundamentada em dados de mercado. Múltiplas propostas geridas em paralelo quando aplicável.'},
            {n:'06',t:'CPCV — Contrato Promessa',d:'Redacção e revisão de CPCV por advogado. Sinal recebido (10–30% do preço). Prazo para escritura definido (tipicamente 30–90 dias). Comissão: 50% no CPCV, 50% na escritura.'},
            {n:'07',t:'Escritura e Recebimento',d:'Marcação em notário. IMT e IS pagos pelo comprador. Registo predial transferido. Vendedor recebe valor líquido via transferência bancária no acto da escritura.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">6. Documentos Necessários para Vender</h2>
        <p className="t">Ter a documentação completa antes de iniciar a venda acelera significativamente o processo e evita que uma proposta caia por falta de documentação. Lista completa:</p>
        <table className="cost-table">
          <thead><tr><th>Documento</th><th>Obtido Em</th><th>Validade</th></tr></thead>
          <tbody>
            <tr><td>Certidão de Registo Predial</td><td>Predial Online / Conservatória</td><td>6 meses</td></tr>
            <tr><td>Caderneta Predial Urbana</td><td>Portal das Finanças</td><td>1 ano</td></tr>
            <tr><td>Licença de Utilização / Habitabilidade</td><td>Câmara Municipal</td><td>Permanente</td></tr>
            <tr><td>Certificado de Desempenho Energético (CE)</td><td>Entidade Acreditada ADENE</td><td>10 anos</td></tr>
            <tr><td>Ficha Técnica de Habitação (FTH)</td><td>Câmara Municipal (imóveis pós-2004)</td><td>Permanente</td></tr>
            <tr><td>Planta do Imóvel</td><td>Câmara Municipal / Arquivo</td><td>—</td></tr>
            <tr><td>Declaração de Não Dívida ao Condomínio</td><td>Administração do Condomínio</td><td>3 meses</td></tr>
            <tr><td>Declaração Não Dívida Finanças e Segurança Social</td><td>Portal das Finanças / Segurança Social</td><td>3 meses</td></tr>
          </tbody>
        </table>

        <div className="callout">
          <p><strong>Atenção:</strong> Imóveis construídos antes de 1951 (data em que começou a obrigatoriedade de licença de utilização) estão isentos desta obrigação. Imóveis em propriedade horizontal necessitam adicionalmente do título constitutivo de propriedade horizontal e regulamento do condomínio.</p>
        </div>

        <h2 className="s">7. IMI e Responsabilidades do Vendedor</h2>
        <p className="t">O IMI (Imposto Municipal sobre Imóveis) é pago pelo proprietário referido em 31 de Dezembro do ano anterior. Se vender em Abril de 2026, o IMI de 2026 (pago em Abril ou Setembro dependendo do valor) é do comprador pro-rata ou geralmente absorvido pelo vendedor por negociação — depende das condições acordadas no CPCV.</p>
        <p className="t">Prática mais comum: IMI do ano de venda é dividido pro-rata entre vendedor e comprador na data da escritura. A Agency Group inclui esta cláusula standard em todos os CPCV que acompanha.</p>
        <p className="t">Após a escritura: o vendedor tem obrigação de declarar a mais-valia na declaração de IRS do ano seguinte à venda. A Agency Group fornece a documentação completa de suporte (valor de venda, comissão paga, despesas elegíveis) para entregar ao contabilista.</p>

        <h2 className="s">8. Consultora Boutique vs Portal — Porque Importa</h2>
        <p className="t">Há duas abordagens para vender imóvel em Portugal: listar em portais (Idealista, OLX, Imovirtual) directamente, ou trabalhar com uma consultora de mediação imobiliária. A diferença em resultados é significativa e mensurável.</p>
        <h3 className="ss">Portais Directos</h3>
        <p className="t">Gratuitamente ou com custo baixo. Exposição a compradores que fazem pesquisa nos portais. Sem qualificação prévia de visitantes — perda de tempo em visitas não qualificadas. Sem poder negocial profissional. Sem acesso a compradores internacionais que não pesquisam nos portais portugueses. Sem rede off-market.</p>
        <h3 className="ss">Consultora Boutique (Agency Group)</h3>
        <p className="t">Comissão de 5% + IVA paga pelo vendedor. Em troca: acesso à nossa base de dados de compradores internacionais activos (Americanos, Franceses, Britânicos, Chineses), exposição em plataformas internacionais (Sotheby's International, Luxuryestate, Kyero, Green-Acres), homestaging e fotografia profissional incluída, negociação profissional que tipicamente mais do que compensa a comissão, e gestão completa do processo até à escritura.</p>

        <div className="callout">
          <p><strong>Agency Group — AMI 22506:</strong> Somos uma consultora boutique especializada em imóvel premium (€500K–€3M) em Lisboa, Cascais, Porto e Comporta. Comissão de 5% + IVA paga a 50% no CPCV e 50% na escritura. Acesso à nossa base de compradores internacionais é o nosso principal diferencial competitivo.</p>
        </div>

        <h2 className="s">9. O AVM Gratuito como Ponto de Partida</h2>
        <p className="t">Antes de qualquer decisão sobre vender, o primeiro passo é perceber quanto vale realmente o seu imóvel no mercado actual. O nosso AVM gratuito está disponível na página principal — sem registo, sem compromisso, em 30 segundos.</p>
        <p className="t">O AVM Agency Group cruza dados do INE, Banco de Portugal, portais de listings activos e a nossa base de dados interna de transacções fechadas. O resultado inclui: estimativa de valor central, intervalo de confiança mínimo/máximo, comparáveis de transacções recentes, e estimativa de tempo médio de venda no estado actual do mercado.</p>
        <p className="t">Após o AVM, se quiser uma avaliação presencial detalhada (visita ao imóvel, análise de estado de conservação, recomendações de preparação para venda), os nossos consultores estão disponíveis para uma reunião gratuita sem compromisso.</p>

        <div className="cta-box">
          <h3>Quanto vale o seu imóvel hoje?</h3>
          <p>AVM gratuito em 30 segundos. Sem registo. Sem custos. Depois, se quiser avançar, os nossos consultores estão disponíveis.</p>
          <Link href="/#avaliacao">Avaliar o meu imóvel →</Link>
        </div>
      </article>
    </>
  )
}
