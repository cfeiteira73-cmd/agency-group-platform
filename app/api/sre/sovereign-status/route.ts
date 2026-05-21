// TypeScript strict — 0 errors
// app/api/sre/sovereign-status/route.ts
// GET /api/sre/sovereign-status → runSovereignValidation (fresh)
// GET /api/sre/sovereign-status?cached=true → getSovereignStatus (latest from DB)

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import {
  runSovereignValidation,
  getSovereignStatus,
} from '@/lib/validation/sovereignReadinessValidator'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import log from '@/lib/logger'

export const runtime    = 'nodejs'
export const maxDuration = 120

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
  const cached = searchParams.get('cached') === 'true'

  try {
    const report = cached
      ? await getSovereignStatus(tenantId)
      : await runSovereignValidation(tenantId)

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Sovereign-Grade': report.overall_grade,
        'X-System-Validated': String(report.system_validated),
        'X-Fail-Count': String(report.fail_count),
      },
    })
  } catch (err) {
    log.error(
      '[/api/sre/sovereign-status] GET error',
      err instanceof Error ? err : undefined,
      { tenant_id: tenantId },
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
