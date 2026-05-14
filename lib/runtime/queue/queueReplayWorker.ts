// AGENCY GROUP — SH-ROS Queue: queueReplayWorker | AMI: 22506
// Background replay worker — processes DLQ events and retries them up to MAX_RETRIES.

import { supabaseAdmin } from '@/lib/supabase'
import { MAX_RETRIES } from '@/lib/runtime/types'
import type { RuntimeEvent } from '@/lib/runtime/types'
import { queueProvider } from './queueProvider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Worker config ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000 // 30 seconds
const BATCH_SIZE = 20

// ─── WorkerStatus ─────────────────────────────────────────────────────────────

interface WorkerStatus {
  running: boolean
  replayed_total: number
  errors_total: number
  last_run_at: string | null
}

// ─── QueueReplayWorker ────────────────────────────────────────────────────────

export class QueueReplayWorker {
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private status: WorkerStatus = {
    running: false,
    replayed_total: 0,
    errors_total: 0,
    last_run_at: null,
  }

  // ── start ──────────────────────────────────────────────────────────────────

  start(): void {
    if (this.status.running) return

    this.status.running = true
    // Immediate first run, then on interval
    void this.processBatch()

    this.intervalHandle = setInterval(() => {
      void this.processBatch()
    }, POLL_INTERVAL_MS)

    console.log('[QueueReplayWorker] Started — polling every', POLL_INTERVAL_MS, 'ms')
  }

  // ── stop ───────────────────────────────────────────────────────────────────

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    this.status.running = false
    console.log('[QueueReplayWorker] Stopped')
  }

  // ── isRunning ──────────────────────────────────────────────────────────────

  isRunning(): boolean {
    return this.status.running
  }

  // ── getStatus ─────────────────────────────────────────────────────────────

  getStatus(): WorkerStatus {
    return { ...this.status }
  }

  // ── processBatch ──────────────────────────────────────────────────────────

  private async processBatch(): Promise<void> {
    this.status.last_run_at = new Date().toISOString()

    try {
      // Fetch DLQ events that have not exceeded MAX_RETRIES
      const { data, error } = await sb
        .from('runtime_events')
        .select('*')
        .eq('status', 'dlq')
        .lt('retry_count', MAX_RETRIES)
        .order('priority_weight', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(BATCH_SIZE)

      if (error) throw error
      if (!data || data.length === 0) return

      for (const row of data as Record<string, unknown>[]) {
        try {
          const event: RuntimeEvent = {
            event_id: row['event_id'] as string,
            org_id: row['org_id'] as string,
            type: row['type'] as RuntimeEvent['type'],
            timestamp: row['timestamp'] as string,
            correlation_id: row['correlation_id'] as string,
            priority: row['priority'] as RuntimeEvent['priority'],
            retry_count: ((row['retry_count'] as number) ?? 0) + 1,
            payload: row['payload'] as RuntimeEvent['payload'],
            metadata: row['metadata'] as RuntimeEvent['metadata'],
          }

          // Reset to pending in DB first (persist-before-execute)
          const { error: resetErr } = await sb
            .from('runtime_events')
            .update({
              status: 'pending',
              retry_count: event.retry_count,
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('event_id', event.event_id)
            .eq('status', 'dlq') // guard against concurrent reset

          if (resetErr) {
            console.error('[QueueReplayWorker] Failed to reset event to pending:', resetErr)
            this.status.errors_total++
            continue
          }

          // Re-enqueue via current provider
          await queueProvider.enqueue(event)
          this.status.replayed_total++

        } catch (eventErr) {
          console.error('[QueueReplayWorker] Error processing DLQ event:', row['event_id'], eventErr)
          this.status.errors_total++

          // Mark as exhausted if we keep failing
          await sb
            .from('runtime_events')
            .update({
              status: 'dlq',
              last_error: eventErr instanceof Error ? eventErr.message : String(eventErr),
              updated_at: new Date().toISOString(),
            })
            .eq('event_id', row['event_id'] as string)
            .catch((err: unknown) => {
              console.error('[QueueReplayWorker] Failed to update error state:', err)
            })
        }
      }

      if (data.length > 0) {
        console.log(`[QueueReplayWorker] Processed ${data.length} DLQ events`)
      }

    } catch (err) {
      console.error('[QueueReplayWorker] processBatch error:', err)
      this.status.errors_total++
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queueReplayWorker = new QueueReplayWorker()
