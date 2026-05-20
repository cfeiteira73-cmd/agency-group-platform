// GET /api/analytics/network-performance
// Best agents by zone, best investors by segment, underperformers.

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import { getToken }                  from 'next-auth/jwt'
import { supabaseAdmin }             from '@/lib/supabase'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { summarizeNetworkHealth }    from '@/lib/analytics/funnelMetrics'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const serviceCheck = await requireServiceAuth(req)
  const isInternal   = serviceCheck.ok

  if (!isInternal) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await getAdminRole(token.email as string)
    if (!admin || !hasPermission(admin.role, 'analytics:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin

    const [agentRows, investorRows, watchlistRows] = await Promise.all([
      // Top agents — join performance + tier
      admin.from('v_agent_performance_latest')
        .select('agent_email, agent_execution_score, close_rate, avg_deal_size, top_zones')
        .order('agent_execution_score', { ascending: false })
        .limit(20),

      // Top investors by engagement
      admin.from('investor_intelligence')
        .select('investor_id, engagement_score, conversion_rate, total_deals, preferred_zones')
        .order('engagement_score', { ascending: false })
        .limit(20),

      // Watchlist partners
      admin.from('partner_tiers')
        .select('partner_email, partner_type, tier, tier_score, criteria')
        .eq('tier', 'WATCHLIST')
        .order('tier_score', { ascending: true })
        .limit(20),
    ])

    // Enrich agents with tier
    const agentEmails  = (agentRows.data ?? []).map((a: { agent_email: string }) => a.agent_email)
    const agentTierMap: Record<string, string> = {}
    if (agentEmails.length > 0) {
      const { data: tiers } = await admin
        .from('partner_tiers')
        .select('partner_email, tier')
        .in('partner_email', agentEmails)
      for (const t of (tiers ?? [])) agentTierMap[t.partner_email] = t.tier
    }

    const topAgents = (agentRows.data ?? []).map(a => ({
      agent_email:     (a.agent_email ?? '') as string,
      zone:            ((a.top_zones ?? []) as string[])[0] ?? 'n/a',
      close_rate_pct:  a.close_rate != null ? parseFloat(((a.close_rate as number) * 100).toFixed(1)) : 0,
      deals_won:       0,   // could enrich from attribution
      avg_deal_size:   a.avg_deal_size as number | null,
      execution_score: (a.agent_execution_score ?? 0) as number,
      tier:            agentTierMap[a.agent_email ?? ''] ?? 'STANDARD',
    }))

    const topInvestors = (investorRows.data ?? []).map(i => ({
      investor_id:      i.investor_id,
      engagement_score: (i.engagement_score ?? 0) as number,
      conversion_pct:   i.conversion_rate != null ? parseFloat(((i.conversion_rate as number) * 100).toFixed(1)) : 0,
      deals_total:      (i.total_deals ?? 0) as number,
      tier:             'STANDARD',  // will be updated once partner_tiers is populated
    }))

    const underperformers = (watchlistRows.data ?? []).map(w => ({
      partner_email: w.partner_email,
      partner_type:  w.partner_type,
      tier:          w.tier as string,
      tier_score:    (w.tier_score ?? 0) as number,
      reason:        'Below STANDARD threshold (score < 45)',
    }))

    const networkStats = { top_agents: topAgents, top_investors: topInvestors, underperformers } as import('@/lib/analytics/funnelMetrics').NetworkStats
    const summary = summarizeNetworkHealth(networkStats)

    return NextResponse.json({
      ...networkStats,
      summary,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[network-performance] error:', err, { corrId })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
