// AGENCY GROUP — SH-ROS Control Tower: Live Dashboard | AMI: 22506
// Stripe-inspired 5-panel operational dashboard (RSC — no 'use client')
// Layout: Revenue Intelligence (full) · AI Timeline (60%) + Token Budget (40%) · DLQ (50%) + Causal Trace (50%)
// =============================================================================

import { Suspense } from 'react'
import { ReplayButton } from './ReplayButton'

export const revalidate = 30 // ISR 30s

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIDecision {
  id?: string
  circuit_name?: string
  agent_id?: string
  model?: string
  latency_ms?: number
  success?: boolean
  fallback_used?: boolean
  revenue_context?: string
  created_at?: string
}

interface AIDecisionsData {
  decisions: AIDecision[]
  summary: {
    total: number
    fallback_count: number
    error_count: number
    avg_latency_ms: number
  }
}

interface BudgetEntry {
  agentId: string
  displayName?: string
  monthlyBudget: number
  tokensUsed: number
  utilizationPct: number
  withinBudget: boolean
  remainingTokens: number
}

interface BudgetData {
  budgets: BudgetEntry[]
  month: string
  tenantId: string
}

interface DLQEvent {
  id: string
  event_type: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface DLQData {
  total: number
  by_type: Record<string, number>
  events: DLQEvent[]
}

interface CausalStep {
  id?: string
  correlation_id: string
  tenant_id: string
  step_type: string
  entity_type?: string
  entity_id?: string
  agent_id?: string
  model?: string
  action?: string
  revenue_delta?: number
  latency_ms?: number
  success: boolean
  error_message?: string
  created_at: string
}

// Revenue / pipeline types (from productAPI.loadDashboard)
interface PipelineData {
  pipeline_value: number
  expected_revenue: number
  commission_mtd: number
  hot_leads: number
  active_leads: number
  proposals_pending: number
  deals_in_progress: number
  close_rate_30d: number | null
  deals_won_mtd: number
}

interface FunnelStage {
  stage: string
  count: number
  total_value: number
  conversion_rate: number
  avg_days: number
  revenue_at_risk: number
}

interface FunnelData {
  stages: FunnelStage[]
  total_pipeline: number
  total_expected: number
  projected_revenue: number
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

const BASE   = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
const BEARER = `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}`

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: BEARER },
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

// Revenue data fetched via server-side import (avoids HTTP roundtrip)
async function fetchRevenueData(): Promise<{ pipeline: PipelineData; funnel: FunnelData } | null> {
  try {
    const { productAPI, revenueOutcomeMapper } = await import('@/lib/product')
    const [dashboard, funnel] = await Promise.all([
      productAPI.loadDashboard({ org_id: 'system', agent_id: 'control-tower' }),
      revenueOutcomeMapper.buildFunnel('system'),
    ])
    return {
      pipeline: dashboard.pipeline as unknown as PipelineData,
      funnel:   funnel as unknown as FunnelData,
    }
  } catch {
    return null
  }
}

// Causal steps — browse recent rows directly from Supabase (RSC server context)
async function fetchRecentCausalSteps(limit = 10): Promise<CausalStep[]> {
  if (process.env.CAUSAL_TRACE_ENABLED === 'false') return []
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient<any>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await sb
      .from('causal_trace')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data ?? []) as CausalStep[]
  } catch {
    return []
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function eur(v: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: v >= 1_000_000 ? 2 : 0,
    notation: v >= 1_000_000 ? 'compact' : 'standard',
  }).format(v)
}

function pctFmt(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)     return `${Math.round(diff / 1_000)}s ago`
  if (diff < 3_600_000)  return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function Card({ title, children, className = '' }: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-5 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
      {children}
    </div>
  )
}

// ─── Agent badge colors ───────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  sofia:          'bg-violet-900 text-violet-300',
  'lead-scorer':  'bg-blue-900 text-blue-300',
  'deal-radar':   'bg-amber-900 text-amber-300',
  juridico:       'bg-rose-900 text-rose-300',
  avm:            'bg-teal-900 text-teal-300',
  crm:            'bg-indigo-900 text-indigo-300',
}

function agentBadgeColor(agentId?: string): string {
  if (!agentId) return 'bg-gray-800 text-gray-400'
  const key = agentId.toLowerCase()
  for (const [prefix, cls] of Object.entries(AGENT_COLORS)) {
    if (key.includes(prefix)) return cls
  }
  return 'bg-gray-800 text-gray-400'
}

// ─── Causal step type icons ───────────────────────────────────────────────────

function causalIcon(stepType: string): string {
  switch (stepType) {
    case 'ai_decision':    return '🟣'
    case 'revenue_outcome': return '🟢'
    case 'error':          return '🔴'
    default:               return '🔵'
  }
}

// ─── PANEL 1 — Revenue Intelligence (full width) ──────────────────────────────

async function RevenueIntelligencePanel() {
  const data = await fetchRevenueData()
  const p = data?.pipeline
  const f = data?.funnel

  const commissionForecast = p ? (p.pipeline_value ?? 0) * 0.05 : null
  const activeDealCount    = p ? (p.deals_in_progress ?? 0) : null
  const avgDealSize        = p && p.deals_in_progress > 0
    ? (p.pipeline_value ?? 0) / p.deals_in_progress
    : null

  const kpis = [
    {
      label: 'Pipeline Value',
      value: p ? eur(p.pipeline_value ?? 0) : '—',
      trend: '↑',
      trendUp: true,
      sub: 'Total active pipeline',
    },
    {
      label: 'Commission Forecast',
      value: commissionForecast != null ? eur(commissionForecast) : '—',
      trend: '↑',
      trendUp: true,
      sub: 'Pipeline × 5%',
    },
    {
      label: 'Active Deals',
      value: activeDealCount != null ? String(activeDealCount) : '—',
      trend: '→',
      trendUp: null,
      sub: `${p?.proposals_pending ?? 0} proposals pending`,
    },
    {
      label: 'Avg Deal Size',
      value: avgDealSize != null ? eur(avgDealSize) : '—',
      trend: '↑',
      trendUp: true,
      sub: `Close rate ${p ? (p.close_rate_30d != null ? pctFmt(p.close_rate_30d) : '—') : '—'} (30d)`,
    },
  ]

  const stageColors = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-600']

  return (
    <Card title="Revenue Intelligence">
      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl font-bold text-white leading-none">{k.value}</span>
              <span className={`text-sm font-semibold leading-none ${
                k.trendUp === true  ? 'text-emerald-400'
                : k.trendUp === false ? 'text-red-400'
                : 'text-gray-500'
              }`}>
                {k.trend}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-gray-600">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Additional deal counts */}
      {p && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Active Leads',    value: p.active_leads,     color: 'text-blue-400' },
            { label: 'Hot Leads',       value: p.hot_leads,        color: 'text-amber-400' },
            { label: 'Proposals',       value: p.proposals_pending, color: 'text-violet-400' },
            { label: 'In Progress',     value: p.deals_in_progress, color: 'text-white' },
            { label: 'Won MTD',         value: p.deals_won_mtd,    color: 'text-emerald-400' },
            { label: 'Commission MTD',  value: eur(p.commission_mtd ?? 0), color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`mt-1 text-base font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Funnel bars */}
      {f && f.stages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Funnel</p>
          {f.stages.map((stage, i) => {
            const width = f.total_pipeline > 0
              ? Math.max(4, (stage.total_value / f.total_pipeline) * 100)
              : 4
            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="w-32 truncate text-[11px] text-gray-500">{stage.stage}</span>
                <div className="flex-1 h-4 rounded bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full ${stageColors[i % stageColors.length]} flex items-center px-1.5`}
                    style={{ width: `${width}%` }}
                  >
                    <span className="text-white text-[9px] font-mono">{stage.count}</span>
                  </div>
                </div>
                <span className="w-24 text-right text-[11px] font-mono text-gray-400">{eur(stage.total_value)}</span>
                <span className="w-10 text-right text-[10px] text-gray-600">{(stage.conversion_rate * 100).toFixed(0)}%</span>
              </div>
            )
          })}
          <p className="text-[11px] text-gray-600 font-mono pt-1">
            Projected: <span className="text-emerald-400">{eur(f.projected_revenue ?? 0)}</span>
          </p>
        </div>
      )}

      {!p && (
        <p className="text-sm text-gray-600 font-mono">Pipeline data unavailable — check productAPI</p>
      )}
    </Card>
  )
}

// ─── PANEL 2 — AI Decision Timeline (60%) ────────────────────────────────────

async function AIDecisionTimelinePanel() {
  const data = await fetchJSON<AIDecisionsData>('/api/control-tower/ai-decisions?limit=20')

  if (!data) {
    return (
      <Card title="AI Decision Timeline">
        <p className="text-sm text-gray-600 font-mono">
          No AI decisions recorded yet — enable <code className="bg-gray-800 px-1 rounded">AI_AUDIT_ENABLED=true</code>
        </p>
      </Card>
    )
  }

  const { decisions, summary } = data
  const fallbackRate = summary.total > 0
    ? ((summary.fallback_count / summary.total) * 100).toFixed(1)
    : '0.0'

  return (
    <Card title="AI Decision Timeline">
      {/* Summary pills */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total',    value: String(summary.total),       color: 'text-white' },
          { label: 'Fallback', value: `${fallbackRate}%`,          color: summary.fallback_count > 0 ? 'text-amber-400' : 'text-gray-500' },
          { label: 'Errors',   value: String(summary.error_count), color: summary.error_count > 0 ? 'text-red-400' : 'text-gray-500' },
          { label: 'Avg ms',   value: String(summary.avg_latency_ms ?? '—'), color: 'text-gray-300' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{s.label}</p>
            <p className={`mt-0.5 text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1 -mr-1">
        {decisions.length === 0 ? (
          <p className="text-sm text-gray-600 font-mono">No decisions recorded yet</p>
        ) : (
          decisions.map((d, i) => {
            const isError    = d.success === false
            const isFallback = d.fallback_used === true
            const leftBorder = isError ? 'border-l-red-500' : isFallback ? 'border-l-amber-500' : 'border-l-emerald-600'
            const bg         = isError ? 'bg-red-950/20' : isFallback ? 'bg-amber-950/20' : 'bg-emerald-950/10'

            return (
              <div
                key={d.id ?? i}
                className={`border-l-2 ${leftBorder} ${bg} pl-3 py-2 rounded-r flex items-start justify-between gap-3`}
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Agent badge */}
                    {d.agent_id && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agentBadgeColor(d.agent_id)}`}>
                        {d.agent_id}
                      </span>
                    )}
                    {/* Circuit / decision name */}
                    <span className="text-xs font-mono text-gray-300 truncate">
                      {d.circuit_name ?? '—'}
                    </span>
                    {/* Model tag */}
                    {d.model && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-gray-800 text-gray-400">
                        {d.model.replace('claude-', '')}
                      </span>
                    )}
                    {/* Latency pill */}
                    {d.latency_ms != null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        d.latency_ms > 3000 ? 'bg-red-900 text-red-300'
                        : d.latency_ms > 1500 ? 'bg-amber-900 text-amber-300'
                        : 'bg-gray-800 text-gray-400'
                      }`}>
                        {d.latency_ms}ms
                      </span>
                    )}
                    {/* Status dot */}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isError ? 'bg-red-500' : isFallback ? 'bg-amber-400' : 'bg-emerald-500'
                    }`} />
                    {isFallback && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-900 text-amber-300">fallback</span>
                    )}
                    {isError && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-900 text-red-300">error</span>
                    )}
                  </div>
                  {d.revenue_context && (
                    <p className="text-[11px] text-gray-600 truncate">{d.revenue_context}</p>
                  )}
                </div>
                {d.created_at && (
                  <span className="flex-shrink-0 text-[10px] text-gray-600 font-mono">{relTime(d.created_at)}</span>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

// ─── PANEL 3 — Token Budget (40%) ────────────────────────────────────────────

async function TokenBudgetPanel() {
  const data = await fetchJSON<BudgetData>('/api/control-tower/budget')

  if (!data) {
    return (
      <Card title="Token Budget">
        <p className="text-sm text-gray-600 font-mono">Budget data unavailable</p>
      </Card>
    )
  }

  const { budgets, month } = data

  return (
    <Card title="Token Budget">
      <p className="text-[11px] font-mono text-gray-600">{month}</p>

      {budgets.length === 0 ? (
        <p className="text-sm text-gray-600">No agents with monthly budgets configured</p>
      ) : (
        <div className="space-y-4">
          {budgets.map(b => {
            const pct = b.utilizationPct
            const barColor =
              pct > 90 ? 'bg-red-500'
              : pct > 70 ? 'bg-amber-400'
              : 'bg-emerald-500'
            const labelColor =
              pct > 90 ? 'text-red-400'
              : pct > 70 ? 'text-amber-400'
              : 'text-emerald-400'

            return (
              <div key={b.agentId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${agentBadgeColor(b.agentId)}`}>
                      {b.displayName ?? b.agentId}
                    </span>
                  </div>
                  <span className={`text-xs font-bold font-mono flex-shrink-0 ${labelColor}`}>
                    {pct}%
                    {pct > 90 && ' ⛔'}
                    {pct > 70 && pct <= 90 && ' ⚠'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-600">
                  <span>{b.tokensUsed.toLocaleString('pt-PT')} used</span>
                  <span>{b.remainingTokens.toLocaleString('pt-PT')} left / {b.monthlyBudget.toLocaleString('pt-PT')} budget</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── PANEL 4 — DLQ Inspector (50%) ───────────────────────────────────────────

async function DLQInspectorPanel() {
  const data = await fetchJSON<DLQData>('/api/control-tower/dlq')

  const total    = data?.total ?? 0
  const byType   = data?.by_type ?? {}
  const events   = data?.events?.slice(0, 5) ?? []
  const hasData  = data != null

  return (
    <Card title="DLQ Inspector">
      {/* Total count hero */}
      <div className="flex items-center gap-4">
        <div>
          <p className={`text-4xl font-bold font-mono leading-none ${
            total > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {hasData ? total : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">failed events queued</p>
        </div>
        {total === 0 && hasData && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-400 font-medium">Queue healthy</span>
          </div>
        )}
      </div>

      {/* By event type breakdown */}
      {Object.keys(byType).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">By Event Type</p>
          {Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-gray-400 truncate">{type}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium font-mono ${
                  count > 10 ? 'bg-red-900 text-red-300'
                  : count > 3  ? 'bg-amber-900 text-amber-300'
                  : 'bg-gray-800 text-gray-400'
                }`}>
                  {count}
                </span>
              </div>
            ))
          }
        </div>
      )}

      {/* Last 5 failed events */}
      {events.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Last Failed Events</p>
          {events.map(ev => (
            <div
              key={ev.id}
              className="rounded-lg border border-gray-800 bg-gray-950 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-900 text-amber-300">
                    {ev.event_type}
                  </span>
                  <span className="text-[10px] font-mono text-gray-600">
                    {truncate(ev.id, 12)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 font-mono">{relTime(ev.created_at)}</p>
              </div>
              <ReplayButton eventId={ev.id} />
            </div>
          ))}
        </div>
      )}

      {!hasData && (
        <p className="text-sm text-gray-600 font-mono">DLQ data unavailable</p>
      )}
    </Card>
  )
}

// ─── PANEL 5 — Causal Trace Explorer (50%) ───────────────────────────────────

async function CausalTraceExplorerPanel() {
  const steps = await fetchRecentCausalSteps(10)

  return (
    <Card title="Causal Trace Explorer">
      {steps.length === 0 ? (
        <p className="text-sm text-gray-600 font-mono">
          No causal steps recorded yet — enable <code className="bg-gray-800 px-1 rounded">CAUSAL_TRACE_ENABLED=true</code>
        </p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gray-800" />

          {steps.map((step, i) => (
            <div key={step.id ?? i} className="relative flex gap-4 pb-4 last:pb-0">
              {/* Step type icon */}
              <div className="relative z-10 flex-shrink-0 w-9 h-9 rounded-full border border-gray-800 bg-gray-950 flex items-center justify-center text-base leading-none">
                {causalIcon(step.step_type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Step type badge */}
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-800 text-gray-300">
                    {step.step_type.replace('_', ' ')}
                  </span>
                  {/* Agent badge */}
                  {step.agent_id && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${agentBadgeColor(step.agent_id)}`}>
                      {step.agent_id}
                    </span>
                  )}
                  {/* Action */}
                  {step.action && (
                    <span className="text-[11px] font-mono text-gray-400">{step.action}</span>
                  )}
                  {/* Latency */}
                  {step.latency_ms != null && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      step.latency_ms > 3000 ? 'bg-red-900 text-red-300'
                      : step.latency_ms > 1000 ? 'bg-amber-900 text-amber-300'
                      : 'bg-gray-800 text-gray-500'
                    }`}>
                      {step.latency_ms}ms
                    </span>
                  )}
                  {/* Success/fail dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${step.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="text-[10px] font-mono text-gray-600">
                    corr: {truncate(step.correlation_id, 10)}
                  </span>
                  {step.tenant_id && (
                    <span className="text-[10px] font-mono text-gray-600">
                      tenant: {step.tenant_id}
                    </span>
                  )}
                  {step.revenue_delta != null && (
                    <span className={`text-[10px] font-mono font-medium ${step.revenue_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Δ {eur(step.revenue_delta)}
                    </span>
                  )}
                  {step.error_message && (
                    <span className="text-[10px] text-red-400 font-mono truncate">{truncate(step.error_message, 40)}</span>
                  )}
                </div>

                {step.created_at && (
                  <p className="mt-0.5 text-[10px] text-gray-700 font-mono">{relTime(step.created_at)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function PanelSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-6 animate-pulse ${className}`}>
      <div className="h-3 w-32 bg-[#1A1A24] rounded mb-5" />
      <div className="space-y-3">
        <div className="h-16 bg-[#1A1A24] rounded-lg" />
        <div className="h-16 bg-[#1A1A24] rounded-lg" />
        <div className="h-16 bg-[#1A1A24] rounded-lg" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ControlTowerDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-screen-2xl px-6 py-8 space-y-6">

        {/* Header — renders immediately */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Control Tower</h1>
            <p className="mt-0.5 text-xs text-gray-500 font-mono">
              Agency Group · SH-ROS · ISR 30s
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Live</span>
          </div>
        </div>

        {/* Row 1 — Revenue Intelligence (full width) */}
        <Suspense fallback={<PanelSkeleton />}>
          <RevenueIntelligencePanel />
        </Suspense>

        {/* Row 2 — AI Timeline (60%) + Token Budget (40%) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <Suspense fallback={<PanelSkeleton />}>
              <AIDecisionTimelinePanel />
            </Suspense>
          </div>
          <div className="xl:col-span-2">
            <Suspense fallback={<PanelSkeleton />}>
              <TokenBudgetPanel />
            </Suspense>
          </div>
        </div>

        {/* Row 3 — DLQ Inspector (50%) + Causal Trace Explorer (50%) */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Suspense fallback={<PanelSkeleton />}>
            <DLQInspectorPanel />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <CausalTraceExplorerPanel />
          </Suspense>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {([
              {
                href:        '/control-tower/ai-timeline',
                icon:        '🟣',
                title:       'AI Timeline',
                description: 'AI decisions · policy · tokens',
              },
              {
                href:        '/control-tower/graph',
                icon:        '🔵',
                title:       'Graph Explorer',
                description: 'Causal graph · correlation IDs · steps',
              },
              {
                href:        '/control-tower/replay',
                icon:        '🔄',
                title:       'Replay Console',
                description: 'DLQ replay · event retry · audit trail',
              },
            ] satisfies Array<{ href: string; icon: string; title: string; description: string }>).map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block rounded-xl border border-gray-800 bg-[#111118] p-5 hover:border-gray-700 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl leading-none flex-shrink-0">{link.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{link.title}</p>
                      <p className="mt-1 text-[11px] text-gray-500 font-mono leading-tight">{link.description}</p>
                    </div>
                  </div>
                  <span className="text-gray-600 flex-shrink-0 text-lg leading-none mt-0.5">→</span>
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
