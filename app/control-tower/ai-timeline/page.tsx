// =============================================================================
// Agency Group — Control Tower: AI Decision Timeline
// app/control-tower/ai-timeline/page.tsx
//
// RSC — no 'use client'. Queries audit_log for every AI decision in the last
// 24h, surfaces KPIs and a chronological timeline table.
//
// Columns sourced from audit_log.metadata (jsonb):
//   model, policy, input_tokens, output_tokens, latency_ms,
//   fallback_used, caller_route
//
// TypeScript strict — 0 errors
// =============================================================================

import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { KPICard }     from '@/app/control-tower/_components/KPICard'
import { StatusBadge } from '@/app/control-tower/_components/StatusBadge'

export const revalidate = 15

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditRow {
  id:             string
  actor_id:       string | null
  actor_type:     string
  action:         string
  result:         string
  risk_level:     string
  correlation_id: string | null
  metadata:       Record<string, unknown> | null
  created_at:     string
}

interface ParsedAIRow {
  id:            string
  created_at:    string
  agent:         string
  model:         string
  decision:      'ALLOW' | 'ESCALATE' | 'DENY'
  policy:        string
  input_tokens:  number
  output_tokens: number
  latency_ms:    number
  fallback_used: boolean
  caller_route:  string
}

// ─── Supabase client ──────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchAITimeline(): Promise<ParsedAIRow[]> {
  const db = getDb()
  if (!db) return []

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let rows: AuditRow[] = []
  try {
    const { data, error } = await db
      .from('audit_log')
      .select('id, actor_id, actor_type, action, result, risk_level, correlation_id, metadata, created_at')
      .in('action', ['ai:execute', 'ai:deny', 'ai:escalate'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !data) return []
    rows = data as unknown as AuditRow[]
  } catch {
    return []
  }

  return rows.map((row): ParsedAIRow => {
    const m = row.metadata ?? {}

    // Derive decision from action verb
    const action = row.action ?? ''
    const decision: 'ALLOW' | 'ESCALATE' | 'DENY' =
      action === 'ai:deny'      ? 'DENY'     :
      action === 'ai:escalate'  ? 'ESCALATE' :
                                  'ALLOW'

    return {
      id:            row.id,
      created_at:    row.created_at,
      agent:         typeof m['agent']         === 'string' ? m['agent']         : (row.actor_id ?? row.actor_type ?? 'unknown'),
      model:         typeof m['model']         === 'string' ? m['model']         : '—',
      decision,
      policy:        typeof m['policy']        === 'string' ? m['policy']        : '—',
      input_tokens:  typeof m['input_tokens']  === 'number' ? m['input_tokens']  : 0,
      output_tokens: typeof m['output_tokens'] === 'number' ? m['output_tokens'] : 0,
      latency_ms:    typeof m['latency_ms']    === 'number' ? m['latency_ms']    : 0,
      fallback_used: typeof m['fallback_used'] === 'boolean' ? m['fallback_used'] : false,
      caller_route:  typeof m['caller_route']  === 'string' ? m['caller_route']  : '—',
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}

function rowBg(decision: ParsedAIRow['decision']): string {
  if (decision === 'DENY')     return 'bg-red-950/20  border-b border-red-900/20  hover:bg-red-950/30'
  if (decision === 'ESCALATE') return 'bg-amber-950/20 border-b border-amber-900/20 hover:bg-amber-950/30'
  return 'border-b border-slate-800/30 hover:bg-[#1A1A24]'
}

function decisionBadgeVariant(decision: ParsedAIRow['decision']): 'ok' | 'warning' | 'failed' {
  if (decision === 'DENY')     return 'failed'
  if (decision === 'ESCALATE') return 'warning'
  return 'ok'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AITimelineSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#1A1A24] rounded-lg border border-slate-800 animate-pulse" />
        ))}
      </div>
      <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <div className="h-4 w-32 bg-[#1A1A24] rounded animate-pulse" />
        </div>
        <div className="space-y-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 border-b border-slate-800/30 bg-[#1A1A24] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Dynamic content ──────────────────────────────────────────────────────────

async function AITimelineContent() {
  const rows = await fetchAITimeline().catch((): ParsedAIRow[] => [])

  // ── KPI aggregates ────────────────────────────────────────────────────────
  const totalCalls   = rows.length
  const deniedCount  = rows.filter(r => r.decision === 'DENY').length
  const avgLatency   = totalCalls > 0
    ? Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / totalCalls)
    : 0
  const totalTokens  = rows.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0)

  const missingEnv = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY

  return (
    <>
      {/* ── Missing env warning ───────────────────────────────────────────── */}
      {missingEnv && (
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 mb-6 text-xs text-amber-300 font-mono">
          NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured — showing empty state.
        </div>
      )}

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Total AI Calls (24h)"
          value={totalCalls.toLocaleString()}
          color="blue"
          mono
        />
        <KPICard
          title="Denied by Policy"
          value={deniedCount.toLocaleString()}
          color={deniedCount > 0 ? 'red' : 'green'}
          sub={deniedCount > 0 ? 'requires review' : 'all clear'}
          mono
        />
        <KPICard
          title="Avg Latency"
          value={avgLatency > 0 ? `${avgLatency.toLocaleString()} ms` : '—'}
          color={avgLatency > 5000 ? 'red' : avgLatency > 2000 ? 'amber' : 'green'}
          mono
        />
        <KPICard
          title="Total Tokens Used"
          value={totalTokens > 0 ? totalTokens.toLocaleString() : '—'}
          color="purple"
          mono
        />
      </div>

      {/* ── Timeline table ────────────────────────────────────────────────── */}
      <div className="bg-[#111118] border border-slate-800 rounded-lg overflow-hidden">

        {/* Table header bar */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-slate-200 font-semibold text-sm">
            AI Decision Log
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs font-mono">
              {totalCalls} record{totalCalls !== 1 ? 's' : ''} · limit 100 · revalidate 15s
            </span>
            {deniedCount > 0 && (
              <StatusBadge variant="failed" label={`${deniedCount} DENIED`} size="xs" />
            )}
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-500 text-sm">
              No AI decisions recorded in the last 24h.
            </p>
            <p className="text-slate-600 text-xs mt-2 font-mono">
              AI calls with actions <span className="text-slate-500">ai:execute</span>,{' '}
              <span className="text-slate-500">ai:deny</span>, or{' '}
              <span className="text-slate-500">ai:escalate</span> will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Time</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Agent</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Model</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Decision</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Policy</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">Tokens In</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">Tokens Out</th>
                  <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">Latency</th>
                  <th className="px-4 py-2.5 text-center font-medium whitespace-nowrap">Fallback</th>
                  <th className="px-4 py-2.5 text-left font-medium whitespace-nowrap">Caller</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${rowBg(row.decision)}`}
                  >
                    {/* Time */}
                    <td className="px-4 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                      {formatTime(row.created_at)}
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-2.5 text-slate-300 font-mono max-w-[140px]">
                      <span className="truncate block" title={row.agent}>
                        {row.agent}
                      </span>
                    </td>

                    {/* Model */}
                    <td className="px-4 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                      {row.model}
                    </td>

                    {/* Decision badge */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <StatusBadge
                        variant={decisionBadgeVariant(row.decision)}
                        label={row.decision}
                        size="xs"
                      />
                    </td>

                    {/* Policy */}
                    <td className="px-4 py-2.5 text-slate-500 font-mono max-w-[140px]">
                      <span className="truncate block" title={row.policy}>
                        {row.policy}
                      </span>
                    </td>

                    {/* Tokens In */}
                    <td className="px-4 py-2.5 text-right text-slate-400 font-mono whitespace-nowrap">
                      {row.input_tokens > 0 ? row.input_tokens.toLocaleString() : '—'}
                    </td>

                    {/* Tokens Out */}
                    <td className="px-4 py-2.5 text-right text-slate-400 font-mono whitespace-nowrap">
                      {row.output_tokens > 0 ? row.output_tokens.toLocaleString() : '—'}
                    </td>

                    {/* Latency */}
                    <td className={`px-4 py-2.5 text-right font-mono whitespace-nowrap ${
                      row.latency_ms > 5000 ? 'text-red-400' :
                      row.latency_ms > 2000 ? 'text-amber-400' :
                      row.latency_ms > 0    ? 'text-slate-300' :
                                              'text-slate-600'
                    }`}>
                      {row.latency_ms > 0 ? `${row.latency_ms.toLocaleString()}ms` : '—'}
                    </td>

                    {/* Fallback */}
                    <td className="px-4 py-2.5 text-center">
                      {row.fallback_used ? (
                        <StatusBadge variant="warning" label="FB" size="xs" />
                      ) : (
                        <span className="text-slate-700 font-mono text-[10px]">—</span>
                      )}
                    </td>

                    {/* Caller route */}
                    <td className="px-4 py-2.5 text-slate-500 font-mono max-w-[180px]">
                      <span className="truncate block" title={row.caller_route}>
                        {row.caller_route}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-slate-600 font-mono">
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-950/50 border border-red-700/30 mr-1.5 align-middle" />
          DENY — blocked by policy
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-950/50 border border-amber-700/30 mr-1.5 align-middle" />
          ESCALATE — needs human review
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-700 mr-1.5 align-middle" />
          ALLOW — executed normally
        </span>
        <span className="ml-auto">
          FB = fallback model used
        </span>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AITimelinePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      {/* ── Static header ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs text-slate-500 uppercase tracking-widest font-mono">
            SH-ROS Control Tower
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/20 font-mono">
            AI Governance
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">AI Decision Timeline</h1>
        <p className="text-sm text-slate-400 mt-1">
          Every governed AI call — policy, tokens, latency, agent · last 24h
        </p>
      </div>
      <Suspense fallback={<AITimelineSkeleton />}>
        <AITimelineContent />
      </Suspense>
    </div>
  )
}
