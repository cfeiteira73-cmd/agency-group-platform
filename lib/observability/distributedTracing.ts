// AGENCY GROUP — SH-ROS Observability: distributedTracing | AMI: 22506
//
// Persistence strategy:
//   Each trace record is written to `causal_trace` (Supabase) as a fire-and-forget
//   insert (step_type='distributed_trace'). The in-memory _log remains as a
//   write-through cache for the current request context only. Cold starts read
//   from causal_trace — no historical data is lost.

import { tracingProvider } from './tracingProvider'
import { supabaseAdmin } from '@/lib/supabase'
// causal_trace not yet in generated types — cast to any until types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

interface TraceRecord {
  trace_id: string
  span_id: string
  name: string
  started_at: string
  ended_at: string
  duration_ms: number
  attributes: Record<string, string | number>
  error?: string
}

async function persistTraceRecord(record: TraceRecord): Promise<void> {
  if (process.env.CAUSAL_TRACE_ENABLED === 'false') return
  try {
    await sb.from('causal_trace').insert({
      correlation_id: record.trace_id,
      tenant_id:      (record.attributes['org_id'] as string) ?? 'agency-group',
      step_type:      'distributed_trace',
      agent_id:       (record.attributes['agent_id'] as string) ?? null,
      entity_id:      (record.attributes['event_id'] as string) ?? null,
      entity_type:    'span',
      action:         record.name,
      latency_ms:     record.duration_ms,
      success:        !record.error,
      error_message:  record.error ?? null,
      metadata: {
        span_id:    record.span_id,
        started_at: record.started_at,
        ended_at:   record.ended_at,
        attributes: record.attributes,
      },
      created_at: record.started_at,
    })
  } catch (err) {
    console.warn('[DistributedTracer] persist failed:', err)
  }
}

export class DistributedTracer {
  /** In-memory log serves as write-through cache for current process lifetime */
  private readonly _log: TraceRecord[] = []

  async traceEvent(
    event_id: string,
    org_id: string,
    callback: () => Promise<unknown>,
  ): Promise<unknown> {
    const span = tracingProvider.startSpan(`shros.event.${event_id}`, {
      event_id,
      org_id,
    })
    const started_at = new Date().toISOString()

    try {
      const result = await callback()
      const ended_at = new Date().toISOString()
      const record: TraceRecord = {
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.event.${event_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { event_id, org_id },
      }
      this._log.push(record)
      void persistTraceRecord(record)
      span.end()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const ended_at = new Date().toISOString()
      const record: TraceRecord = {
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.event.${event_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { event_id, org_id },
        error: error.message,
      }
      this._log.push(record)
      void persistTraceRecord(record)
      span.end(error)
      throw err
    }
  }

  async traceAgent(
    agent_id: string,
    event_id: string,
    callback: () => Promise<unknown>,
    org_id?: string,
  ): Promise<unknown> {
    const resolvedOrgId = org_id ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    const span = tracingProvider.startSpan(`shros.agent.${agent_id}`, {
      agent_id,
      event_id,
      org_id: resolvedOrgId,
    })
    const started_at = new Date().toISOString()

    try {
      const result = await callback()
      const ended_at = new Date().toISOString()
      const record: TraceRecord = {
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.agent.${agent_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { agent_id, event_id, org_id: resolvedOrgId },
      }
      this._log.push(record)
      void persistTraceRecord(record)
      span.end()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const ended_at = new Date().toISOString()
      const record: TraceRecord = {
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.agent.${agent_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { agent_id, event_id, org_id: resolvedOrgId },
        error: error.message,
      }
      this._log.push(record)
      void persistTraceRecord(record)
      span.end(error)
      throw err
    }
  }

  /**
   * Produce a W3C traceparent header value.
   * Format: 00-{32-char trace_id}-{16-char span_id}-01
   */
  propagateToHeaders(trace_id: string, span_id: string): Record<string, string> {
    // Pad/truncate to spec lengths
    const tid = trace_id.replace(/-/g, '').padEnd(32, '0').slice(0, 32)
    const sid = span_id.replace(/-/g, '').padEnd(16, '0').slice(0, 16)
    return {
      traceparent: `00-${tid}-${sid}-01`,
      'x-trace-id': tid,
      'x-span-id': sid,
    }
  }

  extractFromHeaders(headers: Record<string, string>): { trace_id?: string; span_id?: string } {
    const tp = headers['traceparent']
    if (tp) {
      const parts = tp.split('-')
      if (parts.length >= 3) {
        return { trace_id: parts[1], span_id: parts[2] }
      }
    }
    const trace_id = headers['x-trace-id']
    const span_id = headers['x-span-id']
    return {
      trace_id: trace_id || undefined,
      span_id: span_id || undefined,
    }
  }

  getLog(): TraceRecord[] {
    return [...this._log]
  }
}

export const distributedTracer = new DistributedTracer()
