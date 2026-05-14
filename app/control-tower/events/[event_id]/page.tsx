// AGENCY GROUP — SH-ROS Control Tower: Event Detail | AMI: 22506
import Link from 'next/link'
import { StatusBadge } from '../../_components/StatusBadge'

interface EventDetail {
  event_id: string
  org_id: string
  type: string
  status: string
  priority: string
  source_system: string
  correlation_id: string | null
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  latency_ms: number | null
  economic_score: number | null
  retry_count: number
  error_message: string | null
  event_timestamp: string | null
  event_chain: string[]
  created_at: string
  updated_at: string
}

interface AgentExecution {
  agent_id: string
  action: string
  status: string
  latency_ms: number | null
  economic_score: number | null
  error: string | null
  executed_at: string
}

interface EventDetailResponse {
  event: EventDetail
  agent_executions: AgentExecution[]
  related_events: Array<{ event_id: string; type: string; status: string; created_at: string }>
}

async function fetchEventDetail(event_id: string): Promise<EventDetailResponse | null> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/runtime/events/${event_id}`,
      {
        headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
        next: { revalidate: 5 },
      },
    )
    if (!res.ok) return null
    return res.json() as Promise<EventDetailResponse>
  } catch { return null }
}

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  const json = JSON.stringify(data, null, 2)
  return (
    <div className="bg-[#0A0A0F] border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span className="text-[10px] text-slate-600 font-mono">{json.length} chars</span>
      </div>
      <pre className="text-[11px] text-slate-300 font-mono p-3 overflow-auto max-h-60 leading-relaxed">
        {json}
      </pre>
    </div>
  )
}

export default async function EventDetailPage({ params }: { params: { event_id: string } }) {
  const data = await fetchEventDetail(params.event_id)
  const event = data?.event

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
        <Link href="/control-tower/events" className="hover:text-slate-300 transition-colors">
          ← Events
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-400">{params.event_id.slice(0, 8)}…</span>
      </div>

      {!event ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Event not found</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">{params.event_id}</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-slate-100 font-mono">
                  {event.event_id.slice(0, 8)}…
                </h1>
                <StatusBadge variant={event.status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'} />
                <StatusBadge variant={event.priority as 'critical' | 'high' | 'medium' | 'low'} />
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">
                {event.type} · {event.source_system} · {new Date(event.created_at).toLocaleString()}
              </p>
            </div>
            {event.error_message && (
              <div className="bg-red-950/40 border border-red-800/40 rounded px-3 py-2 max-w-sm">
                <p className="text-xs text-red-400 font-mono truncate">{event.error_message}</p>
              </div>
            )}
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Latency', value: event.latency_ms != null ? `${event.latency_ms}ms` : '—', mono: true },
              { label: 'Econ Score', value: event.economic_score != null ? event.economic_score.toFixed(3) : '—', mono: true },
              { label: 'Retries', value: event.retry_count ?? 0, mono: true },
              { label: 'Chain Depth', value: event.event_chain?.length ?? 1, mono: true },
              { label: 'Org', value: event.org_id, mono: true },
            ].map(({ label, value, mono }) => (
              <div key={label} className="bg-[#111118] border border-slate-800 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-sm font-semibold text-slate-100 ${mono ? 'font-mono' : ''} truncate`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Payload */}
            <JsonViewer data={event.payload} label="Payload" />
            {/* Result */}
            <JsonViewer data={event.result ?? {}} label="Result" />
          </div>

          {/* Event Chain */}
          {event.event_chain && event.event_chain.length > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 font-medium mb-3">Event Chain — Causality Path</p>
              <div className="flex items-center gap-2 flex-wrap">
                {event.event_chain.map((id, i) => (
                  <div key={id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-slate-600 text-xs">→</span>}
                    <Link
                      href={`/control-tower/events/${id}`}
                      className={`font-mono text-[11px] px-2 py-1 rounded border transition-colors ${
                        id === event.event_id
                          ? 'border-blue-600 bg-blue-950/40 text-blue-300'
                          : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {id.slice(0, 8)}…
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Executions */}
          {(data?.agent_executions?.length ?? 0) > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Agent Executions</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                    {['Agent', 'Action', 'Status', 'Latency', 'Econ Score', 'Error', 'Time'].map(h => (
                      <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.agent_executions.map((exec, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-3 py-2 font-mono text-blue-400 text-[11px]">{exec.agent_id}</td>
                      <td className="px-3 py-2 text-slate-300">{exec.action}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          variant={exec.status as 'completed' | 'failed' | 'pending' | 'processing' | 'dlq'}
                          size="xs"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {exec.latency_ms != null ? `${exec.latency_ms}ms` : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-purple-400">
                        {exec.economic_score != null ? exec.economic_score.toFixed(3) : '—'}
                      </td>
                      <td className="px-3 py-2 text-red-400 text-[10px] font-mono max-w-xs truncate">
                        {exec.error ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                        {new Date(exec.executed_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Related Events */}
          {(data?.related_events?.length ?? 0) > 0 && (
            <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs text-slate-400 font-medium">Related Events (same correlation_id)</p>
              </div>
              <div className="divide-y divide-slate-800/50">
                {data!.related_events.map(rel => (
                  <div key={rel.event_id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-800/20 transition-colors">
                    <Link href={`/control-tower/events/${rel.event_id}`} className="font-mono text-blue-400 hover:text-blue-300 text-xs">
                      {rel.event_id.slice(0, 8)}…
                    </Link>
                    <span className="text-xs text-slate-400 font-mono flex-1">{rel.type}</span>
                    <StatusBadge
                      variant={rel.status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'}
                      size="xs"
                    />
                    <span className="text-[10px] text-slate-600 font-mono">
                      {new Date(rel.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Metadata */}
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-medium mb-3">Full Event Record</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              {[
                ['event_id', event.event_id],
                ['correlation_id', event.correlation_id ?? '—'],
                ['org_id', event.org_id],
                ['type', event.type],
                ['status', event.status],
                ['priority', event.priority],
                ['source_system', event.source_system],
                ['event_timestamp', event.event_timestamp ?? event.created_at],
                ['created_at', event.created_at],
                ['updated_at', event.updated_at],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3">
                  <span className="text-[10px] text-slate-500 font-mono w-32 shrink-0">{k}</span>
                  <span className="text-[11px] text-slate-300 font-mono truncate">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
