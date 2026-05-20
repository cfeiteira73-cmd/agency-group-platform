// lib/ai/policyEngine.ts
// AI Governance Policy Engine — enforces ALLOW/DENY/ESCALATE rules per agent.
// Tracks token budgets in Redis. Prevents policy violations before execution.

export type PolicyDecision = 'ALLOW' | 'DENY' | 'ESCALATE'

export interface PolicyContext {
  agentId: string
  tenantId: string
  correlationId: string
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  riskLevel?: string
  callerRoute?: string
}

export interface PolicyResult {
  decision: PolicyDecision
  reason: string
  remainingBudget?: number
  /** Cost-aware model recommendation from tokenGovernor. Optional — only set when budget utilisation warrants a downgrade. */
  recommended_model?: string
}

// ─── Redis token budget tracking ─────────────────────────────────────────────
// Key: agent:budget:{tenantId}:{agentId}:{YYYY-MM} → monthly token count
// Uses INCRBY to atomically increment, EXPIRE to auto-reset monthly

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function getBudgetKey(tenantId: string, agentId: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM
  return `agent:budget:${tenantId}:${agentId}:${month}`
}

async function getTokensUsed(tenantId: string, agentId: string): Promise<number> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0
  try {
    const key = await getBudgetKey(tenantId, agentId)
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return 0
    const { result } = await res.json() as { result: string | null }
    return result ? parseInt(result, 10) : 0
  } catch { return 0 }
}

export async function trackTokensUsed(
  tenantId: string,
  agentId: string,
  tokens: number
): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || tokens <= 0) return
  try {
    const key = await getBudgetKey(tenantId, agentId)
    // INCRBY + EXPIRE (31 days) in a pipeline
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCRBY', key, tokens],
        ['EXPIRE', key, 31 * 24 * 3600],
      ]),
      signal: AbortSignal.timeout(2000),
    })
  } catch { /* fail open — budget tracking is non-blocking */ }
}

// ─── Policy Rules ─────────────────────────────────────────────────────────────

export async function checkPolicy(ctx: PolicyContext): Promise<PolicyResult> {
  const { agentId, tenantId, riskLevel, estimatedInputTokens = 0, estimatedOutputTokens = 0 } = ctx

  // Rule 1: Look up agent config — fail-open for unknown ids
  // withAI() passes circuit names ('anthropic-opus', 'anthropic-haiku') as agentId;
  // named agents ('sofia-chat', 'crm-orchestrator') are registered explicitly.
  // Unknown ids are ALLOWED — budget / risk rules only apply to registered agents.
  const { AGENT_REGISTRY } = await import('./agentRegistry')
  const agent = AGENT_REGISTRY[agentId]
  if (!agent) {
    return { decision: 'ALLOW', reason: `Unregistered component — pass-through: ${agentId}` }
  }

  // Rule 2: ESCALATE critical risk in non-production
  if (agent.riskLevel === 'critical' && process.env.NODE_ENV !== 'production') {
    return { decision: 'ESCALATE', reason: 'Critical risk agent requires production environment' }
  }

  // Rule 3: Token budget enforcement
  if (agent.monthlyTokenBudget) {
    const used = await getTokensUsed(tenantId, agentId)
    const projected = used + estimatedInputTokens + estimatedOutputTokens
    if (projected > agent.monthlyTokenBudget) {
      return {
        decision: 'DENY',
        reason: `Monthly token budget exceeded: ${used}/${agent.monthlyTokenBudget}`,
        remainingBudget: Math.max(0, agent.monthlyTokenBudget - used),
      }
    }
    return {
      decision: 'ALLOW',
      reason: 'Within budget',
      remainingBudget: agent.monthlyTokenBudget - used,
    }
  }

  // Suppress unused parameter warning — riskLevel is available for future rules
  void riskLevel

  // Default: ALLOW
  return { decision: 'ALLOW', reason: 'No policy violations' }
}
