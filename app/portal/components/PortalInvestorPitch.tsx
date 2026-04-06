'use client'
import { useState } from 'react'
import { useUIStore } from '../stores/uiStore'
import { usePortfolioStore } from '../stores/portfolioStore'
import { PORTAL_PROPERTIES } from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalInvestorPitchProps {
  onRunInvestorPitch: () => Promise<void>
  exportToPDF: (title: string, html: string) => void
}

type CapitalOption = '500K' | '1M' | '2M' | '5M' | '10M+'
type YieldFocus = 'growth' | 'income' | 'balanced'

interface IpResultShape {
  // API returns camelCase — keep both for forward compat
  title?: unknown
  tagline?: unknown
  // executive summary — API returns camelCase
  executiveSummary?: unknown
  executive_summary?: unknown    // legacy fallback
  // investment thesis
  investmentThesis?: unknown
  investment_thesis?: unknown
  // highlights — API returns uniqueSellingPoints
  uniqueSellingPoints?: unknown
  investment_highlights?: unknown // legacy fallback
  // financial model
  financialModel?: unknown
  key_metrics?: unknown          // legacy fallback
  // projections inside financialModel
  projections?: unknown
  // risk score
  confidenceScore?: unknown
  risk_score?: unknown           // legacy fallback
  // market context
  marketPosition?: unknown
  market_context?: unknown       // legacy fallback
  // risk matrix
  riskMatrix?: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? fallback : n }
  return fallback
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return {}
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  return []
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${n}`
}

function langLabel(l: string): string {
  return { PT: '🇵🇹 PT', EN: '🇬🇧 EN', FR: '🇫🇷 FR', AR: '🇦🇪 AR' }[l] ?? l
}

// ─── SVG Return Projections Chart ────────────────────────────────────────────

interface ReturnChartProps {
  initialPrice: number
  projections: Record<string, unknown>
  irr: number
  horizon: number
}

function ReturnChart({ initialPrice, projections, irr, horizon }: ReturnChartProps) {
  const W = 520
  const H = 180
  const PAD = { top: 28, right: 16, bottom: 36, left: 60 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  // Build data points: year 0 = initial, then from projections or compound
  const years = [0, 3, 5, 10].filter(y => y <= horizon || y === 0 || y === horizon)
  const uniqueYears = [...new Set([0, ...years, horizon])].sort((a, b) => a - b).filter(y => y <= 10)

  const vals: { year: number; value: number }[] = uniqueYears.map(y => {
    if (y === 0) return { year: 0, value: initialPrice }
    // API returns projectedValue3Y / projectedValue5Y / projectedValue10Y — check multiple key formats
    const fromProj = projections[`projectedValue${y}Y`] ?? projections[`year_${y}`] ?? projections[String(y)]
    if (fromProj !== undefined) return { year: y, value: asNumber(fromProj, initialPrice) }
    // fallback: compound at irr/100
    return { year: y, value: Math.round(initialPrice * Math.pow(1 + irr / 100, y)) }
  })

  const maxVal = Math.max(...vals.map(v => v.value))
  const minVal = 0
  const range = maxVal - minVal || 1

  const barW = Math.max(28, Math.min(52, (chartW / vals.length) * 0.55))
  const gap = chartW / vals.length

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      aria-label="Return projections bar chart"
      style={{ display: 'block' }}
    >
      {/* Y-axis grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PAD.top + chartH * (1 - t)
        const val = minVal + range * t
        return (
          <g key={t}>
            <line
              x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
              stroke="rgba(14,14,13,.06)" strokeWidth={1}
            />
            <text
              x={PAD.left - 6} y={y + 4}
              textAnchor="end"
              fontFamily="'DM Mono',monospace"
              fontSize={8}
              fill="rgba(14,14,13,.35)"
            >
              {formatPrice(Math.round(val))}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {vals.map((d, i) => {
        const cx = PAD.left + gap * i + gap / 2
        const barHeight = ((d.value - minVal) / range) * chartH
        const barY = PAD.top + chartH - barHeight
        const isBase = d.year === 0
        const pct = d.year === 0 ? 0 : Math.round(((d.value - initialPrice) / initialPrice) * 100)

        return (
          <g key={d.year}>
            {/* Bar */}
            <rect
              x={cx - barW / 2}
              y={barY}
              width={barW}
              height={barHeight}
              fill={isBase ? 'rgba(28,74,53,.18)' : '#c9a96e'}
              rx={3}
            />
            {/* Base investment line overlay */}
            {!isBase && (
              <rect
                x={cx - barW / 2}
                y={PAD.top + chartH - ((initialPrice - minVal) / range) * chartH}
                width={barW}
                height={((initialPrice - minVal) / range) * chartH}
                fill="rgba(28,74,53,.12)"
                rx={3}
              />
            )}
            {/* % annotation */}
            {!isBase && (
              <text
                x={cx}
                y={barY - 6}
                textAnchor="middle"
                fontFamily="'DM Mono',monospace"
                fontSize={9}
                fill="#c9a96e"
                fontWeight="600"
              >
                +{pct}%
              </text>
            )}
            {/* Value annotation */}
            {isBase && (
              <text
                x={cx}
                y={barY - 6}
                textAnchor="middle"
                fontFamily="'DM Mono',monospace"
                fontSize={8}
                fill="rgba(14,14,13,.4)"
              >
                {formatPrice(d.value)}
              </text>
            )}
            {/* X label */}
            <text
              x={cx}
              y={H - 8}
              textAnchor="middle"
              fontFamily="'DM Mono',monospace"
              fontSize={9}
              fill="rgba(14,14,13,.45)"
            >
              {d.year === 0 ? 'Entrada' : `Ano ${d.year}`}
            </text>
          </g>
        )
      })}

      {/* Y axis line */}
      <line
        x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
        stroke="rgba(14,14,13,.12)" strokeWidth={1}
      />
    </svg>
  )
}

// ─── SVG Risk Matrix ──────────────────────────────────────────────────────────

interface RiskMatrixProps {
  riskScore: number   // 1–10
  irr: number
}

function RiskMatrix({ riskScore, irr }: RiskMatrixProps) {
  const W = 200
  const H = 160
  const PAD = 24
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2

  // Map riskScore 1-10 to x (low=left, high=right)
  const dotX = PAD + (riskScore / 10) * innerW
  // Map irr 8-20 to y (low=bottom, high=top)
  const irrNorm = Math.min(1, Math.max(0, (irr - 8) / 12))
  const dotY = PAD + (1 - irrNorm) * innerH

  const labels = [
    { x: PAD + innerW * 0.25, y: PAD + innerH * 0.25, text: 'Growth Play' },
    { x: PAD + innerW * 0.75, y: PAD + innerH * 0.25, text: 'Opportunistic' },
    { x: PAD + innerW * 0.25, y: PAD + innerH * 0.75, text: 'Safe Income' },
    { x: PAD + innerW * 0.75, y: PAD + innerH * 0.75, text: 'Value Add' },
  ]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-label="Risk vs return matrix"
      style={{ display: 'block' }}
    >
      {/* Background quadrants */}
      <rect x={PAD} y={PAD} width={innerW / 2} height={innerH / 2} fill="rgba(28,74,53,.04)" rx={2} />
      <rect x={PAD + innerW / 2} y={PAD} width={innerW / 2} height={innerH / 2} fill="rgba(201,169,110,.06)" rx={2} />
      <rect x={PAD} y={PAD + innerH / 2} width={innerW / 2} height={innerH / 2} fill="rgba(201,169,110,.04)" rx={2} />
      <rect x={PAD + innerW / 2} y={PAD + innerH / 2} width={innerW / 2} height={innerH / 2} fill="rgba(220,38,38,.04)" rx={2} />

      {/* Grid lines */}
      <line x1={PAD + innerW / 2} y1={PAD} x2={PAD + innerW / 2} y2={PAD + innerH} stroke="rgba(14,14,13,.08)" strokeWidth={1} />
      <line x1={PAD} y1={PAD + innerH / 2} x2={PAD + innerW} y2={PAD + innerH / 2} stroke="rgba(14,14,13,.08)" strokeWidth={1} />

      {/* Border */}
      <rect x={PAD} y={PAD} width={innerW} height={innerH} fill="none" stroke="rgba(14,14,13,.12)" strokeWidth={1} rx={2} />

      {/* Quadrant labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'DM Mono',monospace"
          fontSize={7}
          fill="rgba(14,14,13,.3)"
        >
          {l.text}
        </text>
      ))}

      {/* Axis labels */}
      <text x={PAD} y={H - 6} fontFamily="'DM Mono',monospace" fontSize={7} fill="rgba(14,14,13,.35)">LOW RISK</text>
      <text x={PAD + innerW} y={H - 6} textAnchor="end" fontFamily="'DM Mono',monospace" fontSize={7} fill="rgba(14,14,13,.35)">HIGH RISK</text>
      <text x={6} y={PAD + innerH} textAnchor="middle" fontFamily="'DM Mono',monospace" fontSize={7} fill="rgba(14,14,13,.35)" transform={`rotate(-90, 6, ${PAD + innerH / 2})`}>HIGH RET.</text>

      {/* Dot glow */}
      <circle cx={dotX} cy={dotY} r={10} fill="rgba(28,74,53,.12)" />
      {/* Dot */}
      <circle cx={dotX} cy={dotY} r={6} fill="#1c4a35" />
      <circle cx={dotX} cy={dotY} r={3} fill="#c9a96e" />
    </svg>
  )
}

// ─── Highlight Card ───────────────────────────────────────────────────────────

interface HighlightCardProps {
  icon: string
  label: string
  value: string
  sub?: string
  accent?: boolean
}

function HighlightCard({ icon, label, value, sub, accent }: HighlightCardProps) {
  return (
    <div style={{
      padding: '14px 16px',
      background: accent ? 'rgba(28,74,53,.04)' : '#fff',
      border: `1px solid ${accent ? 'rgba(28,74,53,.14)' : 'rgba(14,14,13,.08)'}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      borderRadius: '10px',
      boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(14,14,13,.38)' }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.35rem', color: accent ? '#1c4a35' : '#0e0e0d', fontWeight: 300, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

// ─── Loading Steps ────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  'Analisando mercado português...',
  'Calculando projeções de retorno...',
  'Avaliando perfil de risco...',
  'Estruturando tese de investimento...',
  'Gerando pitch personalizado...',
]

function LoadingState() {
  const [step] = useState(() => Math.floor(Math.random() * LOADING_STEPS.length))
  return (
    <div className="p-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
      {/* Animated rings */}
      <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 24px' }}>
        <svg viewBox="0 0 64 64" width={64} height={64} aria-label="Loading animation">
          <circle cx={32} cy={32} r={28} fill="none" stroke="rgba(28,74,53,.1)" strokeWidth={3} />
          <circle
            cx={32} cy={32} r={28}
            fill="none"
            stroke="#1c4a35"
            strokeWidth={3}
            strokeDasharray="44 132"
            strokeLinecap="round"
            style={{ transformOrigin: '32px 32px', animation: 'spin 1.4s linear infinite' }}
          />
          <circle
            cx={32} cy={32} r={18}
            fill="none"
            stroke="#c9a96e"
            strokeWidth={2}
            strokeDasharray="20 93"
            strokeLinecap="round"
            style={{ transformOrigin: '32px 32px', animation: 'spin 2s linear infinite reverse' }}
          />
        </svg>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#1c4a35', fontWeight: 300, marginBottom: '8px' }}>
        A gerar Investor Pitch IA
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em' }}>
        {LOADING_STEPS[step]}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '20px' }}>
        {LOADING_STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 6,
            height: 4,
            borderRadius: 2,
            background: i === step ? '#1c4a35' : 'rgba(14,14,13,.12)',
            transition: 'width .3s',
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function PlaceholderState({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="p-card" style={{ padding: '56px 32px', textAlign: 'center' }}>
      <svg viewBox="0 0 64 64" width={64} height={64} aria-label="Investor pitch icon" style={{ margin: '0 auto 20px', display: 'block', opacity: 0.18 }}>
        <rect x={8} y={4} width={36} height={48} rx={3} fill="#1c4a35" />
        <rect x={14} y={14} width={24} height={3} rx={1} fill="#fff" />
        <rect x={14} y={22} width={18} height={3} rx={1} fill="#fff" />
        <rect x={14} y={30} width={21} height={3} rx={1} fill="#fff" />
        <circle cx={46} cy={46} r={14} fill="#c9a96e" />
        <path d="M40 46 L44 50 L52 42" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 300, color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)', marginBottom: '8px' }}>
        Investor Pitch Deck
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.25)', letterSpacing: '.1em', lineHeight: 1.7 }}>
        FAMILY OFFICE · HNWI · INSTITUCIONAL<br />
        CONFIGURE O PAINEL E GERE O PITCH
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalInvestorPitch({ onRunInvestorPitch, exportToPDF }: PortalInvestorPitchProps) {
  const { darkMode } = useUIStore()
  const {
    ipProperty, setIpProperty,
    ipInvestorType, setIpInvestorType,
    ipHorizon, setIpHorizon,
    ipIrr, setIpIrr,
    ipLang, setIpLang,
    ipLoading,
    ipResult,
    ipError,
  } = usePortfolioStore()

  // Extended local state
  const [capital, setCapital] = useState<CapitalOption>('1M')
  const [yieldFocus, setYieldFocus] = useState<YieldFocus>('balanced')
  const [copied, setCopied] = useState(false)

  // Resolve selected property
  const propList = PORTAL_PROPERTIES as Array<Record<string, unknown>>
  const selectedProp = propList.find(p => String(p.id) === ipProperty)
  const selectedPrice = selectedProp ? asNumber(selectedProp.preco) : 0

  // Parse result — API returns camelCase fields, fall back to legacy snake_case
  const res = ipResult ? (ipResult as IpResultShape) : null
  const pitchTitle = res ? asString(res.title) || 'Investor Pitch' : ''
  // executive summary: API returns executiveSummary
  const execSummary = res ? (asString(res.executiveSummary) || asString(res.executive_summary)) : ''
  // key_metrics: built from financialModel if present, else legacy key_metrics
  const financialModel = res ? asRecord(res.financialModel) : {}
  const keyMetrics = Object.keys(financialModel).length > 0
    ? financialModel
    : (res ? asRecord(res.key_metrics) : {})
  // highlights: API returns uniqueSellingPoints (string[]) — wrap into display shape
  const rawUsps = res ? asArray(res.uniqueSellingPoints) : []
  const rawHighlights = res ? asArray(res.investment_highlights) : []
  const highlights = rawUsps.length > 0
    ? rawUsps.map((usp, i) => ({ icon: '◆', label: `USP ${i + 1}`, value: asString(usp) }))
    : rawHighlights
  // projections: inside financialModel
  const projections = Object.keys(financialModel).length > 0
    ? financialModel
    : (res ? asRecord(res.projections) : {})
  // risk score: API returns confidenceScore (1-100), normalise to 1-10
  const rawConf = res ? asNumber(res.confidenceScore, 0) : 0
  const riskScore = rawConf > 0
    ? Math.round(rawConf / 10)
    : (res ? asNumber(res.risk_score, 5) : 5)
  // market context: API returns marketPosition object
  const mp = res ? asRecord(res.marketPosition) : {}
  const marketContext = Object.keys(mp).length > 0
    ? [asString(mp.headline), asString(mp.marketMomentum)].filter(Boolean).join(' — ')
    : (res ? asString(res.market_context) : '')

  // Actions
  function handleCopy() {
    const text = [pitchTitle, execSummary, marketContext].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handlePDF() {
    const sections: string[] = []
    if (pitchTitle) sections.push(`<h1 style="font-family:Cormorant,serif;font-size:2rem;font-weight:300">${pitchTitle}</h1>`)
    if (execSummary) sections.push(`<p style="font-family:Jost,sans-serif;line-height:1.8">${execSummary.replace(/\n/g, '<br/>')}</p>`)
    if (Object.keys(keyMetrics).length) {
      const rows = Object.entries(keyMetrics).map(([k, v]) => `<tr><td style="font-family:'DM Mono',monospace;font-size:.7rem;color:#666;padding:4px 8px">${k}</td><td style="font-family:Cormorant,serif;font-size:1.2rem;padding:4px 8px">${asString(v)}</td></tr>`).join('')
      sections.push(`<table style="width:100%;border-collapse:collapse">${rows}</table>`)
    }
    if (marketContext) sections.push(`<p style="font-family:Jost,sans-serif;line-height:1.8;margin-top:16px">${marketContext.replace(/\n/g, '<br/>')}</p>`)
    exportToPDF(pitchTitle || 'Investor Pitch', sections.join(''))
  }

  function handleEmail() {
    const subject = encodeURIComponent(pitchTitle || 'Investment Opportunity — Agency Group')
    const body = encodeURIComponent([pitchTitle, execSummary, marketContext].filter(Boolean).join('\n\n'))
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  // Style tokens
  const col = {
    green: '#1c4a35',
    gold: '#c9a96e',
    bg: '#f4f0e6',
    text: '#0e0e0d',
    muted: 'rgba(14,14,13,.38)',
    border: 'rgba(14,14,13,.08)',
  }

  const investorLabels: Record<string, string> = {
    private: 'Privado',
    family_office: 'Family Office',
    institutional: 'Institucional',
    hnwi: 'HNWI',
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: col.muted, marginBottom: '6px' }}>
          Captação de Capital · Agency Group AMI 22506
        </div>
        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '2rem', color: darkMode ? '#f4f0e6' : col.text, letterSpacing: '-.01em' }}>
          Investor Pitch IA
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted, marginTop: '4px' }}>
          Family Office · HNWI · Institucional · Multi-idioma · Lisboa · Dubai · Paris · New York
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ════ LEFT PANEL — Configuration ════════════════════════════════════ */}
        <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Header */}
          <div style={{ borderBottom: `1px solid ${col.border}`, paddingBottom: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted }}>Configuração do Pitch</div>
          </div>

          {/* Property selector */}
          <div>
            <label className="p-label">Imóvel</label>
            <select
              className="p-sel"
              value={ipProperty}
              onChange={e => setIpProperty(e.target.value)}
              style={{ marginBottom: '6px' }}
            >
              <option value="">— Selecionar imóvel</option>
              {propList.map(p => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.nome || p.title || p.id)}
                </option>
              ))}
            </select>
            {selectedProp && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.green, background: 'rgba(28,74,53,.06)', padding: '3px 8px', border: '1px solid rgba(28,74,53,.12)', borderRadius: '4px' }}>
                  {formatPrice(selectedPrice)}
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted, background: 'rgba(14,14,13,.04)', padding: '3px 8px', border: `1px solid ${col.border}`, borderRadius: '4px' }}>
                  {asString(selectedProp.zona)} · {asString(selectedProp.area)}m²
                </span>
                {!!selectedProp.badge && (
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.gold, background: 'rgba(201,169,110,.08)', padding: '3px 8px', border: '1px solid rgba(201,169,110,.2)', borderRadius: '4px' }}>
                    {asString(selectedProp.badge)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Investor type */}
          <div>
            <label className="p-label">Tipo de Investidor</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              {(['private', 'family_office', 'institutional', 'hnwi'] as const).map(t => (
                <button type="button"
                  key={t}
                  style={{
                    padding: '9px 6px',
                    background: ipInvestorType === t ? col.green : 'transparent',
                    border: `1px solid ${ipInvestorType === t ? col.green : col.border}`,
                    color: ipInvestorType === t ? '#f4f0e6' : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                  onClick={() => setIpInvestorType(t)}
                >
                  {investorLabels[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Investment horizon */}
          <div>
            <label className="p-label">Horizonte de Investimento</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {([3, 5, 10] as const).map(h => (
                <button type="button"
                  key={h}
                  style={{
                    flex: 1,
                    padding: '9px 4px',
                    background: ipHorizon === h ? col.gold : 'transparent',
                    border: `1px solid ${ipHorizon === h ? col.gold : col.border}`,
                    color: ipHorizon === h ? '#0c1f15' : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                  onClick={() => setIpHorizon(h)}
                >
                  {h}A
                </button>
              ))}
            </div>
          </div>

          {/* IRR target */}
          <div>
            <label className="p-label">IRR Target</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {([8, 12, 15, 20] as const).map(irr => (
                <button type="button"
                  key={irr}
                  style={{
                    flex: 1,
                    padding: '9px 4px',
                    background: ipIrr === irr ? col.green : 'transparent',
                    border: `1px solid ${ipIrr === irr ? col.green : col.border}`,
                    color: ipIrr === irr ? '#f4f0e6' : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                  onClick={() => setIpIrr(irr)}
                >
                  {irr}%
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="p-label">Idioma do Pitch</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {(['PT', 'EN', 'FR', 'AR'] as const).map(l => (
                <button type="button"
                  key={l}
                  style={{
                    flex: 1,
                    padding: '9px 4px',
                    background: ipLang === l ? col.gold : 'transparent',
                    border: `1px solid ${ipLang === l ? col.gold : col.border}`,
                    color: ipLang === l ? '#0c1f15' : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                  onClick={() => setIpLang(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Capital available */}
          <div>
            <label className="p-label">Capital Disponível</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
              {(['500K', '1M', '2M', '5M', '10M+'] as CapitalOption[]).map(c => (
                <button type="button"
                  key={c}
                  style={{
                    padding: '8px 4px',
                    background: capital === c ? 'rgba(28,74,53,.06)' : 'transparent',
                    border: `1px solid ${capital === c ? col.green : col.border}`,
                    color: capital === c ? col.green : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                  onClick={() => setCapital(c)}
                >
                  €{c}
                </button>
              ))}
            </div>
          </div>

          {/* Yield focus */}
          <div>
            <label className="p-label">Foco de Retorno</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              {([
                { id: 'growth', label: 'Capital Growth' },
                { id: 'income', label: 'Yield Income' },
                { id: 'balanced', label: 'Balanced' },
              ] as { id: YieldFocus; label: string }[]).map(f => (
                <button type="button"
                  key={f.id}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    background: yieldFocus === f.id ? 'rgba(201,169,110,.1)' : 'transparent',
                    border: `1px solid ${yieldFocus === f.id ? col.gold : col.border}`,
                    color: yieldFocus === f.id ? '#7a5c1e' : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.04em',
                    transition: 'all .2s',
                    textAlign: 'center',
                    borderRadius: '6px',
                  }}
                  onClick={() => setYieldFocus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${col.border}`, paddingTop: '4px' }} />

          {/* Generate button */}
          <button type="button"
            className="p-btn"
            onClick={onRunInvestorPitch}
            disabled={ipLoading || !ipProperty}
            style={{ width: '100%', padding: '14px', fontSize: '.52rem', letterSpacing: '.12em', borderRadius: '6px', transition: 'all .2s' }}
          >
            {ipLoading ? '✦ A gerar pitch...' : '✦ Gerar Investor Pitch'}
          </button>

          {!ipProperty && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted, textAlign: 'center', marginTop: '-8px' }}>
              Seleciona um imóvel para continuar
            </div>
          )}
        </div>

        {/* ════ RIGHT PANEL — Result ═══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* States */}
          {!ipResult && !ipLoading && !ipError && <PlaceholderState darkMode={darkMode} />}
          {ipLoading && <LoadingState />}

          {/* Error */}
          {ipError && (
            <div className="p-card" style={{ borderLeft: '3px solid #dc2626', padding: '20px 24px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#dc2626', marginBottom: '4px', letterSpacing: '.06em' }}>ERRO</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: '#dc2626' }}>{ipError}</div>
            </div>
          )}

          {/* Result */}
          {ipResult && !ipLoading && (
            <>
              {/* ── Hero Banner ───────────────────────────────────────────────── */}
              <div style={{
                background: col.green,
                padding: '28px 32px',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '12px',
              }}>
                {/* Decorative arc */}
                <svg
                  viewBox="0 0 400 120"
                  aria-label="Decorative background arc"
                  style={{ position: 'absolute', right: 0, bottom: 0, width: 260, opacity: .06, pointerEvents: 'none' }}
                >
                  <circle cx={340} cy={120} r={160} fill="#c9a96e" />
                </svg>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.5)', letterSpacing: '.15em', textTransform: 'uppercase' }}>
                    Agency Group · AMI 22506 · Investor Pitch
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    color: '#0c1f15',
                    background: col.gold,
                    padding: '4px 10px',
                    letterSpacing: '.1em',
                    borderRadius: '4px',
                  }}>
                    {langLabel(ipLang)}
                  </div>
                </div>

                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.8rem', fontWeight: 300, color: '#f4f0e6', letterSpacing: '-.01em', marginBottom: '8px', lineHeight: 1.2 }}>
                  {pitchTitle || (selectedProp ? asString(selectedProp.nome) : 'Investor Pitch')}
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {selectedPrice > 0 && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.gold, letterSpacing: '.06em' }}>
                      {formatPrice(selectedPrice)}
                    </div>
                  )}
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.55)', letterSpacing: '.06em' }}>
                    {investorLabels[ipInvestorType]} · IRR {ipIrr}% · {ipHorizon} anos · {yieldFocus === 'growth' ? 'Capital Growth' : yieldFocus === 'income' ? 'Yield Income' : 'Balanced'}
                  </div>
                </div>
              </div>

              {/* ── Investment Highlights Grid ─────────────────────────────── */}
              {(highlights.length > 0 || Object.keys(keyMetrics).length > 0) && (
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted, marginBottom: '10px' }}>
                    Investment Highlights
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {/* From investment_highlights array if available */}
                    {highlights.length > 0
                      ? highlights.slice(0, 6).map((h, i) => {
                          const hr = asRecord(h)
                          return (
                            <HighlightCard
                              key={i}
                              icon={asString(hr.icon) || '◆'}
                              label={asString(hr.label) || asString(hr.title) || `Highlight ${i + 1}`}
                              value={asString(hr.value) || asString(hr.metric) || '—'}
                              sub={asString(hr.sub) || asString(hr.description) || undefined}
                              accent={i === 0}
                            />
                          )
                        })
                      /* Fallback: key_metrics */
                      : Object.entries(keyMetrics).slice(0, 6).map(([k, v], i) => {
                          const icons: Record<string, string> = {
                            irr: '📈', cap_rate: '🏦', yield: '💰', yield_gross: '💰',
                            capital: '💵', exit_multiple: '✖', risk: '🛡', ltv: '📊',
                          }
                          const iconKey = Object.keys(icons).find(ik => k.toLowerCase().includes(ik)) ?? ''
                          return (
                            <HighlightCard
                              key={k}
                              icon={icons[iconKey] || '◆'}
                              label={k.replace(/_/g, ' ')}
                              value={asString(v)}
                              accent={i === 0}
                            />
                          )
                        })
                    }
                    {/* Always show IRR + Horizon summary cards */}
                    <HighlightCard icon="⏱" label="Horizonte" value={`${ipHorizon} Anos`} sub={`Capital €${capital}`} />
                    <HighlightCard icon="🎯" label="IRR Target" value={`${ipIrr}%`} sub="Anualizado" accent />
                    {riskScore > 0 && (
                      <HighlightCard
                        icon="🛡"
                        label="Risk Score"
                        value={`${riskScore}/10`}
                        sub={riskScore <= 3 ? 'Conservador' : riskScore <= 6 ? 'Moderado' : 'Agressivo'}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── Return Projections Chart ───────────────────────────────── */}
              {selectedPrice > 0 && (
                <div className="p-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted }}>Projeção de Retorno</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: darkMode ? '#f4f0e6' : col.text, fontWeight: 300, marginTop: '2px' }}>
                        Valorização Projetada · IRR {ipIrr}% · {ipHorizon} anos
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted }}>Valor Final Estimado</div>
                      <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: col.green, fontWeight: 300 }}>
                        {(() => {
                          // Prefer API-confirmed projected value, fall back to compound at IRR target
                          const apiProjected = asNumber(financialModel[`projectedValue${ipHorizon}Y`], 0)
                          const basePrice = selectedPrice > 0 ? selectedPrice : asNumber(financialModel.acquisitionCost, 0)
                          const confirmedIrr = asNumber(financialModel.irr, ipIrr)
                          const estimated = apiProjected > 0 ? apiProjected : Math.round(basePrice * Math.pow(1 + confirmedIrr / 100, ipHorizon))
                          return formatPrice(estimated)
                        })()}
                      </div>
                    </div>
                  </div>
                  <ReturnChart
                    initialPrice={selectedPrice > 0 ? selectedPrice : asNumber(financialModel.acquisitionCost, selectedPrice)}
                    projections={projections}
                    irr={asNumber(financialModel.irr, ipIrr)}
                    horizon={ipHorizon}
                  />
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 10, height: 10, background: col.gold, borderRadius: 2 }} />
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted }}>Retorno projetado</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: 10, height: 10, background: 'rgba(28,74,53,.18)', borderRadius: 2 }} />
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted }}>Capital inicial</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Executive Summary ──────────────────────────────────────── */}
              {execSummary && (
                <div className="p-card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted, marginBottom: '14px' }}>
                    Executive Summary
                  </div>
                  <div style={{
                    fontFamily: "'Jost',sans-serif",
                    fontSize: '.85rem',
                    lineHeight: 1.85,
                    color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)',
                    borderLeft: `2px solid ${col.gold}`,
                    paddingLeft: '16px',
                  }}>
                    {execSummary.split('\n').filter(Boolean).map((line, i) => {
                      // Detect section headers (lines ending with : or ALL CAPS or ## prefix)
                      const isHeader = /^#{1,3}\s/.test(line) || /^[A-Z\s]{6,}$/.test(line.trim()) || /:\s*$/.test(line)
                      const cleaned = line.replace(/^#{1,3}\s*/, '')
                      return isHeader
                        ? <div key={i} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', color: col.green, textTransform: 'uppercase', marginTop: i > 0 ? '14px' : 0, marginBottom: '4px' }}>{cleaned}</div>
                        : <p key={i} style={{ margin: '0 0 8px' }}>{cleaned}</p>
                    })}
                  </div>
                </div>
              )}

              {/* ── Risk Matrix + Context row ──────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '16px' }}>
                {/* Risk Matrix */}
                <div className="p-card">
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted, marginBottom: '12px' }}>
                    Risk Matrix
                  </div>
                  <RiskMatrix riskScore={riskScore} irr={ipIrr} />
                  <div style={{ marginTop: '10px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted }}>
                      Perfil: {riskScore <= 3 ? 'Conservador' : riskScore <= 5 ? 'Moderado' : riskScore <= 7 ? 'Crescimento' : 'Oportunista'}
                    </div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: col.green, fontWeight: 300, marginTop: '2px' }}>
                      Score {riskScore}/10
                    </div>
                  </div>
                </div>

                {/* Market Context */}
                {marketContext ? (
                  <div className="p-card">
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted, marginBottom: '12px' }}>
                      Market Context
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.75, color: darkMode ? 'rgba(244,240,230,.75)' : 'rgba(14,14,13,.7)' }}>
                      {marketContext}
                    </div>
                  </div>
                ) : (
                  <div className="p-card" style={{ background: 'rgba(28,74,53,.02)' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: col.muted, marginBottom: '12px' }}>
                      Mercado Portugal 2026
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { label: 'Preço Médio Lisboa', value: '€5.000/m²', trend: '+17,6% YoY' },
                        { label: 'Transacções 2026E', value: '169.812', trend: 'Recorde histórico' },
                        { label: 'Luxo Lisboa Ranking', value: 'Top 5', trend: 'Global 2026' },
                        { label: 'Dias em Mercado', value: '210 dias', trend: 'Média nacional' },
                      ].map(m => (
                        <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: `1px solid ${col.border}` }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted }}>{m.label}</div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: col.green, fontWeight: 300 }}>{m.value}</div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.gold }}>{m.trend}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Actions Bar ────────────────────────────────────────────── */}
              <div style={{
                display: 'flex',
                gap: '10px',
                padding: '16px 20px',
                background: '#fff',
                border: `1px solid ${col.border}`,
                alignItems: 'center',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
              }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: col.muted, letterSpacing: '.08em', flex: 1 }}>
                  PITCH · {new Date().toLocaleDateString('pt-PT')} · Agency Group AMI 22506
                </div>
                <button type="button"
                  onClick={handleCopy}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px',
                    background: copied ? 'rgba(28,74,53,.06)' : 'transparent',
                    border: `1px solid ${copied ? col.green : col.border}`,
                    color: copied ? col.green : col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                >
                  {copied ? '✓ Copiado' : '⧉ Copiar'}
                </button>
                <button type="button"
                  onClick={handlePDF}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px',
                    background: 'transparent',
                    border: `1px solid ${col.border}`,
                    color: col.muted,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    transition: 'all .2s',
                    borderRadius: '6px',
                  }}
                >
                  ⬇ PDF
                </button>
                <button type="button"
                  onClick={handleEmail}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px',
                    background: col.green,
                    border: `1px solid ${col.green}`,
                    color: '#f4f0e6',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    borderRadius: '6px',
                    transition: 'all .2s',
                  }}
                >
                  ✉ Email Pitch
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
