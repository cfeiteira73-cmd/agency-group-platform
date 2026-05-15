// AGENCY GROUP — GTM API: Pricing | AMI: 22506
// GET  /api/gtm/pricing — list tiers
// POST /api/gtm/pricing/quote — generate a pricing quote with ROI
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { pricingEngine, competitorBenchmarking, marketExpansionStrategy } from '@/lib/go-to-market'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'tiers'

    if (view === 'competitive') {
      return NextResponse.json({
        win_rates:       competitorBenchmarking.getWinRate(),
        unique_features: competitorBenchmarking.getUniqueFeatures(),
        overall_score:   competitorBenchmarking.getCompetitiveAdvantageScore(),
        correlation_id,
      }, {
        headers: { 'X-Correlation-ID': correlation_id },
      })
    }

    if (view === 'expansion') {
      return NextResponse.json({
        roadmap:    marketExpansionStrategy.getPriorityRoadmap(),
        waves:      marketExpansionStrategy.getAllWaves(),
        milestones: marketExpansionStrategy.getARRMilestones(),
        opportunity: marketExpansionStrategy.getTotalOpportunity(),
        correlation_id,
      }, {
        headers: { 'X-Correlation-ID': correlation_id },
      })
    }

    // Default: tiers
    return NextResponse.json({
      tiers:        pricingEngine.getTiers(),
      correlation_id,
    }, {
      headers: { 'X-Correlation-ID': correlation_id },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Pricing data failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      org_id:                string
      agents:                number
      annual_billing?:       boolean
      current_gci_per_year?: number
      current_close_rate?:   number
      avg_deal_value?:       number
    }

    if (!body.org_id || !body.agents) {
      return NextResponse.json(
        { error: 'org_id and agents are required' },
        { status: 400 }
      )
    }

    const quote = pricingEngine.quote({
      org_id:              body.org_id,
      agents:              body.agents,
      annual_billing:      body.annual_billing ?? true,
      current_gci_per_year: body.current_gci_per_year,
      current_close_rate:  body.current_close_rate,
      avg_deal_value:      body.avg_deal_value,
    })

    return NextResponse.json({ quote, correlation_id }, {
      status: 201,
      headers: { 'X-Correlation-ID': correlation_id },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Quote generation failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
