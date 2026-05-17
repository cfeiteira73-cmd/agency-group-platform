// AGENCY GROUP — SH-ROS | Pricing Intelligence API | AMI: 22506
// GET /api/pricing-intelligence
// Pure computation — no DB calls, no supabaseAdmin.
// =============================================================================

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { computePricingIntelligence } from '@/lib/pricing-intelligence'
import type { PricingInputs } from '@/lib/pricing-intelligence'
import { buildPricingDecisionEngine } from '@/lib/pricing-intelligence/advancedPricingIntelligence'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: string | null): number | null {
  if (!v) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function toBool(v: string | null): boolean {
  return v === 'true' || v === '1'
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams

  // ── Parse query params ────────────────────────────────────────────────────
  const inputs: PricingInputs = {
    listing_price:  toNum(sp.get('listing_price')),
    area_sqm:       toNum(sp.get('area_sqm')),
    bedrooms:       toNum(sp.get('bedrooms')),
    city:           sp.get('city') || null,
    zone:           sp.get('zone') || null,
    condition:      sp.get('condition') || null,
    luxury_score:   toNum(sp.get('luxury_score')),
    has_pool:       toBool(sp.get('has_pool')),
    has_sea_view:   toBool(sp.get('has_sea_view')),
    demand_score:   toNum(sp.get('demand_score')),
    days_on_market: toNum(sp.get('days_on_market')),
    price_previous: toNum(sp.get('price_previous')),
  }

  // ── Base card ─────────────────────────────────────────────────────────────
  const baseCard = computePricingIntelligence(inputs)

  // ── Advanced decision engine ───────────────────────────────────────────────
  const daysOnMarket = inputs.days_on_market ?? 0
  const advanced = buildPricingDecisionEngine(inputs, baseCard, daysOnMarket)

  // ── Price simulations ─────────────────────────────────────────────────────
  const DELTAS = [-0.10, -0.05, -0.02, +0.02, +0.05] as const
  const basePrice = inputs.listing_price ?? baseCard.avm_base

  const simulations = DELTAS.map((delta) => {
    const simInputs: PricingInputs = {
      ...inputs,
      listing_price: Math.round(basePrice * (1 + delta)),
    }
    const sim = computePricingIntelligence(simInputs)
    return {
      delta_pct:                  Math.round(delta * 100),
      listing_price:              simInputs.listing_price,
      pricing_risk:               sim.pricing_risk,
      overpricing_probability:    sim.overpricing_probability,
      estimated_days_on_market:   sim.estimated_days_on_market,
      inquiry_rate_estimate:      sim.inquiry_rate_estimate,
      conversion_probability:     sim.conversion_probability,
      recommendation:             sim.recommendation,
    }
  })

  // ── Response ───────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      base:        baseCard,
      advanced,
      simulations,
      computed_at: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
