// POST /api/analytics/business-simulation — run pipeline/scenario simulation
// GET  /api/analytics/business-simulation — sensitivity table for all scenarios

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import {
  simulateMarketScenario,
  buildScenarioSensitivityTable,
  computeRevenueImpact,
  computeCapacityDelta,
  simulateIngestionFunnel,
  simulateConversionRevenue,
} from '@/lib/intelligence/businessSimulation'
import type { BaselineMetrics, MarketScenarioType } from '@/lib/intelligence/businessSimulation'

export const runtime = 'nodejs'

const DEFAULT_BASELINE: BaselineMetrics = {
  total_leads_per_month:  200,
  qualify_rate_pct:       40,
  scoring_pass_rate_pct:  65,
  routing_rate_pct:       80,
  conversion_rate_pct:    5,
  avg_deal_value:         600_000,
  avg_commission_pct:     5,
  avg_time_to_close_days: 90,
}

export async function GET(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const scenario = searchParams.get('scenario') as MarketScenarioType | null

  try {
    if (scenario) {
      const result = simulateMarketScenario(scenario, DEFAULT_BASELINE)
      return NextResponse.json({ scenario: result })
    }
    const table = buildScenarioSensitivityTable(DEFAULT_BASELINE)
    return NextResponse.json({ scenarios: table, baseline: DEFAULT_BASELINE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAdminRole(req.headers.get('authorization')?.replace('Bearer ', '') ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body     = await req.json()
    const action   = body.action as string
    const baseline = (body.baseline as BaselineMetrics) ?? DEFAULT_BASELINE

    if (action === 'compare') {
      const before    = simulateMarketScenario(body.before_scenario ?? 'baseline', baseline)
      const after     = simulateMarketScenario(body.after_scenario  ?? 'upturn',   baseline)
      const revImpact = computeRevenueImpact(before.revenue, after.revenue)
      const capDelta  = computeCapacityDelta(before.funnel, after.funnel)
      return NextResponse.json({ before, after, revenue_impact: revImpact, capacity_delta: capDelta })
    }

    if (action === 'simulate') {
      const result = simulateMarketScenario(body.scenario ?? 'baseline', baseline, body.custom_assumptions)
      return NextResponse.json({ result })
    }

    if (action === 'funnel') {
      const assumptions = body.assumptions ?? {
        price_delta_pct: 0, volume_delta_pct: 0, conversion_delta_pct: 0,
        time_to_close_delta_pct: 0, demand_supply_ratio: 1.0,
      }
      const funnel  = simulateIngestionFunnel(baseline, assumptions)
      const revenue = simulateConversionRevenue(funnel, baseline, assumptions)
      return NextResponse.json({ funnel, revenue })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
