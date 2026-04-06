import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Propriedades de Luxo Lisboa 2026: Preços e Investimento',
  description: 'Guia completo de propriedades de luxo em Lisboa 2026. Chiado, Príncipe Real, Estrela, Santos, Parque das Nações. Preços por zona, perfil do comprador, yields e processo de compra. AMI 22506.',
  robots: 'index, follow',
  alternates: {
    canonical: 'https://www.agencygroup.pt/blog/propriedades-luxo-lisboa-2026',
    languages: {
      'en': 'https://www.agencygroup.pt/blog/luxury-property-lisbon',
      'pt': 'https://www.agencygroup.pt/blog/propriedades-luxo-lisboa-2026',
      'x-default': 'https://www.agencygroup.pt/blog/luxury-property-lisbon',
    },
  },
  openGraph: {
    title: 'Propriedades de Luxo em Lisboa 2026: Preços, Zonas e Guia de Investimento',
    description: 'Lisboa no Top 5 mundial do luxo. Chiado €7.000/m², Príncipe Real €7.400/m². Guia completo para investidores internacionais.',
    type: 'article',
    url: 'https://www.agencygroup.pt/blog/propriedades-luxo-lisboa-2026',
  },
}

const ARTICLE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Propriedades de Luxo em Lisboa 2026: Preços, Zonas e Guia de Investimento',
  description: 'Guia completo de propriedades de luxo em Lisboa 2026. Chiado, Príncipe Real, Estrela, Santos, Parque das Nações.',
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
  dateModified: '2026-04-06',
  url: 'https://www.agencygroup.pt/blog/propriedades-luxo-lisboa-2026',
  inLanguage: 'pt-PT',
  about: [
    { '@type': 'Thing', name: 'Propriedades luxo Lisboa' },
    { '@type': 'Thing', name: 'Imóveis Chiado' },
    { '@type': 'Thing', name: 'Príncipe Real imóveis' },
  ],
}

export default function ArticleLuxoLisboa() {
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
        .zona-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:32px 0}
        .zona-card{background:#fff;border:1px solid rgba(14,14,13,.08);padding:24px;border-top:3px solid #1c4a35}
        .zona-name{font-family:var(--font-cormorant),serif;font-size:1.2rem;font-weight:300;color:#1c4a35;margin-bottom:8px}
        .zona-price{font-family:var(--font-dm-mono),monospace;font-size:.8rem;color:#c9a96e;font-weight:400;margin-bottom:8px}
        .zona-desc{font-size:.8rem;line-height:1.7;color:rgba(14,14,13,.6)}
        @media(max-width:768px){nav{padding:16px 24px}.art-hero-inner,.art-content{padding-left:24px;padding-right:24px}.step-grid,.zona-grid{grid-template-columns:1fr}}
      `}</style>

      <nav>
        <Link href="/" className="logo"><span className="la">Agency</span><span className="lg">Group</span></Link>
      </nav>

      <header className="art-hero">
        <div className="art-hero-inner">
          <div className="art-breadcrumb">
            <Link href="/">agencygroup.pt</Link> → <Link href="/blog">blog</Link> → propriedades-luxo-lisboa-2026
          </div>
          <div className="art-cat">Investimento · Luxo</div>
          <h1 className="art-h1">Propriedades de Luxo em Lisboa 2026:<br/><em>Preços, Zonas e Guia de Investimento</em></h1>
          <div className="art-meta">
            <span>Agency Group · AMI 22506</span>
            <span>·</span>
            <span>1 Abril 2026</span>
            <span>·</span>
            <span>14 min leitura</span>
          </div>
        </div>
      </header>

      <article className="art-content">
        <p className="art-lead">
          Lisboa entrou definitivamente no mapa do luxo mundial. O relatório Savills World Cities Prime Residential 2026 posiciona a capital portuguesa no Top 5 global — ao lado de Londres, Nova Iorque, Hong Kong e Dubai. Com +22% de valorização YoY nos segmentos prime e yields brutas de 4,2–4,5%, Lisboa tornou-se o mercado de luxo mais atractivo da Europa Ocidental. Este guia analisa zona a zona, com preços reais de Q1 2026, perfil do comprador internacional e o processo completo de aquisição.
        </p>

        <h2 className="s">1. Porque Lisboa? O Caso de Investimento em 2026</h2>
        <p className="t">Lisboa combina uma raridade difícil de encontrar noutras capitais europeias: preço ainda acessível face a Paris ou Londres, qualidade de vida excecional, segurança, clima mediterrânico e um ecossistema fiscal (NHR/IFICI) que atrai nomes de peso da tecnologia, das finanças e das artes.</p>
        <p className="t">O mercado registou 169.812 transacções em 2025 — recorde histórico. A procura internacional mantém-se robusta, com compradores de 40+ países activos em Lisboa. O segmento acima de €1M cresceu 31% em volume face a 2024. A mediana de preço subiu +17,6% (INE Q3 2025), mas o prime de Lisboa ainda está 60–70% abaixo do equivalente em Paris ou Mónaco.</p>

        <div className="callout">
          <p><strong>Savills 2026:</strong> Lisboa foi classificada como um dos cinco mercados imobiliários de luxo com maior potencial de valorização no horizonte 2026–2028, com estimativa de +18–22% adicional em três anos nos activos prime.</p>
        </div>

        <h2 className="s">2. Zonas Prime — Preços e Características</h2>
        <p className="t">Lisboa é uma cidade de bairros com identidade própria. Cada zona tem o seu carácter, a sua demografia internacional, e o seu tecto de preço. Em Q1 2026:</p>

        <div className="zona-grid">
          {[
            {name:'Chiado',price:'€6.800–7.200/m²',desc:'O endereço mais desejado. Comércio de luxo, restauração Michelin, vistas sobre o Tejo. Apartamentos com pé-direito alto e janelas de sacada. Escassez total de produto.'},
            {name:'Príncipe Real',price:'€7.000–7.800/m²',desc:'O bairro mais caro de Lisboa. Palacetes renovados, jardim histórico, comunidade criativa internacional. Mercado extremamente restrito — menos de 20 transacções/ano acima de €1M.'},
            {name:'Estrela / Lapa',price:'€6.200–6.800/m²',desc:'Tradicional zona de embaixadas. Moradias com jardim, apartamentos amplos, proximidade com Santos e o Tejo. Preferido por famílias internacionais.'},
            {name:'Santos / Alcântara',price:'€5.500–6.000/m²',desc:'Bairro em acelerada valorização. Lofts industriais convertidos, rooftops, proximidade com LX Factory. Atrai jovens executivos e nómadas digitais de alto poder de compra.'},
            {name:'Parque das Nações',price:'€4.800–5.600/m²',desc:'O bairro moderno de Lisboa. Arquitectura contemporânea, marina, congresso. Óptimo para famílias com crianças. Liquidez de arrendamento excecional.'},
            {name:'Belém',price:'€5.200–5.800/m²',desc:'Zona histórica com novo mercado imobiliário. Moradias com jardim, vistas para o Tejo, proximidade com Cascais pela A5. Produtos únicos impossíveis de replicar.'},
          ].map(z=>(
            <div key={z.name} className="zona-card">
              <div className="zona-name">{z.name}</div>
              <div className="zona-price">{z.price}</div>
              <p className="zona-desc">{z.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="s">3. Tabela Comparativa de Preços por Zona (Q1 2026)</h2>
        <table className="cost-table">
          <thead>
            <tr>
              <th>Zona</th>
              <th>Preço Médio/m²</th>
              <th>Mínimo €1M+</th>
              <th>Yield Bruta</th>
              <th>Valorizaçao YoY</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Príncipe Real</td><td>€7.400/m²</td><td>~135m²</td><td>3,8–4,2%</td><td>+24%</td></tr>
            <tr><td>Chiado</td><td>€7.000/m²</td><td>~143m²</td><td>4,0–4,4%</td><td>+22%</td></tr>
            <tr><td>Estrela / Lapa</td><td>€6.500/m²</td><td>~154m²</td><td>4,2–4,5%</td><td>+20%</td></tr>
            <tr><td>Belém</td><td>€5.500/m²</td><td>~182m²</td><td>4,3–4,6%</td><td>+19%</td></tr>
            <tr><td>Santos / Alcântara</td><td>€5.800/m²</td><td>~172m²</td><td>4,5–5,0%</td><td>+21%</td></tr>
            <tr><td>Parque das Nações</td><td>€5.200/m²</td><td>~192m²</td><td>4,8–5,2%</td><td>+17%</td></tr>
          </tbody>
        </table>

        <h2 className="s">4. Perfil do Comprador Internacional em Lisboa</h2>
        <p className="t">O comprador de luxo em Lisboa é cada vez mais sofisticado e diversificado. Em 2025, registámos compradores de 43 nacionalidades diferentes em transacções acima de €500.000. Os principais grupos:</p>

        <div className="step-grid">
          {[
            {n:'16%',t:'Norte-Americanos',d:'Maior grupo em crescimento. Atraídos pelo câmbio favorável USD/EUR, NHR/IFICI, qualidade de vida e segurança. Preferem Chiado, Príncipe Real e Parque das Nações.'},
            {n:'13%',t:'Franceses',d:'Historicamente presentes em Lisboa. Fogem da carga fiscal francesa. Adoram Mouraria, Alfama, Príncipe Real. Muitos são compradores repetidos com 2-3 imóveis.'},
            {n:'9%',t:'Britânicos',d:'Pós-Brexit, Lisboa tornou-se alternativa a Barcelona. Preferem Cascais e Estoril, mas forte presença em Santos e Estrela. Muitos trazem filhos para escolas internacionais.'},
            {n:'8%',t:'Chineses',d:'Family offices e HNWI. Tickets médios mais elevados (€2M–€5M). Preferem produto novo de promotor. Parque das Nações e Belém são favoritos.'},
            {n:'6%',t:'Brasileiros',d:'Maior grupo na faixa €300K–€800K. Mas crescente presença no luxo acima de €1M. Chiado e Príncipe Real são os bairros preferidos.'},
            {n:'5%',t:'Alemães',d:'Perfil conservador, processo de decisão longo, preferência por apartamentos em excelente estado. Valorizam localização histórica e eficiência energética.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">5. Retornos e Performance do Investimento</h2>
        <p className="t">Lisboa oferece três tipos de retorno simultâneos, o que a torna única no panorama europeu:</p>
        <h3 className="ss">Yield de Arrendamento</h3>
        <p className="t">Arrendamento de longa duração em zonas prime gera 3,8–4,5% brutos. Arrendamento de curta duração (Airbnb/VRBO) em zonas turísticas como Chiado, Baixa ou Alfama pode atingir 6–8% brutos, mas exige licenciamento Alojamento Local e gestão activa — ou via empresa especializada.</p>
        <h3 className="ss">Valorização de Capital</h3>
        <p className="t">O segmento prime de Lisboa valorizou +22% em 2025 (YoY). A projecção Savills para 2026–2028 aponta para +18–22% adicional acumulado, impulsionado pela escassez estrutural de produto em zonas históricas e pela continuação da procura internacional.</p>
        <h3 className="ss">Benefício Fiscal NHR/IFICI</h3>
        <p className="t">Compradores que estabeleçam residência fiscal em Portugal podem beneficiar do regime IFICI (sucessor do NHR) — taxa fixa de 20% sobre rendimentos de fonte portuguesa e isenção de rendimentos estrangeiros durante 10 anos. Para um investidor com rendimentos de €500K/ano, a poupança fiscal pode ultrapassar €100K anuais.</p>

        <div className="callout">
          <p><strong>Cálculo exemplo:</strong> Apartamento no Chiado por €1.200.000 — yield bruta 4,2% = €50.400/ano. Valorização estimada +20% em 3 anos = +€240.000 de capital. Retorno total no triénio: ~€391.200 (+32,6% sobre o capital investido, excluindo custos de transacção).</p>
        </div>

        <h2 className="s">6. Processo de Compra em Lisboa — Passo a Passo</h2>
        <div className="step-grid">
          {[
            {n:'01',t:'NIF + Representante',d:'Necessário para qualquer transacção. Obtenção em 1-2 dias via Serviço de Finanças ou advogado. Não residentes precisam de representante fiscal em Portugal.'},
            {n:'02',t:'Due Diligence',d:'Verificação de registo predial, caderneta predial, licença de utilização, dívidas ao condomínio e fisco, certificado energético. Advogado especializado recomendado.'},
            {n:'03',t:'Proposta de Compra',d:'Proposta por escrito com prazo de resposta 48-72h. A Agency Group usa o Deal Radar para determinar a oferta óptima baseada em 16 variáveis de mercado.'},
            {n:'04',t:'CPCV — 10-30% Sinal',d:'Contrato-promessa com sinal de 10-30%. Comissão Agency Group (5% + IVA) paga pelo vendedor. Prazo médio CPCV→Escritura: 45-90 dias.'},
            {n:'05',t:'IMT + IS',d:'Pagamento dos impostos antes da escritura. IMT: tabela progressiva até 7,5%. IS: 0,8%. Para €1.200.000: IMT ~€72.000 + IS €9.600 (estimativa).'},
            {n:'06',t:'Escritura + Registo',d:'Outorgada em notário. Registo na Conservatória Predial. Posse imediata. Processo completo: 60-120 dias desde proposta aceite.'},
          ].map(s=>(
            <div key={s.n} className="step-card">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.t}</div>
              <p className="step-d">{s.d}</p>
            </div>
          ))}
        </div>

        <h2 className="s">7. Custos de Aquisição — Imóvel de €1.200.000</h2>
        <table className="cost-table">
          <thead><tr><th>Custo</th><th>Base de Cálculo</th><th>Valor Estimado</th></tr></thead>
          <tbody>
            <tr><td>IMT (Imposto Municipal sobre Transmissões)</td><td>Tabela progressiva — 7,5% sobre €1,2M</td><td>€ 90.000</td></tr>
            <tr><td>IS (Imposto de Selo)</td><td>0,8% sobre preço</td><td>€ 9.600</td></tr>
            <tr><td>Registo Predial + Notário</td><td>Fixo + variável</td><td>€ 2.000–3.000</td></tr>
            <tr><td>Advogado</td><td>0,5–1% do preço</td><td>€ 6.000–12.000</td></tr>
            <tr><td>Comissão de Mediação</td><td>Paga pelo vendedor</td><td>€ 0</td></tr>
            <tr><td>Total Custos de Aquisição</td><td>~8,5–9% do preço</td><td>€ 107.600–114.600</td></tr>
          </tbody>
        </table>

        <h2 className="s">8. Outlook Lisboa 2026–2027</h2>
        <p className="t">Os fundamentos do mercado de luxo lisboeta continuam sólidos. A oferta nova em zonas históricas é estruturalmente limitada por restrições de reabilitação urbana e PDM. A procura internacional mantém-se acima dos níveis pré-pandémicos em todos os segmentos acima de €500K.</p>
        <p className="t">Os catalisadores de valorização para 2026–2027 incluem: consolidação do hub tecnológico lisboeta (Web Summit, Google, Microsoft), expansão do Metro (linha Rubi, linha Circular), novos projetos hoteleiros de ultra-luxo (Aman, Rosewood), e crescimento continuado do turismo de luxo (+28% em 2025 vs 2024).</p>
        <p className="t">O maior risco identificado é a possível alteração do regime IFICI por pressão política — mas qualquer mudança terá período de transição protegido para quem já beneficia do regime. Para quem ainda não tem residência fiscal portuguesa, a janela de entrada IFICI pode ter prazo.</p>

        <div className="callout">
          <p><strong>Off-Market em Lisboa:</strong> Estimamos que 35–45% das transacções no segmento prime de Lisboa (acima de €800K) nunca chegam a portais públicos. São vendas silenciosas entre redes de consultores, geralmente a preços ligeiramente inferiores ao mercado em troca de rapidez e discrição. A Agency Group tem acesso a este inventário exclusivo.</p>
        </div>

        <div className="cta-box">
          <h3>Encontre a sua propriedade de luxo em Lisboa</h3>
          <p>AVM gratuito, acesso off-market exclusivo e consultoria personalizada. Sem custos para o comprador.</p>
          <Link href="/imoveis">Ver Imóveis Disponíveis →</Link>
        </div>
      </article>
    </>
  )
}
