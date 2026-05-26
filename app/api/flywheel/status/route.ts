// Agency Group — Flywheel Status API Route
// app/api/flywheel/status/route.ts
// TypeScript strict — 0 errors

import { NextResponse } from 'next/server'
import {
  requireAuth,
  extractBearerToken,
  safeCompare,
} from '@/lib/middleware/portalAuthGuard'
import {
  computeFlywheelMetrics,
  getFlywheelHistory,
  identifyFlywheelBottleneck,
} from '@/lib/flywheel/feedbackFlywheelEngine'
import {
  computeCounterfactualLoss,
  getCounterfactualHistory,
} from '@/lib/flywheel/counterfactualLossEngine'
import { runDominanceSweep } from '@/lib/supply-dominance/supplyDominanceEngine'
import {
  detectFirstMoverListings,
  getFirstMoverStats,
  prioritizeFirstMoverOpportunities,
} from '@/lib/supply-dominance/firstPointOfListingEngine'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

// ─── Admin auth helper ────────────────────────────────────────────────────────

function isAdminAuthorized(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const token = extractBearerToken(req)
  if (!token) return false
  return safeCompare(token, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) return authResult

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const tenantId = searchParams.get('tenant_id') ?? authResult.tenant_id ?? DEFAULT_TENANT

    // ?mode=history → flywheel history
    if (mode === 'history') {
      const limitStr = searchParams.get('limit')
      const limit = limitStr ? parseInt(limitStr, 10) : 30
      const history = await getFlywheelHistory(tenantId, limit)
      return NextResponse.json({ flywheel_history: history, count: history.length })
    }

    // ?mode=counterfactual → counterfactual loss
    if (mode === 'counterfactual') {
      const period = searchParams.get('period') ?? undefined
      const historyMode = searchParams.get('history') === 'true'
      if (historyMode) {
        const limitStr = searchParams.get('limit')
        const limit = limitStr ? parseInt(limitStr, 10) : 12
        const history = await getCounterfactualHistory(tenantId, limit)
        return NextResponse.json({ counterfactual_history: history, count: history.length })
      }
      const loss = await computeCounterfactualLoss(tenantId, period)
      return NextResponse.json({ counterfactual_loss: loss })
    }

    // ?mode=supply-dominance → full market sweep
    if (mode === 'supply-dominance') {
      const snapshots = await runDominanceSweep(tenantId)
      return NextResponse.json({ supply_dominance: snapshots, markets: snapshots.length })
    }

    // ?mode=first-mover → detect + stats
    if (mode === 'first-mover') {
      const hoursStr = searchParams.get('since_hours')
      const sinceHours = hoursStr ? parseInt(hoursStr, 10) : 24
      const [signals, stats] = await Promise.all([
        detectFirstMoverListings(tenantId, sinceHours),
        getFirstMoverStats(tenantId),
      ])
      return NextResponse.json({ first_mover_signals: signals, stats, count: signals.length })
    }

    // Default: latest flywheel metrics + bottleneck
    const [metrics, bottleneck] = await Promise.all([
      computeFlywheelMetrics(tenantId),
      identifyFlywheelBottleneck(tenantId),
    ])

    return NextResponse.json({
      flywheel: metrics,
      bottleneck,
    })
  } catch (err) {
    log.error('[flywheel/status] GET error', { err })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as {
      action?: string
      tenant_id?: string
      period?: string
      since_hours?: number
    }

    const tenantId = body.tenant_id ?? DEFAULT_TENANT
    const { action } = body

    if (action === 'compute-flywheel') {
      const metrics = await computeFlywheelMetrics(tenantId)
      return NextResponse.json({ flywheel: metrics })
    }

    if (action === 'compute-counterfactual') {
      const loss = await computeCounterfactualLoss(tenantId, body.period)
      return NextResponse.json({ counterfactual_loss: loss })
    }

    if (action === 'prioritize-first-mover') {
      const assetIds = await prioritizeFirstMoverOpportunities(tenantId)
      return NextResponse.json({ prioritized_asset_ids: assetIds, count: assetIds.length })
    }

    return NextResponse.json(
      { error: 'Unknown action', valid_actions: ['compute-flywheel', 'compute-counterfactual', 'prioritize-first-mover'] },
      { status: 400 },
    )
  } catch (err) {
    log.error('[flywheel/status] POST error', { err })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
