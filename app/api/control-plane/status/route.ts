// Agency Group — Control Plane Status API
// app/api/control-plane/status/route.ts
// GET  → returns current control plane status (auth via Bearer or session)
// POST → triggers a full control plane cycle (requires portal auth)

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/portalAuthGuard'
import {
  getControlPlaneStatus,
  runControlPlaneCycle,
} from '@/lib/control-plane/controlPlaneOrchestrator'
import log from '@/lib/logger'

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── GET — Status query ───────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  // Auth via Bearer INTERNAL_API_SECRET or NextAuth session
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  try {
    const statusResult = await getControlPlaneStatus(tenantId)

    return NextResponse.json(
      {
        ok: true,
        tenant_id: tenantId,
        ...statusResult,
      },
      { status: 200 },
    )
  } catch (err) {
    log.error('[control-plane/status] GET failed', err, { tenant_id: tenantId })
    return NextResponse.json(
      { ok: false, error: 'Failed to retrieve control plane status' },
      { status: 500 },
    )
  }
}

// ─── POST — Trigger cycle ─────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireAuth(req)
  if (authResult instanceof Response) return authResult

  const tenantId = authResult.tenant_id ?? DEFAULT_TENANT_ID

  log.info('[control-plane/status] POST cycle triggered', {
    tenant_id: tenantId,
    method: authResult.method,
    user_id: authResult.user_id ?? undefined,
  })

  try {
    const cycleResult = await runControlPlaneCycle(tenantId)

    return NextResponse.json(
      {
        ok: true,
        ...cycleResult,
      },
      { status: 200 },
    )
  } catch (err) {
    log.error('[control-plane/status] POST cycle failed', err, { tenant_id: tenantId })
    return NextResponse.json(
      { ok: false, error: 'Control plane cycle failed' },
      { status: 500 },
    )
  }
}
