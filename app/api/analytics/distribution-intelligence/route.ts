// GET /api/analytics/distribution-intelligence
// Returns distribution ROI analytics, recipient fatigue status,
// and routing effectiveness metrics.

import { NextRequest, NextResponse }            from 'next/server'
import { getAdminRole, hasPermission }          from '@/lib/auth/adminAuth'
import { supabaseAdmin }                        from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url  = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'all'   // agent | investor | all

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any

    // 1. Top performers (ROI-ranked)
    let topQuery = admin
      .from('v_distribution_roi')
      .select('*')
      .order('roi_score', { ascending: false })
      .limit(20)
    if (type !== 'all') topQuery = topQuery.eq('recipient_type', type)
    const { data: topPerformers, error: topErr } = await topQuery
    if (topErr) throw topErr

    // 2. Fatigued recipients
    const { data: fatigued, error: fatErr } = await admin
      .from('recipient_performance_profiles')
      .select('recipient_email, recipient_type, fatigue_score, distributions_last_7d, cooldown_until, last_distributed_at')
      .eq('is_fatigued', true)
      .order('fatigue_score', { ascending: false })
      .limit(50)
    if (fatErr) throw fatErr

    // 3. Outcome distribution summary
    const { data: outcomes, error: outErr } = await admin
      .from('distribution_outcomes')
      .select('outcome, recipient_type')
      .not('outcome', 'is', null)
    if (outErr) throw outErr

    const outcomeCounts: Record<string, number> = {}
    for (const row of (outcomes ?? [])) {
      const key = `${row.recipient_type}:${row.outcome}`
      outcomeCounts[key] = (outcomeCounts[key] ?? 0) + 1
    }

    // 4. Network summary
    const { data: profiles, error: profErr } = await admin
      .from('recipient_performance_profiles')
      .select('recipient_type, close_rate, roi_score, is_fatigued')
    if (profErr) throw profErr

    const agents    = (profiles ?? []).filter((p: { recipient_type: string }) => p.recipient_type === 'agent')
    const investors = (profiles ?? []).filter((p: { recipient_type: string }) => p.recipient_type === 'investor')

    const avgMetric = (arr: Array<{ close_rate?: number | null }>, key: 'close_rate' | 'roi_score') => {
      const vals = arr.map(p => (p as Record<string, number | null>)[key]).filter((v): v is number => v != null)
      return vals.length ? parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)) : null
    }

    return NextResponse.json({
      top_performers:   topPerformers ?? [],
      fatigued_count:   (fatigued ?? []).length,
      fatigued:         fatigued ?? [],
      outcome_counts:   outcomeCounts,
      network_summary: {
        agent_count:           agents.length,
        investor_count:        investors.length,
        avg_agent_close_rate:   avgMetric(agents,    'close_rate'),
        avg_investor_close_rate: avgMetric(investors, 'close_rate'),
        fatigued_agents:       agents.filter((a: { is_fatigued: boolean }) => a.is_fatigued).length,
        fatigued_investors:    investors.filter((i: { is_fatigued: boolean }) => i.is_fatigued).length,
      },
    })
  } catch (err) {
    console.error('[distribution-intelligence]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
