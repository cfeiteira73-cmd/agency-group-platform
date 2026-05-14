// AGENCY GROUP — SH-ROS Observability: distributedTracing | AMI: 22506

import { tracingProvider } from './tracingProvider'

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

export class DistributedTracer {
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
      this._log.push({
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.event.${event_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { event_id, org_id },
      })
      span.end()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const ended_at = new Date().toISOString()
      this._log.push({
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.event.${event_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { event_id, org_id },
        error: error.message,
      })
      span.end(error)
      throw err
    }
  }

  async traceAgent(
    agent_id: string,
    event_id: string,
    callback: () => Promise<unknown>,
  ): Promise<unknown> {
    const span = tracingProvider.startSpan(`shros.agent.${agent_id}`, {
      agent_id,
      event_id,
    })
    const started_at = new Date().toISOString()

    try {
      const result = await callback()
      const ended_at = new Date().toISOString()
      this._log.push({
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.agent.${agent_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { agent_id, event_id },
      })
      span.end()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const ended_at = new Date().toISOString()
      this._log.push({
        trace_id: span.trace_id,
        span_id: span.span_id,
        name: `shros.agent.${agent_id}`,
        started_at,
        ended_at,
        duration_ms: Date.now() - span.started_at,
        attributes: { agent_id, event_id },
        error: error.message,
      })
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
