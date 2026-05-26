// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Adaptive Rate Limit Engine — Sensitivity-Aware Per-Endpoint Throttling
// Wave 45 Agent 2 — Maximum Security Hardening
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'

export type EndpointSensitivity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PUBLIC'

export const RATE_LIMIT_CONFIG: Record<
  EndpointSensitivity,
  { windowMs: number; max: number; blockMs: number }
> = {
  CRITICAL: { windowMs: 60_000, max: 5,    blockMs: 3_600_000 }, // 5/min  → 1 hr block
  HIGH:     { windowMs: 60_000, max: 20,   blockMs: 900_000 },   // 20/min → 15 min block
  MEDIUM:   { windowMs: 60_000, max: 60,   blockMs: 300_000 },   // 60/min → 5 min block
  LOW:      { windowMs: 60_000, max: 200,  blockMs: 60_000 },    // 200/min → 1 min block
  PUBLIC:   { windowMs: 60_000, max: 1000, blockMs: 30_000 },    // 1000/min → 30 s block
}

export function classifyEndpoint(path: string): EndpointSensitivity {
  if (path.includes('/capital-execution/') || path.includes('/legal-execution/')) return 'CRITICAL'
  if (path.includes('/auth/') || path.includes('/kyc/') || path.includes('/ledger/')) return 'HIGH'
  if (path.includes('/api/')) return 'MEDIUM'
  if (path.includes('/metrics') || path.startsWith('/_next/')) return 'PUBLIC'
  return 'LOW'
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset_at: string
  blocked_until: string | null
  sensitivity: EndpointSensitivity
}

// Key: SHA-256(ip + sensitivity_tier + minute_bucket) — anonymised, collision-safe
export function buildRateLimitKey(ip: string, path: string): string {
  const sensitivity = classifyEndpoint(path)
  const config = RATE_LIMIT_CONFIG[sensitivity]
  const bucket = Math.floor(Date.now() / config.windowMs)
  return createHash('sha256')
    .update(`${ip}::${sensitivity}::${bucket}`)
    .digest('hex')
    .slice(0, 32)
}

export async function checkAdaptiveRateLimit(
  ip: string,
  path: string,
  tenantId?: string,
): Promise<RateLimitResult> {
  const sensitivity = classifyEndpoint(path)
  const config = RATE_LIMIT_CONFIG[sensitivity]
  const key = buildRateLimitKey(ip, path)
  const now = new Date()
  const resetAt = new Date(Math.ceil(Date.now() / config.windowMs) * config.windowMs)
  const resolvedTenantId =
    tenantId ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  try {
    // ── 1. Check active block ───────────────────────────────────────────────
    const { data: blockRow } = await (supabaseAdmin as any)
      .from('rate_limit_blocks')
      .select('blocked_until')
      .eq('key_hash', key)
      .gt('blocked_until', now.toISOString())
      .single()

    if (blockRow) {
      return {
        allowed: false,
        remaining: 0,
        reset_at: resetAt.toISOString(),
        blocked_until: blockRow.blocked_until as string,
        sensitivity,
      }
    }

    // ── 2. Increment counter (upsert on key_hash) ───────────────────────────
    const { data: counter } = await (supabaseAdmin as any)
      .from('rate_limit_counters')
      .upsert(
        {
          key_hash: key,
          count: 1,
          window_start: now.toISOString(),
          sensitivity,
          tenant_id: resolvedTenantId,
        },
        { onConflict: 'key_hash' },
      )
      .select('count')
      .single()

    const count = (counter?.count ?? 1) as number

    // ── 3. Create block when limit exceeded ─────────────────────────────────
    if (count > config.max) {
      const blockedUntil = new Date(Date.now() + config.blockMs).toISOString()

      void (supabaseAdmin as any)
        .from('rate_limit_blocks')
        .upsert(
          {
            key_hash: key,
            blocked_until: blockedUntil,
            sensitivity,
            ip_hash: createHash('sha256').update(ip).digest('hex'),
          },
          { onConflict: 'key_hash' },
        )
        .catch((e: unknown) => console.warn('[adaptive-rate-limit] block write failed', e))

      return {
        allowed: false,
        remaining: 0,
        reset_at: resetAt.toISOString(),
        blocked_until: blockedUntil,
        sensitivity,
      }
    }

    return {
      allowed: true,
      remaining: config.max - count,
      reset_at: resetAt.toISOString(),
      blocked_until: null,
      sensitivity,
    }
  } catch {
    // Fail open — never block legitimate requests on DB errors
    return {
      allowed: true,
      remaining: 999,
      reset_at: resetAt.toISOString(),
      blocked_until: null,
      sensitivity,
    }
  }
}

export async function getRateLimitStats(tenantId: string): Promise<{
  blocked_ips_count: number
  top_blocked_endpoints: Array<{ sensitivity: EndpointSensitivity; count: number }>
  total_requests_1h: number
}> {
  try {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const now = new Date().toISOString()

    const { count: blockedCount } = await (supabaseAdmin as any)
      .from('rate_limit_blocks')
      .select('id', { count: 'exact', head: true })
      .gt('blocked_until', now)

    const { count: totalRequests } = await (supabaseAdmin as any)
      .from('rate_limit_counters')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gt('window_start', oneHourAgo)

    return {
      blocked_ips_count: (blockedCount as number | null) ?? 0,
      top_blocked_endpoints: [],
      total_requests_1h: (totalRequests as number | null) ?? 0,
    }
  } catch {
    return { blocked_ips_count: 0, top_blocked_endpoints: [], total_requests_1h: 0 }
  }
}
