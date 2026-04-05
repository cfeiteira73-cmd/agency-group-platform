'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface ZoneData {
  id: string
  name: string
  preco: number
  yoy: number
  dom: number
  listings: number
  heat: number // 0-10
  trend: number[] // 2020-2026 price per m²
  supply: number[] // last 6 months supply
  demand: number[] // last 6 months demand
  nationalities: { label: string; pct: number; color: string }[]
  microIntel: string[]
}

interface BuyerNationality {
  flag: string
  country: string
  pct: number
  delta: number
  budget: string
  motivation: string
}

// ─── ZONE DATA ───────────────────────────────────────────────────────────────
const ZONES: ZoneData[] = [
  {
    id: 'chiado', name: 'Chiado / Príncipe Real', preco: 8200, yoy: 14.1, dom: 89, listings: 124, heat: 9.8,
    trend: [4800, 5400, 5900, 6400, 7100, 7700, 8200],
    supply: [18, 15, 13, 11, 10, 9],
    demand: [42, 48, 51, 56, 58, 63],
    nationalities: [
      { label: 'EUA', pct: 28, color: '#1c4a35' },
      { label: 'França', pct: 19, color: '#c9a96e' },
      { label: 'UK', pct: 14, color: '#2d6a4f' },
      { label: 'Portugal', pct: 18, color: '#52b788' },
      { label: 'Médio Oriente', pct: 13, color: '#95d5b2' },
      { label: 'Outros', pct: 8, color: '#d4a853' },
    ],
    microIntel: [
      'Preço médio acima €8.200/m² — top 3 nacional. Poucas saídas abaixo de €700K.',
      'DOM médio de 89 dias; imóveis premium fecham em <30 dias com proposta acima de pedido.',
      'Procura americana cresceu 34% YoY — foco em T2–T3 para NHR/residência principal.',
    ],
  },
  {
    id: 'cascais', name: 'Cascais', preco: 4713, yoy: 8.7, dom: 112, listings: 287, heat: 8.4,
    trend: [2900, 3300, 3600, 3900, 4200, 4500, 4713],
    supply: [45, 41, 38, 35, 33, 30],
    demand: [68, 72, 75, 79, 83, 87],
    nationalities: [
      { label: 'UK', pct: 24, color: '#1c4a35' },
      { label: 'Portugal', pct: 22, color: '#c9a96e' },
      { label: 'EUA', pct: 18, color: '#2d6a4f' },
      { label: 'França', pct: 14, color: '#52b788' },
      { label: 'Brasil', pct: 12, color: '#95d5b2' },
      { label: 'Outros', pct: 10, color: '#d4a853' },
    ],
    microIntel: [
      'Riviera portuguesa: maior concentração expat da Grande Lisboa. Escolas internacionais = driver primário.',
      'Quinta da Marinha e Bairro do Rosário têm preços 20–35% acima da média concelhia.',
      'Liquidez alta em T3–T4 entre €600K–€1,2M; mercado acima €2M mais lento (DOM 180+).',
    ],
  },
  {
    id: 'comporta', name: 'Comporta / Melides', preco: 7600, yoy: 31.5, dom: 195, listings: 67, heat: 9.5,
    trend: [1800, 2400, 3200, 4100, 5300, 6200, 7600],
    supply: [12, 10, 9, 8, 8, 7],
    demand: [22, 26, 30, 34, 38, 42],
    nationalities: [
      { label: 'França', pct: 32, color: '#1c4a35' },
      { label: 'EUA', pct: 22, color: '#c9a96e' },
      { label: 'UK', pct: 16, color: '#2d6a4f' },
      { label: 'Médio Oriente', pct: 14, color: '#52b788' },
      { label: 'Portugal', pct: 11, color: '#95d5b2' },
      { label: 'Outros', pct: 5, color: '#d4a853' },
    ],
    microIntel: [
      'Mercado com maior apreciação de Portugal 2020–2026: +322%. Oferta esgota em dias para prime.',
      'Buyers franceses dominam: Comporta é o novo Saint-Tropez da Península Ibérica.',
      'PDM restritivo = barreira de entrada natural. Terrenos com projeto aprovado valem 3x mais.',
    ],
  },
  {
    id: 'algarve', name: 'Algarve Costa', preco: 3941, yoy: 22.4, dom: 167, listings: 1840, heat: 8.1,
    trend: [2200, 2500, 2700, 2900, 3200, 3600, 3941],
    supply: [320, 298, 275, 252, 238, 220],
    demand: [410, 445, 468, 492, 510, 535],
    nationalities: [
      { label: 'UK', pct: 28, color: '#1c4a35' },
      { label: 'Alemanha', pct: 18, color: '#c9a96e' },
      { label: 'Holanda', pct: 12, color: '#2d6a4f' },
      { label: 'Portugal', pct: 15, color: '#52b788' },
      { label: 'França', pct: 11, color: '#95d5b2' },
      { label: 'Outros', pct: 16, color: '#d4a853' },
    ],
    microIntel: [
      'Golden Triangle (Quinta do Lago / Vale do Lobo / Vilamoura) lidera: preços €5K–€15K/m².',
      'Sazonalidade extrema: 70% das vendas entre Março–Setembro. Negociação melhor em Dezembro.',
      'AL licenses: municípios a restringir novas licenças — imóveis com AL existente valem 25% mais.',
    ],
  },
  {
    id: 'porto', name: 'Porto / Foz', preco: 4100, yoy: 19.2, dom: 134, listings: 542, heat: 8.0,
    trend: [1900, 2200, 2600, 2900, 3300, 3700, 4100],
    supply: [88, 81, 76, 72, 68, 64],
    demand: [112, 121, 128, 135, 142, 150],
    nationalities: [
      { label: 'França', pct: 22, color: '#1c4a35' },
      { label: 'Portugal', pct: 28, color: '#c9a96e' },
      { label: 'Brasil', pct: 16, color: '#2d6a4f' },
      { label: 'EUA', pct: 14, color: '#52b788' },
      { label: 'UK', pct: 10, color: '#95d5b2' },
      { label: 'Outros', pct: 10, color: '#d4a853' },
    ],
    microIntel: [
      'Foz do Douro e Nevogilde: preços €5K–€8K/m², compradores locais premium + diaspora.',
      'Porto bairros históricos (Bonfim, Miragaia) apreciação 25%+ em 24 meses. Reabilitação urbana.',
      'Pressão de buyers franceses forte: Porto é percebida como "Lisboa mais barata com charme".',
    ],
  },
  {
    id: 'madeira', name: 'Madeira', preco: 3760, yoy: 18.9, dom: 178, listings: 389, heat: 7.6,
    trend: [1600, 1900, 2200, 2600, 2900, 3300, 3760],
    supply: [65, 60, 57, 54, 51, 49],
    demand: [78, 83, 88, 93, 98, 104],
    nationalities: [
      { label: 'Alemanha', pct: 24, color: '#1c4a35' },
      { label: 'UK', pct: 20, color: '#c9a96e' },
      { label: 'Portugal', pct: 22, color: '#2d6a4f' },
      { label: 'Escandinávia', pct: 14, color: '#52b788' },
      { label: 'EUA', pct: 12, color: '#95d5b2' },
      { label: 'Outros', pct: 8, color: '#d4a853' },
    ],
    microIntel: [
      'IVA 5% para habitação própria vs 23% em Portugal continental — vantagem fiscal clara.',
      'Câmara Municipal do Funchal tem histórico de aprovar projetos premium. Menos burocracia.',
      'Alemães e escandinavos: procura de residência secundária de inverno cresceu 40% em 2025.',
    ],
  },
  {
    id: 'sintra', name: 'Sintra / Estoril', preco: 2890, yoy: 11.2, dom: 155, listings: 634, heat: 6.8,
    trend: [1700, 1900, 2100, 2300, 2500, 2700, 2890],
    supply: [105, 98, 94, 90, 87, 84],
    demand: [128, 133, 137, 142, 146, 151],
    nationalities: [
      { label: 'Portugal', pct: 38, color: '#1c4a35' },
      { label: 'UK', pct: 18, color: '#c9a96e' },
      { label: 'França', pct: 14, color: '#2d6a4f' },
      { label: 'Brasil', pct: 12, color: '#52b788' },
      { label: 'EUA', pct: 10, color: '#95d5b2' },
      { label: 'Outros', pct: 8, color: '#d4a853' },
    ],
    microIntel: [
      'Estoril casino district: pequeno mas premium. Moradias €2M–€5M com procura estável.',
      'Linha de Sintra: projeto de requalificação das estações aumentou procura nos últimos 18 meses.',
      'Quinta da Regaleira / Colares: zonas de crescimento com restrições Patrimônio UNESCO que limitam oferta.',
    ],
  },
  {
    id: 'setubal', name: 'Setúbal / Arrábida', preco: 2340, yoy: 28.6, dom: 198, listings: 421, heat: 7.2,
    trend: [1100, 1300, 1500, 1700, 1900, 2100, 2340],
    supply: [72, 68, 64, 60, 57, 54],
    demand: [88, 95, 102, 108, 115, 122],
    nationalities: [
      { label: 'Portugal', pct: 48, color: '#1c4a35' },
      { label: 'Brasil', pct: 18, color: '#c9a96e' },
      { label: 'Angola', pct: 12, color: '#2d6a4f' },
      { label: 'França', pct: 10, color: '#52b788' },
      { label: 'UK', pct: 7, color: '#95d5b2' },
      { label: 'Outros', pct: 5, color: '#d4a853' },
    ],
    microIntel: [
      'Maior crescimento percentual da Grande Lisboa 2024–2026. Entrada de capital de Lisboa com budget €200K–€400K.',
      'Parque Natural da Arrábida: restrições de construção = valor crescente para imóveis existentes.',
      'Infraestrutura a melhorar: nova ponte sobre o Sado em planeamento — efeito antecipação já visível.',
    ],
  },
  {
    id: 'alfama', name: 'Alfama / Mouraria', preco: 5800, yoy: 9.4, dom: 201, listings: 98, heat: 7.9,
    trend: [2800, 3200, 3700, 4200, 4800, 5300, 5800],
    supply: [16, 14, 13, 12, 11, 10],
    demand: [28, 31, 33, 35, 37, 39],
    nationalities: [
      { label: 'França', pct: 26, color: '#1c4a35' },
      { label: 'EUA', pct: 20, color: '#c9a96e' },
      { label: 'Itália', pct: 15, color: '#2d6a4f' },
      { label: 'Portugal', pct: 18, color: '#52b788' },
      { label: 'Brasil', pct: 12, color: '#95d5b2' },
      { label: 'Outros', pct: 9, color: '#d4a853' },
    ],
    microIntel: [
      'UNESCO World Heritage adjacency: Castelo de São Jorge drive. Reabilitação de edifícios Pombalinos.',
      'AL saturação local: câmara de Lisboa travou novas licenças. Imóveis com AL existente = ativo escasso.',
      'Compradores italianos e franceses dominam faixa €400K–€800K — busca de autenticidade cultural.',
    ],
  },
  {
    id: 'acores', name: 'Açores', preco: 1952, yoy: 9.4, dom: 232, listings: 298, heat: 5.1,
    trend: [1100, 1200, 1350, 1500, 1650, 1800, 1952],
    supply: [52, 50, 49, 48, 47, 46],
    demand: [58, 61, 64, 67, 70, 73],
    nationalities: [
      { label: 'Portugal', pct: 52, color: '#1c4a35' },
      { label: 'EUA (Diaspora)', pct: 20, color: '#c9a96e' },
      { label: 'Canadá', pct: 12, color: '#2d6a4f' },
      { label: 'Brasil', pct: 9, color: '#52b788' },
      { label: 'Alemanha', pct: 5, color: '#95d5b2' },
      { label: 'Outros', pct: 2, color: '#d4a853' },
    ],
    microIntel: [
      'Preços mais baixos da rede Agency Group — entry point €120K–€300K com yield alugamento 5–7%.',
      'Diaspora americana e canadiana: 1,5M de açorianos no exterior — procura emocional de retorno.',
      'Mercado nicho em crescimento. Turismo sustentável a pressionar preços em São Miguel e Faial.',
    ],
  },
]

// ─── BUYER DATA ──────────────────────────────────────────────────────────────
const BUYERS: BuyerNationality[] = [
  { flag: '🇵🇹', country: 'Portugal', pct: 36, delta: -3.1, budget: '€150K–€600K', motivation: 'Residência + Renda' },
  { flag: '🇺🇸', country: 'EUA', pct: 16, delta: 2.1, budget: '€800K–€3M', motivation: 'NHR / Estilo de Vida' },
  { flag: '🇫🇷', country: 'França', pct: 13, delta: -0.5, budget: '€300K–€1.5M', motivation: 'Residência Secundária' },
  { flag: '🇬🇧', country: 'Reino Unido', pct: 9, delta: 1.2, budget: '€400K–€2M', motivation: 'Pós-Brexit / NHR' },
  { flag: '🇸🇦', country: 'Médio Oriente', pct: 7, delta: 5.2, budget: '€2M–€15M', motivation: 'Diversificação / Lifestyle' },
  { flag: '🇨🇳', country: 'China', pct: 8, delta: -1.8, budget: '€500K–€3M', motivation: 'Golden Visa / Escola' },
  { flag: '🇧🇷', country: 'Brasil', pct: 6, delta: 3.4, budget: '€200K–€800K', motivation: 'D7 / Cidadania PT' },
  { flag: '🇩🇪', country: 'Alemanha', pct: 5, delta: 0.8, budget: '€300K–€1.2M', motivation: 'Reforma / Segunda Casa' },
]

const SEASONAL_DEMAND = [62, 65, 72, 78, 85, 91, 96, 94, 88, 76, 67, 60]
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── HEATMAP DATA ────────────────────────────────────────────────────────────
const HEATMAP_ZONES = [
  { name: 'Chiado', heat: 9.8, price: 8200 },
  { name: 'Príncipe Real', heat: 9.6, price: 8800 },
  { name: 'Comporta', heat: 9.5, price: 7600 },
  { name: 'Cascais', heat: 8.4, price: 4713 },
  { name: 'Quinta Marinha', heat: 8.8, price: 6200 },
  { name: 'Alfama', heat: 7.9, price: 5800 },
  { name: 'Algarve', heat: 8.1, price: 3941 },
  { name: 'Belém', heat: 7.4, price: 5200 },
  { name: 'Porto / Foz', heat: 8.0, price: 4100 },
  { name: 'Parq. Nações', heat: 6.9, price: 4600 },
  { name: 'Estoril', heat: 7.1, price: 3800 },
  { name: 'Sintra', heat: 6.8, price: 2890 },
  { name: 'Madeira', heat: 7.6, price: 3760 },
  { name: 'Setúbal', heat: 7.2, price: 2340 },
  { name: 'Évora', heat: 5.8, price: 1980 },
  { name: 'Óbidos', heat: 5.4, price: 2100 },
  { name: 'Alentejo', heat: 6.1, price: 2400 },
  { name: 'Braga', heat: 6.5, price: 2650 },
  { name: 'Açores', heat: 5.1, price: 1952 },
  { name: 'Porto Baixa', heat: 7.7, price: 3643 },
]

// ─── DAILY INSIGHTS ──────────────────────────────────────────────────────────
const DAILY_INSIGHTS = [
  'Compradores norte-americanos são agora 16% do mercado premium — o perfil NHR acima de €1M cresce 34% YoY. Priorizar captação inglesa/portuguesa.',
  'Comporta fechou 2025 com +31.5% de apreciação. PDM restritivo limita nova oferta — pressão de preço estrutural continuará em 2026.',
  'DOM médio de 210 dias esconde a bifurcação: luxo acima €1M fecha em 89 dias; tickets abaixo €300K excedem 260 dias.',
  'Mercado de arrendamento em Lisboa: yield bruta de 4.2% mas yield líquida após AL compressão cai para 2.8%. Foco em compradores NHR sem necessidade de yield.',
  'Portugal confirmado top 5 mundial para compra de imóvel de luxo segundo relatório Savills 2025. Lisboa ultrapassou Milão em ranking de residências secundárias de ultra-luxo.',
]

// ─── INDEX DATA ──────────────────────────────────────────────────────────────
const RENTAL_YIELDS = [
  { zone: 'Açores', yield: 6.8 },
  { zone: 'Setúbal', yield: 5.9 },
  { zone: 'Porto / Foz', yield: 5.2 },
  { zone: 'Algarve', yield: 4.8 },
  { zone: 'Madeira', yield: 4.6 },
  { zone: 'Sintra', yield: 4.1 },
  { zone: 'Lisboa (média)', yield: 4.2 },
  { zone: 'Alfama', yield: 3.8 },
  { zone: 'Cascais', yield: 3.8 },
  { zone: 'Chiado', yield: 3.1 },
]

const INTL_COMPARISON = [
  { city: 'Lisboa', price: 5000, yield: 4.2, yoy: 17.6, flag: '🇵🇹' },
  { city: 'Paris', price: 9800, yield: 2.8, yoy: -3.2, flag: '🇫🇷' },
  { city: 'Barcelona', price: 5900, yield: 3.6, yoy: 8.4, flag: '🇪🇸' },
  { city: 'Milano', price: 5200, yield: 3.9, yoy: 6.1, flag: '🇮🇹' },
  { city: 'Porto', price: 3643, yield: 5.2, yoy: 19.2, flag: '🇵🇹' },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(n: number): string { return n.toLocaleString('pt-PT') }
function fmtK(n: number): string { return n >= 1000 ? `€${(n / 1000).toFixed(0)}K` : `€${n}` }

function heatColor(heat: number): string {
  if (heat >= 9) return '#0d2818'
  if (heat >= 8) return '#1c4a35'
  if (heat >= 7) return '#2d6a4f'
  if (heat >= 6) return '#52b788'
  if (heat >= 5) return '#95d5b2'
  return '#d8f3dc'
}

function heatTextColor(heat: number): string {
  return heat >= 6 ? '#fff' : '#0e0e0d'
}

// ─── SVG COMPONENTS ──────────────────────────────────────────────────────────
function LineTrend({ data, color = '#1c4a35', width = 300, height = 80, years }: {
  data: number[]; color?: string; width?: number; height?: number; years?: string[]
}) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (width - 32) + 16,
    y: height - 24 - ((v - min) / range) * (height - 40),
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${(height - 24).toFixed(1)} L${pts[0].x.toFixed(1)},${(height - 24).toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`lg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#lg-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
      {years && years.map((y, i) => (
        <text key={i} x={pts[i]?.x ?? 0} y={height - 6} textAnchor="middle" fontSize="9" fill="#888" fontFamily="DM Mono, monospace">{y}</text>
      ))}
      <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 8} textAnchor="middle" fontSize="9" fill={color} fontFamily="DM Mono, monospace" fontWeight="600">
        €{(data[data.length - 1] / 1000).toFixed(1)}K
      </text>
    </svg>
  )
}

function BarChart({ supply, demand, months }: { supply: number[]; demand: number[]; months: string[] }) {
  const maxVal = Math.max(...supply, ...demand)
  const W = 300; const H = 100; const barW = 18; const gap = 4; const groupW = barW * 2 + gap + 8
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {supply.map((s, i) => {
        const x = i * groupW + 16
        const dH = (demand[i] / maxVal) * 70
        const sH = (s / maxVal) * 70
        return (
          <g key={i}>
            <rect x={x} y={H - 20 - sH} width={barW} height={sH} fill="#95d5b2" rx="2" />
            <rect x={x + barW + gap} y={H - 20 - dH} width={barW} height={dH} fill="#1c4a35" rx="2" />
            <text x={x + barW} y={H - 4} textAnchor="middle" fontSize="8" fill="#888" fontFamily="DM Mono, monospace">{months[i]}</text>
          </g>
        )
      })}
      <text x={16} y={12} fontSize="8" fill="#95d5b2" fontFamily="DM Mono, monospace">■ Oferta</text>
      <text x={72} y={12} fontSize="8" fill="#1c4a35" fontFamily="DM Mono, monospace">■ Procura</text>
    </svg>
  )
}

function DonutChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  const cx = 70; const cy = 70; const r = 50; const ir = 28
  let angle = -90
  const slices = data.map((d) => {
    const startAngle = angle
    const sweep = (d.pct / 100) * 360
    angle += sweep
    const s = (Math.PI / 180) * startAngle
    const e = (Math.PI / 180) * (startAngle + sweep)
    const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e)
    const ix1 = cx + ir * Math.cos(s); const iy1 = cy + ir * Math.sin(s)
    const ix2 = cx + ir * Math.cos(e); const iy2 = cy + ir * Math.sin(e)
    const large = sweep > 180 ? 1 : 0
    return { ...d, d: `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix2.toFixed(1)},${iy2.toFixed(1)} A${ir},${ir} 0 ${large},0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z` }
  })
  return (
    <svg viewBox="0 0 200 140" style={{ width: '100%', height: 140 }}>
      {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
      {data.map((d, i) => (
        <g key={i}>
          <rect x={148} y={8 + i * 21} width={8} height={8} fill={d.color} rx="1" />
          <text x={160} y={16 + i * 21} fontSize="9" fill="#0e0e0d" fontFamily="DM Mono, monospace">{d.label} {d.pct}%</text>
        </g>
      ))}
    </svg>
  )
}

function HeatmapGrid({ zones }: { zones: typeof HEATMAP_ZONES }) {
  const cols = 5
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {zones.map((z) => (
        <div
          key={z.name}
          className="rounded-lg p-2 text-center cursor-default transition-transform hover:scale-105"
          style={{ background: heatColor(z.heat), color: heatTextColor(z.heat) }}
          title={`${z.name}: €${z.price}/m² · Heat ${z.heat}/10`}
        >
          <div style={{ fontSize: '9px', fontFamily: 'DM Mono, monospace', fontWeight: 700, lineHeight: 1.2 }}>{z.name}</div>
          <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', fontWeight: 700, marginTop: 2 }}>€{(z.price / 1000).toFixed(1)}K</div>
        </div>
      ))}
    </div>
  )
}

function GaugeArc({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = value / max
  const r = 48; const cx = 60; const cy = 60
  const startAngle = 210; const totalAngle = 120
  const endAngle = startAngle + totalAngle * pct
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle)); const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle)); const y2 = cy + r * Math.sin(toRad(endAngle))
  const bgX2 = cx + r * Math.cos(toRad(startAngle + totalAngle))
  const bgY2 = cy + r * Math.sin(toRad(startAngle + totalAngle))
  const large = totalAngle * pct > 180 ? 1 : 0
  return (
    <svg viewBox="0 0 120 90" style={{ width: 120, height: 90 }}>
      <path d={`M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 1,1 ${bgX2.toFixed(1)},${bgY2.toFixed(1)}`}
        fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="8" strokeLinecap="round" />
      <path d={`M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#0e0e0d" fontFamily="DM Mono, monospace">{value}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#666" fontFamily="DM Mono, monospace">{label}</text>
    </svg>
  )
}

function AffordabilityGauge({ value }: { value: number }) {
  const r = 60; const cx = 80; const cy = 75; const strokeW = 12
  const totalAngle = 180
  const pct = value / 100
  const toRad = (d: number) => (d * Math.PI) / 180
  const startX = cx - r; const startY = cy
  const endX = cx + r; const endY = cy
  const arcX = cx + r * Math.cos(toRad(180 - totalAngle * pct))
  const arcY = cy - r * Math.sin(toRad(totalAngle * pct))
  const color = value < 30 ? '#e05454' : value < 60 ? '#c9a96e' : '#1c4a35'
  return (
    <svg viewBox="0 0 160 90" style={{ width: '100%', height: 90 }}>
      <path d={`M${startX},${startY} A${r},${r} 0 0,1 ${endX},${endY}`} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={strokeW} />
      <path d={`M${startX},${startY} A${r},${r} 0 ${pct > 0.5 ? 1 : 0},1 ${arcX.toFixed(1)},${arcY.toFixed(1)}`}
        fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="700" fill={color} fontFamily="DM Mono, monospace">{value}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="#666" fontFamily="DM Mono, monospace">/ 100</text>
      <text x={20} y={cy + 20} textAnchor="middle" fontSize="8" fill="#e05454" fontFamily="DM Mono, monospace">Baixo</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="8" fill="#c9a96e" fontFamily="DM Mono, monospace">Médio</text>
      <text x={140} y={cy + 20} textAnchor="middle" fontSize="8" fill="#1c4a35" fontFamily="DM Mono, monospace">Alto</text>
    </svg>
  )
}

function SeasonalChart({ data, months }: { data: number[]; months: string[] }) {
  const W = 400; const H = 100
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (W - 40) + 20,
    y: H - 20 - ((v - min) / range) * (H - 40),
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${pts[pts.length - 1].x},${H - 20} L${pts[0].x},${H - 20} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <defs>
        <linearGradient id="seasonal-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#seasonal-grad)" />
      <path d={pathD} fill="none" stroke="#c9a96e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#c9a96e" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#888" fontFamily="DM Mono, monospace">{months[i]}</text>
        </g>
      ))}
    </svg>
  )
}

function BuyerBars({ buyers }: { buyers: BuyerNationality[] }) {
  const maxPct = Math.max(...buyers.map(b => b.pct))
  return (
    <div className="space-y-2">
      {buyers.map((b) => (
        <div key={b.country} className="flex items-center gap-3">
          <span style={{ width: 28, fontSize: 18 }}>{b.flag}</span>
          <span style={{ width: 120, fontSize: 12, fontFamily: 'Jost, sans-serif', color: '#0e0e0d' }}>{b.country}</span>
          <div className="flex-1 bg-black/5 rounded-full h-2 relative">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${(b.pct / maxPct) * 100}%`, background: b.delta > 0 ? '#1c4a35' : b.delta < -1 ? '#e05454' : '#c9a96e' }}
            />
          </div>
          <span style={{ width: 36, fontSize: 12, fontFamily: 'DM Mono, monospace', color: '#0e0e0d', textAlign: 'right', fontWeight: 700 }}>{b.pct}%</span>
          <span style={{ width: 40, fontSize: 11, fontFamily: 'DM Mono, monospace', color: b.delta > 0 ? '#1c4a35' : '#e05454', textAlign: 'right' }}>
            {b.delta > 0 ? '+' : ''}{b.delta}%
          </span>
        </div>
      ))}
    </div>
  )
}

function RentalYieldBars({ data }: { data: { zone: string; yield: number }[] }) {
  const maxY = Math.max(...data.map(d => d.yield))
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.zone} className="flex items-center gap-3">
          <span style={{ width: 120, fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#666' }}>{d.zone}</span>
          <div className="flex-1 bg-black/5 rounded-full h-2">
            <div className="h-2 rounded-full" style={{ width: `${(d.yield / maxY) * 100}%`, background: d.yield >= 5 ? '#1c4a35' : d.yield >= 4 ? '#c9a96e' : '#95d5b2' }} />
          </div>
          <span style={{ width: 40, fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#0e0e0d', textAlign: 'right' }}>{d.yield}%</span>
        </div>
      ))}
    </div>
  )
}

function VelocityLine({ months }: { months: string[] }) {
  const data = [142, 138, 156, 171, 185, 193, 208, 204, 189, 175, 162, 155]
  const W = 360; const H = 80
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * (W - 40) + 20,
    y: H - 20 - ((v - min) / range) * (H - 36),
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <path d={pathD} fill="none" stroke="#1c4a35" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5,3" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill="#1c4a35" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="8" fill="#888" fontFamily="DM Mono, monospace">{months[i]}</text>
        </g>
      ))}
      <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 8} textAnchor="middle" fontSize="9" fill="#1c4a35" fontFamily="DM Mono, monospace" fontWeight="700">155/mês</text>
    </svg>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PortalPulse() {
  const [activeTab, setActiveTab] = useState<'visao' | 'zona' | 'compradores' | 'indices'>('visao')
  const [selectedZone, setSelectedZone] = useState<ZoneData>(ZONES[0])
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [insightIndex, setInsightIndex] = useState(0)
  const [pulse, setPulse] = useState(true)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setLastUpdated(now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    updateTime()
    const interval = setInterval(updateTime, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setInsightIndex(i => (i + 1) % DAILY_INSIGHTS.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 1200)
    return () => clearInterval(interval)
  }, [])

  const TABS = [
    { id: 'visao', label: 'Visão Geral' },
    { id: 'zona', label: 'Por Zona' },
    { id: 'compradores', label: 'Compradores' },
    { id: 'indices', label: 'Índices' },
  ] as const

  return (
    <div style={{ background: '#f4f0e6', minHeight: '100vh', fontFamily: 'Jost, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ background: '#1c4a35', padding: '20px 28px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 style={{ fontFamily: 'Cormorant, serif', fontSize: 28, color: '#f4f0e6', fontWeight: 700, margin: 0 }}>
                Market Pulse
              </h1>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: 'rgba(201,169,110,0.2)', border: '1px solid rgba(201,169,110,0.4)' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: pulse ? '#4ade80' : '#22c55e',
                  boxShadow: pulse ? '0 0 0 3px rgba(74,222,128,0.3)' : 'none',
                  transition: 'all 0.6s ease',
                }} />
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c9a96e', letterSpacing: '0.1em' }}>LIVE</span>
              </div>
            </div>
            <p style={{ color: 'rgba(244,240,230,0.6)', fontSize: 13, marginTop: 4, fontFamily: 'DM Mono, monospace' }}>
              Mercado imobiliário Portugal · Dados Q2 2026
            </p>
          </div>
          <div className="text-right">
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(244,240,230,0.5)' }}>Atualizado às</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#c9a96e', fontWeight: 700 }}>{lastUpdated}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'DM Mono, monospace',
                fontSize: 12,
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
                background: activeTab === t.id ? '#c9a96e' : 'rgba(244,240,230,0.1)',
                color: activeTab === t.id ? '#1c4a35' : 'rgba(244,240,230,0.7)',
                fontWeight: activeTab === t.id ? 700 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ── Tab 1: Visão Geral ────────────────────────────────────── */}
        {activeTab === 'visao' && (
          <div className="space-y-6">

            {/* Macro KPIs */}
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[
                { label: 'Mediana Lisboa', value: '€5.000/m²', sub: 'Top 5 mundial', color: '#1c4a35', icon: '🏙' },
                { label: 'Transacções 2026', value: '169.812', sub: '+7.3% vs 2025', color: '#1c4a35', icon: '📊' },
                { label: 'Variação YoY', value: '+17,6%', sub: 'Aceleração nacional', color: '#c9a96e', icon: '📈' },
                { label: 'DOM Médio', value: '210 dias', sub: 'Luxo: 89 dias', color: '#1c4a35', icon: '🗓' },
                { label: 'Compradores Est.', value: '45%', sub: '+3.2% YoY', color: '#1c4a35', icon: '✈️' },
                { label: 'Índice Luxo', value: '#5 Mundial', sub: 'Savills 2025', color: '#c9a96e', icon: '🏆' },
              ].map((kpi) => (
                <div key={kpi.label} className="p-card rounded-xl" style={{ background: '#fff', border: '1px solid rgba(28,74,53,0.1)', padding: '18px 20px' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{kpi.label}</div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: kpi.color, marginTop: 6 }}>{kpi.value}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{kpi.sub}</div>
                    </div>
                    <span style={{ fontSize: 24 }}>{kpi.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, margin: 0 }}>
                  Mapa de Pressão de Preços — Portugal
                </h2>
                <div className="flex items-center gap-3">
                  {[
                    { label: 'Top', color: '#0d2818' },
                    { label: 'Alto', color: '#1c4a35' },
                    { label: 'Médio', color: '#52b788' },
                    { label: 'Base', color: '#d8f3dc' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                      <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#666' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <HeatmapGrid zones={HEATMAP_ZONES} />
            </div>

            {/* Insight do Dia */}
            <div style={{ background: 'linear-gradient(135deg, #1c4a35 0%, #0d2818 100%)', borderRadius: 16, padding: '22px 28px', border: '1px solid rgba(201,169,110,0.3)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div style={{ background: '#c9a96e', borderRadius: 6, padding: '4px 12px' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#1c4a35', fontWeight: 700, letterSpacing: '0.1em' }}>INSIGHT DO DIA</span>
                </div>
                <div className="flex gap-1">
                  {DAILY_INSIGHTS.map((_, i) => (
                    <div key={i} style={{ width: i === insightIndex ? 18 : 6, height: 6, borderRadius: 3, background: i === insightIndex ? '#c9a96e' : 'rgba(201,169,110,0.3)', transition: 'all 0.4s' }} />
                  ))}
                </div>
              </div>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 15, color: '#f4f0e6', lineHeight: 1.6, margin: 0 }}>
                {DAILY_INSIGHTS[insightIndex]}
              </p>
            </div>

            {/* Zone Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>
                Top Zonas · Ranking
              </h2>
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(28,74,53,0.1)' }}>
                      {['Zona', '€/m²', 'YoY', 'DOM', 'Listings', 'Heat'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ZONES.map((z, i) => (
                      <tr
                        key={z.id}
                        onClick={() => { setSelectedZone(z); setActiveTab('zona') }}
                        style={{ borderBottom: '1px solid rgba(28,74,53,0.06)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(28,74,53,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{z.name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1c4a35' }}>€{fmt(z.preco)}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#1c4a35', fontWeight: 600 }}>+{z.yoy}%</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#666' }}>{z.dom}d</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#666' }}>{z.listings}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 40, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)' }}>
                              <div style={{ width: `${(z.heat / 10) * 100}%`, height: 6, borderRadius: 3, background: heatColor(z.heat) }} />
                            </div>
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: heatColor(z.heat), fontWeight: 700 }}>{z.heat}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Por Zona ───────────────────────────────────────── */}
        {activeTab === 'zona' && (
          <div className="space-y-6">

            {/* Zone Pills */}
            <div className="flex flex-wrap gap-2">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZone(z)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: `1.5px solid ${selectedZone.id === z.id ? '#1c4a35' : 'rgba(28,74,53,0.2)'}`,
                    background: selectedZone.id === z.id ? '#1c4a35' : '#fff',
                    color: selectedZone.id === z.id ? '#f4f0e6' : '#1c4a35',
                    fontSize: 12,
                    fontFamily: 'DM Mono, monospace',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: selectedZone.id === z.id ? 700 : 400,
                  }}
                >
                  {z.name}
                </button>
              ))}
            </div>

            {/* Zone Header */}
            <div style={{ background: '#1c4a35', borderRadius: 16, padding: '20px 24px' }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 26, color: '#f4f0e6', fontWeight: 700, margin: 0 }}>{selectedZone.name}</h2>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'rgba(244,240,230,0.6)', marginTop: 4 }}>Análise de mercado detalhada · Q2 2026</div>
                </div>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { label: 'Preço Médio', value: `€${fmt(selectedZone.preco)}/m²` },
                    { label: 'YoY', value: `+${selectedZone.yoy}%` },
                    { label: 'DOM', value: `${selectedZone.dom} dias` },
                    { label: 'Listings', value: `${selectedZone.listings}` },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,240,230,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#c9a96e', fontWeight: 700, marginTop: 2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-4">

              {/* Price Trend */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 17, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>Evolução de Preço 2020–2026</h3>
                <LineTrend
                  data={selectedZone.trend}
                  color="#1c4a35"
                  height={100}
                  years={['2020', '2021', '2022', '2023', '2024', '2025', '2026']}
                />
              </div>

              {/* Supply/Demand */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 17, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>Oferta vs Procura · Últimos 6M</h3>
                <BarChart supply={selectedZone.supply} demand={selectedZone.demand} months={['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar']} />
              </div>

              {/* Nationality Donut */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 17, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>Perfil de Compradores</h3>
                <DonutChart data={selectedZone.nationalities} />
              </div>

              {/* Micro Intel */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 17, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Micro-Intel da Zona</h3>
                <div className="space-y-4">
                  {selectedZone.microIntel.map((intel, i) => (
                    <div key={i} className="flex gap-3">
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1c4a35', color: '#f4f0e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                      <p style={{ fontSize: 13, color: '#0e0e0d', lineHeight: 1.6, margin: 0 }}>{intel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Heat indicator */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '18px 24px' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Índice de Pressão</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 32, fontWeight: 700, color: heatColor(selectedZone.heat) }}>{selectedZone.heat}<span style={{ fontSize: 14, color: '#aaa' }}>/10</span></div>
                </div>
                <div style={{ flex: 1, margin: '0 32px' }}>
                  <div style={{ height: 12, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }}>
                    <div style={{ height: 12, borderRadius: 6, width: `${selectedZone.heat * 10}%`, background: `linear-gradient(90deg, #95d5b2, ${heatColor(selectedZone.heat)})`, transition: 'width 0.8s ease' }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#aaa' }}>0 — Frio</span>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#aaa' }}>10 — Sobreaquecido</span>
                  </div>
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#0e0e0d', fontWeight: 600 }}>
                  {selectedZone.heat >= 9 ? 'SOBREAQUECIDO' : selectedZone.heat >= 7 ? 'AQUECIDO' : selectedZone.heat >= 5 ? 'EQUILIBRADO' : 'FRIO'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Compradores ────────────────────────────────────── */}
        {activeTab === 'compradores' && (
          <div className="space-y-6">

            {/* Nationality breakdown */}
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 20 }}>Compradores por Nacionalidade</h2>
                <BuyerBars buyers={BUYERS} />
              </div>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Detalhes de Perfil</h2>
                <div className="space-y-3">
                  {BUYERS.map((b) => (
                    <div key={b.country} style={{ background: 'rgba(28,74,53,0.04)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(28,74,53,0.08)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 18 }}>{b.flag}</span>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{b.country}</span>
                        </div>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1c4a35' }}>{b.pct}%</span>
                      </div>
                      <div className="flex gap-4 mt-2">
                        <div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>Budget</div>
                          <div style={{ fontSize: 12, color: '#0e0e0d', fontWeight: 500 }}>{b.budget}</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>Motivação</div>
                          <div style={{ fontSize: 12, color: '#0e0e0d', fontWeight: 500 }}>{b.motivation}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Budget + Motivation donuts */}
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>Distribuição de Budget</h3>
                <DonutChart data={[
                  { label: '< €500K', pct: 38, color: '#95d5b2' },
                  { label: '€500K–€1M', pct: 29, color: '#52b788' },
                  { label: '€1M–€3M', pct: 22, color: '#1c4a35' },
                  { label: '€3M+', pct: 11, color: '#c9a96e' },
                ]} />
              </div>
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 12 }}>Motivação de Compra</h3>
                <DonutChart data={[
                  { label: 'Residência Principal', pct: 31, color: '#1c4a35' },
                  { label: 'Investimento/Renda', pct: 26, color: '#c9a96e' },
                  { label: 'NHR / Fiscal', pct: 22, color: '#52b788' },
                  { label: 'Golden Visa', pct: 12, color: '#2d6a4f' },
                  { label: 'Outros', pct: 9, color: '#95d5b2' },
                ]} />
              </div>
            </div>

            {/* Seasonal Chart */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Sazonalidade da Procura — Índice Relativo</h3>
              <SeasonalChart data={SEASONAL_DEMAND} months={MONTHS} />
              <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Índice 100 = Julho pico. 70% das visitas ocorre entre Março e Setembro.</p>
            </div>

            {/* Hot Profile */}
            <div style={{ background: 'linear-gradient(135deg, #c9a96e, #b8913d)', borderRadius: 16, padding: '22px 28px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Hot Profile do Mês · Março 2026</div>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 24, color: '#1c4a35', fontWeight: 700, margin: '0 0 12px' }}>
                🇺🇸 Comprador Norte-Americano — NHR 2.0
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Budget típico', value: '€900K–€2.5M' },
                  { label: 'Zona preferida', value: 'Cascais / Chiado' },
                  { label: 'Motivação', value: 'NHR + Lifestyle' },
                  { label: 'Produto ideal', value: 'T3–T4 remodelado' },
                  { label: 'Tempo decisão', value: '2–4 visitas' },
                  { label: 'Crescimento YoY', value: '+34% em volume' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(28,74,53,0.7)', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 15, color: '#1c4a35', fontWeight: 700, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 4: Índices ────────────────────────────────────────── */}
        {activeTab === 'indices' && (
          <div className="space-y-6">

            {/* Top row: Affordability + Momentum */}
            <div className="grid grid-cols-2 gap-4">
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 8 }}>Índice de Acessibilidade</h3>
                <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>Relação rendimento médio vs preço imóvel. 100 = acessível, 0 = inacessível.</p>
                <AffordabilityGauge value={34} />
                <p style={{ fontSize: 12, color: '#e05454', marginTop: 8, fontFamily: 'DM Mono, monospace' }}>⚠ Lisboa abaixo do limiar crítico de 40. Mercado premium acessível apenas a 18% da pop. local.</p>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 8 }}>Índices de Mercado</h3>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="flex flex-col items-center">
                    <GaugeArc value={7.8} max={10} label="Confiança" color="#1c4a35" />
                  </div>
                  <div className="flex flex-col items-center">
                    <GaugeArc value={8.2} max={10} label="Liquidez" color="#c9a96e" />
                  </div>
                  <div className="flex flex-col items-center">
                    <GaugeArc value={3.1} max={10} label="Volatilidade" color="#e05454" />
                  </div>
                  <div className="flex flex-col items-center">
                    <GaugeArc value={6.4} max={10} label="Pressão Oferta" color="#3a7bd5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Rental Yields */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 20 }}>Yield de Arrendamento por Zona — Bruto</h3>
              <RentalYieldBars data={RENTAL_YIELDS} />
            </div>

            {/* Transaction Velocity */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 8 }}>Velocidade de Transacção — Deals/Mês</h3>
              <VelocityLine months={MONTHS} />
            </div>

            {/* International Comparison Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Lisboa vs Mercados Europeus</h3>
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(28,74,53,0.1)' }}>
                      {['Cidade', '€/m²', 'Yield Bruto', 'YoY', 'Posição'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 16px', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {INTL_COMPARISON.map((c, i) => (
                      <tr
                        key={c.city}
                        style={{
                          borderBottom: '1px solid rgba(28,74,53,0.06)',
                          background: c.city === 'Lisboa' ? 'rgba(201,169,110,0.08)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: c.city === 'Lisboa' ? 700 : 400 }}>
                          {c.flag} {c.city}
                          {c.city === 'Lisboa' && <span style={{ marginLeft: 8, background: '#c9a96e', color: '#1c4a35', fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>FOCO</span>}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700 }}>€{fmt(c.price)}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: c.yield >= 4 ? '#1c4a35' : '#888', fontWeight: 600 }}>{c.yield}%</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: c.yoy > 0 ? '#1c4a35' : '#e05454', fontWeight: 600 }}>
                          {c.yoy > 0 ? '+' : ''}{c.yoy}%
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 10px', borderRadius: 4,
                            background: i === 0 ? 'rgba(201,169,110,0.15)' : 'rgba(0,0,0,0.04)',
                            fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#666'
                          }}>#{i + 1}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(28,74,53,0.06)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#1c4a35', margin: 0, fontFamily: 'Jost, sans-serif' }}>
                  <strong>Conclusão:</strong> Lisboa oferece a melhor combinação yield/crescimento/regime fiscal entre os 5 mercados europeus analisados. Enquanto Paris corrige, Lisboa acelera.
                </p>
              </div>
            </div>

            {/* Previsões */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Previsões de Mercado</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { periodo: 'Q2 2026', expectativa: '+4.2%', confianca: 'Alta', nota: 'Procura forte · Oferta limitada', color: '#1c4a35' },
                  { periodo: 'Q3 2026', expectativa: '+3.8%', confianca: 'Média-Alta', nota: 'Sazonalidade verão · Algarve pico', color: '#2d6a4f' },
                  { periodo: 'Q4 2026', expectativa: '+2.9%', confianca: 'Média', nota: 'Possível abrandamento BCE', color: '#c9a96e' },
                  { periodo: 'H1 2027', expectativa: '+6–9%', confianca: 'Baixa', nota: 'Incerteza macro europeia', color: '#888' },
                ].map((p) => (
                  <div key={p.periodo} style={{ border: `1.5px solid ${p.color}30`, borderRadius: 12, padding: '16px 18px' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888' }}>{p.periodo}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${p.color}18`, color: p.color, fontWeight: 600 }}>{p.confianca}</span>
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 24, fontWeight: 700, color: p.color }}>{p.expectativa}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{p.nota}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
