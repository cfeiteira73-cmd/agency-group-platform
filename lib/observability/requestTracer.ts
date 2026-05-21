// =============================================================================
// Agency Group — Request-Level Performance Tracer
// lib/observability/requestTracer.ts
//
// Tracks the full lifecycle of a single HTTP request: spans, AI cost,
// DB query counts, and final status code / duration.
//
// DESIGN:
//   - Instantiated per-request at the top of a route handler
//   - startSpan() / span.end() wraps any sub-operation
//   - recordAI() and recordDBQuery() accumulate counters
//   - complete() writes the finished trace to request_traces (fire-and-forget)
//   - Never throws — all Supabase writes are guarded
//
// USAGE:
//   import { RequestTracer } from '@/lib/observability/requestTracer'
//
//   export async function GET(req: NextRequest) {
//     const tracer = new RequestTracer(req.nextUrl.pathname, 'GET', corrId, tenantId)
//     const dbSpan = tracer.startSpan('supabase.query', { table: 'deals' })
//     const { data } = await supabaseAdmin.from('deals').select('*')
//     dbSpan.end()
//     tracer.recordDBQuery(Date.now() - queryStart)
//     void tracer.complete(200)
//     return NextResponse.json(data)
//   }
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { recordRequest as sloRecordRequest } from '@/lib/sre/sloTracker'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceSpan {
  name: string
  started_at: number
  duration_ms: number
  tags: Record<string, string>
  error?: string
}

export interface RequestTrace {
  trace_id: string
  correlation_id: string
  path: string
  method: string
  tenant_id: string
  status_code: number | null
  duration_ms: number | null

  // Spans — individual sub-operation timings
  spans: TraceSpan[]

  // AI cost accumulators
  ai_tokens_used: number
  ai_latency_ms: number

  // DB accumulators
  db_queries: number
  db_latency_ms: number

  started_at: string
  completed_at: string | null
}

// ---------------------------------------------------------------------------
// Internal Supabase write client
// ---------------------------------------------------------------------------

function getTraceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// RequestTracer
// ---------------------------------------------------------------------------

export class RequestTracer {
  private trace: RequestTrace
  private activeSpans: Map<string, { started_at: number; tags: Record<string, string> }>

  constructor(
    path: string,
    method: string,
    correlationId: string,
    tenantId: string,
  ) {
    this.activeSpans = new Map()
    this.trace = {
      trace_id:       `${correlationId}:${Date.now()}`,
      correlation_id: correlationId,
      path,
      method:         method.toUpperCase(),
      tenant_id:      tenantId,
      status_code:    null,
      duration_ms:    null,
      spans:          [],
      ai_tokens_used: 0,
      ai_latency_ms:  0,
      db_queries:     0,
      db_latency_ms:  0,
      started_at:     new Date().toISOString(),
      completed_at:   null,
    }
  }

  /**
   * Start a named span. Returns an object with an `end()` method.
   * If end() is never called the span is silently dropped — fire-and-forget.
   *
   * Usage:
   *   const span = tracer.startSpan('anthropic.chat', { model: 'claude-opus-4-6' })
   *   const response = await client.messages.create(...)
   *   span.end()
   */
  startSpan(name: string, tags: Record<string, string> = {}): { end: (error?: string) => void } {
    const spanKey = `${name}:${Date.now()}`
    const started = Date.now()
    this.activeSpans.set(spanKey, { started_at: started, tags })

    return {
      end: (error?: string) => {
        const spanData = this.activeSpans.get(spanKey)
        if (!spanData) return
        this.activeSpans.delete(spanKey)
        const duration_ms = Date.now() - spanData.started_at
        this.trace.spans.push({
          name,
          started_at: spanData.started_at,
          duration_ms,
          tags: spanData.tags,
          ...(error ? { error } : {}),
        })
      },
    }
  }

  /**
   * Accumulate AI call cost into the trace.
   * Call this after every successful Anthropic call (or from trackAICall).
   */
  recordAI(tokens: number, latencyMs: number): void {
    this.trace.ai_tokens_used += tokens
    this.trace.ai_latency_ms  += latencyMs
  }

  /**
   * Accumulate a DB query into the trace.
   * Call this after every Supabase/Postgres query.
   */
  recordDBQuery(latencyMs: number): void {
    this.trace.db_queries++
    this.trace.db_latency_ms += latencyMs
  }

  /**
   * Finalise the trace: set status_code, calculate total duration,
   * write to request_traces (fire-and-forget), and notify the SLO tracker.
   *
   * Safe to call without awaiting from a route handler:
   *   void tracer.complete(200)
   */
  async complete(statusCode: number): Promise<void> {
    this.trace.status_code   = statusCode
    this.trace.completed_at  = new Date().toISOString()
    this.trace.duration_ms   =
      new Date(this.trace.completed_at).getTime() -
      new Date(this.trace.started_at).getTime()

    // SLO tracking — fire-and-forget
    void sloRecordRequest(
      this.trace.tenant_id,
      'api',
      statusCode < 500,
      this.trace.duration_ms,
    ).catch(() => {})

    // Persist trace to Supabase (fire-and-forget — never block response)
    try {
      const client = getTraceClient()
      if (!client) return

      void client
        .from('request_traces')
        .insert({
          trace_id:       this.trace.trace_id,
          correlation_id: this.trace.correlation_id,
          tenant_id:      this.trace.tenant_id || null,
          path:           this.trace.path,
          method:         this.trace.method,
          status_code:    this.trace.status_code,
          duration_ms:    this.trace.duration_ms,
          ai_tokens_used: this.trace.ai_tokens_used,
          ai_latency_ms:  this.trace.ai_latency_ms,
          db_queries:     this.trace.db_queries,
          db_latency_ms:  this.trace.db_latency_ms,
          spans:          this.trace.spans,
          started_at:     this.trace.started_at,
          completed_at:   this.trace.completed_at,
        })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) {
            // Non-fatal — trace write failure never crashes the route
            console.warn('[request-tracer] trace insert failed:', error.message)
          }
        })
    } catch {
      // Never throw from an observability helper
    }
  }

  /**
   * Quick summary for logging at the end of a route handler.
   */
  getSummary(): { duration_ms: number; status: number; ai_tokens: number } {
    const now = Date.now()
    const started = new Date(this.trace.started_at).getTime()
    return {
      duration_ms: this.trace.duration_ms ?? now - started,
      status:      this.trace.status_code ?? 0,
      ai_tokens:   this.trace.ai_tokens_used,
    }
  }
}
