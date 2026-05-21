// Agency Group — Distributed Tracer
// lib/observability/distributedTracer.ts
// correlation_id propagation, span tracking, trace assembly.
// Answer: "Why did this fail?" not just "This failed."
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraceSpan {
  span_id: string
  trace_id: string
  parent_span_id: string | null
  operation: string
  service: 'api' | 'db' | 'queue' | 'ml' | 'external'
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  status: 'ok' | 'error' | 'timeout'
  error?: string
  metadata: Record<string, unknown>
}

export interface Trace {
  trace_id: string
  tenant_id: string
  root_operation: string
  started_at: string
  completed_at: string | null
  total_duration_ms: number | null
  spans: TraceSpan[]
  status: 'ok' | 'error' | 'partial'
  error_count: number
}

// ─── ID Generators ────────────────────────────────────────────────────────────

export function createTraceId(): string {
  return crypto.randomUUID()
}

export function createSpanId(): string {
  return crypto.randomUUID().slice(0, 8)
}

// ─── startSpan ────────────────────────────────────────────────────────────────

export async function startSpan(
  traceId: string,
  tenantId: string,
  operation: string,
  service: TraceSpan['service'],
  parentSpanId?: string,
  metadata?: Record<string, unknown>
): Promise<TraceSpan> {
  const span: TraceSpan = {
    span_id: createSpanId(),
    trace_id: traceId,
    parent_span_id: parentSpanId ?? null,
    operation,
    service,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_ms: null,
    status: 'ok',
    metadata: metadata ?? {},
  }

  void sb
    .from('trace_spans')
    .insert({
      tenant_id: tenantId,
      trace_id: span.trace_id,
      span_id: span.span_id,
      parent_span_id: span.parent_span_id,
      operation: span.operation,
      service: span.service,
      started_at: span.started_at,
      status: span.status,
      metadata: span.metadata,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.info('[distributedTracer] startSpan persist warn', { error })
    })
    .catch((e: unknown) => console.warn('[distributedTracer] startSpan', e))

  return span
}

// ─── endSpan ──────────────────────────────────────────────────────────────────

export async function endSpan(
  span: TraceSpan,
  status: TraceSpan['status'],
  error?: string
): Promise<TraceSpan> {
  const endedAt = new Date().toISOString()
  const startMs = new Date(span.started_at).getTime()
  const durationMs = Date.now() - startMs

  const completed: TraceSpan = {
    ...span,
    ended_at: endedAt,
    duration_ms: durationMs,
    status,
    ...(error !== undefined ? { error } : {}),
  }

  void sb
    .from('trace_spans')
    .update({
      ended_at: completed.ended_at,
      duration_ms: completed.duration_ms,
      status: completed.status,
      error_message: completed.error ?? null,
    })
    .eq('span_id', span.span_id)
    .eq('trace_id', span.trace_id)
    .then(({ error: dbErr }: { error: unknown }) => {
      if (dbErr) log.info('[distributedTracer] endSpan persist warn', { error: dbErr })
    })
    .catch((e: unknown) => console.warn('[distributedTracer] endSpan', e))

  return completed
}

// ─── getTrace ─────────────────────────────────────────────────────────────────

export async function getTrace(traceId: string, tenantId: string): Promise<Trace | null> {
  const { data, error } = await sb
    .from('trace_spans')
    .select('*')
    .eq('trace_id', traceId)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: true })

  if (error) {
    log.info('[distributedTracer] getTrace error', { error, traceId })
    return null
  }

  const rows: Record<string, unknown>[] = data ?? []
  if (rows.length === 0) return null

  const spans: TraceSpan[] = rows.map(r => ({
    span_id: r.span_id as string,
    trace_id: r.trace_id as string,
    parent_span_id: (r.parent_span_id as string | null) ?? null,
    operation: r.operation as string,
    service: r.service as TraceSpan['service'],
    started_at: r.started_at as string,
    ended_at: (r.ended_at as string | null) ?? null,
    duration_ms: (r.duration_ms as number | null) ?? null,
    status: r.status as TraceSpan['status'],
    error: (r.error_message as string | undefined) ?? undefined,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }))

  const rootSpan = spans.find(s => s.parent_span_id === null) ?? spans[0]
  const lastEnded = spans
    .filter(s => s.ended_at !== null)
    .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())[0]

  const errorCount = spans.filter(s => s.status === 'error').length
  const hasNull = spans.some(s => s.ended_at === null)
  const traceStatus: Trace['status'] = errorCount > 0 ? 'error' : hasNull ? 'partial' : 'ok'

  const startMs = new Date(rootSpan.started_at).getTime()
  const completedAt = lastEnded?.ended_at ?? null
  const totalDurationMs = completedAt ? new Date(completedAt).getTime() - startMs : null

  return {
    trace_id: traceId,
    tenant_id: tenantId,
    root_operation: rootSpan.operation,
    started_at: rootSpan.started_at,
    completed_at: completedAt,
    total_duration_ms: totalDurationMs,
    spans,
    status: traceStatus,
    error_count: errorCount,
  }
}

// ─── getRecentTraces ──────────────────────────────────────────────────────────

export async function getRecentTraces(tenantId: string, limit = 20): Promise<Trace[]> {
  // Fetch the most recent distinct trace_ids
  const { data, error } = await sb
    .from('trace_spans')
    .select('trace_id, started_at')
    .eq('tenant_id', tenantId)
    .is('parent_span_id', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.info('[distributedTracer] getRecentTraces error', { error })
    return []
  }

  const rows: { trace_id: string }[] = data ?? []
  const traceIds = [...new Set(rows.map(r => r.trace_id))].slice(0, limit)

  const traces = await Promise.all(traceIds.map(id => getTrace(id, tenantId)))
  return traces.filter((t): t is Trace => t !== null)
}
