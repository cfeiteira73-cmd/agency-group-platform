// Agency Group — ML Model Promote API
// app/api/ml/models/[model_id]/promote/route.ts
// Auth: INTERNAL_API_SECRET Bearer
// TypeScript strict — 0 errors
//
// POST /api/ml/models/:model_id/promote — promote model to active

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { modelRegistry } from '@/lib/ml/modelRegistry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const token  = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { model_id: string } },
): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )

  const { model_id } = params

  if (!model_id) {
    return NextResponse.json({ error: 'model_id is required' }, { status: 400 })
  }

  try {
    await modelRegistry.promoteToActive(model_id, tenantId)

    return NextResponse.json({
      success:      true,
      model_id,
      activated_at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ml/models/[model_id]/promote] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
