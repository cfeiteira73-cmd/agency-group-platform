// =============================================================================
// Agency Group — withAI: Unified AI Resilience Wrapper
// lib/ops/withAI.ts
//
// Combines withCircuitBreaker + withAnthropicRetry into a single ergonomic call.
// Replaces the verbose pattern:
//   await withCircuitBreaker('anthropic-haiku', () => withAnthropicRetry(fn), null)
// With:
//   await withAI('anthropic-haiku', fn, null)
//
// COMPONENT NAMES (shared circuit state — each opens independently):
//   anthropic-opus   — Claude Opus-class models (vision, complex reasoning)
//   anthropic-haiku  — Claude Haiku-class models (quick inference, summaries)
//   anthropic        — Generic / unclassified Anthropic calls
//
// CIRCUIT BEHAVIOUR:
//   Open after:   5 consecutive failures (shared with circuitBreaker.ts constants)
//   Recovery:     half_open probe after 60 seconds
//   Close after:  3 consecutive successes in half_open
//   State storage: Upstash Redis (persistent across cold starts) → in-memory fallback
//
// USAGE:
//   import { withAI } from '@/lib/ops/withAI'
//
//   const message = await withAI(
//     'anthropic-haiku',
//     () => client.messages.create({ model: 'claude-haiku-4-5', ... }),
//     null,  // returned when circuit is open — caller returns 503
//   )
//   if (message === null) {
//     return NextResponse.json({ error: 'AI service temporarily unavailable.' }, { status: 503 })
//   }
//
// TypeScript strict — 0 errors
// =============================================================================

import { withCircuitBreaker, isOpen } from './circuitBreaker'
import { withAnthropicRetry }         from './withRetry'
import { logAIDecision }              from '@/lib/observability/ai-audit'
import { generateCorrelationId }      from '@/lib/observability/correlation'
import { checkPolicy, trackTokensUsed } from '@/lib/ai/policyEngine'
import { validateAgentOutput }        from '@/lib/ai/contracts'
import type { ZodSchema }             from 'zod'

// ---------------------------------------------------------------------------
// Component names — export for type safety at call sites
// ---------------------------------------------------------------------------

export type AIComponent =
  | 'anthropic-opus'    // Claude Opus / vision calls
  | 'anthropic-haiku'   // Claude Haiku calls
  | 'anthropic'         // Generic catch-all

// ---------------------------------------------------------------------------
// withAI
// ---------------------------------------------------------------------------

/**
 * Execute an Anthropic API call with:
 *   1. Circuit breaker protection (Redis-backed, component-scoped)
 *   2. Exponential backoff retry (3 attempts, 1s→2s, 30s per-attempt timeout)
 *
 * When the circuit is OPEN or all retries fail, returns `fallback` immediately
 * (never throws when `fallback` is provided).
 *
 * @param component     Circuit breaker key — use the narrowest name for the model tier
 * @param fn            Anthropic API call factory — called on each retry attempt
 * @param fallback      Value returned when circuit is open or all attempts fail
 * @param revenueContext Optional revenue context tag for audit logging
 * @param outputSchema  Optional Zod schema — when provided, validates the AI text response
 *                      after a successful call (best-effort: logs warning, never blocks)
 *
 * @example
 *   const msg = await withAI('anthropic-haiku', () =>
 *     client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 512, messages }),
 *     null,
 *   )
 *   if (!msg) return NextResponse.json({ error: 'AI temporarily unavailable.' }, { status: 503 })
 */
export async function withAI<T>(
  component: AIComponent,
  fn: () => Promise<T>,
  fallback: T,
  revenueContext?: string,
  outputSchema?: ZodSchema,
): Promise<T> {
  const correlationId = generateCorrelationId()
  const start = Date.now()

  // ── Hard policy gate — runs before any AI call ──────────────────────────────
  const policyCtx = {
    agentId:               component,
    tenantId:              process.env.SYSTEM_ORG_ID ?? 'agency-group',
    correlationId,
    estimatedInputTokens:  1000,
    estimatedOutputTokens: 500,
  }

  // FAIL-CLOSED: if governance infrastructure is unavailable, do NOT execute
  // the AI call. Return 503-equivalent fallback and log prominently.
  let policy: { decision: 'ALLOW' | 'DENY' | 'ESCALATE'; reason: string }
  try {
    policy = await checkPolicy(policyCtx)
  } catch (err) {
    console.error(
      `[withAI] GOVERNANCE UNAVAILABLE for ${component} — failing closed (GOV_503):`,
      err instanceof Error ? err.message : err,
    )
    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         false,
      fallback_used:   true,
      error_type:      'governance_unavailable',
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })
    return fallback
  }

  if (policy.decision === 'DENY') {
    console.warn(`[withAI] Policy DENY for ${component}: ${policy.reason}`)
    return fallback
  }
  if (policy.decision === 'ESCALATE') {
    console.warn(`[withAI] Policy ESCALATE for ${component}: ${policy.reason} — proceeding with caution`)
    // Continue execution but log prominently
  }

  // Detect an open circuit before attempting (circuit breaker returns fallback
  // without throwing, so we probe the state up-front for the audit log).
  const circuitOpen = await isOpen(component)

  if (circuitOpen) {
    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         false,
      fallback_used:   true,
      error_type:      'circuit_open',
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })
    // Let withCircuitBreaker return fallback normally (consistent behaviour)
    return fallback
  }

  try {
    const result = await withCircuitBreaker<T>(
      component,
      (): Promise<T> => withAnthropicRetry(fn),
      fallback,
    )

    const usedFallback = Object.is(result, fallback)

    if (!usedFallback) {
      const inputTokens  = (result as Record<string, unknown> | null)?.['usage'] != null
        ? ((result as Record<string, unknown>)['usage'] as Record<string, number>)['input_tokens']  ?? 0
        : 0
      const outputTokens = (result as Record<string, unknown> | null)?.['usage'] != null
        ? ((result as Record<string, unknown>)['usage'] as Record<string, number>)['output_tokens'] ?? 0
        : 0
      if (inputTokens + outputTokens > 0) {
        void trackTokensUsed('agency-group', component, inputTokens + outputTokens)
      }

      // ── Optional Zod output validation (best-effort — never blocks) ─────────
      if (outputSchema) {
        const contentArr = (result as Record<string, unknown> | null)?.['content']
        if (Array.isArray(contentArr)) {
          const textBlock = contentArr.find(
            (b): b is { type: string; text: string } =>
              typeof b === 'object' && b !== null && (b as Record<string, unknown>)['type'] === 'text',
          )
          if (textBlock) {
            const validation = validateAgentOutput(outputSchema, textBlock.text, component)
            if (!validation.success) {
              console.warn('[withAI] Output validation failed:', validation.error)
            }
          }
        }
      }
    }

    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         !usedFallback,
      fallback_used:   usedFallback,
      error_type:      usedFallback ? 'error' : undefined,
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })

    return result
  } catch (err) {
    const errorType =
      err instanceof Error && err.message.includes('timed out')
        ? 'timeout'
        : err instanceof Error && /rate.?limit/i.test(err.message)
          ? 'rate_limit'
          : 'error'

    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         false,
      fallback_used:   false,
      error_type:      errorType,
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })

    throw err
  }
}

// ---------------------------------------------------------------------------
// withAIStream — variant for streaming calls
//
// For streaming routes (ReadableStream / SSE), the circuit breaker guards the
// *creation* of the stream (the initial API handshake), not the stream body.
// Falls back to a null stream that the caller can detect and return 503.
//
// NOTE: Streaming calls are inherently one-shot — they cannot be retried.
//       Only the circuit breaker applies; retry is omitted here.
// ---------------------------------------------------------------------------

/**
 * Guards a streaming Anthropic call with a circuit breaker only (no retry).
 * Returns `fallback` immediately if the circuit is OPEN.
 *
 * @example
 *   const stream = await withAIStream('anthropic-opus', () =>
 *     client.messages.stream({ model: 'claude-opus-4-6', ... }),
 *     null,
 *   )
 *   if (!stream) return new Response('AI temporarily unavailable.', { status: 503 })
 */
export async function withAIStream<T>(
  component: AIComponent,
  fn: () => Promise<T>,
  fallback: T,
  revenueContext?: string,
): Promise<T> {
  // No retry for streams — retrying a stream would result in partial/duplicate output
  const correlationId = generateCorrelationId()
  const start = Date.now()

  // ── Hard policy gate — runs before any AI call ──────────────────────────────
  const policyCtx = {
    agentId:               component,
    tenantId:              process.env.SYSTEM_ORG_ID ?? 'agency-group',
    correlationId,
    estimatedInputTokens:  1000,
    estimatedOutputTokens: 500,
  }

  // FAIL-CLOSED: if governance infrastructure is unavailable, do NOT execute
  // the AI call. Return 503-equivalent fallback and log prominently.
  let policy: { decision: 'ALLOW' | 'DENY' | 'ESCALATE'; reason: string }
  try {
    policy = await checkPolicy(policyCtx)
  } catch (err) {
    console.error(
      `[withAIStream] GOVERNANCE UNAVAILABLE for ${component} — failing closed (GOV_503):`,
      err instanceof Error ? err.message : err,
    )
    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         false,
      fallback_used:   true,
      error_type:      'governance_unavailable',
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })
    return fallback
  }

  if (policy.decision === 'DENY') {
    console.warn(`[withAIStream] Policy DENY for ${component}: ${policy.reason}`)
    return fallback
  }
  if (policy.decision === 'ESCALATE') {
    console.warn(`[withAIStream] Policy ESCALATE for ${component}: ${policy.reason} — proceeding with caution`)
    // Continue execution but log prominently
  }

  const circuitOpen = await isOpen(component)

  if (circuitOpen) {
    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         false,
      fallback_used:   true,
      error_type:      'circuit_open',
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })
    return fallback
  }

  try {
    const result = await withCircuitBreaker<T>(component, fn, fallback)

    const usedFallback = Object.is(result, fallback)

    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         !usedFallback,
      fallback_used:   usedFallback,
      error_type:      usedFallback ? 'error' : undefined,
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })

    return result
  } catch (err) {
    const errorType =
      err instanceof Error && err.message.includes('timed out')
        ? 'timeout'
        : err instanceof Error && /rate.?limit/i.test(err.message)
          ? 'rate_limit'
          : 'error'

    logAIDecision({
      correlation_id:  correlationId,
      model:           component,
      circuit_name:    component,
      latency_ms:      Date.now() - start,
      success:         false,
      fallback_used:   false,
      error_type:      errorType,
      revenue_context: revenueContext,
      created_at:      new Date().toISOString(),
    })

    throw err
  }
}
