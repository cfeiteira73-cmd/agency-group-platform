'use client'
import { useState, useEffect } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { useCRMStore } from '../stores/crmStore'
import type { SectionId } from './types'
import { PIPELINE_STAGES, STAGE_PCT, STAGE_COLOR } from './constants'

interface PortalDashboardProps {
  agentName: string
  imoveisList: Record<string, unknown>[]
  weeklyReport: Record<string, unknown> | null
  weeklyReportLoading: boolean
  onWeeklyReport: () => void
  onCloseWeeklyReport: () => void
  exportToPDF: (title: string, html: string) => void
  onSetSection: (s: SectionId) => void
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const w = 60
  const h = 24
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / (max - min || 1)) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const lastPt = pts.split(' ').pop() ?? '0,0'
  const [lx, ly] = lastPt.split(',')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  )
}

// ─── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  if (!dateStr) return '—'
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `há ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `há ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

// ─── Status badge colour ──────────────────────────────────────────────────────
function statusColor(status: string): string {
  const map: Record<string, string> = {
    vip: '#c9a96e',
    cliente: '#1c4a35',
    prospect: '#3a7bd5',
    lead: '#888',
  }
  return map[status] ?? '#888'
}

// ─── Ticker data ──────────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  '🏠 Lisboa €8.200/m² · +18% YoY',
  '🌊 Cascais €5.890/m² · +22% YoY',
  '☀️ Algarve €4.100/m² · +15% YoY',
  '🏙️ Porto €3.643/m² · +12% YoY',
  '🌴 Madeira €3.760/m² · +31% YoY',
  '🏝️ Açores €1.952/m² · +8% YoY',
  '📊 169.812 transacções 2025 · +7,2%',
  '💰 Luxo Lisboa top 5 mundial',
  '🇫🇷 Franceses 13% compradores PT',
  '🇺🇸 Norte-americanos 16% compradores PT',
]

// ─── Simulated sparkline seeds ────────────────────────────────────────────────
const SPARK_PIPELINE = [1.2, 1.5, 1.4, 1.8, 2.1, 2.4, 2.6]
const SPARK_GCI = [45, 52, 49, 61, 70, 80, 90]
const SPARK_LEADS = [8, 10, 9, 12, 14, 13, 16]
const SPARK_CONV = [4.2, 4.8, 4.5, 5.1, 5.6, 5.4, 5.9]

// ─── Quick actions config ─────────────────────────────────────────────────────
const QUICK_ACTIONS: {
  label: string
  sub: string
  sec: SectionId
  color: string
  svg: string
}[] = [
  {
    label: 'CRM Clientes',
    sub: 'Gestão relacional · Leads & VIPs',
    sec: 'crm',
    color: '#c9a96e',
    svg: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    label: 'AVM Avaliação',
    sub: '6 metodologias RICS · Relatório PDF',
    sec: 'avm',
    color: '#1c4a35',
    svg: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    label: 'Deal Radar',
    sub: 'IA · Leilões + Banca + Mercado livre',
    sec: 'radar',
    color: '#c9a96e',
    svg: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    label: 'Pipeline CPCV',
    sub: 'Deals activos · Em negociação',
    sec: 'pipeline',
    color: '#1c4a35',
    svg: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    label: 'Marketing AI',
    sub: 'Multi-formato · 6 idiomas',
    sec: 'marketing',
    color: '#c9a96e',
    svg: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  {
    label: 'Consultor Jurídico',
    sub: 'CPCV · NHR · Golden Visa · IMT',
    sec: 'juridico',
    color: '#1c4a35',
    svg: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    label: 'Investor Pitch',
    sub: 'Deal memos · Investor matching',
    sec: 'investorpitch',
    color: '#c9a96e',
    svg: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  },
  {
    label: 'Market Pulse',
    sub: 'Market intelligence · 2026',
    sec: 'pulse',
    color: '#1c4a35',
    svg: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    label: 'Campanhas',
    sub: 'Email · WhatsApp · Drip',
    sec: 'campanhas',
    color: '#c9a96e',
    svg: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PortalDashboard({
  agentName,
  weeklyReport,
  weeklyReportLoading,
  onWeeklyReport,
  onCloseWeeklyReport,
  exportToPDF,
  onSetSection,
}: PortalDashboardProps) {
  const { darkMode } = useUIStore()
  const { deals } = useDealStore()
  const { crmContacts } = useCRMStore()

  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const pipelineTotal = deals.reduce((s, d) => {
    const v = parseFloat(d.valor.replace(/[^0-9.]/g, '')) || 0
    return s + v
  }, 0)

  const closedDeals = deals.filter(d => d.fase === 'Escritura Concluída')
  const cpcvDeals = deals.filter(d => d.fase === 'CPCV Assinado')

  const followUpsHoje = crmContacts.filter(
    c => c.nextFollowUp && c.nextFollowUp <= today
  ).length

  const leadsNovos = crmContacts.filter(c => {
    if (c.status !== 'lead') return false
    const created = c.createdAt ?? ''
    const diffDays = (Date.now() - new Date(created).getTime()) / 86400000
    return diffDays <= 3 && !c.lastContact
  }).length

  const dealsUrgentes = deals.filter(d => {
    if (d.fase === 'Escritura Concluída') return false
    const ref = d.cpcvDate || d.escrituraDate || ''
    if (!ref) return false
    const diffDays = (Date.now() - new Date(ref).getTime()) / 86400000
    return diffDays > 7
  }).length

  const leadsAtivos = crmContacts.filter(
    c => c.status === 'lead' || c.status === 'prospect'
  ).length
  const vipContacts = crmContacts.filter(c => c.status === 'vip').length

  const convRate =
    crmContacts.length > 0
      ? ((closedDeals.length / crmContacts.length) * 100).toFixed(1)
      : '0.0'

  const gciPrevisto = Math.round((pipelineTotal * 0.05) / 1000)

  // ── Alerts ───────────────────────────────────────────────────────────────────
  const alertas: { msg: string; sec: SectionId }[] = [
    followUpsHoje > 0
      ? {
          msg: `${followUpsHoje} follow-up${followUpsHoje > 1 ? 's' : ''} em atraso`,
          sec: 'crm' as SectionId,
        }
      : null,
    dealsUrgentes > 0
      ? {
          msg: `${dealsUrgentes} deal${dealsUrgentes > 1 ? 's' : ''} sem actividade há 7+ dias`,
          sec: 'pipeline' as SectionId,
        }
      : null,
    leadsNovos > 0
      ? {
          msg: `${leadsNovos} lead${leadsNovos > 1 ? 's novos' : ' novo'} sem contacto`,
          sec: 'crm' as SectionId,
        }
      : null,
  ].filter((a): a is { msg: string; sec: SectionId } => a !== null)

  // ── Pipeline by stage ────────────────────────────────────────────────────────
  const stageBreakdown = PIPELINE_STAGES.map(stage => {
    const stageDeals = deals.filter(d => d.fase === stage)
    const stageVal = stageDeals.reduce((s, d) => {
      return s + (parseFloat(d.valor.replace(/[^0-9.]/g, '')) || 0)
    }, 0)
    return { stage, count: stageDeals.length, value: stageVal }
  }).filter(s => s.count > 0)

  const maxStageVal = Math.max(...stageBreakdown.map(s => s.value), 1)

  // ── Top contacts (5 most recent) ─────────────────────────────────────────────
  const recentContacts = [...crmContacts]
    .sort((a, b) => {
      const da = new Date(a.lastContact || a.createdAt || '2000-01-01').getTime()
      const db = new Date(b.lastContact || b.createdAt || '2000-01-01').getTime()
      return db - da
    })
    .slice(0, 5)

  // ── Top 3 deals by value ─────────────────────────────────────────────────────
  const topDeals = [...deals]
    .filter(d => d.fase !== 'Escritura Concluída')
    .sort((a, b) => {
      const va = parseFloat(a.valor.replace(/[^0-9.]/g, '')) || 0
      const vb = parseFloat(b.valor.replace(/[^0-9.]/g, '')) || 0
      return vb - va
    })
    .slice(0, 3)

  // ── Styles ───────────────────────────────────────────────────────────────────
  const cardBg = darkMode ? '#0c1f15' : '#ffffff'
  const cardText = darkMode ? '#f4f0e6' : '#0e0e0d'
  const mutedText = darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.35)'
  const borderCol = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.07)'

  const greeting =
    currentTime.getHours() < 12
      ? 'Bom dia'
      : currentTime.getHours() < 19
      ? 'Boa tarde'
      : 'Boa noite'

  return (
    <div style={{ fontFamily: "'Jost',sans-serif" }}>
      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .ticker-inner { animation: ticker 32s linear infinite; display: flex; gap: 48px; white-space: nowrap; }
        .ticker-inner:hover { animation-play-state: paused; }
        .qa-card:hover { background: rgba(28,74,53,.06) !important; }
        .qa-card:hover .qa-arrow { opacity: 1 !important; transform: translateX(0) !important; }
        .pipeline-row:hover { background: rgba(28,74,53,.04) !important; cursor: pointer; }
        .recent-row:hover { background: rgba(28,74,53,.04) !important; cursor: pointer; }
        .top-deal:hover { background: rgba(201,169,110,.06) !important; cursor: pointer; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 1 — HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.5rem',
              letterSpacing: '.2em',
              textTransform: 'uppercase',
              color: mutedText,
              marginBottom: '8px',
            }}
          >
            {currentTime.toLocaleDateString('pt-PT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant',serif",
              fontWeight: 300,
              fontSize: '2.2rem',
              color: cardText,
              lineHeight: 1.05,
            }}
          >
            {greeting},{' '}
            <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>{agentName}</em>.
          </div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.42rem',
              color: mutedText,
              marginTop: '6px',
              letterSpacing: '.08em',
            }}
          >
            {currentTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} ·{' '}
            {deals.length} deals activos · pipeline €{(pipelineTotal / 1e6).toFixed(2)}M
          </div>
        </div>

        <div
          style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <button
            style={{
              padding: '6px 14px',
              background: weeklyReport
                ? 'rgba(201,169,110,.12)'
                : 'rgba(28,74,53,.06)',
              border: `1px solid ${weeklyReport ? 'rgba(201,169,110,.3)' : 'rgba(28,74,53,.2)'}`,
              color: weeklyReport ? '#c9a96e' : '#1c4a35',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.42rem',
              letterSpacing: '.08em',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
            disabled={weeklyReportLoading}
            onClick={weeklyReport ? onCloseWeeklyReport : onWeeklyReport}
          >
            {weeklyReportLoading
              ? '✦ A gerar...'
              : weeklyReport
              ? '× Fechar Relatório'
              : '📋 Relatório Semanal IA'}
          </button>
          <div
            style={{
              background: '#1c4a35',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#6fcf97',
              }}
            />
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.44rem',
                letterSpacing: '.12em',
                color: '#f4f0e6',
                textTransform: 'uppercase',
              }}
            >
              Portal Activo
            </span>
          </div>
          <div
            style={{
              background: 'rgba(201,169,110,.1)',
              border: '1px solid rgba(201,169,110,.25)',
              padding: '6px 14px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.44rem',
                letterSpacing: '.1em',
                color: '#c9a96e',
                textTransform: 'uppercase',
              }}
            >
              AMI 22506
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          WEEKLY REPORT PANEL
      ══════════════════════════════════════════════════════════════════════ */}
      {weeklyReport && (
        <div
          style={{
            background: 'linear-gradient(135deg,#0c1f15,#1a3d2a)',
            padding: '20px 24px',
            marginBottom: '24px',
            border: '1px solid rgba(201,169,110,.15)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  color: 'rgba(201,169,110,.5)',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}
              >
                📋 Relatório Semanal IA — Claude Opus
              </div>
              <div
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '1.2rem',
                  color: '#f4f0e6',
                  fontWeight: 300,
                }}
              >
                {String(weeklyReport.title)}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  color: 'rgba(244,240,230,.35)',
                  marginTop: '2px',
                }}
              >
                {String(weeklyReport.period)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                style={{
                  padding: '5px 12px',
                  background: 'rgba(244,240,230,.06)',
                  border: '1px solid rgba(244,240,230,.1)',
                  color: 'rgba(244,240,230,.5)',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  cursor: 'pointer',
                  letterSpacing: '.06em',
                }}
                onClick={() => {
                  const html = `
                    <div class="label">${weeklyReport.period}</div>
                    <div style="font-family:var(--font-cormorant),serif;font-size:1.6rem;font-weight:300;margin-bottom:12px">${weeklyReport.title}</div>
                    <div style="padding:14px 18px;background:rgba(28,74,53,.05);border-left:3px solid #1c4a35;margin-bottom:20px;font-family:var(--font-jost),sans-serif;font-size:.85rem;line-height:1.7;color:rgba(14,14,13,.7)">${weeklyReport.executiveSummary}</div>
                  `
                  exportToPDF(String(weeklyReport.title), html)
                }}
              >
                ⬇ PDF
              </button>
              <button
                style={{
                  padding: '5px 12px',
                  background: 'rgba(244,240,230,.06)',
                  border: '1px solid rgba(244,240,230,.1)',
                  color: 'rgba(244,240,230,.5)',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  cursor: 'pointer',
                }}
                onClick={onCloseWeeklyReport}
              >
                × Fechar
              </button>
            </div>
          </div>
          <div
            style={{
              fontFamily: "'Jost',sans-serif",
              fontSize: '.82rem',
              color: 'rgba(244,240,230,.7)',
              lineHeight: 1.7,
              marginBottom: '16px',
              padding: '12px 14px',
              background: 'rgba(255,255,255,.04)',
              borderLeft: '3px solid rgba(201,169,110,.4)',
            }}
          >
            {String(weeklyReport.executiveSummary)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 2 — PAINEL DE ALERTAS
      ══════════════════════════════════════════════════════════════════════ */}
      {alertas.length > 0 && (
        <div
          style={{
            background: darkMode
              ? 'rgba(220,38,38,.08)'
              : 'rgba(220,38,38,.04)',
            border: '1px solid rgba(220,38,38,.25)',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.42rem',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: '#dc2626',
              marginBottom: '4px',
            }}
          >
            ⚠ Alertas activos
          </div>
          {alertas.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <span
                style={{
                  fontFamily: "'Jost',sans-serif",
                  fontSize: '.84rem',
                  color: darkMode ? 'rgba(244,240,230,.8)' : '#0e0e0d',
                }}
              >
                ⚠️ {a.msg}
              </span>
              <button
                style={{
                  padding: '3px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(220,38,38,.4)',
                  color: '#dc2626',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  cursor: 'pointer',
                  letterSpacing: '.06em',
                  flexShrink: 0,
                }}
                onClick={() => onSetSection(a.sec)}
              >
                Ver →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 3 — KPI GRID 4×2
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px',
          marginBottom: '28px',
        }}
      >
        {/* KPI 1 — GCI Previsto */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="kpi-label"
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.4rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: mutedText,
                  marginBottom: '6px',
                }}
              >
                GCI Previsto
              </div>
              <div
                className="kpi-val"
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '1.8rem',
                  fontWeight: 600,
                  color: '#1c4a35',
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                €{gciPrevisto}K
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  color: mutedText,
                  marginBottom: '8px',
                }}
              >
                5% do pipeline total
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  background: 'rgba(74,156,122,.12)',
                  color: '#4a9c7a',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.36rem',
                  letterSpacing: '.06em',
                }}
              >
                +12% vs mês anterior
              </span>
            </div>
            <Sparkline data={SPARK_GCI} color="#1c4a35" />
          </div>
        </div>

        {/* KPI 2 — Pipeline Total */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="kpi-label"
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.4rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: mutedText,
                  marginBottom: '6px',
                }}
              >
                Pipeline Total
              </div>
              <div
                className="kpi-val"
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '1.8rem',
                  fontWeight: 600,
                  color: '#c9a96e',
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                €{(pipelineTotal / 1e6).toFixed(1)}M
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  color: mutedText,
                  marginBottom: '8px',
                }}
              >
                {deals.length} deals em progresso
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  background: 'rgba(201,169,110,.12)',
                  color: '#c9a96e',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.36rem',
                  letterSpacing: '.06em',
                }}
              >
                {deals.length} negócios activos
              </span>
            </div>
            <Sparkline data={SPARK_PIPELINE} color="#c9a96e" />
          </div>
        </div>

        {/* KPI 3 — Leads Activos */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="kpi-label"
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.4rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: mutedText,
                  marginBottom: '6px',
                }}
              >
                Leads Activos
              </div>
              <div
                className="kpi-val"
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '1.8rem',
                  fontWeight: 600,
                  color: '#3a7bd5',
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                {leadsAtivos}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  color: mutedText,
                  marginBottom: '8px',
                }}
              >
                {leadsAtivos} prospects · {vipContacts} VIPs
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  background: 'rgba(58,123,213,.1)',
                  color: '#3a7bd5',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.36rem',
                  letterSpacing: '.06em',
                }}
              >
                {crmContacts.length} no CRM total
              </span>
            </div>
            <Sparkline data={SPARK_LEADS} color="#3a7bd5" />
          </div>
        </div>

        {/* KPI 4 — Follow-Ups Hoje */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div>
            <div
              className="kpi-label"
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.4rem',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: mutedText,
                marginBottom: '6px',
              }}
            >
              Follow-Ups Hoje
            </div>
            <div
              className="kpi-val"
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.8rem',
                fontWeight: 600,
                color: followUpsHoje > 0 ? '#dc2626' : '#4a9c7a',
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              {followUpsHoje}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: followUpsHoje > 0 ? '#dc2626' : '#4a9c7a',
                marginBottom: '8px',
              }}
            >
              {followUpsHoje > 0 ? '⚠ Acção necessária' : '✓ Em dia'}
            </div>
            <button
              style={{
                padding: '3px 10px',
                background: followUpsHoje > 0
                  ? 'rgba(220,38,38,.08)'
                  : 'rgba(74,156,122,.08)',
                border: `1px solid ${followUpsHoje > 0 ? 'rgba(220,38,38,.3)' : 'rgba(74,156,122,.3)'}`,
                color: followUpsHoje > 0 ? '#dc2626' : '#4a9c7a',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.36rem',
                cursor: 'pointer',
              }}
              onClick={() => onSetSection('crm')}
            >
              Abrir CRM →
            </button>
          </div>
        </div>

        {/* KPI 5 — Deals CPCV */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div>
            <div
              className="kpi-label"
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.4rem',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: mutedText,
                marginBottom: '6px',
              }}
            >
              Deals CPCV
            </div>
            <div
              className="kpi-val"
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.8rem',
                fontWeight: 600,
                color: '#c9a96e',
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              {cpcvDeals.length}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: mutedText,
                marginBottom: '8px',
              }}
            >
              Em fase de escritura
            </div>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 7px',
                background: 'rgba(201,169,110,.12)',
                color: '#c9a96e',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.36rem',
                letterSpacing: '.06em',
              }}
            >
              {closedDeals.length} escrituras fechadas
            </span>
          </div>
        </div>

        {/* KPI 6 — Taxa de Conversão */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="kpi-label"
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.4rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: mutedText,
                  marginBottom: '6px',
                }}
              >
                Taxa Conversão
              </div>
              <div
                className="kpi-val"
                style={{
                  fontFamily: "'Cormorant',serif",
                  fontSize: '1.8rem',
                  fontWeight: 600,
                  color: '#4a9c7a',
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                {convRate}%
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.38rem',
                  color: mutedText,
                  marginBottom: '8px',
                }}
              >
                lead → escritura
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  background: 'rgba(74,156,122,.1)',
                  color: '#4a9c7a',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.36rem',
                  letterSpacing: '.06em',
                }}
              >
                benchmark 8%
              </span>
            </div>
            <Sparkline data={SPARK_CONV} color="#4a9c7a" />
          </div>
        </div>

        {/* KPI 7 — Tempo Médio Ciclo */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div>
            <div
              className="kpi-label"
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.4rem',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: mutedText,
                marginBottom: '6px',
              }}
            >
              Ciclo Médio
            </div>
            <div
              className="kpi-val"
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.8rem',
                fontWeight: 600,
                color: '#888',
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              87d
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: mutedText,
                marginBottom: '8px',
              }}
            >
              angariação → escritura
            </div>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 7px',
                background: 'rgba(136,136,136,.1)',
                color: '#888',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.36rem',
                letterSpacing: '.06em',
              }}
            >
              benchmark 210 dias
            </span>
          </div>
        </div>

        {/* KPI 8 — Mercado PT */}
        <div
          className="kpi-card"
          style={{ background: cardBg, border: `1px solid ${borderCol}`, padding: '18px 20px' }}
        >
          <div>
            <div
              className="kpi-label"
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.4rem',
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: mutedText,
                marginBottom: '6px',
              }}
            >
              Mercado PT 2026
            </div>
            <div
              className="kpi-val"
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.8rem',
                fontWeight: 600,
                color: '#c9a96e',
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              +17,6%
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: mutedText,
                marginBottom: '6px',
                lineHeight: 1.5,
              }}
            >
              Lisboa top 5 mundial
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.36rem',
                color: '#c9a96e',
                letterSpacing: '.04em',
              }}
            >
              €3.076/m² mediana · 169.812 transacções
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 4 — PIPELINE VISUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {stageBreakdown.length > 0 && (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            padding: '22px 24px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '18px',
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.1rem',
                fontWeight: 400,
                color: cardText,
              }}
            >
              Pipeline por Fase
            </div>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: '#1c4a35',
                cursor: 'pointer',
                letterSpacing: '.08em',
              }}
              onClick={() => onSetSection('pipeline')}
            >
              Ver tudo →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stageBreakdown.map(s => {
              const barWidth = (s.value / maxStageVal) * 100
              const color = STAGE_COLOR[s.stage] ?? '#888'
              return (
                <div
                  key={s.stage}
                  className="pipeline-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 110px',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '6px 8px',
                    borderRadius: '2px',
                    transition: 'background .15s',
                  }}
                  onClick={() => onSetSection('pipeline')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.4rem',
                        color: cardText,
                        letterSpacing: '.04em',
                      }}
                    >
                      {s.stage}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        background: `${color}1a`,
                        borderRadius: '50%',
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.36rem',
                        color,
                        flexShrink: 0,
                      }}
                    >
                      {s.count}
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      background: darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.06)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: color,
                        borderRadius: '3px',
                        transition: 'width .4s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.4rem',
                      color,
                      textAlign: 'right',
                      letterSpacing: '.04em',
                    }}
                  >
                    €{(s.value / 1e6).toFixed(2)}M
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 5 — DOIS PAINÉIS LADO A LADO
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* Painel Esquerdo — Actividade Recente CRM */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            padding: '22px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.1rem',
                fontWeight: 400,
                color: cardText,
              }}
            >
              Actividade Recente CRM
            </div>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: '#1c4a35',
                cursor: 'pointer',
                letterSpacing: '.08em',
              }}
              onClick={() => onSetSection('crm')}
            >
              Ver CRM →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {recentContacts.length === 0 && (
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.42rem',
                  color: mutedText,
                  padding: '16px 0',
                  textAlign: 'center',
                }}
              >
                Sem contactos no CRM
              </div>
            )}
            {recentContacts.map(c => {
              const initials = c.name
                .split(' ')
                .slice(0, 2)
                .map(n => n[0])
                .join('')
                .toUpperCase()
              const sColor = statusColor(c.status)
              const timeAgo = relativeTime(c.lastContact || c.createdAt || '')
              return (
                <div
                  key={c.id}
                  className="recent-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 8px',
                    transition: 'background .15s',
                    borderBottom: `1px solid ${borderCol}`,
                  }}
                  onClick={() => onSetSection('crm')}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: `${sColor}22`,
                      border: `1.5px solid ${sColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.42rem',
                      color: sColor,
                      flexShrink: 0,
                      letterSpacing: '.04em',
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '2px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '.84rem',
                          fontWeight: 500,
                          color: cardText,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          padding: '1px 6px',
                          background: `${sColor}18`,
                          color: sColor,
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.34rem',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.38rem',
                        color: mutedText,
                        letterSpacing: '.04em',
                      }}
                    >
                      {c.nationality || '—'} · €{(c.budgetMax / 1000).toFixed(0)}K max · {timeAgo}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel Direito — Deals em Destaque */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            padding: '22px 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.1rem',
                fontWeight: 400,
                color: cardText,
              }}
            >
              Deals em Destaque
            </div>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.38rem',
                color: '#1c4a35',
                cursor: 'pointer',
                letterSpacing: '.08em',
              }}
              onClick={() => onSetSection('pipeline')}
            >
              Ver pipeline →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {topDeals.length === 0 && (
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.42rem',
                  color: mutedText,
                  padding: '16px 0',
                  textAlign: 'center',
                }}
              >
                Sem deals activos
              </div>
            )}
            {topDeals.map(d => {
              const val = parseFloat(d.valor.replace(/[^0-9.]/g, '')) || 0
              const pct = STAGE_PCT[d.fase] ?? 0
              const color = STAGE_COLOR[d.fase] ?? '#888'
              return (
                <div
                  key={d.id}
                  className="top-deal"
                  style={{
                    padding: '12px 8px',
                    borderBottom: `1px solid ${borderCol}`,
                    transition: 'background .15s',
                  }}
                  onClick={() => onSetSection('pipeline')}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '2px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: '.36rem',
                            color: mutedText,
                            letterSpacing: '.08em',
                          }}
                        >
                          {d.ref}
                        </span>
                        <span
                          style={{
                            padding: '1px 7px',
                            background: `${color}1a`,
                            color,
                            fontFamily: "'DM Mono',monospace",
                            fontSize: '.34rem',
                            letterSpacing: '.06em',
                          }}
                        >
                          {d.fase}
                        </span>
                      </div>
                      <div
                        style={{
                          fontFamily: "'Jost',sans-serif",
                          fontSize: '.84rem',
                          fontWeight: 500,
                          color: cardText,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.imovel}
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.38rem',
                          color: mutedText,
                          marginTop: '2px',
                        }}
                      >
                        {d.comprador}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Cormorant',serif",
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: '#c9a96e',
                        flexShrink: 0,
                        marginLeft: '12px',
                      }}
                    >
                      €{(val / 1e6).toFixed(2)}M
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      height: '3px',
                      background: darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.06)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        borderRadius: '2px',
                        transition: 'width .4s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.36rem',
                      color: mutedText,
                      marginTop: '4px',
                      textAlign: 'right',
                      letterSpacing: '.04em',
                    }}
                  >
                    {pct}% concluído
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 6 — QUICK ACTIONS 3×3
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: mutedText,
            marginBottom: '14px',
          }}
        >
          Ferramentas &amp; Módulos
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: '12px',
          }}
        >
          {QUICK_ACTIONS.map(a => (
            <div
              key={a.label}
              className="qa-card"
              style={{
                background: cardBg,
                border: `1px solid ${borderCol}`,
                padding: '16px 18px',
                cursor: 'pointer',
                transition: 'background .15s',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
              onClick={() => onSetSection(a.sec)}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  background: `${a.color}14`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={a.color}
                  strokeWidth="1.5"
                  width="20"
                  height="20"
                >
                  <path d={a.svg} />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'Jost',sans-serif",
                    fontSize: '.88rem',
                    fontWeight: 600,
                    color: cardText,
                    marginBottom: '3px',
                  }}
                >
                  {a.label}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.38rem',
                    color: mutedText,
                    letterSpacing: '.04em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.sub}
                </div>
              </div>
              <div
                className="qa-arrow"
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.7rem',
                  color: a.color,
                  opacity: 0,
                  transform: 'translateX(-4px)',
                  transition: 'all .15s',
                  flexShrink: 0,
                }}
              >
                →
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 7 — MARKET TICKER
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: '#1c4a35',
          padding: '10px 0',
          overflow: 'hidden',
          marginTop: '8px',
        }}
      >
        <div className="ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.42rem',
                color: '#c9a96e',
                letterSpacing: '.1em',
                flexShrink: 0,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
