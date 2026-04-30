// =============================================================================
// Agency Group — Structured Logger v1.0
// Production-safe structured logging with Sentry integration
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
// Non-blocking: all logging is synchronous console + async Sentry capture
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatMessage(level: string, message: string, ctx?: LogContext): string {
  const ts   = new Date().toISOString()
  const corr = ctx?.correlation_id ? ` [${String(ctx.correlation_id).slice(0, 8)}]` : ''
  return `[${ts}] [${level}]${corr} ${message}`
}

function toSentryExtras(ctx?: LogContext): Record<string, unknown> {
  return ctx ? { ...ctx } : {}
}

// ---------------------------------------------------------------------------
// Log levels
// ---------------------------------------------------------------------------

function info(message: string, ctx?: LogContext): void {
  console.info(formatMessage('INFO', message, ctx), ctx ?? '')

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
  console.warn(formatMessage('WARN', message, ctx), ctx ?? '')

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
  console.error(formatMessage('ERROR', message, ctx), err ?? '', ctx ?? '')

  // Capture to Sentry with full context
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
  // Revenue events are elevated — always info + Sentry breadcrumb with 'revenue' category
  console.info(formatMessage('REVENUE', message, ctx), ctx ?? '')

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
  const level = ctx?.success === false ? 'WARN' : 'INFO'
  console.info(formatMessage(level, message, ctx), ctx ?? '')

  try {
    Sentry.addBreadcrumb({
      message,
      level: ctx?.success === false ? 'warning' : 'info',
      category: 'automation',
      data: toSentryExtras(ctx),
    })

    // Failed automations are captured as Sentry events for alerting
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

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const log = { info, warn, error, revenue, automation }
export default log

// Named exports for convenience
export { info as logInfo, warn as logWarn, error as logError }
