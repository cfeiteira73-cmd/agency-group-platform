// Agency Group — ML Training API
// app/api/ml/training/route.ts
// Auth: INTERNAL_API_SECRET Bearer
// TypeScript strict — 0 errors
//
// POST /api/ml/training   — trigger retrain job
// GET  /api/ml/training   — list last 10 retrain jobs

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAndTriggerRetrain, executeRetrainJob } from '@/lib/ml/retrainTrigger'
import type { ModelObjective } from '@/lib/ml/modelRegistry'

export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const token  = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  return !!secret && safeCompare(token, secret)
}

// ---------------------------------------------------------------------------
// POST /api/ml/training
// Body: { objective?: ModelObjective, force?: boolean }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )

  let body: { objective?: ModelObjective; force?: boolean } = {}
  try {
    body = await req.json() as { objective?: ModelObjective; force?: boolean }
  } catch {
    // Body is optional — use defaults
  }

  try {
    const result = await checkAndTriggerRetrain(tenantId)

    // If already triggered and force=true, execute synchronously in the same request
    // (only safe for short in-process training runs — not for external trainer)
    if (result.triggered && result.job && body.force === true && !process.env.TRAINING_ENDPOINT) {
      await executeRetrainJob(result.job)
    }

    return NextResponse.json({
      triggered: result.triggered,
      reason:    result.reason,
      job_id:    result.job?.job_id ?? null,
      objective: body.objective ?? 'yield_prediction',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ml/training] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/ml/training
// Returns last 10 retrain jobs with status
// ---------------------------------------------------------------------------

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
  const jobId     = url.searchParams.get('job_id')
  const objective = url.searchParams.get('objective') as ModelObjective | null

  try {
    if (jobId) {
      // Single job lookup
      const { data, error } = await (supabaseAdmin as any)
        .from('retrain_jobs')
        .select('*')
        .eq('job_id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!data) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      return NextResponse.json({ job: data })
    }

    // List last 10 jobs
    let query = (supabaseAdmin as any)
      .from('retrain_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (objective) {
      query = query.eq('objective', objective)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/ml/training] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
