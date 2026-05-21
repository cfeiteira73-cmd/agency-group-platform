// Agency Group — Ingestion Worker
// lib/workers/ingestionWorker.ts
// Processes delta ingestion jobs from Casafari / Idealista / CRM.
// TypeScript strict — 0 errors

import { getQueueAdapter } from '@/lib/queue/adapter'
import { runDeltaIngestion } from '@/lib/ingestion/canonicalPipeline'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { NamedWorkerConfig, WorkerHealth } from './workerTypes'

// ─── Job payload ──────────────────────────────────────────────────────────────

export interface IngestionJob {
  job_type: 'ingestion'
  source: 'casafari' | 'idealista' | 'crm' | 'manual'
  tenant_id: string
  since?: string
  batch_limit?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── Worker ───────────────────────────────────────────────────────────────────

export class IngestionWorker {
  private readonly config: NamedWorkerConfig
  private running = false
  private health: WorkerHealth

  constructor(tenantId: string) {
    this.config = {
      name: 'ingestion-worker',
      queue_name: 'ingestion_jobs',
      batch_size: 5,
      poll_interval_ms: 30_000,
      max_retries: 3,
      tenant_id: tenantId,
    }

    this.health = {
      worker_name:    this.config.name,
      tenant_id:      tenantId,
      status:         'idle',
      jobs_processed: 0,
      jobs_failed:    0,
      jobs_retried:   0,
      last_job_at:    null,
      last_error:     null,
      started_at:     new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    }
  }

  // ─── Core business logic ──────────────────────────────────────────────────

  async processJob(job: { id: string; payload: IngestionJob }): Promise<{ processed: number; failed: number }> {
    const { source, tenant_id, since } = job.payload
    const sinceTs = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    if (source === 'crm') {
      log.warn('[ingestionWorker] CRM source not yet implemented', { job_id: job.id, source })
      return { processed: 0, failed: 0 }
    }

    if (source === 'manual') {
      log.info('[ingestionWorker] manual source — no-op', { job_id: job.id })
      return { processed: 0, failed: 0 }
    }

    // casafari | idealista → canonical delta ingestion
    const result = await runDeltaIngestion(tenant_id, sinceTs)

    log.info('[ingestionWorker] delta ingestion complete', {
      job_id:          job.id,
      source,
      casafari:        result.casafari,
      idealista:       result.idealista,
      total_processed: result.total_processed,
    })

    return { processed: result.total_processed, failed: 0 }
  }

  // ─── Polling loop ─────────────────────────────────────────────────────────

  async runLoop(): Promise<void> {
    this.running = true
    this.health.status     = 'running'
    this.health.started_at = new Date().toISOString()
    await this.persistHealth()

    log.info('[ingestionWorker] started', { tenant_id: this.config.tenant_id })

    while (this.running) {
      try {
        const adapter = getQueueAdapter()
        const messages = await adapter.dequeue(this.config.queue_name, this.config.batch_size)

        if (messages.length === 0) {
          this.health.status = 'idle'
          await this.persistHealth()
          await sleep(this.config.poll_interval_ms)
          continue
        }

        this.health.status = 'running'

        for (const msg of messages) {
          if (!this.running) break

          const payload = msg.payload as IngestionJob
          let succeeded = false

          for (let attempt = 1; attempt <= this.config.max_retries; attempt++) {
            try {
              await this.processJob({ id: msg.id, payload })
              await adapter.ack(msg.id)
              this.health.jobs_processed++
              this.health.last_job_at = new Date().toISOString()
              succeeded = true
              break
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err)
              log.error('[ingestionWorker] job error', err instanceof Error ? err : new Error(errMsg), {
                job_id:  msg.id,
                attempt,
                source:  payload.source,
              })

              if (attempt < this.config.max_retries) {
                this.health.jobs_retried++
                await sleep(Math.pow(2, attempt) * 1_000)
              }
            }
          }

          if (!succeeded) {
            this.health.jobs_failed++
            this.health.last_error = `job ${msg.id} failed after ${this.config.max_retries} attempts`
            this.health.status     = 'error'
            await (getQueueAdapter()).nack(msg.id, this.health.last_error)
          }
        }

        this.health.updated_at = new Date().toISOString()
        await this.persistHealth()

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        log.error('[ingestionWorker] loop error', err instanceof Error ? err : new Error(errMsg), {})
        this.health.status     = 'error'
        this.health.last_error = errMsg
        await this.persistHealth()
        await sleep(this.config.poll_interval_ms)
      }
    }

    this.health.status     = 'stopped'
    this.health.updated_at = new Date().toISOString()
    await this.persistHealth()
    log.info('[ingestionWorker] stopped', { tenant_id: this.config.tenant_id })
  }

  stop(): void {
    this.running = false
  }

  getHealth(): WorkerHealth {
    return { ...this.health }
  }

  // ─── Persist health to DB ─────────────────────────────────────────────────

  private async persistHealth(): Promise<void> {
    try {
      await (supabaseAdmin as any)
        .from('worker_health')
        .upsert(
          {
            tenant_id:      this.health.tenant_id,
            worker_name:    this.health.worker_name,
            status:         this.health.status,
            jobs_processed: this.health.jobs_processed,
            jobs_failed:    this.health.jobs_failed,
            jobs_retried:   this.health.jobs_retried,
            last_job_at:    this.health.last_job_at,
            last_error:     this.health.last_error,
            started_at:     this.health.started_at,
            updated_at:     new Date().toISOString(),
          },
          { onConflict: 'tenant_id,worker_name' },
        )
    } catch (err) {
      log.warn('[ingestionWorker] persistHealth failed', { error: String(err) })
    }
  }
}

export function createIngestionWorker(tenantId: string): IngestionWorker {
  return new IngestionWorker(tenantId)
}
