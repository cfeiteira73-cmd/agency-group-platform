// app/api/compliance/soc2/route.ts
// GET /api/compliance/soc2?tenant_id=...

import { NextRequest, NextResponse } from 'next/server'
import { generateSOC2Report, getAccessControlMatrix } from '@/lib/compliance/soc2Controls'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s1 = process.env.INTERNAL_API_SECRET, s2 = process.env.ADMIN_SECRET
  return (!!s1 && safeCompare(token, s1)) || (!!s2 && safeCompare(token, s2))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
    ?? req.headers.get('x-tenant-id') ?? 'agency-group'
  const [report, matrix] = await Promise.all([
    generateSOC2Report(tenantId),
    Promise.resolve(getAccessControlMatrix()),
  ])
  return NextResponse.json({ report, access_control_matrix: matrix })
}
