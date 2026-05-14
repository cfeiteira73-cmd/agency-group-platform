// AGENCY GROUP — SH-ROS Control Tower: Agent Detail | AMI: 22506
import Link from 'next/link'
import { StatusBadge } from '../../_components/StatusBadge'
import { SparklineBar } from '../../_components/SparklineBar'

interface AgentDetailData {
  agent_id: string
  agent_name: string
  status: string
  description: string
  executions_24h: number
  executions_7d: number
  success_rate_24h: number | null
  avg_latency_ms: number | null
  p99_latency_ms: number | null
  economic_score_avg: number | null
  economic_score_total: number | null
  sparkline_24h: number[]
  recent_executions: Array<{
    event_id: string
    action: string
    status: string
    latency_ms: number | null
    economic_score: number | null
    error: string | null
    executed_at: string
  }>
  top_actions: Array<{ action: string; count: number; success_rate: number }>
  error_summary: Array<{ message: string; count: number; last_seen: string }>
}

async function fetchAgentDetail(agent_id: string): Promise<AgentDetailData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/agents/${agent_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 15 },
    })
    if (!res.ok) return null
    return res.json() as Promise<AgentDetailData>
  } catch { return null }
}

export default async function AgentDetailPage({ params }: { params: { agent_id: string } }) {
  const data = await fetchAgentDetail(params.agent_id)

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
        <Link href="/control-tower/agents" className="hover:text-slate-300 transition-colors">← Agents</Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-400">{params.agent_id}</span>
      </div>

      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Agent not found</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">{params.agent_id}</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-slate-100">{data.agent_name}</h1>
                <StatusBadge variant={data.status as 'healthy' | 'degraded' | 'failed' | 'idle'} />
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">{data.agent_id}</p>
              {data.description && (
                <p className="text-xs text-slate-400 mt-1">{data.description}</p>
              )}
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Execs (24h)', value: data.executions_24h, color: 'text-slate-100' },
              { label: 'Execs (7d)', value: data.executions_7d, color: 'text-slate-100' },
              { label: 'Success Rate', value: data.success_rate_24h != null ? `${data.success_rate_24h}%` : '—', color: data.success_rate_24h != null && data.success_rate_24h >= 90 ? 'text-green-400' : data.success_rate_24h != null && data.success_rate_24h >= 70 ? 'text-amber-400' : 'text-red-400' },
              { label: 'Avg Latency', value: data.avg_latency_ms != null ? `${data.avg_latency_ms}ms` : '—', color: 'text-slate-100' },
              { label: 'Total EV', value: data.economic_score_total != null ? data.economic_score_total.toFixed(0) : '—', color: 'text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#111118] border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sparkline */}
          {data.sparkline_24h.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Execution Throughput — Last 24h</p>
              <SparklineBar data={data.sparkline_24h} height={40} />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-600 font-mono">24h ago</span>
                <span className="text-[10px] text-slate-600 font-mono">now</span>
              </div>
            </div>
          )}

          {/* Top Actions */}
          {data.top_actions.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Top Actions</p>
              <div className="space-y-2">
                {data.top_actions.map(({ action, count, success_rate }) => (
                  <div key={action} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-300 w-48 truncate">{action}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${Math.min(success_rate, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{count}</span>
                    <span className={`text-[10px] font-mono w-10 text-right ${success_rate >= 90 ? 'text-green-400' : success_rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                      {success_rate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Summary */}
          {data.error_summary.length > 0 && (
            <div className="bg-[#111118] border border-red-900/30 rounded-lg p-4">
              <p className="text-xs text-red-400 font-medium mb-3">Error Summary</p>
              <div className="space-y-2">
                {data.error_summary.map(({ message, count, last_seen }) => (
                  <div key={message} className="flex items-start gap-3 py-1.5 border-t border-slate-800 first:border-0">
                    <span className="text-[10px] font-mono bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded">{count}×</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 font-mono truncate">{message}</p>
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5">Last: {new Date(last_seen).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Executions */}
          <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs text-slate-400 font-medium">Recent Executions</p>
            </div>
            {data.recent_executions.length === 0 ? (
              <p className="text-xs text-slate-600 p-4">No executions recorded</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Event', 'Action', 'Status', 'Latency', 'EV', 'Error', 'Time'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_executions.map((exec, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2">
                        <Link href={`/control-tower/events/${exec.event_id}`} className="font-mono text-blue-400 hover:text-blue-300 text-[10px]">
                          {exec.event_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">{exec.action}</td>
                      <td className="px-3 py-2">
                        <StatusBadge variant={exec.status as 'completed' | 'failed' | 'pending' | 'processing' | 'dlq'} size="xs" />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">{exec.latency_ms != null ? `${exec.latency_ms}ms` : '—'}</td>
                      <td className="px-3 py-2 font-mono text-purple-400">{exec.economic_score != null ? exec.economic_score.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 text-red-400 font-mono text-[10px] max-w-xs truncate">{exec.error ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">{new Date(exec.executed_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
