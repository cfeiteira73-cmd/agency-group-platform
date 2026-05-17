// AGENCY GROUP — SH-ROS | AMI: 22506
// POST /api/simulations
// Runs action simulations via agentAutonomyV2 and returns ranked results.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { agentAutonomyV2 } from '@/lib/agent-autonomy-v2'
import type { SimulableAction, ActionSimulationInput } from '@/lib/agent-autonomy-v2'

export const runtime = 'nodejs'
export const maxDuration = 15

const ALL_SIMULABLE_ACTIONS: SimulableAction[] = [
  'adjust_price',
  'boost_homepage',
  'trigger_campaign',
  'outreach_contact',
  'flag_listing',
  'generate_deal_pack',
]

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    property_value_eur: number
    current_close_probability: number
    days_on_market: number
    demand_score: number
  }

  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    property_value_eur,
    current_close_probability,
    days_on_market,
    demand_score,
  } = body

  // ── Build simulation inputs for all 6 actions ──────────────────────────────
  const allInputs: ActionSimulationInput[] = ALL_SIMULABLE_ACTIONS.map((action) => ({
    action,
    property_id: 'sim',
    property_value_eur,
    current_close_probability,
    days_on_market,
    demand_score,
    params:
      action === 'adjust_price'
        ? { price_reduction_pct: 5 }
        : {},
  }))

  // ── Run simulations ────────────────────────────────────────────────────────
  const simulations = agentAutonomyV2.simulateActionBatch(allInputs)

  // ── Get recommended actions (filtered + sorted by gain) ──────────────────
  const recommended = agentAutonomyV2.getRecommendedActions(
    property_value_eur,
    current_close_probability,
    days_on_market,
    demand_score,
  )

  // ── Total potential gain across all simulations ───────────────────────────
  const total_potential_gain_eur = simulations.reduce(
    (acc, s) => acc + Math.max(0, s.delta.commission_gain_eur),
    0,
  )

  return NextResponse.json(
    {
      simulations,
      recommended,
      total_potential_gain_eur: Math.round(total_potential_gain_eur),
    },
    { status: 200 },
  )
}
