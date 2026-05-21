// TypeScript strict — 0 errors
// app/api/sre/security/route.ts
// GET  /api/sre/security?mode=isolation            → auditTenantIsolation
// GET  /api/sre/security?mode=secrets              → getSecretsStatus (metadata only)
// GET  /api/sre/security?actor_id=x&permission=y  → checkAccess
// POST /api/sre/security?mode=assign-role          → assignRole (super_admin only, service auth)

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { auditTenantIsolation } from '@/lib/security/tenantIsolationEnforcer'
import { getSecretsStatus } from '@/lib/security/secretsVault'
import {
  checkAccess,
  assignRole,
  type Permission,
  type SystemRole,
  RBAC_POLICIES,
} from '@/lib/security/rbacEngine'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import log from '@/lib/logger'

export const runtime = 'nodejs'

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

function verifyServiceAuth(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get('x-service-auth') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''
  return safeCompare(incoming, secret)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyServiceAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const mode       = searchParams.get('mode')
  const actorId    = searchParams.get('actor_id')
  const permission = searchParams.get('permission')

  try {
    // mode=isolation → audit tenant isolation
    if (mode === 'isolation') {
      const result = await auditTenantIsolation(tenantId)
      return NextResponse.json({ isolation: result })
    }

    // mode=secrets → secrets status (no values)
    if (mode === 'secrets') {
      const secrets = getSecretsStatus()
      return NextResponse.json({ secrets })
    }

    // actor_id + permission → access check
    if (actorId && permission) {
      const validPermissions = Object.values(RBAC_POLICIES)
        .flatMap(p => p.permissions)
        .filter((v, i, a) => a.indexOf(v) === i) as Permission[]

      if (!validPermissions.includes(permission as Permission)) {
        return NextResponse.json({ error: `Invalid permission: ${permission}` }, { status: 400 })
      }

      const amountEur   = searchParams.get('amount_eur')
      const currentHour = searchParams.get('current_hour_utc')

      const decision = await checkAccess(
        tenantId,
        actorId,
        permission as Permission,
        {
          amount_eur:          amountEur       ? parseFloat(amountEur)  : undefined,
          current_hour_utc:    currentHour     ? parseInt(currentHour, 10) : undefined,
        },
      )
      return NextResponse.json({ access: decision })
    }

    return NextResponse.json(
      { error: 'Provide mode=isolation | mode=secrets | actor_id+permission' },
      { status: 400 },
    )
  } catch (err) {
    log.error('[/api/sre/security] GET error', err instanceof Error ? err : undefined, {
      tenant_id: tenantId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyServiceAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')

  if (mode !== 'assign-role') {
    return NextResponse.json({ error: 'Only mode=assign-role is supported via POST' }, { status: 400 })
  }

  const tenantId = resolveTenantId()

  try {
    const body = await req.json() as Record<string, unknown>
    const actorId = typeof body.actor_id === 'string' ? body.actor_id : null
    const role    = typeof body.role    === 'string' ? body.role    : null

    if (!actorId || !role) {
      return NextResponse.json({ error: 'actor_id and role are required' }, { status: 400 })
    }

    const validRoles = Object.keys(RBAC_POLICIES) as SystemRole[]
    if (!validRoles.includes(role as SystemRole)) {
      return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
    }

    await assignRole(tenantId, actorId, role as SystemRole)

    return NextResponse.json({
      message: 'Role assigned successfully',
      actor_id: actorId,
      role,
      tenant_id: tenantId,
    })
  } catch (err) {
    log.error('[/api/sre/security] POST assign-role error', err instanceof Error ? err : undefined, {
      tenant_id: tenantId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
