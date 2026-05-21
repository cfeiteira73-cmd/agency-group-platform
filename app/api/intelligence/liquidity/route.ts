// =============================================================================
// Agency Group — Market Liquidity Intelligence API
// GET /api/intelligence/liquidity
// Institutional-grade market liquidity feed — powers Control Tower + external APIs
// Auth: portal auth OR service token
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { supabaseAdmin }             from '@/lib/supabase'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'
import { getNetworkStats }           from '@/lib/investors/graphEngine'
import log                           from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const check = await requirePortalAuth(req)
  if (!check.ok) return check.response

  const corrId   = getRequestCorrelationId(req)
  // x-tenant-id header is untrusted (IDOR risk) — source tenant_id from env only
  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'PT'
  const days    = Math.min(parseInt(searchParams.get('days') ?? '30'), 90)

  try {
    const db = supabaseAdmin as any

    // Latest snapshot
    const { data: latestSnapshot } = await db
      .from('market_liquidity_snapshot')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('country', country)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    // Historical trend (last N days)
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: trend = [] } = await db
      .from('market_liquidity_snapshot')
      .select('snapshot_date, active_properties, total_investors, matches_pending, liquidity_ratio, avg_match_score')
      .eq('tenant_id', tenantId)
      .eq('country', country)
      .gte('snapshot_date', cutoff)
      .order('snapshot_date', { ascending: true })

    // Network stats
    const networkStats = await getNetworkStats(tenantId).catch(() => null)

    // Revenue summary
    const { data: revenueData } = await db
      .from('revenue_snapshot')
      .select('period_start, total_revenue_eur, total_commission_eur, total_deals')
      .eq('tenant_id', tenantId)
      .eq('period_type', 'monthly')
      .order('period_start', { ascending: false })
      .limit(3)

    return NextResponse.json(
      {
        country,
        tenant_id: tenantId,
        current:   latestSnapshot ?? null,
        trend:     trend ?? [],
        network:   networkStats,
        revenue:   revenueData ?? [],
        meta: {
          correlation_id: corrId,
          generated_at:   new Date().toISOString(),
          days_requested: days,
        },
      },
      { headers: { 'x-correlation-id': corrId, 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    log.error('[intelligence/liquidity] GET error', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
