// Agency Group — Data Integrity Auditor
// lib/audit/dataIntegrityAuditor.ts
// TypeScript strict — 0 errors
//
// Validates the full data pipeline:
// ingestion → canonical_asset → pricing → liquidity → capital → settlement
// Detects: orphan records, schema drift, missing joins, inconsistent state transitions

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DataIntegrityReport {
  audit_id: string
  tenant_id: string

  pipeline_stages: {
    stage: 'ingestion' | 'canonical_asset' | 'pricing' | 'liquidity' | 'capital' | 'settlement'
    record_count: number
    orphan_count: number       // records with no parent reference
    inconsistent_count: number // invalid state transitions
    issues: string[]
  }[]

  orphan_analysis: {
    canonical_assets_without_source: number   // canonical_assets with no matching ingestion
    capital_transactions_without_escrow: number
    settlements_without_transactions: number
    matches_without_deals: number
    deal_packs_without_contacts: number
  }

  state_transition_violations: {
    table: string
    record_id: string
    current_state: string
    expected_valid_states: string[]
    violation_type: string
  }[]

  schema_drift: {
    table: string
    missing_columns_used: string[]  // columns referenced in code but not checked
    null_rate_anomalies: string[]   // columns with >80% null that should be populated
  }[]

  integrity_score: number  // 0–100
  critical_issues: string[]
  warnings: string[]
}

// ─── Valid escrow state transitions ──────────────────────────────────────────
// pending → funded → released → completed
const VALID_ESCROW_STATES = ['pending', 'funded', 'released', 'completed'] as const
type EscrowState = typeof VALID_ESCROW_STATES[number]

const VALID_ESCROW_TRANSITIONS: Record<EscrowState, EscrowState[]> = {
  pending:   ['funded'],
  funded:    ['released'],
  released:  ['completed'],
  completed: [],
}

// ─── Helper: safe table count ─────────────────────────────────────────────────

async function safeCount(table: string, tenantId: string): Promise<number> {
  try {
    const { count, error } = await (supabaseAdmin as any)
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    if (error) return 0
    return (count as number) ?? 0
  } catch {
    return 0
  }
}

// ─── checkOrphanRecords ───────────────────────────────────────────────────────

export async function checkOrphanRecords(
  tenantId: string,
): Promise<DataIntegrityReport['orphan_analysis']> {
  try {
    // canonical_assets without a matching ingestion job
    const { count: canonicalCount } = await (supabaseAdmin as any)
      .from('canonical_assets')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('source_ingestion_id', null) as { count: number | null }

    // capital_transactions where escrow_account_id is null
    const { count: capWithoutEscrow } = await (supabaseAdmin as any)
      .from('capital_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('escrow_account_id', null) as { count: number | null }

    // settlement_tracking rows with no backing capital_transaction
    const { count: settlementsWithoutTx } = await (supabaseAdmin as any)
      .from('settlement_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('capital_transaction_id', null) as { count: number | null }

    // matches with no linked deal
    const { count: matchesWithoutDeals } = await (supabaseAdmin as any)
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deal_id', null) as { count: number | null }

    // deal_packs with no linked contact
    const { count: dealPacksWithoutContacts } = await (supabaseAdmin as any)
      .from('deal_packs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('contact_id', null) as { count: number | null }

    return {
      canonical_assets_without_source:        (canonicalCount ?? 0),
      capital_transactions_without_escrow:    (capWithoutEscrow ?? 0),
      settlements_without_transactions:       (settlementsWithoutTx ?? 0),
      matches_without_deals:                  (matchesWithoutDeals ?? 0),
      deal_packs_without_contacts:            (dealPacksWithoutContacts ?? 0),
    }
  } catch (err) {
    log.warn('[dataIntegrityAuditor] checkOrphanRecords error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      canonical_assets_without_source:        0,
      capital_transactions_without_escrow:    0,
      settlements_without_transactions:       0,
      matches_without_deals:                  0,
      deal_packs_without_contacts:            0,
    }
  }
}

// ─── checkStateTransitions ────────────────────────────────────────────────────

export async function checkStateTransitions(
  tenantId: string,
): Promise<DataIntegrityReport['state_transition_violations']> {
  const violations: DataIntegrityReport['state_transition_violations'] = []

  try {
    // Fetch all escrow accounts for this tenant
    const { data: escrows, error } = await (supabaseAdmin as any)
      .from('escrow_accounts')
      .select('id, status, previous_status')
      .eq('tenant_id', tenantId)
      .limit(500) as {
        data: Array<{ id: string; status: string; previous_status: string | null }> | null
        error: { message: string } | null
      }

    if (error || !escrows) return violations

    for (const escrow of escrows) {
      const currentState = escrow.status as EscrowState
      const previousState = (escrow.previous_status ?? null) as EscrowState | null

      // Check current state is valid
      if (!VALID_ESCROW_STATES.includes(currentState)) {
        violations.push({
          table:                'escrow_accounts',
          record_id:            escrow.id,
          current_state:        currentState,
          expected_valid_states: [...VALID_ESCROW_STATES],
          violation_type:       'invalid_state',
        })
        continue
      }

      // Check transition is valid
      if (previousState && VALID_ESCROW_STATES.includes(previousState)) {
        const allowedNext = VALID_ESCROW_TRANSITIONS[previousState]
        if (!allowedNext.includes(currentState)) {
          violations.push({
            table:                'escrow_accounts',
            record_id:            escrow.id,
            current_state:        currentState,
            expected_valid_states: allowedNext,
            violation_type:       `invalid_transition_from_${previousState}`,
          })
        }
      }
    }
  } catch (err) {
    log.warn('[dataIntegrityAuditor] checkStateTransitions error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return violations
}

// ─── checkPipelineHealth ──────────────────────────────────────────────────────

export async function checkPipelineHealth(
  tenantId: string,
): Promise<DataIntegrityReport['pipeline_stages']> {
  type Stage = DataIntegrityReport['pipeline_stages'][number]

  const stageConfigs: Array<{
    stage: Stage['stage']
    table: string
    orphanField?: string
  }> = [
    { stage: 'ingestion',      table: 'ingestion_jobs' },
    { stage: 'canonical_asset',table: 'canonical_assets',  orphanField: 'source_ingestion_id' },
    { stage: 'pricing',        table: 'market_pressure_snapshots' },
    { stage: 'liquidity',      table: 'liquidity_grades' },
    { stage: 'capital',        table: 'capital_transactions', orphanField: 'escrow_account_id' },
    { stage: 'settlement',     table: 'settlement_tracking', orphanField: 'capital_transaction_id' },
  ]

  const results: DataIntegrityReport['pipeline_stages'] = []

  for (const cfg of stageConfigs) {
    try {
      const total = await safeCount(cfg.table, tenantId)

      let orphanCount = 0
      if (cfg.orphanField) {
        const { count } = await (supabaseAdmin as any)
          .from(cfg.table)
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is(cfg.orphanField, null) as { count: number | null }
        orphanCount = (count ?? 0)
      }

      const issues: string[] = []
      if (total === 0) issues.push(`${cfg.table}: no records found`)
      if (orphanCount > 0) issues.push(`${cfg.table}: ${orphanCount} orphan records (${cfg.orphanField} is null)`)

      results.push({
        stage:              cfg.stage,
        record_count:       total,
        orphan_count:       orphanCount,
        inconsistent_count: 0,
        issues,
      })
    } catch (err) {
      results.push({
        stage:              cfg.stage,
        record_count:       0,
        orphan_count:       0,
        inconsistent_count: 0,
        issues:             [`Error checking ${cfg.table}: ${err instanceof Error ? err.message : String(err)}`],
      })
    }
  }

  return results
}

// ─── computeIntegrityScore ────────────────────────────────────────────────────

export function computeIntegrityScore(report: Partial<DataIntegrityReport>): number {
  const orphanTotal =
    (report.orphan_analysis?.canonical_assets_without_source ?? 0) +
    (report.orphan_analysis?.capital_transactions_without_escrow ?? 0) +
    (report.orphan_analysis?.settlements_without_transactions ?? 0) +
    (report.orphan_analysis?.matches_without_deals ?? 0) +
    (report.orphan_analysis?.deal_packs_without_contacts ?? 0)

  const stateViolations = report.state_transition_violations?.length ?? 0

  const schemaDriftIssues = (report.schema_drift ?? []).reduce(
    (acc, s) => acc + s.missing_columns_used.length + s.null_rate_anomalies.length,
    0,
  )

  const penalty = orphanTotal * 5 + stateViolations * 10 + schemaDriftIssues * 3
  return Math.max(0, 100 - penalty)
}

// ─── runDataIntegrityAudit ────────────────────────────────────────────────────

export async function runDataIntegrityAudit(tenantId: string): Promise<DataIntegrityReport> {
  const auditId = randomUUID()
  log.info('[dataIntegrityAuditor] starting audit', { tenant_id: tenantId, audit_id: auditId })

  const [orphanAnalysis, stateViolations, pipelineStages] = await Promise.all([
    checkOrphanRecords(tenantId),
    checkStateTransitions(tenantId),
    checkPipelineHealth(tenantId),
  ])

  // Schema drift: flag tables with expected columns that should have data
  const schemaDrift: DataIntegrityReport['schema_drift'] = []

  // Check canonical_assets for expected nullable columns
  try {
    const { data: assetSample } = await (supabaseAdmin as any)
      .from('canonical_assets')
      .select('valuation_eur, property_type, location_lat, location_lng')
      .eq('tenant_id', tenantId)
      .limit(100) as { data: Array<Record<string, unknown>> | null }

    if (assetSample && assetSample.length > 0) {
      const nullRateAnomalies: string[] = []
      const fields = ['valuation_eur', 'property_type', 'location_lat', 'location_lng'] as const
      for (const field of fields) {
        const nullCount = assetSample.filter(r => r[field] == null).length
        const nullRate = nullCount / assetSample.length
        if (nullRate > 0.8) {
          nullRateAnomalies.push(`${field}: ${Math.round(nullRate * 100)}% null`)
        }
      }
      if (nullRateAnomalies.length > 0) {
        schemaDrift.push({
          table:                'canonical_assets',
          missing_columns_used: [],
          null_rate_anomalies:  nullRateAnomalies,
        })
      }
    }
  } catch {
    // Non-fatal — schema drift check is best-effort
  }

  // Collect critical issues
  const criticalIssues: string[] = []
  const warnings: string[] = []

  if (orphanAnalysis.settlements_without_transactions > 0) {
    criticalIssues.push(
      `${orphanAnalysis.settlements_without_transactions} settlement(s) with no backing capital_transaction`,
    )
  }
  if (stateViolations.length > 0) {
    criticalIssues.push(`${stateViolations.length} escrow state transition violation(s) detected`)
  }
  if (orphanAnalysis.canonical_assets_without_source > 0) {
    warnings.push(
      `${orphanAnalysis.canonical_assets_without_source} canonical_asset(s) have no source ingestion record`,
    )
  }
  if (orphanAnalysis.capital_transactions_without_escrow > 0) {
    warnings.push(
      `${orphanAnalysis.capital_transactions_without_escrow} capital_transaction(s) have no linked escrow`,
    )
  }

  const report: DataIntegrityReport = {
    audit_id:                auditId,
    tenant_id:               tenantId,
    pipeline_stages:         pipelineStages,
    orphan_analysis:         orphanAnalysis,
    state_transition_violations: stateViolations,
    schema_drift:            schemaDrift,
    integrity_score:         0,
    critical_issues:         criticalIssues,
    warnings,
  }
  report.integrity_score = computeIntegrityScore(report)

  log.info('[dataIntegrityAuditor] audit complete', {
    tenant_id:       tenantId,
    integrity_score: report.integrity_score,
    critical_issues: criticalIssues.length,
    warnings:        warnings.length,
  })

  // Fire-and-forget persist
  void (supabaseAdmin as any)
    .from('data_integrity_audits')
    .insert({
      id:               auditId,
      tenant_id:        tenantId,
      integrity_score:  report.integrity_score,
      orphan_analysis:  report.orphan_analysis,
      state_violations: report.state_transition_violations,
      schema_drift:     report.schema_drift,
      critical_issues:  report.critical_issues,
      audited_at:       new Date().toISOString(),
    })
    .catch((e: unknown) =>
      log.warn('[dataIntegrityAuditor] persist failed', {
        error: e instanceof Error ? e.message : String(e),
      })
    )

  return report
}
