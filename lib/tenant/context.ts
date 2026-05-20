// =============================================================================
// Agency Group — Tenant Context Envelope
// lib/tenant/context.ts
//
// Resolves the full TenantContext from a Next.js request.
// The context is the canonical "who is this request for, what can they do?"
// envelope. Every API handler that needs tenant/user info should call
// resolveTenantContext(req) at the top.
//
// Propagation chain:
//   JWT claim → x-tenant-id header (injected by middleware.ts)
//   → resolveTenantContext() → TenantContext object
//   → passed into EventBus, AI calls, Supabase queries, audit log
//
// Design rules:
//   - Fail-open: if resolution fails → default 'agency-group' context
//   - Never throws — always returns a context (may be default)
//   - Redis-cached (5 min TTL) for tenant plan/status lookups
//
// TypeScript strict — 0 errors
// =============================================================================

import type { NextRequest } from 'next/server'

// ─── TenantContext type ───────────────────────────────────────────────────────

export type TenantPlanId = 'starter' | 'growth' | 'enterprise' | 'unlimited'
export type TenantStatus = 'active' | 'suspended' | 'cancelled'
export type TenantRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'ANALYST' | 'SYSTEM' | 'AI_AGENT'

export interface TenantContext {
  tenant_id:      string
  user_id?:       string
  user_email?:    string
  role:           TenantRole
  plan:           TenantPlanId
  status:         TenantStatus
  correlation_id: string
  trace_id:       string
  // Quota snapshot — injected from Redis when available
  quota?: {
    ai_tokens_used:   number
    api_calls_used:   number
    ai_tokens_limit:  number
    api_calls_limit:  number
    quota_breach:     boolean
  }
}

// ─── Default (fail-open) context for agency-group tenant ─────────────────────

const DEFAULT_CONTEXT: Readonly<TenantContext> = {
  tenant_id:      'agency-group',
  role:           'SYSTEM',
  plan:           'unlimited',
  status:         'active',
  correlation_id: 'unknown',
  trace_id:       'unknown',
}

// ─── Redis helpers (Upstash — Edge-compatible) ───────────────────────────────

async function redisGet(key: string): Promise<string | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(300),  // 300ms max — never block requests
    })
    if (!res.ok) return null
    const { result } = await res.json() as { result: string | null }
    return result
  } catch { return null }
}

async function redisSet(key: string, value: string, exSeconds: number): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/EX/${exSeconds}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(300),
    })
  } catch { /* non-blocking */ }
}

// ─── Tenant plan lookup (Supabase + Redis cache) ──────────────────────────────

interface TenantRecord {
  slug:    string
  plan:    TenantPlanId
  status:  TenantStatus
  name:    string
}

async function lookupTenantRecord(tenantId: string): Promise<TenantRecord | null> {
  const cacheKey = `tenant:record:${tenantId}`

  // Try Redis cache first
  const cached = await redisGet(cacheKey)
  if (cached) {
    try { return JSON.parse(cached) as TenantRecord } catch { /* parse error */ }
  }

  // Supabase lookup
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  try {
    const res = await fetch(
      `${url}/rest/v1/tenants?slug=eq.${encodeURIComponent(tenantId)}&select=slug,plan,status,name&limit=1`,
      {
        headers: {
          apikey:        key,
          Authorization: `Bearer ${key}`,
          Accept:        'application/json',
        },
        signal: AbortSignal.timeout(500),
      }
    )
    if (!res.ok) return null
    const rows = await res.json() as TenantRecord[]
    if (!rows.length) return null
    const record = rows[0]
    // Cache for 5 minutes
    void redisSet(cacheKey, JSON.stringify(record), 300)
    return record
  } catch { return null }
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolves the full TenantContext from a NextRequest.
 * Reads: x-tenant-id, x-correlation-id, Authorization header.
 * Falls back to DEFAULT_CONTEXT if anything fails.
 *
 * @example
 *   export async function POST(req: NextRequest) {
 *     const ctx = await resolveTenantContext(req)
 *     // ctx.tenant_id, ctx.plan, ctx.role, ctx.correlation_id
 *   }
 */
export async function resolveTenantContext(req: NextRequest): Promise<TenantContext> {
  const tenantId      = req.headers.get('x-tenant-id')      ?? 'agency-group'
  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID()
  const traceId       = req.headers.get('x-trace-id')        ?? correlationId

  // Extract user info from Authorization header (Bearer JWT) if present
  let userId: string | undefined
  let userEmail: string | undefined
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7)
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
        userId    = payload.sub as string | undefined
        userEmail = payload.email as string | undefined
      }
    } catch { /* non-blocking */ }
  }

  // Look up tenant record (cached)
  const record = await lookupTenantRecord(tenantId).catch(() => null)

  // agency-group is always unlimited/active (single-tenant bootstrap)
  const plan: TenantPlanId   = tenantId === 'agency-group' ? 'unlimited' : (record?.plan   ?? 'starter')
  const status: TenantStatus = tenantId === 'agency-group' ? 'active'    : (record?.status ?? 'active')

  return {
    tenant_id:      tenantId,
    user_id:        userId,
    user_email:     userEmail,
    role:           'SYSTEM',    // caller can override after RBAC check
    plan,
    status,
    correlation_id: correlationId,
    trace_id:       traceId,
  }
}

/**
 * Returns a minimal TenantContext without any async lookups.
 * Use in performance-critical paths where a full lookup isn't needed.
 */
export function buildMinimalContext(tenantId = 'agency-group', correlationId?: string): TenantContext {
  return {
    ...DEFAULT_CONTEXT,
    tenant_id:      tenantId,
    correlation_id: correlationId ?? crypto.randomUUID(),
    trace_id:       correlationId ?? crypto.randomUUID(),
  }
}
