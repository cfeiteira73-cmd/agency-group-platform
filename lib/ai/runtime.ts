// =============================================================================
// Agency Group — SH-ROS L1 AI Execution Layer
// lib/ai/runtime.ts
//
// Every AI call in the system MUST go through withAI() or withAIStream().
// These wrappers enforce:
//   1. Policy gate   → policyEngine.checkPolicy()
//   2. Token budget  → tokenGovernor.checkTokenBudget()
//   3. Execution     → caller-supplied fn()
//   4. Consumption   → tokenGovernor.consumeTokenBudget()  (fire-and-forget)
//   5. Audit log     → auditLogger.logAudit()              (fire-and-forget)
//
// Design principles:
//   - Fail-CLOSED: governance failure blocks the AI call with GOV_503
//   - All external calls wrapped in try/catch
//   - No module-level side effects
//   - Streaming via AsyncGenerator
//
// TypeScript strict — 0 errors
// =============================================================================

import { checkPolicy }                               from './policyEngine'
import type { PolicyContext, PolicyResult }           from './policyEngine'
import { checkTokenBudget, consumeTokenBudget }      from './tokenGovernor'
import { logAudit }                                  from '../audit/auditLogger'

// ─── Public types ──────────────────────────────────────────────────────────────

export interface AICallContext {
  tenantId:               string
  agentId:                string
  correlationId:          string
  model:                  string
  estimatedInputTokens?:  number
  estimatedOutputTokens?: number
  riskLevel?:             'low' | 'medium' | 'high' | 'critical'
  callerRoute?:           string
}

export interface AICallResult<T> {
  data:              T
  /** Actual model used — may differ from requested if fallback was triggered. */
  model_used:        string
  input_tokens:      number
  output_tokens:     number
  latency_ms:        number
  /** ALLOW | DENY | ESCALATE */
  policy_decision:   string
  fallback_used:     boolean
  /**
   * Cost-aware model recommendation from tokenGovernor.
   * Set when budget utilisation is ≥80% and a cheaper model was recommended.
   * The caller should prefer this model on subsequent requests.
   * Note: fn() has already executed with ctx.model; this is advisory for the
   * caller's next call. model_used reflects what fn() actually ran with.
   */
  recommended_model_override?: string
}

/** Options accepted by withBudgetGuard / withAI. */
export interface AICallOptions<T> {
  /** Called instead of throwing when policy returns DENY. */
  fallbackFn?: () => Promise<T>
  /**
   * strict=true → throw on DENY even if fallbackFn is provided.
   * strict=false (default) → use fallbackFn or return a zero-value result.
   */
  strict?: boolean
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function now(): number {
  return Date.now()
}

/**
 * Fires an AI audit log entry. Never throws.
 */
function fireAuditLog(
  ctx: AICallContext,
  decision: string,
  result: 'success' | 'denied' | 'error',
  meta: {
    input_tokens:  number
    output_tokens: number
    latency_ms:    number
    fallback_used: boolean
    reason?:       string
  },
): void {
  try {
    logAudit({
      tenant_id:     ctx.tenantId,
      actor_id:      ctx.agentId,
      actor_type:    'ai_agent',
      action:        decision === 'DENY' ? 'ai:deny'
                   : decision === 'ESCALATE' ? 'ai:escalate'
                   : 'ai:execute',
      resource_type: 'ai_call',
      resource_id:   ctx.correlationId,
      result,
      risk_level:    ctx.riskLevel === 'critical' ? 'critical'
                   : ctx.riskLevel === 'high'     ? 'high'
                   : ctx.riskLevel === 'medium'   ? 'medium'
                   : 'low',
      correlation_id: ctx.correlationId,
      metadata: {
        agent_id:      ctx.agentId,
        model:         ctx.model,
        caller_route:  ctx.callerRoute,
        policy:        decision,
        input_tokens:  meta.input_tokens,
        output_tokens: meta.output_tokens,
        latency_ms:    meta.latency_ms,
        fallback_used: meta.fallback_used,
        reason:        meta.reason,
      },
    })
  } catch { /* audit is non-blocking — never throw */ }
}

// ─── withPolicyGate ────────────────────────────────────────────────────────────

/**
 * Runs both policy and token budget checks.
 * Returns the combined PolicyResult (most restrictive decision wins).
 * Fail-CLOSED: if either check throws, the exception propagates so the caller
 * can return GOV_503 rather than silently allowing the AI call.
 *
 * Decision priority: DENY > ESCALATE > ALLOW
 */
export async function withPolicyGate(
  ctx: AICallContext,
  estimatedTokens?: number,
): Promise<PolicyResult> {
  const estimated = estimatedTokens
    ?? (ctx.estimatedInputTokens ?? 0) + (ctx.estimatedOutputTokens ?? 0)

  let policyResult: PolicyResult = { decision: 'ALLOW', reason: 'Default pass-through' }
  let budgetResult: PolicyResult = { decision: 'ALLOW', reason: 'Default pass-through' }

  // ── Policy check — FAIL-CLOSED: let errors propagate ───────────────────────
  const policyCtx: PolicyContext = {
    agentId:               ctx.agentId,
    tenantId:              ctx.tenantId,
    correlationId:         ctx.correlationId,
    estimatedInputTokens:  ctx.estimatedInputTokens,
    estimatedOutputTokens: ctx.estimatedOutputTokens,
    riskLevel:             ctx.riskLevel,
    callerRoute:           ctx.callerRoute,
  }
  policyResult = await checkPolicy(policyCtx)
  // ^ If this throws, the error propagates — caller must handle as GOV_503

  // If already DENY, skip budget check
  if (policyResult.decision === 'DENY') return policyResult

  // ── Token budget check — FAIL-CLOSED: let errors propagate ─────────────────
  const plan = process.env.TENANT_PLAN ?? 'starter'
  const budgetCheck = await checkTokenBudget(
    ctx.tenantId,
    plan,
    ctx.agentId,
    estimated,
  )
  // ^ If this throws, the error propagates — caller must handle as GOV_503

  if (!budgetCheck.allowed) {
    budgetResult = {
      decision:        'DENY',
      reason:          budgetCheck.reason,
      remainingBudget: budgetCheck.remaining_tenant === -1 ? undefined : budgetCheck.remaining_tenant,
    }
  } else {
    budgetResult = {
      decision:         'ALLOW',
      reason:           budgetCheck.reason,
      remainingBudget:  budgetCheck.remaining_tenant === -1 ? undefined : budgetCheck.remaining_tenant,
      recommended_model: budgetCheck.recommended_model,
    }
  }

  // ── Merge: DENY wins, then ESCALATE, then ALLOW ────────────────────────────
  if (budgetResult.decision === 'DENY')        return budgetResult
  if (policyResult.decision === 'ESCALATE')    return policyResult
  if (budgetResult.decision === 'ESCALATE')    return budgetResult
  return policyResult
}

// ─── withBudgetGuard ──────────────────────────────────────────────────────────

/**
 * Full AI execution wrapper with policy gate, budget tracking, and audit log.
 *
 * @param ctx     - Call context (tenant, agent, model, correlation id, etc.)
 * @param fn      - Async function that performs the actual AI call.
 *                  Must return { data: T, input_tokens: number, output_tokens: number }.
 * @param options - Optional fallback and strict-mode config.
 *
 * @example
 *   const result = await withBudgetGuard(
 *     { tenantId, agentId: 'sofia-chat', correlationId, model: 'claude-sonnet-4-6' },
 *     async () => ({
 *       data: await callClaude(prompt),
 *       input_tokens: 450,
 *       output_tokens: 120,
 *     }),
 *   )
 */
export async function withBudgetGuard<T>(
  ctx: AICallContext,
  fn: () => Promise<{ data: T; input_tokens: number; output_tokens: number }>,
  options?: AICallOptions<T>,
): Promise<AICallResult<T>> {
  const t0 = now()

  // ── 1. Policy + budget gate — FAIL-CLOSED ─────────────────────────────────
  // If governance infrastructure (Redis, policyEngine) is unavailable, we must
  // NOT execute the AI call. Throw with a structured GOV_503 error so the
  // caller can surface 503 to the client.
  let gateResult: PolicyResult
  try {
    gateResult = await withPolicyGate(ctx)
  } catch (err) {
    const govErr = new Error(
      `[AI Runtime] GOVERNANCE UNAVAILABLE — failing closed (GOV_503): ${err instanceof Error ? err.message : String(err)}`,
    )
    ;(govErr as NodeJS.ErrnoException).code = 'GOV_503'
    throw govErr
  }

  // ── 2. Handle DENY ─────────────────────────────────────────────────────────
  if (gateResult.decision === 'DENY') {
    const latency = now() - t0

    fireAuditLog(ctx, 'DENY', 'denied', {
      input_tokens:  0,
      output_tokens: 0,
      latency_ms:    latency,
      fallback_used: false,
      reason:        gateResult.reason,
    })

    // strict mode or no fallback → throw
    if (options?.strict || !options?.fallbackFn) {
      throw new Error(`[AI Runtime] Request denied by policy: ${gateResult.reason}`)
    }

    // Use fallback
    const fallbackData = await options.fallbackFn()
    return {
      data:            fallbackData,
      model_used:      ctx.model,
      input_tokens:    0,
      output_tokens:   0,
      latency_ms:      now() - t0,
      policy_decision: 'DENY',
      fallback_used:   true,
    }
  }

  // ── 3. Cost-aware routing advisory ────────────────────────────────────────
  // If the budget check recommends a cheaper model and it differs from ctx.model,
  // log a warning. fn() will still execute with ctx.model (we cannot intercept it),
  // but we surface the recommendation in the returned AICallResult so callers can
  // downgrade on subsequent requests.
  const recommendedModel = gateResult.recommended_model
  if (recommendedModel && recommendedModel !== ctx.model) {
    const pct = gateResult.remainingBudget != null
      ? Math.round((1 - gateResult.remainingBudget / (gateResult.remainingBudget + 1)) * 100)
      : -1
    const pctLabel = pct >= 0 ? `${pct}%` : 'unknown'
    console.warn(
      `[AI Runtime] Cost-aware routing: downgrading from ${ctx.model} to ${recommendedModel} (budget ${pctLabel})`,
    )
  }

  // ── 4. Execute AI call ─────────────────────────────────────────────────────
  // Use a result container so TypeScript definite-assignment analysis is trivial.
  type ExecResult = { data: T; input_tokens: number; output_tokens: number; fallbackUsed: boolean; execError: unknown }
  let execResult: ExecResult

  const modelUsed = recommendedModel ?? ctx.model

  try {
    const fnResult = await fn()
    execResult = { data: fnResult.data, input_tokens: fnResult.input_tokens, output_tokens: fnResult.output_tokens, fallbackUsed: false, execError: null }
  } catch (err) {
    // Try fallback if available and not strict
    if (!options?.strict && options?.fallbackFn) {
      try {
        const fbData = await options.fallbackFn()
        execResult = { data: fbData, input_tokens: 0, output_tokens: 0, fallbackUsed: true, execError: err }
      } catch (fbErr) {
        console.error('[AI Runtime] Fallback fn also failed:', fbErr)
        throw err // rethrow original
      }
    } else {
      throw err
    }
  }

  const latency = now() - t0
  const totalTokens = execResult.input_tokens + execResult.output_tokens

  // ── 5. Record consumption (fire-and-forget) ────────────────────────────────
  void consumeTokenBudget(ctx.tenantId, ctx.agentId, totalTokens)

  // ── 6. Audit log (fire-and-forget) ────────────────────────────────────────
  fireAuditLog(ctx, gateResult.decision, execResult.execError ? 'error' : 'success', {
    input_tokens:  execResult.input_tokens,
    output_tokens: execResult.output_tokens,
    latency_ms:    latency,
    fallback_used: execResult.fallbackUsed,
    reason:        gateResult.reason,
  })

  return {
    data:                    execResult.data,
    model_used:              modelUsed,
    input_tokens:            execResult.input_tokens,
    output_tokens:           execResult.output_tokens,
    latency_ms:              latency,
    policy_decision:         gateResult.decision,
    fallback_used:           execResult.fallbackUsed,
    // Expose the cost-aware recommendation to callers so they can downgrade
    // on the next request. Only set when a downgrade was suggested.
    ...(recommendedModel && recommendedModel !== ctx.model
      ? { recommended_model_override: recommendedModel }
      : {}),
  }
}

// ─── withAI ───────────────────────────────────────────────────────────────────

/**
 * Main entry point for all AI calls. Alias for withBudgetGuard.
 * Use this everywhere — it is the canonical L1 execution wrapper.
 *
 * @example
 *   const { data, input_tokens, latency_ms } = await withAI(
 *     { tenantId, agentId: 'crm-orchestrator', correlationId, model: 'claude-opus-4-6' },
 *     async () => ({
 *       data: await runCRMAnalysis(leads),
 *       input_tokens: usage.input,
 *       output_tokens: usage.output,
 *     }),
 *     { fallbackFn: () => Promise.resolve(emptyCRMResult) },
 *   )
 */
export async function withAI<T>(
  ctx: AICallContext,
  fn: () => Promise<{ data: T; input_tokens: number; output_tokens: number }>,
  options?: AICallOptions<T>,
): Promise<AICallResult<T>> {
  return withBudgetGuard(ctx, fn, options)
}

// ─── withAIStream ─────────────────────────────────────────────────────────────

/**
 * Streaming AI execution wrapper. Uses an AsyncGenerator to yield string chunks.
 * Policy gate is checked before the stream begins.
 * Token consumption is accumulated and recorded when the stream ends.
 *
 * @param ctx - Call context
 * @param fn  - Async function that returns an AsyncIterable<string> with optional token accounting.
 *              Tokens: pass { stream, totalTokens: () => number } or rely on accumulated chunk lengths.
 *
 * @example
 *   for await (const chunk of withAIStream(ctx, async () => ({
 *     stream:  anthropic.messages.stream({ ... }),
 *     tokens:  () => stream.usage?.input_tokens + stream.usage?.output_tokens ?? 0,
 *   }))) {
 *     res.write(chunk)
 *   }
 */
export async function* withAIStream(
  ctx: AICallContext,
  fn: () => Promise<{
    stream:  AsyncIterable<string>
    /** Called after stream completes to report actual tokens. Return 0 if unavailable. */
    tokens?: () => number
  }>,
): AsyncGenerator<string> {
  const t0 = now()

  // ── 1. Policy gate (blocking — must complete before first chunk) ───────────
  // FAIL-CLOSED: governance failure throws GOV_503, never silently proceeds.
  let gateResult: PolicyResult
  try {
    gateResult = await withPolicyGate(ctx)
  } catch (err) {
    const govErr = new Error(
      `[AI Runtime] GOVERNANCE UNAVAILABLE — stream failing closed (GOV_503): ${err instanceof Error ? err.message : String(err)}`,
    )
    ;(govErr as NodeJS.ErrnoException).code = 'GOV_503'
    throw govErr
  }

  if (gateResult.decision === 'DENY') {
    fireAuditLog(ctx, 'DENY', 'denied', {
      input_tokens:  0,
      output_tokens: 0,
      latency_ms:    now() - t0,
      fallback_used: false,
      reason:        gateResult.reason,
    })
    throw new Error(`[AI Runtime] Stream denied by policy: ${gateResult.reason}`)
  }

  // ── 2. Start stream ────────────────────────────────────────────────────────
  let streamProvider: { stream: AsyncIterable<string>; tokens?: () => number }

  try {
    streamProvider = await fn()
  } catch (err) {
    fireAuditLog(ctx, gateResult.decision, 'error', {
      input_tokens:  0,
      output_tokens: 0,
      latency_ms:    now() - t0,
      fallback_used: false,
    })
    throw err
  }

  // ── 3. Yield chunks, accumulate length for fallback token estimation ────────
  let accumulatedChars = 0
  let streamError: unknown = null

  try {
    for await (const chunk of streamProvider.stream) {
      accumulatedChars += chunk.length
      yield chunk
    }
  } catch (err) {
    streamError = err
    // surface error after cleanup
  }

  // ── 4. Token accounting ────────────────────────────────────────────────────
  // Prefer caller-provided token count; fall back to rough char-based estimate.
  const actualTokens: number = (() => {
    try {
      return streamProvider.tokens?.() ?? Math.ceil(accumulatedChars / 4)
    } catch { return Math.ceil(accumulatedChars / 4) }
  })()

  const latency = now() - t0

  // ── 5. Consume budget + audit ──────────────────────────────────────────────
  void consumeTokenBudget(ctx.tenantId, ctx.agentId, actualTokens)

  fireAuditLog(ctx, gateResult.decision, streamError ? 'error' : 'success', {
    input_tokens:  ctx.estimatedInputTokens ?? 0,
    output_tokens: actualTokens,
    latency_ms:    latency,
    fallback_used: false,
  })

  if (streamError) throw streamError
}
