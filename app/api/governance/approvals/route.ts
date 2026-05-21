// app/api/governance/approvals/route.ts
//
// GET  /api/governance/approvals?tenant_id=xxx  → list pending approvals
// POST /api/governance/approvals                → create approval request
//
// Auth:
//   GET  — Bearer INTERNAL_API_SECRET or ADMIN_SECRET
//   POST — Bearer ADMIN_SECRET or ADMIN_TOKENS (admin-only; approval creation
//           is a high-risk mutating operation)

import { timingSafeEqual }  from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  listPendingApprovals,
  requestApproval,
} from '@/lib/governance/approvalFlow'
import type { ApprovalRisk } from '@/lib/governance/approvalFlow'

export const dynamic = 'force-dynamic'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Constant-time string comparison — safe against timing attacks. */
function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/** Extracts the Bearer token from the Authorization header, or empty string. */
function extractBearer(req: NextRequest): string {
  const auth = req.headers.get('authorization') ?? ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : ''
}

/** Basic auth check: accepts INTERNAL_API_SECRET or ADMIN_SECRET. */
function isAuthorized(req: NextRequest): boolean {
  const token = extractBearer(req)
  if (!token) return false
  const s1 = process.env.INTERNAL_API_SECRET
  const s2 = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

/**
 * Admin-only check: accepts ADMIN_SECRET or any token in ADMIN_TOKENS
 * (comma-separated list in env).
 *
 * Used for mutating operations (POST) that create or act on approval requests.
 */
function hasAdminAccess(req: NextRequest): boolean {
  const token       = extractBearer(req)
  if (!token) return false
  const adminSecret = process.env.ADMIN_SECRET
  const adminTokens = (process.env.ADMIN_TOKENS ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
  return (
    (!!adminSecret && safeCompare(token, adminSecret)) ||
    adminTokens.some(t => safeCompare(token, t))
  )
}

// ─── GET — list pending approvals ────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')
    ?? process.env.DEFAULT_TENANT_ID
    ?? process.env.SYSTEM_ORG_ID
    ?? 'agency-group'

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit      = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50

  const approvals = await listPendingApprovals(tenantId, limit)

  return NextResponse.json({ approvals, count: approvals.length, tenant_id: tenantId })
}

// ─── POST — create approval request ──────────────────────────────────────────

interface ApprovalRequestBody {
  tenant_id:     string
  actor_id:      string
  action_type:   string
  resource_type: string
  resource_id?:  string | null
  risk_level:    ApprovalRisk
  description:   string
  context?:      Record<string, unknown>
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Approval creation is a high-risk mutating operation — require admin access.
  if (!hasAdminAccess(req)) {
    return NextResponse.json(
      { error: 'Forbidden: admin access required for approval operations' },
      { status: 403 },
    )
  }

  let body: ApprovalRequestBody
  try {
    body = (await req.json()) as ApprovalRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  const required: (keyof ApprovalRequestBody)[] = [
    'tenant_id', 'actor_id', 'action_type', 'resource_type', 'risk_level', 'description',
  ]
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 422 })
    }
  }

  if (body.risk_level !== 'critical' && body.risk_level !== 'high') {
    return NextResponse.json(
      { error: 'risk_level must be "critical" or "high"' },
      { status: 422 }
    )
  }

  const approval_id = await requestApproval({
    tenant_id:     body.tenant_id,
    actor_id:      body.actor_id,
    action_type:   body.action_type,
    resource_type: body.resource_type,
    resource_id:   body.resource_id ?? null,
    risk_level:    body.risk_level,
    description:   body.description,
    context:       body.context ?? {},
  })

  return NextResponse.json({ approval_id }, { status: 201 })
}
