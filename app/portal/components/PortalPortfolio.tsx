'use client'
import { useMemo } from 'react'
import { useUIStore } from '../stores/uiStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { PORTAL_PROPERTIES } from './constants'
import type { PortfolioProperty } from './types'

interface PortalPortfolioProps {
  onRunPortfolio: () => Promise<void>
}

// ─── Type guards ──────────────────────────────────────────────────────────────

interface ComparisonProperty {
  name: string
  price: number
  yield: number
  score: number
}

interface StructuredPortResult {
  summary?: string
  properties?: ComparisonProperty[]
  winner?: string
  recommendation?: string
}

function isComparisonProperty(val: unknown): val is ComparisonProperty {
  if (typeof val !== 'object' || val === null) return false
  const o = val as Record<string, unknown>
  return typeof o.name === 'string'
}

function parsePortResult(raw: unknown): StructuredPortResult {
  if (typeof raw !== 'object' || raw === null) return {}
  const r = raw as Record<string, unknown>
  const result: StructuredPortResult = {}
  if (typeof r.summary === 'string') result.summary = r.summary
  if (typeof r.winner === 'string') result.winner = r.winner
  if (typeof r.recommendation === 'string') result.recommendation = r.recommendation
  if (Array.isArray(r.properties)) {
    result.properties = r.properties.filter(isComparisonProperty).map(p => ({
      name: p.name,
      price: typeof p.price === 'number' ? p.price : 0,
      yield: typeof p.yield === 'number' ? p.yield : 0,
      score: typeof p.score === 'number' ? p.score : 0,
    }))
  }
  return result
}

// ─── SVG Growth Chart ─────────────────────────────────────────────────────────

interface GrowthChartProps {
  totalValue: number
  totalEquity: number
  totalRental: number
  properties: { currentValue: number; appreciation: number; rentalYield: number; downPayment: number }[]
}

function GrowthChart({ totalValue, totalEquity, totalRental, properties }: GrowthChartProps) {
  const W = 560
  const H = 200
  const padL = 56
  const padR = 16
  const padT = 16
  const padB = 40
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const years = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const seriesValue = years.map(y =>
    properties.reduce((s, p) => s + p.currentValue * Math.pow(1 + p.appreciation / 100, y), 0)
  )
  const seriesEquity = years.map(y => {
    const val = properties.reduce((s, p) => s + p.currentValue * Math.pow(1 + p.appreciation / 100, y), 0)
    const loan = properties.reduce((s, p) => s + p.currentValue * (1 - p.downPayment / 100), 0)
    return Math.max(0, val - loan)
  })
  const seriesRental = years.map(y =>
    properties.reduce((s, p) => s + p.currentValue * (p.rentalYield / 100) * y, 0)
  )

  const allVals = [...seriesValue, ...seriesEquity, ...seriesRental]
  const maxVal = Math.max(...allVals, 1)

  const toX = (y: number) => padL + (y / 10) * chartW
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH

  const pathD = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ')

  const fmtM = (v: number) => `€${(v / 1e6).toFixed(1)}M`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: maxVal * f, y: padT + chartH - f * chartH }))
  const xLabels = [0, 5, 10]

  return (
    <div style={{ marginTop: '24px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '14px' }}>
        Projeção de Crescimento — 10 Anos
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-label="Gráfico de crescimento do portfólio ao longo de 10 anos"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={t.val}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="rgba(14,14,13,.06)" strokeWidth={1} />
            <text
              x={padL - 6}
              y={t.y + 4}
              textAnchor="end"
              fontFamily="'DM Mono',monospace"
              fontSize={9}
              fill="rgba(14,14,13,.3)"
            >
              {fmtM(t.val)}
            </text>
          </g>
        ))}
        {/* X axis labels */}
        {xLabels.map(y => (
          <text
            key={y}
            x={toX(y)}
            y={H - padB + 14}
            textAnchor="middle"
            fontFamily="'DM Mono',monospace"
            fontSize={9}
            fill="rgba(14,14,13,.3)"
          >
            Ano {y}
          </text>
        ))}
        {/* Area fill — Total Value */}
        <path
          d={`${pathD(seriesValue)} L ${toX(10).toFixed(1)} ${(padT + chartH).toFixed(1)} L ${toX(0).toFixed(1)} ${(padT + chartH).toFixed(1)} Z`}
          fill="rgba(28,74,53,.07)"
          strokeWidth={0}
        />
        {/* Lines */}
        <path d={pathD(seriesValue)} fill="none" stroke="#1c4a35" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathD(seriesEquity)} fill="none" stroke="#c9a96e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 3" />
        <path d={pathD(seriesRental)} fill="none" stroke="#4a9c7a" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="2 4" />
        {/* Endpoint dots */}
        {[
          { series: seriesValue, color: '#1c4a35' },
          { series: seriesEquity, color: '#c9a96e' },
          { series: seriesRental, color: '#4a9c7a' },
        ].map(({ series, color }) => (
          <circle
            key={color}
            cx={toX(10)}
            cy={toY(series[10])}
            r={4}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}
        {/* Value labels at year 10 */}
        <text
          x={toX(10) + 8}
          y={toY(seriesValue[10]) + 4}
          fontFamily="'DM Mono',monospace"
          fontSize={9}
          fill="#1c4a35"
          fontWeight="bold"
        >
          {fmtM(seriesValue[10])}
        </text>
        <text
          x={toX(10) + 8}
          y={toY(seriesEquity[10]) + 4}
          fontFamily="'DM Mono',monospace"
          fontSize={9}
          fill="#c9a96e"
        >
          {fmtM(seriesEquity[10])}
        </text>
        <text
          x={toX(10) + 8}
          y={toY(seriesRental[10]) + 4}
          fontFamily="'DM Mono',monospace"
          fontSize={9}
          fill="#4a9c7a"
        >
          {fmtM(seriesRental[10])}
        </text>
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap' }}>
        {[
          { color: '#1c4a35', label: 'Valor Total', dash: false },
          { color: '#c9a96e', label: 'Equity', dash: true },
          { color: '#4a9c7a', label: 'Renda Acumulada', dash: true },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width={24} height={8} aria-label={l.label}>
              <line
                x1={0} y1={4} x2={24} y2={4}
                stroke={l.color}
                strokeWidth={l.dash ? 1.5 : 2.5}
                strokeDasharray={l.dash ? '4 3' : undefined}
              />
            </svg>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)' }}>{l.label}</span>
          </div>
        ))}
      </div>
      {/* Current snapshot note */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.25)', marginTop: '8px' }}>
        Valor actual: {`€${(totalValue / 1e6).toFixed(2)}M`} · Equity: {`€${(totalEquity / 1e6).toFixed(2)}M`} · Renda anual: {`€${Math.round(totalRental).toLocaleString('pt-PT')}`}
      </div>
    </div>
  )
}

// ─── Comparison Result Renderer ───────────────────────────────────────────────

function renderSummaryText(summary: string) {
  const paragraphs = summary.split(/\n\n+/)
  return (
    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: 'rgba(14,14,13,.75)' }}>
      {paragraphs.map((para, i) => {
        if (para.startsWith('# ')) {
          return (
            <div key={i} style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 600, color: '#0e0e0d', margin: '14px 0 6px' }}>
              {para.replace(/^#+\s*/, '')}
            </div>
          )
        }
        if (para.startsWith('## ')) {
          return (
            <div key={i} style={{ fontFamily: "'Cormorant',serif", fontSize: '.95rem', fontWeight: 600, color: '#1c4a35', margin: '10px 0 4px' }}>
              {para.replace(/^#+\s*/, '')}
            </div>
          )
        }
        return <p key={i} style={{ margin: '0 0 10px' }}>{para}</p>
      })}
    </div>
  )
}

function ComparisonResult({ raw }: { raw: unknown }) {
  const parsed = parsePortResult(raw)
  const { properties, winner, recommendation, summary } = parsed

  const hasStructured = Array.isArray(properties) && properties.length > 0

  if (!hasStructured) {
    return (
      <div className="p-card">
        <div className="p-label" style={{ marginBottom: '12px' }}>Análise Comparativa</div>
        {summary ? renderSummaryText(summary) : (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>Sem dados de análise.</div>
        )}
      </div>
    )
  }

  const metrics: { label: string; key: keyof ComparisonProperty; fmt: (v: number) => string; higherIsBetter: boolean }[] = [
    { label: 'Preço', key: 'price', fmt: v => `€${(v / 1e6).toFixed(2)}M`, higherIsBetter: false },
    { label: 'Yield (%)', key: 'yield', fmt: v => `${v.toFixed(2)}%`, higherIsBetter: true },
    { label: 'Score', key: 'score', fmt: v => `${v.toFixed(1)}/10`, higherIsBetter: true },
  ]

  return (
    <div className="p-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="p-label">Análise Comparativa</div>
        {winner && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            background: 'linear-gradient(135deg,#c9a96e22,#c9a96e44)',
            border: '1px solid #c9a96e',
            fontFamily: "'DM Mono',monospace",
            fontSize: '.52rem',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: '#9a7340',
            borderRadius: '4px',
          }}>
            <span style={{ color: '#c9a96e', fontSize: '.9rem' }}>★</span>
            Melhor opção: {winner}
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div style={{ overflowX: 'auto', marginBottom: recommendation ? '20px' : '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 10px', textAlign: 'left', background: 'rgba(14,14,13,.03)', borderBottom: '1px solid rgba(14,14,13,.1)', width: '120px' }}>
                Métrica
              </th>
              {properties.map(p => (
                <th key={p.name} style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.8rem',
                  fontWeight: 600,
                  color: winner === p.name ? '#c9a96e' : '#0e0e0d',
                  padding: '8px 10px',
                  textAlign: 'center',
                  background: winner === p.name ? 'rgba(201,169,110,.06)' : 'rgba(14,14,13,.03)',
                  borderBottom: `2px solid ${winner === p.name ? '#c9a96e' : 'rgba(14,14,13,.1)'}`,
                  borderLeft: '1px solid rgba(14,14,13,.06)',
                }}>
                  {p.name}
                  {winner === p.name && (
                    <span style={{ display: 'block', fontSize: '.52rem', fontFamily: "'DM Mono',monospace", color: '#c9a96e', letterSpacing: '.08em', marginTop: '2px' }}>★ VENCEDOR</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, mi) => {
              const vals = properties.map(p => p[metric.key] as number)
              const best = metric.higherIsBetter ? Math.max(...vals) : Math.min(...vals)
              return (
                <tr key={metric.key} style={{ background: mi % 2 === 0 ? '#fff' : 'rgba(14,14,13,.015)' }}>
                  <td style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 10px', borderBottom: '1px solid rgba(14,14,13,.06)' }}>
                    {metric.label}
                  </td>
                  {properties.map(p => {
                    const val = p[metric.key] as number
                    const isBest = val === best
                    return (
                      <td key={p.name} style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.52rem',
                        fontWeight: isBest ? 700 : 400,
                        color: isBest ? '#1c4a35' : 'rgba(14,14,13,.65)',
                        padding: '10px 10px',
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(14,14,13,.06)',
                        borderLeft: '1px solid rgba(14,14,13,.04)',
                        background: winner === p.name ? 'rgba(201,169,110,.03)' : 'transparent',
                      }}>
                        {metric.fmt(val)}
                        {isBest && (
                          <span style={{ display: 'inline-block', marginLeft: '4px', color: '#1c4a35', fontSize: '.7rem' }}>▲</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {recommendation && (
        <div style={{
          borderLeft: '3px solid #c9a96e',
          paddingLeft: '16px',
          margin: '0 0 4px',
          background: 'rgba(201,169,110,.04)',
          padding: '14px 16px',
        }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#9a7340', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>Recomendação</div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', lineHeight: 1.6, color: 'rgba(14,14,13,.75)', fontStyle: 'italic' }}>
            {recommendation}
          </div>
        </div>
      )}

      {summary && !hasStructured && renderSummaryText(summary)}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalPortfolio({ onRunPortfolio }: PortalPortfolioProps) {
  const { darkMode } = useUIStore()
  const {
    portItems, setPortItems,
    portResult, portLoading,
    portfolioProperties, addPortfolioProperty, removePortfolioProperty, updatePortfolioProperty,
    showPropertyPicker, setShowPropertyPicker,
    portfolioTab, setPortfolioTab,
  } = usePortfolioStore()

  const portfolioStats = useMemo(() => {
    if (portfolioProperties.length === 0) return null
    const totalValue = portfolioProperties.reduce((s, p) => s + p.currentValue, 0)
    const totalLoan = portfolioProperties.reduce((s, p) => s + (p.currentValue * (1 - p.downPayment / 100)), 0)
    const totalEquity = totalValue - totalLoan
    const totalRental = portfolioProperties.reduce((s, p) => s + (p.currentValue * p.rentalYield / 100), 0)
    const value5y = portfolioProperties.reduce((s, p) => s + p.currentValue * Math.pow(1 + p.appreciation / 100, 5), 0)
    const value10y = portfolioProperties.reduce((s, p) => s + p.currentValue * Math.pow(1 + p.appreciation / 100, 10), 0)
    // Total return over 10 years = capital gains + cumulative rental income
    const rentalCumulative10y = totalRental * 10
    const totalReturn10y = (value10y - totalValue) + rentalCumulative10y
    const roi10y = totalValue > 0 ? (totalReturn10y / totalValue * 100) : 0
    return { totalValue, totalEquity, totalRental, value5y, value10y, roi10y }
  }, [portfolioProperties])

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Gestão de Activos</div>
        <div style={{ fontFamily: 'var(--font-cormorant),serif', fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Portfolio Análise</div>
      </div>

      {/* Tab selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '24px' }}>
        {(['comparar', 'simulador'] as const).map(t => (
          <button type="button" key={t} className={`deal-tab${portfolioTab === t ? ' active' : ''}`} onClick={() => setPortfolioTab(t)}>
            {t === 'comparar' ? '📊 Comparar Imóveis' : '📈 Simulador de Portfólio'}
          </button>
        ))}
      </div>

      {/* Compare mode */}
      {portfolioTab === 'comparar' && (
        <div>
          <div className="p-card" style={{ marginBottom: '20px' }}>
            <div className="p-label" style={{ marginBottom: '12px' }}>URLs dos Imóveis a Comparar</div>
            {portItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className="p-inp"
                  placeholder={`URL imóvel ${i + 1} (idealista, imovirtual...)`}
                  value={item}
                  onChange={e => {
                    const updated = [...portItems]
                    updated[i] = e.target.value
                    setPortItems(updated)
                  }}
                />
                {portItems.length > 2 && (
                  <button type="button" onClick={() => setPortItems(portItems.filter((_, j) => j !== i))} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid rgba(14,14,13,.1)', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', borderRadius: '6px', transition: 'all .2s' }}>✕</button>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button type="button" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(14,14,13,.1)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', color: 'rgba(14,14,13,.5)', borderRadius: '6px', transition: 'all .2s' }} onClick={() => setPortItems([...portItems, ''])}>
                + Adicionar Imóvel
              </button>
              <button type="button" className="p-btn" onClick={onRunPortfolio} disabled={portLoading || portItems.filter(x => x.trim()).length < 2}>
                {portLoading ? '✦ A comparar...' : '✦ Comparar'}
              </button>
            </div>
          </div>

          {portResult && <ComparisonResult raw={portResult} />}
        </div>
      )}

      {/* Simulator mode */}
      {portfolioTab === 'simulador' && (
        <div>
          {/* Stats */}
          {portfolioStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Valor Total', val: `€${(portfolioStats.totalValue / 1e6).toFixed(2)}M`, color: '#1c4a35' },
                { label: 'Equity', val: `€${(portfolioStats.totalEquity / 1e6).toFixed(2)}M`, color: '#c9a96e' },
                { label: 'Renda Anual', val: `€${Math.round(portfolioStats.totalRental).toLocaleString('pt-PT')}`, color: '#4a9c7a' },
                { label: 'Valor 5 Anos', val: `€${(portfolioStats.value5y / 1e6).toFixed(2)}M`, color: '#1c4a35' },
                { label: 'Valor 10 Anos', val: `€${(portfolioStats.value10y / 1e6).toFixed(2)}M`, color: '#c9a96e' },
                { label: 'ROI 10 Anos', val: `+${portfolioStats.roi10y.toFixed(1)}%`, color: '#4a9c7a' },
              ].map(m => (
                <div key={m.label} className="kpi-card">
                  <div className="kpi-val" style={{ color: m.color, fontSize: '1.4rem' }}>{m.val}</div>
                  <div className="kpi-label">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* SVG Growth Chart */}
          {portfolioStats && portfolioProperties.length > 0 && (
            <GrowthChart
              totalValue={portfolioStats.totalValue}
              totalEquity={portfolioStats.totalEquity}
              totalRental={portfolioStats.totalRental}
              properties={portfolioProperties}
            />
          )}

          {/* Properties in portfolio */}
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)' }}>
              {portfolioProperties.length} Imóveis no Portfólio
            </div>
            <button type="button" className="p-btn p-btn-gold" style={{ padding: '6px 14px' }} onClick={() => setShowPropertyPicker(true)}>
              + Adicionar Imóvel
            </button>
          </div>

          {portfolioProperties.length === 0 && (
            <div className="p-card" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏘️</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: 'rgba(14,14,13,.4)', marginBottom: '8px' }}>Portfólio vazio</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>Adicione imóveis para simular o portfólio</div>
            </div>
          )}

          {portfolioProperties.map(prop => (
            <div key={prop.id} className="p-card" style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.88rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d' }}>{prop.name}</div>
                <button type="button" onClick={() => removePortfolioProperty(prop.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(14,14,13,.3)', cursor: 'pointer', fontSize: '.8rem' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { label: 'Valor (€)', key: 'currentValue', value: prop.currentValue },
                  { label: 'Entrada (%)', key: 'downPayment', value: prop.downPayment },
                  { label: 'Yield (%)', key: 'rentalYield', value: prop.rentalYield },
                  { label: 'Apreciação (%)', key: 'appreciation', value: prop.appreciation },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '3px' }}>{f.label}</div>
                    <input
                      type="number"
                      className="p-inp"
                      value={f.value}
                      onChange={e => updatePortfolioProperty(prop.id, { [f.key]: Number(e.target.value) } as Partial<PortfolioProperty>)}
                      style={{ padding: '6px 10px', fontSize: '.78rem' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Property Picker */}
          {showPropertyPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
              <div style={{ background: darkMode ? '#0f2117' : '#fff', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1c4a35' }}>Selecionar Imóvel</div>
                  <button type="button" onClick={() => setShowPropertyPicker(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'rgba(14,14,13,.4)' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {(PORTAL_PROPERTIES as Record<string, unknown>[]).map((p) => (
                    <div key={String(p.id)} style={{ padding: '12px', border: '1px solid rgba(14,14,13,.1)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderRadius: '10px', transition: 'all .2s' }}
                      onClick={() => {
                        addPortfolioProperty({
                          id: String(p.id),
                          name: String(p.nome || p.title || p.id),
                          currentValue: Number(p.preco) || 0,
                          downPayment: 30,
                          rentalYield: 4.5,
                          appreciation: 3,
                        })
                        setShowPropertyPicker(false)
                      }}>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: darkMode ? 'rgba(244,240,230,.8)' : '#0e0e0d' }}>{String(p.nome || p.title)}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e' }}>€{(Number(p.preco) / 1e6).toFixed(2)}M</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
