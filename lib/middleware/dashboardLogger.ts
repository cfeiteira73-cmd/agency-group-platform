// Agency Group — Dashboard Structured Logger
// lib/middleware/dashboardLogger.ts
// TypeScript strict — 0 errors
//
// Structured logging for portal API calls.
// Format: { timestamp, level, endpoint, method, duration_ms, status, tenant_id, correlation_id }
// Writes to console (JSON) + optionally to siem_events (when configured)
// Drop-in replacement for console.log/console.error in API routes

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  service: 'portal-api'
  endpoint?: string
  method?: string
  duration_ms?: number
  status_code?: number
  tenant_id?: string
  correlation_id?: string
  message: string
  data?: Record<string, unknown>
  error?: string
  stack?: string
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, error?: Error, data?: Record<string, unknown>): void
  request(method: string, path: string, status: number, durationMs: number): void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SIEM_ENABLED = process.env.SIEM_LOGGING_ENABLED === 'true'

function emit(entry: LogEntry): void {
  // Structured JSON — Vercel captures stdout as structured logs
  console.log(JSON.stringify(entry))

  // Fire-and-forget to siem_events when configured
  if (SIEM_ENABLED) {
    ;(supabaseAdmin as any)
      .from('siem_events')
      .insert({
        level: entry.level,
        service: entry.service,
        endpoint: entry.endpoint ?? null,
        method: entry.method ?? null,
        duration_ms: entry.duration_ms ?? null,
        status_code: entry.status_code ?? null,
        tenant_id: entry.tenant_id ?? null,
        correlation_id: entry.correlation_id ?? null,
        message: entry.message,
        data: entry.data ?? null,
        error: entry.error ?? null,
        occurred_at: entry.timestamp,
      })
      .then(() => {})
      .catch(() => {})
  }
}

function buildEntry(
  level: LogLevel,
  message: string,
  context: { endpoint?: string; tenantId?: string; correlationId?: string },
  extras: Partial<LogEntry>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    service: 'portal-api',
    endpoint: context.endpoint,
    tenant_id: context.tenantId,
    correlation_id: context.correlationId,
    message,
    ...extras,
  }
}

// ---------------------------------------------------------------------------
// createLogger — returns a scoped Logger bound to context
// ---------------------------------------------------------------------------

export function createLogger(context: {
  endpoint?: string
  tenantId?: string
  correlationId?: string
}): Logger {
  return {
    debug(message, data) {
      emit(buildEntry('debug', message, context, { data }))
    },

    info(message, data) {
      emit(buildEntry('info', message, context, { data }))
    },

    warn(message, data) {
      emit(buildEntry('warn', message, context, { data }))
    },

    error(message, err, data) {
      const entry = buildEntry('error', message, context, {
        data,
        error: err?.message,
        stack:
          process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
      })
      emit(entry)
    },

    request(method, path, status, durationMs) {
      emit(
        buildEntry(
          status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
          `${method} ${path} → ${status} (${durationMs}ms)`,
          context,
          {
            method,
            endpoint: path,
            status_code: status,
            duration_ms: durationMs,
          }
        )
      )
    },
  }
}

// ---------------------------------------------------------------------------
// Default export — module-level logger (no context)
// ---------------------------------------------------------------------------

export const log = createLogger({})
