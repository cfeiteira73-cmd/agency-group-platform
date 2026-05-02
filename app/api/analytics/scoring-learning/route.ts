// GET /api/analytics/scoring-learning
// Returns accuracy metrics and learning stats from the feedback loop.
// Used by the admin dashboard to monitor scoring quality over time.

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Auth: session token or internal/cron token
  const internalToken = req.headers.get('x-internal-token')
  const bearer        = req.headers.get('authorization')?.replace('Bearer ', '')
  const isInternal    = (internalToken && internalToken === process.env.CRON_SECRET)
                     || (bearer        && bearer        === process.env.CRON_SECRET)

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: perfRows, error: perfError } = await (supabaseAdmin as any)
      .from('v_scoring_performance')
      .select('*')

    if (perfError) throw new Error(perfError.message)

    // Overall stats from feedback events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stats, error: statsError } = await (supabaseAdmin as any)
      .from('scoring_feedback_events')
      .select('close_status, opportunity_grade, negotiation_delta_pct, realized_dom')
      .not('close_status', 'is', null)

    if (statsError) throw new Error(statsError.message)

    const rows = (stats ?? []) as Array<{
      close_status:          string
      opportunity_grade:     string
      negotiation_delta_pct: number | null
      realized_dom:          number | null
    }>

    const totalFeedback  = rows.length
    const wonRows        = rows.filter(r => r.close_status === 'won')
    const overallWinRate = totalFeedback > 0
      ? parseFloat((wonRows.length / totalFeedback * 100).toFixed(1))
      : null

    const avgNegDelta = wonRows.filter(r => r.negotiation_delta_pct != null).length > 0
      ? parseFloat((
          wonRows
            .filter(r => r.negotiation_delta_pct != null)
            .reduce((s, r) => s + r.negotiation_delta_pct!, 0)
          / wonRows.filter(r => r.negotiation_delta_pct != null).length
        ).toFixed(2))
      : null

    const avgDom = wonRows.filter(r => r.realized_dom != null).length > 0
      ? parseFloat((
          wonRows
            .filter(r => r.realized_dom != null)
            .reduce((s, r) => s + r.realized_dom!, 0)
          / wonRows.filter(r => r.realized_dom != null).length
        ).toFixed(1))
      : null

    return NextResponse.json({
      summary: {
        total_feedback_events: totalFeedback,
        overall_win_rate_pct:  overallWinRate,
        avg_negotiation_delta: avgNegDelta,
        avg_days_to_close:     avgDom,
      },
      grade_performance: perfRows ?? [],
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[scoring-learning] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
