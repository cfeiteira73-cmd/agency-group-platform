// AGENCY GROUP — SH-ROS Control Tower: Workflows | AMI: 22506
export const revalidate = 30

import { Suspense } from 'react'
import { StatusBadge } from '../_components/StatusBadge'

interface WorkflowRun {
  run_id: string
  workflow_id: string
  workflow_name: string
  status: string
  current_step: string | null
  total_steps: number
  completed_steps: number
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  error: string | null
  org_id: string
}

interface WorkflowSummary {
  total_runs_24h: number
  completed_24h: number
  failed_24h: number
  running_now: number
  avg_duration_ms: number | null
  workflows: Record<string, { runs: number; success_rate: number; avg_duration_ms: number | null }>
  recent_runs: WorkflowRun[]
}

async function fetchWorkflows(org_id: string): Promise<WorkflowSummary | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/workflows?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 20 },
    })
    if (!res.ok) return null
    return res.json() as Promise<WorkflowSummary>
  } catch { return null }
}

async function WorkflowsContent() {
  const data = await fetchWorkflows('default')

  return (
    <>
      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Workflow data unavailable</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">GET /api/control-tower/workflows</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Runs (24h)', value: data.total_runs_24h, color: 'text-slate-100' },
              { label: 'Completed', value: data.completed_24h, color: 'text-green-400' },
              { label: 'Failed', value: data.failed_24h, color: data.failed_24h > 0 ? 'text-red-400' : 'text-slate-500' },
              { label: 'Running Now', value: data.running_now, color: 'text-blue-400' },
              { label: 'Avg Duration', value: data.avg_duration_ms != null ? `${(data.avg_duration_ms / 1000).toFixed(1)}s` : '—', color: 'text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#111118] border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Workflow definitions */}
          {Object.keys(data.workflows).length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Registered Workflows</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(data.workflows).map(([id, stats]) => (
                  <div key={id} className="border border-slate-800 rounded-lg p-3 bg-[#0A0A0F]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-mono text-slate-200">{id}</p>
                      <span className={`text-xs font-mono ${stats.success_rate >= 90 ? 'text-green-400' : stats.success_rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {stats.success_rate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-slate-500">{stats.runs} runs</span>
                      {stats.avg_duration_ms != null && (
                        <span className="text-[10px] text-slate-500 font-mono">{(stats.avg_duration_ms / 1000).toFixed(1)}s avg</span>
                      )}
                    </div>
                    <div className="mt-2 bg-slate-800 rounded-full h-1">
                      <div className="h-1 rounded-full bg-blue-500" style={{ width: `${Math.min(stats.success_rate, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent runs */}
          {data.recent_runs.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Recent Runs</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Run ID', 'Workflow', 'Status', 'Progress', 'Duration', 'Error', 'Started'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_runs.map((run) => (
                    <tr key={run.run_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2 font-mono text-blue-400 text-[10px]">{run.run_id.slice(0, 8)}…</td>
                      <td className="px-3 py-2 text-slate-300 text-[11px]">{run.workflow_name}</td>
                      <td className="px-3 py-2">
                        <StatusBadge variant={run.status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'} size="xs" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-blue-500"
                              style={{ width: `${run.total_steps > 0 ? Math.round((run.completed_steps / run.total_steps) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{run.completed_steps}/{run.total_steps}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">
                        {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-3 py-2 text-red-400 font-mono text-[10px] max-w-xs truncate">{run.error ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(run.started_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

function WorkflowsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="h-32 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
    </>
  )
}

export default function WorkflowsPage() {
  return (
    <div className="space-y-5">
      {/* Header — renders immediately */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Workflows</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Temporal.io / DB-backed orchestration</p>
        </div>
      </div>

      {/* Data streams in */}
      <Suspense fallback={<WorkflowsSkeleton />}>
        <WorkflowsContent />
      </Suspense>
    </div>
  )
}
