// Agency Group — Dead Letter Queue Worker Handler
// lib/workers/handlers/dlqHandler.ts
//
// Processes failed jobs from the DLQ:
//   - Logs the failure
//   - Re-enqueues if retries < 2 (with increased delay)
//   - Emits systemFailure event when retries are exhausted
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { getQueueAdapter } from '@/lib/queue/adapter'
import { emit } from '@/lib/events/producers'
import type { WorkerJob, WorkerResult } from '../types'

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface DlqJobPayload {
  original_job_id:  string
  original_queue:   string
  original_payload: unknown
  failure_reason:   string
  tenant_id:        string
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function dlqHandler(
  job: WorkerJob<DlqJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const {
    original_job_id,
    original_queue,
    original_payload,
    failure_reason,
    tenant_id,
  } = job.payload

  try {
    // 1. Log the DLQ event
    try {
      await (supabaseAdmin as any)
        .from('runtime_events')
        .insert({
          event_type:       'dlq_received',
          job_id:           original_job_id,
          queue:            original_queue,
          failure_reason,
          tenant_id,
          payload:          original_payload as Record<string, unknown>,
          created_at:       new Date().toISOString(),
        })
    } catch (logErr) {
      // runtime_events table may not exist in all environments — fall back to console
      console.error('[dlqHandler] DLQ event received', {
        original_job_id,
        original_queue,
        failure_reason,
        tenant_id,
      })
    }

    // 2. Count previous failures for this job_id in job_queue
    const { count: failureCount, error: countErr } = await (supabaseAdmin as any)
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('id', original_job_id)
      .eq('status', 'failed')

    if (countErr) {
      console.warn(`[dlqHandler] could not count failures for ${original_job_id}:`, countErr.message)
    }

    const retryCount = failureCount ?? 0

    // 3. Decide: retry or overflow
    if (retryCount < 2) {
      // Re-enqueue with linear back-off: 60s × (retry_count + 1)
      const delaySeconds = 60 * (retryCount + 1)

      try {
        await getQueueAdapter().enqueue(
          original_queue,
          original_payload,
          { tenant_id, delay_seconds: delaySeconds },
        )

        console.log(
          `[dlqHandler] re-enqueued job ${original_job_id} to ${original_queue} ` +
          `(retry ${retryCount + 1}/2, delay ${delaySeconds}s)`,
        )
      } catch (enqueueErr) {
        const msg = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)
        console.error(`[dlqHandler] re-enqueue failed for ${original_job_id}:`, msg)
        return {
          jobId:      job.jobId,
          success:    false,
          durationMs: Date.now() - start,
          error:      `re-enqueue failed: ${msg}`,
        }
      }
    } else {
      // Retries exhausted — emit system failure event (fire-and-forget)
      void emit.systemFailure({
        failure_type:            'dlq_overflow',
        component:               original_queue,
        severity:                'P2',
        error_message:           failure_reason,
        error_code:              'DLQ_OVERFLOW',
        auto_recovery_attempted: true,
      })

      console.error(
        `[dlqHandler] DLQ_OVERFLOW: job ${original_job_id} exhausted retries on ${original_queue}`,
        { failure_reason, retry_count: retryCount },
      )
    }

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output: {
        original_job_id,
        original_queue,
        retry_count:   retryCount,
        action:        retryCount < 2 ? 're-enqueued' : 'overflow_emitted',
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[dlqHandler] unexpected error for job ${job.jobId}:`, msg)
    return {
      jobId:      job.jobId,
      success:    false,
      durationMs: Date.now() - start,
      error:      msg,
    }
  }
}
