// Agency Group — Revenue Worker
// lib/workers/revenueWorker.ts
// Processes commission calculation, revenue recognition, and ledger reconciliation.
// TypeScript strict — 0 errors

import { getQueueAdapter } from '@/lib/queue/adapter'
import { calculateCommission, type CommissionInput } from '@/lib/economics/commissionEngine'
import { computeRevenueReconciliation } from '@/lib/economics/auditLedger'
import { eventBus } from '@/lib/events/bus'
import { producers } from '@/lib/events/producers'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { NamedWorkerConfig, WorkerHealth } from './workerTypes'

// ─── Job payload ──────────────────────────────────────────────────────────────

export interface RevenueJob {
  job_type: 'revenue'
  sub_type: 'commission_calculation' | 'revenue_recognition' | 'ledger_reconciliation'
  tenant_id: string
  deal_id?: string
  deal_value_eur?: number
  commission_rate_pct?: number
  correlation_id?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── Worker ───────────────────────────────────────────────────────────────────

export class RevenueWorker {
  private readonly config: NamedWorkerConfig
  private running = false
  private health: WorkerHealth

  constructor(tenantId: string) {
    this.config = {
      name: 'revenue-worker',
      queue_name: 'commission_jobs',
      batch_size: 5,
      poll_interval_ms: 10_000,
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

  async processJob(job: { id: string; payload: RevenueJob }): Promise<{ processed: boolean; amount_eur?: number }> {
    const { sub_type, tenant_id, deal_id, deal_value_eur, correlation_id } = job.payload

    // ── commission_calculation ───────────────────────────────────────────────
    if (sub_type === 'commission_calculation') {
      if (!deal_value_eur) {
        log.warn('[revenueWorker] commission_calculation missing deal_value_eur', { job_id: job.id })
        return { processed: false }
      }

      // Fetch deal context from DB if deal_id is provided
      let dealZone: string | null       = null
      let dealRef: string | null        = null
      let agentEmail: string | null     = null

      if (deal_id) {
        const { data: deal } = await (supabaseAdmin as any)
          .from('deals')
          .select('zona, deal_ref, agent_email')
          .eq('id', deal_id)
          .eq('tenant_id', tenant_id)
          .maybeSingle()

        if (deal) {
          dealZone   = (deal.zona as string | null) ?? null
          dealRef    = (deal.deal_ref as string | null) ?? null
          agentEmail = (deal.agent_email as string | null) ?? null
        }
      }

      const input: CommissionInput = {
        deal_id:         deal_id ?? 'unknown',
        tenant_id,
        deal_value_eur,
        zone:            dealZone,
        agent_email:     agentEmail,
        deal_ref:        dealRef,
        correlation_id:  correlation_id ?? job.id,
      }

      const result = calculateCommission(input)

      // Persist commission record
      await (supabaseAdmin as any)
        .from('commissions')
        .upsert(
          {
            commission_id:         result.commission_id,
            tenant_id,
            deal_id:               deal_id ?? null,
            tier:                  result.tier,
            commission_rate:       result.commission_rate,
            gross_commission_eur:  result.gross_commission_eur,
            net_commission_eur:    result.net_commission_eur,
            agency_split_eur:      result.agency_split_eur,
            agent_split_eur:       result.agent_split_eur,
            vat_eur:               result.vat_eur,
            deal_value_eur:        result.deal_value_eur,
            calculated_at:         new Date().toISOString(),
          },
          { onConflict: 'commission_id' },
        )

      // Emit revenue.recognized event
      const event = producers.revenueRecognized(
        {
          deal_id:        deal_id ?? null,
          amount_eur:     result.gross_commission_eur,
          commission_eur: result.net_commission_eur,
          agent_email:    agentEmail,
          zona:           dealZone,
          recognized_at:  new Date().toISOString(),
        },
        { correlation_id: correlation_id ?? job.id, source_system: 'engine' },
      )

      try {
        await eventBus.publish(event)
      } catch (err) {
        log.warn('[revenueWorker] eventBus.publish failed — non-fatal', { error: String(err) })
      }

      log.info('[revenueWorker] commission calculated', {
        job_id:               job.id,
        deal_id:              deal_id ?? null,
        gross_commission_eur: result.gross_commission_eur,
        tier:                 result.tier,
      })

      return { processed: true, amount_eur: result.gross_commission_eur }
    }

    // ── revenue_recognition ──────────────────────────────────────────────────
    if (sub_type === 'revenue_recognition') {
      if (!deal_id) {
        log.warn('[revenueWorker] revenue_recognition missing deal_id', { job_id: job.id })
        return { processed: false }
      }

      const { data: entries, error: ledgerErr } = await (supabaseAdmin as any)
        .from('financial_ledger')
        .select('entry_id, entry_type, amount_eur, recorded_at')
        .eq('tenant_id', tenant_id)
        .eq('deal_id', deal_id)
        .order('recorded_at', { ascending: true })

      if (ledgerErr) {
        throw new Error(`revenueWorker: fetch financial_ledger failed: ${ledgerErr.message}`)
      }

      const rows = (entries ?? []) as Array<{ entry_id: string; entry_type: string; amount_eur: number; recorded_at: string }>
      const totalAmt = rows.reduce((sum, r) => sum + (r.amount_eur ?? 0), 0)

      log.info('[revenueWorker] revenue_recognition ledger read', {
        job_id:      job.id,
        deal_id,
        entries:     rows.length,
        total_eur:   totalAmt,
      })

      return { processed: true, amount_eur: totalAmt }
    }

    // ── ledger_reconciliation ────────────────────────────────────────────────
    if (sub_type === 'ledger_reconciliation') {
      const now      = new Date()
      const toDate   = now.toISOString()
      const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const reconciliation = await computeRevenueReconciliation(tenant_id, fromDate, toDate)

      log.info('[revenueWorker] ledger_reconciliation complete', {
        job_id:              job.id,
        total_gross_value:   reconciliation.total_gross_value_eur,
        total_commission:    reconciliation.total_commission_net_eur,
        total_deals:         reconciliation.total_deals,
      })

      return { processed: true, amount_eur: reconciliation.total_commission_net_eur }
    }

    log.warn('[revenueWorker] unknown sub_type', { job_id: job.id, sub_type })
    return { processed: false }
  }

  // ─── Polling loop ─────────────────────────────────────────────────────────

  async runLoop(): Promise<void> {
    this.running = true
    this.health.status     = 'running'
    this.health.started_at = new Date().toISOString()
    await this.persistHealth()

    log.info('[revenueWorker] started', { tenant_id: this.config.tenant_id })

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

          const payload = msg.payload as RevenueJob
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
              log.error('[revenueWorker] job error', err instanceof Error ? err : new Error(errMsg), {
                job_id:   msg.id,
                attempt,
                sub_type: payload.sub_type,
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
        log.error('[revenueWorker] loop error', err instanceof Error ? err : new Error(errMsg), {})
        this.health.status     = 'error'
        this.health.last_error = errMsg
        await this.persistHealth()
        await sleep(this.config.poll_interval_ms)
      }
    }

    this.health.status     = 'stopped'
    this.health.updated_at = new Date().toISOString()
    await this.persistHealth()
    log.info('[revenueWorker] stopped', { tenant_id: this.config.tenant_id })
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
      log.warn('[revenueWorker] persistHealth failed', { error: String(err) })
    }
  }
}

export function createRevenueWorker(tenantId: string): RevenueWorker {
  return new RevenueWorker(tenantId)
}
