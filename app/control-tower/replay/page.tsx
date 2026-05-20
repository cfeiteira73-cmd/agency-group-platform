// AGENCY GROUP — SH-ROS Control Tower: Replay Console | AMI: 22506
// RSC — no 'use client' — ISR revalidate 15s

import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import { StatusBadge } from '../_components/StatusBadge'
import { KPICard } from '../_components/KPICard'

export const revalidate = 15

// ─── Types ────────────────────────────────────────────────────────────────────

// runtime_events row shape — matches database.types.ts schema exactly
interface RuntimeEventRow {
  event_id: string
  type: string
  org_id: string
  retry_count: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  agents_triggered: string[]
  agents_failed: string[]
  correlation_id: string
  event_timestamp: string | null
  created_at: string
  updated_at: string
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60)  return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60)  return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)   return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

// ── KPI: DLQ depth — counts from runtime_events (status = 'dlq') ─────────────
async function fetchDLQDepth(): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('runtime_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dlq')
    if (error) return 0
    return count ?? 0
  } catch { return 0 }
}

// ── KPI: Failed events last 24h ────────────────────────────────────────────
async function fetchFailedLast24h(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await supabaseAdmin
      .from('runtime_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', cutoff)
    if (error) return 0
    return count ?? 0
  } catch { return 0 }
}

// ── KPI: Pending retry ──────────────────────────────────────────────────────
async function fetchPendingRetry(): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('runtime_events')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending'])
    if (error) return 0
    return count ?? 0
  } catch { return 0 }
}

// ── DLQ events table — runtime_events WHERE status IN ('dlq','failed') ──────
async function fetchDLQEvents(): Promise<RuntimeEventRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('runtime_events')
      .select('event_id, type, org_id, retry_count, status, payload, result, agents_triggered, agents_failed, correlation_id, event_timestamp, created_at, updated_at')
      .in('status', ['dlq', 'failed'])
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return []
    return (data as RuntimeEventRow[]) ?? []
  } catch { return [] }
}

async function fetchReplaySessions(): Promise<RuntimeEventRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('runtime_events')
      .select('event_id, type, org_id, retry_count, status, payload, result, agents_triggered, agents_failed, correlation_id, event_timestamp, created_at, updated_at')
      .ilike('type', '%replay%')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return []
    return (data as RuntimeEventRow[]) ?? []
  } catch { return [] }
}

// ─── Sub-helpers ──────────────────────────────────────────────────────────────

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id
}

function truncateError(msg: string | null | undefined, maxChars = 60): string {
  if (!msg) return '—'
  return msg.length > maxChars ? `${msg.slice(0, maxChars)}…` : msg
}

function extractMetaError(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null
  if (typeof metadata['original_error'] === 'string') return metadata['original_error']
  if (typeof metadata['error'] === 'string') return metadata['error']
  return null
}

function extractReplaySessionId(payload: Record<string, unknown> | null): string {
  if (!payload) return '—'
  const meta = payload['metadata'] as Record<string, unknown> | null | undefined
  if (meta && typeof meta['replay_session'] === 'string') return meta['replay_session']
  if (typeof payload['replay_session'] === 'string') return payload['replay_session']
  if (typeof payload['correlation_id'] === 'string') return payload['correlation_id']
  return '—'
}

function extractEventsReplayed(payload: Record<string, unknown> | null): number | string {
  if (!payload) return '—'
  const meta = payload['metadata'] as Record<string, unknown> | null | undefined
  if (meta && typeof meta['events_count'] === 'number') return meta['events_count']
  if (typeof payload['events_replayed'] === 'number') return payload['events_replayed']
  return '—'
}

function extractDuration(row: RuntimeEventRow): string {
  const pl = row.payload
  if (!pl) return '—'
  const meta = pl['metadata'] as Record<string, unknown> | null | undefined
  if (meta && typeof meta['duration_ms'] === 'number') {
    const ms = meta['duration_ms'] as number
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }
  return '—'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ReplaySkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* DLQ status badge placeholder */}
      <div className="h-5 w-24 bg-zinc-800/50 rounded self-end" />

      {/* DLQ Status KPI row */}
      <section className="space-y-3">
        <div className="h-3 w-20 bg-zinc-800/60 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-xl" />
          ))}
        </div>
      </section>

      {/* DLQ Events table */}
      <section className="space-y-3">
        <div className="h-3 w-28 bg-zinc-800/60 rounded" />
        <div className="h-56 bg-zinc-800/40 rounded-lg" />
      </section>

      {/* Replay Sessions table */}
      <section className="space-y-3">
        <div className="h-3 w-32 bg-zinc-800/60 rounded" />
        <div className="h-40 bg-zinc-800/40 rounded-lg" />
      </section>

      {/* Corridor Configuration */}
      <section className="space-y-3">
        <div className="h-3 w-40 bg-zinc-800/60 rounded" />
        <div className="h-32 bg-zinc-800/40 rounded-lg" />
        <div className="h-28 bg-zinc-800/40 rounded-lg" />
      </section>
    </div>
  )
}

// ─── Async content (does all DB work) ────────────────────────────────────────

async function ReplayContent() {
  const [dlqDepth, failed24h, pendingRetry, dlqEvents, replaySessions] = await Promise.all([
    fetchDLQDepth(),
    fetchFailedLast24h(),
    fetchPendingRetry(),
    fetchDLQEvents(),
    fetchReplaySessions(),
  ])

  return (
    <>
      {/* ── DLQ badge (data-dependent) ─────────────────────────────────────── */}
      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            dlqDepth > 0
              ? 'bg-red-950 text-red-400 border-red-700'
              : 'bg-green-950 text-green-400 border-green-700'
          }`}>
            {dlqDepth > 0 ? `DLQ: ${dlqDepth}` : 'DLQ CLEAR'}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">ISR 15s</span>
        </div>
      </div>

      {/* ── Section 1 — DLQ Status KPI row ───────────────────────────────── */}
      <section>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-3">DLQ Status</p>
        <div className="grid grid-cols-3 gap-4">
          <KPICard
            title="DLQ Depth"
            value={dlqDepth}
            sub="status = dlq"
            color={dlqDepth > 0 ? 'red' : 'green'}
            mono
          />
          <KPICard
            title="Failed Events"
            value={failed24h}
            sub="last 24h · status = failed"
            color={failed24h > 0 ? 'amber' : 'green'}
            mono
          />
          <KPICard
            title="Pending Retry"
            value={pendingRetry}
            sub="status = pending / pending_retry"
            color={pendingRetry > 0 ? 'blue' : 'default'}
            mono
          />
        </div>
      </section>

      {/* ── Section 2 — DLQ Events Table ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">DLQ Events</p>
          <span className="text-[10px] text-slate-600 font-mono">status IN (dlq, failed) · ORDER BY created_at DESC · LIMIT 50</span>
        </div>

        {dlqEvents.length === 0 ? (
          <div className="bg-[#111118] border border-green-900/30 rounded-lg p-6 flex items-center gap-3">
            <span className="text-green-400 text-base">✓</span>
            <div>
              <p className="text-sm text-green-400 font-medium">No DLQ or failed events</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">event_history returned 0 rows for status IN (dlq, failed)</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#111118] border border-orange-900/40 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-orange-900/30 flex items-center justify-between">
              <p className="text-xs text-orange-400 font-medium">
                Dead Letter Queue &amp; Failed Events
              </p>
              <span className="text-[10px] text-slate-600 font-mono">{dlqEvents.length} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0a0a0f]">
                    {['Event ID', 'Type', 'Tenant', 'Agent', 'Attempts', 'Status', 'Last Error', 'Age'].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dlqEvents ?? []).map((row) => {
                    const displayError = extractMetaError(row.payload) ?? (row.agents_failed?.[0] ? `Agent failed: ${row.agents_failed[0]}` : null)
                    return (
                      <tr
                        key={row.event_id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors border-l-2 border-l-orange-700/60"
                      >
                        <td className="px-3 py-2 font-mono text-orange-400 text-[10px] whitespace-nowrap">
                          {truncateId(row.event_id)}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300 text-[10px] max-w-[12rem] truncate whitespace-nowrap">
                          {row.type ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {row.org_id ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {row.agents_triggered?.[0] ?? row.agents_failed?.[0] ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-400 text-[10px] whitespace-nowrap">
                          {row.retry_count ?? 0}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <StatusBadge
                            variant={(row.status === 'dlq' ? 'dlq' : 'failed') as 'dlq' | 'failed'}
                            size="xs"
                          />
                        </td>
                        <td className="px-3 py-2 text-red-400 font-mono text-[10px] max-w-[15rem] truncate">
                          {truncateError(displayError)}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                          {relativeTime(row.created_at ?? row.updated_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 3 — Replay Sessions Table ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Replay Sessions</p>
          <span className="text-[10px] text-slate-600 font-mono">type LIKE &apos;%replay%&apos; OR payload-&gt;&gt;&apos;replay_session&apos; IS NOT NULL · LIMIT 20</span>
        </div>

        {replaySessions.length === 0 ? (
          <div className="bg-[#111118] border border-slate-800 rounded-lg p-6 text-center">
            <p className="text-slate-500 text-sm">No replay sessions found</p>
            <p className="text-slate-600 text-[10px] font-mono mt-1">No events with type matching &apos;%replay%&apos; or replay_session metadata</p>
          </div>
        ) : (
          <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Recent Replay Sessions</p>
              <span className="text-[10px] text-slate-600 font-mono">{replaySessions.length} sessions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#0a0a0f]">
                    {['Session ID', 'Started At', 'Events Replayed', 'Status', 'Duration'].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] text-slate-500 font-medium px-3 py-2 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(replaySessions ?? []).map((row) => {
                    const sessionId = extractReplaySessionId(row.payload)
                    const eventsReplayed = extractEventsReplayed(row.payload)
                    const duration = extractDuration(row)
                    // Derive display status from type string + actual status
                    const statusVariant: 'completed' | 'failed' | 'processing' | 'pending' =
                      row.status === 'completed' ? 'completed'
                      : row.status === 'failed'  ? 'failed'
                      : row.type.includes('completed') ? 'completed'
                      : row.type.includes('failed')    ? 'failed'
                      : row.status === 'processing'    ? 'processing'
                      : 'pending'

                    return (
                      <tr
                        key={row.event_id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-blue-400 text-[10px] whitespace-nowrap">
                          {truncateId(sessionId)}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {(row.event_timestamp ?? row.created_at)
                            ? new Date((row.event_timestamp ?? row.created_at)!).toLocaleString('en-GB', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-100 text-[10px] whitespace-nowrap">
                          {eventsReplayed}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <StatusBadge variant={statusVariant} size="xs" />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400 text-[10px] whitespace-nowrap">
                          {duration}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 4 — Corridor Stats ────────────────────────────────────── */}
      <section>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-3">Corridor Configuration</p>
        <div className="bg-[#111118] border border-slate-800 rounded-lg p-5 grid grid-cols-3 gap-6">

          {/* Exactly-once */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Idempotency Guarantee</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              <span className="text-sm font-medium text-green-400">Active</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Redis NX+EX · exactly-once semantics</p>
            <p className="text-[10px] text-slate-600 font-mono">
              Dedup TTL: 60s · Key: <code className="text-slate-500">ev_dedup:{'{'}key{'}'}</code>
            </p>
          </div>

          {/* Default TTL */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Default TTL</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-blue-400">24h</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Event history retention window</p>
            <p className="text-[10px] text-slate-600 font-mono">GDPR purge cron: 03:00 UTC daily</p>
          </div>

          {/* Replay depth */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Replay Depth</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              <span className="text-sm font-medium text-purple-400">Full</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Cold memory — HistoricalReplayEngine</p>
            <p className="text-[10px] text-slate-600 font-mono">Strategies: org · trace · chain · time-range</p>
          </div>
        </div>

        {/* Sub-row: engine details */}
        <div className="mt-3 bg-[#111118] border border-slate-800 rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-2">Queue Replay Engine</p>
            <div className="space-y-1">
              {[
                ['Source table',   'runtime_events'],
                ['DLQ status',     'status = dlq'],
                ['Replay trigger', 'status → pending · retry_count = 0'],
                ['Dry-run',        'Supported · no mutations'],
                ['Guard',          'Idempotent — skips completed rows'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 w-28 shrink-0">{label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-2">Event Bus / History</p>
            <div className="space-y-1">
              {[
                ['History table',  'event_history'],
                ['History flag',   'EVENT_HISTORY_ENABLED=true'],
                ['DLQ table',      'learning_events (metadata.dlq=true)'],
                ['Poison guard',   'Max 64 KB payload · non-object → quarantine'],
                ['Backend',        'Supabase · pluggable adapter'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 w-28 shrink-0">{label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReplayConsolePage() {
  return (
    <div className="space-y-6">

      {/* ── Header (static — renders immediately) ─────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Replay Console</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Event replay · DLQ recovery · Historical corridor replay
          </p>
        </div>
      </div>

      {/* ── Async content with Suspense ────────────────────────────────────── */}
      <Suspense fallback={<ReplaySkeleton />}>
        <ReplayContent />
      </Suspense>

    </div>
  )
}
