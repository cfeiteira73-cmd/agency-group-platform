// GET /api/cron/refresh-distribution-outcomes
// Daily: refreshes recipient performance profiles and fatigue scores.

import { NextRequest, NextResponse }   from 'next/server'
import { supabaseAdmin }               from '@/lib/supabase'
import { refreshRecipientProfile }     from '@/lib/intelligence/distributionOutcomes'

export const runtime     = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: emails, error } = await (supabaseAdmin as any)
      .from('distribution_outcomes')
      .select('recipient_email')
      .order('created_at', { ascending: false })

    if (error) throw error

    const unique: string[] = [...new Set<string>(
      (emails ?? []).map((r: { recipient_email: string }) => r.recipient_email).filter(Boolean)
    )]

    let refreshed = 0
    const errors: string[] = []

    for (const email of unique) {
      try {
        await refreshRecipientProfile(email)
        refreshed++
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const durationMs = Date.now() - startedAt

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        automation_type:     'cron_refresh_distribution_outcomes',
        outcome: {
          refreshed,
          errors:      errors.length,
          error_list:  errors.slice(0, 10),
          duration_ms: durationMs,
        },
        properties_affected: refreshed,
        ran_at: new Date().toISOString(),
      })

    return NextResponse.json({
      success: true,
      refreshed,
      errors:  errors.length,
      duration_ms: durationMs,
      ...(errors.length > 0 && { error_sample: errors.slice(0, 5) }),
    })
  } catch (err) {
    console.error('[refresh-distribution-outcomes] fatal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
