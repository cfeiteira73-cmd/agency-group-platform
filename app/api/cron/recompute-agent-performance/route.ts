// GET /api/cron/recompute-agent-performance
// Daily cron: recomputes execution scores for all agents with recent activity.
// Runs at 04:00 UTC — before AVM compute (07:00) and investor alerts (08:30).

import { NextRequest, NextResponse }              from 'next/server'
import { computeAndPersistAllAgentMetrics }       from '@/lib/intelligence/agentPerformance'
import { supabaseAdmin }                          from '@/lib/supabase'
import { withCronLock }                           from '@/lib/ops/withCronLock'
import { safeCompare }                            from '@/lib/safeCompare'
import { cronCorrelationId }                      from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret   = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  const cronExpected = process.env.CRON_SECRET
  if (!cronExpected || !cronSecret || !safeCompare(cronSecret, cronExpected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await withCronLock('recompute-agent-performance', 3, async () => {
    const corrId = cronCorrelationId('recompute-agent-performance')
    const startedAt = Date.now()

    try {
      // 90-day rolling window
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const computed = await computeAndPersistAllAgentMetrics(since, '90d')

      const durationMs = Date.now() - startedAt

      // Log to automations_log
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabaseAdmin
        .from('automations_log')
        .insert({
          automation_type: 'cron_agent_performance',
          outcome: {
            computed:    computed.computed,
            errors:      computed.errors.length,
            error_list:  computed.errors.slice(0, 10),
            duration_ms: durationMs,
          },
          properties_affected: computed.computed,
          ran_at: new Date().toISOString(),
        })
        .throwOnError()

      const res = NextResponse.json({
        success:        true,
        computed:       computed.computed,
        errors:         computed.errors.length,
        duration_ms:    durationMs,
        correlation_id: corrId,
        ...(computed.errors.length > 0 && { error_sample: computed.errors.slice(0, 5) }),
      })
      res.headers.set('x-correlation-id', corrId)
      return res
    } catch (err) {
      console.error('[recompute-agent-performance] fatal:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  })

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }
  return result
}
