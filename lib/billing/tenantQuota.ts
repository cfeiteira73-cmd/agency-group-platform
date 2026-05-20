// =============================================================================
// Agency Group — Tenant Quota Engine
// lib/billing/tenantQuota.ts
// Tracks and enforces per-tenant resource limits.
// Redis-backed. Fail-open if Redis unavailable.
// TypeScript strict — 0 errors
// =============================================================================

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export interface TenantPlan {
  planId: 'starter' | 'growth' | 'enterprise' | 'unlimited'
  monthlyAiTokens: number
  monthlyApiCalls: number
  maxActiveAgents: number
  maxCrmContacts: number
  replayEnabled: boolean
  automationRuns: number
}

export const PLANS: Record<TenantPlan['planId'], TenantPlan> = {
  starter: {
    planId:           'starter',
    monthlyAiTokens:  500_000,
    monthlyApiCalls:  5_000,
    maxActiveAgents:  2,
    maxCrmContacts:   200,
    replayEnabled:    false,
    automationRuns:   100,
  },
  growth: {
    planId:           'growth',
    monthlyAiTokens:  2_000_000,
    monthlyApiCalls:  20_000,
    maxActiveAgents:  5,
    maxCrmContacts:   2_000,
    replayEnabled:    true,
    automationRuns:   1_000,
  },
  enterprise: {
    planId:           'enterprise',
    monthlyAiTokens:  10_000_000,
    monthlyApiCalls:  100_000,
    maxActiveAgents:  20,
    maxCrmContacts:   10_000,
    replayEnabled:    true,
    automationRuns:   10_000,
  },
  unlimited: {
    planId:           'unlimited',
    monthlyAiTokens:  Infinity,
    monthlyApiCalls:  Infinity,
    maxActiveAgents:  Infinity,
    maxCrmContacts:   Infinity,
    replayEnabled:    true,
    automationRuns:   Infinity,
  },
}

// ---------------------------------------------------------------------------
// Quota status
// ---------------------------------------------------------------------------

export interface QuotaStatus {
  allowed: boolean
  used: number
  limit: number
  percentUsed: number
  warningLevel: 'ok' | 'warning' | 'critical' | 'blocked'
}

// ---------------------------------------------------------------------------
// Internal: resource → plan field mapping
// ---------------------------------------------------------------------------

type QuotaResource = 'ai_tokens' | 'api_calls' | 'automation_runs'

function getPlanLimit(plan: TenantPlan, resource: QuotaResource): number {
  switch (resource) {
    case 'ai_tokens':      return plan.monthlyAiTokens
    case 'api_calls':      return plan.monthlyApiCalls
    case 'automation_runs': return plan.automationRuns
  }
}

function getWarningLevel(percentUsed: number): QuotaStatus['warningLevel'] {
  if (percentUsed >= 100) return 'blocked'
  if (percentUsed >= 95)  return 'critical'
  if (percentUsed >= 80)  return 'warning'
  return 'ok'
}

// ---------------------------------------------------------------------------
// Internal: Upstash REST pipeline
// ---------------------------------------------------------------------------

async function upstashCmd(commands: Array<[string, ...string[]]>): Promise<Array<unknown>> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash not configured')

  const res = await fetch(`${url}/pipeline`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })

  if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`)
  const json = (await res.json()) as Array<{ result: unknown }>
  return json.map(r => r.result)
}

// ---------------------------------------------------------------------------
// Internal: current month key suffix YYYY-MM
// ---------------------------------------------------------------------------

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function redisKey(tenantId: string, resource: QuotaResource, month?: string): string {
  return `quota:${tenantId}:${resource}:${month ?? currentMonth()}`
}

// ---------------------------------------------------------------------------
// Fail-open sentinel
// ---------------------------------------------------------------------------

function failOpenStatus(limit: number): QuotaStatus {
  return { allowed: true, used: 0, limit, percentUsed: 0, warningLevel: 'ok' }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a tenant has quota remaining for a given resource.
 * Fails open if Redis is unavailable.
 */
export async function checkQuota(
  tenantId: string,
  planId: TenantPlan['planId'],
  resource: QuotaResource,
  amount = 1,
): Promise<QuotaStatus> {
  const plan  = PLANS[planId]
  const limit = getPlanLimit(plan, resource)

  // Unlimited plan — always allow
  if (!isFinite(limit)) {
    return { allowed: true, used: 0, limit: Infinity, percentUsed: 0, warningLevel: 'ok' }
  }

  try {
    const key     = redisKey(tenantId, resource)
    const results = await upstashCmd([['GET', key]])
    const used    = parseInt(String(results[0] ?? '0'), 10) || 0
    const wouldUse = used + amount
    const percentUsed = Math.round((wouldUse / limit) * 100)

    return {
      allowed:      wouldUse <= limit,
      used,
      limit,
      percentUsed,
      warningLevel: getWarningLevel(percentUsed),
    }
  } catch {
    // Fail-open — Redis unavailable
    console.warn(`[tenantQuota] Redis unavailable — failing open for ${tenantId}:${resource}`)
    return failOpenStatus(limit)
  }
}

/**
 * Increment a tenant's usage counter in Redis.
 * TTL is set to 31 days (NX — only on first write).
 * Fails silently if Redis is unavailable.
 */
export async function incrementQuota(
  tenantId: string,
  resource: QuotaResource,
  amount: number,
): Promise<void> {
  try {
    const key = redisKey(tenantId, resource)
    await upstashCmd([
      ['INCRBY', key, String(amount)],
      ['EXPIRE', key, String(31 * 24 * 60 * 60), 'NX'],
    ])
  } catch {
    console.warn(`[tenantQuota] Failed to increment quota for ${tenantId}:${resource}`)
  }
}

/**
 * Returns a summary of all quota resources for a tenant.
 */
export async function getQuotaSummary(
  tenantId: string,
  planId: TenantPlan['planId'],
): Promise<Record<string, QuotaStatus>> {
  const resources: QuotaResource[] = ['ai_tokens', 'api_calls', 'automation_runs']
  const entries = await Promise.all(
    resources.map(async resource => {
      const status = await checkQuota(tenantId, planId, resource, 0)
      return [resource, status] as const
    }),
  )
  return Object.fromEntries(entries)
}
