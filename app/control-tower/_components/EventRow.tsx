'use client'

import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import type { DBRuntimeEvent } from '@/app/control-tower/_lib/types'

interface EventRowProps {
  event: DBRuntimeEvent
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function truncateId(id: string): string {
  return id.substring(0, 8) + '…'
}

export function EventRow({ event }: EventRowProps) {
  const isDLQ = event.status === 'dlq'

  return (
    <Link href={`/control-tower/events/${event.event_id}`}>
      <div className={`grid grid-cols-[110px_1fr_120px_80px_80px_90px_70px_80px] gap-3 px-3 py-2 text-xs hover:bg-[#1A1A24] transition-colors cursor-pointer ${isDLQ ? 'border-l-2 border-orange-500' : ''}`}>
        <span className="font-mono text-slate-400 truncate">{truncateId(event.event_id)}</span>
        <span className="font-mono text-slate-300 truncate">{event.type}</span>
        <span className="text-slate-400 truncate">{event.org_id}</span>
        <span><StatusBadge variant={event.status} size="xs" /></span>
        <span><StatusBadge variant={event.priority} size="xs" /></span>
        <span className="text-slate-500 truncate">{event.source ?? '—'}</span>
        <span className="font-mono text-slate-400 text-right">{formatLatency(event.latency_ms)}</span>
        <span className="font-mono text-slate-500 text-right">{formatTime(event.created_at)}</span>
      </div>
    </Link>
  )
}
