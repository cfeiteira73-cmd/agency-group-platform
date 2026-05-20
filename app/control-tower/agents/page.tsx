// AGENCY GROUP — SH-ROS Control Tower: Agents | AMI: 22506
import Link from 'next/link'
import { Suspense } from 'react'
import { StatusBadge } from '../_components/StatusBadge'

export const revalidate = 30

interface AgentHealth {
  agent_id: string
  agent_name: string
  status: 'healthy' | 'degraded' | 'failed' | 'idle'
  executions_1h: number
  executions_24h: number
  success_rate_24h: number | null
  avg_latency_ms: number | null
  last_execution: string | null
  last_error: string | null
  economic_score_avg: number | null
}

async function fetchAgents(org_id: string): Promise<AgentHealth[]> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/agents?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    const json = await res.json() as { agents: AgentHealth[] }
    return json.agents ?? []
  } catch { return [] }
}

const STATUS_DOT: Record<string, string> = {
  healthy:  'bg-green-400',
  degraded: 'bg-amber-400',
  failed:   'bg-red-400',
  idle:     'bg-slate-600',
}

function AgentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center">
            <div className="h-7 w-10 bg-[#1A1A24] rounded animate-pulse mb-1" />
            <div className="h-3 w-14 bg-[#1A1A24] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

async function AgentsContent() {
  const agents = await fetchAgents(process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001')

  const healthy  = agents.filter(a => a.status === 'healthy').length
  const degraded = agents.filter(a => a.status === 'degraded').length
  const failed   = agents.filter(a => a.status === 'failed').length
  const idle     = agents.filter(a => a.status === 'idle').length

  return (
    <>
      {/* Fleet summary */}
      <div className="flex items-center gap-4">
        {[
          { label: 'Healthy', count: healthy, color: 'text-green-400' },
          { label: 'Degraded', count: degraded, color: 'text-amber-400' },
          { label: 'Failed', count: failed, color: 'text-red-400' },
          { label: 'Idle', count: idle, color: 'text-slate-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="text-center">
            <p className={`text-xl font-bold font-mono ${color}`}>{count}</p>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 font-mono">{agents.length} agents registered</p>

      {agents.length === 0 ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">No agent data available</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">Agents report via /api/control-tower/agents</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {agents.map((agent) => (
            <Link key={agent.agent_id} href={`/control-tower/agents/${agent.agent_id}`}>
              <div className="bg-[#111118] border border-slate-800 rounded-lg p-4 hover:border-slate-600 transition-colors cursor-pointer">
                {/* Agent header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[agent.status] ?? 'bg-slate-600'}`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-100 leading-none">{agent.agent_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{agent.agent_id}</p>
                    </div>
                  </div>
                  <StatusBadge
                    variant={agent.status as 'healthy' | 'degraded' | 'failed' | 'idle'}
                    size="xs"
                  />
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Execs (1h)</p>
                    <p className="text-sm font-mono font-semibold text-slate-200">{agent.executions_1h}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Success</p>
                    <p className={`text-sm font-mono font-semibold ${
                      agent.success_rate_24h == null ? 'text-slate-500'
                      : agent.success_rate_24h >= 90 ? 'text-green-400'
                      : agent.success_rate_24h >= 70 ? 'text-amber-400'
                      : 'text-red-400'
                    }`}>
                      {agent.success_rate_24h != null ? `${agent.success_rate_24h}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Avg Latency</p>
                    <p className="text-sm font-mono font-semibold text-slate-300">
                      {agent.avg_latency_ms != null ? `${agent.avg_latency_ms}ms` : '—'}
                    </p>
                  </div>
                </div>

                {/* Econ score + last execution */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {agent.last_execution
                      ? `Last: ${new Date(agent.last_execution).toLocaleTimeString()}`
                      : 'No executions yet'}
                  </span>
                  {agent.economic_score_avg != null && (
                    <span className="text-[10px] text-purple-400 font-mono">
                      EV {agent.economic_score_avg.toFixed(2)}
                    </span>
                  )}
                </div>
                {agent.economic_score_avg != null && (
                  <div className="mt-2">
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          agent.economic_score_avg >= 0.8 ? 'bg-green-500' :
                          agent.economic_score_avg >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.round(agent.economic_score_avg * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Last error */}
                {agent.last_error && (
                  <div className="mt-2 bg-red-950/30 rounded px-2 py-1">
                    <p className="text-[10px] text-red-400 font-mono truncate">{agent.last_error}</p>
                  </div>
                )}

                {/* Causal trace link */}
                <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 font-mono">causal trace</span>
                  <a
                    href={`/control-tower/events?agent_id=${encodeURIComponent(agent.agent_id)}`}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-mono"
                  >
                    view events →
                  </a>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

export default function AgentsPage() {
  return (
    <div className="space-y-5">
      {/* Static header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Agent Fleet</h1>
      </div>
      <Suspense fallback={<AgentsSkeleton />}>
        <AgentsContent />
      </Suspense>
    </div>
  )
}
