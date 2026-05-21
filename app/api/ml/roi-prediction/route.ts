// Agency Group — ROI Prediction API
// app/api/ml/roi-prediction/route.ts
// TypeScript strict — 0 errors
//
// GET /api/ml/roi-prediction?property_id=xxx              — single ROI prediction (portal auth)
// GET /api/ml/roi-prediction?property_ids=a,b,c           — batch max 20 (portal auth)
// GET /api/ml/roi-prediction?mode=accuracy                — system accuracy (portal auth)
// GET /api/ml/roi-prediction?deal_id=xxx&mode=track       — track deal ROI (service auth)

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { getTenantId } from '@/lib/tenant'
import {
  predictROI,
  batchPredictROI,
  persistROIPrediction,
} from '@/lib/ml/economicEngine'
import {
  trackDealROI,
  computeSystemROIAccuracy,
} from '@/lib/ml/roiTracker'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BATCH = 20

// ---------------------------------------------------------------------------
// Service auth helper
// ---------------------------------------------------------------------------

function isServiceAuth(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming = req.headers.get('x-service-auth')
  if (!incoming) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(incoming)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')
  const dealId = searchParams.get('deal_id')

  // track mode requires service auth
  if (mode === 'track' && dealId) {
    if (!isServiceAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId =
      process.env.DEFAULT_TENANT_ID
      ?? process.env.SYSTEM_ORG_ID
      ?? '00000000-0000-0000-0000-000000000001'

    try {
      const entry = await trackDealROI(tenantId, dealId)
      return NextResponse.json({ ok: true, entry }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    } catch (err) {
      log.error('[roi-prediction] trackDealROI failed', err as Error, {
        tenant_id: tenantId,
        deal_id: dealId,
      })
      return NextResponse.json(
        { error: 'Track failed', detail: String(err) },
        { status: 500 }
      )
    }
  }

  // All other modes require portal auth
  const authed = await isPortalAuth(req)
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = await getTenantId(req)

  try {
    // Accuracy mode
    if (mode === 'accuracy') {
      const accuracy = await computeSystemROIAccuracy(tenantId)
      return NextResponse.json({ ok: true, accuracy }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // Batch mode
    const propertyIdsParam = searchParams.get('property_ids')
    if (propertyIdsParam) {
      const ids = propertyIdsParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, MAX_BATCH)

      if (ids.length === 0) {
        return NextResponse.json({ error: 'property_ids is empty' }, { status: 400 })
      }

      const predictions = await batchPredictROI(tenantId, ids)

      // Fire-and-forget persist
      for (const pred of predictions) {
        void persistROIPrediction(pred).catch(err => {
          log.warn('[roi-prediction] persist failed', { error: err })
        })
      }

      return NextResponse.json({ ok: true, predictions, count: predictions.length }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    // Single mode
    const propertyId = searchParams.get('property_id')
    if (!propertyId) {
      return NextResponse.json(
        { error: 'property_id or property_ids is required' },
        { status: 400 }
      )
    }

    const investorId = searchParams.get('investor_id') ?? undefined
    const prediction = await predictROI(tenantId, propertyId, investorId)

    void persistROIPrediction(prediction).catch(err => {
      log.warn('[roi-prediction] persist failed', { error: err })
    })

    return NextResponse.json({ ok: true, prediction }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('[roi-prediction] GET failed', err as Error, { tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}
