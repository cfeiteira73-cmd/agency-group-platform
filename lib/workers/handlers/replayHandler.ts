// Agency Group — Replay Worker Handler
// lib/workers/handlers/replayHandler.ts
//
// Replays events from event_history in chronological order.
// Supports dry-run mode (count only) and batching (max 100 per job).
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { eventBus } from '@/lib/events/bus'
import type { AnyPlatformEvent } from '@/lib/events/types'
import type { WorkerJob, WorkerResult } from '../types'

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface ReplayJobPayload {
  from_event_id?: string
  entity_type?:   string
  tenant_id:      string
  dry_run?:       boolean
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const MAX_BATCH = 100

export async function replayHandler(
  job: WorkerJob<ReplayJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const { from_event_id, entity_type, tenant_id, dry_run = false } = job.payload

  try {
    // 1. Build query
    let query = (supabaseAdmin as any)
      .from('event_history')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: true })
      .limit(MAX_BATCH)

    if (entity_type) {
      query = query.eq('event_type', entity_type)
    }

    if (from_event_id) {
      // Fetch the cursor event's created_at so we can use it as a range filter
      const { data: cursorRow } = await (supabaseAdmin as any)
        .from('event_history')
        .select('created_at')
        .eq('event_id', from_event_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      if (cursorRow?.created_at) {
        query = query.gte('created_at', cursorRow.created_at as string)
      }
    }

    const { data: events, error: fetchErr } = await query

    if (fetchErr) {
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      `event_history fetch failed: ${fetchErr.message}`,
      }
    }

    const rows = (events ?? []) as Array<Record<string, unknown>>

    // 2. Replay events
    let replayed = 0
    for (const row of rows) {
      if (dry_run) {
        // Dry run: just count and log
        console.log(`[replayHandler][dry-run] would replay event_id=${row.event_id} type=${row.event_type}`)
        replayed++
        continue
      }

      try {
        // Re-publish the stored event payload through the event bus
        const eventPayload = (row.payload ?? row) as AnyPlatformEvent
        await eventBus.publish(eventPayload)
        replayed++
      } catch (publishErr) {
        // Log but continue — partial replays are better than none
        console.warn(
          `[replayHandler] publish failed for event_id=${row.event_id}:`,
          publishErr instanceof Error ? publishErr.message : String(publishErr),
        )
      }
    }

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output: {
        events_found:    rows.length,
        events_replayed: replayed,
        dry_run,
        tenant_id,
        entity_type:     entity_type ?? null,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[replayHandler] unexpected error for job ${job.jobId}:`, msg)
    return {
      jobId:      job.jobId,
      success:    false,
      durationMs: Date.now() - start,
      error:      msg,
    }
  }
}
