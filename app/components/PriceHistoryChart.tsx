'use client'
import { useState } from 'react'

interface PriceHistoryChartProps {
  zona: string
  currentPm2: number
}

const PRICE_HISTORY: Record<string, Array<{ year: number; pm2: number }>> = {
  'Lisboa':   [{year:2019,pm2:3800},{year:2020,pm2:4100},{year:2021,pm2:4500},{year:2022,pm2:4900},{year:2023,pm2:5400},{year:2024,pm2:5800},{year:2025,pm2:6000},{year:2026,pm2:6200}],
  'Cascais':  [{year:2019,pm2:2900},{year:2020,pm2:3100},{year:2021,pm2:3400},{year:2022,pm2:3700},{year:2023,pm2:4000},{year:2024,pm2:4200},{year:2025,pm2:4500},{year:2026,pm2:4713}],
  'Comporta': [{year:2019,pm2:3500},{year:2020,pm2:4200},{year:2021,pm2:5500},{year:2022,pm2:6500},{year:2023,pm2:7000},{year:2024,pm2:7500},{year:2025,pm2:8000},{year:2026,pm2:8500}],
  'Porto':    [{year:2019,pm2:2200},{year:2020,pm2:2400},{year:2021,pm2:2700},{year:2022,pm2:2900},{year:2023,pm2:3100},{year:2024,pm2:3300},{year:2025,pm2:3500},{year:2026,pm2:3643}],
  'Algarve':  [{year:2019,pm2:2400},{year:2020,pm2:2600},{year:2021,pm2:2900},{year:2022,pm2:3100},{year:2023,pm2:3300},{year:2024,pm2:3600},{year:2025,pm2:3800},{year:2026,pm2:3941}],
  'Madeira':  [{year:2019,pm2:1800},{year:2020,pm2:2100},{year:2021,pm2:2500},{year:2022,pm2:2900},{year:2023,pm2:3100},{year:2024,pm2:3400},{year:2025,pm2:3600},{year:2026,pm2:3760}],
  'Sintra':   [{year:2019,pm2:2100},{year:2020,pm2:2300},{year:2021,pm2:2600},{year:2022,pm2:2900},{year:2023,pm2:3100},{year:2024,pm2:3300},{year:2025,pm2:3500},{year:2026,pm2:3650}],
  'Ericeira': [{year:2019,pm2:1600},{year:2020,pm2:1900},{year:2021,pm2:2300},{year:2022,pm2:2700},{year:2023,pm2:2900},{year:2024,pm2:3100},{year:2025,pm2:3300},{year:2026,pm2:3450}],
}

export default function PriceHistoryChart({ zona, currentPm2 }: PriceHistoryChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const data = PRICE_HISTORY[zona] || PRICE_HISTORY['Lisboa']

  // Add 2027 projection
  const lastVal = data[data.length - 1].pm2
  const dataWithProjection = [...data, { year: 2027, pm2: Math.round(lastVal * 1.12), projected: true }]

  const allVals = dataWithProjection.map(d => d.pm2)
  const minVal = Math.min(...allVals) * 0.85
  const maxVal = Math.max(...allVals) * 1.08

  const W = 600, H = 220
  const PAD = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const xScale = (i: number) => PAD.left + (i / (dataWithProjection.length - 1)) * chartW
  const yScale = (v: number) => PAD.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH

  // Build path
  const points = dataWithProjection.map((d, i) => ({ x: xScale(i), y: yScale(d.pm2) }))

  // Smooth cubic bezier
  function buildPath(pts: Array<{x:number;y:number}>) {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i].x + (pts[i+1].x - pts[i].x) / 3
      const cp1y = pts[i].y
      const cp2x = pts[i+1].x - (pts[i+1].x - pts[i].x) / 3
      const cp2y = pts[i+1].y
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pts[i+1].x} ${pts[i+1].y}`
    }
    return d
  }

  const mainPoints = points.slice(0, data.length)
  const projPoints = points.slice(data.length - 1)
  const mainPath = buildPath(mainPoints)
  const projPath = buildPath(projPoints)

  // Area path
  const areaPath = mainPath + ` L ${mainPoints[mainPoints.length-1].x} ${PAD.top + chartH} L ${PAD.left} ${PAD.top + chartH} Z`

  // Metrics
  const firstVal = data[0].pm2
  const totalGain = Math.round(((lastVal - firstVal) / firstVal) * 100)
  const years = data.length - 1
  const cagr = (Math.pow(lastVal / firstVal, 1 / years) - 1) * 100

  // Y-axis grid
  const yTicks = 4
  const yTickVals = Array.from({length: yTicks+1}, (_, i) => minVal + (i / yTicks) * (maxVal - minVal))

  return (
    <div style={{ background: '#0a1a10', border: '1px solid rgba(201,169,110,.12)', padding: '28px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.44rem', letterSpacing: '.2em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Histórico de Preços · {zona}
          </div>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', fontWeight: 300, color: '#f4f0e6' }}>
            €{currentPm2.toLocaleString('pt-PT')}/m² <span style={{ color: '#c9a96e', fontSize: '.85rem' }}>+{totalGain}% (2019–2026)</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            ['CAGR', `+${cagr.toFixed(1)}%/ano`],
            ['Projeção 2027', `€${Math.round(lastVal*1.12).toLocaleString('pt-PT')}/m²`],
          ].map(([label, val]) => (
            <div key={label} style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.38rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${zona}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines */}
        {yTickVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="rgba(244,240,230,.06)" strokeWidth="1" />
            <text x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end" fill="rgba(244,240,230,.3)" fontSize="9" fontFamily="monospace">
              €{Math.round(v/1000)}K
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#grad-${zona})`} />

        {/* Main line */}
        <path d={mainPath} fill="none" stroke="#c9a96e" strokeWidth="2.5" strokeLinecap="round" />

        {/* Projection line (dashed) */}
        <path d={projPath} fill="none" stroke="#c9a96e" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 4" opacity="0.6" />

        {/* Data points */}
        {dataWithProjection.map((d, i) => {
          const isProj = i === dataWithProjection.length - 1
          return (
            <g key={i} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}>
              <circle cx={xScale(i)} cy={yScale(d.pm2)} r={hoveredIdx === i ? 7 : 4}
                fill={isProj ? 'transparent' : '#c9a96e'} stroke="#c9a96e" strokeWidth={isProj ? 2 : 0}
                strokeDasharray={isProj ? '3 2' : 'none'} />

              {/* Tooltip */}
              {hoveredIdx === i && (
                <g>
                  <rect x={xScale(i) - 40} y={yScale(d.pm2) - 38} width="80" height="30" rx="2" fill="#0a1a10" stroke="rgba(201,169,110,.3)" strokeWidth="1" />
                  <text x={xScale(i)} y={yScale(d.pm2) - 22} textAnchor="middle" fill="#c9a96e" fontSize="10" fontFamily="'Cormorant', serif">
                    €{d.pm2.toLocaleString('pt-PT')}/m²
                  </text>
                  <text x={xScale(i)} y={yScale(d.pm2) - 12} textAnchor="middle" fill="rgba(244,240,230,.4)" fontSize="8" fontFamily="monospace">
                    {d.year}{isProj ? ' (proj.)' : ''}
                  </text>
                </g>
              )}

              {/* X-axis labels */}
              <text x={xScale(i)} y={H - 8} textAnchor="middle" fill={isProj ? 'rgba(201,169,110,.4)' : 'rgba(244,240,230,.3)'} fontSize="9" fontFamily="monospace">
                {d.year}
              </text>
            </g>
          )
        })}
      </svg>

      <div style={{ marginTop: '8px', fontFamily: "'DM Mono', monospace", fontSize: '.36rem', letterSpacing: '.08em', color: 'rgba(244,240,230,.2)', textAlign: 'right' }}>
        Fonte: Agency Group / INE / Confidencial Imobiliário 2026 · Projeção 2027 estimada (+12%)
      </div>
    </div>
  )
}
