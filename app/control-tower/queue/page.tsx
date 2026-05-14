// AGENCY GROUP — SH-ROS Control Tower: Queue | AMI: 22506
import { StatusBadge } from '../_components/StatusBadge'
import { SparklineBar } from '../_components/SparklineBar'

interface QueueData {
  provider: string
  total_pending: number
  total_processing: number
  total_dlq: number
  throughput_per_min: number
  by_priority: Record<string, { pending: number; processing: number }>
  dlq_events: Array<{
    event_id: string
    type: string
    priority: string
    retry_count: number
    error_message: string | null
    created_at: string
  }>
  health: 'healthy' | 'degraded' | 'critical'
  throughput_sparkline: number[]
}

async function fetchQueueData(org_id: string): Promise<QueueData | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-tower/queue?org_id=${org_id}`, {
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
      next: { revalidate: 15 },
    })
    if (!res.ok) return null
    return res.json() as Promise<QueueData>
  } catch { return null }
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-blue-500',
  low:      'bg-slate-600',
}

export default async function QueuePage() {
  const data = await fetchQueueData('default')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Queue Health</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Provider: <span className="text-blue-400">{data?.provider ?? 'unknown'}</span>
          </p>
        </div>
        {data?.health && (
          <StatusBadge variant={data.health as 'healthy' | 'degraded' | 'critical'} />
        )}
      </div>

      {!data ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Queue data unavailable</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">GET /api/control-tower/queue</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Pending', value: data.total_pending, color: data.total_pending > 100 ? 'text-amber-400' : 'text-slate-100' },
              { label: 'Processing', value: data.total_processing, color: 'text-blue-400' },
              { label: 'DLQ', value: data.total_dlq, color: data.total_dlq > 0 ? 'text-red-400' : 'text-green-400' },
              { label: 'Throughput/min', value: data.throughput_per_min, color: 'text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#111118] border border-slate-800 rounded-lg p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Priority breakdown + sparkline */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority depth */}
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Queue Depth by Priority</p>
              <div className="space-y-3">
                {Object.entries(data.by_priority).map(([priority, { pending, processing }]) => {
                  const total = pending + processing
                  const maxTotal = Object.values(data.by_priority).reduce((m, v) => Math.max(m, v.pending + v.processing), 1)
                  const pct = Math.round((total / maxTotal) * 100)
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono capitalize text-slate-300">{priority}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500">
                            {pending}p · {processing}⚡
                          </span>
                          <span className="text-xs font-mono text-slate-300 w-8 text-right">{total}</span>
                        </div>
                      </div>
                      <div className="bg-slate-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${PRIORITY_COLORS[priority] ?? 'bg-slate-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Throughput sparkline */}
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Throughput — Last 30 minutes</p>
              <SparklineBar data={data.throughput_sparkline} height={80} color="#8B5CF6" />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-slate-600 font-mono">30m ago</span>
                <span className="text-[10px] text-slate-600 font-mono">now</span>
              </div>
            </div>
          </div>

          {/* DLQ */}
          {data.dlq_events.length > 0 && (
            <div className="bg-[#111118] border border-orange-900/40 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-orange-900/30 flex items-center justify-between">
                <p className="text-xs text-orange-400 font-medium">⚠ Dead Letter Queue — {data.total_dlq} events</p>
                <span className="text-[10px] text-slate-600 font-mono">showing {data.dlq_events.length} recent</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Event ID', 'Type', 'Priority', 'Retries', 'Error', 'Queued At'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.dlq_events.map((evt) => (
                    <tr key={evt.event_id} className="border-b border-slate-800/50 border-l-2 border-l-orange-600">
                      <td className="px-3 py-2 font-mono text-orange-400 text-[10px]">{evt.event_id.slice(0, 8)}…</td>
                      <td className="px-3 py-2 font-mono text-slate-300 text-[10px]">{evt.type}</td>
                      <td className="px-3 py-2">
                        <StatusBadge variant={evt.priority as 'critical' | 'high' | 'medium' | 'low'} size="xs" />
                      </td>
                      <td className="px-3 py-2 font-mono text-amber-400">{evt.retry_count}</td>
                      <td className="px-3 py-2 text-red-400 font-mono text-[10px] max-w-xs truncate">{evt.error_message ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(evt.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.total_dlq === 0 && (
            <div className="bg-[#111118] border border-green-900/30 rounded-lg p-4 flex items-center gap-3">
              <span className="text-green-400 text-lg">✓</span>
              <p className="text-sm text-green-400 font-medium">Dead Letter Queue is empty</p>
              <p className="text-xs text-slate-500 ml-auto font-mono">All events processed cleanly</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
