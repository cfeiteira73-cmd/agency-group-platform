// =============================================================================
// AGENCY GROUP — DLQ Auto-Replay Cron
// GET /api/cron/replay-dlq
//
// Automatically retries failed events from the Dead Letter Queue.
// Runs every 15 minutes via Vercel Cron.
// Events are retried up to MAX_RETRIES times with exponential backoff.
// After MAX_RETRIES exhausted, event is marked 'dead' — no further retries.
//
// DLQ detection: learning_events WHERE metadata->>'dlq' = 'true'
//                AND (metadata->>'dlq_retries')::int < 3
//                AND created_at < NOW() - INTERVAL '5 minutes'
//
// AMI: 22506 | SH-ROS Event Infrastructure
// Vercel cron: */15 * * * *
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { withCronLock } from '@/lib/ops/withCronLock'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_RETRIES = 3
const POISON_THRESHOLD = MAX_RETRIES  // events at or above this are permanently dead
const MIN_AGE_MINUTES = 5             // don't retry events < 5 minutes old

export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET only (fail-closed)
  const cronSecret = process.env.CRON_SECRET
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.headers.get('x-cron-secret')
    ?? ''

  if (!cronSecret || !safeCompare(secret, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lockResult = await withCronLock('replay-dlq', 2, async () => {
  const corrId = req.headers.get('x-correlation-id') ?? crypto.randomUUID()
  const startedAt = Date.now()
  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString()

  // ─── Fetch DLQ candidates ────────────────────────────────────────────────────
  const { data: dlqEvents, error: fetchError } = await supabaseAdmin
    .from('learning_events')
    .select('id, event_type, source_system, metadata, created_at')
    .lt('created_at', cutoff)
    .filter('metadata->>dlq', 'eq', 'true')
    .order('created_at', { ascending: true })
    .limit(50)

  if (fetchError) {
    console.error('[DLQ] Failed to fetch DLQ events', { corrId, error: fetchError.message })
    return NextResponse.json({ error: 'Failed to fetch DLQ', corrId }, { status: 500 })
  }

  if (!dlqEvents || dlqEvents.length === 0) {
    return NextResponse.json({ success: true, processed: 0, corrId, durationMs: Date.now() - startedAt })
  }

  const results = { retried: 0, dead: 0, skipped: 0, errors: 0 }

  for (const row of dlqEvents) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (row.metadata ?? {}) as Record<string, any>
    const retries = typeof meta.dlq_retries === 'number' ? meta.dlq_retries : 0

    // ─── Poison event: exceeded max retries ─────────────────────────────────
    if (retries >= POISON_THRESHOLD) {
      console.warn('[DLQ] Poison event — marking dead', {
        corrId, id: row.id, event_type: row.event_type, retries,
      })
      await supabaseAdmin
        .from('learning_events')
        .update({ metadata: { ...meta, dlq_dead: true, dlq_dead_at: new Date().toISOString() } })
        .eq('id', row.id)
      results.dead++
      continue
    }

    // ─── Exponential backoff check ───────────────────────────────────────────
    // Retry 1: after 5 min, Retry 2: after 15 min, Retry 3: after 45 min
    if (meta.dlq_next_retry_at) {
      const nextRetry = new Date(meta.dlq_next_retry_at as string).getTime()
      if (Date.now() < nextRetry) {
        results.skipped++
        continue
      }
    }

    // ─── Attempt replay by re-inserting the original event ──────────────────
    try {
      const eventPayload = {
        event_type:     row.event_type,
        source_system:  (row.source_system ?? 'agent') as 'agent' | 'api' | 'n8n' | 'cron' | 'engine',
        correlation_id: corrId,
        metadata: {
          ...(meta.payload ? { payload: meta.payload } : {}),
          event_id:       meta.event_id ?? crypto.randomUUID(),
          schema_version: meta.schema_version ?? '1.0',
          occurred_at:    meta.occurred_at ?? row.created_at,
          replayed_from_dlq: true,
          original_dlq_id:   row.id,
        },
        created_at: new Date().toISOString(),
      }

      const { error: replayError } = await supabaseAdmin
        .from('learning_events')
        .insert(eventPayload)

      if (replayError) {
        throw new Error(replayError.message)
      }

      // ─── Update DLQ record: increment retries, schedule next if needed ────
      const nextRetryDelayMs = Math.pow(3, retries + 1) * 5 * 60 * 1000 // 5min, 15min, 45min
      await supabaseAdmin
        .from('learning_events')
        .update({
          metadata: {
            ...meta,
            dlq_retries: retries + 1,
            dlq_last_retry_at: new Date().toISOString(),
            dlq_next_retry_at: new Date(Date.now() + nextRetryDelayMs).toISOString(),
            dlq_replayed_by: `cron:${corrId}`,
          },
        })
        .eq('id', row.id)

      console.log('[DLQ] Replayed event', {
        corrId, id: row.id, event_type: row.event_type, attempt: retries + 1,
      })
      results.retried++

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[DLQ] Replay failed', { corrId, id: row.id, event_type: row.event_type, error: msg })

      // Update retry metadata even on failure so backoff is respected
      const nextRetryDelayMs = Math.pow(3, retries + 1) * 5 * 60 * 1000
      await supabaseAdmin
        .from('learning_events')
        .update({
          metadata: {
            ...meta,
            dlq_retries: retries + 1,
            dlq_last_retry_at: new Date().toISOString(),
            dlq_next_retry_at: new Date(Date.now() + nextRetryDelayMs).toISOString(),
            dlq_last_error: msg,
          },
        })
        .eq('id', row.id)

      results.errors++
    }
  }

  const durationMs = Date.now() - startedAt
  console.log('[DLQ] Replay run complete', { corrId, ...results, durationMs })

  return NextResponse.json({
    success: true,
    corrId,
    processed: dlqEvents.length,
    ...results,
    durationMs,
  })
  }) // end withCronLock

  if (lockResult === null) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }
  return lockResult
}
