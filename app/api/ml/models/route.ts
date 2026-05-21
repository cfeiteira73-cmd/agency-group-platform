// Agency Group — ML Models API
// app/api/ml/models/route.ts
// Auth: INTERNAL_API_SECRET Bearer
// TypeScript strict — 0 errors
//
// GET /api/ml/models?objective=yield_prediction
//   Returns version history for the given objective.

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { modelRegistry } from '@/lib/ml/modelRegistry'
import type { ModelObjective } from '@/lib/ml/modelRegistry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_OBJECTIVES = new Set<ModelObjective>([
  'yield_prediction',
  'conversion_prediction',
  'time_to_close',
  'fraud_detection',
])

function isAuthorized(req: NextRequest): boolean {
  const token  = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )

  const url       = new URL(req.url)
  const objective = url.searchParams.get('objective') as ModelObjective | null

  if (!objective || !VALID_OBJECTIVES.has(objective)) {
    return NextResponse.json(
      { error: `objective must be one of: ${Array.from(VALID_OBJECTIVES).join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const history = await modelRegistry.getVersionHistory(tenantId, objective)

    return NextResponse.json({
      objective,
      models:     history,
      total:      history.length,
      active:     history.find(m => m.status === 'active') ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/ml/models] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
