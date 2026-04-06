'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import { exportToPDF } from '../utils/export'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'pipeline' | 'mercado' | 'equipa'
type PeriodId = 'mes' | 'trimestre' | 'ano' | 'personalizado'

interface BarChartProps {
  data: number[]
  labels?: string[]
  height?: number
  color?: string
  highlightTop?: number
  highlightColor?: string
  showTrend?: boolean
}

interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: string
}

interface LineSeries {
  label: string
  data: number[]
  color: string
}

interface LineChartProps {
  series: LineSeries[]
  labels: string[]
  height?: number
  showGrid?: boolean
  yPrefix?: string
}

interface AgentData {
  name: string
  gciMes: number
  gciYTD: number
  dealsFechados: number
  pipeline: number
  conversao: number
  diasCiclo: number
  score: number
  calls: number
  emails: number
  visitas: number
  propostas: number
}

type SortKey = keyof AgentData
type SortDir = 'asc' | 'desc'

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────

const MONTHS_LABELS = ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar']

const GCI_12M: number[] = [62400, 78300, 91200, 84700, 68900, 72100, 95400, 118600, 134200, 142800, 156400, 168700]

const AGENTS: AgentData[] = [
  { name: 'Sofia Martins',   gciMes: 38400, gciYTD: 312800, dealsFechados: 14, pipeline: 1240000, conversao: 4.8, diasCiclo: 72,  score: 94, calls: 68, emails: 142, visitas: 24, propostas: 11 },
  { name: 'Ricardo Fonseca', gciMes: 29700, gciYTD: 241500, dealsFechados: 11, pipeline: 980000,  conversao: 3.9, diasCiclo: 84,  score: 87, calls: 54, emails: 118, visitas: 19, propostas: 8  },
  { name: 'Ana Rodrigues',   gciMes: 24100, gciYTD: 198600, dealsFechados: 9,  pipeline: 730000,  conversao: 3.4, diasCiclo: 91,  score: 81, calls: 47, emails: 96,  visitas: 16, propostas: 7  },
  { name: 'Bruno Carvalho',  gciMes: 18600, gciYTD: 152300, dealsFechados: 7,  pipeline: 540000,  conversao: 2.8, diasCiclo: 102, score: 73, calls: 39, emails: 78,  visitas: 12, propostas: 5  },
  { name: 'Inês Almeida',    gciMes: 14200, gciYTD: 118400, dealsFechados: 5,  pipeline: 380000,  conversao: 2.1, diasCiclo: 118, score: 65, calls: 31, emails: 62,  visitas: 9,  propostas: 3  },
]

const ZONAS_GCI = [
  { zona: 'Lisboa',    valor: 1842000, pct: 42, color: '#1c4a35' },
  { zona: 'Cascais',   valor: 1008800, pct: 23, color: '#2d6e52' },
  { zona: 'Algarve',   valor: 789200,  pct: 18, color: '#c9a96e' },
  { zona: 'Porto',     valor: 526300,  pct: 12, color: '#a07840' },
  { zona: 'Madeira',   valor: 219300,  pct: 5,  color: '#6b4e28' },
]

const FUNIL = [
  { stage: 'Leads',     valor: 1840, color: '#1c4a35' },
  { stage: 'Visitas',   valor: 412,  color: '#2d6e52' },
  { stage: 'Propostas', valor: 124,  color: '#c9a96e' },
  { stage: 'CPCV',      valor: 38,   color: '#a07840' },
  { stage: 'Escritura', valor: 19,   color: '#6b4e28' },
]

const PIPELINE_STAGES = [
  { stage: 'Qualificação', deals: 8,  valor: 4200000,  prob: 20, color: '#e74c3c' },
  { stage: 'Visita',       deals: 5,  valor: 3800000,  prob: 40, color: '#c9a96e' },
  { stage: 'Proposta',     deals: 4,  valor: 3100000,  prob: 60, color: '#c9a96e' },
  { stage: 'CPCV',         deals: 3,  valor: 2400000,  prob: 85, color: '#1c4a35' },
  { stage: 'Escritura',    deals: 2,  valor: 1600000,  prob: 95, color: '#1c4a35' },
]

const DEAL_VELOCITY = [
  { stage: 'Qualificação', actual: 18, ideal: 12 },
  { stage: 'Visita',       actual: 22, ideal: 15 },
  { stage: 'Proposta',     actual: 31, ideal: 20 },
  { stage: 'CPCV',         actual: 28, ideal: 25 },
  { stage: 'Escritura',    actual: 45, ideal: 30 },
]

const TIPOLOGIA_SEGMENTS: DonutSegment[] = [
  { label: 'Apartamento', value: 48, color: '#1c4a35' },
  { label: 'Moradia',     value: 31, color: '#c9a96e' },
  { label: 'Comercial',   value: 14, color: '#2d6e52' },
  { label: 'Terreno',     value: 7,  color: '#a07840' },
]

const NATIONALITY_SEGMENTS: DonutSegment[] = [
  { label: 'Norte-americanos', value: 16, color: '#1c4a35' },
  { label: 'Franceses',        value: 13, color: '#2d6e52' },
  { label: 'Britânicos',       value: 9,  color: '#c9a96e' },
  { label: 'Chineses',         value: 8,  color: '#a07840' },
  { label: 'Brasileiros',      value: 6,  color: '#6b4e28' },
  { label: 'Alemães',          value: 5,  color: '#8b6914' },
  { label: 'Outros',           value: 43, color: '#d4cfc4' },
]

const MARKET_DATA = [
  { zona: 'Lisboa',    preco: 5000, varYoY: 11.2, volume: 8240, diasMercado: 68,  scores: [4, 4, 4, 2] },
  { zona: 'Cascais',   preco: 4713, varYoY: 9.8,  volume: 3180, diasMercado: 84,  scores: [3, 3, 3, 3] },
  { zona: 'Algarve',   preco: 3941, varYoY: 14.6, volume: 4920, diasMercado: 72,  scores: [2, 4, 2, 2] },
  { zona: 'Porto',     preco: 3643, varYoY: 8.4,  volume: 5640, diasMercado: 91,  scores: [1, 2, 3, 3] },
  { zona: 'Madeira',   preco: 3760, varYoY: 17.2, volume: 1840, diasMercado: 104, scores: [1, 4, 1, 4] },
  { zona: 'Açores',    preco: 1952, varYoY: 6.1,  volume: 920,  diasMercado: 124, scores: [0, 1, 0, 4] },
  { zona: 'Comporta',  preco: 6200, varYoY: 22.4, volume: 280,  diasMercado: 210, scores: [4, 4, 0, 4] },
  { zona: 'Sintra',    preco: 3280, varYoY: 7.8,  volume: 2140, diasMercado: 98,  scores: [1, 2, 2, 3] },
]

const PRICE_TREND_LABELS = ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25']
const PRICE_TREND_SERIES: LineSeries[] = [
  { label: 'Lisboa',  data: [4280, 4420, 4560, 4680, 4780, 4890, 4960, 5000], color: '#1c4a35' },
  { label: 'Cascais', data: [3980, 4100, 4220, 4340, 4450, 4560, 4640, 4713], color: '#c9a96e' },
  { label: 'Algarve', data: [3140, 3260, 3380, 3520, 3640, 3760, 3860, 3941], color: '#2d6e52' },
]

const FORECAST_LABELS = ['Mai 26', 'Jun 26', 'Jul 26']
const FORECAST_SERIES: LineSeries[] = [
  { label: 'Pessimista', data: [148000, 132000, 119000], color: '#e74c3c' },
  { label: 'Base',       data: [168700, 158000, 172000], color: '#1c4a35' },
  { label: 'Optimista',  data: [192000, 210000, 228000], color: '#c9a96e' },
]

const DEMAND_SUPPLY_LABELS = ['Lisboa', 'Cascais', 'Algarve', 'Porto', 'Madeira']
const DEMAND_DATA = [340, 180, 220, 160, 80]
const SUPPLY_DATA = [280, 210, 310, 190, 120]

const LEADERBOARD_WEEKLY = [
  { pos: 1, name: 'Sofia Martins',   gciSemana: 12400, emoji: '🥇' },
  { pos: 2, name: 'Ricardo Fonseca', gciSemana: 8700,  emoji: '🥈' },
  { pos: 3, name: 'Ana Rodrigues',   gciSemana: 6200,  emoji: '🥉' },
  { pos: 4, name: 'Bruno Carvalho',  gciSemana: 4800,  emoji: '' },
  { pos: 5, name: 'Inês Almeida',    gciSemana: 3100,  emoji: '' },
]

// ─── UTILITY FUNCTIONS ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}K`
  return `€${n.toFixed(0)}`
}

function fmtFull(n: number): string {
  return `€${n.toLocaleString('pt-PT')}`
}

function scoreCell(score: number): string {
  if (score >= 3) return '#d4edda'
  if (score >= 2) return '#fff3cd'
  if (score >= 1) return '#ffe0e0'
  return '#f8d7da'
}

// ─── SVG CHART COMPONENTS ──────────────────────────────────────────────────────

function BarChart({ data, labels, height = 120, color = '#1c4a35', highlightTop = 3, highlightColor = '#c9a96e', showTrend = true }: BarChartProps) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null)
  const W = 600
  const H = height
  const PAD = { top: 10, right: 10, bottom: 24, left: 10 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const max = Math.max(...data) * 1.1 || 1  // guard against division-by-zero on empty/zero data
  const barW = chartW / data.length
  const barPad = barW * 0.18

  const sorted = [...data].sort((a, b) => b - a)
  const topVals = sorted.slice(0, highlightTop)

  const trendPoints = data.map((v, i) => {
    const x = PAD.left + i * barW + barW / 2
    const y = PAD.top + chartH - (v / max) * chartH
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={PAD.left} y1={PAD.top + chartH * (1 - t)}
            x2={W - PAD.right} y2={PAD.top + chartH * (1 - t)}
            stroke="#e8e2d6" strokeWidth="0.5"
          />
        ))}
        {/* Bars */}
        {data.map((v, i) => {
          const x = PAD.left + i * barW + barPad
          const bw = barW - barPad * 2
          const bh = (v / max) * chartH
          const y = PAD.top + chartH - bh
          const isTop = topVals.includes(v)
          const fill = isTop ? highlightColor : color
          const isHovered = tooltip?.idx === i
          return (
            <g key={i}
              onMouseEnter={e => setTooltip({ idx: i, x: PAD.left + i * barW + barW / 2, y })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={x} y={y} width={bw} height={bh}
                fill={fill} opacity={isHovered ? 1 : 0.85}
                rx="2"
                style={{ transition: 'opacity 0.15s' }}
              />
              {labels && (
                <text x={PAD.left + i * barW + barW / 2} y={H - 4}
                  textAnchor="middle" fontSize="8" fill="#6b6b5e"
                  fontFamily="'DM Mono',monospace"
                >{labels[i]}</text>
              )}
            </g>
          )
        })}
        {/* Trend line */}
        {showTrend && (
          <polyline
            points={trendPoints}
            fill="none"
            stroke="#e74c3c"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.7"
          />
        )}
        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 28, W - 70)}
              y={tooltip.y - 28}
              width={64} height={20} rx="4"
              fill="#0e0e0d" opacity="0.85"
            />
            <text
              x={Math.min(tooltip.x - 28, W - 70) + 32}
              y={tooltip.y - 14}
              textAnchor="middle" fontSize="8.5" fill="#f4f0e6"
              fontFamily="'DM Mono',monospace"
            >{fmt(data[tooltip.idx])}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function DonutChart({ segments, size = 160, thickness = 36, centerLabel }: DonutChartProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1  // guard against division-by-zero
  const cx = size / 2
  const cy = size / 2
  const r = (size - thickness) / 2

  let cumAngle = -Math.PI / 2
  const arcs = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI
    const start = cumAngle
    const end = cumAngle + angle
    cumAngle = end
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    const large = angle > Math.PI ? 1 : 0
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${cx} ${cy} Z`
    return { ...seg, path, startA: start, endA: end }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ flexShrink: 0, opacity: mounted ? 1 : 0, transition: 'opacity 0.5s' }}
      >
        {arcs.map((arc, i) => (
          <path key={i} d={arc.path} fill={arc.color} opacity="0.9"
            stroke="#f4f0e6" strokeWidth="1.5"
          />
        ))}
        <circle cx={cx} cy={cy} r={r - thickness / 2 + 2} fill="#f4f0e6" />
        {centerLabel && (
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10"
            fill="#0e0e0d" fontFamily="'DM Mono',monospace">{centerLabel}</text>
        )}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#0e0e0d' }}>
              {seg.label} <strong>{seg.value}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ series, labels, height = 100, showGrid = true, yPrefix = '' }: LineChartProps) {
  const [tooltip, setTooltip] = useState<{ si: number; di: number; x: number; y: number } | null>(null)
  const W = 600
  const H = height
  const PAD = { top: 12, right: 10, bottom: 22, left: 10 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const allVals = series.flatMap(s => s.data)
  const minV = Math.min(...allVals) * 0.95
  const maxV = Math.max(...allVals) * 1.05
  const range = maxV - minV || 1  // guard against division-by-zero when all values are equal

  const getX = (i: number) => labels.length <= 1
    ? PAD.left + chartW / 2
    : PAD.left + (i / (labels.length - 1)) * chartW
  const getY = (v: number) => PAD.top + chartH - ((v - minV) / range) * chartH

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t}
            x1={PAD.left} y1={PAD.top + chartH * (1 - t)}
            x2={W - PAD.right} y2={PAD.top + chartH * (1 - t)}
            stroke="#e8e2d6" strokeWidth="0.5"
          />
        ))}
        {labels.map((lbl, i) => (
          <text key={i} x={getX(i)} y={H - 4}
            textAnchor="middle" fontSize="8" fill="#6b6b5e"
            fontFamily="'DM Mono',monospace"
          >{lbl}</text>
        ))}
        {series.map((s, si) => {
          const points = s.data.map((v, di) => `${getX(di)},${getY(v)}`).join(' ')
          return (
            <g key={si}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth="2" opacity="0.9" />
              {s.data.map((v, di) => (
                <circle key={di} cx={getX(di)} cy={getY(v)} r="3.5"
                  fill={s.color} stroke="#f4f0e6" strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setTooltip({ si, di, x: getX(di), y: getY(v) })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </g>
          )
        })}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 32, W - 74)}
              y={tooltip.y - 26}
              width={70} height={18} rx="3"
              fill="#0e0e0d" opacity="0.85"
            />
            <text
              x={Math.min(tooltip.x - 32, W - 74) + 35}
              y={tooltip.y - 13}
              textAnchor="middle" fontSize="8" fill="#f4f0e6"
              fontFamily="'DM Mono',monospace"
            >{yPrefix}{series[tooltip.si].data[tooltip.di].toLocaleString('pt-PT')}</text>
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 3, background: s.color, borderRadius: 2 }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#6b6b5e' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KPI CARD ──────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string
  value: string
  sub?: string
  trend?: number
  gold?: boolean
}

function KPICard({ label, value, sub, trend, gold }: KPICardProps) {
  return (
    <div className="p-card" style={{
      background: gold ? '#1c4a35' : undefined,
      color: gold ? '#f4f0e6' : undefined,
      animation: 'fadeInUp 0.4s ease both',
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65, marginBottom: 6, color: gold ? '#c9a96e' : '#6b6b5e' }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cormorant',serif", fontSize: 28, fontWeight: 700, lineHeight: 1, color: gold ? '#c9a96e' : '#1c4a35', marginBottom: 4 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, opacity: 0.6, color: gold ? '#f4f0e6' : undefined }}>
          {sub}
        </div>
      )}
      {trend !== undefined && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, marginTop: 4, color: trend >= 0 ? '#2d9e5f' : '#e74c3c' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ─── SECTION HEADER ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontFamily: "'Cormorant',serif", fontSize: 20, fontWeight: 300, color: '#1c4a35', margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 12, color: '#6b6b5e', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

// ─── TAB: OVERVIEW ─────────────────────────────────────────────────────────────

function TabOverview() {
  const gciMensal = GCI_12M[GCI_12M.length - 1]
  const gciYTD = GCI_12M.slice(-12).reduce((a, b) => a + b, 0)
  const pipelineAtivo = PIPELINE_STAGES.reduce((acc, s) => acc + s.valor * (s.prob / 100), 0)

  const maxFunil = FUNIL[0].valor

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, animation: 'fadeIn 0.35s ease' }}>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <KPICard label="GCI Mensal" value={fmt(gciMensal)} trend={7.8} />
        <KPICard label="GCI YTD" value={fmt(gciYTD)} trend={17.6} />
        <KPICard label="Pipeline Activo" value={fmt(pipelineAtivo)} sub="ponderado por prob." />
        <KPICard label="Conversão Lead→Deal" value="3.2%" sub="média 12 meses" trend={0.4} />
        <KPICard label="Ciclo Médio" value="87 dias" sub="Benchmark: 75" />
        <KPICard label="NPS Score" value="87" sub="vs 72 média sector" gold />
      </div>

      {/* Revenue Chart */}
      <div className="p-card">
        <SectionHeader title="GCI Últimos 12 Meses" sub="3 meses topo destacados a gold — linha tendência a vermelho" />
        <BarChart
          data={GCI_12M}
          labels={MONTHS_LABELS}
          height={140}
          color="#1c4a35"
          highlightTop={3}
          highlightColor="#c9a96e"
          showTrend
        />
      </div>

      {/* Funil + Zonas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Funil de Conversão */}
        <div className="p-card">
          <SectionHeader title="Funil de Conversão" sub="Largura proporcional ao volume por stage" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {FUNIL.map((f, i) => {
              const pct = (f.valor / maxFunil) * 100
              const convPct = i > 0 && FUNIL[i - 1].valor > 0 ? ((f.valor / FUNIL[i - 1].valor) * 100).toFixed(1) : null
              return (
                <div key={f.stage}>
                  {convPct && (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e', paddingLeft: `${(100 - pct) / 2}%`, marginBottom: 2 }}>
                      ▼ {convPct}%
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      height: 28,
                      width: `${pct}%`,
                      background: f.color,
                      borderRadius: 4,
                      margin: '0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'width 0.6s ease'
                    }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#f4f0e6', whiteSpace: 'nowrap' }}>
                        {f.stage} · {f.valor.toLocaleString('pt-PT')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top 5 Zonas */}
        <div className="p-card">
          <SectionHeader title="Top 5 Zonas por GCI" sub="Percentagem do total de receita" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {ZONAS_GCI.map(z => (
              <div key={z.zona}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 12, fontWeight: 600, color: '#0e0e0d' }}>{z.zona}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#1c4a35' }}>{fmtFull(z.valor)}</span>
                </div>
                <div style={{ height: 8, background: '#e8e2d6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${z.pct}%`, background: z.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e', marginTop: 2 }}>{z.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB: PIPELINE ─────────────────────────────────────────────────────────────

function TabPipeline() {
  const totalPipeline = PIPELINE_STAGES.reduce((a, s) => a + s.valor, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, animation: 'fadeIn 0.35s ease' }}>
      {/* Kanban Visual */}
      <div className="p-card">
        <SectionHeader title="Pipeline por Stage" sub="Cor por probabilidade: vermelho &lt;30% · gold 30–70% · verde &gt;70%" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 8 }}>
          {PIPELINE_STAGES.map(s => (
            <div key={s.stage} style={{
              background: '#f4f0e6',
              border: `2px solid ${s.color}`,
              borderRadius: 10,
              padding: '14px 12px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
            }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.stage}</div>
              <div style={{ fontFamily: "'Cormorant',serif", fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.deals}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#0e0e0d', marginTop: 4 }}>deals</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#1c4a35', marginTop: 8, fontWeight: 700 }}>{fmt(s.valor)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e', marginTop: 2 }}>Prob. {s.prob}%</div>
              <div style={{ height: 4, background: '#e8e2d6', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(s.valor / totalPipeline) * 100}%`, background: s.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Forecast + Velocity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="p-card">
          <SectionHeader title="Forecast GCI (3 meses)" sub="Pessimista · Base · Optimista" />
          <LineChart series={FORECAST_SERIES} labels={FORECAST_LABELS} height={130} yPrefix="€" />
        </div>

        <div className="p-card">
          <SectionHeader title="Deal Velocity por Stage" sub="Dias médios actual vs. benchmark ideal" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {DEAL_VELOCITY.map(d => {
              const maxDays = 50
              return (
                <div key={d.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 11, color: '#0e0e0d' }}>{d.stage}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: d.actual > d.ideal ? '#e74c3c' : '#1c4a35' }}>
                      {d.actual}d <span style={{ color: '#6b6b5e' }}>/ {d.ideal}d ideal</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ height: 6, background: '#e8e2d6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(d.actual / maxDays) * 100}%`, background: d.actual > d.ideal ? '#e74c3c' : '#1c4a35', borderRadius: 3 }} />
                    </div>
                    <div style={{ height: 4, background: '#e8e2d6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(d.ideal / maxDays) * 100}%`, background: '#c9a96e', borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 3, background: '#1c4a35', borderRadius: 2 }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e' }}>Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 3, background: '#c9a96e', borderRadius: 2 }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e' }}>Ideal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tipologia Donut */}
      <div className="p-card">
        <SectionHeader title="Pipeline por Tipologia" sub="Distribuição do valor de pipeline por tipo de imóvel" />
        <DonutChart segments={TIPOLOGIA_SEGMENTS} size={150} thickness={38} centerLabel="4 tipos" />
      </div>
    </div>
  )
}

// ─── TAB: MERCADO ──────────────────────────────────────────────────────────────

function TabMercado() {
  const metricLabels = ['Preço/m²', 'Var. YoY', 'Volume', 'Dias Mkt']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, animation: 'fadeIn 0.35s ease' }}>
      {/* Market Heatmap */}
      <div className="p-card" style={{ overflowX: 'auto' }}>
        <SectionHeader title="Market Heatmap" sub="Verde = melhor quartil · Vermelho = pior quartil" />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 11, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6b6b5e', fontWeight: 400, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Zona</th>
              {metricLabels.map(m => (
                <th key={m} style={{ textAlign: 'right', padding: '6px 10px', color: '#6b6b5e', fontWeight: 400, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKET_DATA.map((row, i) => (
              <tr key={row.zona} style={{ borderTop: '1px solid #e8e2d6' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0e0e0d', fontFamily: "'Jost',sans-serif" }}>{row.zona}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', background: scoreCell(row.scores[0]), borderRadius: 4 }}>
                  €{row.preco.toLocaleString('pt-PT')}/m²
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', background: scoreCell(row.scores[1]), borderRadius: 4, color: '#1c4a35', fontWeight: 700 }}>
                  +{row.varYoY}%
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', background: scoreCell(row.scores[2]), borderRadius: 4 }}>
                  {row.volume.toLocaleString('pt-PT')}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', background: scoreCell(3 - row.scores[3]), borderRadius: 4 }}>
                  {row.diasMercado}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Demand vs Supply */}
      <div className="p-card">
        <SectionHeader title="Demand vs. Supply por Zona" sub="Compradores activos (barras) · Imóveis disponíveis (linha)" />
        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 600 130" width="100%" style={{ display: 'block' }}>
            {DEMAND_SUPPLY_LABELS.map((label, i) => {
              const x = 40 + i * 110
              const maxV = 400
              const dH = (DEMAND_DATA[i] / maxV) * 90
              const sH = (SUPPLY_DATA[i] / maxV) * 90
              const ratio = (SUPPLY_DATA[i] > 0 ? DEMAND_DATA[i] / SUPPLY_DATA[i] : 0).toFixed(2)
              return (
                <g key={label}>
                  {/* Demand bar */}
                  <rect x={x} y={108 - dH} width={42} height={dH} fill="#1c4a35" rx="2" opacity="0.85" />
                  {/* Supply bar */}
                  <rect x={x + 46} y={108 - sH} width={42} height={sH} fill="#c9a96e" rx="2" opacity="0.85" />
                  <text x={x + 44} y={120} textAnchor="middle" fontSize="8" fill="#6b6b5e" fontFamily="'DM Mono',monospace">{label}</text>
                  <text x={x + 44} y={108 - Math.max(dH, sH) - 4} textAnchor="middle" fontSize="8" fill="#0e0e0d" fontFamily="'DM Mono',monospace">×{ratio}</text>
                </g>
              )
            })}
            {/* Legend */}
            <rect x={10} y={4} width={10} height={8} fill="#1c4a35" rx="1" />
            <text x={24} y={12} fontSize="8" fill="#6b6b5e" fontFamily="'DM Mono',monospace">Compradores</text>
            <rect x={100} y={4} width={10} height={8} fill="#c9a96e" rx="1" />
            <text x={114} y={12} fontSize="8" fill="#6b6b5e" fontFamily="'DM Mono',monospace">Disponíveis</text>
          </svg>
        </div>
      </div>

      {/* Buyer Nationality + Price Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="p-card">
          <SectionHeader title="Compradores por Nacionalidade" sub="Segmento €500K–€3M" />
          <DonutChart segments={NATIONALITY_SEGMENTS} size={140} thickness={34} centerLabel="7 nac." />
        </div>

        <div className="p-card">
          <SectionHeader title="Evolução Preço/m²" sub="Últimos 8 trimestres — Lisboa · Cascais · Algarve" />
          <LineChart series={PRICE_TREND_SERIES} labels={PRICE_TREND_LABELS} height={130} yPrefix="€" />
        </div>
      </div>
    </div>
  )
}

// ─── TAB: EQUIPA ───────────────────────────────────────────────────────────────

function TabEquipa() {
  const [sortKey, setSortKey] = useState<SortKey>('gciYTD')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...AGENTS].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'desc' ? bv - av : av - bv
      }
      return 0
    })
  }, [sortKey, sortDir])

  const teamAvg: AgentData = useMemo(() => {
    const n = AGENTS.length
    return {
      name: 'Média Equipa',
      gciMes:        AGENTS.reduce((a, x) => a + x.gciMes, 0) / n,
      gciYTD:        AGENTS.reduce((a, x) => a + x.gciYTD, 0) / n,
      dealsFechados: AGENTS.reduce((a, x) => a + x.dealsFechados, 0) / n,
      pipeline:      AGENTS.reduce((a, x) => a + x.pipeline, 0) / n,
      conversao:     AGENTS.reduce((a, x) => a + x.conversao, 0) / n,
      diasCiclo:     AGENTS.reduce((a, x) => a + x.diasCiclo, 0) / n,
      score:         AGENTS.reduce((a, x) => a + x.score, 0) / n,
      calls:         AGENTS.reduce((a, x) => a + x.calls, 0) / n,
      emails:        AGENTS.reduce((a, x) => a + x.emails, 0) / n,
      visitas:       AGENTS.reduce((a, x) => a + x.visitas, 0) / n,
      propostas:     AGENTS.reduce((a, x) => a + x.propostas, 0) / n,
    }
  }, [])

  const topPerformer = AGENTS.reduce((top, a) => a.gciYTD > top.gciYTD ? a : top, AGENTS[0])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const cols: { key: SortKey; label: string }[] = [
    { key: 'name',         label: 'Agente' },
    { key: 'gciMes',       label: 'GCI Mês' },
    { key: 'gciYTD',       label: 'GCI YTD' },
    { key: 'dealsFechados',label: 'Deals' },
    { key: 'pipeline',     label: 'Pipeline' },
    { key: 'conversao',    label: 'Conv. %' },
    { key: 'diasCiclo',    label: 'Ciclo (d)' },
    { key: 'score',        label: 'Score' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, animation: 'fadeIn 0.35s ease' }}>
      {/* Agent Table */}
      <div className="p-card" style={{ overflowX: 'auto' }}>
        <SectionHeader title="Performance da Equipa" sub="Clique nas colunas para ordenar · Top performer destacado" />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key}
                  onClick={() => handleSort(c.key)}
                  style={{
                    textAlign: c.key === 'name' ? 'left' : 'right',
                    padding: '8px 10px',
                    color: sortKey === c.key ? '#1c4a35' : '#6b6b5e',
                    fontWeight: sortKey === c.key ? 700 : 400,
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {c.label} {sortKey === c.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent, i) => {
              const isTop = agent.name === topPerformer.name
              return (
                <tr key={agent.name}
                  onMouseEnter={() => setHoveredAgent(agent.name)}
                  onMouseLeave={() => setHoveredAgent(null)}
                  style={{
                    borderTop: '1px solid #e8e2d6',
                    background: isTop ? '#e8f4ed' : hoveredAgent === agent.name ? '#f0ece3' : undefined,
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ padding: '10px 10px', fontFamily: "'Jost',sans-serif", fontWeight: isTop ? 700 : 400, color: isTop ? '#1c4a35' : '#0e0e0d' }}>
                    {isTop && <span style={{ color: '#c9a96e', marginRight: 4 }}>★</span>}{agent.name}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#1c4a35', fontWeight: 600 }}>{fmt(agent.gciMes)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: '#1c4a35', fontWeight: 700 }}>{fmt(agent.gciYTD)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>{agent.dealsFechados}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>{fmt(agent.pipeline)}</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: agent.conversao >= 3.2 ? '#1c4a35' : '#e74c3c' }}>{agent.conversao}%</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: agent.diasCiclo <= 87 ? '#1c4a35' : '#e74c3c' }}>{agent.diasCiclo}d</td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 20,
                      background: agent.score >= 85 ? '#1c4a35' : agent.score >= 75 ? '#c9a96e' : '#e8e2d6',
                      color: agent.score >= 85 ? '#f4f0e6' : agent.score >= 75 ? '#0e0e0d' : '#6b6b5e',
                      fontSize: 10,
                      fontWeight: 700,
                    }}>{agent.score}</span>
                  </td>
                </tr>
              )
            })}
            {/* Team avg row */}
            <tr style={{ borderTop: '2px solid #1c4a35', background: '#f0ece3', fontWeight: 700 }}>
              <td style={{ padding: '10px 10px', fontFamily: "'Jost',sans-serif", color: '#6b6b5e', fontSize: 11 }}>Média Equipa</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{fmt(teamAvg.gciMes)}</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{fmt(teamAvg.gciYTD)}</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{teamAvg.dealsFechados.toFixed(1)}</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{fmt(teamAvg.pipeline)}</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{teamAvg.conversao.toFixed(1)}%</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{teamAvg.diasCiclo.toFixed(0)}d</td>
              <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6b6b5e' }}>{teamAvg.score.toFixed(0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Activity Metrics */}
      <div className="p-card">
        <SectionHeader title="Activity Metrics (por semana)" sub="Chamadas · Emails · Visitas · Propostas — linha benchmark médio" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 8 }}>
          {(['calls', 'emails', 'visitas', 'propostas'] as const).map(metric => {
            const labels = ['Chamadas', 'Emails', 'Visitas', 'Propostas']
            const labelIdx = ['calls', 'emails', 'visitas', 'propostas'].indexOf(metric)
            const data = AGENTS.map(a => a[metric]) as number[]
            const avg = data.reduce((a, b) => a + b, 0) / data.length
            const maxV = Math.max(...data)
            return (
              <div key={metric}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#6b6b5e', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.06em' }}>{labels[labelIdx]}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {AGENTS.map((agent, ai) => (
                    <div key={agent.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: 10, color: '#6b6b5e' }}>{agent.name.split(' ')[0]}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#0e0e0d' }}>{agent[metric]}</span>
                      </div>
                      <div style={{ height: 6, background: '#e8e2d6', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${((agent[metric] as number) / maxV) * 100}%`,
                          background: agent.name === topPerformer.name ? '#c9a96e' : '#1c4a35',
                          borderRadius: 3,
                        }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px dashed #c9a96e', marginTop: 4, paddingTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#c9a96e' }}>benchmark</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#c9a96e' }}>{avg.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leaderboard Semanal */}
      <div className="p-card" style={{ maxWidth: 420 }}>
        <SectionHeader title="Leaderboard Semanal" sub="GCI desta semana" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {LEADERBOARD_WEEKLY.map(entry => (
            <div key={entry.pos} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: entry.pos === 1 ? '#1c4a35' : entry.pos <= 3 ? '#f0ece3' : undefined,
              border: entry.pos > 3 ? '1px solid #e8e2d6' : undefined,
            }}>
              <div style={{
                fontFamily: "'Cormorant',serif",
                fontSize: 18,
                fontWeight: 700,
                color: entry.pos === 1 ? '#c9a96e' : '#6b6b5e',
                width: 24,
                textAlign: 'center',
              }}>
                {entry.emoji || `#${entry.pos}`}
              </div>
              <div style={{ flex: 1, fontFamily: "'Jost',sans-serif", fontSize: 13, fontWeight: entry.pos === 1 ? 700 : 400, color: entry.pos === 1 ? '#f4f0e6' : '#0e0e0d' }}>
                {entry.name}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: entry.pos === 1 ? '#c9a96e' : '#1c4a35' }}>
                {fmt(entry.gciSemana)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function PortalAnalytics() {
  const { crmContacts } = useCRMStore()
  const { deals } = useDealStore()

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [period, setPeriod] = useState<PeriodId>('ano')
  const [isExporting, setIsExporting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Derive real metrics from stores where available
  const realDealsCount = deals?.length ?? 0
  const realContactsCount = crmContacts?.length ?? 0

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      await exportToPDF('portal-analytics-root', 'AG_Analytics_Report.pdf')
    } finally {
      setIsExporting(false)
    }
  }, [])

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'pipeline',  label: 'Pipeline' },
    { id: 'mercado',   label: 'Mercado' },
    { id: 'equipa',    label: 'Equipa' },
  ]

  const PERIODS: { id: PeriodId; label: string }[] = [
    { id: 'mes',         label: 'Este Mês' },
    { id: 'trimestre',   label: 'Trimestre' },
    { id: 'ano',         label: 'Este Ano' },
    { id: 'personalizado', label: 'Personalizado' },
  ]

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .p-card {
          background: #fff;
          border: 1px solid #e8e2d6;
          border-radius: 10px;
          padding: 20px;
        }
        .p-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid #1c4a35;
          background: #1c4a35;
          color: #f4f0e6;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .p-btn:hover { opacity: 0.85; }
        .p-btn-gold {
          background: #c9a96e;
          border-color: #c9a96e;
          color: #0e0e0d;
        }
        .p-sel {
          padding: 7px 12px;
          border-radius: 6px;
          border: 1px solid #e8e2d6;
          background: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #0e0e0d;
          cursor: pointer;
          outline: none;
        }
        .p-sel:focus { border-color: #1c4a35; }
        .analytics-tab {
          padding: 8px 18px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 0.15s;
          color: #6b6b5e;
        }
        .analytics-tab:hover {
          background: #e8e2d6;
          color: #0e0e0d;
        }
        .analytics-tab.active {
          background: #1c4a35;
          color: #f4f0e6;
          border-color: #1c4a35;
        }
        .period-btn {
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid #e8e2d6;
          background: transparent;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.15s;
          color: #6b6b5e;
        }
        .period-btn.active {
          background: #c9a96e;
          border-color: #c9a96e;
          color: #0e0e0d;
          font-weight: 700;
        }
      `}</style>

      <div
        id="portal-analytics-root"
        style={{
          background: '#f4f0e6',
          minHeight: '100vh',
          padding: '28px 24px',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant',serif", fontSize: 32, fontWeight: 300, color: '#1c4a35', margin: 0, lineHeight: 1 }}>
              Business Intelligence
            </h1>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 13, color: '#6b6b5e', margin: '4px 0 0' }}>
              Agency Group · AMI 22506 · Dados actualizados em tempo real
              {realContactsCount > 0 && ` · ${realContactsCount} contactos · ${realDealsCount} deals no CRM`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid #e8e2d6', borderRadius: 24, padding: '4px 6px' }}>
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  className={`period-btn${period === p.id ? ' active' : ''}`}
                  onClick={() => setPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Export PDF */}
            <button
              className="p-btn p-btn-gold"
              onClick={handleExport}
              disabled={isExporting}
              style={{ opacity: isExporting ? 0.6 : 1 }}
            >
              {isExporting ? '⏳ A exportar...' : '↓ Exportar PDF'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`analytics-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ maxWidth: 1280 }}>
          {activeTab === 'overview' && <TabOverview />}
          {activeTab === 'pipeline' && <TabPipeline />}
          {activeTab === 'mercado'  && <TabMercado />}
          {activeTab === 'equipa'   && <TabEquipa />}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e8e2d6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#a09e96', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Agency Group · Comissão 5% · AMI 22506 · Portugal + Espanha + Madeira + Açores
          </span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#a09e96' }}>
            {new Date().toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>
    </>
  )
}
