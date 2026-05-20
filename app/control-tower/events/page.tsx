// AGENCY GROUP — SH-ROS Control Tower: Events | AMI: 22506
export const revalidate = 10

import { Suspense } from 'react'
import Link from 'next/link'
import { StatusBadge } from '../_components/StatusBadge'

interface RuntimeEventRow {
  event_id: string
  org_id: string
  type: string
  status: string
  priority: string
  source_system: string
  latency_ms: number | null
  economic_score: number | null
  created_at: string
}

async function fetchEvents(org_id: string, limit = 50): Promise<RuntimeEventRow[]> {
  try {
    const baseUrl = process.env.INTERNAL_API_BASE ?? 'http://localhost:3000'
    const res = await fetch(
      `${baseUrl}/api/runtime/events?org_id=${org_id}&limit=${limit}&source=db`,
      {
        headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN ?? process.env.CRON_SECRET ?? ''}` },
        next: { revalidate: 10 },
      },
    )
    if (!res.ok) return []
    const json = await res.json() as { events: RuntimeEventRow[] }
    return json.events ?? []
  } catch { return [] }
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-500/10',
  high:     'text-orange-400 bg-orange-500/10',
  medium:   'text-blue-400 bg-blue-500/10',
  low:      'text-slate-400 bg-slate-700/40',
}

async function EventsContent() {
  const events = await fetchEvents('default', 50)

  return (
    <>
      <p className="text-xs text-slate-500 font-mono">{events.length} events loaded</p>

      {events.length === 0 ? (
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">No events yet</p>
          <p className="text-slate-600 text-xs mt-1 font-mono">POST to /api/runtime/events to begin</p>
        </div>
      ) : (
        <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0A0A0F]">
                {['Event ID', 'Type', 'Status', 'Priority', 'Source', 'Latency', 'Econ Score', 'Time'].map(h => (
                  <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-3 py-2.5 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <tr
                  key={event.event_id}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${
                    event.status === 'dlq' ? 'border-l-2 border-l-orange-500' : ''
                  } ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}
                >
                  <td className="px-3 py-2">
                    <Link href={`/control-tower/events/${event.event_id}`} className="font-mono text-blue-400 hover:text-blue-300">
                      {event.event_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300 text-[10px]">{event.type}</td>
                  <td className="px-3 py-2"><StatusBadge variant={event.status as 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'} /></td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[event.priority] ?? 'text-slate-400'}`}>
                      {event.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">{event.source_system}</td>
                  <td className="px-3 py-2 font-mono text-slate-400">
                    {event.latency_ms != null ? `${event.latency_ms}ms` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-purple-400">
                    {event.economic_score != null ? event.economic_score.toFixed(3) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function EventsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="h-10 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
      ))}
    </div>
  )
}

export default function EventsPage() {
  return (
    <div className="space-y-4">
      {/* Header — renders immediately */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Event Stream</h1>
        </div>
      </div>

      {/* Data streams in */}
      <Suspense fallback={<EventsSkeleton />}>
        <EventsContent />
      </Suspense>
    </div>
  )
}
