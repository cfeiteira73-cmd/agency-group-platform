// Agency Group — ML Training Worker
// lib/workers/mlTrainingWorker.ts
// Triggers model retraining jobs — checks label count before training.
// TypeScript strict — 0 errors

import { getQueueAdapter } from '@/lib/queue/adapter'
import { trainWithProfitLabels } from '@/lib/ml/retrainTrigger'
import { getExportStats } from '@/lib/ml/trainingDataExporter'
import { modelRegistry } from '@/lib/ml/modelRegistry'
import type { ModelObjective } from '@/lib/ml/modelRegistry'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { NamedWorkerConfig, WorkerHealth } from './workerTypes'

// ─── Job payload ──────────────────────────────────────────────────────────────

export interface MLTrainingJob {
  job_type: 'ml_training'
  tenant_id: string
  model_name: string
  trigger_reason: 'drift_detected' | 'scheduled' | 'manual' | 'new_labels_threshold'
  min_labels?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const VALID_OBJECTIVES = new Set<string>([
  'yield_prediction',
  'conversion_prediction',
  'time_to_close',
  'fraud_detection',
])

function toObjective(name: string): ModelObjective {
  if (VALID_OBJECTIVES.has(name)) return name as ModelObjective
  return 'yield_prediction'
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export class MLTrainingWorker {
  private readonly config: NamedWorkerConfig
  private running = false
  private health: WorkerHealth

  constructor(tenantId: string) {
    this.config = {
      name: 'ml-training-worker',
      queue_name: 'ml_training_jobs',
      batch_size: 1,
      poll_interval_ms: 3_600_000,   // 1 hour
      max_retries: 2,
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

  async processJob(job: { id: string; payload: MLTrainingJob }): Promise<{
    trained: boolean
    auc?: number
    profit_accuracy?: number
  }> {
    const { tenant_id, model_name, trigger_reason, min_labels = 50 } = job.payload

    log.info('[mlTrainingWorker] processing training job', {
      job_id:         job.id,
      model_name,
      trigger_reason,
    })

    // 1. Check label count
    const stats = await getExportStats(tenant_id)

    if (stats.labeled_records < min_labels) {
      log.info('[mlTrainingWorker] insufficient labels — skipping training', {
        labeled_records: stats.labeled_records,
        min_labels,
        model_name,
      })
      return { trained: false }
    }

    // 2. Train
    const objective = toObjective(model_name)
    const result    = await trainWithProfitLabels(tenant_id, objective)

    if (!result) {
      log.warn('[mlTrainingWorker] trainWithProfitLabels returned null', { model_name, tenant_id })
      return { trained: false }
    }

    // 3. Register new model version in registry
    const modelId = randomUUID()

    try {
      await modelRegistry.register({
        tenant_id,
        model_name,
        model_type:            'heuristic',
        objective,
        version:               `1.${stats.labeled_records}.0`,
        status:                'shadow',
        metrics:               {},          // heuristic — no auc_roc yet
        feature_version:       '1.0',
        trained_on_n:          result.trained_on_n,
        training_manifest_id:  null,
        weights_path:          null,
        activated_at:          null,
        retired_at:            null,
      })
    } catch (err) {
      // Registration failure is non-fatal — training succeeded
      log.warn('[mlTrainingWorker] model registration failed', { error: String(err), model_id: modelId })
    }

    // 4. Persist training record
    try {
      await (supabaseAdmin as any)
        .from('ml_training_runs')
        .insert({
          tenant_id,
          model_name,
          model_id:        modelId,
          objective,
          trigger_reason,
          labeled_records: stats.labeled_records,
          profit_accuracy: result.profit_accuracy,
          trained_on_n:    result.trained_on_n,
          status:          'completed',
          completed_at:    new Date().toISOString(),
        })
    } catch (err) {
      log.warn('[mlTrainingWorker] training run persist failed', { error: String(err) })
    }

    log.info('[mlTrainingWorker] training complete', {
      model_name,
      model_id:        modelId,
      profit_accuracy: result.profit_accuracy,
      trained_on_n:    result.trained_on_n,
    })

    return {
      trained:         true,
      profit_accuracy: result.profit_accuracy,
    }
  }

  // ─── Polling loop ─────────────────────────────────────────────────────────

  async runLoop(): Promise<void> {
    this.running = true
    this.health.status     = 'running'
    this.health.started_at = new Date().toISOString()
    await this.persistHealth()

    log.info('[mlTrainingWorker] started', { tenant_id: this.config.tenant_id })

    while (this.running) {
      try {
        const adapter  = getQueueAdapter()
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

          const payload = msg.payload as MLTrainingJob
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
              log.error('[mlTrainingWorker] job error', err instanceof Error ? err : new Error(errMsg), {
                job_id:     msg.id,
                attempt,
                model_name: payload.model_name,
              })

              if (attempt < this.config.max_retries) {
                this.health.jobs_retried++
                await sleep(Math.pow(2, attempt) * 5_000)
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
        log.error('[mlTrainingWorker] loop error', err instanceof Error ? err : new Error(errMsg), {})
        this.health.status     = 'error'
        this.health.last_error = errMsg
        await this.persistHealth()
        await sleep(this.config.poll_interval_ms)
      }
    }

    this.health.status     = 'stopped'
    this.health.updated_at = new Date().toISOString()
    await this.persistHealth()
    log.info('[mlTrainingWorker] stopped', { tenant_id: this.config.tenant_id })
  }

  stop(): void {
    this.running = false
  }

  getHealth(): WorkerHealth {
    return { ...this.health }
  }

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
      log.warn('[mlTrainingWorker] persistHealth failed', { error: String(err) })
    }
  }
}

export function createMLTrainingWorker(tenantId: string): MLTrainingWorker {
  return new MLTrainingWorker(tenantId)
}
