// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — System Integrity Validator v1.0
// lib/sre/systemIntegrityValidator.ts
//
// Runs 5 deterministic integrity checks across the entire system and produces
// a weighted SystemIntegrityReport with an SRE grade (S/A/B/C/D).
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { verifyChainIntegrity } from '@/lib/compliance/immutableAuditLog'

// ─── Public types ─────────────────────────────────────────────────────────────

export type IntegrityCheckType =
  | 'event_loss'
  | 'replay_consistency'
  | 'ml_reproducibility'
  | 'db_integrity'
  | 'audit_chain'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface IntegrityCheckResult {
  check: IntegrityCheckType
  status: CheckStatus
  score: number
  details: string
  data: Record<string, unknown>
  checked_at: string
}

export interface SystemIntegrityReport {
  id: string
  tenant_id: string
  overall_status: CheckStatus
  overall_score: number
  checks: IntegrityCheckResult[]
  critical_issues: string[]
  warnings: string[]
  sre_grade: 'S' | 'A' | 'B' | 'C' | 'D'
  generated_at: string
}

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS: Record<IntegrityCheckType, number> = {
  event_loss:          0.30,
  audit_chain:         0.25,
  db_integrity:        0.20,
  ml_reproducibility:  0.15,
  replay_consistency:  0.10,
}

// ─── Check 1: event_loss ─────────────────────────────────────────────────────

async function checkEventLoss(tenantId: string): Promise<IntegrityCheckResult> {
  const checked_at = new Date().toISOString()
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { count, error } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('processed_at', null)
      .lt('emitted_at', fiveMinutesAgo) as {
        count: number | null
        error: { message: string } | null
      }

    if (error) {
      log.warn('[systemIntegrityValidator] checkEventLoss query failed', { tenant_id: tenantId, error: error.message })
      return {
        check: 'event_loss',
        status: 'warn',
        score: 50,
        details: `Query failed: ${error.message}`,
        data: { error: error.message },
        checked_at,
      }
    }

    const unprocessed = count ?? 0

    let score: number
    let status: CheckStatus

    if (unprocessed === 0) {
      score = 100
      status = 'pass'
    } else if (unprocessed < 10) {
      score = 80
      status = 'warn'
    } else if (unprocessed < 100) {
      score = 50
      status = 'fail'
    } else {
      score = 0
      status = 'fail'
    }

    return {
      check: 'event_loss',
      status,
      score,
      details: unprocessed === 0
        ? 'No unprocessed events older than 5 minutes'
        : `${unprocessed} unprocessed event(s) older than 5 minutes`,
      data: { unprocessed_events: unprocessed, threshold_minutes: 5 },
      checked_at,
    }
  } catch (err) {
    log.warn('[systemIntegrityValidator] checkEventLoss error', { tenant_id: tenantId, error: String(err) })
    return {
      check: 'event_loss',
      status: 'warn',
      score: 50,
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
      checked_at,
    }
  }
}

// ─── Check 2: replay_consistency ─────────────────────────────────────────────

async function checkReplayConsistency(tenantId: string): Promise<IntegrityCheckResult> {
  const checked_at = new Date().toISOString()
  try {
    // Count total kafka events
    const { count: totalCount, error: totalErr } = await (supabaseAdmin as any)
      .from('kafka_event_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: { message: string } | null }

    // Count archived events
    const { count: archivedCount, error: archiveErr } = await (supabaseAdmin as any)
      .from('event_archive_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId) as { count: number | null; error: { message: string } | null }

    if (totalErr || archiveErr) {
      const msg = totalErr?.message ?? archiveErr?.message ?? 'unknown'
      return {
        check: 'replay_consistency',
        status: 'warn',
        score: 80,
        details: `Archive table may not exist or query failed: ${msg}`,
        data: { query_error: msg },
        checked_at,
      }
    }

    const total    = totalCount    ?? 0
    const archived = archivedCount ?? 0
    const unarchived = Math.max(0, total - archived)
    const archivePct = total > 0 ? Math.round((archived / total) * 100) : 100

    // Check replay_sessions for failures in last 7 days (if table exists)
    let replayFailures = 0
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count: failCount } = await (supabaseAdmin as any)
        .from('replay_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'failed')
        .gte('created_at', sevenDaysAgo) as { count: number | null; error: unknown }
      replayFailures = failCount ?? 0
    } catch {
      // table may not exist — ignore
    }

    let score: number
    let status: CheckStatus

    if (replayFailures > 0) {
      score = 50
      status = 'fail'
    } else if (unarchived === 0) {
      score = 100
      status = 'pass'
    } else {
      score = 80
      status = 'warn'
    }

    return {
      check: 'replay_consistency',
      status,
      score,
      details: replayFailures > 0
        ? `${replayFailures} replay session failure(s) in last 7 days`
        : unarchived === 0
          ? `All ${total} event(s) archived (${archivePct}%)`
          : `${unarchived} event(s) not yet archived (${archivePct}% done)`,
      data: {
        total_events: total,
        archived_events: archived,
        unarchived_events: unarchived,
        archive_pct: archivePct,
        replay_failures_7d: replayFailures,
      },
      checked_at,
    }
  } catch (err) {
    log.warn('[systemIntegrityValidator] checkReplayConsistency error', { tenant_id: tenantId, error: String(err) })
    return {
      check: 'replay_consistency',
      status: 'warn',
      score: 80,
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
      checked_at,
    }
  }
}

// ─── Check 3: ml_reproducibility ─────────────────────────────────────────────

async function checkMLReproducibility(tenantId: string): Promise<IntegrityCheckResult> {
  const checked_at = new Date().toISOString()
  try {
    // Count active ML models
    const { data: modelsData, error: modelsErr } = await (supabaseAdmin as any)
      .from('ml_models')
      .select('id, model_name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active') as {
        data: Array<{ id: string; model_name: string }> | null
        error: { message: string } | null
      }

    if (modelsErr) {
      return {
        check: 'ml_reproducibility',
        status: 'warn',
        score: 50,
        details: `ml_models query failed: ${modelsErr.message}`,
        data: { error: modelsErr.message },
        checked_at,
      }
    }

    const activeModels = modelsData ?? []
    const activeCount  = activeModels.length

    // Count artifact backups within last 24h
    let backedUpCount = 0
    if (activeCount > 0) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      try {
        const { count: artCount } = await (supabaseAdmin as any)
          .from('ml_artifact_log')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', twentyFourHoursAgo) as { count: number | null; error: unknown }
        backedUpCount = artCount ?? 0
      } catch {
        // table may not exist
      }
    }

    // Check last successful retraining run (within 48h target)
    let hoursLastRetrain: number | null = null
    try {
      const { data: retrainData } = await (supabaseAdmin as any)
        .from('retraining_runs')
        .select('completed_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1) as { data: Array<{ completed_at: string }> | null; error: unknown }

      if (retrainData && retrainData.length > 0 && retrainData[0].completed_at) {
        const lastRun = new Date(retrainData[0].completed_at).getTime()
        hoursLastRetrain = Math.round((Date.now() - lastRun) / (60 * 60 * 1000))
      }
    } catch {
      // table may not exist
    }

    const allModelsBackedUp = activeCount === 0 || backedUpCount >= activeCount
    const recentRetrain     = hoursLastRetrain !== null && hoursLastRetrain <= 48

    let score: number
    let status: CheckStatus

    if (allModelsBackedUp && recentRetrain) {
      score = 100
      status = 'pass'
    } else if (allModelsBackedUp) {
      score = 80
      status = 'warn'
    } else {
      score = 50
      status = 'fail'
    }

    return {
      check: 'ml_reproducibility',
      status,
      score,
      details: activeCount === 0
        ? 'No active ML models found'
        : allModelsBackedUp && recentRetrain
          ? `All ${activeCount} model(s) backed up; last retrain ${hoursLastRetrain}h ago`
          : allModelsBackedUp
            ? `All ${activeCount} model(s) backed up; last retrain: ${hoursLastRetrain !== null ? `${hoursLastRetrain}h ago` : 'none found'}`
            : `${backedUpCount}/${activeCount} model(s) backed up in last 24h`,
      data: {
        active_models: activeCount,
        backed_up_last_24h: backedUpCount,
        all_backed_up: allModelsBackedUp,
        hours_since_last_retrain: hoursLastRetrain,
        retrain_within_48h: recentRetrain,
      },
      checked_at,
    }
  } catch (err) {
    log.warn('[systemIntegrityValidator] checkMLReproducibility error', { tenant_id: tenantId, error: String(err) })
    return {
      check: 'ml_reproducibility',
      status: 'warn',
      score: 50,
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
      checked_at,
    }
  }
}

// ─── Check 4: db_integrity ────────────────────────────────────────────────────

async function checkDBIntegrity(tenantId: string): Promise<IntegrityCheckResult> {
  const checked_at = new Date().toISOString()
  try {
    // Check capital_transactions with orphaned settlement_id
    const { data: orphanTxns, error: txnErr } = await (supabaseAdmin as any)
      .from('capital_transactions')
      .select('id, settlement_id')
      .eq('tenant_id', tenantId)
      .not('settlement_id', 'is', null) as {
        data: Array<{ id: string; settlement_id: string }> | null
        error: { message: string } | null
      }

    if (txnErr) {
      return {
        check: 'db_integrity',
        status: 'warn',
        score: 70,
        details: `capital_transactions query failed: ${txnErr.message}`,
        data: { error: txnErr.message },
        checked_at,
      }
    }

    const txnsWithSettlement = orphanTxns ?? []

    // Get all settlement IDs
    const { data: settlementData, error: settlErr } = await (supabaseAdmin as any)
      .from('settlement_records')
      .select('id, transaction_id')
      .eq('tenant_id', tenantId) as {
        data: Array<{ id: string; transaction_id: string | null }> | null
        error: { message: string } | null
      }

    if (settlErr) {
      return {
        check: 'db_integrity',
        status: 'warn',
        score: 70,
        details: `settlement_records query failed: ${settlErr.message}`,
        data: { error: settlErr.message },
        checked_at,
      }
    }

    const settlements    = settlementData ?? []
    const settlementIds  = new Set(settlements.map(s => s.id))
    const txnIds         = new Set(txnsWithSettlement.map(t => t.id))

    // Orphaned: transactions whose settlement_id has no matching settlement record
    const orphanedTxns = txnsWithSettlement.filter(t => t.settlement_id && !settlementIds.has(t.settlement_id))

    // Orphaned: settlement records whose transaction_id has no matching transaction
    const orphanedSettlements = settlements.filter(s => s.transaction_id && !txnIds.has(s.transaction_id))

    const totalOrphans = orphanedTxns.length + orphanedSettlements.length

    let score: number
    let status: CheckStatus

    if (totalOrphans === 0) {
      score = 100
      status = 'pass'
    } else if (totalOrphans < 5) {
      score = 70
      status = 'warn'
    } else {
      score = 40
      status = 'fail'
    }

    return {
      check: 'db_integrity',
      status,
      score,
      details: totalOrphans === 0
        ? 'No orphan records detected across capital_transactions ↔ settlement_records'
        : `${totalOrphans} orphan record(s): ${orphanedTxns.length} txn(s) with missing settlement, ${orphanedSettlements.length} settlement(s) with missing txn`,
      data: {
        total_orphans: totalOrphans,
        orphaned_transactions: orphanedTxns.length,
        orphaned_settlements: orphanedSettlements.length,
        transactions_checked: txnsWithSettlement.length,
        settlements_checked: settlements.length,
        sequence_gap_check: 'skipped — expensive query',
      },
      checked_at,
    }
  } catch (err) {
    log.warn('[systemIntegrityValidator] checkDBIntegrity error', { tenant_id: tenantId, error: String(err) })
    return {
      check: 'db_integrity',
      status: 'warn',
      score: 70,
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
      checked_at,
    }
  }
}

// ─── Check 5: audit_chain ─────────────────────────────────────────────────────

async function checkAuditChain(tenantId: string): Promise<IntegrityCheckResult> {
  const checked_at = new Date().toISOString()
  try {
    const result = await verifyChainIntegrity(tenantId, 1000)

    if (result.checked_entries === 0) {
      return {
        check: 'audit_chain',
        status: 'pass',
        score: 100,
        details: 'No audit entries yet — chain integrity trivially valid',
        data: { checked_entries: 0, valid: true },
        checked_at,
      }
    }

    return {
      check: 'audit_chain',
      status: result.valid ? 'pass' : 'fail',
      score: result.valid ? 100 : 0,
      details: result.valid
        ? `SHA-256 chain intact across ${result.checked_entries} entries`
        : `Chain broken at sequence_number ${result.first_broken_sequence} (checked ${result.checked_entries} entries)`,
      data: {
        valid: result.valid,
        checked_entries: result.checked_entries,
        first_broken_sequence: result.first_broken_sequence,
      },
      checked_at,
    }
  } catch (err) {
    log.warn('[systemIntegrityValidator] checkAuditChain error', { tenant_id: tenantId, error: String(err) })
    return {
      check: 'audit_chain',
      status: 'fail',
      score: 0,
      details: `Check error: ${err instanceof Error ? err.message : String(err)}`,
      data: {},
      checked_at,
    }
  }
}

// ─── Grade helper ─────────────────────────────────────────────────────────────

function toGrade(score: number): SystemIntegrityReport['sre_grade'] {
  if (score >= 95) return 'S'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

// ─── runSystemIntegrityCheck ──────────────────────────────────────────────────

export async function runSystemIntegrityCheck(tenantId: string): Promise<SystemIntegrityReport> {
  const id           = randomUUID()
  const generated_at = new Date().toISOString()

  // Run all 5 checks in parallel
  const [r1, r2, r3, r4, r5] = await Promise.allSettled([
    checkEventLoss(tenantId),
    checkReplayConsistency(tenantId),
    checkMLReproducibility(tenantId),
    checkDBIntegrity(tenantId),
    checkAuditChain(tenantId),
  ])

  function extract(settled: PromiseSettledResult<IntegrityCheckResult>, check: IntegrityCheckType): IntegrityCheckResult {
    if (settled.status === 'fulfilled') return settled.value
    return {
      check,
      status: 'fail',
      score: 0,
      details: `Unexpected error: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
      data: {},
      checked_at: generated_at,
    }
  }

  const checks: IntegrityCheckResult[] = [
    extract(r1, 'event_loss'),
    extract(r2, 'replay_consistency'),
    extract(r3, 'ml_reproducibility'),
    extract(r4, 'db_integrity'),
    extract(r5, 'audit_chain'),
  ]

  // Weighted overall score
  const overall_score = Math.round(
    checks.reduce((sum, c) => sum + c.score * WEIGHTS[c.check], 0) * 100,
  ) / 100

  // Determine overall_status
  const hasFail = checks.some(c => c.status === 'fail')
  const hasWarn = checks.some(c => c.status === 'warn')
  const overall_status: CheckStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass'

  // Collect critical issues and warnings
  const critical_issues: string[] = checks
    .filter(c => c.status === 'fail')
    .map(c => `[${c.check}] ${c.details}`)

  const warnings: string[] = checks
    .filter(c => c.status === 'warn')
    .map(c => `[${c.check}] ${c.details}`)

  const sre_grade = toGrade(overall_score)

  const report: SystemIntegrityReport = {
    id,
    tenant_id: tenantId,
    overall_status,
    overall_score,
    checks,
    critical_issues,
    warnings,
    sre_grade,
    generated_at,
  }

  // Persist (fire-and-forget)
  void (async () => {
    try {
      await (supabaseAdmin as any)
        .from('integrity_check_results')
        .insert({
          id,
          tenant_id:      tenantId,
          overall_status,
          overall_score,
          sre_grade,
          checks:         JSON.stringify(checks),
          critical_issues,
          warnings,
          generated_at,
        })
    } catch (e) {
      log.warn('[systemIntegrityValidator] persist failed', { tenant_id: tenantId, error: String(e) })
    }
  })()

  log.info('[systemIntegrityValidator] integrity check complete', {
    tenant_id:      tenantId,
    overall_status,
    overall_score,
    sre_grade,
  })

  return report
}

// ─── getLatestIntegrityReport ─────────────────────────────────────────────────

export async function getLatestIntegrityReport(tenantId: string): Promise<SystemIntegrityReport | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('integrity_check_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

    if (error || !data) return null
    return toReport(data)
  } catch (err) {
    log.warn('[systemIntegrityValidator] getLatestIntegrityReport error', { tenant_id: tenantId, error: String(err) })
    return null
  }
}

// ─── getIntegrityHistory ──────────────────────────────────────────────────────

export async function getIntegrityHistory(tenantId: string, limit = 20): Promise<SystemIntegrityReport[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('integrity_check_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(Math.min(limit, 100)) as {
        data: Array<Record<string, unknown>> | null
        error: { message: string } | null
      }

    if (error || !data) return []
    return data.map(toReport)
  } catch (err) {
    log.warn('[systemIntegrityValidator] getIntegrityHistory error', { tenant_id: tenantId, error: String(err) })
    return []
  }
}

// ─── Row → Report ─────────────────────────────────────────────────────────────

function toReport(row: Record<string, unknown>): SystemIntegrityReport {
  return {
    id:              String(row['id'] ?? ''),
    tenant_id:       String(row['tenant_id'] ?? ''),
    overall_status:  (row['overall_status'] as CheckStatus) ?? 'fail',
    overall_score:   Number(row['overall_score'] ?? 0),
    checks:          Array.isArray(row['checks']) ? (row['checks'] as IntegrityCheckResult[]) : [],
    critical_issues: Array.isArray(row['critical_issues']) ? (row['critical_issues'] as string[]) : [],
    warnings:        Array.isArray(row['warnings']) ? (row['warnings'] as string[]) : [],
    sre_grade:       (row['sre_grade'] as SystemIntegrityReport['sre_grade']) ?? 'D',
    generated_at:    String(row['generated_at'] ?? new Date().toISOString()),
  }
}
