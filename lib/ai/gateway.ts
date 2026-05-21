// =============================================================================
// Agency Group — AI Gateway (Central Control Plane)
// lib/ai/gateway.ts
//
// ALL AI completions in the system MUST route through withAI() or withAIStream().
// Guarantees:
//   - tenant_id required on every call
//   - Budget pre-check (blocks call if over daily/monthly limit)
//   - Full cost tracking via ai_usage_log audit trail
//   - Fail-closed by default (throws on AI failure)
//   - Structured audit log for every call (success + failure)
//
// The one Anthropic client instance lives here — never instantiate Anthropic
// elsewhere for completions (use _anthropicClient only for embeddings/other).
//
// TypeScript strict — 0 errors
// =============================================================================

import Anthropic from '@anthropic-ai/sdk'
import { checkBudget, recordSpend } from './budgetEnforcer'
import { computeAICost, estimateCost } from './costTracker'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Single Anthropic client instance
// ---------------------------------------------------------------------------

// Export for cases where the raw client is needed (e.g. embeddings, non-completion APIs).
// Always prefer withAI() for message completions.
export const _anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIGatewayOptions {
  /** UUID of the tenant making this call — REQUIRED */
  tenantId: string
  /** Logical feature label for cost attribution, e.g. 'chat', 'avm', 'deal_analysis' */
  feature: string
  /** Anthropic model ID — defaults to claude-sonnet-4-5 */
  model?: string
  /** Max output tokens — defaults to 2000 */
  maxTokens?: number
  /** System prompt text */
  systemPrompt?: string
  /**
   * Fail-closed mode (default: true).
   * true  → throw if AI is unavailable or budget exceeded (hard fail, caller returns 503)
   * false → return an empty/partial result instead of throwing
   */
  failClosed?: boolean
  /** Correlation ID for distributed tracing */
  correlationId?: string
}

export interface AIGatewayResult {
  content: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  latency_ms: number
  feature: string
  tenant_id: string
}

// Fallback empty result returned when failClosed=false and AI is unavailable
const EMPTY_RESULT = (options: AIGatewayOptions, model: string): AIGatewayResult => ({
  content: '',
  model,
  input_tokens: 0,
  output_tokens: 0,
  cost_usd: 0,
  latency_ms: 0,
  feature: options.feature,
  tenant_id: options.tenantId,
})

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MODEL     = 'claude-sonnet-4-5'
const DEFAULT_MAX_TOKENS = 2000

// ---------------------------------------------------------------------------
// withAI — single-turn completions
// ---------------------------------------------------------------------------

/**
 * Execute a single-turn AI completion through the gateway.
 *
 * @throws Error if tenantId is missing
 * @throws Error('[AI Gateway] Budget exceeded: ...') if over budget (failClosed=true)
 * @throws Error('[AI Gateway] ...') on Anthropic API failure (failClosed=true)
 *
 * @example
 *   const result = await withAI(
 *     { tenantId: req.tenantId, feature: 'avm', model: 'claude-haiku-4-5' },
 *     [{ role: 'user', content: 'Estimate value for this property...' }]
 *   )
 *   return result.content
 */
export async function withAI(
  options: AIGatewayOptions,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<AIGatewayResult> {
  const {
    tenantId,
    feature,
    model       = DEFAULT_MODEL,
    maxTokens   = DEFAULT_MAX_TOKENS,
    systemPrompt,
    failClosed  = true,
    correlationId,
  } = options

  // ── 1. Validate tenantId ───────────────────────────────────────────────────
  if (!tenantId || !tenantId.trim()) {
    throw new Error('[AI Gateway] tenantId is required for all AI calls')
  }

  // ── 2. Estimate cost for budget pre-check ─────────────────────────────────
  // Rough estimate: total message content length / 4 chars-per-token
  const messageText     = messages.map((m) => m.content).join(' ')
  const estimatedInput  = Math.ceil(messageText.length / 4)
  const estimatedOutput = maxTokens
  const estimatedCost   = estimateCost(model, estimatedInput, estimatedOutput)

  // ── 3. Budget pre-check ────────────────────────────────────────────────────
  const budgetCheck = await checkBudget(tenantId, estimatedCost)
  if (!budgetCheck.allowed) {
    const reason = budgetCheck.reason ?? 'budget_exceeded'
    log.warn('[AI Gateway] Budget check blocked AI call', {
      correlation_id: correlationId ?? null,
      route: 'gateway.withAI',
      tenant_id: tenantId,
      feature,
      model,
      reason,
      estimated_cost_usd: estimatedCost,
    })

    if (failClosed) {
      throw new Error(`[AI Gateway] Budget exceeded: ${reason}`)
    }
    return EMPTY_RESULT(options, model)
  }

  // ── 4. Execute AI call ─────────────────────────────────────────────────────
  const start = Date.now()

  try {
    const response = await _anthropicClient.messages.create({
      model,
      max_tokens: maxTokens,
      messages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    })

    const latency_ms     = Date.now() - start
    const input_tokens   = response.usage.input_tokens
    const output_tokens  = response.usage.output_tokens
    const { total_cost_usd } = computeAICost(model, input_tokens, output_tokens)

    // Extract text content from first text block
    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // ── 5. Audit log (fire-and-forget — never let this fail the call) ────────
    void recordSpend(tenantId, total_cost_usd, model, feature, {
      input_tokens,
      output_tokens,
      latency_ms,
      success: true,
      correlation_id: correlationId,
    })

    log.info('[AI Gateway] AI call completed', {
      correlation_id: correlationId ?? null,
      route: 'gateway.withAI',
      tenant_id: tenantId,
      feature,
      model,
      input_tokens,
      output_tokens,
      cost_usd: total_cost_usd,
      latency_ms,
    })

    return {
      content,
      model,
      input_tokens,
      output_tokens,
      cost_usd: total_cost_usd,
      latency_ms,
      feature,
      tenant_id: tenantId,
    }
  } catch (err) {
    const latency_ms = Date.now() - start
    const errMsg     = err instanceof Error ? err.message : String(err)

    // Audit log the failure
    void recordSpend(tenantId, 0, model, feature, {
      input_tokens:  0,
      output_tokens: 0,
      latency_ms,
      success: false,
      error_message: errMsg.slice(0, 500),
      correlation_id: correlationId,
    })

    log.error('[AI Gateway] AI call failed', err, {
      correlation_id: correlationId ?? null,
      route: 'gateway.withAI',
      tenant_id: tenantId,
      feature,
      model,
      latency_ms,
    })

    if (failClosed) {
      throw new Error(`[AI Gateway] ${errMsg}`)
    }
    return EMPTY_RESULT(options, model)
  }
}

// ---------------------------------------------------------------------------
// withAIStream — streaming completions
// ---------------------------------------------------------------------------

/**
 * Execute a streaming AI completion through the gateway.
 * Calls `onChunk` for each text delta, then returns full AIGatewayResult
 * with accumulated token counts and cost after the stream completes.
 *
 * Budget enforcement and audit logging apply identically to withAI().
 *
 * @throws Error if tenantId is missing or budget exceeded (failClosed=true)
 *
 * @example
 *   const result = await withAIStream(
 *     { tenantId, feature: 'chat' },
 *     messages,
 *     (chunk) => controller.enqueue(chunk),
 *   )
 */
export async function withAIStream(
  options: AIGatewayOptions,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onChunk: (chunk: string) => void,
): Promise<AIGatewayResult> {
  const {
    tenantId,
    feature,
    model       = DEFAULT_MODEL,
    maxTokens   = DEFAULT_MAX_TOKENS,
    systemPrompt,
    failClosed  = true,
    correlationId,
  } = options

  // ── 1. Validate tenantId ───────────────────────────────────────────────────
  if (!tenantId || !tenantId.trim()) {
    throw new Error('[AI Gateway] tenantId is required for all AI calls')
  }

  // ── 2. Estimate cost for budget pre-check ─────────────────────────────────
  const messageText     = messages.map((m) => m.content).join(' ')
  const estimatedInput  = Math.ceil(messageText.length / 4)
  const estimatedOutput = maxTokens
  const estimatedCost   = estimateCost(model, estimatedInput, estimatedOutput)

  // ── 3. Budget pre-check ────────────────────────────────────────────────────
  const budgetCheck = await checkBudget(tenantId, estimatedCost)
  if (!budgetCheck.allowed) {
    const reason = budgetCheck.reason ?? 'budget_exceeded'
    log.warn('[AI Gateway] Budget check blocked streaming AI call', {
      correlation_id: correlationId ?? null,
      route: 'gateway.withAIStream',
      tenant_id: tenantId,
      feature,
      model,
      reason,
    })

    if (failClosed) {
      throw new Error(`[AI Gateway] Budget exceeded: ${reason}`)
    }
    return EMPTY_RESULT(options, model)
  }

  // ── 4. Execute streaming call ──────────────────────────────────────────────
  const start = Date.now()
  let accumulatedText = ''

  try {
    const stream = _anthropicClient.messages.stream({
      model,
      max_tokens: maxTokens,
      messages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const chunk = event.delta.text
        accumulatedText += chunk
        onChunk(chunk)
      }
    }

    // Finalise: get usage from the completed stream message
    const finalMessage = await stream.finalMessage()
    const latency_ms   = Date.now() - start
    const input_tokens  = finalMessage.usage.input_tokens
    const output_tokens = finalMessage.usage.output_tokens
    const { total_cost_usd } = computeAICost(model, input_tokens, output_tokens)

    // ── 5. Audit log ─────────────────────────────────────────────────────────
    void recordSpend(tenantId, total_cost_usd, model, feature, {
      input_tokens,
      output_tokens,
      latency_ms,
      success: true,
      correlation_id: correlationId,
    })

    log.info('[AI Gateway] Streaming AI call completed', {
      correlation_id: correlationId ?? null,
      route: 'gateway.withAIStream',
      tenant_id: tenantId,
      feature,
      model,
      input_tokens,
      output_tokens,
      cost_usd: total_cost_usd,
      latency_ms,
    })

    return {
      content:      accumulatedText,
      model,
      input_tokens,
      output_tokens,
      cost_usd:     total_cost_usd,
      latency_ms,
      feature,
      tenant_id:    tenantId,
    }
  } catch (err) {
    const latency_ms = Date.now() - start
    const errMsg     = err instanceof Error ? err.message : String(err)

    // Estimate token count from accumulated text for the failure audit row
    const partialOutputTokens = Math.ceil(accumulatedText.length / 4)

    void recordSpend(tenantId, 0, model, feature, {
      input_tokens:  0,
      output_tokens: partialOutputTokens,
      latency_ms,
      success: false,
      error_message: errMsg.slice(0, 500),
      correlation_id: correlationId,
    })

    log.error('[AI Gateway] Streaming AI call failed', err, {
      correlation_id: correlationId ?? null,
      route: 'gateway.withAIStream',
      tenant_id: tenantId,
      feature,
      model,
      latency_ms,
      partial_chars: accumulatedText.length,
    })

    if (failClosed) {
      throw new Error(`[AI Gateway] ${errMsg}`)
    }
    return EMPTY_RESULT(options, model)
  }
}
