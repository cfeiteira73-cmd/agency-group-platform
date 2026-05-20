// app/api/billing/cost-model/route.ts
// GET /api/billing/cost-model?tenant_id=...&from=...&to=...

import { NextRequest, NextResponse } from 'next/server'
import { computeTenantCostBreakdown } from '@/lib/billing/costModelEngine'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s = process.env.INTERNAL_API_SECRET
  return !!s && safeCompare(token, s)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp       = req.nextUrl.searchParams
  const tenantId = sp.get('tenant_id') ?? req.headers.get('x-tenant-id') ?? 'agency-group'
  const from     = sp.get('from') ?? undefined
  const to       = sp.get('to')   ?? undefined
  const breakdown = await computeTenantCostBreakdown(tenantId, from, to)
  return NextResponse.json({ breakdown })
}
