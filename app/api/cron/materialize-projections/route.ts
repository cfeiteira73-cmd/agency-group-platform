// =============================================================================
// Agency Group — Projection Materialization Cron
// POST /api/cron/materialize-projections
// Rebuilds: revenue_snapshot, market_liquidity_snapshot
// Auth: CRON_SECRET
// Schedule: daily at 02:00 UTC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare }               from '@/lib/safeCompare'
import { supabaseAdmin }             from '@/lib/supabase'
import { generateLiquiditySnapshot } from '@/lib/market/liquiditySnapshot'
import { getRequestCorrelationId }   from '@/lib/observability/correlation'
import log                           from '@/lib/logger'

export const runtime = 'nodejs'

const TENANT_ID = process.env.DEFAULT_TENANT_ID
  ?? process.env.SYSTEM_ORG_ID
  ?? '00000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const incoming   = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.headers.get('x-cron-secret')
    ?? ''

  if (!cronSecret || !incoming || !safeCompare(incoming, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId   = getRequestCorrelationId(req)
  const budget   = 50_000  // 50s budget
  const start    = Date.now()
  const results: Record<string, unknown> = {}

  try {
    // 1. Market liquidity snapshot (PT + ES)
    for (const country of ['PT', 'ES']) {
      if (Date.now() - start > budget) break
      try {
        const snap = await generateLiquiditySnapshot(TENANT_ID, country)
        results[`liquidity_${country}`] = {
          ok:                true,
          active_properties: snap.active_properties,
          total_investors:   snap.total_investors,
          liquidity_ratio:   snap.liquidity_ratio,
        }
      } catch (e) {
        results[`liquidity_${country}`] = { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }

    // 2. Revenue snapshot (current month)
    if (Date.now() - start <= budget) {
      try {
        const db         = supabaseAdmin as any
        const today      = new Date()
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
        const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

        // Aggregate commission events for current month
        const { data: commissions = [] } = await db
          .from('commission_events')
          .select('gross_commission_eur, net_commission_eur, agent_email, zone')
          .eq('tenant_id', TENANT_ID)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd + 'T23:59:59Z')

        const castComm = commissions as {
          gross_commission_eur: number
          net_commission_eur: number
          agent_email: string | null
          zone: string | null
        }[]

        const totalRevenue    = castComm.reduce((s, r) => s + r.gross_commission_eur, 0)
        const totalCommission = castComm.reduce((s, r) => s + r.net_commission_eur, 0)

        // Count deals
        const { count: dealCount } = await db
          .from('commission_events')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', TENANT_ID)
          .gte('created_at', monthStart)

        // Top agent by commission
        const agentMap: Record<string, number> = {}
        const zoneMap: Record<string, number>  = {}
        for (const c of castComm) {
          if (c.agent_email) agentMap[c.agent_email] = (agentMap[c.agent_email] ?? 0) + c.gross_commission_eur
          if (c.zone)        zoneMap[c.zone]         = (zoneMap[c.zone] ?? 0) + 1
        }

        const topAgent = Object.entries(agentMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
        const topZone  = Object.entries(zoneMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

        await db
          .from('revenue_snapshot')
          .upsert({
            tenant_id:            TENANT_ID,
            period_start:         monthStart,
            period_end:           monthEnd,
            period_type:          'monthly',
            total_deals:          dealCount ?? 0,
            total_revenue_eur:    Math.round(totalRevenue * 100) / 100,
            total_commission_eur: Math.round(totalCommission * 100) / 100,
            avg_deal_value_eur:   dealCount ? Math.round((totalRevenue / dealCount) * 100) / 100 : null,
            top_agent_email:      topAgent,
            top_zone:             topZone,
            deals_by_stage:       {},
            computed_at:          new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,period_type,period_start',
          })

        results.revenue_snapshot = {
          ok:               true,
          total_revenue_eur: totalRevenue,
          total_deals:      dealCount ?? 0,
        }
      } catch (e) {
        results.revenue_snapshot = { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }

    const durationMs = Date.now() - start
    log.info('[materialize-projections] completed', { durationMs, results })

    return NextResponse.json(
      { ok: true, results, durationMs, correlation_id: corrId },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    log.error('[materialize-projections] fatal error', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
