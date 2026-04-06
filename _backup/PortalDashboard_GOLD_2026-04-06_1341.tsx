'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useDealStore } from '../stores/dealStore'
import { useCRMStore } from '../stores/crmStore'
import type { SectionId } from './types'
import { PIPELINE_STAGES, STAGE_PCT, STAGE_COLOR } from './constants'
import { useStaggerIn, useFadeIn } from '../hooks/useGSAPAnimations'
import { SkeletonKPIGrid } from './PortalSkeleton'
import Tooltip from './Tooltip'

interface PortalDashboardProps {
  agentName: string
  imoveisList?: Record<string, unknown>[]
  weeklyReport: Record<string, unknown> | null
  weeklyReportLoading: boolean
  onWeeklyReport: () => void
  onCloseWeeklyReport: () => void
  exportToPDF: (title: string, html: string) => void
  onSetSection: (s: SectionId) => void
}

// ─── KPI Card Interface ────────────────────────────────────────────────────────
interface KPICardData {
  title: string
  value: string
  sub: string
  badge: string
  badgeColor: string
  badgeBg: string
  color: string
  spark: number[]
  delta: number
  deltaPositive: boolean
  highlight?: boolean
  action?: () => void
  actionLabel?: string
}

// ─── Alert Interface ───────────────────────────────────────────────────────────
interface AlertItem {
  id: string
  level: 'critico' | 'atencao' | 'oportunidade'
  title: string
  sub: string
  sec: SectionId
  cta: string
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  if (data.length < 2) return null
  const w = 64, h = 28
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  // Calculate points
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - 4 - ((v - min) / range) * (h - 8),
  }))

  // Build smooth cubic bezier path
  function smoothPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return ''
    let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3
      const cp1y = points[i].y
      const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) / 3
      const cp2y = points[i + 1].y
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${points[i + 1].x.toFixed(1)},${points[i + 1].y.toFixed(1)}`
    }
    return d
  }

  const linePath = smoothPath(pts)
  const lastPt = pts[pts.length - 1]

  // Area path (close below the line)
  const areaPath = linePath + ` L ${w},${h} L 0,${h} Z`

  const gradId = `sg_${id}_${color.replace('#', '')}`

  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle cx={lastPt.x} cy={lastPt.y} r="2.5" fill={color} />
      <circle cx={lastPt.x} cy={lastPt.y} r="4" fill={color} fillOpacity="0.20" />
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

// ─── Portuguese currency parser (for Zustand store strings) ───────────────────
function parseValorLocal(s: string | undefined): number {
  if (!s) return 0
  // Strip €, spaces, then remove thousand-separator dots, then parse
  const cleaned = s.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(?:[,.]|$))/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
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

// ─── Stage velocity targets ───────────────────────────────────────────────────
const STAGE_TARGET_DAYS: Record<string, number> = {
  'Angariação': 14,
  'Proposta Enviada': 7,
  'Proposta Aceite': 5,
  'Due Diligence': 14,
  'CPCV Assinado': 30,
  'Financiamento': 21,
  'Escritura Marcada': 7,
  'Escritura Concluída': 0,
}

// ─── Simulated stage avg days (mock, derived from demo data) ──────────────────
const STAGE_AVG_DAYS: Record<string, number> = {
  'Angariação': 11,
  'Proposta Enviada': 9,
  'Proposta Aceite': 4,
  'Due Diligence': 18,
  'CPCV Assinado': 27,
  'Financiamento': 24,
  'Escritura Marcada': 6,
  'Escritura Concluída': 0,
}

// ─── Quick actions config ─────────────────────────────────────────────────────
const QUICK_ACTIONS: {
  label: string
  sub: string
  sec: SectionId
  color: string
  svg: string
  badge?: string
  badgeRed?: boolean
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
    badge: '3 novos',
    badgeRed: false,
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
  const [isLoadingKPIs, setIsLoadingKPIs] = useState(true)
  const [supabaseConnected, setSupabaseConnected] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => new Set())
  const [sofiaRefreshing, setSofiaRefreshing] = useState(false)
  const [sofiaTs, setSofiaTs] = useState(new Date())
  const [liveKPIs, setLiveKPIs] = useState<{
    pipeline: number
    deals: number
    commission: number
    closingNow: number
    contactCount: number
    source: 'live' | 'demo'
  }>({ pipeline: 0, deals: 0, commission: 0, closingNow: 0, contactCount: 0, source: 'demo' })

  // ── GSAP animation refs ──────────────────────────────────────────────────────
  const pageRef = useRef<HTMLDivElement>(null)
  const kpiGridRef = useRef<HTMLDivElement>(null)
  const actionsGridRef = useRef<HTMLDivElement>(null)

  useFadeIn(pageRef, { duration: 0.4 })
  useStaggerIn(kpiGridRef, '[data-stagger]', { delay: 0.1 })
  useStaggerIn(actionsGridRef, '[data-stagger]', { delay: 0.3 })

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // ── Supabase real data loader ─────────────────────────────────────────────
  const loadDashboardData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [kpiRes, activityRes, healthRes, dealsRes] = await Promise.allSettled([
        fetch('/api/automation/daily-brief', { signal }),
        fetch('/api/crm?limit=5', { signal }),
        fetch('/api/health', { signal }),
        fetch('/api/deals', { signal }),
      ])

      if (kpiRes.status === 'fulfilled' && kpiRes.value.ok) {
        setSupabaseConnected(true)
      } else {
        console.warn('[Dashboard] /api/automation/daily-brief failed:', kpiRes.status === 'rejected' ? kpiRes.reason : kpiRes.value.status)
      }
      // suppress unused warning — activityRes used for future enrichment
      if (activityRes.status === 'rejected') {
        console.warn('[Dashboard] /api/crm?limit=5 failed:', activityRes.reason)
      }

      // ── Parse /api/health for contact count ────────────────────────────────
      let contactCount = 0
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        try {
          const healthData = await healthRes.value.json()
          contactCount = healthData?.counts?.contacts ?? 0
          setSupabaseConnected(true)
        } catch { /* ignore */ }
      } else {
        console.warn('[Dashboard] /api/health failed:', healthRes.status === 'rejected' ? healthRes.reason : healthRes.value.status)
      }

      // ── Parse /api/deals for real pipeline KPIs ────────────────────────────
      if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
        // /api/deals succeeded — mark as connected even if health/brief failed
        setSupabaseConnected(true)
        try {
          const dealsData = await dealsRes.value.json()
          const rawDeals: { valor?: string; escrituraDate?: string; cpcvDate?: string }[] =
            Array.isArray(dealsData?.data) ? dealsData.data : []

          // Parse Portuguese-formatted currency strings: €1.250.000 → 1250000
          const parseValor = (s?: string): number => {
            if (!s) return 0
            // remove currency symbol, spaces, then replace thousand-dots before parsing
            const cleaned = s.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.')
            return parseFloat(cleaned) || 0
          }

          const totalPipelineValue = rawDeals.reduce((sum, d) => sum + parseValor(d.valor), 0)
          const activeDealCount = rawDeals.length
          const estimatedCommission = totalPipelineValue * 0.05
          const closingThisMonth = rawDeals.filter(
            d =>
              (d.escrituraDate && d.escrituraDate.includes('2026-04')) ||
              (d.cpcvDate && d.cpcvDate.includes('2026-04'))
          ).length

          if (activeDealCount > 0 || contactCount > 0) {
            setLiveKPIs({
              pipeline: totalPipelineValue,
              deals: activeDealCount,
              commission: estimatedCommission,
              closingNow: closingThisMonth,
              contactCount,
              source: 'live',
            })
          }
        } catch { /* silently fall back */ }
      } else {
        console.warn('[Dashboard] /api/deals failed:', dealsRes.status === 'rejected' ? dealsRes.reason : dealsRes.value.status)
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      // silently fall back to mock data
    } finally {
      setIsLoadingKPIs(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadDashboardData(controller.signal)
    const interval = setInterval(() => loadDashboardData(controller.signal), 5 * 60 * 1000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [loadDashboardData])

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const pipelineTotal = useMemo(() => deals.reduce((s, d) => s + parseValorLocal(d.valor), 0), [deals])

  const { closedDeals, cpcvDeals } = useMemo(() => ({
    closedDeals: deals.filter(d => d.fase === 'Escritura Concluída'),
    cpcvDeals: deals.filter(d => d.fase === 'CPCV Assinado'),
  }), [deals])

  const followUpsHoje = useMemo(() => crmContacts.filter(
    c => c.nextFollowUp && c.nextFollowUp <= today
  ).length, [crmContacts, today])

  const leadsNovos = useMemo(() => crmContacts.filter(c => {
    if (c.status !== 'lead') return false
    const created = c.createdAt ?? ''
    if (!created) return false
    const diffDays = (Date.now() - new Date(created).getTime()) / 86400000
    return diffDays <= 3 && !c.lastContact
  }).length, [crmContacts])

  const dealsUrgentes = useMemo(() => deals.filter(d => {
    if (d.fase === 'Escritura Concluída') return false
    const ref = d.cpcvDate || d.escrituraDate || ''
    if (!ref) return false
    const diff = (Date.now() - new Date(ref).getTime()) / 86400000
    return diff > 7
  }).length, [deals])

  const { leadsAtivos, vipContacts } = useMemo(() => ({
    leadsAtivos: crmContacts.filter(c => c.status === 'lead' || c.status === 'prospect').length,
    vipContacts: crmContacts.filter(c => c.status === 'vip').length,
  }), [crmContacts])

  const effectiveContactCount = liveKPIs.source === 'live' && liveKPIs.contactCount > 0
    ? liveKPIs.contactCount
    : crmContacts.length
  const convRate =
    effectiveContactCount > 0
      ? ((closedDeals.length / effectiveContactCount) * 100).toFixed(1)
      : '0.0'


  // ── Live KPI helpers: use real Supabase data when available ─────────────────
  const livePipeline = liveKPIs.source === 'live' ? liveKPIs.pipeline : pipelineTotal
  const liveDealCount = liveKPIs.source === 'live' ? liveKPIs.deals : deals.length
  const liveGCI = Math.round((liveKPIs.source === 'live' ? liveKPIs.commission : pipelineTotal * 0.05) / 1000)
  const liveClosingNow = liveKPIs.source === 'live' ? liveKPIs.closingNow : cpcvDeals.length
  const liveTotalContacts = liveKPIs.source === 'live' && liveKPIs.contactCount > 0 ? liveKPIs.contactCount : crmContacts.length

  // ── Stalled deals revenue at risk ────────────────────────────────────────────
  const stalledDeals = useMemo(() => deals.filter(d => {
    if (d.fase === 'Escritura Concluída') return false
    const ref = d.cpcvDate || d.escrituraDate || ''
    if (!ref) return false
    const diffDays = (Date.now() - new Date(ref).getTime()) / 86400000
    return diffDays > 5 && diffDays <= 14
  }), [deals])
  const stalledGCI = useMemo(() => stalledDeals.reduce((s, d) => {
    return s + parseValorLocal(d.valor) * 0.05
  }, 0), [stalledDeals])

  // ── Silent contacts (>18 days no touch, tier A/VIP) ───────────────────────
  const silentVIPs = useMemo(() => crmContacts.filter(c => {
    if (c.status !== 'vip') return false
    const last = c.lastContact || c.createdAt || ''
    if (!last) return true
    const diffDays = (Date.now() - new Date(last).getTime()) / 86400000
    return diffDays >= 18
  }), [crmContacts])

  // ── Categorised alerts ────────────────────────────────────────────────────
  const allAlerts: AlertItem[] = [
    // CRÍTICO
    ...(followUpsHoje > 0
      ? [{
          id: 'followup',
          level: 'critico' as const,
          title: `${followUpsHoje} follow-up${followUpsHoje > 1 ? 's' : ''} em atraso`,
          sub: 'Acção imediata requerida — clientes aguardam resposta',
          sec: 'crm' as SectionId,
          cta: '→ Abrir CRM',
        }]
      : []),
    ...(dealsUrgentes > 0
      ? [{
          id: 'deals-urgentes',
          level: 'critico' as const,
          title: `${dealsUrgentes} deal${dealsUrgentes > 1 ? 's' : ''} sem actividade há 7+ dias`,
          sub: 'Pipeline em risco — contacto urgente necessário',
          sec: 'pipeline' as SectionId,
          cta: '→ Ver Pipeline',
        }]
      : []),
    // ATENÇÃO
    ...(stalledDeals.length > 0
      ? [{
          id: 'stalled',
          level: 'atencao' as const,
          title: `${stalledDeals.length} deal${stalledDeals.length > 1 ? 's' : ''} parado${stalledDeals.length > 1 ? 's' : ''} (5–14 dias)`,
          sub: stalledGCI > 0 ? `€${Math.round(stalledGCI / 1000)}K em comissões em risco` : 'Seguimento recomendado',
          sec: 'pipeline' as SectionId,
          cta: '→ Analisar',
        }]
      : []),
    ...(leadsNovos > 0
      ? [{
          id: 'leads-novos',
          level: 'atencao' as const,
          title: `${leadsNovos} lead${leadsNovos > 1 ? 's novos' : ' novo'} sem 1º contacto`,
          sub: 'Contacto nas primeiras 24h aumenta conversão 3×',
          sec: 'crm' as SectionId,
          cta: '→ Contactar',
        }]
      : []),
    // OPORTUNIDADE
    ...(silentVIPs.length > 0
      ? [{
          id: 'silent-vip',
          level: 'oportunidade' as const,
          title: `${silentVIPs.length} VIP${silentVIPs.length > 1 ? 's' : ''} sem contacto há 18+ dias`,
          sub: `${silentVIPs[0]?.name ?? 'Cliente VIP'} pode estar a avaliar alternativas`,
          sec: 'crm' as SectionId,
          cta: '→ Reactivar',
        }]
      : []),
  ]

  const visibleAlerts = allAlerts.filter(a => !dismissedAlerts.has(a.id))

  // ── Pipeline by stage ────────────────────────────────────────────────────────
  const stageBreakdown = useMemo(() => PIPELINE_STAGES.map(stage => {
    const stageDeals = deals.filter(d => d.fase === stage)
    const stageVal = stageDeals.reduce((s, d) => s + parseValorLocal(d.valor), 0)
    return { stage, count: stageDeals.length, value: stageVal }
  }).filter(s => s.count > 0), [deals])

  const maxStageVal = Math.max(...stageBreakdown.map(s => s.value), 1)

  // ── Top contacts (5 most recent) ─────────────────────────────────────────────
  const recentContacts = useMemo(() => [...crmContacts]
    .sort((a, b) => {
      const da = new Date(a.lastContact || a.createdAt || '2000-01-01').getTime()
      const db = new Date(b.lastContact || b.createdAt || '2000-01-01').getTime()
      return db - da
    })
    .slice(0, 5), [crmContacts])

  // ── Top 3 deals by value ─────────────────────────────────────────────────────
  const topDeals = useMemo(() => [...deals]
    .filter(d => d.fase !== 'Escritura Concluída')
    .sort((a, b) => {
      const va = parseValorLocal(a.valor)
      const vb = parseValorLocal(b.valor)
      return vb - va
    })
    .slice(0, 3), [deals])

  // ── Sofia Insights (smart analysis from current state) ───────────────────────
  const sofiaInsights = {
    opportunity: silentVIPs.length > 0
      ? `"${silentVIPs[0]?.name ?? 'Cliente VIP'} está em silêncio há ${
          (() => {
            const lc = silentVIPs[0]?.lastContact
            if (!lc) return 18
            const d = new Date(lc)
            if (isNaN(d.getTime())) return 18
            return Math.floor((Date.now() - d.getTime()) / 86400000)
          })()
        } dias. Momento ideal para contacto com nova propriedade em linha com o seu perfil."`
      : `"Pipeline sólido com €${(pipelineTotal / 1e6).toFixed(1)}M activo. Foco em acelerar ${
          stageBreakdown[0]?.stage ?? 'fase inicial'
        } para maximizar GCI este trimestre."`,
    market: 'Lisboa +0,3% esta semana\nVolume transacções: ▲ 12%\nDOM médio: 198 dias (−5%)\nNovo: Cascais abaixo €4.500/m²',
    action: topDeals.length > 0
      ? `"${topDeals[0].ref} (${topDeals[0].fase}) está em negociação. Valor: ${topDeals[0].valor}. Seguimento proactivo pode acelerar fecho."`
      : `"Sem deals activos de alto valor. Prioridade: activar prospeção off-market esta semana."`,
    risk: stalledGCI > 0
      ? `€${Math.round(stalledGCI / 1000)}K em ${stalledDeals.length} deal${stalledDeals.length > 1 ? 's' : ''} parado${stalledDeals.length > 1 ? 's' : ''}.\nAccção necessária: seguimento urgente esta semana.`
      : `Pipeline em boa velocidade.\nSem receita em risco imediato.`,
  }

  // ── KPI Cards (8 total with enhanced data) ────────────────────────────────────
  const kpiCards: KPICardData[] = useMemo(() => [
    {
      title: 'GCI Previsto',
      value: `€${liveGCI}K`,
      sub: `5% do pipeline${liveKPIs.source === 'live' ? ' · LIVE' : ''}`,
      badge: '+12% vs mês ant.',
      badgeColor: '#4a9c7a',
      badgeBg: 'rgba(74,156,122,.12)',
      color: '#1c4a35',
      spark: [45, 52, 49, 61, 70, 80, liveGCI > 0 ? Math.min(liveGCI, 120) : 90],
      delta: 12,
      deltaPositive: true,
      highlight: liveGCI > 80,
    },
    {
      title: 'Pipeline Total',
      value: `€${(livePipeline / 1e6).toFixed(1)}M`,
      sub: `${liveDealCount} deals em progresso`,
      badge: `${liveDealCount} negócios`,
      badgeColor: '#c9a96e',
      badgeBg: 'rgba(201,169,110,.12)',
      color: '#c9a96e',
      spark: [1.2, 1.5, 1.4, 1.8, 2.1, 2.4, livePipeline > 0 ? Math.min(livePipeline / 1e6, 3.5) : 2.6],
      delta: 8,
      deltaPositive: true,
    },
    {
      title: 'Leads Activos',
      value: `${leadsAtivos}`,
      sub: `${leadsAtivos} prospects · ${vipContacts} VIPs`,
      badge: `${liveTotalContacts} no CRM`,
      badgeColor: '#3a7bd5',
      badgeBg: 'rgba(58,123,213,.1)',
      color: '#3a7bd5',
      spark: [8, 10, 9, 12, 14, 13, Math.max(leadsAtivos, 1)],
      delta: 6,
      deltaPositive: true,
    },
    {
      title: 'Follow-Ups Hoje',
      value: `${followUpsHoje}`,
      sub: followUpsHoje > 0 ? '⚠ Acção necessária' : '✓ Em dia',
      badge: followUpsHoje > 0 ? 'Urgente' : 'Em dia',
      badgeColor: followUpsHoje > 0 ? '#dc2626' : '#4a9c7a',
      badgeBg: followUpsHoje > 0 ? 'rgba(220,38,38,.08)' : 'rgba(74,156,122,.08)',
      color: followUpsHoje > 0 ? '#dc2626' : '#4a9c7a',
      spark: [2, 3, 1, 4, 2, 3, Math.max(followUpsHoje, 0)],
      delta: followUpsHoje > 2 ? -15 : 5,
      deltaPositive: followUpsHoje <= 2,
      action: () => onSetSection('crm'),
      actionLabel: 'Abrir CRM →',
    },
    {
      title: 'Deals CPCV',
      value: `${cpcvDeals.length}`,
      sub: `${liveClosingNow} a fechar em Abril`,
      badge: `${closedDeals.length} escrituras`,
      badgeColor: '#c9a96e',
      badgeBg: 'rgba(201,169,110,.12)',
      color: '#c9a96e',
      spark: [1, 2, 1, 3, 2, 3, Math.max(cpcvDeals.length, 0)],
      delta: 10,
      deltaPositive: true,
    },
    {
      title: 'Taxa Conversão',
      value: `${convRate}%`,
      sub: 'lead → escritura',
      badge: 'benchmark 8%',
      badgeColor: '#4a9c7a',
      badgeBg: 'rgba(74,156,122,.1)',
      color: '#4a9c7a',
      spark: [4.2, 4.8, 4.5, 5.1, 5.6, 5.4, parseFloat(convRate) || 5.9],
      delta: 3,
      deltaPositive: true,
    },
    {
      title: 'Ciclo Médio',
      value: '87d',
      sub: 'angariação → escritura',
      badge: 'benchmark 210d',
      badgeColor: '#888',
      badgeBg: 'rgba(136,136,136,.1)',
      color: '#888',
      spark: [95, 91, 89, 88, 90, 87, 87],
      delta: -4,
      deltaPositive: true,
      highlight: true,
    },
    {
      title: 'Mercado PT 2026',
      value: '+17,6%',
      sub: 'Lisboa top 5 mundial',
      badge: '€3.076/m² mediana',
      badgeColor: '#c9a96e',
      badgeBg: 'rgba(201,169,110,.08)',
      color: '#c9a96e',
      spark: [12, 13.5, 14, 15.2, 16, 16.8, 17.6],
      delta: 17.6,
      deltaPositive: true,
    },
  ], [liveGCI, livePipeline, liveDealCount, liveKPIs.source, leadsAtivos, vipContacts, liveTotalContacts, followUpsHoje, cpcvDeals, liveClosingNow, closedDeals, convRate, pipelineTotal, stageBreakdown])

  // ── Styles ───────────────────────────────────────────────────────────────────
  const cardBg = darkMode ? '#0f1e16' : '#ffffff'
  const cardText = darkMode ? '#f4f0e6' : '#0e0e0d'
  const mutedText = darkMode ? 'rgba(240,237,228,.55)' : 'rgba(14,14,13,.50)'
  const borderCol = darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.07)'

  const greeting =
    currentTime.getHours() < 12
      ? 'Bom dia'
      : currentTime.getHours() < 19
      ? 'Boa tarde'
      : 'Boa noite'

  return (
    <div ref={pageRef} style={{ fontFamily: "'Jost',sans-serif" }}>
      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseGreen { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        .ticker-inner { animation: ticker 40s linear infinite; display: flex; gap: 48px; white-space: nowrap; }
        .ticker-inner:hover { animation-play-state: paused; }
        .qa-card:hover { background: ${darkMode ? 'rgba(28,74,53,.18)' : 'rgba(28,74,53,.06)'} !important; }
        .qa-card:hover .qa-arrow { opacity: 1 !important; transform: translateX(0) !important; }
        .pipeline-row:hover { background: ${darkMode ? 'rgba(28,74,53,.15)' : 'rgba(28,74,53,.04)'} !important; cursor: pointer; }
        .recent-row:hover { background: ${darkMode ? 'rgba(28,74,53,.15)' : 'rgba(28,74,53,.04)'} !important; cursor: pointer; }
        .top-deal:hover { background: ${darkMode ? 'rgba(201,169,110,.12)' : 'rgba(201,169,110,.06)'} !important; cursor: pointer; }
        .kpi-card { transition: box-shadow .2s ease-out, transform .15s cubic-bezier(.4,0,.2,1); }
        .kpi-card:hover { box-shadow: 0 6px 32px rgba(28,74,53,.14); transform: translateY(-2px); }
        .alert-item { animation: fadeIn .25s ease; }
        .alert-item:hover { opacity: 0.95; }
        .alert-item button:hover { opacity: 0.75; }
        .sofia-card:hover { background: ${darkMode ? 'rgba(28,74,53,.14)' : 'rgba(28,74,53,.04)'} !important; }
        .pulse-dot { animation: pulseGreen 2s ease-in-out infinite; }
        button:focus-visible { outline: 2px solid #c9a96e; outline-offset: 2px; }
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
          .qa-grid { grid-template-columns: repeat(2,1fr) !important; }
          .side-panels { grid-template-columns: 1fr !important; }
          .pipeline-section { display: none !important; }
        }
        @media (max-width: 480px) {
          .kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
          .qa-grid { grid-template-columns: 1fr !important; }
          .side-panels { grid-template-columns: 1fr !important; }
        }
        .pipeline-row { transition: background .15s ease; }
        .recent-row { transition: background .15s ease; }
        .top-deal { transition: background .15s ease; }
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
              fontSize: '.52rem',
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
            <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>{agentName || 'Agente'}</em>.
          </div>
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              color: mutedText,
              marginTop: '6px',
              letterSpacing: '.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {currentTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} ·{' '}
              {liveDealCount} deals activos · pipeline €{(livePipeline / 1e6).toFixed(2)}M
            </span>
            {/* ── Supabase status badge ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                className={supabaseConnected ? 'pulse-dot' : ''}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isLoadingKPIs ? '#888' : supabaseConnected ? '#22c55e' : '#f59e0b',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  color: '#c9a96e',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                }}
              >
                {isLoadingKPIs ? 'SYNC' : supabaseConnected ? 'LIVE' : 'DEMO'}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
        >
          <button
            type="button"
            style={{
              padding: '6px 14px',
              background: weeklyReport
                ? 'rgba(201,169,110,.12)'
                : darkMode ? 'rgba(28,74,53,.35)' : 'rgba(28,74,53,.06)',
              border: `1px solid ${weeklyReport ? 'rgba(201,169,110,.3)' : 'rgba(28,74,53,.4)'}`,
              color: weeklyReport ? '#c9a96e' : darkMode ? '#a8d4b8' : '#1c4a35',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              letterSpacing: '.08em',
              cursor: 'pointer',
              transition: 'all .15s',
              borderRadius: '4px',
              opacity: weeklyReportLoading ? 0.7 : 1,
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
              borderRadius: '4px',
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
                fontSize: '.52rem',
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
              borderRadius: '4px',
            }}
          >
            <span
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
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
      {!!weeklyReport && (
        <div
          style={{
            background: darkMode ? 'linear-gradient(135deg,#0c1f15,#1a3d2a)' : 'linear-gradient(135deg,#f8f7f4,#eaf0eb)',
            padding: '20px 24px',
            marginBottom: '24px',
            border: '1px solid rgba(201,169,110,.15)',
            borderRadius: '12px',
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
                  fontSize: '.52rem',
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
                  color: darkMode ? '#f4f0e6' : '#0e0e0d',
                  fontWeight: 300,
                }}
              >
                {String(weeklyReport.title)}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  color: darkMode ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.4)',
                  marginTop: '2px',
                }}
              >
                {String(weeklyReport.period)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{
                  padding: '5px 12px',
                  background: 'rgba(244,240,230,.06)',
                  border: '1px solid rgba(244,240,230,.1)',
                  color: 'rgba(244,240,230,.5)',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  cursor: 'pointer',
                  letterSpacing: '.06em',
                  borderRadius: '4px',
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
                type="button"
                style={{
                  padding: '5px 12px',
                  background: 'rgba(244,240,230,.06)',
                  border: '1px solid rgba(244,240,230,.1)',
                  color: 'rgba(244,240,230,.5)',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                onClick={onCloseWeeklyReport}
                aria-label="Fechar relatório"
              >
                × Fechar
              </button>
            </div>
          </div>
          <div
            style={{
              fontFamily: "'Jost',sans-serif",
              fontSize: '.82rem',
              color: darkMode ? 'rgba(244,240,230,.7)' : 'rgba(14,14,13,.75)',
              lineHeight: 1.7,
              marginBottom: '16px',
              padding: '12px 14px',
              background: 'rgba(255,255,255,.04)',
              borderLeft: '3px solid rgba(201,169,110,.4)',
              borderRadius: '4px',
            }}
          >
            {String(weeklyReport.executiveSummary)}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 2 — PAINEL DE ALERTAS CATEGORIZADO
      ══════════════════════════════════════════════════════════════════════ */}
      {visibleAlerts.length > 0 && (
        <div
          style={{
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: '.60rem',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: mutedText,
              marginBottom: '8px',
            }}
          >
            ⚠ Alertas activos — {visibleAlerts.length} item{visibleAlerts.length > 1 ? 's' : ''}
          </div>
          {visibleAlerts.map(a => {
            const lvlMap = {
              critico: { border: '#dc2626', bg: 'rgba(220,38,38,.07)', dot: '#dc2626', label: 'CRÍTICO' },
              atencao: { border: '#f59e0b', bg: 'rgba(245,158,11,.07)', dot: '#f59e0b', label: 'ATENÇÃO' },
              oportunidade: { border: '#22c55e', bg: 'rgba(34,197,94,.07)', dot: '#22c55e', label: 'OPORTUNIDADE' },
            }
            const lv = lvlMap[a.level]
            return (
              <div
                key={a.id}
                className="alert-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: lv.bg,
                  border: `1px solid ${lv.border}30`,
                  borderLeft: `3px solid ${lv.border}`,
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: lv.dot,
                    flexShrink: 0,
                  }}
                />
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
                        fontSize: '.52rem',
                        letterSpacing: '.1em',
                        color: lv.dot,
                        textTransform: 'uppercase',
                      }}
                    >
                      {lv.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '.84rem',
                        fontWeight: 600,
                        color: cardText,
                      }}
                    >
                      {a.title}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      color: mutedText,
                      letterSpacing: '.04em',
                    }}
                  >
                    {a.sub}
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    padding: '4px 12px',
                    background: 'transparent',
                    border: `1px solid ${lv.border}60`,
                    color: lv.dot,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    flexShrink: 0,
                    transition: 'all .15s',
                    borderRadius: '4px',
                  }}
                  onClick={() => onSetSection(a.sec)}
                >
                  {a.cta}
                </button>
                <button
                  type="button"
                  style={{
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: `1px solid ${borderCol}`,
                    color: mutedText,
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    lineHeight: 1,
                    borderRadius: '4px',
                    transition: 'opacity .15s ease',
                  }}
                  onClick={() => setDismissedAlerts(prev => new Set([...prev, a.id]))}
                  title="Dispensar"
                  aria-label="Dispensar alerta"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 3 — KPI GRID 4×2 COM SPARKLINES + DELTA
      ══════════════════════════════════════════════════════════════════════ */}
      {isLoadingKPIs ? (
        <div style={{ marginBottom: '28px' }}>
          <SkeletonKPIGrid darkMode={darkMode} />
        </div>
      ) : (
      <div
        ref={kpiGridRef}
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px',
          marginBottom: '28px',
        }}
      >
        {kpiCards.map((kpi) => (
          <div
            key={kpi.title}
            data-stagger=""
            className={`kpi-card animate-fade-up`}
            style={{
              background: cardBg,
              border: `1px solid ${kpi.highlight ? kpi.color + '40' : borderCol}`,
              padding: '18px 20px',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '12px',
            }}
          >
            {/* Best month indicator */}
            {!!kpi.highlight && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: kpi.color,
                  color: '#ffffff',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  letterSpacing: '.08em',
                  padding: '2px 7px',
                  borderRadius: '0 12px 0 6px',
                  textTransform: 'uppercase',
                }}
              >
                ★ BEST
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.54rem',
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: mutedText,
                    marginBottom: '6px',
                  }}
                >
                  {kpi.title}
                </div>
                <div
                  style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.8rem',
                    fontWeight: 600,
                    color: kpi.color,
                    lineHeight: 1,
                    marginBottom: '4px',
                  }}
                >
                  {kpi.value}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.60rem',
                    color: mutedText,
                    lineHeight: 1.4,
                    marginBottom: '8px',
                  }}
                >
                  {kpi.sub}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 7px',
                      background: kpi.badgeBg,
                      color: kpi.badgeColor,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      letterSpacing: '.06em',
                      borderRadius: '4px',
                    }}
                  >
                    {kpi.badge}
                  </span>
                  {/* WoW delta badge */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '2px 6px',
                      background: kpi.deltaPositive ? 'rgba(74,156,122,.10)' : 'rgba(220,38,38,.10)',
                      color: kpi.deltaPositive ? '#4a9c7a' : '#dc2626',
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      letterSpacing: '.06em',
                      borderRadius: '4px',
                    }}
                  >
                    {kpi.deltaPositive ? '▲' : '▼'} {Math.abs(kpi.delta)}%
                  </span>
                </div>
                {!!kpi.action && (
                  <button
                    type="button"
                    style={{
                      marginTop: '8px',
                      padding: '3px 10px',
                      background: kpi.deltaPositive
                        ? 'rgba(74,156,122,.08)'
                        : 'rgba(220,38,38,.08)',
                      border: `1px solid ${kpi.deltaPositive ? 'rgba(74,156,122,.3)' : 'rgba(220,38,38,.3)'}`,
                      color: kpi.color,
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      cursor: 'pointer',
                      letterSpacing: '.04em',
                      borderRadius: '4px',
                      transition: 'all .15s',
                    }}
                    onClick={kpi.action}
                  >
                    {kpi.actionLabel ?? 'Ver →'}
                  </button>
                )}
              </div>
              <div style={{ flexShrink: 0, marginLeft: '8px' }}>
                <Sparkline data={kpi.spark} color={kpi.color} id={kpi.title.replace(/\s/g, '')} />
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 4 — PIPELINE VISUAL + VELOCIDADE
      ══════════════════════════════════════════════════════════════════════ */}
      {stageBreakdown.length > 0 && (
        <div
          className="pipeline-section"
          style={{
            background: cardBg,
            border: `1px solid ${borderCol}`,
            padding: '22px 24px',
            marginBottom: '24px',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
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
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: darkMode ? '#6fcf97' : '#1c4a35',
                cursor: 'pointer',
                letterSpacing: '.08em',
                transition: 'opacity .15s ease',
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
              const avgDays = STAGE_AVG_DAYS[s.stage] ?? 0
              const targetDays = STAGE_TARGET_DAYS[s.stage] ?? 999
              const velocityOk = avgDays <= targetDays
              return (
                <div
                  key={s.stage}
                  className="pipeline-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(80px, 160px) 1fr minmax(60px, 120px)',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    transition: 'background .15s',
                  }}
                  onClick={() => onSetSection('pipeline')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: '.60rem',
                            color: cardText,
                            letterSpacing: '.04em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
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
                            fontSize: '.52rem',
                            color,
                            flexShrink: 0,
                          }}
                        >
                          {s.count}
                        </span>
                      </div>
                      {/* Velocity row */}
                      {avgDays > 0 && (
                        <div
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: '.52rem',
                            color: velocityOk ? '#4a9c7a' : '#dc2626',
                            letterSpacing: '.04em',
                            marginTop: '2px',
                          }}
                        >
                          {velocityOk ? '✓' : '⚠'} ~{avgDays}d {velocityOk ? '(dentro do alvo)' : `(alvo: ${targetDays}d)`}
                        </div>
                      )}
                    </div>
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
                      fontFamily: "'Cormorant',serif",
                      fontSize: '.75rem',
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
          {/* Velocity legend */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: `1px solid ${borderCol}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4a9c7a' }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: mutedText, fontWeight: 500 }}>
                Dentro do alvo de velocidade
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: mutedText, fontWeight: 500 }}>
                Acima do alvo — acção requerida
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 5 — SOFIA INSIGHTS 2×2
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: darkMode ? '#0f1e16' : 'linear-gradient(135deg,#fafaf8,#f4f0e6)',
          border: `1px solid ${borderCol}`,
          marginBottom: '24px',
          overflow: 'hidden',
          borderRadius: '12px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: `1px solid ${borderCol}`,
            background: darkMode ? 'rgba(28,74,53,.3)' : 'rgba(28,74,53,.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                background: '#1c4a35',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '.75rem',
              }}
            >
              🤖
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: darkMode ? '#6fcf97' : '#1c4a35',
                  fontWeight: 600,
                }}
              >
                Sofia Insights
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  color: mutedText,
                  marginTop: '1px',
                }}
              >
                Análise inteligente · {sofiaTs.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{
              padding: '5px 14px',
              background: 'transparent',
              border: `1px solid ${darkMode ? 'rgba(111,207,151,.2)' : 'rgba(28,74,53,.2)'}`,
              color: darkMode ? '#6fcf97' : '#1c4a35',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.52rem',
              cursor: sofiaRefreshing ? 'not-allowed' : 'pointer',
              letterSpacing: '.06em',
              opacity: sofiaRefreshing ? 0.5 : 1,
              transition: 'all .15s',
              borderRadius: '4px',
            }}
            disabled={sofiaRefreshing}
            onClick={() => {
              setSofiaRefreshing(true)
              setTimeout(() => {
                setSofiaRefreshing(false)
                setSofiaTs(new Date())
              }, 1200)
            }}
          >
            {sofiaRefreshing ? '✦ A actualizar...' : '↻ Refresh'}
          </button>
        </div>

        {/* 2×2 Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'auto auto',
          }}
        >
          {/* Cell 1 — Oportunidade do Dia */}
          <div
            className="sofia-card"
            style={{
              padding: '18px 20px',
              borderRight: `1px solid ${borderCol}`,
              borderBottom: `1px solid ${borderCol}`,
              transition: 'background .15s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '.9rem' }}>💡</span>
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: '#c9a96e',
                }}
              >
                Oportunidade do Dia
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Jost',sans-serif",
                fontSize: '.82rem',
                color: cardText,
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            >
              {sofiaInsights.opportunity}
            </div>
          </div>

          {/* Cell 2 — Mercado Hoje */}
          <div
            className="sofia-card"
            style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${borderCol}`,
              transition: 'background .15s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '.9rem' }}>📊</span>
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: '#3a7bd5',
                }}
              >
                Mercado Hoje
              </span>
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: cardText,
                lineHeight: 1.9,
                whiteSpace: 'pre-line',
              }}
            >
              {sofiaInsights.market}
            </div>
          </div>

          {/* Cell 3 — Acção Prioritária */}
          <div
            className="sofia-card"
            style={{
              padding: '18px 20px',
              borderRight: `1px solid ${borderCol}`,
              transition: 'background .15s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '.9rem' }}>🎯</span>
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: darkMode ? '#6fcf97' : '#1c4a35',
                }}
              >
                Acção Prioritária
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Jost',sans-serif",
                fontSize: '.82rem',
                color: cardText,
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            >
              {sofiaInsights.action}
            </div>
            {topDeals.length > 0 && (
              <button
                type="button"
                style={{
                  marginTop: '12px',
                  padding: '4px 12px',
                  background: darkMode ? 'rgba(28,74,53,.25)' : 'rgba(28,74,53,.06)',
                  border: `1px solid ${darkMode ? 'rgba(111,207,151,.25)' : 'rgba(28,74,53,.2)'}`,
                  color: darkMode ? '#6fcf97' : '#1c4a35',
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  cursor: 'pointer',
                  letterSpacing: '.06em',
                  borderRadius: '4px',
                }}
                onClick={() => onSetSection('pipeline')}
              >
                → Ver Pipeline
              </button>
            )}
          </div>

          {/* Cell 4 — Receita em Risco */}
          <div
            className="sofia-card"
            style={{
              padding: '18px 20px',
              borderLeft: stalledDeals.length > 0 ? '3px solid rgba(220,38,38,.4)' : 'none',
              transition: 'background .15s',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '.9rem' }}>💰</span>
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.54rem',
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: stalledDeals.length > 0 ? '#dc2626' : '#4a9c7a',
                }}
              >
                Receita em Risco
              </span>
            </div>
            {stalledDeals.length > 0 ? (
              <>
                <div
                  style={{
                    fontFamily: "'Cormorant',serif",
                    fontSize: '1.6rem',
                    fontWeight: 600,
                    color: '#dc2626',
                    lineHeight: 1,
                    marginBottom: '4px',
                  }}
                >
                  €{Math.round(stalledGCI / 1000)}K
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    color: mutedText,
                    whiteSpace: 'pre-line',
                    lineHeight: 1.7,
                  }}
                >
                  {sofiaInsights.risk}
                </div>
                <button
                  type="button"
                  style={{
                    marginTop: '10px',
                    padding: '4px 12px',
                    background: 'rgba(220,38,38,.06)',
                    border: '1px solid rgba(220,38,38,.25)',
                    color: '#dc2626',
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '.52rem',
                    cursor: 'pointer',
                    letterSpacing: '.06em',
                    borderRadius: '4px',
                  }}
                  onClick={() => onSetSection('pipeline')}
                >
                  → Seguimento urgente
                </button>
              </>
            ) : (
              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: '.52rem',
                  color: '#4a9c7a',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                }}
              >
                {sofiaInsights.risk}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 6 — DOIS PAINÉIS LADO A LADO
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="side-panels"
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
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
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
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: darkMode ? '#6fcf97' : '#1c4a35',
                cursor: 'pointer',
                letterSpacing: '.08em',
                transition: 'opacity .15s ease',
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
                  fontSize: '.52rem',
                  color: mutedText,
                  padding: '16px 0',
                  textAlign: 'center',
                }}
              >
                📋 Sem contactos no CRM
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
              const needsFollowUp = c.nextFollowUp && c.nextFollowUp <= today
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
                    position: 'relative',
                  }}
                  onClick={() => onSetSection('crm')}
                >
                  {/* Priority dot */}
                  {!!needsFollowUp && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '8px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#dc2626',
                      }}
                    />
                  )}
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
                      fontSize: '.62rem',
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
                          fontSize: '.52rem',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                          borderRadius: '3px',
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: '.52rem',
                        color: mutedText,
                        letterSpacing: '.04em',
                      }}
                    >
                      {c.nationality || '—'} · €{((c.budgetMax ?? 0) / 1000).toFixed(0)}K max · {timeAgo}
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
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
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
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: "'DM Mono',monospace",
                fontSize: '.52rem',
                color: darkMode ? '#6fcf97' : '#1c4a35',
                cursor: 'pointer',
                letterSpacing: '.08em',
                transition: 'opacity .15s ease',
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
                  fontSize: '.52rem',
                  color: mutedText,
                  padding: '16px 0',
                  textAlign: 'center',
                }}
              >
                🏠 Sem deals activos
              </div>
            )}
            {topDeals.map(d => {
              const val = parseValorLocal(d.valor)
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
                      flexWrap: 'wrap',
                      gap: '4px',
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
                            fontSize: '.52rem',
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
                            fontSize: '.52rem',
                            letterSpacing: '.06em',
                            borderRadius: '4px',
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
                          fontSize: '.52rem',
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
                      fontSize: '.52rem',
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
          SECÇÃO 7 — QUICK ACTIONS 3×3
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.52rem',
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: mutedText,
            marginBottom: '14px',
          }}
        >
          Ferramentas &amp; Módulos
        </div>
        <div
          ref={actionsGridRef}
          className="qa-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: '14px',
          }}
        >
          {QUICK_ACTIONS.map(a => {
            const needsAction = a.sec === 'crm' && followUpsHoje > 0
            return (
              <Tooltip key={a.label} content={a.sub} darkMode={darkMode} position="top">
              <div
                data-stagger=""
                className="qa-card"
                role="button"
                tabIndex={0}
                style={{
                  background: cardBg,
                  border: `1px solid ${needsAction ? 'rgba(220,38,38,.25)' : borderCol}`,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'background .15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  position: 'relative',
                  borderRadius: '12px',
                }}
                onClick={() => onSetSection(a.sec)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSetSection(a.sec) } }}
              >
                {/* Priority indicator */}
                {!!needsAction && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#dc2626',
                    }}
                  />
                )}
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    background: darkMode ? `${a.color}28` : `${a.color}14`,
                    borderRadius: '6px',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <div
                      style={{
                        fontFamily: "'Jost',sans-serif",
                        fontSize: '.88rem',
                        fontWeight: 600,
                        color: cardText,
                      }}
                    >
                      {a.label}
                    </div>
                    {/* Badge count */}
                    {!!a.badge && (
                      <span
                        style={{
                          padding: '1px 6px',
                          background: a.badgeRed ? 'rgba(220,38,38,.1)' : darkMode ? 'rgba(28,74,53,.35)' : 'rgba(28,74,53,.08)',
                          color: a.badgeRed ? '#dc2626' : darkMode ? '#6fcf97' : '#1c4a35',
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.54rem',
                          letterSpacing: '.06em',
                          borderRadius: '2px',
                          flexShrink: 0,
                        }}
                      >
                        {a.badge}
                      </span>
                    )}
                    {/* CRM follow-up count */}
                    {a.sec === 'crm' && followUpsHoje > 0 && (
                      <span
                        style={{
                          padding: '1px 6px',
                          background: 'rgba(220,38,38,.1)',
                          color: '#dc2626',
                          fontFamily: "'DM Mono',monospace",
                          fontSize: '.54rem',
                          letterSpacing: '.06em',
                          borderRadius: '2px',
                          flexShrink: 0,
                        }}
                      >
                        {followUpsHoje} urgente{followUpsHoje > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: '.52rem',
                      color: mutedText,
                      letterSpacing: '.04em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.4,
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
                    transition: 'opacity .15s ease, transform .15s ease',
                    flexShrink: 0,
                  }}
                >
                  →
                </div>
              </div>
              </Tooltip>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECÇÃO 8 — MARKET TICKER
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: '#1c4a35',
          padding: '10px 0',
          overflow: 'hidden',
          marginTop: '8px',
          borderRadius: '12px',
        }}
      >
        <div className="ticker-inner">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={`t-${i}`}
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.54rem',
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

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE BOTTOM TAB BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <style>{`
        .mobile-tabs { display: none; }
        @media (max-width: 768px) {
          .mobile-tabs {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            border-top: 1px solid rgba(14,14,13,.08);
            z-index: 100;
            padding: 6px 0 env(safe-area-inset-bottom, 6px);
          }
        }
      `}</style>
      <div className="mobile-tabs" style={{ background: darkMode ? '#0f1e16' : '#ffffff' }}>
        {([
          { label: 'Dashboard', sec: 'dashboard' as SectionId, svg: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
          { label: 'CRM', sec: 'crm' as SectionId, svg: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
          { label: 'Pipeline', sec: 'pipeline' as SectionId, svg: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
          { label: 'Radar', sec: 'radar' as SectionId, svg: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
        ] as { label: string; sec: SectionId; svg: string }[]).map(tab => (
          <button
            type="button"
            key={tab.sec}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              padding: '8px 4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: darkMode ? '#6fcf97' : '#1c4a35',
            }}
            onClick={() => onSetSection(tab.sec)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <path d={tab.svg} />
            </svg>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.06em', color: darkMode ? '#f4f0e6' : '#0e0e0d' }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
