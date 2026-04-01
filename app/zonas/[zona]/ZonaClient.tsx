'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZoneData {
  nome: string
  nomeEn: string
  preco: number
  primePraco: number
  yoy: number
  yield: number
  yieldTur: number
  vol: number
  emoji: string
  bairros: string[]
  desc: string
  drivers: string[]
  forecast: string
  compradores: string[]
  faq: { q: string; a: string }[]
}

interface ZoneRecord {
  [key: string]: ZoneData
}

// ─── Zone Data ───────────────────────────────────────────────────────────────

const ZONES: ZoneRecord = {
  lisboa: {
    nome: 'Lisboa', nomeEn: 'Lisbon',
    preco: 5000, primePraco: 8500, yoy: 14, yield: 3.2, yieldTur: 4.8, vol: 18420,
    emoji: '🏛',
    bairros: ['Chiado', 'Príncipe Real', 'Avenida da Liberdade', 'Campo de Ourique', 'Belém', 'Parque das Nações'],
    desc: 'Capital europeia com mercado prime de classe mundial. Liquidez máxima, procura internacional crescente, infraestrutura world-class.',
    drivers: ['Capital nacional · procura institucional', 'Turismo 7.8M visitantes/ano', 'Hub tecnológico europeu', 'Reconversão de edifícios históricos'],
    forecast: '€5.800/m² em 2027',
    compradores: ['🇺🇸 Norte-americanos 18%', '🇫🇷 Franceses 15%', '🇬🇧 Britânicos 10%', '🇨🇳 Chineses 9%'],
    faq: [
      { q: 'Qual o preço médio por m² em Lisboa em 2026?', a: 'O preço médio em Lisboa situa-se nos €5.000/m² em 2026, com zonas prime como Chiado e Príncipe Real a atingir €8.500/m².' },
      { q: 'Vale a pena investir em imóveis em Lisboa?', a: 'Sim. Lisboa apresenta um yield bruto de 3,2% (4,8% em arrendamento turístico), valorização anual de 14% e liquidez elevada com 18.420 transações em 2025.' },
      { q: 'Quais os melhores bairros para comprar em Lisboa?', a: 'Chiado, Príncipe Real e Avenida da Liberdade para luxo prime. Belém e Campo de Ourique para value. Parque das Nações para moderno e familiar.' },
    ],
  },
  cascais: {
    nome: 'Cascais', nomeEn: 'Cascais',
    preco: 4713, primePraco: 7200, yoy: 12, yield: 3.8, yieldTur: 5.2, vol: 4820,
    emoji: '🏖',
    bairros: ['Cascais Vila', 'Estoril', 'Quinta da Marinha', 'Birre', 'São João do Estoril', 'Alcabideche'],
    desc: 'A Riviera portuguesa. Lifestyle premium, golfe world-class, praias, e a 30 minutos de Lisboa. Preferência de compradores norte-americanos e britânicos.',
    drivers: ['Lifestyle premium · golfe · praias', 'Escola internacional AIS', '30 min Lisboa Marquês de Pombal', 'Comunidade expatriada consolidada'],
    forecast: '€5.400/m² em 2027',
    compradores: ['🇺🇸 Norte-americanos 22%', '🇬🇧 Britânicos 18%', '🇫🇷 Franceses 11%', '🇧🇷 Brasileiros 8%'],
    faq: [
      { q: 'Qual o preço médio por m² em Cascais?', a: 'O preço médio em Cascais é de €4.713/m² em 2026, com villas prime em Quinta da Marinha e Estoril entre €6.000–€7.200/m².' },
      { q: 'Cascais é boa opção para família expatriada?', a: 'Excelente. Cascais tem o International College (American International School), comunidade anglófona estabelecida, segurança máxima e qualidade de vida superior.' },
      { q: 'Quanto custa uma moradia em Cascais?', a: 'Moradias em Cascais variam entre €800K e €5M+. Em Quinta da Marinha as villas de luxo situam-se entre €1.5M e €4M.' },
    ],
  },
  algarve: {
    nome: 'Algarve', nomeEn: 'Algarve',
    preco: 3941, primePraco: 6500, yoy: 11, yield: 4.8, yieldTur: 7.2, vol: 12340,
    emoji: '☀️',
    bairros: ['Lagos', 'Portimão', 'Vilamoura', 'Albufeira', 'Vale do Lobo', 'Quinta do Lago'],
    desc: 'O destino de sol e golfe mais procurado da Europa. Yield turístico até 7,2%, crescimento constante e liquidez superior em resort de luxo.',
    drivers: ['300 dias de sol/ano', 'Golf resort world-class (Quinta do Lago)', 'Aluguer turístico premium', 'Aeroporto Faro com ligações directas'],
    forecast: '€4.600/m² em 2027',
    compradores: ['🇬🇧 Britânicos 28%', '🇩🇪 Alemães 15%', '🇫🇷 Franceses 12%', '🇮🇪 Irlandeses 9%'],
    faq: [
      { q: 'Qual o yield de arrendamento turístico no Algarve?', a: 'O yield turístico no Algarve varia entre 5,5% e 7,2% dependendo da localização, com Quinta do Lago e Vale do Lobo no topo.' },
      { q: 'Vale mais comprar em Vilamoura ou Quinta do Lago?', a: 'Quinta do Lago oferece maior exclusividade e yield superior. Vilamoura tem mais liquidez e variedade de preços. Para investimento puro, Quinta do Lago supera.' },
      { q: 'O Algarve é bom para viver o ano todo?', a: 'Sim. Cada vez mais residentes permanentes. Excelentes serviços de saúde, escolas internacionais (Vilamoura), e comunidade europeia cosmopolita.' },
    ],
  },
  porto: {
    nome: 'Porto', nomeEn: 'Porto',
    preco: 3643, primePraco: 5800, yoy: 12, yield: 4.1, yieldTur: 6.1, vol: 8920,
    emoji: '🍷',
    bairros: ['Foz do Douro', 'Matosinhos', 'Boavista', 'Bonfim', 'Miragaia', 'Cedofeita'],
    desc: 'A segunda maior cidade de Portugal, com carisma único, crescimento acelerado e preços ainda 27% abaixo de Lisboa. A oportunidade da próxima década.',
    drivers: ['Preços 27% abaixo Lisboa', 'Crescimento tecnológico (Web Summit Norte)', 'Aeroporto Francisco Sá Carneiro top europeu', 'Património UNESCO + turismo crescente'],
    forecast: '€4.200/m² em 2027',
    compradores: ['🇫🇷 Franceses 20%', '🇧🇷 Brasileiros 18%', '🇺🇸 Norte-americanos 12%', '🇬🇧 Britânicos 9%'],
    faq: [
      { q: 'Porto ou Lisboa para investimento imobiliário?', a: 'Porto oferece maior upside (preços 27% abaixo de Lisboa), yield superior (4.1% vs 3.2%) e crescimento acelerado. Lisboa tem mais liquidez e procura prime.' },
      { q: 'Qual o melhor bairro para comprar no Porto?', a: 'Foz do Douro para luxo costeiro. Boavista para modernidade e serviços. Bonfim e Cedofeita para gentrificação e retorno de reabilitação.' },
      { q: 'Qual o preço por m² no Porto em 2026?', a: 'O preço médio no Porto é €3.643/m². Na Foz do Douro os preços prime situam-se entre €5.000–€5.800/m².' },
    ],
  },
  madeira: {
    nome: 'Madeira', nomeEn: 'Madeira',
    preco: 3760, primePraco: 5200, yoy: 18, yield: 4.5, yieldTur: 6.8, vol: 3240,
    emoji: '🌺',
    bairros: ['Funchal', 'Câmara de Lobos', 'Santa Cruz', 'Calheta', 'Ponta do Sol', 'Machico'],
    desc: 'A ilha de crescimento mais rápido da Europa. +18% YoY, clima ameno 365 dias, nenhum imposto municipal sobre mais-valias em certos regimes, e digitalização acelerada.',
    drivers: ['Clima 22°C média anual', '+18% valorização YoY (mais alto de Portugal)', 'Regime fiscal IFICI vantajoso', 'Nómadas digitais e remote workers crescente'],
    forecast: '€4.400/m² em 2027',
    compradores: ['🇩🇪 Alemães 25%', '🇬🇧 Britânicos 20%', '🇫🇷 Franceses 14%', '🇳🇱 Holandeses 10%'],
    faq: [
      { q: 'Vale a pena investir em imóveis na Madeira?', a: 'Absolutamente. A Madeira lidera a valorização em Portugal (+18% YoY), tem regime fiscal IFICI vantajoso, e procura internacional crescente de alemães e britânicos.' },
      { q: 'Qual o preço dos imóveis na Madeira?', a: 'O preço médio na Madeira é €3.760/m², com apartamentos prime no Funchal a €5.200/m². Muito abaixo do potencial vs mercado europeu comparável.' },
      { q: 'Madeira tem boa conexão aérea?', a: 'Sim. O Aeroporto do Funchal tem voos diretos para mais de 30 destinos europeus, incluindo Frankfurt, Londres, Paris, Amesterdão e Lisboa (1h15).' },
    ],
  },
  comporta: {
    nome: 'Comporta', nomeEn: 'Comporta',
    preco: 4200, primePraco: 9500, yoy: 22, yield: 4.0, yieldTur: 6.5, vol: 820,
    emoji: '🌾',
    bairros: ['Comporta', 'Carvalhal', 'Melides', 'Grândola', 'Tróia', 'Alcácer do Sal'],
    desc: 'O St. Tropez português. O mercado de maior crescimento em Portugal (+22% YoY). Edição limitada de natureza preservada, luxo discreto e compradores HNWI globais.',
    drivers: ['Natureza preservada (UNESCO candidata)', '+22% YoY — líder de crescimento', 'Compradores HNWI/celebrity nacionais e internacionais', 'Supply ultra-limitado (construção restrita)'],
    forecast: '€5.200/m² em 2027',
    compradores: ['🇺🇸 Norte-americanos 25%', '🇫🇷 Franceses 20%', '🇬🇧 Britânicos 15%', '🇵🇹 Portugueses HNWI 15%'],
    faq: [
      { q: 'Por que é que Comporta é tão cara?', a: 'Supply ultra-limitado (construção muito restrita por regulamentação ambiental), natureza preservada única, e procura de HNWI globais que procuram exclusividade e anonimato.' },
      { q: 'Quanto custa uma moradia em Comporta?', a: 'Moradias em Comporta variam entre €800K e €6M+. Herdades exclusivas com piscina e arrozais chegam aos €10M. Preços médios de terrenos: €500–€800/m².' },
      { q: 'Comporta é boa para arrendamento turístico?', a: 'Excelente. Yield turístico de 6.5% com ocupação sazonal premium (verão) e crescente procura de semanas completas. Preços de aluguer: €3.000–€12.000/semana.' },
    ],
  },
  sintra: {
    nome: 'Sintra', nomeEn: 'Sintra',
    preco: 3200, primePraco: 5500, yoy: 9, yield: 3.5, yieldTur: 5.0, vol: 2840,
    emoji: '🏰',
    bairros: ['Sintra Vila', 'São Pedro de Penaferrim', 'Colares', 'Almoçageme', 'Azenhas do Mar', 'Monserrate'],
    desc: 'Património UNESCO, palácios reais e natureza serrana a 25 minutos de Lisboa. O destino de lifestyle mais procurado por famílias de alto rendimento.',
    drivers: ['UNESCO World Heritage Site', '25 min Lisboa (IC19 / comboio)', 'Natureza serrana · microclima fresco', 'Comunidade artística e literária consolidada'],
    forecast: '€3.700/m² em 2027',
    compradores: ['🇵🇹 Portugueses premium 30%', '🇬🇧 Britânicos 18%', '🇫🇷 Franceses 15%', '🇩🇪 Alemães 12%'],
    faq: [
      { q: 'Sintra é boa para viver com família?', a: 'Excelente. Sintra é considerada uma das melhores localizações para famílias em Portugal: natureza, segurança, escolas de qualidade, e a 25 minutos de Lisboa.' },
      { q: 'Qual o preço por m² em Sintra?', a: 'O preço médio em Sintra é €3.200/m², com quintas e palacetes históricos a €5.000–€5.500/m². Ainda 36% abaixo de Lisboa para uma qualidade de vida superior.' },
      { q: 'Sintra tem bons transportes para Lisboa?', a: 'Sim. Comboio direto Sintra-Lisboa (25-40 min) frequente. IC19 de carro em 30-45 min. Crescente teletrabalho tornou Sintra num hub de lifestyle premium.' },
    ],
  },
  ericeira: {
    nome: 'Ericeira', nomeEn: 'Ericeira',
    preco: 2800, primePraco: 4500, yoy: 15, yield: 4.2, yieldTur: 6.0, vol: 1240,
    emoji: '🏄',
    bairros: ['Ericeira', 'Mafra', 'Ribamar', 'São Julião', 'Carvoeira', 'Encarnação'],
    desc: 'Reserva Mundial de Surf e destino de surf lifestyle em rápido crescimento. +15% YoY. A 40 minutos de Lisboa com identidade única, preços de entrada e forte comunidade international.',
    drivers: ['Única Reserva Mundial de Surf da Europa', '+15% YoY — crescimento acelerado', 'Comunidade surf/wellness/digital nomad', '40 min Lisboa A21'],
    forecast: '€3.300/m² em 2027',
    compradores: ['🇺🇸 Norte-americanos 20%', '🇬🇧 Britânicos 18%', '🇦🇺 Australianos 12%', '🇩🇪 Alemães 10%'],
    faq: [
      { q: 'Ericeira é boa para investimento imobiliário?', a: 'Muito. +15% YoY, preços de entrada mais baixos que Lisboa/Cascais, yield turístico de 6%, e identidade única de surf que atrai compradores internacionais jovens e premium.' },
      { q: 'Qual o preço por m² em Ericeira?', a: 'O preço médio é €2.800/m² — o mais acessível dos mercados prime do Eixo Lisboa. Apartamentos T2 de qualidade entre €350K–€600K. Grande oportunidade de entrada.' },
      { q: 'Ericeira é longe de Lisboa?', a: 'Apenas 40 minutos de Lisboa pela A21. Com teletrabalho crescente, muitas famílias e profissionais escolhem Ericeira para qualidade de vida superior mantendo acesso a Lisboa.' },
    ],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
const fmtEur = (n: number) => '€' + fmt(n)

// Extract numeric percentage from buyer string like "🇺🇸 Norte-americanos 18%"
function buyerPct(str: string): number {
  const m = str.match(/(\d+)%/)
  return m ? parseInt(m[1], 10) : 0
}

function buyerLabel(str: string): string {
  return str.replace(/\d+%/, '').trim()
}

// ─── Client Component ────────────────────────────────────────────────────────

export default function ZonaClient({ zona }: { zona: string }) {
  const z = ZONES[zona]

  if (!z) {
    notFound()
  }

  // Calculator state
  const [budget, setBudget] = useState(500000)
  const [ltv, setLtv] = useState(60)
  const [horizon, setHorizon] = useState(5)
  const [tipoRenda, setTipoRenda] = useState<'longa' | 'turistica'>('longa')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const calc = useMemo(() => {
    const yieldRate = (tipoRenda === 'turistica' ? z.yieldTur : z.yield) / 100
    const ltvDec = ltv / 100
    const equity = budget * (1 - ltvDec)
    const emprestimo = budget * ltvDec
    const imt = budget * 0.065
    const is = budget * 0.008
    const outrosCustos = 5000
    const totalInvestido = equity + imt + is + outrosCustos
    const rendaBruta = budget * yieldRate
    const rendaLiquida = rendaBruta - budget * 0.012
    const tanAnual = 0.035
    const tanMensal = tanAnual / 12
    const nPag = horizon * 12
    const prestacao = emprestimo > 0
      ? emprestimo * (tanMensal * Math.pow(1 + tanMensal, nPag)) / (Math.pow(1 + tanMensal, nPag) - 1)
      : 0
    const cashFlowMensal = rendaLiquida / 12 - prestacao
    const apreciacaoAnual = z.yoy / 100 * 0.5
    const valorFinal = budget * Math.pow(1 + apreciacaoAnual, horizon)
    const totalReturn = (valorFinal - budget) + rendaLiquida * horizon
    const irr = totalInvestido > 0
      ? (Math.pow((totalReturn + totalInvestido) / totalInvestido, 1 / horizon) - 1) * 100
      : 0
    const cashOnCash = totalInvestido > 0 ? rendaLiquida / totalInvestido * 100 : 0
    return {
      equity, emprestimo, imt, is, outrosCustos, totalInvestido,
      rendaBruta, rendaLiquida, prestacao, cashFlowMensal,
      valorFinal, totalReturn, irr, cashOnCash, apreciacaoAnual,
    }
  }, [budget, ltv, horizon, tipoRenda, z])

  // JSON-LD schemas
  const schemaFAQ = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: z.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const schemaLocalBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://agencygroup.pt/zonas/${zona}#localbusiness`,
    name: `Agency Group — Imóveis em ${z.nome}`,
    description: z.desc,
    url: `https://agencygroup.pt/zonas/${zona}`,
    telephone: '+351919948986',
    email: 'geral@agencygroup.pt',
    address: {
      '@type': 'PostalAddress',
      addressLocality: z.nome,
      addressCountry: 'PT',
    },
    priceRange: '€€€€',
    areaServed: z.nome,
    sameAs: ['https://agencygroup.pt'],
  }

  // Colours & tokens
  const C = {
    dark: '#0c1f15',
    light: '#f4f0e6',
    gold: '#c9a96e',
    green: '#1c4a35',
    text: '#0e0e0d',
    muted: 'rgba(14,14,13,.45)',
    border: 'rgba(14,14,13,.10)',
    goldAlpha: 'rgba(201,169,110,.15)',
    darkBorder: 'rgba(201,169,110,.12)',
  }

  return (
    <>
      {/* ── Fonts + Global Reset ─────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@200;300;400;500&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Jost',sans-serif;background:${C.light};color:${C.text};-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(14,14,13,.15)}
        input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:3px;background:rgba(14,14,13,.12);border-radius:2px;outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:${C.green};cursor:pointer}
        @media(max-width:768px){
          .mob-col{flex-direction:column!important}
          .mob-full{width:100%!important}
          .mob-hide{display:none!important}
          .mob-p{padding:40px 24px!important}
          .mob-grid-1{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── JSON-LD ──────────────────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaLocalBusiness) }}
      />

      {/* ══════════════════════════════════════════════════════════════════
          01 — NAV
      ══════════════════════════════════════════════════════════════════ */}
      <nav style={{
        background: C.dark,
        borderBottom: `1px solid ${C.darkBorder}`,
        padding: '24px 64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.2rem', letterSpacing: '.35em', textTransform: 'uppercase', color: C.gold, lineHeight: 1 }}>Agency</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '.6rem', letterSpacing: '.6em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginTop: '2px' }}>Group</div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/zonas/lisboa" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.15em', textTransform: 'uppercase', color: zona === 'lisboa' ? C.gold : 'rgba(244,240,230,.45)', textDecoration: 'none' }}>Lisboa</Link>
          <Link href="/zonas/cascais" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.15em', textTransform: 'uppercase', color: zona === 'cascais' ? C.gold : 'rgba(244,240,230,.45)', textDecoration: 'none' }}>Cascais</Link>
          <Link href="/zonas/algarve" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.15em', textTransform: 'uppercase', color: zona === 'algarve' ? C.gold : 'rgba(244,240,230,.45)', textDecoration: 'none' }}>Algarve</Link>
          <Link href="/zonas/porto" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.15em', textTransform: 'uppercase', color: zona === 'porto' ? C.gold : 'rgba(244,240,230,.45)', textDecoration: 'none' }}>Porto</Link>
          <Link href="/zonas/madeira" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.15em', textTransform: 'uppercase', color: zona === 'madeira' ? C.gold : 'rgba(244,240,230,.45)', textDecoration: 'none' }} className="mob-hide">Madeira</Link>
          <a
            href="https://wa.me/351919948986"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: C.gold,
              color: C.dark,
              fontFamily: "'DM Mono',monospace",
              fontSize: '.42rem',
              letterSpacing: '.15em',
              textTransform: 'uppercase',
              padding: '10px 20px',
              textDecoration: 'none',
              display: 'block',
            }}
          >
            Contactar
          </a>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          02 — HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: C.dark,
        padding: '100px 64px 80px',
        position: 'relative',
        overflow: 'hidden',
      }} className="mob-p">
        {/* Background accent */}
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: '40%',
          height: '100%',
          background: 'radial-gradient(ellipse at top right, rgba(201,169,110,.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
          <Link href="/" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,240,230,.3)', textDecoration: 'none' }}>Agency Group</Link>
          <span style={{ color: 'rgba(244,240,230,.2)', fontSize: '.7rem' }}>›</span>
          <Link href="/zonas" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(244,240,230,.3)', textDecoration: 'none' }}>Zonas</Link>
          <span style={{ color: 'rgba(244,240,230,.2)', fontSize: '.7rem' }}>›</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: C.gold }}>{z.nome}</span>
        </div>

        <div style={{ maxWidth: '900px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.25em', textTransform: 'uppercase', color: C.gold, marginBottom: '16px' }}>
            Guia de Mercado 2026
          </div>
          <h1 style={{
            fontFamily: "'Cormorant',serif",
            fontWeight: 300,
            fontSize: 'clamp(3.2rem, 7vw, 6rem)',
            lineHeight: 1.0,
            color: C.light,
            letterSpacing: '-.01em',
            marginBottom: '24px',
          }}>
            {z.emoji} Imóveis em<br />
            <em style={{ color: C.gold, fontStyle: 'italic' }}>{z.nome}</em>
          </h1>
          <p style={{
            fontFamily: "'Jost',sans-serif",
            fontWeight: 300,
            fontSize: '1.1rem',
            lineHeight: 1.7,
            color: 'rgba(244,240,230,.7)',
            maxWidth: '620px',
            marginBottom: '48px',
          }}>
            {z.desc}
          </p>

          {/* Hero Stats Row */}
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }} className="mob-col">
            {[
              { label: 'Preço médio/m²', value: `€${fmt(z.preco)}`, sub: `Prime: €${fmt(z.primePraco)}` },
              { label: 'Valorização YoY', value: `+${z.yoy}%`, sub: '2025 → 2026' },
              { label: 'Yield bruto', value: `${z.yield}%`, sub: `Turístico: ${z.yieldTur}%` },
              { label: 'Previsão 2027', value: z.forecast, sub: 'Conservador' },
            ].map((s) => (
              <div key={s.label} style={{ borderLeft: `2px solid ${C.gold}`, paddingLeft: '20px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(244,240,230,.4)', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: C.gold, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(244,240,230,.3)', marginTop: '4px' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          03 — ZONA EM NÚMEROS
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: C.light, padding: '80px 64px' }} className="mob-p">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold, marginBottom: '8px' }}>01 — Dados de Mercado</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: C.dark, marginBottom: '48px' }}>
            {z.nome} em Números
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '24px',
          }} className="mob-grid-1">
            {[
              {
                label: 'Preço médio por m²',
                value: `€${fmt(z.preco)}`,
                sub: `Prime: €${fmt(z.primePraco)}/m²`,
                accent: C.gold,
              },
              {
                label: 'Valorização anual',
                value: `+${z.yoy}%`,
                sub: 'YoY 2025–2026',
                accent: '#2d7a56',
              },
              {
                label: 'Yield arrendamento',
                value: `${z.yield}%`,
                sub: `Turístico: ${z.yieldTur}%`,
                accent: C.green,
              },
              {
                label: 'Volume transações',
                value: fmt(z.vol),
                sub: 'Unidades em 2025',
                accent: C.text,
              },
            ].map((card) => (
              <div key={card.label} style={{
                background: '#fff',
                border: `1px solid ${C.border}`,
                borderTop: `3px solid ${card.accent}`,
                padding: '28px 24px',
              }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginBottom: '12px' }}>{card.label}</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '2.4rem', color: card.accent, lineHeight: 1, marginBottom: '8px' }}>{card.value}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: C.muted }}>{card.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          04 — BAIRROS & MICROZONAS
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#f9f6ef', padding: '80px 64px', borderTop: `1px solid ${C.border}` }} className="mob-p">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold, marginBottom: '8px' }}>02 — Microzonas</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: C.dark, marginBottom: '12px' }}>
            Bairros de {z.nome}
          </h2>
          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, color: C.muted, marginBottom: '48px', maxWidth: '520px', lineHeight: 1.7 }}>
            Cada microzona tem dinâmica própria de preços, perfil de comprador e potencial de valorização.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
          }} className="mob-grid-1">
            {z.bairros.map((bairro, i) => (
              <div key={bairro} style={{
                background: '#fff',
                border: `1px solid ${C.border}`,
                padding: '24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                transition: 'border-color .2s',
                cursor: 'default',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: i % 2 === 0 ? C.green : C.dark,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: C.gold }}>0{i + 1}</span>
                </div>
                <div>
                  <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 400, fontSize: '1.1rem', color: C.dark, marginBottom: '6px' }}>{bairro}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.08em', color: C.muted }}>
                    €{fmt(Math.round(z.preco * (0.9 + i * 0.04)))}/m² est.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          05 — POR QUE INVESTIR AQUI
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: C.dark, padding: '80px 64px' }} className="mob-p">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold, marginBottom: '8px' }}>03 — Investment Case</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: C.light, marginBottom: '48px' }}>
            Por que Investir em {z.nome}?
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '24px',
          }} className="mob-grid-1">
            {z.drivers.map((driver, i) => {
              const icons = ['◆', '◈', '◉', '◎']
              return (
                <div key={driver} style={{
                  border: `1px solid rgba(201,169,110,.15)`,
                  background: 'rgba(201,169,110,.04)',
                  padding: '32px',
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '1.2rem',
                    color: C.gold,
                    flexShrink: 0,
                    marginTop: '2px',
                    lineHeight: 1,
                  }}>
                    {icons[i] ?? '◆'}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 400, fontSize: '1rem', color: C.light, lineHeight: 1.5 }}>{driver}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Forecast Banner */}
          <div style={{
            marginTop: '40px',
            background: 'rgba(201,169,110,.08)',
            border: `1px solid rgba(201,169,110,.25)`,
            padding: '28px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', letterSpacing: '.15em', textTransform: 'uppercase', color: C.gold }}>Previsão</div>
            <div style={{ width: '1px', height: '32px', background: 'rgba(201,169,110,.2)' }} />
            <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: C.gold }}>{z.forecast}</div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: '.85rem', color: 'rgba(244,240,230,.5)', marginLeft: 'auto' }} className="mob-hide">
              Estimativa Agency Group · base conservadora 50% YoY actual
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          06 — PERFIL DE COMPRADORES
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: C.light, padding: '80px 64px', borderTop: `1px solid ${C.border}` }} className="mob-p">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold, marginBottom: '8px' }}>04 — Compradores</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: C.dark, marginBottom: '12px' }}>
            Quem Compra em {z.nome}?
          </h2>
          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, color: C.muted, marginBottom: '48px', lineHeight: 1.7 }}>
            Perfil internacional dos compradores activos no mercado de {z.nome} em 2026.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
            {z.compradores.map((comp) => {
              const pct = buyerPct(comp)
              const label = buyerLabel(comp)
              return (
                <div key={comp}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontWeight: 400, fontSize: '.95rem', color: C.text }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: C.green, letterSpacing: '.06em' }}>{pct}%</span>
                  </div>
                  <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct * 2.5}%`,
                      background: `linear-gradient(90deg, ${C.green}, ${C.gold})`,
                      borderRadius: '2px',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{
            marginTop: '40px',
            display: 'inline-block',
            padding: '12px 24px',
            background: C.goldAlpha,
            border: `1px solid rgba(201,169,110,.25)`,
            fontFamily: "'DM Mono',monospace",
            fontSize: '.42rem',
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: C.green,
          }}>
            Fonte: Agency Group — dados de transações 2025
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          07 — CALCULADORA DE INVESTIMENTO
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#f9f6ef', padding: '80px 64px', borderTop: `1px solid ${C.border}` }} className="mob-p">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold, marginBottom: '8px' }}>05 — Simulador</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: C.dark, marginBottom: '12px' }}>
            Calculadora de Investimento
          </h2>
          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, color: C.muted, marginBottom: '48px', lineHeight: 1.7 }}>
            Simule o retorno de um investimento imobiliário em {z.nome}. Dados baseados em médias de mercado 2026.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' }} className="mob-grid-1">
            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Budget */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted }}>Orçamento</label>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: C.green, letterSpacing: '.06em' }}>{fmtEur(budget)}</span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={5000000}
                  step={50000}
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>€100K</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>€5M</span>
                </div>
              </div>

              {/* LTV */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted }}>Financiamento (LTV)</label>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: C.green, letterSpacing: '.06em' }}>{ltv}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={ltv}
                  onChange={(e) => setLtv(parseInt(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>0% — cash</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>80%</span>
                </div>
              </div>

              {/* Horizon */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted }}>Horizonte</label>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', color: C.green, letterSpacing: '.06em' }}>{horizon} anos</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={horizon}
                  onChange={(e) => setHorizon(parseInt(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>1 ano</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>15 anos</span>
                </div>
              </div>

              {/* Tipo Renda */}
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, marginBottom: '12px' }}>Tipo de Rendimento</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(['longa', 'turistica'] as const).map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setTipoRenda(tipo)}
                      style={{
                        padding: '10px 20px',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.42rem',
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        border: `1px solid ${tipoRenda === tipo ? C.green : C.border}`,
                        background: tipoRenda === tipo ? 'rgba(28,74,53,.08)' : '#fff',
                        color: tipoRenda === tipo ? C.green : C.muted,
                        cursor: 'pointer',
                        transition: 'all .2s',
                      }}
                    >
                      {tipo === 'longa' ? `Longa Duração (${z.yield}%)` : `Turístico (${z.yieldTur}%)`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Capital structure */}
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, padding: '20px 24px', borderLeft: `3px solid ${C.gold}` }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '12px' }}>Estrutura de Capital</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { label: 'Capital próprio', value: fmtEur(calc.equity) },
                    { label: 'Empréstimo', value: fmtEur(calc.emprestimo) },
                    { label: 'IMT + IS', value: fmtEur(calc.imt + calc.is) },
                    { label: 'Total investido', value: fmtEur(calc.totalInvestido) },
                  ].map((r) => (
                    <div key={r.label}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted, marginBottom: '3px' }}>{r.label}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.56rem', color: C.text }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Income */}
              <div style={{ background: '#fff', border: `1px solid ${C.border}`, padding: '20px 24px', borderLeft: `3px solid ${C.green}` }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, marginBottom: '12px' }}>Rendimento Estimado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { label: 'Renda bruta/ano', value: fmtEur(calc.rendaBruta) },
                    { label: 'Renda líquida/ano', value: fmtEur(calc.rendaLiquida) },
                    { label: 'Prestação/mês', value: calc.emprestimo > 0 ? fmtEur(calc.prestacao) : '— cash' },
                    { label: 'Cash flow/mês', value: fmtEur(calc.cashFlowMensal) },
                  ].map((r) => (
                    <div key={r.label}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted, marginBottom: '3px' }}>{r.label}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.56rem', color: calc.cashFlowMensal < 0 && r.label === 'Cash flow/mês' ? '#c0392b' : C.text }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Returns */}
              <div style={{ background: C.dark, border: `1px solid rgba(201,169,110,.2)`, padding: '20px 24px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(244,240,230,.4)', marginBottom: '12px' }}>Retorno em {horizon} Anos</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { label: 'Valor final estimado', value: fmtEur(calc.valorFinal) },
                    { label: 'Retorno total', value: fmtEur(calc.totalReturn) },
                    { label: 'IRR estimada', value: `${calc.irr.toFixed(1)}%/ano` },
                    { label: 'Cash-on-cash', value: `${calc.cashOnCash.toFixed(1)}%` },
                  ].map((r) => (
                    <div key={r.label}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: 'rgba(244,240,230,.35)', marginBottom: '3px' }}>{r.label}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.56rem', color: C.gold }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted, lineHeight: 1.6 }}>
                * Simulação meramente indicativa. TAN hipoteca: 3.5%. Apreciação: {(calc.apreciacaoAnual * 100).toFixed(1)}%/ano (50% YoY actual). Não inclui IRS, gestão ou seguros.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          08 — FAQ
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: C.light, padding: '80px 64px', borderTop: `1px solid ${C.border}` }} className="mob-p">
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold, marginBottom: '8px' }}>06 — FAQ</div>
          <h2 style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: C.dark, marginBottom: '48px' }}>
            Perguntas Frequentes<br />
            <em style={{ fontStyle: 'italic', color: C.gold }}>sobre {z.nome}</em>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {z.faq.map((item, i) => (
              <div key={i} style={{ borderTop: `1px solid ${C.border}`, ...(i === z.faq.length - 1 ? { borderBottom: `1px solid ${C.border}` } : {}) }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '24px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    gap: '24px',
                  }}
                >
                  <span style={{ fontFamily: "'Cormorant',serif", fontWeight: 400, fontSize: '1.15rem', color: C.dark, lineHeight: 1.4 }}>{item.q}</span>
                  <span style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '1rem',
                    color: C.gold,
                    flexShrink: 0,
                    transition: 'transform .2s',
                    transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)',
                    display: 'block',
                    lineHeight: 1,
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{
                    paddingBottom: '24px',
                    fontFamily: "'Jost',sans-serif",
                    fontWeight: 300,
                    fontSize: '.95rem',
                    color: C.muted,
                    lineHeight: 1.7,
                  }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          09 — OUTRAS ZONAS
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#f9f6ef', padding: '60px 64px', borderTop: `1px solid ${C.border}` }} className="mob-p">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.2em', textTransform: 'uppercase', color: C.muted, marginBottom: '32px' }}>Explorar outras zonas</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(ZONES)
              .filter(([key]) => key !== zona)
              .map(([key, z2]) => (
                <Link
                  key={key}
                  href={`/zonas/${key}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 20px',
                    background: '#fff',
                    border: `1px solid ${C.border}`,
                    textDecoration: 'none',
                    transition: 'border-color .2s',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{z2.emoji}</span>
                  <div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 400, fontSize: '.85rem', color: C.text }}>{z2.nome}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: C.muted }}>€{fmt(z2.preco)}/m² · +{z2.yoy}%</div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          10 — CTA
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: C.dark, padding: '100px 64px' }} className="mob-p">
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.42rem', letterSpacing: '.25em', textTransform: 'uppercase', color: C.gold, marginBottom: '16px' }}>
            Agency Group · AMI 22506
          </div>
          <h2 style={{
            fontFamily: "'Cormorant',serif",
            fontWeight: 300,
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            color: C.light,
            lineHeight: 1.15,
            marginBottom: '20px',
          }}>
            Encontre o seu imóvel<br />
            <em style={{ color: C.gold, fontStyle: 'italic' }}>em {z.nome}</em>
          </h2>
          <p style={{
            fontFamily: "'Jost',sans-serif",
            fontWeight: 300,
            fontSize: '1rem',
            color: 'rgba(244,240,230,.6)',
            lineHeight: 1.7,
            marginBottom: '48px',
            maxWidth: '480px',
            margin: '0 auto 48px',
          }}>
            Fale com um especialista Agency Group dedicado a {z.nome}. Avaliação AVM gratuita, acesso off-market e acompanhamento completo de compra.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/351919948986"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: C.gold,
                color: C.dark,
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                padding: '18px 40px',
                textDecoration: 'none',
              }}
            >
              WhatsApp · Especialista {z.nome}
            </a>
            <Link
              href="/avm"
              style={{
                display: 'inline-block',
                background: 'transparent',
                color: C.gold,
                border: `1px solid ${C.gold}`,
                fontFamily: "'DM Mono',monospace",
                fontSize: '.48rem',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                padding: '18px 40px',
                textDecoration: 'none',
              }}
            >
              AVM Gratuito
            </Link>
          </div>

          {/* Trust signals */}
          <div style={{ marginTop: '60px', display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { value: 'AMI 22506', label: 'Licença oficial' },
              { value: '5%', label: 'Comissão única' },
              { value: '€100K–€100M', label: 'Segmento' },
              { value: '0€', label: 'AVM gratuito' },
            ].map((t) => (
              <div key={t.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.7rem', color: C.gold, letterSpacing: '.04em' }}>{t.value}</div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: '.75rem', color: 'rgba(244,240,230,.35)', marginTop: '4px' }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer style={{
        background: '#081410',
        borderTop: `1px solid rgba(201,169,110,.08)`,
        padding: '48px 64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '24px',
      }}>
        <div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.1rem', letterSpacing: '.35em', textTransform: 'uppercase', color: C.gold }}>Agency Group</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.38rem', color: 'rgba(244,240,230,.2)', marginTop: '6px', letterSpacing: '.08em' }}>
            AMI 22506 · geral@agencygroup.pt · +351 919 948 986
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {Object.entries(ZONES).slice(0, 4).map(([key, z2]) => (
            <Link
              key={key}
              href={`/zonas/${key}`}
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: key === zona ? C.gold : 'rgba(244,240,230,.25)',
                textDecoration: 'none',
              }}
            >
              {z2.nome}
            </Link>
          ))}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.35rem', color: 'rgba(244,240,230,.15)', letterSpacing: '.06em' }}>
          © 2026 Agency Group. Todos os direitos reservados.
        </div>
      </footer>
    </>
  )
}
