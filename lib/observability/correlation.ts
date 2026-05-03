// =============================================================================
// Agency Group — Correlation ID Propagation
// lib/observability/correlation.ts
//
// Provides consistent correlation ID generation and propagation across all
// API routes, background jobs, and external service calls.
//
// DESIGN:
//   - Every inbound HTTP request gets a correlation ID (injected by middleware)
//   - Downstream calls (Supabase, n8n, Resend, Anthropic) receive the same ID
//   - Cron jobs generate their own run-scoped correlation ID
//   - IDs are stored in learning_events.correlation_id for full event replay
//
// USAGE:
//   const corrId = getRequestCorrelationId(req)          // extract from request
//   const corrId = generateCorrelationId()               // generate new (cron jobs)
//   const headers = buildCorrelationHeaders(corrId)      // spread into fetch()
//   const ctx     = withCorrelation(corrId, { route })   // build log context
// =============================================================================

import type { NextRequest } from 'next/server'
import type { LogContext }  from '@/lib/logger'

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Generate a new v4 UUID correlation ID.
 * Works in Edge runtime (crypto.randomUUID) and Node.js.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Extraction — from inbound requests
// ---------------------------------------------------------------------------

/**
 * Extract the correlation ID from an inbound NextRequest.
 * The middleware injects `x-correlation-id` on every request.
 * Falls back to generating a new ID if the header is missing.
 */
export function getRequestCorrelationId(req: NextRequest): string {
  return req.headers.get('x-correlation-id') || generateCorrelationId()
}

/**
 * Extract correlation ID from a plain HeadersInit or Headers object.
 * Useful in API routes where you have `req.headers` as a Headers instance.
 */
export function getHeaderCorrelationId(headers: Headers | HeadersInit): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-correlation-id')
  }
  if (typeof headers === 'object' && !Array.isArray(headers)) {
    return (headers as Record<string, string>)['x-correlation-id'] ?? null
  }
  return null
}

// ---------------------------------------------------------------------------
// Propagation — to outbound calls
// ---------------------------------------------------------------------------

/**
 * Build fetch headers that propagate the correlation ID to downstream services.
 *
 * Usage:
 *   const res = await fetch(url, {
 *     headers: {
 *       'Content-Type': 'application/json',
 *       ...buildCorrelationHeaders(corrId),
 *     }
 *   })
 */
export function buildCorrelationHeaders(correlationId: string): Record<string, string> {
  return { 'x-correlation-id': correlationId }
}

// ---------------------------------------------------------------------------
// Log context — integrate with lib/logger
// ---------------------------------------------------------------------------

/**
 * Build a LogContext that includes the correlation ID.
 * Spread this into every log.info/warn/error call.
 *
 * Usage:
 *   const ctx = withCorrelation(corrId, { route: '/api/leads', agent_email })
 *   log.info('[leads] new lead created', { ...ctx, lead_id })
 */
export function withCorrelation(
  correlationId: string,
  extra: Partial<LogContext> = {},
): LogContext {
  return { correlation_id: correlationId, ...extra }
}

// ---------------------------------------------------------------------------
// Cron job scoping
// ---------------------------------------------------------------------------

/**
 * Generate a cron-scoped correlation ID with a prefix for easy filtering.
 * Format: cron_{job_name}_{uuid_prefix}
 *
 * Usage:
 *   const corrId = cronCorrelationId('avm-compute')
 *   // → "cron_avm-compute_a1b2c3d4"
 */
export function cronCorrelationId(jobName: string): string {
  const uuid = generateCorrelationId().replace(/-/g, '').slice(0, 8)
  return `cron_${jobName}_${uuid}`
}

// ---------------------------------------------------------------------------
// Short ID — for logging brevity
// ---------------------------------------------------------------------------

/**
 * Returns the first 8 characters of a correlation ID for compact log output.
 */
export function shortCorrelationId(correlationId: string): string {
  return correlationId.slice(0, 8)
}
