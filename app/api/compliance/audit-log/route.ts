// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Audit Log API Route
// app/api/compliance/audit-log/route.ts
//
// GET  /api/compliance/audit-log?entity_id=xxx   → queryAuditLog for entity
// GET  /api/compliance/audit-log?action=xxx      → queryAuditLog filtered by action
// GET  /api/compliance/audit-log?mode=verify     → verifyChainIntegrity
// POST /api/compliance/audit-log                 → writeAuditLog (service auth)
//
// Auth: ALL methods require x-service-auth: INTERNAL_API_SECRET header
//
// TypeScript strict — 0 errors
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import log from '@/lib/logger'
import {
  writeAuditLog,
  queryAuditLog,
  verifyChainIntegrity,
  type AuditAction,
} from '@/lib/compliance/immutableAuditLog'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const serviceAuthHeader = req.headers.get('x-service-auth')
    ?? req.headers.get('authorization')?.replace('Bearer ', '')
    ?? null

  if (!serviceAuthHeader) return false

  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false

  return safeCompare(serviceAuthHeader, secret)
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
    ?? req.headers.get('x-tenant-id')
    ?? process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  const mode      = req.nextUrl.searchParams.get('mode')
  const entityId  = req.nextUrl.searchParams.get('entity_id') ?? undefined
  const action    = req.nextUrl.searchParams.get('action') ?? undefined
  const actorId   = req.nextUrl.searchParams.get('actor_id') ?? undefined
  const from      = req.nextUrl.searchParams.get('from') ?? undefined
  const to        = req.nextUrl.searchParams.get('to') ?? undefined
  const limitStr  = req.nextUrl.searchParams.get('limit')
  const limit     = limitStr ? Math.min(parseInt(limitStr, 10), 1000) : undefined

  // ── Chain integrity verification ────────────────────────────────────────────
  if (mode === 'verify') {
    try {
      const result = await verifyChainIntegrity(tenantId, limit)
      return NextResponse.json({
        ok:     true,
        result,
        tenant_id: tenantId,
      })
    } catch (err) {
      log.warn('[audit-log route] verifyChainIntegrity error', {
        tenant_id: tenantId,
        error:     err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
    }
  }

  // ── Query audit log ─────────────────────────────────────────────────────────
  try {
    const entries = await queryAuditLog(tenantId, {
      action:    action as AuditAction | undefined,
      entity_id: entityId,
      actor_id:  actorId,
      from,
      to,
      limit,
    })

    return NextResponse.json({
      ok:      true,
      entries,
      count:   entries.length,
      tenant_id: tenantId,
    })
  } catch (err) {
    log.warn('[audit-log route] queryAuditLog error', {
      tenant_id: tenantId,
      error:     err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

interface WriteAuditLogBody {
  action: AuditAction
  actor_id: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  correlation_id?: string
  tenant_id?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: WriteAuditLogBody

  try {
    body = await req.json() as WriteAuditLogBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, actor_id, entity_type, entity_id, payload, correlation_id, tenant_id: bodyTenant } = body

  // Validate required fields
  if (!action || !actor_id || !entity_type || !entity_id || !payload) {
    return NextResponse.json(
      { error: 'Missing required fields: action, actor_id, entity_type, entity_id, payload' },
      { status: 400 },
    )
  }

  const tenantId = bodyTenant
    ?? req.headers.get('x-tenant-id')
    ?? process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? '00000000-0000-0000-0000-000000000001'

  try {
    const entry = await writeAuditLog(
      tenantId,
      action,
      actor_id,
      entity_type,
      entity_id,
      payload,
      correlation_id,
    )

    return NextResponse.json({ ok: true, entry }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn('[audit-log route] writeAuditLog error', {
      tenant_id: tenantId,
      action,
      entity_id,
      error:     msg,
    })
    return NextResponse.json({ error: 'Failed to write audit log entry', detail: msg }, { status: 500 })
  }
}
