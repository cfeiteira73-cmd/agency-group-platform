// =============================================================================
// Agency Group — Business Telemetry Standard
// lib/observability/telemetry.ts
//
// Structured business events for monitoring KPIs, API performance,
// revenue flows, AI cost, and circuit-breaker state changes.
//
// Design principles:
//   - Fire-and-forget: every export is void — callers never await
//   - Never throws: all paths are wrapped in try/catch
//   - Vercel log aggregation: every event is a single-line JSON to console.log
//   - Sentry integration: conditional on SENTRY_DSN env var
//   - Edge-runtime safe: no Node.js-only APIs (no fs, no process.exit, etc.)
//   - TypeScript strict: 0 errors
//   - correlation_id is included in every output for log aggregation
// =============================================================================

import * as Sentry from '@sentry/nextjs'

// ---------------------------------------------------------------------------
// Internal — shared event shape emitted to console (Vercel log drain)
// ---------------------------------------------------------------------------

interface TelemetryEvent {
  ts: string
  event: string
  correlation_id: string | null
  [key: string]: string | number | boolean | null
}

function emit(event: TelemetryEvent): void {
  // Single-line JSON — Vercel log drain aggregates these for querying
  console.log(JSON.stringify(event))
}

/**
 * Whether Sentry is configured in this environment.
 * Evaluated once at module load to avoid per-call overhead.
 */
const SENTRY_ENABLED =
  typeof process !== 'undefined' &&
  typeof process.env !== 'undefined' &&
  Boolean(process.env.SENTRY_DSN)

// ---------------------------------------------------------------------------
// trackBusinessEvent
// ---------------------------------------------------------------------------

/**
 * Track a generic business event with arbitrary key-value metadata.
 *
 * Usage:
 *   trackBusinessEvent('lead.qualified', { source: 'sofia', score: 82 }, corrId)
 */
export function trackBusinessEvent(
  name: string,
  props: Record<string, string | number | boolean | null>,
  correlationId?: string | null,
): void {
  try {
    const event: TelemetryEvent = {
      ts: new Date().toISOString(),
      event: name,
      correlation_id: correlationId ?? null,
      ...props,
    }
    emit(event)

    if (SENTRY_ENABLED) {
      try {
        Sentry.addBreadcrumb({
          message: name,
          level: 'info',
          category: 'business',
          data: { correlation_id: correlationId ?? null, ...props },
        })
      } catch {
        // Sentry unavailable — not fatal
      }
    }
  } catch {
    // telemetry must never throw
  }
}

// ---------------------------------------------------------------------------
// trackApiRoute
// ---------------------------------------------------------------------------

/**
 * Track API route performance. Call at the end of every route handler.
 *
 * Usage:
 *   trackApiRoute('/api/leads', 'POST', 201, Date.now() - start, corrId)
 */
export function trackApiRoute(
  route: string,
  method: string,
  statusCode: number,
  durationMs: number,
  correlationId?: string | null,
): void {
  try {
    const isError = statusCode >= 500
    const isClientError = statusCode >= 400 && statusCode < 500

    emit({
      ts: new Date().toISOString(),
      event: 'api.route',
      correlation_id: correlationId ?? null,
      route,
      method: method.toUpperCase(),
      status_code: statusCode,
      duration_ms: durationMs,
      is_error: isError,
      is_client_error: isClientError,
    })

    if (SENTRY_ENABLED) {
      try {
        // Add as breadcrumb always
        Sentry.addBreadcrumb({
          message: `${method.toUpperCase()} ${route} → ${statusCode}`,
          level: isError ? 'error' : isClientError ? 'warning' : 'info',
          category: 'api',
          data: {
            route,
            method,
            status_code: statusCode,
            duration_ms: durationMs,
            correlation_id: correlationId ?? null,
          },
        })

        // Capture slow routes (>3 s) and server errors as Sentry events
        if (isError || durationMs > 3000) {
          Sentry.withScope((scope) => {
            scope.setTag('route', route)
            scope.setTag('method', method.toUpperCase())
            if (correlationId) scope.setTag('correlation_id', correlationId)
            scope.setExtra('status_code', statusCode)
            scope.setExtra('duration_ms', durationMs)
            Sentry.captureMessage(
              `API ${isError ? 'error' : 'slow'}: ${method.toUpperCase()} ${route}`,
              isError ? 'error' : 'warning',
            )
          })
        }
      } catch {
        // Sentry unavailable — not fatal
      }
    }
  } catch {
    // telemetry must never throw
  }
}

// ---------------------------------------------------------------------------
// trackRevenueEvent
// ---------------------------------------------------------------------------

/**
 * Track a revenue-critical event. Also emits a structured log at REVENUE
 * level so it appears in Vercel logs with a distinctive prefix.
 *
 * Usage:
 *   trackRevenueEvent('deal_closed', 250000, 'agent@agencygroup.pt', corrId)
 */
export function trackRevenueEvent(
  eventType: 'deal_created' | 'deal_closed' | 'match_created' | 'commission_earned',
  value: number,
  agentEmail: string | null,
  correlationId?: string | null,
): void {
  try {
    const payload: TelemetryEvent = {
      ts: new Date().toISOString(),
      event: `revenue.${eventType}`,
      correlation_id: correlationId ?? null,
      event_type: eventType,
      value,
      agent_email: agentEmail ?? null,
    }

    // Structured log with REVENUE prefix for easy Vercel log filtering
    console.log(`[REVENUE] ${JSON.stringify(payload)}`)

    if (SENTRY_ENABLED) {
      try {
        Sentry.withScope((scope) => {
          scope.setTag('revenue_event', eventType)
          if (agentEmail) scope.setTag('agent_email', agentEmail)
          if (correlationId) scope.setTag('correlation_id', correlationId)
          scope.setExtra('value', value)
          scope.setExtra('agent_email', agentEmail)
          Sentry.addBreadcrumb({
            message: `Revenue: ${eventType} €${value}`,
            level: 'info',
            category: 'revenue',
            data: {
              event_type: eventType,
              value,
              agent_email: agentEmail,
              correlation_id: correlationId ?? null,
            },
          })
          // Revenue events are always captured as Sentry messages for alerting
          Sentry.captureMessage(`[revenue] ${eventType} €${value}`, 'info')
        })
      } catch {
        // Sentry unavailable — not fatal
      }
    }
  } catch {
    // telemetry must never throw
  }
}

// ---------------------------------------------------------------------------
// trackAICall
// ---------------------------------------------------------------------------

/**
 * Track an Anthropic / vision AI call with cost awareness.
 *
 * Usage:
 *   trackAICall('claude-3-5-sonnet-20241022', 1200, 840, true, corrId)
 */
export function trackAICall(
  model: string,
  tokens: number,
  latencyMs: number,
  success: boolean,
  correlationId?: string | null,
): void {
  try {
    emit({
      ts: new Date().toISOString(),
      event: 'ai.call',
      correlation_id: correlationId ?? null,
      model,
      tokens,
      latency_ms: latencyMs,
      success,
    })

    if (SENTRY_ENABLED) {
      try {
        Sentry.addBreadcrumb({
          message: `AI call: ${model} (${tokens} tokens, ${latencyMs}ms)`,
          level: success ? 'info' : 'error',
          category: 'ai',
          data: {
            model,
            tokens,
            latency_ms: latencyMs,
            success,
            correlation_id: correlationId ?? null,
          },
        })

        // Failed AI calls captured as Sentry events
        if (!success) {
          Sentry.withScope((scope) => {
            scope.setTag('ai_model', model)
            if (correlationId) scope.setTag('correlation_id', correlationId)
            scope.setExtra('tokens', tokens)
            scope.setExtra('latency_ms', latencyMs)
            Sentry.captureMessage(`AI call failed: ${model}`, 'error')
          })
        }
      } catch {
        // Sentry unavailable — not fatal
      }
    }
  } catch {
    // telemetry must never throw
  }
}

// ---------------------------------------------------------------------------
// trackCircuitBreaker
// ---------------------------------------------------------------------------

/**
 * Track a circuit-breaker state transition (closed→open, open→half-open, etc.).
 *
 * Usage:
 *   trackCircuitBreaker('supabase', 'closed', 'open', corrId)
 */
export function trackCircuitBreaker(
  component: string,
  previousState: string,
  newState: string,
  correlationId?: string | null,
): void {
  try {
    const isOpening = newState === 'open'

    emit({
      ts: new Date().toISOString(),
      event: 'circuit_breaker.state_change',
      correlation_id: correlationId ?? null,
      component,
      previous_state: previousState,
      new_state: newState,
      is_opening: isOpening,
    })

    if (SENTRY_ENABLED) {
      try {
        Sentry.addBreadcrumb({
          message: `Circuit breaker [${component}]: ${previousState} → ${newState}`,
          level: isOpening ? 'error' : 'info',
          category: 'circuit_breaker',
          data: {
            component,
            previous_state: previousState,
            new_state: newState,
            correlation_id: correlationId ?? null,
          },
        })

        // Opening a circuit breaker is an error worth alerting on
        if (isOpening) {
          Sentry.withScope((scope) => {
            scope.setTag('circuit_breaker_component', component)
            if (correlationId) scope.setTag('correlation_id', correlationId)
            scope.setExtra('previous_state', previousState)
            scope.setExtra('new_state', newState)
            Sentry.captureMessage(`Circuit breaker OPEN: ${component}`, 'error')
          })
        }
      } catch {
        // Sentry unavailable — not fatal
      }
    }
  } catch {
    // telemetry must never throw
  }
}
