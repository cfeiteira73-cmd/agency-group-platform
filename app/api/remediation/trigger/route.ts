// =============================================================================
// Agency Group — Self-Healing Trigger
// POST /api/remediation/trigger
//
// Body: { incident_id: string }
//
// Triggers a full healing cycle for the given incident.
// Returns the HealingCycleResult.
//
// Auth : Bearer INTERNAL_API_SECRET | ADMIN_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse }  from 'next/server'
import { runHealingCycle }             from '@/lib/remediation/selfHealingOrchestrator'
import { safeCompare }                 from '@/lib/safeCompare'
import { checkRateLimit }              from '@/lib/security/rateLimiter'
import { createHash }                  from 'crypto'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

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

  // Rate limit: 10 requests per minute per token (sliding window)
  const token     = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 16)
  const rl    = await checkRateLimit(
    `ratelimit:remediation:trigger:${tokenHash}`,
    10,
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

  let body: { incident_id?: string }
  try {
    body = await req.json() as { incident_id?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { incident_id } = body
  if (!incident_id || typeof incident_id !== 'string' || incident_id.trim() === '') {
    return NextResponse.json({ error: 'incident_id is required' }, { status: 400 })
  }

  const incidentId = incident_id.trim()

  // Idempotency lock: prevent concurrent healing cycles for the same incident
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (upstashUrl && upstashToken) {
    try {
      const lockKey = `remediation:inflight:${encodeURIComponent(incidentId)}`
      const setRes  = await fetch(`${upstashUrl}/set/${lockKey}/1/nx/ex/60`, {
        method:  'GET',
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal:  AbortSignal.timeout(2000),
      })
      if (setRes.ok) {
        const { result } = await setRes.json() as { result: string | null }
        if (result === null) {
          // SETNX returned null — key already exists, cycle is inflight
          return NextResponse.json(
            { error: 'Healing cycle already inflight for this incident', incident_id: incidentId },
            { status: 409 },
          )
        }
      }
    } catch { /* fail-open: if Redis is unavailable, allow the healing cycle */ }
  }

  const result = await runHealingCycle(incidentId)

  const status = result.stages.ingestion === 'failed' ? 404 : 200
  return NextResponse.json(result, { status })
}
