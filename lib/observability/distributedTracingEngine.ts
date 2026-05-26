// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/observability/distributedTracingEngine.ts
// Distributed tracing with correlation_id chaining across all system layers
// Wave 44 Agent 4 — Advanced Observability + Control Plane
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SpanStatus = 'STARTED' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'
export type SpanLayer =
  | 'API'
  | 'DB'
  | 'ML'
  | 'CAPITAL'
  | 'LEGAL'
  | 'SUPPLY'
  | 'NOTIFICATION'
  | 'EXTERNAL'

export interface TraceSpan {
  span_id: string
  trace_id: string
  parent_span_id: string | null
  tenant_id: string
  layer: SpanLayer
  operation: string
  status: SpanStatus
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  metadata: Record<string, unknown>
  error_message: string | null
  http_status: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0
  const idx = Math.ceil((sortedValues.length * p) / 100) - 1
  return sortedValues[Math.max(0, idx)]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new root trace ID.
 */
export function createTraceId(): string {
  return randomUUID()
}

/**
 * Start a new span. Returns the span_id immediately.
 * DB insert is fire-and-forget — never blocks the caller.
 */
export async function startSpan(
  traceId: string,
  layer: SpanLayer,
  operation: string,
  tenantId: string,
  parentSpanId?: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const spanId = randomUUID()

  void (supabaseAdmin as any)
    .from('trace_spans')
    .insert({
      span_id: spanId,
      trace_id: traceId,
      parent_span_id: parentSpanId ?? null,
      tenant_id: tenantId,
      layer,
      operation,
      status: 'STARTED',
      started_at: new Date().toISOString(),
      metadata: metadata ?? {},
    })
    .catch((e: unknown) => console.warn('[distributedTracingEngine] startSpan insert failed:', e))

  return spanId
}

/**
 * Mark a span as ended. Fire-and-forget.
 */
export async function endSpan(
  spanId: string,
  status: SpanStatus,
  errorMessage?: string,
  httpStatus?: number
): Promise<void> {
  const endedAt = new Date().toISOString()

  void (supabaseAdmin as any)
    .from('trace_spans')
    .select('started_at')
    .eq('span_id', spanId)
    .single()
    .then(({ data }: { data: { started_at: string } | null }) => {
      const duration_ms = data?.started_at
        ? Math.max(0, new Date(endedAt).getTime() - new Date(data.started_at).getTime())
        : null

      return (supabaseAdmin as any)
        .from('trace_spans')
        .update({
          ended_at: endedAt,
          duration_ms,
          status,
          error_message: errorMessage ?? null,
          http_status: httpStatus ?? null,
        })
        .eq('span_id', spanId)
    })
    .catch((e: unknown) => console.warn('[distributedTracingEngine] endSpan update failed:', e))
}

/**
 * Return all spans for a given trace_id, ordered chronologically.
 */
export async function getTrace(traceId: string): Promise<TraceSpan[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('trace_spans')
      .select('*')
      .eq('trace_id', traceId)
      .order('started_at', { ascending: true })

    if (error) {
      log.warn('[distributedTracingEngine] getTrace error', { err: error })
      return []
    }
    return (data ?? []) as TraceSpan[]
  } catch (e) {
    log.warn('[distributedTracingEngine] getTrace exception', { err: String(e) })
    return []
  }
}

/**
 * Return slow operations exceeding a threshold, grouped and aggregated.
 */
export async function getSlowOperations(
  tenantId: string,
  thresholdMs = 2000,
  hours = 24
): Promise<
  Array<{
    operation: string
    avg_ms: number
    max_ms: number
    count: number
    p95_ms: number
  }>
> {
  try {
    const since = new Date(Date.now() - hours * 3600_000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('trace_spans')
      .select('operation, duration_ms')
      .eq('tenant_id', tenantId)
      .gte('started_at', since)
      .gte('duration_ms', thresholdMs)
      .not('duration_ms', 'is', null)

    if (error) {
      log.warn('[distributedTracingEngine] getSlowOperations error', { err: error })
      return []
    }

    const rows = (data ?? []) as Array<{ operation: string; duration_ms: number }>

    // Group by operation
    const grouped = new Map<string, number[]>()
    for (const row of rows) {
      if (!grouped.has(row.operation)) grouped.set(row.operation, [])
      grouped.get(row.operation)!.push(row.duration_ms)
    }

    return Array.from(grouped.entries()).map(([operation, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b)
      const avg_ms = sorted.reduce((s, v) => s + v, 0) / sorted.length
      return {
        operation,
        avg_ms: Math.round(avg_ms),
        max_ms: sorted[sorted.length - 1] ?? 0,
        count: sorted.length,
        p95_ms: percentile(sorted, 95),
      }
    })
  } catch (e) {
    log.warn('[distributedTracingEngine] getSlowOperations exception', { err: String(e) })
    return []
  }
}

/**
 * Return a 24-hour health summary for a tenant.
 */
export async function getTraceHealth(tenantId: string): Promise<{
  total_spans_24h: number
  error_rate_pct: number
  avg_duration_ms: number
  slowest_operation: string | null
}> {
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('trace_spans')
      .select('status, duration_ms, operation')
      .eq('tenant_id', tenantId)
      .gte('started_at', since)

    if (error) {
      log.warn('[distributedTracingEngine] getTraceHealth error', { err: error })
      return { total_spans_24h: 0, error_rate_pct: 0, avg_duration_ms: 0, slowest_operation: null }
    }

    const rows = (data ?? []) as Array<{
      status: string
      duration_ms: number | null
      operation: string
    }>
    const total = rows.length
    if (total === 0) {
      return { total_spans_24h: 0, error_rate_pct: 0, avg_duration_ms: 0, slowest_operation: null }
    }

    const failed = rows.filter((r) => r.status === 'FAILED').length
    const withDuration = rows.filter((r) => r.duration_ms != null)
    const avg_duration_ms =
      withDuration.length > 0
        ? Math.round(
            withDuration.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / withDuration.length
          )
        : 0

    let slowest_operation: string | null = null
    let maxDuration = 0
    for (const r of rows) {
      if ((r.duration_ms ?? 0) > maxDuration) {
        maxDuration = r.duration_ms ?? 0
        slowest_operation = r.operation
      }
    }

    return {
      total_spans_24h: total,
      error_rate_pct: Math.round((failed / total) * 1000) / 10,
      avg_duration_ms,
      slowest_operation,
    }
  } catch (e) {
    log.warn('[distributedTracingEngine] getTraceHealth exception', { err: String(e) })
    return { total_spans_24h: 0, error_rate_pct: 0, avg_duration_ms: 0, slowest_operation: null }
  }
}
