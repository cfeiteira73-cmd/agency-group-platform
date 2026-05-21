// Agency Group — Self-Healing Evaluation API
// app/api/sre/self-heal/route.ts
//
// POST /api/sre/self-heal
//   Body: { force?: boolean }
//   Runs deep health check, evaluates all healing rules, executes auto-severity rules.
//   Auth: CRON_SECRET or INTERNAL_API_TOKEN
//   Schedule: */5 * * * * (vercel.json cron)
//
// GET /api/sre/self-heal
//   Returns last 20 healing executions from DB.
//   Auth: CRON_SECRET or INTERNAL_API_TOKEN
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import { runDeepHealthCheck }        from '@/lib/sre/healthCheck'
import { selfHealingEngine }         from '@/lib/sre/selfHealingEngine'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 60

// ─── GET /api/sre/self-heal ───────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  try {
    const executions = await selfHealingEngine.getRecentExecutions(20)

    return NextResponse.json(
      {
        executions,
        count:       executions.length,
        computed_at: new Date().toISOString(),
      },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[GET /api/sre/self-heal]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST /api/sre/self-heal ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  // Parse body (may be empty for cron invocation)
  let force = false
  try {
    const body = await req.json() as { force?: boolean }
    force = body.force === true
  } catch {
    // empty body — fine
  }

  try {
    // 1. Run deep health check
    const health = await runDeepHealthCheck()

    // 2. Evaluate healing rules
    const executions = await selfHealingEngine.evaluate(health)

    // 3. Summarise
    const autoExecuted  = executions.filter(e => e.auto_executed)
    const awaitingConfirm = executions.filter(e => !e.auto_executed)

    return NextResponse.json(
      {
        executions,
        auto_executed_count:        autoExecuted.length,
        awaiting_confirmation_count: awaitingConfirm.length,
        health_status:              health.summary,
        health_failed:              health.failed,
        health_degraded:            health.degraded,
        forced:                     force,
        evaluated_at:               health.timestamp,
      },
      {
        status: 200,
        headers: { 'x-correlation-id': corrId },
      },
    )
  } catch (err) {
    console.error('[POST /api/sre/self-heal]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
