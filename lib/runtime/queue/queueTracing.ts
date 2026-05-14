// AGENCY GROUP — SH-ROS Queue: queueTracing | AMI: 22506
// Distributed tracing integration for queue operations.
// OpenTelemetry-compatible span structure. Emits structured JSON to stdout.

import type { RuntimeEvent } from '@/lib/runtime/types'

// ─── QueueSpan ────────────────────────────────────────────────────────────────

export interface QueueSpan {
  span_id: string
  trace_id: string
  start(): void
  end(status: 'ok' | 'error', error?: string): void
  addAttribute(key: string, value: string | number): void
}

// ─── Internal span ────────────────────────────────────────────────────────────

interface SpanData {
  span_id: string
  trace_id: string
  parent_span_id?: string
  name: string
  kind: 'producer' | 'consumer'
  start_time_ms: number | null
  end_time_ms: number | null
  duration_ms: number | null
  status: 'ok' | 'error' | 'unset'
  error?: string
  attributes: Record<string, string | number>
}

// ─── QueueTracer ─────────────────────────────────────────────────────────────

export class QueueTracer {

  // ── startEnqueueSpan ───────────────────────────────────────────────────────

  startEnqueueSpan(event: RuntimeEvent): QueueSpan {
    const spanData: SpanData = {
      span_id: crypto.randomUUID(),
      trace_id: event.metadata.trace_id,
      name: `queue.enqueue`,
      kind: 'producer',
      start_time_ms: null,
      end_time_ms: null,
      duration_ms: null,
      status: 'unset',
      attributes: {
        'event.id': event.event_id,
        'event.type': event.type,
        'event.priority': event.priority,
        'event.org_id': event.org_id,
        'event.correlation_id': event.correlation_id,
        'event.source_system': event.metadata.source_system,
        'event.schema_version': event.metadata.schema_version,
      },
    }

    return this.buildSpan(spanData)
  }

  // ── startDequeueSpan ───────────────────────────────────────────────────────

  startDequeueSpan(event_id: string, org_id: string): QueueSpan {
    const spanData: SpanData = {
      span_id: crypto.randomUUID(),
      trace_id: crypto.randomUUID(), // new trace for consumption
      name: `queue.dequeue`,
      kind: 'consumer',
      start_time_ms: null,
      end_time_ms: null,
      duration_ms: null,
      status: 'unset',
      attributes: {
        'event.id': event_id,
        'event.org_id': org_id,
      },
    }

    return this.buildSpan(spanData)
  }

  // ── Internal span factory ──────────────────────────────────────────────────

  private buildSpan(spanData: SpanData): QueueSpan {
    return {
      span_id: spanData.span_id,
      trace_id: spanData.trace_id,

      start(): void {
        spanData.start_time_ms = Date.now()
      },

      end(status: 'ok' | 'error', error?: string): void {
        spanData.end_time_ms = Date.now()
        spanData.duration_ms = spanData.start_time_ms
          ? spanData.end_time_ms - spanData.start_time_ms
          : null
        spanData.status = status
        if (error) spanData.error = error

        // Emit OpenTelemetry-compatible structured log
        console.log(
          JSON.stringify({
            '@type': 'queue.span',
            span_id: spanData.span_id,
            trace_id: spanData.trace_id,
            parent_span_id: spanData.parent_span_id,
            name: spanData.name,
            kind: spanData.kind,
            start_time_ms: spanData.start_time_ms,
            end_time_ms: spanData.end_time_ms,
            duration_ms: spanData.duration_ms,
            status: spanData.status,
            error: spanData.error,
            attributes: spanData.attributes,
          }),
        )
      },

      addAttribute(key: string, value: string | number): void {
        spanData.attributes[key] = value
      },
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queueTracer = new QueueTracer()
