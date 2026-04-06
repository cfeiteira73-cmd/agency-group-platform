'use client'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { PIPELINE_STAGES, STAGE_PCT, STAGE_COLOR, CHECKLISTS } from './constants'
import type { Deal } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalPipelineProps {
  onToggleCheck: (dealId: number, fase: string, idx: number) => void
  onChangeFase: (dealId: number, fase: string) => void
  onAddDeal: () => void
  onDealRisk: (dealId: number) => Promise<void>
  onDealNego: (dealId: number) => Promise<void>
  exportToPDF: (title: string, html: string) => void
}

type DealWithMeta = Deal & { createdAt?: string }
type DocStatus = 'obtido' | 'em_falta' | 'nao_aplicavel'
type DealTabId = 'checklist' | 'investor' | 'dealroom' | 'timeline' | 'nego' | 'documentos'

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMISSION_RATE = 0.05
const STALE_DAYS = 14

const STAGE_PROB: Record<string, number> = {
  'Angariação': 0.10,
  'Proposta Enviada': 0.20,
  'Proposta Aceite': 0.40,
  'Due Diligence': 0.55,
  'CPCV Assinado': 0.75,
  'Financiamento': 0.85,
  'Escritura Marcada': 0.95,
  'Escritura Concluída': 1.00,
}

const KANBAN_STAGES = [
  'Angariação',
  'Proposta Enviada',
  'Proposta Aceite',
  'Due Diligence',
  'CPCV Assinado',
  'Escritura Marcada',
]

const DOCS_BY_PHASE: Record<string, string[]> = {
  'Angariação': ['BI/Passaporte vendedor', 'Caderneta Predial', 'Certidão Predial', 'Planta do Imóvel', 'Licença de Habitação', 'Certificado Energético'],
  'Proposta Enviada': ['BI/Passaporte comprador', 'NIF comprador', 'Prova de Fundos', 'Carta de Oferta'],
  'Due Diligence': ['Relatório Técnico Vistoria', 'Declaração Débitos IMI', 'Certidão sem Ónus', 'Licença de Obras (se remodelado)'],
  'CPCV Assinado': ['CPCV Assinado', 'Recibo de Sinal', 'Procuração (se aplicável)'],
  'Financiamento': ['Aprovação Bancária', 'Avaliação Bancária', 'Seguro Multirriscos'],
  'Escritura Marcada': ['Comprovativo IMT Pago', 'Comprovativo IS Pago', 'Documentos Notariais'],
  'Escritura Concluída': ['Escritura Assinada', 'Registo Predial Atualizado', 'Recibo de Comissão'],
}

const TIPO_OPTIONS = ['Apartamento', 'Moradia', 'Villa', 'Penthouse', 'Comercial'] as const

// ─── Health Score Algorithm ────────────────────────────────────────────────────

type IssueSeverity = 'red' | 'amber' | 'green' | 'blue'
interface HealthIssue { label: string; severity: IssueSeverity }

function dealHealthScore(deal: DealWithMeta): { score: number; issues: string[]; badges: HealthIssue[] } {
  let score = 100
  const issues: string[] = []
  const badges: HealthIssue[] = []
  const daysSinceCreated = (Date.now() - new Date(deal.createdAt || Date.now()).getTime()) / 86400000
  const now = new Date()
  const createdDate = new Date(deal.createdAt || Date.now())
  const isNewThisMonth = (now.getFullYear() === createdDate.getFullYear() && now.getMonth() === createdDate.getMonth())

  if (isNewThisMonth) { badges.push({ label: 'Novo este mês', severity: 'blue' }) }

  if (daysSinceCreated > 90) { score -= 20; issues.push('Deal aberto há 90+ dias') }
  if (!deal.comprador) { score -= 15; issues.push('Comprador não identificado') }
  const val = parseDealValue(deal.valor)
  if (!deal.valor || val === 0) { score -= 20; issues.push('Valor não definido') }
  if (!deal.cpcvDate && (STAGE_PCT[deal.fase] ?? 0) >= 70) {
    score -= 10; issues.push('Data CPCV em falta')
    badges.push({ label: 'Docs em falta', severity: 'amber' })
  }
  if (daysSinceCreated > 30 && (deal.fase ?? '') === 'Angariação') {
    score -= 15; issues.push('30+ dias sem avançar de Angariação')
    badges.push({ label: 'Em negociação 30d+', severity: 'red' })
  }
  if (daysSinceCreated > STALE_DAYS) {
    score -= 10; issues.push(`Parado há ${Math.floor(daysSinceCreated)}d`)
    badges.push({ label: `Sem contacto ${Math.floor(daysSinceCreated)}d`, severity: 'red' })
  }
  // Proposta expirada — if in Proposta Enviada for > 14 days
  if (deal.fase === 'Proposta Enviada' && daysSinceCreated > 14) {
    score -= 8; issues.push('Proposta pode ter expirado')
    badges.push({ label: 'Proposta expirada', severity: 'amber' })
  }
  // Escritura próxima
  if (deal.escrituraDate) {
    const daysToEscritura = (new Date(deal.escrituraDate).getTime() - Date.now()) / 86400000
    if (daysToEscritura >= 0 && daysToEscritura <= 14) {
      badges.push({ label: 'Escritura próxima', severity: 'green' })
    }
  }

  return { score: Math.max(0, score), issues, badges }
}

function healthColor(score: number): string {
  if (score >= 75) return '#4a9c7a'
  if (score >= 45) return '#c9a96e'
  return '#dc2626'
}

function healthLabel(score: number): string {
  if (score >= 75) return 'Saudável'
  if (score >= 45) return 'Atenção'
  return 'Em Risco'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDealValue(valor: string | undefined | null): number {
  if (!valor) return 0
  return parseFloat(valor.replace(/[^0-9.]/g, '')) || 0
}

function dealDays(deal: DealWithMeta): number {
  return Math.ceil((Date.now() - new Date(deal.createdAt || Date.now()).getTime()) / 86400000)
}

function nextStage(fase: string): string | null {
  const idx = PIPELINE_STAGES.indexOf(fase)
  if (idx === -1 || idx >= PIPELINE_STAGES.length - 1) return null
  return PIPELINE_STAGES[idx + 1]
}

function fmtK(v: number): string {
  return v >= 1e6 ? `€${(v / 1e6).toFixed(2)}M` : `€${Math.round(v / 1000)}k`
}

// ─── SVG Gauge ────────────────────────────────────────────────────────────────

function GCIGauge({ pct, label, value, darkMode = false }: { pct: number; label: string; value: string; darkMode?: boolean }) {
  const r = 36
  const cx = 44
  const cy = 46
  const circumference = Math.PI * r
  const clamped = Math.min(Math.max(pct, 0), 1)
  const dash = circumference * clamped
  const gap = circumference - dash
  const color = clamped > 0.66 ? '#4a9c7a' : clamped > 0.33 ? '#c9a96e' : '#dc2626'

  return (
    <svg width="88" height="56" viewBox="0 0 88 56" aria-label={`${label}: ${value}`} style={{ overflow: 'visible' }}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.07)'} strokeWidth="7" strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ transition: 'stroke-dasharray .7s cubic-bezier(.4,0,.2,1), stroke .4s ease' }}
      />
      <text x={cx} y={cy - 10} textAnchor="middle" style={{ fontFamily: "'Cormorant',serif", fontSize: '12px', fill: color, fontWeight: 600 }}>{value}</text>
      <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '5.5px', fill: darkMode ? 'rgba(240,237,228,.45)' : 'rgba(14,14,13,.35)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</text>
    </svg>
  )
}

// ─── Activity Timeline Banner ─────────────────────────────────────────────────

interface PipelineMove {
  dealId: number
  dealRef: string
  dealName: string
  fromFase: string
  toFase: string
  at: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageBadge({ fase }: { fase: string }) {
  const color = STAGE_COLOR[fase] || '#888'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px',
      background: color + '18', border: `1px solid ${color}40`,
      color, fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
      letterSpacing: '.06em', borderRadius: '4px',
    }}>
      {fase}
    </span>
  )
}

function HealthBadge({ score }: { score: number }) {
  const color = healthColor(score)
  const label = healthLabel(score)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 7px',
      background: color + '14', border: `1px solid ${color}35`,
      borderRadius: '20px',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color, letterSpacing: '.04em' }}>{label} {score}%</span>
    </span>
  )
}

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  red: '#dc2626',
  amber: '#c9a96e',
  green: '#4a9c7a',
  blue: '#3a7bd5',
}

function DealHealthBadges({ badges }: { badges: HealthIssue[] }) {
  if (badges.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
      {badges.map((b, i) => {
        const col = SEVERITY_COLOR[b.severity]
        return (
          <span key={i} style={{
            fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
            color: col, background: col + '12', border: `1px solid ${col}30`,
            padding: '1px 6px', borderRadius: '2px',
          }}>
            {b.label}
          </span>
        )
      })}
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: '3px', background: 'rgba(14,14,13,.07)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .4s ease' }} />
    </div>
  )
}

// ─── Deal at Risk Alert Banner ────────────────────────────────────────────────

function AtRiskBanner({ deals, darkMode }: { deals: Deal[]; darkMode: boolean }) {
  const atRisk = deals.filter(d => {
    const days = Math.ceil((Date.now() - new Date((d as DealWithMeta).createdAt || Date.now()).getTime()) / 86400000)
    return days > STALE_DAYS && d.fase !== 'Escritura Concluída'
  })

  if (atRisk.length === 0) return null

  return (
    <div style={{
      marginBottom: '16px',
      padding: '10px 16px',
      background: 'rgba(220,38,38,.06)',
      border: '1px solid rgba(220,38,38,.2)',
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      borderRadius: '12px',
    }}>
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Alerta de risco">
          <path d="M8 1.5L1 13.5h14L8 1.5z" fill="rgba(220,38,38,.15)" stroke="#dc2626" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="7.25" y="6" width="1.5" height="4" rx=".5" fill="#dc2626" />
          <rect x="7.25" y="11" width="1.5" height="1.5" rx=".5" fill="#dc2626" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#dc2626', letterSpacing: '.06em', marginBottom: '4px' }}>
          {atRisk.length} DEAL{atRisk.length > 1 ? 'S' : ''} EM RISCO · PARADO{atRisk.length > 1 ? 'S' : ''} {STALE_DAYS}+ DIAS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {atRisk.map(d => {
            const days = Math.ceil((Date.now() - new Date((d as DealWithMeta).createdAt || Date.now()).getTime()) / 86400000)
            return (
              <span key={d.id} style={{
                padding: '2px 9px',
                background: 'rgba(220,38,38,.1)', border: '1px solid rgba(220,38,38,.25)',
                borderRadius: '2px',
                fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#dc2626',
              }}>
                {d.ref ?? '—'} · {d.fase ?? '—'} · {days}d
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Activity Timeline Banner ─────────────────────────────────────────────────

function ActivityTimelineBanner({ moves, darkMode }: { moves: PipelineMove[]; darkMode: boolean }) {
  if (moves.length === 0) return null

  return (
    <div style={{
      marginBottom: '16px',
      padding: '12px 16px',
      background: darkMode ? 'rgba(28,74,53,.1)' : 'rgba(28,74,53,.03)',
      border: '1px solid rgba(28,74,53,.1)',
      borderRadius: '12px',
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '10px' }}>
        Actividade Recente
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {moves.slice(0, 5).map((m, i) => {
          const fromColor = STAGE_COLOR[m.fromFase] || '#888'
          const toColor = STAGE_COLOR[m.toFase] || '#888'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', flexShrink: 0, width: '52px' }}>
                {m.at}
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.76rem', color: darkMode ? 'rgba(244,240,230,.7)' : 'rgba(14,14,13,.65)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.dealRef}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: fromColor, padding: '1px 5px', background: fromColor + '15', borderRadius: '2px' }}>{m.fromFase}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" aria-label="avançou para">
                  <path d="M0 4h9M6 1l3 3-3 3" stroke={darkMode ? 'rgba(240,237,228,.30)' : 'rgba(14,14,13,.3)'} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: toColor, padding: '1px 5px', background: toColor + '15', borderRadius: '2px' }}>{m.toFase}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── GCI Forecast Panel ───────────────────────────────────────────────────────

function GCIForecastPanel({ deals, darkMode }: { deals: Deal[]; darkMode: boolean }) {
  const pipelineWeighted = deals.reduce((sum, d) => {
    const val = parseDealValue(d.valor)
    const prob = STAGE_PROB[d.fase ?? ''] ?? 0.1
    const { score } = dealHealthScore(d as DealWithMeta)
    // Risk-adjust by health score
    const healthAdj = score / 100
    return sum + val * prob * healthAdj
  }, 0)

  const gciWeighted = pipelineWeighted * COMMISSION_RATE

  // 30d: Escritura × 0.9 + CPCV × 0.8 (per spec)
  const forecast30 = deals
    .filter(d => ['CPCV Assinado', 'Escritura Marcada', 'Financiamento'].includes(d.fase))
    .reduce((sum, d) => {
      const val = parseDealValue(d.valor)
      const prob = d.fase === 'Escritura Marcada' ? 0.9 : d.fase === 'CPCV Assinado' ? 0.8 : 0.65
      return sum + val * prob * COMMISSION_RATE
    }, 0)

  // 90d: all stages weighted by probability
  const forecast90 = deals
    .filter(d => (STAGE_PCT[d.fase ?? ''] ?? 0) >= 35)
    .reduce((sum, d) => sum + parseDealValue(d.valor) * (STAGE_PROB[d.fase ?? ''] ?? 0.1) * COMMISSION_RATE, 0)

  // Annual: extrapolate — weighted pipeline × 4 quarters
  const forecastAnnual = deals
    .reduce((sum, d) => sum + parseDealValue(d.valor) * (STAGE_PROB[d.fase ?? ''] ?? 0.1) * COMMISSION_RATE, 0) * 4

  const totalPipeline = deals.reduce((sum, d) => sum + parseDealValue(d.valor), 0)

  const stageDist = PIPELINE_STAGES.map(s => {
    const stageVal = deals.filter(d => (d.fase ?? '') === s).reduce((sum, d) => sum + parseDealValue(d.valor), 0)
    return { stage: s, pct: totalPipeline > 0 ? (stageVal / totalPipeline) * 100 : 0, color: STAGE_COLOR[s] || '#888' }
  }).filter(s => s.pct > 0)

  const bg = darkMode ? 'rgba(28,74,53,.12)' : 'rgba(28,74,53,.04)'
  const border = darkMode ? 'rgba(201,169,110,.12)' : 'rgba(28,74,53,.1)'

  // Max forecast to scale gauges
  const maxForecast = Math.max(forecast30, forecast90, gciWeighted, forecastAnnual, 1)

  return (
    <div style={{ marginBottom: '20px', padding: '18px 20px', background: bg, border: `1px solid ${border}`, borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.15em', textTransform: 'uppercase', color: '#c9a96e' }}>
          GCI Forecast · Comissão Prevista
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)' }}>
          AMI 22506 · 5% comissão
        </div>
      </div>

      {/* Gauge row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: '30 Dias', value: fmtK(forecast30), pct: forecast30 / maxForecast, sub: 'CPCV + Escritura' },
          { label: '90 Dias', value: fmtK(forecast90), pct: forecast90 / maxForecast, sub: 'Proposta Aceite+' },
          { label: 'GCI Ponderado', value: fmtK(gciWeighted), pct: gciWeighted / maxForecast, sub: 'Valor × Probabilidade', gold: true },
          { label: 'Anual (proj.)', value: fmtK(forecastAnnual), pct: forecastAnnual / maxForecast, sub: 'Ponderado × 4Q' },
        ].map(m => (
          <div key={m.label} style={{
            padding: '14px 12px',
            background: darkMode ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.65)',
            border: `1px solid ${m.gold ? 'rgba(201,169,110,.2)' : border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            borderRadius: '10px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
          }}>
            <GCIGauge pct={m.pct} label={m.label} value={m.value} darkMode={darkMode} />
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)', marginTop: '4px', textAlign: 'center' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline total bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>PIPELINE TOTAL</span>
          <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', fontWeight: 300 }}>{fmtK(totalPipeline)}</span>
        </div>
      </div>

      {/* Stage distribution */}
      {stageDist.length > 0 && (
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.3)', marginBottom: '6px', letterSpacing: '.06em' }}>DISTRIBUIÇÃO POR STAGE</div>
          <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '1px' }}>
            {stageDist.map(s => (
              <div key={s.stage} style={{ flex: s.pct, background: s.color, minWidth: '2px', transition: 'flex .5s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: '7px' }}>
            {stageDist.map(s => (
              <span key={s.stage} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                {s.stage} {s.pct.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  isActive,
  darkMode,
  onClick,
  onAdvance,
  compact = false,
  isDragTarget = false,
  justMoved = false,
}: {
  deal: DealWithMeta
  isActive: boolean
  darkMode: boolean
  onClick: () => void
  onAdvance?: () => void
  compact?: boolean
  isDragTarget?: boolean
  justMoved?: boolean
}) {
  const pct = STAGE_PCT[deal.fase ?? ''] ?? 10
  const color = STAGE_COLOR[deal.fase ?? ''] || '#888'
  const days = dealDays(deal)
  const isStale = days > STALE_DAYS
  const isVeryStale = days > 30
  const { score, badges } = dealHealthScore(deal)
  const ns = nextStage(deal.fase)
  const val = parseDealValue(deal.valor)
  const commission = val * COMMISSION_RATE
  const [glowing, setGlowing] = useState(false)

  useEffect(() => {
    if (justMoved) {
      setGlowing(true)
      const t = setTimeout(() => setGlowing(false), 900)
      return () => clearTimeout(t)
    }
  }, [justMoved])

  return (
    <div
      className={`deal-card${isActive ? ' active' : ''}`}
      onClick={onClick}
      style={{
        marginBottom: compact ? '0' : '8px',
        cursor: 'pointer',
        position: 'relative',
        outline: isDragTarget ? `2px dashed ${color}` : glowing ? '2px solid #4a9c7a' : 'none',
        outlineOffset: '2px',
        transition: 'outline .1s ease, box-shadow .15s ease',
        boxShadow: glowing ? '0 0 12px rgba(74,156,122,.35)' : isDragTarget ? `0 0 0 4px ${color}15` : 'none',
        animation: glowing ? 'deal-glow .9s ease-out' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', letterSpacing: '.06em' }}>{deal.ref ?? '—'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isStale && (
            <span style={{
              fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
              color: '#dc2626', background: '#dc262610',
              padding: '1px 5px', border: '1px solid #dc262628', borderRadius: '2px',
              animation: isVeryStale ? 'none' : 'none',
            }}>
              {days}d parado
            </span>
          )}
          <HealthBadge score={score} />
        </div>
      </div>

      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', fontWeight: 500, color: darkMode ? 'rgba(244,240,230,.85)' : '#0e0e0d', marginBottom: '3px', lineHeight: 1.3 }}>
        {deal.imovel ?? '—'}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.05rem', color: '#c9a96e', fontWeight: 300 }}>
          {deal.valor ?? '—'}
        </div>
        {commission > 0 && (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>
            GCI {fmtK(commission)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
        <StageBadge fase={deal.fase ?? '—'} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: isStale ? '#dc2626' : 'rgba(14,14,13,.28)' }}>
          {days}d
        </span>
      </div>

      <DealHealthBadges badges={badges} />

      {deal.comprador ? (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.38)', marginTop: '5px' }}>
          👤 {deal.comprador}
        </div>
      ) : null}

      <ProgressBar pct={pct} color={color} />

      {onAdvance && ns && (
        <button
          onClick={e => { e.stopPropagation(); onAdvance() }}
          style={{
            marginTop: '8px', width: '100%', padding: '5px 0',
            background: 'transparent', border: `1px solid ${color}50`,
            color, fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
            cursor: 'pointer', letterSpacing: '.06em',
            transition: 'background .15s ease',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = color + '14' }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent' }}
        >
          → {ns}
        </button>
      )}
    </div>
  )
}

// ─── Kanban View with Drag-and-Drop ───────────────────────────────────────────

function KanbanView({
  deals,
  activeDeal,
  darkMode,
  onSelectDeal,
  onChangeFase,
  onMoveLogged,
}: {
  deals: Deal[]
  activeDeal: number | null
  darkMode: boolean
  onSelectDeal: (id: number | null) => void
  onChangeFase: (dealId: number, fase: string) => void
  onMoveLogged: (move: PipelineMove) => void
}) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const dragCounter = useRef<Record<string, number>>({})
  const [justMovedId, setJustMovedId] = useState<number | null>(null)

  const headerBg = (stage: string) => {
    if (['Angariação', 'Proposta Enviada'].includes(stage)) return '#1c4a35'
    if (['Proposta Aceite', 'Due Diligence'].includes(stage)) return '#4a9c7a'
    if (['CPCV Assinado'].includes(stage)) return '#c9a96e'
    return '#1c4a35'
  }

  const handleDragStart = useCallback((e: React.DragEvent, dealId: number) => {
    setDraggingId(dealId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(dealId))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDragOverStage(null)
    dragCounter.current = {}
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault()
    dragCounter.current[stage] = (dragCounter.current[stage] || 0) + 1
    setDragOverStage(stage)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, stage: string) => {
    dragCounter.current[stage] = Math.max(0, (dragCounter.current[stage] || 1) - 1)
    if (dragCounter.current[stage] === 0) {
      setDragOverStage(prev => prev === stage ? null : prev)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, stage: string) => {
    e.preventDefault()
    const id = parseInt(e.dataTransfer.getData('text/plain'))
    if (!isNaN(id)) {
      const deal = deals.find(d => d.id === id)
      if (deal && deal.fase !== stage) {
        onMoveLogged({
          dealId: id,
          dealRef: deal.ref,
          dealName: deal.imovel,
          fromFase: deal.fase,
          toFase: stage,
          at: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        })
        onChangeFase(id, stage)
        setJustMovedId(id)
        setTimeout(() => setJustMovedId(null), 1000)
      }
    }
    setDraggingId(null)
    setDragOverStage(null)
    dragCounter.current = {}
  }, [deals, onChangeFase, onMoveLogged])

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', minWidth: `${KANBAN_STAGES.length * 220}px` }}>
        {KANBAN_STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.fase === stage)
          const stageTotal = stageDeals.reduce((sum, d) => sum + parseDealValue(d.valor), 0)
          const fmtTotal = stageTotal >= 1e6
            ? `€${(stageTotal / 1e6).toFixed(1)}M`
            : stageTotal > 0 ? `€${Math.round(stageTotal / 1000)}k` : '—'
          const isDropTarget = dragOverStage === stage && draggingId !== null
          const stageColor = STAGE_COLOR[stage] || '#888'

          return (
            <div
              key={stage}
              style={{ width: '210px', flexShrink: 0 }}
              onDragOver={handleDragOver}
              onDragEnter={e => handleDragEnter(e, stage)}
              onDragLeave={e => handleDragLeave(e, stage)}
              onDrop={e => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div style={{
                background: isDropTarget ? stageColor : headerBg(stage),
                padding: '10px 12px',
                marginBottom: '8px',
                transition: 'background .15s ease',
                outline: isDropTarget ? `2px dashed rgba(244,240,230,.6)` : 'none',
                outlineOffset: '-3px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.75)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    {stage}
                  </div>
                  <span style={{
                    background: 'rgba(244,240,230,.18)', color: '#f4f0e6',
                    fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                    padding: '1px 6px', borderRadius: '10px',
                  }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div style={{ fontFamily: "'Cormorant',serif", fontSize: '.92rem', color: '#f4f0e6', fontWeight: 300, opacity: .9 }}>
                  {fmtTotal}
                </div>
                {isDropTarget && (
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.7)', marginTop: '3px', letterSpacing: '.05em' }}>
                    ↓ solte aqui
                  </div>
                )}
              </div>

              {/* Cards drop area */}
              <div
                style={{
                  display: 'flex', flexDirection: 'column', gap: '7px',
                  minHeight: '80px',
                  padding: isDropTarget ? '6px' : '0',
                  background: isDropTarget ? `${stageColor}08` : 'transparent',
                  border: isDropTarget ? `1px dashed ${stageColor}40` : '1px solid transparent',
                  transition: 'background .15s ease, border .15s ease',
                  borderRadius: '2px',
                }}
              >
                {stageDeals.length === 0 && (
                  <div style={{
                    padding: '16px 12px',
                    border: `1px dashed ${isDropTarget ? stageColor + '50' : 'rgba(14,14,13,.12)'}`,
                    textAlign: 'center',
                    fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                    color: isDropTarget ? stageColor : 'rgba(14,14,13,.2)',
                    transition: 'border .15s, color .15s',
                  }}>
                    {isDropTarget ? '+ soltar aqui' : 'Sem deals'}
                  </div>
                )}
                {stageDeals.map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={e => handleDragStart(e, deal.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      opacity: draggingId === deal.id ? 0.45 : 1,
                      cursor: 'grab',
                      transition: 'opacity .15s ease',
                    }}
                  >
                    <DealCard
                      deal={deal as DealWithMeta}
                      isActive={activeDeal === deal.id}
                      darkMode={darkMode}
                      compact
                      isDragTarget={false}
                      justMoved={justMovedId === deal.id}
                      onClick={() => onSelectDeal(activeDeal === deal.id ? null : deal.id)}
                      onAdvance={() => {
                        const ns = nextStage(deal.fase)
                        if (ns) onChangeFase(deal.id, ns)
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: number
  date: string
  tipo: string
  nota: string
}

function TimelineTab({ deal, darkMode }: { deal: DealWithMeta; darkMode: boolean }) {
  const [events, setEvents] = useState<TimelineEvent[]>(() => {
    const base: TimelineEvent[] = []
    if (deal.createdAt) {
      base.push({ id: 1, date: deal.createdAt.slice(0, 10), tipo: 'Criado', nota: 'Deal criado no pipeline' })
    }
    if (deal.cpcvDate) {
      base.push({ id: 2, date: deal.cpcvDate, tipo: 'CPCV', nota: 'Data CPCV registada' })
    }
    if (deal.escrituraDate) {
      base.push({ id: 3, date: deal.escrituraDate, tipo: 'Escritura', nota: 'Data escritura registada' })
    }
    base.push({ id: 4, date: new Date().toISOString().slice(0, 10), tipo: 'Fase', nota: `Fase actual: ${deal.fase}` })
    return base.sort((a, b) => a.date.localeCompare(b.date))
  })

  const [newNote, setNewNote] = useState('')
  const [newTipo, setNewTipo] = useState<'Nota' | 'Reunião' | 'Proposta' | 'Alerta'>('Nota')

  const addNote = () => {
    if (!newNote.trim()) return
    setEvents(prev => [...prev, {
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      tipo: newTipo,
      nota: newNote.trim(),
    }].sort((a, b) => a.date.localeCompare(b.date)))
    setNewNote('')
  }

  const tipoColor: Record<string, string> = {
    'Criado': '#888',
    'CPCV': '#c9a96e',
    'Escritura': '#1c4a35',
    'Fase': '#4a9c7a',
    'Nota': '#3a7bd5',
    'Reunião': '#7c3aed',
    'Proposta': '#c9a96e',
    'Alerta': '#dc2626',
  }

  const tipoIcon: Record<string, string> = {
    'Criado': '✦',
    'CPCV': '📝',
    'Escritura': '🏛',
    'Fase': '→',
    'Nota': '💬',
    'Reunião': '📅',
    'Proposta': '📄',
    'Alerta': '⚠',
  }

  return (
    <div>
      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '1px', background: 'rgba(14,14,13,.1)' }} />
        {events.map(ev => {
          const color = tipoColor[ev.tipo] || '#888'
          return (
            <div key={ev.id} style={{ position: 'relative', marginBottom: '18px' }}>
              <div style={{
                position: 'absolute', left: '-20px', top: '3px',
                width: '9px', height: '9px', borderRadius: '50%',
                background: color, border: `2px solid ${darkMode ? '#122a1a' : '#f9f7f4'}`,
                boxShadow: `0 0 0 2px ${color}35`,
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color, background: color + '15', padding: '1px 5px', borderRadius: '2px' }}>
                  {tipoIcon[ev.tipo] || '·'} {ev.tipo}
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>{ev.date}</span>
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.78rem', color: darkMode ? 'rgba(244,240,230,.8)' : '#0e0e0d', lineHeight: 1.5 }}>
                {ev.nota}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '16px', borderTop: '1px solid rgba(14,14,13,.07)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          {(['Nota', 'Reunião', 'Proposta', 'Alerta'] as const).map(t => (
            <button key={t} onClick={() => setNewTipo(t)} style={{
              padding: '3px 9px',
              background: newTipo === t ? tipoColor[t] + '20' : 'transparent',
              border: `1px solid ${newTipo === t ? tipoColor[t] + '50' : 'rgba(14,14,13,.1)'}`,
              color: newTipo === t ? tipoColor[t] : 'rgba(14,14,13,.4)',
              fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', borderRadius: '2px',
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            className="p-inp"
            placeholder="Adicionar nota à timeline..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            style={{ flex: 1 }}
          />
          <button className="p-btn" onClick={addNote} style={{ flexShrink: 0 }}>Adicionar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Documentos Tab ───────────────────────────────────────────────────────────

function DocumentosTab({ deal, darkMode }: { deal: DealWithMeta; darkMode: boolean }) {
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({})

  const allDocs: { fase: string; doc: string }[] = []
  const currentStageIdx = PIPELINE_STAGES.indexOf(deal.fase)
  const relevantStages = PIPELINE_STAGES.slice(0, currentStageIdx + 1)

  relevantStages.forEach(s => {
    const docs = DOCS_BY_PHASE[s] || []
    docs.forEach(doc => allDocs.push({ fase: s, doc }))
  })

  const toggleStatus = (key: string) => {
    setDocStatus(prev => {
      const cur = prev[key] || 'em_falta'
      const next: DocStatus = cur === 'em_falta' ? 'obtido' : cur === 'obtido' ? 'nao_aplicavel' : 'em_falta'
      return { ...prev, [key]: next }
    })
  }

  const statusIcon: Record<DocStatus, string> = { obtido: '✅', em_falta: '⬜', nao_aplicavel: '➖' }
  const statusColor: Record<DocStatus, string> = {
    obtido: '#4a9c7a', em_falta: 'rgba(14,14,13,.3)', nao_aplicavel: 'rgba(14,14,13,.2)',
  }

  const grouped: Record<string, typeof allDocs> = {}
  allDocs.forEach(d => {
    if (!grouped[d.fase]) grouped[d.fase] = []
    grouped[d.fase].push(d)
  })

  const totalDocs = allDocs.length
  const obtidos = allDocs.filter(({ fase, doc }) => docStatus[`${fase}::${doc}`] === 'obtido').length
  const completionPct = totalDocs > 0 ? (obtidos / totalDocs) * 100 : 0

  return (
    <div>
      {/* Progress summary */}
      <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(28,74,53,.04)', border: '1px solid rgba(28,74,53,.08)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', letterSpacing: '.06em' }}>DOCUMENTAÇÃO COMPLETA</span>
          <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#1c4a35', fontWeight: 300 }}>{obtidos}/{totalDocs}</span>
        </div>
        <div style={{ height: '4px', background: 'rgba(14,14,13,.07)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completionPct}%`, background: completionPct >= 80 ? '#4a9c7a' : completionPct >= 50 ? '#c9a96e' : '#dc2626', transition: 'width .4s ease' }} />
        </div>
      </div>

      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)', marginBottom: '10px', letterSpacing: '.04em' }}>
        Clique para alternar: ⬜ Em falta → ✅ Obtido → ➖ N/A
      </div>
      {Object.entries(grouped).map(([fase, docs]) => (
        <div key={fase} style={{ marginBottom: '14px' }}>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em',
            textTransform: 'uppercase', color: fase === deal.fase ? '#c9a96e' : 'rgba(14,14,13,.3)',
            marginBottom: '6px',
          }}>
            {fase}
          </div>
          {docs.map(({ doc }) => {
            const key = `${fase}::${doc}`
            const status = docStatus[key] || 'em_falta'
            return (
              <div
                key={key}
                onClick={() => toggleStatus(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 10px', marginBottom: '4px', cursor: 'pointer',
                  background: status === 'obtido' ? 'rgba(74,156,122,.06)' : 'transparent',
                  border: `1px solid ${status === 'obtido' ? 'rgba(74,156,122,.2)' : 'rgba(14,14,13,.07)'}`,
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: '.75rem', flexShrink: 0 }}>{statusIcon[status]}</span>
                <span style={{
                  fontFamily: "'Jost',sans-serif", fontSize: '.78rem',
                  color: statusColor[status], flex: 1,
                  textDecoration: status === 'nao_aplicavel' ? 'line-through' : 'none',
                }}>
                  {doc}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Deal Detail Panel ────────────────────────────────────────────────────────

function DealDetailPanel({
  deal,
  darkMode,
  onChangeFase,
  onToggleCheck,
  onDealRisk,
  onDealNego,
  dealTab,
  setDealTab,
  dealRiskLoading,
  dealRiskAnalysis,
  dealNegoLoading,
  dealNego,
  investorData,
  setInvestorData,
  invScenario,
  setInvScenario,
  taxRegime,
  setTaxRegime,
  tipoImovelInv,
  setTipoImovelInv,
}: {
  deal: DealWithMeta
  darkMode: boolean
  onChangeFase: (dealId: number, fase: string) => void
  onToggleCheck: (dealId: number, fase: string, idx: number) => void
  onDealRisk: (dealId: number) => Promise<void>
  onDealNego: (dealId: number) => Promise<void>
  dealTab: DealTabId
  setDealTab: (t: DealTabId) => void
  dealRiskLoading: boolean
  dealRiskAnalysis: Record<string, unknown> | null
  dealNegoLoading: boolean
  dealNego: Record<string, unknown> | null
  investorData: { rendaMensal: string; apreciacao: string; horizonte: string; ltv: string; spread: string }
  setInvestorData: (d: Partial<typeof investorData>) => void
  invScenario: 'bear' | 'base' | 'bull'
  setInvScenario: (s: 'bear' | 'base' | 'bull') => void
  taxRegime: 'standard' | 'ifici'
  setTaxRegime: (r: 'standard' | 'ifici') => void
  tipoImovelInv: 'residencial' | 'comercial'
  setTipoImovelInv: (t: 'residencial' | 'comercial') => void
}) {
  const { score, issues } = dealHealthScore(deal)
  const days = dealDays(deal)
  const hColor = healthColor(score)
  const prob = STAGE_PROB[deal.fase ?? ''] ?? 0.1
  const val = parseDealValue(deal.valor)
  const expectedGCI = val * prob * COMMISSION_RATE

  const TABS = [
    { id: 'checklist', label: 'Checklist' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'investor', label: 'Investidor' },
    { id: 'nego', label: 'Negociação' },
  ] as const

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.4rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', fontWeight: 300, marginBottom: '4px', lineHeight: 1.2 }}>
          {deal.imovel ?? '—'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{ fontFamily: "'Cormorant',serif", fontSize: '1.1rem', color: '#c9a96e', fontWeight: 300 }}>{deal.valor}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>·</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>{deal.ref}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>·</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)' }}>{days}d no pipeline</span>
          {expectedGCI > 0 && (
            <>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.3)' }}>·</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e' }}>GCI esperado {fmtK(expectedGCI)}</span>
            </>
          )}
        </div>

        {/* Health score bar */}
        <div style={{
          padding: '10px 14px',
          background: `${hColor}08`,
          border: `1px solid ${hColor}25`,
          display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap',
        }}>
          <div style={{ flexShrink: 0 }}>
            {/* Mini health gauge */}
            <svg width="52" height="34" viewBox="0 0 52 34" aria-label={`Health score: ${score}%`} style={{ overflow: 'visible' }}>
              <path d={`M 6 30 A 20 20 0 0 1 46 30`} fill="none" stroke={darkMode ? 'rgba(240,237,228,.08)' : 'rgba(14,14,13,.07)'} strokeWidth="5" strokeLinecap="round" />
              <path
                d={`M 6 30 A 20 20 0 0 1 46 30`}
                fill="none" stroke={hColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${Math.PI * 20 * score / 100} ${Math.PI * 20 * (1 - score / 100)}`}
                style={{ transition: 'stroke-dasharray .6s ease' }}
              />
              <text x="26" y="24" textAnchor="middle" style={{ fontFamily: "'DM Mono',monospace", fontSize: '8px', fill: hColor, fontWeight: 700 }}>{score}</text>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: hColor, fontWeight: 'bold', marginBottom: '4px' }}>
              Deal Health: {healthLabel(score)}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {issues.map(issue => (
                <span key={issue} style={{
                  fontFamily: "'DM Mono',monospace", fontSize: '.52rem',
                  color: 'rgba(14,14,13,.45)', background: 'rgba(14,14,13,.05)',
                  padding: '1px 6px', borderRadius: '2px',
                }}>
                  {issue}
                </span>
              ))}
              {issues.length === 0 && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#4a9c7a' }}>Nenhum problema identificado</span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.35)', marginBottom: '2px' }}>Prob. fecho</div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: hColor }}>{Math.round(prob * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Phase selector */}
      <div style={{ marginBottom: '14px' }}>
        <label className="p-label">Fase do Negócio</label>
        <select className="p-sel" value={deal.fase} onChange={e => onChangeFase(deal.id, e.target.value)}>
          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(14,14,13,.1)', marginBottom: '16px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`deal-tab${dealTab === t.id ? ' active' : ''}`}
            onClick={() => setDealTab(t.id as DealTabId)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Checklist */}
      {dealTab === 'checklist' && (
        <div>
          {Object.entries(deal.checklist ?? {}).map(([fase, items]) => {
            const doneCount = (items as boolean[]).filter(Boolean).length
            const total = (CHECKLISTS[fase] || []).length
            return (
              <div key={fase} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: fase === deal.fase ? '#c9a96e' : 'rgba(14,14,13,.3)' }}>{fase}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: doneCount === total ? '#4a9c7a' : 'rgba(14,14,13,.35)' }}>{doneCount}/{total}</div>
                </div>
                {(CHECKLISTS[fase] || []).map((item: string, idx: number) => (
                  <div key={idx} className={`check-item${(items as boolean[])[idx] ? ' done' : ''}`} onClick={() => onToggleCheck(deal.id, fase, idx)}>
                    <div style={{ width: '16px', height: '16px', border: `1.5px solid ${(items as boolean[])[idx] ? '#1c4a35' : 'rgba(14,14,13,.2)'}`, background: (items as boolean[])[idx] ? '#1c4a35' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s, border .15s' }}>
                      {(items as boolean[])[idx] && (
                        <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" width="8" height="8" aria-label="concluído">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Documentos */}
      {dealTab === 'documentos' && <DocumentosTab deal={deal} darkMode={darkMode} />}

      {/* Timeline */}
      {dealTab === 'timeline' && <TimelineTab deal={deal} darkMode={darkMode} />}

      {/* Negociação */}
      {dealTab === 'nego' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button className="p-btn" onClick={() => onDealRisk(deal.id)} disabled={dealRiskLoading}>
              {dealRiskLoading ? '✦ A analisar...' : '🔍 Análise de Risco'}
            </button>
            <button className="p-btn p-btn-gold" onClick={() => onDealNego(deal.id)} disabled={dealNegoLoading}>
              {dealNegoLoading ? '✦ A preparar...' : '⚡ Estratégia Negociação'}
            </button>
          </div>
          {dealRiskAnalysis && (
            <div className="p-card" style={{ marginBottom: '12px' }}>
              <div className="p-label" style={{ marginBottom: '8px' }}>Análise de Risco</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                {String(dealRiskAnalysis.summary || '')}
              </div>
            </div>
          )}
          {dealNego && (
            <div className="p-card">
              <div className="p-label" style={{ marginBottom: '8px' }}>Estratégia de Negociação</div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', lineHeight: 1.7, color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.75)' }}>
                {String(dealNego.estrategia || '')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Investor */}
      {dealTab === 'investor' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label className="p-label">Renda Mensal (€)</label>
              <input className="p-inp" type="number" value={investorData.rendaMensal} onChange={e => setInvestorData({ rendaMensal: e.target.value })} placeholder="ex: 3500" />
            </div>
            <div>
              <label className="p-label">Apreciação Anual (%)</label>
              <input className="p-inp" type="number" value={investorData.apreciacao} onChange={e => setInvestorData({ apreciacao: e.target.value })} />
            </div>
            <div>
              <label className="p-label">Horizonte (anos)</label>
              <select className="p-sel" value={investorData.horizonte} onChange={e => setInvestorData({ horizonte: e.target.value })}>
                {['5', '10', '15', '20'].map(h => <option key={h} value={h}>{h} anos</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {(['bear', 'base', 'bull'] as const).map(s => (
              <div key={s} className={`inv-scenario${invScenario === s ? ' best' : ''}`} onClick={() => setInvScenario(s)} style={{ cursor: 'pointer' }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: s === 'bull' ? '#4a9c7a' : s === 'bear' ? '#dc2626' : '#c9a96e', textTransform: 'uppercase', letterSpacing: '.08em' }}>{s}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', marginTop: '2px' }}>{s === 'bull' ? '+4% anual' : s === 'base' ? '+2.5% anual' : '+0.5% anual'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['standard', 'ifici'] as const).map(r => (
              <button key={r} style={{ padding: '6px 14px', background: taxRegime === r ? '#1c4a35' : 'transparent', border: `1px solid ${taxRegime === r ? '#1c4a35' : 'rgba(14,14,13,.15)'}`, color: taxRegime === r ? '#f4f0e6' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }} onClick={() => setTaxRegime(r)}>
                {r === 'standard' ? 'Regime Geral' : 'IFICI/NHR'}
              </button>
            ))}
            {(['residencial', 'comercial'] as const).map(t => (
              <button key={t} style={{ padding: '6px 14px', background: tipoImovelInv === t ? '#c9a96e' : 'transparent', border: `1px solid ${tipoImovelInv === t ? '#c9a96e' : 'rgba(14,14,13,.15)'}`, color: tipoImovelInv === t ? '#0c1f15' : 'rgba(14,14,13,.5)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }} onClick={() => setTipoImovelInv(t)}>
                {t}
              </button>
            ))}
          </div>
          {investorData.rendaMensal && (() => {
            const preco = parseDealValue(deal.valor)
            const renda = parseFloat(investorData.rendaMensal) || 0
            const aprecBase = parseFloat(investorData.apreciacao) || 3
            const aprecMult = invScenario === 'bull' ? 1.4 : invScenario === 'bear' ? 0.3 : 1
            const aprec = aprecBase * aprecMult
            const anos = parseInt(investorData.horizonte) || 10
            const yieldBruto = preco > 0 ? (renda * 12 / preco * 100) : 0
            const taxRate = taxRegime === 'ifici' ? 0.20 : tipoImovelInv === 'residencial' ? 0.28 : 0.25
            const yieldLiquido = yieldBruto * (1 - taxRate)
            const valorFinal = preco * Math.pow(1 + aprec / 100, anos)
            const totalReturn = preco > 0 ? ((valorFinal - preco + renda * 12 * anos) / preco * 100) : 0
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '8px' }}>
                {[
                  { l: 'Yield Bruto', v: `${yieldBruto.toFixed(1)}%` },
                  { l: `Yield Líquido (${taxRegime === 'ifici' ? '20%' : '28%'})`, v: `${yieldLiquido.toFixed(1)}%` },
                  { l: `Valorização Anual (${invScenario})`, v: `+${aprec.toFixed(1)}%` },
                  { l: `Retorno Total ${anos}a`, v: `+${totalReturn.toFixed(0)}%` },
                  { l: 'Valor Final Estimado', v: `€${Math.round(valorFinal).toLocaleString('pt-PT')}` },
                  { l: 'Rendimento Total Acumulado', v: `€${Math.round(renda * 12 * anos).toLocaleString('pt-PT')}` },
                ].map(m => (
                  <div key={m.l} style={{ padding: '12px 14px', background: darkMode ? 'rgba(28,74,53,.15)' : 'rgba(28,74,53,.04)', border: `1px solid ${darkMode ? 'rgba(201,169,110,.1)' : 'rgba(28,74,53,.1)'}` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{m.l}</div>
                    <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1.3rem', color: '#c9a96e', fontWeight: 300 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── New Deal Form ────────────────────────────────────────────────────────────

interface NewDealFormData {
  imovel: string
  valor: string
  comprador: string
  compradorEmail: string
  compradorTelefone: string
  vendedor: string
  vendedorEmail: string
  zona: string
  tipo: typeof TIPO_OPTIONS[number]
  dataInicioNegociacao: string
  observacoes: string
}

const EMPTY_NEW_DEAL: NewDealFormData = {
  imovel: '', valor: '', comprador: '', compradorEmail: '',
  compradorTelefone: '', vendedor: '', vendedorEmail: '',
  zona: '', tipo: 'Apartamento', dataInicioNegociacao: '', observacoes: '',
}

function NewDealForm({
  darkMode,
  onAdd,
  onCancel,
}: {
  darkMode: boolean
  onAdd: (data: NewDealFormData) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<NewDealFormData>(EMPTY_NEW_DEAL)
  const setField = (k: keyof NewDealFormData, v: string) => setForm(prev => ({ ...prev, [k]: v }))
  const canSubmit = form.imovel.trim() && form.valor.trim()
  const bg = darkMode ? '#122a1a' : 'rgba(28,74,53,.04)'

  return (
    <div style={{ padding: '18px 20px', background: bg, border: '1px solid rgba(28,74,53,.15)', marginBottom: '18px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)' }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#1c4a35', marginBottom: '16px' }}>Novo Deal</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label className="p-label">Imóvel *</label>
          <input className="p-inp" placeholder="Nome / Referência do imóvel" value={form.imovel} onChange={e => setField('imovel', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Valor *</label>
          <input className="p-inp" placeholder="€ 500.000" value={form.valor} onChange={e => setField('valor', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Comprador</label>
          <input className="p-inp" placeholder="Nome do comprador" value={form.comprador} onChange={e => setField('comprador', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Email Comprador</label>
          <input className="p-inp" type="email" placeholder="email@exemplo.com" value={form.compradorEmail} onChange={e => setField('compradorEmail', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Telefone Comprador</label>
          <input className="p-inp" placeholder="+351 9XX XXX XXX" value={form.compradorTelefone} onChange={e => setField('compradorTelefone', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Vendedor</label>
          <input className="p-inp" placeholder="Nome do vendedor" value={form.vendedor} onChange={e => setField('vendedor', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Email Vendedor</label>
          <input className="p-inp" type="email" placeholder="email@exemplo.com" value={form.vendedorEmail} onChange={e => setField('vendedorEmail', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Zona</label>
          <input className="p-inp" placeholder="Lisboa, Cascais, Algarve..." value={form.zona} onChange={e => setField('zona', e.target.value)} />
        </div>
        <div>
          <label className="p-label">Tipo de Imóvel</label>
          <select className="p-sel" value={form.tipo} onChange={e => setField('tipo', e.target.value as NewDealFormData['tipo'])}>
            {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="p-label">Data Início Negociação</label>
          <input className="p-inp" type="date" value={form.dataInicioNegociacao} onChange={e => setField('dataInicioNegociacao', e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label className="p-label">Observações</label>
        <textarea
          className="p-inp" rows={3}
          placeholder="Notas adicionais sobre o deal..."
          value={form.observacoes}
          onChange={e => setField('observacoes', e.target.value)}
          style={{ resize: 'vertical', minHeight: '64px' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="p-btn" onClick={() => { if (canSubmit) onAdd(form) }} disabled={!canSubmit}>
          Adicionar Deal
        </button>
        <button style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Export Pipeline PDF ──────────────────────────────────────────────────────

function buildPipelineHTML(deals: Deal[]): string {
  const totalVal = deals.reduce((s, d) => s + parseDealValue(d.valor), 0)
  const gci = totalVal * COMMISSION_RATE
  const rows = deals.map(d => `
    <tr>
      <td>${d.ref ?? '—'}</td>
      <td>${d.imovel ?? '—'}</td>
      <td>${d.valor ?? '—'}</td>
      <td>${d.comprador || '—'}</td>
      <td>${d.fase ?? '—'}</td>
      <td>${STAGE_PCT[d.fase ?? ''] ?? 0}%</td>
    </tr>`).join('')
  return `
    <h2 style="font-family:Georgia,serif;color:#1c4a35;">Pipeline CPCV — Agency Group</h2>
    <p style="font-family:monospace;font-size:12px;color:#888;">Gerado em ${new Date().toLocaleDateString('pt-PT')}</p>
    <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
      <thead>
        <tr style="background:#1c4a35;color:#fff;">
          <th style="padding:8px;text-align:left;">Ref</th>
          <th style="padding:8px;text-align:left;">Imóvel</th>
          <th style="padding:8px;text-align:left;">Valor</th>
          <th style="padding:8px;text-align:left;">Comprador</th>
          <th style="padding:8px;text-align:left;">Fase</th>
          <th style="padding:8px;text-align:left;">Progress</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;font-family:monospace;font-size:13px;">
      <strong>Total Pipeline:</strong> €${totalVal.toLocaleString('pt-PT')}<br/>
      <strong>GCI Previsto (5%):</strong> €${Math.round(gci).toLocaleString('pt-PT')}<br/>
      <strong>Total Deals:</strong> ${deals.length}
    </div>`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortalPipeline({
  onToggleCheck,
  onChangeFase,
  onAddDeal,
  onDealRisk,
  onDealNego,
  exportToPDF,
}: PortalPipelineProps) {
  const { darkMode } = useUIStore()
  const {
    deals, setDeals,
    activeDeal, setActiveDeal,
    showNewDeal, setShowNewDeal,
    newDeal, setNewDeal,
    pipelineView, setPipelineView,
    pipelineSearch, setPipelineSearch,
    dealTab, setDealTab,
    dealRiskLoading, dealRiskAnalysis,
    dealNegoLoading, dealNego,
    investorData, setInvestorData,
    invScenario, setInvScenario,
    taxRegime, setTaxRegime,
    tipoImovelInv, setTipoImovelInv,
  } = useDealStore()

  const [extDealTab, setExtDealTab] = useState<DealTabId>('checklist')
  const [showNewDealForm, setShowNewDealForm] = useState(false)
  const [newDealForm, setNewDealForm] = useState<NewDealFormData>(EMPTY_NEW_DEAL)
  const [recentMoves, setRecentMoves] = useState<PipelineMove[]>([])
  // Filter chips
  const [activeFilter, setActiveFilter] = useState<string>('todos')
  // Live data
  const [liveDataSource, setLiveDataSource] = useState<'live' | 'demo'>('demo')

  // Load live deals from /api/deals
  useEffect(() => {
    let cancelled = false
    async function loadDeals() {
      try {
        const res = await fetch('/api/deals')
        if (res.ok) {
          const { data } = await res.json()
          if (!cancelled && data && data.length > 0) {
            const fullChecklist = Object.fromEntries(
              Object.keys(CHECKLISTS).map(k => [k, CHECKLISTS[k].map(() => false)])
            )
            const liveDeals = data.map((d: Deal) => ({
              ...d,
              checklist: fullChecklist,
            }))
            setDeals(liveDeals)
            setLiveDataSource('live')
          }
        }
      } catch { /* use mock */ }
    }
    loadDeals()
    const interval = setInterval(loadDeals, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pipelineTotal = useMemo(() =>
    deals.reduce((s, d) => s + parseDealValue(d.valor), 0), [deals])

  const activeDealObj = useMemo(() =>
    deals.find(d => d.id === activeDeal) as DealWithMeta | undefined || null,
    [deals, activeDeal])

  const filteredDeals = useMemo(() => {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86400000
    return deals.filter(d => {
      // Search filter
      const q = pipelineSearch.toLowerCase()
      const searchOk = !pipelineSearch ||
        (d.imovel ?? '').toLowerCase().includes(q) ||
        (d.comprador ?? '').toLowerCase().includes(q) ||
        (d.ref ?? '').toLowerCase().includes(q)
      if (!searchOk) return false
      // Chip filter
      if (activeFilter === 'todos') return true
      if (activeFilter === 'meus') return true // no agent filter in demo
      if (activeFilter === 'atrisk') {
        const { score } = dealHealthScore(d as DealWithMeta)
        return score < 60
      }
      if (activeFilter === 'recentes') {
        return new Date((d as DealWithMeta).createdAt || Date.now()).getTime() >= thirtyDaysAgo
      }
      if (activeFilter === 'milhao') {
        return parseDealValue(d.valor) >= 1e6
      }
      return true
    })
  }, [deals, pipelineSearch, activeFilter])

  // Summary bar stats
  const summaryStats = useMemo(() => {
    const totalVal = filteredDeals.reduce((s, d) => s + parseDealValue(d.valor), 0)
    const totalComm = totalVal * COMMISSION_RATE
    const gciMes = filteredDeals
      .filter(d => ['CPCV Assinado', 'Escritura Marcada'].includes(d.fase))
      .reduce((s, d) => s + parseDealValue(d.valor) * 0.5 * COMMISSION_RATE, 0)
    const closedDeals = deals.filter(d => d.fase === 'Escritura Concluída').length
    const totalClosed = deals.filter(d => STAGE_PCT[d.fase] >= 40).length
    const winRate = totalClosed > 0 ? Math.round((closedDeals / totalClosed) * 100) : 0
    return { totalVal, totalComm, gciMes, winRate }
  }, [filteredDeals, deals])

  const handleAddDealFromForm = useCallback((data: NewDealFormData) => {
    setNewDeal({ imovel: data.imovel, valor: data.valor })
    setTimeout(() => {
      onAddDeal()
      setShowNewDealForm(false)
      setNewDealForm(EMPTY_NEW_DEAL)
    }, 0)
  }, [onAddDeal, setNewDeal])

  const handleMoveLogged = useCallback((move: PipelineMove) => {
    setRecentMoves(prev => [move, ...prev].slice(0, 10))
  }, [])

  const handleSetDealTab = useCallback((t: DealTabId) => {
    setExtDealTab(t)
    setDealTab(t)
  }, [setDealTab])

  const fmtM = (v: number) => v >= 1e6 ? `€${(v / 1e6).toFixed(1)}M` : `€${Math.round(v / 1000)}k`

  // suppress lint for unused vars from store — they are preserved for store contract
  void showNewDeal; void setShowNewDeal; void newDeal

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(14,14,13,.3)', marginBottom: '4px' }}>
            Gestão de Negócios
          </div>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontWeight: 300, fontSize: '1.6rem', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>
            Pipeline CPCV · <span style={{ color: '#c9a96e' }}>{fmtM(pipelineTotal)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid rgba(14,14,13,.1)', borderRadius: '6px', overflow: 'hidden' }}>
            {(['lista', 'kanban'] as const).map(v => (
              <button key={v}
                style={{ padding: '6px 14px', background: pipelineView === v ? '#1c4a35' : 'transparent', color: pipelineView === v ? '#f4f0e6' : 'rgba(14,14,13,.45)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', border: 'none', cursor: 'pointer', letterSpacing: '.08em' }}
                onClick={() => setPipelineView(v)}>
                {v === 'lista' ? '☰ Lista' : '⠿ Kanban'}
              </button>
            ))}
          </div>
          <button
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', cursor: 'pointer', color: 'rgba(14,14,13,.55)', letterSpacing: '.06em', borderRadius: '6px', transition: 'all .2s' }}
            onClick={() => exportToPDF('Pipeline CPCV — Agency Group', buildPipelineHTML(deals))}
          >
            ⬇ Exportar PDF
          </button>
          <button className="p-btn p-btn-gold" style={{ padding: '6px 14px' }} onClick={() => setShowNewDealForm(true)}>
            + Novo Deal
          </button>
        </div>
      </div>

      {/* ── Pipeline Summary Bar ── */}
      <style>{`@keyframes deal-glow{0%{box-shadow:0 0 0 0 rgba(74,156,122,.5)}50%{box-shadow:0 0 16px 4px rgba(74,156,122,.3)}100%{box-shadow:0 0 0 0 rgba(74,156,122,0)}}`}</style>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', flexWrap: 'wrap', gap: '0',
        marginBottom: '16px',
        background: darkMode ? '#0c1f15' : '#1c4a35',
        border: '1px solid rgba(201,169,110,.15)',
        overflow: 'hidden',
        borderRadius: '12px',
      }}>
        {[
          { label: 'Deals Activos', val: String(filteredDeals.filter(d => d.fase !== 'Escritura Concluída').length) },
          { label: 'Valor Total', val: fmtM(summaryStats.totalVal) },
          { label: 'Comissão Prev.', val: fmtM(summaryStats.totalComm) },
          { label: 'GCI Mês', val: fmtM(summaryStats.gciMes) },
          { label: 'Win Rate', val: `${summaryStats.winRate}%` },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, minWidth: '110px',
            padding: '10px 16px',
            borderRight: i < arr.length - 1 ? '1px solid rgba(201,169,110,.1)' : 'none',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '1rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.4)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '3px' }}>{s.label}</div>
          </div>
        ))}
        {liveDataSource === 'live' && (
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '5px', borderLeft: '1px solid rgba(201,169,110,.1)' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4a9c7a' }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.35)', letterSpacing: '.06em' }}>LIVE</span>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <input
        className="p-inp"
        style={{ marginBottom: '10px' }}
        placeholder="Pesquisar deals por nome, comprador ou referência..."
        value={pipelineSearch}
        onChange={e => setPipelineSearch(e.target.value)}
      />

      {/* ── Filter Chips ── */}
      {(() => {
        const now = Date.now()
        const thirtyDaysAgo = now - 30 * 86400000
        const chips = [
          { key: 'todos', label: 'Todos', count: deals.length },
          { key: 'meus', label: 'Meus Deals', count: deals.length },
          { key: 'atrisk', label: 'At Risk', count: deals.filter(d => dealHealthScore(d as DealWithMeta).score < 60).length },
          { key: 'recentes', label: 'Últimos 30d', count: deals.filter(d => new Date((d as DealWithMeta).createdAt || Date.now()).getTime() >= thirtyDaysAgo).length },
          { key: 'milhao', label: '>€1M', count: deals.filter(d => parseDealValue(d.valor) >= 1e6).length },
        ]
        return (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {chips.map(chip => (
              <button key={chip.key}
                onClick={() => setActiveFilter(chip.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px',
                  background: activeFilter === chip.key ? '#1c4a35' : 'transparent',
                  color: activeFilter === chip.key ? '#c9a96e' : darkMode ? 'rgba(244,240,230,.55)' : 'rgba(14,14,13,.5)',
                  border: `1px solid ${activeFilter === chip.key ? '#1c4a35' : darkMode ? 'rgba(244,240,230,.15)' : 'rgba(14,14,13,.12)'}`,
                  fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em',
                  cursor: 'pointer', borderRadius: '6px', transition: 'all .2s',
                  ...(chip.key === 'atrisk' && activeFilter !== 'atrisk' ? { color: '#dc2626', borderColor: 'rgba(220,38,38,.2)' } : {}),
                }}>
                {chip.label}
                <span style={{
                  background: activeFilter === chip.key ? 'rgba(201,169,110,.25)' : darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.06)',
                  color: activeFilter === chip.key ? '#c9a96e' : darkMode ? 'rgba(244,240,230,.45)' : 'rgba(14,14,13,.4)',
                  padding: '1px 6px', borderRadius: '10px', fontSize: '.52rem', fontFamily: "'DM Mono',monospace",
                  ...(chip.key === 'atrisk' ? { color: '#dc2626', background: 'rgba(220,38,38,.08)' } : {}),
                }}>
                  {chip.count}
                </span>
              </button>
            ))}
          </div>
        )
      })()}

      {/* ── Deal at Risk Alert ── */}
      <AtRiskBanner deals={filteredDeals} darkMode={darkMode} />

      {/* ── Activity Timeline Banner ── */}
      <ActivityTimelineBanner moves={recentMoves} darkMode={darkMode} />

      {/* ── GCI Forecast Panel ── */}
      <GCIForecastPanel deals={filteredDeals} darkMode={darkMode} />

      {/* ── New Deal Form ── */}
      {showNewDealForm && (
        <NewDealForm
          darkMode={darkMode}
          onAdd={handleAddDealFromForm}
          onCancel={() => { setShowNewDealForm(false); setNewDealForm(EMPTY_NEW_DEAL) }}
        />
      )}

      {/* ── Kanban View ── */}
      {pipelineView === 'kanban' && (
        <div>
          <KanbanView
            deals={filteredDeals}
            activeDeal={activeDeal}
            darkMode={darkMode}
            onSelectDeal={setActiveDeal}
            onChangeFase={onChangeFase}
            onMoveLogged={handleMoveLogged}
          />
          {activeDealObj && (
            <div style={{
              marginTop: '20px', padding: '20px',
              background: darkMode ? '#122a1a' : 'rgba(255,255,255,.6)',
              border: '1px solid rgba(28,74,53,.15)',
              borderRadius: '12px', boxShadow: '0 1px 3px rgba(14,14,13,.06),0 1px 2px rgba(14,14,13,.04)',
            }}>
              <DealDetailPanel
                deal={activeDealObj} darkMode={darkMode}
                onChangeFase={onChangeFase} onToggleCheck={onToggleCheck}
                onDealRisk={onDealRisk} onDealNego={onDealNego}
                dealTab={extDealTab} setDealTab={handleSetDealTab}
                dealRiskLoading={dealRiskLoading} dealRiskAnalysis={dealRiskAnalysis}
                dealNegoLoading={dealNegoLoading} dealNego={dealNego}
                investorData={investorData} setInvestorData={setInvestorData}
                invScenario={invScenario} setInvScenario={setInvScenario}
                taxRegime={taxRegime} setTaxRegime={setTaxRegime}
                tipoImovelInv={tipoImovelInv} setTipoImovelInv={setTipoImovelInv}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Lista View ── */}
      {pipelineView === 'lista' && (
        <div style={{ display: 'flex', gap: '20px', minHeight: 0 }}>
          <div style={{ width: '280px', flexShrink: 0 }}>
            {filteredDeals.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(14,14,13,.25)', border: '1px dashed rgba(14,14,13,.1)' }}>
                Sem deals encontrados
              </div>
            )}
            {filteredDeals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal as DealWithMeta}
                isActive={activeDeal === deal.id}
                darkMode={darkMode}
                onClick={() => setActiveDeal(activeDeal === deal.id ? null : deal.id)}
                onAdvance={() => {
                  const ns = nextStage(deal.fase)
                  if (ns) onChangeFase(deal.id, ns)
                }}
              />
            ))}
          </div>

          {activeDealObj && (
            <DealDetailPanel
              deal={activeDealObj} darkMode={darkMode}
              onChangeFase={onChangeFase} onToggleCheck={onToggleCheck}
              onDealRisk={onDealRisk} onDealNego={onDealNego}
              dealTab={extDealTab} setDealTab={handleSetDealTab}
              dealRiskLoading={dealRiskLoading} dealRiskAnalysis={dealRiskAnalysis}
              dealNegoLoading={dealNegoLoading} dealNego={dealNego}
              investorData={investorData} setInvestorData={setInvestorData}
              invScenario={invScenario} setInvScenario={setInvScenario}
              taxRegime={taxRegime} setTaxRegime={setTaxRegime}
              tipoImovelInv={tipoImovelInv} setTipoImovelInv={setTipoImovelInv}
            />
          )}

          {!activeDeal && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'rgba(14,14,13,.2)', fontFamily: "'Cormorant',serif", fontSize: '1.1rem' }}>
                Selecione um deal para ver os detalhes
              </div>
              <div style={{ color: 'rgba(14,14,13,.15)', fontFamily: "'DM Mono',monospace", fontSize: '.52rem' }}>
                {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''} no pipeline
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
