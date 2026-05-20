// app/api/billing/economics/route.ts
// GET /api/billing/economics?tenant_id=xxx&period_start=...&period_end=...
//
// Returns TenantEconomics JSON for a given tenant + optional period.
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
//
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { getCachedTenantEconomics } from '@/lib/billing/economicsCache'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const internal = process.env.INTERNAL_API_SECRET
  const admin    = process.env.ADMIN_SECRET
  if (internal && auth === `Bearer ${internal}`) return true
  if (admin    && auth === `Bearer ${admin}`)    return true
  return false
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp           = req.nextUrl.searchParams
  const tenantId     = sp.get('tenant_id')
  const periodStart  = sp.get('period_start') ?? undefined
  const periodEnd    = sp.get('period_end')   ?? undefined

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  try {
    const economics = await getCachedTenantEconomics(tenantId, periodStart, periodEnd)
    return NextResponse.json(economics)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
