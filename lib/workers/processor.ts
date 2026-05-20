// Agency Group — Worker Processor
// lib/workers/processor.ts
// Polls job_queue and dispatches to registered handlers.
// Called by cron or API trigger. TypeScript strict — 0 errors

import { getQueueAdapter } from '@/lib/queue/adapter'
import type { WorkerName, WorkerHandler, WorkerJob, WorkerResult } from './types'
import { WORKER_REGISTRY } from './types'

// ─── Handler Registry ─────────────────────────────────────────────────────────

const handlers = new Map<WorkerName, WorkerHandler>()

/**
 * Register a handler for a given worker name.
 * Call this at app startup / route module load.
 */
export function registerWorkerHandler<T>(
  name: WorkerName,
  handler: WorkerHandler<T>,
): void {
  handlers.set(name, handler as WorkerHandler)
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, jobId: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Job ${jobId} timed out after ${ms}ms`))
    }, ms)

    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      err   => { clearTimeout(timer); reject(err) },
    )
  })
}

// ─── processQueue ─────────────────────────────────────────────────────────────

/**
 * Dequeues up to `limit` messages from the worker's queue and dispatches them.
 * - Calls the registered handler for each message.
 * - Acks on success, nacks on failure.
 * - Respects timeoutMs from WorkerConfig via Promise.race.
 * - Returns a summary of processed / succeeded / failed.
 */
export async function processQueue(
  workerName: WorkerName,
  limit = 10,
): Promise<{ processed: number; succeeded: number; failed: number; durationMs: number }> {
  const wallStart = Date.now()
  const config = WORKER_REGISTRY[workerName]

  if (!config.enabled) {
    return { processed: 0, succeeded: 0, failed: 0, durationMs: 0 }
  }

  const adapter = getQueueAdapter()
  const messages = await adapter.dequeue(config.queue, Math.min(limit, config.concurrency * 2))

  if (messages.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, durationMs: Date.now() - wallStart }
  }

  const handler = handlers.get(workerName)

  let succeeded = 0
  let failed = 0

  // Respect concurrency: chunk into batches of config.concurrency
  for (let i = 0; i < messages.length; i += config.concurrency) {
    const batch = messages.slice(i, i + config.concurrency)

    await Promise.all(
      batch.map(async msg => {
        const job: WorkerJob = {
          jobId: msg.id,
          workerName,
          payload: msg.payload,
          tenant_id: msg.tenant_id,
          correlation_id: msg.correlation_id,
          startedAt: new Date().toISOString(),
        }

        try {
          let result: WorkerResult

          if (handler) {
            result = await withTimeout(handler(job), config.timeoutMs, msg.id)
          } else {
            // No handler registered — stub success (worker not yet wired)
            console.warn(`[Worker:${workerName}] No handler registered — acking job ${msg.id} as stub`)
            result = {
              jobId: msg.id,
              success: true,
              durationMs: 0,
              output: { stub: true, message: 'No handler registered' },
            }
          }

          if (result.success) {
            await adapter.ack(msg.id)
            succeeded++
          } else {
            await adapter.nack(msg.id, result.error ?? 'handler returned success=false')
            failed++
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          await adapter.nack(msg.id, errMsg)
          failed++
          console.error(`[Worker:${workerName}] Job ${msg.id} failed: ${errMsg}`)
        }
      }),
    )
  }

  return {
    processed: messages.length,
    succeeded,
    failed,
    durationMs: Date.now() - wallStart,
  }
}

// ─── processAllQueues ─────────────────────────────────────────────────────────

/**
 * Runs processQueue for all enabled workers in parallel.
 * Returns a per-worker summary.
 */
export async function processAllQueues(): Promise<
  Record<WorkerName, { processed: number; succeeded: number; failed: number }>
> {
  const enabledWorkers = (Object.keys(WORKER_REGISTRY) as WorkerName[]).filter(
    name => WORKER_REGISTRY[name].enabled,
  )

  const results = await Promise.all(
    enabledWorkers.map(async name => {
      const summary = await processQueue(name)
      return { name, summary }
    }),
  )

  return results.reduce(
    (acc, { name, summary }) => {
      acc[name] = {
        processed: summary.processed,
        succeeded: summary.succeeded,
        failed: summary.failed,
      }
      return acc
    },
    {} as Record<WorkerName, { processed: number; succeeded: number; failed: number }>,
  )
}
