// Agency Group — Growth Attribution & ROI API Route
// app/api/growth/attribution/route.ts
// Wave 40: System A3 — Attribution & ROI Engine (Stripe-level)

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  computeAttribution,
  getChannelAttributionSummary,
  recordTouchpoint,
  type AttributionModel,
  type TouchpointChannel,
} from '@/lib/growth/attributionEngine'
import {
  computeCAC,
  computeInvestorLTV,
  computeCampaignROI,
  getFullROIReport,
  recordCampaignCost,
} from '@/lib/growth/cacLtvEngine'
import { computeGrowthKPIs, getGrowthTrend } from '@/lib/growth/growthKpiEngine'

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as unknown as NextResponse

  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode')
  const investorId = searchParams.get('investor_id')
  const campaignId = searchParams.get('campaign_id')
  const model = (searchParams.get('model') ?? 'capital_weighted') as AttributionModel
  const windowDays = parseInt(searchParams.get('window_days') ?? '30', 10)
  const periods = parseInt(searchParams.get('periods') ?? '12', 10)

  try {
    // GET ?investor_id=xxx&model=capital_weighted → computeAttribution
    if (investorId && !mode) {
      if (!investorId) {
        return NextResponse.json({ error: 'investor_id required' }, { status: 400 })
      }
      const result = await computeAttribution(investorId, TENANT_ID, model)
      return NextResponse.json(result)
    }

    // GET ?mode=channel-summary&model=multi_touch_linear → getChannelAttributionSummary
    if (mode === 'channel-summary') {
      const summaries = await getChannelAttributionSummary(TENANT_ID, model, windowDays)
      return NextResponse.json(summaries)
    }

    // GET ?mode=cac&window_days=30 → computeCAC
    if (mode === 'cac') {
      const cac = await computeCAC(TENANT_ID, windowDays)
      return NextResponse.json(cac)
    }

    // GET ?investor_id=xxx&mode=ltv → computeInvestorLTV
    if (mode === 'ltv') {
      if (!investorId) {
        return NextResponse.json({ error: 'investor_id required for ltv mode' }, { status: 400 })
      }
      const ltv = await computeInvestorLTV(investorId, TENANT_ID)
      return NextResponse.json(ltv)
    }

    // GET ?campaign_id=xxx&mode=campaign-roi → computeCampaignROI
    if (mode === 'campaign-roi') {
      if (!campaignId) {
        return NextResponse.json({ error: 'campaign_id required for campaign-roi mode' }, { status: 400 })
      }
      const roi = await computeCampaignROI(campaignId, TENANT_ID)
      return NextResponse.json(roi)
    }

    // GET ?mode=full-roi → getFullROIReport
    if (mode === 'full-roi') {
      const report = await getFullROIReport(TENANT_ID)
      return NextResponse.json(report)
    }

    // GET ?mode=growth-kpis&window_days=30 → computeGrowthKPIs
    if (mode === 'growth-kpis') {
      const kpis = await computeGrowthKPIs(TENANT_ID, windowDays)
      return NextResponse.json(kpis)
    }

    // GET ?mode=growth-trend&periods=12 → getGrowthTrend
    if (mode === 'growth-trend') {
      const trend = await getGrowthTrend(TENANT_ID, periods)
      return NextResponse.json(trend)
    }

    return NextResponse.json(
      { error: 'Invalid mode. Valid: channel-summary|cac|ltv|campaign-roi|full-roi|growth-kpis|growth-trend or provide investor_id' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as unknown as NextResponse

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    // POST { action: 'touchpoint', investor_id, channel, campaign_id?, signal_type, metadata? }
    if (action === 'touchpoint') {
      const investorId = body.investor_id as string | undefined
      const channel = body.channel as TouchpointChannel | undefined
      const signal_type = body.signal_type as string | undefined

      if (!investorId || !channel || !signal_type) {
        return NextResponse.json(
          { error: 'investor_id, channel, and signal_type are required' },
          { status: 400 },
        )
      }

      await recordTouchpoint({
        investor_id: investorId,
        tenant_id: TENANT_ID,
        channel,
        campaign_id: (body.campaign_id as string | undefined) ?? null,
        occurred_at: new Date().toISOString(),
        signal_type,
        metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
      })

      return NextResponse.json({ ok: true, action: 'touchpoint' })
    }

    // POST { action: 'campaign-cost', channel, spend_eur_cents, period_start, period_end, investors_targeted, notes? }
    if (action === 'campaign-cost') {
      // Admin Bearer required
      if (authResult.method !== 'bearer') {
        return NextResponse.json({ error: 'Admin Bearer token required for campaign-cost' }, { status: 403 })
      }

      const channel = body.channel as string | undefined
      const spend_eur_cents = body.spend_eur_cents as number | undefined
      const period_start = body.period_start as string | undefined
      const period_end = body.period_end as string | undefined
      const investors_targeted = (body.investors_targeted as number | undefined) ?? 0

      if (!channel || spend_eur_cents === undefined || !period_start || !period_end) {
        return NextResponse.json(
          { error: 'channel, spend_eur_cents, period_start, period_end are required' },
          { status: 400 },
        )
      }

      const cost = await recordCampaignCost({
        tenant_id: TENANT_ID,
        channel,
        spend_eur_cents,
        period_start,
        period_end,
        investors_targeted,
        notes: (body.notes as string | undefined) ?? '',
      })

      return NextResponse.json(cost)
    }

    return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
