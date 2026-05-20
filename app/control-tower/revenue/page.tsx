// AGENCY GROUP — Control Tower: Revenue Dashboard | AMI: 22506
// Real-time revenue dashboard: pipeline health, funnel, daily target, top leads
// =============================================================================

import { Suspense } from 'react'
import { productAPI } from '@/lib/product'
import { revenueOutcomeMapper } from '@/lib/product'
// StatusBadge available at control-tower/_components if needed

export const revalidate = 30  // ISR 30s

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getRevenueData() {
  // Use the real tenant UUID from the organizations table (slug: 'agency-group')
  // Fallback to env var for flexibility across environments
  const SYSTEM_ORG = process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

  const [dashboard, funnel, daily_target] = await Promise.all([
    productAPI.loadDashboard({ org_id: SYSTEM_ORG, agent_id: 'control-tower' }),
    revenueOutcomeMapper.buildFunnel(SYSTEM_ORG),
    revenueOutcomeMapper.getDailyTarget(SYSTEM_ORG),
  ])

  return { dashboard, funnel, daily_target }
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

function eur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000)     return `€${(value / 1_000).toFixed(0)}K`
  return `€${value.toFixed(0)}`
}

function pct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RevenuePage() {
  let revenueData: Awaited<ReturnType<typeof getRevenueData>> | null = null
  try {
    revenueData = await getRevenueData()
  } catch (err) {
    console.error('[Control Tower] Revenue data unavailable:', err)
    return (
      <div className="p-6 text-slate-500 text-sm">
        Revenue data temporarily unavailable — retry in a few seconds.
      </div>
    )
  }
  const { dashboard, funnel, daily_target } = revenueData
  const { pipeline, top_leads, decisions } = dashboard

  const health_color: Record<typeof decisions.pipeline_health, string> = {
    excellent:       'text-emerald-400',
    good:            'text-blue-400',
    needs_attention: 'text-amber-400',
    critical:        'text-red-400',
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Loading revenue data…
      </div>
    }>
    <div className="space-y-6 p-6 min-h-screen bg-[#0A0A0F] text-slate-100">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Live pipeline · Updated {new Date().toLocaleTimeString('en-GB')}
          </p>
        </div>
        <div className={`flex items-center gap-2 text-sm font-semibold ${health_color[decisions.pipeline_health]}`}>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          Pipeline: {decisions.pipeline_health.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* Daily Target Banner */}
      {!daily_target.on_track && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-400 text-xl">⚠️</span>
          <div>
            <p className="text-red-300 font-semibold">Revenue behind daily target</p>
            <p className="text-red-400/80 text-sm">
              Target: {eur(daily_target.target)}/day · Actual avg: {eur(daily_target.actual)}/day ·
              Gap: {eur(Math.abs(daily_target.gap))}
            </p>
            {daily_target.recommended_actions.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {daily_target.recommended_actions.map((a, i) => (
                  <li key={i} className="text-red-300/80 text-xs">→ {a}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {daily_target.on_track && (
        <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-4">
          <p className="text-emerald-300 font-medium">
            ✅ On track — {eur(daily_target.actual)}/day avg vs {eur(daily_target.target)}/day target
          </p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pipeline Value',    value: eur(pipeline.pipeline_value),    sub: 'active deals' },
          { label: 'Expected Revenue',  value: eur(pipeline.expected_revenue),  sub: 'risk-adjusted' },
          { label: 'Commission MTD',    value: eur(pipeline.commission_mtd),    sub: `${pipeline.deals_won_mtd} deals closed` },
          { label: 'Hot Leads',         value: String(pipeline.hot_leads),      sub: 'score ≥ 80' },
          { label: 'Active Leads',      value: String(pipeline.active_leads),   sub: 'in pipeline' },
          { label: 'Proposals Pending', value: String(pipeline.proposals_pending), sub: 'awaiting response' },
          { label: 'Deals Active',      value: String(pipeline.deals_in_progress), sub: 'in progress' },
          { label: 'Close Rate 30d',    value: pct(pipeline.close_rate_30d),    sub: pipeline.close_rate_30d == null ? 'No closed deals yet' : 'deals won / total 30d' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#111118] border border-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{kpi.label}</p>
            <p className="text-white text-2xl font-bold mt-1">{kpi.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Causal data lineage */}
      <div className="text-[10px] text-slate-700 font-mono flex items-center gap-2 mt-1">
        <span className="text-slate-600">source:</span>
        <span>event_history → causal_trace → mv_agent_revenue</span>
        <span className="text-slate-600">·</span>
        <span>ISR 30s</span>
      </div>

      {/* Revenue Funnel */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Revenue Funnel</h2>
        <div className="space-y-3">
          {funnel.stages.map((stage, i) => {
            const width = funnel.total_pipeline > 0
              ? Math.max(8, (stage.total_value / funnel.total_pipeline) * 100)
              : 8
            return (
              <div key={i} className="flex items-center gap-4">
                <div className="w-32 text-xs text-slate-400 truncate">{stage.stage}</div>
                <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded flex items-center px-2"
                    style={{ width: `${width}%` }}
                  >
                    <span className="text-white text-[10px] font-medium whitespace-nowrap">
                      {stage.count} · {eur(stage.total_value)}
                    </span>
                  </div>
                </div>
                <div className="w-16 text-right text-xs text-slate-400">
                  {pct(stage.conversion_rate)}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex gap-6 text-xs text-slate-500">
          <span>Total pipeline: <strong className="text-slate-300">{eur(funnel.total_pipeline)}</strong></span>
          <span>Expected: <strong className="text-slate-300">{eur(funnel.total_expected)}</strong></span>
          <span>Projected: <strong className="text-emerald-400">{eur(funnel.projected_revenue)}</strong></span>
        </div>
      </div>

      {/* Actions + Top Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Actions */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Priority Actions ({decisions.actions.length})
          </h2>
          <div className="space-y-3">
            {decisions.actions.slice(0, 6).map(action => (
              <div key={action.action_id} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-md">
                <div className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  action.priority === 1 ? 'bg-red-600 text-white' :
                  action.priority === 2 ? 'bg-orange-600 text-white' :
                  'bg-slate-600 text-slate-200'
                }`}>
                  {action.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{action.instruction}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-slate-500 text-xs">{action.time_estimate}</span>
                    <span className="text-emerald-400 text-xs font-medium">+{eur(action.revenue_impact)}</span>
                  </div>
                </div>
              </div>
            ))}
            {decisions.actions.length === 0 && (
              <p className="text-slate-500 text-sm">No priority actions — pipeline healthy</p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/50 text-xs text-slate-500">
            Estimated daily impact: <span className="text-emerald-400 font-medium">{eur(decisions.estimated_daily_revenue_impact)}</span>
          </div>
        </div>

        {/* Top Leads */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Hot Leads (Top 8)
          </h2>
          <div className="space-y-2">
            {top_leads.slice(0, 8).map(lead => (
              <div key={lead.contact_id} className="flex items-center gap-3 p-2.5 bg-slate-800/20 rounded-md">
                <div className={`w-1 h-8 rounded-full flex-shrink-0 ${
                  lead.priority === 'critical' ? 'bg-red-500' :
                  lead.priority === 'high'     ? 'bg-orange-500' :
                  lead.priority === 'medium'   ? 'bg-blue-500' : 'bg-slate-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 text-sm font-medium truncate">{lead.name}</span>
                    <span className="text-slate-500 text-xs">{lead.stage}</span>
                  </div>
                  <p className="text-slate-500 text-xs truncate">{lead.next_action}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white text-sm font-bold">{lead.score}</div>
                  <div className="text-slate-500 text-[10px]">{eur(lead.expected_value)}</div>
                </div>
              </div>
            ))}
            {top_leads.length === 0 && (
              <p className="text-slate-500 text-sm">No leads found</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 text-sm text-slate-400">
        <strong className="text-slate-300">System summary:</strong> {decisions.summary}
      </div>
    </div>
    </Suspense>
  )
}
