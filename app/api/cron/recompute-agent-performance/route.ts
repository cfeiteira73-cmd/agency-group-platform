// GET /api/cron/recompute-agent-performance
// Daily cron: recomputes execution scores for all agents with recent activity.
// Runs at 04:00 UTC — before AVM compute (07:00) and investor alerts (08:30).

import { NextRequest, NextResponse }              from 'next/server'
import { computeAndPersistAllAgentMetrics }       from '@/lib/intelligence/agentPerformance'
import { supabaseAdmin }                          from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret   = req.headers.get('authorization')?.replace('Bearer ', '')
  const cronExpected = process.env.CRON_SECRET
  if (!cronExpected || !cronSecret || cronSecret !== cronExpected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  try {
    // 90-day rolling window
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const result = await computeAndPersistAllAgentMetrics(since, '90d')

    const durationMs = Date.now() - startedAt

    // Log to automations_log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        automation_type: 'cron_agent_performance',
        outcome: {
          computed:    result.computed,
          errors:      result.errors.length,
          error_list:  result.errors.slice(0, 10),
          duration_ms: durationMs,
        },
        properties_affected: result.computed,
        ran_at: new Date().toISOString(),
      })
      .throwOnError()

    return NextResponse.json({
      success: true,
      computed:    result.computed,
      errors:      result.errors.length,
      duration_ms: durationMs,
      ...(result.errors.length > 0 && { error_sample: result.errors.slice(0, 5) }),
    })
  } catch (err) {
    console.error('[recompute-agent-performance] fatal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
