// =============================================================================
// Agency Group — Delta Ingestion Cron
// POST /api/cron/delta-ingestion
//
// Runs daily delta ingestion from Casafari + Idealista.
// Fetches only properties updated since last_ingested_at (stored in
// ingestion_log table). Updates last_ingested_at on success.
//
// Schedule: 0 6 * * * (6:00 UTC daily) — see vercel.json
//
// Flow:
//   1. Load last_ingested_at from ingestion_log (latest successful delta run)
//   2. Call runDeltaIngestion(tenantId, sinceTimestamp)
//   3. Update ingestion_log with new last_ingested_at on success
//   4. Return stats JSON
//
// Auth: CRON_SECRET (x-cron-secret header or Authorization: Bearer)
// Max duration: 300s (Vercel Pro)
//
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import { runDeltaIngestion }         from '@/lib/ingestion/canonicalPipeline'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ─── Auth helper ─────────────────────────────────────────────────────────────

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()

  if (!token) return false

  // Constant-time comparison to prevent timing attacks
  try {
    const { timingSafeEqual } = require('crypto') as typeof import('crypto')
    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return token === secret
  }
}

// ─── GET last ingested timestamp ─────────────────────────────────────────────

async function getLastIngestedAt(tenantId: string): Promise<string> {
  // Check ingestion_runs for last completed delta
  const { data } = await supabaseAdmin
    .from('ingestion_runs')
    .select('last_source_timestamp, completed_at')
    .eq('tenant_id', tenantId)
    .eq('run_type', 'delta')
    .eq('status', 'completed')
    .not('last_source_timestamp', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.last_source_timestamp) {
    return data.last_source_timestamp as string
  }

  // Fallback: also check legacy ingestion_log for migration compatibility
  const { data: legacyLog } = await supabaseAdmin
    .from('ingestion_log')
    .select('started_at')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (legacyLog?.started_at) {
    return legacyLog.started_at as string
  }

  // First run: 24 hours ago
  return new Date(Date.now() - 24 * 3_600_000).toISOString()
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()

  const tenantId =
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'

  // ── Load last ingested timestamp ──────────────────────────────────────────
  let sinceTimestamp: string
  try {
    sinceTimestamp = await getLastIngestedAt(tenantId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[delta-ingestion] getLastIngestedAt error:', msg)
    sinceTimestamp = new Date(Date.now() - 24 * 3_600_000).toISOString()
  }

  console.log(`[delta-ingestion] Starting delta from ${sinceTimestamp} for tenant ${tenantId}`)

  // ── Run delta ingestion ────────────────────────────────────────────────────
  let result: { casafari: number; idealista: number; total_processed: number }
  let runStatus: 'success' | 'partial' | 'error' = 'success'
  let errorMessage: string | null = null

  try {
    result = await runDeltaIngestion(tenantId, sinceTimestamp)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[delta-ingestion] runDeltaIngestion error:', msg)
    runStatus    = 'error'
    errorMessage = msg
    result       = { casafari: 0, idealista: 0, total_processed: 0 }
  }

  const completedAt = new Date().toISOString()
  const durationMs  = Date.now() - new Date(startedAt).getTime()

  // ── Update ingestion_log on success ───────────────────────────────────────
  if (runStatus === 'success') {
    try {
      await supabaseAdmin
        .from('ingestion_log')
        .insert({
          run_id:       `delta-${Date.now()}`,
          provider:     'delta_ingestion',
          fetched:      result.casafari + result.idealista,
          new_listings: result.total_processed,
          updated:      0,
          duplicates:   0,
          started_at:   startedAt,
          duration_ms:  durationMs,
          errors:       null,
        })
    } catch (logErr) {
      // Non-fatal — log but don't fail the response
      console.warn('[delta-ingestion] ingestion_log insert error:', logErr)
    }
  } else if (runStatus === 'error') {
    result.casafari = 0
    result.idealista = 0
    result.total_processed = 0
  }

  // ── Log to automations_log ─────────────────────────────────────────────────
  void supabaseAdmin
    .from('automations_log')
    .insert({
      workflow_name: 'delta_ingestion',
      trigger_type:  'cron',
      status:        runStatus,
      started_at:    startedAt,
      completed_at:  completedAt,
      duration_ms:   durationMs,
      outcome: {
        casafari_enqueued:  result.casafari,
        idealista_enqueued: result.idealista,
        total_processed:    result.total_processed,
        since:              sinceTimestamp,
      },
      error_message: errorMessage,
    })
    .then(({ error }) => {
      if (error) console.warn('[delta-ingestion] automations_log insert error:', error.message)
    })

  return NextResponse.json(
    {
      ok:              runStatus !== 'error',
      status:          runStatus,
      since:           sinceTimestamp,
      started_at:      startedAt,
      completed_at:    completedAt,
      duration_ms:     durationMs,
      casafari:        result.casafari,
      idealista:       result.idealista,
      total_processed: result.total_processed,
      error:           errorMessage,
    },
    { status: runStatus === 'error' ? 500 : 200 },
  )
}

// Also support GET for Vercel cron (which may send GET)
export { POST as GET }
