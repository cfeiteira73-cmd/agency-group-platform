'use client'
import { useState } from 'react'
import { exportToPDF } from '../utils/export'
import { useDealStore } from '../stores/dealStore'
import { useUIStore } from '../stores/uiStore'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommResult {
  forecast?: Record<string, string>
  insights?: string[]
  recommendations?: string[]
  [key: string]: unknown
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_PCT_C: Record<string, number> = {
  'Angariação': 0.10,
  'Proposta Enviada': 0.20,
  'Proposta Aceite': 0.35,
  'Due Diligence': 0.50,
  'CPCV Assinado': 0.70,
  'Financiamento': 0.80,
  'Escritura Marcada': 0.90,
  'Escritura Concluída': 1.00,
}

// Average days per stage to reach close (used for monthly forecast)
const STAGE_DAYS_TO_CLOSE: Record<string, number> = {
  'Angariação': 210,
  'Proposta Enviada': 150,
  'Proposta Aceite': 90,
  'Due Diligence': 60,
  'CPCV Assinado': 45,
  'Financiamento': 30,
  'Escritura Marcada': 14,
  'Escritura Concluída': 0,
}

// ─── SVG Waterfall Chart ──────────────────────────────────────────────────────

interface WaterfallStep {
  label: string
  value: number
  type: 'income' | 'deduction' | 'split'
}

function WaterfallChart({ steps, darkMode = false }: { steps: WaterfallStep[]; darkMode?: boolean }) {
  const W = 600
  const H = 160
  const padL = 10
  const padR = 10
  const padT = 16
  const padB = 36

  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = Math.floor(chartW / steps.length) - 8

  const maxVal = Math.max(...steps.map(s => s.value), 1)

  const COLOR: Record<WaterfallStep['type'], string> = {
    income: '#1c4a35',
    deduction: '#e05454',
    split: '#c9a96e',
  }

  const fmt = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${Math.round(v)}`

  return (
    <div style={{ background: darkMode ? '#0f1e16' : '#fff', border: `1px solid ${darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}`, padding: '20px', marginBottom: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: darkMode ? 'rgba(240,237,228,.38)' : 'rgba(14,14,13,.35)', marginBottom: '14px' }}>
        Fluxo de Comissão — Waterfall
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-label="Gráfico waterfall do fluxo de comissões"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Horizontal base line */}
        <line
          x1={padL}
          y1={padT + chartH}
          x2={W - padR}
          y2={padT + chartH}
          stroke={darkMode ? 'rgba(240,237,228,.12)' : 'rgba(14,14,13,.12)'}
          strokeWidth={1}
        />
        {steps.map((step, i) => {
          const slotW = chartW / steps.length
          const cx = padL + i * slotW + slotW / 2
          const barH = Math.max(4, (step.value / maxVal) * chartH)
          const barX = cx - barW / 2
          const barY = padT + chartH - barH
          const color = COLOR[step.type]
          const isDeduction = step.type === 'deduction'

          return (
            <g key={step.label}>
              {/* Connector line from previous bar */}
              {i > 0 && (
                <line
                  x1={padL + (i - 1) * slotW + slotW / 2 + barW / 2}
                  y1={padT + chartH - Math.max(4, (steps[i - 1].value / maxVal) * chartH)}
                  x2={barX}
                  y2={padT + chartH - barH}
                  stroke={darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              )}
              {/* Bar */}
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={barH}
                fill={color}
                opacity={isDeduction ? 0.85 : 0.9}
                rx={2}
              />
              {/* Top value label */}
              <text
                x={cx}
                y={barY - 5}
                textAnchor="middle"
                fontFamily="'DM Mono',monospace"
                fontSize={9}
                fill={color}
                fontWeight="bold"
              >
                {fmt(step.value)}
              </text>
              {/* Bottom label */}
              <text
                x={cx}
                y={padT + chartH + 14}
                textAnchor="middle"
                fontFamily="'DM Mono',monospace"
                fontSize={8}
                fill={darkMode ? 'rgba(240,237,228,.45)' : 'rgba(14,14,13,.45)'}
              >
                {step.label.length > 12 ? step.label.slice(0, 11) + '…' : step.label}
              </text>
              {/* Arrow indicator for deductions */}
              {isDeduction && (
                <text
                  x={cx}
                  y={barY + barH / 2 + 4}
                  textAnchor="middle"
                  fontFamily="'DM Mono',monospace"
                  fontSize={10}
                  fill={darkMode ? '#0f1e16' : '#fff'}
                  opacity={0.85}
                >
                  ▼
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
        {[
          { color: '#1c4a35', label: 'Receita' },
          { color: '#e05454', label: 'Dedução' },
          { color: '#c9a96e', label: 'Divisão' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2 }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.45)' : 'rgba(14,14,13,.45)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SVG Monthly Forecast Chart ───────────────────────────────────────────────

interface MonthForecast {
  month: string
  low: number
  mid: number
  high: number
}

function MonthlyForecastChart({ forecasts, darkMode = false }: { forecasts: MonthForecast[]; darkMode?: boolean }) {
  if (forecasts.length === 0) return null

  const W = 560
  const H = 140
  const padL = 56
  const padR = 16
  const padT = 16
  const padB = 32
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const maxVal = Math.max(...forecasts.map(f => f.high), 1)
  const slotW = chartW / forecasts.length
  const barGroupW = slotW * 0.7
  const barW = barGroupW / 3

  const toX = (i: number, sub: number) => padL + i * slotW + (slotW - barGroupW) / 2 + sub * barW
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH
  const toH = (v: number) => Math.max(2, (v / maxVal) * chartH)

  const fmt = (v: number) => `€${(v / 1000).toFixed(0)}k`

  const yTicks = [0, 0.5, 1].map(f => ({ val: maxVal * f, y: padT + chartH - f * chartH }))

  return (
    <div style={{ background: darkMode ? '#0f1e16' : '#fff', border: `1px solid ${darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}`, padding: '20px', marginBottom: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: darkMode ? 'rgba(240,237,228,.38)' : 'rgba(14,14,13,.35)' }}>
          Previsão Mensal — Próximos 3 Meses
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { color: 'rgba(28,74,53,.25)', label: 'Pessimista' },
            { color: '#1c4a35', label: 'Médio' },
            { color: '#c9a96e', label: 'Optimista' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: 8, height: 8, background: l.color, borderRadius: 1 }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-label="Gráfico de previsão de comissões para os próximos 3 meses"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Y grid */}
        {yTicks.map(t => (
          <g key={t.val}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke={darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.06)'} strokeWidth={1} />
            <text
              x={padL - 6}
              y={t.y + 4}
              textAnchor="end"
              fontFamily="'DM Mono',monospace"
              fontSize={9}
              fill={darkMode ? 'rgba(240,237,228,.32)' : 'rgba(14,14,13,.3)'}
            >
              {fmt(t.val)}
            </text>
          </g>
        ))}
        {/* Base */}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={darkMode ? 'rgba(240,237,228,.12)' : 'rgba(14,14,13,.12)'} strokeWidth={1} />

        {forecasts.map((f, i) => (
          <g key={f.month}>
            {/* Low bar */}
            <rect
              x={toX(i, 0)}
              y={toY(f.low)}
              width={barW - 2}
              height={toH(f.low)}
              fill="rgba(28,74,53,.25)"
              rx={2}
            />
            {/* Mid bar */}
            <rect
              x={toX(i, 1)}
              y={toY(f.mid)}
              width={barW - 2}
              height={toH(f.mid)}
              fill="#1c4a35"
              rx={2}
            />
            {/* High bar */}
            <rect
              x={toX(i, 2)}
              y={toY(f.high)}
              width={barW - 2}
              height={toH(f.high)}
              fill="#c9a96e"
              rx={2}
            />
            {/* Mid value label */}
            <text
              x={toX(i, 1) + (barW - 2) / 2}
              y={toY(f.mid) - 5}
              textAnchor="middle"
              fontFamily="'DM Mono',monospace"
              fontSize={9}
              fill="#1c4a35"
              fontWeight="bold"
            >
              {fmt(f.mid)}
            </text>
            {/* Month label */}
            <text
              x={padL + i * slotW + slotW / 2}
              y={padT + chartH + 16}
              textAnchor="middle"
              fontFamily="'DM Mono',monospace"
              fontSize={9}
              fill={darkMode ? 'rgba(240,237,228,.50)' : 'rgba(14,14,13,.5)'}
            >
              {f.month}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.28)' : 'rgba(14,14,13,.25)', marginTop: '6px' }}>
        Estimativa baseada em fase do pipeline e prazo médio de fecho por etapa.
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PortalComissoes() {
  const deals = useDealStore(s => s.deals)
  const darkMode = useUIStore(s => s.darkMode)
  const [commResult, setCommResult] = useState<Record<string, unknown> | null>(null)
  const [commLoading, setCommLoading] = useState(false)

  const parseValor = (v: string | number | null | undefined): number => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v
    if (!v) return 0
    const clean = String(v).trim().replace(/[€$£\s\u00A0]/g, '')
    if (!clean) return 0
    const hasComma = clean.includes(',')
    const dotCount = (clean.match(/\./g) || []).length
    if (hasComma) return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
    if (dotCount > 1) return parseFloat(clean.replace(/\./g, '')) || 0
    if (dotCount === 1) {
      const parts = clean.split('.')
      if (parts[1] && parts[1].length === 3) return parseFloat(clean.replace('.', '')) || 0
      return parseFloat(clean) || 0
    }
    return parseFloat(clean) || 0
  }

  const pipelineWeighted = deals.reduce((s, d) => {
    const val = parseValor(d.valor)
    const pct = STAGE_PCT_C[d.fase] || 0
    return s + val * 0.05 * pct
  }, 0)

  const realized = deals
    .filter(d => d.fase === 'Escritura Concluída')
    .reduce((s, d) => s + parseValor(d.valor) * 0.05, 0)

  const irsWithholding = pipelineWeighted * 0.25
  const netExpected = pipelineWeighted * 0.75
  const cpcvExpected = pipelineWeighted * 0.5
  const escrituraExpected = pipelineWeighted * 0.5

  const fmt2 = (n: number) => `€${Math.round(n).toLocaleString('pt-PT')}`

  const byStage = Object.entries(STAGE_PCT_C).map(([stage, pct]) => {
    const stageDeals = deals.filter(d => d.fase === stage)
    const stageVal = stageDeals.reduce((s, d) => s + parseValor(d.valor), 0)
    const stageComm = stageVal * 0.05 * pct
    return { stage, deals: stageDeals.length, value: stageVal, commission: stageComm, probability: pct }
  }).filter(s => s.deals > 0)

  const topDeal = deals.reduce((best, d) => {
    const v = parseValor(d.valor) * 0.05
    return v > best.v ? { d, v } : best
  }, { d: deals[0], v: 0 })

  // ─── Waterfall steps ────────────────────────────────────────────────────────
  const waterfallSteps: { label: string; value: number; type: 'income' | 'deduction' | 'split' }[] = [
    { label: 'Comissão Bruta', value: pipelineWeighted, type: 'income' },
    { label: 'IRS Retido', value: irsWithholding, type: 'deduction' },
    { label: 'Comissão Líquida', value: netExpected, type: 'income' },
    { label: 'CPCV 50%', value: cpcvExpected * 0.75, type: 'split' },
    { label: 'Escritura 50%', value: escrituraExpected * 0.75, type: 'split' },
  ]

  // ─── Monthly forecast ──────────────────────────────────────────────────────
  const monthlyForecasts: { month: string; low: number; mid: number; high: number }[] = (() => {
    const now = new Date(2026, 3, 5) // current date from context
    return [1, 2, 3].map(offset => {
      const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const monthName = target.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
      const daysAway = offset * 30

      let midComm = 0
      for (const d of deals) {
        if (d.fase === 'Escritura Concluída') continue
        const daysToClose = STAGE_DAYS_TO_CLOSE[d.fase] ?? 210
        const val = parseValor(d.valor)
        const comm = val * 0.05 * 0.75 // net after IRS
        // Gaussian-style weight: peak if daysToClose ~ daysAway
        const diff = Math.abs(daysToClose - daysAway)
        const weight = Math.exp(-(diff * diff) / (2 * 30 * 30)) // sigma = 30 days
        midComm += comm * weight
      }

      return {
        month: monthName,
        low: midComm * 0.5,
        mid: midComm,
        high: midComm * 1.6,
      }
    })
  })()

  const handleAIAnalysis = async () => {
    setCommLoading(true)
    try {
      const res = await fetch('/api/deal/commission-pl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deals, period: '2026' }),
      })
      const d = await res.json()
      if (d.forecast) setCommResult(d)
    } finally { setCommLoading(false) }
  }

  const handleExportPDF = () => {
    const html = `
      <div class="label">Pipeline & Comissões — Agency Group 2026</div>
      <div class="row">
        <div class="card"><div class="label">Pipeline Ponderado</div><div class="metric">${fmt2(pipelineWeighted)}</div></div>
        <div class="card"><div class="label">Realizado</div><div class="metric green">${fmt2(realized)}</div></div>
        <div class="card"><div class="label">Líquido Esperado</div><div class="metric gold">${fmt2(netExpected)}</div></div>
        <div class="card"><div class="label">IRS Retido</div><div class="metric" style="color:#e05454">${fmt2(irsWithholding)}</div></div>
      </div>
      <hr class="divider">
      <table>
        <thead><tr><th>Deal</th><th>Valor</th><th>Fase</th><th>Comissão Bruta</th><th>Prob.</th><th>Comissão Ponderada</th></tr></thead>
        <tbody>${deals.map(d => {
      const v = parseValor(d.valor)
      const pct = STAGE_PCT_C[d.fase] || 0
      return `<tr><td>${d.imovel}</td><td>${fmt2(v)}</td><td>${d.fase}</td><td>${fmt2(v * 0.05)}</td><td>${Math.round(pct * 100)}%</td><td>${fmt2(v * 0.05 * pct)}</td></tr>`
    }).join('')}</tbody>
      </table>
    `
    exportToPDF('Comissões & P&L — Agency Group', html)
  }

  const cr = commResult as CommResult | null

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontWeight: 300, fontSize: '1.6rem', color: darkMode ? 'rgba(240,237,228,.88)' : '#0e0e0d', letterSpacing: '-.01em' }}>Comissões & P&L</div>
          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '4px' }}>5% Comissão · 50% CPCV + 50% Escritura · IRS 25% Retenção</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" className="p-btn" style={{ fontSize: '.52rem', padding: '8px 16px' }} onClick={handleAIAnalysis} disabled={commLoading}>
            {commLoading ? 'A analisar...' : '✦ Análise IA'}
          </button>
          <button type="button" className="p-btn p-btn-gold" style={{ fontSize: '.52rem', padding: '8px 16px' }} onClick={handleExportPDF}>
            ⬇ Exportar PDF
          </button>
        </div>
      </div>

      {/* Main KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Pipeline Ponderado', value: fmt2(pipelineWeighted), sub: 'Por probabilidade de fase', bg: '#0c1f15', textColor: '#c9a96e' },
          { label: 'Realizado', value: fmt2(realized), sub: 'Escrituras concluídas', bg: 'rgba(28,74,53,.06)', textColor: '#1c4a35' },
          { label: 'Comissão Líquida', value: fmt2(netExpected), sub: 'Após IRS 25% retido', bg: 'rgba(74,156,122,.06)', textColor: '#4a9c7a' },
          { label: 'IRS Retenção', value: fmt2(irsWithholding), sub: '25% retido na fonte', bg: 'rgba(224,84,84,.05)', textColor: '#e05454' },
        ].map(k => (
          <div key={k.label} style={{ padding: '20px 22px', background: k.bg === '#0c1f15' ? '#0c1f15' : (darkMode ? '#0f1e16' : '#fff'), border: `1px solid ${k.bg === '#0c1f15' ? '#0c1f15' : (darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)')}`, position: 'relative', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: k.bg === '#0c1f15' ? 'rgba(244,240,230,.4)' : (darkMode ? 'rgba(240,237,228,.38)' : 'rgba(14,14,13,.35)'), letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.7rem', fontWeight: 600, color: k.textColor, lineHeight: 1, marginBottom: '4px' }}>{k.value}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: k.bg === '#0c1f15' ? 'rgba(244,240,230,.3)' : (darkMode ? 'rgba(240,237,228,.32)' : 'rgba(14,14,13,.3)') }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* CPCV vs Escritura split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', background: 'rgba(201,169,110,.06)', border: '1px solid rgba(201,169,110,.2)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Comissão CPCV (50%)</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 600, color: '#c9a96e' }}>{fmt2(cpcvExpected)}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.32)' : 'rgba(14,14,13,.3)', marginTop: '3px' }}>Recebível no CPCV</div>
        </div>
        <div style={{ padding: '16px 20px', background: 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.15)', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Comissão Escritura (50%)</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', fontWeight: 600, color: '#1c4a35' }}>{fmt2(escrituraExpected)}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.32)' : 'rgba(14,14,13,.3)', marginTop: '3px' }}>Recebível na Escritura</div>
        </div>
        <div style={{ padding: '16px 20px', background: darkMode ? 'rgba(240,237,228,.04)' : 'rgba(14,14,13,.03)', border: `1px solid ${darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}`, borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>Top Deal</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 600, color: darkMode ? 'rgba(240,237,228,.88)' : '#0e0e0d', lineHeight: 1.3 }}>{topDeal.d?.imovel?.split('·')[0]?.trim() || '—'}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', marginTop: '4px' }}>{fmt2(topDeal.v)}</div>
        </div>
      </div>

      {/* Waterfall Chart */}
      <WaterfallChart steps={waterfallSteps} darkMode={darkMode} />

      {/* Pipeline visual bars */}
      <div style={{ background: darkMode ? '#0f1e16' : '#fff', border: `1px solid ${darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}`, padding: '20px', marginBottom: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: darkMode ? 'rgba(240,237,228,.38)' : 'rgba(14,14,13,.35)', marginBottom: '16px' }}>Comissão por Fase do Pipeline</div>
        {byStage.map(s => (
          <div key={s.stage} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: darkMode ? 'rgba(240,237,228,.88)' : '#0e0e0d' }}>{s.stage}</span>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)' }}>{s.deals} deal{s.deals !== 1 ? 's' : ''} · {fmt2(s.value)}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', fontWeight: 600, color: '#1c4a35', minWidth: '70px', textAlign: 'right' }}>{fmt2(s.commission)}</span>
              </div>
            </div>
            <div style={{ height: '6px', background: darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.06)' }}>
              <div style={{ height: '100%', width: `${Math.min(100, s.probability * 100)}%`, background: 'linear-gradient(90deg,#1c4a35,#4a9c7a)', transition: 'width .8s ease' }} />
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.32)' : 'rgba(14,14,13,.3)', marginTop: '2px' }}>Probabilidade: {Math.round(s.probability * 100)}%</div>
          </div>
        ))}
      </div>

      {/* Monthly Forecast */}
      <MonthlyForecastChart forecasts={monthlyForecasts} darkMode={darkMode} />

      {/* AI Analysis */}
      {cr && (
        <div style={{ background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.15)', padding: '20px', marginBottom: '20px', animation: 'fadeIn .3s ease', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '14px' }}>✦ Análise IA — Previsão de Comissões</div>
          {cr.forecast && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '14px' }}>
              {[['3 Meses', '3months'], ['6 Meses', '6months'], ['12 Meses', '12months']].map(([label, key]) => (
                <div key={key} style={{ padding: '12px 14px', background: darkMode ? '#0f1e16' : '#fff', border: '1px solid rgba(28,74,53,.1)', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px' }}>Previsão {label}</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: '#1c4a35', lineHeight: 1.5 }}>{(cr.forecast as Record<string, string>)[key]}</div>
                </div>
              ))}
            </div>
          )}
          {cr.insights?.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ color: '#c9a96e', flexShrink: 0 }}>▸</span>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: darkMode ? 'rgba(240,237,228,.72)' : 'rgba(14,14,13,.7)', lineHeight: 1.6 }}>{ins}</span>
            </div>
          ))}
        </div>
      )}

      {/* Deal-by-deal table */}
      <div style={{ border: `1px solid ${darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}`, overflow: 'hidden', borderRadius: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', background: darkMode ? 'rgba(240,237,228,.04)' : 'rgba(14,14,13,.03)', borderBottom: `1px solid ${darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.08)'}`, padding: '10px 16px', gap: '8px' }}>
          {['Imóvel', 'Valor', 'Fase', 'Comissão Bruta', 'Prob.', 'Ponderado'].map(h => (
            <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.38)' : 'rgba(14,14,13,.35)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
          ))}
        </div>
        {deals.map((d, i) => {
          const v = parseValor(d.valor)
          const comm = v * 0.05
          const pct = STAGE_PCT_C[d.fase] || 0
          const ponderado = comm * pct
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', gap: '8px', alignItems: 'center', borderBottom: `1px solid ${darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.04)'}`, background: darkMode ? (i % 2 === 0 ? '#0f1e16' : 'rgba(240,237,228,.02)') : (i % 2 === 0 ? '#fff' : 'rgba(14,14,13,.01)') }}>
              <div style={{ fontSize: '.85rem', fontWeight: 500, color: darkMode ? 'rgba(240,237,228,.88)' : '#0e0e0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.imovel}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.62)' : 'rgba(14,14,13,.6)' }}>{fmt2(v)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', padding: '2px 6px', background: 'rgba(28,74,53,.07)', color: '#1c4a35', border: '1px solid rgba(28,74,53,.15)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderRadius: '4px' }}>{d.fase}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.62)' : 'rgba(14,14,13,.6)' }}>{fmt2(comm)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', fontWeight: 600 }}>{Math.round(pct * 100)}%</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', fontWeight: 600 }}>{fmt2(ponderado)}</div>
            </div>
          )
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 16px', gap: '8px', background: 'rgba(28,74,53,.04)', borderTop: '2px solid rgba(28,74,53,.15)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#1c4a35', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', gridColumn: '1/5' }}>TOTAL PIPELINE</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(240,237,228,.42)' : 'rgba(14,14,13,.4)' }}></div>
          <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', fontWeight: 700, color: '#1c4a35' }}>{fmt2(pipelineWeighted)}</div>
        </div>
      </div>
    </div>
  )
}
