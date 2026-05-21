// Agency Group — Network Feedback Cron
// app/api/cron/network-feedback/route.ts
// POST /api/cron/network-feedback
// Auth: CRON_SECRET (Bearer header)
// Schedule: daily at 03:00 UTC
// TypeScript strict — 0 errors

import { NextRequest, NextResponse }   from 'next/server'
import { timingSafeEqual }             from 'crypto'
import { processNetworkFeedback }      from '@/lib/investors/networkFeedbackProcessor'
import { computeTopDemandProperties }  from '@/lib/investors/demandScoreEngine'
import { computeHeatmap, persistHeatmap } from '@/lib/investors/heatmapEngine'

export const runtime = 'nodejs'

// ─── Tenant helper ─────────────────────────────────────────────────────────────

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ─── POST /api/cron/network-feedback ──────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. CRON_SECRET auth ──────────────────────────────────────────────────────
  const cronExpected = process.env.CRON_SECRET
  const incoming     = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.headers.get('x-cron-secret')

  if (!cronExpected || !incoming) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bufA = Buffer.from(incoming,     'utf8')
  const bufB = Buffer.from(cronExpected, 'utf8')
  const match = bufA.length === bufB.length && timingSafeEqual(bufA, bufB)

  if (!match) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()
  const start    = Date.now()

  // ── 2. Process network feedback ──────────────────────────────────────────────
  const feedbackResult = await processNetworkFeedback(tenantId)

  console.log('[cron/network-feedback] processNetworkFeedback result:', {
    investors_processed: feedbackResult.investors_processed,
    edges_updated:       feedbackResult.edges_updated,
    avg_network_score:   feedbackResult.avg_network_score,
    top_investors:       feedbackResult.top_investors,
  })

  // ── 3. Compute top demand properties ─────────────────────────────────────────
  const topDemand = await computeTopDemandProperties(tenantId)

  const top5 = topDemand.slice(0, 5)

  console.log('[cron/network-feedback] top 5 demand properties:', top5.map(p => ({
    property_id:  p.property_id,
    demand_score: p.demand_score,
    demand_tier:  p.demand_tier,
  })))

  // ── 4. Compute and persist heatmap ───────────────────────────────────────────
  let heatmapZones = 0
  try {
    const heatmapData = await computeHeatmap(tenantId)
    if (heatmapData.length > 0) {
      await persistHeatmap(tenantId, heatmapData)
      heatmapZones = heatmapData.length
      console.log(`[cron/network-feedback] heatmap computed and persisted — ${heatmapZones} zones`)
    }
  } catch (heatmapErr) {
    // Non-fatal: heatmap failure must not fail the cron
    console.warn('[cron/network-feedback] heatmap computation failed (non-fatal):', heatmapErr instanceof Error ? heatmapErr.message : String(heatmapErr))
  }

  // ── 5. Return result ──────────────────────────────────────────────────────────
  return NextResponse.json({
    ok:                    true,
    tenant_id:             tenantId,
    network_feedback:      feedbackResult,
    top_demand_properties: top5,
    heatmap_zones_updated: heatmapZones,
    duration_ms:           Date.now() - start,
    ran_at:                new Date().toISOString(),
  })
}
