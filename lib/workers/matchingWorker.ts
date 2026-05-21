// Agency Group — Matching Worker
// lib/workers/matchingWorker.ts
// Links investors to properties — inserts matches above score threshold.
// TypeScript strict — 0 errors

import { getQueueAdapter } from '@/lib/queue/adapter'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { NamedWorkerConfig, WorkerHealth } from './workerTypes'

// ─── Job payload ──────────────────────────────────────────────────────────────

export interface MatchingJob {
  job_type: 'matching'
  tenant_id: string
  property_id?: string
  investor_id?: string
  max_matches?: number
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PropertyRow {
  id: string
  zona: string | null
  tipologia: string | null
  preco: number | null
}

interface InvestorRow {
  id: string
  zonas_interesse: string[] | null
  budget_min: number | null
  budget_max: number | null
  tipologias: string[] | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep      = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const MATCH_THRESHOLD = 60

function computeMatchScore(
  property: PropertyRow,
  investor: InvestorRow,
): number {
  let score = 0

  // Geography match (40 pts)
  const zonas = investor.zonas_interesse ?? []
  if (property.zona && zonas.includes(property.zona)) {
    score += 40
  } else if (zonas.length === 0) {
    score += 20  // no preference — partial credit
  }

  // Budget fit (35 pts)
  const preco = property.preco ?? 0
  const min   = investor.budget_min ?? 0
  const max   = investor.budget_max ?? Number.MAX_SAFE_INTEGER
  if (preco >= min && preco <= max) {
    score += 35
  } else if (preco >= min * 0.85 && preco <= max * 1.15) {
    score += 15  // within 15% tolerance
  }

  // Type match (25 pts)
  const tipos = investor.tipologias ?? []
  if (property.tipologia && tipos.includes(property.tipologia)) {
    score += 25
  } else if (tipos.length === 0) {
    score += 12  // no preference — partial credit
  }

  return Math.min(100, score)
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export class MatchingWorker {
  private readonly config: NamedWorkerConfig
  private running = false
  private health: WorkerHealth

  constructor(tenantId: string) {
    this.config = {
      name: 'matching-worker',
      queue_name: 'matching_jobs',
      batch_size: 10,
      poll_interval_ms: 20_000,
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

  async processJob(job: { id: string; payload: MatchingJob }): Promise<{ matches_created: number }> {
    const { tenant_id, property_id, investor_id, max_matches = 10 } = job.payload

    if (!property_id && !investor_id) {
      log.warn('[matchingWorker] job has neither property_id nor investor_id', { job_id: job.id })
      return { matches_created: 0 }
    }

    let matchesCreated = 0

    if (property_id) {
      // Find investors for this property
      const { data: prop, error: propErr } = await (supabaseAdmin as any)
        .from('canonical_properties')
        .select('id, zona, tipologia, preco')
        .eq('id', property_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      if (propErr || !prop) {
        throw new Error(`matchingWorker: fetch property ${property_id} failed: ${propErr?.message ?? 'not found'}`)
      }

      const { data: investors, error: invErr } = await (supabaseAdmin as any)
        .from('investors')
        .select('id, zonas_interesse, budget_min, budget_max, tipologias')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .limit(200)

      if (invErr) throw new Error(`matchingWorker: fetch investors failed: ${invErr.message}`)

      const rows: Array<Record<string, unknown>> = []

      for (const inv of (investors ?? []) as InvestorRow[]) {
        const matchScore = computeMatchScore(prop as PropertyRow, inv)
        if (matchScore >= MATCH_THRESHOLD) {
          rows.push({
            tenant_id,
            property_id,
            investor_id: inv.id,
            match_score: matchScore,
            status:      'pending',
            matched_at:  new Date().toISOString(),
          })
        }
        if (rows.length >= max_matches) break
      }

      if (rows.length > 0) {
        const { data: inserted, error: insErr } = await (supabaseAdmin as any)
          .from('matches')
          .upsert(rows, { onConflict: 'tenant_id,property_id,investor_id', ignoreDuplicates: true })
          .select('id')

        if (insErr) throw new Error(`matchingWorker: upsert matches failed: ${insErr.message}`)
        matchesCreated = (inserted as unknown[])?.length ?? rows.length
      }

    } else if (investor_id) {
      // Find properties for this investor
      const { data: inv, error: invErr } = await (supabaseAdmin as any)
        .from('investors')
        .select('id, zonas_interesse, budget_min, budget_max, tipologias')
        .eq('id', investor_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      if (invErr || !inv) {
        throw new Error(`matchingWorker: fetch investor ${investor_id} failed: ${invErr?.message ?? 'not found'}`)
      }

      const { data: properties, error: propErr } = await (supabaseAdmin as any)
        .from('canonical_properties')
        .select('id, zona, tipologia, preco')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .limit(200)

      if (propErr) throw new Error(`matchingWorker: fetch properties failed: ${propErr.message}`)

      const rows: Array<Record<string, unknown>> = []

      for (const prop of (properties ?? []) as PropertyRow[]) {
        const matchScore = computeMatchScore(prop, inv as InvestorRow)
        if (matchScore >= MATCH_THRESHOLD) {
          rows.push({
            tenant_id,
            property_id: prop.id,
            investor_id,
            match_score: matchScore,
            status:      'pending',
            matched_at:  new Date().toISOString(),
          })
        }
        if (rows.length >= max_matches) break
      }

      if (rows.length > 0) {
        const { data: inserted, error: insErr } = await (supabaseAdmin as any)
          .from('matches')
          .upsert(rows, { onConflict: 'tenant_id,property_id,investor_id', ignoreDuplicates: true })
          .select('id')

        if (insErr) throw new Error(`matchingWorker: upsert matches failed: ${insErr.message}`)
        matchesCreated = (inserted as unknown[])?.length ?? rows.length
      }
    }

    log.info('[matchingWorker] matching complete', {
      job_id:          job.id,
      property_id:     property_id ?? null,
      investor_id:     investor_id ?? null,
      matches_created: matchesCreated,
    })

    return { matches_created: matchesCreated }
  }

  // ─── Polling loop ─────────────────────────────────────────────────────────

  async runLoop(): Promise<void> {
    this.running = true
    this.health.status     = 'running'
    this.health.started_at = new Date().toISOString()
    await this.persistHealth()

    log.info('[matchingWorker] started', { tenant_id: this.config.tenant_id })

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

          const payload = msg.payload as MatchingJob
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
              log.error('[matchingWorker] job error', err instanceof Error ? err : new Error(errMsg), {
                job_id:  msg.id,
                attempt,
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
        log.error('[matchingWorker] loop error', err instanceof Error ? err : new Error(errMsg), {})
        this.health.status     = 'error'
        this.health.last_error = errMsg
        await this.persistHealth()
        await sleep(this.config.poll_interval_ms)
      }
    }

    this.health.status     = 'stopped'
    this.health.updated_at = new Date().toISOString()
    await this.persistHealth()
    log.info('[matchingWorker] stopped', { tenant_id: this.config.tenant_id })
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
      log.warn('[matchingWorker] persistHealth failed', { error: String(err) })
    }
  }
}

export function createMatchingWorker(tenantId: string): MatchingWorker {
  return new MatchingWorker(tenantId)
}
