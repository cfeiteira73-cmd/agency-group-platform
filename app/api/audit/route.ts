// app/api/audit/route.ts
// GET /api/audit?tenant_id=...&limit=50&offset=0&risk_level=high
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { queryAuditLog, getAuditRiskSummary } from '@/lib/audit/auditLogger'
import type { AuditQueryFilter } from '@/lib/audit/auditTypes'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1 = process.env.INTERNAL_API_SECRET
  const s2 = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const tenantId = sp.get('tenant_id') ?? req.headers.get('x-tenant-id') ?? 'agency-group'

  const filter: AuditQueryFilter = {
    tenant_id:     tenantId,
    actor_id:      sp.get('actor_id')      ?? undefined,
    action:        sp.get('action')        ?? undefined,
    resource_type: sp.get('resource_type') ?? undefined,
    resource_id:   sp.get('resource_id')   ?? undefined,
    result:        (sp.get('result')       as AuditQueryFilter['result'])      ?? undefined,
    risk_level:    (sp.get('risk_level')   as AuditQueryFilter['risk_level'])  ?? undefined,
    from_date:     sp.get('from_date')     ?? undefined,
    to_date:       sp.get('to_date')       ?? undefined,
    limit:         sp.get('limit')  ? parseInt(sp.get('limit')!)  : 50,
    offset:        sp.get('offset') ? parseInt(sp.get('offset')!) : 0,
  }

  const [{ records, total }, summary] = await Promise.all([
    queryAuditLog(filter),
    getAuditRiskSummary(tenantId),
  ])

  return NextResponse.json({
    records,
    total,
    summary,
    filter: { ...filter, tenant_id: tenantId },
  })
}
