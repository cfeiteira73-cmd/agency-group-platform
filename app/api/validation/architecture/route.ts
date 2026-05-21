// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Architecture Validation API
// app/api/validation/architecture/route.ts
//
// GET  /api/validation/architecture              → latest scan (portal auth)
// GET  /api/validation/architecture?mode=history → scan history (portal auth)
// POST /api/validation/architecture              → run scan (service auth)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { requireServiceAuth } from '@/lib/auth/serviceAuth'
import {
  runArchitectureScan,
  getLatestArchitectureScan,
  getArchitectureScanHistory,
} from '@/lib/validation/architectureScanner'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime    = 'nodejs'
export const maxDuration = 60

// ─── Tenant resolver ──────────────────────────────────────────────────────────

function resolveTenantId(req: NextRequest): string {
  return (
    req.nextUrl.searchParams.get('tenant_id') ??
    req.headers.get('x-tenant-id') ??
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

// ─── GET /api/validation/architecture ────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId(req)
  const mode     = req.nextUrl.searchParams.get('mode')

  try {
    if (mode === 'history') {
      const limitParam = req.nextUrl.searchParams.get('limit')
      const limit      = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20
      const history    = await getArchitectureScanHistory(tenantId, limit)
      return NextResponse.json(
        { history, count: history.length, tenant_id: tenantId },
        { headers: { 'x-correlation-id': corrId } },
      )
    }

    const latest = await getLatestArchitectureScan(tenantId)
    if (!latest) {
      return NextResponse.json(
        {
          message:   'No architecture scans found — POST to run the first scan',
          tenant_id: tenantId,
        },
        { status: 404, headers: { 'x-correlation-id': corrId } },
      )
    }

    return NextResponse.json(
      { scan: latest, tenant_id: tenantId },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[GET /api/validation/architecture]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}

// ─── POST /api/validation/architecture ───────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  const auth = await requireServiceAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId(req)

  try {
    const result = await runArchitectureScan(tenantId)

    return NextResponse.json(
      {
        scan:      result,
        tenant_id: tenantId,
        triggered_by: auth.identity,
      },
      { headers: { 'x-correlation-id': corrId } },
    )
  } catch (err) {
    console.error('[POST /api/validation/architecture]', err, { corrId, tenant_id: tenantId })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'x-correlation-id': corrId } },
    )
  }
}
