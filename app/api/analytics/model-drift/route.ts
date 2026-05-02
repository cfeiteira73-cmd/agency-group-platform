// GET /api/analytics/model-drift
// Returns the latest drift report from the calibration engine.
// Optionally triggers a fresh computation via ?recompute=true.

import { NextRequest, NextResponse } from 'next/server'
import { getToken }                  from 'next-auth/jwt'
import { computeAndPersistDriftReport } from '@/lib/intelligence/driftDetector'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime  = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // Auth: session or cron token
  const internalToken = req.headers.get('x-internal-token')
  const bearer        = req.headers.get('authorization')?.replace('Bearer ', '')
  const isInternal    = (internalToken && internalToken === process.env.CRON_SECRET)
                     || (bearer        && bearer        === process.env.CRON_SECRET)

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const recompute = searchParams.get('recompute') === 'true'

  try {
    if (recompute) {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const report = await computeAndPersistDriftReport(since, true)
      return NextResponse.json({ source: 'fresh', report })
    }

    // Return latest persisted report
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('calibration_recommendations')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw new Error(error.message)

    if (!data) {
      return NextResponse.json({
        source: 'none',
        message: 'No drift report yet. Use ?recompute=true to generate one.',
      })
    }

    return NextResponse.json({ source: 'cached', report: data })
  } catch (err) {
    console.error('[model-drift] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
