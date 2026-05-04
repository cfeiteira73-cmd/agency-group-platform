// GET /api/analytics/funnel
// Returns full conversion funnel metrics: ingested → scored → distributed → closed

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import { getToken }                  from 'next-auth/jwt'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { fetchFunnelCounts, computeFunnelConversions, computeGradeConversions } from '@/lib/analytics/funnelMetrics'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const internalToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const isInternal    = safeCompare(internalToken ?? '', process.env.CRON_SECRET ?? '')

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await getAdminRole(token.email as string)
    if (!admin || !hasPermission(admin.role, 'analytics:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  try {
    const [counts, gradeRows] = await Promise.all([
      fetchFunnelCounts(since),
      // Grade-level distribution vs close
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('revenue_attribution')
        .select('attributed_score_grade, close_status, commission_total')
        .gte('created_at', since.toISOString()),
    ])

    const funnel = computeFunnelConversions(counts)

    // Aggregate grade conversions
    const gradeCounts: Record<string, { distributed: number; closed: number; commission: number }> = {}
    for (const row of (gradeRows.data ?? []) as Array<{
      attributed_score_grade: string | null
      close_status: string
      commission_total: number | null
    }>) {
      const g = row.attributed_score_grade ?? 'unknown'
      if (!gradeCounts[g]) gradeCounts[g] = { distributed: 0, closed: 0, commission: 0 }
      gradeCounts[g].distributed++
      if (row.close_status === 'won') gradeCounts[g].closed++
      gradeCounts[g].commission += row.commission_total ?? 0
    }

    const gradeConversions = computeGradeConversions(
      Object.entries(gradeCounts).map(([grade, v]) => ({
        grade,
        distributed:    v.distributed,
        closed:         v.closed,
        avg_commission: v.closed > 0 ? parseFloat((v.commission / v.closed).toFixed(2)) : null,
      })),
    )

    return NextResponse.json({
      period_days:       days,
      since:             since.toISOString(),
      funnel,
      grade_conversions: gradeConversions,
      raw_counts:        counts,
      generated_at:      new Date().toISOString(),
    })
  } catch (err) {
    console.error('[analytics/funnel] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
