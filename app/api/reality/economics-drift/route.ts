// =============================================================================
// Agency Group — Reality: Economics Drift API
// app/api/reality/economics-drift/route.ts
//
// GET /api/reality/economics-drift?tenant_id=xxx
//   Returns the EconomicDriftProfile for the given tenant.
//   Auth: Bearer token via REALITY_API_SECRET env var.
//
// TypeScript strict — 0 errors
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server'
import { getEconomicDriftProfile }        from '@/lib/reality/economicsDriftEngine'
import { safeCompare }                    from '@/lib/safeCompare'

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function verifyBearer(request: NextRequest): boolean {
  const secret = process.env.REALITY_API_SECRET
  if (!secret) return false   // no secret configured → block all

  const authHeader = request.headers.get('authorization') ?? ''
  const [scheme, token] = authHeader.split(' ')
  return scheme === 'Bearer' && !!token && safeCompare(token, secret)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { searchParams } = request.nextUrl
  const tenantId = searchParams.get('tenant_id')

  if (!tenantId || tenantId.trim() === '') {
    return badRequest('tenant_id query parameter is required')
  }

  try {
    const profile = await getEconomicDriftProfile(tenantId.trim())
    return NextResponse.json(profile)
  } catch (err) {
    console.error('[EconomicsDrift API] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
