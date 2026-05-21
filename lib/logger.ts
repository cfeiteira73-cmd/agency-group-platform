// =============================================================================
// Agency Group — Structured JSON Logger v2.0
// Production-safe structured logging with Sentry integration
//
// AUDIT FIX: Previously emitted human-readable strings. Now emits
// newline-delimited JSON to stdout so log drains (Vercel, Datadog, Loki,
// CloudWatch) can parse and index every field.
//
// Usage:
//   import log from '@/lib/logger'
//   log.info('[route] message', { key: 'value' })
//   log.warn('[route] warning', { context })
//   log.error('[route] error', error, { correlation_id, route })
//   log.revenue('[route] revenue event', { deal_id, amount })
//
// Sentry:
//   - log.error() automatically calls Sentry.captureException
//   - Breadcrumbs are added for info/warn events
//   - correlation_id is attached to every Sentry event scope
//
// Non-blocking: all logging is synchronous stdout + async Sentry capture
//
// Public API surface is PRESERVED exactly — all existing callsites continue
// to work without any changes.
// =============================================================================

import * as Sentry from '@sentry/nextjs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogContext {
  correlation_id?: string | null
  route?: string
  agent_email?: string
  deal_id?: string | null
  lead_id?: string | null
  property_id?: string | null
  [key: string]: unknown
}

// Internal structured log entry shape — compatible with Vercel Log Drains,
// Datadog, Loki, and CloudWatch (all expect newline-delimited JSON).
interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'revenue' | 'automation' | 'debug'
  ts: string            // ISO 8601
  msg: string           // the human-readable message
  service: string       // 'agency-group'
  err?: {
    message: string
    name: string
    stack?: string
  }
  [key: string]: unknown  // spread of LogContext fields
}

const SERVICE_NAME = 'agency-group'

// ---------------------------------------------------------------------------
// Emit — structured JSON to stdout (parseable by every major log drain)
// ---------------------------------------------------------------------------

function emitStructured(entry: LogEntry): void {
  if (process.env.NODE_ENV === 'development') {
    // Development: pretty-print with a level prefix for human readability.
    // Still valid JSON so tooling can parse it; the prefix is on the same line.
    const prefix = { error: '[ERROR]', warn: '[WARN]', info: '[INFO]', revenue: '[REVENUE]', automation: '[AUTO]', debug: '[DEBUG]' }[entry.level] ?? '[LOG]'
    // Use process.stdout.write so the output is identical to production
    // in terms of newline-delimited JSON, just with an extra prefix comment.
    process.stdout.write(`${prefix} ${JSON.stringify(entry)}\n`)
  } else {
    // Production: pure newline-delimited JSON — no prefix, no colours.
    // Each line is a valid JSON object that log drains can ingest directly.
    process.stdout.write(`${JSON.stringify(entry)}\n`)
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (preserved from v1 for Sentry integration)
// ---------------------------------------------------------------------------

function toSentryExtras(ctx?: LogContext): Record<string, unknown> {
  return ctx ? { ...ctx } : {}
}

// ---------------------------------------------------------------------------
// Log levels — PUBLIC API SURFACE (signatures preserved exactly from v1)
// ---------------------------------------------------------------------------

function info(message: string, ctx?: LogContext): void {
  emitStructured({
    level: 'info',
    ts: new Date().toISOString(),
    msg: message,
    service: SERVICE_NAME,
    ...ctx,
  })

  // Add Sentry breadcrumb for info events (non-blocking)
  try {
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      data: toSentryExtras(ctx),
    })
  } catch {
    // Sentry unavailable — not fatal
  }
}

function warn(message: string, ctx?: LogContext): void {
  emitStructured({
    level: 'warn',
    ts: new Date().toISOString(),
    msg: message,
    service: SERVICE_NAME,
    ...ctx,
  })

  try {
    Sentry.addBreadcrumb({
      message,
      level: 'warning',
      data: toSentryExtras(ctx),
    })
  } catch {
    // Sentry unavailable — not fatal
  }
}

function error(message: string, err?: unknown, ctx?: LogContext): void {
  const errField: LogEntry['err'] =
    err instanceof Error
      ? { message: err.message, name: err.name, stack: err.stack }
      : err != null
        ? { message: String(err), name: 'Unknown' }
        : undefined

  emitStructured({
    level: 'error',
    ts: new Date().toISOString(),
    msg: message,
    service: SERVICE_NAME,
    ...(errField ? { err: errField } : {}),
    ...ctx,
  })

  // Capture to Sentry with full context (preserved from v1)
  try {
    Sentry.withScope((scope) => {
      if (ctx?.correlation_id) scope.setTag('correlation_id', String(ctx.correlation_id))
      if (ctx?.route)          scope.setTag('route', ctx.route)
      if (ctx?.agent_email)    scope.setTag('agent_email', ctx.agent_email)
      scope.setExtras(toSentryExtras(ctx))
      scope.setExtra('log_message', message)

      if (err instanceof Error) {
        Sentry.captureException(err)
      } else {
        Sentry.captureMessage(message, 'error')
      }
    })
  } catch {
    // Sentry unavailable — not fatal
  }
}

function revenue(message: string, ctx?: LogContext & { amount?: number; deal_id?: string | null }): void {
  emitStructured({
    level: 'revenue',
    ts: new Date().toISOString(),
    msg: message,
    service: SERVICE_NAME,
    ...ctx,
  })

  try {
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      category: 'revenue',
      data: toSentryExtras(ctx),
    })
  } catch {
    // Sentry unavailable — not fatal
  }
}

function automation(message: string, ctx?: LogContext & { workflow?: string; success?: boolean }): void {
  emitStructured({
    level: 'automation',
    ts: new Date().toISOString(),
    msg: message,
    service: SERVICE_NAME,
    ...ctx,
  })

  try {
    Sentry.addBreadcrumb({
      message,
      level: ctx?.success === false ? 'warning' : 'info',
      category: 'automation',
      data: toSentryExtras(ctx),
    })

    // Failed automations are captured as Sentry events for alerting (preserved from v1)
    if (ctx?.success === false) {
      Sentry.withScope((scope) => {
        scope.setTag('automation_workflow', ctx.workflow ?? 'unknown')
        if (ctx.correlation_id) scope.setTag('correlation_id', String(ctx.correlation_id))
        scope.setExtras(toSentryExtras(ctx))
        Sentry.captureMessage(`Automation failed: ${message}`, 'warning')
      })
    }
  } catch {
    // Sentry unavailable — not fatal
  }
}

// debug — new method, does not break existing callsites (additive only)
function debug(message: string, ctx?: LogContext): void {
  if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
    emitStructured({
      level: 'debug',
      ts: new Date().toISOString(),
      msg: message,
      service: SERVICE_NAME,
      ...ctx,
    })
  }
}

// child — creates a bound logger with pre-filled context so callers don't
// have to repeat common fields (correlation_id, route, etc.) on every call.
function child(context: LogContext): typeof log {
  return {
    info:       (msg, ctx) => info(msg, { ...context, ...ctx }),
    warn:       (msg, ctx) => warn(msg, { ...context, ...ctx }),
    error:      (msg, err, ctx) => error(msg, err, { ...context, ...ctx }),
    revenue:    (msg, ctx) => revenue(msg, { ...context, ...ctx }),
    automation: (msg, ctx) => automation(msg, { ...context, ...ctx }),
    debug:      (msg, ctx) => debug(msg, { ...context, ...ctx }),
    child:      (ctx) => child({ ...context, ...ctx }),
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const log = { info, warn, error, revenue, automation, debug, child }
export default log

// Named exports for convenience (preserved from v1)
export { info as logInfo, warn as logWarn, error as logError }

// Type export for child logger consumers
export type Logger = typeof log
