// =============================================================================
// Agency Group — Self-Healing Batch Runner
// POST /api/remediation/batch
//
// Body: { tenant_id: string; limit?: number }
//
// Runs a healing cycle for all open incidents of a tenant (max 10).
// Returns all HealingCycleResult objects + aggregated summary.
//
// Auth : Bearer INTERNAL_API_SECRET | ADMIN_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }  from 'next/server'
import { runHealingBatch }             from '@/lib/remediation/selfHealingOrchestrator'
import { safeCompare }                 from '@/lib/safeCompare'
import { checkRateLimit }              from '@/lib/security/rateLimiter'
import { createHash }                  from 'crypto'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const auth     = req.headers.get('authorization') ?? ''
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && !!auth && safeCompare(auth, `Bearer ${internal}`)) return true
  if (admin    && !!auth && safeCompare(auth, `Bearer ${admin}`))    return true
  return false
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 5 requests per minute per token (sliding window)
  const token     = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 16)
  const rl    = await checkRateLimit(
    `ratelimit:remediation:batch:${tokenHash}`,
    5,
    60_000,
  )
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', reset_at: rl.reset_at },
      {
        status:  429,
        headers: { 'Retry-After': String(Math.ceil((rl.reset_at - Date.now()) / 1000)) },
      },
    )
  }

  let body: { tenant_id?: string }
  try {
    body = await req.json() as { tenant_id?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id } = body
  if (!tenant_id || typeof tenant_id !== 'string' || tenant_id.trim() === '') {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  const results = await runHealingBatch(tenant_id.trim())

  const healed    = results.filter((r) => r.healed).length
  const escalated = results.filter((r) => r.escalated).length
  const avgMs     = results.length > 0
    ? Math.round(results.reduce((a, r) => a + r.duration_ms, 0) / results.length)
    : 0

  return NextResponse.json({
    tenant_id:     tenant_id.trim(),
    ran_at:        new Date().toISOString(),
    cycles:        results.length,
    healed,
    escalated,
    avg_duration_ms: avgMs,
    heal_rate:     results.length > 0 ? Math.round((healed / results.length) * 1000) / 1000 : 0,
    results,
  })
}
