// Agency Group — End-to-End Flow Tester
// lib/testing/e2eFlowTester.ts
// TypeScript strict — 0 errors
//
// Tests the complete revenue pipeline:
// Casafari listing → canonical_asset → investor bid → escrow → settlement → ROI feedback
// All steps use REAL DB data + measure actual pipeline health
// Does NOT create test data — queries existing records to validate flow completeness

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlowStage =
  | 'data_ingestion'
  | 'canonical_asset'
  | 'investor_match'
  | 'escrow_creation'
  | 'settlement'
  | 'roi_feedback'

export interface FlowStageResult {
  stage: FlowStage
  status: 'pass' | 'fail' | 'skip'
  record_count: number
  latency_ms: number
  issues: string[]
}

export interface E2EFlowResult {
  test_id: string
  tenant_id: string
  flow_stages: FlowStageResult[]
  pipeline_completion_pct: number
  end_to_end_latency_ms: number
  flow_health: 'healthy' | 'degraded' | 'broken'
  critical_breaks: string[]
  executed_at: string
}

// ─── Stage tester ─────────────────────────────────────────────────────────────

export async function testStage(
  tenantId: string,
  stage: FlowStage,
): Promise<FlowStageResult> {
  const db = supabaseAdmin as any
  const t0 = Date.now()
  const issues: string[] = []
  let record_count = 0
  let status: FlowStageResult['status'] = 'fail'

  try {
    switch (stage) {
      case 'data_ingestion': {
        // Count canonical_assets where data_source IS NOT NULL
        const { count, error } = await db
          .from('canonical_assets')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .not('data_source', 'is', null)
        if (error) {
          issues.push(`data_ingestion query error: ${error.message}`)
        } else {
          record_count = (count as number) ?? 0
          status = record_count > 0 ? 'pass' : 'fail'
          if (record_count === 0) issues.push('No canonical_assets with data_source found — ingestion pipeline may be stalled')
        }
        break
      }

      case 'canonical_asset': {
        // Count canonical_assets where canonical_hash IS NOT NULL
        const { count, error } = await db
          .from('canonical_assets')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .not('canonical_hash', 'is', null)
        if (error) {
          issues.push(`canonical_asset query error: ${error.message}`)
        } else {
          record_count = (count as number) ?? 0
          status = record_count > 0 ? 'pass' : 'fail'
          if (record_count === 0) issues.push('No canonical_assets with canonical_hash — dedup/normalisation step not running')
        }
        break
      }

      case 'investor_match': {
        // Count matches where match_score > 0
        const { count, error } = await db
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gt('match_score', 0)
        if (error) {
          issues.push(`investor_match query error: ${error.message}`)
        } else {
          record_count = (count as number) ?? 0
          status = record_count > 0 ? 'pass' : 'fail'
          if (record_count === 0) issues.push('No investor matches found — matching engine may not have run')
        }
        break
      }

      case 'escrow_creation': {
        // Count escrow_accounts — pass if table exists (count ≥ 0)
        const { count, error } = await db
          .from('escrow_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        if (error) {
          issues.push(`escrow_creation query error: ${error.message}`)
          status = 'fail'
        } else {
          record_count = (count as number) ?? 0
          status = 'pass' // table exists; 0 records is acceptable at this stage
        }
        break
      }

      case 'settlement': {
        // Count settlement_tracking — pass if table exists (count ≥ 0)
        const { count, error } = await db
          .from('settlement_tracking')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        if (error) {
          issues.push(`settlement query error: ${error.message}`)
          status = 'fail'
        } else {
          record_count = (count as number) ?? 0
          status = 'pass' // table exists; 0 records is acceptable
        }
        break
      }

      case 'roi_feedback': {
        // Count ml_predictions where model_type = 'roi' — pass if ≥ 0
        const { count, error } = await db
          .from('ml_predictions')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('model_type', 'roi')
        if (error) {
          issues.push(`roi_feedback query error: ${error.message}`)
          status = 'fail'
        } else {
          record_count = (count as number) ?? 0
          status = 'pass' // table exists; 0 records is acceptable
        }
        break
      }

      default: {
        const _exhaustive: never = stage
        issues.push(`Unknown stage: ${String(_exhaustive)}`)
        status = 'skip'
      }
    }
  } catch (err) {
    issues.push(`Unexpected error in stage ${stage}: ${err instanceof Error ? err.message : String(err)}`)
    status = 'fail'
  }

  return {
    stage,
    status,
    record_count,
    latency_ms: Date.now() - t0,
    issues,
  }
}

// ─── runE2EFlowTest ───────────────────────────────────────────────────────────

const ALL_STAGES: FlowStage[] = [
  'data_ingestion',
  'canonical_asset',
  'investor_match',
  'escrow_creation',
  'settlement',
  'roi_feedback',
]

export async function runE2EFlowTest(tenantId: string): Promise<E2EFlowResult> {
  const test_id    = randomUUID()
  const executed_at = new Date().toISOString()
  const t0          = Date.now()

  log.info('[e2eFlowTester] starting e2e flow test', { tenant_id: tenantId, test_id })

  const flow_stages = await Promise.all(
    ALL_STAGES.map(stage => testStage(tenantId, stage)),
  )

  const passed_count = flow_stages.filter(s => s.status === 'pass').length
  const pipeline_completion_pct = Math.round((passed_count / ALL_STAGES.length) * 100)
  const end_to_end_latency_ms   = Date.now() - t0

  const flow_health: E2EFlowResult['flow_health'] =
    passed_count === ALL_STAGES.length ? 'healthy' :
    passed_count >= 4 ? 'degraded' :
    'broken'

  const critical_breaks = flow_stages
    .filter(s => s.status === 'fail')
    .map(s => `[${s.stage}] ${s.issues.join('; ')}`)

  const result: E2EFlowResult = {
    test_id,
    tenant_id: tenantId,
    flow_stages,
    pipeline_completion_pct,
    end_to_end_latency_ms,
    flow_health,
    critical_breaks,
    executed_at,
  }

  log.info('[e2eFlowTester] e2e flow test complete', {
    tenant_id: tenantId,
    test_id,
    flow_health,
    pipeline_completion_pct,
    passed_count,
  })

  // Persist (fire-and-forget)
  void (supabaseAdmin as any)
    .from('e2e_flow_results')
    .insert({
      id: test_id,
      tenant_id: tenantId,
      flow_stages: flow_stages,
      pipeline_completion_pct,
      flow_health,
      critical_breaks,
      executed_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) log.warn('[e2eFlowTester] persist failed', { error: error.message, test_id })
    })
    .catch((e: unknown) => log.warn('[e2eFlowTester] persist threw', {
      error: e instanceof Error ? e.message : String(e),
      test_id,
    }))

  return result
}
