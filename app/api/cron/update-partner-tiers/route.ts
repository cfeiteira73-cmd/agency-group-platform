// GET /api/cron/update-partner-tiers
// Daily: recomputes ELITE/PRIORITY/STANDARD/WATCHLIST for all active partners.

import { NextRequest, NextResponse }         from 'next/server'
import { batchUpdateAllPartnerTiers }        from '@/lib/commercial/partnerTiering'
import { supabaseAdmin }                     from '@/lib/supabase'
import { cronCorrelationId }                 from '@/lib/observability/correlation'

export const runtime     = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret   = req.headers.get('authorization')?.replace('Bearer ', '')
  const cronExpected = process.env.CRON_SECRET
  if (!cronExpected || !cronSecret || cronSecret !== cronExpected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId = cronCorrelationId('update-partner-tiers')

  const startedAt = Date.now()

  try {
    const result = await batchUpdateAllPartnerTiers()
    const durationMs = Date.now() - startedAt

    // Log to automations_log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        automation_type:     'cron_update_partner_tiers',
        outcome: {
          agents:      result.agents,
          investors:   result.investors,
          errors:      result.errors.length,
          error_list:  result.errors.slice(0, 10),
          duration_ms: durationMs,
        },
        properties_affected: result.agents + result.investors,
        ran_at: new Date().toISOString(),
      })

    const res = NextResponse.json({
      success:        true,
      agents:         result.agents,
      investors:      result.investors,
      errors:         result.errors.length,
      duration_ms:    durationMs,
      correlation_id: corrId,
      ...(result.errors.length > 0 && { error_sample: result.errors.slice(0, 5) }),
    })
    res.headers.set('x-correlation-id', corrId)
    return res
  } catch (err) {
    console.error('[update-partner-tiers] fatal:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
