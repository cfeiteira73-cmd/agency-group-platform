// Agency Group — ML Model Retire API
// app/api/ml/models/[model_id]/retire/route.ts
// Auth: INTERNAL_API_SECRET Bearer
// TypeScript strict — 0 errors
//
// POST /api/ml/models/:model_id/retire — retire a model

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

  const { model_id } = params

  if (!model_id) {
    return NextResponse.json({ error: 'model_id is required' }, { status: 400 })
  }

  let reason = 'manual retirement'
  try {
    const body = await req.json() as { reason?: string }
    if (body.reason) reason = body.reason
  } catch {
    // reason is optional
  }

  try {
    await modelRegistry.retireModel(model_id, reason)

    return NextResponse.json({
      success:    true,
      model_id,
      reason,
      retired_at: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ml/models/[model_id]/retire] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
