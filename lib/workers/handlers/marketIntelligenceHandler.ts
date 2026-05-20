// Agency Group — Market Intelligence Worker Handler
// lib/workers/handlers/marketIntelligenceHandler.ts
//
// Generates and persists market liquidity snapshots on demand or schedule.
// TypeScript strict — 0 errors

import { generateLiquiditySnapshot } from '@/lib/market/liquiditySnapshot'
import { emit } from '@/lib/events/producers'
import type { WorkerJob, WorkerResult } from '../types'

export interface MarketIntelligenceJobPayload {
  tenant_id:      string
  country?:       string
  correlation_id?: string
}

export async function marketIntelligenceHandler(
  job: WorkerJob<MarketIntelligenceJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const { tenant_id, country = 'PT', correlation_id } = job.payload

  try {
    const metrics = await generateLiquiditySnapshot(tenant_id, country)

    void emit.marketSnapshotGenerated(
      {
        snapshot_id:       metrics.snapshot_id,
        active_properties: metrics.active_properties,
        total_investors:   metrics.total_investors,
        liquidity_ratio:   metrics.liquidity_ratio,
        avg_match_score:   metrics.avg_match_score,
        snapshot_date:     metrics.snapshot_date,
        tenant_id,
      },
      { correlation_id: correlation_id ?? null, source_system: 'cron' },
    )

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output:     metrics,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[marketIntelligenceHandler] job ${job.jobId} failed:`, msg)
    return { jobId: job.jobId, success: false, durationMs: Date.now() - start, error: msg }
  }
}
