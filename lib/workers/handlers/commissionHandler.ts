// Agency Group — Commission Worker Handler
// lib/workers/handlers/commissionHandler.ts
//
// Processes commission calculation jobs enqueued after deal closes.
// Calculates, persists, and emits commissionCalculated event.
// TypeScript strict — 0 errors

import { calculateAndPersistCommission } from '@/lib/economics/commissionEngine'
import { emit } from '@/lib/events/producers'
import type { WorkerJob, WorkerResult } from '../types'

export interface CommissionJobPayload {
  deal_id:       string
  tenant_id:     string
  deal_value_eur: number
  zone:          string | null
  agent_email:   string | null
  deal_ref:      string | null
  correlation_id: string
}

export async function commissionHandler(
  job: WorkerJob<CommissionJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const {
    deal_id, tenant_id, deal_value_eur, zone, agent_email, deal_ref, correlation_id,
  } = job.payload

  try {
    if (!deal_id || deal_value_eur <= 0) {
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      'commissionHandler: deal_id and deal_value_eur > 0 are required',
      }
    }

    const result = await calculateAndPersistCommission({
      deal_id,
      tenant_id,
      deal_value_eur,
      zone,
      agent_email,
      deal_ref,
      correlation_id,
    })

    // Emit commissionCalculated event (fire-and-forget)
    void emit.commissionCalculated(
      {
        deal_id,
        commission_id:    result.commission_id,
        gross_eur:        result.gross_commission_eur,
        net_eur:          result.net_commission_eur,
        agency_split_eur: result.agency_split_eur,
        agent_split_eur:  result.agent_split_eur,
        rate:             result.commission_rate,
        tier:             result.tier,
        agent_email,
      },
      { correlation_id, source_system: 'engine' },
    )

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output: {
        commission_id:    result.commission_id,
        tier:             result.tier,
        gross_eur:        result.gross_commission_eur,
        net_eur:          result.net_commission_eur,
        agency_split_eur: result.agency_split_eur,
        agent_split_eur:  result.agent_split_eur,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[commissionHandler] job ${job.jobId} failed:`, msg)
    return { jobId: job.jobId, success: false, durationMs: Date.now() - start, error: msg }
  }
}
