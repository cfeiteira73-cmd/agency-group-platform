// GET /api/cron/update-partner-tiers
// Daily: recomputes ELITE/PRIORITY/STANDARD/WATCHLIST for all active partners.

import { NextRequest, NextResponse }         from 'next/server'
import { batchUpdateAllPartnerTiers }        from '@/lib/commercial/partnerTiering'
import { supabaseAdmin }                     from '@/lib/supabase'
import { withCronLock }                      from '@/lib/ops/cronLock'
import { safeCompare }                       from '@/lib/safeCompare'
import { cronCorrelationId }                 from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret   = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  const cronExpected = process.env.CRON_SECRET
  if (!cronExpected || !cronSecret || !safeCompare(cronSecret, cronExpected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await withCronLock('update-partner-tiers', 3, async () => {
    const corrId    = cronCorrelationId('update-partner-tiers')
    const startedAt = Date.now()

    try {
      const tiers    = await batchUpdateAllPartnerTiers()
      const durationMs = Date.now() - startedAt

      // Log to automations_log
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabaseAdmin
        .from('automations_log')
        .insert({
          automation_type:     'cron_update_partner_tiers',
          outcome: {
            agents:      tiers.agents,
            investors:   tiers.investors,
            errors:      tiers.errors.length,
            error_list:  tiers.errors.slice(0, 10),
            duration_ms: durationMs,
          },
          properties_affected: tiers.agents + tiers.investors,
          ran_at: new Date().toISOString(),
        })

      const res = NextResponse.json({
        success:        true,
        agents:         tiers.agents,
        investors:      tiers.investors,
        errors:         tiers.errors.length,
        duration_ms:    durationMs,
        correlation_id: corrId,
        ...(tiers.errors.length > 0 && { error_sample: tiers.errors.slice(0, 5) }),
      })
      res.headers.set('x-correlation-id', corrId)
      return res
    } catch (err) {
      console.error('[update-partner-tiers] fatal:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
    }
  })

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }
  return result
}
