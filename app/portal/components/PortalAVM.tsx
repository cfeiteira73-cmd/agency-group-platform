'use client'
import { useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useAVMStore } from '../stores/avmStore'

interface PortalAVMProps {
  onRunAVM: () => Promise<void>
  onAddToPortfolio?: (data: Record<string, unknown>) => void
}

// ─── Confidence Gauge SVG ─────────────────────────────────────────────────────
function Gauge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(Math.max(value / max, 0), 1)
  const r = 40
  const cx = 50
  const cy = 52
  const circumference = Math.PI * r
  const dash = circumference * pct
  const gap = circumference - dash
  const color = pct > 0.8 ? '#22c55e' : pct > 0.6 ? '#c9a96e' : '#e05252'

  const startX = cx - r
  const startY = cy
  const endX = cx + r
  const endY = cy

  // Needle angle (0% = 180deg left, 100% = 0deg right)
  const needleAngle = 180 - pct * 180
  const needleRad = (needleAngle * Math.PI) / 180
  const needleLen = 32
  const nx = cx + needleLen * Math.cos(needleRad)
  const ny = cy - needleLen * Math.sin(needleRad)

  return (
    <svg width="100" height="64" viewBox="0 0 100 64" aria-label={`Confiança: ${value}%`} style={{ overflow: 'visible' }}>
      {/* Track */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        fill="none" stroke="rgba(14,14,13,.08)" strokeWidth="8" strokeLinecap="round"
      />
      {/* Zone ticks — low/mid/high */}
      {[0, 0.33, 0.66, 1].map((t, i) => {
        const ang = (180 - t * 180) * Math.PI / 180
        const x1 = cx + (r - 6) * Math.cos(ang)
        const y1 = cy - (r - 6) * Math.sin(ang)
        const x2 = cx + (r + 2) * Math.cos(ang)
        const y2 = cy - (r + 2) * Math.sin(ang)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(14,14,13,.12)" strokeWidth="1" />
      })}
      {/* Fill */}
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ transition: 'stroke-dasharray .6s ease, stroke .4s ease' }}
      />
      {/* Needle */}
      <line
        x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={color} strokeWidth="2" strokeLinecap="round"
        style={{ transition: 'x2 .6s ease, y2 .6s ease' }}
      />
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
      {/* Value label */}
      <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontFamily: "'Cormorant',serif", fontSize: '13px', fill: color, fontWeight: 600 }}>
        {value}%
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5.5px', fill: 'rgba(14,14,13,.35)', letterSpacing: '.1em' }}>
        CONFIANÇA
      </text>
      {/* Zone labels */}
      <text x={startX - 2} y={cy + 16} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5px', fill: '#e05252', opacity: .7 }}>Baixa</text>
      <text x={cx} y={cy - r - 6} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5px', fill: '#c9a96e', opacity: .7 }}>Mod.</text>
      <text x={endX + 2} y={cy + 16} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5px', fill: '#22c55e', opacity: .7 }}>Alta</text>
    </svg>
  )
}

// ─── Inline Bar ───────────────────────────────────────────────────────────────
function InlineBar({ pct, color = '#1c4a35' }: { pct: number; color?: string }) {
  return (
    <div style={{ height: '4px', background: 'rgba(14,14,13,.06)', borderRadius: '2px', overflow: 'hidden', minWidth: '60px' }}>
      <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: '2px', transition: 'width .5s ease' }} />
    </div>
  )
}

// ─── Price History SVG Line Chart ────────────────────────────────────────────
const PRICE_HISTORY: Record<string, { year: number; price: number }[]> = {
  'Lisboa — Chiado': [
    { year: 2022, price: 7800 }, { year: 2023, price: 8400 }, { year: 2024, price: 9100 }, { year: 2025, price: 9500 }, { year: 2026, price: 9800 },
  ],
  'Lisboa — Príncipe Real': [
    { year: 2022, price: 7200 }, { year: 2023, price: 7800 }, { year: 2024, price: 8500 }, { year: 2025, price: 8900 }, { year: 2026, price: 9200 },
  ],
  'Lisboa — Bairro Alto': [
    { year: 2022, price: 6800 }, { year: 2023, price: 7400 }, { year: 2024, price: 8000 }, { year: 2025, price: 8500 }, { year: 2026, price: 8800 },
  ],
  'Lisboa — Alfama': [
    { year: 2022, price: 5900 }, { year: 2023, price: 6400 }, { year: 2024, price: 6900 }, { year: 2025, price: 7200 }, { year: 2026, price: 7400 },
  ],
  'Lisboa — Belém': [
    { year: 2022, price: 5600 }, { year: 2023, price: 6100 }, { year: 2024, price: 6600 }, { year: 2025, price: 6900 }, { year: 2026, price: 7100 },
  ],
  'Lisboa — Parque das Nações': [
    { year: 2022, price: 5500 }, { year: 2023, price: 5900 }, { year: 2024, price: 6300 }, { year: 2025, price: 6600 }, { year: 2026, price: 6800 },
  ],
  'Lisboa — Avenidas Novas': [
    { year: 2022, price: 5100 }, { year: 2023, price: 5500 }, { year: 2024, price: 5900 }, { year: 2025, price: 6200 }, { year: 2026, price: 6400 },
  ],
  'Cascais': [
    { year: 2022, price: 4600 }, { year: 2023, price: 5000 }, { year: 2024, price: 5400 }, { year: 2025, price: 5700 }, { year: 2026, price: 5890 },
  ],
  'Porto — Foz': [
    { year: 2022, price: 4100 }, { year: 2023, price: 4500 }, { year: 2024, price: 4800 }, { year: 2025, price: 5000 }, { year: 2026, price: 5200 },
  ],
  'Algarve — Vilamoura': [
    { year: 2022, price: 4000 }, { year: 2023, price: 4400 }, { year: 2024, price: 4700 }, { year: 2025, price: 4900 }, { year: 2026, price: 5100 },
  ],
}

const DEFAULT_HISTORY = [
  { year: 2022, price: 2400 }, { year: 2023, price: 2650 }, { year: 2024, price: 2850 }, { year: 2025, price: 3000 }, { year: 2026, price: 3076 },
]

function PriceHistoryChart({ zona }: { zona: string }) {
  const data = PRICE_HISTORY[zona] ?? DEFAULT_HISTORY
  const W = 260
  const H = 80
  const padL = 38
  const padR = 12
  const padT = 10
  const padB = 22
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const minPrice = Math.min(...data.map(d => d.price)) * 0.92
  const maxPrice = Math.max(...data.map(d => d.price)) * 1.04
  const priceRange = maxPrice - minPrice || 1

  const toX = (i: number) => padL + (i / (data.length - 1)) * innerW
  const toY = (p: number) => padT + innerH - ((p - minPrice) / priceRange) * innerH

  const polyPoints = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.price).toFixed(1)}`).join(' ')
  // Area fill path
  const areaPath = [
    `M ${toX(0).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
    ...data.map((d, i) => `L ${toX(i).toFixed(1)} ${toY(d.price).toFixed(1)}`),
    `L ${toX(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
    'Z',
  ].join(' ')

  const growth = data.length >= 2
    ? (((data[data.length - 1].price - data[0].price) / data[0].price) * 100).toFixed(1)
    : '0.0'
  const growthPositive = parseFloat(growth) >= 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)' }}>
          Evolução do Preço 2022–2026
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: growthPositive ? '#22c55e' : '#e05252' }}>
          {growthPositive ? '+' : ''}{growth}% · 4 anos
        </div>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-label={`Evolução de preço €/m² em ${zona}`} style={{ overflow: 'visible', display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((t, i) => {
          const y = padT + innerH * (1 - t)
          const priceAtLine = Math.round(minPrice + t * priceRange)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(14,14,13,.06)" strokeWidth="1" strokeDasharray="3,3" />
              <text x={padL - 4} y={y + 4} textAnchor="end" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5px', fill: 'rgba(14,14,13,.3)' }}>
                {priceAtLine >= 1000 ? `${(priceAtLine / 1000).toFixed(1)}k` : priceAtLine}
              </text>
            </g>
          )
        })}

        {/* Area fill */}
        <defs>
          <linearGradient id="avm-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c4a35" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1c4a35" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#avm-area-grad)" />

        {/* Line */}
        <polyline points={polyPoints} fill="none" stroke="#1c4a35" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.price)} r="3.5" fill="#1c4a35" />
            <circle cx={toX(i)} cy={toY(d.price)} r="6" fill="#1c4a35" fillOpacity="0.08" />
          </g>
        ))}

        {/* Year labels */}
        {data.map((d, i) => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5.5px', fill: 'rgba(14,14,13,.35)' }}>
            {d.year}
          </text>
        ))}

        {/* Current value tooltip on last point */}
        {data.length > 0 && (() => {
          const last = data[data.length - 1]
          const lx = toX(data.length - 1)
          const ly = toY(last.price)
          return (
            <g>
              <rect x={lx - 22} y={ly - 20} width="44" height="13" rx="2" fill="#1c4a35" />
              <text x={lx} y={ly - 10} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '6px', fill: '#f4f0e6' }}>
                €{last.price.toLocaleString('pt-PT')}/m²
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

// ─── Adjustment Factors Panel ─────────────────────────────────────────────────

interface AdjustmentFactor {
  label: string
  key: string
  min: number
  max: number
  step: number
  defaultVal: number
  unit: string
  description: string
}

const ADJUSTMENT_FACTORS: AdjustmentFactor[] = [
  { label: 'Estado de Conservação', key: 'estado', min: -15, max: 10, step: 1, defaultVal: 0, unit: '%', description: 'Novo → Para Renovar' },
  { label: 'Andar / Elevação', key: 'andar', min: -5, max: 12, step: 1, defaultVal: 0, unit: '%', description: 'RC → 6+' },
  { label: 'Vista Privilegiada', key: 'vista', min: 0, max: 20, step: 1, defaultVal: 0, unit: '%', description: 'Interior → Mar/Rio' },
  { label: 'Garagem / Estacionamento', key: 'garagem', min: 0, max: 8, step: 0.5, defaultVal: 0, unit: '%', description: 'Sem → Box privada' },
]

function AdjustmentFactorsPanel({
  baseValue,
  darkMode,
}: {
  baseValue: number
  darkMode: boolean
}) {
  const [factors, setFactors] = useState<Record<string, number>>(() =>
    Object.fromEntries(ADJUSTMENT_FACTORS.map(f => [f.key, f.defaultVal]))
  )

  const totalAdjustment = Object.values(factors).reduce((s, v) => s + v, 0)
  const adjustedValue = baseValue > 0 ? baseValue * (1 + totalAdjustment / 100) : 0
  const adjustedColor = totalAdjustment >= 0 ? '#4a9c7a' : '#dc2626'

  return (
    <div className="p-card">
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>
        Factores de Ajuste
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
        {ADJUSTMENT_FACTORS.map(f => {
          const val = factors[f.key] ?? f.defaultVal
          const pct = (val - f.min) / (f.max - f.min)
          const isPositive = val > 0
          const isNegative = val < 0
          const valueColor = isPositive ? '#4a9c7a' : isNegative ? '#dc2626' : 'rgba(14,14,13,.35)'

          return (
            <div key={f.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.7)', marginBottom: '1px' }}>{f.label}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>{f.description}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: valueColor, fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>
                  {val > 0 ? '+' : ''}{val}{f.unit}
                </div>
              </div>
              <div style={{ position: 'relative', height: '6px', background: 'rgba(14,14,13,.06)', borderRadius: '3px' }}>
                {/* Zero marker */}
                <div style={{
                  position: 'absolute',
                  left: `${((0 - f.min) / (f.max - f.min)) * 100}%`,
                  top: '-2px', bottom: '-2px',
                  width: '1px', background: 'rgba(14,14,13,.2)',
                }} />
                {/* Fill bar */}
                <div style={{
                  position: 'absolute',
                  left: `${((0 - f.min) / (f.max - f.min)) * 100}%`,
                  width: `${Math.abs(pct - (0 - f.min) / (f.max - f.min)) * 100}%`,
                  marginLeft: val < 0 ? `-${Math.abs(pct - (0 - f.min) / (f.max - f.min)) * 100}%` : '0',
                  height: '100%',
                  background: valueColor,
                  borderRadius: '3px',
                  transition: 'width .3s, background .2s',
                }} />
                {/* Thumb */}
                <div style={{
                  position: 'absolute',
                  left: `${pct * 100}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '12px', height: '12px',
                  background: valueColor,
                  borderRadius: '50%',
                  border: `2px solid ${darkMode ? '#122a1a' : '#f9f7f4'}`,
                  boxShadow: `0 0 0 2px ${valueColor}40`,
                  transition: 'left .1s, background .2s',
                  zIndex: 1,
                }} />
              </div>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={val}
                onChange={e => setFactors(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) }))}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '20px',
                  marginTop: '-13px',
                  cursor: 'pointer',
                }}
                aria-label={f.label}
              />
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div style={{
        padding: '10px 14px',
        background: `${adjustedColor}08`,
        border: `1px solid ${adjustedColor}25`,
        borderRadius: '10px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '2px' }}>AJUSTE TOTAL</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: adjustedColor, fontWeight: 300 }}>
            {totalAdjustment > 0 ? '+' : ''}{totalAdjustment.toFixed(1)}%
          </div>
        </div>
        {baseValue > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '2px' }}>VALOR AJUSTADO</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: adjustedColor, fontWeight: 300 }}>
              €{Math.round(adjustedValue).toLocaleString('pt-PT')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Preços de referência por zona ───────────────────────────────────────────
const ZONA_PRICES: Record<string, number> = {
  'Lisboa — Chiado': 9800,
  'Lisboa — Príncipe Real': 9200,
  'Lisboa — Bairro Alto': 8800,
  'Lisboa — Alfama': 7400,
  'Lisboa — Belém': 7100,
  'Lisboa — Parque das Nações': 6800,
  'Lisboa — Avenidas Novas': 6400,
  'Cascais': 5890,
  'Estoril': 5600,
  'Sintra': 3200,
  'Oeiras': 4100,
  'Porto — Foz': 5200,
  'Porto — Boavista': 4600,
  'Porto — Ribeira': 4900,
  'Algarve — Lagos': 4800,
  'Algarve — Albufeira': 4200,
  'Algarve — Vilamoura': 5100,
  'Comporta': 6500,
  'Alentejo': 1800,
  'Madeira — Funchal': 3760,
  'Açores — Ponta Delgada': 1952,
}

// ─── Zone Heatmap Reference Table ─────────────────────────────────────────────
const ZONE_HEATMAP_DATA = [
  { zona: 'Lisboa — Chiado', preco: 9800, variacao: '+12.3%', liquidez: 'Alta', segmento: 'Ultra-Luxo' },
  { zona: 'Cascais', preco: 5890, variacao: '+9.8%', liquidez: 'Alta', segmento: 'Luxo' },
  { zona: 'Comporta', preco: 6500, variacao: '+18.2%', liquidez: 'Média', segmento: 'Ultra-Luxo' },
  { zona: 'Porto — Foz', preco: 5200, variacao: '+11.4%', liquidez: 'Alta', segmento: 'Premium' },
  { zona: 'Algarve — Vilamoura', preco: 5100, variacao: '+8.6%', liquidez: 'Média', segmento: 'Premium' },
  { zona: 'Oeiras', preco: 4100, variacao: '+7.2%', liquidez: 'Alta', segmento: 'Médio-Alto' },
  { zona: 'Madeira — Funchal', preco: 3760, variacao: '+14.1%', liquidez: 'Média', segmento: 'Premium' },
  { zona: 'Porto — Boavista', preco: 4600, variacao: '+10.5%', liquidez: 'Alta', segmento: 'Premium' },
  { zona: 'Sintra', preco: 3200, variacao: '+6.8%', liquidez: 'Média', segmento: 'Médio-Alto' },
  { zona: 'Açores — Ponta Delgada', preco: 1952, variacao: '+21.4%', liquidez: 'Baixa', segmento: 'Médio' },
]

function ZoneHeatmap({ activeZona, onSelect }: { activeZona: string; onSelect: (z: string) => void }) {
  const maxPrice = Math.max(...ZONE_HEATMAP_DATA.map(z => z.preco))

  const liquidezColor: Record<string, string> = {
    'Alta': '#4a9c7a',
    'Média': '#c9a96e',
    'Baixa': '#dc2626',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.72rem' }}>
        <thead>
          <tr>
            {['Zona', '€/m²', 'Var. YoY', 'Liquidez', 'Segmento'].map(h => (
              <th key={h} style={{
                fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid rgba(14,14,13,.07)',
                fontWeight: 400,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONE_HEATMAP_DATA.map(row => {
            const isActive = activeZona.includes(row.zona.split(' — ')[row.zona.includes('—') ? 1 : 0]) ||
              activeZona === row.zona ||
              row.zona.includes(activeZona.split(' — ')[activeZona.includes('—') ? 1 : 0] || '')
            const heatPct = row.preco / maxPrice
            const heatColor = heatPct > 0.8 ? '#dc2626' : heatPct > 0.6 ? '#c9a96e' : heatPct > 0.4 ? '#4a9c7a' : '#3a7bd5'

            return (
              <tr
                key={row.zona}
                onClick={() => onSelect(row.zona)}
                style={{
                  cursor: 'pointer',
                  background: isActive ? 'rgba(28,74,53,.06)' : 'transparent',
                  transition: 'background .12s',
                }}
              >
                <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(14,14,13,.04)', fontFamily: "'Jost',sans-serif", fontSize: '.76rem', color: isActive ? '#1c4a35' : 'rgba(14,14,13,.65)', fontWeight: isActive ? 600 : 400 }}>
                  {row.zona}
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: `${heatPct * 48}px`, height: '4px', background: heatColor, borderRadius: '2px', flexShrink: 0, transition: 'width .4s ease' }} />
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: heatColor, fontWeight: 600 }}>
                      €{row.preco.toLocaleString('pt-PT')}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(14,14,13,.04)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#4a9c7a' }}>
                  {row.variacao}
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(14,14,13,.04)' }}>
                  <span style={{
                    fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                    color: liquidezColor[row.liquidez] || '#888',
                    background: (liquidezColor[row.liquidez] || '#888') + '14',
                    padding: '1px 6px', borderRadius: '4px',
                  }}>{row.liquidez}</span>
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid rgba(14,14,13,.04)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>
                  {row.segmento}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PortalAVM({ onRunAVM, onAddToPortfolio }: PortalAVMProps) {
  const { darkMode } = useUIStore()
  const {
    avmResult, avmLoading,
    avmZona, setAvmZona,
    avmTipo, setAvmTipo,
    avmArea, setAvmArea,
    avmEstado, setAvmEstado,
    avmVista, setAvmVista,
    avmPiscina, setAvmPiscina,
    avmGaragem, setAvmGaragem,
    avmEpc, setAvmEpc,
    avmAndar, setAvmAndar,
    avmOrientacao, setAvmOrientacao,
    avmAnoConstr, setAvmAnoConstr,
    avmTerraco, setAvmTerraco,
    avmCasasBanho, setAvmCasasBanho,
    avmUso, setAvmUso,
  } = useAVMStore()

  const [showZoneHeatmap, setShowZoneHeatmap] = useState(false)
  const [showAdjustments, setShowAdjustments] = useState(false)

  const ZONAS = [
    'Lisboa — Chiado','Lisboa — Príncipe Real','Lisboa — Bairro Alto','Lisboa — Alfama','Lisboa — Belém',
    'Lisboa — Parque das Nações','Lisboa — Avenidas Novas','Cascais','Estoril','Sintra','Oeiras',
    'Porto — Foz','Porto — Boavista','Porto — Ribeira','Algarve — Lagos','Algarve — Albufeira',
    'Algarve — Vilamoura','Comporta','Alentejo','Madeira — Funchal','Açores — Ponta Delgada',
  ]

  const res = avmResult as Record<string, unknown> | null

  // API returns: estimativa, rangeMin, rangeMax, pm2, score_confianca (number),
  // investimento.renda_mensal_estimada, investimento.yield_bruta_pct,
  // mercado.liquidez, metodologias[], comparaveis[]
  const valorCentral = Number(res?.estimativa ?? res?.valor_central ?? res?.valorEstimado ?? 0)
  const valorMin = Number(res?.rangeMin ?? res?.valor_min ?? res?.valorMin ?? 0)
  const valorMax = Number(res?.rangeMax ?? res?.valor_max ?? res?.valorMax ?? 0)
  const precoM2 = Number(res?.pm2 ?? res?.preco_m2 ?? res?.precoM2 ?? 0)
  // confianca: API returns numeric score_confianca, string confianca label
  const confianca = Number(res?.score_confianca ?? res?.confianca ?? res?.confidenceScore ?? 0)
  const investimento = res?.investimento as Record<string, unknown> | undefined
  const mercado = res?.mercado as Record<string, unknown> | undefined
  const yieldBruto = investimento?.yield_bruta_pct
    ? `${investimento.yield_bruta_pct}%`
    : (res?.yield_bruto ?? res?.yieldEstimado ?? '—')
  const liquidez = String(mercado?.liquidez ?? res?.liquidez ?? res?.tempoVenda ?? '—')
  const rendaEstimada = Number(investimento?.renda_mensal_estimada ?? res?.renda_estimada ?? res?.rendaEstimada ?? 0)

  const metodologias = (res?.metodologias ?? res?.methodologies ?? []) as Array<{
    nome?: string; label?: string; valor: number; peso: number; descricao?: string
  }>
  // API comparaveis shape: { ref, zona, tipo, area, andar, estado, valor, pm2, meses_mercado }
  const comparaveis = (res?.comparaveis ?? res?.comparables ?? []) as Array<{
    ref?: string; morada?: string; zona?: string; area: number; valor: number
    distancia?: number; ajuste?: number; pm2?: number; estado?: string; meses_mercado?: number
  }>

  const confidenceLabel = confianca > 80 ? 'Alta Confiança' : confianca > 60 ? 'Confiança Moderada' : 'Confiança Baixa'
  const confidenceColor = confianca > 80 ? '#22c55e' : confianca > 60 ? '#c9a96e' : '#e05252'

  const comparavelBadge = (ajuste: number) => {
    if (ajuste < -5) return { label: 'Inferior', color: '#e05252', bg: 'rgba(224,82,82,.08)' }
    if (ajuste > 5) return { label: 'Superior', color: '#1c4a35', bg: 'rgba(28,74,53,.08)' }
    return { label: 'Similar', color: '#c9a96e', bg: 'rgba(201,169,110,.1)' }
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Avaliação Automática de Imóveis</div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>AVM Inteligente</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>6 metodologias RICS · Comparáveis em tempo real · Relatório PDF</div>
      </div>

      <div className="p-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* ── Form Column ──────────────────────────────────────────────────── */}
        <div>
          <div className="p-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="p-label">Zona / Localização</label>
                <select className="p-sel" value={avmZona} onChange={e => setAvmZona(e.target.value)}>
                  {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Tipologia</label>
                <select className="p-sel" value={avmTipo} onChange={e => setAvmTipo(e.target.value)}>
                  {['T0','T1','T2','T3','T4','T5+','Moradia','Villa','Penthouse','Loja','Escritório'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Área (m²)</label>
                <input className="p-inp" type="number" placeholder="ex: 120" value={avmArea} onChange={e => setAvmArea(e.target.value)} />
              </div>
              <div>
                <label className="p-label">Estado</label>
                <select className="p-sel" value={avmEstado} onChange={e => setAvmEstado(e.target.value)}>
                  {['Novo','Excelente','Bom','Razoável','Para Renovar'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Vista</label>
                <select className="p-sel" value={avmVista} onChange={e => setAvmVista(e.target.value)}>
                  {['interior','jardim','cidade','mar','rio','campo'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Andar</label>
                <select className="p-sel" value={avmAndar} onChange={e => setAvmAndar(e.target.value)}>
                  {['rc','1-2','3-5','6+'].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Certificado Energético</label>
                <select className="p-sel" value={avmEpc} onChange={e => setAvmEpc(e.target.value)}>
                  {['A+','A','B','B-','C','D','E','F'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Garagem</label>
                <select className="p-sel" value={avmGaragem} onChange={e => setAvmGaragem(e.target.value)}>
                  {['sem','1','2','box'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Piscina</label>
                <select className="p-sel" value={avmPiscina} onChange={e => setAvmPiscina(e.target.value)}>
                  <option value="nao">Sem piscina</option>
                  <option value="sim">Com piscina</option>
                </select>
              </div>
              <div>
                <label className="p-label">Casas de Banho</label>
                <select className="p-sel" value={avmCasasBanho} onChange={e => setAvmCasasBanho(e.target.value)}>
                  {['1','2','3','4+'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Ano Construção</label>
                <input className="p-inp" type="number" placeholder="ex: 2005" value={avmAnoConstr} onChange={e => setAvmAnoConstr(e.target.value)} />
              </div>
              <div>
                <label className="p-label">Terraço (m²)</label>
                <input className="p-inp" type="number" placeholder="0" value={avmTerraco} onChange={e => setAvmTerraco(e.target.value)} />
              </div>
              <div>
                <label className="p-label">Orientação</label>
                <select className="p-sel" value={avmOrientacao} onChange={e => setAvmOrientacao(e.target.value)}>
                  <option value="">— Não especificado</option>
                  {['Norte','Sul','Este','Oeste','Sul-Nascente','Sul-Poente'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="p-label">Uso</label>
                <select className="p-sel" value={avmUso} onChange={e => setAvmUso(e.target.value)}>
                  <option value="habitacao">Habitação</option>
                  <option value="comercial">Comercial</option>
                  <option value="investimento">Investimento</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <button className="p-btn" style={{ width: '100%' }} onClick={onRunAVM} disabled={avmLoading}>
                  {avmLoading ? '✦ A calcular...' : '✦ Avaliar Imóvel'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Price History Chart ──────────────────────────────────────── */}
          <div className="p-card" style={{ marginTop: '16px' }}>
            <PriceHistoryChart zona={avmZona} />
          </div>

          {/* ── Zone Heatmap Toggle ──────────────────────────────────────── */}
          <div className="p-card" style={{ marginTop: '16px' }}>
            <button
              onClick={() => setShowZoneHeatmap(v => !v)}
              style={{
                width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0',
              }}
            >
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)' }}>Heatmap de Zonas · €/m²</div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)' }}>{showZoneHeatmap ? '▲' : '▼'}</span>
            </button>
            {showZoneHeatmap && (
              <div style={{ marginTop: '12px' }}>
                <ZoneHeatmap activeZona={avmZona} onSelect={setAvmZona} />
              </div>
            )}
          </div>

          {/* ── Market Reference (compact) ───────────────────────────────── */}
          {!showZoneHeatmap && (
            <div className="p-card" style={{ marginTop: '16px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '10px' }}>Referência de Mercado · €/m²</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.entries(ZONA_PRICES)
                  .sort((a, b) => b[1] - a[1])
                  .map(([zona, preco]) => {
                    const isActive = avmZona === zona
                    const barPct = preco / 10000
                    return (
                      <div
                        key={zona}
                        onClick={() => setAvmZona(zona)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px',
                          cursor: 'pointer',
                          background: isActive ? 'rgba(28,74,53,.06)' : 'transparent',
                          border: isActive ? '1px solid rgba(28,74,53,.15)' : '1px solid transparent',
                          borderRadius: '2px', transition: 'background .15s',
                        }}
                      >
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: isActive ? '#1c4a35' : 'rgba(14,14,13,.55)', width: '140px', flexShrink: 0, fontWeight: isActive ? 700 : 400 }}>{zona}</div>
                        <InlineBar pct={barPct} color={isActive ? '#1c4a35' : 'rgba(28,74,53,.25)'} />
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: isActive ? '#1c4a35' : 'rgba(14,14,13,.5)', width: '52px', textAlign: 'right', flexShrink: 0, fontWeight: isActive ? 700 : 400 }}>
                          €{preco.toLocaleString('pt-PT')}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* ── Results Column ───────────────────────────────────────────────── */}
        <div>
          {!avmResult && !avmLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏠</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', color: darkMode ? 'rgba(244,240,230,.5)' : 'rgba(14,14,13,.4)', marginBottom: '8px' }}>Aguarda avaliação</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', lineHeight: 1.6 }}>Preencha os dados e clique em Avaliar</div>
            </div>
          )}

          {avmLoading && (
            <div className="p-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', color: '#1c4a35', letterSpacing: '.2em' }}>✦ A calcular avaliação...</div>
            </div>
          )}

          {avmResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── Hero valor ─────────────────────────────────────────────── */}
              <div className="p-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '6px' }}>Valor de Mercado Estimado</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '2.5rem', color: '#1c4a35', fontWeight: 300, lineHeight: 1, marginBottom: '8px' }}>
                      €{valorCentral.toLocaleString('pt-PT')}
                    </div>
                    {/* Confidence interval */}
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', marginBottom: '10px' }}>
                      €{valorMin.toLocaleString('pt-PT')} <span style={{ color: 'rgba(14,14,13,.2)', margin: '0 4px' }}>—</span> €{valorMax.toLocaleString('pt-PT')}
                    </div>
                    {/* Confidence interval bar */}
                    {valorMin > 0 && valorMax > 0 && (
                      <div style={{ position: 'relative', height: '6px', background: 'rgba(14,14,13,.06)', borderRadius: '3px', marginBottom: '10px', overflow: 'visible' }}>
                        {(() => {
                          const range = valorMax - valorMin
                          const leftPct = range > 0 ? ((valorCentral - valorMin) / range) * 80 : 40
                          return (
                            <>
                              <div style={{ position: 'absolute', left: '10%', right: '10%', top: 0, bottom: 0, background: 'rgba(28,74,53,.15)', borderRadius: '3px' }} />
                              <div style={{ position: 'absolute', left: `calc(10% + ${leftPct * 0.8}%)`, top: '-3px', width: '12px', height: '12px', background: '#1c4a35', borderRadius: '50%', transform: 'translateX(-50%)' }} />
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {/* Confidence badge */}
                    {confianca > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: `${confidenceColor}12`, border: `1px solid ${confidenceColor}30`, borderRadius: '20px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: confidenceColor }} />
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: confidenceColor, letterSpacing: '.05em' }}>{confidenceLabel} · {confianca}%</span>
                      </div>
                    )}
                  </div>
                  {/* Improved Confidence Gauge */}
                  {confianca > 0 && (
                    <div style={{ flexShrink: 0 }}>
                      <Gauge value={confianca} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Grid 4 KPIs ─────────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Renda Est./mês', val: rendaEstimada > 0 ? `€${rendaEstimada.toLocaleString('pt-PT')}` : '—' },
                  { label: 'Yield Bruto', val: yieldBruto ? `${yieldBruto}%` : '—' },
                  { label: 'Tempo de Venda', val: liquidez },
                  { label: 'Preço / m²', val: precoM2 > 0 ? `€${precoM2.toLocaleString('pt-PT')}` : '—' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '14px 16px', background: 'rgba(28,74,53,.03)', border: '1px solid rgba(28,74,53,.07)', borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: '#1c4a35', fontWeight: 300 }}>{m.val}</div>
                  </div>
                ))}
              </div>

              {/* ── Adjustment Factors Toggle ────────────────────────────── */}
              <div>
                <button
                  onClick={() => setShowAdjustments(v => !v)}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: 'rgba(201,169,110,.05)', border: '1px solid rgba(201,169,110,.2)',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', letterSpacing: '.1em',
                  }}
                >
                  <span>✦ Factores de Ajuste Manual</span>
                  <span>{showAdjustments ? '▲' : '▼'}</span>
                </button>
                {showAdjustments && (
                  <div style={{ marginTop: '8px' }}>
                    <AdjustmentFactorsPanel baseValue={valorCentral} darkMode={darkMode} />
                  </div>
                )}
              </div>

              {/* ── Metodologias ─────────────────────────────────────────────── */}
              {metodologias.length > 0 && (
                <div className="p-card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>Breakdown de Metodologias</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {metodologias.map((m, i) => {
                      // API returns peso as decimal (0.35), valor as full integer
                      const pesoDecimal = m.peso > 1 ? m.peso / 100 : m.peso
                      const contrib = Math.round(m.valor * pesoDecimal)
                      const pesoDisplay = m.peso > 1 ? m.peso : Math.round(m.peso * 100)
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: 'rgba(14,14,13,.7)' }}>
                              {m.label ?? m.nome ?? `Metodologia ${i + 1}`}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>peso {pesoDisplay}%</span>
                              <span style={{ fontFamily: "'Cormorant',serif", fontSize: '.9rem', color: '#1c4a35', fontWeight: 500 }}>€{contrib.toLocaleString('pt-PT')}</span>
                            </div>
                          </div>
                          <InlineBar pct={pesoDecimal} color="#1c4a35" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Comparáveis Grid ──────────────────────────────────────── */}
              {comparaveis.length > 0 && (
                <div className="p-card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>
                    Comparáveis de Mercado
                    <span style={{ marginLeft: '8px', color: 'rgba(14,14,13,.25)', fontWeight: 400 }}>· {comparaveis.length} imóveis</span>
                  </div>
                  {/* Grid header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px', padding: '4px 12px', marginBottom: '4px' }}>
                    {['Imóvel', 'Área', '€/m²', 'Ajuste'].map(h => (
                      <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {comparaveis.slice(0, 5).map((c, i) => {
                      // API shape: { ref, zona, tipo, area, andar, estado, valor, pm2, meses_mercado }
                      // Compute delta vs zone base pm2 if available; fallback to computed
                      const cPm2 = c.pm2 ?? (c.area > 0 ? Math.round(c.valor / c.area) : 0)
                      const deltaVsBase = precoM2 > 0 && cPm2 > 0 ? Math.round(((cPm2 / precoM2) - 1) * 100) : (c.ajuste ?? 0)
                      const badge = comparavelBadge(deltaVsBase)
                      const displayName = c.morada ?? c.zona ?? c.ref ?? `Comparável ${i + 1}`
                      return (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px',
                          alignItems: 'center', padding: '10px 12px',
                          background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.05)',
                          borderRadius: '10px',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.76rem', color: 'rgba(14,14,13,.75)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ fontFamily: "'Cormorant',serif", fontSize: '.9rem', color: '#1c4a35' }}>€{c.valor.toLocaleString('pt-PT')}</span>
                              {c.estado && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', alignSelf: 'center' }}>{c.estado}</span>}
                            </div>
                          </div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', textAlign: 'right', whiteSpace: 'nowrap' }}>{c.area}m²</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {cPm2 > 0 ? `€${cPm2.toLocaleString('pt-PT')}` : '—'}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-block', padding: '2px 8px', background: badge.bg, borderRadius: '10px' }}>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: badge.color, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                                {deltaVsBase !== 0 ? `${deltaVsBase > 0 ? '+' : ''}${deltaVsBase}%` : badge.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Adicionar ao Portfólio ───────────────────────────────── */}
              {onAddToPortfolio && (
                <button
                  className="p-btn"
                  style={{ width: '100%', background: 'transparent', border: '1px solid rgba(28,74,53,.3)', color: '#1c4a35' }}
                  onClick={() => onAddToPortfolio({
                    zona: avmZona, tipo: avmTipo, area: avmArea,
                    valorEstimado: valorCentral, precoM2, yieldBruto, rendaEstimada,
                  })}
                >
                  + Adicionar ao Portfólio
                </button>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
