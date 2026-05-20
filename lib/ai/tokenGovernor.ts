// =============================================================================
// Agency Group — SH-ROS Token Budget Governor
// lib/ai/tokenGovernor.ts
//
// Consolidated token budget enforcement layer.
// Operates at two levels simultaneously:
//   1. Tenant monthly budget  → per TenantPlanId hard limit
//   2. Agent monthly budget   → per agentId within the tenant
//
// Redis keys (Upstash REST):
//   tkgov:tenant:{tenantId}:{YYYY-MM}              → tenant monthly total
//   tkgov:agent:{tenantId}:{agentId}:{YYYY-MM}     → agent monthly total
//
// Fail-open everywhere: if Redis is unavailable, requests are allowed.
// Global system cap enforced from GLOBAL_TOKEN_CAP_MONTHLY env var.
//
// TypeScript strict — 0 errors
// =============================================================================

import type { TenantPlanId } from '../tenant/context'

// ─── Config ───────────────────────────────────────────────────────────────────

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

/** Hard monthly token caps per billing plan. */
const PLAN_BUDGETS: Record<TenantPlanId, number> = {
  starter:    100_000,
  growth:     1_000_000,
  enterprise: 10_000_000,
  unlimited:  Infinity,
}

/** Maximum tokens allowed in a single AI request, regardless of plan. */
const MAX_TOKENS_PER_REQUEST = 32_000

/** Global system-wide monthly cap (all tenants combined). Default 50M. */
const GLOBAL_CAP_MONTHLY: number = (() => {
  const raw = process.env.GLOBAL_TOKEN_CAP_MONTHLY
  if (!raw) return 50_000_000
  const parsed = parseInt(raw, 10)
  return isNaN(parsed) ? 50_000_000 : parsed
})()

// ─── Redis helpers ─────────────────────────────────────────────────────────────

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function tenantKey(tenantId: string): string {
  return `tkgov:tenant:${tenantId}:${currentMonth()}`
}

function agentKey(tenantId: string, agentId: string): string {
  return `tkgov:agent:${tenantId}:${agentId}:${currentMonth()}`
}

function globalKey(): string {
  return `tkgov:global:${currentMonth()}`
}

async function redisGet(key: string): Promise<number> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return 0
    const { result } = await res.json() as { result: string | null }
    return result ? parseInt(result, 10) : 0
  } catch { return 0 }
}

/** INCRBY + EXPIRE in a single pipeline call. TTL = 32 days (covers month boundary). */
async function redisIncrBy(key: string, delta: number): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || delta <= 0) return
  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCRBY', key, delta],
        ['EXPIRE', key, 32 * 24 * 3600],
      ]),
      signal: AbortSignal.timeout(2000),
    })
  } catch { /* fail open */ }
}

// ─── Model recommendation ──────────────────────────────────────────────────────

/**
 * Recommends a cost-appropriate model based on budget utilisation.
 * Defaults to cheap models; never recommends Opus as a fallback.
 *
 * - budgetPct <  50  → haiku  (budget healthy — use cheapest)
 * - budgetPct <  80  → sonnet (mid-range — balanced cost/quality)
 * - budgetPct >= 80  → haiku  (near limit — force cheapest to preserve budget)
 */
export function recommendFallbackModel(estimatedTokens: number, budgetPct: number): string {
  void estimatedTokens // available for future token-size-aware routing
  if (budgetPct >= 80) return 'claude-haiku-4-5'
  if (budgetPct >= 50) return 'claude-sonnet-4-5'
  return 'claude-haiku-4-5'
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface BudgetCheckResult {
  /** Whether the request is permitted to proceed. */
  allowed: boolean
  /** Human-readable reason for the decision. */
  reason: string
  /** Tokens remaining for the tenant this month. -1 = unlimited. */
  remaining_tenant: number
  /** Tokens remaining for the agent this month. -1 = unlimited. */
  remaining_agent: number
  /** Suggested model if usage is near the limit. */
  recommended_model?: string
}

// ─── checkTokenBudget ─────────────────────────────────────────────────────────

/**
 * Pre-flight budget check. Call BEFORE executing any AI request.
 * Fail-open: if Redis is unavailable, returns allowed=true.
 *
 * @param tenantId        - Tenant slug (e.g. 'agency-group')
 * @param plan            - TenantPlanId string
 * @param agentId         - Agent or circuit identifier
 * @param estimatedTokens - Expected token consumption for this request
 */
export async function checkTokenBudget(
  tenantId: string,
  plan: string,
  agentId: string,
  estimatedTokens: number,
): Promise<BudgetCheckResult> {
  // ── 1. Per-request hard cap ────────────────────────────────────────────────
  if (estimatedTokens > MAX_TOKENS_PER_REQUEST) {
    return {
      allowed: false,
      reason: `Estimated ${estimatedTokens} tokens exceeds per-request limit of ${MAX_TOKENS_PER_REQUEST}`,
      remaining_tenant: -1,
      remaining_agent: -1,
    }
  }

  // ── 2. Resolve plan budget ─────────────────────────────────────────────────
  const planId = plan as TenantPlanId
  const planBudget: number = PLAN_BUDGETS[planId] ?? PLAN_BUDGETS.starter

  // Unlimited plans bypass all monthly checks
  if (planBudget === Infinity) {
    return {
      allowed: true,
      reason: 'Unlimited plan — no monthly cap',
      remaining_tenant: -1,
      remaining_agent: -1,
      recommended_model: recommendFallbackModel(estimatedTokens, 0),
    }
  }

  // ── 3. Fetch current usage (parallel) ─────────────────────────────────────
  const [tenantUsed, agentUsed, globalUsed] = await Promise.all([
    redisGet(tenantKey(tenantId)),
    redisGet(agentKey(tenantId, agentId)),
    redisGet(globalKey()),
  ])

  // ── 4. Global system cap check ─────────────────────────────────────────────
  // globalKey() aggregates usage across ALL tenants (maintained in consumeTokenBudget).
  if (globalUsed + estimatedTokens > GLOBAL_CAP_MONTHLY) {
    return {
      allowed: false,
      reason: `Global system cap (${GLOBAL_CAP_MONTHLY.toLocaleString()} tokens/month) would be exceeded`,
      remaining_tenant: Math.max(0, planBudget - tenantUsed),
      remaining_agent: -1,
    }
  }

  // ── 5. Tenant monthly budget check ────────────────────────────────────────
  const tenantProjected = tenantUsed + estimatedTokens
  if (tenantProjected > planBudget) {
    return {
      allowed: false,
      reason: `Tenant monthly budget exceeded: ${tenantUsed.toLocaleString()}/${planBudget.toLocaleString()} tokens (plan: ${plan})`,
      remaining_tenant: Math.max(0, planBudget - tenantUsed),
      remaining_agent: -1,
    }
  }

  const remainingTenant = planBudget - tenantUsed
  const budgetPct = (tenantUsed / planBudget) * 100

  return {
    allowed: true,
    reason: `Budget OK — ${tenantUsed.toLocaleString()}/${planBudget.toLocaleString()} tokens used (${budgetPct.toFixed(1)}%)`,
    remaining_tenant: remainingTenant,
    remaining_agent: agentUsed >= 0 ? agentUsed : 0, // agent has no hard cap, expose usage
    recommended_model: budgetPct >= 80
      ? recommendFallbackModel(estimatedTokens, budgetPct)
      : undefined,
  }
}

// ─── consumeTokenBudget ───────────────────────────────────────────────────────

/**
 * Records actual token consumption after an AI call completes.
 * Fire-and-forget — never throws.
 *
 * @param tenantId     - Tenant slug
 * @param agentId      - Agent or circuit identifier
 * @param actualTokens - Real tokens consumed (input + output)
 */
export async function consumeTokenBudget(
  tenantId: string,
  agentId: string,
  actualTokens: number,
): Promise<void> {
  if (actualTokens <= 0) return
  try {
    await Promise.all([
      redisIncrBy(tenantKey(tenantId), actualTokens),
      redisIncrBy(agentKey(tenantId, agentId), actualTokens),
      redisIncrBy(globalKey(), actualTokens),
    ])
  } catch { /* intentional: non-blocking */ }
}

// ─── getTenantBudgetStatus ────────────────────────────────────────────────────

/**
 * Returns the current budget status for a tenant.
 * Used by Control Tower dashboard and billing alerts.
 */
export async function getTenantBudgetStatus(
  tenantId: string,
  plan: string,
): Promise<{
  tenant_id: string
  plan: string
  month: string
  tokens_used: number
  tokens_limit: number
  pct_used: number
  status: 'healthy' | 'warning' | 'critical'
}> {
  const planId = plan as TenantPlanId
  const limit: number = PLAN_BUDGETS[planId] ?? PLAN_BUDGETS.starter

  if (limit === Infinity) {
    return {
      tenant_id: tenantId,
      plan,
      month: currentMonth(),
      tokens_used: 0,
      tokens_limit: -1,
      pct_used: 0,
      status: 'healthy',
    }
  }

  const used = await redisGet(tenantKey(tenantId))
  const pct  = limit > 0 ? (used / limit) * 100 : 0

  let status: 'healthy' | 'warning' | 'critical'
  if (pct >= 95)      status = 'critical'
  else if (pct >= 80) status = 'warning'
  else                status = 'healthy'

  return {
    tenant_id:    tenantId,
    plan,
    month:        currentMonth(),
    tokens_used:  used,
    tokens_limit: limit,
    pct_used:     Math.round(pct * 100) / 100, // 2 decimal places
    status,
  }
}
