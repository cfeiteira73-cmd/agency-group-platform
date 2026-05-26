// =============================================================================
// Agency Group — Market Infrastructure Status API
// GET/POST /api/infrastructure/status
//
// The definitive system status endpoint — what banks and investors see.
//
// GET modes (requireAuth):
//   default          → getMarketInfrastructureStatus (full 10-layer status)
//   ?mode=go-live    → runGoLiveAssessment (6 hard-stop criteria)
//   ?mode=latest-assessment → getLatestAssessment
//   ?mode=layer&layer=SUPPLY → checkLayerStatus for specific layer
//   ?mode=history    → getStatusHistory
//
// POST (admin Bearer):
//   { action: 'run-go-live-assessment' } → runGoLiveAssessment
//   { action: 'run-full-status' }        → getMarketInfrastructureStatus
//
// Response headers:
//   X-System-Grade, X-Go-Live-Ready, X-Operational-Layers
//
// TypeScript strict — 0 errors.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  getMarketInfrastructureStatus,
  checkLayerStatus,
  getStatusHistory,
  type InfrastructureLayer,
} from '@/lib/infrastructure/marketInfrastructureStatusEngine'
import {
  runGoLiveAssessment,
  getLatestAssessment,
} from '@/lib/infrastructure/goLiveCriteriaValidator'
import log from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'agency-group'

const VALID_LAYERS: InfrastructureLayer[] = [
  'SUPPLY', 'NORMALIZATION', 'OPPORTUNITY', 'CAPITAL',
  'DISTRIBUTION', 'EXECUTION', 'FEEDBACK', 'ML', 'REGULATORY', 'AUTHORITY',
]

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('mode') ?? 'default'

  log.info('[infrastructure/status] GET request', {
    route: '/api/infrastructure/status',
    mode,
    tenant_id: tenantId,
  })

  // ── mode=go-live ──────────────────────────────────────────────────────────
  if (mode === 'go-live') {
    const assessment = await runGoLiveAssessment(tenantId)
    return NextResponse.json(
      { ok: true, assessment },
      {
        headers: {
          'X-System-Grade': assessment.system_grade,
          'X-Go-Live-Ready': String(assessment.go_live_ready),
          'X-Operational-Layers': '—',
        },
      },
    )
  }

  // ── mode=latest-assessment ────────────────────────────────────────────────
  if (mode === 'latest-assessment') {
    const assessment = await getLatestAssessment(tenantId)
    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: 'No assessment found — run POST { action: "run-go-live-assessment" } first' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { ok: true, assessment },
      {
        headers: {
          'X-System-Grade': assessment.system_grade,
          'X-Go-Live-Ready': String(assessment.go_live_ready),
          'X-Operational-Layers': '—',
        },
      },
    )
  }

  // ── mode=layer ────────────────────────────────────────────────────────────
  if (mode === 'layer') {
    const layerParam = (searchParams.get('layer') ?? '').toUpperCase() as InfrastructureLayer
    if (!VALID_LAYERS.includes(layerParam)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid layer. Valid values: ${VALID_LAYERS.join(', ')}`,
        },
        { status: 400 },
      )
    }
    const layerStatus = await checkLayerStatus(layerParam, tenantId)
    return NextResponse.json({ ok: true, layer: layerStatus })
  }

  // ── mode=history ──────────────────────────────────────────────────────────
  if (mode === 'history') {
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 30
    const history = await getStatusHistory(tenantId, limit)
    return NextResponse.json({ ok: true, history, count: history.length })
  }

  // ── default: full 10-layer status ─────────────────────────────────────────
  const status = await getMarketInfrastructureStatus(tenantId)
  return NextResponse.json(
    { ok: true, status },
    {
      headers: {
        'X-System-Grade': status.system_grade,
        'X-Go-Live-Ready': String(status.go_live_ready),
        'X-Operational-Layers': String(status.operational_layers),
      },
    },
  )
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult as NextResponse

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body.action ?? '')

  log.info('[infrastructure/status] POST request', {
    route: '/api/infrastructure/status',
    action,
    tenant_id: tenantId,
  })

  if (action === 'run-go-live-assessment') {
    const assessment = await runGoLiveAssessment(tenantId)
    return NextResponse.json(
      { ok: true, assessment },
      {
        headers: {
          'X-System-Grade': assessment.system_grade,
          'X-Go-Live-Ready': String(assessment.go_live_ready),
          'X-Operational-Layers': '—',
        },
      },
    )
  }

  if (action === 'run-full-status') {
    const status = await getMarketInfrastructureStatus(tenantId)
    return NextResponse.json(
      { ok: true, status },
      {
        headers: {
          'X-System-Grade': status.system_grade,
          'X-Go-Live-Ready': String(status.go_live_ready),
          'X-Operational-Layers': String(status.operational_layers),
        },
      },
    )
  }

  return NextResponse.json(
    {
      ok: false,
      error: `Unknown action: "${action}". Valid actions: run-go-live-assessment, run-full-status`,
    },
    { status: 400 },
  )
}
