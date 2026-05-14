// AGENCY GROUP — SH-ROS Control Tower: Overview | AMI: 22506
import { KPICard } from './_components/KPICard'
import { SparklineBar } from './_components/SparklineBar'
import { StatusBadge } from './_components/StatusBadge'

interface OverviewData {
  kpis: {
    events_total_24h: number
    events_last_1h: number
    dlq_count: number
    avg_latency_ms: number | null
    avg_economic_score: number | null
    critical_alerts: number
    automation_success_pct: number | null
  }
  by_status: Record<string, number>
  sparkline_24h: number[]
  active_alerts: Array<{ id: string; alert_type: string; severity: string; message: string; created_at: string }>
}

async function fetchOverview(org_id: string): Promise<OverviewData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/overview?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return res.json() as Promise<OverviewData>
  } catch { return null }
}

export default async function ControlTowerOverviewPage() {
  const data = await fetchOverview('default')

  const kpis = data?.kpis
  const sparkline = data?.sparkline_24h ?? new Array(24).fill(0)
  const byStatus  = data?.by_status ?? {}

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">System Overview</h1>
        <p className="text-xs text-slate-500 mt-0.5 font-mono">Real-time SH-ROS operational status</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Events (24h)"
          value={kpis?.events_total_24h ?? 0}
          sub={`${kpis?.events_last_1h ?? 0} in last hour`}
          color="default"
        />
        <KPICard
          title="DLQ"
          value={kpis?.dlq_count ?? 0}
          sub={(kpis?.dlq_count ?? 0) > 0 ? 'Requires attention' : 'Queue healthy'}
          color={(kpis?.dlq_count ?? 0) > 0 ? 'red' : 'green'}
        />
        <KPICard
          title="Avg Latency"
          value={kpis?.avg_latency_ms != null ? `${kpis.avg_latency_ms}ms` : '—'}
          sub="Budget: 2000ms"
          mono
          color={
            kpis?.avg_latency_ms == null ? 'default'
            : kpis.avg_latency_ms > 2000 ? 'red'
            : kpis.avg_latency_ms > 1000 ? 'amber'
            : 'green'
          }
        />
        <KPICard
          title="Agent Success"
          value={kpis?.automation_success_pct != null ? `${kpis.automation_success_pct}%` : '—'}
          sub="24h execution rate"
          color={
            kpis?.automation_success_pct == null ? 'default'
            : kpis.automation_success_pct >= 90 ? 'green'
            : kpis.automation_success_pct >= 70 ? 'amber'
            : 'red'
          }
        />
      </div>

      {/* Throughput + Status */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sparkline */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 font-medium mb-3">Event Throughput — Last 24h</p>
          <SparklineBar data={sparkline} height={48} />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-slate-600 font-mono">24h ago</span>
            <span className="text-[10px] text-slate-600 font-mono">now</span>
          </div>
        </div>

        {/* Status distribution */}
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400 font-medium mb-3">Event Status Distribution</p>
          <div className="space-y-2">
            {Object.entries(byStatus).length === 0 ? (
              <p className="text-xs text-slate-600">No events yet</p>
            ) : (
              Object.entries(byStatus).map(([status, count]) => {
                const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={status} className="flex items-center gap-2">
                    <StatusBadge variant={status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'} />
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          status === 'completed' ? 'bg-green-500'
                          : status === 'failed' ? 'bg-red-500'
                          : status === 'dlq' ? 'bg-orange-500'
                          : status === 'processing' ? 'bg-blue-500'
                          : 'bg-slate-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-8 text-right">{count}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {(data?.active_alerts?.length ?? 0) > 0 && (
        <div className="bg-[#111118] border border-red-900/40 rounded-lg p-4">
          <p className="text-xs text-red-400 font-medium mb-3">⚠ Active P0/P1 Alerts</p>
          <div className="space-y-2">
            {data!.active_alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 py-1.5 border-t border-slate-800 first:border-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  alert.severity === 'P0' ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'
                }`}>{alert.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{alert.message}</p>
                  <p className="text-[10px] text-slate-600 font-mono mt-0.5">{alert.alert_type} · {new Date(alert.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data && (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">No data available</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">POST to /api/runtime/events to start</p>
        </div>
      )}
    </div>
  )
}
