// AGENCY GROUP — SH-ROS Observability: tracingProvider | AMI: 22506

export interface Span {
  span_id: string
  trace_id: string
  name: string
  started_at: number
  setAttribute(k: string, v: string | number): void
  addEvent(name: string, attrs?: Record<string, string>): void
  end(error?: Error): void
  isRecording(): boolean
}

export interface TraceContext {
  trace_id: string
  span_id: string
  flags: number
}

// ---------------------------------------------------------------------------
// No-op span used when OTEL is unavailable
// ---------------------------------------------------------------------------

class NoopSpan implements Span {
  span_id: string
  trace_id: string
  name: string
  started_at: number
  private _recording = true

  constructor(name: string, trace_id?: string) {
    this.name = name
    this.started_at = Date.now()
    this.trace_id = trace_id ?? crypto.randomUUID().replace(/-/g, '')
    this.span_id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }

  setAttribute(_k: string, _v: string | number): void {}
  addEvent(_name: string, _attrs?: Record<string, string>): void {}
  end(_error?: Error): void {
    this._recording = false
  }
  isRecording(): boolean {
    return this._recording
  }
}

// ---------------------------------------------------------------------------
// OTEL-backed span (wraps @opentelemetry/api Span)
// ---------------------------------------------------------------------------

class OTELSpan implements Span {
  span_id: string
  trace_id: string
  name: string
  started_at: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _inner: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(inner: any, name: string) {
    this._inner = inner
    this.name = name
    this.started_at = Date.now()
    const ctx = inner.spanContext()
    this.trace_id = ctx.traceId ?? crypto.randomUUID().replace(/-/g, '')
    this.span_id = ctx.spanId ?? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }

  setAttribute(k: string, v: string | number): void {
    try { this._inner.setAttribute(k, v) } catch {}
  }

  addEvent(name: string, attrs?: Record<string, string>): void {
    try { this._inner.addEvent(name, attrs) } catch {}
  }

  end(error?: Error): void {
    try {
      if (error) {
        this._inner.recordException(error)
        this._inner.setStatus({ code: 2, message: error.message })
      }
      this._inner.end()
    } catch {}
  }

  isRecording(): boolean {
    try { return this._inner.isRecording() } catch { return false }
  }
}

// ---------------------------------------------------------------------------
// TracingProvider
// ---------------------------------------------------------------------------

export class TracingProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _tracer: any = null
  private _initialized = false
  private _activeTraceId: string | undefined

  init(serviceName?: string): void {
    if (this._initialized) return
    this._initialized = true

    const svcName = serviceName ??
      process.env.OTEL_SERVICE_NAME ??
      'agency-group-sh-ros'

    try {
      // Dynamic import to handle missing package gracefully
      const api = require('@opentelemetry/api') as typeof import('@opentelemetry/api')
      this._tracer = api.trace.getTracer(svcName)

      // Attempt to bootstrap the SDK if endpoint configured
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      if (endpoint) {
        try {
          const { NodeSDK } = require('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node')
          const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http') as typeof import('@opentelemetry/exporter-trace-otlp-http')
          const sdk = new NodeSDK({
            serviceName: svcName,
            traceExporter: new OTLPTraceExporter({ url: endpoint }),
          })
          sdk.start()
        } catch (sdkErr) {
          console.warn('[TracingProvider] OTEL SDK init failed (non-fatal):', sdkErr)
        }
      }
    } catch {
      // @opentelemetry/api not installed — degrade gracefully
      this._tracer = null
    }
  }

  startSpan(name: string, attributes?: Record<string, string | number>): Span {
    if (!this._initialized) this.init()

    if (this._tracer) {
      try {
        const api = require('@opentelemetry/api') as typeof import('@opentelemetry/api')
        const inner = this._tracer.startSpan(name, { attributes })
        const span = new OTELSpan(inner, name)
        this._activeTraceId = span.trace_id
        return span
      } catch {
        // Fall through to noop
      }
    }

    const span = new NoopSpan(name, this._activeTraceId)
    this._activeTraceId = span.trace_id
    return span
  }

  getActiveTraceId(): string | undefined {
    return this._activeTraceId
  }

  extractContext(headers: Record<string, string>): TraceContext {
    const traceparent = headers['traceparent'] ?? headers['x-trace-id']
    if (traceparent) {
      const parts = traceparent.split('-')
      if (parts.length >= 4) {
        return { trace_id: parts[1], span_id: parts[2], flags: parseInt(parts[3], 16) }
      }
    }
    return {
      trace_id: crypto.randomUUID().replace(/-/g, ''),
      span_id: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      flags: 1,
    }
  }

  injectContext(span: Span, headers: Record<string, string>): void {
    headers['traceparent'] = `00-${span.trace_id}-${span.span_id}-01`
    headers['x-trace-id'] = span.trace_id
  }
}

export const tracingProvider = new TracingProvider()
