'use client'
import { useState, useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useRadarStore } from '../stores/radarStore'
import { HEAT_MAP_ZONES } from './constants'

interface PortalRadarProps {
  onRunRadar: () => Promise<void>
  onRunRadarSearch: () => Promise<void>
  onGerarPDF: (deals: Record<string, unknown>[], filtros: Record<string, unknown>, stats: Record<string, unknown>) => void
}

interface RadarDimension {
  name: string
  score: number
  weight?: number
  note?: string
}

interface FinancialProjection {
  yieldBruto: number
  yieldLiquido: number
  irr5anos: number
  irr10anos: number
}

interface Comparable {
  address: string
  price: number
  sqm: number
  daysOnMarket: number
}

interface RadarResultTyped {
  score: number
  recommendation: string
  summary: string
  dimensions?: RadarDimension[]
  risks?: string[]
  opportunities?: string[]
  comparables?: Comparable[]
  negotiationAdvice?: string
  exitStrategy?: string
  financialProjection?: FinancialProjection
  // legacy fields
  classificacao?: string
  analise_narrativa?: string
}

type ResultTab = 'overview' | 'dimensoes' | 'financeiro' | 'comparaveis'

interface RadarHistoryItem {
  url: string
  score: number
  recommendation: string
  date: string
}

const RADAR_HISTORY_KEY = 'ag_radar_history'
const MAX_HISTORY = 5

// Zone benchmark data — median price/m² and avg yield for key zones
const ZONE_BENCHMARKS: Record<string, { pm2: number; yield: number; dom: number; trend: string }> = {
  'lisboa':     { pm2: 5000, yield: 3.8, dom: 90,  trend: '+14%' },
  'cascais':    { pm2: 4713, yield: 4.1, dom: 120, trend: '+11%' },
  'algarve':    { pm2: 3941, yield: 5.2, dom: 150, trend: '+18%' },
  'porto':      { pm2: 3643, yield: 4.6, dom: 80,  trend: '+16%' },
  'madeira':    { pm2: 3760, yield: 5.8, dom: 180, trend: '+22%' },
  'açores':     { pm2: 1952, yield: 6.5, dom: 200, trend: '+9%'  },
  'sintra':     { pm2: 3200, yield: 4.2, dom: 130, trend: '+12%' },
  'setubal':    { pm2: 2400, yield: 4.8, dom: 110, trend: '+15%' },
}

function getScoreColor(score: number): string {
  if (score > 75) return '#22c55e'
  if (score > 50) return '#c9a96e'
  return '#e05252'
}

function getScoreBg(score: number): string {
  if (score > 75) return 'rgba(34,197,94,.08)'
  if (score > 50) return 'rgba(201,169,110,.08)'
  return 'rgba(224,82,82,.08)'
}

function getRecommendationLabel(rec: string): string {
  const r = (rec || '').toUpperCase()
  if (r.includes('COMPRAR') || r === 'BUY') return 'COMPRAR COM CONFIANÇA'
  if (r.includes('INVESTIGAR') || r.includes('INVESTIG') || r === 'HOLD') return 'INVESTIGAR MAIS'
  if (r.includes('EVITAR') || r === 'AVOID' || r === 'SELL') return 'EVITAR'
  return r || 'ANALISAR'
}

function RadarChart({ dimensions }: { dimensions: RadarDimension[] }) {
  if (!dimensions || dimensions.length === 0) return null
  const size = 260
  const cx = size / 2
  const cy = size / 2
  const maxR = 100
  const n = dimensions.length
  const toXY = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })
  const angles = dimensions.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2)

  // Max polygon points (full 100)
  const maxPoints = angles.map(a => toXY(a, maxR))
  const maxPoly = maxPoints.map(p => `${p.x},${p.y}`).join(' ')

  // Score polygon
  const scorePoints = dimensions.map((d, i) => toXY(angles[i], (d.score / 100) * maxR))
  const scorePoly = scorePoints.map(p => `${p.x},${p.y}`).join(' ')

  // Grid rings at 25, 50, 75, 100
  const rings = [25, 50, 75, 100]

  return (
    <svg width={size} height={size + 40} viewBox={`0 0 ${size} ${size + 40}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid rings */}
      {rings.map(pct => {
        const rpts = angles.map(a => toXY(a, (pct / 100) * maxR))
        return (
          <polygon
            key={pct}
            points={rpts.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(14,14,13,.08)"
            strokeWidth="1"
          />
        )
      })}

      {/* Axis lines */}
      {angles.map((a, i) => {
        const end = toXY(a, maxR)
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(14,14,13,.07)" strokeWidth="1" />
      })}

      {/* Max polygon */}
      <polygon points={maxPoly} fill="rgba(14,14,13,.03)" stroke="rgba(14,14,13,.12)" strokeWidth="1" />

      {/* Score polygon */}
      <polygon points={scorePoly} fill="rgba(28,74,53,.15)" stroke="#1c4a35" strokeWidth="2" />

      {/* Score dots */}
      {scorePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#1c4a35" />
      ))}

      {/* Labels */}
      {dimensions.map((d, i) => {
        const labelR = maxR + 22
        const lp = toXY(angles[i], labelR)
        const anchor = lp.x < cx - 5 ? 'end' : lp.x > cx + 5 ? 'start' : 'middle'
        const name = d.name.length > 12 ? d.name.substring(0, 11) + '…' : d.name
        return (
          <g key={i}>
            <text
              x={lp.x} y={lp.y - 3}
              textAnchor={anchor}
              fontFamily="DM Mono, monospace"
              fontSize="7"
              fill="rgba(14,14,13,.5)"
              letterSpacing=".04em"
            >{name}</text>
            <text
              x={lp.x} y={lp.y + 8}
              textAnchor={anchor}
              fontFamily="DM Mono, monospace"
              fontSize="8"
              fontWeight="700"
              fill={getScoreColor(d.score)}
            >{d.score}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Benchmark Panel ─────────────────────────────────────────────────────────
function BenchmarkPanel({ url, score, darkMode }: { url: string; score: number; darkMode: boolean }) {
  // Detect zone from URL/text
  const urlLower = url.toLowerCase()
  const detectedZone = Object.keys(ZONE_BENCHMARKS).find(z => urlLower.includes(z)) ?? 'lisboa'
  const bench = ZONE_BENCHMARKS[detectedZone]
  const textMuted = darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)'
  const border = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.08)'

  const metrics = [
    { label: 'Preço/m² Zona',     val: `€${bench.pm2.toLocaleString('pt-PT')}`,   bench: 'Mediana mercado', color: '#1c4a35' },
    { label: 'Yield Médio',       val: `${bench.yield}%`,                           bench: 'Arrendamento zona', color: '#4a9c7a' },
    { label: 'Dias no Mercado',   val: `${bench.dom}d`,                             bench: 'Média zona', color: '#c9a96e' },
    { label: 'Tendência YoY',     val: bench.trend,                                 bench: 'Valorização anual', color: '#3a7bd5' },
  ]

  // SVG bar comparison: score vs zone average (70)
  const zoneAvgScore = 70
  const barW = 200
  const myBar = Math.round((score / 100) * barW)
  const zoneBar = Math.round((zoneAvgScore / 100) * barW)

  return (
    <div style={{ padding: '16px', background: darkMode ? 'rgba(244,240,230,.03)' : 'rgba(14,14,13,.02)', border: `1px solid ${border}`, borderRadius: '12px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', color: textMuted }}>Benchmark — Zona Detectada</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 300, color: darkMode ? '#f4f0e6' : '#0e0e0d', marginTop: '2px', textTransform: 'capitalize' }}>{detectedZone}</div>
        </div>
        {/* SVG score comparison bar */}
        <svg width={barW + 60} height={44} viewBox={`0 0 ${barW + 60} 44`} aria-label={`Score ${score} vs zona ${zoneAvgScore}`}>
          <text x="0" y="10" fontFamily="DM Mono, monospace" fontSize="7" fill={textMuted}>Este imóvel</text>
          <rect x="0" y="14" width={barW} height="8" rx="4" fill="rgba(14,14,13,.07)" />
          <rect x="0" y="14" width={myBar} height="8" rx="4" fill={getScoreColor(score)} />
          <text x={myBar + 4} y="21" fontFamily="DM Mono, monospace" fontSize="7" fontWeight="700" fill={getScoreColor(score)}>{score}</text>
          <text x="0" y="36" fontFamily="DM Mono, monospace" fontSize="7" fill={textMuted}>Média zona</text>
          <rect x="0" y="40" width={barW} height="4" rx="2" fill="rgba(14,14,13,.07)" />
          <rect x="0" y="40" width={zoneBar} height="4" rx="2" fill="rgba(14,14,13,.25)" />
          <text x={zoneBar + 4} y="44" fontFamily="DM Mono, monospace" fontSize="7" fill={textMuted}>{zoneAvgScore}</text>
        </svg>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ padding: '10px 12px', background: darkMode ? 'rgba(244,240,230,.04)' : '#fff', border: `1px solid ${border}`, borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: textMuted, marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', fontWeight: 300, color: m.color, lineHeight: 1 }}>{m.val}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: textMuted, marginTop: '2px' }}>{m.bench}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Alert System (top 3 opps + top 3 risks) ─────────────────────────────────
function AlertSystem({ risks, opportunities, darkMode }: { risks: string[]; opportunities: string[]; darkMode: boolean }) {
  const top3risks = (risks ?? []).slice(0, 3)
  const top3opps  = (opportunities ?? []).slice(0, 3)
  if (top3risks.length === 0 && top3opps.length === 0) return null
  const border = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.08)'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
      {/* Top 3 Opportunities */}
      {top3opps.length > 0 && (
        <div style={{ background: 'rgba(28,74,53,.05)', border: '2px solid rgba(28,74,53,.2)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Oportunidades">
              <polygon points="8,2 10,6 15,6 11,9.5 12.5,14 8,11 3.5,14 5,9.5 1,6 6,6" fill="#22c55e" opacity=".9" />
            </svg>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#22c55e', fontWeight: 700 }}>Top Oportunidades</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {top3opps.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '7px 10px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.12)', borderRadius: '8px' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>0{i + 1}</span>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: darkMode ? 'rgba(244,240,230,.7)' : 'rgba(14,14,13,.7)', lineHeight: 1.4 }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 3 Risks */}
      {top3risks.length > 0 && (
        <div style={{ background: 'rgba(224,82,82,.05)', border: '2px solid rgba(224,82,82,.2)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Riscos">
              <path d="M8 2L15 13H1Z" fill="#e05252" opacity=".9" />
              <rect x="7.3" y="6" width="1.4" height="4" rx=".5" fill="#fff" />
              <circle cx="8" cy="11.5" r=".8" fill="#fff" />
            </svg>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#e05252', fontWeight: 700 }}>Top Riscos</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {top3risks.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '7px 10px', background: 'rgba(224,82,82,.06)', border: '1px solid rgba(224,82,82,.12)', borderRadius: '8px' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#e05252', fontWeight: 700, flexShrink: 0 }}>0{i + 1}</span>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: darkMode ? 'rgba(244,240,230,.7)' : 'rgba(14,14,13,.7)', lineHeight: 1.4 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortalRadar({ onRunRadar, onRunRadarSearch, onGerarPDF }: PortalRadarProps) {
  const { darkMode, setSection } = useUIStore()
  const {
    radarResult, radarLoading,
    radarUrl, setRadarUrl,
    radarMode, setRadarMode,
    searchZona, setSearchZona,
    searchPrecoMin, setSearchPrecoMin,
    searchPrecoMax, setSearchPrecoMax,
    searchTipos, setSearchTipos,
    searchScoreMin, setSearchScoreMin,
    searchFontes, setSearchFontes,
    searchResults, searchLoading,
    showHeatMap, setShowHeatMap,
  } = useRadarStore()

  const [resultTab, setResultTab] = useState<ResultTab>('overview')
  const [radarHistory, setRadarHistory] = useState<RadarHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [liveSource, setLiveSource] = useState<'live' | 'demo'>('demo')

  const TIPOS_IMOVEL = ['apartamento', 'moradia', 'villa', 'penthouse', 'loja', 'escritorio', 'terreno', 'armazem']
  const FONTES = ['idealista', 'imovirtual', 'eleiloes', 'banca', 'century21', 'remax', 'era']

  // ── Live signals fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/signals')
      .then(r => { if (!r.ok) throw new Error('not ok'); return r.json() })
      .then(() => setLiveSource('live'))
      .catch(() => setLiveSource('demo'))
  }, [])

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RADAR_HISTORY_KEY)
      if (stored) setRadarHistory(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  // Save result to history when radarResult changes
  useEffect(() => {
    if (!radarResult || !radarUrl) return
    const raw = radarResult as Record<string, unknown>
    const analiseH = (raw.analise as Record<string, unknown> | undefined) ?? {}
    const score = Number(analiseH.score ?? raw.score ?? 0)
    const recommendation = String(analiseH.classificacao ?? analiseH.recommendation ?? raw.classificacao ?? raw.recommendation ?? '')
    if (!score) return
    const item: RadarHistoryItem = {
      url: radarUrl,
      score,
      recommendation,
      date: new Date().toLocaleDateString('pt-PT'),
    }
    setRadarHistory(prev => {
      const next = [item, ...prev.filter(h => h.url !== item.url)].slice(0, MAX_HISTORY)
      try { localStorage.setItem(RADAR_HISTORY_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarResult])

  const toggleTipo = (t: string) => {
    setSearchTipos(searchTipos.includes(t) ? searchTipos.filter(x => x !== t) : [...searchTipos, t])
  }
  const toggleFonte = (f: string) => {
    setSearchFontes(searchFontes.includes(f) ? searchFontes.filter(x => x !== f) : [...searchFontes, f])
  }

  // Search API returns { success, results: Deal[], ... } — field is "results", not "deals"
  const searchDeals = searchResults
    ? ((searchResults as Record<string, unknown>).results
        ?? (searchResults as Record<string, unknown>).deals) as Record<string, unknown>[] | undefined
    : undefined

  // ── Typed result for enhanced display ──────────────────────────────────────
  // The radar API wraps AI analysis inside `analise` sub-object.
  // Fields map: analise.score → score, analise.clasificacao → recommendation,
  // analise.veredicto → summary, analise.20_dimensoes → dimensions,
  // analise.riscos_criticos → risks, analise.pontos_fortes → opportunities,
  // analise.estrategia_negociacao → negotiationAdvice
  // We also support top-level legacy fields for cached/old responses.
  const analise = radarResult
    ? (radarResult.analise as Record<string, unknown> | undefined) ?? {}
    : {}

  const typedResult = radarResult ? ((): RadarResultTyped => {
    const raw = radarResult as Record<string, unknown>
    // Score: prefer analise.score, then top-level score
    const score = Number(analise.score ?? raw.score ?? 0)
    // Recommendation: analise.clasificacao (PT) or analise.recommendation (EN) or top-level
    const recommendation = String(
      analise.classificacao ?? analise.recommendation ?? raw.classificacao ?? raw.recommendation ?? ''
    )
    // Summary: analise.veredicto or analise.summary or legacy
    const summary = String(
      analise.veredicto ?? analise.summary ?? raw.veredicto ?? raw.analise_narrativa ?? raw.summary ?? ''
    )
    // Dimensions: analise["20_dimensoes"] object → convert to RadarDimension[]
    const rawDims = analise['20_dimensoes'] as Record<string, { s: number; n: string }> | undefined
    const dimensions: RadarDimension[] | undefined = rawDims
      ? Object.entries(rawDims).map(([key, val]) => ({
          name: (val?.n ?? key).substring(0, 30),
          score: Math.round(((val?.s ?? 0) / 10) * 100), // convert 0-10 to 0-100
          note: undefined,
        }))
      : undefined
    // Risks: analise.riscos_criticos or top-level risks
    const risksRaw = analise.riscos_criticos ?? analise.risks ?? raw.risks
    const risks: string[] | undefined = Array.isArray(risksRaw) ? risksRaw as string[] : undefined
    // Opportunities: analise.pontos_fortes or top-level opportunities
    const oppsRaw = analise.pontos_fortes ?? analise.opportunities ?? raw.opportunities
    const opportunities: string[] | undefined = Array.isArray(oppsRaw) ? oppsRaw as string[] : undefined
    // Negotiation advice
    const negotiationAdvice = String(
      analise.estrategia_negociacao ?? analise.negotiationAdvice ?? raw.negotiationAdvice ?? ''
    ) || undefined
    // Exit strategy (not provided by API currently, keep undefined)
    const exitStrategy = String(analise.exitStrategy ?? raw.exitStrategy ?? '') || undefined
    // Financial projection: build from financeiro sub-object
    const fin = raw.financeiro as Record<string, unknown> | undefined
    const financialProjection = fin ? {
      yieldBruto:  Number(analise.yield_bruto  ?? fin.yield_bruto  ?? 0),
      yieldLiquido: Number(analise.yield_liquido ?? fin.yield_liq   ?? 0),
      irr5anos:    Number(analise.roi_5_anos_pct  ?? fin.roi5y       ?? 0),
      irr10anos:   Number(analise.roi_10_anos_pct ?? fin.roi10y      ?? 0),
    } : undefined

    return { score, recommendation, summary, dimensions, risks, opportunities, negotiationAdvice, exitStrategy, financialProjection }
  })() : null

  const resultScore   = typedResult?.score   ?? 0
  const resultRec     = typedResult?.recommendation ?? ''
  const resultSummary = typedResult?.summary ?? ''
  const hasDimensions = !!(typedResult?.dimensions && typedResult.dimensions.length > 0)
  const hasFinancial  = !!(typedResult?.financialProjection &&
    (typedResult.financialProjection.yieldBruto > 0 || typedResult.financialProjection.irr5anos > 0))
  const hasComparables = !!(typedResult?.comparables && typedResult.comparables.length > 0)
  const hasRisksOrOpps = !!(typedResult?.risks?.length || typedResult?.opportunities?.length)

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '6px' }}>Inteligência de Mercado</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.8rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>Deal Radar 16D</div>
          {/* LIVE / DEMO badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '999px',
            background: liveSource === 'live' ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)',
            border: `1px solid ${liveSource === 'live' ? 'rgba(34,197,94,.3)' : 'rgba(251,191,36,.3)'}`,
          }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: liveSource === 'live' ? '#22c55e' : '#fbbf24',
              boxShadow: liveSource === 'live' ? '0 0 0 2px rgba(34,197,94,.25)' : 'none',
            }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', fontWeight: 700, letterSpacing: '.1em', color: liveSource === 'live' ? '#22c55e' : '#f59e0b' }}>
              {liveSource === 'live' ? 'LIVE' : 'DEMO'}
            </span>
          </div>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginTop: '4px' }}>16 dimensões · Score AI · Leilões + Banca + Mercado livre</div>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid rgba(14,14,13,.1)' }}>
        {(['url', 'search'] as const).map(m => (
          <button key={m} className={`mkt-tab${radarMode === m ? ' active' : ''}`} onClick={() => setRadarMode(m)}>
            {m === 'url' ? '🔗 Analisar URL' : '🔍 Busca Inteligente'}
          </button>
        ))}
        <button
          className={`mkt-tab${showHeatMap ? ' active' : ''}`}
          onClick={() => setShowHeatMap(!showHeatMap)}
          style={{ marginLeft: 'auto' }}
        >🗺 Heat Map</button>
        {radarHistory.length > 0 && (
          <button
            className={`mkt-tab${showHistory ? ' active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
          >🕐 Histórico ({radarHistory.length})</button>
        )}
      </div>

      {/* Radar History Panel */}
      {showHistory && radarHistory.length > 0 && (
        <div className="p-card" style={{ marginBottom: '20px', background: 'rgba(14,14,13,.02)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '10px' }}>Análises Recentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {radarHistory.map((h, i) => (
              <div key={i}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', borderRadius: '10px', cursor: 'pointer', transition: 'background .15s', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}
                onClick={() => { setRadarUrl(h.url); setRadarMode('url'); setShowHistory(false) }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: getScoreBg(h.score),
                  border: `2px solid ${getScoreColor(h.score)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Cormorant',serif", fontSize: '.9rem', fontWeight: 300,
                  color: getScoreColor(h.score), flexShrink: 0,
                }}>{h.score}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', textTransform: 'uppercase', marginBottom: '2px' }}>{getRecommendationLabel(h.recommendation)}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', flexShrink: 0 }}>{h.date}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setRadarHistory([]); try { localStorage.removeItem(RADAR_HISTORY_KEY) } catch { /* ignore */ } }}
            style={{ marginTop: '8px', padding: '4px 10px', background: 'none', border: '1px solid rgba(14,14,13,.1)', borderRadius: '6px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', cursor: 'pointer', transition: 'all .2s' }}
          >Limpar histórico</button>
        </div>
      )}

      {/* URL Mode */}
      {radarMode === 'url' && (
        <div className="p-card" style={{ marginBottom: '24px' }}>
          <label className="p-label">URL do Imóvel ou Texto de Anúncio</label>
          <textarea
            className="p-inp"
            rows={3}
            placeholder="Cola URL do idealista, imovirtual, OLX... ou texto do anúncio"
            value={radarUrl}
            onChange={e => setRadarUrl(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <button className="p-btn" style={{ marginTop: '12px' }} onClick={onRunRadar} disabled={radarLoading || !radarUrl.trim()}>
            {radarLoading ? '✦ A analisar...' : '✦ Analisar Deal'}
          </button>
        </div>
      )}

      {/* Search Mode */}
      {radarMode === 'search' && (
        <div className="p-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="p-label">Zona</label>
              <input className="p-inp" value={searchZona} onChange={e => setSearchZona(e.target.value)} placeholder="ex: Lisboa" />
            </div>
            <div>
              <label className="p-label">Preço Mínimo (€)</label>
              <input className="p-inp" type="number" value={searchPrecoMin} onChange={e => setSearchPrecoMin(e.target.value)} />
            </div>
            <div>
              <label className="p-label">Preço Máximo (€)</label>
              <input className="p-inp" type="number" value={searchPrecoMax} onChange={e => setSearchPrecoMax(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="p-label">Tipologias</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TIPOS_IMOVEL.map(t => (
                <button key={t} onClick={() => toggleTipo(t)}
                  style={{ padding: '4px 10px', background: searchTipos.includes(t) ? '#1c4a35' : 'transparent', border: `1px solid ${searchTipos.includes(t) ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: searchTipos.includes(t) ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="p-label">Fontes</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FONTES.map(f => (
                <button key={f} onClick={() => toggleFonte(f)}
                  style={{ padding: '4px 10px', background: searchFontes.includes(f) ? '#c9a96e' : 'transparent', border: `1px solid ${searchFontes.includes(f) ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: searchFontes.includes(f) ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.4rem', cursor: 'pointer' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label className="p-label">Score Mínimo: {searchScoreMin}</label>
            <input type="range" min={40} max={95} value={searchScoreMin} onChange={e => setSearchScoreMin(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button className="p-btn" onClick={onRunRadarSearch} disabled={searchLoading}>
            {searchLoading ? '✦ A pesquisar...' : '✦ Buscar Oportunidades'}
          </button>
        </div>
      )}

      {/* Heat Map */}
      {showHeatMap && (
        <div className="p-card" style={{ marginBottom: '24px' }}>
          <div className="p-label" style={{ marginBottom: '12px' }}>Heat Map de Preços — Portugal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
            {HEAT_MAP_ZONES.map((z: Record<string, unknown>) => (
              <div key={String(z.zona)} style={{ padding: '10px 12px', background: `${String(z.color)}14`, border: `1px solid ${String(z.color)}30`, borderRadius: '10px' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: String(z.color), letterSpacing: '.08em', marginBottom: '2px' }}>{String(z.zona)}</div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', fontWeight: 300, color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>€{Number(z.pm2 || 0).toLocaleString('pt-PT')}/m²</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#4a9c7a' }}>{String(z.yoy || '0')}% YoY</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* URL Analysis Result — Enhanced */}
      {radarResult && radarMode === 'url' && (
        <div className="p-card">

          {/* Score Hero */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '24px 20px', marginBottom: '20px',
            background: getScoreBg(resultScore),
            border: `1px solid ${getScoreColor(resultScore)}20`,
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: '#fff',
                border: `3px solid ${getScoreColor(resultScore)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 4px 20px ${getScoreColor(resultScore)}30`,
              }}>
                <div style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '2.2rem', fontWeight: 300,
                  color: getScoreColor(resultScore), lineHeight: 1,
                }}>{resultScore}</div>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '4px' }}>Score de Oportunidade</div>
                <div style={{
                  fontFamily: "'DM Mono',monospace", fontSize: '.56rem',
                  fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
                  color: getScoreColor(resultScore),
                }}>{getRecommendationLabel(resultRec)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                className="p-btn"
                style={{ padding: '10px 16px', fontSize: '.52rem', background: 'rgba(14,14,13,.06)', color: 'rgba(14,14,13,.6)', border: '1px solid rgba(14,14,13,.15)', borderRadius: '6px', transition: 'all .2s' }}
                onClick={() => {
                  // Build text report including chart dimensions for PDF
                  const dimText = typedResult?.dimensions?.map(d => `${d.name}: ${d.score}/100`).join('\n') ?? ''
                  const riskText = typedResult?.risks?.join('\n') ?? ''
                  const oppText  = typedResult?.opportunities?.join('\n') ?? ''
                  const report = `DEAL RADAR 16D — Agency Group\n\nURL: ${radarUrl}\nScore: ${resultScore}/100\nRecomendação: ${getRecommendationLabel(resultRec)}\n\n${resultSummary}\n\nDIMENSÕES:\n${dimText}\n\nOPORTUNIDADES:\n${oppText}\n\nRISCOS:\n${riskText}`
                  navigator.clipboard.writeText(report).catch(() => {})
                }}
              >↗ Copiar Relatório</button>
              <button
                className="p-btn p-btn-gold"
                style={{ padding: '10px 20px', fontSize: '.52rem', borderRadius: '6px', transition: 'all .2s' }}
                onClick={() => setSection('pipeline')}
              >+ Pipeline</button>
            </div>
          </div>

          {/* Benchmark Panel */}
          <BenchmarkPanel url={radarUrl} score={resultScore} darkMode={darkMode} />

          {/* Alert System — Top 3 Opps & Risks */}
          {hasRisksOrOpps && (
            <AlertSystem
              risks={typedResult?.risks ?? []}
              opportunities={typedResult?.opportunities ?? []}
              darkMode={darkMode}
            />
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '20px', overflowX: 'auto', gap: '0' }}>
            {([
              ['overview', 'Overview'],
              ['dimensoes', 'Dimensões'],
              ['financeiro', 'Financeiro'],
              ['comparaveis', 'Comparáveis'],
            ] as [ResultTab, string][]).map(([t, l]) => (
              <button key={t}
                onClick={() => setResultTab(t)}
                style={{
                  padding: '10px 18px', background: 'none', border: 'none',
                  borderBottom: `2px solid ${resultTab === t ? '#1c4a35' : 'transparent'}`,
                  fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                  letterSpacing: '.12em', textTransform: 'uppercase',
                  color: resultTab === t ? '#1c4a35' : 'rgba(14,14,13,.4)',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .2s',
                }}>{l}</button>
            ))}
          </div>

          {/* Tab: Overview */}
          {resultTab === 'overview' && (
            <div>
              {resultSummary && (
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.87rem', color: 'rgba(14,14,13,.75)', lineHeight: 1.8, marginBottom: '20px', padding: '14px 16px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)' }}>
                  {resultSummary}
                </div>
              )}

              {/* Radar Chart */}
              {hasDimensions && (
                <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)' }}>Análise 16 Dimensões — Visualização Radar</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>{typedResult!.dimensions!.length} dimensões</div>
                  </div>
                  <RadarChart dimensions={typedResult!.dimensions!} />
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.25)', textAlign: 'center', marginTop: '8px', letterSpacing: '.06em' }}>Clique em &quot;Copiar Relatório&quot; para exportar com todas as dimensões</div>
                </div>
              )}

              {/* All risks & opportunities (full list) — beyond top 3 shown in alert above */}
              {hasRisksOrOpps && (typedResult?.risks?.length ?? 0) > 3 || (typedResult?.opportunities?.length ?? 0) > 3 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {typedResult?.risks && typedResult.risks.length > 3 && (
                    <div style={{ background: 'rgba(224,82,82,.04)', border: '1px solid rgba(224,82,82,.15)', padding: '14px' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#e05252', marginBottom: '10px' }}>Todos os Riscos ({typedResult.risks.length})</div>
                      <ul style={{ margin: 0, paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {typedResult.risks.slice(3).map((r, i) => (
                          <li key={i} style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.65)', lineHeight: 1.5 }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {typedResult?.opportunities && typedResult.opportunities.length > 3 && (
                    <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', padding: '14px' }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '10px' }}>Mais Oportunidades ({typedResult.opportunities.length})</div>
                      <ul style={{ margin: 0, paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {typedResult.opportunities.slice(3).map((o, i) => (
                          <li key={i} style={{ fontFamily: "'Jost',sans-serif", fontSize: '.8rem', color: 'rgba(14,14,13,.65)', lineHeight: 1.5 }}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Fallback if no structured data */}
              {!resultSummary && !hasDimensions && !hasRisksOrOpps && (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', textAlign: 'center', padding: '20px' }}>
                  Análise completa não disponível para esta fonte.
                </div>
              )}
            </div>
          )}

          {/* Tab: Dimensoes */}
          {resultTab === 'dimensoes' && (
            <div>
              {hasDimensions ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {typedResult!.dimensions!.map((d, i) => (
                    <div key={i} style={{ background: 'rgba(14,14,13,.02)', border: '1px solid rgba(14,14,13,.07)', borderRadius: '10px', padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#0e0e0d', fontWeight: 600 }}>{d.name}</span>
                          {d.weight !== undefined && (
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', background: 'rgba(14,14,13,.06)', padding: '1px 5px', borderRadius: '4px' }}>peso {d.weight}%</span>
                          )}
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.5rem', fontWeight: 700, color: getScoreColor(d.score) }}>{d.score}</span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(14,14,13,.07)', borderRadius: '3px', overflow: 'hidden', marginBottom: d.note ? '6px' : '0' }}>
                        <div style={{ height: '100%', width: `${d.score}%`, background: getScoreColor(d.score), borderRadius: '3px', transition: 'width .4s' }} />
                      </div>
                      {d.note && <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.76rem', color: 'rgba(14,14,13,.5)', lineHeight: 1.4 }}>{d.note}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                  Dados de dimensões não disponíveis nesta análise.
                </div>
              )}
            </div>
          )}

          {/* Tab: Financeiro */}
          {resultTab === 'financeiro' && (
            <div>
              {hasFinancial && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '12px' }}>Projecção Financeira</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    {[
                      { label: 'Yield Bruto', val: `${typedResult!.financialProjection!.yieldBruto?.toFixed(1)}%` },
                      { label: 'Yield Líquido', val: `${typedResult!.financialProjection!.yieldLiquido?.toFixed(1)}%` },
                      { label: 'IRR 5 Anos', val: `${typedResult!.financialProjection!.irr5anos?.toFixed(1)}%` },
                      { label: 'IRR 10 Anos', val: `${typedResult!.financialProjection!.irr10anos?.toFixed(1)}%` },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.12)', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.4)', marginBottom: '6px' }}>{item.label}</div>
                        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.6rem', color: '#1c4a35', lineHeight: 1 }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {typedResult?.negotiationAdvice && (
                <div style={{ marginBottom: '16px', padding: '14px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '8px' }}>Estratégia de Negociação</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.7 }}>{typedResult.negotiationAdvice}</div>
                </div>
              )}
              {typedResult?.exitStrategy && (
                <div style={{ padding: '14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '8px' }}>Exit Strategy</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.84rem', color: 'rgba(14,14,13,.7)', lineHeight: 1.7 }}>{typedResult.exitStrategy}</div>
                </div>
              )}
              {!hasFinancial && !typedResult?.negotiationAdvice && !typedResult?.exitStrategy && (
                <div style={{ textAlign: 'center', padding: '32px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                  Dados financeiros não disponíveis nesta análise.
                </div>
              )}
            </div>
          )}

          {/* Tab: Comparaveis */}
          {resultTab === 'comparaveis' && (
            <div>
              {hasComparables ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', marginBottom: '4px' }}>Imóveis Comparáveis Vendidos</div>
                  {typedResult!.comparables!.map((comp, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fff', border: '1px solid rgba(14,14,13,.08)', borderRadius: '10px', gap: '16px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.83rem', fontWeight: 500, color: '#0e0e0d', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.address}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)' }}>{comp.sqm}m² · {comp.daysOnMarket}d no mercado</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.2rem', color: '#1c4a35', lineHeight: 1 }}>€{comp.price.toLocaleString('pt-PT')}</div>
                        {comp.sqm > 0 && (
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>€{Math.round(comp.price / comp.sqm).toLocaleString('pt-PT')}/m²</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
                  Sem comparáveis disponíveis para este imóvel.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      {searchResults && radarMode === 'search' && searchDeals && searchDeals.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.1em' }}>
              {searchDeals.length} oportunidades encontradas
            </div>
            <button className="p-btn p-btn-gold" style={{ padding: '8px 16px' }}
              onClick={() => onGerarPDF(
                searchDeals,
                { zona: searchZona, preco_min: searchPrecoMin, preco_max: searchPrecoMax, tipos: searchTipos, fontes: searchFontes, score_min: searchScoreMin },
                (searchResults as Record<string, unknown>).stats as Record<string, unknown> || {}
              )}>
              ⬇ PDF Escolhas do Dia
            </button>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {searchDeals.map((deal, i) => (
              <div key={i} className="deal-card" style={{ borderLeft: `4px solid ${Number(deal.score || 0) >= 80 ? '#c9a96e' : Number(deal.score || 0) >= 65 ? '#4a9c7a' : '#888'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.6rem', fontWeight: 300, color: '#1c4a35' }}>{String(deal.score || 0)}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', padding: '2px 6px', background: 'rgba(201,169,110,.08)', borderRadius: '4px' }}>{String(deal.classificacao || '—')}</span>
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', fontWeight: 500, color: '#0e0e0d', marginBottom: '2px' }}>{String(deal.titulo || 'Imóvel').substring(0, 80)}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.4rem', color: 'rgba(14,14,13,.4)' }}>{String(deal.zona || '')} · {deal.area ? `${deal.area}m²` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.2rem', fontWeight: 300, color: '#0e0e0d' }}>
                      {Number(deal.preco || 0) > 0 ? `€ ${Number(deal.preco).toLocaleString('pt-PT')}` : '—'}
                    </div>
                    {!!deal.url && (
                      <a href={String(deal.url)} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35' }}>Ver →</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
