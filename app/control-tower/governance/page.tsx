// app/control-tower/governance/page.tsx
// AI Governance Dashboard — SH-ROS Control Tower
// Shows: policy decisions, budget burn, agent supervision, circuit status, pending approvals
// RSC — no 'use client'

import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getTenantBudgetStatus } from '@/lib/ai/tokenGovernor'
import { listPendingApprovals } from '@/lib/governance/approvalFlow'
import type { ApprovalRequest } from '@/lib/governance/approvalFlow'

export const revalidate = 30

// ─── Data fetchers ────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getAIAuditStats() {
  const db = getDb()
  if (!db) return { total: 0, fallbacks: 0, errors: 0, avgLatency: 0, byModel: [] as [string, number][], rows: [] }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let data: unknown[] | null = null
  try {
    const res = await db
      .from('ai_audit_log')
      .select('model, success, fallback_used, latency_ms, error_type, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(500)
    data = res.data
  } catch { data = [] }

  const rows = (data ?? []) as {
    model: string; success: boolean; fallback_used: boolean;
    latency_ms: number; error_type: string | null
  }[]

  const total      = rows.length
  const fallbacks  = rows.filter(r => r.fallback_used).length
  const errors     = rows.filter(r => !r.success).length
  const avgLatency = total > 0 ? Math.round(rows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / total) : 0
  const byModel    = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.model ?? 'unknown'] = (acc[r.model ?? 'unknown'] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return { total, fallbacks, errors, avgLatency, byModel, rows: rows.slice(0, 10) }
}

async function getPolicyStats() {
  const db = getDb()
  if (!db) return { total_calls: 0, agents: [] as [string, number][] }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let data: unknown[] | null = null
  try {
    const res = await db
      .from('ai_feedback')
      .select('agent_id, metadata, created_at')
      .gte('created_at', cutoff)
      .limit(200)
    data = res.data
  } catch { data = [] }

  const rows = (data ?? []) as { agent_id: string; metadata: Record<string, unknown> | null }[]
  const agentCounts = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.agent_id] = (acc[r.agent_id] ?? 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  return { total_calls: rows.length, agents: agentCounts.slice(0, 8) }
}

async function getSecurityAlerts() {
  const db = getDb()
  if (!db) return [] as { event_type: string; severity: string; description: string; created_at: string }[]
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  try {
    const res = await db
      .from('security_events')
      .select('event_type, severity, description, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(10)
    return (res.data ?? []) as { event_type: string; severity: string; description: string; created_at: string }[]
  } catch {
    return []
  }
}

// ─── Pending Approvals skeleton ───────────────────────────────────────────────

function ApprovalsSkeleton() {
  return (
    <div className="bg-[#111118] border border-white/5 rounded-lg overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-white/5">
        <div className="h-4 w-36 bg-[#1A1A24] rounded animate-pulse" />
      </div>
      <div className="space-y-2 p-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg animate-pulse border border-slate-800" />
        ))}
      </div>
    </div>
  )
}

// ─── Pending Approvals async section ─────────────────────────────────────────

async function PendingApprovalsSection({ defaultTenant }: { defaultTenant: string }) {
  const pendingApprovals = await listPendingApprovals(defaultTenant, 10).catch(() => [] as ApprovalRequest[])

  return (
    <div className="bg-[#111118] border border-white/5 rounded-lg overflow-hidden mt-6">
      {/* Section header */}
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-300">Pending Approvals</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${
          pendingApprovals.length === 0
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {pendingApprovals.length} pending
        </span>
      </div>

      {/* Banner */}
      {pendingApprovals.length === 0 ? (
        <div className="px-5 py-6 flex items-center justify-center gap-2 text-xs text-emerald-400">
          <span>&#10003; No pending approvals — system fully authorized</span>
        </div>
      ) : (
        <>
          <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2">
            <span className="text-amber-400 text-sm">&#9888;</span>
            <span className="text-xs text-amber-300 font-medium">
              {pendingApprovals.length} action{pendingApprovals.length !== 1 ? 's' : ''} require human authorization
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-normal">Approval ID</th>
                  <th className="px-5 py-3 text-left font-normal">Action</th>
                  <th className="px-5 py-3 text-left font-normal">Resource</th>
                  <th className="px-5 py-3 text-left font-normal">Risk</th>
                  <th className="px-5 py-3 text-left font-normal">Requested</th>
                  <th className="px-5 py-3 text-left font-normal">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingApprovals.map((appr) => {
                  const requestedMs  = new Date(appr.requested_at).getTime()
                  const expiresMs    = new Date(appr.expires_at).getTime()
                  const nowMs        = Date.now()
                  const minutesAgo   = Math.round((nowMs - requestedMs) / 60_000)
                  const minsLeft     = Math.max(0, Math.round((expiresMs - nowMs) / 60_000))
                  const hrsLeft      = Math.floor(minsLeft / 60)
                  const minsRem      = minsLeft % 60

                  const relativeRequested =
                    minutesAgo < 60
                      ? `${minutesAgo}m ago`
                      : `${Math.floor(minutesAgo / 60)}h ${minutesAgo % 60}m ago`

                  const relativeExpires =
                    hrsLeft > 0 ? `${hrsLeft}h ${minsRem}m` : `${minsLeft}m`

                  return (
                    <tr key={appr.approval_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-mono text-slate-400">
                        {appr.approval_id.slice(0, 18)}&hellip;
                      </td>
                      <td className="px-5 py-3 text-white max-w-[160px] truncate">
                        {appr.action_type}
                      </td>
                      <td className="px-5 py-3 text-slate-400 max-w-[120px] truncate">
                        {appr.resource_type}
                        {appr.resource_id ? ` · ${appr.resource_id.slice(0, 8)}` : ''}
                      </td>
                      <td className="px-5 py-3">
                        {appr.risk_level === 'critical' ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium uppercase tracking-wide text-[10px]">
                            critical
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium uppercase tracking-wide text-[10px]">
                            high
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {relativeRequested}
                      </td>
                      <td className={`px-5 py-3 whitespace-nowrap font-mono ${
                        minsLeft < 60 ? 'text-red-400' : 'text-slate-500'
                      }`}>
                        {relativeExpires}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function GovernancePage() {
  const defaultTenant = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

  // pendingApprovals is extracted into a Suspense boundary below — not fetched here
  const [auditStats, policyStats, alerts, tokenStatus] = await Promise.all([
    getAIAuditStats().catch(() => ({ total: 0, fallbacks: 0, errors: 0, avgLatency: 0, byModel: [] as [string, number][], rows: [] })),
    getPolicyStats().catch(() => ({ total_calls: 0, agents: [] as [string, number][] })),
    getSecurityAlerts().catch(() => [] as { event_type: string; severity: string; description: string; created_at: string }[]),
    getTenantBudgetStatus('agency-group', 'unlimited').catch(() => null),
  ])

  const fallbackPct  = auditStats.total > 0 ? Math.round((auditStats.fallbacks  / auditStats.total) * 100) : 0
  const errorPct     = auditStats.total > 0 ? Math.round((auditStats.errors     / auditStats.total) * 100) : 0
  const healthStatus = errorPct > 20 ? 'critical' : errorPct > 10 ? 'degraded' : 'healthy'

  const SEV_COLORS: Record<string, string> = {
    critical: 'text-red-400', error: 'text-red-400',
    warning:  'text-amber-400', info: 'text-slate-400',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 font-mono">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            healthStatus === 'healthy' ? 'bg-emerald-400' :
            healthStatus === 'degraded' ? 'bg-amber-400' : 'bg-red-400'
          }`} />
          <span className="text-xs text-slate-500 uppercase tracking-widest">SH-ROS Control Tower</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            healthStatus === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            healthStatus === 'degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>{healthStatus}</span>
        </div>
        <h1 className="text-2xl font-bold text-white">AI Governance</h1>
        <p className="text-sm text-slate-400 mt-1">Policy engine · agent supervision · security · last 24h</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'AI Calls',       value: auditStats.total.toLocaleString(), color: 'text-white' },
          { label: 'Fallback Rate',  value: `${fallbackPct}%`,  color: fallbackPct > 15 ? 'text-amber-400' : 'text-emerald-400' },
          { label: 'Error Rate',     value: `${errorPct}%`,     color: errorPct > 10 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Avg Latency',    value: `${auditStats.avgLatency}ms`, color: auditStats.avgLatency > 3000 ? 'text-amber-400' : 'text-white' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#111118] border border-white/5 rounded-lg p-4">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Model usage */}
        <div className="bg-[#111118] border border-white/5 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Model Usage (24h)</h2>
          {auditStats.byModel.length === 0 ? (
            <p className="text-xs text-slate-600">No AI calls in last 24h</p>
          ) : (
            <div className="space-y-3">
              {auditStats.byModel.map(([model, count]) => {
                const pct = auditStats.total > 0 ? (count / auditStats.total) * 100 : 0
                return (
                  <div key={model}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 truncate">{model}</span>
                      <span className="text-slate-300">{count} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agent call frequency */}
        <div className="bg-[#111118] border border-white/5 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Agent Activity (24h)</h2>
          <div className="text-xs text-slate-500 mb-3">{policyStats.total_calls} total AI decisions logged</div>
          {policyStats.agents.length === 0 ? (
            <p className="text-xs text-slate-600">No agent activity</p>
          ) : (
            <div className="space-y-2">
              {policyStats.agents.map(([agent, count]) => (
                <div key={agent} className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 truncate max-w-[60%]">{agent}</span>
                  <span className="text-xs font-mono text-violet-300">{count} calls</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Token Budget Status */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-200">Token Governor</span>
          {tokenStatus && (
            <span className={`text-xs px-2 py-0.5 rounded font-mono ${
              tokenStatus.status === 'healthy'  ? 'bg-green-500/10 text-green-400' :
              tokenStatus.status === 'warning'  ? 'bg-amber-500/10 text-amber-400' :
                                                  'bg-red-500/10 text-red-400'
            }`}>{tokenStatus.status.toUpperCase()}</span>
          )}
        </div>
        {tokenStatus ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Monthly usage</span>
              <span className="font-mono">
                {tokenStatus.tokens_limit === -1 ? 'Unlimited' :
                 `${tokenStatus.tokens_used.toLocaleString()} / ${tokenStatus.tokens_limit.toLocaleString()}`}
              </span>
            </div>
            {tokenStatus.tokens_limit !== -1 && (
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    tokenStatus.status === 'critical' ? 'bg-red-500' :
                    tokenStatus.status === 'warning'  ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, tokenStatus.pct_used)}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-slate-600 font-mono">{tokenStatus.month} · Plan: {tokenStatus.plan}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Token governor unavailable</p>
        )}
      </div>

      {/* Security alerts */}
      <div className="bg-[#111118] border border-white/5 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-300">Security Events (24h)</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            alerts.length > 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>{alerts.length} events</span>
        </div>
        {alerts.length === 0 ? (
          <div className="px-5 py-6 text-xs text-slate-600 text-center">No security events in last 24h</div>
        ) : (
          <div className="divide-y divide-white/5">
            {alerts.map((alert, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span className={`text-xs font-mono mt-0.5 ${SEV_COLORS[alert.severity] ?? 'text-slate-400'}`}>
                  [{alert.severity?.toUpperCase()}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">{alert.event_type}</div>
                  <div className="text-xs text-slate-500 truncate">{alert.description}</div>
                </div>
                <div className="text-xs text-slate-600 whitespace-nowrap">
                  {new Date(alert.created_at).toLocaleTimeString('en-GB')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Pending Approvals — streams in independently ─────────────────── */}
      <Suspense fallback={<ApprovalsSkeleton />}>
        <PendingApprovalsSection defaultTenant={defaultTenant} />
      </Suspense>
    </div>
  )
}
