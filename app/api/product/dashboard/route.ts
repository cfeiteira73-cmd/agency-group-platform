// AGENCY GROUP — Product API: Dashboard | AMI: 22506
// GET /api/product/dashboard?org_id=xxx
// Returns full dashboard payload: pipeline + leads + decisions + funnel + daily_target
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { productAPI } from '@/lib/product'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const correlation_id = getRequestCorrelationId(req)

  try {
    // Auth
    const session = await auth()
    const portal  = await isPortalAuth(req)
    if (!session && !portal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const org_id   = searchParams.get('org_id')   ?? 'default'
    const agent_id = searchParams.get('agent_id') ?? 'system'

    const payload = await productAPI.loadDashboard({
      org_id,
      agent_id,
      locale: (searchParams.get('locale') as 'pt' | 'en') ?? 'en',
    })

    return NextResponse.json(payload, {
      headers: {
        'X-Correlation-ID': correlation_id,
        'Cache-Control':    'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Dashboard load failed', detail: String(err), correlation_id },
      { status: 500 }
    )
  }
}
