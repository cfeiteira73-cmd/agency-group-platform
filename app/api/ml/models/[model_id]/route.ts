// Agency Group — ML Model Detail API
// app/api/ml/models/[model_id]/route.ts
// Auth: INTERNAL_API_SECRET Bearer
// TypeScript strict — 0 errors
//
// GET /api/ml/models/:model_id — full model details

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isAuthorized(req: NextRequest): boolean {
  const token  = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

export async function GET(
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
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('*')
      .eq('id', model_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    return NextResponse.json({ model: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/ml/models/[model_id]] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
