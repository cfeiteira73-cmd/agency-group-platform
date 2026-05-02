// =============================================================================
// Agency Group — AVM Batch Compute Cron
// GET /api/cron/avm-compute
// Scheduled: daily at 07:00 UTC (after ingest-listings at 05:00, sync-listings at 06:00)
//
// PIPELINE:
//   1. Fetch active properties with no avm_value_base OR last computed >7 days ago
//   2. For each property: fetch comps from same zone, run AVM engine
//   3. Persist avm_value_low / avm_value_base / avm_value_high / avm_confidence
//   4. Log results to automations_log
//
// WHY SEPARATE FROM SYNC-LISTINGS:
//   AVM computation is expensive (DB reads per property for comps).
//   Keeping it separate allows independent scheduling and rate control.
//   sync-listings (06:00) scores with avm_estimate first pass;
//   avm-compute (07:00) enriches with V2 confidence-adjusted AVM.
//
// AUTH: CRON_SECRET
// MAX DURATION: 300s (Vercel Pro)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { batchComputeAVM }           from '@/lib/valuation/avm'
import { supabaseAdmin }             from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()
  return token === secret
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const t0        = Date.now()

  const { searchParams } = req.nextUrl
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50

  try {
    const { computed, errors } = await batchComputeAVM(limit)
    const durationMs = Date.now() - t0

    // Log to automations_log
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('automations_log')
        .insert({
          workflow_name: 'avm_compute_cron',
          trigger_type:  'cron',
          status:        errors.length === 0 ? 'success' : 'partial',
          started_at:    startedAt,
          completed_at:  new Date().toISOString(),
          duration_ms:   durationMs,
          outcome: { computed, errors_count: errors.length },
          error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
        })
    } catch { /* non-critical */ }

    return NextResponse.json(
      {
        ok:          errors.length === 0,
        computed,
        errors_count: errors.length,
        duration_ms: durationMs,
        ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
      },
      { status: errors.length === 0 ? 200 : 207 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
