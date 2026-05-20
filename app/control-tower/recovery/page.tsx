// AGENCY GROUP — SH-ROS Control Tower: Recovery | AMI: 22506
export const revalidate = 30

import { StatusBadge } from '../_components/StatusBadge'

interface RecoveryData {
  status: 'healthy' | 'degraded' | 'critical'
  last_run: string | null
  orphans_recovered_24h: number
  reconciliations_24h: number
  split_brain_events_7d: number
  active_locks: number
  active_leases: number
  recent_recoveries: Array<{
    id: string
    type: string
    event_id: string
    status: string
    recovered_at: string
    details: string
  }>
  reconciliation_issues: Array<{
    event_id: string
    expected_status: string
    actual_status: string
    resolved: boolean
    detected_at: string
  }>
}

async function fetchRecoveryData(org_id: string): Promise<RecoveryData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/recovery?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return res.json() as Promise<RecoveryData>
  } catch { return null }
}

export default async function RecoveryPage() {
  const data = await fetchRecoveryData(process.env.DEFAULT_TENANT_ID ?? 'agency-group')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Recovery System</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Orphan recovery · Reconciliation · Distributed locks · Split-brain protection
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.status && (
            <StatusBadge variant={data.status === 'healthy' ? 'healthy' : data.status === 'degraded' ? 'degraded' : 'failed'} />
          )}
          {data?.last_run && (
            <span className="text-[10px] text-slate-500 font-mono">
              Last run: {new Date(data.last_run).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Recovery data unavailable</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Orphans Recovered', value: data.orphans_recovered_24h, color: 'text-slate-100', sub: '24h' },
              { label: 'Reconciliations', value: data.reconciliations_24h, color: 'text-blue-400', sub: '24h' },
              { label: 'Split Brain Events', value: data.split_brain_events_7d, color: data.split_brain_events_7d > 0 ? 'text-red-400' : 'text-green-400', sub: '7d' },
              { label: 'Active Locks', value: data.active_locks, color: data.active_locks > 10 ? 'text-amber-400' : 'text-slate-100', sub: 'now' },
              { label: 'Active Leases', value: data.active_leases, color: 'text-purple-400', sub: 'now' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="bg-[#111118] border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-600 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Active locks/leases info */}
          {(data.active_locks > 0 || data.active_leases > 0) && (
            <div className="bg-[#111118] border border-blue-900/30 rounded-lg p-4 flex items-center gap-4">
              <span className="text-blue-400 text-lg">🔒</span>
              <div>
                <p className="text-sm text-blue-300 font-medium">
                  {data.active_locks} distributed lock{data.active_locks !== 1 ? 's' : ''} ·{' '}
                  {data.active_leases} execution lease{data.active_leases !== 1 ? 's' : ''} active
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Locks prevent concurrent processing of the same event across workers
                </p>
              </div>
            </div>
          )}

          {/* Reconciliation issues */}
          {data.reconciliation_issues.length > 0 && (
            <div className="bg-[#111118] border border-amber-900/40 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-900/30">
                <p className="text-xs text-amber-400 font-medium">Status Discrepancies — Reconciliation Queue</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Event ID', 'Expected', 'Actual', 'Status', 'Detected'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.reconciliation_issues.map((issue) => (
                    <tr key={issue.event_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2 font-mono text-blue-400 text-[10px]">{issue.event_id.slice(0, 8)}…</td>
                      <td className="px-3 py-2">
                        <StatusBadge variant={issue.expected_status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'} size="xs" />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge variant={issue.actual_status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'} size="xs" />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-mono ${issue.resolved ? 'text-green-400' : 'text-amber-400'}`}>
                          {issue.resolved ? '✓ resolved' : '⚠ pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(issue.detected_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent recoveries */}
          {data.recent_recoveries.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Recent Recovery Actions</p>
              </div>
              <div className="divide-y divide-slate-800/50">
                {data.recent_recoveries.map((rec) => (
                  <div key={rec.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      rec.status === 'recovered' ? 'bg-green-900/40 text-green-400 border border-green-800/40'
                      : 'bg-red-900/40 text-red-400 border border-red-800/40'
                    }`}>
                      {rec.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300">{rec.details}</span>
                        <span className="text-[10px] font-mono text-slate-600">{rec.event_id.slice(0, 8)}…</span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono">
                        {new Date(rec.recovered_at).toLocaleString()}
                      </span>
                    </div>
                    <StatusBadge variant={rec.status === 'recovered' ? 'completed' : 'failed'} size="xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.orphans_recovered_24h === 0 && data.reconciliation_issues.length === 0 && (
            <div className="bg-[#111118] border border-green-900/30 rounded-lg p-4 flex items-center gap-3">
              <span className="text-green-400 text-lg">✓</span>
              <div>
                <p className="text-sm text-green-400 font-medium">Recovery system nominal</p>
                <p className="text-[10px] text-slate-500 font-mono">No orphans or discrepancies detected in last 24h</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
