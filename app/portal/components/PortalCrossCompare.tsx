'use client'
import { useState, useMemo } from 'react'

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface City {
  id: string
  flag: string
  name: string
  country: string
  priceM2: number
  yoyChange: number
  rentalYield: number
  dom: number
  foreignBuyerPct: number
  transactionVolume: number // thousands/year
  transactionCosts: number // % buyer+seller
  capitalGainsTax: number
  taxRegimes: string[]
  mortgageLTV: number
  currency: string
  liquidity: 'Alta' | 'Média' | 'Baixa'
  pros: string[]
  cons: string[]
  profiles: string[]
  scores: {
    yield: number
    growth: number
    tax: number
    safety: number
    lifestyle: number
    liquidity: number
  }
  price2020: number // price/m² in 2020 for arbitrage calc
  investCosts: number // total cost % on €1M investment
}

// ─── MARKET DATA ─────────────────────────────────────────────────────────────
const CITIES: City[] = [
  {
    id: 'monaco', flag: '🇲🇨', name: 'Monaco', country: 'Mónaco',
    priceM2: 48000, yoyChange: 6.2, rentalYield: 1.8, dom: 280,
    foreignBuyerPct: 82, transactionVolume: 0.4, transactionCosts: 6.5,
    capitalGainsTax: 0, taxRegimes: ['Zero CGT', 'Zero IRS residentes'],
    mortgageLTV: 60, currency: 'EUR', liquidity: 'Baixa',
    pros: ['Zero impostos', 'Segurança máxima', 'Prestígio absoluto', 'Estabilidade política'],
    cons: ['Inacessível para maioria', 'Liquidez muito baixa', 'Sem Golden Visa', 'Mercado opaco'],
    profiles: ['HNWI globais', 'Famílias billionaires', 'Privacidade fiscal'],
    scores: { yield: 1, growth: 5, tax: 10, safety: 10, lifestyle: 9, liquidity: 2 },
    price2020: 38000, investCosts: 10,
  },
  {
    id: 'london', flag: '🇬🇧', name: 'Londres', country: 'Reino Unido',
    priceM2: 22000, yoyChange: 1.8, rentalYield: 3.2, dom: 210,
    foreignBuyerPct: 38, transactionVolume: 85, transactionCosts: 14,
    capitalGainsTax: 28, taxRegimes: ['CGT 24–28%', 'SDLT progressivo'],
    mortgageLTV: 75, currency: 'GBP', liquidity: 'Alta',
    pros: ['Liquidez máxima europeia', 'Mercado transparente', 'Serviços financeiros', 'Educação'],
    cons: ['Fiscalidade pesada pós-Brexit', 'SDLT 2–12%', 'Moeda não-EUR', 'Custo de vida extremo'],
    profiles: ['Capital Growth', 'Educação filhos', 'Diversificação'],
    scores: { yield: 3, growth: 3, tax: 2, safety: 9, lifestyle: 7, liquidity: 10 },
    price2020: 18500, investCosts: 16,
  },
  {
    id: 'paris', flag: '🇫🇷', name: 'Paris', country: 'França',
    priceM2: 9800, yoyChange: -3.2, rentalYield: 2.8, dom: 185,
    foreignBuyerPct: 18, transactionVolume: 32, transactionCosts: 12,
    capitalGainsTax: 36, taxRegimes: ['IS + PS 36%', 'IR progressivo'],
    mortgageLTV: 80, currency: 'EUR', liquidity: 'Média',
    pros: ['Prestígio cultural', 'Euro zone', 'Infraestrutura excelente', 'Mercado maduro'],
    cons: ['Em correcção desde 2022', 'CGT 36% efectivo', 'Controlo de rendas', 'Burocracia'],
    profiles: ['Residência principal', 'Diversificação cautelosa'],
    scores: { yield: 2, growth: 1, tax: 1, safety: 8, lifestyle: 9, liquidity: 6 },
    price2020: 10600, investCosts: 14,
  },
  {
    id: 'zurich', flag: '🇨🇭', name: 'Zurique', country: 'Suíça',
    priceM2: 15000, yoyChange: 4.1, rentalYield: 2.5, dom: 160,
    foreignBuyerPct: 28, transactionVolume: 12, transactionCosts: 3,
    capitalGainsTax: 0, taxRegimes: ['Zero CGT federal', 'Cantonal wealth tax'],
    mortgageLTV: 80, currency: 'CHF', liquidity: 'Média',
    pros: ['Zero CGT federal', 'Estabilidade máxima', 'Moeda refúgio', 'Qualidade vida #1'],
    cons: ['Restrições compra por estrangeiros (Lex Koller)', 'Moeda não-EUR', 'Acesso limitado', 'Custo vida alto'],
    profiles: ['Preservação de capital', 'HNWI', 'Diversificação CHF'],
    scores: { yield: 2, growth: 4, tax: 9, safety: 10, lifestyle: 10, liquidity: 4 },
    price2020: 12000, investCosts: 5,
  },
  {
    id: 'barcelona', flag: '🇪🇸', name: 'Barcelona', country: 'Espanha',
    priceM2: 5900, yoyChange: 8.4, rentalYield: 3.6, dom: 148,
    foreignBuyerPct: 32, transactionVolume: 28, transactionCosts: 10,
    capitalGainsTax: 26, taxRegimes: ['IRPF 19–26%', 'Beckham Law'],
    mortgageLTV: 70, currency: 'EUR', liquidity: 'Alta',
    pros: ['Clima / Qualidade vida', 'Beckham Law (24% flat)', 'Grande mercado', 'Infraestrutura'],
    cons: ['Restrições AL em Barcelona', 'Independentismo catalão', 'Sem NHR equiv.', 'Imposto herança'],
    profiles: ['Lifestyle', 'Beckham Law expats', 'Capital Growth'],
    scores: { yield: 4, growth: 6, tax: 5, safety: 7, lifestyle: 9, liquidity: 8 },
    price2020: 4100, investCosts: 12,
  },
  {
    id: 'lisboa', flag: '🇵🇹', name: 'Lisboa', country: 'Portugal',
    priceM2: 5000, yoyChange: 17.6, rentalYield: 4.2, dom: 145,
    foreignBuyerPct: 45, transactionVolume: 22, transactionCosts: 8.5,
    capitalGainsTax: 28, taxRegimes: ['NHR/IFICI 20%', '28% MV (50% excl)', 'D7', 'Golden Visa €500K'],
    mortgageLTV: 80, currency: 'EUR', liquidity: 'Alta',
    pros: ['NHR fiscal (20% flat)', 'Golden Visa', 'Lusofonia + inglês', 'Top 5 luxo mundial', 'Schengen'],
    cons: ['Pressão habitacional local', 'Burocracia cartórios', 'Mercado aquecido', 'AL restrições'],
    profiles: ['NHR Tax Optimization', 'Golden Visa', 'Lifestyle', 'Capital Growth', 'Yield'],
    scores: { yield: 7, growth: 9, tax: 8, safety: 9, lifestyle: 9, liquidity: 8 },
    price2020: 3800, investCosts: 10.5,
  },
  {
    id: 'madrid', flag: '🇪🇸', name: 'Madrid', country: 'Espanha',
    priceM2: 4500, yoyChange: 11.2, rentalYield: 3.5, dom: 122,
    foreignBuyerPct: 24, transactionVolume: 42, transactionCosts: 10,
    capitalGainsTax: 26, taxRegimes: ['IRPF 19–26%', 'Beckham Law 24%'],
    mortgageLTV: 70, currency: 'EUR', liquidity: 'Alta',
    pros: ['Grande mercado líquido', 'Beckham Law', 'Crescimento económico', 'Sem restrições AL Comunidad'],
    cons: ['CGT pesado', 'Sem NHR equiv.', 'Imposto herança Comunidad', 'Burocracia'],
    profiles: ['Capital Growth', 'Yield', 'Beckham Law'],
    scores: { yield: 4, growth: 7, tax: 5, safety: 8, lifestyle: 8, liquidity: 9 },
    price2020: 3200, investCosts: 12,
  },
  {
    id: 'porto', flag: '🇵🇹', name: 'Porto', country: 'Portugal',
    priceM2: 3643, yoyChange: 19.2, rentalYield: 5.2, dom: 134,
    foreignBuyerPct: 38, transactionVolume: 14, transactionCosts: 8.5,
    capitalGainsTax: 28, taxRegimes: ['NHR/IFICI 20%', '28% MV (50% excl)', 'D7'],
    mortgageLTV: 80, currency: 'EUR', liquidity: 'Alta',
    pros: ['Melhor yield Portugal', 'Preços entrada mais baixos', 'NHR disponível', 'Crescimento top'],
    cons: ['Mercado menor que Lisboa', 'Menos liquidez high ticket', 'Bairros heterogéneos', 'Menos expat infra'],
    profiles: ['Yield', 'Capital Growth', 'NHR', 'Entry Level'],
    scores: { yield: 9, growth: 10, tax: 8, safety: 8, lifestyle: 8, liquidity: 7 },
    price2020: 2400, investCosts: 10.5,
  },
  {
    id: 'madeira', flag: '🇵🇹', name: 'Madeira', country: 'Portugal (RAM)',
    priceM2: 3760, yoyChange: 18.9, rentalYield: 4.6, dom: 178,
    foreignBuyerPct: 42, transactionVolume: 5, transactionCosts: 8.5,
    capitalGainsTax: 28, taxRegimes: ['IVA 5%', 'NHR disponível', 'IRS benéfico RAM'],
    mortgageLTV: 80, currency: 'EUR', liquidity: 'Média',
    pros: ['IVA 5% habitação', 'NHR disponível', 'Clima 12 meses', 'Procura alemã/nórdica alta'],
    cons: ['Mercado pequeno', 'Acesso aéreo dependente', 'Oferta premium limitada', 'Liquidez moderada'],
    profiles: ['Lifestyle', 'Yield', 'NHR', 'Residência Principal'],
    scores: { yield: 7, growth: 8, tax: 8, safety: 9, lifestyle: 8, liquidity: 5 },
    price2020: 2200, investCosts: 10.5,
  },
  {
    id: 'acores', flag: '🇵🇹', name: 'Açores', country: 'Portugal (RAA)',
    priceM2: 1952, yoyChange: 9.4, rentalYield: 6.8, dom: 232,
    foreignBuyerPct: 22, transactionVolume: 2, transactionCosts: 8.5,
    capitalGainsTax: 28, taxRegimes: ['NHR disponível', 'Incentivos RAA', 'IRS benéfico'],
    mortgageLTV: 80, currency: 'EUR', liquidity: 'Baixa',
    pros: ['Yield mais alto da rede', 'Preços entrada baixos', 'Procura diaspora americana', 'Crescimento sustentável'],
    cons: ['Mercado muito pequeno', 'Liquidez baixa', 'Acesso aéreo limitado', 'Economia menos diversa'],
    profiles: ['Income Seeker', 'Entry Level', 'Diaspora'],
    scores: { yield: 10, growth: 5, tax: 7, safety: 8, lifestyle: 7, liquidity: 3 },
    price2020: 1400, investCosts: 10.5,
  },
]

// ─── INVESTOR PROFILES ────────────────────────────────────────────────────────
const INVESTOR_PROFILES: Record<string, { label: string; icon: string; description: string; rankKey: keyof City['scores'] }> = {
  income:   { label: 'Income Seeker', icon: '💰', description: 'Maximiza yield de arrendamento. Prioriza fluxo de caixa sobre apreciação.', rankKey: 'yield' },
  growth:   { label: 'Capital Growth', icon: '📈', description: 'Foco em apreciação de capital a longo prazo. Aceita yield menor.', rankKey: 'growth' },
  nhr:      { label: 'NHR / Tax Optimizer', icon: '🏛', description: 'Otimiza estrutura fiscal. NHR, zero CGT, regimes especiais.', rankKey: 'tax' },
  golden:   { label: 'Golden Visa', icon: '🛂', description: 'Residência europeia via investimento. Schengen e mobilidade.', rankKey: 'safety' },
  lifestyle: { label: 'Lifestyle Buyer', icon: '🌊', description: 'Qualidade de vida, clima, cultura, segurança. Secundária de prestígio.', rankKey: 'lifestyle' },
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(n: number): string { return Math.round(n).toLocaleString('pt-PT') }
function fmtK(n: number): string { return n >= 1000 ? `€${(n / 1000).toFixed(0)}K` : `€${n}` }

function scoreColor(v: number): string {
  if (v >= 8) return '#1c4a35'
  if (v >= 6) return '#52b788'
  if (v >= 4) return '#c9a96e'
  return '#e05454'
}

// ─── SVG COMPONENTS ──────────────────────────────────────────────────────────
function HorizontalBar({ value, max, color, highlight }: { value: number; max: number; color: string; highlight: boolean }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: 20, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: highlight ? '#c9a96e' : color,
        borderRadius: 4, transition: 'width 0.8s ease',
        boxShadow: highlight ? '0 0 8px rgba(201,169,110,0.5)' : 'none',
      }} />
    </div>
  )
}

function RadarChart({ cities, labels }: { cities: Array<{ name: string; scores: City['scores']; color: string }>; labels: string[] }) {
  const keys: (keyof City['scores'])[] = ['yield', 'growth', 'tax', 'safety', 'lifestyle', 'liquidity']
  const n = keys.length
  const cx = 110; const cy = 110; const r = 80
  const toPoint = (i: number, val: number) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    const d = (val / 10) * r
    return { x: cx + d * Math.cos(angle), y: cy + d * Math.sin(angle) }
  }
  // Grid rings
  const rings = [2, 4, 6, 8, 10]
  // Axis labels
  const axisLabelPoints = keys.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    const d = r + 20
    return { x: cx + d * Math.cos(angle), y: cy + d * Math.sin(angle) }
  })

  return (
    <svg viewBox="0 0 340 220" style={{ width: '100%', height: 220 }}>
      {/* Grid rings */}
      {rings.map(ring => {
        const pts = keys.map((_, i) => toPoint(i, ring))
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
        return <path key={ring} d={d} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
      })}
      {/* Axes */}
      {keys.map((_, i) => {
        const p = toPoint(i, 10)
        return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      })}
      {/* Axis labels */}
      {axisLabelPoints.map((p, i) => (
        <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill="#555" fontFamily="DM Mono, monospace" fontWeight="600">
          {labels[i]}
        </text>
      ))}
      {/* City polygons */}
      {cities.map((city, ci) => {
        const pts = keys.map((k, i) => toPoint(i, city.scores[k]))
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
        return (
          <g key={ci}>
            <path d={d} fill={`${city.color}30`} stroke={city.color} strokeWidth="2" />
            {pts.map((p, pi) => (
              <circle key={pi} cx={p.x} cy={p.y} r="3" fill={city.color} />
            ))}
          </g>
        )
      })}
      {/* Legend */}
      {cities.map((c, i) => (
        <g key={i}>
          <rect x={220} y={20 + i * 22} width={10} height={10} fill={c.color} rx="2" />
          <text x={235} y={29 + i * 22} fontSize="10" fill="#0e0e0d" fontFamily="DM Mono, monospace">{c.name}</text>
        </g>
      ))}
    </svg>
  )
}

function ArbitrageGroupBar({ cities }: { cities: City[] }) {
  const investment = 1000000
  const W = 560; const H = 160
  const barW = 18; const gapW = 10
  const groupW = barW * 2 + gapW + 24
  const sorted = [...cities].sort((a, b) => {
    const aV = investment * (1 + a.yoyChange / 100) ** 6 * (1 - a.investCosts / 100)
    const bV = investment * (1 + b.yoyChange / 100) ** 6 * (1 - b.investCosts / 100)
    return bV - aV
  })
  const maxVal = sorted.reduce((acc, c) => {
    const val = investment * (1 + c.yoyChange / 100) ** 6 * (1 - c.investCosts / 100)
    return Math.max(acc, val)
  }, investment)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {sorted.map((c, i) => {
        const currentVal = investment * (1 + c.yoyChange / 100) ** 6 * (1 - c.investCosts / 100)
        const isLisboa = c.id === 'lisboa'
        const bH = (investment / maxVal) * 100
        const cH = (currentVal / maxVal) * 100
        const x = 16 + i * groupW
        return (
          <g key={c.id}>
            <rect x={x} y={H - 24 - bH} width={barW} height={bH} fill="rgba(28,74,53,0.15)" rx="2" />
            <rect x={x + barW + gapW} y={H - 24 - cH} width={barW} height={cH}
              fill={isLisboa ? '#c9a96e' : '#1c4a35'} rx="2"
              stroke={isLisboa ? '#1c4a35' : 'none'} strokeWidth={isLisboa ? 1.5 : 0} />
            <text x={x + barW + gapW / 2} y={H - 6} textAnchor="middle" fontSize="7.5" fill={isLisboa ? '#c9a96e' : '#888'} fontFamily="DM Mono, monospace" fontWeight={isLisboa ? '700' : '400'}>
              {c.flag}
            </text>
            {i === 0 && (
              <text x={x + barW + gapW / 2} y={H - 24 - cH - 6} textAnchor="middle" fontSize="8" fill="#c9a96e" fontFamily="DM Mono, monospace" fontWeight="700">
                {fmtK(currentVal)}
              </text>
            )}
          </g>
        )
      })}
      <text x={16} y={14} fontSize="8" fill="rgba(28,74,53,0.4)" fontFamily="DM Mono, monospace">■ Inicial €1M</text>
      <text x={80} y={14} fontSize="8" fill="#1c4a35" fontFamily="DM Mono, monospace">■ Actual 2026</text>
      <text x={148} y={14} fontSize="8" fill="#c9a96e" fontFamily="DM Mono, monospace">■ Lisboa</text>
    </svg>
  )
}

// ─── CITY PROFILE CARD ────────────────────────────────────────────────────────
function CityProfileCard({ city, lisboaCity }: { city: City; lisboaCity: City }) {
  const comparisons = [
    { label: 'Preço/m²', cityV: city.priceM2, lisbV: lisboaCity.priceM2, fmtFn: (v: number) => `€${fmt(v)}` },
    { label: 'YoY', cityV: city.yoyChange, lisbV: lisboaCity.yoyChange, fmtFn: (v: number) => `${v > 0 ? '+' : ''}${v}%` },
    { label: 'Yield', cityV: city.rentalYield, lisbV: lisboaCity.rentalYield, fmtFn: (v: number) => `${v}%` },
    { label: 'CGT', cityV: city.capitalGainsTax, lisbV: lisboaCity.capitalGainsTax, fmtFn: (v: number) => `${v}%` },
    { label: 'DOM', cityV: city.dom, lisbV: lisboaCity.dom, fmtFn: (v: number) => `${v}d` },
  ]
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: 36 }}>{city.flag}</span>
        <div>
          <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 24, fontWeight: 700, margin: 0, color: '#0e0e0d' }}>{city.name}</h3>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888' }}>{city.country}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>Preço Médio</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: '#1c4a35' }}>€{fmt(city.priceM2)}/m²</div>
        </div>
      </div>

      {/* Key stats grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Yield Bruto', value: `${city.rentalYield}%` },
          { label: 'YoY', value: `${city.yoyChange > 0 ? '+' : ''}${city.yoyChange}%` },
          { label: 'DOM', value: `${city.dom}d` },
          { label: 'Comprador Est.', value: `${city.foreignBuyerPct}%` },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(28,74,53,0.05)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 700, color: '#0e0e0d', marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Regimes fiscais */}
      <div className="flex flex-wrap gap-2 mb-4">
        {city.taxRegimes.map(r => (
          <span key={r} style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(28,74,53,0.08)', fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#1c4a35', fontWeight: 600 }}>{r}</span>
        ))}
      </div>

      {/* Pros / Cons */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#1c4a35', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Vantagens</div>
          {city.pros.map((p, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <span style={{ color: '#1c4a35', fontSize: 12, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: 12, color: '#0e0e0d' }}>{p}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#e05454', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Atenções</div>
          {city.cons.map((c, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <span style={{ color: '#e05454', fontSize: 12, marginTop: 1 }}>×</span>
              <span style={{ fontSize: 12, color: '#0e0e0d' }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Profile tags */}
      <div>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Melhor para:</div>
        <div className="flex flex-wrap gap-2">
          {city.profiles.map(p => (
            <span key={p} style={{ padding: '4px 12px', borderRadius: 999, background: '#1c4a35', color: '#f4f0e6', fontSize: 11, fontFamily: 'DM Mono, monospace' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* vs Lisboa */}
      {city.id !== 'lisboa' && (
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(28,74,53,0.1)', paddingTop: 16 }}>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>vs Lisboa 🇵🇹</div>
          <div className="space-y-2">
            {comparisons.map(c => {
              const diff = c.cityV - c.lisbV
              const better = c.label === 'CGT' || c.label === 'DOM' ? diff < 0 : diff > 0
              return (
                <div key={c.label} className="flex items-center justify-between">
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888', width: 70 }}>{c.label}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600 }}>{c.fmtFn(c.cityV)}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: better ? '#1c4a35' : '#e05454' }}>
                    {diff > 0 ? '+' : ''}{c.label === 'Preço/m²' || c.label === 'DOM' ? fmt(diff) : diff.toFixed(1)}
                    {c.label === 'Preço/m²' ? '' : '%'}
                    {better ? ' ✓' : ' ↓'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PortalCrossCompare() {
  const [activeTab, setActiveTab] = useState<'precos' | 'detalhe' | 'perfis' | 'arbitragem'>('precos')
  const [priceMetric, setPriceMetric] = useState<'price' | 'yoy' | 'yield' | 'volume'>('price')
  const [selectedCity, setSelectedCity] = useState<City>(CITIES.find(c => c.id === 'lisboa')!)
  const [selectedProfile, setSelectedProfile] = useState<string>('income')
  const [radarCities, setRadarCities] = useState<string[]>(['lisboa', 'porto', 'barcelona'])

  const lisboaCity = CITIES.find(c => c.id === 'lisboa')!

  const sortedCities = useMemo(() => {
    return [...CITIES].sort((a, b) => {
      if (priceMetric === 'price') return b.priceM2 - a.priceM2
      if (priceMetric === 'yoy') return b.yoyChange - a.yoyChange
      if (priceMetric === 'yield') return b.rentalYield - a.rentalYield
      return b.transactionVolume - a.transactionVolume
    })
  }, [priceMetric])

  const maxMetricValue = useMemo(() => {
    if (priceMetric === 'price') return Math.max(...CITIES.map(c => c.priceM2))
    if (priceMetric === 'yoy') return Math.max(...CITIES.map(c => Math.abs(c.yoyChange)))
    if (priceMetric === 'yield') return Math.max(...CITIES.map(c => c.rentalYield))
    return Math.max(...CITIES.map(c => c.transactionVolume))
  }, [priceMetric])

  const profileData = INVESTOR_PROFILES[selectedProfile]
  const profileRanked = useMemo(() => {
    return [...CITIES]
      .sort((a, b) => b.scores[profileData.rankKey] - a.scores[profileData.rankKey])
      .slice(0, 5)
  }, [selectedProfile, profileData.rankKey])

  const radarCityData = useMemo(() => {
    const colors = ['#1c4a35', '#c9a96e', '#e05454']
    return radarCities.map((id, i) => ({
      ...CITIES.find(c => c.id === id)!,
      color: colors[i] ?? '#888',
    }))
  }, [radarCities])

  const arbitrageData = useMemo(() => {
    return CITIES.map(c => {
      const initialInvestment = 1000000
      const afterCosts = initialInvestment * (1 - c.investCosts / 100)
      const currentValue = afterCosts * Math.pow(1 + c.yoyChange / 100, 6)
      const gain = currentValue - initialInvestment
      return { ...c, currentValue, gain, roi: ((currentValue - initialInvestment) / initialInvestment) * 100 }
    }).sort((a, b) => b.currentValue - a.currentValue)
  }, [])

  const TABS = [
    { id: 'precos', label: 'Comparação de Preços' },
    { id: 'detalhe', label: 'Análise Detalhada' },
    { id: 'perfis', label: 'Para Cada Perfil' },
    { id: 'arbitragem', label: 'Simulador de Arbitragem' },
  ] as const

  function metricValue(c: City): number {
    if (priceMetric === 'price') return c.priceM2
    if (priceMetric === 'yoy') return c.yoyChange
    if (priceMetric === 'yield') return c.rentalYield
    return c.transactionVolume
  }

  function metricLabel(c: City): string {
    if (priceMetric === 'price') return `€${fmt(c.priceM2)}/m²`
    if (priceMetric === 'yoy') return `${c.yoyChange > 0 ? '+' : ''}${c.yoyChange}%`
    if (priceMetric === 'yield') return `${c.rentalYield}%`
    return `${c.transactionVolume}K/ano`
  }

  function metricBarColor(c: City): string {
    if (priceMetric === 'yoy') return c.yoyChange >= 0 ? '#1c4a35' : '#e05454'
    return '#1c4a35'
  }

  return (
    <div style={{ background: '#f4f0e6', minHeight: '100vh', fontFamily: 'Jost, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ background: '#1c4a35', padding: '20px 28px' }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ fontFamily: 'Cormorant, serif', fontSize: 28, color: '#f4f0e6', fontWeight: 700, margin: 0 }}>
              Global Market Intelligence
            </h1>
            <p style={{ color: 'rgba(244,240,230,0.6)', fontSize: 13, marginTop: 4, fontFamily: 'DM Mono, monospace' }}>
              10 Mercados · Dados 2026 · Comparação Internacional
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'Mercados', value: '10' },
              { label: 'Melhor Yield', value: '6.8% (Açores)' },
              { label: 'Melhor Growth', value: '+19.2% (Porto)' },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: 'rgba(244,240,230,0.1)', borderRadius: 10, padding: '10px 16px', border: '1px solid rgba(201,169,110,0.3)' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(244,240,230,0.5)', letterSpacing: '0.1em' }}>{kpi.label}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, color: '#c9a96e', fontWeight: 700 }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-1 mt-5 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '0.05em', transition: 'all 0.2s',
              background: activeTab === t.id ? '#c9a96e' : 'rgba(244,240,230,0.1)',
              color: activeTab === t.id ? '#1c4a35' : 'rgba(244,240,230,0.7)',
              fontWeight: activeTab === t.id ? 700 : 400,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* ── Tab 1: Comparação de Preços ──────────────────────────── */}
        {activeTab === 'precos' && (
          <div className="space-y-6">

            {/* Metric toggle */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 22, color: '#0e0e0d', fontWeight: 600, margin: 0 }}>
                  Ranking de Mercados
                </h2>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'price', label: '€/m²' },
                    { key: 'yoy', label: 'YoY %' },
                    { key: 'yield', label: 'Yield' },
                    { key: 'volume', label: 'Volume' },
                  ].map(m => (
                    <button
                      key={m.key}
                      onClick={() => setPriceMetric(m.key as typeof priceMetric)}
                      style={{
                        padding: '6px 16px', borderRadius: 8,
                        border: `1.5px solid ${priceMetric === m.key ? '#1c4a35' : 'rgba(28,74,53,0.2)'}`,
                        background: priceMetric === m.key ? '#1c4a35' : 'transparent',
                        color: priceMetric === m.key ? '#f4f0e6' : '#1c4a35',
                        fontFamily: 'DM Mono, monospace', fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >{m.label}</button>
                  ))}
                </div>
              </div>

              {/* Horizontal bar chart */}
              <div className="space-y-3">
                {sortedCities.map((c, i) => {
                  const val = metricValue(c)
                  const absVal = Math.abs(val)
                  const max = maxMetricValue
                  const isLisboa = c.id === 'lisboa'
                  const barColor = isLisboa ? '#c9a96e' : metricBarColor(c)
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 cursor-pointer"
                      onClick={() => { setSelectedCity(c); setActiveTab('detalhe') }}
                      style={{ padding: '6px 0' }}
                    >
                      <div style={{ width: 28, textAlign: 'center', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888' }}>#{i + 1}</div>
                      <span style={{ fontSize: 22, width: 32 }}>{c.flag}</span>
                      <div style={{ width: 130 }}>
                        <div style={{ fontWeight: isLisboa ? 700 : 500, fontSize: 13, color: isLisboa ? '#c9a96e' : '#0e0e0d' }}>{c.name}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>{c.country}</div>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div style={{ flex: 1, height: 20, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${(absVal / max) * 100}%`,
                            background: barColor,
                            borderRadius: 4,
                            transition: 'width 0.6s ease',
                            boxShadow: isLisboa ? '0 0 8px rgba(201,169,110,0.4)' : 'none',
                          }} />
                        </div>
                        <div style={{
                          width: 110, textAlign: 'right',
                          fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700,
                          color: priceMetric === 'yoy' ? (val >= 0 ? '#1c4a35' : '#e05454') : isLisboa ? '#c9a96e' : '#0e0e0d'
                        }}>{metricLabel(c)}</div>
                      </div>
                      {isLisboa && (
                        <div style={{ width: 40, display: 'flex', justifyContent: 'center' }}>
                          <span style={{ background: '#c9a96e', color: '#1c4a35', fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>FOCO</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mini comparison table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Visão Completa · Todos os Mercados</h2>
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(28,74,53,0.1)' }}>
                      {['', 'Mercado', '€/m²', 'YoY', 'Yield', 'DOM', 'CGT', 'Liquidez', 'Score'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CITIES.map((c) => {
                      const isLisboa = c.id === 'lisboa'
                      const totalScore = Math.round(Object.values(c.scores).reduce((a, b) => a + b, 0) / 6 * 10)
                      return (
                        <tr
                          key={c.id}
                          onClick={() => { setSelectedCity(c); setActiveTab('detalhe') }}
                          style={{
                            borderBottom: '1px solid rgba(28,74,53,0.06)',
                            background: isLisboa ? 'rgba(201,169,110,0.07)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { if (!isLisboa) e.currentTarget.style.background = 'rgba(28,74,53,0.03)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = isLisboa ? 'rgba(201,169,110,0.07)' : 'transparent' }}
                        >
                          <td style={{ padding: '9px 10px', fontSize: 18 }}>{c.flag}</td>
                          <td style={{ padding: '9px 10px', fontWeight: isLisboa ? 700 : 500, fontSize: 13, color: isLisboa ? '#c9a96e' : '#0e0e0d', whiteSpace: 'nowrap' }}>{c.name}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 600 }}>€{fmt(c.priceM2)}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: c.yoyChange >= 0 ? '#1c4a35' : '#e05454', fontWeight: 600 }}>{c.yoyChange > 0 ? '+' : ''}{c.yoyChange}%</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: c.rentalYield >= 5 ? '#1c4a35' : '#888' }}>{c.rentalYield}%</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#666' }}>{c.dom}d</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: c.capitalGainsTax === 0 ? '#1c4a35' : '#0e0e0d' }}>{c.capitalGainsTax === 0 ? 'Zero' : `${c.capitalGainsTax}%`}</td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace', background: c.liquidity === 'Alta' ? 'rgba(28,74,53,0.1)' : c.liquidity === 'Média' ? 'rgba(201,169,110,0.15)' : 'rgba(224,84,84,0.1)', color: c.liquidity === 'Alta' ? '#1c4a35' : c.liquidity === 'Média' ? '#8a6c2e' : '#e05454' }}>
                              {c.liquidity}
                            </span>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <div className="flex items-center gap-2">
                              <div style={{ width: 32, height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3 }}>
                                <div style={{ width: `${totalScore}%`, height: 6, borderRadius: 3, background: scoreColor(totalScore / 10) }} />
                              </div>
                              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: scoreColor(totalScore / 10) }}>{totalScore}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Análise Detalhada ─────────────────────────────── */}
        {activeTab === 'detalhe' && (
          <div className="space-y-6">
            {/* City selector pills */}
            <div className="flex flex-wrap gap-2">
              {CITIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCity(c)}
                  style={{
                    padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                    border: `1.5px solid ${selectedCity.id === c.id ? '#1c4a35' : 'rgba(28,74,53,0.2)'}`,
                    background: selectedCity.id === c.id ? '#1c4a35' : '#fff',
                    color: selectedCity.id === c.id ? '#f4f0e6' : '#1c4a35',
                    fontSize: 13, fontFamily: 'DM Mono, monospace',
                    fontWeight: selectedCity.id === c.id ? 700 : 400,
                    transition: 'all 0.2s',
                  }}
                >{c.flag} {c.name}</button>
              ))}
            </div>

            <CityProfileCard city={selectedCity} lisboaCity={lisboaCity} />

            {/* Score bars */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 16 }}>Scores de Avaliação</h3>
              <div className="space-y-3">
                {Object.entries(selectedCity.scores).map(([key, val]) => {
                  const labels: Record<string, string> = { yield: 'Yield', growth: 'Crescimento', tax: 'Fiscalidade', safety: 'Segurança', lifestyle: 'Lifestyle', liquidity: 'Liquidez' }
                  return (
                    <div key={key} className="flex items-center gap-4">
                      <span style={{ width: 90, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#888' }}>{labels[key]}</span>
                      <div style={{ flex: 1, height: 12, background: 'rgba(0,0,0,0.06)', borderRadius: 6 }}>
                        <div style={{ width: `${val * 10}%`, height: 12, borderRadius: 6, background: scoreColor(val), transition: 'width 0.7s ease' }} />
                      </div>
                      <span style={{ width: 28, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, color: scoreColor(val) }}>{val}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Para Cada Perfil ──────────────────────────────── */}
        {activeTab === 'perfis' && (
          <div className="space-y-6">

            {/* Profile selector */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(INVESTOR_PROFILES).map(([k, p]) => (
                <button
                  key={k}
                  onClick={() => setSelectedProfile(k)}
                  style={{
                    padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${selectedProfile === k ? '#1c4a35' : 'rgba(28,74,53,0.2)'}`,
                    background: selectedProfile === k ? '#1c4a35' : '#fff',
                    color: selectedProfile === k ? '#f4f0e6' : '#1c4a35',
                    fontFamily: 'DM Mono, monospace', fontSize: 12, transition: 'all 0.2s',
                    fontWeight: selectedProfile === k ? 700 : 400,
                  }}
                >{p.icon} {p.label}</button>
              ))}
            </div>

            {/* Profile description */}
            <div style={{ background: '#1c4a35', borderRadius: 16, padding: '18px 24px' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{profileData.icon}</div>
              <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 22, color: '#f4f0e6', fontWeight: 700, margin: '0 0 6px' }}>{profileData.label}</h2>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,230,0.8)', margin: 0 }}>{profileData.description}</p>
            </div>

            {/* Top 5 Ranked */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 20, color: '#0e0e0d', fontWeight: 600, marginBottom: 20 }}>
                Top 5 Mercados para {profileData.label}
              </h3>
              <div className="space-y-4">
                {profileRanked.map((c, i) => {
                  const scoreKey = profileData.rankKey
                  const score = c.scores[scoreKey]
                  const reasons: Record<string, string[]> = {
                    income: [
                      `Yield de ${c.rentalYield}% bruto`, `DOM de ${c.dom} dias`, `Procura estrangeira ${c.foreignBuyerPct}%`
                    ],
                    growth: [`YoY ${c.yoyChange > 0 ? '+' : ''}${c.yoyChange}%`, `Score crescimento ${c.scores.growth}/10`, `Liquidez ${c.liquidity}`],
                    nhr: [`CGT: ${c.capitalGainsTax === 0 ? 'Zero' : c.capitalGainsTax + '%'}`, `Regimes: ${c.taxRegimes.join(', ')}`, `Score fiscal ${c.scores.tax}/10`],
                    golden: [`Score segurança ${c.scores.safety}/10`, `Regimes visa: ${c.taxRegimes.join(', ')}`, `Liquidez ${c.liquidity}`],
                    lifestyle: [`Score lifestyle ${c.scores.lifestyle}/10`, `DOM ${c.dom}d`, `Score segurança ${c.scores.safety}/10`],
                  }
                  const isTop1 = i === 0
                  return (
                    <div
                      key={c.id}
                      style={{
                        borderRadius: 12, padding: '16px 20px',
                        border: isTop1 ? '2px solid #c9a96e' : '1px solid rgba(28,74,53,0.1)',
                        background: isTop1 ? 'rgba(201,169,110,0.07)' : 'rgba(28,74,53,0.02)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: isTop1 ? '#c9a96e' : 'rgba(28,74,53,0.12)',
                            color: isTop1 ? '#1c4a35' : '#1c4a35',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700,
                          }}>#{i + 1}</div>
                          <span style={{ fontSize: 28 }}>{c.flag}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16, color: isTop1 ? '#c9a96e' : '#0e0e0d' }}>{c.name}</div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>{c.country}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888' }}>Score {profileData.label}</div>
                          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: scoreColor(score) }}>{score}/10</div>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {(reasons[selectedProfile] ?? []).map((r, ri) => (
                          <span key={ri} style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(28,74,53,0.08)', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#1c4a35' }}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Radar chart */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, margin: 0 }}>Radar · Top 3 Mercados</h3>
                <div className="flex gap-2">
                  {radarCities.map((id, idx) => (
                    <select
                      key={idx}
                      value={id}
                      onChange={e => {
                        const next = [...radarCities]
                        next[idx] = e.target.value
                        setRadarCities(next)
                      }}
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid rgba(28,74,53,0.2)', background: '#f4f0e6', fontFamily: 'DM Mono, monospace', fontSize: 11, appearance: 'none' }}
                    >
                      {CITIES.map(c => <option key={c.id} value={c.id}>{c.flag} {c.name}</option>)}
                    </select>
                  ))}
                </div>
              </div>
              <RadarChart
                cities={radarCityData}
                labels={['Yield', 'Crescim.', 'Fiscal', 'Segurança', 'Lifestyle', 'Liquidez']}
              />
            </div>
          </div>
        )}

        {/* ── Tab 4: Simulador de Arbitragem ───────────────────────── */}
        {activeTab === 'arbitragem' && (
          <div className="space-y-6">

            {/* Description */}
            <div style={{ background: '#1c4a35', borderRadius: 16, padding: '20px 28px' }}>
              <h2 style={{ fontFamily: 'Cormorant, serif', fontSize: 24, color: '#f4f0e6', fontWeight: 700, margin: '0 0 8px' }}>
                Se investisse €1M em cada mercado em 2020...
              </h2>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: 'rgba(244,240,230,0.8)', margin: 0 }}>
                Valor projetado em 2026 após 6 anos de apreciação, líquido de todos os custos de transacção e entrada.
              </p>
            </div>

            {/* Bar chart */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 18, color: '#0e0e0d', fontWeight: 600, marginBottom: 20 }}>
                €1M Investido 2020 → Valor 2026
              </h3>
              <ArbitrageGroupBar cities={CITIES} />
            </div>

            {/* Arbitrage table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(28,74,53,0.1)', padding: '20px 24px' }}>
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(28,74,53,0.1)' }}>
                      {['', 'Mercado', 'Investimento', 'Custos Entrada', 'Aprec. YoY', 'Valor 2026', 'Ganho Líquido', 'ROI Total'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arbitrageData.map((c, i) => {
                      const isWinner = i === 0
                      const isLisboa = c.id === 'lisboa'
                      return (
                        <tr key={c.id} style={{
                          borderBottom: '1px solid rgba(28,74,53,0.06)',
                          background: isWinner ? 'rgba(201,169,110,0.1)' : isLisboa ? 'rgba(28,74,53,0.04)' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: isWinner ? '#c9a96e' : '#888' }}>#{i + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 14 }}>
                            {c.flag} {c.name}
                            {isWinner && <span style={{ marginLeft: 8, background: '#c9a96e', color: '#1c4a35', fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>VENCEDOR</span>}
                            {isLisboa && !isWinner && <span style={{ marginLeft: 8, background: '#1c4a35', color: '#f4f0e6', fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>FOCO</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>€1.000.000</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#e05454' }}>−€{fmt(1000000 * c.investCosts / 100)}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: c.yoyChange > 0 ? '#1c4a35' : '#e05454', fontWeight: 600 }}>
                            {c.yoyChange > 0 ? '+' : ''}{c.yoyChange}%/a
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: isWinner ? '#c9a96e' : '#0e0e0d' }}>
                            €{fmt(c.currentValue)}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, color: c.gain > 0 ? '#1c4a35' : '#e05454' }}>
                            {c.gain > 0 ? '+' : ''}€{fmt(c.gain)}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 700, color: c.roi > 20 ? '#1c4a35' : c.roi > 0 ? '#52b788' : '#e05454' }}>
                            {c.roi > 0 ? '+' : ''}{c.roi.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conclusion */}
            <div style={{ background: 'linear-gradient(135deg, #c9a96e, #b8913d)', borderRadius: 16, padding: '22px 28px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(28,74,53,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Conclusão do Simulador</div>
              <h3 style={{ fontFamily: 'Cormorant, serif', fontSize: 22, color: '#1c4a35', fontWeight: 700, margin: '0 0 12px' }}>
                {arbitrageData[0].flag} {arbitrageData[0].name} lidera — €{fmt(arbitrageData[0].currentValue)} sobre €1M investido
              </h3>
              <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, color: '#1c4a35', lineHeight: 1.6, margin: 0 }}>
                Dos 10 mercados analisados, <strong>{arbitrageData[0].name}</strong> oferece o melhor retorno bruto de capital a 6 anos com +{arbitrageData[0].roi.toFixed(1)}% ROI total.
                Lisboa situa-se em #{arbitrageData.findIndex(c => c.id === 'lisboa') + 1} com {fmtK(arbitrageData.find(c => c.id === 'lisboa')?.currentValue ?? 0)} —
                combinando crescimento acelerado (+17.6% YoY) com regime NHR que pode reduzir significativamente o imposto sobre mais-valias.
                Paris, o único mercado em contracção, seria a pior opção com ROI negativo após custos.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
