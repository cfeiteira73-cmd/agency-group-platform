// =============================================================================
// Agency Group — Control Tower: Causal Graph Explorer
// app/control-tower/graph/page.tsx
//
// Revenue attribution · Root cause · Agent decisions
//
// RSC — NO 'use client' — NO mock data
// ISR: revalidate every 30 seconds
// =============================================================================

import { Suspense } from 'react'
import { KPICard } from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'
import {
  getAgentRevenueMV,
  getTopDealPatterns,
  getGraphIntelligenceReport,
  type AgentRevenueMV,
  type GraphIntelligenceReport,
} from '@/lib/graph/materializedViews'
import {
  getRevenueAttribution,
  type RevenueAttribution,
} from '@/lib/graph/recursiveCTE'

export const revalidate = 30

// ─── Tenant ───────────────────────────────────────────────────────────────────

const TENANT_ID = process.env.NEXT_PUBLIC_SUPABASE_TENANT_ID ?? 'agency-group'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function eur(value: number): string {
  return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function shortId(id: string): string {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}…${id.slice(-6)}`
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch {
    return '—'
  }
}

// ─── Data loader ──────────────────────────────────────────────────────────────

interface PageData {
  agentRevenue: AgentRevenueMV[]
  topPatterns: { flow_path: string; count: number; total_revenue: number }[]
  attribution: RevenueAttribution[]
  report: GraphIntelligenceReport | null
}

async function loadPageData(): Promise<PageData> {
  const [agentRevenue, topPatterns, attribution, report] = await Promise.all([
    getAgentRevenueMV(TENANT_ID, 20).catch((): AgentRevenueMV[] => []),
    getTopDealPatterns(TENANT_ID, 10).catch(
      (): { flow_path: string; count: number; total_revenue: number }[] => [],
    ),
    getRevenueAttribution(TENANT_ID).catch((): RevenueAttribution[] => []),
    getGraphIntelligenceReport(TENANT_ID).catch((): null => null),
  ])

  return { agentRevenue, topPatterns, attribution, report }
}

// ─── Sub-components (RSC-safe, no hooks) ─────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-slate-600 text-sm font-mono">
      {label}
    </div>
  )
}

function SectionHeading({
  title,
  sub,
  badge,
}: {
  title: string
  sub?: string
  badge?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-widest">
          {title}
        </h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="text-[10px] font-mono text-slate-600 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
          {badge}
        </span>
      )}
    </div>
  )
}

// ─── Section 1 — Agent Revenue Attribution ────────────────────────────────────

function AgentRevenueSummary({ rows }: { rows: AgentRevenueMV[] }) {
  return (
    <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
      <SectionHeading
        title="Agent Revenue Attribution"
        sub="From mv_agent_revenue · agents ranked by total revenue"
        badge="materialized view"
      />

      {rows.length === 0 ? (
        <EmptyState label="No agent revenue data" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-slate-600 border-b border-slate-800">
                <th className="pb-2 pr-4">Agent ID</th>
                <th className="pb-2 pr-4 text-right">Deals</th>
                <th className="pb-2 pr-4 text-right">Revenue Attributed</th>
                <th className="pb-2 pr-4 text-right">Avg Confidence</th>
                <th className="pb-2">Last Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => (
                <tr
                  key={row.agent_id}
                  className="hover:bg-slate-800/20 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <span className="font-mono text-blue-400 text-xs">
                      {shortId(row.agent_id)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-slate-300">
                    {row.deal_count.toLocaleString('pt-PT')}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">
                    <span
                      className={
                        row.total_revenue >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }
                    >
                      {eur(row.total_revenue)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <StatusBadge
                      variant={
                        row.success_rate >= 0.75
                          ? 'healthy'
                          : row.success_rate >= 0.4
                          ? 'degraded'
                          : 'failed'
                      }
                      label={pct(row.success_rate)}
                      size="xs"
                    />
                  </td>
                  <td className="py-3 text-slate-500 text-xs font-mono">
                    {relativeTime(row.last_activity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Section 2 — Top Deal Flow Paths ─────────────────────────────────────────

function ConversionPatterns({
  patterns,
}: {
  patterns: { flow_path: string; count: number; total_revenue: number }[]
}) {
  const maxCount = Math.max(1, ...patterns.map((p) => p.count))

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
      <SectionHeading
        title="Top Deal Flow Paths"
        sub="Conversion patterns ranked by frequency"
        badge="mv_deal_flow_paths"
      />

      {patterns.length === 0 ? (
        <EmptyState label="No conversion pattern data" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-slate-600 border-b border-slate-800">
                <th className="pb-2 pr-4">Stage Path</th>
                <th className="pb-2 pr-4 text-right">Deal Count</th>
                <th className="pb-2 pr-4 text-right">Frequency</th>
                <th className="pb-2 text-right">Revenue (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {patterns.map((p, i) => {
                const widthPct = Math.max(4, (p.count / maxCount) * 100)
                return (
                  <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="text-slate-300 text-xs font-mono leading-relaxed break-all">
                        {p.flow_path || '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-300">
                      {p.count.toLocaleString('pt-PT')}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-20 h-1.5 bg-slate-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono">
                      <span
                        className={
                          p.total_revenue >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }
                      >
                        {eur(p.total_revenue)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Section 3 — Revenue Leakage Detection ────────────────────────────────────

function RevenueLeaks({ attribution }: { attribution: RevenueAttribution[] }) {
  const leaks = attribution.filter((a) => a.total_revenue < 0)

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
      <SectionHeading
        title="Revenue Leakage Detection"
        sub="Agents with negative total revenue attribution (last 30 days)"
        badge="causal_trace · rpc"
      />

      {leaks.length === 0 ? (
        <div className="py-10 text-center">
          <span className="inline-flex items-center gap-2 text-emerald-400 text-sm font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            No revenue leaks detected
          </span>
        </div>
      ) : (
        <>
          <div className="mb-4 px-3 py-2 bg-red-950/30 border border-red-800/30 rounded text-xs text-red-300 font-mono">
            {leaks.length} agent{leaks.length !== 1 ? 's' : ''} with negative attribution ·{' '}
            Total leakage:{' '}
            <span className="font-bold text-red-400">
              {eur(leaks.reduce((s, l) => s + l.total_revenue, 0))}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-slate-600 border-b border-slate-800">
                  <th className="pb-2 pr-4">Agent</th>
                  <th className="pb-2 pr-4 text-right">Revenue Delta (€)</th>
                  <th className="pb-2 pr-4 text-right">Deal Count</th>
                  <th className="pb-2 pr-4 text-right">Avg / Deal</th>
                  <th className="pb-2 text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaks
                  .sort((a, b) => a.total_revenue - b.total_revenue)
                  .map((row) => (
                    <tr
                      key={row.agent_id}
                      className="hover:bg-red-950/10 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <span className="font-mono text-red-300 text-xs">
                          {shortId(row.agent_id)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-red-400 font-bold">
                        {eur(row.total_revenue)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-slate-400">
                        {Number(row.deal_count).toLocaleString('pt-PT')}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-red-400/80">
                        {eur(row.avg_revenue_per_deal)}
                      </td>
                      <td className="py-3 text-right">
                        <StatusBadge
                          variant={row.success_rate >= 0.4 ? 'degraded' : 'failed'}
                          label={pct(row.success_rate)}
                          size="xs"
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Section 4 — Tenant Graph Stats ──────────────────────────────────────────

function TenantGraphStats({ report }: { report: GraphIntelligenceReport | null }) {
  const stats = report?.tenant_stats ?? null

  const totalAgents = stats?.active_agents ?? report?.agent_revenue.length ?? 0
  const totalRevenue = stats?.total_revenue ?? 0
  const totalDeals = stats?.total_deals ?? 0
  const successRate = stats?.overall_success_rate ?? 0

  const topAgents = (report?.agent_revenue ?? [])
    .slice(0, 3)
    .map((a) => shortId(a.agent_id))
    .join(', ')

  const nodesProxy = totalAgents + totalDeals
  const edgesProxy = report?.top_deal_paths.length ?? 0

  return (
    <div className="bg-[#111118] border border-slate-800 rounded-lg p-5">
      <SectionHeading
        title="Tenant Graph Stats"
        sub={`Tenant: ${TENANT_ID} · ${report?.generated_at ? new Date(report.generated_at).toLocaleTimeString('en-GB') : '—'}`}
        badge="mv_tenant_graph_stats"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KPICard
          title="Total Nodes"
          value={nodesProxy.toLocaleString('pt-PT')}
          sub="agents + deals"
          color="blue"
          mono
        />
        <KPICard
          title="Total Edges"
          value={edgesProxy.toLocaleString('pt-PT')}
          sub="deal flow paths"
          color="purple"
          mono
        />
        <KPICard
          title="Revenue Attributed"
          value={eur(totalRevenue)}
          sub={`${totalDeals} deals total`}
          color={totalRevenue >= 0 ? 'green' : 'red'}
          mono
        />
        <KPICard
          title="Success Rate"
          value={pct(successRate)}
          sub={`${totalAgents} active agents`}
          color={
            successRate >= 0.75
              ? 'green'
              : successRate >= 0.4
              ? 'amber'
              : 'red'
          }
          mono
        />
      </div>

      {topAgents && (
        <div className="p-3 bg-slate-900/60 border border-slate-800/60 rounded text-xs font-mono text-slate-400">
          <span className="text-slate-600">top agents:</span>{' '}
          <span className="text-blue-400">{topAgents}</span>
        </div>
      )}

      {(report?.insights ?? []).length > 0 && (
        <ul className="mt-4 space-y-1">
          {report!.insights.map((insight, i) => (
            <li
              key={i}
              className="text-xs text-slate-400 font-mono flex items-start gap-2"
            >
              <span className="text-slate-700 flex-shrink-0">→</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function GraphSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Data lineage breadcrumb placeholder */}
      <div className="h-3 w-2/3 bg-zinc-800/50 rounded" />

      {/* Tenant Graph Stats — 4 KPI cards + info bar */}
      <div className="bg-zinc-800/30 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="h-4 w-48 bg-zinc-800/60 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-xl" />
          ))}
        </div>
        <div className="h-8 bg-zinc-800/40 rounded" />
      </div>

      {/* Agent Revenue Attribution table */}
      <div className="bg-zinc-800/30 border border-slate-800 rounded-lg p-5 space-y-3">
        <div className="h-4 w-56 bg-zinc-800/60 rounded" />
        <div className="h-48 bg-zinc-800/40 rounded" />
      </div>

      {/* Top Deal Flow Paths table */}
      <div className="bg-zinc-800/30 border border-slate-800 rounded-lg p-5 space-y-3">
        <div className="h-4 w-48 bg-zinc-800/60 rounded" />
        <div className="h-40 bg-zinc-800/40 rounded" />
      </div>

      {/* Revenue Leakage Detection */}
      <div className="bg-zinc-800/30 border border-slate-800 rounded-lg p-5 space-y-3">
        <div className="h-4 w-52 bg-zinc-800/60 rounded" />
        <div className="h-32 bg-zinc-800/40 rounded" />
      </div>
    </div>
  )
}

// ─── Async content (does all DB work) ────────────────────────────────────────

async function GraphContent() {
  const { agentRevenue, topPatterns, attribution, report } = await loadPageData()

  const leakCount = attribution.filter((a) => a.total_revenue < 0).length

  return (
    <>
      {/* ── Header badges (data-dependent) ────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0 self-end">
        {leakCount > 0 && (
          <StatusBadge variant="warning" label={`${leakCount} leak${leakCount !== 1 ? 's' : ''}`} />
        )}
        <StatusBadge variant="ok" label="ISR 30s" size="xs" />
        <span className="text-[10px] font-mono text-slate-600">
          {new Date().toLocaleTimeString('en-GB')}
        </span>
      </div>

      {/* ── Data lineage breadcrumb ────────────────────────────────────────── */}
      <div className="text-[10px] font-mono text-slate-700 flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-600">source:</span>
        <span>causal_trace</span>
        <span className="text-slate-800">→</span>
        <span>mv_agent_revenue</span>
        <span className="text-slate-800">→</span>
        <span>mv_deal_flow_paths</span>
        <span className="text-slate-800">→</span>
        <span>mv_tenant_graph_stats</span>
        <span className="text-slate-800">·</span>
        <span className="text-slate-600">tenant:</span>
        <span className="text-blue-900">{TENANT_ID}</span>
      </div>

      {/* ── Section 4 — Tenant Graph Stats (summary, shown first) ─────────── */}
      <TenantGraphStats report={report} />

      {/* ── Section 1 — Agent Revenue Attribution ─────────────────────────── */}
      <AgentRevenueSummary rows={agentRevenue ?? []} />

      {/* ── Section 2 — Top Deal Flow Paths ───────────────────────────────── */}
      <ConversionPatterns patterns={topPatterns ?? []} />

      {/* ── Section 3 — Revenue Leakage Detection ─────────────────────────── */}
      <RevenueLeaks attribution={attribution ?? []} />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CausalGraphExplorerPage() {
  return (
    <div className="space-y-6 p-6 min-h-screen bg-[#0a0a0f] text-slate-100">

      {/* ── Header (static — renders immediately) ─────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Causal Graph Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Revenue attribution · Root cause · Agent decisions
          </p>
        </div>
      </div>

      {/* ── Async content with Suspense ────────────────────────────────────── */}
      <Suspense fallback={<GraphSkeleton />}>
        <GraphContent />
      </Suspense>

    </div>
  )
}
