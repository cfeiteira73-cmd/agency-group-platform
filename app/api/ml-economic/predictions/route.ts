// Agency Group — ML Economic Predictions API
// app/api/ml-economic/predictions/route.ts
// GET/POST endpoint for ML economic engine: flywheel metrics, patterns,
// liquidity predictions, zone forecasts, allocation recommendations, outcome recording.

export const runtime = 'nodejs'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import { extractBearerToken, safeCompare } from '@/lib/middleware/portalAuthGuard'
import log from '@/lib/logger'
import {
  getFlywheelMetrics,
  extractPatternsFromHistory,
  recordOutcome,
} from '@/lib/ml-economic/executionLearner'
import type { ExecutionFeatures } from '@/lib/ml-economic/executionLearner'
import { recommendAllocation, getRecommendationHistory } from '@/lib/ml-economic/capitalAllocationAdvisor'
import { predictAssetLiquidity, forecastZoneLiquidity } from '@/lib/ml-economic/liquidityPredictor'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET ────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')
  const assetId = url.searchParams.get('asset_id')
  const zone = url.searchParams.get('zone')
  const priceParam = url.searchParams.get('price')
  const investorId = url.searchParams.get('investor_id')

  try {
    // GET ?mode=flywheel
    if (mode === 'flywheel') {
      const metrics = await getFlywheelMetrics(TENANT_ID)
      return NextResponse.json({ ok: true, data: metrics })
    }

    // GET ?mode=patterns
    if (mode === 'patterns') {
      const patterns = await extractPatternsFromHistory(TENANT_ID)
      return NextResponse.json({ ok: true, data: patterns })
    }

    // GET ?zone=xxx&mode=zone-forecast
    if (mode === 'zone-forecast' && zone) {
      const forecast = await forecastZoneLiquidity(zone, TENANT_ID)
      return NextResponse.json({ ok: true, data: forecast })
    }

    // GET ?investor_id=xxx&mode=recommendations
    if (mode === 'recommendations' && investorId) {
      const history = await getRecommendationHistory(investorId, TENANT_ID)
      return NextResponse.json({ ok: true, data: history })
    }

    // GET ?asset_id=xxx&zone=yyy&price=NNN
    if (assetId && zone && priceParam) {
      const price = parseInt(priceParam, 10)
      if (isNaN(price) || price <= 0) {
        return NextResponse.json({ ok: false, error: 'Invalid price parameter' }, { status: 400 })
      }
      const prediction = await predictAssetLiquidity(assetId, zone, price, TENANT_ID)
      return NextResponse.json({ ok: true, data: prediction })
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid query. Supported: mode=flywheel, mode=patterns, mode=zone-forecast&zone=X, mode=recommendations&investor_id=X, asset_id=X&zone=Y&price=N',
      },
      { status: 400 },
    )
  } catch (e) {
    log.info('[ml-economic/predictions] GET error', { error: String(e) })
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body['action'] as string | undefined

  // ── action: recommend — requires portal auth ─────────────────────────────────
  if (action === 'recommend') {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) return authResult

    const investor_id = body['investor_id'] as string | undefined
    const asset_id = body['asset_id'] as string | undefined
    const zone = body['zone'] as string | undefined
    const asset_class = body['asset_class'] as string | undefined
    const listed_price_eur_cents = body['listed_price_eur_cents'] as number | undefined

    if (!investor_id || !asset_id || !zone || !asset_class || !listed_price_eur_cents) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: investor_id, asset_id, zone, asset_class, listed_price_eur_cents' },
        { status: 400 },
      )
    }

    try {
      const recommendation = await recommendAllocation({
        investor_id,
        asset_id,
        zone,
        asset_class,
        listed_price_eur_cents,
        tenant_id: TENANT_ID,
      })
      return NextResponse.json({ ok: true, data: recommendation })
    } catch (e) {
      log.info('[ml-economic/predictions] recommend error', { error: String(e) })
      return NextResponse.json({ ok: false, error: 'Recommendation failed' }, { status: 500 })
    }
  }

  // ── action: record-outcome — requires INTERNAL_API_TOKEN Bearer ──────────────
  if (action === 'record-outcome') {
    const internalToken = process.env.INTERNAL_API_TOKEN
    if (!internalToken) {
      return NextResponse.json({ ok: false, error: 'Admin token not configured' }, { status: 500 })
    }
    const token = extractBearerToken(req)
    if (!token || !safeCompare(token, internalToken)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized — admin Bearer required' }, { status: 401 })
    }

    const settlement_id = (body['settlement_id'] as string | undefined) ?? ''
    const asset_id = body['asset_id'] as string | undefined
    const investor_id = body['investor_id'] as string | undefined
    const zone = (body['zone'] as string | undefined) ?? 'unknown'
    const asset_class = (body['asset_class'] as string | undefined) ?? 'residential'
    const agreed_price_eur_cents = body['agreed_price_eur_cents'] as number | undefined
    const final_price_eur_cents = body['final_price_eur_cents'] as number | undefined
    const commission_eur_cents = body['commission_eur_cents'] as number | undefined
    const days_to_close = body['days_to_close'] as number | undefined
    const competing_bids = (body['competing_bids'] as number | undefined) ?? 0
    const liquidity_score_at_close = (body['liquidity_score_at_close'] as number | undefined) ?? 0
    const features = body['features'] as ExecutionFeatures | undefined

    if (
      !asset_id ||
      !investor_id ||
      agreed_price_eur_cents === undefined ||
      final_price_eur_cents === undefined ||
      commission_eur_cents === undefined ||
      days_to_close === undefined ||
      !features
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Missing required fields: asset_id, investor_id, agreed_price_eur_cents, final_price_eur_cents, commission_eur_cents, days_to_close, features',
        },
        { status: 400 },
      )
    }

    try {
      const outcome = await recordOutcome(
        {
          tenant_id: TENANT_ID,
          settlement_id,
          asset_id,
          investor_id,
          zone,
          asset_class,
          agreed_price_eur_cents,
          final_price_eur_cents,
          commission_eur_cents,
          days_to_close,
          competing_bids,
          liquidity_score_at_close,
          features,
        },
        TENANT_ID,
      )
      return NextResponse.json({ ok: true, data: outcome })
    } catch (e) {
      log.info('[ml-economic/predictions] record-outcome error', { error: String(e) })
      return NextResponse.json({ ok: false, error: 'Record outcome failed' }, { status: 500 })
    }
  }

  return NextResponse.json(
    { ok: false, error: 'Unknown action. Supported: recommend, record-outcome' },
    { status: 400 },
  )
}
