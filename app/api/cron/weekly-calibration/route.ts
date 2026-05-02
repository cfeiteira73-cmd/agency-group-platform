// GET /api/cron/weekly-calibration
// Weekly: recomputes calibration report and persists recommendations.
// Triggers alert if urgency_score > 60 or critical recommendations found.

import { NextRequest, NextResponse }   from 'next/server'
import { runWeeklyCalibration }        from '@/lib/intelligence/recalibrationEngine'
import { buildAlert, createAlert }     from '@/lib/ops/alertEngine'
import { withCronLock }                from '@/lib/ops/cronLock'
import { supabaseAdmin }               from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  // Guard: weekly calibration is expensive — prevent double-execution
  const lockResult = await withCronLock('weekly-calibration', 55, async () => {
    return await runWeeklyCalibration()
  })

  if (lockResult === null) {
    return NextResponse.json({ skipped: true, reason: 'lock_held — another instance running' })
  }

  try {
    const result = lockResult
    const durationMs = Date.now() - startedAt

    // Fire alert if urgency is high
    if (result.trigger.triggered && result.trigger.urgency !== 'normal') {
      const alert = buildAlert(
        'score_distribution_anomaly',
        `Calibration: ${result.trigger.urgency.toUpperCase()} urgency (score ${result.urgency_score}/100)`,
        result.trigger.reason ?? 'Calibration recommendations require review',
        {
          urgency_score:   result.urgency_score,
          critical_count:  result.trigger.critical_count,
          high_count:      result.trigger.high_count,
          persisted:       result.persisted,
        },
      )
      await createAlert(alert).catch(console.error)
    }

    // Log to automations_log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        automation_type: 'cron_weekly_calibration',
        outcome: {
          triggered:       result.trigger.triggered,
          urgency:         result.trigger.urgency,
          urgency_score:   result.urgency_score,
          persisted:       result.persisted,
          critical_count:  result.trigger.critical_count,
          high_count:      result.trigger.high_count,
          duration_ms:     durationMs,
        },
        properties_affected: result.persisted,
        ran_at: new Date().toISOString(),
      })

    return NextResponse.json({
      success:       true,
      triggered:     result.trigger.triggered,
      urgency:       result.trigger.urgency,
      urgency_score: result.urgency_score,
      persisted:     result.persisted,
      duration_ms:   durationMs,
    })
  } catch (err) {
    console.error('[weekly-calibration] fatal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
