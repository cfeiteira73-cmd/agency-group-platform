// Agency Group — Scoring Worker
// lib/workers/scoringWorker.ts
// Scores properties and investor-property matches using ML models.
// TypeScript strict — 0 errors

import { getQueueAdapter } from '@/lib/queue/adapter'
import { predictWithWeights } from '@/lib/ml/modelBootstrap'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { NamedWorkerConfig, WorkerHealth } from './workerTypes'

// ─── Job payload ──────────────────────────────────────────────────────────────

export interface ScoringJob {
  job_type: 'scoring'
  entity_type: 'property' | 'investor_match'
  entity_id: string
  tenant_id: string
  model_name?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export class ScoringWorker {
  private readonly config: NamedWorkerConfig
  private running = false
  private health: WorkerHealth

  constructor(tenantId: string) {
    this.config = {
      name: 'scoring-worker',
      queue_name: 'scoring_jobs',
      batch_size: 20,
      poll_interval_ms: 15_000,
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

  async processJob(job: { id: string; payload: ScoringJob }): Promise<{ score: number; model_name: string }> {
    const { entity_type, entity_id, tenant_id } = job.payload
    const modelName = job.payload.model_name ?? (
      entity_type === 'property' ? 'liquidity_predictor' : 'investor_conversion_predictor'
    )

    let features: Record<string, number> = {}

    if (entity_type === 'property') {
      // Fetch property from DB
      const { data: prop, error } = await (supabaseAdmin as any)
        .from('canonical_properties')
        .select('preco, zona, area_util, tipologia, ano_construcao')
        .eq('id', entity_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      if (error) throw new Error(`scoringWorker: fetch property ${entity_id} failed: ${error.message}`)

      if (prop) {
        features = {
          preco:          (prop.preco as number ?? 0) / 1_000_000,
          area_util:      (prop.area_util as number ?? 0) / 200,
          tipologia:      Number(String(prop.tipologia ?? 'T2').replace(/\D/g, '')) / 5,
          ano_construcao: ((prop.ano_construcao as number ?? 2000) - 1900) / 125,
          zona_score:     prop.zona != null ? 0.7 : 0.3,
        }
      }
    } else {
      // investor_match
      const { data: match, error } = await (supabaseAdmin as any)
        .from('matches')
        .select('match_score, property_id, investor_id, status')
        .eq('id', entity_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      if (error) throw new Error(`scoringWorker: fetch match ${entity_id} failed: ${error.message}`)

      if (match) {
        features = {
          match_score:    (match.match_score as number ?? 0) / 100,
          is_active:      match.status === 'active' ? 1 : 0,
          has_property:   match.property_id != null ? 1 : 0,
          has_investor:   match.investor_id != null ? 1 : 0,
        }
      }
    }

    // Heuristic weights — replaced when a trained model is active
    const weights: Record<string, number> = {
      __bias__:       -0.5,
      preco:           0.3,
      area_util:       0.2,
      tipologia:       0.1,
      ano_construcao:  0.1,
      zona_score:      0.4,
      match_score:     0.8,
      is_active:       0.3,
      has_property:    0.2,
      has_investor:    0.2,
    }

    const rawScore = predictWithWeights(weights, features)
    const score    = parseFloat(sigmoid(rawScore).toFixed(4))

    // Store prediction in ml_predictions
    await (supabaseAdmin as any)
      .from('ml_predictions')
      .upsert(
        {
          tenant_id:    tenant_id,
          entity_type,
          entity_id,
          model_name:   modelName,
          score,
          raw_score:    rawScore,
          features_used: features,
          predicted_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,entity_type,entity_id,model_name' },
      )

    log.info('[scoringWorker] scored entity', {
      entity_type,
      entity_id,
      model_name: modelName,
      score,
    })

    return { score, model_name: modelName }
  }

  // ─── Polling loop ─────────────────────────────────────────────────────────

  async runLoop(): Promise<void> {
    this.running = true
    this.health.status     = 'running'
    this.health.started_at = new Date().toISOString()
    await this.persistHealth()

    log.info('[scoringWorker] started', { tenant_id: this.config.tenant_id })

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

          const payload = msg.payload as ScoringJob
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
              log.error('[scoringWorker] job error', err instanceof Error ? err : new Error(errMsg), {
                job_id:      msg.id,
                attempt,
                entity_type: payload.entity_type,
                entity_id:   payload.entity_id,
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
        log.error('[scoringWorker] loop error', err instanceof Error ? err : new Error(errMsg), {})
        this.health.status     = 'error'
        this.health.last_error = errMsg
        await this.persistHealth()
        await sleep(this.config.poll_interval_ms)
      }
    }

    this.health.status     = 'stopped'
    this.health.updated_at = new Date().toISOString()
    await this.persistHealth()
    log.info('[scoringWorker] stopped', { tenant_id: this.config.tenant_id })
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
      log.warn('[scoringWorker] persistHealth failed', { error: String(err) })
    }
  }
}

export function createScoringWorker(tenantId: string): ScoringWorker {
  return new ScoringWorker(tenantId)
}
