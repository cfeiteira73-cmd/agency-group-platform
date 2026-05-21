// app/api/billing/usage/route.ts
// GET /api/billing/usage?tenant_id=...&from=...&to=...
// Returns usage summary for a tenant (Stripe-compatible format)
// Auth: Bearer INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { aggregateTenantUsage, getAllTenantsUsage } from '@/lib/billing/stripeReporter'
import { safeCompare } from '@/lib/safeCompare'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const s = process.env.INTERNAL_API_SECRET
  return !!s && safeCompare(token, s)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp       = req.nextUrl.searchParams
  const tenantId = sp.get('tenant_id')
  const from     = sp.get('from') ?? undefined
  const to       = sp.get('to')   ?? undefined
  const all      = sp.get('all')  === 'true'

  try {
    if (all) {
      const summaries = await getAllTenantsUsage(from, to)
      return NextResponse.json({ summaries, count: summaries.length })
    }

    const tid = tenantId ?? process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? 'agency-group'
    const summary = await aggregateTenantUsage(tid, from, to)
    return NextResponse.json({ summary })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
